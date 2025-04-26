/**
 * Chat Component
 * Handles document querying and answer display
 */
import DOM from '../utils/dom.js';
import API from '../utils/api.js';
import Helpers from '../utils/helpers.js';
import Config from '../config.js';

const Chat = {
    elements: {
        queryForm: null,
        questionInput: null,
        answerDiv: null,
        loadingDiv: null,
        chatStatus: null
    },
    
    eventSource: null,

    /**
     * Initialize the chat component
     */
    init() {
        // Cache DOM elements
        this.elements = {
            queryForm: DOM.getById('query-form'),
            questionInput: DOM.getById('question'),
            answerDiv: DOM.getById('answer'),
            loadingDiv: DOM.getById('loading'),
            chatStatus: DOM.getById('chat-status')
        };

        // Initialize event handlers
        this._initQueryForm();
        this._initThinkToggleHandlers();
    },

    /**
     * Initialize query form submission
     * @private
     */
    _initQueryForm() {
        if (!this.elements.queryForm || !this.elements.questionInput || 
            !this.elements.answerDiv || !this.elements.loadingDiv) return;
        
        this.elements.queryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const question = this.elements.questionInput.value.trim();
            if (!question) return;

            // Close any existing event source
            if (this.eventSource) {
                this.eventSource.close();
                this.eventSource = null;
            }

            let fullAnswer = '';
            
            this.elements.answerDiv.innerHTML = '';
            this.elements.answerDiv.classList.add('placeholder-text');
            DOM.show(this.elements.loadingDiv);
            this.elements.questionInput.disabled = true;
            this.elements.queryForm.querySelector('button').disabled = true;

            try {
                this._saveToSearchHistory(question);
                const eventSourceUrl = `${Config.api.stream}?question=${encodeURIComponent(question)}`;
                this.eventSource = API.createEventSource(eventSourceUrl);

                this.eventSource.onopen = () => {
                    DOM.show(this.elements.loadingDiv);
                    this.elements.answerDiv.classList.remove('placeholder-text');
                };

                this.eventSource.onmessage = (event) => {
                    const chunk = event.data;
                    
                    if (chunk === "[DONE]") {
                        this.eventSource.close();
                        this.eventSource = null;
                        DOM.hide(this.elements.loadingDiv);
                        this.elements.questionInput.disabled = false;
                        this.elements.queryForm.querySelector('button').disabled = false;
                        
                        // Scroll to bottom
                        const chatOutput = document.querySelector('.chat-output');
                        if (chatOutput) chatOutput.scrollTop = chatOutput.scrollHeight;
                        return;
                    }
                    
                    fullAnswer += chunk;
                    this._renderAnswer(fullAnswer); // Render incrementally
                };

                this.eventSource.onerror = (err) => {
                    console.error("EventSource failed:", err);
                    
                    if (this.eventSource) {
                        this.eventSource.close();
                        this.eventSource = null;
                    }
                    
                    DOM.hide(this.elements.loadingDiv);
                    this.elements.questionInput.disabled = false;
                    this.elements.queryForm.querySelector('button').disabled = false;
                    
                    if (!fullAnswer) {
                        // Show error only if no answer was received
                        this._renderAnswer("Error connecting to streaming server. Check your connection and try again.");
                    }
                    
                    if (this.elements.chatStatus) {
                        DOM.showStatus(
                            this.elements.chatStatus, 
                            "Streaming connection error.", 
                            'error',
                            Config.defaults.autoHideTimeout
                        );
                    }
                };
            } catch (error) {
                console.error("Error setting up EventSource:", error);
                
                DOM.hide(this.elements.loadingDiv);
                this.elements.questionInput.disabled = false;
                this.elements.queryForm.querySelector('button').disabled = false;
                
                this._renderAnswer(`Error starting the query: ${error.message}`);
                
                if (this.elements.chatStatus) {
                    DOM.showStatus(
                        this.elements.chatStatus, 
                        `Error: ${error.message}`, 
                        'error',
                        Config.defaults.autoHideTimeout
                    );
                }
            }
        });
    },

    /**
     * Initialize event delegation for think section toggle buttons
     * @private
     */
    _initThinkToggleHandlers() {
        if (!this.elements.answerDiv) return;
        
        // Delegate click for toggling think sections
        this.elements.answerDiv.addEventListener('click', (e) => {
            if (!e.target || !e.target.classList.contains('toggle-btn')) return;
            
            const content = e.target.nextElementSibling;
            if (!content || !content.classList.contains('think-content')) return;
            
            const isHidden = DOM.toggle(content);
            e.target.textContent = isHidden 
                ? 'Show Internal Processing' 
                : 'Hide Internal Processing';
        });
    },

    /**
     * Save search query to history
     * @param {string} query - Search query
     * @private
     */
    _saveToSearchHistory(query) {
        if (!query) return;
        
        try {
            const history = JSON.parse(localStorage.getItem(Config.storage.searchHistory) || '[]');
            // Remove existing duplicate if any
            const updatedHistory = history.filter(item => item.toLowerCase() !== query.toLowerCase());
            // Add new query at the beginning of the array
            updatedHistory.unshift(query);
            // Keep only last X items
            const limitedHistory = updatedHistory.slice(0, 10); // Keep last 10 searches
            localStorage.setItem(Config.storage.searchHistory, JSON.stringify(limitedHistory));
        } catch (error) {
            console.error("Error saving search history:", error);
        }
    },

    /**
     * Render answer with formatted think sections
     * @param {string} answerText - Answer text with <think> tags
     * @private
     */
    _renderAnswer(answerText) {
        if (!this.elements.answerDiv) return;
        
        this.elements.answerDiv.classList.remove('placeholder-text');
        this.elements.answerDiv.innerHTML = Helpers.renderThinkSections(answerText);
    }
};

export default Chat;