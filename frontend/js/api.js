const API = {
    post: async function(endpoint, data = {}) {
        const url = CONFIG.API_BASE_URL + endpoint;
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        if (Auth.isAuthenticated()) {
            Object.assign(headers, Auth.getAuthHeaders());
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                console.error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('API request failed:', error);
            // Return standardized error so SPA doesn't break
            return {
                success: false,
                message: 'Failed to process request. Please try again.',
                data: null
            };
        }
    }
};
