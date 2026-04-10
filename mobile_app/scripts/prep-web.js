const fs = require('fs');
const path = require('path');

const wwwDir = path.join(__dirname, '../www');
const jsConfigPath = path.join(wwwDir, 'frontend/js/config.js');
const indexHtmlPath = path.join(wwwDir, 'index.html');

// config.js is now dynamically handling Capacitor detection, no need to overwrite it

// Update index.html base href
if (fs.existsSync(indexHtmlPath)) {
    let content = fs.readFileSync(indexHtmlPath, 'utf8');
    content = content.replace(/<base href="[^"]*">/g, '<base href="./">');
    fs.writeFileSync(indexHtmlPath, content);
    console.log('✅ index.html base href set to ./');
}

console.log('✅ Mobile build preparation complete!');
