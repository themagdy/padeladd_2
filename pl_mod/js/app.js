window.AdminApp = {
    contentDiv: document.getElementById('admin-content'),
    titleEl: document.getElementById('page-title'),

    init() {
        this.checkAuth();
        this.handleRouting();
        window.addEventListener('hashchange', () => this.handleRouting());
        this.initModalObserver();

        // Global Modal Dismissal (Click Outside to Close)
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                // Direct hide
                e.target.style.display = 'none';

                // Also trigger controller-specific close if it exists
                const activePage = window.location.hash.replace('#', '') || 'dashboard';
                if (AdminControllers[activePage]) {
                    if (typeof AdminControllers[activePage].closeModal === 'function') {
                        AdminControllers[activePage].closeModal();
                    }
                    if (typeof AdminControllers[activePage].closeStatsModal === 'function') {
                        AdminControllers[activePage].closeStatsModal();
                    }
                    if (typeof AdminControllers[activePage].closePreviewModal === 'function') {
                        AdminControllers[activePage].closePreviewModal();
                    }
                }
            }
        });
    },

    checkAuth() {
        const token = localStorage.getItem('admin_token');
        if (!token) {
            window.location.href = 'login.html';
        }
    },

    logout() {
        localStorage.removeItem('admin_token');
        window.location.href = 'login.html';
    },

    async handleRouting() {
        const hash = window.location.hash.replace('#', '') || 'dashboard';
        this.updateActiveNavLink(hash);
        await this.loadPage(hash);
    },

    updateActiveNavLink(page) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.page === page);
        });
        
        const activeLink = document.querySelector(`.nav-link[data-page="${page}"]`);
        if (activeLink) {
            this.titleEl.innerText = activeLink.innerText.trim().replace(/^.+?\s/, '');
        }
    },

    async loadPage(page) {
        console.log(`Loading page: ${page}...`);
        this.contentDiv.innerHTML = '<div class="loader" style="color:#fff; padding:40px; text-align:center;">Loading...</div>';
        
        // Clear previous header actions
        const headerActions = document.getElementById('header-actions');
        if (headerActions) headerActions.innerHTML = '';

        try {
            const response = await fetch(`pages/${page}.html?v=${Date.now()}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const html = await response.text();
            this.contentDiv.innerHTML = html;
            
            // Sync Search/Actions to header
            this.syncHeaderActions();

            // Re-initialize any page-specific logic
            await this.initPageScripts(page);
            this.updateModalScrollLock();
        } catch (error) {
            console.error(`Error loading page ${page}:`, error);
            this.contentDiv.innerHTML = `<div class="card" style="padding:40px; text-align:center;"><h3 style="color:var(--c-red)">Error Loading Page</h3></div>`;
        }
    },

    syncHeaderActions() {
        const source = document.getElementById('page-search-source');
        const target = document.getElementById('header-actions');
        if (source && target) {
            target.innerHTML = source.innerHTML;
            source.innerHTML = ''; // Hide from original page
        }
    },

    async initPageScripts(page) {
        console.log(`Initializing scripts for: ${page}`);
        // Initialize the controller if it exists
        if (AdminControllers[page] && typeof AdminControllers[page].init === 'function') {
            try {
                await AdminControllers[page].init();
                console.log(`Controller for ${page} initialized.`);
            } catch (err) {
                console.error(`Controller init error for ${page}:`, err);
            }
        } else {
            console.warn(`No controller found for page: ${page}`);
        }
    },
    
    toast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `admin-toast ${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${type === 'success' ? '✅' : '❌'}</span>
            <span class="toast-msg">${message}</span>
        `;
        
        container.appendChild(toast);

        // Auto-remove
        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 400);
        }, 4000);
    },
    
    updateModalScrollLock() {
        let isAnyModalVisible = false;
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            // Check inline style first as it's what we change in JS
            if (modal.style.display !== 'none' && modal.style.display !== '') {
                isAnyModalVisible = true;
            } else {
                // Fallback to computed style
                const style = window.getComputedStyle(modal);
                if (style.display !== 'none' && style.visibility !== 'hidden') {
                    isAnyModalVisible = true;
                }
            }
        });

        const main = document.querySelector('.admin-main');
        if (main) {
            main.style.overflowY = isAnyModalVisible ? 'hidden' : 'auto';
        }
        document.body.classList.toggle('modal-open', isAnyModalVisible);
        document.documentElement.classList.toggle('modal-open', isAnyModalVisible);
    },
    
    initModalObserver() {
        const observer = new MutationObserver(() => this.updateModalScrollLock());

        observer.observe(document.body, { 
            attributes: true, 
            subtree: true, 
            childList: true, // Watch for new modals being added to the DOM
            attributeFilter: ['style', 'class'] 
        });
    }
};

// Start the app
document.addEventListener('DOMContentLoaded', () => AdminApp.init());
