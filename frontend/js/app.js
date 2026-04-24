const Toast = {
    show: function(message, type = 'info') {
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
        if (type === 'error')   icon = '❌';
        if (type === 'warning') icon = '⚠️';

        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <span class="toast-message">${message}</span>
        `;

        container.appendChild(toast);

        // Auto-remove after 4s
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-20px)';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
};

const ConfirmModal = {
    _modal: null,
    _resolve: null,

    show: function({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', showCancel = true, thirdText = null, thirdColor = 'var(--c-secondary)', type = 'info', showInput = false, inputPlaceholder = 'Enter reason...' }) {
        return new Promise((resolve) => {
            this._resolve = resolve;
            
            // Create container if not exists
            if (!this._modal) {
                this._modal = document.createElement('div');
                this._modal.id = 'global-confirm-modal';
                this._modal.style.cssText = `
                    position:fixed; top:0; left:0; width:100%; height:100%;
                    background:rgba(0,0,0,0.85); backdrop-filter:blur(8px);
                    display:flex; align-items:center; justify-content:center;
                    z-index:9999; opacity:0; pointer-events:none;
                    transition:opacity 0.25s ease; padding:32px;
                `;
                document.body.appendChild(this._modal);
            }

            const isWarning = type === 'warning';
            const icon = isWarning ? '⚡' : '👋';
            const confirmBtnColor = isWarning ? 'var(--c-red)' : 'var(--c-primary)';

            const inputHtml = showInput ? `
                <textarea id="gcm-input" placeholder="${inputPlaceholder}" style="width:100%; border:1px solid var(--c-border); background:rgba(255,255,255,0.05); color:var(--c-text); border-radius:12px; padding:12px; font-size:14px; margin-bottom:24px; resize:none; font-family:var(--font); outline:none;" rows="3"></textarea>
            ` : '';

            const thirdBtnHtml = thirdText ? `
                <button id="gcm-third" class="btn" style="background:${thirdColor}; color:white; border:none; padding:16px;">${thirdText}</button>
            ` : '';

            const cancelBtnHtml = showCancel ? `
                <button id="gcm-cancel" class="btn" style="background:none; border:none; color:var(--c-text-muted); padding:12px; font-size:14px; font-weight:600;">${cancelText}</button>
            ` : '';

            this._modal.innerHTML = `
                <div style="background:var(--c-bg-card); border:1px solid var(--c-border); border-radius:32px; width:100%; max-width:400px; padding:40px 32px; text-align:center; box-shadow:0 20px 40px rgba(0,0,0,0.4); transform:scale(0.95); transition:transform 0.25s ease;" id="gcm-card">
                    <div style="font-size:48px; margin-bottom:24px;">${icon}</div>
                    <h2 style="font-size:24px; font-weight:800; margin-bottom:12px; color:var(--c-text);">${title}</h2>
                    <p style="font-size:15px; color:var(--c-text-muted); line-height:1.6; margin-bottom:24px;">${message}</p>
                    ${inputHtml}
                    <div style="display:flex; flex-direction:column; gap:12px;">
                        <button id="gcm-confirm" class="btn" style="background:${confirmBtnColor}; color:white; border:none; padding:16px;">${confirmText}</button>
                        ${thirdBtnHtml}
                        ${cancelBtnHtml}
                    </div>
                </div>
            `;

            // Setup listeners
            this._modal.onclick = (e) => {
                if (e.target === this._modal) this.close(false);
            };
            this._modal.querySelector('#gcm-confirm').onclick = () => {
                const val = showInput ? this._modal.querySelector('#gcm-input').value.trim() : true;
                this.close(val);
            };
            if (thirdText) {
                this._modal.querySelector('#gcm-third').onclick = () => this.close('third');
            }
            const cancelBtn = this._modal.querySelector('#gcm-cancel');
            if (cancelBtn) {
                cancelBtn.onclick = () => this.close(false);
            }


            // Disable scroll (Hardened for mobile)
            document.documentElement.style.height = '100%';
            document.body.style.height = '100%';
            document.body.style.overflow = 'hidden';
            document.body.style.touchAction = 'none';

            // Prevent touchmove events from bubbling up
            this._modal.ontouchmove = (e) => e.preventDefault();

            // Trigger animation
            this._modal.style.opacity = '1';
            this._modal.style.pointerEvents = 'auto';
            setTimeout(() => {
                document.getElementById('gcm-card').style.transform = 'scale(1)';
            }, 10);
        });
    },

    close: function(result) {
        if (!this._modal) return;

        // Restore scroll
        document.documentElement.style.height = '';
        document.body.style.height = '';
        document.body.style.overflow = '';
        document.body.style.touchAction = '';
        this._modal.ontouchmove = null;

        this._modal.style.opacity = '0';
        this._modal.style.pointerEvents = 'none';
        document.getElementById('gcm-card').style.transform = 'scale(0.95)';
        setTimeout(() => {
            if (this._resolve) this._resolve(result);
        }, 250);
    }
};

const PollManager = {
    _timer: null,
    _activeTask: null,

    start: function(taskName, callback, interval = 15000) {
        this.stop();
        this._activeTask = taskName;
        this._timer = setInterval(() => {
            console.log(`[PollManager] Running: ${taskName}`);
            callback();
        }, interval);
    },

    stop: function() {
        if (this._timer) {
            console.log(`[PollManager] Stopping: ${this._activeTask}`);
            clearInterval(this._timer);
            this._timer = null;
            this._activeTask = null;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Initialize the SPA router once DOM is ready
    Router.init();

    // Phase 6: Initialize notifications engine
    NotificationsController.init();

    // Mobile Status Bar Fix
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.StatusBar) {
        const StatusBar = window.Capacitor.Plugins.StatusBar;
        StatusBar.setBackgroundColor({ color: '#171C26' });
        StatusBar.setStyle({ style: 'DARK' });
    }
});
