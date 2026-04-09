const fs = require('fs');
const path = require('path');

const wwwDir = path.join(__dirname, '../www');
const jsConfigPath = path.join(wwwDir, 'frontend/js/config.js');
const indexHtmlPath = path.join(wwwDir, 'index.html');

// Update JS Config
if (fs.existsSync(jsConfigPath)) {
    let content = fs.readFileSync(jsConfigPath, 'utf8');
    content = content.replace(/BASE_PATH:\s*['"][^'"]*['"]/g, "BASE_PATH: ''");
    content = content.replace(/API_BASE_URL:\s*['"][^'"]*['"]/g, "API_BASE_URL: 'https://ahmedmagdy.com/pl/backend/api'");
    fs.writeFileSync(jsConfigPath, content);
    console.log('Updated config.js');
}

// Update index.html base href
if (fs.existsSync(indexHtmlPath)) {
    let content = fs.readFileSync(indexHtmlPath, 'utf8');
    content = content.replace(/<base href="[^"]*">/g, '<base href="./">');
    fs.writeFileSync(indexHtmlPath, content);
    console.log('Updated index.html');
}
