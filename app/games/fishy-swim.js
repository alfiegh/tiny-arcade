// FISHY SWIM (3D) — steer to the stars; built with Three.js:
// physically-based materials, environment lighting, soft shadows, animated caustics,
// fog, light shafts, swaying kelp, bubbles, bloom and a vignette.
// The camera is fixed (with a gentle drift) and the fish moves on one plane,
// so it controls exactly like the 2D version.
Games.register({
  id: 'fishy-swim', name: 'Fishy Swim', emoji: '🐠', color: '#0a6fb0',
  create(api) {
    const T = window.THREE;
    const { input, sfx } = api;

    // ---------- renderer ----------
    const canvas = document.createElement('canvas');
    canvas.className = 'gl-layer';
    document.body.appendChild(canvas);
    const renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(api.w, api.h, false);
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFShadowMap;

    const scene = new T.Scene();
    const FOG = new T.Color('#0c5a8a');
    scene.fog = new T.FogExp2(FOG, 0.026);
    const pmrem = new T.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new T.RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;

    const camera = new T.PerspectiveCamera(45, api.w / api.h, 0.1, 200);
    camera.position.set(0, 1.4, 16);
    const camTarget = new T.Vector3(0, 0.7, 0);

    const uTime = { value: 0 };
    const disposables = [];
    const track = o => { disposables.push(o); return o; };

    // ---------- little texture helpers (all generated, no image files) ----------
    function canvasTex(size, draw, { repeat = 1, srgb = true } = {}) {
      const c = document.createElement('canvas'); c.width = c.height = size;
      draw(c.getContext('2d'), size);
      const t = track(new T.CanvasTexture(c));
      t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat, repeat);
      if (srgb) t.colorSpace = T.SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    }
    const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };

    const sparkTex = canvasTex(64, (g, s) => {
      const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.6)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, s, s);
    });

    // Sand: colour grain + a ripple height field turned into a normal map
    const SAND = 256;
    const height = new Float32Array(SAND * SAND);
    for (let y = 0; y < SAND; y++) for (let x = 0; x < SAND; x++) {
      const u = x / SAND, v = y / SAND;
      height[y * SAND + x] = Math.sin((v * 6 + Math.sin(u * 6.283 * 2) * 0.15) * 6.283) * 0.5 + hash(x, y) * 0.35;
    }
    const sandMap = canvasTex(SAND, (g, s) => {
      const img = g.createImageData(s, s);
      for (let i = 0; i < s * s; i++) {
        const n = hash(i % s, (i / s) | 0) * 26 - 13 + height[i] * 8;
        img.data[i * 4] = 214 + n; img.data[i * 4 + 1] = 178 + n; img.data[i * 4 + 2] = 124 + n * 0.8; img.data[i * 4 + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    }, { repeat: 7 });
    const sandNormal = canvasTex(SAND, (g, s) => {
      const img = g.createImageData(s, s);
      const H = (x, y) => height[((y + s) % s) * s + ((x + s) % s)];
      for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
        const dx = (H(x + 1, y) - H(x - 1, y)) * 1.6, dy = (H(x, y + 1) - H(x, y - 1)) * 1.6;
        const l = Math.hypot(dx, dy, 1), i = (y * s + x) * 4;
        img.data[i] = (-dx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (-dy / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    }, { repeat: 7, srgb: false });

    // Caustics: tiled Voronoi edges (bright where two cells meet)
    const causticTex = canvasTex(256, (g, s) => {
      const pts = Array.from({ length: 22 }, () => [Math.random(), Math.random()]);
      const img = g.createImageData(s, s);
      for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
        let f1 = 9, f2 = 9;
        const u = x / s, v = y / s;
        for (const [px, py] of pts) for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
          const d = Math.hypot(u - px - ox, v - py - oy);
          if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
        }
        const e = Math.pow(1 - Math.min(1, (f2 - f1) / 0.06), 3) * 255;
        const i = (y * s + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = e; img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    }, { repeat: 5, srgb: false });

    // ---------- backdrop: deep-water gradient dome ----------
    const dome = new T.Mesh(track(new T.SphereGeometry(90, 32, 16)), track(new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new T.Color('#7fe0ff') }, mid: { value: new T.Color('#1a86c0') }, bot: { value: FOG.clone() } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: `uniform vec3 top, mid, bot; varying vec3 vP;
        void main(){ float h = vP.y; vec3 c = h > 0.1 ? mix(mid, top, smoothstep(0.1, 0.7, h)) : mix(bot, mid, smoothstep(-0.25, 0.1, h)); gl_FragColor = vec4(c, 1.); }`,
    })));
    scene.add(dome);

    // ---------- lights ----------
    scene.add(new T.HemisphereLight('#a8ecff', '#0b3550', 0.65));
    const sun = new T.DirectionalLight('#fff1d6', 1.9);
    sun.position.set(5, 16, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 12, bottom: -12, near: 1, far: 40 });
    sun.shadow.bias = -0.0006; sun.shadow.radius = 6;
    scene.add(sun);

    // ---------- sea floor ----------
    const FLOOR_Y = -3.6;
    const floorGeo = track(new T.PlaneGeometry(110, 60, 220, 120));
    floorGeo.rotateX(-Math.PI / 2);
    const fp = floorGeo.attributes.position;
    const dune = (x, z) => Math.sin(x * 0.28) * 0.28 + Math.sin(z * 0.4 + x * 0.12) * 0.22 + Math.sin(x * 0.9 + z * 0.7) * 0.06;
    for (let i = 0; i < fp.count; i++) fp.setY(i, dune(fp.getX(i), fp.getZ(i)));
    floorGeo.computeVertexNormals();
    const floorMat = track(new T.MeshStandardMaterial({
      map: sandMap, normalMap: sandNormal, normalScale: new T.Vector2(0.6, 0.6), roughness: 1,
      emissive: new T.Color('#9ff0ff'), emissiveIntensity: 0.6, emissiveMap: causticTex,
    }));
    floorMat.onBeforeCompile = sh => {
      sh.uniforms.uTime = uTime;
      sh.fragmentShader = 'uniform float uTime;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `
        #ifdef USE_EMISSIVEMAP
          vec2 cuv = vEmissiveMapUv;
          float c1 = texture2D(emissiveMap, cuv + vec2(uTime * 0.021, uTime * 0.013)).r;
          float c2 = texture2D(emissiveMap, cuv * 1.31 + vec2(-uTime * 0.017, uTime * 0.024)).r;
          totalEmissiveRadiance *= min(c1, c2) * 1.4;
        #endif`);
    };
    const floor = new T.Mesh(floorGeo, floorMat);
    floor.position.y = FLOOR_Y; floor.receiveShadow = true;
    scene.add(floor);
    const groundAt = (x, z) => FLOOR_Y + dune(x, z);

    // ---------- rocks, coral, kelp, shells ----------
    const rockMat = track(new T.MeshStandardMaterial({ color: '#6f8796', roughness: 0.9, flatShading: true }));
    function rock(x, z, s) {
      const g = track(new T.IcosahedronGeometry(1, 1));
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const k = 0.75 + hash(p.getX(i) * 3 + x, p.getZ(i) * 3 + z) * 0.45; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.7, p.getZ(i) * k); }
      g.computeVertexNormals();
      const m = new T.Mesh(g, rockMat);
      m.scale.setScalar(s); m.position.set(x, groundAt(x, z) + s * 0.25, z); m.rotation.y = x;
      m.castShadow = m.receiveShadow = true; scene.add(m);
    }
    [[-9, -4, 1.6], [-6.5, -6, 1], [7.5, -3.5, 1.8], [10, -6, 1.2], [3, -8, 1.4], [-12, -1, 1.3], [12.5, 0, 1], [-2, -9, 1.1]].forEach(a => rock(...a));

    const CORAL = ['#ff6f91', '#ff9f43', '#c56cf0', '#ffd23f', '#ff4d6d', '#17c3b2'];
    const brainGeo = track(new T.IcosahedronGeometry(1, 4));
    { const p = brainGeo.attributes.position; const v = new T.Vector3();
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 1 + Math.sin(v.x * 9 + Math.sin(v.z * 7) * 2) * Math.cos(v.y * 8) * 0.06; v.multiplyScalar(k); p.setXYZ(i, v.x, v.y * 0.75, v.z); }
      brainGeo.computeVertexNormals(); }
    const capsule = track(new T.CapsuleGeometry(0.12, 1, 6, 12));
    function coral(x, z, i) {
      const mat = track(new T.MeshStandardMaterial({ color: CORAL[i % CORAL.length], roughness: 0.55, emissive: CORAL[i % CORAL.length], emissiveIntensity: 0.08 }));
      const y = groundAt(x, z);
      if (i % 2) {
        const b = new T.Mesh(brainGeo, mat); b.scale.setScalar(U.rand(0.6, 1)); b.position.set(x, y + 0.25, z);
        b.castShadow = true; scene.add(b);
      } else {
        const grp = new T.Group(); grp.position.set(x, y, z);
        for (let k = 0; k < 7; k++) {
          const c = new T.Mesh(capsule, mat);
          const a = (k / 7) * Math.PI * 2, tilt = U.rand(0.2, 0.7), len = U.rand(0.8, 1.6);
          c.scale.set(1, len, 1);
          c.position.set(Math.sin(a) * 0.25, len * 0.5, Math.cos(a) * 0.25);
          c.rotation.set(Math.cos(a) * tilt, 0, -Math.sin(a) * tilt);
          c.castShadow = true; grp.add(c);
        }
        scene.add(grp);
      }
    }
    [[-7.5, -2.5], [-4, -5], [5.5, -2], [8.5, -5.5], [0.5, -6.5], [-10.5, -5], [11, -2.5], [-1.5, -4], [3.5, -4.5], [-13, -3]].forEach(([x, z], i) => coral(x, z, i));

    // kelp: a tapered ribbon that sways in the vertex shader
    const KELP_H = 6;
    const kelpGeo = track(new T.CylinderGeometry(0.05, 0.16, KELP_H, 6, 24));
    kelpGeo.translate(0, KELP_H / 2, 0); kelpGeo.scale(1, 1, 0.35);
    function kelpMat(color) {
      const m = track(new T.MeshStandardMaterial({ color, roughness: 0.6 }));
      m.onBeforeCompile = sh => {
        sh.uniforms.uTime = uTime;
        sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
          #include <begin_vertex>
          float ph = modelMatrix[3].x * 0.7 + modelMatrix[3].z;
          float k = pow(position.y / ${KELP_H.toFixed(1)}, 1.6);
          transformed.x += sin(uTime * 1.3 + ph + position.y * 0.7) * k * 0.9;
          transformed.z += cos(uTime * 1.1 + ph + position.y * 0.5) * k * 0.35;`);
      };
      m.customProgramCacheKey = () => 'kelp';
      return m;
    }
    const kelpMats = ['#2bb673', '#1f9e6e', '#5ccf8a'].map(kelpMat);
    for (let i = 0; i < 34; i++) {
      const front = i < 6;
      const x = front ? (i % 2 ? -1 : 1) * U.rand(13, 17) : U.rand(-20, 20);
      const z = front ? U.rand(1, 4) : U.rand(-11, -2.5);
      const k = new T.Mesh(kelpGeo, kelpMats[i % 3]);
      k.position.set(x, groundAt(x, z) - 0.1, z);
      k.scale.set(1, U.rand(0.55, 1.15), 1); k.rotation.y = U.rand(0, 3);
      k.castShadow = true; scene.add(k);
    }

    // stars: used for collectables and (in pink) for starfish on the sand
    const starShape = new T.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.27 : 0.6, a = Math.PI / 2 + (i * Math.PI) / 5;
      i ? starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const starGeo = track(new T.ExtrudeGeometry(starShape, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.09, bevelSegments: 4 }));
    starGeo.center();
    const starfishMat = track(new T.MeshStandardMaterial({ color: '#ff7a8a', roughness: 0.8 }));
    for (let i = 0; i < 7; i++) {
      const x = U.rand(-12, 12), z = U.rand(-4, 3.5);
      const s = new T.Mesh(starGeo, starfishMat);
      s.scale.setScalar(U.rand(0.35, 0.55)); s.rotation.set(-Math.PI / 2, 0, U.rand(0, 6));
      s.position.set(x, groundAt(x, z) + 0.06, z); s.receiveShadow = s.castShadow = true; scene.add(s);
    }

    // ---------- light shafts ----------
    const shaftTex = canvasTex(64, (g, s) => {
      const h = g.createLinearGradient(0, 0, s, 0);
      h.addColorStop(0, 'rgba(255,255,255,0)'); h.addColorStop(0.5, 'rgba(255,255,255,1)'); h.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = h; g.fillRect(0, 0, s, s);
      g.globalCompositeOperation = 'destination-in';
      const v = g.createLinearGradient(0, 0, 0, s);
      v.addColorStop(0, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = v; g.fillRect(0, 0, s, s);
    }, { repeat: 1 });
    shaftTex.wrapS = shaftTex.wrapT = T.ClampToEdgeWrapping;
    const shafts = [];
    for (let i = 0; i < 7; i++) {
      const m = new T.Mesh(track(new T.PlaneGeometry(U.rand(1.5, 3.2), 22)), track(new T.MeshBasicMaterial({
        map: shaftTex, color: '#d9fbff', transparent: true, opacity: 0.12, blending: T.AdditiveBlending, depthWrite: false, fog: false, side: T.DoubleSide })));
      m.position.set(-14 + i * 4.6 + U.rand(-1, 1), 6, U.rand(-7, -1));
      m.rotation.z = 0.32; m.userData.ph = Math.random() * 6;
      scene.add(m); shafts.push(m);
    }

    // ---------- the fish ----------
    function fishBodyMaterial({ body, band, belly, bands }) {
      const m = track(new T.MeshStandardMaterial({ color: body, roughness: 0.38, metalness: 0, envMapIntensity: 0.5 }));
      const u = { uBand: { value: new T.Color(band) }, uBelly: { value: new T.Color(belly) }, uBands: { value: bands } };
      m.onBeforeCompile = sh => {
        Object.assign(sh.uniforms, u);
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;');
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', `#include <common>
            varying vec3 vLocal; uniform vec3 uBand; uniform vec3 uBelly; uniform float uBands;
            vec3 band(vec3 c, float d, float w) {
              c = mix(c, vec3(0.05, 0.03, 0.08), 1.0 - smoothstep(w + 0.03, w + 0.05, d));
              return mix(c, uBand, 1.0 - smoothstep(w - 0.01, w + 0.01, d));
            }`)
          .replace('#include <color_fragment>', `#include <color_fragment>
            diffuseColor.rgb = mix(diffuseColor.rgb, uBelly, (1.0 - smoothstep(-0.85, -0.1, vLocal.y)) * 0.5);
            if (uBands > 0.5) { diffuseColor.rgb = band(diffuseColor.rgb, abs(vLocal.x - 0.42), 0.1); diffuseColor.rgb = band(diffuseColor.rgb, abs(vLocal.x + 0.32), 0.11); }
            if (uBands > 1.5) { diffuseColor.rgb = band(diffuseColor.rgb, abs(vLocal.x + 0.93), 0.06); }`);
      };
      m.customProgramCacheKey = () => 'fishbody';
      return m;
    }
    const bodyGeo = track(new T.SphereGeometry(1, 48, 32));
    const eyeGeo = track(new T.SphereGeometry(1, 24, 16));
    const tailShape = new T.Shape();
    tailShape.moveTo(0.1, 0); tailShape.quadraticCurveTo(-0.5, 0.45, -1.05, 0.8); tailShape.quadraticCurveTo(-0.8, 0, -1.05, -0.8); tailShape.quadraticCurveTo(-0.5, -0.45, 0.1, 0);
    const tailGeo = track(new T.ExtrudeGeometry(tailShape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3 }));
    tailGeo.translate(0, 0, -0.025);
    const finShape = new T.Shape();
    finShape.moveTo(-0.55, 0); finShape.quadraticCurveTo(-0.3, 0.75, 0.45, 0.05); finShape.lineTo(-0.55, 0);
    const finGeo = track(new T.ExtrudeGeometry(finShape, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 }));
    finGeo.translate(0, 0, -0.02);
    const white = track(new T.MeshPhysicalMaterial({ color: '#e9eef2', roughness: 0.25, clearcoat: 0.6 }));
    const pupilMat = track(new T.MeshPhysicalMaterial({ color: '#111018', roughness: 0.05, clearcoat: 1 }));
    const glint = track(new T.MeshBasicMaterial({ color: new T.Color(1.4, 1.4, 1.4) }));
    const blushMat = track(new T.MeshStandardMaterial({ color: '#ff7aa8', roughness: 0.8, transparent: true, opacity: 0.7 }));

    function makeFish(o) {
      const g = new T.Group();
      const round = o.round || 1;
      const body = new T.Mesh(bodyGeo, fishBodyMaterial(o));
      body.scale.set(1.2, 0.95 * round, 0.72 * Math.sqrt(round));
      body.castShadow = true; g.add(body);
      const finMat = track(new T.MeshPhysicalMaterial({ color: o.fin, roughness: 0.3, clearcoat: 0.6, side: T.DoubleSide }));
      const tail = new T.Group(); tail.position.x = -1.05; g.add(tail);
      const tm = new T.Mesh(tailGeo, finMat); tm.castShadow = true; tail.add(tm);
      const dorsal = new T.Mesh(finGeo, finMat); dorsal.position.set(0, 0.78 * round, 0); dorsal.castShadow = true; g.add(dorsal);
      const pecs = [-1, 1].map(side => {
        const p = new T.Mesh(eyeGeo, finMat); p.scale.set(0.34, 0.07, 0.2);
        p.position.set(0.1, -0.3 * round, side * 0.66 * Math.sqrt(round)); p.rotation.y = side * 0.5;
        g.add(p); return p;
      });
      const eyes = [-1, 1].map(side => {
        const e = new T.Group(); e.position.set(0.7, 0.24 * round, side * 0.5 * Math.sqrt(round));
        const ball = new T.Mesh(eyeGeo, white); ball.scale.setScalar(0.3); e.add(ball);
        const pupil = new T.Mesh(eyeGeo, pupilMat); pupil.scale.setScalar(0.19); pupil.position.set(0.1, 0.02, side * 0.17); e.add(pupil);
        const gl = new T.Mesh(eyeGeo, glint); gl.scale.setScalar(0.045); gl.position.set(0.16, 0.1, side * 0.32); e.add(gl);
        const blush = new T.Mesh(eyeGeo, blushMat); blush.scale.set(0.13, 0.07, 0.05);
        blush.position.set(-0.17, -0.34, side * 0.1); e.add(blush);
        g.add(e); return e;
      });
      g.scale.setScalar(o.size || 1);
      g.userData = { tail, pecs, eyes, wag: Math.random() * 6, blink: U.rand(2, 5), face: 1, yaw: 0 };
      return g;
    }

    function animateFish(f, dt, speed, vy) {
      const d = f.userData;
      d.wag += dt * (5 + speed * 1.6);
      d.tail.rotation.y = Math.sin(d.wag) * (0.35 + Math.min(speed, 6) * 0.06);
      d.pecs.forEach((p, i) => { p.rotation.x = Math.sin(d.wag * 1.3 + i * Math.PI) * 0.5; });
      const targetYaw = d.face > 0 ? 0 : Math.PI;
      d.yaw = U.lerp(d.yaw, targetYaw, Math.min(1, dt * 6));
      f.rotation.y = d.yaw + Math.sin(d.wag) * 0.06;
      // Euler XYZ applies Z (pitch) before Y (turn), so positive Z is "nose up" whichever way it faces
      f.rotation.z = U.lerp(f.rotation.z, U.clamp(vy * 0.07, -0.45, 0.45), Math.min(1, dt * 4));
      d.blink -= dt;
      const shut = d.blink < 0.12 && d.blink > 0;
      d.eyes.forEach(e => { e.scale.y = shut ? 0.15 : 1; });
      if (d.blink < 0) d.blink = U.rand(2.5, 5.5);
    }

    const hero = makeFish({ body: '#e04400', band: '#ffffff', belly: '#f59040', fin: '#e8600c', bands: 2, size: 1.15 });
    scene.add(hero);
    window.__stage = { T, renderer, scene, camera, hero };   // DevTools + the menu icon (tools/make-icons.js)
    const FRIENDS = [
      { body: '#2f6bff', band: '#111', belly: '#7fb0ff', fin: '#ffd23f', bands: 0, size: 0.84 },
      { body: '#ffd23f', band: '#fff', belly: '#fff3b0', fin: '#ffb703', bands: 0, size: 0.72, round: 1.35 },
      { body: '#ff5fa2', band: '#fff', belly: '#ffd1e8', fin: '#ffb3d1', bands: 1, size: 0.78 },
      { body: '#36d27a', band: '#fffbe6', belly: '#c9f7da', fin: '#1fae5a', bands: 1, size: 0.74 },
      { body: '#9b5de5', band: '#ffd23f', belly: '#e0c8ff', fin: '#f15bb5', bands: 2, size: 0.72 },
      { body: '#ff4d6d', band: '#fff', belly: '#ffc2cd', fin: '#ff8fa3', bands: 0, size: 0.7, round: 1.25 },
      { body: '#17c3b2', band: '#fff', belly: '#b8fff6', fin: '#ffd23f', bands: 1, size: 0.72 },
    ];

    // a big friendly whale far away in the fog, for depth
    const whale = new T.Group();
    { const wm = track(new T.MeshStandardMaterial({ color: '#1d4e7a', roughness: 0.7 }));
      const b = new T.Mesh(bodyGeo, wm); b.scale.set(3.2, 1.3, 1.2); whale.add(b);
      const t = new T.Mesh(tailGeo, wm); t.scale.setScalar(2.2); t.rotation.x = Math.PI / 2; t.position.x = -3; whale.add(t); whale.userData.tail = t;
      whale.position.set(-60, 3, -34); scene.add(whale); }

    // ---------- bubbles (instanced) ----------
    const BUB = 220;
    const bubMat = track(new T.MeshPhysicalMaterial({ color: '#e8fbff', roughness: 0, metalness: 0, transparent: true, opacity: 0.2,
      iridescence: 1, iridescenceIOR: 1.3, clearcoat: 1, envMapIntensity: 2.2, depthWrite: false }));
    const bubbles = new T.InstancedMesh(track(new T.SphereGeometry(1, 16, 12)), bubMat, BUB);
    bubbles.instanceMatrix.setUsage(T.DynamicDrawUsage);
    scene.add(bubbles);
    const vents = [[-9, -4], [7.5, -3.5], [3, -8], [-12, -1]];
    const bub = Array.from({ length: BUB }, (_, i) => {
      const v = vents[i % vents.length];
      return { x: v[0], y: FLOOR_Y + Math.random() * 14, z: v[1], r: U.rand(0.04, 0.14), sp: U.rand(0.8, 1.8), ph: Math.random() * 6, vent: v, vx: 0 };
    });
    let bubCursor = 0;
    const dummy = new T.Object3D();

    // ---------- plankton + sparkle particles ----------
    const PL = 700;
    const plGeo = new T.BufferGeometry();
    const plPos = new Float32Array(PL * 3);
    for (let i = 0; i < PL; i++) { plPos[i * 3] = U.rand(-24, 24); plPos[i * 3 + 1] = U.rand(-3.5, 9); plPos[i * 3 + 2] = U.rand(-14, 8); }
    plGeo.setAttribute('position', new T.BufferAttribute(plPos, 3)); track(plGeo);
    const plankton = new T.Points(plGeo, track(new T.PointsMaterial({ size: 0.07, map: sparkTex, color: '#cdf6ff', transparent: true, opacity: 0.7, depthWrite: false, blending: T.AdditiveBlending })));
    scene.add(plankton);

    const PM = 600;
    const pGeo = new T.BufferGeometry();
    const pPos = new Float32Array(PM * 3).fill(-999), pCol = new Float32Array(PM * 3);
    pGeo.setAttribute('position', new T.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new T.BufferAttribute(pCol, 3)); track(pGeo);
    const sparks = new T.Points(pGeo, track(new T.PointsMaterial({ size: 0.45, map: sparkTex, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false })));
    scene.add(sparks);
    const pd = Array.from({ length: PM }, () => ({ life: 0 }));
    let pCursor = 0;
    function sparkle(p, color, n = 40, speed = 5) {
      const c = new T.Color(color);
      for (let k = 0; k < n; k++) {
        const i = pCursor = (pCursor + 1) % PM;
        const a = Math.random() * Math.PI * 2, b = Math.acos(U.rand(-1, 1)), s = U.rand(0.3, 1) * speed;
        Object.assign(pd[i], { x: p.x, y: p.y, z: p.z, vx: Math.sin(b) * Math.cos(a) * s, vy: Math.sin(b) * Math.sin(a) * s, vz: Math.cos(b) * s, life: U.rand(0.6, 1.1), max: 1.1, c });
      }
    }

    // ---------- collectable stars ----------
    const starMat = track(new T.MeshStandardMaterial({ color: '#ffcc33', metalness: 0.55, roughness: 0.22, emissive: '#ffae00', emissiveIntensity: 2.6 }));
    const haloMat = track(new T.SpriteMaterial({ map: sparkTex, color: '#ffe27a', transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false }));
    let stars = [];

    // ---------- play area ----------
    const bounds = { x: 8, yMin: -2.4, yMax: 4.3 };
    function updateBounds() {
      const halfH = Math.tan(T.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
      bounds.x = halfH * camera.aspect - 1.5;
    }
    updateBounds();

    function spawnStar(near = false) {
      let x, y, tries = 0;
      do {
        x = near ? hero.position.x + U.rand(-3.5, 3.5) : U.rand(-bounds.x + 0.6, bounds.x - 0.6);
        y = near ? hero.position.y + U.rand(-2.5, 2.5) : U.rand(bounds.yMin + 0.6, bounds.yMax - 0.8);
        tries++;
      } while (tries < 20 && Math.hypot(x - hero.position.x, y - hero.position.y) < 2.6);
      const m = new T.Mesh(starGeo, starMat); m.castShadow = true;
      const halo = new T.Sprite(haloMat); halo.scale.setScalar(2.6); m.add(halo);
      m.position.set(U.clamp(x, -bounds.x, bounds.x), U.clamp(y, bounds.yMin, bounds.yMax), 0);
      m.userData = { t: Math.random() * 6, born: 0, baseY: m.position.y };
      m.scale.setScalar(0.01);
      scene.add(m); stars.push(m);
    }
    for (let i = 0; i < 3; i++) spawnStar();

    // ---------- post-processing ----------
    const composer = new T.EffectComposer(renderer);
    composer.addPass(new T.RenderPass(scene, camera));
    const bloom = new T.UnrealBloomPass(new T.Vector2(api.w, api.h), 0.6, 0.6, 1.15);
    composer.addPass(bloom);
    const vignette = new T.ShaderPass(T.VignetteShader);
    vignette.uniforms.offset.value = 0.95; vignette.uniforms.darkness.value = 1.25;
    composer.addPass(vignette);
    composer.addPass(new T.OutputPass());

    // ---------- state ----------
    const vel = new T.Vector2();
    let friends = [], collected = 0, still = 0, t = 0, flash = 0;

    return {
      resize() {
        renderer.setSize(api.w, api.h, false);
        composer.setSize(api.w, api.h);
        camera.aspect = api.w / api.h; camera.updateProjectionMatrix();
        updateBounds();
      },

      update(dt) {
        t += dt; uTime.value = t;
        const sp = 7 * CONFIG.stickSpeed;
        vel.x = U.lerp(vel.x, input.x * sp, Math.min(1, dt * 3));
        vel.y = U.lerp(vel.y, -input.y * sp, Math.min(1, dt * 3));
        hero.position.x = U.clamp(hero.position.x + vel.x * dt, -bounds.x, bounds.x);
        hero.position.y = U.clamp(hero.position.y + vel.y * dt, bounds.yMin, bounds.yMax);
        hero.position.y += Math.sin(t * 2) * 0.004;
        if (Math.abs(vel.x) > 0.3) hero.userData.face = Math.sign(vel.x);
        animateFish(hero, dt, vel.length(), vel.y);

        still = input.moving ? 0 : still + dt;
        if (still > 7 && stars.length) { const s = stars.shift(); scene.remove(s); spawnStar(true); still = 0; sfx.sparkle(); }

        // bubbles: ambient vents + a puff from the fish when any button is pressed
        if (input.actions.length) {
          const mouth = new T.Vector3(1.25 * hero.userData.face, 0, 0).add(hero.position);
          for (let k = 0; k < 10; k++) {
            const b = bub[bubCursor = (bubCursor + 1) % BUB];
            Object.assign(b, { x: mouth.x, y: mouth.y, z: U.rand(-0.3, 0.3), r: U.rand(0.08, 0.22), sp: U.rand(1.5, 2.6), vx: hero.userData.face * U.rand(1, 3), vent: null });
          }
          sfx.bubble(); setTimeout(() => sfx.bubble(), 90); setTimeout(() => sfx.bubble(), 170);
        }
        for (let i = 0; i < BUB; i++) {
          const b = bub[i];
          b.y += b.sp * dt; b.x += (b.vx + Math.sin(t * 2 + b.ph) * 0.3) * dt; b.vx *= 0.97;
          if (b.y > 10) { const v = b.vent || U.pick(vents); Object.assign(b, { x: v[0] + U.rand(-0.3, 0.3), y: groundAt(v[0], v[1]) + 0.3, z: v[1], vent: v, vx: 0, r: U.rand(0.04, 0.14), sp: U.rand(0.8, 1.8) }); }
          const wob = 1 + Math.sin(t * 8 + b.ph) * 0.08;
          dummy.position.set(b.x, b.y, b.z); dummy.scale.set(b.r * wob, b.r / wob, b.r * wob); dummy.updateMatrix();
          bubbles.setMatrixAt(i, dummy.matrix);
        }
        bubbles.instanceMatrix.needsUpdate = true;

        // stars
        const grab = 1.35, magnet = 3.2;
        for (const s of stars) {
          const d = s.userData;
          d.t += dt; d.born = Math.min(1, d.born + dt * 1.8);
          s.scale.setScalar(U.ease(d.born) * (1 + Math.sin(d.t * 5) * 0.05));
          s.rotation.y += dt * 1.6; s.rotation.z = Math.sin(d.t * 1.5) * 0.2;
          const dist = s.position.distanceTo(hero.position);
          if (dist < magnet) s.position.lerp(hero.position, Math.min(1, dt * 2.2));
          else s.position.y = d.baseY + Math.sin(d.t * 2.2) * 0.25;
          if (dist < grab && d.born > 0.4) {
            d.got = true; collected++; flash = 1;
            sfx.note(collected % 10 + 2); sfx.sparkle();
            sparkle(s.position, '#ffd75e', 60, 6); sparkle(s.position, '#ffffff', 25, 3);
            input.rumble(0.3, 80);
            if (collected % 5 === 0) {
              const o = FRIENDS[(collected / 5 - 1) % FRIENDS.length];
              if (friends.length < 7) {
                const f = makeFish(o);
                f.position.set(hero.position.x - hero.userData.face * 3, hero.position.y, -0.8);
                scene.add(f); friends.push(f);
                sparkle(f.position, o.body, 50, 5);
              }
              api.celebrate();
            }
          }
        }
        stars = stars.filter(s => { if (s.userData.got) scene.remove(s); return !s.userData.got; });
        while (stars.length < 3) spawnStar();

        // friends follow in a gentle line, a little behind the hero
        let leader = hero;
        friends.forEach((f, i) => {
          const tx = leader.position.x - leader.userData.face * 1.9, ty = leader.position.y + Math.sin(t * 1.5 + i) * 0.3, tz = -0.8 - (i % 2) * 0.9;
          const px = f.position.x, py = f.position.y;
          f.position.x = U.lerp(f.position.x, tx, Math.min(1, dt * 2.8));
          f.position.y = U.lerp(f.position.y, ty, Math.min(1, dt * 2.8));
          f.position.z = U.lerp(f.position.z, tz, Math.min(1, dt * 2));
          const vx = (f.position.x - px) / dt, vy = (f.position.y - py) / dt;
          if (Math.abs(vx) > 0.4) f.userData.face = Math.sign(vx);
          animateFish(f, dt, Math.hypot(vx, vy), vy);
          leader = f;
        });

        // particles
        for (let i = 0; i < PM; i++) {
          const p = pd[i];
          if (p.life <= 0) { pPos[i * 3 + 1] = -999; continue; }
          p.life -= dt; p.vx *= 0.94; p.vy *= 0.94; p.vz *= 0.94; p.vy += 0.6 * dt;
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
          pPos[i * 3] = p.x; pPos[i * 3 + 1] = p.y; pPos[i * 3 + 2] = p.z;
          const k = Math.max(0, p.life / p.max) * 3.0; // >1 so bloom picks them up
          pCol[i * 3] = p.c.r * k; pCol[i * 3 + 1] = p.c.g * k; pCol[i * 3 + 2] = p.c.b * k;
        }
        pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;

        for (let i = 0; i < PL; i++) {
          plPos[i * 3] += Math.sin(t * 0.3 + i) * 0.003;
          plPos[i * 3 + 1] += 0.004 + Math.cos(t * 0.5 + i * 0.7) * 0.002;
          if (plPos[i * 3 + 1] > 9) plPos[i * 3 + 1] = -3.5;
        }
        plGeo.attributes.position.needsUpdate = true;

        shafts.forEach(s => { s.material.opacity = 0.09 + Math.sin(t * 0.6 + s.userData.ph) * 0.05; });
        whale.position.x += dt * 1.2; if (whale.position.x > 60) whale.position.x = -60;
        whale.position.y = 3 + Math.sin(t * 0.3) * 1.2;
        whale.userData.tail.rotation.y = Math.sin(t * 1.2) * 0.3;

        // camera drifts very slightly with the fish for parallax
        camera.position.x = U.lerp(camera.position.x, hero.position.x * 0.18, Math.min(1, dt * 1.5));
        camera.position.y = U.lerp(camera.position.y, 1.4 + hero.position.y * 0.08, Math.min(1, dt * 1.5));
        camTarget.set(hero.position.x * 0.14, 0.7 + hero.position.y * 0.05, 0);
        camera.lookAt(camTarget);
        flash = Math.max(0, flash - dt * 3);
        bloom.strength = 0.6 + flash * 0.6;
      },

      draw(ctx) {
        composer.render();
        // 2D HUD over the 3D scene
        ctx.clearRect(0, 0, api.w, api.h);
        ctx.font = `800 ${Math.max(28, api.h * 0.05)}px ui-rounded, system-ui, sans-serif`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
        ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 8;
        U.emoji(ctx, '⭐', 46, 46, 50);
        ctx.fillText(collected, 80, 50);
        ctx.shadowBlur = 0; ctx.textAlign = 'center';
      },

      destroy() {
        composer.dispose?.();
        scene.traverse(o => { if (o.isMesh || o.isPoints || o.isSprite) { o.geometry?.dispose?.(); } });
        disposables.forEach(d => d.dispose?.());
        pmrem.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        canvas.remove();
      },
    };
  },
});
