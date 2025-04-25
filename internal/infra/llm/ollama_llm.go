package llm

import (
	"context"
	"fmt"

	"github.com/DjonatanS/rag-ollama-qdrant-go/internal/usecase"
	"github.com/tmc/langchaingo/llms"
	"github.com/tmc/langchaingo/llms/ollama"
)

// OllamaLLM implements the usecase.LLM interface using Ollama.
type OllamaLLM struct {
	llm llms.Model // Use the langchaingo llms.Model interface
}

// NewOllamaLLM creates a new OllamaLLM.
func NewOllamaLLM(modelName string) (*OllamaLLM, error) {
	// Use ollama.New to create an instance that satisfies llms.Model
	llmInstance, err := ollama.New(ollama.WithModel(modelName))
	if err != nil {
		return nil, fmt.Errorf("failed to create ollama client for generation: %w", err)
	}
	return &OllamaLLM{llm: llmInstance}, nil // Store the concrete *ollama.LLM which implements llms.Model
}

// Call generates text based on the prompt.
// Note: This simplifies the langchaingo Call interface for the use case.
// If more complex options are needed, the usecase.LLM interface might need adjustment.
func (l *OllamaLLM) Call(ctx context.Context, prompt string, options ...func(map[string]interface{})) (string, error) {
	// Convert usecase options to langchaingo options if necessary (simplified here)
	langchainOpts := []llms.CallOption{}
	// Example: If options were defined to map to langchain options
	// for _, opt := range options {
	// 	 cfg := make(map[string]interface{})
	// 	 opt(cfg)
	// 	 // convert cfg to langchainOpts
	// }

	// Use the Call method of the underlying llms.Model
	completion, err := l.llm.Call(ctx, prompt, langchainOpts...)
	if err != nil {
		return "", fmt.Errorf("ollama llm call failed: %w", err)
	}
	return completion, nil
}

// CallWithStreaming implementa o streaming de respostas do LLM.
// Recebe um callback que é chamado para cada fragmento da resposta.
func (l *OllamaLLM) CallWithStreaming(ctx context.Context, prompt string, callbackFn func(chunk string), options ...func(map[string]interface{})) error {
	// Converter opções de configuração se necessário
	langchainOpts := []llms.CallOption{}
	// Implementação futura para mapear opções

	// Add the streaming function callback as a langchaingo option
	langchainOpts = append(langchainOpts, llms.WithStreamingFunc(func(ctx context.Context, chunk []byte) error {
		callbackFn(string(chunk))
		return nil // Indicate success to the streaming framework
	}))

	// Use the Call method of the underlying llms.Model with the streaming option.
	// The first return value (completion string) is ignored in streaming mode,
	// as the content is handled by the callback.
	_, err := l.llm.Call(ctx, prompt, langchainOpts...)
	if err != nil {
		// Note: Errors during the streaming process itself might be returned here,
		// or potentially need to be handled within the callback depending on the nature
		// of the error and langchaingo's behavior.
		return fmt.Errorf("ollama streaming call failed: %w", err)
	}

	// Return nil if the call setup and streaming initiation were successful.
	// Errors during the stream are handled by the callback or returned by Call.
	return nil
}

// Ensure OllamaLLM implements the interface
var _ usecase.LLM = (*OllamaLLM)(nil)
