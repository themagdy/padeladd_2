window.AdminApp = {
    contentDiv: document.getElementById('admin-content'),
    titleEl: document.getElementById('page-title'),

    init() {
        this.checkAuth();
        this.handleRouting();
        window.addEventListener('hashchange', () => this.handleRouting());

        // Global Modal Dismissal (Click Outside to Close)
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                const activePage = window.location.hash.replace('#', '') || 'dashboard';
                if (AdminControllers[activePage] && typeof AdminControllers[activePage].closeModal === 'function') {
                    AdminControllers[activePage].closeModal();
                } else if (AdminControllers.venues && e.target.id === 'review-venue-modal') {
                    AdminControllers.venues.closeModal();
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
    }
};

// Start the app
document.addEventListener('DOMContentLoaded', () => AdminApp.init());
