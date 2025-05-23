package loader

import (
	"context"
	"os"

	"github.com/tmc/langchaingo/documentloaders"
	"github.com/tmc/langchaingo/schema"
	"github.com/tmc/langchaingo/textsplitter"
)

func LoadAndSplitPDF(ctx context.Context, path string) ([]schema.Document, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	fileInfo, err := f.Stat()
	if err != nil {
		return nil, err
	}

	loader := documentloaders.NewPDF(f, fileInfo.Size())
	docs, err := loader.Load(ctx)
	if err != nil {
		return nil, err
	}

	splitter := textsplitter.NewRecursiveCharacter(textsplitter.WithChunkSize(1000), textsplitter.WithChunkOverlap(100))

	return textsplitter.SplitDocuments(splitter, docs)
}
