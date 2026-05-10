var FX = {
    ignite: function (el) {
        if (!el) return;
        el.classList.remove('ignite');
        void el.offsetWidth; // Trigger reflow
        el.classList.add('ignite');

        // Remove class after animation
        setTimeout(() => {
            el.classList.remove('ignite');
        }, 650);
    }
};

var SoundManager = {
    _sounds: {
        tap: new Audio('assets/sounds/tap.mp3'),
        success: new Audio('assets/sounds/success.mp3'),
        notify: new Audio('assets/sounds/notify.mp3')
    },
    play: function (type) {
        if (typeof Audio === 'undefined') return;
        const s = this._sounds[type];
        if (s) {
            s.currentTime = 0;
            s.play().catch(e => { }); // Silent fail if blocked by browser
        }
    },
    init: function () {
        if (typeof Audio === 'undefined') return;
        // Global tap listener for all buttons, links and clickable items
        document.addEventListener('click', (e) => {
            const el = e.target.closest('button, a, .nav-item, [onclick], .clickable');
            if (el && !el.hasAttribute('data-no-sound')) {
                this.play('tap');
            }
        }, true);
    }
};

var Toast = {
    show: function (message, type = 'info', duration = 5000) {
        // Create container if not exists
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }

        // Create the toast element
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        let icon = '🔔';
        if (type === 'success') icon = '✅';
        if (type === 'error') icon = '❌';
        if (type === 'warning') icon = '⚠️';

        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <span class="toast-message">${message}</span>
            <span class="toast-close" style="margin-left:12px; cursor:pointer; opacity:0.6; font-weight:900; font-size:12px;" onclick="this.parentElement.remove()">✕</span>
        `;

        container.appendChild(toast);

        // Auto-remove after specified duration
        if (duration > 0) {
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.style.opacity = '0';
                    toast.style.transform = 'translateY(-20px)';
                    setTimeout(() => { if (toast.parentElement) toast.remove(); }, 300);
                }
            }, duration);
        }
    }
};

var ConfirmModal = {
    _modal: null,
    _resolve: null,
    _isOpen: false,

    show: function ({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', showCancel = true, thirdText = null, thirdColor = 'var(--c-secondary)', type = 'info', showInput = false, inputPlaceholder = 'Enter reason...', inputMaxLength = 300, tipText = '', icon: customIcon = null, undismissable = false, closeOnOverlayClick = true }) {
        return new Promise((resolve) => {
            this._resolve = resolve;
            this._undismissable = undismissable;
            this._closeOnOverlayClick = closeOnOverlayClick;

            // Create container if not exists
            if (!this._modal) {
                this._modal = document.createElement('div');
                this._modal.id = 'global-confirm-modal';
                this._modal.style.cssText = `
                    position:fixed; top:0; left:0; width:100%; height:100%;
                    background:rgba(0,0,0,0.8);
                    display:flex; align-items:center; justify-content:center;
                    z-index:100000; opacity:0; pointer-events:none;
                    transition:opacity 0.25s ease; padding:32px;
                `;
                document.body.appendChild(this._modal);
            }

            const isWarning = type === 'warning';
            const icon = customIcon || (isWarning ? '⚡' : '👋');
            const confirmBtnColor = isWarning ? 'var(--c-red)' : 'var(--c-primary)';

            const inputHtml = showInput ? `
                <textarea id="gcm-input" placeholder="${inputPlaceholder}" maxlength="${inputMaxLength}" style="width:100%; border:1px solid var(--c-border); background:rgba(255,255,255,0.05); color:var(--c-text); border-radius:12px; padding:12px; font-size:14px; margin-bottom:4px; resize:none; font-family:var(--font); outline:none;" rows="6"></textarea>
                <div style="display:flex; justify-content:space-between; margin-bottom:24px; padding:0 4px;">
                    <span id="gcm-tip" style="font-size:11px; color:var(--c-text-dim); text-align:left; flex:1; padding-right:10px;">${tipText}</span>
                    <span id="gcm-counter" style="font-size:11px; color:var(--c-text-muted); font-weight:700; white-space:nowrap;">0/${inputMaxLength}</span>
                </div>
            ` : '';

            const thirdBtnHtml = thirdText ? `
                <button id="gcm-third" class="btn" style="background:${thirdColor}; color:white; border:none; padding:16px;">${thirdText}</button>
            ` : '';

            const cancelBtnHtml = showCancel ? `
                <button id="gcm-cancel" class="btn" style="background:none; border:none; color:var(--c-text-muted); padding:12px; font-size:14px; font-weight:600;">${cancelText}</button>
            ` : '';

            this._modal.innerHTML = `
                <div id="gcm-card" style="background:rgba(23, 23, 28, 0.98); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.1); border-radius:32px; padding:28px; width:100%; max-width:340px; text-align:center; position:relative; transform:scale(0.85); opacity:0; transition:all 0.4s cubic-bezier(0.16, 1, 0.3, 1); box-shadow:0 30px 60px rgba(0,0,0,0.6);">
                    
                    <!-- Premium Emoji Frame -->
                    <div style="margin: 0 auto 20px; width:72px; height:72px; position:relative; display:flex; align-items:center; justify-content:center;">
                        <div style="position:absolute; inset:0; border-radius:50%; background:linear-gradient(135deg, var(--c-primary), #6366f1); opacity:0.15; filter:blur(10px);"></div>
                        <div style="position:absolute; inset:0; border-radius:50%; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.03);"></div>
                        <div style="font-size:34px; z-index:1; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.3));">${icon}</div>
                    </div>

                    <h2 style="font-size:20px; font-weight:900; color:#fff; margin-bottom:20px; letter-spacing:-0.5px; line-height:1.2;">${title}</h2>
                    
                    ${inputHtml}

                    <div style="font-size:12px; color:rgba(255,255,255,0.5); line-height:1.6; margin-bottom:24px; font-weight:400; text-align:left; padding:0 8px;">${message.replace(/\n/g, '<br>')}</div>

                    <div style="display:flex; gap:12px; flex-direction:column;">
                        <button id="gcm-confirm" class="btn" style="background:var(--c-primary); color:#fff; border:none; width:100%; padding:14px; border-radius:16px; font-weight:800; font-size:14px; letter-spacing:0.5px; box-shadow: 0 8px 20px rgba(27, 82, 206, 0.25); transition:transform 0.2s;">
                            ${confirmText.toUpperCase()}
                        </button>
                        ${thirdBtnHtml}
                        ${cancelBtnHtml}
                    </div>
                </div>
            `;

            // Setup listeners
            this._modal.onclick = (e) => {
                if (e.target === this._modal && !this._undismissable && this._closeOnOverlayClick) this.close(false);
            };
            this._modal.querySelector('#gcm-confirm').onclick = () => {
                const val = showInput ? this._modal.querySelector('#gcm-input').value.trim() : true;
                this.close(val);
            };

            if (showInput) {
                const inp = this._modal.querySelector('#gcm-input');
                const count = this._modal.querySelector('#gcm-counter');
                inp.oninput = () => {
                    count.innerText = `${inp.value.length}/${inputMaxLength}`;
                };
                // Auto-focus with slight delay for transition
                setTimeout(() => inp.focus(), 300);
            }

            if (thirdText) {
                this._modal.querySelector('#gcm-third').onclick = () => this.close('third');
            }
            const cancelBtn = this._modal.querySelector('#gcm-cancel');
            if (cancelBtn) {
                cancelBtn.onclick = () => this.close(false);
            }


            // Disable scroll (Hardened for mobile)
            document.documentElement.style.overflow = 'hidden';
            document.body.style.overflow = 'hidden';
            document.body.style.touchAction = 'none';
            document.body.style.position = 'fixed';
            document.body.style.width = '100%';

            // Prevent touchmove events from bubbling up
            this._modal.ontouchmove = (e) => e.preventDefault();

            // Set state
            this._isOpen = true;

            // Trigger animation
            this._modal.style.opacity = '1';
            this._modal.style.pointerEvents = 'auto';
            setTimeout(() => {
                const card = document.getElementById('gcm-card');
                if (card) {
                    card.style.transform = 'scale(1)';
                    card.style.opacity = '1';
                }
            }, 10);
        });
    },

    close: function (result) {
        if (!this._modal) return;

        if (this._undismissable) {
            // If undismissable, we still resolve the promise so the action can happen,
            // but we DON'T hide the modal and DON'T restore scroll.
            if (this._resolve) {
                const tempResolve = this._resolve;
                this._resolve = null; // Prevent double resolve
                tempResolve(result);
            }
            return;
        }

        // Restore scroll
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        document.body.style.touchAction = '';
        document.body.style.position = '';
        document.body.style.width = '';
        this._modal.ontouchmove = null;

        this._isOpen = false;

        this._modal.style.opacity = '0';
        this._modal.style.pointerEvents = 'none';
        const card = document.getElementById('gcm-card');
        if (card) {
            card.style.transform = 'scale(0.95)';
            card.style.opacity = '0';
        }
        setTimeout(() => {
            if (this._resolve) this._resolve(result);
        }, 250);
    }
};

var PollManager = {
    _timer: null,
    _activeTask: null,

    start: function (taskName, callback, interval = 15000) {
        this.stop();
        this._activeTask = taskName;
        this._timer = setInterval(() => {
            console.log(`[PollManager] Running: ${taskName}`);
            callback();
        }, interval);
    },

    stop: function () {
        if (this._timer) {
            console.log(`[PollManager] Stopping: ${this._activeTask}`);
            clearInterval(this._timer);
            this._timer = null;
            this._activeTask = null;
        }
    }
};

var PushNotificationsController = {
    _isStartingUp: true,
    init: async function () {
        const PushNotifications = window.Capacitor?.Plugins?.PushNotifications;
        if (!PushNotifications) {
            console.log('[PushNotifications] Not a native app or plugin missing');
            return;
        }

        // Suppress notification sounds for the first 3 seconds of startup
        setTimeout(() => {
            this._isStartingUp = false;
            console.log('[PushNotifications] Startup silence period ended');
        }, 3000);

        // Give native bridge 2 seconds to breathe before registration
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
            console.log('[PushNotifications] Starting registration flow...');
            // Check current status first
            let permStatus = await PushNotifications.checkPermissions();
            console.log('[PushNotifications] Permission status:', permStatus.receive);

            if (permStatus.receive === 'prompt') {
                permStatus = await PushNotifications.requestPermissions();
            }

            if (permStatus.receive !== 'granted') {
                console.log('[PushNotifications] Permission not granted');
                return;
            }

            // Safe Registration
            console.log('[PushNotifications] Registering...');
            await PushNotifications.register();

            // Listeners
            this.setupListeners(PushNotifications);

        } catch (e) {
            console.error('[PushNotifications] Initialization crash prevented:', e);
        }
    },

    setupListeners: function (PushNotifications) {
        if (!PushNotifications) return;

        try {
            // On success, we get a token
            PushNotifications.addListener('registration', (token) => {
                console.log('[PushNotifications] Registration success');
                this.updateServerToken(token.value);
            });

            // On error
            PushNotifications.addListener('registrationError', (error) => {
                console.error('[PushNotifications] Registration error:', error.error);
            });

            // Handle incoming notifications (Foreground)
            PushNotifications.addListener('pushNotificationReceived', (notification) => {
                console.log('[PushNotifications] Received in foreground:', notification);
                if (notification.title && notification.body) {
                    Toast.show(notification.body, 'info');
                    if (typeof SoundManager !== 'undefined' && !this._isStartingUp) {
                        SoundManager.play('notify');
                    }
                    if (typeof Router !== 'undefined' && Router.currentPath === '/dashboard' && typeof DashboardController !== 'undefined') {
                        DashboardController.load();
                    }
                }
            });

            // Handle notification click (Action)
            PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
                console.log('[PushNotifications] Action performed. App opened via notification.');
                // All automated navigation and mark-read actions disabled as requested.
            });
        } catch (e) {
            console.error('[PushNotifications] Listener setup failed:', e);
        }
    },

    updateServerToken: async function (token) {
        if (typeof Auth !== 'undefined' && !Auth.isAuthenticated()) return;
        const platform = window.Capacitor.getPlatform();
        console.log('[PushNotifications] Updating server token...');
        await API.post('/profile/update_device_token', {
            token: token,
            platform: platform
        });
    }
};


const InAppMessagesController = {
    init: async function () {
        if (!Auth.isAuthenticated()) return;

        // Instant check as requested
        this.check();
    },

    check: async function () {
        try {
            const res = await API.get('/system/check_in_app_messages?t=' + Date.now());
            if (res.success && res.data) {
                this.display(res.data);
            }
        } catch (err) {
            console.error('[InAppMessages] Check failed:', err);
        }
    },

    display: async function (msg) {
        let confirmText = msg.button_text || 'Got it';
        let action = msg.action_type;

        ConfirmModal.show({
            title: msg.heading,
            message: msg.body,
            icon: msg.emoji,
            confirmText: confirmText,
            showCancel: false,
            type: 'info',
            undismissable: msg.is_undismissable == 1,
            closeOnOverlayClick: false
        }).then(async (confirmed) => {
            if (!confirmed) return;

            // Mark as seen (only if not undismissable)
            if (msg.is_undismissable != 1) {
                await API.post('/system/mark_message_seen', { message_id: msg.id });
            }

            if (action === 'navigate' && msg.page_route) {
                Router.navigate(msg.page_route);
            } else if (action === 'external') {
                const platform = window.Capacitor?.getPlatform() || 'web';
                let url = msg.android_url;
                if (platform === 'ios') url = msg.ios_url || msg.android_url;

                if (url) {
                    window.open(url, '_blank');
                }
            }
            // 'close' action is already handled by the modal closing
        });
    }
};


const ScoreUI = {
    /**
     * Renders a match score card based on the provided UI design.
     * @param {Object} match - The match object
     * @param {Object} approvedScore - The score record to render
     * @param {Array} players - Optional explicit player list
     * @param {Boolean} showHeader - Whether to show the Venue/Date header
     */
    renderMatchScore: function (match, approvedScore = null, players = null, showHeader = true) {
        if (!approvedScore && match.scores) {
            approvedScore = match.scores.find(s => s.status === 'approved');
        }

        if (!approvedScore) return '';

        // Process sets and winner
        const sets = [];
        let t1Sets = 0, t2Sets = 0;
        for (let i = 1; i <= 3; i++) {
            const s1 = parseInt(approvedScore[`t1_set${i}`]);
            const s2 = parseInt(approvedScore[`t2_set${i}`]);
            if (isNaN(s1) || isNaN(s2)) continue;
            if (i > 1 && s1 === 0 && s2 === 0) continue; // Skip 0-0 sets after the first one (not played)

            const winner = s1 > s2 ? 1 : (s2 > s1 ? 2 : 0);
            if (winner === 1) t1Sets++; else if (winner === 2) t2Sets++;
            sets.push({ s1, s2, winner });
        }
        const t1Winner = t1Sets > t2Sets;

        // Map players to teams (handle different data structures)
        let team1 = [], team2 = [];
        const allPlayers = players || [...(match.team_a || []), ...(match.team_b || [])];

        // Handle custom composition (team switches)
        let customComp = null;
        if (approvedScore.composition_json) {
            try {
                customComp = typeof approvedScore.composition_json === 'string'
                    ? JSON.parse(approvedScore.composition_json)
                    : approvedScore.composition_json;
            } catch (e) { }
        }

        allPlayers.forEach(p => {
            let finalPlayer = { ...p };
            if (customComp) {
                const compMatch = customComp.find(c => parseInt(c.user_id) === parseInt(p.user_id || p.id));
                if (compMatch) finalPlayer = { ...p, ...compMatch };
            }

            const pData = {
                name: finalPlayer.nickname || finalPlayer.name || (finalPlayer.first_name + ' ' + finalPlayer.last_name) || '—',
                code: finalPlayer.player_code || finalPlayer.code || '',
                team_no: parseInt(finalPlayer.team_no)
            };

            if (pData.team_no === 1) team1.push(pData);
            else if (pData.team_no === 2) team2.push(pData);
        });

        const renderTeamRow = (teamPlayers, isWinner) => {
            const p1 = teamPlayers[0] || { name: '—' };
            const p2 = teamPlayers[1] || { name: '—' };

            return `
                <div class="msc-team-row ${isWinner ? 'winner' : ''}" style="display:flex; align-items:center; justify-content:space-between; padding:7px 12px; border-radius:10px; margin-bottom:4px; background:${isWinner ? 'rgba(247,148,29,0.06)' : 'rgba(255,255,255,0.02)'}; border:1px solid ${isWinner ? 'rgba(247,148,29,0.1)' : 'transparent'};">
                    <div style="display:flex; align-items:center; gap:8px; overflow:hidden; flex:1; margin-right:8px;">
                        ${isWinner ? '<span style="color:var(--c-orange); font-size:10px; flex-shrink:0;">▶</span>' : '<span style="width:10px; flex-shrink:0;"></span>'}
                        <div style="display:flex; align-items:center; gap:4px; overflow:hidden;">
                            <div style="display:flex; align-items:center; gap:4px; min-width:0;">
                                <span style="font-size:13px; font-weight:700; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p1.name}</span>
                                <span style="font-size:10px; background:rgba(255,255,255,0.1); padding:1px 4px; border-radius:4px; color:var(--c-text-muted); text-transform:uppercase; flex-shrink:0; font-family:monospace;">${p1.code}</span>
                            </div>
                            <span style="color:var(--c-text-dim); font-size:10px;">/</span>
                            <div style="display:flex; align-items:center; gap:4px; min-width:0;">
                                <span style="font-size:13px; font-weight:700; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p2.name}</span>
                                <span style="font-size:10px; background:rgba(255,255,255,0.1); padding:1px 4px; border-radius:4px; color:var(--c-text-muted); text-transform:uppercase; flex-shrink:0; font-family:monospace;">${p2.code}</span>
                            </div>
                        </div>
                    </div>
                    <div style="display:flex; gap:10px; flex-shrink:0; margin-left:10px;">
                        ${sets.map(s => `
                            <span style="font-size:15px; font-weight:800; color:${s.winner === (teamPlayers === team1 ? 1 : 2) ? 'var(--c-orange)' : '#fff'}; width:14px; text-align:center;">
                                ${(teamPlayers === team1) ? s.s1 : s.s2}
                            </span>
                        `).join('')}
                    </div>
                </div>
            `;
        };

        const headerVenue = (match.venue || 'Venue TBD').split(' - ')[0].trim();
        const headerDate = match.scheduled_at
            ? new Date(match.scheduled_at.replace(' ', 'T')).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })
            : '';

        const headerHtml = showHeader ? `
            <div class="msc-header" style="padding:0 24px; margin-bottom:12px; display:flex; align-items:center; gap:8px;">
                <span class="msc-venue">${headerVenue}</span>
                <span style="opacity:0.2;">•</span>
                <span class="msc-date" style="font-size:11px; color:var(--c-text-muted); font-weight:700;">${headerDate}</span>
            </div>
        ` : '';

        return `
            <div class="msc-card ${showHeader ? 'with-header' : ''}" style="width:100%; position:relative; overflow:hidden;">
                ${headerHtml}
                <div class="msc-body" style="padding: 0 ${showHeader ? '24px' : '20px'};">
                    ${renderTeamRow(team1, t1Winner)}
                    ${renderTeamRow(team2, !t1Winner)}
                </div>
            </div>
        `;
    }
};

const StatsUI = {
    /**
     * Updates a set of stat elements with the provided stats object.
     * @param {Object} stats - The stats object from the API
     * @param {String} prefix - The ID prefix for the elements (e.g., 'dash' or 'pv')
     */
    update: function (stats, prefix) {
        if (!stats) return;

        const upIcon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>';
        const downIcon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';

        const elMap = {
            'ranking': stats.ranking ?? '—',
            'points': stats.points,
            'matches': stats.matches_played,
            'winrate': stats.win_rate + '%'
        };

        for (const [key, val] of Object.entries(elMap)) {
            // Try both prefix-key and prefix-key-count for flexibility
            const el = document.getElementById(`${prefix}-${key}`) || document.getElementById(`${prefix}-${key}-count`);
            if (el) {
                if (key === 'points' && stats.current_buffer !== undefined) {
                    el.innerHTML = `${val} <span style="display: inline-flex; flex-direction: column; vertical-align: middle; margin-left: 8px; line-height: 1; text-align: left;">
                        <span style="font-size: 14px; font-weight: 900; color: var(--c-orange); opacity: 0.9;">+ ${stats.current_buffer}</span>
                        <span style="font-size: 9px; font-weight: 800; opacity: 0.4; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 1px;">Buffer</span>
                    </span>`;
                } else {
                    el.textContent = val;
                }
            }
        }

        // Secondary details (if elements exist)
        const rcEl = document.getElementById(`${prefix}-ranking-change`) || document.getElementById(`${prefix}-highest-rank`);
        if (rcEl) {
            if (stats.ranking_change > 0) {
                rcEl.innerHTML = `<span class="stat-trend up">${upIcon} ${stats.ranking_change} POSITIONS</span>`;
            } else if (stats.ranking_change < 0) {
                rcEl.innerHTML = `<span class="stat-trend down">${downIcon} ${Math.abs(stats.ranking_change)} POSITIONS</span>`;
            } else {
                rcEl.innerHTML = `<span class="stat-trend neutral">STABLE RANK</span>`;
            }
        }

        const pwEl = document.getElementById(`${prefix}-points-week`);
        if (pwEl && stats.points_this_week !== undefined) {
            if (stats.points_this_week > 0) {
                pwEl.innerHTML = `<span class="stat-trend up">${upIcon} +${stats.points_this_week} THIS WEEK</span>`;
                pwEl.style.color = '';
            } else if (stats.points_this_week < 0) {
                pwEl.innerHTML = `<span class="stat-trend down">${downIcon} ${stats.points_this_week} THIS WEEK</span>`;
                pwEl.style.color = '';
            } else {
                pwEl.textContent = '';
            }
        }

        const wlEl = document.getElementById(`${prefix}-wl`);
        if (wlEl && stats.matches_played > 0) {
            wlEl.textContent = `${stats.matches_won}W / ${stats.matches_lost}L`;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {

    // Initialize the SPA router once DOM is ready
    Router.init();

    // Phase 6: Initialize notifications engine
    NotificationsController.init();

    // Initialize sound engine
    SoundManager.init();

    if (typeof Auth !== 'undefined' && Auth.isAuthenticated()) {
        PushNotificationsController.init();
        InAppMessagesController.init();
        if (typeof UI !== 'undefined' && UI.syncNav) {
            UI.syncNav();
        }
    }

    // Mobile Status Bar Fix
    const StatusBar = window.Capacitor?.Plugins?.StatusBar;
    if (StatusBar) {
        StatusBar.setBackgroundColor({ color: '#11161E' });
        StatusBar.setStyle({ style: 'DARK' });
    }

    // Android Physical Back Button Handler
    const App = window.Capacitor?.Plugins?.App;
    if (App) {
        App.addListener('backButton', () => {
            // Priority 1: Close confirm modal if open
            if (typeof ConfirmModal !== 'undefined' && ConfirmModal._isOpen) {
                ConfirmModal.close(false);
                return;
            }

            // Priority 2: Close notifications if open
            if (typeof NotificationsController !== 'undefined' && NotificationsController._isOpen) {
                NotificationsController.close();
                return;
            }

            // Priority 2: Navigate back if we have history
            if (Router.navDepth > 0) {
                Router.back();
            } else {
                // Otherwise exit the app
                App.exitApp();
            }
        });
    }

    // Capacitor Specific Logic
    if (window.Capacitor) {
        document.body.classList.add('is-mobile-app');

        // Force hide scrollbars via JS (Safety Injector for WebView)
        const style = document.createElement('style');
        style.textContent = `
            *::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; background: transparent !important; }
            *::-webkit-scrollbar-thumb { display: none !important; background: transparent !important; }
            *::-webkit-scrollbar-track { display: none !important; background: transparent !important; }
            html, body { scrollbar-width: none !important; -ms-overflow-style: none !important; }
        `;
        document.head.appendChild(style);
    }
});
