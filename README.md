# RAG with Ollama and Qdrant in Go

This project implements a RAG (Retrieval-Augmented Generation) system using Go, Ollama for local language models, and Qdrant as a vector database. The architecture follows Clean Architecture principles to ensure a clear separation of responsibilities.

![RAG Architecture](https://miro.medium.com/max/1400/1*Z0sOxEyR6j_4VqaJNMaJvg.jpeg)

## Features

- Loads and splits PDF documents into smaller chunks
- Generates embeddings for each chunk using Ollama models
- Stores embeddings and text in a Qdrant vector database
- Retrieves relevant documents for a query
- Uses LLM to generate answers based on retrieved documents

## Prerequisites

- **Go** (version 1.18 or higher) - [Download Go](https://go.dev/doc/install)
- **Ollama** - [Download Ollama](https://ollama.com)
- **Qdrant** - [Docker Qdrant](https://qdrant.tech/documentation/guides/installation/)

## Installation 

### 1. Clone the repository

```bash
git clone https://github.com/DjonatanS/rag-ollama-qdrant-go
cd rag-ollama-qdrant-go
```

### 2. Install dependencies

```bash
go mod tidy
```

### 3. Set up Ollama

Download and install Ollama at: [https://ollama.com/download](https://ollama.com/download)

After installation, download the necessary models:

```bash
# Model for generating embeddings (768-dimensional vector)
ollama pull nomic-embed-text

# Model for text generation (you can replace it with other supported models)
ollama pull deepseek-r1:8b
```

### 4. Start Qdrant

The easiest way is to run it via Docker:

```bash
docker run -d -p 6333:6333 -p 6334:6334 \
    -v $(pwd)/qdrant_storage:/qdrant/storage \
    qdrant/qdrant
```

Check if it's working by accessing: http://localhost:6333/dashboard

## Project Structure

The project follows Clean Architecture principles:

```
/cmd
  /ragapp           # Application entry point
/internal
  /usecase          # Use cases and interfaces (business rules)
  /infra            # Concrete implementations (adapters)
    /llm            # Adapters for language models
    /loader         # Adapters for document loading
    /splitter       # Adapters for text splitting
    /vectorstore    # Adapters for vector databases
/data
  /pdfs             # PDF files for processing
```

## How to Use

### 1. Prepare your documents

Place your PDF files in the `data/pdfs/` folder. The application will process all PDF files found in this directory.

### 2. Compile and run the application

```bash
go build -o ragapp cmd/ragapp/main.go
./ragapp "Your question here"
```

Or run directly:

```bash
go run cmd/ragapp/main.go "Your question here"
```

If no question is provided, a default question will be used.

### 3. Configuration

The main configurations are defined in the `cmd/ragapp/main.go` file as constants:

| Parameter | Description | Default Value |
|-----------|-------------|--------------|
| pdfDir | PDF directory | "data/pdfs" |
| pdfPattern | Pattern to find PDFs | "*.pdf" |
| qdrantURL | Qdrant server URL | "http://localhost:6333" |
| collectionName | Collection name in Qdrant | "my_collection" |
| embedModel | Model for embeddings | "nomic-embed-text" |
| genModel | Model for text generation | "deepseek-r1:8b" |
| vectorSize | Vector dimensions | 768 |
| chunkSize | Text chunk size | 1000 |
| chunkOverlap | Overlap between chunks | 100 |

To change these configurations, edit the `cmd/ragapp/main.go` file.

## How It Works

1. **Ingestion Phase**:
   - PDF files are loaded and split into smaller chunks
   - Each chunk is converted to an embedding using the Ollama model
   - Embeddings and text are stored in Qdrant

2. **Query Phase**:
   - The question is converted to an embedding
   - Qdrant is queried to find documents with similar embeddings
   - Relevant documents are sent to the LLM along with the question
   - The LLM generates a response based on the documents and the question

## Code Architecture

### User Interface Layer (UI)
- `cmd/ragapp/main.go`: Entry point, configuration, and main flow

### Use Case Layer
- `internal/usecase/interfaces.go`: Defines interfaces for the main operations
- `internal/usecase/ingestion_usecase.go`: Orchestrates the document ingestion process
- `internal/usecase/query_usecase.go`: Orchestrates the query and response generation process

### Infrastructure Layer
- `internal/infra/loader/pdf_loader.go`: Implements PDF loading
- `internal/infra/splitter/recursive_splitter.go`: Implements text splitting
- `internal/infra/llm/ollama_embedder.go`: Implements embedding generation with Ollama
- `internal/infra/llm/ollama_llm.go`: Implements text generation with Ollama
- `internal/infra/vectorstore/qdrant_adapter.go`: Implements storage and retrieval with Qdrant

## Contributions

Feel free to create issues, send PRs, or suggest improvements to this project.

## License

This project is licensed under the MIT license.
