package loader

import (
	"context"
	"fmt"
	"os"

	"github.com/DjonatanS/rag-ollama-qdrant-go/internal/usecase"
	"github.com/tmc/langchaingo/documentloaders"
	"github.com/tmc/langchaingo/schema"
)

// PDFLoader implements the usecase.DocumentLoader interface for PDF files.
type PDFLoader struct{}

// NewPDFLoader creates a new PDFLoader.
func NewPDFLoader() *PDFLoader {
	return &PDFLoader{}
}

// Load reads a PDF file from the given path and returns its content as documents.
func (l *PDFLoader) Load(ctx context.Context, source string) ([]schema.Document, error) {
	f, err := os.Open(source)
	if err != nil {
		return nil, fmt.Errorf("failed to open PDF file '%s': %w", source, err)
	}
	defer f.Close()

	fileInfo, err := f.Stat()
	if err != nil {
		return nil, fmt.Errorf("failed to get file info for '%s': %w", source, err)
	}

	loader := documentloaders.NewPDF(f, fileInfo.Size())
	docs, err := loader.Load(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to load documents from PDF '%s': %w", source, err)
	}

	// Add source metadata
	for i := range docs {
		if docs[i].Metadata == nil {
			docs[i].Metadata = make(map[string]interface{})
		}
		docs[i].Metadata["source"] = source
	}

	return docs, nil
}

// Ensure PDFLoader implements the interface
var _ usecase.DocumentLoader = (*PDFLoader)(nil)
