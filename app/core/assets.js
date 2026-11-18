// Parses the packed 3D models (app/assets/**/*.glb.js) once at startup.
//   Assets.ready  -> Promise that resolves when every model is parsed
//   Assets.get('dinos/trex') -> { scene, animations, meta } or null
//   Assets.load('cube/')    -> Promise: parses a lazily bundled pack on first use
const Assets = (() => {
  const store = {};
  function b64ToBuffer(b64) {
    const bin = atob(b64), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u.buffer;
  }
  // When does the Jump clip touch down again? (Body bone returns to its resting height after the peak)
  function landingTime(clip) {
    const tr = clip && clip.tracks.find(t => /Body\.position$/.test(t.name));
    if (!tr) return clip ? clip.duration * 0.75 : 0.8;
    const v = tr.values, n = tr.times.length;
    const y = i => v[i * 3 + 1];
    let peak = 0; for (let i = 1; i < n; i++) if (y(i) > y(peak)) peak = i;
    const base = y(0), thresh = base + (y(peak) - base) * 0.12;
    for (let i = peak; i < n; i++) if (y(i) <= thresh) return tr.times[i];
    return clip.duration * 0.75;
  }
  function parse(key, b64) {
    return new Promise(resolve => {
      if (!window.THREE || !THREE.GLTFLoader) return resolve();
      new THREE.GLTFLoader().parse(b64ToBuffer(b64), '', gltf => {
        const jump = gltf.animations.find(a => a.name === 'Jump');
        store[key] = { scene: gltf.scene, animations: gltf.animations, meta: { landAt: landingTime(jump) } };
        resolve();
      }, err => { console.warn('Could not load model', key, err); resolve(); });
    });
  }
  // eager models (one .glb.js each) are parsed at startup
  const raw = window.TINY_ASSETS || {};
  const ready = Promise.all(Object.entries(raw).map(([key, b64]) => parse(key, b64))).then(() => { delete window.TINY_ASSETS; });
  // bundled packs (<folder>.bundle.js) stay as text until a game asks for them: Assets.load('cube/') -> Promise
  // (a game lists its packs in Games.register({ assets: ['cube/'] }) and the shell loads them behind the loading screen)
  // The bundle script itself is only added to the page then (assets/cube/ -> assets/cube/cube.bundle.js), so app startup never pays for it.
  const loading = {};
  function script(pre) {
    const lazy = window.TINY_ASSETS_LAZY || {};
    if (Object.keys(lazy).some(k => k.startsWith(pre))) return Promise.resolve();
    return new Promise(resolve => {
      const el = document.createElement('script');
      el.src = `assets/${pre}${pre.replace(/\/$/, '').split('/').pop()}.bundle.js`;
      el.onload = el.onerror = () => resolve(); document.head.appendChild(el);
    });
  }
  function load(prefixes) {
    return Promise.all([].concat(prefixes || []).map(pre => loading[pre] || (loading[pre] = ready.then(() => script(pre)).then(() => {
      const lazy = window.TINY_ASSETS_LAZY || {};
      return Promise.all(Object.keys(lazy).filter(k => k.startsWith(pre)).map(k => parse(k, lazy[k]).then(() => { delete lazy[k]; })));
    }))));
  }
  return { ready, load, get: key => store[key] || null, keys: () => Object.keys(store) };
})();
