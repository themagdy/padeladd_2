const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const wwwDir = path.join(__dirname, '../www');
const rootDir = path.join(__dirname, '../../');
const bundlesDir = path.join(rootDir, 'downloads/bundles');
const versionTxtPath = path.join(rootDir, 'version.txt');

// Extract current version from package.json
let version = '2.4.89';
const pkgPath = path.join(__dirname, '../package.json');
if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (pkg.version) version = pkg.version.trim();
}

// Ensure target output directory exists
if (!fs.existsSync(bundlesDir)) {
    fs.mkdirSync(bundlesDir, { recursive: true });
}

const zipFileName = `web-v${version}.zip`;
const zipFilePath = path.join(bundlesDir, zipFileName);

console.log(`📦 Creating OTA bundle zip: ${zipFileName}...`);

try {
    // Remove old zip if exists
    if (fs.existsSync(zipFilePath)) {
        fs.unlinkSync(zipFilePath);
    }

    // Zip contents of www directory into downloads/bundles/web-v{version}.zip
    execSync(`cd "${wwwDir}" && zip -r "${zipFilePath}" . -x "*.DS_Store"`);
    console.log(`✅ Bundle created successfully at: downloads/bundles/${zipFileName}`);
} catch (err) {
    console.error(`❌ Failed to create zip bundle:`, err.message);
}
