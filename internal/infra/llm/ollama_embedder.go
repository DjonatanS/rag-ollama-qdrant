package llm

import (
	"context"
	"fmt"

	"github.com/DjonatanS/rag-ollama-qdrant-go/internal/usecase"
	"github.com/tmc/langchaingo/embeddings"
	"github.com/tmc/langchaingo/llms/ollama"
)

type OllamaEmbedder struct {
	embedder embeddings.Embedder
}

func NewOllamaEmbedder(modelName string) (*OllamaEmbedder, error) {
	llm, err := ollama.New(ollama.WithModel(modelName))
	if err != nil {
		return nil, fmt.Errorf("failed to create ollama client for embeddings: %w", err)
	}
	embedder, err := embeddings.NewEmbedder(llm)
	if err != nil {
		return nil, fmt.Errorf("failed to create ollama embedder: %w", err)
	}
	return &OllamaEmbedder{embedder: embedder}, nil
}

func (e *OllamaEmbedder) EmbedDocuments(ctx context.Context, texts []string) ([][]float32, error) {
	embeddings, err := e.embedder.EmbedDocuments(ctx, texts)
	if err != nil {
		return nil, fmt.Errorf("ollama embed documents failed: %w", err)
	}
	return embeddings, nil
}

func (e *OllamaEmbedder) EmbedQuery(ctx context.Context, text string) ([]float32, error) {
	embedding, err := e.embedder.EmbedQuery(ctx, text)
	if err != nil {
		return nil, fmt.Errorf("ollama embed query failed: %w", err)
	}
	return embedding, nil
}

var _ usecase.EmbeddingGenerator = (*OllamaEmbedder)(nil)
