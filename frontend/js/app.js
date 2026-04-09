const Toast = {
    show: function(message, type = 'error') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.style.position = 'fixed';
            container.style.top = '20px'; // Top instead of bottom for visibility
            container.style.left = '50%';
            container.style.transform = 'translateX(-50%)';
            container.style.zIndex = '9999';
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.gap = '10px';
            container.style.width = '90%';
            container.style.maxWidth = '400px';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.style.background = 'var(--c-bg-card, #1a1e26)'; // Neutral dark card
        toast.style.color = 'var(--c-text, #ffffff)';
        toast.style.padding = '18px 20px';
        toast.style.borderRadius = '12px';
        toast.style.border = type === 'error' ? '1px solid rgba(244, 67, 54, 0.5)' : '1px solid rgba(16, 185, 129, 0.5)';
        toast.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.7)';
        toast.style.fontSize = '14px';
        toast.style.fontWeight = '500';
        toast.style.textAlign = 'center';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        toast.style.transition = 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        toast.textContent = message;

        container.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });

        // Remove after 6 seconds (longer duration)
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-20px)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 6000);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Initialize the SPA router once DOM is ready
    Router.init();
});
