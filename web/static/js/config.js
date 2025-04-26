/**
 * Application configuration settings
 */

const Config = {
    // API endpoints
    api: {
        stream: '/api/stream',
        ingest: '/api/ingest',
        collections: '/api/collections'
    },
    
    // Default settings
    defaults: {
        resultsLimit: 5,
        autoHideTimeout: 5000, // ms
        darkModeDefault: true
    },
    
    // Local storage keys
    storage: {
        user: 'user',
        users: 'users',
        darkMode: 'darkMode',
        searchHistory: 'searchHistory'
    },
    
    // Authentication settings
    auth: {
        minPasswordLength: 6
    }
};

export default Config;