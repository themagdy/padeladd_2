#!/usr/bin/env node
/**
 * Migration: Move admin_token from URL query string to Authorization Bearer header.
 * Reads pl_mod/js/controllers.js, applies transformations, writes it back.
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../pl_mod/js/controllers.js');
let content = fs.readFileSync(filePath, 'utf8');

// ── Step 1: Add _admFetch wrapper at the very top ──────────────────────────
const wrapper = `// Security: Admin fetch wrapper — sends token as Authorization header, not in URL
function _admFetch(url, opts = {}) {
    const token = localStorage.getItem('admin_token');
    opts.headers = Object.assign({}, opts.headers || {}, { 'Authorization': 'Bearer ' + token });
    return fetch(url, opts);
}

`;
content = wrapper + content;

// ── Step 2: Remove ?admin_token=${token} from fetch URLs ───────────────────
content = content.replace(/\?admin_token=\$\{token\}/g, '');

// ── Step 3: Remove &admin_token=${token} from fetch URLs ───────────────────
content = content.replace(/&admin_token=\$\{token\}/g, '');

// ── Step 4: Replace fetch( with _admFetch( for all admin API calls ─────────
// Only replace fetch calls pointing to ../backend/api/admin/
content = content.replace(
    /\bawait fetch\(`(\.\.\/backend\/api\/admin\/[^`]*)`/g,
    'await _admFetch(`$1`'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Done. admin_token removed from URLs. _admFetch wrapper added.');
