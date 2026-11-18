// Wraps every app/assets/**/*.glb into a small .glb.js script so models load from file:// in Electron
// (and in any browser) with a plain <script> tag, no web server needed.
//   node tools/pack-assets.js      (or: npm run assets)
// Then add <script src="assets/<folder>/<name>.glb.js"></script> to app/index.html.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', 'app', 'assets');
// A folder with a `.bundle` file is packed into ONE script (<folder>/<folder>.bundle.js) instead of one per model,
// and those models are parsed only when a game that lists the folder in `assets: [...]` starts (Assets.load).
function walk(dir) {
  const files = fs.readdirSync(dir);
  const bundle = files.includes('.bundle') ? [] : null;
  for (const f of files) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.glb')) {
      const key = path.relative(root, p).replace(/\\/g, '/').replace(/\.glb$/, '');
      const b64 = fs.readFileSync(p).toString('base64');
      const v = bundle ? 'TINY_ASSETS_LAZY' : 'TINY_ASSETS';   // bundles are parsed lazily when their game starts
      const line = `(window.${v} = window.${v} || {})[${JSON.stringify(key)}] = "${b64}";\n`;
      if (bundle) bundle.push(line); else fs.writeFileSync(p + '.js', line);
      console.log('packed', key, Math.round(b64.length / 1024) + ' KB');
    }
  }
  if (bundle) {
    const out = path.join(dir, path.basename(dir) + '.bundle.js');
    fs.writeFileSync(out, bundle.join(''));
    console.log('bundled', path.relative(root, out), bundle.length + ' models', Math.round(fs.statSync(out).size / 1024) + ' KB');
  }
}
walk(root);
