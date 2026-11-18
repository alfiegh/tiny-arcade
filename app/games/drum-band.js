// DRUM BAND (3D) — a concert stage. The four drums sit where the face buttons are,
// L/R crash the cymbals, ZL/ZR fire confetti cannons, and the dino dances to every hit.
// Teaches: different buttons do different things, and where they sit on the controller.
Games.register({
  id: 'drum-band', name: 'Drum Band', emoji: '🥁', color: '#ff9f1c',
  create(api) {
    const { input, sfx } = api;
    const S = Kit3D.stage(api, { background: '#0d0820', bloom: [0.6, 0.5, 1.3], exposure: 1.0, fov: 44, envIntensity: 0.45, vignette: 1.3 });
    const { T, scene, camera, geo, mat, mesh } = S;
    camera.position.set(0, 7.4, 15.5);
    const camLook = new T.Vector3(0, 1.7, 0);
    camera.lookAt(camLook);

    // ---------- stage ----------
    scene.add(new T.HemisphereLight('#b9a6ff', '#1a0f2e', 0.45));
    const key = new T.DirectionalLight('#ffe9d0', 1.1);
    key.position.set(3, 14, 10); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -12, right: 12, top: 10, bottom: -10, near: 1, far: 40 });
    key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02;
    scene.add(key);

    const wood = S.canvasTex(512, (g, s) => {
      for (let i = 0; i < 8; i++) {
        const y = i * s / 8;
        g.fillStyle = `hsl(${28 + U.rand(-4, 4)} ${45 + U.rand(-5, 5)}% ${32 + U.rand(-4, 4)}%)`; g.fillRect(0, y, s, s / 8);
        g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 3; g.strokeRect(-2, y, s + 4, s / 8);
        for (let k = 0; k < 40; k++) { g.strokeStyle = `rgba(0,0,0,${U.rand(0.03, 0.1)})`; g.lineWidth = 1; g.beginPath(); const yy = y + U.rand(2, s / 8 - 2); g.moveTo(0, yy); g.bezierCurveTo(s / 3, yy + U.rand(-3, 3), s * 2 / 3, yy + U.rand(-3, 3), s, yy); g.stroke(); }
      }
    }, { repeat: 4 });
    const floor = mesh(S.track(new T.BoxGeometry(28, 0.6, 14)), S.track(new T.MeshStandardMaterial({ map: wood, roughness: 0.35, metalness: 0.05 })), { shadow: false });
    floor.position.set(0, -0.3, 0); scene.add(floor);
    const edge = mesh(geo.box, mat('#1a1030', { roughness: 0.6 }), { shadow: false }); edge.scale.set(28, 2, 0.4); edge.position.set(0, -1.3, 7.1); scene.add(edge);

    // velvet curtain with folds
    const curtGeo = S.track(new T.PlaneGeometry(30, 13, 160, 1));
    { const p = curtGeo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 2.2) * 0.35 + Math.sin(p.getX(i) * 0.7) * 0.2); curtGeo.computeVertexNormals(); }
    const curtain = new T.Mesh(curtGeo, S.track(new T.MeshPhysicalMaterial({ color: '#8a0f2c', roughness: 0.75, sheen: 1, sheenColor: new T.Color('#ff6b8b'), sheenRoughness: 0.4 })));
    curtain.position.set(0, 6, -6.5); curtain.receiveShadow = true; scene.add(curtain);

    // marquee bulbs along the front edge
    const bulbs = [];
    for (let i = 0; i < 23; i++) {
      const m = S.track(new T.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffcf6b', emissiveIntensity: 1.2 }));
      const b = new T.Mesh(geo.sphereLo, m); b.scale.setScalar(0.16); b.position.set(-12.1 + i * 1.1, -0.35, 7.32); scene.add(b);
      bulbs.push({ m, flash: 0, color: new T.Color('#ffcf6b') });
    }

    // speakers that pump on hits
    const speakers = [-1, 1].map(s => {
      const g = new T.Group(); g.position.set(s * 9.6, 0, -2.2); g.rotation.y = -s * 0.35;
      const box = mesh(geo.box, mat('#1c1a24', { roughness: 0.5 })); box.scale.set(2.4, 4.2, 1.8); box.position.y = 2.1; g.add(box);
      const cones = [1.2, 3.1].map((y, k) => {
        const c = mesh(geo.cyl, mat('#3a3550', { roughness: 0.3, metalness: 0.4 })); c.scale.set(0.8 - k * 0.25, 0.15, 0.8 - k * 0.25);
        c.rotation.x = Math.PI / 2; c.position.set(0, y, 0.92); g.add(c);
        const ringM = mat('#8e7dff', { emissive: '#6a5cff', emissiveIntensity: 0.9 });
        const r = new T.Mesh(S.track(new T.TorusGeometry(0.85 - k * 0.25, 0.05, 8, 32)), ringM); r.position.set(0, y, 0.95); g.add(r);
        return c;
      });
      scene.add(g); return { g, cones, pump: 0 };
    });

    // spotlights with visible beams
    const beamGeo = S.track(new T.ConeGeometry(2.4, 14, 32, 1, true)); beamGeo.translate(0, -7, 0);
    const beamTex = S.canvasTex(64, (g, s) => { const v = g.createLinearGradient(0, 0, 0, s); v.addColorStop(0, 'rgba(255,255,255,.9)'); v.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = v; g.fillRect(0, 0, s, s); }, { clamp: true });
    const spots = [-6, -2, 2, 6].map((x, i) => {
      const c = U.BTN_COLORS[[2, 3, 0, 1][i]];
      const l = new T.SpotLight(c, 70, 30, 0.32, 0.5, 1.2);
      l.position.set(x, 12, 1); scene.add(l); scene.add(l.target);
      const beam = new T.Mesh(beamGeo, S.track(new T.MeshBasicMaterial({ color: c, map: beamTex, transparent: true, opacity: 0.12, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false })));
      beam.position.copy(l.position); scene.add(beam);
      return { l, beam, base: new T.Color(c), flash: 0, ph: i * 1.7 };
    });

    // ---------- dino on a riser ----------
    const riser = mesh(geo.cyl, mat('#2a2140', { roughness: 0.4, metalness: 0.3 })); riser.scale.set(2.2, 0.5, 2.2); riser.position.set(0, 0.25, -3.4); scene.add(riser);
    const riserRim = new T.Mesh(S.track(new T.TorusGeometry(2.2, 0.07, 8, 48)), S.track(new T.MeshStandardMaterial({ color: '#fff', emissive: '#ff5fa2', emissiveIntensity: 1.6 })));
    riserRim.rotation.x = Math.PI / 2; riserRim.position.set(0, 0.5, -3.4); scene.add(riserRim);
    const dino = Kit3D.makeDinoModel(S, 'trex', { height: 3.5 });
    dino.root.position.set(0, 0.5, -3.4); scene.add(dino.root);

    // ---------- drums ----------
    const CENTER = new T.Vector3(0, 0, 1.7), SPREAD = 2.6;
    const goldM = mat('#ffcf5a', { metalness: 1, roughness: 0.25 });
    const legM = mat('#c9ccd6', { metalness: 1, roughness: 0.3 });
    const DRUMS = [
      { btn: 0, dx: 0, dz: 1, sound: 'kick', move: 'jump', icon: '🥁', r: 1.1 },
      { btn: 1, dx: 1, dz: 0, sound: 'clap', move: 'clap', icon: '👏', r: 0.9 },
      { btn: 2, dx: -1, dz: 0, sound: 'hat', move: 'headbang', icon: '✨', r: 0.9 },
      { btn: 3, dx: 0, dz: -1, sound: 'bell', move: 'spin', icon: '🔔', r: 0.85 },
    ];
    DRUMS.forEach(d => {
      const color = U.BTN_COLORS[d.btn];
      const g = new T.Group(); g.position.set(CENTER.x + d.dx * SPREAD, 0, CENTER.z + d.dz * SPREAD);
      const body = new T.Group(); body.position.y = 0.55; g.add(body);
      const shell = mesh(geo.cyl, mat(color, { physical: true, roughness: 0.25, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 }));
      shell.scale.set(d.r, 0.85, d.r); shell.position.y = 0.42; body.add(shell);
      const headM = S.track(new T.MeshStandardMaterial({ color: '#d9cdb8', roughness: 0.6, emissive: color, emissiveIntensity: 0 }));
      const head = mesh(geo.cyl, headM); head.scale.set(d.r * 0.97, 0.05, d.r * 0.97); head.position.y = 0.87; body.add(head);
      [0.86, 0.0].forEach(y => { const rr = new T.Mesh(S.track(new T.TorusGeometry(d.r, 0.07, 10, 40)), goldM); rr.rotation.x = Math.PI / 2; rr.position.y = y; rr.castShadow = true; body.add(rr); });
      for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; const l = mesh(geo.cyl, legM); l.scale.set(0.05, 0.6, 0.05); l.position.set(Math.cos(a) * d.r * 0.8, 0.28, Math.sin(a) * d.r * 0.8); g.add(l); }
      scene.add(g);
      Object.assign(d, { g, body, headM, hit: 0, color });
    });

    // cymbals (L / R)
    const cymbals = [-1, 1].map(s => {
      const g = new T.Group(); g.position.set(s * 5.4, 0, 0.2);
      const stand = mesh(geo.cyl, legM); stand.scale.set(0.06, 2.6, 0.06); stand.position.y = 1.3; g.add(stand);
      const pivot = new T.Group(); pivot.position.y = 2.65; g.add(pivot);
      const discM = S.track(new T.MeshStandardMaterial({ color: '#ffd36b', metalness: 1, roughness: 0.18, emissive: '#ffb300', emissiveIntensity: 0 }));
      const disc = mesh(S.track(new T.CylinderGeometry(1.15, 1.15, 0.05, 48)), discM); pivot.add(disc);
      const bell = mesh(geo.sphereLo, discM); bell.scale.set(0.28, 0.12, 0.28); bell.position.y = 0.04; pivot.add(bell);
      pivot.rotation.x = 0.35; pivot.rotation.z = -s * 0.15;
      scene.add(g);
      return { pivot, discM, hit: 0, btns: s < 0 ? [4] : [5], side: s };
    });

    // confetti cannons (ZL / ZR)
    const cannons = [-1, 1].map(s => {
      const g = new T.Group(); g.position.set(s * 7.6, 0, 4.2);
      const base = mesh(geo.cyl, mat('#2b2a3a', { metalness: 0.5, roughness: 0.4 })); base.scale.set(0.7, 0.4, 0.7); base.position.y = 0.2; g.add(base);
      const pivot = new T.Group(); pivot.position.y = 0.5; pivot.rotation.z = s * 0.45; pivot.rotation.x = -0.25; g.add(pivot);
      const barrel = mesh(geo.cyl, mat(s < 0 ? '#9b5de5' : '#00bbf9', { physical: true, roughness: 0.25, clearcoat: 1 })); barrel.scale.set(0.42, 1.8, 0.42); barrel.position.y = 0.9; pivot.add(barrel);
      const stripe = mesh(geo.cyl, mat('#ffd23f')); stripe.scale.set(0.44, 0.25, 0.44); stripe.position.y = 1.2; pivot.add(stripe);
      scene.add(g);
      return { g, pivot, kick: 0, btns: s < 0 ? [6] : [7], side: s };
    });

    // crowd of little blobs at the front
    const crowd = [];
    for (let i = 0; i < 15; i++) {
      const g = new T.Group();
      const x = -10.5 + i * 1.5 + U.rand(-0.3, 0.3);
      g.position.set(x, -1.6, 8.6 + (i % 2) * 0.7);
      const b = mesh(geo.sphere, mat(U.RAINBOW[i % U.RAINBOW.length], { roughness: 0.4 })); b.scale.set(0.62, 0.7, 0.6); g.add(b);
      [-1, 1].forEach(s => { const e = Kit3D.eye(S, 0.15, s); e.position.set(s * 0.22, 0.2, 0.5); g.add(e); });
      scene.add(g); crowd.push({ g, jump: 0, vy: 0, y0: g.position.y, ph: Math.random() * 6 });
    }

    const DPAD = { 12: 3, 13: 0, 14: 2, 15: 1 };
    let hits = 0, t = 0, energy = 0;

    function crowdCheer(power = 1) {
      crowd.forEach(c => { if (c.jump <= 0 && Math.random() < 0.7 * power) { c.vy = U.rand(4, 7) * power; c.jump = 1; } });
    }
    function flashLights(color) {
      spots.forEach(s => { s.flash = 1; s.l.color.set(color); s.beam.material.color.set(color); });
      bulbs.forEach((b, i) => { b.flash = 1; b.color.set(i % 2 ? color : '#ffffff'); });
      speakers.forEach(sp => sp.pump = 1);
    }
    function hitDrum(d) {
      d.hit = 1; hits++; energy = Math.min(1, energy + 0.12);
      sfx.drum(d.sound);
      const top = new T.Vector3(d.g.position.x, 1.5, d.g.position.z);
      S.ring(new T.Vector3(d.g.position.x, 0.03, d.g.position.z), d.color, 3.5, 0.55);
      S.sparkle(top, d.color, 35, 6, { gravity: 5, up: 3 });
      flashLights(d.color);
      if (!dino.airborne) dino.do(d.move);
      const sp = S.toScreen(top);
      api.fx.floatEmoji(sp.x + U.rand(-30, 30), sp.y - 30, U.pick(['🎵', '🎶']), { size: 50, life: 1.3, vy: -170, vx: U.rand(-60, 60) });
      input.rumble(d.sound === 'kick' ? 0.6 : 0.25, 70);
      crowdCheer(0.5);
      S.shake(d.sound === 'kick' ? 0.12 : 0.04);
      if (hits % 20 === 0) { api.celebrate(); dino.do('dance'); crowdCheer(1.4); }
    }

    return {
      resize: S.resize,
      update(dt) {
        t += dt;
        for (const b of input.pressed) {
          const idx = b in DPAD ? DPAD[b] : b;
          const d = DRUMS.find(d => d.btn === idx);
          if (d) { hitDrum(d); continue; }
          const c = cymbals.find(c => c.btns.includes(b));
          if (c) {
            c.hit = 1; hits++; energy = Math.min(1, energy + 0.12);
            sfx.drum('cymbal');
            const p = new T.Vector3(c.pivot.getWorldPosition(new T.Vector3()).x, 2.7, 0.2);
            S.sparkle(p, '#ffd36b', 50, 7, { gravity: 4 });
            flashLights('#ffd36b'); dino.do(c.side < 0 ? 'waveL' : 'waveR');
            input.rumble(0.35, 90); crowdCheer(0.8);
            continue;
          }
          const k = cannons.find(k => k.btns.includes(b));
          if (k) {
            k.kick = 1; hits++;
            sfx.firework();
            const mouth = new T.Vector3(k.g.position.x - k.side * 1.2, 2.2, k.g.position.z - 0.5);
            for (let n = 0; n < 5; n++) S.sparkle(mouth, U.pick(U.RAINBOW), 30, 9, { gravity: 6, life: 2.2, up: 9 });
            setTimeout(() => { const top = new T.Vector3(k.g.position.x * 0.5, 9, -1); for (let n = 0; n < 4; n++) S.sparkle(top, U.pick(U.RAINBOW), 40, 7, { gravity: 3, life: 1.8 }); }, 550);
            flashLights(U.pick(U.RAINBOW)); dino.do('happy');
            input.rumble(0.7, 200); crowdCheer(1.3); S.shake(0.15);
          }
        }

        DRUMS.forEach(d => {
          d.hit = Math.max(0, d.hit - dt * 4.5);
          const sq = Math.sin(d.hit * Math.PI) * 0.25;
          d.body.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
          d.headM.emissiveIntensity = d.hit * 2.2 + 0.05;
        });
        cymbals.forEach(c => {
          c.hit = Math.max(0, c.hit - dt * 1.8);
          c.pivot.rotation.x = 0.35 + Math.sin(t * 30) * 0.35 * c.hit;
          c.discM.emissiveIntensity = c.hit * 2.5;
        });
        cannons.forEach(k => { k.kick = Math.max(0, k.kick - dt * 3); k.pivot.scale.set(1 + k.kick * 0.25, 1 - k.kick * 0.3, 1 + k.kick * 0.25); });
        speakers.forEach(sp => { sp.pump = Math.max(0, sp.pump - dt * 6); sp.cones.forEach(c => c.position.z = 0.92 + sp.pump * 0.25); });
        crowd.forEach(c => {
          if (c.jump > 0) { c.g.position.y += c.vy * dt; c.vy -= 20 * dt; if (c.g.position.y <= c.y0) { c.g.position.y = c.y0; c.jump = 0; } }
          c.g.rotation.z = Math.sin(t * 3 + c.ph) * 0.12 * (0.3 + energy);
        });

        energy = Math.max(0, energy - dt * 0.15);
        spots.forEach((s, i) => {
          s.flash = Math.max(0, s.flash - dt * 2);
          const sweep = 0.4 + energy * 1.2;
          s.l.target.position.set(Math.sin(t * sweep + s.ph) * 6, 0, Math.cos(t * sweep * 0.8 + s.ph) * 3 + 1);
          s.beam.lookAt(s.l.target.position); s.beam.rotateX(-Math.PI / 2);
          s.l.intensity = 22 + s.flash * 45;
          s.beam.material.opacity = 0.07 + s.flash * 0.18 + energy * 0.05;
          if (s.flash < 0.05) { s.l.color.lerp(s.base, Math.min(1, dt * 2)); s.beam.material.color.lerp(s.base, Math.min(1, dt * 2)); }
        });
        bulbs.forEach((b, i) => {
          b.flash = Math.max(0, b.flash - dt * 2.5);
          const chase = (Math.sin(t * 6 - i * 0.8) > 0.6 ? 0.8 : 0) * (0.3 + energy);
          b.m.emissive.copy(b.color); b.m.emissiveIntensity = 0.5 + chase + b.flash * 3;
          if (b.flash < 0.05) b.color.lerp(new T.Color('#ffcf6b'), Math.min(1, dt * 2));
        });
        riserRim.material.emissive.setHSL((t * 0.1) % 1, 0.9, 0.55);
        dino.update(dt, 0);
        S.update(dt);
      },
      draw(ctx) {
        S.render();
        ctx.clearRect(0, 0, api.w, api.h);
        DRUMS.forEach(d => {     // icon floating above each drum
          const sp = S.toScreen(new T.Vector3(d.g.position.x, 2.3 + Math.sin(t * 3 + d.btn) * 0.1, d.g.position.z));
          U.emoji(ctx, d.icon, sp.x, sp.y, Math.max(34, api.h * 0.05) * (1 + d.hit * 0.4));
        });
      },
      destroy: S.destroy,
    };
  },
});
