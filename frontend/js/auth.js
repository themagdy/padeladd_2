const Auth = {
    _tokenCache: null,
    _hasProfileCache: null,
    _hasLevelCache: null,
    _authUserIdCache: null,
    _onboardingStepCache: null,
    _initialized: false,

    init: function() {
        if (this._initialized) return Promise.resolve();

        const isCapacitor = typeof window.Capacitor !== 'undefined' && window.Capacitor.Plugins && window.Capacitor.Plugins.SecureStoragePlugin;
        if (isCapacitor) {
            const SecureStorage = window.Capacitor.Plugins.SecureStoragePlugin;
            return Promise.all([
                SecureStorage.get({ key: 'auth_token' }).then(res => res.value).catch(() => null),
                SecureStorage.get({ key: 'has_profile' }).then(res => res.value).catch(() => null),
                SecureStorage.get({ key: 'has_level' }).then(res => res.value).catch(() => null),
                SecureStorage.get({ key: 'auth_user_id' }).then(res => res.value).catch(() => null),
                SecureStorage.get({ key: 'onboarding_step' }).then(res => res.value).catch(() => null)
            ]).then(([token, hasProfile, hasLevel, authUserId, onboardingStep]) => {
                this._tokenCache = token || null;
                this._hasProfileCache = hasProfile || null;
                this._hasLevelCache = hasLevel || null;
                this._authUserIdCache = authUserId || null;
                this._onboardingStepCache = onboardingStep || null;
                this._initialized = true;
            }).catch(err => {
                console.error('[Auth] SecureStorage init failed, falling back to localStorage:', err);
                this._loadFromLocalStorage();
            });
        } else {
            this._loadFromLocalStorage();
            return Promise.resolve();
        }
    },

    _loadFromLocalStorage: function() {
        this._tokenCache = localStorage.getItem('auth_token');
        this._hasProfileCache = localStorage.getItem('has_profile');
        this._hasLevelCache = localStorage.getItem('has_level');
        this._authUserIdCache = localStorage.getItem('auth_user_id');
        this._onboardingStepCache = localStorage.getItem('onboarding_step');
        this._initialized = true;
    },

    getToken: function() {
        if (!this._initialized) {
            return localStorage.getItem('auth_token');
        }
        return this._tokenCache;
    },
    setToken: function(token) {
        this._tokenCache = token;
        const isCapacitor = typeof window.Capacitor !== 'undefined' && window.Capacitor.Plugins && window.Capacitor.Plugins.SecureStoragePlugin;
        if (isCapacitor) {
            window.Capacitor.Plugins.SecureStoragePlugin.set({ key: 'auth_token', value: token }).catch(err => {
                console.error('[Auth] SecureStorage setToken failed:', err);
            });
        } else {
            localStorage.setItem('auth_token', token);
        }
        if (typeof PushNotificationsController !== 'undefined') {
            if (PushNotificationsController.init) PushNotificationsController.init();
            if (PushNotificationsController.updateServerToken) PushNotificationsController.updateServerToken();
        }
    },
    clearToken: function() {
        this._tokenCache = null;
        const isCapacitor = typeof window.Capacitor !== 'undefined' && window.Capacitor.Plugins && window.Capacitor.Plugins.SecureStoragePlugin;
        if (isCapacitor) {
            window.Capacitor.Plugins.SecureStoragePlugin.remove({ key: 'auth_token' }).catch(() => {});
        } else {
            localStorage.removeItem('auth_token');
        }
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
        if (!this._initialized) {
            return localStorage.getItem('has_profile') === 'true';
        }
        return this._hasProfileCache === 'true';
    },
    setHasProfile: function(val) {
        const valStr = val ? 'true' : 'false';
        this._hasProfileCache = valStr;
        const isCapacitor = typeof window.Capacitor !== 'undefined' && window.Capacitor.Plugins && window.Capacitor.Plugins.SecureStoragePlugin;
        if (isCapacitor) {
            window.Capacitor.Plugins.SecureStoragePlugin.set({ key: 'has_profile', value: valStr }).catch(() => {});
        } else {
            localStorage.setItem('has_profile', valStr);
        }
    },
    hasLevel: function() {
        if (!this._initialized) {
            return localStorage.getItem('has_level') === 'true';
        }
        return this._hasLevelCache === 'true';
    },
    setHasLevel: function(val) {
        const valStr = val ? 'true' : 'false';
        this._hasLevelCache = valStr;
        const isCapacitor = typeof window.Capacitor !== 'undefined' && window.Capacitor.Plugins && window.Capacitor.Plugins.SecureStoragePlugin;
        if (isCapacitor) {
            window.Capacitor.Plugins.SecureStoragePlugin.set({ key: 'has_level', value: valStr }).catch(() => {});
        } else {
            localStorage.setItem('has_level', valStr);
        }
    },
    getUserId: function() {
        if (!this._initialized) {
            return parseInt(localStorage.getItem('auth_user_id')) || 0;
        }
        return parseInt(this._authUserIdCache) || 0;
    },
    setUserId: function(id) {
        const idStr = String(id);
        this._authUserIdCache = idStr;
        const isCapacitor = typeof window.Capacitor !== 'undefined' && window.Capacitor.Plugins && window.Capacitor.Plugins.SecureStoragePlugin;
        if (isCapacitor) {
            window.Capacitor.Plugins.SecureStoragePlugin.set({ key: 'auth_user_id', value: idStr }).catch(() => {});
        } else {
            localStorage.setItem('auth_user_id', idStr);
        }
    },
    getOnboardingStep: function() {
        if (!this._initialized) {
            return localStorage.getItem('onboarding_step') || 'terms';
        }
        return this._onboardingStepCache || 'terms';
    },
    setOnboardingStep: function(val) {
        this._onboardingStepCache = val;
        const isCapacitor = typeof window.Capacitor !== 'undefined' && window.Capacitor.Plugins && window.Capacitor.Plugins.SecureStoragePlugin;
        if (isCapacitor) {
            window.Capacitor.Plugins.SecureStoragePlugin.set({ key: 'onboarding_step', value: val }).catch(() => {});
        } else {
            localStorage.setItem('onboarding_step', val);
        }
    },
    syncWithServer: function() {
        if (!this.isAuthenticated()) return Promise.resolve();
        
        if (typeof API !== 'undefined') {
            const p1 = API.post('/profile/get', {}).then(res => {
                if (res && res.success) {
                    const u = res.data.user;
                    const p = res.data.profile;
                    if (u && u.onboarding_step) {
                        this.setOnboardingStep(u.onboarding_step);
                    }
                    if (p) {
                        this.setHasProfile(true);
                        this.setHasLevel(!!p.level);
                        const totalPts = (parseInt(p.rank_points) || 0) + (parseInt(p.current_buffer) || 0);
                        if (totalPts > 0) {
                            this.setSessionBounds(this.getMinPlayerPts(), this.getMaxPlayerPts(), totalPts);
                        }
                    } else {
                        this.setHasProfile(false);
                        this.setHasLevel(false);
                    }
                }
            }).catch(err => {
                console.error('[Auth] Server sync failed:', err);
            });

            const p2 = API.post('/stats/get', {}).then(res => {
                if (res && res.success && res.data) {
                    if (res.data.min_player_pts !== undefined && res.data.max_player_pts !== undefined) {
                        this.setSessionBounds(res.data.min_player_pts, res.data.max_player_pts, res.data.eligibility_pts);
                    }
                }
            }).catch(() => {});

            return Promise.all([p1, p2]);
        }
        return Promise.resolve();
    },
    _minPlayerPtsCache: null,
    _maxPlayerPtsCache: null,
    _creatorPtsCache: null,

    getMinPlayerPts: function() {
        if (this._minPlayerPtsCache !== null) return this._minPlayerPtsCache;
        const stored = sessionStorage.getItem('min_player_pts');
        return stored !== null ? parseInt(stored) : 0;
    },
    getMaxPlayerPts: function() {
        if (this._maxPlayerPtsCache !== null) return this._maxPlayerPtsCache;
        const stored = sessionStorage.getItem('max_player_pts');
        return stored !== null ? parseInt(stored) : 1000;
    },
    getCreatorPts: function() {
        if (this._creatorPtsCache !== null) return this._creatorPtsCache;
        const stored = sessionStorage.getItem('creator_pts');
        if (stored !== null && !isNaN(parseInt(stored))) return parseInt(stored);
        if (typeof DashboardController !== 'undefined' && DashboardController._currentProfile && DashboardController._currentProfile.points) {
            return DashboardController._currentProfile.points;
        }
        return 0;
    },
    setSessionBounds: function(minPts, maxPts, creatorPts = null) {
        this._minPlayerPtsCache = parseInt(minPts) || 0;
        this._maxPlayerPtsCache = parseInt(maxPts) || 1000;
        sessionStorage.setItem('min_player_pts', String(this._minPlayerPtsCache));
        sessionStorage.setItem('max_player_pts', String(this._maxPlayerPtsCache));
        if (creatorPts !== null && creatorPts !== undefined) {
            const parsed = parseInt(creatorPts);
            if (!isNaN(parsed) && parsed > 0) {
                this._creatorPtsCache = parsed;
                sessionStorage.setItem('creator_pts', String(this._creatorPtsCache));
            }
        }
    },
    clearAll: function() {
        this._tokenCache = null;
        this._hasProfileCache = null;
        this._hasLevelCache = null;
        this._authUserIdCache = null;
        this._onboardingStepCache = null;
        this._minPlayerPtsCache = null;
        this._maxPlayerPtsCache = null;
        this._creatorPtsCache = null;
        try { sessionStorage.clear(); } catch(e) {}
        try { localStorage.clear(); } catch(e) {}
        const isCapacitor = typeof window.Capacitor !== 'undefined' && window.Capacitor.Plugins && window.Capacitor.Plugins.SecureStoragePlugin;
        if (isCapacitor) {
            const SecureStorage = window.Capacitor.Plugins.SecureStoragePlugin;
            return Promise.all([
                SecureStorage.remove({ key: 'auth_token' }).catch(() => {}),
                SecureStorage.remove({ key: 'has_profile' }).catch(() => {}),
                SecureStorage.remove({ key: 'has_level' }).catch(() => {}),
                SecureStorage.remove({ key: 'auth_user_id' }).catch(() => {}),
                SecureStorage.remove({ key: 'onboarding_step' }).catch(() => {}),
                SecureStorage.clear().catch(() => {})
            ]);
        }
        return Promise.resolve();
    },
    logout: async function() {
        if (typeof API !== 'undefined') {
            API.post('/logout', {}).catch(() => {});
        }
        await this.clearAll();
        if (typeof ModalStack !== 'undefined') {
            ModalStack.stack = [];
            const container = document.getElementById('modal-stack-container');
            if (container) container.innerHTML = '';
            document.body.classList.remove('modal-open-body');
        }
        if (typeof Router !== 'undefined') {
            Router.navDepth = 0;
            Router.navigate('/', true, true);
        } else {
            window.location.href = (typeof CONFIG !== 'undefined' ? CONFIG.BASE_PATH : '') + '/';
        }
    }
};

