package main

import (
	"context"
	"log"
	"os"

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

	// --- Dependency Injection ---
	log.Println("Initializing components...")

	// Infrastructure Adapters
	pdfLoader := loader.NewPDFLoader()
	textSplitter := splitter.NewRecursiveCharacterSplitter(chunkSize, chunkOverlap)

	embedder, err := llm.NewOllamaEmbedder(embedModel)
	if err != nil {
		log.Fatalf("Failed to initialize Ollama embedder: %v", err)
	}

	qdrantStore, err := vectorstore.NewQdrantVectorStore(qdrantURL, embedder) // Pass embedder for Retriever needs
	if err != nil {
		log.Fatalf("Failed to initialize Qdrant vector store: %v", err)
	}

	generatorLLM, err := llm.NewOllamaLLM(genModel)
	if err != nil {
		log.Fatalf("Failed to initialize Ollama generation LLM: %v", err)
	}

	log.Println("Components initialized.")

	// Use Cases
	ingestionUC := usecase.NewIngestionUseCase(pdfLoader, textSplitter, embedder, qdrantStore)
	// QdrantStore implements both VectorStore and Retriever interfaces
	queryUC := usecase.NewQueryUseCase(embedder, qdrantStore, generatorLLM)

	// --- Application Logic ---

	// 1. Ingestion
	log.Println("--- Starting Ingestion Phase ---")
	err = ingestionUC.Execute(ctx, pdfDir, pdfPattern, collectionName, vectorSize)
	if err != nil {
		log.Fatalf("Ingestion failed: %v", err)
	}
	log.Println("--- Ingestion Phase Complete ---")

	// 2. Querying
	log.Println("--- Starting Query Phase ---")
	// Example query from command line arguments or default
	question := "Qual a habilidade mais importante na era da Inteligência Artificial?"
	if len(os.Args) > 1 {
		question = os.Args[1] // Use first argument as question if provided
	}

	answer, relevantDocs, err := queryUC.Execute(ctx, question)
	if err != nil {
		log.Fatalf("Query failed: %v", err)
	}

	log.Printf("\n=== Query ===\n%s\n", question)
	log.Printf("\n=== Answer ===\n%s\n", answer)

	log.Println("\n=== Relevant Documents Retrieved ===")
	for i, doc := range relevantDocs {
		log.Printf("--- Document %d (Score: %.4f) ---", i+1, doc.Metadata["score"])
		log.Printf("Source: %s", doc.Metadata["source"])
		log.Printf("Content: %s\n", doc.PageContent)
	}
	log.Println("--- Query Phase Complete ---")

	log.Println("RAG application finished.")
}
