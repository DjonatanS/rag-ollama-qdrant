/**
 * Main Application Entry Point
 * Initializes and orchestrates all components
 */
import Auth from './components/auth.js';
import Navigation from './components/navigation.js';
import Chat from './components/chat.js';
import Uploader from './components/uploader.js';
import Theme from './components/theme.js';

/**
 * Main App Controller
 */
const App = {
    /**
     * Initialize the application
     */
    init() {
        // Initialize theme controller first (to apply theme immediately)
        Theme.init();
        
        // Initialize authentication
        Auth.init();
        
        // Initialize navigation
        Navigation.init();
        
        // Initialize other components only if user is authenticated
        if (Auth.isAuthenticated()) {
            this._initAuthenticatedComponents();
        }
        
        // Listen for authentication changes
        window.addEventListener('userAuthenticated', () => {
            this._initAuthenticatedComponents();
        });
        
        // Handle page-specific initializations when navigation occurs
        window.addEventListener('pageChanged', (event) => {
            this._handlePageChange(event.detail.pageId);
        });
        
        console.log('Application initialized');
    },
    
    /**
     * Initialize components that require authentication
     * @private
     */
    _initAuthenticatedComponents() {
        // Init components
        Chat.init();
        Uploader.init();
        
        // Initialize any dashboard/visualization components if available
        if (typeof window.initializeDashboard === 'function') {
            try {
                window.initializeDashboard();
            } catch (error) {
                console.error("Error initializing dashboard:", error);
            }
        }
    },
    
    /**
     * Handle page-specific actions when navigation occurs
     * @param {string} pageId - ID of the page being navigated to
     * @private
     */
    _handlePageChange(pageId) {
        // Add any specific logic to run when changing pages
        switch (pageId) {
            case 'dashboard':
                if (typeof window.updateVisualizationDisplay === 'function') {
                    window.updateVisualizationDisplay();
                }
                break;
                
            case 'query':
                // Focus on the question input when navigating to chat page
                setTimeout(() => {
                    const questionInput = document.getElementById('question');
                    if (questionInput) questionInput.focus();
                }, 100);
                break;
                
            default:
                break;
        }
    }
};

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Expose App globally for debugging purposes
window.App = App;