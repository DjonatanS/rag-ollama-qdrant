package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/DjonatanS/rag-ollama-qdrant-go/internal/infra/llm"
	"github.com/DjonatanS/rag-ollama-qdrant-go/internal/infra/loader"
	"github.com/DjonatanS/rag-ollama-qdrant-go/internal/infra/splitter"
	"github.com/DjonatanS/rag-ollama-qdrant-go/internal/infra/vectorstore"
	"github.com/DjonatanS/rag-ollama-qdrant-go/internal/usecase"
)

const (
	// Configuration
	pdfDir         = "data/pdfs" // Directory containing PDFs
	pdfPattern     = "*.pdf"     // Pattern to match PDF files
	qdrantURL      = "http://localhost:6333"
	collectionName = "my_collection"
	embedModel     = "nomic-embed-text"
	genModel       = "deepseek-r1:8b"
	vectorSize     = 768 // Dimension for nomic-embed-text
	chunkSize      = 1000
	chunkOverlap   = 100
)

func main() {
	ctx := context.Background()
	log.Println("Starting RAG application...")

	// Processar argumentos da linha de comando
	var mode string
	var query string
	var perPdf bool

	// Verificar se o modo está especificado
	if len(os.Args) > 1 {
		mode = strings.ToLower(os.Args[1])
	}

	// Verificar se uma pergunta foi fornecida
	if len(os.Args) > 2 {
		query = os.Args[2]
	} else {
		query = "Qual a habilidade mais importante na era da Inteligência Artificial?"
	}

	// Se o modo é help, mostrar instruções
	if mode == "help" {
		fmt.Println("Uso: ragapp [modo] [pergunta]")
		fmt.Println("Modos:")
		fmt.Println("  ingest    - Apenas ingere os documentos (padrão: uma coleção)")
		fmt.Println("  ingest-per-pdf - Ingere documentos criando uma coleção por PDF")
		fmt.Println("  query     - Apenas consulta os documentos (padrão: uma coleção)")
		fmt.Println("  stream    - Consulta com saída em streaming")
		fmt.Println("  all       - Ingere e consulta (padrão)")
		fmt.Println("  help      - Mostra esta ajuda")
		fmt.Println("\nExemplos:")
		fmt.Println("  ragapp ingest-per-pdf")
		fmt.Println("  ragapp stream \"Como monitorar o desempenho de containers com Go?\"")
		return
	}

	// Se o modo é ingest-per-pdf, configurar a flag correspondente
	if mode == "ingest-per-pdf" {
		perPdf = true
		mode = "ingest" // Normalizar para o switch abaixo
	}

	log.Println("Initializing components...")

	pdfLoader := loader.NewPDFLoader()
	textSplitter := splitter.NewRecursiveCharacterSplitter(chunkSize, chunkOverlap)

	embedder, err := llm.NewOllamaEmbedder(embedModel)
	if err != nil {
		log.Fatalf("Failed to initialize Ollama embedder: %v", err)
	}

	qdrantStore, err := vectorstore.NewQdrantVectorStore(qdrantURL, embedder)
	if err != nil {
		log.Fatalf("Failed to initialize Qdrant vector store: %v", err)
	}

	// Criar QdrantRetriever para suporte a múltiplas coleções
	qdrantRetriever, err := vectorstore.NewQdrantRetriever(qdrantURL, embedder)
	if err != nil {
		log.Fatalf("Failed to initialize Qdrant retriever: %v", err)
	}

	generatorLLM, err := llm.NewOllamaLLM(genModel)
	if err != nil {
		log.Fatalf("Failed to initialize Ollama generation LLM: %v", err)
	}

	log.Println("Components initialized.")

	// Use Cases
	ingestionUC := usecase.NewIngestionUseCase(pdfLoader, textSplitter, embedder, qdrantStore)
	queryUC := usecase.NewQueryUseCase(embedder, qdrantRetriever, generatorLLM)

	// Executar o modo selecionado
	switch mode {
	case "ingest":
		// Apenas ingestão
		log.Println("--- Starting Ingestion Phase ---")
		if perPdf {
			err = ingestionUC.ExecutePerPDF(ctx, pdfDir, pdfPattern, vectorSize)
		} else {
			err = ingestionUC.Execute(ctx, pdfDir, pdfPattern, collectionName, vectorSize)
		}
		if err != nil {
			log.Fatalf("Ingestion failed: %v", err)
		}
		log.Println("--- Ingestion Phase Complete ---")

	case "query":
		// Apenas consulta padrão (sem streaming)
		log.Println("--- Starting Query Phase ---")
		executeStandardQuery(ctx, queryUC, qdrantRetriever, query)
		log.Println("--- Query Phase Complete ---")

	case "stream":
		// Consulta com resposta em streaming
		log.Println("--- Starting Streaming Query Phase ---")
		executeStreamingQuery(ctx, queryUC, qdrantRetriever, query)
		log.Println("--- Streaming Query Phase Complete ---")

	default:
		// Modo padrão: ingestão seguida de consulta
		log.Println("--- Starting Ingestion Phase ---")
		if perPdf {
			err = ingestionUC.ExecutePerPDF(ctx, pdfDir, pdfPattern, vectorSize)
		} else {
			err = ingestionUC.Execute(ctx, pdfDir, pdfPattern, collectionName, vectorSize)
		}
		if err != nil {
			log.Fatalf("Ingestion failed: %v", err)
		}
		log.Println("--- Ingestion Phase Complete ---")

		log.Println("--- Starting Query Phase ---")
		if perPdf {
			executeStreamingMultiCollectionQuery(ctx, queryUC, qdrantRetriever, query)
		} else {
			executeStandardQuery(ctx, queryUC, qdrantRetriever, query)
		}
		log.Println("--- Query Phase Complete ---")
	}

	log.Println("RAG application finished.")
}

// executeStandardQuery executa uma consulta padrão em uma única coleção
func executeStandardQuery(ctx context.Context, queryUC *usecase.QueryUseCase, retriever *vectorstore.QdrantRetriever, query string) {
	log.Printf("\n=== Query ===\n%s\n", query)

	answer, relevantDocs, err := queryUC.Execute(ctx, query)
	if err != nil {
		log.Fatalf("Query failed: %v", err)
	}

	log.Printf("\n=== Answer ===\n%s\n", answer)

	log.Println("\n=== Relevant Documents Retrieved ===")
	for i, doc := range relevantDocs {
		log.Printf("--- Document %d (Score: %.4f) ---", i+1, doc.Metadata["score"])
		log.Printf("Source: %s", doc.Metadata["source"])
		log.Printf("Content: %s\n", doc.PageContent)
	}
}

// executeStreamingQuery executa uma consulta com resposta em streaming
func executeStreamingQuery(ctx context.Context, queryUC *usecase.QueryUseCase, retriever *vectorstore.QdrantRetriever, query string) {
	log.Printf("\n=== Query ===\n%s\n", query)
	log.Printf("\n=== Answer (streaming) ===\n")

	// Definir callback para exibir cada parte da resposta
	streamCallback := func(chunk string) {
		fmt.Print(chunk)
	}

	// Lista todas as coleções disponíveis
	collections, err := retriever.ListCollections(ctx)
	if err != nil {
		log.Fatalf("Failed to list collections: %v", err)
	}

	// Se houver apenas uma coleção ou for a coleção padrão, use a consulta de streaming padrão
	if len(collections) <= 1 || (len(collections) == 1 && collections[0] == collectionName) {
		relevantDocs, err := queryUC.ExecuteWithStreaming(ctx, query, collectionName, streamCallback)
		if err != nil {
			log.Fatalf("Streaming query failed: %v", err)
		}

		fmt.Println() // Nova linha após resposta completa

		log.Println("\n=== Relevant Documents Retrieved ===")
		for i, doc := range relevantDocs {
			log.Printf("--- Document %d (Score: %.4f) ---", i+1, doc.Metadata["score"])
			log.Printf("Source: %s", doc.Metadata["source"])
			log.Printf("Content: %s\n", doc.PageContent)
		}
	} else {
		// Se houver múltiplas coleções, use a consulta de streaming multicoleção
		executeStreamingMultiCollectionQuery(ctx, queryUC, retriever, query)
	}
}

// executeStreamingMultiCollectionQuery executa uma consulta em múltiplas coleções com streaming
func executeStreamingMultiCollectionQuery(ctx context.Context, queryUC *usecase.QueryUseCase, retriever *vectorstore.QdrantRetriever, query string) {
	log.Printf("\n=== Multi-Collection Query ===\n%s\n", query)
	log.Printf("\n=== Answer (streaming from multiple collections) ===\n")

	// Definir callback para exibir cada parte da resposta
	streamCallback := func(chunk string) {
		fmt.Print(chunk)
	}

	// Listar todas as coleções disponíveis
	collections, err := retriever.ListCollections(ctx)
	if err != nil {
		log.Fatalf("Failed to list collections: %v", err)
	}

	if len(collections) == 0 {
		log.Fatalf("No collections found in Qdrant")
	}

	log.Printf("Found %d collections: %v", len(collections), collections)

	// Executar consulta em todas as coleções encontradas
	relevantDocs, err := queryUC.ExecuteWithStreamingMultiCollection(ctx, query, collections, 2, streamCallback)
	if err != nil {
		log.Fatalf("Multi-collection streaming query failed: %v", err)
	}

	fmt.Println() // Nova linha após resposta completa

	log.Println("\n=== Relevant Documents Retrieved ===")
	for i, doc := range relevantDocs {
		collection := "unknown"
		if coll, ok := doc.Metadata["collection"].(string); ok {
			collection = coll
		}

		log.Printf("--- Document %d (Collection: %s, Score: %.4f) ---", i+1, collection, doc.Metadata["score"])
		log.Printf("Source: %s", doc.Metadata["source"])
		log.Printf("Content: %s\n", doc.PageContent)
	}
}
