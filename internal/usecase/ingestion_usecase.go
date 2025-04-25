package usecase

import (
	"context"
	"fmt"
	"log"
	"path/filepath"
	"strings"

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

// ExecutePerPDF executa o processo de ingestão criando uma coleção para cada arquivo PDF
func (uc *IngestionUseCase) ExecutePerPDF(ctx context.Context, dirPath, filePattern string, vectorSize int) error {
	log.Printf("Starting per-PDF ingestion for directory: %s, pattern: %s", dirPath, filePattern)

	files, err := filepath.Glob(filepath.Join(dirPath, filePattern))
	if err != nil {
		return fmt.Errorf("failed to list files in '%s' with pattern '%s': %w", dirPath, filePattern, err)
	}
	if len(files) == 0 {
		return fmt.Errorf("no files found matching pattern '%s' in directory '%s'", filePattern, dirPath)
	}
	log.Printf("Found %d files to process.", len(files))

	for _, filePath := range files {
		// Obter nome do arquivo sem extensão para usar como nome da coleção
		fileName := filepath.Base(filePath)
		fileNameWithoutExt := strings.TrimSuffix(fileName, filepath.Ext(fileName))

		// Sanitizar o nome da coleção (remover caracteres inválidos)
		collectionName := sanitizeCollectionName(fileNameWithoutExt)

		log.Printf("Processing file: %s -> collection: %s", filePath, collectionName)

		// Garantir que a coleção exista
		log.Printf("Ensuring collection '%s' exists with vector size %d...", collectionName, vectorSize)
		if err := uc.store.DeleteCollection(ctx, collectionName); err != nil {
			log.Printf("Warning: Failed to delete collection '%s': %v", collectionName, err)
		}
		if err := uc.store.EnsureCollection(ctx, collectionName, vectorSize); err != nil {
			log.Printf("Warning: Failed to ensure collection '%s': %v. Skipping file.", collectionName, err)
			continue
		}

		// Carregar e dividir o documento
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

		if len(splittedDocs) == 0 {
			log.Printf("No documents were successfully split from file %s. Skipping.", filePath)
			continue
		}

		// Extrair textos para embedding
		var texts []string
		for _, doc := range splittedDocs {
			texts = append(texts, doc.PageContent)
		}

		log.Printf("Generating embeddings for %d chunks from %s...", len(texts), filePath)
		embeddings, err := uc.embedder.EmbedDocuments(ctx, texts)
		if err != nil {
			log.Printf("Warning: Failed to generate embeddings for %s: %v. Skipping.", filePath, err)
			continue
		}

		// Adicionar documentos com embeddings à coleção específica
		log.Printf("Adding %d documents with embeddings to collection '%s'...", len(splittedDocs), collectionName)
		ids, err := uc.store.AddDocuments(ctx, collectionName, splittedDocs, embeddings)
		if err != nil {
			log.Printf("Warning: Failed to add documents to collection '%s': %v", collectionName, err)
			continue
		}

		log.Printf("Successfully added %d documents to collection '%s' from file %s", len(ids), collectionName, filePath)
	}

	log.Printf("Per-PDF ingestion complete for all files.")
	return nil
}

// sanitizeCollectionName sanitiza o nome do arquivo para ser usado como nome de coleção
func sanitizeCollectionName(name string) string {
	// Substituir espaços, pontos e outros caracteres por underscores
	name = strings.ReplaceAll(name, " ", "_")
	name = strings.ReplaceAll(name, ".", "_")
	name = strings.ReplaceAll(name, "-", "_")

	// Remover caracteres especiais
	var result strings.Builder
	for _, char := range name {
		if (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || (char >= '0' && char <= '9') || char == '_' {
			result.WriteRune(char)
		}
	}

	return strings.ToLower(result.String())
}
