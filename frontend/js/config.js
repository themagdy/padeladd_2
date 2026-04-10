const isLocal = window.location.pathname.startsWith('/padeladd4');
const BASE_PATH = isLocal ? '/padeladd4' : '/pl';

const CONFIG = {
    BASE_PATH: BASE_PATH,
    API_BASE_URL: BASE_PATH + '/backend/api',
    LIVE_URL: 'https://ahmedmagdy.com/pl',
    APP_ENV: isLocal ? 'development' : 'production'
};
