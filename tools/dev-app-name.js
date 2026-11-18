// Development only (macOS): `npm start` runs node_modules/electron/dist/Electron.app, so the Dock tooltip and the
// menu bar say "Electron". This renames that local copy to the productName from package.json.
// Runs automatically after `npm install` (postinstall), or by hand: `node tools/dev-app-name.js`.
// The packaged app (`npm run dist`) doesn't need this: electron-builder names it from productName.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
if (process.platform !== 'darwin') process.exit(0);
const name = require('../package.json').productName || 'Tiny Arcade';
const app = path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'Electron.app');
const plist = path.join(app, 'Contents', 'Info.plist');
if (!fs.existsSync(plist)) process.exit(0);
for (const key of ['CFBundleName', 'CFBundleDisplayName']) execFileSync('plutil', ['-replace', key, '-string', name, plist]);
fs.utimesSync(app, new Date(), new Date());   // nudge macOS to re-read the bundle name
console.log(`dev Electron.app now shows as "${name}"`);
