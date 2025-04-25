document.addEventListener('DOMContentLoaded', () => {
    // User Authentication & Session Management
    const authContainer = document.getElementById('auth-container');
    const mainContainer = document.getElementById('main-container');
    const authTabs = document.querySelectorAll('.auth-tab-btn');
    const authForms = document.querySelectorAll('.auth-form-container');
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

    // Check if user is logged in
    function checkAuth() {
        const user = JSON.parse(localStorage.getItem('user'));
        if (user) {
            authContainer.classList.add('hidden');
            mainContainer.classList.remove('hidden');
            userDisplay.textContent = user.name || user.email;
            
            // Fill profile data if available
            if (document.getElementById('profile-name')) {
                document.getElementById('profile-name').value = user.name || '';
            }
            if (document.getElementById('profile-email')) {
                document.getElementById('profile-email').value = user.email || '';
            }
            
            return true;
        } else {
            authContainer.classList.remove('hidden');
            mainContainer.classList.add('hidden');
            return false;
        }
    }

    // Authentication Tab Switching
    authTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            const authType = btn.getAttribute('data-auth');
            
            authTabs.forEach(b => b.classList.remove('active'));
            authForms.forEach(form => form.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(`${authType}-form-container`).classList.add('active');
            authStatus.textContent = '';
            authStatus.className = 'status';
        });
    });

    // Login Form Submission
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        // Demo authentication - in a real app, this would be a server request
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        const user = users.find(u => u.email === email && u.password === password);
        
        if (user) {
            // Store user session (except password)
            const { password, ...userSession } = user;
            localStorage.setItem('user', JSON.stringify(userSession));
            
            authStatus.textContent = "Login bem-sucedido!";
            authStatus.className = "status success";
            
            // Reset form and redirect to main app
            loginForm.reset();
            setTimeout(() => {
                checkAuth();
            }, 1000);
        } else {
            authStatus.textContent = "Email ou senha inválidos.";
            authStatus.className = "status error";
        }
    });

    // Registration Form Submission
    registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const confirm = document.getElementById('register-confirm').value;
        
        // Validate passwords match
        if (password !== confirm) {
            authStatus.textContent = "As senhas não coincidem.";
            authStatus.className = "status error";
            return;
        }
        
        // Check if email already exists
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        if (users.some(u => u.email === email)) {
            authStatus.textContent = "Este email já está registrado.";
            authStatus.className = "status error";
            return;
        }
        
        // Add new user
        const newUser = { id: Date.now().toString(), name, email, password };
        users.push(newUser);
        localStorage.setItem('users', JSON.stringify(users));
        
        // Store user session (except password)
        const { password: pwd, ...userSession } = newUser;
        localStorage.setItem('user', JSON.stringify(userSession));
        
        authStatus.textContent = "Registro concluído com sucesso!";
        authStatus.className = "status success";
        
        // Reset form and redirect to main app
        registerForm.reset();
        setTimeout(() => {
            checkAuth();
        }, 1000);
    });

    // Logout
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('user');
        checkAuth();
    });

    // Sidebar Navigation
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            const pageId = item.getAttribute('data-page');
            
            navItems.forEach(nav => nav.classList.remove('active'));
            pageContents.forEach(page => page.classList.remove('active'));
            
            item.classList.add('active');
            document.getElementById(`${pageId}-page`).classList.add('active');
        });
    });

    // Profile Update Form
    if (profileForm) {
        profileForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const name = document.getElementById('profile-name').value;
            
            // Update user details
            const user = JSON.parse(localStorage.getItem('user'));
            user.name = name;
            localStorage.setItem('user', JSON.stringify(user));
            
            // Update in users array too
            const users = JSON.parse(localStorage.getItem('users') || '[]');
            const index = users.findIndex(u => u.id === user.id);
            if (index !== -1) {
                users[index] = { ...users[index], name };
                localStorage.setItem('users', JSON.stringify(users));
            }
            
            // Update display
            userDisplay.textContent = user.name || user.email;
            
            profileStatus.textContent = "Perfil atualizado com sucesso!";
            profileStatus.className = "status success";
            
            setTimeout(() => {
                profileStatus.textContent = "";
                profileStatus.className = "status";
            }, 3000);
        });
    }

    // Password Change Form
    if (passwordForm) {
        passwordForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const currentPassword = document.getElementById('current-password').value;
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            
            // Validate new passwords match
            if (newPassword !== confirmPassword) {
                profileStatus.textContent = "As novas senhas não coincidem.";
                profileStatus.className = "status error";
                return;
            }
            
            // Get current user
            const user = JSON.parse(localStorage.getItem('user'));
            const users = JSON.parse(localStorage.getItem('users') || '[]');
            const index = users.findIndex(u => u.id === user.id);
            
            if (index !== -1) {
                // Validate current password
                if (users[index].password !== currentPassword) {
                    profileStatus.textContent = "Senha atual incorreta.";
                    profileStatus.className = "status error";
                    return;
                }
                
                // Update password
                users[index].password = newPassword;
                localStorage.setItem('users', JSON.stringify(users));
                
                passwordForm.reset();
                profileStatus.textContent = "Senha alterada com sucesso!";
                profileStatus.className = "status success";
                
                setTimeout(() => {
                    profileStatus.textContent = "";
                    profileStatus.className = "status";
                }, 3000);
            }
        });
    }

    // Initialize auth state
    checkAuth();
    
    // Existing code for query and document upload
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

        // Verify user is logged in before submitting query
        if (!checkAuth()) {
            return;
        }

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
        
        // Verify user is logged in before uploading
        if (!checkAuth()) {
            return;
        }
        
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