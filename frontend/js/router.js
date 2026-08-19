const ModalStack = {
    stack: [],
    _layerCounter: 0,

    hasModals: function () {
        return this.stack.length > 0;
    },

    getTopModal: function () {
        return this.stack.length > 0 ? this.stack[this.stack.length - 1] : null;
    },

    push: async function (path, route, params, html) {
        if (this.stack.length >= 5) return false;
        const container = document.getElementById('modal-stack-container');
        if (!container) return;

        document.body.classList.add('modal-open-body');
        const currentTop = this.getTopModal();
        if (currentTop && currentTop.containerEl) {
            currentTop.containerEl.classList.add('is-parent');
        }

        this._layerCounter++;
        const layerId = `modal-layer-${this._layerCounter}`;
        const zIndex = 8000 + this.stack.length * 10;

        let maxW = '480px';
        if (path === '/profile/edit') maxW = '500px';
        else if (path === '/terms') maxW = '520px';
        else if (path.startsWith('/p/') || (path.startsWith('/profile/view/') && path !== '/profile/view')) maxW = '1200px';
        else if (path.startsWith('/matches/M-') || path.startsWith('/matches/view/')) maxW = '900px';
        else if (path === '/rules' || path.startsWith('/announcement/')) maxW = '800px';

        const isChat = path.includes('/chat');
        const layerEl = document.createElement('div');
        layerEl.className = 'modal-layer slide-enter';
        layerEl.id = layerId;
        layerEl.style.zIndex = zIndex;

        if (isChat) {
            layerEl.style.paddingBottom = '0px';
            layerEl.style.overflow = 'hidden';
            layerEl.style.display = 'flex';
            layerEl.style.flexDirection = 'column';
        }

        layerEl.innerHTML = safeHTML(`
            <header class="top-bar-nav fixed-top-bar" style="display:flex; flex-shrink:0;">
                <div class="top-bar-inner" style="width:100%; max-width:${maxW}; margin:0 auto; display:flex; align-items:center; justify-content:space-between; padding:0 16px; height:100%;">
                    <button class="top-bar-back" onclick="Router.back()" style="display:inline-flex; align-items:center; justify-content:center; width:44px; height:44px; background:transparent; border:none; color:var(--c-text); text-decoration:none; margin-left:-12px; cursor:pointer;">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                    </button>
                    <div class="top-bar-title" style="font-size:15px; font-weight:700; color:var(--c-text); text-transform:uppercase; letter-spacing:1px;"></div>
                    <div class="top-bar-actions" style="display:flex; align-items:center;"></div>
                </div>
            </header>
            <div class="modal-body-content" style="width:100%; ${isChat ? 'flex:1; display:flex; flex-direction:column; min-height:0; overflow:hidden;' : ''}">
                ${html}
            </div>
        `);

        container.appendChild(layerEl);

        const backBtn = layerEl.querySelector('.top-bar-back');
        if (backBtn) {
            backBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                Router.back();
            };
        }

        const layerState = {
            id: layerId,
            path: path,
            params: params,
            containerEl: layerEl,
            route: route,
            data: {}
        };

        this.stack.push(layerState);

        requestAnimationFrame(() => {
            layerEl.classList.add('slide-active');
        });

        if (typeof route.init === 'function') {
            await route.init(params, layerEl, layerState);
        }

        return layerState;
    },

    pop: function () {
        if (!this.hasModals()) return false;

        const topModal = this.stack.pop();
        if (topModal && topModal.containerEl) {
            topModal.containerEl.classList.remove('slide-active');
            topModal.containerEl.classList.add('slide-exit');
            setTimeout(() => {
                topModal.containerEl.remove();
            }, 360);
        }

        const newTop = this.getTopModal();
        if (newTop && newTop.containerEl) {
            newTop.containerEl.classList.remove('is-parent');
            const targetPath = newTop.path;
            window.history.replaceState(null, '', CONFIG.BASE_PATH + (targetPath.startsWith('/') ? targetPath : '/' + targetPath));
        } else {
            document.body.classList.remove('modal-open-body');
            const basePath = Router.currentBasePath || '/dashboard';
            window.history.replaceState(null, '', CONFIG.BASE_PATH + (basePath.startsWith('/') ? basePath : '/' + basePath));
        }

        if (typeof Router !== 'undefined' && typeof Router.updateNavVisibility === 'function') {
            Router.updateNavVisibility(Router.currentBasePath || window.location.pathname);
        }

        return true;
    },

    flushTop: function () {
        if (!this.hasModals()) return false;
        const topModal = this.stack.pop();
        if (topModal && topModal.containerEl) {
            topModal.containerEl.remove();
        }
        return true;
    },

    popAll: function () {
        while (this.hasModals()) {
            const topModal = this.stack.pop();
            if (topModal && topModal.containerEl) {
                topModal.containerEl.remove();
            }
        }
        document.body.classList.remove('modal-open-body');
        const container = document.getElementById('modal-stack-container');
        if (container) container.innerHTML = '';
    }
};

setInterval(() => {
    if (typeof ModalStack !== 'undefined') {
        console.log(`[Modals Open] ${ModalStack.stack.length}`);
    }
}, 3000);

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
        '/announcement/:id': { template: 'frontend/pages/announcement.html', init: (params) => AnnouncementController.init(params) },
        '/p/:id': { template: 'frontend/pages/profile/view.html', init: (params) => ProfileViewController.init(params) },
        // ── Phase 3: Match System ──────────────────────────────────────────────
        '/matches': { template: 'frontend/pages/matches/list.html', init: () => MatchesController.initList('play') },
        '/matches/my': { template: 'frontend/pages/matches/list.html', init: () => MatchesController.initList('mine') },
        '/matches/create': { template: 'frontend/pages/matches/create.html', init: () => MatchesController.initCreate() },
        '/matches/join': { template: 'frontend/pages/matches/list.html', init: () => MatchesController.initList('play') },
        '/matches/view/:id': { template: 'frontend/pages/matches/view.html', init: (params) => MatchesController.initView({ id: params.id }) },
        '/matches/:matchCode': { template: 'frontend/pages/matches/view.html', init: (params) => MatchesController.initView(params) },
        '/matches/:matchCode/chat': { template: 'frontend/pages/matches/chat.html', init: (params, container, state) => ChatController.init(params, container, state) },
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
        '/terms': { template: 'frontend/pages/terms.html', init: () => AuthController.initTerms() },
        '/privacy': { template: 'frontend/pages/privacy.html', init: () => { } }
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
            // Rule 1: If any modal overlay is open, pop the top modal layer
            if (typeof ModalStack !== 'undefined' && ModalStack.hasModals()) {
                ModalStack.pop();
                return;
            }

            // 1. If we are popping back from the chat overlay, close it
            if (typeof ChatController !== 'undefined' && ChatController._isShowing) {
                ChatController.close(true);
                return;
            }
            if (e.state && e.state.ignoreRoute) return;

            const path = window.location.pathname.replace(CONFIG.BASE_PATH, '');

            // Rule 2: If on a main tab/page (Ranking, Play, Mine, Profile), navigate to Dashboard
            const mainTabs = ['/ranking', '/matches', '/matches/my', '/profile', '/profile/view'];
            if (mainTabs.some(p => path === p || path.startsWith(p))) {
                this.navigate('/dashboard', true, true);
                return;
            }

            if (e.state && typeof e.state.depth !== 'undefined') {
                this.navDepth = e.state.depth;
            }
            sessionStorage.setItem('is_back_navigation', 'true');
            this.handleRoute();
        });


        document.body.addEventListener('click', e => {
            let target = e.target.closest('[data-link]');
            if (target) {
                e.preventDefault();
                let href = target.getAttribute('href');

                // Clear sub-tabs and search query when navigating via main menu items
                if (target.classList.contains('nav-item')) {
                    sessionStorage.removeItem('last_sub_tab_play');
                    sessionStorage.removeItem('last_sub_tab_mine');
                    if (typeof MatchesController !== 'undefined') {
                        MatchesController._searchQuery = '';
                    }
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

        const cleanPath = path.startsWith(CONFIG.BASE_PATH) ? path.slice(CONFIG.BASE_PATH.length) : path;
        if (cleanPath === '/dashboard' || cleanPath === '/') {
            if (typeof ModalStack !== 'undefined') ModalStack.popAll();
            this.navDepth = 0;
            replace = true;
        }

        let currentPath = window.location.pathname.replace(CONFIG.BASE_PATH, '');
        if (currentPath.startsWith('/profile/view') || currentPath.startsWith('/p/')) {
            sessionStorage.setItem('profile_scroll_pos', window.scrollY);
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
        if (typeof ChatController !== 'undefined' && ChatController._isShowing) {
            ChatController.stop();
            ChatController._isShowing = false;
        }

        if (ModalStack.hasModals()) {
            ModalStack.pop();
            return;
        }

        if (this.currentBasePath === '/matches/my') {
            this.navigate('/matches/my');
            return;
        }
        if (this.currentBasePath === '/matches') {
            this.navigate('/matches');
            return;
        }

        const mainTabs = ['/ranking', '/matches/my', '/matches', '/profile', '/profile/view'];
        const curPath = this.currentPath || window.location.pathname.replace(CONFIG.BASE_PATH, '');
        if (mainTabs.some(p => curPath === p || (p !== '/matches' && curPath.startsWith(p)))) {
            this.navigate('/dashboard');
            return;
        }

        if (this.navDepth > 0) {
            window.history.back();
            return;
        }

        this.navigate('/dashboard', true, true);
    },

    handleRoute: async function () {
        // Stop any active polling from the previous page
        if (typeof PollManager !== 'undefined') PollManager.stop();
        if (typeof ChatController !== 'undefined') ChatController.stop();
        if (typeof DashboardController !== 'undefined') DashboardController.stop();


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
        this.currentPath = path;

        const appDiv = document.getElementById('app-content');
        if (!appDiv) return;

        // Normalize path for cache check
        let nPath = path;
        if (!nPath.startsWith('/')) nPath = '/' + nPath;

        // Skip global loader ONLY for main list tabs to prevent flickering (they handle their own skeletons/cache)
        // Detail pages (Matches/Profiles) will show the global loader for a better user experience
        const mainTabs = ['/dashboard', '/matches', '/matches/my', '/ranking', '/', '/login', '/register', '/index.html'];
        const isMainTab = mainTabs.includes(nPath);

        const loader = document.getElementById('global-loader');
        if (loader && !isMainTab) loader.style.display = 'flex';

        // Global Protection: Redirect to login if not authenticated and trying to access private route
        const publicRoutes = ['/', '/login', '/register', '/forgot-password', '/reset-password', '/index.html', '/verify-email', '/verify', '/terms', '/privacy'];
        const isPublic = publicRoutes.includes(path);

        if (!Auth.isAuthenticated() && !isPublic) {
            // Verify is a special case: you are "authenticated" but might not have a profile yet
            if (loader) loader.style.display = 'none';
            this.navigate('/login');
            return;
        }

        // If authenticated, don't allow hitting /login or /register
        if (Auth.isAuthenticated() && (path === '/login' || path === '/register' || path === '/' || path === '/index.html')) {
            if (Auth.hasProfile() && Auth.hasLevel()) {
                this.navigate('/dashboard');
                return;
            }
        }

        const isPublicVanity = path.startsWith('/p/') || path.startsWith('/profile/view/');

        // Force profile completion sequence: Terms -> Profile Edit
        if (Auth.isAuthenticated() && Auth.getOnboardingStep() !== 'completed' && path !== '/verify' && !isPublicVanity) {
            const step = Auth.getOnboardingStep();

            if (step === 'terms' && path !== '/terms') {
                this.navigate('/terms');
                return;
            }

            if (step === 'profile' && path !== '/profile/edit') {
                this.navigate('/profile/edit');
                return;
            }
        }

        const mainBaseRoutes = ['/dashboard', '/ranking', '/matches', '/matches/my', '/profile/view', '/profile'];
        if (mainBaseRoutes.includes(nPath)) this.currentBasePath = nPath;

        this.updateNavVisibility(nPath);

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

                if (!isMainTab) {
                    if (!appDiv.querySelector('.page') || appDiv.querySelector('#mv-skeleton')) {
                        const dashRoute = this.routes['/dashboard'];
                        if (dashRoute) {
                            const dashHtml = this._templateCache[dashRoute.template] || await (await fetch(CONFIG.BASE_PATH + '/' + dashRoute.template)).text();
                            appDiv.innerHTML = safeHTML(dashHtml);
                            if (typeof dashRoute.init === 'function') await dashRoute.init();
                        }
                    }

                    await ModalStack.push(path, route, matchedParams, html);
                    if (loader) loader.style.display = 'none';
                    return;
                }

                this.currentBasePath = path;
                appDiv.innerHTML = safeHTML(html);
                if (typeof CONFIG !== 'undefined' && CONFIG.APP_BUILD_REF) {
                    appDiv.querySelectorAll('.app-version-placeholder').forEach(el => {
                        el.textContent = CONFIG.APP_BUILD_REF;
                    });
                }
                // Skip scrolling to top if we have a saved ranking scroll position to restore
                if (!sessionStorage.getItem('ranking_scroll_pos') || path !== '/ranking') {
                    window.scrollTo(0, 0);
                }

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
        const backBarRoutes = ['/register', '/verify', '/forgot-password', '/reset-password', '/profile/edit', '/matches/create', '/rules', '/terms', '/privacy'];
        const isDynamicBackBar = nPath.startsWith('/matches/M-') ||
            nPath.startsWith('/p/') ||
            nPath.startsWith('/announcement/') ||
            (nPath.startsWith('/profile/view/') && nPath !== '/profile/view');

        const needsBackBar = backBarRoutes.includes(nPath) || isDynamicBackBar;

        if (tbar) tbar.style.display = 'none';
        document.body.classList.remove('has-fixed-bar');

        const hideNavBar = isAuthPage;

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
