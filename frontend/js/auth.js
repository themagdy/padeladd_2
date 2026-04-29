const Auth = {
    getToken: function() {
        return localStorage.getItem('auth_token');
    },
    setToken: function(token) {
        localStorage.setItem('auth_token', token);
    },
    clearToken: function() {
        localStorage.removeItem('auth_token');
    },
    isAuthenticated: function() {
        return !!this.getToken();
    },
    getAuthHeaders: function() {
        return {
            'Authorization': 'Bearer ' + this.getToken()
        };
    },
    hasProfile: function() {
        return localStorage.getItem('has_profile') === 'true';
    },
    setHasProfile: function(val) {
        localStorage.setItem('has_profile', val ? 'true' : 'false');
    },
    hasLevel: function() {
        return localStorage.getItem('has_level') === 'true';
    },
    setHasLevel: function(val) {
        localStorage.setItem('has_level', val ? 'true' : 'false');
    },
    clearAll: function() {
        this.clearToken();
        localStorage.removeItem('has_profile');
        localStorage.removeItem('has_level');
    }
};
