/**
 * DOM utility for common DOM operations
 */

const DOM = {
    /**
     * Get an element by ID
     * @param {string} id - The element ID
     * @returns {HTMLElement|null} - The element or null if not found
     */
    getById: (id) => document.getElementById(id),
    
    /**
     * Get elements by selector
     * @param {string} selector - The CSS selector
     * @param {HTMLElement} parent - Optional parent element (defaults to document)
     * @returns {NodeList} - The matched elements
     */
    query: (selector, parent = document) => parent.querySelectorAll(selector),
    
    /**
     * Get first element by selector
     * @param {string} selector - The CSS selector
     * @param {HTMLElement} parent - Optional parent element (defaults to document)
     * @returns {HTMLElement|null} - The first matched element or null
     */
    queryOne: (selector, parent = document) => parent.querySelector(selector),
    
    /**
     * Show an element (remove 'hidden' class)
     * @param {HTMLElement} element - The element to show
     */
    show: (element) => {
        if (element) element.classList.remove('hidden');
    },
    
    /**
     * Hide an element (add 'hidden' class)
     * @param {HTMLElement} element - The element to hide
     */
    hide: (element) => {
        if (element) element.classList.add('hidden');
    },
    
    /**
     * Toggle element visibility
     * @param {HTMLElement} element - The element to toggle
     * @returns {boolean} - True if element is now visible, false if hidden
     */
    toggle: (element) => {
        if (!element) return false;
        const isHidden = element.classList.toggle('hidden');
        return !isHidden; // Return true if element is now visible
    },
    
    /**
     * Display status message
     * @param {HTMLElement} element - The status element
     * @param {string} message - The message to display
     * @param {string} type - Message type: 'success', 'error', or 'info'
     * @param {number} timeout - Optional auto-hide timeout in ms
     */
    showStatus: (element, message, type = 'info', timeout = 0) => {
        if (!element) return;
        
        element.textContent = message;
        element.className = `status ${type}`;
        element.classList.remove('hidden');
        
        if (timeout > 0) {
            setTimeout(() => {
                element.textContent = '';
                element.classList.add('hidden');
            }, timeout);
        }
    },
    
    /**
     * Create an element with attributes and children
     * @param {string} tag - The tag name
     * @param {object} attrs - Optional attributes
     * @param {string|HTMLElement|Array} children - Optional children
     * @returns {HTMLElement} - The created element
     */
    createElement: (tag, attrs = {}, children = null) => {
        const element = document.createElement(tag);
        
        // Set attributes
        Object.entries(attrs).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'style' && typeof value === 'object') {
                Object.assign(element.style, value);
            } else if (key.startsWith('on') && typeof value === 'function') {
                element.addEventListener(key.substring(2).toLowerCase(), value);
            } else {
                element.setAttribute(key, value);
            }
        });
        
        // Add children
        if (children) {
            if (Array.isArray(children)) {
                children.forEach(child => {
                    if (child) {
                        element.appendChild(typeof child === 'string' 
                            ? document.createTextNode(child) 
                            : child);
                    }
                });
            } else {
                element.appendChild(typeof children === 'string' 
                    ? document.createTextNode(children) 
                    : children);
            }
        }
        
        return element;
    }
};

export default DOM;