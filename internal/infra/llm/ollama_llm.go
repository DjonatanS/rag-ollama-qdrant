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
	llm, err := ollama.New(ollama.WithModel(modelName))
	if err != nil {
		return nil, fmt.Errorf("failed to create ollama client for generation: %w", err)
	}
	return &OllamaLLM{llm: llm}, nil
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

	completion, err := l.llm.Call(ctx, prompt, langchainOpts...)
	if err != nil {
		return "", fmt.Errorf("ollama llm call failed: %w", err)
	}
	return completion, nil
}

// Ensure OllamaLLM implements the interface
var _ usecase.LLM = (*OllamaLLM)(nil)
