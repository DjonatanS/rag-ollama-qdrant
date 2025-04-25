package usecase

import (
	"context"
	"fmt"
	"log"
	"sort"

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

// ExecuteWithStreaming realiza a busca por documentos relevantes e gera uma resposta com streaming
func (uc *QueryUseCase) ExecuteWithStreaming(ctx context.Context, query string, collectionName string, callback func(chunk string)) ([]schema.Document, error) {
	log.Printf("Executing streaming query: %s on collection: %s", query, collectionName)

	// Converter a consulta em embedding para buscar documentos relevantes
	queryEmbedding, err := uc.embedder.EmbedQuery(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to embed query for retrieval: %w", err)
	}

	// Obter o adaptador específico para acessar métodos específicos de coleção
	// Verificar primeiramente se o retriever possui o método SimilaritySearch
	type similaritySearcher interface {
		SimilaritySearch(ctx context.Context, collectionName string, queryEmbedding []float32, numDocuments int) ([]schema.Document, error)
	}

	// Tentar obter o retriever como um searcher
	searcher, ok := uc.retriever.(similaritySearcher)
	if !ok {
		return nil, fmt.Errorf("retriever does not implement SimilaritySearch method")
	}

	// Buscar documentos relevantes usando similaridade de embedding
	relevantDocs, err := searcher.SimilaritySearch(ctx, collectionName, queryEmbedding, 4)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve relevant documents: %w", err)
	}
	log.Printf("Retrieved %d relevant documents from collection %s", len(relevantDocs), collectionName)

	if len(relevantDocs) == 0 {
		callback("No relevant documents found to answer the query.")
		return nil, nil
	}

	// Construir o contexto a partir dos documentos relevantes
	contextStr := ""
	for _, doc := range relevantDocs {
		contextStr += doc.PageContent + "\n\n"
	}

	// Criar o prompt para o LLM com o contexto e a pergunta
	prompt := fmt.Sprintf("Based on the following context:\n\n%s\n\nAnswer the question: %s", contextStr, query)

	log.Println("Generating streaming answer using LLM...")

	// Chamar o LLM com streaming, passando o callback para processar os chunks da resposta
	err = uc.llm.CallWithStreaming(ctx, prompt, callback)
	if err != nil {
		return relevantDocs, fmt.Errorf("failed to generate streaming answer with LLM: %w", err)
	}

	return relevantDocs, nil
}

// ExecuteMultiCollection realiza a consulta em todas as coleções disponíveis e combina os resultados
func (uc *QueryUseCase) ExecuteMultiCollection(ctx context.Context, query string, collections []string, numDocsPerCollection int) (string, []schema.Document, error) {
	log.Printf("Executing query across %d collections: %s", len(collections), query)

	var allRelevantDocs []schema.Document

	// Converter a consulta em embedding uma única vez
	queryEmbedding, err := uc.embedder.EmbedQuery(ctx, query)
	if err != nil {
		return "", nil, fmt.Errorf("failed to embed query for retrieval: %w", err)
	}

	// Obter o adaptador específico para acessar métodos específicos de coleção
	type similaritySearcher interface {
		SimilaritySearch(ctx context.Context, collectionName string, queryEmbedding []float32, numDocuments int) ([]schema.Document, error)
	}

	// Tentar obter o retriever como um searcher
	searcher, ok := uc.retriever.(similaritySearcher)
	if !ok {
		return "", nil, fmt.Errorf("retriever does not implement SimilaritySearch method")
	}

	// Para cada coleção, buscar os documentos mais relevantes
	for _, collectionName := range collections {
		log.Printf("Searching collection: %s", collectionName)
		docs, err := searcher.SimilaritySearch(ctx, collectionName, queryEmbedding, numDocsPerCollection)
		if err != nil {
			log.Printf("Warning: Failed to search collection %s: %v", collectionName, err)
			continue
		}

		allRelevantDocs = append(allRelevantDocs, docs...)
	}

	if len(allRelevantDocs) == 0 {
		return "No relevant documents found across collections to answer the query.", nil, nil
	}

	// Ordenar todos os documentos por score (assumindo que o score está nos metadados)
	sortDocumentsByScore(allRelevantDocs)

	// Limitar ao número total desejado de documentos
	maxDocs := numDocsPerCollection * 2 // Por exemplo, limite máximo de documentos
	if len(allRelevantDocs) > maxDocs {
		allRelevantDocs = allRelevantDocs[:maxDocs]
	}

	// Construir o contexto a partir dos documentos relevantes
	contextStr := ""
	for _, doc := range allRelevantDocs {
		contextStr += doc.PageContent + "\n\n"
	}

	// Criar o prompt para o LLM com o contexto e a pergunta
	prompt := fmt.Sprintf("Based on the following context from multiple documents:\n\n%s\n\nAnswer the question: %s", contextStr, query)

	log.Println("Generating answer using LLM...")

	// Chamar o LLM para gerar a resposta
	answer, err := uc.llm.Call(ctx, prompt)
	if err != nil {
		return "", allRelevantDocs, fmt.Errorf("failed to generate answer with LLM: %w", err)
	}

	log.Printf("Generated answer based on documents from multiple collections")
	return answer, allRelevantDocs, nil
}

// ExecuteWithStreamingMultiCollection realiza a consulta em múltiplas coleções e gera resposta com streaming
func (uc *QueryUseCase) ExecuteWithStreamingMultiCollection(ctx context.Context, query string, collections []string, numDocsPerCollection int, callback func(chunk string)) ([]schema.Document, error) {
	log.Printf("Executing streaming query across %d collections: %s", len(collections), query)

	var allRelevantDocs []schema.Document

	// Converter a consulta em embedding uma única vez
	queryEmbedding, err := uc.embedder.EmbedQuery(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to embed query for retrieval: %w", err)
	}

	// Obter o adaptador específico para acessar métodos específicos de coleção
	type similaritySearcher interface {
		SimilaritySearch(ctx context.Context, collectionName string, queryEmbedding []float32, numDocuments int) ([]schema.Document, error)
	}

	// Tentar obter o retriever como um searcher
	searcher, ok := uc.retriever.(similaritySearcher)
	if !ok {
		return nil, fmt.Errorf("retriever does not implement SimilaritySearch method")
	}

	// Para cada coleção, buscar os documentos mais relevantes
	for _, collectionName := range collections {
		log.Printf("Searching collection: %s", collectionName)
		docs, err := searcher.SimilaritySearch(ctx, collectionName, queryEmbedding, numDocsPerCollection)
		if err != nil {
			log.Printf("Warning: Failed to search collection %s: %v", collectionName, err)
			continue
		}

		allRelevantDocs = append(allRelevantDocs, docs...)
	}

	if len(allRelevantDocs) == 0 {
		callback("No relevant documents found across collections to answer the query.")
		return nil, nil
	}

	// Ordenar todos os documentos por score
	sortDocumentsByScore(allRelevantDocs)

	// Limitar ao número total desejado de documentos
	maxDocs := numDocsPerCollection * 2
	if len(allRelevantDocs) > maxDocs {
		allRelevantDocs = allRelevantDocs[:maxDocs]
	}

	// Construir o contexto a partir dos documentos relevantes
	contextStr := ""
	for _, doc := range allRelevantDocs {
		contextStr += doc.PageContent + "\n\n"
	}

	// Criar o prompt para o LLM com o contexto e a pergunta
	prompt := fmt.Sprintf("Based on the following context from multiple documents:\n\n%s\n\nAnswer the question: %s", contextStr, query)

	log.Println("Generating streaming answer using LLM...")

	// Chamar o LLM com streaming, passando o callback para processar os chunks da resposta
	err = uc.llm.CallWithStreaming(ctx, prompt, callback)
	if err != nil {
		return allRelevantDocs, fmt.Errorf("failed to generate streaming answer with LLM: %w", err)
	}

	return allRelevantDocs, nil
}

// Função auxiliar para ordenar documentos por score
func sortDocumentsByScore(docs []schema.Document) {
	sort.Slice(docs, func(i, j int) bool {
		// Extrair scores dos metadados
		scoreI, okI := docs[i].Metadata["score"].(float64)
		scoreJ, okJ := docs[j].Metadata["score"].(float64)

		// Se ambos têm score, compare-os (ordem decrescente)
		if okI && okJ {
			return scoreI > scoreJ
		}

		// Se apenas um tem score, priorizá-lo
		if okI {
			return true
		}
		if okJ {
			return false
		}

		// Se nenhum tem score, manter ordem original
		return i < j
	})
}
