# RAG com Ollama e Qdrant em Go

Este projeto implementa um sistema RAG (Retrieval-Augmented Generation) utilizando Go, Ollama para modelos de linguagem locais e Qdrant como banco de dados vetorial. A arquitetura segue princípios de Clean Architecture para garantir uma separação clara de responsabilidades.

![RAG Architecture](https://miro.medium.com/max/1400/1*Z0sOxEyR6j_4VqaJNMaJvg.jpeg)

## Funcionalidades

- Carrega e divide documentos PDF em partes menores (chunks)
- Gera embeddings para cada chunk utilizando modelos Ollama
- Armazena embeddings e texto em um banco de dados vetorial Qdrant
- Busca documentos relevantes para uma pergunta (query)
- Utiliza LLM para gerar respostas baseadas nos documentos recuperados

## Pré-requisitos

- **Go** (versão 1.18 ou superior) - [Download Go](https://go.dev/doc/install)
- **Ollama** - [Download Ollama](https://ollama.com)
- **Qdrant** - [Docker Qdrant](https://qdrant.tech/documentation/guides/installation/)

## Instalação 

### 1. Clone o repositório

```bash
git clone https://github.com/DjonatanS/rag-ollama-qdrant-go
cd rag-ollama-qdrant-go
```

### 2. Instale as dependências

```bash
go mod tidy
```

### 3. Prepare a instalação do Ollama

Baixe e instale o Ollama em: [https://ollama.com/download](https://ollama.com/download)

Após a instalação, baixe os modelos necessários:

```bash
# Modelo para gerar embeddings (vetor 768-dimensional)
ollama pull nomic-embed-text

# Modelo para geração de texto (você pode trocar por outros modelos suportados)
ollama pull deepseek-r1:8b
```

### 4. Inicie o Qdrant

A maneira mais fácil é executar via Docker:

```bash
docker run -d -p 6333:6333 -p 6334:6334 \
    -v $(pwd)/qdrant_storage:/qdrant/storage \
    qdrant/qdrant
```

Verifique se está funcionando acessando: http://localhost:6333/dashboard

## Estrutura do Projeto

O projeto segue os princípios de Clean Architecture:

```
/cmd
  /ragapp           # Ponto de entrada do aplicativo
/internal
  /usecase          # Casos de uso e interfaces (regras de negócios)
  /infra            # Implementações concretas (adaptadores)
    /llm            # Adaptadores para modelos de linguagem
    /loader         # Adaptadores para carregamento de documentos
    /splitter       # Adaptadores para divisão de texto
    /vectorstore    # Adaptadores para bancos de dados vetoriais
/data
  /pdfs             # Arquivos PDF para processamento
```

## Como usar

### 1. Prepare seus documentos

Coloque seus arquivos PDF na pasta `data/pdfs/`. O aplicativo processará todos os arquivos PDF encontrados neste diretório.

### 2. Compile e execute o aplicativo

```bash
go build -o ragapp cmd/ragapp/main.go
./ragapp "Sua pergunta aqui"
```

Ou execute diretamente:

```bash
go run cmd/ragapp/main.go "Sua pergunta aqui"
```

Se nenhuma pergunta for fornecida, será usada uma pergunta padrão.

### 3. Configuração

As principais configurações estão definidas no arquivo `cmd/ragapp/main.go` como constantes:

| Parâmetro | Descrição | Valor Padrão |
|-----------|-----------|--------------|
| pdfDir | Diretório dos PDFs | "data/pdfs" |
| pdfPattern | Padrão para encontrar PDFs | "*.pdf" |
| qdrantURL | URL do servidor Qdrant | "http://localhost:6333" |
| collectionName | Nome da coleção no Qdrant | "my_collection" |
| embedModel | Modelo para embeddings | "nomic-embed-text" |
| genModel | Modelo para geração de texto | "deepseek-r1:8b" |
| vectorSize | Dimensão dos vetores | 768 |
| chunkSize | Tamanho dos chunks de texto | 1000 |
| chunkOverlap | Sobreposição entre chunks | 100 |

Para alterar estas configurações, edite o arquivo `cmd/ragapp/main.go`.

## Como Funciona

1. **Fase de Ingestão**:
   - Os arquivos PDF são carregados e divididos em chunks menores
   - Cada chunk é convertido em um embedding usando o modelo Ollama
   - Os embeddings e o texto são armazenados no Qdrant

2. **Fase de Consulta**:
   - A pergunta é convertida em embedding
   - O Qdrant é consultado para encontrar documentos com embeddings similares
   - Os documentos relevantes são enviados ao LLM junto com a pergunta
   - O LLM gera uma resposta baseada nos documentos e na pergunta

## Arquitetura do Código

### Camada de Interface de Usuário (UI)
- `cmd/ragapp/main.go`: Ponto de entrada, configuração e fluxo principal

### Camada de Casos de Uso
- `internal/usecase/interfaces.go`: Define interfaces para as operações principais
- `internal/usecase/ingestion_usecase.go`: Orquestra o processo de ingestão de documentos
- `internal/usecase/query_usecase.go`: Orquestra o processo de consulta e geração de resposta

### Camada de Infraestrutura
- `internal/infra/loader/pdf_loader.go`: Implementa carregamento de PDFs
- `internal/infra/splitter/recursive_splitter.go`: Implementa divisão de texto
- `internal/infra/llm/ollama_embedder.go`: Implementa geração de embeddings com Ollama
- `internal/infra/llm/ollama_llm.go`: Implementa geração de texto com Ollama
- `internal/infra/vectorstore/qdrant_adapter.go`: Implementa armazenamento e recuperação com Qdrant

## Contribuições

Sinta-se à vontade para criar issues, enviar PRs ou sugerir melhorias para este projeto.

## Licença

Este projeto é licenciado sob a licença MIT.
