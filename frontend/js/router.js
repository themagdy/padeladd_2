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
        '/p/:id': { template: 'frontend/pages/profile/view.html', init: (params) => ProfileViewController.init(params) },
        // ── Phase 3: Match System ──────────────────────────────────────────────
        '/matches': { template: 'frontend/pages/matches/list.html', init: () => MatchesController.initList('play') },
        '/matches/my': { template: 'frontend/pages/matches/list.html', init: () => MatchesController.initList('mine') },
        '/matches/create': { template: 'frontend/pages/matches/create.html', init: () => MatchesController.initCreate() },
        '/matches/join': { template: 'frontend/pages/matches/list.html', init: () => MatchesController.initList('play') },
        '/matches/view/:id': { template: 'frontend/pages/matches/view.html', init: (params) => MatchesController.initView({ id: params.id }) },
        '/matches/:matchCode': { template: 'frontend/pages/matches/view.html', init: (params) => MatchesController.initView(params) },
        '/matches/:matchCode/chat': { template: 'frontend/pages/matches/view.html', init: (params) => MatchesController.initView(params, true) },
        '/ranking': { template: 'frontend/pages/ranking.html', init: () => RankingController.init() },
        '/rules': {
            template: 'frontend/pages/rules.html',
            init: () => {
                let matchesPlayed = 0;
                let bufferPoints = 100;
                let rankingPoints = 0;

                window.toggleCalibrationSim = function (mode) {
                    if (matchesPlayed >= 20) return;

                    const container = document.querySelector('.calibration-simulator');
                    if (!container) return;

                    const valBuffer = document.getElementById('sim-val-buffer');
                    const valRank = document.getElementById('sim-val-rank');
                    const progressBuffer = document.getElementById('sim-progress-buffer');
                    const progressRank = document.getElementById('sim-progress-rank');
                    const statusLabel = document.getElementById('sim-status-label');
                    const arrow = document.getElementById('sim-transfer-arrow');
                    const matchCounter = document.getElementById('sim-match-counter');
                    const cards = container.querySelectorAll('.sim-card');
                    const cardBuffer = cards[0];
                    const cardRank = cards[1];

                    // Cache state to represent transitions correctly
                    matchesPlayed++;
                    bufferPoints -= 5;
                    if (bufferPoints < 0) bufferPoints = 0;

                    if (mode === 'win') {
                        rankingPoints += 5;
                    }

                    const nextBuffer = bufferPoints;
                    const nextRank = rankingPoints;

                    // Remove existing classes to restart arrow/connector states
                    container.classList.remove('state-win', 'state-loss', 'state-idle');
                    void container.offsetWidth; // force layout reflow

                    // Spawn physical flying badge
                    const badge = document.createElement('div');
                    badge.className = `flying-badge ${mode === 'win' ? 'win-flight' : 'loss-flight'}`;
                    badge.textContent = '5%';
                    container.appendChild(badge);

                    // Immediate animations on trigger
                    if (cardBuffer) {
                        cardBuffer.classList.add(mode === 'win' ? 'pulse-green' : 'pulse-pink');
                        setTimeout(() => cardBuffer.classList.remove('pulse-green', 'pulse-pink'), 400);
                    }

                    // Immediate visual decrement for the Buffer Points (Orb leaves the starting card)
                    if (valBuffer) valBuffer.textContent = nextBuffer;
                    if (progressBuffer) progressBuffer.style.width = `${nextBuffer}%`;
                    if (matchCounter) matchCounter.textContent = `Match: ${matchesPlayed} / 20`;

                    if (mode === 'win') {
                        container.classList.add('state-win');
                        if (arrow) {
                            arrow.style.color = 'var(--c-green)';
                            arrow.style.transform = 'scale(1.2)';
                        }
                        if (statusLabel) {
                            statusLabel.textContent = '⚡ ➔ 🏆';
                            statusLabel.style.color = 'var(--c-green)';
                            statusLabel.style.background = 'rgba(0, 206, 0, 0.08)';
                        }

                        // Delay updates to match landing of the flying badge (1500ms)
                        setTimeout(() => {
                            if (valRank) valRank.textContent = nextRank;
                            if (progressRank) progressRank.style.width = `${Math.min(nextRank, 100)}%`;

                            if (statusLabel) statusLabel.textContent = '🏆 +5';
                            if (cardRank) {
                                cardRank.classList.add('pulse-green');
                                setTimeout(() => cardRank.classList.remove('pulse-green'), 300);
                            }
                            badge.remove();

                            // Trigger completion check when points land
                            if (matchesPlayed >= 20) {
                                triggerCompletion();
                            }
                        }, 1500);

                    } else {
                        container.classList.add('state-loss');
                        if (arrow) {
                            arrow.style.color = 'var(--c-pink)';
                            arrow.style.transform = 'scale(1.2)';
                        }
                        if (statusLabel) {
                            statusLabel.textContent = '⚡ ➔ 💨';
                            statusLabel.style.color = 'var(--c-pink)';
                            statusLabel.style.background = 'rgba(216, 27, 96, 0.08)';
                        }

                        // Delay removal of loss badge to match flush sequence (1500ms)
                        setTimeout(() => {
                            if (statusLabel) statusLabel.textContent = '💨';
                            badge.remove();

                            // Trigger completion check when points flush
                            if (matchesPlayed >= 20) {
                                triggerCompletion();
                            }
                        }, 1500);
                    }

                    // Reset arrow scale after click feedback
                    setTimeout(() => {
                        if (arrow) arrow.style.transform = 'scale(1)';
                    }, 300);

                    function triggerCompletion() {
                        const controls = document.getElementById('sim-controls');
                        const banner = document.getElementById('sim-completion-banner');

                        if (controls) controls.style.display = 'none';
                        if (banner) banner.style.display = 'block';
                        if (statusLabel) {
                            statusLabel.textContent = '🎯';
                            statusLabel.style.color = 'var(--c-green)';
                            statusLabel.style.background = 'rgba(0, 206, 0, 0.15)';
                        }
                    }
                };

                // Programmatic button binding to bypass DOMPurify onclick sanitization
                const btnWin = document.getElementById('sim-btn-win');
                const btnLoss = document.getElementById('sim-btn-loss');
                const btnReset = document.getElementById('sim-btn-reset');

                if (btnWin) {
                    btnWin.addEventListener('click', () => {
                        window.toggleCalibrationSim('win');
                    });
                }
                if (btnLoss) {
                    btnLoss.addEventListener('click', () => {
                        window.toggleCalibrationSim('loss');
                    });
                }
                if (btnReset) {
                    btnReset.addEventListener('click', () => {
                        // Reset simulator states
                        matchesPlayed = 0;
                        bufferPoints = 100;
                        rankingPoints = 0;

                        const container = document.querySelector('.calibration-simulator');
                        if (container) {
                            container.classList.remove('state-win', 'state-loss');
                            container.classList.add('state-idle');
                        }

                        const valBuffer = document.getElementById('sim-val-buffer');
                        const valRank = document.getElementById('sim-val-rank');
                        const progressBuffer = document.getElementById('sim-progress-buffer');
                        const progressRank = document.getElementById('sim-progress-rank');
                        const statusLabel = document.getElementById('sim-status-label');
                        const arrow = document.getElementById('sim-transfer-arrow');
                        const matchCounter = document.getElementById('sim-match-counter');
                        const controls = document.getElementById('sim-controls');
                        const banner = document.getElementById('sim-completion-banner');

                        if (valBuffer) valBuffer.textContent = '100';
                        if (valRank) valRank.textContent = '0';
                        if (matchCounter) matchCounter.textContent = 'Match: 0 / 20';
                        if (progressBuffer) progressBuffer.style.width = '100%';
                        if (progressRank) progressRank.style.width = '0%';
                        if (controls) controls.style.display = 'flex';
                        if (banner) banner.style.display = 'none';
                        if (arrow) {
                            arrow.style.color = 'var(--c-border)';
                            arrow.style.transform = 'scale(1)';
                        }
                        if (statusLabel) {
                            statusLabel.textContent = '👇';
                            statusLabel.style.color = 'var(--c-text-muted)';
                            statusLabel.style.background = 'transparent';
                        }
                    });
                }
            }
        },
        '/terms': { template: 'frontend/pages/terms.html', init: () => AuthController.initTerms() }
    },

    navDepth: 0,
    _templateCache: {},

    init: function () {
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
            const backBarRoutes = ['/register', '/verify', '/forgot-password', '/reset-password', '/profile/edit', '/matches/create', '/rules', '/terms'];
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

    navigate: function (path, addToHistory = true, replace = false) {
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

    back: function () {
        const path = window.location.pathname.replace(CONFIG.BASE_PATH, '');
        const publicRoutes = ['/', '/login', '/register', '/forgot-password', '/reset-password', '/index.html', '/verify-email', '/verify', '/terms'];
        const isAuthPage = publicRoutes.includes(path) || path === '';

        // 1. If we are on a page with a back bar/button, go back in history
        const backBarRoutes = ['/register', '/verify', '/forgot-password', '/reset-password', '/profile/edit', '/matches/create', '/rules', '/terms'];
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
            if (navigator.app && navigator.app.exitApp) {
                navigator.app.exitApp();
            } else if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
                window.Capacitor.Plugins.App.exitApp();
            } else {
                window.close();
            }
        } else {
            // If on Play/Ranking/etc without back bar, go to Dashboard
            this.navigate('/dashboard', true, true);
        }
    },

    handleRoute: async function () {
        // Stop any active polling from the previous page
        if (typeof PollManager !== 'undefined') PollManager.stop();
        if (typeof ChatController !== 'undefined') ChatController.stop();


        // Normalize path by stripping CONFIG.BASE_PATH
        let path = window.location.pathname;
        if (path.startsWith(CONFIG.BASE_PATH)) {
            path = path.slice(CONFIG.BASE_PATH.length);
        }

        // Ensure path starts with / and has no trailing slash
        if (!path.startsWith('/')) path = '/' + path;
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
        const publicRoutes = ['/', '/login', '/register', '/forgot-password', '/reset-password', '/index.html', '/verify-email', '/verify', '/terms'];
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

        // Force profile completion sequence: Terms -> Profile Edit
        if (Auth.isAuthenticated() && (!Auth.hasProfile() || !Auth.hasLevel()) && path !== '/verify' && !isPublicVanity) {
            const hasAgreed = sessionStorage.getItem('padeladd_agreed_terms') === 'true';

            if (!hasAgreed && path !== '/terms') {
                this.navigate('/terms');
                return;
            }

            if (hasAgreed && path !== '/profile/edit' && path !== '/terms') {
                this.navigate('/profile/edit');
                return;
            }
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

        this.params = matchedParams || {};

        if (route) {
            try {
                let html;
                if (this._templateCache[route.template]) {
                    html = this._templateCache[route.template];
                } else {
                    // Ensure we fetch relative to the base URL
                    const v = new Date().getTime();
                    const targetUrl = CONFIG.BASE_PATH + '/' + route.template + '?v=' + v;

                    const response = await fetch(targetUrl, { cache: 'no-cache' });
                    if (!response.ok) throw new Error('Template not found');
                    html = await response.text();

                    this._templateCache[route.template] = html;
                }

                appDiv.innerHTML = safeHTML(html);
                window.scrollTo(0, 0);

                // Initialize specific route logic
                if (typeof route.init === 'function') {
                    await route.init(matchedParams);
                }

                // Done loading everything
                if (loader) loader.style.display = 'none';
            } catch (err) {
                console.error(err);
                if (loader) loader.style.display = 'none';
                appDiv.innerHTML = safeHTML(`
                    <div class="test-page" style="text-align: center; padding: 50px 20px;">
                        <h2 style="color: #fff; margin-bottom: 20px;">Oops! Error loading page</h2>
                        <p style="color: var(--c-text-muted); margin-bottom: 30px;">${err.message}</p>
                        <a href="dashboard" data-link class="btn btn-primary" style="width: auto; padding: 12px 30px;">Return to Dashboard</a>
                    </div>
                `);
                window.scrollTo(0, 0);
            }
        } else {
            if (loader) loader.style.display = 'none';
            appDiv.innerHTML = safeHTML(`
                <div class="test-page" style="text-align: center; padding: 50px 20px;">
                    <h2 style="color: #fff;">Page Not Found</h2>
                    <p style="color: var(--c-text-muted); margin-bottom: 30px;">The requested path "${path}" was not found.</p>
                    <a href="dashboard" data-link class="btn btn-primary" style="width: auto; padding: 12px 30px;">Return to Dashboard</a>
                </div>
            `);
            window.scrollTo(0, 0);
        }
    },

    updateNavVisibility: function (path) {
        const nav = document.getElementById('main-nav');
        const bnav = document.getElementById('bottom-nav');
        const tbar = document.getElementById('top-bar-nav');
        const tactions = document.getElementById('top-bar-actions');
        if (!nav) return;

        // Ensure path starts with / and has no trailing slash (uniform matching)
        let nPath = path;
        if (!nPath.startsWith('/')) nPath = '/' + nPath;
        if (nPath !== '/' && nPath.endsWith('/')) nPath = nPath.slice(0, -1);

        const authRoutes = ['/login', '/register', '/verify', '/forgot-password', '/reset-password'];
        const isAuthPage = authRoutes.includes(nPath) || nPath === '/' || nPath === '/index.html';

        // Pages that need the unified back bar
        const backBarRoutes = ['/register', '/verify', '/forgot-password', '/reset-password', '/profile/edit', '/matches/create', '/rules', '/terms'];
        const isDynamicBackBar = nPath.startsWith('/matches/M-') ||
            nPath.startsWith('/p/') ||
            (nPath.startsWith('/profile/view/') && nPath !== '/profile/view');

        const needsBackBar = backBarRoutes.includes(nPath) || isDynamicBackBar;

        if (needsBackBar) {
            tbar.style.display = 'flex';
            document.body.classList.add('has-fixed-bar');

            const tbarInner = document.getElementById('top-bar-inner');
            if (tbarInner) {
                if (nPath === '/profile/edit') {
                    tbarInner.style.maxWidth = '500px';
                    tbarInner.style.padding = '0 20px';
                } else if (nPath === '/terms') {
                    tbarInner.style.maxWidth = '520px';
                    tbarInner.style.padding = '0 20px';
                } else if (nPath.startsWith('/p/') || (nPath.startsWith('/profile/view/') && nPath !== '/profile/view')) {
                    tbarInner.style.maxWidth = '1200px';
                    tbarInner.style.padding = '0 16px';
                } else if (path.startsWith('/matches/M-') || path.startsWith('/matches/view/')) {
                    tbarInner.style.maxWidth = '900px';
                    tbarInner.style.padding = '0 16px';
                } else if (nPath === '/rules') {
                    tbarInner.style.maxWidth = '800px';
                    tbarInner.style.padding = '0 16px';
                } else {
                    tbarInner.style.maxWidth = '480px';
                    tbarInner.style.padding = '0 16px';
                }
            }

            // Special case for logout on profile edit (only if new user)
            if (nPath === '/profile/edit' && tactions) {
                if (!Auth.hasProfile()) {
                    tactions.innerHTML = safeHTML(`<button onclick="API.post('/logout').then(() => { Auth.clearAll(); Router.navigate('/login'); })" style="background: transparent; border: none; color: var(--c-text-muted); font-size: 14px; font-weight: 700; cursor: pointer; text-transform:uppercase; letter-spacing:1px;">Sign Out</button>`);
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
