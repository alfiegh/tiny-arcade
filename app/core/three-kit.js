// Shared 3D toolkit for Tiny Arcade games (needs vendor/three.bundle.js).
//
//   const S = Kit3D.stage(api, { background, fog: [color, near, far], bloom: [strength, radius, threshold] });
//   S.scene / S.camera / S.track(disposable) / S.sparkle(pos, color, n, speed, opts) / S.ring(pos, color)
//   S.update(dt); S.render(); S.resize(); S.destroy();
//
// Also: Kit3D.sky(), Kit3D.sun(), Kit3D.makeDino(), Kit3D.infiniteGround(), Kit3D.scatter(), Kit3D.drawGuide()
const Kit3D = (() => {
  const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };

  function stage(api, o = {}) {
    const T = window.THREE;
    const canvas = document.createElement('canvas');
    canvas.className = 'gl-layer';
    document.body.appendChild(canvas);
    const renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(api.w, api.h, false);
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = o.exposure ?? 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFShadowMap;

    const scene = new T.Scene();
    if (o.background) scene.background = new T.Color(o.background);
    if (o.fog) scene.fog = new T.Fog(o.fog[0], o.fog[1], o.fog[2]);
    const pmrem = new T.PMREMGenerator(renderer);
    // blurred studio environment: soft reflections without hard 'ceiling lamp' hot spots on flat glossy surfaces
    scene.environment = pmrem.fromScene(new T.RoomEnvironment(), 0.25).texture;
    scene.environmentIntensity = o.envIntensity ?? 0.5;

    const camera = new T.PerspectiveCamera(o.fov ?? 45, api.w / api.h, 0.1, 500);
    const disposables = [];
    const track = x => { disposables.push(x); return x; };

    function canvasTex(size, draw, { repeat = 1, srgb = true, clamp = false } = {}) {
      const c = document.createElement('canvas'); c.width = c.height = size;
      draw(c.getContext('2d'), size);
      const t = track(new T.CanvasTexture(c));
      t.wrapS = t.wrapT = clamp ? T.ClampToEdgeWrapping : T.RepeatWrapping;
      t.repeat.set(repeat, repeat);
      if (srgb) t.colorSpace = T.SRGBColorSpace;
      t.anisotropy = 8;
      return t;
    }
    const sparkTex = canvasTex(64, (g, s) => {
      const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.6)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, s, s);
    }, { clamp: true });

    // shared geometries
    const geo = {
      sphere: track(new T.SphereGeometry(1, 32, 24)),
      sphereLo: track(new T.SphereGeometry(1, 16, 12)),
      box: track(new T.BoxGeometry(1, 1, 1)),
      cyl: track(new T.CylinderGeometry(1, 1, 1, 32)),
      cone: track(new T.ConeGeometry(1, 1, 16)),
    };
    const matCache = {};
    function mat(color, opts = {}) {
      const key = color + JSON.stringify(opts);
      if (!matCache[key]) {
        const { physical, ...rest } = opts;
        matCache[key] = track(new (physical ? T.MeshPhysicalMaterial : T.MeshStandardMaterial)({ color, roughness: 0.55, ...rest }));
      }
      return matCache[key];
    }
    function mesh(g, m, { shadow = true, receive = true } = {}) {
      const x = new T.Mesh(g, m); x.castShadow = shadow; x.receiveShadow = receive; return x;
    }

    // post-processing
    const composer = new T.EffectComposer(renderer);
    composer.addPass(new T.RenderPass(scene, camera));
    const [bs, br, bt] = o.bloom ?? [0.5, 0.6, 1.1];
    const bloom = new T.UnrealBloomPass(new T.Vector2(api.w, api.h), bs, br, bt);
    composer.addPass(bloom);
    const vig = new T.ShaderPass(T.VignetteShader);
    vig.uniforms.offset.value = 0.95; vig.uniforms.darkness.value = o.vignette ?? 1.1;
    composer.addPass(vig);
    composer.addPass(new T.OutputPass());

    // particles (one pool, additive, HDR so bloom catches them)
    const PM = 1500;
    const pGeo = track(new T.BufferGeometry());
    const pPos = new Float32Array(PM * 3).fill(-9999), pCol = new Float32Array(PM * 3);
    pGeo.setAttribute('position', new T.BufferAttribute(pPos, 3));
    pGeo.setAttribute('color', new T.BufferAttribute(pCol, 3));
    const sparks = new T.Points(pGeo, track(new T.PointsMaterial({ size: o.sparkSize ?? 0.4, map: sparkTex, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false })));
    sparks.frustumCulled = false;
    scene.add(sparks);
    const pd = Array.from({ length: PM }, () => ({ life: 0 }));
    let pCursor = 0;
    function sparkle(p, color, n = 30, speed = 5, { gravity = 0, life = 1, glow = 3, up = 0, spread = 0 } = {}) {
      const c = new T.Color(color);
      for (let k = 0; k < n; k++) {
        const i = pCursor = (pCursor + 1) % PM;
        const a = Math.random() * Math.PI * 2, b = Math.acos(U.rand(-1, 1)), s = U.rand(0.3, 1) * speed;
        Object.assign(pd[i], {
          x: p.x + U.rand(-spread, spread), y: p.y, z: p.z + U.rand(-spread, spread),
          vx: Math.sin(b) * Math.cos(a) * s, vy: Math.sin(b) * Math.sin(a) * s + up, vz: Math.cos(b) * s,
          life: U.rand(0.6, 1) * life, max: life, c, g: gravity, glow,
        });
      }
    }

    // flat shockwave rings
    const ringGeo = track(new T.RingGeometry(0.85, 1, 48));
    ringGeo.rotateX(-Math.PI / 2);
    const rings = Array.from({ length: 14 }, () => {
      const m = new T.Mesh(ringGeo, track(new T.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false })));
      m.visible = false; scene.add(m); return m;
    });
    let ringCursor = 0;
    function ring(p, color, maxR = 4, life = 0.6, intensity = 1.5) {
      const m = rings[ringCursor = (ringCursor + 1) % rings.length];
      m.position.copy(p); m.material.color.set(color).multiplyScalar(intensity);
      m.userData = { t: 0, life, maxR }; m.visible = true;
    }

    let shakeAmt = 0;
    const saved = new T.Vector3();

    const S = {
      T, renderer, scene, camera, composer, bloom, geo, mat, mesh, track, canvasTex, sparkTex, sparkle, ring, hash,
      shake(a) { shakeAmt = Math.max(shakeAmt, a); },
      update(dt) {
        for (let i = 0; i < PM; i++) {
          const p = pd[i];
          if (p.life <= 0) { if (pPos[i * 3 + 1] !== -9999) pPos[i * 3 + 1] = -9999; continue; }
          p.life -= dt; const drag = Math.pow(0.08, dt);
          p.vx *= drag; p.vz *= drag; p.vy = p.vy * drag - p.g * dt;
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
          pPos[i * 3] = p.x; pPos[i * 3 + 1] = p.y; pPos[i * 3 + 2] = p.z;
          const k = Math.max(0, p.life / p.max) * p.glow;
          pCol[i * 3] = p.c.r * k; pCol[i * 3 + 1] = p.c.g * k; pCol[i * 3 + 2] = p.c.b * k;
        }
        pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
        for (const m of rings) {
          if (!m.visible) continue;
          const d = m.userData; d.t += dt;
          const k = d.t / d.life;
          if (k >= 1) { m.visible = false; continue; }
          m.scale.setScalar(0.3 + U.ease(k) * d.maxR);
          m.material.opacity = 1 - k;
        }
        shakeAmt *= Math.pow(0.02, dt);
      },
      render() {
        saved.copy(camera.position);
        if (shakeAmt > 0.002) camera.position.add(new T.Vector3(U.rand(-1, 1), U.rand(-1, 1), U.rand(-1, 1)).multiplyScalar(shakeAmt));
        composer.render();
        camera.position.copy(saved);
      },
      resize() {
        renderer.setSize(api.w, api.h, false);
        composer.setSize(api.w, api.h);
        camera.aspect = api.w / api.h; camera.updateProjectionMatrix();
      },
      toScreen(v) {
        const p = v.clone().project(camera);
        return { x: (p.x + 1) / 2 * api.w, y: (1 - p.y) / 2 * api.h, behind: p.z > 1 };
      },
      // visible half-width/height of the plane at distance d in front of the camera
      viewSize(d) { const h = Math.tan(T.MathUtils.degToRad(camera.fov / 2)) * d; return { w: h * camera.aspect, h }; },
      destroy() {
        composer.dispose?.();
        scene.traverse(x => { if (x.geometry) x.geometry.dispose(); });
        disposables.forEach(d => d.dispose?.());
        pmrem.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        canvas.remove();
      },
    };
    window.__stage = S; // handy for debugging in DevTools
    return S;
  }

  // Gradient sky dome; keep it centred on the camera for "infinite" worlds.
  function sky(S, top, mid, bottom, { radius = 220, sunDir = null } = {}) {
    const T = S.T;
    const m = new T.Mesh(S.track(new T.SphereGeometry(radius, 32, 16)), S.track(new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new T.Color(top) }, mid: { value: new T.Color(mid) }, bot: { value: new T.Color(bottom) },
        sunDir: { value: (sunDir || new T.Vector3(0.4, 0.5, -0.8)).normalize() }, sunOn: { value: sunDir ? 1 : 0 } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: `uniform vec3 top, mid, bot, sunDir; uniform float sunOn; varying vec3 vP;
        void main(){
          float h = vP.y;
          vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.6, h)) : mix(mid, bot, smoothstep(0.0, -0.2, h));
          float s = max(dot(vP, sunDir), 0.0);
          c += sunOn * (pow(s, 600.0) * 6.0 + pow(s, 12.0) * 0.25) * vec3(1.0, 0.92, 0.75);
          gl_FragColor = vec4(c, 1.);
        }`,
    })));
    m.frustumCulled = false;
    S.scene.add(m);
    return m;
  }

  // Directional "sun" with soft shadows. Call follow(x, z) each frame in moving worlds.
  function sun(S, { color = '#fff4dc', intensity = 2, offset = [8, 18, 10], size = 22, mapSize = 2048 } = {}) {
    const T = S.T;
    const l = new T.DirectionalLight(color, intensity);
    l.castShadow = true;
    l.shadow.mapSize.set(mapSize, mapSize);
    Object.assign(l.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: 1, far: 80 });
    l.shadow.bias = -0.0005; l.shadow.normalBias = 0.02; l.shadow.radius = 3;
    l.position.set(...offset);
    S.scene.add(l); S.scene.add(l.target);
    l.follow = (x, z) => { l.position.set(x + offset[0], offset[1], z + offset[2]); l.target.position.set(x, 0, z); };
    return l;
  }

  // Cute eyes (white, pupil, glint). Returns a group; set .scale.y for blinking.
  function eye(S, size = 0.25, side = 1) {
    const T = S.T, g = new T.Group();
    const white = S.mesh(S.geo.sphereLo, S.mat('#f4f6f8', { roughness: 0.2 }), { shadow: false });
    white.scale.setScalar(size); g.add(white);
    const pupil = S.mesh(S.geo.sphereLo, S.mat('#14121a', { roughness: 0.05 }), { shadow: false });
    pupil.scale.setScalar(size * 0.6); pupil.position.set(side * size * 0.22, size * 0.05, size * 0.55); g.add(pupil);
    const glint = new T.Mesh(S.geo.sphereLo, S.mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 1.3 }));
    glint.scale.setScalar(size * 0.17); glint.position.set(side * size * 0.3 + size * 0.1, size * 0.3, size * 0.95); g.add(glint);
    return g;
  }

  // ---------------- DINOSAUR (shared by Dino World and Drum Band) ----------------
  // Faces +Z. root -> inner (animated) -> parts. Call rig.update(dt, speed) every frame and rig.do('roar') etc.
  function makeDino(S, { body = '#58c75a', belly = '#e3f7a8', spikes = ['#ff9f1c', '#ffd23f'], scale = 1 } = {}) {
    const T = S.T, G = S.geo;
    const mBody = S.mat(body, { roughness: 0.45 }), mBelly = S.mat(belly, { roughness: 0.6 });
    const root = new T.Group(), inner = new T.Group();
    root.add(inner); root.scale.setScalar(scale);
    const add = (parent, g, m, pos, scl, rot) => {
      const x = S.mesh(g, m); x.position.set(...pos); if (scl) x.scale.set(...scl); if (rot) x.rotation.set(...rot);
      parent.add(x); return x;
    };

    const torso = new T.Group(); inner.add(torso);
    add(torso, G.sphere, mBody, [0, 1.65, 0], [1.05, 1.1, 1.3]);
    add(torso, G.sphere, mBelly, [0, 1.5, 0.42], [0.8, 0.9, 0.95]);

    // head
    const head = new T.Group(); head.position.set(0, 2.45, 0.75); torso.add(head);
    add(head, G.sphere, mBody, [0, 0.38, 0.32], [0.78, 0.72, 0.85]);
    add(head, G.sphere, mBody, [0, 0.32, 0.82], [0.62, 0.4, 0.6]);           // upper snout
    add(head, G.sphere, S.mat('#7a1f2b', { roughness: 0.8 }), [0, 0.12, 0.85], [0.42, 0.22, 0.42]); // mouth inside
    add(head, G.sphere, S.mat('#ff7b9c', { roughness: 0.7 }), [0, 0.06, 0.92], [0.24, 0.07, 0.28]); // tongue
    const jaw = new T.Group(); jaw.position.set(0, 0.1, 0.48); head.add(jaw);
    add(jaw, G.sphere, mBelly, [0, -0.05, 0.38], [0.54, 0.2, 0.55]);
    const toothM = S.mat('#ffffff', { roughness: 0.3 });
    [-0.28, -0.1, 0.1, 0.28].forEach(x => add(head, G.cone, toothM, [x, 0.0, 1.12 - Math.abs(x) * 0.5], [0.06, 0.13, 0.06], [Math.PI, 0, 0]));
    const eyes = [-1, 1].map(side => { const e = eye(S, 0.25, side); e.position.set(side * 0.42, 0.68, 0.78); e.rotation.y = side * 0.35; head.add(e); return e; });
    [-1, 1].forEach(side => add(head, G.sphereLo, S.mat('#ff8fb1', { roughness: 0.8, transparent: true, opacity: 0.7 }), [side * 0.58, 0.28, 0.75], [0.14, 0.08, 0.06], [0, side * 0.6, 0]));
    [-1, 1].forEach(side => add(head, G.sphereLo, S.mat('#2a4a2a'), [side * 0.14, 0.52, 1.38], [0.05, 0.04, 0.03]));

    // arms (pivot at shoulder, hanging down)
    const arms = [-1, 1].map(side => {
      const a = new T.Group(); a.position.set(side * 0.78, 2.05, 0.8); torso.add(a);
      add(a, G.sphere, mBody, [0, -0.28, 0.06], [0.17, 0.34, 0.17]);
      add(a, G.sphere, mBelly, [0, -0.62, 0.1], [0.19, 0.17, 0.19]);
      return a;
    });
    // legs (pivot at hip)
    const legs = [-1, 1].map(side => {
      const l = new T.Group(); l.position.set(side * 0.62, 1.22, 0); inner.add(l);
      add(l, G.sphere, mBody, [0, -0.2, 0], [0.46, 0.6, 0.52]);
      add(l, G.sphere, mBody, [0, -0.7, 0.05], [0.26, 0.38, 0.28]);
      add(l, G.sphere, mBelly, [0, -1.04, 0.2], [0.34, 0.17, 0.48]);
      return l;
    });
    // tail: chain of segments so the wag ripples down it
    const tail = [];
    let parent = torso, pos = [0, 1.45, -1.0];
    const spikeMs = spikes.map(c => S.mat(c, { roughness: 0.4 }));
    for (let i = 0; i < 5; i++) {
      const seg = new T.Group(); seg.position.set(...pos); parent.add(seg);
      const r = 0.55 - i * 0.09;
      add(seg, G.sphere, mBody, [0, 0, -r * 0.6], [r, r * 0.95, r * 1.3]);
      if (i < 4) add(seg, G.cone, spikeMs[(i + 1) % 2], [0, r * 0.95, -r * 0.6], [0.12 - i * 0.015, 0.3 - i * 0.04, 0.12 - i * 0.015]);
      tail.push(seg); parent = seg; pos = [0, -0.04, -r * 1.25];
    }
    // back spikes
    [[2.62, 0.5], [2.72, 0.05], [2.64, -0.42], [2.4, -0.85]].forEach(([y, z], i) => add(torso, G.cone, spikeMs[i % 2], [0, y + 0.08, z], [0.16, 0.42, 0.16], [z * 0.25, 0, 0]));

    // ---- rig ----
    const DUR = { roar: 1.3, sneeze: 1.4, dance: 2.6, waveL: 1.8, waveR: 1.8, legL: 1.3, legR: 1.3, clap: 0.45, spin: 0.8, headbang: 0.5, happy: 0.7 };
    const act = {};
    let t = 0, phase = 0, jumpY = 0, vy = 0, air = false, squash = 0, blink = 2;
    const rig = {
      root, inner, head, jaw, arms, legs, tail, eyes,
      onLand: null, onStomp: null, onSneeze: null,
      get airborne() { return air; },
      do(name) {
        if (name === 'jump') { if (!air) { vy = 10; air = true; } return; }
        act[name] = { t: 0, d: DUR[name], fired: false };
      },
      busy(name) { return !!act[name]; },
      update(dt, speed = 0) {
        t += dt;
        const s = U.clamp(speed / 6, 0, 1);
        phase += dt * (3 + speed * 1.6);
        // base pose: idle breathing + walk cycle
        let legL = Math.sin(phase) * 0.75 * s, legR = -Math.sin(phase) * 0.75 * s;
        let armLx = -Math.sin(phase) * 0.45 * s, armRx = Math.sin(phase) * 0.45 * s, armLz = 0.15, armRz = -0.15;
        let headX = Math.sin(t * 1.3) * 0.05, headY = Math.sin(t * 0.7) * 0.18, headZ = 0, jawX = 0.05 + Math.max(0, Math.sin(t * 0.9)) * 0.06;
        let bob = Math.abs(Math.sin(phase)) * 0.16 * s, lean = 0, spin = 0, tailAmp = 0.25 + s * 0.2, tailSpeed = 3;
        let torsoX = s * 0.12;

        for (const [name, a] of Object.entries(act)) {
          a.t += dt;
          const p = Math.min(1, a.t / a.d);
          const env = Math.min(1, p * 5, (1 - p) * 5);
          switch (name) {
            case 'roar': { const e = Math.sin(p * Math.PI); jawX = 0.95 * Math.min(1, e * 1.6); headX = -0.55 * e; armLz = 0.9 * e; armRz = -0.9 * e; torsoX = -0.2 * e; headY = Math.sin(t * 40) * 0.06 * e; break; }
            case 'sneeze': {
              if (p < 0.45) { const k = p / 0.45; headX = -0.6 * k; jawX = 0.3 * k; }
              else { if (!a.fired) { a.fired = true; rig.onSneeze?.(); } const k = (p - 0.45) / 0.55; headX = U.lerp(0.55, 0, k); jawX = U.lerp(0.8, 0.05, k); torsoX = 0.25 * (1 - k); }
              break; }
            case 'dance': spin = p * Math.PI * 2; bob += Math.abs(Math.sin(p * Math.PI * 8)) * 0.45;
              armLz = 2.2 + Math.sin(p * Math.PI * 8) * 0.5; armRz = -2.2 + Math.sin(p * Math.PI * 8) * 0.5; headZ = Math.sin(p * Math.PI * 8) * 0.25; tailAmp = 0.7; tailSpeed = 10; break;
            case 'waveL': armLz = 2.5 * env + Math.sin(t * 14) * 0.4 * env; headZ = 0.15 * env; headY = 0.25 * env; break;
            case 'waveR': armRz = -2.5 * env - Math.sin(t * 14) * 0.4 * env; headZ = -0.15 * env; headY = -0.25 * env; break;
            case 'legL': case 'legR': {
              const side = name === 'legL' ? 1 : -1;
              const e = Math.min(1, p * 4, Math.max(0, (0.9 - p) * 5));
              if (side > 0) legL = -1.3 * e; else legR = -1.3 * e;
              lean = -side * 0.22 * e; armLz = 0.7 * e; armRz = -0.7 * e;
              if (p > 0.88 && !a.fired) { a.fired = true; rig.onStomp?.(side); }
              break; }
            case 'clap': { const e = Math.sin(p * Math.PI); armLx = armRx = -1.3 * e; armLz = -0.55 * e; armRz = 0.55 * e; break; }
            case 'spin': spin = U.ease(p) * Math.PI * 2; break;
            case 'headbang': headX = Math.sin(p * Math.PI * 2) * 0.5; break;
            case 'happy': bob += Math.sin(p * Math.PI) * 0.6; armLz = 2 * Math.sin(p * Math.PI); armRz = -2 * Math.sin(p * Math.PI); break;
          }
          if (p >= 1) delete act[name];
        }

        // jump physics
        if (air) {
          jumpY += vy * dt; vy -= 28 * dt;
          legL = legR = -0.5; armLz = Math.max(armLz, 1.2); armRz = Math.min(armRz, -1.2);
          if (jumpY <= 0) { jumpY = 0; air = false; squash = 1; rig.onLand?.(); }
        }
        squash = Math.max(0, squash - dt * 4);

        inner.position.y = bob + jumpY;
        inner.rotation.y = spin;
        inner.rotation.z = U.lerp(inner.rotation.z, lean, Math.min(1, dt * 10));
        torso.rotation.x = U.lerp(torso.rotation.x, torsoX, Math.min(1, dt * 8));
        const sq = Math.sin(squash * Math.PI) * 0.25;
        inner.scale.set(1 + sq, 1 - sq, 1 + sq);
        legs[0].rotation.x = U.lerp(legs[0].rotation.x, legR, Math.min(1, dt * 14));
        legs[1].rotation.x = U.lerp(legs[1].rotation.x, legL, Math.min(1, dt * 14));
        arms[0].rotation.set(U.lerp(arms[0].rotation.x, armRx, Math.min(1, dt * 12)), 0, U.lerp(arms[0].rotation.z, armRz, Math.min(1, dt * 12)));
        arms[1].rotation.set(U.lerp(arms[1].rotation.x, armLx, Math.min(1, dt * 12)), 0, U.lerp(arms[1].rotation.z, armLz, Math.min(1, dt * 12)));
        head.rotation.set(U.lerp(head.rotation.x, headX, Math.min(1, dt * 10)), U.lerp(head.rotation.y, headY, Math.min(1, dt * 6)), U.lerp(head.rotation.z, headZ, Math.min(1, dt * 8)));
        jaw.rotation.x = U.lerp(jaw.rotation.x, jawX, Math.min(1, dt * 14));
        tail.forEach((seg, i) => { seg.rotation.y = Math.sin(t * tailSpeed - i * 0.6) * tailAmp * (0.4 + i * 0.15); seg.rotation.x = -0.05; });
        blink -= dt;
        const shut = blink > 0 && blink < 0.12;
        eyes.forEach(e => { e.scale.y = shut ? 0.12 : 1; });
        if (blink < 0) blink = U.rand(2.5, 5);
      },
    };
    return rig;
  }

  // ---------------- MODEL DINOSAURS (Quaternius pack, app/assets/dinos) ----------------
  // Same interface as makeDino: root, inner, do(name), busy(name), update(dt, speed), airborne, onLand/onStomp/onSneeze.
  // Clips from the file drive idle/walk/run/jump/roar; everything else is layered on top by rotating bones.
  const DINO_SPECIES = {
    trex:            { biped: true,  height: 3.6, cartoon: { Head: 1.3, FrontLegL: 1.8, FrontLegR: 1.8 },
                       palette: { Green: '#3fca5a', LightGreen: '#d4f57e', Black: '#2a2a2a', Red: '#ff6f8a', LightYellow: '#fff7d6' } },
    velociraptor:    { biped: true,  height: 2.6, cartoon: { Head: 1.25, FrontLegL: 1.3, FrontLegR: 1.3 },
                       palette: { Brown: '#ff9a3c', LightBrown: '#ffe2a8', Black: '#2a2a2a' } },
    parasaurolophus: { biped: true,  height: 3.0, cartoon: { Head: 1.2, FrontLegL: 1.3, FrontLegR: 1.3 },
                       palette: { Green: '#ffc43d', LightGreen: '#fff2b3', LightYellow: '#fffbe8', Red: '#ff5e8e' } },
    triceratops:     { biped: false, height: 2.4, cartoon: { Head: 1.15 },
                       palette: { Purple: '#a070ff', LightBrown: '#ffeccc', Brown: '#ffd166' } },
    stegosaurus:     { biped: false, height: 2.4, cartoon: { Head: 1.3 },
                       palette: { DarkBrown: '#1fbfab', Brown: '#ff7b54', LightBrown: '#fff0c4' } },
    apatosaurus:     { biped: false, height: 3.2, cartoon: { Head: 1.5 },
                       palette: { Brown: '#4ea8ff', Material: '#c4e6ff', LightBrown: '#8fd0ff', Black: '#2a2a2a' } },
  };

  function makeDinoModel(S, species = 'trex', { height, palette } = {}) {
    const T = S.T;
    const asset = typeof Assets !== 'undefined' ? Assets.get('dinos/' + species) : null;
    const spec = DINO_SPECIES[species] || DINO_SPECIES.trex;
    const H = height || spec.height;
    if (!asset || !T.SkeletonUtils) return makeDino(S, { scale: H / 3.4 });   // fallback: bubble dino

    const root = new T.Group(), inner = new T.Group(); root.add(inner);
    const model = T.SkeletonUtils.clone(asset.scene);
    inner.add(model);

    // bright, per-instance materials (recoloured by material name)
    const pal = { ...spec.palette, ...(palette || {}) }, mats = {};
    model.traverse(n => {
      if (!n.isMesh) return;
      n.castShadow = true; n.receiveShadow = true; n.frustumCulled = false;
      const list = [].concat(n.material).map(m => {
        if (!mats[m.name]) { const c = S.track(m.clone()); if (pal[m.name]) c.color.set(pal[m.name]); c.roughness = 0.55; c.envMapIntensity = 0.7; mats[m.name] = c; }
        return mats[m.name];
      });
      n.material = list.length === 1 ? list[0] : list;
    });
    const B = {}; model.traverse(n => { if (n.isBone) B[n.name] = n; });
    const target = name => (B[name] && B[name].parent === B.root ? B[name] : null);   // IK-style foot targets

    // animation clips
    const mixer = new T.AnimationMixer(model);
    const clip = name => asset.animations.find(a => a.name === name);
    const A = {};
    ['Idle', 'Walk', 'Run'].forEach(n => { const c = clip(n); if (c) { A[n] = mixer.clipAction(c); A[n].play(); A[n].setEffectiveWeight(n === 'Idle' ? 1 : 0); } });
    ['Jump', 'Attack'].forEach(n => { const c = clip(n); if (c) { const a = mixer.clipAction(c); a.setLoop(T.LoopOnce, 1); a.clampWhenFinished = true; A[n] = a; } });
    const JUMP_SPEED = 1.35;
    const landAt = asset.meta.landAt / JUMP_SPEED;

    // normalise size and stand the feet on y = 0
    // (measured from the actually skinned vertices: bounding boxes can be wrong for skinned meshes)
    mixer.update(0); model.updateMatrixWorld(true);
    const box = new T.Box3(), v = new T.Vector3();
    model.traverse(n => {
      if (!n.isSkinnedMesh) return;
      n.skeleton.update();
      const pos = n.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); n.applyBoneTransform(i, v); box.expandByPoint(v.applyMatrix4(n.matrixWorld)); }
    });
    const k = H / Math.max(0.001, box.max.y - box.min.y);
    model.scale.multiplyScalar(k);
    model.position.y = -box.min.y * k;
    const sizeK = H / 3.6;   // relative size, used to match animation speed to ground speed

    // bone helpers: rotate about the dino's own axes (forward +Z, up +Y, its left +X), whatever the bone's local axes are
    const X = new T.Vector3(1, 0, 0), Y = new T.Vector3(0, 1, 0), Z = new T.Vector3(0, 0, 1);
    const fq = new T.Quaternion(), pq = new T.Quaternion(), dq = new T.Quaternion(), rel = new T.Quaternion(), relInv = new T.Quaternion();
    const piv = new T.Vector3(), tw = new T.Vector3(), axW = new T.Vector3();
    function rot(bone, axis, angle) {
      if (!bone || Math.abs(angle) < 1e-4) return;
      model.getWorldQuaternion(fq); bone.parent.getWorldQuaternion(pq);
      rel.copy(fq).invert().multiply(pq); relInv.copy(rel).invert();
      dq.setFromAxisAngle(axis, angle);
      bone.quaternion.premultiply(relInv.multiply(dq).multiply(rel));
      bone.updateMatrixWorld(true);
    }
    function limb(upper, tgt, axis, angle) {     // rotate a limb; its foot target (if any) follows rigidly
      if (!upper || Math.abs(angle) < 1e-4) return;
      upper.getWorldPosition(piv);
      if (tgt) tgt.getWorldPosition(tw);
      rot(upper, axis, angle);
      if (tgt) {
        model.getWorldQuaternion(fq); axW.copy(axis).applyQuaternion(fq);
        tw.sub(piv).applyAxisAngle(axW, angle).add(piv);
        tgt.position.copy(tgt.parent.worldToLocal(tw));
        rot(tgt, axis, angle);
      }
    }

    const DUR = { roar: 1.2, sneeze: 1.4, dance: 2.6, waveL: 1.8, waveR: 1.8, legL: 1.3, legR: 1.3, clap: 0.45, spin: 0.8, headbang: 0.5, happy: 0.7 };
    const act = {};
    let t = 0, air = false, jt = 0, squash = 0;
    const sm = { armL: 0, armR: 0, fwdL: 0, fwdR: 0, legL: 0, legR: 0, headX: 0, headY: 0, lean: 0 };   // smoothed overlay values

    const rig = {
      root, inner, model, bones: B, species,
      onLand: null, onStomp: null, onSneeze: null,
      get airborne() { return air; },
      do(name) {
        if (name === 'jump') {
          if (air) return;
          air = true; jt = 0;
          if (A.Jump) A.Jump.reset().setEffectiveTimeScale(JUMP_SPEED).setEffectiveWeight(1).fadeIn(0.08).play();
          return;
        }
        if (name === 'roar' && A.Attack) A.Attack.reset().setEffectiveWeight(1).fadeIn(0.1).play();
        act[name] = { t: 0, d: DUR[name], fired: false };
      },
      busy(name) { return !!act[name]; },
      update(dt, speed = 0) {
        t += dt;
        // locomotion blend: idle -> walk -> run, played faster the faster we move
        const s = speed / sizeK;
        const wIdle = U.clamp(1 - s / 1.6, 0, 1), wRun = U.clamp((s - 4.2) / 2.2, 0, 1), wWalk = Math.max(0, 1 - wIdle - wRun);
        const oneShot = Math.max(A.Jump && A.Jump.isRunning() ? A.Jump.getEffectiveWeight() : 0, A.Attack && A.Attack.isRunning() ? A.Attack.getEffectiveWeight() : 0);
        const free = 1 - oneShot;
        if (A.Idle) A.Idle.setEffectiveWeight(wIdle * free);
        if (A.Walk) { A.Walk.setEffectiveWeight(wWalk * free); A.Walk.setEffectiveTimeScale(U.clamp(s / 2.0, 0.6, 2.2)); }
        if (A.Run) { A.Run.setEffectiveWeight(wRun * free); A.Run.setEffectiveTimeScale(U.clamp(s / 5.5, 0.7, 1.8)); }
        if (A.Attack && A.Attack.isRunning() && A.Attack.time > A.Attack.getClip().duration - 0.25 && !A.Attack.userData) { A.Attack.fadeOut(0.25); A.Attack.userData = 1; }
        if (A.Attack && !A.Attack.isRunning()) A.Attack.userData = 0;
        mixer.update(dt);
        for (const [b, v] of Object.entries(spec.cartoon || {})) if (B[b]) B[b].scale.setScalar(v);

        // jump timing (the clip itself lifts the body)
        if (air) {
          jt += dt;
          if (jt >= landAt) { air = false; squash = 1; rig.onLand?.(); if (A.Jump) A.Jump.fadeOut(0.3); }
        }
        squash = Math.max(0, squash - dt * 4);

        // overlay targets for this frame
        let armL = 0, armR = 0, fwdL = 0, fwdR = 0, legL = 0, legR = 0;
        let headX = 0, headY = Math.sin(t * 0.7) * 0.15, tailAmp = 0.08, tailSpeed = 2, spin = 0, bob = 0, lean = 0;
        for (const [name, a] of Object.entries(act)) {
          a.t += dt;
          const p = Math.min(1, a.t / a.d);
          const env = Math.min(1, p * 5, (1 - p) * 5);
          const wave = Math.sin(t * 14) * 0.45 * env;
          switch (name) {
            case 'roar': armL = 0.5 * env; armR = -0.5 * env; break;
            case 'sneeze':
              if (p < 0.45) headX = -0.55 * (p / 0.45);
              else { if (!a.fired) { a.fired = true; rig.onSneeze?.(); } const q = (p - 0.45) / 0.55; headX = U.lerp(0.5, 0, q); lean = 0; }
              break;
            case 'dance': spin = p * Math.PI * 2; bob = Math.abs(Math.sin(p * Math.PI * 8)) * 0.4 * sizeK;
              if (spec.biped) { armL = 1.2 + Math.sin(p * Math.PI * 8) * 0.4; armR = -1.2 + Math.sin(p * Math.PI * 8) * 0.4; }
              headY = Math.sin(p * Math.PI * 8) * 0.35; tailAmp = 0.5; tailSpeed = 10; break;
            case 'waveL': if (spec.biped) { armL = 1.4 * env + wave; fwdL = -0.5 * env; } else { fwdL = -1.0 * env + wave; } headY = 0.3 * env; break;
            case 'waveR': if (spec.biped) { armR = -1.4 * env - wave; fwdR = -0.5 * env; } else { fwdR = -1.0 * env + wave; } headY = -0.3 * env; break;
            case 'legL': case 'legR': {
              const side = name === 'legL' ? 1 : -1;
              const e = Math.min(1, p * 4, Math.max(0, (0.9 - p) * 5));
              if (side > 0) legL = 0.8 * e; else legR = 0.8 * e;
              lean = -side * 0.12 * e;
              if (p > 0.88 && !a.fired) { a.fired = true; rig.onStomp?.(side); }
              break; }
            case 'clap': { const e = Math.sin(p * Math.PI); fwdL = fwdR = -0.9 * e; if (spec.biped) { armL = -0.35 * e; armR = 0.35 * e; } break; }
            case 'spin': spin = U.ease(p) * Math.PI * 2; break;
            case 'headbang': headX = Math.sin(p * Math.PI * 2) * 0.45; break;
            case 'happy': bob = Math.sin(p * Math.PI) * 0.5 * sizeK; if (spec.biped) { armL = 1.2 * Math.sin(p * Math.PI); armR = -1.2 * Math.sin(p * Math.PI); } break;
          }
          if (p >= 1) delete act[name];
        }
        // smooth so poses blend in and out
        const kk = Math.min(1, dt * 12);
        for (const [key, v] of Object.entries({ armL, armR, fwdL, fwdR, legL, legR, headX, headY, lean })) sm[key] = U.lerp(sm[key], v, kk);

        inner.position.y = bob;
        inner.rotation.y = spin;
        inner.rotation.z = sm.lean;
        const sq = Math.sin(squash * Math.PI) * 0.15;
        inner.scale.set(1 + sq, 1 - sq, 1 + sq);

        // apply bone overlays on top of the clip pose
        root.updateMatrixWorld(true);
        limb(B.FrontUpLegL, target('FrontFootL'), Z, sm.armL);
        limb(B.FrontUpLegR, target('FrontFootR'), Z, sm.armR);
        limb(B.FrontUpLegL, target('FrontFootL'), X, sm.fwdL);
        limb(B.FrontUpLegR, target('FrontFootR'), X, sm.fwdR);
        limb(B.BackUpLegL, target('BackFootL'), X, -sm.legL);
        limb(B.BackUpLegR, target('BackFootR'), X, -sm.legR);
        rot(B.Neck, X, sm.headX * 0.5); rot(B.Head, X, sm.headX * 0.5);
        rot(B.Neck, Y, sm.headY * 0.5); rot(B.Head, Y, sm.headY * 0.5);
        for (let i = 1; i <= 5; i++) rot(B['Tail' + i], Y, Math.sin(t * tailSpeed - i * 0.6) * tailAmp);
      },
    };
    return rig;
  }

  // ---------------- INFINITE WORLD ----------------
  // A big ground plane that follows the player while its texture stays put, so it feels endless.
  function infiniteGround(S, map, { size = 260, tile = 6, color = '#ffffff', roughness = 0.95, normalMap = null } = {}) {
    const T = S.T;
    const reps = size / tile;
    map.repeat.set(reps, reps);
    if (normalMap) normalMap.repeat.set(reps, reps);
    const g = S.track(new T.PlaneGeometry(size, size, 1, 1)); g.rotateX(-Math.PI / 2);
    const m = new T.Mesh(g, S.track(new T.MeshStandardMaterial({ map, color, roughness, normalMap })));
    m.receiveShadow = true;
    S.scene.add(m);
    return {
      mesh: m,
      follow(x, z) {
        m.position.set(x, 0, z);
        const ox = (x / tile) % 1, oz = (-z / tile) % 1;
        map.offset.set(ox, oz);
        if (normalMap) normalMap.offset.set(ox, oz);
      },
    };
  }

  // Scatter props in a square around the player and wrap them as the player moves.
  // items: [{ make: () => Object3D, count, radius }]
  function scatter(S, items, { area = 130, avoid = 6 } = {}) {
    const list = [];
    for (const it of items) for (let i = 0; i < it.count; i++) {
      const o = it.make(i);
      let x, z;
      do { x = U.rand(-area / 2, area / 2); z = U.rand(-area / 2, area / 2); } while (Math.hypot(x, z) < avoid);
      o.position.x = x; o.position.z = z;
      o.rotation.y = Math.random() * Math.PI * 2;
      o.userData.r = it.radius ?? 1;
      o.userData.wob = 0; o.userData.wt = Math.random() * 10;
      o.userData.base = o.scale.clone();
      o.userData.kind = it.kind;
      S.scene.add(o); list.push(o);
    }
    const half = area / 2;
    return {
      list,
      update(px, pz, dt) {
        for (const o of list) {
          const dx = o.position.x - px, dz = o.position.z - pz;
          if (dx > half) o.position.x -= area; else if (dx < -half) o.position.x += area;
          if (dz > half) o.position.z -= area; else if (dz < -half) o.position.z += area;
          const u = o.userData;
          if (u.wob > 0.001) {
            u.wt += dt * 18; u.wob *= Math.pow(0.04, dt);
            const k = Math.sin(u.wt) * u.wob;
            o.scale.set(u.base.x * (1 - k * 0.15), u.base.y * (1 + k * 0.25), u.base.z * (1 - k * 0.15));
            o.rotation.z = k * 0.12;
          }
        }
      },
      // wobble everything near (x, z); returns the props touched
      nudge(x, z, radius, strength = 1) {
        const hit = [];
        for (const o of list) {
          const d = Math.hypot(o.position.x - x, o.position.z - z);
          if (d < radius + o.userData.r) { o.userData.wob = Math.max(o.userData.wob, strength * (1 - d / (radius + o.userData.r + 0.01))); hit.push(o); }
        }
        return hit;
      },
    };
  }

  // Ground decals (footprints / tyre tracks) from a recycled pool
  function decals(S, tex, { count = 160, size = [0.7, 0.9], opacity = 0.35 } = {}) {
    const T = S.T;
    const g = S.track(new T.PlaneGeometry(size[0], size[1])); g.rotateX(-Math.PI / 2);
    const m = S.track(new T.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false, color: '#3b2a1a', polygonOffset: true, polygonOffsetFactor: -2 }));
    const pool = Array.from({ length: count }, () => { const d = new T.Mesh(g, m); d.visible = false; d.renderOrder = 1; S.scene.add(d); return d; });
    let c = 0;
    return {
      place(x, z, yaw) { const d = pool[c = (c + 1) % count]; d.position.set(x, 0.02, z); d.rotation.y = yaw; d.visible = true; },
    };
  }

  // A small controller map for grown-ups, drawn on the 2D HUD.
  // map: { 0:'🦘', 1:'🦖', 2:'🤧', 3:'💃', 4:'👋', 5:'👋', 6:'🦵', 7:'🦵' }
  function drawGuide(ctx, api, map, alpha = 0.85) {
    const s = Math.max(16, Math.min(24, api.h * 0.028));
    const cx = api.w - s * 5.2, cy = api.h - s * 4.4;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(20,16,40,.45)';
    U.roundRect(ctx, cx - s * 4.6, cy - s * 4.0, s * 9.4, s * 8.0, s); ctx.fill();
    const btn = (x, y, color, emoji) => {
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, s * 0.8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; ctx.stroke();
      if (emoji) U.emoji(ctx, emoji, x, y, s * 0.95);
    };
    // face buttons by position
    [[0, 0, 1.7], [1, 1.7, 0], [2, -1.7, 0], [3, 0, -1.7]].forEach(([b, dx, dy]) => map[b] && btn(cx + s * 2.2 + dx * s, cy + s * 1.2 + dy * s, U.BTN_COLORS[b], map[b]));
    // shoulders & triggers
    [[6, -3.4, -2.9, 'ZL'], [4, -1.7, -2.9, 'L'], [5, 2.0, -2.9, 'R'], [7, 3.7, -2.9, 'ZR']].forEach(([b, dx, dy, l]) => {
      if (!map[b]) return;
      const x = cx + dx * s * 0.95 - s * 0.6, y = cy + dy * s + s * 0.2;
      ctx.fillStyle = '#5b5480'; U.roundRect(ctx, x - s * 0.8, y - s * 0.45, s * 1.6, s * 0.9, s * 0.3); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `700 ${s * 0.45}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(l, x, y);
      U.emoji(ctx, map[b], x, y + s * 0.95, s * 0.8);
    });
    // stick
    ctx.fillStyle = '#3b3560'; ctx.beginPath(); ctx.arc(cx - s * 2.4, cy + s * 1.2, s * 1.05, 0, Math.PI * 2); ctx.fill();
    if (map.stick) U.emoji(ctx, map.stick, cx - s * 2.4, cy + s * 1.2, s * 1.0);
    ctx.restore();
  }

  return { stage, sky, sun, eye, makeDino, makeDinoModel, DINO_SPECIES, infiniteGround, scatter, decals, drawGuide, hash };
})();
