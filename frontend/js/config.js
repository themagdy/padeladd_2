const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isMobile = window.location.protocol === 'capacitor:' || window.location.protocol === 'http:'; // Capacitor/Cordova detection

// On mobile, we ALWAYS want the live URL
// On local web, we want /padeladd4
// On live web, we want /pl
let BASE_PATH = isLocal ? '/padeladd4' : '/pl';
let API_BASE = isLocal ? '/padeladd4/backend/api' : 'https://ahmedmagdy.com/pl/backend/api';

if (window.location.protocol === 'capacitor:') {
    API_BASE = 'https://ahmedmagdy.com/pl/backend/api';
    BASE_PATH = ''; // Mobile assets are root-relative
}

const CONFIG = {
    BASE_PATH: BASE_PATH,
    API_BASE_URL: API_BASE,
    LIVE_URL: 'https://ahmedmagdy.com/pl',
    APP_ENV: isLocal ? 'development' : 'production'
};
