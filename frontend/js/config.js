const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isCapacitor = typeof window.Capacitor !== 'undefined' || window.location.protocol === 'capacitor:'; // Only rely on window.Capacitor or protocol

// Check if accessing mobile_app/www directory directly on local MAMP/XAMPP
const isLocalWww = isLocal && window.location.pathname.includes('/mobile_app/www');

// On mobile, we ALWAYS want the live URL
// On local web, we want /padeladd4
// On live web, we want /pl
let BASE_PATH = isLocal ? '/padeladd4' : '/pl';
if (isLocalWww) {
    BASE_PATH = window.location.pathname.split('/index.html')[0];
    if (BASE_PATH.endsWith('/')) BASE_PATH = BASE_PATH.slice(0, -1);
}

let API_BASE = isLocal && !isCapacitor ? '/padeladd4/backend/api' : 'https://ahmedmagdy.com/pl/backend/api';

if (isCapacitor) {
    API_BASE = 'https://ahmedmagdy.com/pl/backend/api';
    BASE_PATH = ''; // Mobile assets are root-relative
}

const CONFIG = {
    BASE_PATH: BASE_PATH,
    API_BASE_URL: API_BASE,
    LIVE_URL: 'https://ahmedmagdy.com/pl',
    APP_ENV: isLocal ? 'development' : 'production'
};
