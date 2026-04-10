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
    },
    clearErrors: function(form) {
        form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
        form.querySelectorAll('.form-error').forEach(el => el.style.display = 'none');
    }
};

const AuthController = {
    initLogin: function() {
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
                    if (Auth.hasProfile()) {
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
                 }
                 updateUI();
             }
        };

        if (!userId) {
            if (Auth.isAuthenticated()) { Router.navigate('/dashboard'); return; }
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

    init: async function() {
        const res = await API.post('/profile/get', {});
        if (!res || !res.success) return;

        const { user, profile, stats } = res.data;
        DashboardController._currentUser = user;

        // Welcome name
        const nameEl = document.getElementById('dash-name');
        if (nameEl) nameEl.textContent = profile?.nickname || user.first_name;

        // Nav avatar
        const av = document.getElementById('nav-avatar');
        if (av) av.textContent = (user.first_name[0] + user.last_name[0]).toUpperCase();

        // Stats
        const rankEl = document.getElementById('dash-ranking');
        if (rankEl) rankEl.textContent = stats.ranking ?? '—';

        const highEl = document.getElementById('dash-highest-rank');
        if (highEl && stats.highest_ranking) highEl.textContent = `${stats.highest_ranking} Highest rank`;

        const ptsEl = document.getElementById('dash-points');
        if (ptsEl) ptsEl.textContent = stats.points;

        const pwEl = document.getElementById('dash-points-week');
        if (pwEl && stats.points_this_week > 0) pwEl.textContent = `+${stats.points_this_week} this week`;

        const mEl = document.getElementById('dash-matches-count');
        if (mEl) mEl.textContent = stats.matches_played;

        const wlEl = document.getElementById('dash-wl');
        if (wlEl && stats.matches_played > 0) wlEl.textContent = `${stats.matches_won}W / ${stats.matches_lost}L`;

        const wrEl = document.getElementById('dash-winrate');
        if (wrEl) wrEl.textContent = stats.win_rate + '%';

        // Matches
        const matchRes = await API.post('/matches/user', {});
        if (matchRes && matchRes.success) {
            DashboardController._allMatches = matchRes.data.matches;
            const upcoming = matchRes.data.matches.filter(m => m.status === 'upcoming').length;
            const upCountEl = document.getElementById('dash-upcoming-count');
            if (upCountEl) upCountEl.textContent = upcoming;
        }
        DashboardController.renderMatches();

        // Ranking (placeholder — real API in Phase 8)
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
        if (upco) {
            upco.style.borderBottomColor = tab === 'upcoming' ? 'var(--c-primary)' : 'transparent';
            upco.style.color = tab === 'upcoming' ? 'var(--c-text)' : 'var(--c-text-muted)';
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
        listEl.innerHTML = filtered.map(m => DashboardController.renderMatchCard(m, uid)).join('');
    },

    renderMatchCard: function(m, userId) {
        const userTeam = m.user_team;
        const myTeam  = userTeam === 'a' ? m.team_a : m.team_b;
        const oppTeam = userTeam === 'a' ? m.team_b : m.team_a;
        const myScore  = userTeam === 'a' ? m.score_a : m.score_b;
        const oppScore = userTeam === 'a' ? m.score_b : m.score_a;
        const won = m.winner_team === userTeam;
        const isCompleted = m.status === 'completed';
        const winnerColor = won ? 'var(--c-green)' : 'var(--c-red)';
        const scoreColor = isCompleted ? winnerColor : 'var(--c-text-muted)';
        const dateStr = m.scheduled_at
            ? new Date(m.scheduled_at).toLocaleDateString('en-US', { weekday:'long', hour:'2-digit', minute:'2-digit' })
            : 'TBD';

        const renderTeamRow = (players, score, isWinner) => players.map((p, i) => `
            <div style="display:grid; grid-template-columns:18px 1fr auto auto; align-items:center; gap:8px; padding:6px 0; border-bottom:${i === 0 ? '1px solid var(--c-border)' : 'none'};">
                <div style="color:${isWinner?'var(--c-orange)':'transparent'}; font-size:10px;">▶</div>
                <span style="font-size:13px; font-weight:700;">${p.name || '—'}</span>
                <span style="font-size:10px; color:var(--c-text-dim); background:var(--c-bg-secondary); border-radius:4px; padding:2px 6px;">P${i+1}</span>
                <span style="font-size:14px; font-weight:800; color:${isWinner?'var(--c-orange)':'var(--c-text)'}; min-width:20px; text-align:right;">${score ?? '—'}</span>
            </div>
        `).join('');

        return `
        <div style="background:var(--c-bg-card); border:1px solid var(--c-border); border-radius:var(--r-lg); padding:14px 16px; margin-bottom:10px; cursor:pointer; transition:border-color 0.2s;" onmouseover="this.style.borderColor='var(--c-text-dim)'" onmouseout="this.style.borderColor='var(--c-border)'">
            <div style="font-size:12px; color:var(--c-text-muted); font-weight:600; margin-bottom:10px;">${m.venue || 'Venue TBD'} · ${dateStr}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0;">
                <div style="padding-right:12px; border-right:1px solid var(--c-border);">
                    ${renderTeamRow(m.team_a, m.score_a, m.winner_team === 'a')}
                </div>
                <div style="padding-left:12px;">
                    ${renderTeamRow(m.team_b, m.score_b, m.winner_team === 'b')}
                </div>
            </div>
        </div>`;
    },

    renderRanking: function() {
        const listEl = document.getElementById('dash-ranking-list');
        if (!listEl) return;
        // Placeholder rows until Phase 8 leaderboard API
        listEl.innerHTML = `<div class="empty-state" style="padding:40px 0;"><div class="empty-icon">🏅</div><h3>Ranking coming soon</h3><p>Full leaderboard available in Phase 8.</p></div>`;
    }
};



// -------------------------------------------------------
//  PROFILE VIEW CONTROLLER
// -------------------------------------------------------
const ProfileViewController = {
    init: async function() {
        const res = await API.post('/profile/get', {});
        if (!res || !res.success) return;
        const { user, profile, stats } = res.data;

        // Avatar
        const av = document.getElementById('prof-avatar');
        if (av) av.textContent = (user.first_name[0] + user.last_name[0]).toUpperCase();

        // Name
        const nameEl = document.getElementById('prof-name');
        if (nameEl) nameEl.textContent = (profile?.nickname || user.first_name + ' ' + user.last_name);

        // Player code
        const codeEl = document.getElementById('prof-code');
        if (codeEl) {
            if (profile?.player_code) {
                codeEl.textContent = profile.player_code;
                codeEl.style.display = 'inline-flex';
            } else {
                codeEl.style.display = 'none';
            }
        }

        // Meta pills (gender, location, hand)
        const metaEl = document.getElementById('prof-meta');
        if (metaEl) {
            const items = [];
            if (profile?.gender) items.push(`<span style='font-size:12px; color:var(--c-text-muted); display:flex; align-items:center; gap:4px;'>${profile.gender === 'male' ? '♂' : '♀'} ${profile.gender}</span>`);
            if (profile?.location) items.push(`<span style='font-size:12px; color:var(--c-text-muted); display:flex; align-items:center; gap:4px;'>📍 ${profile.location}</span>`);
            if (profile?.playing_hand) items.push(`<span style='font-size:12px; color:var(--c-text-muted); display:flex; align-items:center; gap:4px;'>✋ ${profile.playing_hand} hand</span>`);
            if (profile?.age) items.push(`<span style='font-size:12px; color:var(--c-text-muted);'>Age ${profile.age}</span>`);
            metaEl.innerHTML = items.join('');
        }

        // Rank badge
        const rankVal = document.getElementById('prof-rank-val');
        if (rankVal) rankVal.textContent = stats.ranking ?? '—';

        // Bio
        const bioEl = document.getElementById('prof-bio');
        if (bioEl && profile?.bio) {
            bioEl.textContent = profile.bio;
            bioEl.style.display = 'block';
        }

        // Stats mini grid
        const pvPts = document.getElementById('pv-points');
        if (pvPts) pvPts.textContent = stats.points;
        const pvRank = document.getElementById('pv-rank');
        if (pvRank) pvRank.textContent = stats.ranking ?? '—';
        const pvWR = document.getElementById('pv-winrate');
        if (pvWR) pvWR.textContent = stats.win_rate + '%';
        const pvM = document.getElementById('pv-matches');
        if (pvM) pvM.textContent = stats.matches_played;

        // Matches list
        const matchRes = await API.post('/matches/user', {});
        const listEl = document.getElementById('pv-matches-list');
        if (listEl) {
            if (!matchRes || !matchRes.success || matchRes.data.matches.length === 0) {
                listEl.innerHTML = `<div class='empty-state'><div class='empty-icon'>🎾</div><h3>No matches yet</h3><p>Create or join a match to start tracking results.</p></div>`;
            } else {
                listEl.innerHTML = matchRes.data.matches.map(m => DashboardController.renderMatchCard(m, user.id)).join('');
            }
        }
    }
};

const ProfileController = {
    initEdit: function() {
        const form = document.getElementById('profile-form');
        if (!form) return;

        // Populate days
        const daySelect = form.dob_day;
        for (let i = 1; i <= 31; i++) {
            const val = i.toString().padStart(2, '0');
            daySelect.options.add(new Option(i, val));
        }

        // Populate years (1950 - 2018)
        const yearSelect = form.dob_year;
        const currentYear = new Date().getFullYear();
        for (let i = currentYear - 6; i >= 1950; i--) {
            yearSelect.options.add(new Option(i, i));
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            UI.clearErrors(form);

            if (!form.dob_day.value) { UI.showError('dob_day', 'Select day', form); return; }
            if (!form.dob_month.value) { UI.showError('dob_month', 'Select month', form); return; }
            if (!form.dob_year.value) { UI.showError('dob_year', 'Select year', form); return; }
            if (!form.gender.value) { UI.showError('gender', 'Please select gender', form); return; }
            if (!form.playing_hand.value) { UI.showError('playing_hand', 'Please select playing hand', form); return; }

            const dob = `${form.dob_year.value}-${form.dob_month.value}-${form.dob_day.value}`;

            const payload = {
                date_of_birth: dob,
                gender: form.gender.value,
                playing_hand: form.playing_hand.value,
                nickname: form.nickname.value,
                location: form.location.value,
                bio: form.bio.value
            };
            
            const res = await API.post('/profile/update', payload);
            if (res && res.success) {
                Auth.setHasProfile(true);
                Router.navigate('/dashboard');
            } else {
                Toast.show(res ? res.message : 'Failed to save profile');
            }
        });
    }
};
