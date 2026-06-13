const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isCapacitor = typeof window.Capacitor !== 'undefined' || window.location.protocol === 'capacitor:'; // Only rely on window.Capacitor or protocol

// Check if accessing mobile_app/www directory directly on local MAMP/XAMPP
const isLocalWww = isLocal && window.location.pathname.includes('/mobile_app/www');

// On mobile, we ALWAYS want the live URL
// On local web, we want /padeladd4
// On live web, we want root /
let BASE_PATH = isLocal ? '/padeladd4' : '';
if (isLocalWww) {
    BASE_PATH = window.location.pathname.split('/index.html')[0];
    if (BASE_PATH.endsWith('/')) BASE_PATH = BASE_PATH.slice(0, -1);
}

let API_BASE = isLocal && !isCapacitor ? '/padeladd4/backend/api' : 'https://padeladd.com/backend/api';

if (isCapacitor) {
    API_BASE = 'https://padeladd.com/backend/api';
    BASE_PATH = ''; // Mobile assets are root-relative
}

const CONFIG = {
    BASE_PATH: BASE_PATH,
    API_BASE_URL: API_BASE,
    ASSET_BASE: isCapacitor ? 'https://padeladd.com' : (isLocal ? '/padeladd4' : ''),
    LIVE_URL: 'https://padeladd.com',
    APP_ENV: isLocal ? 'development' : 'production',
    APP_BUILD_REF: isCapacitor ? "2.3.89" : "Web",
    SKELETON_DELAY: 300
};
