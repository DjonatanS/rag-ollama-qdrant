document.addEventListener('DOMContentLoaded', () => {
    // Tabs
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });

    // Query form
    const queryForm = document.getElementById('query-form');
    const questionInput = document.getElementById('question');
    const answerDiv = document.getElementById('answer');
    const loadingDiv = document.getElementById('loading');

    // Escape HTML to prevent injection
    function escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Render answer with collapsible <think> sections
    function renderAnswer(answerText) {
        const segments = [];
        let lastIndex = 0;
        const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
        let match;
        while ((match = thinkRegex.exec(answerText)) !== null) {
            if (match.index > lastIndex) {
                segments.push({ type: 'text', content: answerText.slice(lastIndex, match.index) });
            }
            segments.push({ type: 'think', content: match[1] });
            lastIndex = thinkRegex.lastIndex;
        }
        if (lastIndex < answerText.length) {
            segments.push({ type: 'text', content: answerText.slice(lastIndex) });
        }

        let html = '';
        segments.forEach(seg => {
            const escaped = escapeHtml(seg.content);
            if (seg.type === 'text') {
                html += `<span>${escaped}</span>`;
            } else if (seg.type === 'think') {
                html +=
                    `<div class="think">` +
                        `<button class="toggle-btn">Show thought</button>` +
                        `<div class="think-content hidden">${escaped}</div>` +
                    `</div>`;
            }
        });
        answerDiv.innerHTML = html;
    }

    // Delegate click for toggling think sections
    answerDiv.addEventListener('click', (e) => {
        if (e.target && e.target.classList.contains('toggle-btn')) {
            const content = e.target.nextElementSibling;
            if (content) {
                content.classList.toggle('hidden');
                e.target.textContent = content.classList.contains('hidden') ? 'Show thought' : 'Hide thought';
            }
        }
    });
    queryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const question = questionInput.value.trim();
        if (!question) return;

        // Clear previous answer and show loading
        let fullAnswer = '';
        answerDiv.innerHTML = '';
        loadingDiv.classList.remove('hidden');

        // Sempre usar streaming para consultas
        try {
            const eventSource = new EventSource(`/api/stream?question=${encodeURIComponent(question)}`);
            eventSource.onmessage = (event) => {
                const chunk = event.data;
                if (chunk === "[DONE]") {
                    eventSource.close();
                    loadingDiv.classList.add('hidden');
                    return;
                }
                fullAnswer += chunk;
                renderAnswer(fullAnswer);
            };
            eventSource.onerror = () => {
                eventSource.close();
                loadingDiv.classList.add('hidden');
                if (!fullAnswer) {
                    answerDiv.textContent = "Erro ao conectar com o servidor.";
                }
            };
        } catch (error) {
            loadingDiv.classList.add('hidden');
            answerDiv.textContent = `Erro: ${error.message}`;
        }
    });

    // Ingest form
    const uploadForm = document.getElementById('upload-form');
    const fileInput = document.getElementById('file-input');
    const createPerPdf = document.getElementById('create-per-pdf');
    const statusDiv = document.getElementById('ingest-status');
    const dropZone = document.querySelector('.drop-zone');

    // Drag and drop
    ['dragover', 'dragenter'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.add('drop-zone-active');
        }, false);
    });

    ['dragleave', 'dragend'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.remove('drop-zone-active');
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drop-zone-active');
        fileInput.files = e.dataTransfer.files;
        updateFileCounter();
    });

    fileInput.addEventListener('change', updateFileCounter);

    function updateFileCounter() {
        if (fileInput.files.length > 0) {
            const fileCount = fileInput.files.length;
            const prompt = dropZone.querySelector('.drop-zone-prompt');
            prompt.textContent = `${fileCount} ${fileCount === 1 ? 'arquivo selecionado' : 'arquivos selecionados'}`;
        }
    }

    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (fileInput.files.length === 0) {
            statusDiv.textContent = "Por favor, selecione ao menos um arquivo PDF.";
            statusDiv.className = "status error";
            return;
        }

        // Show loading status
        statusDiv.textContent = "Processando documentos...";
        statusDiv.className = "status";

        const formData = new FormData();
        
        for (const file of fileInput.files) {
            formData.append('pdfs', file);
        }
        
        formData.append('perPdf', createPerPdf.checked);

        try {
            const response = await fetch('/api/ingest', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (response.ok) {
                statusDiv.textContent = `Sucesso: ${data.message}`;
                statusDiv.className = "status success";
                uploadForm.reset();
                dropZone.querySelector('.drop-zone-prompt').textContent = 'Arraste arquivos PDF aqui ou clique para selecionar';
            } else {
                statusDiv.textContent = `Erro: ${data.error || 'Falha ao processar os documentos.'}`;
                statusDiv.className = "status error";
            }
        } catch (error) {
            statusDiv.textContent = `Erro: ${error.message}`;
            statusDiv.className = "status error";
        }
    });
});