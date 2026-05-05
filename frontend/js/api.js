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

            let result;
            const text = await response.text();
            try {
                result = JSON.parse(text);
            } catch (e) {
                console.error('JSON Parse Error for response:', text);
                throw e; // Rethrow to be caught by the catch block below
            }
            
            // Handle unauthorized globally
            if (response.status === 401) {
                const path = window.location.pathname;
                // Don't auto-logout if we are in the middle of onboarding/verification
                if (!path.includes('/verify') && !path.includes('/terms') && !path.includes('/profile/edit')) {
                    Auth.clearAll();
                    if (!path.includes('/login')) {
                        Router.navigate('/login');
                    }
                }
            }
            
            if (result) {
                result.status = response.status;
            }
            return result;
        } catch (error) {
            console.error('API request failed:', error);
            // Return standardized error so SPA doesn't break
            return {
                success: false,
                message: 'Failed to process request. Please try again.',
                error_details: error.message
            };
        }
    }
};
