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
    _ctx: null,
    _buffers: {},
    _unlocked: false,

    init: function () {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const list = {
            tap: 'assets/sounds/tap.mp3',
            success: 'assets/sounds/success.mp3',
            notify: 'assets/sounds/notify.mp3'
        };
        this._ctx = new AudioContext();
        for (const [id, path] of Object.entries(list)) {
            fetch(path)
                .then(res => res.arrayBuffer())
                .then(arrayBuffer => this._ctx.decodeAudioData(arrayBuffer))
                .then(buffer => { this._buffers[id] = buffer; })
                .catch(err => console.warn('[SoundManager] Load failed:', path, err));
        }
        const unlock = () => {
            if (this._unlocked || !this._ctx) return;
            if (this._ctx.state === 'suspended') this._ctx.resume();
            const source = this._ctx.createBufferSource();
            source.buffer = this._ctx.createBuffer(1, 1, 22050);
            source.connect(this._ctx.destination);
            source.start(0);
            this._unlocked = true;
        };
        ['touchstart', 'click', 'mousedown'].forEach(e =>
            document.addEventListener(e, unlock, { once: true, passive: true })
        );
        document.addEventListener('click', (e) => {
            const el = e.target.closest('button, a, .nav-item, [onclick], .clickable');
            if (el && !el.hasAttribute('data-no-sound')) {
                this.play('tap');
            }

            const statBox = e.target.closest('.stat-box');
            if (statBox) {
                statBox.classList.remove('clicked');
                void statBox.offsetWidth; // trigger reflow
                statBox.classList.add('clicked');
                setTimeout(() => statBox.classList.remove('clicked'), 600);
            }
        }, true);
    },

    play: function (type) {
        if (!this._ctx || !this._buffers[type]) return;
        if (this._ctx.state === 'suspended') this._ctx.resume();
        const source = this._ctx.createBufferSource();
        source.buffer = this._buffers[type];
        source.connect(this._ctx.destination);
        source.start(0);
        const Haptics = window.Capacitor?.Plugins?.Haptics;
        if (Haptics) {
            if (type === 'tap') Haptics.selectionChanged().catch(() => { });
            else if (type === 'success') Haptics.notification({ type: 'SUCCESS' }).catch(() => { });
        }
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

        toast.innerHTML = safeHTML(`
            <span class="toast-icon">${icon}</span>
            <span class="toast-message">${message}</span>
            <span class="toast-close" style="margin-left:12px; cursor:pointer; opacity:0.6; font-weight:900; font-size:12px;" onclick="this.parentElement.remove()">✕</span>
        `);

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

    show: function ({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', showCancel = true, thirdText = null, thirdColor = 'var(--c-secondary)', type = 'info', showInput = false, required = false, inputPlaceholder = 'Enter reason...', inputMaxLength = 300, tipText = '', icon: customIcon = null, undismissable = false, closeOnOverlayClick = true, headerLayout = 'column' }) {
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
            const icon = customIcon !== null && customIcon !== undefined ? customIcon : (isWarning ? '⚡' : '');
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

            let headerHtml = '';
            if (headerLayout === 'row') {
                const iconHtml = icon ? `<div style="font-size:24px; line-height:1;">${icon}</div>` : '';
                headerHtml = `
                    <div style="display:flex; align-items:flex-end; justify-content:flex-start; gap:10px; margin-bottom:16px; padding-bottom:16px; border-bottom:1px solid rgba(255,255,255,0.08);">
                        ${iconHtml}
                        <h2 style="font-size:15px; font-weight:800; color:#fff; margin:0; text-transform:uppercase; letter-spacing:0.5px; line-height:1; padding-bottom:2px; text-align:left;">${title}</h2>
                    </div>
                `;
            } else {
                let iconFrameHtml = '';
                if (icon) {
                    iconFrameHtml = `
                    <!-- Premium Emoji Frame -->
                    <div style="margin: 0 auto 20px; width:72px; height:72px; position:relative; display:flex; align-items:center; justify-content:center;">
                        <div style="position:absolute; inset:0; border-radius:50%; background:linear-gradient(135deg, var(--c-primary), #6366f1); opacity:0.15; filter:blur(10px);"></div>
                        <div style="position:absolute; inset:0; border-radius:50%; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.03);"></div>
                        <div style="font-size:34px; z-index:1; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.3));">${icon}</div>
                    </div>`;
                }
                const alignStyle = icon ? 'center' : 'left';
                headerHtml = `
                    ${iconFrameHtml}
                    <h2 style="font-size:22px; font-weight:700; background: linear-gradient(135deg, #ffffff 0%, #a5b4fc 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom:20px; letter-spacing:-0.5px; line-height:1.2; text-align:${alignStyle};">${title}</h2>
                `;
            }

            const isRowLayout = headerLayout === 'row';
            const cardMaxWidth = isRowLayout ? '380px' : '340px';
            const cardPadding = isRowLayout ? '20px' : '28px';
            const cardBorderRadius = isRowLayout ? '24px' : '32px';

            this._modal.innerHTML = safeHTML(`
                <div id="gcm-card" style="background:rgba(23, 23, 28, 0.98); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.1); border-radius:${cardBorderRadius}; padding:${cardPadding}; width:100%; max-width:${cardMaxWidth}; text-align:center; position:relative; transform:scale(0.85); opacity:0; transition:all 0.4s cubic-bezier(0.16, 1, 0.3, 1); box-shadow:0 30px 60px rgba(0,0,0,0.6);">
                    
                    ${headerHtml}
                    
                    ${inputHtml}
 
                    <div style="font-size:12px; color:rgba(255,255,255,0.5); line-height:1.6; margin-bottom:24px; font-weight:400; text-align:left; padding:0;">${message.replace(/\n/g, '<br>')}</div>
 
                    <div style="display:flex; gap:12px; flex-direction:column;">
                        <button id="gcm-confirm" class="btn" style="background:var(--c-primary); color:#fff; border:none; width:100%; padding:14px; border-radius:16px; font-weight:800; font-size:14px; letter-spacing:0.5px; box-shadow: 0 8px 20px rgba(27, 82, 206, 0.25); transition:transform 0.2s;">
                            ${confirmText.toUpperCase()}
                        </button>
                        ${thirdBtnHtml}
                        ${cancelBtnHtml}
                    </div>
                </div>
            `);

            // Setup listeners
            this._modal.onclick = (e) => {
                if (e.target === this._modal && !this._undismissable && this._closeOnOverlayClick) this.close(false);
            };
            this._modal.querySelector('#gcm-confirm').onclick = () => {
                if (showInput) {
                    const val = this._modal.querySelector('#gcm-input').value.trim();
                    if (required && val === '') {
                        const inp = this._modal.querySelector('#gcm-input');
                        inp.style.borderColor = 'var(--c-red)';
                        Toast.show('Please enter a message.', 'error');
                        return;
                    }
                    this.close(val);
                } else {
                    this.close(true);
                }
            };

            if (showInput) {
                const inp = this._modal.querySelector('#gcm-input');
                const count = this._modal.querySelector('#gcm-counter');
                inp.oninput = () => {
                    count.innerText = `${inp.value.length}/${inputMaxLength}`;
                    inp.style.borderColor = 'var(--c-border)';
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
            const scrollY = window.scrollY || document.documentElement.scrollTop;
            document.documentElement.style.overflow = 'hidden';
            document.body.style.overflow = 'hidden';
            document.body.style.touchAction = 'none';
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.width = '100%';

            // Prevent touchmove events from bubbling up, except inside scrollable elements
            this._modal.ontouchmove = (e) => {
                if (e.target.closest('.custom-scroll')) return;
                e.preventDefault();
            };

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
        const scrollY = parseFloat(document.body.style.top || '0') * -1;
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        document.body.style.touchAction = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        this._modal.ontouchmove = null;
        if (scrollY > 0) {
            window.scrollTo(0, scrollY);
        }

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

var InviteModal = {
    _modal: null,
    _isOpen: false,

    show: function (invites, onUpdate) {
        // Create container if not exists
        if (!this._modal) {
            this._modal = document.createElement('div');
            this._modal.id = 'invite-modal-overlay';
            this._modal.style.cssText = `
                position:fixed; top:0; left:0; width:100%; height:100%;
                background:rgba(0,0,0,0.8);
                display:flex; align-items:center; justify-content:center;
                z-index:100000; opacity:0; pointer-events:none;
                transition:opacity 0.25s ease; padding:32px;
            `;
            document.body.appendChild(this._modal);
        }

        const slotsHtml = invites.map((inv, idx) => {
            const isUsed = !!inv.used_at;
            let slotContent = '';
            if (isUsed) {
                let initials = '?';
                if (inv.used_by_name) {
                    initials = inv.used_by_name.substring(0, 2).toUpperCase();
                }
                const avatarHtml = UI.getAvatarHtml(inv.used_by_avatar, 'width:100%; height:100%; border-radius:50%; object-fit:cover;', 'width:32px; height:32px; border-radius:50%; flex-shrink:0; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.06); color:#fff;', initials);
                slotContent = `
                    <div style="display:flex; align-items:center; gap:10px; width:100%;">
                        ${avatarHtml}
                        <div style="flex:1; text-align:left; min-width:0;">
                            <div style="font-weight:700; font-size:13px; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Used by ${inv.used_by_name}</div>
                            <div style="font-size:10px; color:var(--c-orange); font-weight:800; font-family:monospace; margin-top:2px;">CODE: ${inv.code}</div>
                        </div>
                        <span style="font-size:18px; color:var(--c-green); flex-shrink:0;">✓</span>
                    </div>
                `;
            } else {
                slotContent = `
                    <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
                        <span style="font-family: 'JetBrains Mono', monospace; font-size:15px; font-weight:800; color:#fff; letter-spacing:0.5px;">${inv.code}</span>
                        <button onclick="InviteModal.copyCode('${inv.code}', this)" class="btn btn-sm" style="background:rgba(255,255,255,0.05); color:#fff; border:1px solid rgba(255,255,255,0.1); padding:6px 14px; border-radius:8px; font-size:11px; font-weight:700; transition:all 0.2s; cursor:pointer;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                            COPY
                        </button>
                    </div>
                `;
            }

            return `
                <div style="display:flex; align-items:center; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:16px; padding:14px 18px; margin-bottom:12px; transition:all 0.2s;">
                    ${slotContent}
                </div>
            `;
        }).join('');

        this._modal.innerHTML = safeHTML(`
            <div id="invite-modal-card" style="background:rgba(23, 23, 28, 0.98); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.1); border-radius:32px; padding:28px; width:100%; max-width:340px; text-align:center; position:relative; transform:scale(0.85); opacity:0; transition:all 0.4s cubic-bezier(0.16, 1, 0.3, 1); box-shadow:0 30px 60px rgba(0,0,0,0.6);">
                <div style="margin: 0 auto 20px; width:72px; height:72px; position:relative; display:flex; align-items:center; justify-content:center;">
                    <div style="position:absolute; inset:0; border-radius:50%; background:linear-gradient(135deg, var(--c-orange), #ff8b00); opacity:0.15; filter:blur(10px);"></div>
                    <div style="position:absolute; inset:0; border-radius:50%; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.03);"></div>
                    <div style="font-size:34px; z-index:1; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.3));">🎟️</div>
                </div>
                <h2 style="font-size:20px; font-weight:900; color:#fff; margin-bottom:8px; letter-spacing:-0.5px; line-height:1.2;">Exclusive Invites</h2>
                <p style="font-size:12px; color:var(--c-text-muted); line-height:1.6; margin-bottom:24px; font-weight:400; padding:0 8px; text-align:center;">
                    Your friends need one of these exclusive codes to register. Give them out wisely!
                </p>

                <div style="margin-bottom:24px;">
                    ${slotsHtml}
                </div>

                <div>
                    <button onclick="InviteModal.close()" class="btn" style="background:var(--c-primary); color:#fff; border:none; width:100%; padding:14px; border-radius:16px; font-weight:800; font-size:14px; letter-spacing:0.5px; box-shadow: 0 8px 20px rgba(27, 82, 206, 0.25); transition:transform 0.2s;">
                        CLOSE
                    </button>
                </div>
            </div>
        `);

        // Close on overlay click
        this._modal.onclick = (e) => {
            if (e.target === this._modal) this.close();
        };

        // Disable scroll
        const scrollY = window.scrollY || document.documentElement.scrollTop;
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        document.body.style.touchAction = 'none';
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = '100%';

        this._isOpen = true;

        // Trigger animation
        this._modal.style.opacity = '1';
        this._modal.style.pointerEvents = 'auto';
        setTimeout(() => {
            const card = document.getElementById('invite-modal-card');
            if (card) {
                card.style.transform = 'scale(1)';
                card.style.opacity = '1';
            }
        }, 10);
    },

    copyCode: function (code, btn) {
        if (!navigator.clipboard) {
            // Fallback for older browsers / Capacitor webview
            const textArea = document.createElement("textarea");
            textArea.value = code;
            textArea.style.position = "fixed";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                this.onCopySuccess(btn);
            } catch (err) {
                console.error('Fallback copy failed', err);
            }
            document.body.removeChild(textArea);
            return;
        }

        navigator.clipboard.writeText(code).then(() => {
            this.onCopySuccess(btn);
        }).catch(err => {
            console.error('Clipboard copy failed', err);
        });
    },

    onCopySuccess: function (btn) {
        if (btn) {
            const originalText = btn.textContent;
            btn.textContent = 'COPIED!';
            btn.style.borderColor = 'var(--c-green)';
            btn.style.color = 'var(--c-green)';
            btn.style.background = 'rgba(16,185,129,0.1)';
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.borderColor = 'rgba(255,255,255,0.1)';
                btn.style.color = '#fff';
                btn.style.background = 'rgba(255,255,255,0.05)';
            }, 2000);
        }
        Toast.show('Invitation code copied to clipboard!', 'success');
    },

    close: function () {
        if (!this._modal) return;

        // Restore scroll
        const scrollY = parseFloat(document.body.style.top || '0') * -1;
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        document.body.style.touchAction = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        if (scrollY > 0) {
            window.scrollTo(0, scrollY);
        }

        this._isOpen = false;

        this._modal.style.opacity = '0';
        this._modal.style.pointerEvents = 'none';
        const card = document.getElementById('invite-modal-card');
        if (card) {
            card.style.transform = 'scale(0.95)';
            card.style.opacity = '0';
        }
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
            // Mark as seen upon dismissal
            await API.post('/system/mark_message_seen', { message_id: msg.id });

            if (!confirmed) return;

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

        if (customComp && customComp.length > 0) {
            // Use custom composition as source of truth for players and teams
            customComp.forEach(p => {
                const original = allPlayers.find(op => parseInt(op.user_id || op.id) === parseInt(p.user_id));
                const pData = {
                    name: p.nickname || p.name || (original ? (original.nickname || original.name || (original.first_name + ' ' + original.last_name)) : '—'),
                    code: p.player_code || p.code || (original ? (original.player_code || original.code) : ''),
                    team_no: parseInt(p.team_no)
                };
                if (pData.team_no === 1) team1.push(pData);
                else if (pData.team_no === 2) team2.push(pData);
            });
        } else {
            // Standard mapping from original players
            allPlayers.forEach(p => {
                const pData = {
                    name: p.nickname || p.name || (p.first_name + ' ' + p.last_name) || '—',
                    code: p.player_code || p.code || '',
                    team_no: parseInt(p.team_no)
                };
                if (pData.team_no === 1) team1.push(pData);
                else if (pData.team_no === 2) team2.push(pData);
            });
        }

        const renderTeamRow = (teamPlayers, isWinner) => {
            const p1 = teamPlayers[0] || { name: '—' };
            const p2 = teamPlayers[1] || { name: '—' };

            const isFriendly = match.match_type === 'friendly';
            const winnerBg = isFriendly ? 'rgba(27, 82, 206, 0.05)' : 'rgba(247,148,29,0.06)';
            const winnerBorder = isFriendly ? 'rgba(27, 82, 206, 0.15)' : 'rgba(247,148,29,0.1)';
            const accentColor = isFriendly ? '#5A91FF' : 'var(--c-orange)';

            return `
                <div class="msc-team-row ${isWinner ? 'winner' : ''}" style="display:flex; align-items:center; justify-content:space-between; padding:7px 12px; border-radius:10px; margin-bottom:4px; background:${isWinner ? winnerBg : 'rgba(255,255,255,0.02)'}; border:1px solid ${isWinner ? winnerBorder : 'transparent'};">
                    <div style="display:flex; align-items:center; gap:8px; overflow:hidden; flex:1; margin-right:8px;">
                        ${isWinner ? `<span style="color:${accentColor}; font-size:10px; flex-shrink:0;">▶</span>` : '<span style="width:10px; flex-shrink:0;"></span>'}
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
                            <span style="font-size:15px; font-weight:800; color:${s.winner === (teamPlayers === team1 ? 1 : 2) ? accentColor : '#fff'}; width:14px; text-align:center;">
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

        const isFriendly = match.match_type === 'friendly';
        const typeBadge = isFriendly
            ? `<span style="font-size:9px; background:rgba(27, 82, 206, 0.1); color:#5A91FF; padding:2px 6px; border-radius:4px; font-weight:800; text-transform:uppercase; font-family:var(--f-mono);">🤝 Friendly</span>`
            : `<span style="font-size:9px; background:rgba(247,148,29,0.15); color:var(--c-orange); padding:2px 6px; border-radius:4px; font-weight:800; text-transform:uppercase; font-family:var(--f-mono);">🏆 Competition</span>`;

        const headerHtml = showHeader ? `
            <div class="msc-header" style="padding:0 24px; margin-bottom:12px; display:flex; align-items:center; justify-content:space-between; width:100%; box-sizing:border-box;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span class="msc-venue">${headerVenue}</span>
                    <span style="opacity:0.2;">•</span>
                    <span class="msc-date" style="font-size:11px; color:var(--c-text-muted); font-weight:700;">${headerDate}</span>
                </div>
                <div>${typeBadge}</div>
            </div>
        ` : '';

        const cardBorderColor = isFriendly ? 'rgba(27, 82, 206, 0.6)' : 'rgba(255, 139, 0, 0.45)';

        return `
            <div class="msc-card ${showHeader ? 'with-header' : ''}" style="width:100%; position:relative; overflow:hidden; border-left:2px solid ${cardBorderColor};">
                ${headerHtml}
                <div class="msc-body" style="padding: 0 ${showHeader ? '24px' : '20px'};">
                    ${renderTeamRow(team1, t1Winner)}
                    ${renderTeamRow(team2, !t1Winner)}
                </div>
            </div>
        `;
    },

    /**
     * Renders a premium skeleton loader for match score cards.
     * @param {Number} count - Number of skeleton cards to render
     */
    renderSkeleton: function (count = 3) {
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `
                <div style="margin-bottom:12px; padding:16px; background:rgba(255,255,255,0.02); border-radius:var(--r-lg); border:1px solid rgba(255,255,255,0.05); overflow:hidden;">
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:16px; padding:0 4px;">
                        <div class="skeleton" style="width:80px; height:10px; border-radius:4px; opacity:0.6;"></div>
                        <div style="width:4px; height:4px; border-radius:50%; background:var(--c-border); opacity:0.3;"></div>
                        <div class="skeleton" style="width:60px; height:10px; border-radius:4px; opacity:0.4;"></div>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.01); padding:10px 12px; border-radius:10px; border:1px solid rgba(255,255,255,0.02);">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <div style="width:10px; height:10px; border-radius:2px; background:var(--c-border); opacity:0.2;"></div>
                                <div style="display:flex; gap:6px;">
                                    <div class="skeleton" style="width:90px; height:12px; border-radius:4px;"></div>
                                    <div class="skeleton" style="width:36px; height:12px; border-radius:4px; opacity:0.5;"></div>
                                </div>
                            </div>
                            <div style="display:flex; gap:10px;">
                                <div class="skeleton" style="width:14px; height:16px; border-radius:4px; opacity:0.8;"></div>
                                <div class="skeleton" style="width:14px; height:16px; border-radius:4px; opacity:0.4;"></div>
                            </div>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.01); padding:10px 12px; border-radius:10px; border:1px solid rgba(255,255,255,0.02);">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <div style="width:10px; height:10px; border-radius:2px; background:transparent;"></div>
                                <div style="display:flex; gap:6px;">
                                    <div class="skeleton" style="width:110px; height:12px; border-radius:4px;"></div>
                                    <div class="skeleton" style="width:36px; height:12px; border-radius:4px; opacity:0.5;"></div>
                                </div>
                            </div>
                            <div style="display:flex; gap:10px;">
                                <div class="skeleton" style="width:14px; height:16px; border-radius:4px; opacity:0.4;"></div>
                                <div class="skeleton" style="width:14px; height:16px; border-radius:4px; opacity:0.8;"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        return html;
    }
};

const RankingUI = {
    /**
     * Renders a premium skeleton loader for ranking rows.
     * @param {Number} count - Number of skeleton rows to render
     */
    renderSkeleton: function (count = 5) {
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `
                <div style="padding:14px 10px; display:grid; grid-template-columns: 40px 1fr 60px; align-items:center; gap:12px; border-bottom:1px solid rgba(255,255,255,0.05); overflow:hidden;">
                    <div style="display:flex; justify-content:center;">
                        <div class="skeleton" style="width:24px; height:24px; border-radius:50%; opacity:0.3;"></div>
                    </div>
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div class="skeleton" style="width:36px; height:36px; border-radius:50%; flex-shrink:0;"></div>
                        <div style="display:flex; flex-direction:column; gap:6px; flex:1;">
                            <div class="skeleton" style="width:120px; height:12px; border-radius:4px;"></div>
                            <div class="skeleton" style="width:80px; height:10px; border-radius:4px; opacity:0.5;"></div>
                        </div>
                    </div>
                    <div style="display:flex; justify-content:flex-end;">
                        <div class="skeleton" style="width:40px; height:14px; border-radius:4px;"></div>
                    </div>
                </div>
            `;
        }
        return html;
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

        const getUpIcon = () => {
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("width", "12"); svg.setAttribute("height", "12"); svg.setAttribute("viewBox", "0 0 24 24");
            svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor");
            svg.setAttribute("stroke-width", "4"); svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("stroke-linejoin", "round");
            const poly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
            poly.setAttribute("points", "18 15 12 9 6 15");
            svg.appendChild(poly);
            return svg;
        };
        const getDownIcon = () => {
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("width", "12"); svg.setAttribute("height", "12"); svg.setAttribute("viewBox", "0 0 24 24");
            svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor");
            svg.setAttribute("stroke-width", "4"); svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("stroke-linejoin", "round");
            const poly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
            poly.setAttribute("points", "6 9 12 15 18 9");
            svg.appendChild(poly);
            return svg;
        };

        const elMap = {
            'ranking': stats.ranking ?? '—',
            'points': stats.points,
            'matches': stats.matches_played,
            'winrate': stats.win_rate + '%'
        };

        for (const [key, val] of Object.entries(elMap)) {
            const el = document.getElementById(`${prefix}-${key}`) || document.getElementById(`${prefix}-${key}-count`);
            if (el) {
                el.innerHTML = ''; // Clear previous
                el.textContent = val;
            }
        }

        const rcEl = document.getElementById(`${prefix}-ranking-change`) || document.getElementById(`${prefix}-highest-rank`);
        if (rcEl) {
            rcEl.innerHTML = '';
            const trend = document.createElement('span');
            if (stats.ranking_change > 0) {
                trend.className = 'stat-trend up';
                trend.appendChild(getUpIcon());
                trend.append(` ${stats.ranking_change} POSITIONS`);
            } else if (stats.ranking_change < 0) {
                trend.className = 'stat-trend down';
                trend.appendChild(getDownIcon());
                trend.append(` ${Math.abs(stats.ranking_change)} POSITIONS`);
            } else {
                trend.className = 'stat-trend neutral';
                trend.textContent = 'STABLE RANK';
            }
            rcEl.appendChild(trend);
        }

        const pwEl = document.getElementById(`${prefix}-points-week`);
        if (pwEl) {
            pwEl.innerHTML = '';

            const buffer = stats.current_buffer ?? 0;

            if (buffer > 0) {
                // Buffer still active — show buffer badge, suppress weekly diff
                const trend = document.createElement('span');
                trend.style.cssText = 'color: var(--c-orange); background: rgba(255, 139, 0, 0.12); border: 1px solid rgba(255, 139, 0, 0.25); padding: 3px 8px; border-radius: 6px; display: inline-flex; align-items: baseline; gap: 6px;';
                trend.innerHTML = `<span style="font-size: 13px; font-weight: 800;">+${buffer}</span><span style="font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">BUFFER</span>`;
                pwEl.appendChild(trend);
                pwEl.style.color = '';
            } else if (stats.points_this_week !== undefined) {
                // Buffer exhausted — show weekly change as normal
                if (stats.points_this_week > 0) {
                    const trend = document.createElement('span');
                    trend.className = 'stat-trend up';
                    trend.appendChild(getUpIcon());
                    trend.append(` +${stats.points_this_week} THIS WEEK`);
                    pwEl.appendChild(trend);
                    pwEl.style.color = '';
                } else if (stats.points_this_week < 0) {
                    const trend = document.createElement('span');
                    trend.className = 'stat-trend down';
                    trend.appendChild(getDownIcon());
                    trend.append(` ${stats.points_this_week} THIS WEEK`);
                    pwEl.appendChild(trend);
                    pwEl.style.color = '';
                }
            }
        }

        const wlEl = document.getElementById(`${prefix}-wl`);
        if (wlEl && stats.matches_played > 0) {
            wlEl.textContent = `${stats.matches_won}W / ${stats.matches_lost}L`;
            wlEl.style.fontSize = '11px';
            wlEl.style.fontWeight = '800';
            wlEl.style.letterSpacing = '0.5px';
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
        StatusBar.setBackgroundColor({ color: '#0D1117' }); // old: #11161E
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

            // Priority 2: Close exclusive invites (coupon codes) if open
            if (typeof InviteModal !== 'undefined' && InviteModal._isOpen) {
                InviteModal.close();
                return;
            }

            // Priority 3: Close stories overlay if viewing stories
            if (typeof StoriesController !== 'undefined' && StoriesController._isShowing) {
                StoriesController.closePlayer();
                return;
            }

            // Priority 4: Close notifications if open
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
