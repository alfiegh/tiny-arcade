// DRAGON SKY (3D) — fly a friendly dragon over an endless land and breathe fire to light things up.
//
//   Stick left / right : turn                       Stick up / down : fly higher / lower
//   ZR (hold)          : fly fast                   ZL (hold)       : slow down
//   A (bottom, hold)   : breathe fire               B (right)       : ROAR
//   X (top)            : big flap (shoots upward)   Y (left)        : loop-the-loop
//   L / R              : barrel roll left / right
//
// Fire lights paper lanterns (they glow and float up), campfires and the braziers on castle towers.
// Nothing is destroyed and nothing is lost: lit things go out again after a while so there is always more to light.
// Model: app/assets/dragon/dragon.glb (rigged; one seamless "Fly" loop, faces +Z, hovers upright in the clip).
Games.register({
  id: 'dragon-sky', name: 'Dragon Sky', emoji: '🐉', color: '#3fbf6a',
  create(api) {
    const { input, sfx } = api;
    const S = Kit3D.stage(api, { fog: ['#cfeaff', 40, 90], bloom: [0.6, 0.6, 1.2], exposure: 1.0, fov: 55, envIntensity: 0.6 });
    const { T, scene, camera, geo, mat, mesh } = S;

    const skyDome = Kit3D.sky(S, '#3d8fe8', '#cfeaff', '#cfeaff', { sunDir: new T.Vector3(0.45, 0.5, -0.75) });
    scene.add(new T.HemisphereLight('#e2f3ff', '#6b9a4a', 1.0));
    const sun = Kit3D.sun(S, { intensity: 2.0, offset: [10, 24, 8], size: 30 });

    // ---------- ground ----------
    const grassTex = S.canvasTex(512, (g, s) => {
      g.fillStyle = '#86cf5c'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 30; i++) { g.fillStyle = `hsla(${U.rand(75, 110)},45%,${U.rand(42, 58)}%,.35)`; g.beginPath(); g.arc(U.rand(0, s), U.rand(0, s), U.rand(30, 110), 0, 7); g.fill(); }
      for (let i = 0; i < 7000; i++) { g.fillStyle = `hsl(${U.rand(75, 115)} ${U.rand(35, 60)}% ${U.rand(38, 60)}%)`; g.fillRect(U.rand(0, s), U.rand(0, s), 2, U.rand(3, 6)); }
    });
    const ground = Kit3D.infiniteGround(S, grassTex, { tile: 12, size: 320 });

    // ---------- flames (shared look for fire breath and lit things) ----------
    const flameTex = S.canvasTex(128, (g, s) => {
      const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,240,200,.85)'); r.addColorStop(1, 'rgba(255,200,120,0)');
      g.fillStyle = r; g.fillRect(0, 0, s, s);
    }, { clamp: true });
    const flameCone = S.track(new T.ConeGeometry(1, 1, 12));
    function staticFlame(size) {   // a little flickering campfire flame (hidden until lit)
      const g = new T.Group(); g.visible = false;
      [['#ff7a1a', 1, 1.6], ['#ffd23f', 0.6, 1.1]].forEach(([c, w, h]) => {
        const m = new T.Mesh(flameCone, S.track(new T.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 2.4, transparent: true, opacity: 0.9, depthWrite: false })));
        m.scale.set(w * size, h * size, w * size); m.position.y = h * size / 2; g.add(m);
      });
      const l = new T.PointLight('#ff8a2a', 0, 9, 1.6); l.position.y = size; g.add(l);
      g.userData.light = l; return g;
    }

    // ---------- world ----------
    const trunkM = mat('#8a5a3c', { roughness: 0.9 }), leafMs = ['#3fa34d', '#57b947', '#2f8f45'].map(c => mat(c, { roughness: 0.8 }));
    function tree() {
      const g = new T.Group();
      const tr = mesh(geo.cyl, trunkM); tr.scale.set(0.4, 3, 0.4); tr.position.y = 1.5; g.add(tr);
      [[0, 3.8, 0, 1.9], [1, 3.2, 0.3, 1.2], [-1, 3.3, -0.2, 1.3]].forEach(([a, b, c, r], i) => { const l = mesh(geo.sphereLo, leafMs[i % 3]); l.scale.setScalar(r); l.position.set(a, b, c); g.add(l); });
      g.scale.setScalar(U.rand(0.9, 1.4)); return g;
    }
    const hillMs = ['#6fc24a', '#7fcf55', '#5fb544'].map(c => mat(c, { roughness: 0.95 }));
    function hill() { const g = new T.Group(); const h = mesh(geo.sphere, U.pick(hillMs)); h.scale.set(U.rand(6, 11), U.rand(2, 4), U.rand(6, 11)); g.add(h); return g; }
    const stoneM = mat('#cfc6bd', { roughness: 0.85 });
    // medieval castle pieces (Quaternius "Modular Medieval Buildings", app/assets/medieval)
    const MED = 'medieval/medieval', med = (name, o) => Kit3D.prop(S, MED, name, o);
    const roofCols = ['#e5484d', '#3d7bf0', '#9b5de5', '#ff9f1c'];
    function tower() {   // a flat-topped tower with a fire bowl on top to light
      const H = U.rand(8.8, 10);
      const g = med(U.pick(['Tower', 'LargeTower', 'LargeSquareTowerBricks', 'Tower']), { height: H });
      const bowl = mesh(geo.cyl, mat('#5b4636', { roughness: 0.8 })); bowl.scale.set(0.8, 0.45, 0.8); bowl.position.y = H - 0.15; g.add(bowl);
      const f = staticFlame(1.1); f.position.y = H + 0.05; g.add(f);
      g.userData.flame = f; g.userData.fireAt = new T.Vector3(0, H + 0.4, 0); g.userData.clear = { r: 4.5, h: H + 3.4 }; return g;
    }
    function castle() {  // gate + walls + pointy corner towers, roof colour per castle
      const g = new T.Group(), k = 2.3, roof = { Celing: U.pick(roofCols) };
      const add = (name, x, z = 0, ry = 0) => { const p = med(name, { scale: k, colors: roof }); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p); return p; };
      add('WallEntranceBricks', 0); add('WallBricks', -1.54 * k); add('WallBricks', 1.54 * k);
      add('PointyTower', -2.6 * k); add('PointyTower', 2.6 * k);
      const ban = add('Banner', 0, 0.2 * k); ban.position.y = 1.55 * k - 0.1;
      g.userData.clear = { r: 8, h: 5.4 * k + 2.5 }; return g;
    }
    function watchtower() { const g = med('WatchTowerWRoof', { height: 7.5, colors: { Celing: U.pick(roofCols) } }); g.userData.clear = { r: 3.5, h: 10.5 }; return g; }
    function well() { return med('Well', { height: 2.2, colors: { Celing: U.pick(roofCols) } }); }
    function target() { return med(U.pick(['Target', 'TargetWithArrows']), { height: 1.8 }); }
    function campfire() {
      const g = new T.Group();
      for (let k = 0; k < 4; k++) { const l = mesh(geo.cyl, trunkM); l.scale.set(0.15, 1.3, 0.15); l.rotation.set(Math.PI / 2, k * Math.PI / 4, 0); l.position.y = 0.15; g.add(l); }
      for (let k = 0; k < 8; k++) { const r = mesh(geo.sphereLo, stoneM); const a = k / 8 * Math.PI * 2; r.scale.set(0.25, 0.18, 0.25); r.position.set(Math.cos(a) * 0.9, 0.1, Math.sin(a) * 0.9); g.add(r); }
      const f = staticFlame(0.8); f.position.y = 0.2; g.add(f);
      g.userData.flame = f; g.userData.fireAt = new T.Vector3(0, 0.6, 0); return g;
    }
    const lanternColors = ['#ff5e5e', '#ffb02e', '#ff7bd5', '#b48cff', '#4fc3ff', '#7be07b'];
    function lantern(i) {
      const g = new T.Group(), body = new T.Group(); g.add(body);
      const c = lanternColors[i % lanternColors.length];
      const m = S.track(new T.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.05, roughness: 0.7 }));
      const b = mesh(geo.sphere, m, { shadow: false }); b.scale.set(0.9, 1.15, 0.9); body.add(b);
      [-1.1, 1.1].forEach(y => { const r = mesh(geo.cyl, mat('#6b4a2b')); r.scale.set(0.55, 0.12, 0.55); r.position.y = y; body.add(r); });
      const l = new T.PointLight(c, 0, 10, 1.6); body.add(l);
      g.position.y = U.rand(6, 17);
      Object.assign(g.userData, { body, m, light: l, baseY: g.position.y, lift: 0, ph: Math.random() * 6, fireAt: new T.Vector3(0, 0, 0) });
      return g;
    }
    const cloudM = mat('#ffffff', { roughness: 1 });
    function cloud() {
      const g = new T.Group();
      for (let k = 0; k < 6; k++) { const p = mesh(geo.sphereLo, cloudM, { shadow: false }); p.scale.set(U.rand(1.8, 3), U.rand(1.2, 1.8), U.rand(1.8, 2.6)); p.position.set(U.rand(-3, 3), U.rand(-0.4, 0.6), U.rand(-1.5, 1.5)); g.add(p); }
      g.position.y = U.rand(13, 24); return g;
    }
    const world = Kit3D.scatter(S, [
      { make: hill, count: 10, radius: 7, kind: 'deco' },
      { make: tree, count: 28, radius: 1.2, kind: 'deco' },
      { make: tower, count: 6, radius: 1.8, kind: 'tower' },
      { make: castle, count: 3, radius: 8, kind: 'castle' },
      { make: watchtower, count: 4, radius: 2, kind: 'deco' },
      { make: well, count: 5, radius: 1, kind: 'deco' },
      { make: target, count: 6, radius: 0.8, kind: 'deco' },
      { make: campfire, count: 12, radius: 1, kind: 'camp' },
      { make: lantern, count: 22, radius: 1.2, kind: 'lantern' },
      { make: cloud, count: 14, radius: 3, kind: 'cloud' },
    ], { area: 150, avoid: 10 });
    world.list.forEach(o => { if (o.userData.flame || o.userData.kind === 'lantern') Object.assign(o.userData, { lit: 0 }); });
    // a few lanterns right ahead at the start, so the first puff of fire finds something
    world.list.filter(o => o.userData.kind === 'lantern').slice(0, 3).forEach((o, i) => { o.position.set([-4, 4, -1.5][i], 0, 18 + i * 6); o.userData.baseY = [5, 6, 3.8][i]; o.position.y = o.userData.baseY; });

    // ---------- the dragon ----------
    const D = makeDragon();
    scene.add(D.root);
    S.dragon = D;   // for DevTools poking: __stage.dragon

    function makeDragon() {
      const asset = Assets.get('dragon/dragon');
      const root = new T.Group();                 // position + heading
      const bank = new T.Group(); root.add(bank); // roll
      const pitch = new T.Group(); bank.add(pitch);
      const model = T.SkeletonUtils.clone(asset.scene);
      pitch.add(model);
      model.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = false; n.frustumCulled = false; n.material = S.track(n.material.clone()); n.material.roughness = 0.8; n.material.envMapIntensity = 0.3; n.material.color.setScalar(0.85); } });
      const B = {}; model.traverse(n => { if (n.isBone) B[n.name] = n; });
      const mixer = new T.AnimationMixer(model);
      const fly = mixer.clipAction(asset.animations.find(a => a.name === 'Fly') || asset.animations[0]); fly.play();
      mixer.update(0); model.updateMatrixWorld(true);
      // size from the skinned vertices (wingspan ~7.5), pivot on the hips
      const box = new T.Box3(), v = new T.Vector3();
      model.traverse(n => {
        if (!n.isSkinnedMesh) return;
        n.skeleton.update();
        const p = n.geometry.attributes.position;
        for (let i = 0; i < p.count; i += 3) { v.fromBufferAttribute(p, i); n.applyBoneTransform(i, v); box.expandByPoint(v.applyMatrix4(n.matrixWorld)); }
      });
      const k = 7.5 / (box.max.x - box.min.x);
      model.scale.multiplyScalar(k);
      model.updateMatrixWorld(true);
      const hips = (B.pelvic_1 || model).getWorldPosition(new T.Vector3());
      model.position.sub(hips);
      const mouth = new T.Vector3(), headP = new T.Vector3(), lipU = new T.Vector3(), lipL = new T.Vector3();
      return {
        root, bank, pitch, model, mixer, fly, bones: B,
        // world position of the mouth and the direction the snout points
        mouth(dir) {
          B.upper_lip.getWorldPosition(lipU); B.lower_lip.getWorldPosition(lipL); B.head.getWorldPosition(headP);
          mouth.copy(lipU).add(lipL).multiplyScalar(0.5);
          if (dir) dir.copy(mouth).sub(headP).normalize();
          return mouth;
        },
      };
    }

    // ---------- fire breath particles ----------
    const FIRE_N = 300;
    const fire = Array.from({ length: FIRE_N }, () => {
      const m = S.track(new T.SpriteMaterial({ map: flameTex, color: '#ffffff', transparent: true, depthWrite: false, fog: false }));   // normal blending: additive washes out on the bright sky
      const s = new T.Sprite(m); s.visible = false; scene.add(s);
      return { s, m, v: new T.Vector3(), life: 0, max: 1 };
    });
    let fireCursor = 0;
    const FIRE_COLORS = [new T.Color(1.6, 1.35, 0.45), new T.Color(1.5, 0.6, 0.06), new T.Color(1.2, 0.18, 0.04), new T.Color(0.5, 0.36, 0.34)];   // yellow-hot -> orange -> red -> smoke
    const fireLight = new T.PointLight('#ff8a2a', 0, 22, 1.4); scene.add(fireLight);
    function emitFire(p, dir) {
      for (let k = 0; k < 6; k++) {
        const f = fire[fireCursor = (fireCursor + 1) % FIRE_N];
        f.s.position.copy(p).addScaledVector(dir, U.rand(0, 0.6));
        f.v.copy(dir).multiplyScalar(U.rand(16, 22)).add(new T.Vector3(U.rand(-2.2, 2.2), U.rand(-1, 2), U.rand(-2.2, 2.2)));
        f.life = f.max = U.rand(0.7, 1.05); f.s.visible = true; f.s.material.rotation = U.rand(0, 6.3);
      }
    }

    // ---------- state ----------
    const pos = new T.Vector3(0, 6, 0);
    let yaw = 0, speed = 7, turn = 0, vy = 0, t = 0, roll = 0, rollV = 0, loop = null, flapBoost = 0;
    let breathing = false, breathT = 0, breathCam = 0, roarT = 0, litCount = 0;
    const fwd = () => new T.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const mouthDir = new T.Vector3(), tmp = new T.Vector3();

    const hills = world.list.filter(o => o.userData.kind === 'deco' && o.children[0].scale.x > 5).map(o => o.children[0]);
    function groundHeight(x, z) {   // top of the hills under (x, z)
      let h = 0;
      for (const m of hills) {
        const o = m.parent, dx = (x - o.position.x) / m.scale.x, dz = (z - o.position.z) / m.scale.z, q = 1 - dx * dx - dz * dz;
        if (q > 0) h = Math.max(h, m.scale.y * Math.sqrt(q));
      }
      return h;
    }

    function light(o) {
      const u = o.userData;
      if (u.lit > 0) { u.lit = Math.max(u.lit, 25); return; }
      u.lit = 25;
      const at = o.localToWorld(u.fireAt.clone());
      if (u.flame) { u.flame.visible = true; }
      if (u.kind === 'lantern') { u.m.emissiveIntensity = 1.4; u.lift = 0; }
      sfx.note(litCount++ % 10 + 5, { type: 'sine', dur: 0.5, vol: 0.22 });
      S.sparkle(at, '#ffd27a', 40, 5, { glow: 1.6, spread: 0.8, gravity: 2 });
      S.ring(at, '#ffb347', 3, 0.5, 1.2);
      const sp = S.toScreen(at); if (!sp.behind && Math.random() < 0.5) api.fx.floatEmoji(sp.x, sp.y, U.pick(['✨', '🔥', '⭐']), { size: 50, life: 1.2 });
      input.rumble(0.3, 90);
    }
    function unlight(o) {
      const u = o.userData; u.lit = 0;
      if (u.flame) { u.flame.visible = false; u.flame.userData.light.intensity = 0; }
      if (u.kind === 'lantern') { u.m.emissiveIntensity = 0.05; u.light.intensity = 0; u.lift = 0; o.position.y = u.baseY; }
    }

    function doAction(b) {
      switch (b) {
        case 1: sfx.roar(); roarT = 1.2; S.shake(0.25); input.rumble(0.6, 400); world.nudge(pos.x, pos.z, 14, 0.6); break;
        case 2: if (!loop) { loop = { t: 0 }; sfx.whoosh(); } break;
        case 3: vy = Math.max(vy, 9); flapBoost = 1; sfx.whoosh(); sfx.synth({ type: 'sine', freq: 200, slideTo: 420, dur: 0.35, vol: 0.2 }); break;
        case 4: rollV = 1; sfx.whoosh(); break;
        case 5: rollV = -1; sfx.whoosh(); break;
      }
    }

    camera.position.set(0, 10, -12);

    return {
      resize: S.resize,
      update(dt) {
        t += dt;
        for (const b of input.pressed) doAction(b);

        // flying: always gliding forward; stick steers and climbs
        const target = (input.down.has(7) ? 13 : input.down.has(6) ? 3 : 7) * CONFIG.stickSpeed;
        speed = U.lerp(speed, target, Math.min(1, dt * 1.5));
        turn = U.lerp(turn, input.x, Math.min(1, dt * 4));
        yaw -= turn * 1.3 * dt;
        const climb = -input.y * 6;
        vy = U.lerp(vy, climb, Math.min(1, dt * (Math.abs(vy) > Math.abs(climb) ? 1.5 : 3)));
        const f = fwd();
        pos.addScaledVector(f, speed * dt);
        pos.y += vy * dt;
        const floor = 3 + groundHeight(pos.x, pos.z);
        if (pos.y < floor) { pos.y = U.lerp(pos.y, floor, Math.min(1, dt * 8)); vy = Math.max(0, vy); }
        if (pos.y > 24) { pos.y = 24; vy = Math.min(0, vy); }
        // towers and castles are tall: glide up and over them instead of bumping
        world.list.forEach(o => {
          const c = o.userData.clear; if (!c) return;
          const d = Math.hypot(o.position.x - pos.x, o.position.z - pos.z);
          if (d < c.r && pos.y < c.h) pos.y = U.lerp(pos.y, c.h, Math.min(1, dt * 6));
        });

        // tricks
        if (rollV) { roll += rollV * dt * Math.PI * 2 / 0.8; if (Math.abs(roll) >= Math.PI * 2) { roll = 0; rollV = 0; } }
        let loopA = 0;
        if (loop) { loop.t += dt; loopA = U.ease(Math.min(1, loop.t / 1.1)) * Math.PI * 2; if (loop.t >= 1.1) loop = null; }
        flapBoost = Math.max(0, flapBoost - dt * 1.2);

        // pose: lean into the glide, bank into turns
        D.root.position.copy(pos); D.root.rotation.y = yaw;
        D.bank.rotation.z = -turn * 0.55 + roll;
        D.pitch.rotation.x = 0.35 + speed * 0.02 - vy * 0.03 - loopA;
        D.fly.setEffectiveTimeScale(0.9 + speed * 0.05 + flapBoost * 1.2 + Math.max(0, vy) * 0.05);
        D.mixer.update(dt);
        D.root.updateMatrixWorld(true);

        // fire breath (hold A)
        const wasBreathing = breathing;
        breathing = input.down.has(0);
        const mouth = D.mouth(mouthDir);
        const aim = tmp.copy(f).multiplyScalar(0.8).add(mouthDir.multiplyScalar(0.4)).setY(-0.32).normalize();
        if (breathing) {
          breathT -= dt;
          emitFire(mouth, aim);
          if (Math.random() < dt * 14) S.sparkle(mouth.clone().addScaledVector(aim, U.rand(3, 9)), Math.random() < 0.5 ? '#ffb020' : '#ff5a1f', 4, 4, { glow: 1.6, up: 1.5, life: 0.7 });   // embers
          if (!wasBreathing || breathT <= 0) { breathT = 0.22; sfx.whoosh(); }
          if (!wasBreathing) { sfx.synth({ type: 'sawtooth', freq: 140, slideTo: 70, dur: 0.5, vol: 0.18, cutoff: 700 }); }
          input.rumble(0.2, 60);
          // generous hit cone: anything near the line of fire gets lit
          world.list.forEach(o => {
            const u = o.userData; if (u.lit === undefined || u.lit > 20) return;
            const at = o.localToWorld(u.fireAt.clone());
            const rel = at.sub(mouth), along = rel.dot(aim);
            if (along < 0 || along > 18) return;
            const off = rel.addScaledVector(aim, -along).length();
            if (off < 2.2 + along * 0.22) light(o);
          });
        }
        fireLight.position.copy(mouth).addScaledVector(aim, 3);
        fireLight.intensity = U.lerp(fireLight.intensity, breathing ? 40 + Math.sin(t * 37) * 10 : 0, Math.min(1, dt * 12));
        fire.forEach(p => {
          if (p.life <= 0) return;
          p.life -= dt;
          if (p.life <= 0) { p.s.visible = false; return; }
          const k = 1 - p.life / p.max;
          // breath velocity slows down, but flames keep flying along with the dragon so it never flies into its own fire
          p.v.multiplyScalar(Math.pow(0.25, dt)); p.v.y += dt * 3;
          p.s.position.addScaledVector(p.v, dt).addScaledVector(f, speed * dt);
          p.s.scale.setScalar(0.7 + k * 4.6);
          const ci = Math.min(2.999, k * 3), j = Math.floor(ci);
          p.m.color.copy(FIRE_COLORS[j]).lerp(FIRE_COLORS[j + 1], ci - j);
          p.m.opacity = Math.min(0.95, (1 - k) * 1.5) * U.clamp((p.s.position.distanceTo(camera.position) - 3) / 4, 0, 1);   // never a white-out near the lens
        });

        // lit things: flicker, lanterns float up, everything goes out again after a while
        world.list.forEach(o => {
          const u = o.userData;
          if (u.kind === 'lantern') {
            u.body.position.y = Math.sin(t * 1.2 + u.ph) * 0.3; u.body.rotation.y += dt * 0.3;
            if (u.lit > 0) { u.lift += dt; o.position.y = u.baseY + Math.min(12, u.lift * 2.2); u.light.intensity = 6 + Math.sin(t * 9 + u.ph) * 1.5; }   // floats up out of the way
          }
          if (u.flame && u.lit > 0) {
            const fl = 1 + Math.sin(t * 17 + o.position.x) * 0.12 + Math.sin(t * 29) * 0.06;
            u.flame.scale.set(1, fl, 1); u.flame.userData.light.intensity = 8 * fl;
            if (Math.random() < dt * 3) S.sparkle(o.localToWorld(u.fireAt.clone()).add(new T.Vector3(0, 0.8, 0)), '#ffb347', 3, 1.5, { glow: 1.4, up: 2, life: 0.8 });
          }
          if (u.lit > 0) { u.lit -= dt; if (u.lit <= 0) unlight(o); }
          if (u.kind === 'lantern' || u.kind === 'cloud') o.visible = o.position.distanceTo(camera.position) > (u.kind === 'cloud' ? 11 : 3.5);   // no lens-filling blobs
        });

        // roar: the camera rumbles, clouds wobble
        roarT = Math.max(0, roarT - dt);

        world.update(pos.x, pos.z, dt);
        ground.follow(pos.x, pos.z);
        sun.follow(pos.x, pos.z);

        // chase camera: behind and a little above, following height softly
        breathCam = U.lerp(breathCam, breathing ? 1 : 0, Math.min(1, dt * 2.5));
        const camGoal = pos.clone().addScaledVector(f, -13 + breathCam * 4).add(new T.Vector3(-f.z * breathCam * 10, 5.5 + breathCam * 2.5, f.x * breathCam * 10));   // swings to a 3/4 view while breathing so the flame stream shows
        camGoal.y = Math.max(2.5 + groundHeight(camGoal.x, camGoal.z), camGoal.y);
        world.list.forEach(o => { const c = o.userData.clear; if (c && Math.hypot(o.position.x - camGoal.x, o.position.z - camGoal.z) < c.r - 1) camGoal.y = Math.max(camGoal.y, c.h - 0.5); });
        camera.position.lerp(camGoal, Math.min(1, dt * 2.2));
        camera.lookAt(pos.x + f.x * 9, pos.y - 1, pos.z + f.z * 9);
        skyDome.position.copy(camera.position);
        S.update(dt);
      },
      draw(ctx) {
        S.render();
        ctx.clearRect(0, 0, api.w, api.h);
        if (CONFIG.showGuides) Kit3D.drawGuide(ctx, api, { 0: '🔥', 1: '🐲', 2: '🔄', 3: '⬆️', 4: '↩️', 5: '↪️', 6: '🐢', 7: '🚀', stick: '🐉' }, 0.8);
      },
      destroy() { S.destroy(); },
    };
  },
});
