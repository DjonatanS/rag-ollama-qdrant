/**
 * API utility for making requests to the backend
 */

const API = {
    /**
     * Make a GET request
     * @param {string} url - The URL to fetch
     * @returns {Promise} - Promise that resolves with the response data
     */
    get: async (url) => {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error("API GET error:", error);
            throw error;
        }
    },

    /**
     * Make a POST request
     * @param {string} url - The URL to post to
     * @param {object} data - The data to send
     * @returns {Promise} - Promise that resolves with the response data
     */
    post: async (url, data) => {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error("API POST error:", error);
            throw error;
        }
    },

    /**
     * Upload files using FormData
     * @param {string} url - The URL to upload to
     * @param {FormData} formData - The form data with files
     * @returns {Promise} - Promise that resolves with the response data
     */
    upload: async (url, formData) => {
        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData, // No need to set Content-Type for FormData
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error("API upload error:", error);
            throw error;
        }
    },

    /**
     * Create an event source for server-sent events
     * @param {string} url - The URL for the event source
     * @returns {EventSource} - The event source object
     */
    createEventSource: (url) => {
        return new EventSource(url);
    }
};

export default API;