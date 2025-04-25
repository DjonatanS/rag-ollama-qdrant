package usecase

import (
	"context"
	"fmt"
	"log"
	"path/filepath"

	"github.com/tmc/langchaingo/schema"
)

type IngestionUseCase struct {
	loader   DocumentLoader
	splitter TextSplitter
	embedder EmbeddingGenerator
	store    VectorStore
}

func NewIngestionUseCase(l DocumentLoader, s TextSplitter, e EmbeddingGenerator, vs VectorStore) *IngestionUseCase {
	return &IngestionUseCase{
		loader:   l,
		splitter: s,
		embedder: e,
		store:    vs,
	}
}

func (uc *IngestionUseCase) Execute(ctx context.Context, dirPath, filePattern, collectionName string, vectorSize int) error {
	log.Printf("Starting ingestion process for directory: %s, pattern: %s", dirPath, filePattern)

	log.Printf("Ensuring collection '%s' exists with vector size %d...", collectionName, vectorSize)
	if err := uc.store.DeleteCollection(ctx, collectionName); err != nil {
		log.Printf("Warning: Failed to delete collection '%s': %v", collectionName, err)
	}
	if err := uc.store.EnsureCollection(ctx, collectionName, vectorSize); err != nil {
		return fmt.Errorf("failed to ensure collection '%s': %w", collectionName, err)
	}
	log.Printf("Collection '%s' ensured.", collectionName)

	files, err := filepath.Glob(filepath.Join(dirPath, filePattern))
	if err != nil {
		return fmt.Errorf("failed to list files in '%s' with pattern '%s': %w", dirPath, filePattern, err)
	}
	if len(files) == 0 {
		return fmt.Errorf("no files found matching pattern '%s' in directory '%s'", filePattern, dirPath)
	}
	log.Printf("Found %d files to process.", len(files))

	var allDocs []schema.Document
	var allTexts []string
	for _, filePath := range files {
		log.Printf("Processing file: %s", filePath)

		docs, err := uc.loader.Load(ctx, filePath)
		if err != nil {
			log.Printf("Warning: Failed to load file %s: %v. Skipping.", filePath, err)
			continue
		}

		splittedDocs, err := uc.splitter.SplitDocuments(ctx, docs)
		if err != nil {
			log.Printf("Warning: Failed to split documents from file %s: %v. Skipping.", filePath, err)
			continue
		}

		for _, doc := range splittedDocs {
			allDocs = append(allDocs, doc)
			allTexts = append(allTexts, doc.PageContent)
		}
		log.Printf("Loaded and split %d documents from %s", len(splittedDocs), filePath)
	}

	if len(allDocs) == 0 {
		return fmt.Errorf("no documents were successfully loaded and split from any files")
	}
	log.Printf("Total documents to embed and add: %d", len(allDocs))

	log.Println("Generating embeddings for all documents...")
	embeddings, err := uc.embedder.EmbedDocuments(ctx, allTexts)
	if err != nil {
		return fmt.Errorf("failed to generate embeddings: %w", err)
	}
	log.Printf("Generated %d embeddings.", len(embeddings))

	log.Printf("Adding %d documents with embeddings to collection '%s'...", len(allDocs), collectionName)
	ids, err := uc.store.AddDocuments(ctx, collectionName, allDocs, embeddings)
	if err != nil {
		return fmt.Errorf("failed to add documents to vector store: %w", err)
	}

	log.Printf("Successfully added %d documents to collection '%s'. Ingestion complete.", len(ids), collectionName)
	return nil
}
