package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/DjonatanS/rag-ollama-qdrant-go/internal/infra/llm"
	"github.com/DjonatanS/rag-ollama-qdrant-go/internal/infra/loader"
	"github.com/DjonatanS/rag-ollama-qdrant-go/internal/infra/splitter"
	"github.com/DjonatanS/rag-ollama-qdrant-go/internal/infra/vectorstore"
	"github.com/DjonatanS/rag-ollama-qdrant-go/internal/usecase"
)

const (
	pdfDir         = "data/pdfs"
	uploadDir      = "data/uploads"
	qdrantURL      = "http://localhost:6333"
	collectionName = "my_collection"
	embedModel     = "nomic-embed-text"
	genModel       = "deepseek-r1:8b"
	vectorSize     = 768
	chunkSize      = 1000
	chunkOverlap   = 100
	port           = 8020
)

func main() {
	ctx := context.Background()

	// Garantir que os diretórios necessários existam
	os.MkdirAll(pdfDir, 0755)
	os.MkdirAll(uploadDir, 0755)

	// Instanciar componentes do RAG
	embedder, err := llm.NewOllamaEmbedder(embedModel)
	if err != nil {
		log.Fatalf("Falha ao criar embedder: %v", err)
	}

	queryLLM, err := llm.NewOllamaLLM(genModel)
	if err != nil {
		log.Fatalf("Falha ao criar LLM: %v", err)
	}

	// Instanciar o adaptador do Qdrant (vector store)
	vectorStore, err := vectorstore.NewQdrantVectorStore(qdrantURL, embedder)
	if err != nil {
		log.Fatalf("Falha ao criar adaptador do Qdrant: %v", err)
	}

	// Ensure the collection exists
	if err := vectorStore.EnsureCollection(ctx, collectionName, vectorSize); err != nil {
		log.Fatalf("Falha ao garantir coleção: %v", err)
	}

	// Configurar rotas
	mux := http.NewServeMux()

	// Servir arquivos estáticos
	fs := http.FileServer(http.Dir("web/static"))
	mux.Handle("/static/", http.StripPrefix("/static/", fs))

	// Rota principal (página inicial)
	mux.HandleFunc("/", serveIndex)

	// API para consultas padrão
	mux.HandleFunc("/api/query", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Método não permitido", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			Question string `json:"question"`
		}

		err := json.NewDecoder(r.Body).Decode(&req)
		if err != nil {
			http.Error(w, "Falha ao decodificar requisição", http.StatusBadRequest)
			return
		}

		// Criar o caso de uso de consulta
		queryUseCase := usecase.NewQueryUseCase(embedder, vectorStore, queryLLM)
		answer, _, err := queryUseCase.Execute(ctx, req.Question)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"answer": answer})
	})

	// API para consultas com streaming
	mux.HandleFunc("/api/stream", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Método não permitido", http.StatusMethodNotAllowed)
			return
		}

		question := r.URL.Query().Get("question")
		if question == "" {
			http.Error(w, "Pergunta não especificada", http.StatusBadRequest)
			return
		}

		// Criar o caso de uso de consulta
		queryUseCase := usecase.NewQueryUseCase(embedder, vectorStore, queryLLM)

		// Configurar o stream SSE
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "Streaming não suportado", http.StatusInternalServerError)
			return
		}

		// Callback para processar o streaming
		streamCallback := func(chunk string) {
			fmt.Fprintf(w, "data: %s\n\n", chunk)
			flusher.Flush()
		}

		// Executar a query com streaming
		err := queryUseCase.ExecuteStreaming(ctx, question, streamCallback)
		if err != nil {
			// Enviar o erro como evento
			fmt.Fprintf(w, "data: Erro: %s\n\n", err.Error())
			flusher.Flush()
		}

		// Sinalizar o fim do stream
		fmt.Fprintf(w, "data: [DONE]\n\n")
		flusher.Flush()
	})

	// API para ingestão de documentos
	mux.HandleFunc("/api/ingest", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Método não permitido", http.StatusMethodNotAllowed)
			return
		}

		// Limitar o tamanho do upload para 32MB
		r.Body = http.MaxBytesReader(w, r.Body, 32<<20)
		if err := r.ParseMultipartForm(32 << 20); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "Arquivo muito grande (máximo 32MB)"})
			return
		}

		// Verificar se é para criar coleções por PDF
		perPdfParam := r.FormValue("perPdf")
		perPdf := perPdfParam == "true"

		// Obter os arquivos enviados
		files := r.MultipartForm.File["pdfs"]
		if len(files) == 0 {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "Nenhum arquivo enviado"})
			return
		}

		// Diretório para salvar os uploads
		timestamp := time.Now().Format("20060102150405")
		uploadSubDir := filepath.Join(uploadDir, timestamp)
		if err := os.MkdirAll(uploadSubDir, 0755); err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": "Erro ao criar diretório de upload"})
			return
		}

		// Processar os arquivos
		processedFiles := 0
		for _, fileHeader := range files {
			// Verificar a extensão
			if !strings.HasSuffix(strings.ToLower(fileHeader.Filename), ".pdf") {
				continue // Ignorar arquivos não-PDF
			}

			// Salvar o arquivo
			pdfPath, err := saveUploadedFile(fileHeader, uploadSubDir)
			if err != nil {
				log.Printf("Erro ao salvar arquivo %s: %v", fileHeader.Filename, err)
				continue
			}

			// Processar o PDF
			if perPdf {
				// Usar o nome do arquivo (sem extensão) como nome da coleção
				baseName := strings.TrimSuffix(filepath.Base(fileHeader.Filename), filepath.Ext(fileHeader.Filename))
				colName := strings.ReplaceAll(baseName, " ", "_")
				colName = strings.ToLower(colName)

				// Criar uma nova instância do vector store para esta coleção
				pdfVectorStore, err := vectorstore.NewQdrantVectorStore(qdrantURL, embedder)
				if err != nil {
					log.Printf("Erro ao criar adaptador do Qdrant para %s: %v", colName, err)
					continue
				}

				// Ensure the collection exists for this PDF
				if err := pdfVectorStore.EnsureCollection(ctx, colName, vectorSize); err != nil {
					log.Printf("Erro ao garantir coleção para %s: %v", colName, err)
					continue
				}

				// Criar e executar o caso de uso de ingestão para este PDF
				pdfLoader := loader.NewPDFLoader()
				textSplitter := splitter.NewRecursiveCharacterSplitter(chunkSize, chunkOverlap)
				ingestionUseCase := usecase.NewIngestionUseCase(pdfLoader, textSplitter, embedder, pdfVectorStore)

				// Extract directory and use the single PDF file as the pattern
				pdfDir := filepath.Dir(pdfPath)
				pdfFile := filepath.Base(pdfPath)

				err = ingestionUseCase.Execute(ctx, pdfDir, pdfFile, colName, vectorSize)
				if err != nil {
					log.Printf("Erro ao processar %s: %v", fileHeader.Filename, err)
					continue
				}
			} else {
				// Usar a coleção padrão para todos os PDFs
				pdfLoader := loader.NewPDFLoader()
				textSplitter := splitter.NewRecursiveCharacterSplitter(chunkSize, chunkOverlap)
				ingestionUseCase := usecase.NewIngestionUseCase(pdfLoader, textSplitter, embedder, vectorStore)

				// Extract directory and use the single PDF file as the pattern
				pdfDir := filepath.Dir(pdfPath)
				pdfFile := filepath.Base(pdfPath)

				err = ingestionUseCase.Execute(ctx, pdfDir, pdfFile, collectionName, vectorSize)
				if err != nil {
					log.Printf("Erro ao processar %s: %v", fileHeader.Filename, err)
					continue
				}
			}

			processedFiles++
		}

		if processedFiles == 0 {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "Nenhum arquivo PDF válido foi processado"})
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"message": fmt.Sprintf("%d arquivos processados com sucesso", processedFiles),
		})
	})

	// Iniciar o servidor
	serverAddr := fmt.Sprintf(":%d", port)
	log.Printf("Servidor iniciado em http://localhost%s", serverAddr)
	log.Fatal(http.ListenAndServe(serverAddr, mux))
}

func serveIndex(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}

	http.ServeFile(w, r, "web/templates/index.html")
}

// saveUploadedFile salva um arquivo enviado e retorna o caminho completo
func saveUploadedFile(fileHeader *multipart.FileHeader, destDir string) (string, error) {
	src, err := fileHeader.Open()
	if err != nil {
		return "", err
	}
	defer src.Close()

	destPath := filepath.Join(destDir, fileHeader.Filename)
	dest, err := os.Create(destPath)
	if err != nil {
		return "", err
	}
	defer dest.Close()

	if _, err := io.Copy(dest, src); err != nil {
		return "", err
	}

	return destPath, nil
}
