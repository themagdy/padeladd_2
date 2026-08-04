const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const jsDir = path.join(__dirname, '../www/frontend/js');
if (!fs.existsSync(jsDir)) {
    console.error('❌ www/frontend/js directory not found!');
    process.exit(1);
}

const files = fs.readdirSync(jsDir);
files.forEach(file => {
    if (file.endsWith('.js') && !file.endsWith('.min.js')) {
        const filePath = path.join(jsDir, file);
        console.log(`⚡ Minifying ${file}...`);
        try {
            execSync(`npx esbuild "${filePath}" --minify --allow-overwrite --outfile="${filePath}"`);
        } catch (err) {
            console.error(`❌ Failed to minify ${file}:`, err.message);
        }
    }
});

console.log('✅ All non-minified JavaScript files in www/frontend/js have been minified!');
