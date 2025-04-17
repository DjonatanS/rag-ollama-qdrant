package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"path/filepath"

	"github.com/DjonatanS/rag-ollama-qdrant-go/pgk/loader"
	"github.com/DjonatanS/rag-ollama-qdrant-go/pgk/store"

	"github.com/tmc/langchaingo/chains"
	"github.com/tmc/langchaingo/embeddings"
	"github.com/tmc/langchaingo/llms/ollama"
	"github.com/tmc/langchaingo/schema"
)

func GetLLM(llmName string) (*ollama.LLM, error) {
	llm, err := ollama.New(ollama.WithModel(llmName))
	if err != nil {
		return nil, err
	}
	return llm, nil
}

func main() {
	ctx := context.Background()

	// Configure Ollama for embeddings
	embedLLM, err := GetLLM("nomic-embed-text")
	if err != nil {
		log.Fatal(err)
	}
	embedder, err := embeddings.NewEmbedder(embedLLM)
	if err != nil {
		log.Fatal(err)
	}

	// Configure Ollama for text generation
	llm, err := GetLLM("deepseek-r1:8b")
	if err != nil {
		log.Fatal(err)
	}

	// Get vector size from the model to ensure dimension consistency
	//vectorSize := 768 // Default for nomic-embed-text

	// Delete existing collection to ensure proper vector dimensions
	qdrantURL := "http://localhost:6333"
	collectionName := "my_collection"

	// Delete collection if it exists to avoid dimension mismatch
	if err := deleteQdrantCollection(ctx, qdrantURL, collectionName); err != nil {
		log.Printf("Warning: Failed to delete collection: %v", err)
		// Continue anyway, it might not exist
	}

	// Load all PDFs from the data/pdfs directory
	pdfDir := "data/pdfs"
	pdfFiles, err := filepath.Glob(filepath.Join(pdfDir, "*.pdf"))
	if err != nil {
		log.Fatalf("Failed to list PDF files: %v", err)
	}

	if len(pdfFiles) == 0 {
		log.Fatalf("No PDF files found in %s", pdfDir)
	}

	var allDocs []schema.Document
	log.Printf("Found %d PDF files to load...", len(pdfFiles))

	for _, pdfPath := range pdfFiles {
		log.Printf("Loading PDF: %s", pdfPath)
		docs, err := loader.LoadAndSplitPDF(ctx, pdfPath)
		if err != nil {
			log.Printf("Warning: Failed to load/split PDF %s: %v. Skipping.", pdfPath, err)
			continue // Skip this file and continue with the next
		}
		allDocs = append(allDocs, docs...)
		log.Printf("Loaded %d documents from %s", len(docs), pdfPath)
	}

	if len(allDocs) == 0 {
		log.Fatal("No documents were successfully loaded from any PDF files.")
	}
	log.Printf("Total loaded %d documents from all PDFs", len(allDocs))

	// Configure Qdrant with our custom implementation
	vectorStore, err := store.NewQdrantStore(ctx, qdrantURL, collectionName, embedder)
	if err != nil {
		log.Fatal(err)
	}

	// Add documents
	ids, err := vectorStore.AddDocuments(ctx, allDocs) // Use allDocs here
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("Added %d documents to vector store", len(ids))

	// Create retrieval chain
	retrievalQA := chains.NewRetrievalQAFromLLM(llm, vectorStore)

	// Query
	question := "How to Using  Go  to  Monitor  Container Performance"
	result, err := vectorStore.GetRelevantDocuments(ctx, question)
	if err != nil {
		log.Fatal(err)
	}

	log.Printf("Found %d relevant documents", len(result))

	// Now use RetrievalQA to generate an answer based on retrieved documents
	answer, err := retrievalQA.Call(ctx, map[string]any{"query": question})
	if err != nil {
		log.Fatal(err)
	}
	log.Println("Answer:", answer["text"])
}

// deleteQdrantCollection deletes a collection if it exists
func deleteQdrantCollection(ctx context.Context, baseURL string, collectionName string) error {
	url := fmt.Sprintf("%s/collections/%s", baseURL, collectionName)

	req, err := http.NewRequestWithContext(ctx, "DELETE", url, nil)
	if err != nil {
		return err
	}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// 404 means collection doesn't exist, which is fine
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNotFound {
		bodyBytes := []byte{}
		if resp.Body != nil {
			bodyBytes, _ = io.ReadAll(resp.Body)
		}
		return fmt.Errorf("failed to delete collection, status: %d, response: %s", resp.StatusCode, string(bodyBytes))
	}

	if resp.StatusCode == http.StatusOK {
		log.Printf("Collection '%s' deleted successfully", collectionName)
	}

	return nil
}
