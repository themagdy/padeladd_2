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
        '/profile/view': { template: 'frontend/pages/profile/view.html', init: (params) => ProfileViewController.init(params) },
        '/profile/view/:id': { template: 'frontend/pages/profile/view.html', init: (params) => ProfileViewController.init(params) },
        '/verify-email': { template: 'frontend/pages/auth/verify_success.html', init: () => AuthController.handleEmailLink() },
        '/dashboard': { template: 'frontend/pages/dashboard.html', init: () => DashboardController.init() },
        '/p/:profileId': { template: 'frontend/pages/profile/view.html', init: (params) => ProfileViewController.init({ id: params.profileId }) },
        // ── Phase 3: Match System ──────────────────────────────────────────────
        '/matches': { template: 'frontend/pages/matches/list.html', init: () => MatchesController.initList('play') },
        '/matches/my': { template: 'frontend/pages/matches/list.html', init: () => MatchesController.initList('mine') },
        '/matches/create': { template: 'frontend/pages/matches/create.html', init: () => MatchesController.initCreate() },
        '/matches/join': { template: 'frontend/pages/matches/list.html', init: () => MatchesController.initList('play') },
        '/matches/:matchCode': { template: 'frontend/pages/matches/view.html', init: (params) => MatchesController.initView(params) },
        '/matches/:matchCode/chat': { template: 'frontend/pages/matches/view.html', init: (params) => MatchesController.initView(params, true) },
        '/ranking': { template: 'frontend/pages/ranking.html', init: () => RankingController.init() },
        '/rules': { template: 'frontend/pages/rules.html', init: () => {} }
    },
    
    navDepth: 0,
    
    init: function() {
        // Initialize depth if not present (direct landing)
        if (!history.state || typeof history.state.depth === 'undefined') {
            history.replaceState({ depth: 0 }, null, window.location.href);
        } else {
            this.navDepth = history.state.depth;
        }

        window.addEventListener('popstate', (e) => {
            // 1. If we are popping back from the chat overlay, close it
            if (typeof ChatController !== 'undefined' && ChatController._isShowing) {
                ChatController.close(true);
                return;
            }
            if (e.state && e.state.ignoreRoute) return;

            const path = window.location.pathname.replace(CONFIG.BASE_PATH, '');
            const backBarRoutes = ['/register', '/verify', '/forgot-password', '/reset-password', '/profile/edit', '/matches/create', '/rules'];
            const isDynamicBackBar = path.startsWith('/matches/M-') || 
                                     path.startsWith('/p/') || 
                                     (path.startsWith('/profile/view/') && path !== '/profile/view');
            const hasBackBar = backBarRoutes.includes(path) || isDynamicBackBar;

            // 2. If no back bar (main tab) and we are moving back, we should eventually land on Dashboard
            if (!hasBackBar && path !== '/dashboard' && path !== '/login' && path !== '/' && path !== '/index.html') {
                // If we land on a main tab (Play, Ranking, etc) via back button, 
                // and it's not the dashboard, the user wants to go to dashboard.
                // However, we let the browser pop naturally first. 
                // If the new state has no depth or is 0, we force dashboard.
                if (!e.state || e.state.depth === 0) {
                    this.navigate('/dashboard', true, true);
                    return;
                }
            }

            if (e.state && typeof e.state.depth !== 'undefined') {
                this.navDepth = e.state.depth;
            }
            this.handleRoute();
        });


        document.body.addEventListener('click', e => {
            let target = e.target.closest('[data-link]');
            if (target) {
                e.preventDefault();
                let href = target.getAttribute('href');
                
                // Clear sub-tabs when navigating via main menu items
                if (target.classList.contains('nav-item')) {
                    sessionStorage.removeItem('last_sub_tab_play');
                    sessionStorage.removeItem('last_sub_tab_mine');
                }

                this.navigate(href);
            }
        });
        this.handleRoute(); // Process initial load
    },
    
    navigate: function(path, addToHistory = true, replace = false) {
        let finalPath = path;
        // Auto-prefix with BASE_PATH if needed
        if (finalPath.startsWith('/') && !finalPath.startsWith(CONFIG.BASE_PATH)) {
            finalPath = CONFIG.BASE_PATH + (finalPath === '/' ? '' : finalPath);
        }

        if (addToHistory) {
            if (replace) {
                history.replaceState({ depth: this.navDepth }, null, finalPath);
            } else {
                this.navDepth++;
                history.pushState({ depth: this.navDepth }, null, finalPath);
            }
        }
        this.handleRoute();
    },

    back: function() {
        const path = window.location.pathname.replace(CONFIG.BASE_PATH, '');
        const publicRoutes = ['/', '/login', '/register', '/forgot-password', '/reset-password', '/index.html', '/verify-email', '/verify'];
        const isAuthPage = publicRoutes.includes(path) || path === '';

        // 1. If we are on a page with a back bar/button, go back in history
        const backBarRoutes = ['/register', '/verify', '/forgot-password', '/reset-password', '/profile/edit', '/matches/create', '/rules'];
        const isDynamicBackBar = path.startsWith('/matches/M-') || 
                                 path.startsWith('/p/') || 
                                 (path.startsWith('/profile/view/') && path !== '/profile/view');
        const hasBackBar = backBarRoutes.includes(path) || isDynamicBackBar;

        if (hasBackBar && this.navDepth > 0) {
            window.history.back();
            return;
        }

        // 2. If no back bar (main tabs) OR depth is 0, determine fallback
        if (path === '/dashboard' || isAuthPage) {
            // If on dashboard or login, "close" the app
            if (window.confirm("Do you want to exit Padeladd?")) {
                if (navigator.app && navigator.app.exitApp) {
                    navigator.app.exitApp();
                } else {
                    window.close();
                }
            }
        } else {
            // If on Play/Ranking/etc without back bar, go to Dashboard
            this.navigate('/dashboard', true, true);
        }
    },
    
    handleRoute: async function() {
        // Scroll to top on every navigation
        window.scrollTo(0, 0);

        // Stop any active polling from the previous page
        if (typeof PollManager !== 'undefined') PollManager.stop();
        if (typeof ChatController !== 'undefined') ChatController.stop();


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

        // Normalize path for cache check
        let nPath = path;
        if (!nPath.startsWith('/')) nPath = '/' + nPath;

        // Skip global loader ONLY for main list tabs to prevent flickering (they handle their own skeletons/cache)
        // Detail pages (Matches/Profiles) will show the global loader for a better user experience
        const isMainTab = (nPath === '/dashboard' || nPath === '/matches' || nPath === '/matches/my' || nPath === '/ranking');

        const loader = document.getElementById('global-loader');
        if (loader && !isMainTab) loader.style.display = 'flex';
        
        // Global Protection: Redirect to login if not authenticated and trying to access private route
        const publicRoutes = ['/', '/login', '/register', '/forgot-password', '/reset-password', '/index.html', '/verify-email', '/verify'];
        const isPublic = publicRoutes.includes(path);

        if (!Auth.isAuthenticated() && !isPublic) {
            // Verify is a special case: you are "authenticated" but might not have a profile yet
            if (loader) loader.style.display = 'none';
            this.navigate('/login');
            return;
        }

        // If authenticated, don't allow hitting /login or /register
        if (Auth.isAuthenticated() && (path === '/login' || path === '/register' || path === '/')) {
             if (Auth.hasProfile() && Auth.hasLevel()) {
                 this.navigate('/dashboard');
                 return;
             }
        }

        const isPublicVanity = path.startsWith('/p/') || path.startsWith('/profile/view/');

        // Force profile completion if authenticated but no profile OR no level
        if (Auth.isAuthenticated() && (!Auth.hasProfile() || !Auth.hasLevel()) && path !== '/profile/edit' && path !== '/verify' && !isPublicVanity) {
             this.navigate('/profile/edit');
             return;
        }

        this.updateNavVisibility(path);

        // Find route with parameter support
        let matchedParams = null;
        let route = this.routes[path];
        
        if (!route) {
            // Try matching dynamic routes (e.g. /profile/view/:id)
            for (const [rPath, rTarget] of Object.entries(this.routes)) {
                if (rPath.includes(':')) {
                    const regexPath = new RegExp('^' + rPath.replace(/:\w+/g, '([^/]+)') + '$');
                    const match = path.match(regexPath);
                    if (match) {
                        route = rTarget;
                        // Extract params (for now just simple mapping)
                        const keys = rPath.match(/:\w+/g);
                        matchedParams = {};
                        keys.forEach((key, i) => {
                            matchedParams[key.substring(1)] = match[i + 1];
                        });
                        break;
                    }
                }
            }
        }
        
        if (route) {
            try {
                // Ensure we fetch relative to the base URL
                const v = new Date().getTime(); 
                const targetUrl = CONFIG.BASE_PATH + '/' + route.template + '?v=' + v;
                
                const response = await fetch(targetUrl, { cache: 'no-cache' });
                if (!response.ok) throw new Error('Template not found');
                const html = await response.text();
                
                appDiv.innerHTML = html;
                
                // Initialize specific route logic
                if (typeof route.init === 'function') {
                    await route.init(matchedParams);
                }

                // Done loading everything
                if (loader) loader.style.display = 'none';
            } catch (err) {
                console.error(err);
                if (loader) loader.style.display = 'none';
                appDiv.innerHTML = `
                    <div class="test-page" style="text-align: center; padding: 50px 20px;">
                        <h2 style="color: #fff; margin-bottom: 20px;">Oops! Error loading page</h2>
                        <p style="color: var(--c-text-muted); margin-bottom: 30px;">${err.message}</p>
                        <a href="dashboard" data-link class="btn btn-primary" style="width: auto; padding: 12px 30px;">Return to Dashboard</a>
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
    },

    updateNavVisibility: function(path) {
        const nav = document.getElementById('main-nav');
        const bnav = document.getElementById('bottom-nav');
        const tbar = document.getElementById('top-bar-nav');
        const tactions = document.getElementById('top-bar-actions');
        if (!nav) return;

        // Ensure path starts with / and has no trailing slash (uniform matching)
        let nPath = path;
        if (!nPath.startsWith('/')) nPath = '/' + nPath;
        if (nPath !== '/' && nPath.endsWith('/')) nPath = nPath.slice(0, -1);

        const authRoutes = ['/login', '/register', '/verify', '/forgot-password', '/reset-password', '/profile/edit', '/matches/create', '/index.html'];
        const isAuthPage = authRoutes.includes(nPath) || nPath === '/';

        // Pages that need the unified back bar
        const backBarRoutes = ['/register', '/verify', '/forgot-password', '/reset-password', '/profile/edit', '/matches/create', '/rules'];
        const isDynamicBackBar = nPath.startsWith('/matches/M-') || 
                                 nPath.startsWith('/p/') || 
                                 (nPath.startsWith('/profile/view/') && nPath !== '/profile/view');
                                 
        const needsBackBar = backBarRoutes.includes(nPath) || isDynamicBackBar;

        if (needsBackBar) {
            tbar.style.display = 'flex';
            document.body.classList.add('has-fixed-bar');
            
            const tbarInner = document.getElementById('top-bar-inner');
            if (tbarInner) {
                if (nPath.startsWith('/p/') || (nPath.startsWith('/profile/view/') && nPath !== '/profile/view')) {
                    tbarInner.style.maxWidth = '1200px';
                } else if (path.startsWith('/matches/M-') || path.startsWith('/matches/view/')) {
                    tbarInner.style.maxWidth = '900px';
                } else if (nPath === '/rules') {
                    tbarInner.style.maxWidth = '800px';
                } else {
                    tbarInner.style.maxWidth = '480px';
                }
            }
            
            // Special case for logout on profile edit (only if new user)
            if (nPath === '/profile/edit' && tactions) {
                if (!Auth.hasProfile()) {
                    tactions.innerHTML = `<button onclick="API.post('/logout').then(() => { Auth.clearAll(); Router.navigate('/login'); })" style="background: transparent; border: none; color: var(--c-text-muted); font-size: 14px; font-weight: 700; cursor: pointer; text-transform:uppercase; letter-spacing:1px;">Sign Out</button>`;
                } else {
                    tactions.innerHTML = '';
                }
            } else {
                if (tactions) tactions.innerHTML = '';
            }
        } else {
            tbar.style.display = 'none';
            document.body.classList.remove('has-fixed-bar');
        }

        const hideNavBar = isAuthPage || needsBackBar;

        if (Auth.isAuthenticated() && Auth.hasProfile() && !hideNavBar) {
            nav.style.display = 'flex';
            if (bnav) bnav.style.display = 'flex';
            document.body.classList.add('has-nav');
            
            // Set active item for both navs
            const allNavs = [nav, bnav].filter(el => el !== null);
            allNavs.forEach(navEl => {
                navEl.querySelectorAll('.nav-item').forEach(item => {
                    item.classList.remove('active');
                    const href = item.getAttribute('href') || '';
                    
                    // Precise matching
                    const isDashboard = (path === '/dashboard' && href === 'dashboard');
                    const isRanking = (path.startsWith('/ranking') && href === 'ranking');
                    const isPlay = ((path === '/matches' || path === '/matches/join') && href === 'matches');
                    const isMyMatches = (path === '/matches/my' && href === 'matches/my');
                    const isProfile = ((path.startsWith('/profile') || path.startsWith('/p/')) && href === 'profile/view');

                    if (isDashboard || isRanking || isPlay || isMyMatches || isProfile) {
                        item.classList.add('active');
                    }
                });
            });

        } else {
            nav.style.display = 'none';
            if (bnav) bnav.style.display = 'none';
            document.body.classList.remove('has-nav');
        }
    }
};
