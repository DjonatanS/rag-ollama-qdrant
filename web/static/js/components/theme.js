/**
 * Theme Component
 * Handles dark/light mode theme switching
 */
import DOM from '../utils/dom.js';
import Config from '../config.js';

const Theme = {
    elements: {
        authSwitch: null,
        mainSwitch: null
    },
    
    /**
     * Initialize theme management
     */
    init() {
        // Cache DOM elements
        this.elements = {
            authSwitch: DOM.getById('auth-dark-mode-switch'),
            mainSwitch: DOM.getById('main-dark-mode-switch')
        };
        
        // Initialize event handlers
        this._initToggleSwitches();
        
        // Apply saved theme preference
        this._applyInitialTheme();
    },
    
    /**
     * Toggle between dark and light mode
     * @returns {boolean} - True if dark mode is now active, false if light mode
     */
    toggleDarkMode() {
        const isDarkMode = document.body.classList.toggle('dark-mode');
        this._syncTogglesState(isDarkMode);
        this._savePreference(isDarkMode);
        this._updateVisualizations(isDarkMode);
        return isDarkMode;
    },
    
    /**
     * Set dark mode state explicitly
     * @param {boolean} isDarkMode - True to enable dark mode, false for light mode
     */
    setDarkMode(isDarkMode) {
        if (isDarkMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        
        this._syncTogglesState(isDarkMode);
        this._savePreference(isDarkMode);
    },
    
    /**
     * Initialize theme toggle switches
     * @private
     */
    _initToggleSwitches() {
        const { authSwitch, mainSwitch } = this.elements;
        
        // Add event listener to auth page switch
        if (authSwitch) {
            authSwitch.addEventListener('change', () => {
                this.toggleDarkMode();
            });
        }
        
        // Add event listener to main app switch
        if (mainSwitch) {
            mainSwitch.addEventListener('change', () => {
                this.toggleDarkMode();
            });
        }
    },
    
    /**
     * Apply initial theme based on saved preference
     * @private
     */
    _applyInitialTheme() {
        const darkModePreference = localStorage.getItem(Config.storage.darkMode);
        
        // Default to dark mode unless explicitly set to disabled
        if (darkModePreference === 'disabled') {
            this.setDarkMode(false);
        } else {
            this.setDarkMode(true);
        }
    },
    
    /**
     * Sync toggle switches state with theme
     * @param {boolean} isDarkMode - True if dark mode is active
     * @private
     */
    _syncTogglesState(isDarkMode) {
        const { authSwitch, mainSwitch } = this.elements;
        
        if (authSwitch) {
            authSwitch.checked = isDarkMode;
        }
        
        if (mainSwitch) {
            mainSwitch.checked = isDarkMode;
        }
    },
    
    /**
     * Save theme preference to local storage
     * @param {boolean} isDarkMode - True if dark mode is active
     * @private
     */
    _savePreference(isDarkMode) {
        localStorage.setItem(
            Config.storage.darkMode, 
            isDarkMode ? 'enabled' : 'disabled'
        );
    },
    
    /**
     * Update visualizations when theme changes
     * This refreshes charts and visualizations to match the new theme colors
     * @param {boolean} isDarkMode - True if dark mode is active
     * @private
     */
    _updateVisualizations(isDarkMode) {
        // Only update if we're on the dashboard page and visualizations exist
        const dashboardPage = DOM.getById('dashboard-page');
        if (!dashboardPage?.classList.contains('active')) {
            return;
        }
        
        // Handle Chart.js charts if they exist
        if (typeof window.visualizationState !== 'undefined' && 
            window.visualizationState.chartInstance) {
            try {
                // Destroy and recreate the chart with new theme colors
                window.visualizationState.chartInstance.destroy();
                window.createCollectionDistributionChart();
            } catch (err) {
                console.error("Error updating chart:", err);
            }
        }
        
        // Handle D3 visualizations if data exists
        if (typeof window.visualizationState !== 'undefined' && 
            window.visualizationState.currentData &&
            window.visualizationState.currentData.length > 0) {
            try {
                // Refresh the current visualization with new theme colors
                window.updateVisualizationDisplay();
            } catch (err) {
                console.error("Error updating D3 visualization:", err);
            }
        }
    }
};

export default Theme;