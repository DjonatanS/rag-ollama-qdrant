package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"

	"github.com/DjonatanS/rag-ollama-qdrant-go/pgk/loader"
	"github.com/DjonatanS/rag-ollama-qdrant-go/pgk/store"

	"github.com/tmc/langchaingo/chains"
	"github.com/tmc/langchaingo/embeddings"
	"github.com/tmc/langchaingo/llms/ollama"
)

func main() {
	ctx := context.Background()

	// Configure Ollama for embeddings
	embedLLM, err := ollama.New(ollama.WithModel("nomic-embed-text"))
	if err != nil {
		log.Fatal(err)
	}
	embedder, err := embeddings.NewEmbedder(embedLLM)
	if err != nil {
		log.Fatal(err)
	}

	// Configure Ollama for text generation
	llm, err := ollama.New(ollama.WithModel("deepseek-r1:8b"))
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

	// Load PDF
	docs, err := loader.LoadAndSplitPDF(ctx, "data/pdfs/DSA_Artigo.pdf")
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("Loaded %d documents from PDF", len(docs))

	// Configure Qdrant with our custom implementation
	vectorStore, err := store.NewQdrantStore(ctx, qdrantURL, collectionName, embedder)
	if err != nil {
		log.Fatal(err)
	}

	// Add documents
	ids, err := vectorStore.AddDocuments(ctx, docs)
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("Added %d documents to vector store", len(ids))

	// Create retrieval chain
	retrievalQA := chains.NewRetrievalQAFromLLM(llm, vectorStore)

	// Query
	question := "O que a pesquisa recente da Salesforce descobriu?"
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
