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
    _initialized: false,

    init: function () {
        if (this._initialized) return;
        this._initialized = true;

        const unlock = () => {
            if (this._unlocked) return;
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this._ctx = new AudioContext();
                const list = {
                    tap: 'assets/sounds/tap.mp3',
                    success: 'assets/sounds/success.mp3',
                    notify: 'assets/sounds/notify.mp3'
                };
                for (const [id, path] of Object.entries(list)) {
                    fetch(path)
                        .then(res => res.arrayBuffer())
                        .then(arrayBuffer => this._ctx.decodeAudioData(arrayBuffer))
                        .then(buffer => { this._buffers[id] = buffer; })
                        .catch(err => console.warn('[SoundManager] Load failed:', path, err));
                }
                if (this._ctx.state === 'suspended') this._ctx.resume();
                const source = this._ctx.createBufferSource();
                source.buffer = this._ctx.createBuffer(1, 1, 22050);
                source.connect(this._ctx.destination);
                source.start(0);
            }
            this._unlocked = true;

            // Remove unlock listeners
            ['touchstart', 'click', 'mousedown'].forEach(ev =>
                document.removeEventListener(ev, unlock)
            );
        };

        ['touchstart', 'click', 'mousedown'].forEach(e =>
            document.addEventListener(e, unlock, { passive: true })
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
        if (type === 'error') icon = '⚠️';
        if (type === 'warning') icon = '⚠️';

        toast.innerHTML = safeHTML(`
            <span class="toast-icon">${icon}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
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

    show: function ({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', showCancel = true, thirdText = null, thirdColor = 'var(--c-secondary)', type = 'info', showInput = false, inputType = 'textarea', required = false, inputPlaceholder = 'Enter reason...', inputMaxLength = 300, tipText = '', icon: customIcon = null, undismissable = false, closeOnOverlayClick = true, headerLayout = 'column', playersList = null }) {
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
                    display:flex; flex-direction:column; align-items:center; justify-content:flex-start;
                    z-index:100000; opacity:0; pointer-events:none;
                    transition:opacity 0.25s ease; padding:32px 16px;
                    overflow-y:auto;
                `;
                document.body.appendChild(this._modal);
            }

            const isWarning = type === 'warning';
            const icon = customIcon !== null && customIcon !== undefined ? customIcon : (isWarning ? '⚡' : '');
            const confirmBtnColor = isWarning ? 'var(--c-red)' : 'var(--c-primary)';

            let inputHtml = '';
            if (showInput) {
                if (inputType === 'radio') {
                    let playerOptions = '<option value="" disabled selected hidden>Select Player</option>';
                    if (playersList && Array.isArray(playersList)) {
                        playersList.forEach(p => {
                            playerOptions += `<option value="${p.id}">${p.name}</option>`;
                        });
                    }

                    inputHtml = `
                        <div id="gcm-radio-container" style="margin-bottom:4px; width:100%; display:flex; flex-direction:column; align-items:flex-start;">
                            <label style="display:flex; align-items:center; gap:10px; margin-bottom:12px; cursor:pointer; color:#fff; font-size:14px; font-weight:600; text-align:left; width:100%;">
                                <input type="radio" name="gcm-radio-opt" value="No show" style="accent-color:var(--c-primary); width:18px; height:18px; cursor:pointer;" />
                                <span>No show</span>
                            </label>
                            
                            <label style="display:flex; align-items:center; gap:10px; margin-bottom:12px; cursor:pointer; color:#fff; font-size:14px; font-weight:600; text-align:left; width:100%;">
                                <input type="radio" name="gcm-radio-opt" value="Level mismatch" style="accent-color:var(--c-primary); width:18px; height:18px; cursor:pointer;" />
                                <span>Level mismatch</span>
                            </label>
                            
                            <label style="display:flex; align-items:center; gap:10px; margin-bottom:12px; cursor:pointer; color:#fff; font-size:14px; font-weight:600; text-align:left; width:100%;">
                                <input type="radio" name="gcm-radio-opt" value="Bad attitude" style="accent-color:var(--c-primary); width:18px; height:18px; cursor:pointer;" />
                                <span>Bad attitude</span>
                            </label>

                            ${playersList && Array.isArray(playersList) ? `
                            <div id="gcm-radio-player-wrap" style="display:none; margin-bottom:8px; width:100%; padding-left:28px; box-sizing:border-box;">
                                <label style="color:rgba(255,255,255,0.6); display:block; text-align:left; font-size:11px; font-weight:800; text-transform:uppercase; margin-bottom:6px; font-family:var(--font);">Select Player</label>
                                <select id="gcm-player-select" style="width:100%; border:1px solid rgba(255,255,255,0.15); background:rgba(23, 23, 28, 0.98) url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238B9BB4' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E&quot;) no-repeat right 16px center; appearance:none; -webkit-appearance:none; color:#fff; border-radius:12px; padding:14px 44px 14px 16px; font-size:14px; font-family:var(--font); outline:none; cursor:pointer;">
                                    ${playerOptions}
                                </select>
                            </div>
                            ` : ''}

                            <label style="display:flex; align-items:center; gap:10px; margin-bottom:12px; cursor:pointer; color:#fff; font-size:14px; font-weight:600; text-align:left; width:100%;">
                                <input type="radio" name="gcm-radio-opt" value="other" style="accent-color:var(--c-primary); width:18px; height:18px; cursor:pointer;" />
                                <span>Other</span>
                            </label>

                            <div id="gcm-radio-other-wrap" style="display:none; margin-bottom:8px; width:100%; padding-left:28px; box-sizing:border-box;">
                                <textarea id="gcm-input" placeholder="Please describe the issue..." maxlength="${inputMaxLength}" style="width:100%; border:1px solid rgba(255,255,255,0.15); background:rgba(255,255,255,0.06); color:#fff; border-radius:12px; padding:12px; font-size:14px; resize:none; font-family:var(--font); outline:none; margin-bottom:4px;" rows="3"></textarea>
                                <div style="display:flex; justify-content:space-between; margin-bottom:0; padding:0 4px;">
                                    <span id="gcm-tip" style="font-size:11px; color:var(--c-text-dim); text-align:left; flex:1; padding-right:10px;">${tipText}</span>
                                    <span id="gcm-counter" style="font-size:11px; color:var(--c-text-muted); font-weight:700; white-space:nowrap;">0/${inputMaxLength}</span>
                                </div>
                            </div>
                        </div>
                    `;
                } else {
                    inputHtml = `
                        <${inputType === 'textarea' ? 'textarea' : 'input'} id="gcm-input" type="${inputType}" placeholder="${inputPlaceholder}" maxlength="${inputMaxLength}" style="width:100%; border:1px solid rgba(255,255,255,0.15); background:rgba(255,255,255,0.06); color:#fff; border-radius:12px; padding:12px; font-size:14px; margin-bottom:${inputType === 'password' ? '18px' : '4px'}; resize:none; font-family:var(--font); outline:none;" ${inputType === 'textarea' ? 'rows="6"' : ''}></${inputType === 'textarea' ? 'textarea' : 'input'}>
                    `;
                }
            }

            if (showInput && inputType !== 'radio') {
                inputHtml += `
                    <div style="display:${inputType === 'password' ? 'none' : 'flex'}; justify-content:space-between; margin-bottom:24px; padding:0 4px;">
                        <span id="gcm-tip" style="font-size:11px; color:var(--c-text-dim); text-align:left; flex:1; padding-right:10px;">${tipText}</span>
                        <span id="gcm-counter" style="font-size:11px; color:var(--c-text-muted); font-weight:700; white-space:nowrap;">0/${inputMaxLength}</span>
                    </div>
                `;
            }

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
                <div id="gcm-card" style="margin: auto 0; flex-shrink: 0; background:rgba(23, 23, 28, 0.98); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.1); border-radius:${cardBorderRadius}; padding:${cardPadding}; width:100%; max-width:${cardMaxWidth}; text-align:center; position:relative; transform:scale(0.85); opacity:0; transition:all 0.4s cubic-bezier(0.16, 1, 0.3, 1); box-shadow:0 30px 60px rgba(0,0,0,0.6);">
                    
                    ${headerHtml}
                    
                    ${inputHtml}
 
                    ${message ? `<div style="font-size:12px; color:rgba(255,255,255,0.5); line-height:1.6; margin-bottom:24px; font-weight:400; text-align:left; padding:0;">${message.replace(/\n/g, '<br>')}</div>` : ''}
 
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
                let resolvedValue = null;
                if (showInput) {
                    if (inputType === 'radio') {
                        const selectedRadio = this._modal.querySelector('input[name="gcm-radio-opt"]:checked');
                        if (!selectedRadio) {
                            Toast.show('Please select an option.', 'error');
                            return;
                        }
                        const selectedVal = selectedRadio.value;
                        if (selectedVal === 'other') {
                            const details = this._modal.querySelector('#gcm-input').value.trim();
                            if (details === '') {
                                this._modal.querySelector('#gcm-input').style.borderColor = 'var(--c-red)';
                                Toast.show('Please describe the issue.', 'error');
                                return;
                            }
                            resolvedValue = 'Other: ' + details;
                        } else {
                            if (playersList && Array.isArray(playersList)) {
                                const sel = this._modal.querySelector('#gcm-player-select');
                                if (!sel || sel.value === '') {
                                    Toast.show('Please select a player.', 'error');
                                    return;
                                }
                            }
                            resolvedValue = selectedVal;
                        }
                    } else {
                        const val = this._modal.querySelector('#gcm-input').value.trim();
                        if (required && val === '') {
                            const inp = this._modal.querySelector('#gcm-input');
                            inp.style.borderColor = 'var(--c-red)';
                            const errorMsg = inputType === 'password' ? 'Please enter your password.' : 'Please enter a message.';
                            Toast.show(errorMsg, 'error');
                            return;
                        }
                        resolvedValue = val;
                    }
                } else {
                    resolvedValue = true;
                }

                if (playersList && Array.isArray(playersList)) {
                    const selectedRadio = this._modal.querySelector('input[name="gcm-radio-opt"]:checked');
                    const isOther = selectedRadio && selectedRadio.value === 'other';
                    const sel = this._modal.querySelector('#gcm-player-select');
                    const targetPlayerId = (!isOther && sel) ? parseInt(sel.value) : null;
                    this.close({ reason: resolvedValue, targetUserId: targetPlayerId });
                } else {
                    this.close(resolvedValue);
                }
            };

            if (showInput) {
                const inp = this._modal.querySelector('#gcm-input');
                const count = this._modal.querySelector('#gcm-counter');

                if (inputType === 'radio') {
                    // Set up radio change event listener to toggle "other" text input area
                    const radios = this._modal.querySelectorAll('input[name="gcm-radio-opt"]');
                    const otherWrap = this._modal.querySelector('#gcm-radio-other-wrap');
                    const playerWrap = this._modal.querySelector('#gcm-radio-player-wrap');
                    radios.forEach(r => {
                        r.onchange = () => {
                            const label = r.closest('label');
                            if (r.value === 'other') {
                                otherWrap.style.display = 'block';
                                if (playerWrap) playerWrap.style.display = 'none';
                                setTimeout(() => inp.focus(), 100);
                            } else {
                                otherWrap.style.display = 'none';
                                if (playerWrap) {
                                    playerWrap.style.display = 'block';
                                    label.parentNode.insertBefore(playerWrap, label.nextSibling);
                                }
                            }
                        };
                    });
                }

                inp.oninput = () => {
                    if (count) count.innerText = `${inp.value.length}/${inputMaxLength}`;
                    inp.style.borderColor = 'var(--c-border)';
                };

                if (inputType !== 'radio') {
                    setTimeout(() => inp.focus(), 300);
                }
            }

            if (thirdText) {
                this._modal.querySelector('#gcm-third').onclick = () => this.close('third');
            }
            const cancelBtn = this._modal.querySelector('#gcm-cancel');
            if (cancelBtn) {
                cancelBtn.onclick = () => this.close(false);
            }


            // Lock body scroll to prevent page scroll behind modal (keep overlay scrollable)
            const scrollY = window.scrollY || document.documentElement.scrollTop;
            document.documentElement.style.overflow = 'hidden';
            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.width = '100%';
            // NOTE: Do NOT set touchAction:none or block touchmove on overlay — that kills modal scrolling

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
                display:flex; flex-direction:column; align-items:center; justify-content:flex-start;
                z-index:100000; opacity:0; pointer-events:none;
                transition:opacity 0.25s ease; padding:32px 16px;
                overflow-y:auto;
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
             <div id="invite-modal-card" style="margin: auto 0; background:rgba(23, 23, 28, 0.98); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.1); border-radius:32px; padding:28px; width:100%; max-width:340px; text-align:center; position:relative; transform:scale(0.85); opacity:0; transition:all 0.4s cubic-bezier(0.16, 1, 0.3, 1); box-shadow:0 30px 60px rgba(0,0,0,0.6);">
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

        // Lock body scroll to prevent page scroll behind modal (keep overlay scrollable)
        const scrollY = window.scrollY || document.documentElement.scrollTop;
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = '100%';
        // NOTE: Do NOT set touchAction:none — that kills modal scrolling

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
        const platform = window.Capacitor?.getPlatform?.() || 'web';
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
                const platform = window.Capacitor?.getPlatform?.() || 'web';
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
    renderMatchScore: function (match, approvedScore = null, players = null, showHeader = true, highlightUserId = null) {
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
                    team_no: parseInt(p.team_no),
                    user_id: parseInt(p.user_id),
                    point_change: original?.point_change ?? null
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
                    team_no: parseInt(p.team_no),
                    user_id: parseInt(p.user_id || p.id),
                    point_change: p.point_change ?? null
                };
                if (pData.team_no === 1) team1.push(pData);
                else if (pData.team_no === 2) team2.push(pData);
            });
        }

        const renderTeamRow = (teamPlayers, isWinner) => {
            const p1 = teamPlayers[0] || { name: '—' };
            const p2 = teamPlayers[1] || { name: '—' };

            const isFriendly = match.match_type === 'friendly';
            const accentColor = isFriendly ? '#5A91FF' : 'var(--c-orange)';

            const renderPlayerName = (p) => {
                let badge = '';
                const scorePts = approvedScore?.point_changes?.[p.user_id] ?? approvedScore?.point_changes?.[String(p.user_id)];
                const ptsToUse = (scorePts !== undefined && scorePts !== null) ? scorePts : p.point_change;

                if (highlightUserId && parseInt(p.user_id) === parseInt(highlightUserId) && ptsToUse !== null && ptsToUse !== undefined) {
                    const pts = parseInt(ptsToUse);
                    if (pts !== 0 && !isNaN(pts)) {
                        const bg = pts > 0 ? '#064e3b' : '#450a0a';
                        const color = pts > 0 ? '#4ade80' : '#f87171';
                        const border = pts > 0 ? '1px solid rgba(74,222,128,0.4)' : '1px solid rgba(248,113,113,0.4)';
                        const arrow = pts > 0 ? '↑' : '↓';
                        badge = `<span style="font-size:10px; font-weight:700; letter-spacing:0.3px; background:${bg}; color:${color}; padding:0 6px; border-radius:10px; border:${border}; box-shadow:0 2px 6px rgba(0,0,0,0.4); white-space:nowrap; display:inline-flex; align-items:center; height:18px; line-height:1; margin-left:3px; vertical-align:middle;"><span style="font-size:11px; margin-right:2px; font-weight:800;">${arrow}</span>${Math.abs(pts)}</span>`;
                    }
                }
                return `<span class="msc-premium-player-name">${p.name}</span>${badge}`;
            };

            return `
                <div class="msc-premium-row" style="opacity:${isWinner ? '1' : '0.85'}; background:${isWinner ? (isFriendly ? 'rgba(90,145,255,0.06)' : 'rgba(247,148,29,0.06)') : 'transparent'};">
                    <div class="msc-premium-players" style="font-weight:${isWinner ? '700' : '400'}; color:${isWinner ? '#fff' : 'rgba(255,255,255,0.8)'};">
                        ${renderPlayerName(p1)}
                        <span style="opacity:0.25; margin:0 4px;">/</span>
                        ${renderPlayerName(p2)}
                    </div>
                    <div class="msc-premium-scores">
                        ${sets.map(s => {
                const isSetWinner = s.winner === (teamPlayers === team1 ? 1 : 2);
                const val = (teamPlayers === team1) ? s.s1 : s.s2;
                return `
                                <span class="msc-premium-score-val" style="color:${isSetWinner ? accentColor : 'rgba(255,255,255,0.35)'};">
                                    ${val}
                                </span>
                            `;
            }).join('')}
                    </div>
                </div>
            `;
        };

        const headerVenue = (match.venue || 'Venue TBD').split(' - ')[0].trim();
        const headerDate = match.scheduled_at
            ? new Date(match.scheduled_at.replace(' ', 'T')).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })
            : '';

        const isFriendly = match.match_type === 'friendly';
        const typeBadgeColor = isFriendly ? '#5A91FF' : 'var(--c-orange)';

        const headerHtml = showHeader ? `
            <div class="msc-premium-header">
                <span class="msc-premium-venue-date">${headerVenue} • ${headerDate}</span>
                <span class="msc-premium-type-badge" style="color:${typeBadgeColor};">
                    ${isFriendly ? '🤝 Friendly' : '🏆 Competition'}
                </span>
            </div>
        ` : '';

        const cardBorderColor = isFriendly ? '#5A91FF' : 'var(--c-orange)';

        return `
            <div class="msc-premium-card">
                ${headerHtml}
                <div class="msc-premium-body">
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

        const matchesSubEl = document.getElementById(`${prefix}-matches-sub`);
        if (matchesSubEl && stats.matches_played > 0) {
            const compCount = stats.comp_played ?? 0;
            const friendlyCount = stats.friendly_played ?? 0;
            matchesSubEl.innerHTML = safeHTML(`<span style="color:var(--c-orange);"><span style="font-size:14px; vertical-align:-1px; margin-right:5px;">🏆</span><span style="font-size:14px;">${compCount}</span></span> <span style="opacity:0.5; margin:0 5px;">|</span> <span style="color:#5B8BFF;"><span style="font-size:17px; vertical-align:-2px; margin-right:5px;">🤝</span><span style="font-size:14px;">${friendlyCount}</span></span>`);
            matchesSubEl.style.fontSize = '12px';
            matchesSubEl.style.fontWeight = '500';
            matchesSubEl.style.letterSpacing = '0.5px';
        }

        const wlEl = document.getElementById(`${prefix}-wl`);
        if (wlEl && stats.matches_played > 0) {
            wlEl.innerHTML = safeHTML(`<span style="color:#4ebd79;">${stats.matches_won}W</span> <span style="opacity:0.5; margin:0 5px;">/</span> <span style="color:#e57373;">${stats.matches_lost}L</span>`);
            wlEl.style.fontSize = '12px';
            wlEl.style.fontWeight = '500';
            wlEl.style.letterSpacing = '0.5px';
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {

    // iOS & iPadOS Native Left-Edge Swipe Back Gesture Handler
    const isIOSDevice = (window.Capacitor?.getPlatform?.() === 'ios') ||
        (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (isIOSDevice) {
        let edgeTouchStartX = 0;
        let edgeTouchStartY = 0;
        let isEdgeSwipeCandidate = false;

        document.addEventListener('touchstart', (e) => {
            if (!e.touches || e.touches.length !== 1) return;
            const touch = e.touches[0];
            if (touch.clientX <= 50) {
                edgeTouchStartX = touch.clientX;
                edgeTouchStartY = touch.clientY;
                isEdgeSwipeCandidate = true;
            } else {
                isEdgeSwipeCandidate = false;
            }
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            if (!isEdgeSwipeCandidate || !e.changedTouches || e.changedTouches.length !== 1) return;
            const touch = e.changedTouches[0];
            const deltaX = touch.clientX - edgeTouchStartX;
            const deltaY = Math.abs(touch.clientY - edgeTouchStartY);

            if (deltaX > 70 && deltaY < 50 && deltaX > deltaY * 1.5) {
                isEdgeSwipeCandidate = false;
                if (typeof Router !== 'undefined' && Router.back) {
                    Router.back();
                }
            }
            isEdgeSwipeCandidate = false;
        }, { passive: true });
    }

    // Initialize the SPA router once DOM is ready
    Auth.init().then(() => {
        return Auth.syncWithServer();
    }).then(() => {
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
    });


    // Mobile Status Bar Fix
    const StatusBar = window.Capacitor?.Plugins?.StatusBar;
    if (StatusBar) {
        StatusBar.setBackgroundColor({ color: '#0D1117' }); // old: #11161E
        StatusBar.setStyle({ style: 'DARK' });
    }

    // Android Physical Back Button & App State Handler
    const App = window.Capacitor?.Plugins?.App;
    if (App) {
        App.addListener('appStateChange', ({ isActive }) => {
            if (!isActive && typeof ChatController !== 'undefined' && ChatController._isShowing && ChatController._matchId) {
                // Clear chat presence instantly on mobile app backgrounding
                ChatController.stop();
            } else if (isActive && typeof ChatController !== 'undefined' && ChatController._isShowing && ChatController._matchId) {
                // Delay refresh slightly to allow the native OS network interface to re-establish connection
                setTimeout(() => {
                    if (navigator.onLine) {
                        ChatController.startPoll();
                        ChatController.loadMessages(false);
                    }
                }, 300);
            }
        });

        // App Launch / Deep Link Handler
        App.addListener('appUrlOpen', (data) => {
            console.log('[App] Deep link received:', data.url);
            if (data.url) {
                try {
                    const urlObj = new URL(data.url);
                    const path = urlObj.pathname;
                    const search = urlObj.search;

                    if (path && (path.startsWith('/matches/') || path.startsWith('/share/'))) {
                        const matchCode = path.replace('/matches/', '').replace('/share/', '').trim();
                        if (matchCode) {
                            console.log('[App] Routing to deep linked match:', matchCode);
                            if (typeof Router !== 'undefined') {
                                Router.navigate('/matches/' + matchCode, true, true);
                            }
                        }
                    } else if (path === '/reset-password') {
                        console.log('[App] Routing to reset-password with token:', search);
                        if (typeof Router !== 'undefined') {
                            Router.navigate('/reset-password' + search, true, true);
                        }
                    } else if (path === '/verify-email') {
                        console.log('[App] Routing to verify-email with token:', search);
                        if (typeof Router !== 'undefined') {
                            Router.navigate('/verify-email' + search, true, true);
                        }
                    }
                } catch (err) {
                    console.error('[App] Deep link routing error:', err);
                }
            }
        });

        App.addListener('backButton', () => {
            // Priority 1: Close confirm modal if open
            if (typeof ConfirmModal !== 'undefined' && ConfirmModal._isOpen) {
                ConfirmModal.close(false);
                return;
            }

            // Priority 2: Close match score submission modal if open
            const scoringModal = document.getElementById('scoring-modal-overlay');
            if (scoringModal && typeof ScoringController !== 'undefined') {
                ScoringController.closeModal();
                return;
            }

            // Priority 3: Close exclusive invites (coupon codes) if open
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
        const platform = window.Capacitor?.getPlatform?.() || 'web';
        if (platform) {
            document.body.classList.add(`platform-${platform}`);
        }

        // Force hide scrollbars via JS (Safety Injector for WebView)
        const style = document.createElement('style');
        style.textContent = `
            *::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; background: transparent !important; }
            *::-webkit-scrollbar-thumb { display: none !important; background: transparent !important; }
            *::-webkit-scrollbar-track { display: none !important; background: transparent !important; }
            html, body { scrollbar-width: none !important; -ms-overflow-style: none !important; }
        `;
        document.head.appendChild(style);
        // CapacitorUpdater background check and instant auto-reload on download complete
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorUpdater) {
            const updater = window.Capacitor.Plugins.CapacitorUpdater;
            updater.notifyAppReady().catch(function (e) { });

            // Listen for download completion -> set active bundle pointer and reload immediately (works on iOS & Android)
            updater.addListener('downloadComplete', function (info) {
                if (info && info.bundle && info.bundle.id) {
                    updater.set({ id: info.bundle.id }).then(function () {
                        return updater.reload();
                    }).catch(function (e) {
                        return updater.reload();
                    });
                } else {
                    updater.reload().catch(function (e) { });
                }
            }).catch(function (e) { });

            updater.sync().catch(function (e) { });
        }
    }
});

// Top-Level Global Password Visibility Toggle (instantly available before DOMContentLoaded)
window.togglePasswordVisibility = function (toggle) {
    if (!toggle) return;

    // 300ms debounce guard to prevent dual touchstart/click event bounce on mobile
    const now = Date.now();
    if (toggle._lastToggle && (now - toggle._lastToggle < 300)) {
        return;
    }
    toggle._lastToggle = now;

    const wrap = toggle.closest('.password-wrap');
    if (!wrap) return;

    const input = wrap.querySelector('input');
    if (!input) return;

    const isPassword = input.type === 'password' || input.getAttribute('type') === 'password';
    const newType = isPassword ? 'text' : 'password';

    // Mutate native input property and HTML attribute
    input.type = newType;
    input.setAttribute('type', newType);

    // Swap the eye SVG icon state safely
    const svg = toggle.querySelector('svg');
    const width = svg ? (svg.getAttribute('width') || '20') : '20';
    const height = svg ? (svg.getAttribute('height') || '20') : '20';

    if (isPassword) {
        // Slashed Eye
        toggle.innerHTML = `
            <svg viewBox="0 0 24 24" width="${width}" height="${height}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-icon">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>
        `;
    } else {
        // Normal Eye
        toggle.innerHTML = `
            <svg viewBox="0 0 24 24" width="${width}" height="${height}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-icon">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            </svg>
        `;
    }
};

const handleGlobalMobileAuthToggle = (e) => {
    const showBtn = e.target.closest('.show-login-form-btn');
    if (showBtn) {
        e.preventDefault();
        e.stopPropagation();
        const page = document.querySelector('.auth-page');
        if (page) {
            page.classList.add('mobile-show-form');
            const form = page.querySelector('#login-form');
            if (form) {
                if (typeof UI !== 'undefined' && UI.clearErrors) UI.clearErrors(form);
                setTimeout(() => {
                    if (typeof UI !== 'undefined' && UI.clearErrors) UI.clearErrors(form);
                    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
                }, 50);
            }
        }
        return false;
    }

    const backBtn = e.target.closest('.mobile-back-hero-btn');
    if (backBtn) {
        e.preventDefault();
        e.stopPropagation();
        const page = document.querySelector('.auth-page');
        if (page) {
            page.classList.remove('mobile-show-form');
            const form = page.querySelector('#login-form');
            if (form && typeof UI !== 'undefined' && UI.clearErrors) {
                UI.clearErrors(form);
            }
        }
        return false;
    }
};

const handleGlobalPasswordToggle = (e) => {
    const toggle = e.target.closest('.password-toggle');
    if (toggle) {
        e.preventDefault();
        window.togglePasswordVisibility(toggle);
    }
};

document.addEventListener('pointerdown', handleGlobalPasswordToggle);
document.addEventListener('click', handleGlobalPasswordToggle);
document.addEventListener('click', handleGlobalMobileAuthToggle, true);
