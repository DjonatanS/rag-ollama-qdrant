/**
 * Authentication Component
 * Handles login, registration and user management
 */
import DOM from '../utils/dom.js';
import Config from '../config.js';

const Auth = {
    elements: {
        authContainer: null,
        mainContainer: null,
        loginForm: null,
        registerForm: null,
        authStatus: null,
        userDisplay: null,
        logoutBtn: null,
        authTabs: null,
        authForms: null
    },

    /**
     * Initialize the auth component
     */
    init() {
        // Cache DOM elements
        this.elements = {
            authContainer: DOM.getById('auth-container'),
            mainContainer: DOM.getById('main-container'),
            loginForm: DOM.getById('login-form'),
            registerForm: DOM.getById('register-form'),
            authStatus: DOM.getById('auth-status'),
            userDisplay: DOM.getById('user-display'),
            logoutBtn: DOM.getById('logout-btn'),
            authTabs: DOM.query('.auth-tab-btn'),
            authForms: DOM.query('.auth-form-container')
        };

        // Initialize event handlers
        this._initTabSwitching();
        this._initLoginForm();
        this._initRegisterForm();
        this._initLogout();
    },

    /**
     * Check if user is authenticated
     * @returns {boolean} - True if authenticated
     */
    isAuthenticated() {
        const user = this.getCurrentUser();
        return !!user;
    },

    /**
     * Get current user from local storage
     * @returns {object|null} - User object or null if not logged in
     */
    getCurrentUser() {
        try {
            return JSON.parse(localStorage.getItem(Config.storage.user));
        } catch (error) {
            console.error('Error parsing user data:', error);
            return null;
        }
    },

    /**
     * Update the UI based on authentication state
     * @returns {boolean} - True if user is authenticated
     */
    updateAuthUI() {
        const user = this.getCurrentUser();
        
        if (user) {
            DOM.hide(this.elements.authContainer);
            DOM.show(this.elements.mainContainer);
            
            if (this.elements.userDisplay) {
                this.elements.userDisplay.textContent = user.name || user.email;
            }
            
            // Pre-fill profile if elements exist
            const profileNameInput = DOM.getById('profile-name');
            const profileEmailInput = DOM.getById('profile-email');
            
            if (profileNameInput) profileNameInput.value = user.name || '';
            if (profileEmailInput) profileEmailInput.value = user.email || '';
            
            return true;
        } else {
            DOM.show(this.elements.authContainer);
            DOM.hide(this.elements.mainContainer);
            return false;
        }
    },

    /**
     * Initialize tab switching behavior
     * @private
     */
    _initTabSwitching() {
        if (this.elements.authTabs.length === 0 || this.elements.authForms.length === 0) return;
        
        this.elements.authTabs.forEach(btn => {
            btn.addEventListener('click', () => {
                const authType = btn.getAttribute('data-auth');
                
                this.elements.authTabs.forEach(b => b.classList.remove('active'));
                this.elements.authForms.forEach(form => form.classList.remove('active'));
                
                btn.classList.add('active');
                DOM.getById(`${authType}-form-container`).classList.add('active');
                
                if (this.elements.authStatus) {
                    this.elements.authStatus.textContent = '';
                    this.elements.authStatus.classList.add('hidden');
                }
            });
        });
    },

    /**
     * Initialize login form handler
     * @private
     */
    _initLoginForm() {
        if (!this.elements.loginForm) return;
        
        this.elements.loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const email = DOM.getById('login-email').value;
            const password = DOM.getById('login-password').value;
            const users = JSON.parse(localStorage.getItem(Config.storage.users) || '[]');
            const user = users.find(u => u.email === email && u.password === password);

            if (user) {
                const { password, ...userSession } = user;
                localStorage.setItem(Config.storage.user, JSON.stringify(userSession));
                
                DOM.showStatus(
                    this.elements.authStatus, 
                    "Login bem-sucedido! Redirecionando...", 
                    'success'
                );
                
                this.elements.loginForm.reset();
                setTimeout(() => this.updateAuthUI(), 1500);
            } else {
                DOM.showStatus(
                    this.elements.authStatus, 
                    "Email ou senha inválidos.", 
                    'error'
                );
            }
        });
    },

    /**
     * Initialize registration form handler
     * @private
     */
    _initRegisterForm() {
        if (!this.elements.registerForm) return;
        
        this.elements.registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const name = DOM.getById('register-name').value;
            const email = DOM.getById('register-email').value;
            const password = DOM.getById('register-password').value;
            const confirm = DOM.getById('register-confirm').value;

            if (password !== confirm) {
                DOM.showStatus(this.elements.authStatus, "As senhas não coincidem.", 'error');
                return;
            }
            
            if (password.length < Config.auth.minPasswordLength) {
                DOM.showStatus(
                    this.elements.authStatus, 
                    `A senha deve ter no mínimo ${Config.auth.minPasswordLength} caracteres.`, 
                    'error'
                );
                return;
            }

            const users = JSON.parse(localStorage.getItem(Config.storage.users) || '[]');
            
            if (users.some(u => u.email === email)) {
                DOM.showStatus(this.elements.authStatus, "Este email já está registrado.", 'error');
                return;
            }

            const newUser = { id: Date.now().toString(), name, email, password };
            users.push(newUser);
            localStorage.setItem(Config.storage.users, JSON.stringify(users));

            const { password: pwd, ...userSession } = newUser;
            localStorage.setItem(Config.storage.user, JSON.stringify(userSession));

            DOM.showStatus(
                this.elements.authStatus, 
                "Registro concluído! Redirecionando...", 
                'success'
            );
            
            this.elements.registerForm.reset();
            setTimeout(() => this.updateAuthUI(), 1500);
        });
    },

    /**
     * Initialize logout functionality
     * @private
     */
    _initLogout() {
        if (!this.elements.logoutBtn) return;
        
        this.elements.logoutBtn.addEventListener('click', () => {
            localStorage.removeItem(Config.storage.user);
            window.location.reload();
        });
    }
};

export default Auth;