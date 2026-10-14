/**
 * Build script for Zen2048
 * Copies runtime web assets from src/ to www/
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');
const wwwDir = path.join(__dirname, '..', 'www');

if (!fs.existsSync(wwwDir)) {
  fs.mkdirSync(wwwDir, { recursive: true });
}

const files = fs.readdirSync(srcDir);
let copied = 0;

for (const file of files) {
  const srcPath = path.join(srcDir, file);
  const destPath = path.join(wwwDir, file);
  const stat = fs.statSync(srcPath);

  if (stat.isFile()) {
    fs.copyFileSync(srcPath, destPath);
    copied++;
  }
}

console.log(`Zen2048 build complete: copied ${copied} assets to www/`);
