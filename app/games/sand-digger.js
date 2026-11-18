// SAND DIGGER (3D) — drive a big wheel loader around an endless sandy yard and build sand piles.
//
//   Stick up / down : drive forward / reverse      Stick left / right : steer (the loader bends in the middle)
//   ZR (hold)       : go forward                   ZL (hold) : reverse (beep-beep backup alarm)
//   A (bottom)      : dump the sand from the bucket (empty bucket: gives it a shake)
//   B (right)       : horn                         X (top)   : lift / lower the bucket arm
//   Y (left)        : flashing beacon on/off       L / R     : bounce
//
// Drive the bucket into a brown dig mound to fill it, then press A anywhere to tip it out.
// Dumping on (or next to) a pile makes it grow taller; big piles get a flag and a sparkle.
// Model: "Wheel loader" (app/assets/bulldozer/bulldozer.glb). Its bucket comes out of the file detached
// from the arm, so buildLoader() re-hinges it at the arm tip and drives the arm/bucket/wheels itself.
Games.register({
  id: 'sand-digger', name: 'Sand Digger', emoji: '🏗️', color: '#f4a261',
  create(api) {
    const { input, sfx } = api;
    const S = Kit3D.stage(api, { fog: ['#ffe9c7', 38, 70], bloom: [0.5, 0.6, 1.25], exposure: 1.0, fov: 50, envIntensity: 0.55 });
    const { T, scene, camera, geo, mat, mesh } = S;

    const skyDome = Kit3D.sky(S, '#4aa8f0', '#ffe9c7', '#ffe9c7', { sunDir: new T.Vector3(0.45, 0.45, -0.75) });
    scene.add(new T.HemisphereLight('#e6f4ff', '#c99a5b', 0.95));
    const sun = Kit3D.sun(S, { intensity: 2.1, offset: [10, 20, 8], size: 26 });

    // ---------- ground ----------
    const sandTex = S.canvasTex(512, (g, s) => {
      g.fillStyle = '#efcf8f'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 30; i++) { g.fillStyle = `hsla(${U.rand(32, 44)},60%,${U.rand(62, 76)}%,.35)`; g.beginPath(); g.arc(U.rand(0, s), U.rand(0, s), U.rand(30, 110), 0, 7); g.fill(); }
      for (let i = 0; i < 9000; i++) { g.fillStyle = `hsl(${U.rand(28, 45)} ${U.rand(35, 60)}% ${U.rand(52, 80)}%)`; g.fillRect(U.rand(0, s), U.rand(0, s), 2, 2); }
      for (let i = 0; i < 12; i++) { g.strokeStyle = 'rgba(180,130,70,.15)'; g.lineWidth = 3; g.beginPath(); const y = U.rand(0, s); g.moveTo(0, y); g.bezierCurveTo(s * 0.3, y + U.rand(-30, 30), s * 0.7, y + U.rand(-30, 30), s, y); g.stroke(); }
    });
    const ground = Kit3D.infiniteGround(S, sandTex, { tile: 10 });

    // ---------- sand mounds (shared shape: a soft round hill, unit radius and height) ----------
    const moundGeo = S.track((() => {
      const pts = [];
      for (let i = 0; i <= 16; i++) { const r = i / 16; pts.push(new T.Vector2(r, Math.pow(1 - r * r, 1.4))); }
      pts.reverse();
      const g = new T.LatheGeometry(pts, 32);
      const p = g.attributes.position, v = new T.Vector3();   // a little lumpy so it reads as sand
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 1 + (Math.sin(v.x * 7 + v.z * 3) + Math.sin(v.z * 9 - v.x * 2)) * 0.035 * v.y; p.setXYZ(i, v.x * k, v.y * k, v.z * k); }
      g.computeVertexNormals(); return g;
    })());
    const grainTex = S.canvasTex(256, (g, s) => { g.fillStyle = '#fff'; g.fillRect(0, 0, s, s); for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(120,80,30,${U.rand(0.05, 0.25)})`; g.fillRect(U.rand(0, s), U.rand(0, s), 2, 2); } });
    const pileM = S.track(new T.MeshStandardMaterial({ color: '#ffd27a', map: grainTex, roughness: 1 }));
    const digM = S.track(new T.MeshStandardMaterial({ color: '#c98a4b', map: grainTex, roughness: 1 }));
    const pebbleM = mat('#9a8f86', { roughness: 0.9 });

    // ---------- yard props ----------
    function digMound() {
      const g = new T.Group(), body = new T.Group(); g.add(body);
      const m = mesh(moundGeo, digM); m.scale.set(2.2, 1.5, 2.2); body.add(m);
      for (let k = 0; k < 4; k++) { const p = mesh(geo.sphereLo, pebbleM); const a = U.rand(0, 7), r = U.rand(0.8, 1.8); p.scale.set(0.22, 0.15, 0.2); p.position.set(Math.cos(a) * r, 0.9 * (1 - (r / 2.2) ** 2) + 0.1, Math.sin(a) * r); body.add(p); }
      g.userData.body = body; g.userData.amount = 1; g.userData.regrow = 0; return g;
    }
    const coneM = mat('#ff7b22', { roughness: 0.5 }), stripeM = mat('#ffffff', { roughness: 0.5 });
    function trafficCone() {
      const g = new T.Group();
      const c = mesh(geo.cone, coneM); c.scale.set(0.38, 1.1, 0.38); c.position.y = 0.6; g.add(c);
      const s = mesh(geo.cyl, stripeM); s.scale.set(0.24, 0.16, 0.24); s.position.y = 0.72; g.add(s);
      const b = mesh(geo.box, coneM); b.scale.set(0.9, 0.08, 0.9); b.position.y = 0.04; g.add(b);
      return g;
    }
    const barrelMs = ['#2a9df4', '#e63946', '#3fbf6a'].map(c => mat(c, { roughness: 0.5 }));
    function barrel() {
      const g = new T.Group();
      const b = mesh(geo.cyl, U.pick(barrelMs)); b.scale.set(0.5, 1.2, 0.5); b.position.y = 0.6; g.add(b);
      [0.3, 0.9].forEach(y => { const r = mesh(geo.cyl, mat('#d9dde3', { roughness: 0.5 })); r.scale.set(0.52, 0.06, 0.52); r.position.y = y; g.add(r); });
      return g;
    }
    const rockM = mat('#a39a92', { roughness: 0.9 });
    function boulder() {
      const g = new T.Group();
      for (let k = 0; k < 3; k++) { const r = mesh(geo.sphereLo, rockM); r.scale.set(U.rand(0.8, 1.4), U.rand(0.6, 1.0), U.rand(0.8, 1.3)); r.position.set(U.rand(-0.6, 0.6), 0.4, U.rand(-0.6, 0.6)); r.rotation.y = U.rand(0, 3); g.add(r); }
      return g;
    }
    const leafM = mat('#4caf50', { roughness: 0.8 }), trunkM = mat('#a0703f', { roughness: 0.9 });
    function palm() {
      const g = new T.Group();
      for (let k = 0; k < 6; k++) { const s = mesh(geo.cyl, trunkM); s.scale.set(0.28 - k * 0.02, 0.85, 0.28 - k * 0.02); s.position.set(k * 0.06, 0.42 + k * 0.8, 0); g.add(s); }
      for (let k = 0; k < 6; k++) { const l = mesh(geo.sphereLo, leafM); const a = k / 6 * Math.PI * 2; l.scale.set(1.5, 0.12, 0.45); l.position.set(0.36 + Math.cos(a) * 1.2, 4.8, Math.sin(a) * 1.2); l.rotation.set(0, -a, -0.35); g.add(l); }
      return g;
    }
    function bush() {
      const g = new T.Group();
      for (let k = 0; k < 3; k++) { const b = mesh(geo.sphereLo, mat('#7cb342', { roughness: 0.85 })); b.scale.setScalar(U.rand(0.45, 0.7)); b.position.set(U.rand(-0.5, 0.5), 0.4, U.rand(-0.5, 0.5)); g.add(b); }
      return g;
    }
    const world = Kit3D.scatter(S, [
      { make: digMound, count: 16, radius: 2.2, kind: 'dig' },
      { make: trafficCone, count: 18, radius: 0.5, kind: 'push' },
      { make: barrel, count: 10, radius: 0.6, kind: 'push' },
      { make: boulder, count: 10, radius: 1.3, kind: 'solid' },
      { make: palm, count: 10, radius: 0.6, kind: 'solid' },
      { make: bush, count: 20, radius: 0.7, kind: 'soft' },
    ], { area: 130, avoid: 9 });
    // one dig mound right in front, so the very first drive forward fills the bucket
    const firstDig = world.list.find(o => o.userData.kind === 'dig');
    firstDig.position.set(0, 0, 9);

    // ---------- the wheel loader ----------
    const L = buildLoader();
    scene.add(L.root);
    S.loader = L;   // for DevTools poking: __stage.loader
    S.hero = L.root;   // what the menu icon shows (tools/make-icons.js)

    function buildLoader() {
      const asset = Assets.get('bulldozer/bulldozer');
      const root = new T.Group();                  // faces +Z, sits on y = 0
      const body = new T.Group(); root.add(body);  // bounces / tilts
      const model = asset.scene.clone(true);
      model.rotation.y = Math.PI;                  // the file faces -Z
      body.add(model);

      // satin, toddler-bright materials (the file's white mirror shaders bloom badly)
      const yellow = mat('#ffbf1f', { roughness: 0.5, metalness: 0.1, envMapIntensity: 0.6 });
      const tyre = mat('#2b2b2e', { roughness: 0.9 });
      const glass = mat('#6fa8d6', { roughness: 0.3, metalness: 0, transparent: true, opacity: 0.55, envMapIntensity: 0.4 });
      const cache = {};
      model.traverse(n => {
        if (!n.isMesh) return;
        n.castShadow = true; n.receiveShadow = true;
        n.material = [].concat(n.material).map(m => {
          if (cache[m.uuid]) return cache[m.uuid];
          let c;
          if (/^freshnel shader(\.002)?$/.test(m.name) || m.name === 'Material.003') c = yellow;
          else if (m.name === 'black rough plastic') c = tyre;                     // tyres (no colour in the file)
          else if (m.name === 'clear_glass') c = glass;
          else {
            c = S.track(m.clone());
            if ('clearcoat' in c) c.clearcoat = 0;
            if (c.roughness < 0.45) c.roughness = 0.5;
            c.envMapIntensity = 0.6;
            if (c.emissive && c.emissive.getHex()) c.emissiveIntensity = 0.25;   // work lights: no big white bloom
          }
          return (cache[m.uuid] = c);
        });
        if (n.material.length === 1) n.material = n.material[0];
      });

      const get = name => model.getObjectByName(name);
      const arm = get('Plane010'), bucket = get('Plane016'), front = get('WGT-Bone');
      ['Cube005', 'Cylinder004'].forEach(k => { const o = get(k); if (o) o.visible = false; });   // bucket link rod (can't follow our hinge)
      model.updateMatrixWorld(true);

      // re-hinge the bucket at the arm tip (the "Armature" empty sits on the arm's tip pin)
      const tipW = get('Armature').getWorldPosition(new T.Vector3());
      const centreX = new T.Box3().setFromObject(get('Cube002')).getCenter(new T.Vector3()).x;
      arm.add(bucket);                                             // keeps its arm-relative pose (orientation is right)
      const tip = new T.Group(); tip.position.copy(arm.worldToLocal(tipW.clone()));
      arm.add(tip); arm.updateMatrixWorld(true);
      const bb = boxIn(bucket, tip);
      const lug = new T.Vector3((bb.min.x + bb.max.x) / 2, bb.min.y + (bb.max.y - bb.min.y) * 0.2, bb.max.z - 0.15);
      bucket.position.sub(lug);
      tip.attach(bucket);
      tip.position.x = arm.worldToLocal(new T.Vector3(centreX, tipW.y, tipW.z)).x;   // centre the bucket on the machine
      // bucket tilt (tip.rotation.x relative to the arm, + = curl back): resting flat, carrying, dumping
      const restCurl = 0.45, CARRY = 0.7, DUMP = -1.5;
      // markers in bucket space, measured in arm space (≈ machine axes, front = -Z) with the bucket posed
      const inTip = (x, y, z) => tip.worldToLocal(arm.localToWorld(new T.Vector3(x, y, z)));
      tip.rotation.x = restCurl; arm.updateMatrixWorld(true);
      let b = boxIn(bucket, arm);
      const lip = new T.Object3D(); lip.position.copy(inTip((b.min.x + b.max.x) / 2, b.min.y, b.min.z)); tip.add(lip);   // front cutting edge
      tip.rotation.x = restCurl + CARRY; arm.updateMatrixWorld(true);
      b = boxIn(bucket, arm);
      const bw = b.max.x - b.min.x, bd = b.max.z - b.min.z, bh = b.max.y - b.min.y;
      const load = mesh(moundGeo, pileM); tip.add(load);   // sand heap inside, upright while carrying
      load.position.copy(inTip((b.min.x + b.max.x) / 2, b.min.y + bh * 0.45, (b.min.z + b.max.z) / 2));
      load.rotation.x = -(restCurl + CARRY);
      const loadScale = new T.Vector3(bw * 0.4, bh * 0.45, bd * 0.4);
      load.scale.setScalar(0.001);
      tip.rotation.x = 0;

      // wheels: spin each axle mesh about its own centre (recentre geometry once; idempotent)
      const spinners = ['Plane012', 'Plane013', 'Plane015'].map(get).filter(Boolean);
      spinners.forEach(w => {
        w.geometry.computeBoundingBox();
        const c = w.geometry.boundingBox.getCenter(new T.Vector3()); c.x = 0;
        if (c.lengthSq() < 1e-8) return;
        w.geometry = w.geometry.clone(); S.track(w.geometry); w.geometry.translate(0, -c.y, -c.z);
        w.position.add(c);
        w.children.forEach(ch => ch.position.sub(c));
      });

      // lowered pose: rotate the arm about its hinge until the bucket rests on the ground
      root.updateMatrixWorld(true);
      const groundAt = () => { model.position.y = 0; model.updateMatrixWorld(true); return new T.Box3().setFromObject(model).min.y; };
      const floor = groundAt();
      const setArm = a => { arm.rotation.x = a; tip.rotation.x = -a + restCurl; model.updateMatrixWorld(true); };
      const bucketMin = () => new T.Box3().setFromObject(bucket).min.y;
      let lo = -1.6, hi = 0;
      for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; setArm(mid); if (bucketMin() < floor + 0.05) lo = mid; else hi = mid; }
      const armDown = hi, armUp = 0.05;
      setArm(armDown);

      // stand on y = 0 and scale to toy size (~6.5 long)
      const scale = 0.75;
      model.scale.setScalar(scale);
      model.position.y = -floor * scale;

      // beacon on the cab roof
      const roof = new T.Box3().setFromObject(get('Plane017') || model).max.y;
      const beaconM = S.track(new T.MeshStandardMaterial({ color: '#ffb347', emissive: '#ff8c00', emissiveIntensity: 0 }));
      const beacon = mesh(geo.sphere, beaconM); beacon.scale.setScalar(0.18); beacon.position.set(0, roof * scale - floor * scale + 0.15, -0.9); body.add(beacon);
      const beaconLight = new T.PointLight('#ff9500', 0, 12, 1.5); beaconLight.position.copy(beacon.position).add(new T.Vector3(0, 0.3, 0)); body.add(beaconLight);

      return { root, body, model, arm, tip, front, lip, load, loadScale, spinners, armDown, armUp, restCurl, CARRY, DUMP, setArm, beaconM, beaconLight, wheelR: 1.0 * scale };
    }
    function boxIn(obj, space) {   // bounding box of obj's geometry expressed in `space` coordinates
      const box = new T.Box3(), v = new T.Vector3(), inv = new T.Matrix4().copy(space.matrixWorld).invert(), m = new T.Matrix4();
      obj.updateMatrixWorld(true);
      obj.traverse(n => {
        if (!n.isMesh) return;
        m.multiplyMatrices(inv, n.matrixWorld);
        const p = n.geometry.attributes.position;
        for (let i = 0; i < p.count; i += 3) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(m));
      });
      return box;
    }

    // ---------- sand piles the child builds ----------
    const flagMs = ['#e63946', '#2a9df4', '#3fbf6a', '#b46cff'].map(c => mat(c, { roughness: 0.6, side: T.DoubleSide }));
    const piles = [];
    function pileSize(v) { return { r: 1.2 * Math.pow(v, 0.4), h: 0.6 * Math.pow(v, 0.75) }; }
    function newPile(x, z) {
      let p;
      if (piles.length < 30) {
        const g = new T.Group(), m = mesh(moundGeo, pileM); g.add(m);
        const flag = new T.Group(); flag.visible = false; g.add(flag);
        const pole = mesh(geo.cyl, mat('#f4f1ea')); pole.scale.set(0.04, 1.4, 0.04); pole.position.y = 0.7; flag.add(pole);
        const cloth = mesh(geo.box, flagMs[piles.length % 4]); cloth.scale.set(0.02, 0.4, 0.6); cloth.position.set(0, 1.2, 0.3); flag.add(cloth);
        scene.add(g);
        p = { g, m, flag, cloth, vol: 0, shown: 0, wob: 0 };
        piles.push(p);
      } else {   // recycle the pile farthest away
        p = piles.reduce((a, b) => (b.g.position.distanceTo(pos) > a.g.position.distanceTo(pos) ? b : a));
        p.vol = 0; p.shown = 0; p.flag.visible = false;
      }
      p.g.position.set(x, 0, z); p.g.visible = true;
      return p;
    }
    function pileAt(x, z) {
      let best = null, bd = Infinity;
      for (const p of piles) {
        if (!p.g.visible) continue;
        const d = Math.hypot(p.g.position.x - x, p.g.position.z - z), r = pileSize(Math.max(1, p.vol)).r;
        if (d < r + 1.2 && d < bd) { best = p; bd = d; }
      }
      return best;
    }
    function addSand(p, amount) {
      const before = p.vol;
      p.vol = Math.min(40, p.vol + amount); p.wob = 1;
      for (const step of [5, 10, 15, 20, 25, 30, 35, 40]) if (before < step && p.vol >= step) milestone(p, step);
    }
    function milestone(p, step) {
      const top = p.g.position.clone().setY(pileSize(p.vol).h + 0.4);
      if (step === 5) { p.flag.visible = true; sfx.chime(); }
      else { sfx.cheer(); }
      S.sparkle(top, '#fff3b0', 50, 5, { gravity: 4, glow: 1.6, spread: 0.6 });
      S.ring(p.g.position.clone().setY(0.1), '#ffe08a', pileSize(p.vol).r + 3, 0.8, 0.8);
      if (step >= 10) { const sp = S.toScreen(top); if (!sp.behind) api.fx.floatEmoji(sp.x, sp.y, U.pick(['⭐', '🌟', '✨']), { size: 70, life: 1.6 }); }
      if (step % 10 === 0) api.fx.confetti(api.w, api.h);
      input.rumble(0.5, 200);
    }

    // ---------- falling sand grains ----------
    const grainM = S.track(new T.MeshStandardMaterial({ color: '#f2c070', roughness: 1 }));
    const grains = Array.from({ length: 70 }, () => { const m = new T.Mesh(geo.sphereLo, grainM); m.visible = false; m.castShadow = false; scene.add(m); return { m, v: new T.Vector3(), life: 0 }; });
    let grainCursor = 0;
    function grain(p, v, size = 0.14) {
      const g = grains[grainCursor = (grainCursor + 1) % grains.length];
      g.m.position.copy(p); g.v.copy(v); g.life = 1.6; g.m.scale.setScalar(size * U.rand(0.7, 1.3)); g.m.visible = true;
    }

    // ---------- state ----------
    const pos = new T.Vector3();
    let yaw = 0, speed = 0, steer = 0, hopY = 0, vy = 0, air = false, squash = 0, tilt = 0, t = 0;
    let armUp = false, armA = 0, fill = 0, curl = 0, beaconOn = false, backupT = 0, scoopT = 0;
    let dump = null, shakeT = 0;
    const engine = sfx.engine();
    const fwd = () => new T.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const lipW = new T.Vector3();

    function doAction(b) {
      switch (b) {
        case 0:
          if (dump) break;
          if (fill > 0.05) { dump = { t: 0, amount: fill, poured: 0, pile: null }; sfx.servo(); }
          else { shakeT = 0.6; sfx.servo(); }
          break;
        case 1: sfx.horn(); S.ring(pos.clone().setY(0.1), '#ffe08a', 10, 0.8, 0.5); world.nudge(pos.x, pos.z, 10, 0.4); input.rumble(0.4, 300); break;
        case 2: beaconOn = !beaconOn; sfx.synth({ type: 'square', freq: beaconOn ? 880 : 520, dur: 0.12, vol: 0.12, cutoff: 3000 }); break;
        case 3: armUp = !armUp; sfx.servo(); break;
        case 4: case 5: if (!air) { air = true; vy = 6.5; sfx.boing(); } break;
      }
    }

    camera.position.set(5, 9, -9);

    return {
      resize: S.resize,
      update(dt) {
        t += dt;
        for (const b of input.pressed) doAction(b);

        // driving (a bit slower than the tractor: it's a big machine)
        let throttle = -input.y;
        if (input.down.has(7)) throttle = 1;
        if (input.down.has(6)) throttle = -1;
        const target = (throttle > 0 ? throttle * 8 : throttle * 4.5) * CONFIG.stickSpeed;
        speed = U.lerp(speed, target, Math.min(1, dt * (Math.abs(target) > Math.abs(speed) ? 1.3 : 2.5)));
        steer = U.lerp(steer, input.x, Math.min(1, dt * 5));
        const dir = speed >= -0.1 ? 1 : -1;
        yaw -= steer * 1.5 * dt * dir * U.clamp(Math.abs(speed) / 3, 0.4, 1);
        const f = fwd();
        pos.addScaledVector(f, speed * dt);

        // backup alarm
        if (speed < -0.6) { backupT -= dt; if (backupT <= 0) { backupT = 0.55; sfx.synth({ type: 'square', freq: 1050, dur: 0.22, vol: 0.08, cutoff: 3000, attack: 0.01 }); } }
        else backupT = 0;

        // collisions with props
        world.list.forEach(o => {
          const u = o.userData, k = u.kind;
          const dx = o.position.x - pos.x, dz = o.position.z - pos.z, d = Math.hypot(dx, dz);
          const min = k === 'dig' ? (u.regrow > 0 ? 0 : u.r * o.userData.body.scale.x * 0.6 + 2.4) : u.r + 2.0;
          if (d >= min || d < 0.001) return;
          const nx = dx / d, nz = dz / d, push = min - d;
          if (k === 'dig') { pos.x -= nx * push; pos.z -= nz * push; speed *= 0.8; }
          else if (k === 'solid') { pos.x -= nx * push; pos.z -= nz * push; speed *= 0.6; if (u.wob < 0.3) { u.wob = 0.6; sfx.boop(); input.rumble(0.3, 80); } }
          else if (k === 'push') { o.position.x += nx * push; o.position.z += nz * push; u.wob = Math.max(u.wob, 0.5); }
          else if (u.wob < 0.2) u.wob = 0.8;
        });
        // the child's piles are soft: the loader slides around them and they wobble (never knocked down)
        piles.forEach(p => {
          if (!p.g.visible || p.vol < 1) return;
          const dx = p.g.position.x - pos.x, dz = p.g.position.z - pos.z, d = Math.hypot(dx, dz), min = pileSize(p.vol).r * 0.7 + 1.6;
          if (d >= min || d < 0.001) return;
          pos.x -= dx / d * (min - d); pos.z -= dz / d * (min - d); speed *= 0.85; p.wob = Math.max(p.wob, 0.3);
        });

        // hop
        if (air) { hopY += vy * dt; vy -= 22 * dt; if (hopY <= 0) { hopY = 0; air = false; squash = 1; sfx.stomp(); S.shake(0.12); input.rumble(0.5, 120); S.sparkle(pos.clone().setY(0.3), '#e0b878', 24, 4, { gravity: 6, glow: 1.0, spread: 1.5 }); world.nudge(pos.x, pos.z, 5, 0.6); } }
        else tilt = U.lerp(tilt, -speed * 0.005 + (speed - target) * 0.008, dt * 4);
        squash = Math.max(0, squash - dt * 4);
        const sq = Math.sin(squash * Math.PI) * 0.12;
        L.root.position.copy(pos); L.root.rotation.y = yaw;
        L.body.position.y = hopY + Math.sin(t * 20) * 0.012 + Math.abs(Math.sin(t * 8)) * 0.03 * Math.min(1, Math.abs(speed) / 4);
        L.body.rotation.x = tilt; L.body.scale.set(1 + sq, 1 - sq, 1 + sq);
        L.front.rotation.y = -steer * 0.35;   // articulated steering: the front half bends into the turn
        L.spinners.forEach(w => w.rotation.x -= speed * dt / L.wheelR);

        // arm + bucket pose
        let armGoal = armUp ? 1 : 0, curlGoal = fill > 0.05 ? L.CARRY : 0;
        if (dump) {
          dump.t += dt;
          const p = dump.t;
          armGoal = Math.max(armGoal, 0.55);
          curlGoal = p < 0.35 ? L.CARRY : p < 1.5 ? L.DUMP : 0;
          if (p > 0.55 && p < 1.5) {   // pour
            L.lip.getWorldPosition(lipW);
            const share = Math.min(dump.amount - dump.poured, dt * dump.amount / 0.85);
            dump.poured += share; fill = Math.max(0, dump.amount - dump.poured);
            if (!dump.pile) dump.pile = pileAt(lipW.x, lipW.z) || newPile(lipW.x + f.x * 0.4, lipW.z + f.z * 0.4);
            addSand(dump.pile, share * 2);
            for (let k = 0; k < 3; k++) grain(lipW.clone().add(new T.Vector3(U.rand(-0.6, 0.6), 0, U.rand(-0.2, 0.2)).applyAxisAngle(new T.Vector3(0, 1, 0), yaw)), new T.Vector3(U.rand(-0.4, 0.4), U.rand(-1, 0.5), U.rand(-0.4, 0.4)).addScaledVector(f, 0.8));
            if (Math.random() < dt * 8) sfx.whoosh();
            input.rumble(0.15, 60);
          }
          if (p >= 1.9) dump = null;
        }
        if (shakeT > 0) {
          shakeT -= dt;
          curlGoal = Math.sin(shakeT * 40) * 0.35;
          if (Math.random() < dt * 20) { L.lip.getWorldPosition(lipW); grain(lipW, new T.Vector3(U.rand(-1, 1), U.rand(1, 2.5), U.rand(-1, 1)), 0.07); }
        }
        armA = U.lerp(armA, armGoal, Math.min(1, dt * 2.6));
        curl = U.lerp(curl, curlGoal, Math.min(1, dt * (shakeT > 0 ? 30 : 4)));
        const armAngle = U.lerp(L.armDown, L.armUp, armA);
        L.arm.rotation.x = armAngle; L.tip.rotation.x = -armAngle + L.restCurl + curl;
        L.load.scale.copy(L.loadScale).multiplyScalar(Math.max(0.001, fill));
        L.load.visible = fill > 0.02;

        // scooping: bucket low + lip touching a dig mound fills the bucket
        L.root.updateMatrixWorld(true);
        L.lip.getWorldPosition(lipW);
        world.list.forEach(o => {
          const u = o.userData; if (u.kind !== 'dig') return;
          if (u.regrow > 0) { u.regrow -= dt; if (u.regrow <= 0) { u.amount = 1; u.body.scale.setScalar(0.01); u.wob = 0.8; S.sparkle(o.position.clone().setY(1), '#ffe6a8', 20, 3, { glow: 1.0, spread: 1.5 }); } return; }
          u.body.scale.setScalar(U.lerp(u.body.scale.x, 0.35 + 0.65 * u.amount, Math.min(1, dt * 6)));
          if (dump || armA > 0.45 || fill >= 1) return;
          const d = Math.hypot(o.position.x - lipW.x, o.position.z - lipW.z);
          if (d > 2.2 * u.body.scale.x + 0.6) return;
          const before = fill;
          fill = Math.min(1, fill + dt * 1.6);
          u.amount -= (fill - before) * 0.34; u.wob = Math.max(u.wob, 0.35);
          scoopT -= dt;
          if (scoopT <= 0) { scoopT = 0.18; sfx.synth({ type: 'sawtooth', freq: U.rand(90, 130), slideTo: 60, dur: 0.18, vol: 0.12, cutoff: 500 }); }
          if (Math.random() < 0.6) grain(lipW.clone().setY(0.5), new T.Vector3(U.rand(-1.5, 1.5), U.rand(2, 4), U.rand(-1.5, 1.5)), 0.1);
          input.rumble(0.25, 50);
          if (fill >= 1 && before < 1) { sfx.pop(); sfx.sparkle(); S.sparkle(lipW.clone().setY(1.6), '#fff1b8', 24, 3, { glow: 1.3, spread: 0.8 }); }
          if (u.amount <= 0.05) { u.regrow = 6; u.body.scale.setScalar(0.001); sfx.pop(); }
        });

        // piles: ease toward their size, wobble when they grow
        piles.forEach(p => {
          if (!p.g.visible) return;
          p.shown = U.lerp(p.shown, p.vol, Math.min(1, dt * 5));
          p.wob *= Math.pow(0.03, dt);
          const s = pileSize(Math.max(0.05, p.shown)), k = Math.sin(t * 18) * p.wob * 0.08;
          p.m.scale.set(s.r * (1 - k), s.h * (1 + k * 1.5), s.r * (1 - k));
          p.flag.position.y = s.h * (1 + k * 1.5) - 0.1;
          p.cloth.rotation.y = Math.sin(t * 6 + p.g.position.x) * 0.3;
        });

        // grains fall and land
        grains.forEach(g => {
          if (g.life <= 0) return;
          g.life -= dt; g.v.y -= 16 * dt; g.m.position.addScaledVector(g.v, dt);
          if (g.m.position.y < 0.05 || g.life <= 0) { g.life = 0; g.m.visible = false; }
        });

        // beacon
        const flash = beaconOn ? (Math.sin(t * 10) > 0 ? 1 : 0.15) : 0;
        L.beaconM.emissiveIntensity = flash * 4; L.beaconLight.intensity = flash * 6;

        engine.set(Math.abs(speed) / 8 + (dump ? 0.3 : 0) + Math.abs(armA - armGoal) * 0.3);
        world.update(pos.x, pos.z, dt);
        ground.follow(pos.x, pos.z);
        sun.follow(pos.x, pos.z);

        // chase camera
        // three-quarter chase view from behind-left, high enough to see the bucket and the sand in it
        const camGoal = pos.clone().addScaledVector(f, -8).add(new T.Vector3(f.z * 4.5, 7.8, -f.x * 4.5));
        camera.position.lerp(camGoal, Math.min(1, dt * 2.5));
        camera.lookAt(pos.x + f.x * 3.5, 0.8 + hopY * 0.4, pos.z + f.z * 3.5);
        skyDome.position.copy(camera.position);
        S.update(dt);
      },
      draw(ctx) {
        S.render();
        ctx.clearRect(0, 0, api.w, api.h);
        if (CONFIG.showGuides) Kit3D.drawGuide(ctx, api, { 0: '⛰️', 1: '📯', 2: '🚨', 3: '🏗️', 4: '🦘', 5: '🦘', 6: '⏪', 7: '⏩', stick: '🚜' }, 0.8);
      },
      destroy() { engine.stop(); S.destroy(); },
    };
  },
});
