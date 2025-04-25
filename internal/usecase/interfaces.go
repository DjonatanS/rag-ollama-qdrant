package usecase

import (
	"context"

	"github.com/tmc/langchaingo/schema"
)

type DocumentLoader interface {
	Load(ctx context.Context, source string) ([]schema.Document, error)
}

type TextSplitter interface {
	SplitDocuments(ctx context.Context, docs []schema.Document) ([]schema.Document, error)
}

type EmbeddingGenerator interface {
	EmbedDocuments(ctx context.Context, texts []string) ([][]float32, error)
	EmbedQuery(ctx context.Context, text string) ([]float32, error)
}

type VectorStore interface {
	AddDocuments(ctx context.Context, collectionName string, docs []schema.Document, embeddings [][]float32) ([]string, error)
	SimilaritySearch(ctx context.Context, collectionName string, queryEmbedding []float32, numDocuments int) ([]schema.Document, error)
	EnsureCollection(ctx context.Context, collectionName string, vectorSize int) error
	DeleteCollection(ctx context.Context, collectionName string) error
}

type LLM interface {
	Call(ctx context.Context, prompt string, options ...func(map[string]interface{})) (string, error) // Simplified Call interface
	CallWithStreaming(ctx context.Context, prompt string, callbackFn func(chunk string), options ...func(map[string]interface{})) error
}

type Retriever interface {
	GetRelevantDocuments(ctx context.Context, query string) ([]schema.Document, error)
}
