// Utility helpers for dates and relative time
const isToday = (d) => {
    if (!d) return false;
    const date = new Date(d.replace(' ', 'T')); // Handle PHP datetime format
    const now = new Date();
    return date.getDate() === now.getDate() &&
           date.getMonth() === now.getMonth() &&
           date.getFullYear() === now.getFullYear();
};

const relTime = (d) => {
    if (!d) return '';
    try {
        const date = new Date(d.replace(' ', 'T'));
        const now = new Date();
        const diff = Math.floor((now - date) / 1000); // seconds
        
        if (diff < 60) return 'Just now';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
        
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch (e) { return ''; }
};

const UI = {
    showError: function(inputName, message, form) {
        const input = form.querySelector(`[name="${inputName}"]`);
        if (!input) return;
        
        input.classList.add('error');
        const group = input.closest('.form-group');
        if (!group) return;

        let errorSpan = group.querySelector('.form-error');
        if (!errorSpan) {
            errorSpan = document.createElement('span');
            errorSpan.className = 'form-error';
            group.appendChild(errorSpan);
        }
        errorSpan.innerText = message;
        errorSpan.style.display = 'block';
        errorSpan.style.marginTop = '4px';

        // Smoothly scroll the error into view if it's not fully visible
        group.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    clearErrors: function(form) {
        form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
        form.querySelectorAll('.form-error').forEach(el => el.style.display = 'none');
    },
    syncNav: async function() {
        if (!Auth.isAuthenticated()) return;
        const res = await API.post('/profile/get', {});
        if (!res || !res.success) return;
        const { user, profile } = res.data;

        // Nav avatar
        const av = document.getElementById('nav-avatar');
        if (av) {
            if (profile && profile.profile_image) {
                av.innerHTML = `<img src="${CONFIG.ASSET_BASE}/${profile.profile_image}">`;
                av.style.background = 'none';
            } else {
                const initials = ((user.first_name?.[0] || '') + (user.last_name?.[0] || '')).toUpperCase() || (user.nickname?.[0] || '?').toUpperCase();
                av.textContent = initials;
                av.style.background = 'var(--g-primary)';
            }
            av.setAttribute('href', 'profile/view');
        }

        // Notification badge — pull real unread count from Phase 6
        NotificationsController.pollBadge();
    }
};

const AuthController = {
    initLogin: function() {
        if (Auth.isAuthenticated()) {
            if (Auth.hasProfile()) Router.navigate('/dashboard');
            else Router.navigate('/profile/edit');
            return;
        }
        const form = document.getElementById('login-form');
        if (!form) return;
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            UI.clearErrors(form);
            
            if (!form.email.value) { UI.showError('email', 'Phone number or email is required', form); return; }
            if (!form.password.value) { UI.showError('password', 'Password is required', form); return; }

            const payload = {
                email: form.email.value,
                password: form.password.value
            };
            
            const res = await API.post('/login', payload);
            if (res && res.success) {
                Auth.setToken(res.data.token);
                Auth.setHasProfile(res.data.has_profile);
                Auth.setHasLevel(res.data.has_profile); // If has_profile is true, they have a level
                
                if (res.data.has_profile) {
                    Router.navigate('/dashboard');
                } else {
                    Router.navigate('/profile/edit');
                }
            } else {
                if (res && res.data && res.data.needs_verification) {
                    localStorage.setItem('verify_user_id', res.data.user_id);
                    Router.navigate('/verify');
                } else {
                    // Unified style: show backend error on the first field (email)
                    UI.showError('email', res ? res.message : 'Invalid email or password', form);
                }
            }
        });
    },

    initRegister: function() {
        if (Auth.isAuthenticated()) {
            if (Auth.hasProfile() && Auth.hasLevel()) Router.navigate('/dashboard');
            else Router.navigate('/profile/edit');
            return;
        }
        const form = document.getElementById('register-form');
        if (!form) return;
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            Auth.clearAll();
            UI.clearErrors(form);

            if (!form.first_name.value) { UI.showError('first_name', 'First name is required', form); return; }
            if (!form.last_name.value) { UI.showError('last_name', 'Last name is required', form); return; }
            if (!form.email.value || !form.email.value.includes('@')) { UI.showError('email', 'Invalid email address', form); return; }
            const mobileVal = form.mobile.value.trim();
            const mobileRegex = /^01[0125][0-9]{8}$/;
            if (!mobileRegex.test(mobileVal)) { 
                UI.showError('mobile', 'Enter a valid 11-digit Egyptian mobile (e.g. 01012345678)', form); 
                return; 
            }
            if (!form.password.value || form.password.value.length < 8) { UI.showError('password', 'Password must be at least 8 chars', form); return; }

            const payload = {
                first_name: form.first_name.value,
                last_name: form.last_name.value,
                mobile: form.mobile.value,
                email: form.email.value,
                password: form.password.value
            };
            
            const btn = form.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.innerText = 'Registering...';

            const res = await API.post('/register', payload);
            if (res && res.success) {
                localStorage.setItem('verify_user_id', res.data.user_id);
                console.log("TEST CODES:", res.data);
                // Friendly modal/notification could go here, but for now alert is fine for flow
                Router.navigate('/verify');
            } else {
                const msg = (res && res.message) ? res.message.toLowerCase() : '';
                if (msg.includes('email')) UI.showError('email', res.message, form);
                else if (msg.includes('mobile')) UI.showError('mobile', res.message, form);
                else Toast.show(res ? res.message : 'Registration failed');
                
                btn.disabled = false;
                btn.innerText = 'Continue →';
            }
        });
    },

    initVerify: function() {
        const smsForm = document.getElementById('verify-sms-form');
        const continueBtn = document.getElementById('btn-complete-verify');
        const userId = localStorage.getItem('verify_user_id');

        let isEmailVerified = false;
        let isPhoneVerified = false;

        const updateUI = () => {
            const emailBadge = document.getElementById('email-status-badge');
            const smsBadge = document.getElementById('sms-status-badge');
            const emailMsg = document.getElementById('email-verified-msg');

            if (isEmailVerified && emailBadge) {
                emailBadge.innerText = 'Verified';
                emailBadge.className = 'badge badge-green';
                if (emailMsg) emailMsg.style.display = 'block';
            }
            if (isPhoneVerified && smsBadge) {
                smsBadge.innerText = 'Verified';
                smsBadge.className = 'badge badge-green';
                if (smsForm) {
                    smsForm.querySelector('button').disabled = true;
                    smsForm.querySelector('button').innerText = '✓ Verified';
                }
            }

            if (isEmailVerified && isPhoneVerified && continueBtn) {
                continueBtn.disabled = false;
                continueBtn.style.opacity = '1';
                
                // Auto-advance so they don't get stuck verifying again
                setTimeout(() => {
                    if (Auth.hasProfile() && Auth.hasLevel()) {
                        Router.navigate('/dashboard');
                    } else {
                        Router.navigate('/profile/edit');
                    }
                }, 1500);
            }
        };

        const checkStatus = async () => {
             const res = await API.post('/check-verification', { user_id: userId });
             if (res && res.success) {
                 isEmailVerified = !!res.data.email_verified;
                 isPhoneVerified = !!res.data.phone_verified;
                 if (res.data.token) {
                     Auth.setToken(res.data.token);
                 }
                 if (res.data.fully_verified || (isEmailVerified && isPhoneVerified)) {
                    Auth.setHasProfile(res.data.has_profile);
                    Auth.setHasLevel(res.data.has_profile);
                 }
                 updateUI();
             }
        };

        if (!userId) {
            if (Auth.isAuthenticated()) { 
                if (Auth.hasProfile() && Auth.hasLevel()) Router.navigate('/dashboard');
                else Router.navigate('/profile/edit');
                return; 
            }
            Router.navigate('/login'); return;
        }

        // Check status immediately and then every 3s
        checkStatus();
        const poll = setInterval(() => {
            if (isEmailVerified && isPhoneVerified) {
                clearInterval(poll);
                return;
            }
            // Only poll if the page is still the verify page
            if (!document.getElementById('verify-sms-form')) {
                clearInterval(poll);
                return;
            }
            checkStatus();
        }, 3000);

        if (continueBtn) {
            continueBtn.addEventListener('click', () => {
                if (!continueBtn.disabled) {
                    Router.navigate('/profile/edit');
                }
            });
        }

        if (smsForm) {
            smsForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const code = smsForm.code.value;
                const res = await API.post('/verify-otp', { user_id: userId, code });
                if (res && res.success) {
                    isPhoneVerified = true;
                    if (res.data.token) {
                        Auth.setToken(res.data.token);
                    }
                    if (res.data.fully_verified) {
                        Auth.setHasProfile(res.data.has_profile);
                        Auth.setHasLevel(res.data.has_profile);
                    }
                    updateUI();
                } else {
                    Toast.show(res ? res.message : 'Invalid code');
                }
            });
        }

        window._verifyState = {
            setEmailVerified: (val) => {
                isEmailVerified = val;
                updateUI();
            }
        };
    },

    handleEmailLink: async function() {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        
        if (!token) {
            Toast.show('Invalid verification link.');
            Router.navigate('/login');
            return;
        }

        const res = await API.post('/verify-email-link', { token });
        if (res && res.success) {
            if (res.data.token) {
                Auth.setToken(res.data.token);
            }
            if (res.data.fully_verified) {
                Auth.setHasProfile(res.data.has_profile);
                Auth.setHasLevel(res.data.has_profile);
            }
            const badge = document.getElementById('email-status-badge');
            const msg = document.getElementById('email-verified-msg');
            if (badge) {
                badge.innerText = 'Verified';
                badge.className = 'badge badge-green';
            }
            if (msg) msg.style.display = 'block';

            if (window._verifyState) {
                window._verifyState.setEmailVerified(true);
            }
            
            Toast.show('Email verified successfully! Now please complete the WhatsApp step.', 'success');
        } else {
            Toast.show(res ? res.message : 'Verification link expired or invalid.');
            Router.navigate('/login');
        }
    },

    initForgotPassword: function() {
        const form = document.getElementById('forgot-form');
        if(!form) return;
        
        form.addEventListener('submit', async(e) => {
            e.preventDefault();
            const payload = { email: form.email.value };
            const res = await API.post('/forgot-password', payload);
            if(res && res.success) {
                Toast.show(res.message, 'success');
                if (res.data && res.data.test_reset_token) {
                    console.log('RESET TOKEN (DEV ONLY): ', res.data.test_reset_token);
                    // store for easy testing flow
                    localStorage.setItem('test_reset_token', res.data.test_reset_token);
                }
                Router.navigate('/login');
            } else {
                Toast.show(res && res.message ? res.message : 'Error processing request.');
            }
        });
    },

    initResetPassword: function() {
        const form = document.getElementById('reset-form');
        if(!form) return;

        // Auto-fill test token or URL token if available
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get('token');
        const testToken = localStorage.getItem('test_reset_token');
        
        if (urlToken && form.token) {
            form.token.value = urlToken;
        } else if (testToken && form.token) {
            form.token.value = testToken;
            localStorage.removeItem('test_reset_token');
        }

        form.addEventListener('submit', async(e) => {
            e.preventDefault();
            const pt = form.password.value;
            const pc = form.password_confirm.value;
            if (pt !== pc) {
                Toast.show('Passwords do not match');
                return;
            }
            
            const payload = { token: form.token.value, new_password: pt };
            const res = await API.post('/reset-password', payload);
            Toast.show(res ? res.message : 'Error resetting password');
            if (res && res.success){
                Router.navigate('/login');
            }
        });
    }
};

// -------------------------------------------------------
//  DASHBOARD CONTROLLER
// -------------------------------------------------------
const DashboardController = {
    _allMatches: [],
    _currentMatchTab: 'completed',
    _currentRankTab: 'male',
    _currentUser: null,
    _cache: {}, // Stores user profile and recent matches

    init: async function(isSilent = false) {
        if (!isSilent) await UI.syncNav();
        
        // Use cache for instant render if available
        if (!isSilent && DashboardController._cache.profile) {
            DashboardController.applyData(DashboardController._cache.profile, DashboardController._cache.matches);
        }

        // Use Promise.all for initial data
        const [res, matchRes] = await Promise.all([
            API.post('/profile/get', {}),
            API.post('/matches/recent', { limit: 10 })
        ]);

        if (!res || !res.success) {
            if (!res || res.message === 'Unauthorized') {
                Auth.clearAll();
                Router.navigate('/login');
            }
            return;
        }

        // Compare with cache
        const profileJson = JSON.stringify(res.data);
        const matchesJson = matchRes?.success ? JSON.stringify(matchRes.data.matches) : '';
        
        if (isSilent && DashboardController._cache.profile_json === profileJson && DashboardController._cache.matches_json === matchesJson) {
            return;
        }

        DashboardController._cache.profile = res.data;
        DashboardController._cache.profile_json = profileJson;
        if (matchRes?.success) {
            DashboardController._cache.matches = matchRes.data.matches;
            DashboardController._cache.matches_json = matchesJson;
        }

        DashboardController.applyData(res.data, matchRes?.success ? matchRes.data.matches : []);

        // Start polling if this is the first load
        if (!isSilent && typeof PollManager !== 'undefined') {
            PollManager.start('dashboard', () => DashboardController.init(true), 10000);
        }
    },

    applyData: function(profileData, matchData) {
        const { user, profile, stats } = profileData;
        DashboardController._currentUser = user;
        
        if (matchData) {
            DashboardController._allMatches = matchData;
        }

        // Welcome name
        const nameEl = document.getElementById('dash-name');
        if (nameEl) nameEl.textContent = profile?.nickname || user.first_name;

        // Stats
        StatsUI.update(stats, 'dash');

        DashboardController.renderMatches();
        DashboardController.renderRanking();
    },

    switchRankTab: function(gender) {
        DashboardController._currentRankTab = gender;
        const males = document.getElementById('tab-males');
        const females = document.getElementById('tab-females');
        if (males) {
            males.style.borderBottomColor = gender === 'male' ? 'var(--c-primary)' : 'transparent';
            males.style.color = gender === 'male' ? 'var(--c-text)' : 'var(--c-text-muted)';
        }
        if (females) {
            females.style.borderBottomColor = gender === 'female' ? 'var(--c-primary)' : 'transparent';
            females.style.color = gender === 'female' ? 'var(--c-text)' : 'var(--c-text-muted)';
        }
        DashboardController.renderRanking();
    },

    switchMatchTab: function(tab) {
        DashboardController._currentMatchTab = tab;
        const comp = document.getElementById('tab-completed');
        const upco = document.getElementById('tab-upcoming');
        if (comp) {
            comp.style.borderBottomColor = tab === 'completed' ? 'var(--c-primary)' : 'transparent';
            comp.style.color = tab === 'completed' ? 'var(--c-text)' : 'var(--c-text-muted)';
        }
        DashboardController.renderMatches();
    },

    renderMatches: function() {
        const listEl = document.getElementById('dash-matches-list');
        if (!listEl) return;
        const filtered = DashboardController._allMatches.filter(m => m.status === DashboardController._currentMatchTab);
        if (filtered.length === 0) {
            listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">🎾</div><h3>No ${DashboardController._currentMatchTab} matches</h3><p>Your matches will appear here.</p></div>`;
            return;
        }
        const uid = DashboardController._currentUser?.id;
        
        let html = '';
        if (DashboardController._currentMatchTab === 'completed') {
            // Flatten all scores from all completed matches into a single list of cards
            const allScoreCards = [];
            filtered.forEach(m => {
                if (m.scores && m.scores.length > 0) {
                    m.scores.forEach(s => {
                        allScoreCards.push(DashboardController.renderMatchCard(m, uid, s));
                    });
                } else {
                    allScoreCards.push(DashboardController.renderMatchCard(m, uid));
                }
            });
            // Show only the latest 4 scores
            html = allScoreCards.slice(0, 4).join('');
        } else {
            // For upcoming, show everything
            filtered.forEach(m => {
                html += DashboardController.renderMatchCard(m, uid);
            });
        }
        listEl.innerHTML = html;
    },

    renderMatchCard: function(m, userId, specificScore = null) {
        if (m.status === 'completed' && (specificScore || (m.scores && m.scores.length > 0))) {
            const scoreToRender = specificScore || m.scores[0];
            const allPlayers = [...(m.team_a || []), ...(m.team_b || [])];
            const scoreHtml = ScoreUI.renderMatchScore(m, scoreToRender, allPlayers, false);
            
            const dateObj = new Date(m.scheduled_at.replace(' ', 'T'));
            const now = new Date();
            const diffDays = Math.floor((now - dateObj) / (1000 * 60 * 60 * 24));
            
            let dayStr;
            if (dateObj.toDateString() === now.toDateString()) {
                dayStr = 'Today';
            } else if (diffDays < 7) {
                dayStr = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
            } else {
                dayStr = dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
            }
            const timeStr = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(':00', '');
            
            const venueTitle = (m.venue || 'Venue TBD').split(' - ')[0].trim();
            const dashHeader = `
                <div style="font-size:10px; font-weight:800; color:var(--c-text-muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:10px; padding:0 20px;">
                    ${venueTitle} &nbsp;·&nbsp; ${dayStr}
                </div>
            `;
            
            return `
                <div onclick="Router.navigate('/matches/${m.match_code}')" class="dash-match-card" style="cursor:pointer; background:var(--c-bg-card); border:1px solid var(--c-border); border-radius:var(--r-lg); padding:10px 0; margin-bottom:29px; transition:var(--t-fast);">
                    ${dashHeader}
                    ${scoreHtml}
                </div>
            `;
        }

        const userTeam = m.user_team;
        const dateStr = m.scheduled_at
            ? new Date(m.scheduled_at.replace(' ', 'T')).toLocaleDateString('en-US', { weekday:'long', hour:'2-digit', minute:'2-digit' })
            : 'TBD';

        const renderTeamRow = (players) => {
            const p1 = players[0] || { name: '—' };
            const p2 = players[1] || { name: '—' };
            return `
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <div style="font-size:13px; font-weight:700;">${p1.name}</div>
                    <div style="font-size:13px; font-weight:700;">${p2.name}</div>
                </div>
            `;
        };

        return `
        <div onclick="Router.navigate('/matches/${m.match_code}')" style="background:var(--c-bg-card); border:1px solid var(--c-border); border-radius:var(--r-lg); padding:16px; margin-bottom:12px; cursor:pointer; transition:all 0.2s;">
            <div style="font-size:11px; color:var(--c-text-muted); font-weight:600; margin-bottom:12px; text-transform:uppercase; letter-spacing:0.5px;">${m.venue || 'Venue TBD'} · ${dateStr}</div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; gap:16px; align-items:center;">
                    ${renderTeamRow(m.team_a)}
                    <div style="font-size:12px; color:var(--c-text-dim); font-weight:700;">VS</div>
                    ${renderTeamRow(m.team_b)}
                </div>
                <div class="status-badge" style="font-size:10px;">${m.status.toUpperCase()}</div>
            </div>
        </div>`;
    },

    renderRanking: async function() {
        const listEl = document.getElementById('dash-ranking-list');
        if (!listEl) return;
        
        // Use current tab gender
        const gender = DashboardController._currentRankTab || 'male';

        const res = await API.post('/ranking/list', { gender: gender, limit: 10 });
        if (!res || !res.success) {
             listEl.innerHTML = `<div class="empty-state" style="padding:40px 0;"><div class="empty-icon">⚠️</div><h3>Unable to load ranking</h3></div>`;
             return;
        }

        const ranking = res.data.ranking;
        if (ranking.length === 0) {
            listEl.innerHTML = `<div class="empty-state" style="padding:40px 0;"><div class="empty-icon">🏅</div><h3>No rankings yet</h3><p>Rankings will appear after the first matches are recorded.</p></div>`;
            return;
        }

        let html = '';
        ranking.forEach(r => {
            const trend = r.points_this_week;
            const trendHtml = trend > 0 ? `<span style="color:var(--c-green);">+${trend}</span>` : (trend < 0 ? `<span style="color:var(--c-red);">${trend}</span>` : `<span style="color:var(--c-text-dim);">0</span>`);
            
            const initials = ((r.first_name?.[0] || '') + (r.last_name?.[0] || '')).toUpperCase() || (r.nickname?.[0] || '?').toUpperCase();
            const fallbackHtml = `<div style='width:32px; height:32px; border-radius:50%; background:var(--g-primary); display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:800; color:#fff; border:1px solid rgba(255,255,255,0.1); flex-shrink:0;'>${initials}</div>`;
            const avatarHtml = r.profile_image 
                ? `<img src="${CONFIG.ASSET_BASE}/${r.profile_image}" onerror="this.onerror=null; this.outerHTML=\`${fallbackHtml}\`;" style="width:32px; height:32px; border-radius:50%; object-fit:cover; border:1px solid var(--c-border);">`
                : fallbackHtml;
            
            html += `
                <div onclick="Router.navigate('/profile/view/${r.player_code}')" class="rank-grid-dash" style="padding:12px 10px; align-items:center; border-radius:var(--r-md); transition:all 0.2s; cursor:pointer; margin-bottom:4px;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
                    <span style="font-weight:800; color:${r.rank <= 3 ? 'var(--c-orange)' : 'var(--c-text-dim)'}; font-size:15px;">#${r.rank}</span>
                    <div style="display:flex; align-items:center; gap:10px; min-width:0;">
                        ${avatarHtml}
                        <div style="min-width:0; overflow:hidden;">
                            <div style="font-size:14px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${r.nickname}</div>
                            <div style="display:flex; align-items:center; gap:6px; margin-top:2px;">
                                <span style="font-size:10px; background:rgba(255,255,255,0.1); padding:1px 4px; border-radius:4px; color:var(--c-text-muted); font-family:monospace; font-weight:700; text-transform:uppercase;">${r.player_code}</span>
                                <span style="font-size:10px; color:var(--c-text-muted); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${r.first_name} ${r.last_name}</span>
                            </div>
                        </div>
                    </div>
                    <span class="hide-mobile" style="text-align:center; font-size:13px; font-weight:600; color:var(--c-text-muted);">${r.age || '—'}</span>
                    <span style="text-align:right; font-size:14px; font-weight:800; color:#fff;">${r.points}</span>
                    <span class="hide-mobile" style="text-align:right; font-size:12px; font-weight:700;">${trendHtml}</span>
                </div>
            `;
        });
        listEl.innerHTML = html;
    }
};



// -------------------------------------------------------
//  PROFILE VIEW CONTROLLER
// -------------------------------------------------------
const ProfileViewController = {
    init: async function(params) {
        // Guard: All profile views require authentication
        if (!Auth.isAuthenticated()) {
            Router.navigate('/login');
            return;
        }

        await UI.syncNav();
        
        // ID could be user_id (numeric) or player_code (string)
        const payload = {};
        if (params && params.id) {
            if (/^\d+$/.test(params.id)) payload.target_id = params.id;
            else payload.player_code = params.id;
        }
        
        const res = await API.post('/profile/get', payload);
        if (!res || !res.success) {
            const pageEl = document.querySelector('.page.active');
            if (pageEl) {
                pageEl.innerHTML = `
                    <div style="width:100%; max-width:500px; margin:0 auto; padding:90px 20px 40px; text-align:center; display:flex; flex-direction:column; align-items:center; justify-content:center;">
                        <div style="font-size:64px; margin-bottom:20px;">🎾🔎</div>
                        <h1 style="font-size:32px; font-weight:800; color:#fff; margin-bottom:12px;">Player Not Found</h1>
                        <p style="color:var(--c-text-muted); font-size:16px; margin-bottom:32px;">The player code you are looking for does not exist or has been removed.</p>
                        <button onclick="Router.navigate(Auth.isAuthenticated() ? '/dashboard' : '/')" class="btn btn-primary" style="width:auto; padding:14px 40px;">
                            ${Auth.isAuthenticated() ? 'Return to Dashboard' : 'Go to Homepage'}
                        </button>
                        ${Auth.isAuthenticated() ? `
                            <div style="margin-top:40px; padding-top:20px; border-top:1px solid rgba(255,255,255,0.05); width:100%;">
                                <p style="color:var(--c-text-dim); font-size:14px; margin-bottom:12px;">Not you? Or having issues?</p>
                                <button onclick="API.post('/logout', {}).then(() => { Auth.clearAll(); Router.navigate('/login'); })" style="background:transparent; border:none; color:var(--c-orange); font-size:14px; font-weight:700; cursor:pointer; text-transform:uppercase; letter-spacing:1px;">Sign Out</button>
                            </div>
                        ` : ''}
                    </div>
                `;
            }
            return;
        }
        const { user, profile, stats, is_self } = res.data;
        
        // Avatar
        const av = document.getElementById('prof-avatar');
        if (av) {
            if (profile && profile.profile_image) {
                av.innerHTML = `<img src="${CONFIG.ASSET_BASE}/${profile.profile_image}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
                av.classList.remove('avatar-placeholder');
                av.style.background = 'none';
            } else {
                const initials = ((user.first_name?.[0] || '') + (user.last_name?.[0] || '')).toUpperCase() || (user.nickname?.[0] || '?').toUpperCase();
                av.textContent = initials;
                av.classList.add('avatar-placeholder');
                // Transparent for background if we have initials
            }
        }

        // Action cards visibility (only for self)
        const actionCards = document.getElementById('prof-action-cards');
        if (actionCards) {
            actionCards.style.display = res.data.is_self ? 'flex' : 'none';
        }

        // Report player button (only for others)
        const reportContainer = document.getElementById('prof-report-container');
        if (reportContainer) {
            if (!res.data.is_self) {
                reportContainer.style.display = 'block';
                const reportBtn = document.getElementById('prof-report-btn');
                if (reportBtn) {
                    reportBtn.onclick = () => ProfileController.reportPlayer(user.id);
                }
            } else {
                reportContainer.style.display = 'none';
            }
        }

        // Names (Nickname + Full Name)
        const nickEl = document.getElementById('prof-nickname');
        if (nickEl) nickEl.textContent = profile?.nickname || user.first_name;
        
        const fullEl = document.getElementById('prof-fullname');
        if (fullEl) {
            if (profile?.nickname) {
                fullEl.textContent = user.first_name + ' ' + user.last_name;
                fullEl.style.display = 'block';
            } else {
                fullEl.style.display = 'none';
            }
        }

        // Player code
        const codeEl = document.getElementById('prof-code');
        if (codeEl) {
            if (profile?.player_code) {
                codeEl.innerHTML = `<span>🆔</span> <span style="color:var(--c-orange); font-weight:800;">${profile.player_code}</span>`;
                codeEl.style.display = 'inline-flex';
            } else {
                codeEl.style.display = 'none';
            }
        }

        // Meta pills (location, hand)
        const metaEl = document.getElementById('prof-meta');
        if (metaEl) {
            const items = [];
            if (profile?.location) items.push(`<span style='font-size:13px; color:var(--c-text-muted); display:flex; align-items:center; gap:6px;'>📍 ${profile.location}</span>`);
            if (profile?.playing_side) {
                const h = profile.playing_side.charAt(0).toUpperCase() + profile.playing_side.slice(1);
                const label = profile.playing_side === 'flexible' ? 'Flexible' : h + ' side';
                items.push(`<span style='font-size:13px; color:var(--c-text-muted); display:flex; align-items:center; gap:6px;'>🎾 ${label}</span>`);
            }
            if (profile?.age) items.push(`<span style='font-size:13px; color:var(--c-text-muted); display:flex; align-items:center; gap:6px;'>🎂 Age ${profile.age}</span>`);
            metaEl.innerHTML = items.join('');
        }

        // Bio
        const bioEl = document.getElementById('prof-bio');
        if (bioEl && profile?.bio) {
            bioEl.textContent = profile.bio;
            bioEl.style.display = 'block';
        }

        // Stats cards
        StatsUI.update(stats, 'pv');

        // Wait to showcase placeholder loaders for matches
        await new Promise(r => setTimeout(r, CONFIG.SKELETON_DELAY));

        // Matches list
        const matchPayload = { target_id: user.id };
        const matchRes = await API.post('/matches/user', matchPayload);
        const listEl = document.getElementById('pv-matches-list');
        if (listEl) {
            // Filter: only completed matches (history)
            const historyMatches = (matchRes?.data?.matches || []).filter(m => m.status === 'completed');
            
            if (historyMatches.length === 0) {
                listEl.innerHTML = `<div class='empty-state' style='padding:60px 0;'><div class='empty-icon'>🎾</div><h3>No match results yet</h3><p>Complete matches to see them in history.</p></div>`;
            } else {
                // Limit to latest 5 results (scores)
                let scoreCount = 0;
                let html = '';
                for (const m of historyMatches) {
                    if (scoreCount >= 5) break;
                    
                    if (m.scores && m.scores.length > 0) {
                        for (const s of m.scores) {
                            if (scoreCount >= 5) break;
                            html += DashboardController.renderMatchCard(m, user.id, s);
                            scoreCount++;
                        }
                    } else {
                        html += DashboardController.renderMatchCard(m, user.id);
                        scoreCount++;
                    }
                }
                listEl.innerHTML = html;
            }
        }

        // Final reveal
        const contentEl = document.getElementById('prof-view-content');
        if (contentEl) contentEl.style.opacity = '1';
    }
};

const ProfileController = {

    reportPlayer: async function(targetUserId) {
        const reason = await ConfirmModal.show({
            title: 'Report Player',
            message: 'Please describe the issue you encountered with this player.',
            showInput: true,
            inputPlaceholder: 'Unfair behavior / Inappropriate conduct...',
            confirmText: 'Submit Report',
            type: 'warning'
        });

        if (!reason) return;

        const res = await API.post('/profile/report', { target_user_id: targetUserId, reason });
        if (res && res.success) {
            Toast.show('Report submitted successfully.', 'success');
        } else {
            Toast.show(res ? res.message : 'Report failed', 'error');
        }
    },

    _cropper: null,

    cancelCrop: function() {
        document.getElementById('crop-modal-overlay').style.display = 'none';
        if (this._cropper) {
            this._cropper.destroy();
            this._cropper = null;
        }
        const input = document.getElementById('avatar-input');
        if (input) input.value = '';
    },

    zoom: function(amount) {
        if (this._cropper) {
            this._cropper.zoom(amount);
        }
    },

    confirmCrop: async function() {
        if (!this._cropper) return;

        const canvas = this._cropper.getCroppedCanvas({
            width: 500,
            height: 500
        });

        canvas.toBlob(async (blob) => {
            const formData = new FormData();
            formData.append('image', blob, 'avatar.png');

            document.getElementById('crop-modal-overlay').style.display = 'none';
            this._cropper.destroy();
            this._cropper = null;

            const res = await fetch(CONFIG.API_BASE_URL + '/profile/upload_image', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + Auth.getToken() },
                body: formData
            }).then(r => r.json());

            if (res && res.success) {
                const avImg = document.getElementById('edit-avatar-img');
                const avPreview = document.getElementById('edit-avatar-preview');
                const removeBtn = document.getElementById('remove-avatar-btn');
                
                avImg.src = CONFIG.ASSET_BASE + '/' + res.data.profile_image + '?v=' + Date.now();
                avImg.style.display = 'block';
                avPreview.style.display = 'none';
                if (removeBtn) removeBtn.style.display = 'block';
                Toast.show('Photo updated', 'success');
                UI.syncNav();
            } else {
                Toast.show(res ? res.message : 'Upload failed');
            }
        }, 'image/png');
    },

    initEdit: function() {
        const form = document.getElementById('profile-form');
        if (!form) return;

        // Populate days
        const daySelect = form.dob_day;
        for (let i = 1; i <= 31; i++) {
            const val = i.toString().padStart(2, '0');
            daySelect.options.add(new Option(i, val));
        }

        // Populate years (1961 - 2012 for 14-65yo)
        const yearSelect = form.dob_year;
        const currentYear = new Date().getFullYear();
        for (let i = currentYear - 14; i >= currentYear - 65; i--) {
            yearSelect.options.add(new Option(i, i));
        }
        // Only show logout option if they don't have a profile yet
        const logoutOption = document.getElementById('logout-option');
        if (logoutOption) {
            logoutOption.style.display = Auth.hasProfile() ? 'none' : 'block';
        }

        // Load existing data if they already have a profile
        const isExisting = Auth.hasProfile();
        
        // Dynamic content based on state
        const titleEl = document.getElementById('edit-profile-title');
        const subtitleEl = document.getElementById('edit-profile-subtitle');
        const submitBtn = document.getElementById('edit-profile-submit');
        
        if (isExisting) {
            if (titleEl) titleEl.textContent = 'Edit Profile';
            if (subtitleEl) subtitleEl.style.display = 'none';
            if (submitBtn) submitBtn.textContent = 'Save changes';
        } else {
            if (titleEl) titleEl.textContent = 'Complete Your Profile';
            if (subtitleEl) subtitleEl.style.display = 'block';
            if (submitBtn) submitBtn.textContent = 'Join Leaderboard →'; // Match initial design
        }

        // Fetch data to pre-fill (even for new users to get first/last name from reg step)
        API.post('/profile/get', {}).then(res => {
            if (res && res.success) {
                const p = res.data.profile;
                const u = res.data.user;
                if (u) {
                    if (form.first_name) form.first_name.value = u.first_name || '';
                    if (form.last_name) form.last_name.value = u.last_name || '';
                }
                if (p) {
                    if (form.nickname && p.nickname) form.nickname.value = p.nickname;
                    if (form.gender && p.gender) form.gender.value = p.gender;
                    if (form.playing_side && p.playing_side) form.playing_side.value = p.playing_side;
                    if (form.location && p.location) form.location.value = p.location;
                    if (form.bio && p.bio) form.bio.value = p.bio;
                    
                    Auth.setHasProfile(true); // They have a profile row
                    Auth.setHasLevel(!!p.level);

                    if (!p.level) {
                        const modal = document.getElementById('level-selection-modal');
                        if (modal) {
                            modal.style.display = 'flex';
                            document.body.style.overflow = 'hidden';
                            document.documentElement.style.overflow = 'hidden';
                        }
                    }
                    
                    if (p.date_of_birth) {
                        const parts = p.date_of_birth.split('-');
                        if (parts.length === 3) {
                            if (form.dob_year) form.dob_year.value = parts[0];
                            if (form.dob_month) form.dob_month.value = parts[1];
                            if (form.dob_day) form.dob_day.value = parts[2];
                        }
                    }
                }

                // Avatar setup
                const avPreview = document.getElementById('edit-avatar-preview');
                const avImg = document.getElementById('edit-avatar-img');
                const removeBtn = document.getElementById('remove-avatar-btn');
                
                if (p && p.profile_image) {
                    avImg.src = CONFIG.ASSET_BASE + '/' + p.profile_image + '?v=' + Date.now();
                    avImg.style.display = 'block';
                    avPreview.style.display = 'none';
                    if (removeBtn) removeBtn.style.display = 'block';
                } else if (u) {
                    // Show initials if no photo
                    avImg.style.display = 'none';
                    avPreview.style.display = 'flex';
                    avPreview.textContent = (u.first_name[0] + u.last_name[0]).toUpperCase();
                    if (removeBtn) removeBtn.style.display = 'none';
                }
            }
        });

        // Avatar Upload Handlers
        const avatarInput = document.getElementById('avatar-input');
        if (avatarInput) {
            avatarInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                // Clear the input value so the same file can be selected again if needed
                e.target.value = "";

                const reader = new FileReader();
                reader.onload = (event) => {
                    const overlay = document.getElementById('crop-modal-overlay');
                    const imageEl = document.getElementById('crop-image-el');
                    imageEl.src = event.target.result;
                    overlay.style.display = 'flex';

                    if (ProfileController._cropper) {
                        ProfileController._cropper.destroy();
                    }

                    const zoomBar = document.getElementById('crop-zoom-bar');
                    if (zoomBar) zoomBar.value = 1;

                    ProfileController._cropper = new Cropper(imageEl, {
                        aspectRatio: 1,
                        viewMode: 1,
                        dragMode: 'move',
                        autoCropArea: 1,
                        modal: true,
                        guides: false,
                        center: true,
                        highlight: false,
                        background: false,
                        restore: false,
                        checkOrientation: true,
                        cropBoxMovable: false,
                        cropBoxResizable: false,
                        toggleDragModeOnDblclick: false,
                        ready: function() {
                            const data = ProfileController._cropper.getCanvasData();
                            const initialRatio = data.width / data.naturalWidth;
                            if (zoomBar) {
                                zoomBar.min = initialRatio;
                                zoomBar.max = initialRatio * 5; // 5x zoom max
                                zoomBar.value = initialRatio;
                            }
                        },
                        zoom: function(e) {
                            if (zoomBar) zoomBar.value = e.detail.ratio;
                        }
                    });

                    if (zoomBar) {
                        zoomBar.oninput = (e) => {
                            if (ProfileController._cropper) {
                                ProfileController._cropper.zoomTo(parseFloat(e.target.value));
                            }
                        };
                    }
                };
                reader.readAsDataURL(file);
            });
        }

        const removeAvatarBtn = document.getElementById('remove-avatar-btn');
        if (removeAvatarBtn) {
            removeAvatarBtn.addEventListener('click', async () => {
                const res = await API.post('/profile/remove_image', {});
                if (res && res.success) {
                    document.getElementById('edit-avatar-img').style.display = 'none';
                    document.getElementById('edit-avatar-preview').style.display = 'flex';
                    removeAvatarBtn.style.display = 'none';
                    Toast.show('Photo removed', 'success');
                    UI.syncNav();
                }
            });
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            UI.clearErrors(form);

            if (!form.first_name.value) { UI.showError('first_name', 'First name is required', form); return; }
            if (!form.last_name.value) { UI.showError('last_name', 'Last name is required', form); return; }
            if (!form.dob_day.value) { UI.showError('dob_day', 'Select day', form); return; }
            if (!form.dob_month.value) { UI.showError('dob_month', 'Select month', form); return; }
            if (!form.dob_year.value) { UI.showError('dob_year', 'Select year', form); return; }
            
            const dobYear = parseInt(form.dob_year.value);
            const curY = new Date().getFullYear();
            const age = curY - dobYear;
            if (age < 14 || age > 65) {
                UI.showError('dob_year', 'Age must be between 14 and 65', form);
                return;
            }

            if (!form.gender.value) { UI.showError('gender', 'Please select gender', form); return; }
            if (!form.playing_side.value) { UI.showError('playing_side', 'Please select your side', form); return; }
            if (!form.location.value) { UI.showError('location', 'Please select location', form); return; }

            const dob = `${form.dob_year.value}-${form.dob_month.value}-${form.dob_day.value}`;

            const payload = {
                first_name: form.first_name.value.trim(),
                last_name: form.last_name.value.trim(),
                date_of_birth: dob,
                gender: form.gender.value,
                playing_side: form.playing_side.value,
                nickname: form.nickname.value,
                location: form.location.value,
                bio: form.bio.value
            };
            
            const res = await API.post('/profile/update', payload);
            if (res && res.success) {
                Auth.setHasProfile(true);
                // Important: Don't set hasLevel(true) here yet!
                
                if (res.data && res.data.is_new_profile) {
                    const modal = document.getElementById('level-selection-modal');
                    if (modal) {
                        modal.style.display = 'flex';
                        document.body.style.overflow = 'hidden';
                        document.documentElement.style.overflow = 'hidden';
                    }
                } else if (isExisting) {
                    Auth.setHasLevel(true); // Existing profile means they already have a level (or we are just editing)
                    Router.navigate('/profile/view');
                } else {
                    // This case shouldn't normally happen for new profiles without level
                    Router.navigate('/dashboard');
                }
            } else {
                Toast.show(res ? res.message : 'Failed to save profile');
            }
        });
    },

    submitLevel: async function() {
        const selected = document.querySelector('input[name="player_level"]:checked');
        if (!selected) return;
        const level = selected.value;
        const btn = document.getElementById('level-selection-submit');
        if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

        const res = await API.post('/profile/set_level', { level });
        if (res && res.success) {
            Auth.setHasLevel(true);
            document.getElementById('level-selection-modal').style.display = 'none';
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
            Router.navigate('/dashboard');
        } else {
            Toast.show(res ? res.message : 'Failed to save level');
            if (btn) { btn.disabled = false; btn.textContent = 'Complete Profile'; }
        }
    }
};

// -------------------------------------------------------
//  MATCHES CONTROLLER  (Phase 3)
// -------------------------------------------------------
const MatchesController = {
    _lastMode: 'play',
    _currentTab: 'play_upcoming',
    _playFilterType: 'all',
    _playFilterGender: 'all',
    _cache: {}, // Stores lists per tab/filters
    _lastMatchId: null,
    _lastMatchState: null,
    _partnerEnabled: false,

    // ── Create ──────────────────────────────────────────
    initCreate: function() {
        UI.syncNav();

        const genderBtn = document.getElementById('cm-gender-restricted-btn');
        if (genderBtn && DashboardController._currentUser) {
            const isFemale = DashboardController._currentUser.gender === 'female';
            genderBtn.textContent = isFemale ? 'Females Only' : 'Males Only';
        }

        const dateScroller = document.getElementById('cm-date-scroller');
        const timeScroller = document.getElementById('cm-time-scroller');
        const dateInput    = document.getElementById('cm-date');
        const timeInput    = document.getElementById('cm-time');
        
        if (dateScroller && dateInput) {
            // Generate next 10 days
            let html = '';
            for (let i = 0; i < 10; i++) {
                const d = new Date();
                d.setDate(d.getDate() + i);
                const iso = d.toISOString().slice(0, 10);
                const dayName = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' });
                const dayNum  = d.getDate();
                
                html += `
                <div class="pill ${i === 0 ? 'active' : ''}" data-value="${iso}" onclick="MatchesController._selectPill(this, 'cm-date')">
                    <span class="pill-sub">${dayName}</span>
                    <span class="pill-main">${dayNum}</span>
                </div>`;
                if (i === 0) dateInput.value = iso;
            }
            dateScroller.innerHTML = html;
        }

        if (timeScroller && timeInput) {
            // Generate 30-min slots from 07:00 to 03:00 (next day)
            let html = '';
            for (let h = 7; h <= 27; h++) {
                ['00', '30'].forEach(m => {
                    const actualHour = h % 24;
                    const h24 = actualHour.toString().padStart(2, '0');
                    const t = `${h24}:${m}`;
                    
                    // Display label (12h format)
                    const ampm = actualHour >= 12 ? 'PM' : 'AM';
                    const displayHr = actualHour % 12 || 12;
                    const displayTime = `${displayHr}:${m}`;
                    
                    html += `
                    <div class="pill" data-value="${t}" onclick="MatchesController._selectPill(this, 'cm-time')">
                        <span class="pill-main">${displayTime}</span>
                        <span class="pill-sub">${ampm}</span>
                    </div>`;
                });
            }
            timeScroller.innerHTML = html;

            // Scroll to 4:00 PM (16:00) by default as a starting point, but don't select it
            const defaultTime = '16:00';
            const defaultPill = timeScroller.querySelector(`.pill[data-value="${defaultTime}"]`);
            if (defaultPill) {
                // Use a small timeout to ensure DOM is ready for scrolling
                setTimeout(() => {
                    defaultPill.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
                }, 100);
            }
        }




        // Venue Autocomplete
        const venueInput = document.getElementById('cm-venue');
        const venueDrop  = document.getElementById('cm-venue-dropdown');
        let venueTimeout = null;

        if (venueInput && venueDrop) {
            venueInput.addEventListener('input', (e) => {
                clearTimeout(venueTimeout);
                const q = e.target.value.trim();
                
                if (q.length < 1) {
                    venueDrop.style.display = 'none';
                    const addBtnWrap = document.getElementById('cm-add-venue-wrapper');
                    if (addBtnWrap) addBtnWrap.style.display = 'none';
                    return;
                }

                venueTimeout = setTimeout(async () => {
                    const res = await API.post('/match/venues', { q: q });
                    const addBtnWrap = document.getElementById('cm-add-venue-wrapper');

                    if (res && res.success && res.data.venues.length > 0) {
                        venueDrop.innerHTML = res.data.venues.map(v => `<li>${v}</li>`).join('');
                        venueDrop.style.display = 'block';
                        if (addBtnWrap) addBtnWrap.style.display = 'none';
                    } else {
                        venueDrop.style.display = 'none';
                        if (addBtnWrap) addBtnWrap.style.display = 'block';
                    }
                }, 300);

                // Reset DB flag on input
                const dbFlag = document.getElementById('cm-venue-is-db');
                if (dbFlag) dbFlag.value = '0';
            });

            // Handle selection
            venueDrop.addEventListener('click', (e) => {
                if (e.target.tagName === 'LI') {
                    const fullText = e.target.textContent;
                    venueInput.value = fullText;
                    venueDrop.style.display = 'none';
                    
                    const dbFlag = document.getElementById('cm-venue-is-db');
                    if (dbFlag) dbFlag.value = '1';

                    const addBtnWrap = document.getElementById('cm-add-venue-wrapper');
                    if (addBtnWrap) addBtnWrap.style.display = 'none';
                }
            });

            // Close when clicking outside
            document.addEventListener('click', (e) => {
                if (e.target !== venueInput && e.target !== venueDrop) {
                    venueDrop.style.display = 'none';
                }
            });
        }

        // Partner Code Check
        const partnerInput = document.getElementById('cm-partner-code');
        const partnerHelp  = document.getElementById('cm-partner-help');
        let partnerTimeout = null;

        const partnerBadge = document.getElementById('cm-partner-badge');
        const badgeCode    = document.getElementById('cm-badge-code');
        const badgeName    = document.getElementById('cm-badge-name');
        const badgeClear   = document.getElementById('cm-badge-clear');

        if (partnerInput && partnerHelp) {
            if (badgeClear) {
                badgeClear.addEventListener('click', () => {
                    partnerBadge.style.display = 'none';
                    partnerInput.value = '';
                    partnerInput.focus();
                    partnerHelp.textContent = "Enter your partner's 4-character player code";
                    partnerHelp.style.color = 'var(--c-text-muted)';
                });
            }

            partnerInput.addEventListener('input', (e) => {
                clearTimeout(partnerTimeout);
                
                const q = e.target.value.trim();
                partnerHelp.textContent = "Enter your partner's 4-character player code";
                partnerHelp.style.color = 'var(--c-text-muted)';
                partnerInput.classList.remove('error');

                if (q.length === 3 || q.length === 4) {
                    partnerHelp.textContent = "Looking up player...";
                    partnerTimeout = setTimeout(async () => {
                        const res = await API.post('/profile/check_code', { code: q });
                        if (res && res.success) {
                            partnerInput.value = q; // Standardize value to just the code
                            if (partnerBadge && badgeCode && badgeName) {
                                badgeCode.textContent = q;
                                badgeName.textContent = res.data.name;
                                partnerBadge.style.display = 'flex';
                            }
                            partnerHelp.textContent = "Player found!";
                            partnerHelp.style.color = "var(--c-primary)";
                        } else {
                            if (partnerBadge) partnerBadge.style.display = 'none';
                            partnerHelp.textContent = (res && res.message) ? res.message : "Player not found or invalid";
                            partnerHelp.style.color = "var(--c-danger)";
                            partnerInput.classList.add('error');
                        }
                    }, 400);
                } else if (q.length > 4) {
                    // Trim long inputs if pasted
                    e.target.value = q.substring(0, 4);
                    e.target.dispatchEvent(new Event('input'));
                } else {
                    if (partnerBadge) partnerBadge.style.display = 'none';
                }
            });
        }

        const form = document.getElementById('create-match-form');

        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            UI.clearErrors(form);

            const venue    = form.venue_name.value.trim();
            const court    = form.court_name.value.trim();
            const dateVal  = dateInput ? dateInput.value : '';
            const timeVal  = timeInput ? timeInput.value : '';
            const isDbVenue = document.getElementById('cm-venue-is-db')?.value === '1';

            if (!venue) { UI.showError('venue_name', 'Venue name is required', form); return; }
            if (!isDbVenue) {
                UI.showError('venue_name', 'Please select a venue from the official list or add a new one.', form);
                return;
            }
            if (!court) { UI.showError('court_name', 'Court name or number is required', form); return; }

            if (!dateVal) { UI.showError('date', 'Please select a date', form); return; }
            if (!timeVal) { UI.showError('time', 'Please select a time', form); return; }

            // Combine
            const combined  = dateVal + 'T' + timeVal;
            const pickedDt  = new Date(combined);
            const now       = new Date();
            now.setMinutes(now.getMinutes() + 15); // Buffer

            if (pickedDt <= now) {
                UI.showError('time', 'Match date must be in the future', form);
                return;
            }


            const payload = {
                venue_name:       venue,
                court_name:       form.court_name.value.trim(),
                match_datetime:   combined,
                duration_minutes: parseInt(form.duration_minutes.value) || 90,
                gender_type:      form.gender_type.value,
                match_type:       form.match_type.value
            };

            if (MatchesController._partnerEnabled) {
                let code = form.partner_player_code.value.trim();
                // Strip the name if it was appended (e.g. "a123 (Ahmed Magdy)" -> "a123")
                if (code.includes(' (')) {
                    code = code.split(' (')[0].trim();
                }
                if (!code || (code.length !== 3 && code.length !== 4)) { 
                    UI.showError('partner_player_code', "Enter a valid player code", form); 
                    return; 
                }
                payload.partner_player_code = code;
            }


            const btn = document.getElementById('cm-submit');
            btn.disabled = true;
            btn.textContent = 'Creating…';

            const res = await API.post('/match/create', payload);
            btn.disabled = false;
            btn.textContent = '🎾 Create Match';

            if (res && res.success) {
                Toast.show('Match created!', 'success');
                Router.navigate('/matches/' + res.data.match_code, true, true);
            } else {
                Toast.show(res ? res.message : 'Failed to create match', 'error');
            }
        });
    },

    setToggle: function(fieldName, btn) {
        document.getElementById('cm-' + fieldName.replace('_', '-')).value = btn.dataset.val;
        const container = btn.parentElement;
        const buttons = container.querySelectorAll('button');
        buttons.forEach(b => {
            b.classList.remove('active');
            b.style.background = 'transparent';
            b.style.color = 'var(--c-text-muted)';
        });
        btn.classList.add('active');
        btn.style.background = 'var(--c-primary)';
        btn.style.color = '#fff';
    },

    showMatchTypeInfo: function() {
        Toast.show("Competition matches affect your points and ranking; friendly matches do not.", "info", 6000);
    },

    showVenueRequest: function() {
        ConfirmModal.show({
            title: 'Add a New Venue',
            message: 'Enter the name and location of the venue you would like to add.',
            confirmText: 'Submit Request',
            showInput: true,
            inputPlaceholder: 'Venue Name, City',
            type: 'info'
        }).then(res => {
            // 'res' is the string input if confirmed, or false/null if cancelled
            if (res && typeof res === 'string' && res.trim()) {
                const venueName = res.trim();
                API.post('/match/request_venue', { venue_name: venueName }).then(response => {
                    Toast.show("Our team will review and add this venue shortly. Stay tuned!", "success", 6000);
                });
            }
        });
    },

    _selectPill: function(el, inputId) {
        const parent = el.parentElement;
        parent.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
        el.classList.add('active');
        document.getElementById(inputId).value = el.dataset.value;
    },

    scroll: function(id, direction) {
        const el = document.getElementById(id);
        if (el) {
            const scrollAmount = el.clientWidth * 0.6;
            el.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
        }
    },



    togglePartner: function() {
        MatchesController._partnerEnabled = !MatchesController._partnerEnabled;
        const row     = document.getElementById('cm-partner-toggle-row');
        const section = document.getElementById('cm-partner-section');
        if (MatchesController._partnerEnabled) {
            row.classList.add('toggle-on');
            if (section) section.style.display = 'block';
        } else {
            row.classList.remove('toggle-on');
            if (section) section.style.display = 'none';
        }
    },

    // ── List ──────────────────────────────────────────
    initList: async function(mode = 'play') {
        // Resolve sub-tab: check if we have a saved sub-tab for this mode
        const savedTab = sessionStorage.getItem('last_sub_tab_' + mode);
        let defaultSubTab = mode === 'play' ? 'play_upcoming' : 'mine_upcoming';
        
        MatchesController._currentTab = savedTab || defaultSubTab;
        MatchesController._lastMode = mode;

        await UI.syncNav();
        const skeleton = document.getElementById('ml-skeleton');
        const list     = document.getElementById('ml-list');
        const headerTitleEl = document.getElementById('ml-header-title');
        const headerSubEl   = document.getElementById('ml-header-sub');
        const tabsContainer = document.getElementById('ml-tabs-container');

        if (headerTitleEl) {
            if (mode === 'play') {
                headerTitleEl.textContent = 'PLAY';
                headerSubEl.textContent = 'Join matches nearby or with friends';
                if (tabsContainer) {
                    tabsContainer.innerHTML = `
                      <button id="ml-tab-play_upcoming" onclick="MatchesController.switchTab('play_upcoming')"
                        style="flex:1; background:none; border:none; color:${MatchesController._currentTab === 'play_upcoming' ? 'var(--c-text)' : 'var(--c-text-muted)'}; font-family:var(--font); font-size:15px; font-weight:700; padding:14px 0; border-bottom:2.5px solid ${MatchesController._currentTab === 'play_upcoming' ? 'var(--c-primary)' : 'transparent'}; cursor:pointer; transition:all 0.15s;">
                        ⏳ Upcoming
                      </button>
                      <button id="ml-tab-play_past" onclick="MatchesController.switchTab('play_past')"
                        style="flex:1; background:none; border:none; color:${MatchesController._currentTab === 'play_past' ? 'var(--c-text)' : 'var(--c-text-muted)'}; font-family:var(--font); font-size:15px; font-weight:700; padding:14px 0; border-bottom:2.5px solid ${MatchesController._currentTab === 'play_past' ? 'var(--c-primary)' : 'transparent'}; cursor:pointer; transition:all 0.15s;">
                        🏆 Completed
                      </button>
                    `;
                }
            } else {
                headerTitleEl.textContent = 'MY MATCHES';
                headerSubEl.textContent = 'View your upcoming matches and history';
                
                const isUpcoming = MatchesController._currentTab === 'mine_upcoming';
                const isPast     = MatchesController._currentTab === 'mine_past';
                const isCompleted = MatchesController._currentTab === 'mine_completed';
                
                tabsContainer.innerHTML = `
                  <button id="ml-tab-mine_upcoming" onclick="MatchesController.switchTab('mine_upcoming')" 
                    style="flex:1; background:none; border:none; color:${isUpcoming ? 'var(--c-text)' : 'var(--c-text-muted)'}; font-family:var(--font); font-size:14px; font-weight:700; padding:14px 0; border-bottom:2.5px solid ${isUpcoming ? 'var(--c-primary)' : 'transparent'}; cursor:pointer; transition:all 0.15s; white-space:nowrap;">
                    ⏳ Upcoming
                  </button>
                  <button id="ml-tab-mine_past" onclick="MatchesController.switchTab('mine_past')" 
                    style="flex:1; background:none; border:none; color:${isPast ? 'var(--c-text)' : 'var(--c-text-muted)'}; font-family:var(--font); font-size:14px; font-weight:700; padding:14px 0; border-bottom:2.5px solid ${isPast ? 'var(--c-primary)' : 'transparent'}; cursor:pointer; transition:all 0.15s; white-space:nowrap;">
                    🌘 Past
                  </button>
                  <button id="ml-tab-mine_completed" onclick="MatchesController.switchTab('mine_completed')" 
                    style="flex:1; background:none; border:none; color:${isCompleted ? 'var(--c-text)' : 'var(--c-text-muted)'}; font-family:var(--font); font-size:14px; font-weight:700; padding:14px 0; border-bottom:2.5px solid ${isCompleted ? 'var(--c-primary)' : 'transparent'}; cursor:pointer; transition:all 0.15s; white-space:nowrap;">
                    🏆 Completed
                  </button>
                `;
            }
        }
        
        await MatchesController.updatePlayFiltersUI();
        
        await MatchesController.loadList();
        if (typeof PollManager !== 'undefined') {
            PollManager.start('match_list', () => MatchesController.loadList(true), 10000);
        }
    },

    updatePlayFiltersUI: async function() {
        const filterEl = document.getElementById('ml-play-filters');
        if (!filterEl) return;
        
        const isUpcomingPlay = MatchesController._currentTab === 'play_upcoming';
        filterEl.style.display = isUpcomingPlay ? 'block' : 'none';

        if (isUpcomingPlay) {
            // Update gender button label based on user gender
            const res = await API.post('/profile/get', {});
            if (res && res.success) {
                const gender = res.data.profile?.gender || 'male';
                const label = gender === 'female' ? 'Females' : 'Males';
                const btn = document.getElementById('ml-gender-restricted-filter-btn');
                if (btn) btn.textContent = label;
            }
        }
    },

    setPlayFilter: function(type, val, btn) {
        if (type === 'match_type') MatchesController._playFilterType = val;
        if (type === 'gender_type') MatchesController._playFilterGender = val;

        // Update UI
        const btns = btn.parentElement.querySelectorAll('button');
        btns.forEach(b => {
            b.classList.remove('active');
            b.style.background = 'transparent';
            b.style.color = 'var(--c-text-muted)';
            b.style.boxShadow = 'none';
        });
        
        btn.classList.add('active');
        btn.style.background = 'var(--c-primary)';
        btn.style.color = '#fff';
        btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';

        MatchesController.loadList();
    },

    switchTab: async function(tab) {
        MatchesController._currentTab = tab;
        sessionStorage.setItem('last_sub_tab_' + MatchesController._lastMode, tab);
        
        await MatchesController.updatePlayFiltersUI();
        
        // Reset all tabs
        const tabsContainer = document.getElementById('ml-tabs-container');
        if (tabsContainer) {
            tabsContainer.querySelectorAll('button').forEach(btn => {
                btn.style.borderBottomColor = 'transparent';
                btn.style.color = 'var(--c-text-muted)';
            });
            const activeBtn = document.getElementById('ml-tab-' + tab);
            if (activeBtn) {
                activeBtn.style.borderBottomColor = 'var(--c-primary)';
                activeBtn.style.color = 'var(--c-text)';
            }
        }
        
        await MatchesController.loadList();
        if (typeof PollManager !== 'undefined') {
            PollManager.start('match_list', () => MatchesController.loadList(true), 10000);
        }
    },

    loadList: async function(isSilent = false) {
        const skeleton = document.getElementById('ml-skeleton');
        const list     = document.getElementById('ml-list');
        
        const cacheKey = `${MatchesController._currentTab}_${MatchesController._playFilterType}_${MatchesController._playFilterGender}`;
        const hasCache = MatchesController._cache[cacheKey];

        if (!isSilent && !hasCache && skeleton) skeleton.style.display = 'block';
        if (!isSilent && !hasCache && list)     list.style.display = 'none';

        // If we have cache, render it immediately while fetching
        if (!isSilent && hasCache) {
            MatchesController.renderList(hasCache);
            if (skeleton) skeleton.style.display = 'none';
            if (list)     list.style.display = 'block';
        }

        let endpoint = '/match/list';
        let payload  = { 
            mode: MatchesController._currentTab,
            match_type: MatchesController._playFilterType,
            gender_type: MatchesController._playFilterGender
        };

        // ONLY use /matches/user for 'Completed' tabs (mine_completed and play_past) to get scores
        // Revert 'mine_past' to original /match/list to show teams instead of scores
        if (MatchesController._currentTab === 'play_past') {
            endpoint = '/matches/recent';
            payload  = { limit: 50 };
        } else if (MatchesController._currentTab === 'mine_completed') {
            endpoint = '/matches/user';
            payload  = {};
        }

        let res = await API.post(endpoint, payload);
        
        // Phase 6: Silent retry on first failure
        if ((!res || !res.success) && !isSilent) {
            console.warn("Matches list failed, retrying once...");
            await new Promise(r => setTimeout(r, 1000));
            res = await API.post(endpoint, payload);
        }

        if (!isSilent && skeleton) skeleton.style.display = 'none';
        if (!isSilent && list)     list.style.display = 'block';

        if (!res || !res.success) {
            if (!isSilent && !hasCache) {
                list.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Could not load matches</h3><p>${res ? res.message : 'Network error'}</p></div>`;
            }
            return;
        }

        // Compare with cache to prevent unnecessary re-renders
        const responseJson = JSON.stringify(res.data.matches);
        if (isSilent && MatchesController._cache[cacheKey + '_json'] === responseJson) {
            return;
        }

        MatchesController._cache[cacheKey] = res.data.matches;
        MatchesController._cache[cacheKey + '_json'] = responseJson;

        if (!isSilent && skeleton) skeleton.style.display = 'none';
        if (!isSilent && list)     list.style.display = 'block';

        MatchesController.renderList(res.data.matches);
    },

    renderList: function(matches) {
        const list = document.getElementById('ml-list');
        if (!list) return;

        let endpoint = MatchesController._currentTab === 'play_past' ? '/matches/user' : '/match/list';


        // If we used /matches/user, filter for completed only
        if (endpoint === '/matches/user') {
            matches = matches.filter(m => m.status === 'completed');
        }
        
        // Empty state handling
        if (matches.length === 0) {
            let msg = 'Nothing found';
            let sub = 'Check back later for new matches.';
            let icon = '🔍';
            
            if (MatchesController._currentTab === 'play_upcoming') {
                msg  = 'No games yet';
                sub  = 'Be the first to create one!';
                icon = '🎾';
            } else if (MatchesController._currentTab === 'mine_upcoming') {
                msg  = 'Your schedule is clear';
                sub  = 'Join a match to get playing.';
                icon = '📅';
            } else if (MatchesController._currentTab.includes('past') || MatchesController._currentTab.includes('completed')) {
                msg  = 'No history yet';
                sub  = 'Finished matches will appear here.';
                icon = '🌘';
            }

            list.innerHTML = `
                <div class="empty-state" style="padding:40px 20px; text-align:center; background:rgba(255,255,255,0.02); border-radius:var(--r-lg); border:1px dashed var(--c-border);">
                    <div style="font-size:42px; margin-bottom:12px; opacity:0.4;">${icon}</div>
                    <h3 style="font-size:16px; font-weight:700; margin-bottom:4px; color:var(--c-text);">${msg}</h3>
                    <p style="color:var(--c-text-muted); font-size:13px; max-width:220px; margin:0 auto; line-height:1.4;">${sub}</p>
                    ${MatchesController._currentTab === 'play_upcoming' ? `
                        <button onclick="Router.navigate('/matches/create')" class="btn btn-primary" style="margin-top:16px; width:auto; padding:10px 20px; font-size:13px; height:auto;">🎾 Create Match</button>
                    ` : ''}
                </div>`;
            return;
        }

        // Inject Filter Bar if in mine_upcoming
        if (MatchesController._currentTab === 'mine_upcoming') {
            const counts = {
                all:     matches.length,
                joined:  matches.filter(m => m.user_in_match).length,
                waiting: matches.filter(m => m.user_is_waiting).length,
                on_hold: matches.filter(m => m.user_is_invited || (m.status === 'on_hold' && m.user_is_requester)).length
            };

            // Count how many specific categories have matches
            const activeCats = ['joined', 'waiting', 'on_hold'].filter(k => counts[k] > 0);

            let filterBar = '';
            if (activeCats.length >= 2) {
                filterBar = `
                <div class="status-filter-bar">
                    <button onclick="MatchesController.setFilter('all')" class="status-filter-btn ${MatchesController._currentFilter === 'all' ? 'active' : ''}">All matches (${counts.all})</button>
                    ${counts.joined > 0 ? `<button onclick="MatchesController.setFilter('joined')" class="status-filter-btn ${MatchesController._currentFilter === 'joined' ? 'active' : ''}">Joined (${counts.joined})</button>` : ''}
                    ${counts.waiting > 0 ? `<button onclick="MatchesController.setFilter('waiting')" class="status-filter-btn ${MatchesController._currentFilter === 'waiting' ? 'active' : ''}">Waiting (${counts.waiting})</button>` : ''}
                    ${counts.on_hold > 0 ? `<button onclick="MatchesController.setFilter('on_hold')" class="status-filter-btn ${MatchesController._currentFilter === 'on_hold' ? 'active' : ''}">On hold (${counts.on_hold})</button>` : ''}
                </div>`;
            } else {
                // Only 0 or 1 category, so reset filter to all and hide bar
                MatchesController._currentFilter = 'all';
            }

            list.innerHTML = filterBar + '<div id="ml-filtered-results"></div>';

            
            // Filter logic
            if (MatchesController._currentFilter !== 'all') {
                matches = matches.filter(m => {
                    if (MatchesController._currentFilter === 'joined') return m.user_in_match;
                    if (MatchesController._currentFilter === 'waiting') return m.user_is_waiting;
                    if (MatchesController._currentFilter === 'on_hold') {
                        return m.user_is_invited || (m.status === 'on_hold' && m.user_is_requester);
                    }
                    return true;
                });
            }
            
            const resultsContainer = document.getElementById('ml-filtered-results');
            if (matches.length === 0) {
                resultsContainer.innerHTML = `<div class="empty-state" style="padding:40px 20px;"><div class="empty-icon">🔍</div><h3>No matches in this category</h3><p>Try a different filter or browse all.</p></div>`;
            } else {
                let html = '';
                matches.forEach(m => {
                    const isCompletedTab = MatchesController._currentTab === 'mine_completed' || MatchesController._currentTab === 'play_past';
                    if (m.status === 'completed' && m.scores && m.scores.length > 0 && isCompletedTab) {
                        m.scores.forEach(s => { html += MatchesController.renderMatchCard(m, s); });
                    } else {
                        html += MatchesController.renderMatchCard(m);
                    }
                });
                resultsContainer.innerHTML = html;
            }
        } else {
            let html = '';
            matches.forEach(m => {
                const isCompletedTab = MatchesController._currentTab === 'mine_completed' || MatchesController._currentTab === 'play_past';
                if (m.status === 'completed' && m.scores && m.scores.length > 0 && isCompletedTab) {
                    m.scores.forEach(s => { html += MatchesController.renderMatchCard(m, s); });
                } else {
                    html += MatchesController.renderMatchCard(m);
                }
            });
            list.innerHTML = html;
        }
    },

    setFilter: function(filter) {
        MatchesController._currentFilter = filter;
        MatchesController.loadList(true); // Silent refresh
    },

    renderMiniSlot: function(m, team, slot) {
        const s = (m.slots || []).find(x => parseInt(x.team_no) === team && parseInt(x.slot_no) === slot);
        if (s) {
            const initials = ((s.first_name?.[0] || '') + (s.last_name?.[0] || '')).toUpperCase() || '?';
            const profileUrl = `/p/${s.player_code}`;
            const rawName  = s.nickname || s.first_name;
            const displayName = rawName.length > 10 ? rawName.substring(0, 8) + '..' : rawName;
            return `
            <div class="player-mini-slot">
              <div class="player-avatar-mini">
                ${s.profile_image ? `<img src="${CONFIG.ASSET_BASE}/${s.profile_image}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : initials}
              </div>
              <div class="player-name-mini" title="${rawName}">
                   ${displayName}
                   ${s.playing_side ? `<span class="side-indicator-mini ${s.playing_side}">${s.playing_side[0].toUpperCase()}</span>` : ''}
              </div>
            </div>`;
        }
        return `
        <div class="player-mini-slot">
          <div class="empty-avatar-mini">+</div>
          <div class="empty-name-mini">Open</div>
        </div>`;
    },

    renderMatchCard: function(m, specificScore = null) {
        // Use specificScore if provided, otherwise fallback to finding one
        const approvedScore = specificScore || (m.scores || []).find(s => s.status === 'approved') || (m.scores && m.scores.length > 0 ? m.scores[0] : null);
        
        const dateVal = m.match_datetime || m.scheduled_at;
        const dt      = new Date(dateVal ? dateVal.replace(' ', 'T') : null);
        const dateStr = dt.toLocaleDateString('en-EG', { weekday: 'short', month: 'short', day: 'numeric' });
        const timeStr = dt.toLocaleTimeString('en-EG', { hour: '2-digit', minute: '2-digit' });

        const isPast = dt < new Date();
        const statusColor = {
            open:      isPast ? 'var(--c-text-muted)' : 'var(--c-green)',
            on_hold:   'var(--c-gold)',
            full:      'var(--c-orange)',
            completed: 'var(--c-text-muted)',
            cancelled: 'var(--c-red)',
        };

        let label = m.status.charAt(0).toUpperCase() + m.status.slice(1);
        if (m.status === 'on_hold') label = 'Pending Partner';
        if (m.status === 'open' && isPast) label = 'Incomplete';
        const statusLabel = label;

        let myBadge = '';
        if (m.user_in_match) {
            myBadge = `<span class="badge-user-in">You're in</span>`;
        } else if (m.user_is_requester) {
            myBadge = `<span class="badge-pending">Pending</span>`;
        } else if (m.user_is_invited) {
            myBadge = `<span class="badge-waiting">Invited</span>`;
        } else if (m.user_is_waiting) {
            myBadge = `<span class="badge-in-queue">In Queue</span>`;
        }
        
        const matchCode = m.match_code || `M-${m.id.toString().padStart(4, '0')}`;
        const venueVal = m.venue_name || m.venue || 'Venue TBD';
        const venueParts = venueVal.split('-');
        const mainTitle = venueParts[0].trim();
        const subTitle  = venueParts.length > 1 ? venueParts.slice(1).join('-').trim() : '';
        
        let typeBadges = '';
        if (m.match_type === 'competition') {
            typeBadges += `<span style="display:inline-block; font-size:10px; font-weight:700; background:rgba(255,165,0,0.1); color:var(--c-orange); padding:2px 6px; border-radius:4px; margin-right:4px;">🏆 Competition</span>`;
        }
        if (m.gender_type === 'same_gender') {
            const genderStr = (m.creator_gender || 'male') === 'female' ? 'Women Only' : 'Men Only';
            const genderIcon = (m.creator_gender || 'male') === 'female' ? '👩' : '👨';
            typeBadges += `<span style="display:inline-block; font-size:10px; font-weight:700; background:rgba(27,82,206,0.1); color:var(--c-primary); padding:2px 6px; border-radius:4px; margin-right:4px;">${genderIcon} ${genderStr}</span>`;
        }

        const isCompletedTab = MatchesController._currentTab === 'mine_completed' || MatchesController._currentTab === 'play_past';

        // If completed and has ANY score, use the EXACT Dashboard template (ONLY for Completed tabs)
        if (m.status === 'completed' && approvedScore && isCompletedTab) {
            const allPlayers = [...(m.team_a || []), ...(m.team_b || [])];
            const scoreHtml = ScoreUI.renderMatchScore(m, approvedScore, allPlayers, false);
            
            const now = new Date();
            const diffDays = Math.floor((now - dt) / (1000 * 60 * 60 * 24));
            
            let dayStr;
            if (dt.toDateString() === now.toDateString()) {
                dayStr = 'Today';
            } else if (diffDays < 7) {
                dayStr = dt.toLocaleDateString('en-US', { weekday: 'long' });
            } else {
                dayStr = dt.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
            }
            
            const dashHeader = `
                <div style="font-size:10px; font-weight:800; color:var(--c-text-muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:10px; padding:0 20px; display:flex; justify-content:space-between;">
                    <span>${mainTitle} &nbsp;·&nbsp; ${dayStr}</span>
                    <div style="text-transform:none;">${typeBadges}</div>
                </div>
            `;
            
            return `
                <div onclick="Router.navigate('/matches/${m.match_code}')" class="dash-match-card" style="cursor:pointer; background:var(--c-bg-card); border:1px solid var(--c-border); border-radius:var(--r-lg); padding:14px 0; margin-bottom:12px; transition:var(--t-fast);">
                    ${dashHeader}
                    ${scoreHtml}
                    <div style="padding: 0 20px; margin-top: 10px;">${myBadge}</div>
                </div>
            `;
        }

        const isNotEligible = m.player_eligible === false && MatchesController._currentTab === 'play_upcoming';
        const dimEffect = isNotEligible ? 'opacity: 0.2; filter: grayscale(1); pointer-events:none;' : '';
        
        let notEligibleTag = '';
        if (isNotEligible) {
            notEligibleTag = `<div style="margin-bottom:12px;"><span style="display:inline-block; font-size:10px; font-weight:800; background:var(--c-red); color:#fff; box-shadow: 0 4px 10px rgba(255,0,0,0.2); padding:4px 10px; border-radius:6px; text-transform:uppercase; letter-spacing:0.5px;">🚫 Not Eligible to Join</span></div>`;
        }

        // Default template for upcoming/incomplete/etc.
        return `
        <div class="match-card-modern" onclick="${isNotEligible ? '' : `Router.navigate('/matches/${matchCode}')`}" id="mc-${m.id}" style="${isNotEligible ? 'cursor:default;' : 'cursor:pointer;'}">
          ${notEligibleTag}
          <div style="${dimEffect}">
            <div class="match-title-row">
              <div style="min-width:0; flex:1;">
                 <div>
                    <h3 class="match-venue-name" style="padding-right: 80px;">
                      ${mainTitle} ${subTitle ? `<span style="margin: 0 4px; opacity: 0.3; font-weight: 300;">|</span><span class="match-venue-sub" style="font-size: 13px; font-weight: 600; color: var(--c-text-muted); opacity: 0.8;">${subTitle}</span>` : ''}
                    </h3>
                    <div class="badge-user-in-wrapper">${myBadge}</div>
                 </div>
                 <div class="match-meta-row">
                    ${m.court_name ? `<span class="court-label-white">Court: ${m.court_name}</span>` : ''}
                    <span>🗓 ${dateStr}</span>
                    <span>⏰ ${timeStr}</span>
                 </div>
                 ${typeBadges ? `<div style="margin-top:8px;">${typeBadges}</div>` : ''}
              </div>
              <div style="text-align:right; flex-shrink:0;">
                 <div class="status-badge-pill status-${(m.status === 'open' && isPast) ? 'incomplete' : m.status}">${statusLabel}</div>
                 <div style="font-size:10px; color:var(--c-text-dim); margin-top:6px; font-weight:600;">By ${m.creator_nickname || m.creator_name}</div>
              </div>
            </div>
          </div>

          <div style="background:rgba(255,255,255,0.02); border-radius:12px; padding:16px; display:grid; grid-template-columns: 1fr auto 1fr; align-items:center; gap:12px; margin-top:20px; border:1px solid rgba(255,255,255,0.03);">
             <div>
                <div style="font-size:10px; font-weight:800; color:var(--c-orange); text-transform:uppercase; letter-spacing:1px; margin-bottom:12px; opacity:0.8;">Team 1</div>
                ${MatchesController.renderMiniSlot(m, 1, 1)}
                ${MatchesController.renderMiniSlot(m, 1, 2)}
             </div>
             <div style="width:1px; height:40px; background:rgba(255,255,255,0.05);"></div>
             <div>
                <div style="font-size:10px; font-weight:800; color:#fff; text-transform:uppercase; letter-spacing:1px; margin-bottom:12px; opacity:0.8;">Team 2</div>
                ${MatchesController.renderMiniSlot(m, 2, 1)}
                ${MatchesController.renderMiniSlot(m, 2, 2)}
             </div>
          </div>
        </div>`;
    },

    // ── View (detail) ──────────────────────────────────
    initView: async function(params, autoOpenChat = false) {
        await UI.syncNav();
        let match_id   = parseInt(params?.id || 0);
        const match_code = params?.matchCode || '';

        if (!match_id && !match_code) { Router.navigate('/matches'); return; }
        
        const result = await MatchesController.loadDetails({ match_id, match_code });
        if (result && result.id) match_id = result.id;

        // Fallback: use the match_id that loadDetails stored in state
        if (!match_id && MatchesController._currentMatchId) {
            match_id = parseInt(MatchesController._currentMatchId);
        }

        if (autoOpenChat && match_id) {
            console.log('[Chat Permalink] Scheduling auto-open for match_id:', match_id);
            setTimeout(() => {
                console.log('[Chat Permalink] Opening chat now for match_id:', match_id);
                if (typeof ChatController !== 'undefined') {
                    ChatController.open(match_id);
                }
            }, 300);
        } else if (autoOpenChat) {
            console.warn('[Chat Permalink] autoOpenChat=true but match_id is still 0, cannot open chat');
        }



        if (typeof PollManager !== 'undefined') {
            PollManager.start('match_details', () => MatchesController.loadDetails({ match_id, match_code }, true), 5000);
        }
    },

    loadDetails: async function(query, isSilent = false) {


        const skeleton = document.getElementById('mv-skeleton');
        const content  = document.getElementById('mv-content');
        if (!isSilent && skeleton) skeleton.style.display = 'block';
        if (!isSilent && content)  content.style.display  = 'none';

        const res = await API.post('/match/details', query);
        if (!isSilent && skeleton) skeleton.style.display = 'none';

        if (!res || !res.success || !res.data) {
            Toast.show(res ? res.message : 'Could not load match', 'error');
            if (!isSilent) Router.navigate('/matches');
            return;
        }

        const { match, slots, waiting_list, user_in_match, pending_for_me, my_pending_request, my_waitlist_entry, is_creator, scores, disputes, viewer_id } = res.data;
        const myUserId = viewer_id || (user_in_match ? parseInt(user_in_match.user_id) : 0);
        
        if (!match || !slots) {
            Toast.show('Incomplete match data', 'error');
            if (!isSilent) Router.navigate('/matches');
            return;
        }

        // State comparison to prevent blinking/flicker during polling
        const currentStateKey = JSON.stringify({
            match: res.data.match,
            slots: res.data.slots,
            waiting_list: res.data.waiting_list,
            user_in_match: res.data.user_in_match,
            pending_for_me: res.data.pending_for_me,
            my_pending_request: res.data.my_pending_request,
            my_waitlist_entry: res.data.my_waitlist_entry,
            late_withdrawal: res.data.late_withdrawal,
            unread_count: res.data.unread_count,
            scores: res.data.scores,
            disputes: res.data.disputes
        });

        const isSameMatch = MatchesController._lastMatchId === parseInt(match.id);
        const isSameState = MatchesController._lastMatchState === currentStateKey;

        if (isSilent && isSameMatch && isSameState) {
            return; // No changes in DB, skip re-render
        }

        MatchesController._lastMatchId    = parseInt(match.id);
        MatchesController._lastMatchState = currentStateKey;



        MatchesController._currentMatchId = match.id;
        MatchesController._currentMatchSlotsCount = slots.length;
        MatchesController._currentMatchSlots = slots;
        MatchesController._currentMatchWaitlist = waiting_list;
        MatchesController._currentUserSide = res.data.user_playing_side;

        
        // Collect all IDs currently in the match or waiting list
        const playerIds = new Set();
        slots.forEach(s => playerIds.add(parseInt(s.user_id)));
        (waiting_list || []).forEach(w => {
            if (['pending', 'approved'].includes(w.request_status)) {
                playerIds.add(parseInt(w.requester_id));
                if (w.partner_id) playerIds.add(parseInt(w.partner_id));
            }
        });
        MatchesController._currentMatchPlayerIds = playerIds;

        let isPast = false;
        let isAuthorized = false;

        const dt      = new Date(match.match_datetime);
        const dateStr = dt.toLocaleDateString('en-EG', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        const timeStr = dt.toLocaleTimeString('en-EG', { hour: '2-digit', minute: '2-digit' });

        // Hide withdrawal warning for past matches
        const withdrawalWarning = document.querySelector('.mv-withdrawal-warning');
        if (withdrawalWarning) {
            const isMatchPast = dt < new Date() || match.status === 'completed' || match.status === 'cancelled';
            withdrawalWarning.style.display = isMatchPast ? 'none' : 'flex';
        }

        const statusBadgeContainer = document.getElementById('mv-status-badge');
        
        const titleEl = document.getElementById('mv-title');
        if (titleEl) {
            const isPast = dt < new Date();
            let label = match.status.charAt(0).toUpperCase() + match.status.slice(1);
            if (match.status === 'on_hold') label = 'Pending Partner';
            if (match.status === 'open' && isPast) label = 'Incomplete';
            const statusLabel = label;
            const statusClass = (match.status === 'open' && isPast) ? 'incomplete' : match.status;

            const matchCode = match.match_code || `M-${match.id.toString().padStart(4, '0')}`;
            
            const venueParts = match.venue_name.split('-');
            const mainTitle = venueParts[0].trim();
            const subTitle  = venueParts.length > 1 ? venueParts.slice(1).join('-').trim() : '';

            let typeBadges = '';
            if (match.match_type === 'competition' || match.gender_type === 'same_gender') {
                typeBadges = `<div style="display:flex; align-items:center; gap:8px;">`;
                if (match.match_type === 'competition') {
                    typeBadges += `<span class="status-badge-pill" style="background:rgba(255,165,0,0.1); color:var(--c-orange);">🏆 Competition</span>`;
                }
                if (match.gender_type === 'same_gender') {
                    const genderStr = (match.creator_gender || 'male') === 'female' ? 'Women Only' : 'Men Only';
                    const genderIcon = (match.creator_gender || 'male') === 'female' ? '👩' : '👨';
                    typeBadges += `<span class="status-badge-pill" style="background:rgba(27,82,206,0.1); color:var(--c-primary);">${genderIcon} ${genderStr}</span>`;
                }
                typeBadges += `</div>`;
            }

            titleEl.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:20px; flex-wrap:wrap;">
                    <span class="match-code-badge">${matchCode}</span>
                    <span class="status-badge-pill status-${statusClass}">${statusLabel}</span>
                    ${typeBadges}
                </div>
                <div id="mv-venue-name" style="font-size: 28px; font-weight: 800; line-height: 1.2;">
                    ${mainTitle} ${subTitle ? `<span style="margin: 0 8px; opacity: 0.2; font-weight: 300;">|</span><span style="font-size: 18px; font-weight: 600; color: var(--c-text-muted); opacity: 0.7;">${subTitle}</span>` : ''}
                </div>
            `;
        }

        const metaEl = document.getElementById('mv-meta');
        if (metaEl) {
            metaEl.className = 'match-meta-row';
            metaEl.style.flexDirection = 'column';
            metaEl.style.alignItems = 'flex-start';
            metaEl.style.gap = '8px';
            
            metaEl.innerHTML = `
                <div style="display:flex; align-items:center; flex-wrap:wrap; gap:16px;">
                    ${match.court_name ? `<div class="court-label-white" style="display:flex; align-items:center; gap:6px;"><span style="opacity:0.6;">🎾</span> Court: ${match.court_name}</div>` : ''}
                    <div style="display:flex; align-items:center; gap:6px;"><span>🗓</span> ${dateStr}</div>
                    <div style="display:flex; align-items:center; gap:6px;"><span>⏰</span> ${timeStr}</div>
                </div>
                <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; font-size:12px; margin-top:4px; width:100%;">
                    <div style="display:flex; align-items:center; gap:6px; opacity:0.8;">
                        <span>👤</span> Created by <span style="color:var(--c-primary); font-weight:700; margin-left:2px;">${match.creator_nickname || match.creator_name}</span>
                        ${match.creator_code ? `<span style="font-size:10px; background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px; color:var(--c-text-muted); text-transform:uppercase; font-family:monospace; margin-left:4px;">${match.creator_code}</span>` : ''}
                    </div>
                    <button onclick="ScoringController.reportIssue(${match.id})" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:var(--c-text-muted); padding:6px 14px; border-radius:10px; font-size:11px; cursor:pointer; font-weight:700; display:flex; align-items:center; gap:6px; transition:all 0.2s;">
                        <span>🚩</span> Report a problem
                    </button>
                </div>
            `;
        }

        if (statusBadgeContainer) statusBadgeContainer.innerHTML = ''; // Moved into title area

        // Calculate team sums (as per user request)
        const getTeamSum = (teamNo) => {
            const teamSlots = slots.filter(s => parseInt(s.team_no) === teamNo && s.status === 'confirmed');
            if (teamSlots.length === 0) return null;
            return teamSlots.reduce((acc, s) => acc + (parseInt(s.points) || 50), 0);
        };

        const team1Sum = getTeamSum(1);
        const team2Sum = getTeamSum(2);

        const t1p = document.getElementById('mv-team1-points');
        if (t1p) t1p.innerHTML = (team1Sum !== null) ? `${team1Sum} pts total` : 'EMPTY';
        const t2p = document.getElementById('mv-team2-points');
        if (t2p) t2p.innerHTML = (team2Sum !== null) ? `${team2Sum} pts total` : 'EMPTY';

        // Render slot elements
        [[1,1],[1,2],[2,1],[2,2]].forEach(([team, slot]) => {
            const s   = slots.find(x => parseInt(x.team_no) === team && parseInt(x.slot_no) === slot);
            const el  = document.getElementById(`mv-team${team}-slot${slot}`);
            if (!el) return;
            if (s) {
                const initials = ((s.first_name?.[0] || '') + (s.last_name?.[0] || '')).toUpperCase() || (s.nickname?.[0] || '?').toUpperCase();
                const isMe     = parseInt(s.user_id) === myUserId && myUserId > 0;
                const profileUrl = `/p/${s.player_code}`;
                el.className   = 'mv-slot' + (isMe ? ' slot-mine' : '');
                if (!isMe) {
                    el.style.cursor = 'pointer';
                    el.onclick     = () => Router.navigate(profileUrl);
                } else {
                    el.style.cursor = 'default';
                    el.onclick = null;
                }
                const rawName  = s.nickname || s.first_name;
                const displayName = (rawName.length > 18) ? rawName.substring(0, 16) + '..' : rawName;

                el.innerHTML   = `
                    <div class="slot-avatar">
                        ${s.profile_image ? `<img src="${CONFIG.ASSET_BASE}/${s.profile_image}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : initials}
                    </div>
                    <div class="slot-info">
                        <div class="slot-row-top">
                            <div class="slot-name" title="${rawName}">${displayName}</div>
                            <div class="slot-side-wrapper" style="display:flex; align-items:center; gap:6px;">
                                ${isMe ? '<span style="font-size:14px;">🫵</span>' : ''}
                                ${s.playing_side ? `<span class="side-indicator-mini ${s.playing_side}">${s.playing_side[0].toUpperCase()}</span>` : ''}
                            </div>
                        </div>
                        <div class="slot-row-bottom">
                            ${s.player_code ? `<span class="slot-code">${s.player_code}</span>` : '<span></span>'}
                            <span class="slot-points">${s.points || 50} pts</span>
                        </div>
                    </div>`;
            } else {
                el.className = 'mv-slot slot-empty';
                el.style.cursor = 'default';
                el.innerHTML = 'Open';
                el.onclick = null;
            }
        });

        // Action area
        const actionArea = document.getElementById('mv-action-area');
        const chatArea   = document.getElementById('mv-chat-area');
        if (chatArea) chatArea.innerHTML = '';
        if (actionArea) {
                // Unified Policy Violation Area
                const lateWithdrawal = res.data.late_withdrawal;
                const policyArea     = document.getElementById('mv-policy-area');
                if (policyArea) {
                    let combinedHtml = '';
                    
                    // Case 1: Late Withdrawal
                    if (lateWithdrawal) {
                        const lwUser     = lateWithdrawal.nickname || `${lateWithdrawal.first_name} ${lateWithdrawal.last_name}`;
                        const lwCode     = lateWithdrawal.player_code || '';
                        const lwReason   = lateWithdrawal.event_data?.reason || '';
                        const profileUrl = `/p/${lwCode}`;
                        const codeTag = lwCode ? `<a href="${profileUrl}" onclick="Router.navigate('${profileUrl}'); return false;" style="display:inline-block; margin-left:4px; padding:2px 8px; background:rgba(247,148,29,0.08); border:1px solid rgba(247,148,29,0.15); border-radius:6px; font-size:10px; font-weight:900; font-family:monospace; color:var(--c-orange); text-transform:uppercase; letter-spacing:0.5px; vertical-align:middle; cursor:pointer; text-decoration:none;">${lwCode}</a>` : '';
                        const clickableUser = lwCode ? `<a href="${profileUrl}" onclick="Router.navigate('${profileUrl}'); return false;" style="color:inherit; text-decoration:none; font-weight:700;">${lwUser}</a>` : `<strong>${lwUser}</strong>`;

                        combinedHtml += `
                            <div style="background:rgba(255,59,48,0.04); border:1px solid rgba(255,59,48,0.1); border-radius:18px; padding:16px; margin-bottom:16px;">
                                <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                                    <div style="font-size:16px;">⚠️</div>
                                    <div style="font-size:11px; font-weight:800; color:var(--c-red); text-transform:uppercase; letter-spacing:1px; opacity:0.8;">Policy Violation (Late Withdrawal)</div>
                                </div>
                                <div style="font-size:14px; line-height:1.4; color:var(--c-text);">
                                    ${clickableUser}${codeTag} left the match within the 6-hour policy.
                                    ${lwReason ? `<div style="margin-top:8px; padding-left:12px; border-left:2px solid rgba(255,59,48,0.2); font-style:italic; color:var(--c-text-muted); font-size:13px;">"${lwReason}"</div>` : ''}
                                </div>
                                <div style="margin-top:12px; padding-top:10px; border-top:1px solid rgba(255,59,48,0.08); font-size:13px; color:var(--c-red); opacity:0.8; font-weight:600;">Admins will investigate, player may face a ban.</div>
                            </div>`;
                    }

                    // Case 2: Late Cancellation
                    if (match.status === 'cancelled' && match.is_policy_violation) {
                        combinedHtml += `
                            <div style="background:rgba(255,59,48,0.04); border:1px solid rgba(255,59,48,0.1); border-radius:18px; padding:16px; margin-bottom:16px;">
                                <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                                    <div style="font-size:16px;">🚫</div>
                                    <div style="font-size:11px; font-weight:800; color:var(--c-red); text-transform:uppercase; letter-spacing:1px; opacity:0.8;">Policy Violation (Late Cancellation)</div>
                                </div>
                                <div style="font-size:14px; line-height:1.4; color:var(--c-text);">
                                    This match was cancelled within the 6-hour policy by the creator.
                                </div>
                                <div style="margin-top:12px; padding-top:10px; border-top:1px solid rgba(255,59,48,0.08); font-size:13px; color:var(--c-red); opacity:0.8; font-weight:600;">Admins will investigate, player may face a ban.</div>
                            </div>`;
                    }

                    if (policyArea.innerHTML !== combinedHtml) {
                        policyArea.innerHTML = combinedHtml;
                    }
                }


                if (match.status === 'cancelled') {
                    actionArea.innerHTML = `
                        <div style="background:rgba(255,59,48,0.05); border-left:4px solid var(--c-red); border-radius:16px; padding:16px 20px; display:flex; gap:16px; align-items:flex-start;">
                            <div style="font-size:24px; margin-top:2px;">🚫</div>
                            <div style="flex:1; text-align:left;">
                                <h3 style="font-size:15px; font-weight:800; color:var(--c-red); margin:0 0 4px 0;">Match Cancelled</h3>
                                <p style="font-size:13px; color:var(--c-text); margin:0; line-height:1.4; opacity:0.9;">
                                    ${match.cancellation_reason ? `Reason: <strong>${match.cancellation_reason}</strong>` : 'No specific reason was provided for this cancellation.'}
                                </p>
                        </div>`;
                    if (content) content.style.display = 'block';
                    if (skeleton) skeleton.style.display = 'none';
                    return;
                } else {
                    const confirmedCount = slots.filter(s => s.status === 'confirmed').length;
                    const isFull = match.status === 'full' || confirmedCount >= 4;

                    // Time tracking
                    const matchTimeDate = new Date(match.match_datetime.replace(' ', 'T'));
                    const now = new Date();
                    const diffHrs = (matchTimeDate - now) / (1000 * 60 * 60);
                const isPastMatch = diffHrs <= 0;
                const isLiveMatch = !isPastMatch && match.status !== 'completed';

                // Reset action area visibility and clear form during poll
                MatchesController.hideInvitePartner();

                // ── Phase 7: Post-Match Scoring UI ────────────────────────
                // Only allow scoring if the match reached 'full' or 'completed' status.
                // 'Incomplete' matches (past and still open) cannot be scored.
                const canScore = match.status === 'full' || match.status === 'completed';
                if (isPastMatch && match.status !== 'cancelled' && canScore) {
                    let scoringHtml = '';
                    
                    if ((scores || []).length > 0) {
                        (scores || []).forEach((s, idx) => {
                            if (idx > 0) {
                                scoringHtml += `<div style="height:1px; background:rgba(255,255,255,0.08); margin:40px 16px;"></div>`;
                            }
                            if (s.status === 'approved') {
                                scoringHtml += `
                                    <div class="approved-score-wrapper" style="margin-bottom:24px;">
                                        ${(scores || []).length > 1 ? `<div style="font-size:10px; color:var(--c-text-muted); font-weight:900; text-transform:uppercase; letter-spacing:1.5px; margin-bottom:12px; padding:0 20px; opacity:0.6;">Match Result #${idx + 1}</div>` : ''}
                                        ${ScoreUI.renderMatchScore(match, s, slots, false)}
                                    </div>
                                `;
                            } else if (s.status === 'pending') {
                                const isSubmitter = parseInt(s.submitted_by_user_id) === myUserId;
                                const submitterName = s.nickname || s.first_name;
                                
                                // Determine teams based on composition switch if available
                                let currentTeamNo = user_in_match ? parseInt(user_in_match.team_no) : null;
                                let subTeamNo = null;
                                
                                if (s.composition_json) {
                                    try {
                                        const comp = JSON.parse(s.composition_json);
                                        const myEntry = comp.find(cx => parseInt(cx.user_id) === myUserId);
                                        const subEntry = comp.find(cx => parseInt(cx.user_id) === parseInt(s.submitted_by_user_id));
                                        if (myEntry) currentTeamNo = parseInt(myEntry.team_no);
                                        if (subEntry) subTeamNo = parseInt(subEntry.team_no);
                                    } catch(e) {}
                                }
                                
                                if (!subTeamNo) {
                                    const submitterSlot = slots.find(sx => parseInt(sx.user_id) === parseInt(s.submitted_by_user_id));
                                    if (submitterSlot) subTeamNo = parseInt(submitterSlot.team_no);
                                }
                                
                                const amOpponent = user_in_match && currentTeamNo && subTeamNo && currentTeamNo !== subTeamNo;

                                scoringHtml += `
                                    <div class="pending-score-container" style="position:relative; margin-bottom:32px;">
                                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding:0 20px;">
                                            <div style="font-size:10px; color:var(--c-text-muted); font-weight:900; text-transform:uppercase; letter-spacing:1.5px; opacity:0.7;">
                                                ${(scores || []).length > 1 ? `Match #${idx + 1} ` : ''}Result Submitted
                                            </div>
                                            <div class="status-tag pending" style="background:rgba(247,148,29,0.1); color:var(--c-orange); padding:4px 12px; border-radius:20px; font-size:10px; font-weight:800; text-transform:uppercase;">Pending Approval</div>
                                        </div>
                                        ${ScoreUI.renderMatchScore(match, s, slots, false)}
                                        
                                        <div style="display:flex; justify-content:center; align-items:center; gap:12px; margin-top:20px;">
                                            <p style="font-size:12px; color:var(--c-text-muted); margin:0;">Submitted by ${isSubmitter ? 'you' : submitterName}</p>
                                            ${!isSubmitter ? `
                                                <span style="width:4px; height:4px; background:var(--c-text-muted); border-radius:50%; opacity:0.3;"></span>
                                                <p style="font-size:11px; color:var(--c-orange); margin:0; font-weight:700;">
                                                    ${amOpponent ? 'Please verify the result' : 'Waiting for opponents to verify...'}
                                                </p>
                                            ` : `
                                                <span style="width:4px; height:4px; background:var(--c-text-muted); border-radius:50%; opacity:0.3;"></span>
                                                <p style="font-size:11px; color:var(--c-orange); margin:0; font-weight:700;">Waiting for opponents to verify...</p>
                                            `}
                                        </div>
                                        
                                        ${amOpponent ? `
                                            <div class="approval-actions" style="margin-top:24px; display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                                                <button class="btn btn-success" onclick="ScoringController.approveScore(${s.id})" style="height:44px; font-weight:700;">Approve Result</button>
                                                <button class="btn btn-secondary" onclick="ScoringController.disputeScore(${s.id})" style="height:44px; font-weight:700;">Dispute Result</button>
                                            </div>
                                        ` : ''}
                                    </div>
                                `;
                            } else if (s.status === 'disputed') {
                                scoringHtml += `
                                    <div class="results-banner" style="border-color:var(--c-red); margin-bottom:24px;">
                                        <div class="results-header">
                                            <div class="results-title">Match Disputed</div>
                                            <div class="status-tag disputed">Under Review</div>
                                        </div>
                                        <p style="font-size:13px; color:var(--c-text); text-align:center; margin:10px 0;">This match result has been disputed. Admins are reviewing the logs.</p>
                                        ${user_in_match ? `<button class="btn btn-secondary btn-sm" onclick="ScoringController.initScoreSubmission(MatchesController._currentMatchData)">Submit Correct Score</button>` : ''}
                                    </div>
                                `;
                            }
                        });
                    } else if (user_in_match) {
                        // No scores yet
                        scoringHtml = `
                            <div class="results-banner">
                                <div class="results-title" style="margin-bottom:12px;">Match Ended</div>
                                <button class="btn btn-primary" onclick="ScoringController.initScoreSubmission(MatchesController._currentMatchData)">Submit Match Result</button>
                                <p style="font-size:11px; color:var(--c-text-dim); text-align:center; margin-top:12px;">Record the score to update your rankings.</p>
                            </div>
                        `;
                    }

                    // Secondary match submission (Multi-score support)
                    if (user_in_match && (scores || []).length === 1) {
                        scoringHtml += `
                            <div style="margin-top:40px; padding-top:32px; border-top:1px solid rgba(255,255,255,0.05); text-align:center;">
                                <div style="font-size:11px; font-weight:900; color:var(--c-text-muted); text-transform:uppercase; letter-spacing:1.5px; margin-bottom:16px; opacity:0.6;">Played another match?</div>
                                <button class="btn btn-primary" onclick="ScoringController.initScoreSubmission(MatchesController._currentMatchData)" style="width:100%; height:54px; border-radius:12px;">
                                    Submit Score #2
                                </button>
                            </div>
                        `;
                    }


                    
                    actionArea.innerHTML = `<div style="margin-top:40px;">${scoringHtml}</div>`;
                    MatchesController._currentMatchData = match; // Store for controller use

                } else if (pending_for_me) {
                    const reqName = pending_for_me.req_nickname || pending_for_me.req_first;
                    const reqFullName = `${pending_for_me.req_first} ${pending_for_me.req_last}`.trim();
                    const reqInitial = (pending_for_me.req_first?.[0] || '?').toUpperCase();
                    const reqAvatar = pending_for_me.req_profile 
                        ? `<img src="${CONFIG.ASSET_BASE}/${pending_for_me.req_profile}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
                        : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--c-bg-secondary);border-radius:50%;font-weight:700;font-size:16px;">${reqInitial}</div>`;

                    actionArea.innerHTML = `
                        <div style="background:var(--c-bg-card); border:1px solid rgba(247,148,29,0.25); border-radius:var(--r-lg); padding:20px; box-shadow:0 8px 24px rgba(0,0,0,0.15);">
                            <div style="display:flex; align-items:center; gap:16px; margin-bottom:20px;">
                                <div style="width:52px; height:52px; border:2px solid var(--c-orange); border-radius:50%; padding:2px; flex-shrink:0;">
                                    ${reqAvatar}
                                </div>
                                <div style="flex:1;">
                                    <div style="font-size:11px; font-weight:800; color:var(--c-orange); text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">Team Join Request</div>
                                    <div style="font-size:16px; font-weight:700; color:var(--c-text);">
                                        ${reqName} <span style="font-size:13px; font-weight:400; color:var(--c-text-muted); margin-left:4px;">(${reqFullName})</span>
                                    </div>
                                </div>
                            </div>
                            <p style="font-size:13px; color:var(--c-text-muted); margin-bottom:20px; line-height:1.5;">
                                wants you to join this match as their partner. Do you want to play together?
                            </p>
                            <div id="mv-action-msg" style="display:none; font-size:12px; font-weight:600; padding:10px; border-radius:8px; text-align:center; margin-bottom:12px;"></div>
                            <div style="display:flex; gap:12px;">
                                <button onclick="MatchesController.approve(${pending_for_me.id}, ${match.id}, this)" class="btn btn-success" style="flex:1; flex-direction:column; padding:12px 8px; font-size:12px; gap:6px; border-radius:12px;">
                                    <span style="font-size:20px;">✅</span>
                                    <span style="font-weight:800; text-transform:uppercase; letter-spacing:0.3px;">Approve</span>
                                </button>
                                <button onclick="MatchesController.deny(${pending_for_me.id}, ${match.id}, this)"    class="btn btn-danger"  style="flex:1; flex-direction:column; padding:12px 8px; font-size:12px; gap:6px; border-radius:12px; color:var(--c-orange); border-color:rgba(247, 148, 29, 0.3); background:rgba(247, 148, 29, 0.1);">
                                    <span style="font-size:20px;">✗</span>
                                    <span style="font-weight:800; text-transform:uppercase; letter-spacing:0.3px;">Deny</span>
                                </button>
                                <button onclick="MatchesController.block(${pending_for_me.id}, ${match.id}, this)"   class="btn btn-danger"  style="flex:1; flex-direction:column; padding:12px 8px; font-size:12px; gap:6px; border-radius:12px;">
                                    <span style="font-size:20px;">🚫</span>
                                    <span style="font-weight:800; text-transform:uppercase; letter-spacing:0.3px;">Block</span>
                                </button>
                            </div>
                        </div>`;
                } else if (my_pending_request) {
                    const partnerName = my_pending_request.par_nickname || my_pending_request.par_first;
                    actionArea.innerHTML = `
                        <div style="display:flex; flex-direction:column; gap:10px;">
                            <div id="mv-action-msg" style="display:none; font-size:12px; font-weight:600; padding:10px; border-radius:8px; text-align:center;"></div>
                            <div style="flex-direction:column; background:rgba(247,148,29,0.06); border:1px solid rgba(247,148,29,0.15); border-radius:var(--r-md); padding:16px; gap:12px; display:flex;">
                                <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; width:100%;">
                                    <div style="font-size:14px; font-weight:700; color:var(--c-orange);"><span style="margin-right:8px;">⏳</span>Invitation sent to <strong>${partnerName}</strong></div>
                                    <button onclick="MatchesController.cancelRequest(${my_pending_request.id}, ${match.id}, this)" style="padding:7px 12px; background:var(--c-bg-secondary); border:1px solid var(--c-border); border-radius:var(--r-sm); color:var(--c-text); font-size:11px; font-weight:800; text-transform:uppercase; cursor:pointer; font-family:var(--font); white-space:nowrap;">Cancel</button>
                                </div>
                                <div style="font-size:12px; color:var(--c-text-muted); line-height:1.4; border-top:1px solid rgba(247,148,29,0.1); pt:10px; margin-top:4px;">
                                    <strong>Private Draft:</strong> This match is hidden from other players until your partner responds or you cancel this invitation.
                                </div>
                            </div>
                        </div>`;
                } else if (user_in_match) {
                    const isCreator = !!is_creator;
                    const isLate = diffHrs < 6;

                    const myTeam = parseInt(user_in_match.team_no);
                    const teamSlots = slots.filter(s => parseInt(s.team_no) === myTeam && s.status === 'confirmed');
                    const hasPartner = teamSlots.length > 1;

                    const isPast = (new Date(match.match_datetime.replace(' ', 'T')) - new Date()) <= 0;
                    const isFull = match.status === 'full' || match.status === 'completed';
                    const showBanner = !isPast || isFull;

                    let actionHtml = `<div style="display:flex; flex-direction:column; gap:10px;">`;
                    actionHtml += `<div id="mv-action-msg" style="display:none; font-size:12px; font-weight:600; padding:10px; border-radius:8px; text-align:center;"></div>`;
                    
                    if (showBanner) {
                        actionHtml += `<div style="display:flex; align-items:center; justify-content:space-between; gap:10px; background:rgba(76,175,80,0.08); border:1px solid rgba(76,175,80,0.15); border-radius:var(--r-md); padding:12px 16px;">`;
                        actionHtml += `<div style="font-size:13px; font-weight:600; color:var(--c-green);"><span style="margin-right:6px;">✅</span>${isPast ? 'You were in this match' : 'You are in this match'}</div>`;
                    } else {
                        actionHtml += `<div style="display:none;">`;
                    }
                    actionHtml += `<div style="display:flex; gap:8px;">`;
                    
                    if (isLiveMatch && !isCreator) {
                        actionHtml += `<button onclick="MatchesController.leaveMatch(${match.id}, this, ${isLate}, ${isFull})" style="padding:7px 12px; background:var(--c-bg-secondary); border:1px solid var(--c-border); border-radius:var(--r-sm); color:var(--c-orange); font-size:11px; font-weight:800; text-transform:uppercase; cursor:pointer; font-family:var(--font);">🚪 Leave</button>`;
                    }
                    if (isCreator && isLiveMatch) {
                        actionHtml += `<button id="mv-cancel-btn" onclick="MatchesController.cancelMatch(${match.id}, this, ${isLate}, ${isFull})" style="padding:7px 12px; background:rgba(241,90,41,0.1); border:1px solid rgba(241,90,41,0.3); border-radius:var(--r-sm); color:var(--c-red); font-size:11px; font-weight:800; text-transform:uppercase; cursor:pointer; font-family:var(--font);">✕ Cancel</button>`;
                    }
                    actionHtml += `</div></div></div>`;
                    actionArea.innerHTML = actionHtml;
                } else if (my_waitlist_entry) {
                    const isSolo = !my_waitlist_entry.partner_id;
                    const otherPerson = (parseInt(my_waitlist_entry.requester_id) === myUserId) 
                        ? (my_waitlist_entry.par_nickname || my_waitlist_entry.par_first)
                        : (my_waitlist_entry.req_nickname || my_waitlist_entry.req_first);
                    const wlNames = isSolo ? 'You are in the waitlist' : `You & ${otherPerson} are in line`;

                    const s11 = slots.find(s => s.team_no == 1 && s.slot_no == 1);
                    const s12 = slots.find(s => s.team_no == 1 && s.slot_no == 2);
                    const s21 = slots.find(s => s.team_no == 2 && s.slot_no == 1);
                    const s22 = slots.find(s => s.team_no == 2 && s.slot_no == 2);
                    const canJumpIn = isSolo ? (slots.length < 4) : ((!s11 && !s12) || (!s21 && !s22));

                    actionArea.innerHTML = `
                        <div style="display:flex; flex-direction:column; gap:10px;">
                            <div id="mv-action-msg" style="display:none; font-size:12px; font-weight:600; padding:10px; border-radius:8px; text-align:center;"></div>
                            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; background:rgba(27,82,206,0.06); border:1px solid rgba(27,82,206,0.15); border-radius:var(--r-md); padding:12px 16px;">
                                <div style="font-size:13px; font-weight:600; color:var(--c-text-muted);"><span style="margin-right:6px;">🕒</span>${wlNames}</div>
                                <div style="display:flex; gap:8px;">
                                    ${(isLiveMatch && canJumpIn) ? `<button onclick="MatchesController.jumpIn(${my_waitlist_entry.id}, ${match.id}, this)" style="padding:7px 12px; background:#1D8348; border:none; border-radius:var(--r-sm); color:#fff; font-size:11px; font-weight:800; text-transform:uppercase; cursor:pointer; font-family:var(--font); box-shadow:0 2px 8px rgba(29,131,72,0.2);">⚡ Jump In</button>` : ''}
                                    ${isLiveMatch ? `<button onclick="MatchesController.withdraw(${my_waitlist_entry.id}, ${match.id}, this)" style="padding:7px 12px; background:var(--c-bg-secondary); border:1px solid var(--c-border); border-radius:var(--r-sm); color:var(--c-text); font-size:11px; font-weight:800; text-transform:uppercase; cursor:pointer; font-family:var(--font);">Withdraw</button>` : '<span style="font-size:11px; color:var(--c-text-muted); letter-spacing:0.5px; opacity:0.8;">MATCH ENDED</span>'}
                                </div>
                            </div>
                        </div>`;
                } else {
                    const slotsCount = slots.length;

                    let joinHtml = `<div style="display:flex; flex-direction:column; gap:10px;">`;
                    joinHtml += `<div id="mv-action-msg" style="display:none; font-size:12px; font-weight:600; padding:10px; border-radius:8px; text-align:center;"></div>`;
                    
                    if (isLiveMatch) {
                        joinHtml += `<div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">`;
                        if (isFull) {
                            joinHtml += `<button id="mv-join-solo-btn" onclick="MatchesController.joinWaitlist(${match.id}, this)" class="btn btn-secondary" style="padding:14px; font-size:14px;">🕒 Join Waitlist</button>`;
                            joinHtml += `<button id="mv-join-team-btn" onclick="MatchesController.showInvitePartner(true)" class="btn btn-secondary" style="padding:14px; font-size:14px;">🕒 Join as Team</button>`;
                        } else {
                            joinHtml += `<button id="mv-join-solo-btn" onclick="MatchesController.joinSolo(${match.id}, this)" class="btn btn-primary" style="padding:14px; font-size:14px;">⚡ Join Solo</button>`;
                            joinHtml += `<button id="mv-join-team-btn" onclick="MatchesController.showInvitePartner(false)" class="btn btn-secondary" style="padding:14px; font-size:14px;">👥 Join Team</button>`;
                        }
                        joinHtml += `</div>`;
                    } else {
                        joinHtml += `<div style="text-align:center; padding:12px; background:rgba(255,255,255,0.03); border:1px solid var(--c-border); border-radius:var(--r-md);">
                                        <div style="font-size:13px; font-weight:700; color:var(--c-text-muted); letter-spacing:1px; text-transform:uppercase;">🏁 Match Ended</div>
                                     </div>`;
                    }

                    joinHtml += `</div>`;
                    actionArea.innerHTML = joinHtml;
                }

                // Phase 5: Chat access logic
                isPast = (new Date(match.match_datetime.replace(' ', 'T')) - new Date()) <= 0;
                const isWaitlisted = !!(my_waitlist_entry || my_pending_request);
                isAuthorized = !!(user_in_match || isWaitlisted || is_creator);
                
                // Only allow chat access if player is in a slot or on the waiting list
                if (isAuthorized) {
                    const unreadCount = res.data.unread_count || 0;
                    const badgeHtml = unreadCount > 0 ? `
                        <span class="chat-unread-badge" style="background:var(--c-red); color:#fff; font-size:12px; font-weight:900; padding:3px 9px; border-radius:12px; min-width:24px; box-shadow:0 3px 12px rgba(241, 90, 41, 0.5); border:1px solid rgba(255,255,255,0.15);">
                            ${unreadCount > 99 ? '99+' : unreadCount}
                        </span>` : '';

                    const chatBtnHtml = `
                        <div style="margin-bottom:20px;">
                            <button onclick="ChatController.open(${match.id})" class="btn btn-secondary" style="width:100%; padding:14px; display:flex; align-items:center; justify-content:center; gap:10px; font-weight:700; border-radius:var(--r-md); background:var(--c-bg-card); color:var(--c-text);">
                                <span>💬</span> Match Chat
                                ${badgeHtml}
                            </button>
                        </div>
                    `;
                    if (chatArea) chatArea.innerHTML = chatBtnHtml;
                }
            }
        }

        const wlSection = document.getElementById('mv-waiting-section');
        const wlList    = document.getElementById('mv-waiting-list');
        const activeWl  = (waiting_list || []).filter(w => ['pending', 'approved'].includes(w.request_status));

        const isWaitlisted = my_waitlist_entry || my_pending_request;
        if ((is_creator || user_in_match || isWaitlisted) && activeWl.length > 0 && wlSection && wlList) {
            wlSection.style.display = 'block';
            wlList.innerHTML = activeWl.map(w => {
                const isSolo = !w.partner_id;
                const reqName = w.req_nickname || w.req_first;
                const parName = w.par_nickname || w.par_first;
                const names   = isSolo ? reqName : `${reqName} & ${parName}`;
                let status = 'In Queue';
                let sClass = 'badge-primary';
                
                if (w.request_status === 'pending') {
                    status = 'Waiting for partner approval';
                    sClass = 'badge-orange';
                } else if (w.request_status === 'denied') {
                    status = 'Denied';
                    sClass = 'badge-red';
                } else if (w.request_status === 'cancelled') {
                    status = 'Cancelled';
                    sClass = 'badge-muted';
                }
                
                return `
                <div class="wl-row" style="display:flex; align-items:center; justify-content:space-between; padding:12px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                    <div>
                        <div style="font-size:14px; font-weight:700; color:var(--c-text); display:flex; align-items:center; gap:8px;">
                            ${names}
                            ${isSolo ? (w.req_side ? `<span class="side-indicator-mini ${w.req_side}" style="position:static; width:18px; height:18px; font-size:10px;">${w.req_side[0].toUpperCase()}</span>` : '') : ''}
                        </div>
                        <div style="font-size:12px; color:var(--c-text-muted); margin-top:2px;">${isSolo ? 'Solo Request' : 'Team Request'}</div>
                    </div>
                    <div class="badge ${sClass}" style="font-size:10px; padding:4px 8px;">${status}</div>
                </div>`;
            }).join('');
        } else if (wlSection) {
            wlSection.style.display = 'none';
        }

        if (content) content.style.display = 'block';
        if (skeleton) skeleton.style.display = 'none';

        if (!isAuthorized) {
            ChatController.stop();
        }

        MatchesController.initJoinForm();

        if (typeof ChatController !== 'undefined' && ChatController._isShowing) {
            ChatController.renderPlayerBar();
        }

        return { id: parseInt(match.id), isAuthorized, isChatAllowed: isAuthorized };
    },





    
    initJoinForm: function() {
        const input = document.getElementById('mv-partner-code-input');
        const help  = document.getElementById('mv-partner-help');
        const badge = document.getElementById('mv-partner-badge');
        const bCode = document.getElementById('mv-badge-code');
        const bName = document.getElementById('mv-badge-name');
        const bClear = document.getElementById('mv-badge-clear');
        
        if (!input || !help) return;

        let lookupTimeout = null;

        if (bClear) {
            bClear.onclick = () => {
                badge.style.display = 'none';
                input.value = '';
                input.focus();
                help.textContent = "Your partner will receive a request to approve.";
                help.style.color = 'var(--c-text-muted)';
            };
        }

        input.oninput = (e) => {
            clearTimeout(lookupTimeout);
            const q = e.target.value.trim();
            help.textContent = "Your partner will receive a request to approve.";
            help.style.color = 'var(--c-text-muted)';
            input.classList.remove('error');

            if (q.length === 3 || q.length === 4) {
                help.textContent = "Looking up player...";
                lookupTimeout = setTimeout(async () => {
                    const res = await API.post('/profile/check_code', { code: q });
                    if (res && res.success) {
                        const foundId = parseInt(res.data.user_id);
                        if (MatchesController._currentMatchPlayerIds && MatchesController._currentMatchPlayerIds.has(foundId)) {
                            if (badge) badge.style.display = 'none';
                            help.textContent = "This player is already in the match";
                            help.style.color = "var(--c-danger)";
                            input.classList.add('error');
                            return;
                        }

                        input.value = q;
                        if (badge && bCode && bName) {
                            bCode.textContent = q;
                            bName.textContent = res.data.name;
                            badge.style.display = 'flex';
                        }
                        help.textContent = "Player found!";
                        help.style.color = "var(--c-primary)";
                    } else {
                        if (badge) badge.style.display = 'none';
                        help.textContent = (res && res.message) ? res.message : "Player not found";
                        help.style.color = "var(--c-danger)";
                        input.classList.add('error');
                    }
                }, 400);
            } else if (q.length > 4) {
                e.target.value = q.substring(0, 4);
                e.target.dispatchEvent(new Event('input'));
            } else {
                if (badge) badge.style.display = 'none';
            }
        };
    },

    showInvitePartner: function(isFull = false) {
        // Cancel solo selection mode if active
        MatchesController.cancelSelectionMode();

        const form = document.getElementById('mv-join-team-form');
        if (!form) return;

        // Inject/update the waitlist notice at top of team form
        let noticeEl = document.getElementById('mv-team-waitlist-notice');
        if (isFull) {
            if (!noticeEl) {
                noticeEl = document.createElement('div');
                noticeEl.id = 'mv-team-waitlist-notice';
                noticeEl.style.cssText = 'background:rgba(247,148,29,0.07); border:1px solid rgba(247,148,29,0.2); border-radius:10px; padding:10px 14px; font-size:12px; color:var(--c-orange); font-weight:600; margin-bottom:14px; line-height:1.4;';
                noticeEl.innerHTML = '🕒 <strong>Match is full.</strong> Your request will be added to the waitlist. You and your partner will be notified when a team slot opens up.';
                form.insertBefore(noticeEl, form.firstChild);
            } else {
                noticeEl.style.display = 'block';
            }
        } else if (noticeEl) {
            noticeEl.style.display = 'none';
        }

        form.style.display = 'block';
        
        const area = document.getElementById('mv-action-area');
        if (area) area.style.display = 'none';

        const input = document.getElementById('mv-partner-code-input');
        if (input) {
            input.focus();
            // Scroll to form on mobile
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        }
    },

    resetInviteForm: function() {
        const input = document.getElementById('mv-partner-code-input');
        const badge = document.getElementById('mv-partner-badge');
        const help  = document.getElementById('mv-partner-help');
        const btn   = document.querySelector('#mv-join-team-form button[type="submit"]');

        if (input) {
            input.value = '';
            input.classList.remove('error');
        }
        if (badge) badge.style.display = 'none';
        if (help) {
            help.textContent = "Your partner will receive a request to approve.";
            help.style.color = 'var(--c-text-muted)';
        }
        if (btn) {
            btn.innerHTML = 'Send Request';
            btn.disabled = false;
        }
    },

    hideInvitePartner: function() {
        const form = document.getElementById('mv-join-team-form');
        if (form) form.style.display = 'none';
        
        const area = document.getElementById('mv-action-area');
        if (area) area.style.display = 'block';

        MatchesController.resetInviteForm();
    },


    cancelSelectionMode: function() {
        if (this._soloSelectionTimeout) {
            clearTimeout(this._soloSelectionTimeout);
            this._soloSelectionTimeout = null;
        }

        const soloBtn = document.getElementById('mv-join-solo-btn');
        if (soloBtn) {
            soloBtn.style.display = 'block';
            soloBtn.disabled = false;
            // Restore icon/text based on context
            if (soloBtn.innerText.includes('Waitlist')) {
                soloBtn.innerText = '🕒 Join Waitlist';
            } else {
                soloBtn.innerText = '⚡ Join Solo';
            }
        }

        const teamBtn = document.getElementById('mv-join-team-btn');
        if (teamBtn) {
            teamBtn.style.display = 'block';
        }

        const emptySlots = document.querySelectorAll('.mv-slot.slot-empty');
        emptySlots.forEach(el => {
            el.innerText = 'Open';
            el.style.cursor = 'default';
            el.classList.remove('pulse-selection');
            el.onclick = null;
        });
    },

    // ── Actions ──────────────────────────────────────────
    joinSolo: async function(match_id, btn) {
        // Hide team form if open
        const teamForm = document.getElementById('mv-join-team-form');
        if (teamForm) teamForm.style.display = 'none';

        // Hide team button to focus on solo selection
        const teamBtn = document.getElementById('mv-join-team-btn');
        if (teamBtn) teamBtn.style.display = 'none';

        // If match is full, join waitlist immediately
        const slotsCount = MatchesController._currentMatchSlotsCount || 0;
        if (slotsCount >= 4) {
            return MatchesController.performJoinSolo(match_id, btn);
        }

        // Otherwise, enter selection mode
        btn.disabled = true;
        btn.innerText = 'Select a spot ↑';
        
        // Find all empty slots and make them interactive
        const emptySlots = document.querySelectorAll('.mv-slot.slot-empty');
        emptySlots.forEach(el => {
            el.innerText = 'Join here';
            el.style.cursor = 'pointer';
            el.classList.add('pulse-selection');
            
            // Extract team/slot from ID e.g. mv-team1-slot2
            const parts = el.id.split('-');
            const team = parseInt(parts[1].replace('team', ''));
            const slot = parseInt(parts[2].replace('slot', ''));
            
            el.onclick = () => {
                if (MatchesController._soloSelectionTimeout) {
                    clearTimeout(MatchesController._soloSelectionTimeout);
                    MatchesController._soloSelectionTimeout = null;
                }
                MatchesController.performJoinSolo(match_id, el, team, slot);
            };
        });

        // --- NEW: 3s Auto-dismiss ---
        if (this._soloSelectionTimeout) clearTimeout(this._soloSelectionTimeout);
        this._soloSelectionTimeout = setTimeout(() => {
            this.cancelSelectionMode();
        }, 3000);
    },

    performJoinSolo: async function(match_id, btn, team_no = null, slot_no = null, force_waitlist = false) {
        let oldText = btn ? btn.innerText : '🎾 Join Solo';
        
        let sideOverride = null;
        if (team_no && slot_no && !force_waitlist) {
            const partner = (MatchesController._currentMatchSlots || []).find(s => parseInt(s.team_no) === team_no);
            const mySide = MatchesController._currentUserSide;
            if (partner && partner.playing_side && mySide && partner.playing_side !== 'flexible' && mySide !== 'flexible') {
                if (partner.playing_side === mySide) {
                    const result = await ConfirmModal.show({
                        title: 'Side Conflict',
                        message: `You are both ${mySide} players. How would you like to proceed?`,
                        confirmText: 'Join as Flexible',
                        thirdText: 'Join Waiting List',
                        cancelText: 'Cancel'
                    });
                    
                    if (result === 'third') {
                        MatchesController.cancelSelectionMode();
                        return MatchesController.joinWaitlist(match_id, btn);
                    }
                    if (!result) {
                        MatchesController.cancelSelectionMode();
                        return;
                    }
                    sideOverride = 'flexible';
                }
            }
        }

        if (btn) { btn.disabled = true; btn.innerText = '...'; }

        const res = await API.post('/match/join-solo', { 
            match_id, 
            team_no, 
            slot_no,
            playing_side: sideOverride,
            force_waitlist: force_waitlist
        });


        console.log('[API MatchJoinSolo]', res);

        if (res && res.success) {
            Toast.show('You joined the match!', 'success');
            await MatchesController.loadDetails({ match_id });
        } else {
            MatchesController.showActionError(res ? res.message : 'Join failed');
            if (btn) {
                btn.disabled = false;
                btn.innerText = oldText;
            }
            Toast.show(res ? res.message : 'Join failed', 'error');
        }
    },

    joinWaitlist: async function(match_id, btn) {
        return MatchesController.performJoinSolo(match_id, btn, null, null, true);
    },

    submitTeamRequest: async function() {

        const form    = document.getElementById('mv-join-team-form');
        const btn     = form ? form.querySelector('button[type="submit"]') : null;
        const oldText = btn ? btn.innerText : 'Send Request';

        if (btn) { btn.disabled = true; btn.innerText = '...'; }

        const match_id = MatchesController._currentMatchId;
        const code     = document.getElementById('mv-partner-code-input')?.value.trim();
        
        if (!code) { 
            MatchesController.showActionError('Enter partner player code!');
            if (btn) { btn.disabled = false; btn.innerText = oldText; }
            Toast.show('Enter partner player code', 'warning'); 
            return; 
        }

        const res = await API.post('/match/join-team', { match_id, partner_player_code: code });
        console.log('[API MatchJoinTeam]', res);

        if (res && res.success) {
            Toast.show('Request sent! Waiting for partner approval.', 'success');
            if (form) form.style.display = 'none';
            await MatchesController.loadDetails({ match_id });
        } else {
            MatchesController.showActionError(res ? res.message : 'Request failed');
            if (btn) {
                btn.disabled = false;
                btn.innerText = oldText;
            }
            Toast.show(res ? res.message : 'Request failed', 'error');
        }
    },

    showActionError: function(msg) {
        const container = document.getElementById('mv-action-msg');
        if (!container) return;
        container.textContent = msg;
        container.style.display = 'block';
        container.style.background = 'rgba(244, 67, 54, 0.1)';
        container.style.color = 'var(--c-danger)';
        container.style.border = '1px solid rgba(244, 67, 54, 0.2)';
        
        setTimeout(() => {
            container.style.display = 'none';
        }, 5000);
    },

    approve: async function(wl_id, match_id, btn) {
        let oldText = btn ? btn.innerText : '✅ Approve';

        const req = (MatchesController._currentMatchWaitlist || []).find(w => parseInt(w.id) === wl_id);
        let sideOverride = null;
        if (req && req.req_side && req.par_side && req.req_side !== 'flexible' && req.par_side !== 'flexible') {
            if (req.req_side === req.par_side) {
                const confirmed = await ConfirmModal.show({
                    title: 'Side Conflict',
                    message: `You are both ${req.par_side} players. Do you want to join as flexible for this match?`,
                    confirmText: 'Join as Flexible',
                    cancelText: 'Cancel'
                });
                if (!confirmed) return;
                sideOverride = 'flexible';
            }
        }

        if (btn) { btn.disabled = true; btn.innerText = '...'; }

        const res = await API.post('/match/approve', { 
            waiting_list_id: wl_id,
            playing_side: sideOverride
        });

        console.log('[API MatchApprove]', res);

        if (res && res.success) {
            Toast.show('Approved! Both players are now in the match.', 'success');
            await MatchesController.loadDetails({ match_id });
        } else {
            MatchesController.showActionError(res ? res.message : 'Approve failed');
            if (btn) {
                btn.disabled = false;
                btn.innerText = oldText;
            }
            Toast.show(res ? res.message : 'Approve failed', 'error');
        }
    },

    deny: async function(wl_id, match_id, btn) {
        let oldText = btn ? btn.innerText : '✗ Deny';
        if (btn) { btn.disabled = true; btn.innerText = '...'; }

        const res = await API.post('/match/deny', { waiting_list_id: wl_id });
        console.log('[API MatchDeny]', res);

        if (res && res.success) {
            Toast.show('Request denied.', 'info');
            await MatchesController.loadDetails({ match_id });
        } else {
            MatchesController.showActionError(res ? res.message : 'Deny failed');
            if (btn) {
                btn.disabled = false;
                btn.innerText = oldText;
            }
            Toast.show(res ? res.message : 'Deny failed', 'error');
        }
    },

    block: async function(wl_id, match_id, btn) {
        let oldText = btn ? btn.innerText : '🚫 Block';
        if (btn) { btn.disabled = true; btn.innerText = '...'; }

        const res = await API.post('/match/block', { waiting_list_id: wl_id });
        console.log('[API MatchBlock]', res);

        if (res && res.success) {
            Toast.show(res.message, 'info');
            await MatchesController.loadDetails({ match_id });
        } else {
            MatchesController.showActionError(res ? res.message : 'Block failed');
            if (btn) {
                btn.disabled = false;
                btn.innerText = oldText;
            }
            Toast.show(res ? res.message : 'Block failed', 'error');
        }
    },

    cancelRequest: async function(wl_id, match_id, btn) {
        let oldText = btn ? btn.innerText : 'Cancel Request';
        if (btn) { btn.disabled = true; btn.innerText = '...'; }

        const res = await API.post('/match/cancel', { waiting_list_id: wl_id });
        console.log('[API MatchCancelRequest]', res);

        if (res && res.success) {
            Toast.show('Invitation cancelled.', 'info');
            await MatchesController.loadDetails({ match_id });
        } else {
            MatchesController.showActionError(res ? res.message : 'Cancel failed');
            if (btn) {
                btn.disabled = false;
                btn.innerText = oldText;
            }
            Toast.show(res ? res.message : 'Cancel failed', 'error');
        }
    },
    
    withdraw: async function(wl_id, match_id, btn) {
        let oldText = btn ? btn.innerText : 'Withdraw';
        if (btn) { btn.disabled = true; btn.innerText = '...'; }

        const res = await API.post('/match/withdraw', { waiting_list_id: wl_id });
        console.log('[API MatchWithdraw]', res);

        if (res && res.success) {
            Toast.show('Withdrawn from waiting list', 'success');
            await MatchesController.loadDetails({ match_id });
        } else {
            MatchesController.showActionError(res ? res.message : 'Error withdrawing');
            if (btn) { btn.disabled = false; btn.innerText = oldText; }
            Toast.show(res ? res.message : 'Error withdrawing', 'error');
        }
    },

    leaveMatch: async function(match_id, btn, isLate, isFull) {
        let modalOpts = {
            title: 'Leave Match?',
            message: 'Are you sure you want to leave this match?',
            confirmText: 'Yes, Leave Match',
            cancelText: 'No, Stay',
            type: 'info'
        };

        if (isLate && isFull) {
            modalOpts = {
                title: 'Policy Warning',
                message: 'You are leaving a full match less than 6 hours before it starts. This violates our policy and may lead to a ban.',
                confirmText: 'Confirm Withdrawal',
                cancelText: 'Don\'t Leave',
                type: 'warning',
                showInput: true,
                inputPlaceholder: 'Please provide a reason...'
            };
        }

        const reasonOrConfirmed = await ConfirmModal.show(modalOpts);
        if (reasonOrConfirmed === false) return;

        let oldText = btn ? btn.innerText : '🚪 Leave Match';
        if (btn) { btn.disabled = true; btn.innerText = '...'; }

        const reason = (typeof reasonOrConfirmed === 'string') ? reasonOrConfirmed : '';

        const res = await API.post('/match/withdraw', { 
            match_id,
            reason: reason
        });

        console.log('[API LeaveMatch]', res);

        if (res && res.success) {
            const msg = res.data?.is_late
                ? 'You have left the match (late withdrawal — within 6 hours).'
                : 'You have left the match.';
            Toast.show(msg, 'success');
            await MatchesController.loadDetails({ match_id }, true);

        } else {
            MatchesController.showActionError(res ? res.message : 'Could not leave match');
            if (btn) { btn.disabled = false; btn.innerText = oldText; }
            Toast.show(res ? res.message : 'Could not leave match', 'error');
        }
    },

    cancelMatch: async function(match_id, btn, isLate, isFull) {
        let modalOpts = {
            title: 'Cancel Match?',
            message: 'This action cannot be undone and other players will be notified.',
            confirmText: 'Yes, Cancel Match',
            cancelText: 'No, Keep it',
            type: 'info'
        };

        // Late cancellation warning for full matches
        if (isLate && isFull) {
            modalOpts = {
                title: 'Policy Warning',
                message: 'You are cancelling a full match less than 6 hours before it starts. This violates our policy and may lead to a ban.',
                confirmText: 'Confirm Cancellation',
                cancelText: 'Don\'t Cancel',
                type: 'warning',
                showInput: true,
                inputPlaceholder: 'Please provide a reason...'
            };
        }

        const reasonOrConfirmed = await ConfirmModal.show(modalOpts);
        if (reasonOrConfirmed === false) return;

        let oldText = btn ? btn.innerText : '✕ Cancel Match';
        if (btn) { btn.disabled = true; btn.innerText = '...'; }

        // If it was a simple confirmation, reasonOrConfirmed is 'true'. 
        // If it was an input modal, it's the string value.
        const reason = (typeof reasonOrConfirmed === 'string') ? reasonOrConfirmed : '';

        const res = await API.post('/match/cancel', { 
            match_id, 
            reason: reason 
        });
        console.log('[API CancelMatch]', res);

        if (res && res.success) {
            Router.navigate('/matches/my');
        } else {
            MatchesController.showActionError(res ? res.message : 'Could not cancel match');
            if (btn) { btn.disabled = false; btn.innerText = oldText; }
        }
    },

    jumpIn: async function(waitlist_id, match_id, btn) {
        let oldText = btn.innerText;
        btn.disabled = true;
        btn.innerText = '…';
        
        const res = await API.post('/match/jump-in', { waitlist_id, match_id });
        if (res && res.success) {
            Toast.show('You joined the match! ⚡', 'success');
            // Refresh view
            this.initView({ id: match_id });
        } else {
            Toast.show(res ? res.message : 'Could not jump in', 'error');
            btn.disabled = false;
            btn.innerText = oldText;
        }
    }
};


// ── Phase 5: Chat Controller ──────────────────────────────────────────────────
const ChatController = {

    _matchId:   0,
    _lastId:    0,
    _sending:   false,
    _pollTimer: null,
    _isShowing: false,
    _lastSenderId: 0,
    _lastMsgEl: null,
    _viewerId: 0,
    _shownActionIds: new Set(),





    open: function(match_id) {
        this._matchId = match_id;
        this._isShowing = true;
        this._lastSenderId = 0;
        this._lastMsgEl = null;


        const overlay = document.getElementById('mv-chat-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
            
            // Hardened scroll lock for all platforms
            document.documentElement.style.overflow = 'hidden';
            document.body.style.overflow = 'hidden'; 
            document.body.style.height = '100dvh';

            // Immediate UX cleanup: hide badge since we are now "reading"
            const badge = document.querySelector('.chat-unread-badge');
            if (badge) badge.style.display = 'none';
        }
        
        // Push state so back button closes the chat
        const currentPath = window.location.pathname;
        const chatPath = currentPath.endsWith('/chat') ? currentPath : (currentPath + '/chat');

        // Only push if we are NOT already on the chat path (avoid double history entries)
        if (currentPath !== chatPath) {
            history.pushState({ 
                chatOpen: true, 
                ignoreRoute: true, 
                depth: (typeof Router !== 'undefined' ? Router.navDepth : 0) 
            }, '', chatPath);
        } else {
            // If already on /chat, just replace state to ensure our chatOpen flag is present
            history.replaceState({ 
                chatOpen: true, 
                ignoreRoute: true, 
                depth: (typeof Router !== 'undefined' ? Router.navDepth : 0) 
            }, '', chatPath);
        }
        
        this.init(match_id);
    },





    renderPlayerBar: function() {

        const bar = document.getElementById('chat-player-bar');
        if (!bar) return;
        
        // Use slot data from MatchesController
        const slots = MatchesController._currentMatchSlots || [];
        const waitlist = MatchesController._currentMatchWaitlist || [];
        
        // Build a unique list of players
        const players = [];
        const seen = new Set();

        const add = (p) => {
            if (!p || !p.user_id || seen.has(p.user_id)) return;
            seen.add(p.user_id);
            players.push(p);
        };

        slots.forEach(s => add(s));
        waitlist.forEach(w => {
            // Only show people currently in the queue or pending approval
            if (!['pending', 'approved'].includes(w.request_status)) return;
            
            if (w.requester_id) add({ user_id: w.requester_id, nickname: w.req_nickname, first_name: w.req_first, last_name: w.req_last, profile_image: w.req_profile, player_code: w.req_code });
            if (w.partner_id) add({ user_id: w.partner_id, nickname: w.par_nickname, first_name: w.par_first, last_name: w.par_last, profile_image: w.par_profile, player_code: w.par_code });
        });

        const currentUserId = this._viewerId || 0;
        
        let meUser = null;
        const otherUsers = [];
        
        players.forEach(p => {
            if (parseInt(p.user_id) === currentUserId) {
                meUser = p;
            } else {
                otherUsers.push(p);
            }
        });

        let html = '';

        const buildAvatar = (p, isMe) => {
            const initials = ((p.first_name?.[0] || '') + (p.last_name?.[0] || '')).toUpperCase() || (p.nickname?.[0] || '?').toUpperCase();
            const displayName = p.nickname || p.first_name || 'Player';
            const imgPath = p.profile_image ? `src="${CONFIG.ASSET_BASE}/${p.profile_image}"` : '';
            
            const onlineDot = `<div id="avatar-online-dot-${p.user_id}" style="display:none; position:absolute; bottom:-1px; right:-1px; width:13px; height:13px; background-color:#10B981; border:2px solid var(--c-bg); border-radius:50%; z-index:10; box-shadow:0 0 4px rgba(16,185,129,0.4);"></div>`;
            
            if (isMe) {
                // Non-clickable representation of self
                return `
                    <div class="chat-player-avatar" 
                         style="position:relative; z-index:5; flex-shrink:0; border-color:var(--c-primary);"
                         title="${displayName} (You)">
                        ${p.profile_image ? `<img ${imgPath} style="pointer-events:none;width:100%;height:100%;object-fit:cover;border-radius:50%;">` : initials}
                        ${onlineDot}
                    </div>
                `;
            } else {
                // Clickable representation of others
                return `
                    <div class="chat-player-avatar" 
                         onclick="ChatController.openPlayerMenu(event)"
                         data-user-id="${p.user_id}"
                         data-nickname="${displayName}"
                         data-fullname="${((p.first_name || '') + ' ' + (p.last_name || '')).trim()}"
                         data-code="${p.player_code || ''}"
                         style="position:relative; z-index:5; cursor:pointer; flex-shrink:0;"
                         title="${displayName}">
                        ${p.profile_image ? `<img ${imgPath} style="pointer-events:none;width:100%;height:100%;object-fit:cover;border-radius:50%;">` : initials}
                        ${onlineDot}
                    </div>
                `;
            }
        };

        if (meUser) {
            html += buildAvatar(meUser, true);
        }
        
        if (otherUsers.length > 0) {
            if (meUser) {
                html += `<div style="width:1px; height:24px; background:rgba(255,255,255,0.1); margin:auto 4px; flex-shrink:0;"></div>`;
            }
            html += otherUsers.map(p => buildAvatar(p, false)).join('');
        }

        bar.innerHTML = html;
    },


    openPlayerMenu: function(event) {
        if (event) event.stopPropagation();
        const el = (event && event.target) ? event.target.closest('.chat-player-avatar') : null;
        if (!el) return;

        const userId   = el.dataset.userId;
        const nickname = el.dataset.nickname || '';
        const fullName = el.dataset.fullname || '';
        const pCode    = el.dataset.code || '';
        if (!userId || Number(userId) === this._viewerId) return;

        const actionBar = document.getElementById('chat-player-actions-bar');

        const nameEl    = document.getElementById('chat-selected-player-name');
        const listEl    = document.getElementById('chat-inline-actions');
        
        if (!actionBar || !nameEl || !listEl) return;

        const cached = PhoneController._requests[userId];
        const isApproved = cached && cached.status === 'approved';
        const isPending = cached && cached.status === 'pending';

        let btnContent = '';
        if (isPending) {
            btnContent = `
                <div id="phone-btn-${userId}" 
                     onclick="ChatController.cancelPhone(${userId}, this)" 
                     style="cursor:pointer; padding:6px 14px; background:var(--c-primary); color:#fff; border-radius:8px; font-size:12px; font-weight:700; white-space:nowrap;">
                     Cancel request
                </div>`;
        } else if (isApproved && cached.phone) {
            btnContent = `
                <div id="phone-btn-${userId}" 
                     onclick="event.stopPropagation(); window.location.href='tel:${cached.phone.replace(/\s+/g, '')}'"
                     style="cursor:pointer; padding:6px 14px; background:rgba(247,148,29,0.1); border:1px solid var(--c-orange); color:var(--c-orange); border-radius:8px; font-size:12px; font-weight:700; white-space:nowrap;">
                     📞 ${cached.phone}
                </div>`;
        } else {
            btnContent = `
                <div id="phone-btn-${userId}" 
                     onclick="ChatController.requestPhone(${userId}, this)" 
                     style="cursor:pointer; padding:6px 14px; background:rgba(255,255,255,0.1); color:#fff; border-radius:8px; font-size:12px; font-weight:700; white-space:nowrap;">
                     📞 Request Phone
                </div>`;
        }

        const codeHtml = pCode ? `<span style="font-family:monospace; font-size:11px; background:rgba(247,148,29,0.15); color:var(--c-orange); padding:2px 6px; border-radius:6px; letter-spacing:0.5px; font-weight:800;">${pCode}</span>` : '';
        const nameDisplay = `<span style="text-transform:uppercase; font-weight:900;">${nickname}</span>`;
        nameEl.innerHTML = `${nameDisplay} ${codeHtml}`;
        listEl.innerHTML = btnContent;


        actionBar.style.setProperty('display', 'flex', 'important');
    },




    closePlayerMenu: function() {
        const actionBar = document.getElementById('chat-player-actions-bar');
        if (actionBar) actionBar.style.setProperty('display', 'none', 'important');
    },

    mentionPlayer: function(nickname) {
        if (!nickname) return;
        const input = document.getElementById('chat-input');
        if (input) {
            const val = input.value;
            const space = (val.length > 0 && !val.endsWith(' ')) ? ' ' : '';
            input.value = val + space + '@' + nickname + ' ';
            input.focus();
            this.autoResize(input);
        }
    },

    requestPhone: async function(userId, btn) {
        if (btn) { 
            btn.style.pointerEvents = 'none'; 
            btn.style.opacity = '0.7'; 
            btn.innerText = '… Sending'; 
        }
        const success = await PhoneController.request(userId, this._matchId);
        if (success) {
            if (btn) {
                btn.innerText = 'Cancel request';
                btn.style.background = 'var(--c-primary)';
                btn.style.opacity = '1';
                btn.onclick = () => this.cancelPhone(userId, btn);
            }
            // Trigger chat refresh to show the request status (if needed) or just UI update
            await this.loadMessages(false, true);
        } else if (btn) {
            btn.style.pointerEvents = 'auto';
            btn.style.opacity = '1';
            btn.innerText = '📞 Request Phone';
        }
        setTimeout(() => this.closePlayerMenu(), 1000);
    },

    cancelPhone: async function(userId, btn) {
        if (btn) { 
            btn.style.pointerEvents = 'none'; 
            btn.style.opacity = '0.7'; 
            btn.innerText = '… Cancelling'; 
        }
        const success = await PhoneController.cancel(userId, this._matchId);
        if (success && btn) {
            btn.innerText = '📞 Request Phone';
            btn.style.background = 'rgba(255,255,255,0.1)';
            btn.style.pointerEvents = 'auto';
            btn.style.opacity = '1';
            btn.onclick = () => this.requestPhone(userId, btn);
        } else if (!success && btn) {
            // Revert state if failed
            btn.innerText = 'Cancel request';
            btn.style.background = 'var(--c-primary)';
            btn.style.pointerEvents = 'auto';
            btn.style.opacity = '1';
        }
        setTimeout(() => this.closePlayerMenu(), 600);
    },







    suspendAndNavigate: function(path) {
        this._isShowing = false;
        const overlay = document.getElementById('mv-chat-overlay');
        if (overlay) overlay.style.display = 'none';
        this.stop();
        Router.navigate(path);
    },


    close: function(fromHistory = false) {

        if (!this._isShowing) return;
        this._isShowing = false;
        
        this.closePlayerMenu();

        const overlay = document.getElementById('mv-chat-overlay');

        const menu = document.getElementById('chat-action-menu');
        if (menu) menu.style.display = 'none';

        if (overlay) {
            overlay.style.display = 'none';
            document.documentElement.style.overflow = '';
            document.body.style.overflow = ''; 
            document.body.style.height = '';
        }
        this.stop();


        // If closed via ✕ button, we need to pop the state we pushed
        if (!fromHistory) {
            if (history.state && history.state.chatOpen) {
                history.back();
            }
        }
    },

    init: function(match_id) {
        this._matchId = match_id;

        this._lastId  = 0;
        
        const indicator = document.getElementById('chat-online-indicator');
        if (indicator) indicator.style.display = 'flex';
        
        this._shownActionIds.clear(); 
        this.loadMessages(true);

        this.startPoll();
    },


    stop: function() {
        if (this._pollTimer) { 
            clearInterval(this._pollTimer); 
            this._pollTimer = null; 
            
            // Phase 6: Explicitly clear presence so notifications re-enable immediately
            const mid = parseInt(this._matchId);
            if (mid) {
                API.post('/chat/presence-clear', { match_id: mid });
            }
        }
    },

    startPoll: function() {
        this.stop();
        this._pollTimer = setInterval(() => { ChatController.loadMessages(false); }, 5000);
    },


    loadMessages: async function(initial = false, forceScroll = false) {
        // Phase 6: Don't poll if the tab is in the background (prevents "ghost online" status)
        if (document.hidden && !initial) return;

        const container = document.getElementById('chat-messages-container');
        const inner     = document.getElementById('chat-messages-inner');
        if (!container || !inner) return;

        const mid = parseInt(this._matchId);
        if (!mid) return;
        const res = await API.post('/chat/list', { match_id: mid, since_id: initial ? 0 : (this._lastId || 0) });

        if (!res || !res.success) return;

        if (initial) {
            this._lastMsgEl = null;
            this._lastSenderId = 0;
            // Only clear the container if we are going to add messages or notifications
            // We do this below after checking what data we received.
        }

        const messages             = res.data.messages || [];

        const viewerId             = parseInt(res.data.viewer_id);
        this._viewerId             = viewerId;
        
        if (initial) {
            this.renderPlayerBar();
        }

        const outgoing             = res.data.outgoing_phone_requests || [];
        const pendingForMe         = res.data.pending_phone_requests || [];
        const online_users         = res.data.online_users || [];

        // Real-Time dynamically toggle the online indicator dots across the player bar
        const onlineSet = new Set(online_users.map(id => String(id)));
        document.querySelectorAll('div[id^="avatar-online-dot-"]').forEach(el => {
            const uid = el.id.replace('avatar-online-dot-', '');
            if (onlineSet.has(uid) || uid === String(viewerId)) {
                el.style.display = 'block';
            } else {
                el.style.display = 'none';
            }
        });

        // Manage empty state and clearing on initial load
        const hasContent = messages.length > 0 || pendingForMe.length > 0 || outgoing.filter(pr => pr.status === 'approved').length > 0;
        
        if (initial) {
            if (hasContent) {
                // We have things to show, prep the stage by clearing exactly once
                inner.innerHTML = ''; 
            } else {
                // Nothing to show, make sure empty state is visible
                let emptyState = document.getElementById('chat-empty-state');
                if (!emptyState) {
                    inner.innerHTML = `
                      <div id="chat-empty-state" style="display:flex; align-items:center; justify-content:center; color:var(--c-text-muted); font-size:13px; text-align:center; padding:40px 0; flex:1;">
                        No messages yet.<br>Be the first to say something! 🎾
                      </div>`;
                }
            }
        }
        
        // Globally ensure placeholder is removed if we are injecting anything
        if (hasContent) {
            const emptyState = document.getElementById('chat-empty-state');
            if (emptyState) emptyState.remove();
        }


        // Sync outgoing status
        outgoing.forEach(pr => {
            const tid = parseInt(pr.target_user_id);
            if (!PhoneController._requests[tid] || PhoneController._requests[tid].status === 'pending') {
                PhoneController._requests[tid] = { status: pr.status, request_id: parseInt(pr.id) };
                if (pr.phone) PhoneController._requests[tid].phone = pr.phone;
                PhoneController.updateBtn(tid, pr.status, pr.phone);
            }
        });

        // --- NEW: Unified Chronological Timeline ---
        const timelineEvents = [
            ...messages.map(m => ({ type: 'message', time: new Date(m.created_at), data: m })),
            ...outgoing
                .filter(pr => pr.status === 'approved')
                .map(pr => ({ type: 'phone_approved', time: new Date(pr.updated_at || pr.created_at), data: pr }))
        ];

        // Sort chronologically
        timelineEvents.sort((a,b) => a.time - b.time);



        const wasAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
        
        try {
            timelineEvents.forEach(event => {
                if (event.type === 'message') {
                    const msg = event.data;
                    const msgId = parseInt(msg.id);
                    if (!msgId) return;
                    const senderId = parseInt(msg.user_id);
                    const isMe = senderId === viewerId;
                    const bubble = this.buildBubbleEl(msg, isMe);
                    
                    if (senderId === this._lastSenderId && this._lastMsgEl) {
                        const col = this._lastMsgEl.querySelector('.chat-msg-column');
                        if (col) {
                            col.appendChild(bubble);
                            this._lastMsgEl.style.marginBottom = '16px'; 
                        }
                    } else {
                        const group = document.createElement('div');
                        group.className = 'chat-msg-group';
                        group.style.cssText = `display:flex; gap:10px; align-items:flex-end; margin-bottom:16px; width:100%;` + (isMe ? 'flex-direction:row-reverse;' : '');
                        
                        const name = msg.nickname || msg.first_name || 'Guest';
                        const code = msg.player_code || '';
                        const avatar = msg.profile_image
                            ? '<img src="' + CONFIG.ASSET_BASE + '/' + msg.profile_image + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'
                            : (name[0] || '?').toUpperCase();

                        group.innerHTML = `
                            <div class="chat-group-avatar" style="width:34px; height:34px; border-radius:50%; background:var(--g-primary); display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:800; flex-shrink:0; overflow:hidden;">${avatar}</div>
                            <div class="chat-msg-column" style="max-width:72%; display:flex; flex-direction:column; gap:2px; ${isMe ? 'align-items:flex-end;' : 'align-items:flex-start;'}">
                                ${!isMe ? `<div style="font-size:11px; font-weight:700; color:var(--c-text-muted); margin-bottom:2px;">${name} ${code ? `<span style="font-family:monospace; font-size:10px; color:var(--c-orange); opacity:0.9;">${code}</span>` : ''}</div>` : ''}
                            </div>
                        `;
                        
                        group.querySelector('.chat-msg-column').appendChild(bubble);
                        inner.appendChild(group);
                        this._lastMsgEl = group;
                    }
                    
                    this._lastId = Math.max(this._lastId, msgId);
                    this._lastSenderId = senderId;
                } 
                else if (event.type === 'phone_approved') {
                    const pr = event.data;
                    const actionKey = 'approved-' + pr.id;
                    if (this._shownActionIds.has(actionKey)) return;
                    this._shownActionIds.add(actionKey);

                    const targetName = pr.nickname || pr.first_name;
                    const phone = pr.phone || 'Unavailable';
                    const el = document.createElement('div');
                    el.className = 'chat-system-msg';
                    el.style.cssText = 'background:linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.02)); border:1px solid rgba(16,185,129,0.2); border-radius:16px; padding:14px; margin-bottom:12px; width:100%; display:flex; flex-direction:column; gap:12px; box-shadow:0 4px 12px rgba(0,0,0,0.1);';
                    
                    const initials = ((pr.first_name?.[0] || '') + (pr.last_name?.[0] || '')).toUpperCase() || (pr.nickname?.[0] || '?').toUpperCase();
                    const avatarHtml = pr.profile_image 
                        ? `<img src="${CONFIG.ASSET_BASE}/${pr.profile_image}" style="width:32px; height:32px; object-fit:cover; border-radius:50%; flex-shrink:0; border:2px solid var(--c-bg-card);">`
                        : `<div style="display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; border-radius:50%; background:var(--g-primary); color:#fff; font-size:12px; font-weight:800; flex-shrink:0; border:2px solid var(--c-bg-card);">${initials}</div>`;
                    const codeHtml = pr.player_code ? `<span style="font-family:monospace; font-size:10px; color:var(--c-orange); opacity:0.9; background:rgba(247,148,29,0.1); padding:2px 4px; border-radius:4px;">${pr.player_code}</span>` : '';

                    el.innerHTML = `
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div style="position:relative;">
                                ${avatarHtml}
                                <div style="position:absolute; bottom:-4px; right:-4px; width:16px; height:16px; background:#10B981; border-radius:50%; border:2px solid var(--c-bg); display:flex; align-items:center; justify-content:center; font-size:8px; color:#fff;">✓</div>
                            </div>
                            <div style="display:flex; flex-direction:column; gap:2px; flex:1;">
                                <div style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
                                    <strong style="font-size:14px; color:var(--c-text);">${targetName}</strong>
                                    ${codeHtml}
                                </div>
                                <div style="font-size:11px; color:var(--c-text-muted);">Shared phone number</div>
                            </div>
                        </div>
                        <a href="tel:${phone}" style="display:flex; align-items:center; justify-content:center; gap:8px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.05); padding:10px 16px; border-radius:12px; text-decoration:none; color:var(--c-text); transition:background 0.2s;">
                            <span style="font-size:16px; opacity:0.8;">📞</span>
                            <span style="font-size:16px; font-weight:800; font-family:monospace; color:#10B981; letter-spacing:0.5px;">${phone}</span>
                        </a>
                    `;
                    if (inner) inner.appendChild(el);
                    
                    // Break the group
                    this._lastSenderId = 0;
                    this._lastMsgEl = null;
                }
            });
        } catch (e) {
            console.error("Chat rendering error:", e);
        }

        // --- NEW: System Actions Rendered at the Bottom ---

        // 1. Incoming prompts (Pending for me)
        pendingForMe.forEach(pr => {
            const notifId = 'phone-notif-pending-' + pr.id;
            if (document.getElementById(notifId)) return;
            const requesterName = pr.nickname || pr.first_name;
            const el = document.createElement('div');
            el.id = notifId;
            el.className = 'chat-system-msg';
            el.style.cssText = 'background:rgba(var(--c-primary-rgb,59,130,246),0.1); border:1px solid rgba(255,255,255,0.05); border-radius:14px; padding:12px 14px; display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:12px; width:100%;';
            el.innerHTML =
                '<div style="font-size:13px; color:var(--c-text); flex:1;">📞 <strong>' + requesterName + '</strong> wants your phone number</div>' +
                '<div style="display:flex; gap:8px; flex-shrink:0;">' +
                    '<button onclick="PhoneController.respond(' + pr.id + ',\'approve\')" style="background:var(--g-primary); border:none; border-radius:8px; padding:6px 14px; font-size:12px; font-weight:700; color:#fff; cursor:pointer;">Allow</button>' +
                    '<button onclick="PhoneController.respond(' + pr.id + ',\'deny\')" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:6px 14px; font-size:12px; font-weight:700; color:var(--c-text-muted); cursor:pointer;">Deny</button>' +
                '</div>';
            if (inner) inner.appendChild(el);
        });

        // 2. Cleanup: remove pending boxes locally if they were cancelled on the server
        const validPendingIds = new Set(pendingForMe.map(pr => 'phone-notif-pending-' + pr.id));
        if (inner) {
            inner.querySelectorAll('div[id^="phone-notif-pending-"]').forEach(el => {
                // Phase 6: Only remove if not valid and not already approved/handled in this session
                if (!validPendingIds.has(el.id) && !el.classList.contains('notif-handled')) {
                    el.remove();
                }
            });
        }


        if (initial || wasAtBottom || forceScroll) {
            if (initial) {
                container.scrollTop = container.scrollHeight;
            } else {
                container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
            }
        }
    },

    buildBubbleEl: function(msg, isMe) {
        const timeStr = new Date(msg.created_at).toLocaleTimeString('en-EG', { hour: '2-digit', minute: '2-digit' });
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble';
        bubble.dataset.msgId = msg.id;
        bubble.style.cssText = 'position:relative; background:' + (isMe ? 'var(--g-primary)' : 'var(--g-card)') + '; border:1px solid ' + (isMe ? 'transparent' : 'var(--c-border)') + '; border-radius:' + (isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px') + '; padding:7px 12px; font-size:14px; line-height:1.4; color:var(--c-text); word-break:break-word; max-width:100%;';

        bubble.innerHTML = this.escapeHtml(msg.message_text) + `<span style="float:right; font-size:9px; color:var(--c-text-muted); opacity:0.6; margin:6px -4px -2px 8px; vertical-align:bottom;">${timeStr}</span>`;
        return bubble;
    },



    sendMessage: async function() {
        if (this._sending) return;
        const input = document.getElementById('chat-input');
        if (!input) return;
        const text = input.value.trim();
        if (!text) return;
        this._sending = true;
        const btn = document.getElementById('chat-send-btn');
        if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }
        const res = await API.post('/chat/send', { match_id: this._matchId, message_text: text });
        this._sending = false;
        if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
        if (res && res.success) {
            input.value = '';
            this.autoResize(input);
            await this.loadMessages(false, true);
        }
    },

    handleKey: function(e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }
    },

    autoResize: function(el) {
        el.style.height = 'auto';
        const newHeight = Math.min(el.scrollHeight, 100);
        el.style.height = newHeight + 'px';
        el.style.overflowY = el.scrollHeight > 100 ? 'auto' : 'hidden';
    },


    escapeHtml: function(str) {
        if (!str) return '';
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
    }

};
window.ChatController = ChatController;


// Handle Browser Back Button for Chat Overlay
window.addEventListener('popstate', function(event) {
    if (ChatController && ChatController._isShowing) {
        // If we popped away from the chatOpen state, close the overlay
        if (!event.state || !event.state.chatOpen) {
            ChatController.close(true);
        }
    }
});

// ── Phase 5: Phone Controller ─────────────────────────────────────────────────

const PhoneController = {
    _requests: {},

    request: async function(target_user_id, match_id) {
        const cached = this._requests[target_user_id];
        // Only block duplicate API calls if the request is already actively pending or approved.
        if (cached && (cached.status === 'pending' || cached.status === 'approved')) { 
            this.updateBtn(target_user_id, cached.status, cached.phone || null); 
            return true; 
        }
        
        const btn = document.getElementById('phone-btn-' + target_user_id);
        if (btn) { btn.disabled = true; btn.textContent = '…'; }
        const res = await API.post('/phone/request', { match_id, target_user_id });
        if (!res || !res.success) {
            if (btn) { btn.disabled = false; btn.textContent = '📞 Request Phone'; }
            if (res && res.message) {
                const isBlocked = (res.status === 429);
                ConfirmModal.show({ 
                    title: isBlocked ? 'Maximum Attempts Reached' : 'Request Failed', 
                    message: res.message, 
                    confirmText: 'OK', 
                    showCancel: !isBlocked,
                    type: 'warning' 
                });
            }
            return false;
        }
        this._requests[target_user_id] = { status: res.data.status, request_id: res.data.request_id };
        this.updateBtn(target_user_id, res.data.status, null);
        return true;
    },

    cancel: async function(target_user_id, match_id) {
        const res = await API.post('/phone/cancel', { match_id, target_user_id });
        if (res && res.success) {
            delete this._requests[target_user_id];
            return true;
        }
        if (res && res.message) {
            ConfirmModal.show({ title: 'Cancel Failed', message: res.message, confirmText: 'OK', type: 'warning' });
        }
        return false;
    },



    respond: async function(request_id, action) {
        const res = await API.post('/phone/respond', { request_id, action });
        if (!res || !res.success) return;
        const notif = document.getElementById('phone-notif-pending-' + request_id);
        if (action === 'approve' && res.data.phone) {
            if (notif) {
                notif.innerHTML = '<span style="color:var(--c-orange);font-weight:700;">✅ Approved — <a href="tel:' + res.data.phone + '" style="color:inherit; text-decoration:underline;">' + res.data.phone + '</a></span>';
                notif.classList.add('notif-handled');
            }
        } else {
            if (notif) notif.remove();
        }
    },

    updateBtn: function(target_user_id, status, phone) {
        const btn = document.getElementById('phone-btn-' + target_user_id);
        if (!btn) return;

        btn.disabled = false;
        btn.style.pointerEvents = 'auto';

        if (status === 'pending') { 
            btn.innerHTML = 'Cancel request'; 
            btn.style.cssText = 'cursor:pointer; padding:6px 14px; background:var(--c-primary); color:#fff; border-radius:8px; font-size:12px; font-weight:700; white-space:nowrap;';
            btn.onclick = () => ChatController.cancelPhone(target_user_id, btn);
        }
        else if (status === 'approved' && phone) { 
            btn.innerHTML = '📞 ' + phone; 
            btn.style.cssText = 'cursor:pointer; padding:6px 14px; background:rgba(247,148,29,0.1); border:1px solid var(--c-orange); color:var(--c-orange); border-radius:8px; font-size:12px; font-weight:700; white-space:nowrap;';
            btn.onclick = (e) => {
                e.stopPropagation();
                window.location.href = 'tel:' + phone.replace(/\s+/g, '');
            };
        }
        else { // Denied, Cancelled, or otherwise invalid
            btn.innerHTML = '📞 Request Phone'; 
            btn.style.cssText = 'cursor:pointer; padding:6px 14px; background:rgba(255,255,255,0.1); color:#fff; border-radius:8px; font-size:12px; font-weight:700; white-space:nowrap;';
            btn.onclick = () => ChatController.requestPhone(target_user_id, btn);
        }
    }
};

// =============================================================================
// Phase 6 — NotificationsController
// =============================================================================
const NotificationsController = {
    _pollTimer: null,
    _isOpen: false,
    _inProgress: false,
    _notifications: [],
    _visuallyUnreadIds: new Set(),
    _offset: 0,
    _hasMore: true,
    _isLoading: false,

    // Called once on app init / nav sync
    init: function() {
        this.injectPanel();
        this.pollBadge();
        this._pollTimer = setInterval(() => NotificationsController.pollBadge(), 15000);
    },

    stop: function() {
        if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
    },

    pollBadge: async function() {
        if (!Auth.isAuthenticated() || this._inProgress) return;
        // Phase 6: Skip background notification polling if tab is hidden
        if (document.hidden) return;

        this._inProgress = true;
        try {
            const res = await API.post('/notifications/list', {});
            if (!res || !res.success) throw new Error('API failed');
            
            // Use global unread count from backend for the badge
            const unreadCount = parseInt(res.data.unread_count || 0);
            
            const badge = document.getElementById('nav-notif-badge');
            if (badge) {
                badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                badge.style.display = unreadCount > 0 ? 'flex' : 'none';
            }

            this._notifications = res.data.notifications || [];
            if (this._isOpen) this.renderList();
        } catch (e) {
            console.warn('Notification poll failed:', e.message);
        } finally {
            this._inProgress = false;
        }
    },

    open: async function() {
        if (this._isOpen) return;
        this._isOpen = true;
        const panel = document.getElementById('notif-panel');
        if (!panel) return;
        
        // Phase 6: Reset pagination and load first page
        this._offset = 0;
        this._hasMore = true;
        this._notifications = [];
        this.loadMore();

        // Hide badge immediately
        const badge = document.getElementById('nav-notif-badge');
        if (badge) badge.style.display = 'none';

        panel.classList.add('open');
    },

    close: function() {
        if (!this._isOpen) return;
        this._isOpen = false;
        
        const panel = document.getElementById('notif-panel');
        if (panel) panel.classList.remove('open');

        // Phase 6: Next time it opens, they appear as read
        this._visuallyUnreadIds.clear();
    },

    toggle: function() {
        this._isOpen ? this.close() : this.open();
    },

    loadMore: async function() {
        if (this._isLoading || !this._hasMore) return;
        this._isLoading = true;
        this.renderList(); // Show loading indicator at bottom

        try {
            const res = await API.post('/notifications/list', { limit: 20, offset: this._offset });
            if (!res || !res.success) throw new Error('API failed');

            const newNotifs = res.data.notifications || [];
            
            // Phase 6: Aggregate IDs for immediate "mark as read" logic
            const unreadIds = newNotifs.filter(n => !n.is_read).map(n => n.id);
            if (unreadIds.length > 0) {
                unreadIds.forEach(id => this._visuallyUnreadIds.add(id));
                this.markRead(unreadIds, true); // Silent update
            }

            this._notifications = this._notifications.concat(newNotifs);
            this._offset += newNotifs.length;
            this._hasMore = res.data.has_more;
        } catch (e) {
            console.error('Failed to load more notifications:', e);
            this._hasMore = false;
        } finally {
            this._isLoading = false;
            this.renderList();
        }
    },

    renderList: function() {
        const listEl = document.getElementById('notif-list');
        if (!listEl) return;
        
        try {
            const notifications = this._notifications;
            if (notifications.length === 0) {
                listEl.innerHTML = `
                    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:60px 20px; gap:16px; color:var(--c-text-muted);">
                        <div style="font-size:40px;">🔔</div>
                        <div style="font-size:14px; font-weight:600;">No notifications yet</div>
                        <div style="font-size:12px; opacity:0.6; text-align:center;">Actions in your matches will appear here</div>
                    </div>`;
                return;
            }

            const typeIcon = {
                match_joined: '🎾', team_invite: '👥', partner_confirmed: '✅',
                partner_denied: '✗', partner_blocked: '🚫', match_cancelled: '❌',
                player_withdrawn: '🚪', phone_requested: '📞', phone_approved: '📱', phone_denied: '🚫',
                new_message: '💬', score_submitted: '📊', score_confirmed: '🏆', score_disputed: '⚠️'
            };

            // Phase 6: Grouping (Aggregation) for new_message by match
            const grouped = [];
            const chatGroups = {}; // match_id -> index in grouped array

            notifications.forEach(n => {
                if (n.type === 'new_message' && n.reference_id) {
                    const mid = n.reference_id;
                    if (chatGroups[mid] !== undefined) {
                        const existing = grouped[chatGroups[mid]];
                        existing.is_group = true;
                        if (!existing.all_ids) existing.all_ids = [existing.id];
                        existing.all_ids.push(n.id);
                        existing.count = (existing.count || 1) + 1;
                        // Always keep the newest as the representative (notifications are already DESC)
                        // So we don't need to do anything else, just collect IDs
                        return;
                    } else {
                        chatGroups[mid] = grouped.length;
                    }
                }
                grouped.push({ ...n });
            });

            // Update text for groups
            grouped.forEach(n => {
                if (n.is_group) {
                    const others = n.count - 1;
                    n.group_suffix = ` and ${others} other message${others > 1 ? 's' : ''}`;
                }
            });

            const todayItems = grouped.filter(n => isToday(n.created_at));
            const earlierItems = grouped.filter(n => !isToday(n.created_at));

            const renderGroup = (label, items) => {
                if (items.length === 0) return '';
                return `
                    <div style="font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:1.5px; color:var(--c-text-muted); padding:16px 20px 8px; opacity:0.7;">${label}</div>
                    ${items.map(n => {
                        // Phase 6: Keep items blue if they were originally unread in this session
                        // For groups, check if the newest one is unread (representative)
                        const isReadVisually = n.is_read && !this._visuallyUnreadIds.has(n.id);
                        // Phase 6: Consistent avatar style with emoji badge
                        const emoji = typeIcon[n.type] || '🔔';
                        
                        let avatarContent = '';
                        if (n.sender_avatar) {
                            avatarContent = `<img src="${CONFIG.ASSET_BASE}/${n.sender_avatar}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
                        } else {
                            // Robust initial extraction
                            let initials = '';
                            if (n.sender_first_name || n.sender_last_name) {
                                initials = ((n.sender_first_name?.[0] || '') + (n.sender_last_name?.[0] || '')).toUpperCase();
                            } else if (n.sender_nickname) {
                                initials = n.sender_nickname[0].toUpperCase();
                            }
                            
                            // Last resort: Extract from message text (usually starts with sender name)
                            if (!initials && n.message_text) {
                                const firstChar = n.message_text.trim()[0];
                                if (firstChar && /[a-zA-Z0-9]/.test(firstChar)) {
                                    initials = firstChar.toUpperCase();
                                }
                            }

                            if (!initials) initials = 'P'; // Final fallback for Padeladd
                            
                            avatarContent = `<div style="width:100%; height:100%; border-radius:50%; background:var(--g-primary); display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:800; color:#fff;">${initials}</div>`;
                        }

                        const avatarHtml = `
                            <div style="position:relative; flex-shrink:0;">
                                <div style="width:40px; height:40px; border-radius:50%; border:1.5px solid rgba(255,255,255,0.08); overflow:hidden;">
                                    ${avatarContent}
                                </div>
                                <div style="position:absolute; bottom:-4px; right:-4px; width:22px; height:22px; background:var(--c-bg-card); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; border:2px solid var(--c-bg-card); box-shadow:0 2px 5px rgba(0,0,0,0.4); z-index:2;">
                                    ${emoji}
                                </div>
                            </div>
                        `;

                        return `
                        <div class="notif-item ${isReadVisually ? '' : 'notif-unread'}" onclick="NotificationsController.handleNotifClick(${JSON.stringify(n).replace(/"/g, '&quot;')})"
                             style="display:flex; align-items:flex-start; gap:12px; padding:14px 20px; cursor:pointer; transition:background 0.15s; border-bottom:1px solid rgba(255,255,255,0.04); position:relative;">
                            ${avatarHtml}
                            <div style="flex:1; min-width:0;">
                                <div style="font-size:13px; color:var(--c-text); line-height:1.4; font-weight:${isReadVisually ? '400' : '500'}; word-break:break-word;">
                                    ${n.message_text.replace(/: (.*)/, ': <span style="font-weight:700;">$1</span>')}${n.group_suffix || ''}
                                </div>
                                <div style="font-size:11px; color:var(--c-text-muted); margin-top:4px; opacity:0.7;">${relTime(n.created_at)}</div>
                            </div>
                            ${!isReadVisually ? '<div style="width:8px; height:8px; background:var(--c-primary); border-radius:50%; flex-shrink:0; margin-top:6px;"></div>' : ''}
                        </div>
                    `;}).join('')}
                `;
            };

            listEl.innerHTML = renderGroup('Today', todayItems) + renderGroup('Earlier', earlierItems);

            // Phase 6: Add loading indicator and scroll listener
            if (this._isLoading) {
                listEl.insertAdjacentHTML('beforeend', `
                    <div id="notif-loading" style="padding:20px; text-align:center; opacity:0.6; font-size:12px;">
                        <span class="chat-loader" style="width:16px; height:16px; display:inline-block; margin-right:8px;"></span> Loading more...
                    </div>
                `);
            } else if (this._hasMore) {
                listEl.insertAdjacentHTML('beforeend', `
                    <div id="load-more-trigger" style="height:20px;"></div>
                `);
            }

            // Simple intersection detection via scroll listener
            listEl.onscroll = () => {
                if (!this._hasMore || this._isLoading) return;
                const scrollPos = listEl.scrollTop + listEl.clientHeight;
                if (scrollPos >= listEl.scrollHeight - 50) {
                    this.loadMore();
                }
            };

        } catch (e) {
            console.error('Notification render failed:', e);
            listEl.innerHTML = '<div style="padding:40px; text-align:center; opacity:0.5;">Load error.</div>';
        }
    },

    handleNotifClick: async function(n) {
        // 1. Mark as read immediately if unread (handles groups too)
        if (!n.is_read) {
            const ids = n.all_ids || [n.id];
            await this.markRead(ids);
        }
        
        // 2. Clear badge and close panel
        this._visuallyUnreadIds.clear();
        this.close();

        // 3. Navigate based on type
        let navPath = n.match_code ? `/matches/${n.match_code}` : `/matches/view/${n.reference_id}`;
        
        switch (n.type) {
            case 'match_joined':
            case 'team_invite':
            case 'partner_confirmed':
            case 'player_withdrawn':
            case 'partner_denied':
            case 'score_submitted':
            case 'score_confirmed':
            case 'score_disputed':
            case 'match_cancelled':
            case 'availability_alert':
            case 'partner_blocked':
            case 'score_submitted':
            case 'score_approved':
            case 'score_disputed':
                Router.navigate(navPath);
                break;
            
            case 'new_message':
            case 'phone_requested':
            case 'phone_approved':
            case 'phone_denied':
                // Phase 6: Stack navigation so Back takes you to the match, not dashboard
                // First navigate to the match detail page
                Router.navigate(navPath); 
                
                // Then open the chat overlay which will push its own /chat state
                setTimeout(() => {
                    if (typeof ChatController !== 'undefined') ChatController.open(n.reference_id);
                }, 100);
                break;
            
            case 'partner_blocked':
                Router.navigate('/dashboard');
                break;
            
            default:
                // Default to dashboard if type is unknown but clicked
                Router.navigate('/dashboard');
        }
    },

    markRead: async function(ids, isSilent = false) {
        const res = await API.post('/notifications/read', { ids });
        if (res && res.success) {
            ids.forEach(id => {
                const n = this._notifications.find(n => n.id === id);
                if (n) n.is_read = true;
            });

            if (!isSilent) {
                const count = res.data.unread_count;
                const badge = document.getElementById('nav-notif-badge');
                if (badge) {
                    badge.textContent = count;
                    badge.style.display = count > 0 ? 'flex' : 'none';
                }
                this.renderList();
            }
        }
    },

    markAllRead: async function() {
        const res = await API.post('/notifications/read', { all: true });
        if (res && res.success) {
            this._notifications.forEach(n => n.is_read = true);
            this._visuallyUnreadIds.clear(); // Clear visual persistent state on manual "Mark all read"
            const badge = document.getElementById('nav-notif-badge');
            if (badge) badge.style.display = 'none';
            this.renderList();
        }
    },

    injectPanel: function() {
        if (document.getElementById('notif-panel')) return;
        const panel = document.createElement('div');
        panel.id = 'notif-panel';
        panel.innerHTML = `
            <div id="notif-panel-overlay" onclick="NotificationsController.close()" style="position:fixed; inset:0; z-index:8998; background:rgba(0,0,0,0.5); display:none;"></div>
            <div id="notif-panel-inner" style="
                position:fixed; top:0; right:0; height:100dvh; width:min(380px, 100vw);
                background:var(--c-bg-card); border-left:1px solid var(--c-border);
                z-index:8999; display:flex; flex-direction:column;
                transform:translateX(100%); transition:transform 0.3s cubic-bezier(0.4,0,0.2,1);
                box-shadow:-8px 0 32px rgba(0,0,0,0.4);
            ">
                <div style="display:flex; align-items:center; justify-content:space-between; padding:20px; border-bottom:1px solid var(--c-border); flex-shrink:0;">
                    <div style="font-size:16px; font-weight:800; letter-spacing:0.5px;">🔔 Notifications</div>
                    <div style="display:flex; gap:8px; align-items:center;">

                        <button onclick="NotificationsController.close()" style="background:transparent; border:none; color:var(--c-text); cursor:pointer; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:8px;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>
                </div>
                <div id="notif-list" style="flex:1; overflow-y:auto; overscroll-behavior:contain;"></div>
            </div>
        `;
        document.getElementById('app').appendChild(panel);

        // CSS for panel open state
        const style = document.createElement('style');
        style.textContent = `
            #notif-panel.open #notif-panel-overlay { display:block !important; }
            #notif-panel.open #notif-panel-inner { transform:translateX(0) !important; }
            .notif-item:hover { background:rgba(255,255,255,0.03); }
            .notif-unread { background:rgba(var(--c-primary-rgb, 59,130,246),0.05); }
            .notif-unread:hover { background:rgba(var(--c-primary-rgb, 59,130,246),0.08) !important; }
        `;
        document.head.appendChild(style);
    }
};

// -------------------------------------------------------
//  PHASE 7: SCORING CONTROLLER
// -------------------------------------------------------
const ScoringController = {
    _match: null,
    _composition: null,
    _scoreData: {
        s1_t1: 0, s1_t2: 0,
        s2_t1: 0, s2_t2: 0,
        s3_t1: 0, s3_t2: 0
    },

    initScoreSubmission: function(match) {
        this._match = match;
        this._scoreData = { s1_t1: 0, s1_t2: 0, s2_t1: 0, s2_t2: 0, s3_t1: 0, s3_t2: 0 };
        this._composition = null; // Default: match original teams
        
        const modal = document.createElement('div');
        modal.id = 'scoring-modal-overlay';
        modal.className = 'loading-overlay';
        modal.style.zIndex = '10000';
        modal.onclick = (e) => { if(e.target === modal) this.closeModal(); };
        modal.innerHTML = `
            <div class="scoring-modal">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
                    <h2 style="font-size:20px; font-weight:800; margin:0;">Submit Match Score</h2>
                    <button onclick="ScoringController.closeModal()" class="modal-close-btn">&times;</button>
                </div>
                
                <div class="score-grid">
                    <div class="score-team">
                        <div class="score-team-name">Team A</div>
                        <div id="team-a-nicknames" style="font-size:11px; color:var(--c-text-muted); font-weight:600; margin-bottom:12px; margin-top:-8px; text-transform:uppercase; letter-spacing:0.5px;"></div>
                        <div class="score-inputs" id="t1-inputs">
                            ${this._renderSetInputs(1, 1)}
                            ${this._renderSetInputs(2, 1)}
                            ${this._renderSetInputs(3, 1)}
                        </div>
                    </div>
                    <div style="font-size:18px; font-weight:800; color:var(--c-text-dim); margin-top:28px;">VS</div>
                    <div class="score-team">
                        <div class="score-team-name">Team B</div>
                        <div id="team-b-nicknames" style="font-size:11px; color:var(--c-text-muted); font-weight:600; margin-bottom:12px; margin-top:-8px; text-transform:uppercase; letter-spacing:0.5px;"></div>
                        <div class="score-inputs" id="t2-inputs">
                            ${this._renderSetInputs(1, 2)}
                            ${this._renderSetInputs(2, 2)}
                            ${this._renderSetInputs(3, 2)}
                        </div>
                    </div>
                </div>

                <div class="composition-switch">
                    <div class="comp-header">
                        <span class="comp-title">Teams/Partners changed?</span>
                        <button class="btn btn-sm btn-secondary" onclick="ScoringController.toggleComposition()">Switch Teams</button>
                    </div>
                    <div id="comp-editor" style="display:none;">
                        <p style="font-size:11px; color:var(--c-text-muted); margin-bottom:12px;">Click a player to toggle their team (must have 2 per team).</p>
                        <div class="comp-players" id="comp-players-list"></div>
                        <div class="field-error" id="err-composition" style="margin-top:12px; text-align:center;"></div>
                    </div>
                </div>

                <button class="btn btn-primary" onclick="ScoringController.submitScore()">Submit Results →</button>
                <p style="text-align:center; font-size:11px; color:var(--c-text-dim); margin-top:16px;">Opponents must approve the score for points to count.</p>
            </div>
        `;
        document.body.appendChild(modal);
        this._updateNicknames();
    },

    _updateNicknames: function() {
        const teamA = document.getElementById('team-a-nicknames');
        const teamB = document.getElementById('team-b-nicknames');
        if (!teamA || !teamB) return;

        const players = this._composition || MatchesController._currentMatchSlots.map(s => ({
            user_id: parseInt(s.user_id),
            team_no: parseInt(s.team_no),
            name: s.nickname || s.first_name
        }));

        const listA = players.filter(p => p.team_no == 1);
        const listB = players.filter(p => p.team_no == 2);

        if (listA.length === 2 && listB.length === 2) {
            teamA.textContent = listA.map(p => p.name).join(' / ');
            teamB.textContent = listB.map(p => p.name).join(' / ');
        } else {
            teamA.textContent = '';
            teamB.textContent = '';
        }
    },

    _renderSetInputs: function(set, team) {
        return `
            <div class="set-input-group-wrapper">
                <div class="set-input-group">
                    <span class="set-label">SET ${set}</span>
                    <div class="set-control">
                        <div class="btn-score-adj" onclick="ScoringController.adjustScore(${set}, ${team}, -1)">-</div>
                        <span class="set-val" id="val-s${set}-t${team}">0</span>
                        <div class="btn-score-adj" onclick="ScoringController.adjustScore(${set}, ${team}, 1)">+</div>
                    </div>
                </div>
                <div class="field-error" id="err-s${set}-t${team}"></div>
            </div>
        `;
    },

    adjustScore: function(set, team, delta) {
        const key = `s${set}_t${team}`;
        let newVal = this._scoreData[key] + delta;
        if (newVal < 0) newVal = 0;
        if (newVal > 7) newVal = 7;
        
        this._scoreData[key] = newVal;
        const el = document.getElementById(`val-s${set}-t${team}`);
        if (el) el.textContent = newVal;
    },

    toggleComposition: function() {
        const editor = document.getElementById('comp-editor');
        if (editor.style.display === 'none') {
            editor.style.display = 'block';
            this._renderComposition();
        } else {
            editor.style.display = 'none';
            this._composition = null;
            this._updateNicknames();
        }
    },

    _renderComposition: function() {
        if (!this._composition) {
            // Initial state from match slots
            this._composition = MatchesController._currentMatchSlots.map(s => ({
                user_id: parseInt(s.user_id),
                team_no: parseInt(s.team_no),
                slot_no: parseInt(s.slot_no),
                name: s.nickname || s.first_name
            }));
        }

        const list = document.getElementById('comp-players-list');
        if (!list) return;

        list.innerHTML = this._composition.map((p, idx) => `
            <div class="comp-player-card ${p.team_no == 1 ? 'active-t1' : 'active-t2'}" onclick="ScoringController.switchPlayerTeam(${idx})">
                <div style="font-size:10px; font-weight:800; color:${p.team_no == 1 ? 'var(--c-primary)' : 'var(--c-orange)'}">${p.team_no == 1 ? 'A' : 'B'}</div>
                <div style="font-size:12px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}</div>
            </div>
        `).join('');
    },

    switchPlayerTeam: function(idx) {
        const p = this._composition[idx];
        p.team_no = p.team_no == 1 ? 2 : 1;
        this._renderComposition();
        this._updateNicknames();
    },

    closeModal: function() {
        const modal = document.getElementById('scoring-modal-overlay');
        if (modal) modal.remove();
    },

    submitScore: async function() {
        const btn = document.querySelector('.scoring-modal .btn-primary');
        if (btn && btn.disabled) return;

        let hasErrors = false;
        
        // Clear previous errors
        document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
        document.querySelectorAll('.set-input-group').forEach(el => el.classList.remove('error'));

        const s1_t1 = this._scoreData.s1_t1, s1_t2 = this._scoreData.s1_t2;
        const s2_t1 = this._scoreData.s2_t1, s2_t2 = this._scoreData.s2_t2;
        const s3_t1 = this._scoreData.s3_t1, s3_t2 = this._scoreData.s3_t2;

        const checkSet = (t1, t2, setNum) => {
            if (t1 === 0 && t2 === 0) return null; // Set not played
            
            // Padel set rules: 6-0 to 6-4, 7-5, 7-6
            const isT1Winner = (t1 === 6 && t2 <= 4) || (t1 === 7 && (t2 === 5 || t2 === 6));
            const isT2Winner = (t2 === 6 && t1 <= 4) || (t2 === 7 && (t1 === 5 || t1 === 6));
            
            if (!isT1Winner && !isT2Winner) {
                this._showFieldError(`s${setNum}-t1`, 'Invalid set score');
                this._showFieldError(`s${setNum}-t2`, 'Invalid set score');
                return 'error';
            }
            return isT1Winner ? 1 : 2;
        };

        const w1 = checkSet(s1_t1, s1_t2, 1);
        const w2 = checkSet(s2_t1, s2_t2, 2);
        const w3 = checkSet(s3_t1, s3_t2, 3);

        if (w1 === 'error' || w2 === 'error' || w3 === 'error') hasErrors = true;

        if (!hasErrors) {
            // Match-level validation
            if (!w1) {
                this._showFieldError('s1-t1', 'Set 1 is required');
                hasErrors = true;
            } else if (w1 && w2) {
                const team1Sets = (w1 === 1 ? 1 : 0) + (w2 === 1 ? 1 : 0) + (w3 === 1 ? 1 : 0);
                const team2Sets = (w1 === 2 ? 1 : 0) + (w2 === 2 ? 1 : 0) + (w3 === 2 ? 1 : 0);
                
                if (team1Sets < 2 && team2Sets < 2) {
                    this._showFieldError('s3-t1', 'Deciding set required (1-1)');
                    this._showFieldError('s3-t2', 'Deciding set required (1-1)');
                    hasErrors = true;
                }
                
                // If 3rd set is played, ensure 1st and 2nd sets were split
                if (w3 && w1 === w2) {
                    this._showFieldError('s3-t1', 'Not needed (2-0)');
                    this._showFieldError('s3-t2', 'Not needed (2-0)');
                    hasErrors = true;
                }
            } else if (w1 && !w2) {
                this._showFieldError('s2-t1', 'Set 2 is required');
                hasErrors = true;
            }
        }

        // Validate composition (2 per team)
        if (this._composition) {
            const t1 = this._composition.filter(x => x.team_no == 1).length;
            const t2 = this._composition.filter(x => x.team_no == 2).length;
            if (t1 !== 2 || t2 !== 2) {
                this._showFieldError('composition', 'Each team must have exactly 2 players.');
                hasErrors = true;
            }
            
            // Assign slot numbers within teams
            let t1_count = 0, t2_count = 0;
            this._composition.forEach(p => {
                if (p.team_no == 1) p.slot_no = ++t1_count;
                else p.slot_no = ++t2_count;
            });
        }

        if (hasErrors) return;

        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Submitting...';
        }

        const payload = {
            match_id: this._match.id,
            s1_t1, s1_t2, s2_t1, s2_t2, s3_t1, s3_t2,
            composition: this._composition
        };

        const res = await API.post('/score/submit', payload);
        if (res && res.success) {
            Toast.show('Score submitted for review!', 'success');
            this.closeModal();
            MatchesController.loadDetails({ match_id: this._match.id }); // Refresh
        } else {
            Toast.show(res ? res.message : 'Submission failed', 'error');
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Submit Results →';
            }
        }
    },

    _showFieldError: function(fieldId, msg) {
        const errEl = document.getElementById(`err-${fieldId}`);
        const groupEl = errEl?.previousElementSibling;
        if (errEl) errEl.textContent = msg;
        if (groupEl) groupEl.classList.add('error');
    },

    approveScore: async function(scoreId) {
        const confirmed = await ConfirmModal.show({
            title: 'Approve Result',
            message: 'Are you sure you want to approve this score? This will finalize the match and update everyone\'s points.',
            confirmText: 'Approve Result'
        });
        if (!confirmed) return;

        const res = await API.post('/score/approve', { score_id: scoreId });
        if (res && res.success) {
            Toast.show('Score approved! Points updated.', 'success');
            MatchesController.loadDetails({ match_id: MatchesController._currentMatchId });
            UI.syncNav();
        } else {
            Toast.show(res ? res.message : 'Approval failed', 'error');
        }
    },

    disputeScore: async function(scoreId) {
        const reason = await ConfirmModal.show({
            title: 'Dispute Score',
            message: 'Please provide a brief reason why you are disputing this result.',
            showInput: true,
            inputPlaceholder: 'Wrong score / I was in a different team...',
            confirmText: 'Send Dispute',
            type: 'warning'
        });
        
        if (!reason) return;

        const res = await API.post('/score/dispute', { score_id: scoreId, reason });
        if (res && res.success) {
            Toast.show('Dispute recorded. Our team will review it.', 'warning');
            MatchesController.loadDetails({ match_id: MatchesController._currentMatchId });
        } else {
            Toast.show(res ? res.message : 'Dispute failed', 'error');
        }
    },

    reportIssue: async function(matchId, targetUserId = null) {
        const reason = await ConfirmModal.show({
            title: targetUserId ? 'Report Player' : 'Report Match Issue',
            message: 'Please describe the issue you encountered.',
            showInput: true,
            inputPlaceholder: 'Unfair behavior / App issue...',
            confirmText: 'Submit Report',
            type: 'warning'
        });

        if (!reason) return;

        const res = await API.post('/match/report', { match_id: matchId, target_user_id: targetUserId, reason });
        if (res && res.success) {
            Toast.show('Report submitted successfully.', 'success');
        } else {
            Toast.show(res ? res.message : 'Report failed', 'error');
        }
    }
};

// -------------------------------------------------------
//  RANKING PAGE CONTROLLER
// -------------------------------------------------------
const RankingController = {
    _currentTab: 'male',
    _fullList: [],
    _cache: {}, // Stores ranking data per gender

    init: async function() {
        await UI.syncNav();
        this.loadData();
    },

    switchTab: function(gender) {
        this._currentTab = gender;
        
        // Update UI buttons
        const mBtn = document.getElementById('rank-tab-male');
        const fBtn = document.getElementById('rank-tab-female');
        if (mBtn && fBtn) {
            mBtn.classList.toggle('active', gender === 'male');
            fBtn.classList.toggle('active', gender === 'female');
        }

        this.loadData();
    },

    loadData: async function(isSilent = false) {
        const listEl = document.getElementById('ranking-full-list');
        if (!listEl) return;

        const cacheKey = this._currentTab;
        const hasCache = this._cache[cacheKey];

        // Only show skeletons if we have no cache
        if (!isSilent && !hasCache) {
            listEl.innerHTML = '<div class="rank-row-skeleton"></div>'.repeat(8);
        }

        // If we have cache, render it immediately
        if (!isSilent && hasCache) {
            this._fullList = hasCache;
            this.render(hasCache);
        }

        // Fetch larger list for the full page (limit 100)
        const res = await API.post('/ranking/list', { gender: this._currentTab, limit: 100 });
        
        if (!res || !res.success) {
            if (!isSilent && !hasCache) {
                listEl.innerHTML = '<div style="padding:80px; text-align:center; color:var(--c-text-muted);">Failed to load ranking. Please try again.</div>';
            }
            return;
        }

        // Compare with cache to prevent redundant render
        const responseJson = JSON.stringify(res.data.ranking);
        if (isSilent && this._cache[cacheKey + '_json'] === responseJson) {
            return;
        }

        this._cache[cacheKey] = res.data.ranking;
        this._cache[cacheKey + '_json'] = responseJson;
        this._fullList = res.data.ranking;
        this.render(this._fullList);
    },

    handleSearch: function(query) {
        const q = query.toLowerCase().trim();
        
        const clearBtn = document.getElementById('rank-search-clear');
        if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';

        if (!q) {
            this.render(this._fullList);
            return;
        }

        const filtered = this._fullList.filter(r => 
            r.nickname.toLowerCase().includes(q) || 
            r.first_name.toLowerCase().includes(q) || 
            r.last_name.toLowerCase().includes(q) ||
            r.player_code.toUpperCase().includes(q.toUpperCase())
        );
        this.render(filtered);
    },

    clearSearch: function() {
        const input = document.getElementById('rank-search');
        if (input) {
            input.value = '';
            this.handleSearch('');
        }
    },

    render: function(list) {
        const listEl = document.getElementById('ranking-full-list');
        if (!listEl) return;

        if (list.length === 0) {
            listEl.innerHTML = '<div style="padding:100px 20px; text-align:center; color:var(--c-text-muted);"><div style="font-size:40px; margin-bottom:16px;">🔍</div>No players found.</div>';
            return;
        }

        let html = '';
        list.forEach(r => {
            const pointsColor = r.rank <= 3 ? 'var(--c-orange)' : '#fff';
            const initials = ((r.first_name?.[0] || '') + (r.last_name?.[0] || '')).toUpperCase() || (r.nickname?.[0] || '?').toUpperCase();
            const fallbackHtml = `<div style='width:40px; height:40px; border-radius:50%; border:2px solid var(--c-border); flex-shrink:0; background:var(--g-primary); display:flex; align-items:center; justify-content:center; font-size:16px; font-weight:800; color:#fff;'>${initials}</div>`;
            
            const avatarHtml = r.profile_image 
                ? `<img src="${CONFIG.ASSET_BASE}/${r.profile_image}" onerror="this.onerror=null; this.outerHTML=\`${fallbackHtml}\`;" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:2px solid var(--c-border); flex-shrink:0;">`
                : fallbackHtml;
            
            html += `
                <div onclick="Router.navigate('/profile/view/${r.player_code}')" class="rank-grid-full" style="padding:18px 20px; align-items:center; border-bottom:1px solid rgba(255,255,255,0.03); cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
                    <span style="font-size:18px; font-weight:900; color:${r.rank <= 3 ? 'var(--c-orange)' : 'var(--c-text-dim)'};">#${r.rank}</span>
                    
                    <div style="display:flex; align-items:center; gap:12px; min-width:0; overflow:hidden;">
                        ${avatarHtml}
                        <div style="min-width:0; overflow:hidden;">
                            <div style="font-size:15px; font-weight:700; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${r.nickname}</div>
                            <div style="display:flex; align-items:center; gap:8px; margin-top:3px;">
                                <span style="font-size:10px; background:rgba(255,255,255,0.1); padding:1px 5px; border-radius:4px; color:var(--c-text-muted); font-family:monospace; font-weight:700; text-transform:uppercase;">${r.player_code}</span>
                                <span style="font-size:12px; color:var(--c-text-muted); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${r.first_name} ${r.last_name}</span>
                            </div>
                        </div>
                    </div>

                    <span class="hide-mobile" style="text-align:center; font-size:14px; font-weight:600; color:var(--c-text-muted);">${r.age || '—'}</span>
                    <span class="hide-mobile" style="text-align:center; font-size:14px; font-weight:700; color:var(--c-text);">${r.matches_played}</span>
                    <span class="hide-mobile" style="text-align:right; font-size:14px; font-weight:700; color:var(--c-green);">${r.win_rate}%</span>
                    <span class="hide-mobile" style="text-align:right; font-size:13px; font-weight:800; color:${r.points_this_week > 0 ? 'var(--c-green)' : r.points_this_week < 0 ? '#ef4444' : 'var(--c-text-muted)'};">${r.points_this_week > 0 ? '+' : ''}${r.points_this_week !== 0 ? r.points_this_week : '—'}</span>
                    <span style="text-align:right; font-size:16px; font-weight:900; color:${pointsColor};">${r.points >= 0 ? '+' : ''}${r.points}</span>
                </div>
            `;
        });
        listEl.innerHTML = html;
    }
};
