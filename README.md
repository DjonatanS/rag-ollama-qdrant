# RAG with Ollama and Qdrant in Go

This project implements a RAG (Retrieval-Augmented Generation) system using Go, Ollama for local language models, and Qdrant as a vector database. The architecture follows Clean Architecture principles to ensure a clear separation of responsibilities.

![RAG Architecture](https://miro.medium.com/max/1400/1*Z0sOxEyR6j_4VqaJNMaJvg.jpeg)

## Features

- Loads and splits PDF documents into smaller chunks
- Generates embeddings for each chunk using Ollama models
- Stores embeddings and text in a Qdrant vector database
- Retrieves relevant documents for a query
- Uses LLM to generate answers based on retrieved documents
- Supports streaming responses for a more interactive experience
- Renders AI internal reasoning wrapped in `<think>` tags as expandable/collapsible sections to keep answers organized
- Allows per-PDF collection creation for more targeted retrieval
- Provides a web interface for document ingestion, querying and visualization

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

Place your PDF files in the [`data/pdfs`](data/pdfs) folder. The application will process all PDF files found in this directory during the ingestion phase.

### 2. Compile the application (Optional)

You can compile the application into a single binary:

```bash
go build -o ragapp cmd/ragapp/main.go
```

### 3. Run the application

The application has two main modes: `ingest` and `query`.

#### Ingestion Mode

This mode processes the PDF documents in the [`data/pdfs`](data/pdfs) directory, generates embeddings, and stores them in Qdrant. Run this mode first.

**Using `go run`:**

```bash
go run cmd/ragapp/main.go ingest
```

**Using the compiled binary:**

```bash
./ragapp ingest
```

**Per-PDF collections:**
To create a separate collection for each PDF (useful for targeted queries):

```bash
go run cmd/ragapp/main.go ingest-per-pdf
```

#### Query Mode

This mode takes a question as input, retrieves relevant documents from Qdrant, and generates an answer using the LLM.

**Using `go run`:**

```bash
# Ask a specific question
go run cmd/ragapp/main.go query "Your question here?"

# Ask a default question (if no question is provided)
go run cmd/ragapp/main.go query
```

**Using the compiled binary:**

```bash
# Ask a specific question
./ragapp query "Your question here?"

# Ask a default question (if no question is provided)
./ragapp query
```

#### Streaming Mode

The streaming mode provides real-time token-by-token responses, similar to ChatGPT's streaming experience:

```bash
go run cmd/ragapp/main.go stream "What are the key features of Go programming language?"
```

**Using the compiled binary:**

```bash
./ragapp stream "What are the key features of Go programming language?"
```

This will display the LLM's response in real-time as it's being generated, providing a more interactive experience.

#### Combined Mode (Default)

If you don't specify a mode, the application will run both ingestion and query phases:

```bash
go run cmd/ragapp/main.go "Your question here?"
```

### 4. Help

To see all available options:

```bash
go run cmd/ragapp/main.go help
```

### 5. Configuration

The main configurations are defined in the [`cmd/ragapp/main.go`](cmd/ragapp/main.go) file as constants:

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

To change these configurations, edit the [`cmd/ragapp/main.go`](cmd/ragapp/main.go) file before compiling or running.

## Using the Web Server

In addition to the command-line interface, this project includes a web server that provides a graphical user interface for interacting with the RAG system.

### Starting the Web Server

```bash
# Run the web server
go run cmd/webserver/main.go

# Or if compiled
./webserver
```

The server will start on port 8020 by default. You can access the web interface by visiting http://localhost:8020 in your browser.

### Web Interface Features

The web interface provides several key features:

1. **Document Ingestion**: Upload PDF documents through a drag-and-drop interface. You can choose to create individual collections per PDF or add them to a single collection.

2. **Chat Interface**: Ask questions about your documents and receive generated answers based on the content.

3. **Vector Visualizations**: View visual representations of your document vectors using techniques like t-SNE, UMAP, or PCA to understand document relationships.

4. **Collection Management**: Browse and manage your vector collections.

5. **Similarity Search**: Find documents similar to a text query and explore related content.

### Configuration

The web server's configuration options (such as port, model names, and vector dimensions) can be found at the top of the `cmd/webserver/main.go` file. Modify these constants to customize your server settings.

## How It Works

1.  **Ingestion Phase (`ingest` mode)**:
    *   PDF files from `pdfDir` are loaded.
    *   Text is extracted and split into chunks (`chunkSize`, `chunkOverlap`).
    *   Each chunk is converted to an embedding using the Ollama `embedModel`.
    *   Embeddings and corresponding text chunks are stored in the Qdrant `collectionName`.

2.  **Query Phase (`query` mode)**:
    *   The input question is converted to an embedding using the `embedModel`.
    *   Qdrant is queried to find documents (chunks) with embeddings similar to the question embedding.
    *   The retrieved document chunks are combined with the original question to form a prompt.
    *   The prompt is sent to the Ollama `genModel`.
    *   The LLM generates a response based on the provided context (documents) and the question.

3.  **Streaming Phase (`stream` mode)**:
    *   Works like the query phase but delivers the response token by token as it's generated.
    *   The UI displays the response in real-time, similar to ChatGPT's streaming experience.
    *   Particularly useful for longer responses where you want to see progress immediately.

## Code Architecture

### User Interface Layer (UI)
- [`cmd/ragapp/main.go`](cmd/ragapp/main.go): Entry point, configuration, command-line argument parsing, and main flow orchestration.

### Use Case Layer
- [`internal/usecase/interfaces.go`](internal/usecase/interfaces.go): Defines interfaces for the core operations (Loader, Splitter, Embedder, LLM, VectorStore).
- [`internal/usecase/ingestion_usecase.go`](internal/usecase/ingestion_usecase.go): Orchestrates the document ingestion process (load -> split -> embed -> store).
- [`internal/usecase/query_usecase.go`](internal/usecase/query_usecase.go): Orchestrates the query and response generation process (embed query -> search -> generate response).

### Infrastructure Layer
- [`internal/infra/loader/pdf_loader.go`](internal/infra/loader/pdf_loader.go): Implements the `Loader` interface for PDF files.
- [`internal/infra/splitter/recursive_splitter.go`](internal/infra/splitter/recursive_splitter.go): Implements the `Splitter` interface using recursive character splitting.
- [`internal/infra/llm/ollama_embedder.go`](internal/infra/llm/ollama_embedder.go): Implements the `Embedder` interface using an Ollama model.
- [`internal/infra/llm/ollama_llm.go`](internal/infra/llm/ollama_llm.go): Implements the `LLM` interface for text generation using an Ollama model.
- [`internal/infra/vectorstore/qdrant_adapter.go`](internal/infra/vectorstore/qdrant_adapter.go): Implements the `VectorStore` interface using Qdrant.

## Contributions

Feel free to create issues, send PRs, or suggest improvements to this project.

## License

This project is licensed under the MIT license.
