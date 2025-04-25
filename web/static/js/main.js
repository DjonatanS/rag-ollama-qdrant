document.addEventListener('DOMContentLoaded', () => {
    // --- Constants ---
    const authContainer = document.getElementById('auth-container');
    const mainContainer = document.getElementById('main-container');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const authStatus = document.getElementById('auth-status');
    const userDisplay = document.getElementById('user-display');
    const logoutBtn = document.getElementById('logout-btn');
    const navItems = document.querySelectorAll('.nav-item');
    const pageContents = document.querySelectorAll('.page-content');
    const profileForm = document.getElementById('profile-form');
    const passwordForm = document.getElementById('password-form');
    const profileStatus = document.getElementById('profile-status');
    const authTabs = document.querySelectorAll('.auth-tab-btn');
    const authForms = document.querySelectorAll('.auth-form-container');

    const queryForm = document.getElementById('query-form');
    const questionInput = document.getElementById('question');
    const answerDiv = document.getElementById('answer');
    const loadingDiv = document.getElementById('loading');

    const uploadForm = document.getElementById('upload-form');
    const fileInput = document.getElementById('file-input');
    const createPerPdf = document.getElementById('create-per-pdf');
    const ingestStatusDiv = document.getElementById('ingest-status');
    const dropZone = document.getElementById('drop-zone');
    const dropZonePrompt = dropZone?.querySelector('.drop-zone-prompt'); // Use optional chaining

    // --- Functions ---

    // Check Auth State
    function checkAuth() {
        const user = JSON.parse(localStorage.getItem('user'));
        if (user) {
            authContainer.classList.add('hidden'); // Hide auth screen
            mainContainer.classList.remove('hidden'); // Show main app
            userDisplay.textContent = user.name || user.email;

            // Pre-fill profile if elements exist
            const profileNameInput = document.getElementById('profile-name');
            const profileEmailInput = document.getElementById('profile-email');
            if (profileNameInput) profileNameInput.value = user.name || '';
            if (profileEmailInput) profileEmailInput.value = user.email || '';

            // Initialize dashboard only if logged in and dashboard page exists
            if (document.getElementById('dashboard-page')) {
                console.log("Chamando initializeDashboard do main.js");
                // Verificar se a função existe antes de chamar
                if (typeof initializeDashboard === 'function') {
                    // Dar tempo para o DOM carregar completamente
                    setTimeout(() => {
                        try {
                            initializeDashboard();
                        } catch (error) {
                            console.error("Erro ao inicializar dashboard:", error);
                            const dashboardPage = document.getElementById('dashboard-page');
                            if (dashboardPage) {
                                dashboardPage.innerHTML = `<div class="error-message full-page-error">
                                    <i class="fas fa-exclamation-triangle"></i>
                                    <p>Erro ao inicializar visualizações: ${error.message}</p>
                                    <p>Tente recarregar a página ou verifique o console para mais detalhes.</p>
                                </div>`;
                            }
                        }
                    }, 100);
                } else {
                    console.error("Função initializeDashboard não encontrada. Verifique se visualizations.js foi carregado corretamente.");
                    const dashboardPage = document.getElementById('dashboard-page');
                    if (dashboardPage) {
                        dashboardPage.innerHTML = `<div class="error-message full-page-error">
                            <i class="fas fa-exclamation-triangle"></i>
                            <p>Biblioteca de visualização não foi carregada corretamente.</p>
                            <p>Verifique se o arquivo visualizations.js está disponível e foi importado.</p>
                        </div>`;
                    }
                }
            }
            return true;
        } else {
            authContainer.classList.remove('hidden'); // Show auth screen
            mainContainer.classList.add('hidden'); // Hide main app
            return false;
        }
    }

    // Display Status Messages (Auth/Profile)
    function showStatus(element, message, type = 'info') {
        if (!element) return;
        element.textContent = message;
        element.className = `status ${type}`; // types: success, error, info (default)
        element.classList.remove('hidden');

        // Optional: Auto-hide after a few seconds
        if (type === 'success' || type === 'error') {
            setTimeout(() => {
                element.textContent = '';
                element.classList.add('hidden');
            }, 5000);
        }
    }

    // Escape HTML
    function escapeHtml(text) {
        if (typeof text !== 'string') return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Render Answer with Collapsible <think> Sections
    function renderAnswer(answerText) {
        if (!answerDiv) return;
        answerDiv.classList.remove('placeholder-text'); // Remove placeholder

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
                        `<button class="toggle-btn">Mostrar Processamento Interno</button>` +
                        `<div class="think-content hidden"><pre>${escaped}</pre></div>` +
                    `</div>`;
            }
        });
        answerDiv.innerHTML = html;
    }

    // Update Drop Zone Prompt
    function updateFileCounter() {
        if (!fileInput || !dropZonePrompt) return;
        const fileCount = fileInput.files.length;
        if (fileCount > 0) {
            dropZonePrompt.textContent = `${fileCount} ${fileCount === 1 ? 'arquivo selecionado' : 'arquivos selecionados'}`;
        } else {
            dropZonePrompt.innerHTML = 'Arraste arquivos PDF aqui ou <strong>clique para selecionar</strong>'; // Reset text
        }
    }

    // Reset Drop Zone
    function resetDropZone() {
        if (uploadForm) uploadForm.reset();
        if (fileInput) fileInput.value = ''; // Clear selected files
        updateFileCounter();
    }


    // --- Event Listeners ---

    // Auth Tab Switching
    if (authTabs.length > 0 && authForms.length > 0) {
        authTabs.forEach(btn => {
            btn.addEventListener('click', () => {
                const authType = btn.getAttribute('data-auth');
                authTabs.forEach(b => b.classList.remove('active'));
                authForms.forEach(form => form.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(`${authType}-form-container`).classList.add('active');
                if (authStatus) {
                     authStatus.textContent = '';
                     authStatus.classList.add('hidden');
                }
            });
        });
    }

    // Login Form
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const users = JSON.parse(localStorage.getItem('users') || '[]');
            const user = users.find(u => u.email === email && u.password === password); // Simple check

            if (user) {
                const { password, ...userSession } = user;
                localStorage.setItem('user', JSON.stringify(userSession));
                showStatus(authStatus, "Login bem-sucedido! Redirecionando...", 'success');
                loginForm.reset();
                setTimeout(checkAuth, 1500); // Redirect after delay
            } else {
                showStatus(authStatus, "Email ou senha inválidos.", 'error');
            }
        });
    }

    // Registration Form
    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('register-name').value;
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;
            const confirm = document.getElementById('register-confirm').value;

            if (password !== confirm) {
                showStatus(authStatus, "As senhas não coincidem.", 'error');
                return;
            }
            if (password.length < 6) {
                 showStatus(authStatus, "A senha deve ter no mínimo 6 caracteres.", 'error');
                return;
            }

            const users = JSON.parse(localStorage.getItem('users') || '[]');
            if (users.some(u => u.email === email)) {
                showStatus(authStatus, "Este email já está registrado.", 'error');
                return;
            }

            const newUser = { id: Date.now().toString(), name, email, password }; // Store password temporarily
            users.push(newUser);
            localStorage.setItem('users', JSON.stringify(users));

            const { password: pwd, ...userSession } = newUser; // Don't store password in active session
            localStorage.setItem('user', JSON.stringify(userSession));

            showStatus(authStatus, "Registro concluído! Redirecionando...", 'success');
            registerForm.reset();
            setTimeout(checkAuth, 1500); // Redirect after delay
        });
    }

    // Logout Button
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('user');
            // Optionally clear other session data if needed
            window.location.reload(); // Simple way to reset state
            // checkAuth(); // Or just update UI without reload
        });
    }

    // Sidebar Navigation
    if (navItems.length > 0 && pageContents.length > 0) {
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const pageId = item.getAttribute('data-page');
                const targetPage = document.getElementById(`${pageId}-page`);

                if (targetPage) {
                    navItems.forEach(nav => nav.classList.remove('active'));
                    pageContents.forEach(page => page.classList.remove('active'));
                    item.classList.add('active');
                    targetPage.classList.add('active');

                     // Update Top Nav Title (simple example)
                     const topNavTitle = document.querySelector('.top-nav-title');
                     if (topNavTitle) {
                         const pageHeader = targetPage.querySelector('.page-header h2, h2'); // Find header in page
                         topNavTitle.textContent = pageHeader ? pageHeader.textContent : 'LLM Go Qdrant';
                     }
                } else {
                    console.warn(`Page with ID ${pageId}-page not found.`);
                }
            });
        });
    }

    // Profile Update Form
    if (profileForm) {
        profileForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('profile-name').value;
            const user = JSON.parse(localStorage.getItem('user'));
            if (!user) return; // Should not happen if logged in

            user.name = name;
            localStorage.setItem('user', JSON.stringify(user));

            // Update in the main users list as well
            const users = JSON.parse(localStorage.getItem('users') || '[]');
            const index = users.findIndex(u => u.id === user.id);
            if (index !== -1) {
                users[index].name = name; // Update name only
                localStorage.setItem('users', JSON.stringify(users));
            }

            userDisplay.textContent = user.name || user.email; // Update sidebar display
            showStatus(profileStatus, "Perfil atualizado com sucesso!", 'success');
        });
    }

    // Password Change Form
    if (passwordForm) {
        passwordForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const currentPassword = document.getElementById('current-password').value;
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            if (newPassword !== confirmPassword) {
                showStatus(profileStatus, "As novas senhas não coincidem.", 'error');
                return;
            }
             if (newPassword.length < 6) {
                 showStatus(profileStatus, "A nova senha deve ter no mínimo 6 caracteres.", 'error');
                return;
            }


            const user = JSON.parse(localStorage.getItem('user'));
            if (!user) return;
            const users = JSON.parse(localStorage.getItem('users') || '[]');
            const index = users.findIndex(u => u.id === user.id);

            if (index !== -1) {
                // Validate current password (assuming it's stored - which is NOT secure practice)
                if (users[index].password !== currentPassword) {
                    showStatus(profileStatus, "Senha atual incorreta.", 'error');
                    return;
                }

                // Update password in the 'users' storage
                users[index].password = newPassword;
                localStorage.setItem('users', JSON.stringify(users));

                passwordForm.reset();
                showStatus(profileStatus, "Senha alterada com sucesso!", 'success');
            } else {
                 showStatus(profileStatus, "Erro ao encontrar usuário para alterar senha.", 'error');
            }
        });
    }

    // Query Form (Chat)
    if (queryForm && questionInput && answerDiv && loadingDiv) {
        queryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const question = questionInput.value.trim();
            if (!question) return;

            // Verify login just in case
            if (!checkAuth()) {
                showStatus(document.getElementById('chat-status'), "Faça login para enviar perguntas.", 'error'); // Assuming a chat-status div exists
                return;
            }

            let fullAnswer = '';
            answerDiv.innerHTML = ''; // Clear previous answer
            answerDiv.classList.add('placeholder-text'); // Add placeholder back initially
            loadingDiv.classList.remove('hidden'); // Show loading
            questionInput.disabled = true; // Disable input while processing
            queryForm.querySelector('button').disabled = true;

             // Use streaming API endpoint
            try {
                const eventSource = new EventSource(`/api/stream?question=${encodeURIComponent(question)}`);

                eventSource.onopen = () => {
                    loadingDiv.classList.remove('hidden');
                    answerDiv.classList.remove('placeholder-text'); // Remove placeholder on first chunk
                };

                eventSource.onmessage = (event) => {
                    const chunk = event.data;
                    if (chunk === "[DONE]") {
                        eventSource.close();
                        loadingDiv.classList.add('hidden');
                        questionInput.disabled = false;
                        queryForm.querySelector('button').disabled = false;
                        // Optionally scroll to bottom
                        const chatOutput = document.querySelector('.chat-output');
                        if (chatOutput) chatOutput.scrollTop = chatOutput.scrollHeight;
                        return;
                    }
                    fullAnswer += chunk;
                    renderAnswer(fullAnswer); // Render incrementally
                };

                eventSource.onerror = (err) => {
                    console.error("EventSource failed:", err);
                    eventSource.close();
                    loadingDiv.classList.add('hidden');
                    questionInput.disabled = false;
                    queryForm.querySelector('button').disabled = false;
                    if (!fullAnswer) { // Show error only if no answer was received
                         renderAnswer("Erro ao conectar com o servidor de streaming. Verifique a conexão e tente novamente.");
                    }
                     showStatus(document.getElementById('chat-status'), "Erro na conexão de streaming.", 'error');
                };
            } catch (error) {
                console.error("Error setting up EventSource:", error);
                loadingDiv.classList.add('hidden');
                questionInput.disabled = false;
                queryForm.querySelector('button').disabled = false;
                 renderAnswer(`Erro ao iniciar a consulta: ${error.message}`);
                 showStatus(document.getElementById('chat-status'), `Erro: ${error.message}`, 'error');
            }
        });

        // Delegate click for toggling think sections
        answerDiv.addEventListener('click', (e) => {
            if (e.target && e.target.classList.contains('toggle-btn')) {
                const content = e.target.nextElementSibling;
                if (content && content.classList.contains('think-content')) {
                    content.classList.toggle('hidden');
                    e.target.textContent = content.classList.contains('hidden') ? 'Mostrar Processamento Interno' : 'Ocultar Processamento Interno';
                }
            }
        });
    }

    // Ingest Form (Document Upload)
    if (uploadForm && fileInput && ingestStatusDiv && dropZone) {
        // Drag and drop listeners
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.add('drop-zone-active'), false);
        });
        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.remove('drop-zone-active'), false);
        });

        dropZone.addEventListener('drop', (e) => {
            if (e.dataTransfer.files) {
                fileInput.files = e.dataTransfer.files;
                updateFileCounter();
            }
        });

        fileInput.addEventListener('change', updateFileCounter);

        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!checkAuth()) {
                 showStatus(ingestStatusDiv, "Faça login para enviar documentos.", 'error');
                return;
            }
            if (fileInput.files.length === 0) {
                 showStatus(ingestStatusDiv, "Selecione ao menos um arquivo PDF.", 'error');
                return;
            }

            showStatus(ingestStatusDiv, "Processando documentos...", 'info');
            const submitButton = uploadForm.querySelector('button[type="submit"]');
            if (submitButton) submitButton.disabled = true;


            const formData = new FormData();
            for (const file of fileInput.files) {
                formData.append('pdfs', file);
            }
            if (createPerPdf) formData.append('perPdf', createPerPdf.checked);

            try {
                const response = await fetch('/api/ingest', { method: 'POST', body: formData });
                const data = await response.json();

                if (response.ok) {
                    showStatus(ingestStatusDiv, `Sucesso: ${data.message || 'Documentos processados.'}`, 'success');
                    resetDropZone(); // Reset form and drop zone text
                } else {
                    showStatus(ingestStatusDiv, `Erro: ${data.error || 'Falha ao processar os documentos.'}`, 'error');
                }
            } catch (error) {
                 console.error("Ingest error:", error);
                 showStatus(ingestStatusDiv, `Erro de rede ou servidor: ${error.message}`, 'error');
            } finally {
                 if (submitButton) submitButton.disabled = false;
            }
        });
    }


    // --- Initialization ---
    checkAuth(); // Initial check when the page loads

}); // End DOMContentLoaded