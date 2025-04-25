package splitter

import (
	"context"
	"fmt"

	"github.com/DjonatanS/rag-ollama-qdrant-go/internal/usecase"
	"github.com/tmc/langchaingo/schema"
	"github.com/tmc/langchaingo/textsplitter"
)

// RecursiveCharacterSplitter implements the usecase.TextSplitter interface.
type RecursiveCharacterSplitter struct {
	splitter textsplitter.RecursiveCharacter
}

// NewRecursiveCharacterSplitter creates a new splitter with default settings.
func NewRecursiveCharacterSplitter(chunkSize, chunkOverlap int) *RecursiveCharacterSplitter {
	return &RecursiveCharacterSplitter{
		splitter: textsplitter.NewRecursiveCharacter(
			textsplitter.WithChunkSize(chunkSize),
			textsplitter.WithChunkOverlap(chunkOverlap),
		),
	}
}

// SplitDocuments splits the given documents using the recursive character splitter.
func (s *RecursiveCharacterSplitter) SplitDocuments(ctx context.Context, docs []schema.Document) ([]schema.Document, error) {
	splittedDocs, err := textsplitter.SplitDocuments(s.splitter, docs)
	if err != nil {
		return nil, fmt.Errorf("failed to split documents: %w", err)
	}
	return splittedDocs, nil
}

// Ensure RecursiveCharacterSplitter implements the interface
var _ usecase.TextSplitter = (*RecursiveCharacterSplitter)(nil)
