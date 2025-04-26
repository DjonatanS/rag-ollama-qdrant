/**
 * Helper utility functions
 */

const Helpers = {
    /**
     * Escape HTML special characters to prevent XSS
     * @param {string} text - The text to escape
     * @returns {string} - Escaped HTML
     */
    escapeHtml: (text) => {
        if (typeof text !== 'string') return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },
    
    /**
     * Debounce function to limit how often a function can be called
     * @param {Function} func - The function to debounce
     * @param {number} delay - Delay in milliseconds
     * @returns {Function} - Debounced function
     */
    debounce: (func, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), delay);
        };
    },
    
    /**
     * Format a date string
     * @param {Date|string} date - Date object or date string
     * @param {string} format - Optional format (default: 'dd/mm/yyyy')
     * @returns {string} - Formatted date string
     */
    formatDate: (date, format = 'dd/mm/yyyy') => {
        const d = typeof date === 'string' ? new Date(date) : date;
        if (!(d instanceof Date) || isNaN(d)) {
            return '';
        }
        
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        
        switch (format) {
            case 'dd/mm/yyyy':
                return `${day}/${month}/${year}`;
            case 'mm/dd/yyyy':
                return `${month}/${day}/${year}`;
            case 'yyyy-mm-dd':
                return `${year}-${month}-${day}`;
            case 'dd/mm/yyyy hh:mm':
                return `${day}/${month}/${year} ${hours}:${minutes}`;
            default:
                return `${day}/${month}/${year}`;
        }
    },
    
    /**
     * Check if an object is empty
     * @param {Object} obj - Object to check
     * @returns {boolean} - True if object is empty
     */
    isEmpty: (obj) => {
        if (!obj) return true;
        if (Array.isArray(obj)) return obj.length === 0;
        if (typeof obj === 'object') return Object.keys(obj).length === 0;
        return false;
    },
    
    /**
     * Truncate text to a specified length
     * @param {string} text - The text to truncate
     * @param {number} length - Maximum length
     * @param {string} suffix - Optional suffix for truncated text
     * @returns {string} - Truncated text
     */
    truncate: (text, length = 100, suffix = '...') => {
        if (!text || typeof text !== 'string') return '';
        if (text.length <= length) return text;
        return text.substring(0, length - suffix.length) + suffix;
    },
    
    /**
     * Generate a random ID
     * @param {number} length - ID length (default: 8)
     * @returns {string} - Random ID
     */
    generateId: (length = 8) => {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },
    
    /**
     * Parse and render collapsible <think> sections
     * @param {string} answerText - The text containing <think> tags
     * @returns {string} - HTML with collapsible sections
     */
    renderThinkSections: (answerText) => {
        if (!answerText) return '';
        
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
            const escaped = Helpers.escapeHtml(seg.content);
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
        
        return html;
    }
};

export default Helpers;