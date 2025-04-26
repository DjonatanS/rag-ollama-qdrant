/**
 * Navigation Component
 * Manages page navigation and top menu functionality
 */
import DOM from '../utils/dom.js';

const Navigation = {
    elements: {
        navItems: null,
        pageContents: null,
        topNavTitle: null
    },

    /**
     * Initialize the navigation component
     */
    init() {
        // Cache DOM elements
        this.elements = {
            navItems: DOM.query('.nav-item'),
            pageContents: DOM.query('.page-content'),
            topNavTitle: DOM.queryOne('.top-nav-title')
        };

        // Initialize event handlers
        this._initNavigation();
    },

    /**
     * Navigate to a specific page
     * @param {string} pageId - The page ID to navigate to
     * @returns {boolean} - True if navigation was successful
     */
    navigateTo(pageId) {
        const targetPage = DOM.getById(`${pageId}-page`);
        const navItem = DOM.queryOne(`.nav-item[data-page="${pageId}"]`);
        
        if (!targetPage || !navItem) {
            console.warn(`Navigation failed: Page with ID ${pageId}-page not found.`);
            return false;
        }
        
        // Update navigation classes
        this.elements.navItems.forEach(item => item.classList.remove('active'));
        this.elements.pageContents.forEach(page => page.classList.remove('active'));
        
        navItem.classList.add('active');
        targetPage.classList.add('active');
        
        // Update page title in top nav
        this._updateTopNavTitle(targetPage);
        
        // Trigger custom event that other components can listen for
        window.dispatchEvent(new CustomEvent('pageChanged', { 
            detail: { pageId, element: targetPage } 
        }));
        
        return true;
    },

    /**
     * Initialize sidebar navigation functionality
     * @private
     */
    _initNavigation() {
        if (this.elements.navItems.length === 0 || this.elements.pageContents.length === 0) return;
        
        // Add click listeners to all navigation items
        this.elements.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                
                const pageId = item.getAttribute('data-page');
                if (pageId) {
                    this.navigateTo(pageId);
                    
                    // Update URL hash for bookmarking (optional)
                    window.location.hash = pageId;
                }
            });
        });
        
        // Handle initial navigation based on URL hash (optional)
        this._handleInitialNavigation();
    },

    /**
     * Handle initial navigation when page loads
     * @private
     */
    _handleInitialNavigation() {
        // Check if there's a hash in the URL
        const hash = window.location.hash.substring(1); // Remove the # character
        
        if (hash) {
            // Try to navigate to the page specified in the hash
            const success = this.navigateTo(hash);
            
            // If navigation failed, go to default page
            if (!success) {
                this._navigateToDefaultPage();
            }
        } else {
            // No hash, go to default page
            this._navigateToDefaultPage();
        }
    },

    /**
     * Navigate to the default page (usually first page or dashboard)
     * @private
     */
    _navigateToDefaultPage() {
        // Find the first nav item, which is typically the default page
        const firstNavItem = this.elements.navItems[0];
        
        if (firstNavItem) {
            const defaultPageId = firstNavItem.getAttribute('data-page');
            if (defaultPageId) {
                this.navigateTo(defaultPageId);
            }
        }
    },

    /**
     * Update the top navigation title based on the current page
     * @param {HTMLElement} targetPage - The active page element
     * @private
     */
    _updateTopNavTitle(targetPage) {
        if (!this.elements.topNavTitle || !targetPage) return;
        
        // Find the page title from the page header if it exists
        const pageHeader = targetPage.querySelector('.page-header h2, h2');
        
        if (pageHeader) {
            this.elements.topNavTitle.textContent = pageHeader.textContent;
        } else {
            // Default title if no header found
            this.elements.topNavTitle.textContent = 'LLM Go Qdrant';
        }
    }
};

export default Navigation;