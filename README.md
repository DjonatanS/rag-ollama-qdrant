# RAG com Ollama e Qdrant em Go

Este projeto demonstra a implementação de um sistema RAG (Retrieval-Augmented Generation) utilizando Go, Ollama (para modelos de linguagem locais) e Qdrant (como banco de dados vetorial). O sistema carrega um documento PDF, o processa, armazena seus embeddings vetoriais no Qdrant e, em seguida, utiliza um modelo de linguagem para responder a perguntas com base no conteúdo do PDF recuperado.

## Funcionalidades

*   Carrega e divide documentos PDF em partes menores (chunks).
*   Gera embeddings vetoriais para os chunks de texto usando um modelo Ollama (ex: `nomic-embed-text`).
*   Armazena os embeddings e o texto original no Qdrant.
*   Utiliza um modelo de linguagem generativo Ollama (ex: `deepseek-r1:8b`) para gerar respostas com base nos documentos recuperados do Qdrant.
*   Implementa uma cadeia RAG utilizando a biblioteca LangchainGo.
*   Interage diretamente com a API REST do Qdrant para gerenciamento de coleções (criação, verificação) e busca vetorial.
*   Inclui lógica para deletar e recriar a coleção Qdrant para garantir a consistência da dimensão vetorial ao trocar modelos de embedding.

## Pré-requisitos

*   **Go:** Versão 1.18 ou superior. ([https://go.dev/doc/install](https://go.dev/doc/install))
*   **Ollama:** Instalado e em execução. ([https://ollama.com/](https://ollama.com/))
*   **Qdrant:** Instalado e em execução (ex: via Docker). ([https://qdrant.tech/documentation/guides/installation/](https://qdrant.tech/documentation/guides/installation/))

## Configuração Inicial

1.  **Ollama:**
    *   Certifique-se de que o serviço Ollama esteja rodando.
    *   Baixe os modelos necessários (os modelos padrão usados no projeto são `nomic-embed-text` para embeddings e `deepseek-r1:8b` para geração):
        ```bash
        ollama pull nomic-embed-text
        ollama pull deepseek-r1:8b
        ```

2.  **Qdrant:**
    *   Inicie o Qdrant. Se estiver usando Docker (recomendado para desenvolvimento):
        ```bash
        docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant
        ```
    *   O projeto espera que a API REST do Qdrant esteja acessível em `http://localhost:6333`.

## Instalação das Dependências

Navegue até o diretório raiz do projeto e execute:

```bash
go mod tidy
```

## Como Usar

1.  **Prepare o Documento:** Coloque o arquivo PDF que deseja processar na pasta `data/pdfs/`. O projeto está configurado por padrão para usar `data/pdfs/DSA_Artigo.pdf`.
2.  **Execute o Programa:**
    ```bash
    go run main.go
    ```

O programa executará os seguintes passos:
*   Tentará deletar a coleção Qdrant existente (`my_collection`) para garantir que a dimensão vetorial esteja correta.
*   Carregará e dividirá o PDF especificado.
*   Criará uma nova coleção no Qdrant com a dimensão vetorial apropriada para o modelo de embedding (`nomic-embed-text` -> 768).
*   Gerará embeddings para cada chunk do PDF e os armazenará no Qdrant.
*   Executará uma pergunta de exemplo (`Qual a habilidade mais importante na era da Inteligência Artificial?`).
*   Recuperará os documentos relevantes do Qdrant com base na pergunta.
*   Usará o modelo de linguagem generativo para gerar uma resposta com base nos documentos recuperados.
*   Imprimirá os documentos relevantes encontrados e a resposta final no console.

## Como Funciona

1.  **Carregamento (Loader):** O `pgk/loader/pdfloader.go` utiliza bibliotecas Go para ler o conteúdo do arquivo PDF e dividi-lo em chunks de texto menores e gerenciáveis.
2.  **Embedding:** O `main.go` configura um cliente Ollama para o modelo de embedding (`nomic-embed-text`). Para cada chunk de texto, ele chama o cliente Ollama para gerar um vetor de embedding.
3.  **Armazenamento (Store):** O `pgk/store/qdrantstore.go` implementa a lógica para interagir com a API REST do Qdrant:
    *   `ensureCollectionExists`: Verifica se a coleção existe. Se não, chama `createCollection`.
    *   `createCollection`: Envia uma requisição `PUT` para criar a coleção com a configuração de vetor correta (nome `default`, dimensão 768, distância `Cosine`).
    *   `AddDocuments`: Recebe os documentos (chunks), gera seus embeddings usando o `embedder` passado, e envia uma requisição `PUT` para `/points` para inserir/atualizar os pontos (vetores + payload) na coleção.
    *   `SimilaritySearch`: Recebe uma consulta (pergunta), gera seu embedding, e envia uma requisição `POST` para `/points/search` para encontrar os vetores mais similares na coleção, retornando os documentos correspondentes.
4.  **Recuperação (Retrieval):** Em `main.go`, após adicionar os documentos, uma pergunta é definida. O método `vectorStore.GetRelevantDocuments` (que chama `SimilaritySearch`) é usado para encontrar os chunks de texto mais relevantes para a pergunta no Qdrant.
5.  **Geração (Generation):** O `main.go` configura um segundo cliente Ollama para o modelo generativo (`deepseek-r1:8b`). A função `chains.NewRetrievalQAFromLLM` do LangchainGo é usada para criar uma cadeia que:
    *   Recebe a pergunta.
    *   Usa o `vectorStore` (nosso `QdrantStore`) para recuperar documentos relevantes.
    *   Passa a pergunta e os documentos recuperados como contexto para o LLM (`deepseek-r1:8b`).
    *   Retorna a resposta gerada pelo LLM.

## Configuração e Customização

*   **Modelos Ollama:** Os nomes dos modelos são definidos em `main.go` nas chamadas `ollama.New()`. Você pode trocá-los por outros modelos disponíveis no seu Ollama. **Importante:** Se trocar o modelo de embedding (`nomic-embed-text`), certifique-se de atualizar a dimensão do vetor (`Size: 768`) na função `createCollection` em `pgk/store/qdrantstore.go` para corresponder à dimensão do novo modelo.
*   **Endpoint Qdrant:** A URL base (`http://localhost:6333`) e o nome da coleção (`my_collection`) são definidos como variáveis em `main.go`.
*   **Arquivo PDF:** O caminho para o arquivo PDF a ser carregado é definido na chamada `loader.LoadAndSplitPDF` em `main.go`.
*   **Pergunta:** A pergunta de exemplo é definida na variável `question` em `main.go`.
*   **Número de Documentos Recuperados:** O número de documentos a serem recuperados na busca por similaridade é definido no método `GetRelevantDocuments` (atualmente fixo em 4 dentro da chamada para `SimilaritySearch`).
