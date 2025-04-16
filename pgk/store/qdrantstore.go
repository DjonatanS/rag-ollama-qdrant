package store

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"

	"github.com/google/uuid"
	"github.com/tmc/langchaingo/embeddings"
	"github.com/tmc/langchaingo/schema"
	"github.com/tmc/langchaingo/vectorstores/qdrant"
)

// QdrantStore é um wrapper para o Store do pacote qdrant
type QdrantStore struct {
	store          qdrant.Store
	embedder       embeddings.Embedder
	baseURL        string
	collectionName string
}

// Estrutura correta para criar uma coleção no Qdrant
type CreateCollectionRequest struct {
	Vectors map[string]VectorParams `json:"vectors"`
}

type VectorParams struct {
	Size     int    `json:"size"`
	Distance string `json:"distance"`
}

// Estruturas para inserção de pontos
type UpsertPointsRequest struct {
	Points []Point `json:"points"`
	Wait   bool    `json:"wait"`
}

type Point struct {
	ID      string                 `json:"id"`
	Vector  map[string][]float32   `json:"vector"`
	Payload map[string]interface{} `json:"payload"`
}

// NewQdrantStore cria uma nova instância do QdrantStore
func NewQdrantStore(ctx context.Context, urlStr, collectionName string, embedder embeddings.Embedder) (*QdrantStore, error) {
	qdrantURL, err := url.Parse(urlStr)
	if err != nil {
		return nil, err
	}

	// Verificar se a coleção existe e criar se necessário
	qdrantStore := &QdrantStore{
		baseURL:        urlStr,
		collectionName: collectionName,
		embedder:       embedder,
	}

	// Verificar e criar coleção se necessário
	if err := qdrantStore.ensureCollectionExists(ctx); err != nil {
		return nil, fmt.Errorf("falha ao verificar/criar coleção: %w", err)
	}

	store, err := qdrant.New(
		qdrant.WithURL(*qdrantURL),
		qdrant.WithCollectionName(collectionName),
		qdrant.WithEmbedder(embedder),
	)

	if err != nil {
		return nil, err
	}

	qdrantStore.store = store
	return qdrantStore, nil
}

// ensureCollectionExists verifica se a coleção existe e cria se necessário
func (s *QdrantStore) ensureCollectionExists(ctx context.Context) error {
	// 1. Verificar se a coleção existe
	exists, err := s.collectionExists(ctx)
	if err != nil {
		return err
	}

	// 2. Se não existe, criar
	if !exists {
		return s.createCollection(ctx)
	}

	return nil
}

// collectionExists verifica se a coleção existe
func (s *QdrantStore) collectionExists(ctx context.Context) (bool, error) {
	url := fmt.Sprintf("%s/collections/%s", s.baseURL, s.collectionName)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return false, err
	}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	// Se código 404, coleção não existe
	if resp.StatusCode == http.StatusNotFound {
		return false, nil
	}

	// Se outro código diferente de 200, erro desconhecido
	if resp.StatusCode != http.StatusOK {
		return false, fmt.Errorf("erro ao verificar coleção, status: %d", resp.StatusCode)
	}

	// Coleção existe
	return true, nil
}

// createCollection cria uma nova coleção no Qdrant
func (s *QdrantStore) createCollection(ctx context.Context) error {
	url := fmt.Sprintf("%s/collections/%s", s.baseURL, s.collectionName)

	// Corrigindo o tamanho do vetor para 768 - compatível com o modelo nomic-embed-text
	createRequest := CreateCollectionRequest{
		Vectors: map[string]VectorParams{
			"default": {
				Size:     768, // Alterado de 1536 para 768 para corresponder ao modelo nomic-embed-text
				Distance: "Cosine",
			},
		},
	}

	jsonData, err := json.Marshal(createRequest)
	if err != nil {
		return err
	}

	fmt.Printf("Payload para criar coleção: %s\n", string(jsonData))

	req, err := http.NewRequestWithContext(ctx, "PUT", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("erro ao criar coleção, status: %d, resposta: %s", resp.StatusCode, string(bodyBytes))
	}

	fmt.Printf("Coleção '%s' criada com sucesso\n", s.collectionName)
	return nil
}

// AddDocuments adiciona documentos ao store usando nossa própria implementação
func (s *QdrantStore) AddDocuments(ctx context.Context, docs []schema.Document) ([]string, error) {
	ids := make([]string, len(docs))
	points := make([]Point, len(docs))

	// Para cada documento, criar um ponto para inserção
	for i, doc := range docs {
		// Gerar ID único
		id := uuid.New().String()
		ids[i] = id

		// Gerar embedding para o conteúdo do documento
		embeddings, err := s.embedder.EmbedDocuments(ctx, []string{doc.PageContent})
		if err != nil {
			return nil, fmt.Errorf("erro ao gerar embedding para documento: %w", err)
		}

		// Importante: usar "default" como nome do vetor
		points[i] = Point{
			ID: id,
			Vector: map[string][]float32{
				"default": embeddings[0],
			},
			Payload: map[string]interface{}{
				"text":     doc.PageContent,
				"metadata": doc.Metadata,
			},
		}
	}

	// Criar payload para inserção
	upsertRequest := UpsertPointsRequest{
		Points: points,
		Wait:   true,
	}

	jsonData, err := json.Marshal(upsertRequest)
	if err != nil {
		return nil, err
	}

	fmt.Printf("Inserindo %d documentos na coleção '%s'\n", len(docs), s.collectionName)

	// Fazer requisição de inserção
	url := fmt.Sprintf("%s/collections/%s/points", s.baseURL, s.collectionName)
	req, err := http.NewRequestWithContext(ctx, "PUT", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("erro ao inserir pontos, status: %d, resposta: %s", resp.StatusCode, string(bodyBytes))
	}

	return ids, nil
}

// GetRelevantDocuments recupera documentos relevantes para uma consulta
func (s *QdrantStore) GetRelevantDocuments(ctx context.Context, query string) ([]schema.Document, error) {
	return s.SimilaritySearch(ctx, query, 4)
}

// SimilaritySearch implementa uma busca por similaridade customizada
func (s *QdrantStore) SimilaritySearch(ctx context.Context, query string, numDocuments int) ([]schema.Document, error) {
	// Gerar embedding para a consulta
	embedding, err := s.embedder.EmbedQuery(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("erro ao gerar embedding para consulta: %w", err)
	}

	// Criar payload para busca com o formato correto para Qdrant
	searchRequest := struct {
		Vector      interface{} `json:"vector"`
		Limit       int         `json:"limit"`
		WithPayload bool        `json:"with_payload"`
		WithVector  bool        `json:"with_vector"`
	}{
		// Use o formato correto que o Qdrant espera para NamedVectorStruct
		Vector: struct {
			Name   string    `json:"name"`
			Vector []float32 `json:"vector"`
		}{
			Name:   "default",
			Vector: embedding,
		},
		Limit:       numDocuments,
		WithPayload: true,
		WithVector:  false,
	}

	jsonData, err := json.Marshal(searchRequest)
	if err != nil {
		return nil, err
	}

	// Log para debug
	fmt.Printf("Payload de busca: %s\n", string(jsonData))

	// Fazer requisição de busca
	url := fmt.Sprintf("%s/collections/%s/points/search", s.baseURL, s.collectionName)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("erro na busca, status: %d, resposta: %s", resp.StatusCode, string(bodyBytes))
	}

	// Processar resposta
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	// Extrair resultados
	resultList, ok := result["result"].([]interface{})
	if !ok {
		return nil, fmt.Errorf("formato de resposta inválido")
	}

	// Converter para documentos
	documents := make([]schema.Document, 0, len(resultList))
	for _, item := range resultList {
		record, ok := item.(map[string]interface{})
		if !ok {
			continue
		}

		payload, ok := record["payload"].(map[string]interface{})
		if !ok {
			continue
		}

		text, ok := payload["text"].(string)
		if !ok {
			continue
		}

		var metadata map[string]interface{}
		if meta, ok := payload["metadata"].(map[string]interface{}); ok {
			metadata = meta
		} else {
			metadata = make(map[string]interface{})
		}

		// Adicionar score ao metadata se disponível
		if score, ok := record["score"].(float64); ok {
			metadata["score"] = score
		}

		documents = append(documents, schema.Document{
			PageContent: text,
			Metadata:    metadata,
		})
	}

	return documents, nil
}

// Ensure que QdrantStore implementa a interface schema.Retriever
var _ schema.Retriever = (*QdrantStore)(nil)
