// Wraps every app/assets/**/*.glb into a small .glb.js script so models load from file:// in Electron
// (and in any browser) with a plain <script> tag, no web server needed.
//   node tools/pack-assets.js      (or: npm run assets)
// Then add <script src="assets/<folder>/<name>.glb.js"></script> to app/index.html.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', 'app', 'assets');
function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.glb')) {
      const key = path.relative(root, p).replace(/\\/g, '/').replace(/\.glb$/, '');
      const b64 = fs.readFileSync(p).toString('base64');
      fs.writeFileSync(p + '.js', `(window.TINY_ASSETS = window.TINY_ASSETS || {})[${JSON.stringify(key)}] = "${b64}";\n`);
      console.log('packed', key, Math.round(b64.length / 1024) + ' KB');
    }
  }
}
walk(root);
