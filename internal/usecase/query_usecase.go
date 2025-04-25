package usecase

import (
	"context"
	"fmt"
	"log"

	"github.com/tmc/langchaingo/schema"
)

type QueryUseCase struct {
	embedder  EmbeddingGenerator
	retriever Retriever
	llm       LLM
}

func NewQueryUseCase(e EmbeddingGenerator, r Retriever, l LLM) *QueryUseCase {
	return &QueryUseCase{
		embedder:  e,
		retriever: r,
		llm:       l,
	}
}

func (uc *QueryUseCase) Execute(ctx context.Context, query string) (string, []schema.Document, error) {
	log.Printf("Executing query: %s", query)

	relevantDocs, err := uc.retriever.GetRelevantDocuments(ctx, query)
	if err != nil {
		return "", nil, fmt.Errorf("failed to retrieve relevant documents: %w", err)
	}
	log.Printf("Retrieved %d relevant documents.", len(relevantDocs))

	if len(relevantDocs) == 0 {
		return "No relevant documents found to answer the query.", nil, nil
	}

	contextStr := ""
	for _, doc := range relevantDocs {
		contextStr += doc.PageContent + "\n\n"
	}

	prompt := fmt.Sprintf("Based on the following context:\n\n%s\n\nAnswer the question: %s", contextStr, query)

	log.Println("Generating answer using LLM...")

	answer, err := uc.llm.Call(ctx, prompt)
	if err != nil {
		return "", relevantDocs, fmt.Errorf("failed to generate answer with LLM: %w", err)
	}

	log.Printf("Generated answer: %s", answer)
	return answer, relevantDocs, nil

	/*
	   // Alternative using LangchainGo RetrievalQA chain (requires LLM adapter to be compatible
	   // with langchaingo LLM interface and Retriever adapter to implement langchaingo Retriever)
	   qaChain := chains.NewRetrievalQAFromLLM(uc.llm.(llms.Model), uc.retriever.(schema.Retriever))
	   result, err := chains.Call(ctx, qaChain, map[string]any{"query": query})
	   if err != nil {
	       return "", relevantDocs, fmt.Errorf("failed to call RetrievalQA chain: %w", err)
	   }
	   answer, ok := result["text"].(string)
	   if !ok {
	       return "", relevantDocs, fmt.Errorf("unexpected format for LLM result")
	   }
	   log.Printf("Generated answer: %s", answer)
	   return answer, relevantDocs, nil
	*/
}
