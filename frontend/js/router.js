const Router = {
    routes: {
        '/': { template: 'frontend/pages/auth/login.html', init: () => AuthController.initLogin() },
        '/index.html': { template: 'frontend/pages/auth/login.html', init: () => AuthController.initLogin() },
        '/login': { template: 'frontend/pages/auth/login.html', init: () => AuthController.initLogin() },
        '/register': { template: 'frontend/pages/auth/register.html', init: () => AuthController.initRegister() },
        '/verify': { template: 'frontend/pages/auth/verify.html', init: () => AuthController.initVerify() },
        '/forgot-password': { template: 'frontend/pages/auth/forgot_password.html', init: () => AuthController.initForgotPassword() },
        '/reset-password': { template: 'frontend/pages/auth/reset_password.html', init: () => AuthController.initResetPassword() },
        '/profile/edit': { template: 'frontend/pages/profile/edit.html', init: () => ProfileController.initEdit() },
        '/verify-email': { template: 'frontend/pages/auth/verify_success.html', init: () => AuthController.handleEmailLink() },
        '/dashboard': { template: 'frontend/pages/dashboard.html', init: () => {} } 
    },
    
    init: function() {
        window.addEventListener('popstate', this.handleRoute.bind(this));
        document.body.addEventListener('click', e => {
            let target = e.target.closest('[data-link]');
            if (target) {
                e.preventDefault();
                let href = target.getAttribute('href');
                this.navigate(href);
            }
        });
        this.handleRoute(); // Process initial load
    },
    
    navigate: function(path, addToHistory = true) {
        let finalPath = path;
        // Auto-prefix with BASE_PATH if needed
        if (finalPath.startsWith('/') && !finalPath.startsWith(CONFIG.BASE_PATH)) {
            finalPath = CONFIG.BASE_PATH + (finalPath === '/' ? '' : finalPath);
        }

        if (addToHistory) {
            history.pushState(null, null, finalPath);
        }
        this.handleRoute();
    },
    
    handleRoute: async function() {
        // Normalize path by stripping CONFIG.BASE_PATH
        let path = window.location.pathname;
        if (path.startsWith(CONFIG.BASE_PATH)) {
            path = path.slice(CONFIG.BASE_PATH.length);
        }
        if (path === '') path = '/';
        if (path !== '/' && path.endsWith('/')) {
            path = path.slice(0, -1);
        }
        
        const appDiv = document.getElementById('app-content');
        if (!appDiv) return;

        // Display loading state using global loader
        const loader = document.getElementById('global-loader');
        if (loader) loader.style.display = 'flex';
        
        // Protection: Dashboard requires completed profile
        if (path === '/dashboard') {
            if (!Auth.isAuthenticated()) {
                if (loader) loader.style.display = 'none';
                this.navigate('/login');
                return;
            }
            if (!Auth.hasProfile()) {
                if (loader) loader.style.display = 'none';
                this.navigate('/profile/edit');
                return;
            }
        }

        const route = this.routes[path];
        
        if (route) {
            try {
                // Ensure we fetch relative to the base URL
                // Add a cache-buster so browsers don't serve old HTML files
                const v = new Date().getTime(); 
                const targetUrl = CONFIG.BASE_PATH + '/' + route.template + '?v=' + v;
                
                const response = await fetch(targetUrl, { cache: 'no-cache' });
                if (!response.ok) throw new Error('Template not found');
                const html = await response.text();
                
                // Done loading
                if (loader) loader.style.display = 'none';
                appDiv.innerHTML = html;
                
                // Initialize specific route logic
                if (typeof route.init === 'function') {
                    // slight timeout to ensure DOM is updated
                    setTimeout(() => route.init(), 0);
                }
            } catch (err) {
                console.error(err);
                appDiv.innerHTML = `
                    <div class="test-page" style="text-align: center;">
                        <h2>Error loading page</h2>
                        <a href="/" data-link class="btn btn-primary">Go Home</a>
                    </div>
                `;
            }
        } else {
            appDiv.innerHTML = `
                <div class="test-page" style="text-align: center;">
                    <h2>Page Not Found</h2>
                    <a href="/" data-link class="btn btn-primary">Go Home</a>
                </div>
            `;
        }
    }
};
