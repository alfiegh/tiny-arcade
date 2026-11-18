// Renders the menu icons: each game's hero (S.hero) on a transparent background -> app/assets/icons/<id>.png
//   npm run icons                 (all games)
//   npm run icons -- dragon-sky   (just one)
// Each game sets S.hero (an Object3D, a list, or a function returning a list). The game runs for a moment in a
// hidden window, then everything except the hero is hidden and it is rendered from a 3/4 angle with the game's
// own lights + environment, 2x supersampled. Tweak the angle per game in VIEWS below.
const { app, BrowserWindow } = require('electron');
const fs = require('fs'), path = require('path');

const SIZE = 512;
// az: degrees around the hero (0 = straight at its front), el: degrees above, pad: framing, wait: seconds of play first
// space 'camera' = angles relative to the game's own camera instead of the hero's facing
const VIEWS = {
  'button-party': { az: 20, el: 12, pad: 1.05, space: 'camera' },
  'drum-band':    { az: 15, el: 16, pad: 0.85, space: 'camera' },
  'fishy-swim':   { az: 25, el: 10, pad: 1.0, space: 'camera' },
  'balloon-pop':  { az: 0, el: 5, pad: 0.85, space: 'camera', wait: 4.5 },
  'dino-world':   { az: 35, el: 14, pad: 0.85 },
  'tractor':      { az: 38, el: 18, pad: 1.0 },
  'sand-digger':  { az: 40, el: 20, pad: 0.88 },
  'dragon-sky':   { az: 12, el: 12, pad: 0.8 },
};

const root = path.join(__dirname, '..', 'app');
const outDir = path.join(root, 'assets', 'icons');
const only = process.argv.slice(2).filter(a => VIEWS[a]);

// runs inside the game page
function capture(view, size) {
  const S = window.__stage, T = S.T;
  let hero = typeof S.hero === 'function' ? S.hero() : S.hero;
  hero = [].concat(hero).filter(Boolean);
  S.scene.updateMatrixWorld(true);
  const keep = new Set();
  hero.forEach(h => { h.traverse(n => keep.add(n)); h.traverseAncestors(a => keep.add(a)); });
  const hidden = [];
  S.scene.traverse(o => { if ((o.isMesh || o.isSprite || o.isLine || o.isPoints) && o.visible && !keep.has(o)) { o.visible = false; hidden.push(o); } });
  const bg = S.scene.background, fog = S.scene.fog; S.scene.background = null; S.scene.fog = null;

  const box = new T.Box3(); hero.forEach(h => box.expandByObject(h, true));
  const sphere = box.getBoundingSphere(new T.Sphere());
  // direction: in the hero's own yaw (front = +Z) or relative to the game camera
  let yaw;
  if (view.space === 'camera') { const d = S.camera.getWorldDirection(new T.Vector3()); yaw = Math.atan2(-d.x, -d.z); }
  else { const q = hero[0].getWorldQuaternion(new T.Quaternion()), f = new T.Vector3(0, 0, 1).applyQuaternion(q); yaw = Math.atan2(f.x, f.z); }
  const az = yaw + view.az * Math.PI / 180, el = view.el * Math.PI / 180;
  const cam = new T.PerspectiveCamera(28, 1, 0.05, 2000);
  const dist = sphere.radius / Math.sin(cam.fov * Math.PI / 360) * (view.pad || 1);
  cam.position.copy(sphere.center).add(new T.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(dist));
  cam.near = dist / 50; cam.far = dist * 4; cam.updateProjectionMatrix(); cam.lookAt(sphere.center);

  // soft studio light on top of the game's own lighting, so every icon is lit the same friendly way
  const hemi = new T.HemisphereLight('#ffffff', '#8a7f9e', 1.1), key = new T.DirectionalLight('#fff6e6', 1.6);
  key.position.copy(cam.position).add(new T.Vector3(0, dist * 0.8, 0)).addScaledVector(new T.Vector3().crossVectors(cam.up, cam.position.clone().sub(sphere.center)).normalize(), -dist * 0.6);
  key.target.position.copy(sphere.center);
  S.scene.add(hemi, key, key.target);
  const big = size * 2;
  const r = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(big, big); r.setClearColor(0x000000, 0);
  r.toneMapping = S.renderer.toneMapping; r.toneMappingExposure = S.renderer.toneMappingExposure;
  r.outputColorSpace = S.renderer.outputColorSpace; r.shadowMap.enabled = true; r.shadowMap.type = T.PCFShadowMap;
  r.render(S.scene, cam);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(r.domElement, 0, 0, size, size);
  r.dispose(); S.scene.remove(hemi, key, key.target);
  hidden.forEach(o => { o.visible = true; }); S.scene.background = bg; S.scene.fog = fog;
  return c.toDataURL('image/png');
}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.whenReady().then(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const w = new BrowserWindow({ width: 1100, height: 700, show: false, webPreferences: { offscreen: true, backgroundThrottling: false } });
  w.webContents.setFrameRate(60);
  for (const [id, view] of Object.entries(VIEWS)) {
    if (only.length && !only.includes(id)) continue;
    await w.loadURL('file://' + path.join(root, 'index.html') + '?icon=' + id + '#' + id);   // query forces a real reload per game
    await new Promise(r => setTimeout(r, (view.wait || 3) * 1000));
    try {
      const url = await w.webContents.executeJavaScript(`(${capture})(${JSON.stringify(view)}, ${SIZE})`);
      fs.writeFileSync(path.join(outDir, id + '.png'), Buffer.from(url.split(',')[1], 'base64'));
      console.log('icon', id);
    } catch (e) { console.log('FAILED', id, e.message); }
  }
  app.quit();
});
