package vectorstore

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"

	"github.com/DjonatanS/rag-ollama-qdrant-go/internal/usecase"
	"github.com/google/uuid"
	"github.com/tmc/langchaingo/schema"
)

// QdrantVectorStore implements the usecase.VectorStore and usecase.Retriever interfaces using Qdrant.
type QdrantVectorStore struct {
	baseURL  string
	embedder usecase.EmbeddingGenerator // Embedder needed for GetRelevantDocuments
	client   *http.Client
}

// --- Qdrant API Structures ---

type CreateCollectionRequest struct {
	Vectors map[string]VectorParams `json:"vectors"`
}

type VectorParams struct {
	Size     int    `json:"size"`
	Distance string `json:"distance"` // e.g., "Cosine", "Euclid", "Dot"
}

type UpsertPointsRequest struct {
	Points []Point `json:"points"`
	Wait   bool    `json:"wait"`
}

type Point struct {
	ID      string                 `json:"id"`
	Vector  map[string][]float32   `json:"vector"` // Assuming single vector named "default"
	Payload map[string]interface{} `json:"payload"`
}

type SearchRequest struct {
	Vector      NamedVector `json:"vector"`
	Limit       int         `json:"limit"`
	WithPayload bool        `json:"with_payload"`
	WithVector  bool        `json:"with_vector"`
}

type NamedVector struct {
	Name   string    `json:"name"`
	Vector []float32 `json:"vector"`
}

type SearchResponse struct {
	Result []SearchResult `json:"result"`
	Status string         `json:"status"`
	Time   float64        `json:"time"`
}

type SearchResult struct {
	ID      string                 `json:"id"`
	Version int                    `json:"version"`
	Score   float64                `json:"score"`
	Payload map[string]interface{} `json:"payload"`
	Vector  interface{}            `json:"vector"` // Can be map[string][]float32 or []float32 depending on request
}

// --- Adapter Implementation ---

// NewQdrantVectorStore creates a new QdrantVectorStore adapter.
func NewQdrantVectorStore(baseURL string, embedder usecase.EmbeddingGenerator) (*QdrantVectorStore, error) {
	// Validate URL
	_, err := url.Parse(baseURL)
	if err != nil {
		return nil, fmt.Errorf("invalid Qdrant base URL: %w", err)
	}
	return &QdrantVectorStore{
		baseURL:  baseURL,
		embedder: embedder,
		client:   &http.Client{},
	}, nil
}

// EnsureCollection checks if a collection exists and creates it if not.
func (s *QdrantVectorStore) EnsureCollection(ctx context.Context, collectionName string, vectorSize int) error {
	exists, err := s.collectionExists(ctx, collectionName)
	if err != nil {
		return fmt.Errorf("failed to check if collection '%s' exists: %w", collectionName, err)
	}
	if !exists {
		return s.createCollection(ctx, collectionName, vectorSize)
	}
	return nil
}

// DeleteCollection deletes a Qdrant collection.
func (s *QdrantVectorStore) DeleteCollection(ctx context.Context, collectionName string) error {
	url := fmt.Sprintf("%s/collections/%s", s.baseURL, collectionName)
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, url, nil)
	if err != nil {
		return fmt.Errorf("failed to create delete request for collection '%s': %w", collectionName, err)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to execute delete request for collection '%s': %w", collectionName, err)
	}
	defer resp.Body.Close()

	// 404 is acceptable (means it didn't exist)
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNotFound {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to delete collection '%s', status: %d, response: %s", collectionName, resp.StatusCode, string(bodyBytes))
	}

	if resp.StatusCode == http.StatusOK {
		fmt.Printf("Collection '%s' deleted successfully\n", collectionName)
	}
	return nil
}

// AddDocuments adds documents with pre-generated embeddings to the specified collection.
func (s *QdrantVectorStore) AddDocuments(ctx context.Context, collectionName string, docs []schema.Document, embeddings [][]float32) ([]string, error) {
	if len(docs) != len(embeddings) {
		return nil, fmt.Errorf("number of documents (%d) does not match number of embeddings (%d)", len(docs), len(embeddings))
	}

	ids := make([]string, len(docs))
	points := make([]Point, len(docs))

	for i, doc := range docs {
		pointID := uuid.New().String()
		ids[i] = pointID

		payload := map[string]interface{}{}
		// Preserve existing metadata and add text
		if doc.Metadata != nil {
			for k, v := range doc.Metadata {
				payload[k] = v
			}
		}
		payload["text"] = doc.PageContent // Ensure text is in payload

		points[i] = Point{
			ID: pointID,
			Vector: map[string][]float32{
				"default": embeddings[i], // Assuming the vector name is "default"
			},
			Payload: payload,
		}
	}

	upsertReq := UpsertPointsRequest{
		Points: points,
		Wait:   true, // Wait for operation to complete
	}

	jsonData, err := json.Marshal(upsertReq)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal upsert request: %w", err)
	}

	url := fmt.Sprintf("%s/collections/%s/points", s.baseURL, collectionName)
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create upsert request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute upsert request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to upsert points to collection '%s', status: %d, response: %s", collectionName, resp.StatusCode, string(bodyBytes))
	}

	return ids, nil
}

// SimilaritySearch performs a search using a pre-generated query embedding.
func (s *QdrantVectorStore) SimilaritySearch(ctx context.Context, collectionName string, queryEmbedding []float32, numDocuments int) ([]schema.Document, error) {
	searchReq := SearchRequest{
		Vector: NamedVector{
			Name:   "default", // Assuming the vector name is "default"
			Vector: queryEmbedding,
		},
		Limit:       numDocuments,
		WithPayload: true,
		WithVector:  false, // Usually not needed for RAG
	}

	jsonData, err := json.Marshal(searchReq)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal search request: %w", err)
	}

	url := fmt.Sprintf("%s/collections/%s/points/search", s.baseURL, collectionName)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create search request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute search request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("search request failed for collection '%s', status: %d, response: %s", collectionName, resp.StatusCode, string(bodyBytes))
	}

	var searchResp SearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&searchResp); err != nil {
		return nil, fmt.Errorf("failed to decode search response: %w", err)
	}

	// Convert search results to schema.Document
	documents := make([]schema.Document, 0, len(searchResp.Result))
	for _, res := range searchResp.Result {
		text, ok := res.Payload["text"].(string)
		if !ok {
			// If text is not directly in payload, skip or handle differently
			continue
		}

		metadata := make(map[string]interface{})
		for k, v := range res.Payload {
			if k != "text" { // Avoid duplicating text in metadata
				metadata[k] = v
			}
		}
		metadata["score"] = res.Score // Add similarity score to metadata

		documents = append(documents, schema.Document{
			PageContent: text,
			Metadata:    metadata,
		})
	}

	return documents, nil
}

// GetRelevantDocuments implements the usecase.Retriever interface.
// It embeds the query and then calls SimilaritySearch.
// Assumes the collection name is implicitly known or needs to be configured.
// For simplicity, using a hardcoded collection name here, but should be configurable.
func (s *QdrantVectorStore) GetRelevantDocuments(ctx context.Context, query string) ([]schema.Document, error) {
	collectionName := "my_collection" // TODO: Make this configurable
	numDocuments := 4                 // TODO: Make this configurable

	queryEmbedding, err := s.embedder.EmbedQuery(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to embed query for retrieval: %w", err)
	}

	return s.SimilaritySearch(ctx, collectionName, queryEmbedding, numDocuments)
}

// --- Helper Methods ---

func (s *QdrantVectorStore) collectionExists(ctx context.Context, collectionName string) (bool, error) {
	url := fmt.Sprintf("%s/collections/%s", s.baseURL, collectionName)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return false, err
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		return true, nil
	}
	if resp.StatusCode == http.StatusNotFound {
		return false, nil
	}

	return false, fmt.Errorf("unexpected status code %d when checking collection '%s'", resp.StatusCode, collectionName)
}

func (s *QdrantVectorStore) createCollection(ctx context.Context, collectionName string, vectorSize int) error {
	url := fmt.Sprintf("%s/collections/%s", s.baseURL, collectionName)

	createReq := CreateCollectionRequest{
		Vectors: map[string]VectorParams{
			"default": { // Assuming the vector name is "default"
				Size:     vectorSize,
				Distance: "Cosine", // Default distance metric
			},
		},
	}

	jsonData, err := json.Marshal(createReq)
	if err != nil {
		return fmt.Errorf("failed to marshal create collection request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPut, url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request for creating collection '%s': %w", collectionName, err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to execute request for creating collection '%s': %w", collectionName, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to create collection '%s', status: %d, response: %s", collectionName, resp.StatusCode, string(bodyBytes))
	}

	fmt.Printf("Collection '%s' created successfully\n", collectionName)
	return nil
}

// Ensure QdrantVectorStore implements the interfaces
var _ usecase.VectorStore = (*QdrantVectorStore)(nil)
var _ usecase.Retriever = (*QdrantVectorStore)(nil)
