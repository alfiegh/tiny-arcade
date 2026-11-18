// TRACTOR FARM (3D) — drive a tractor around an endless farm.
//
//   Stick up / down : drive forward / reverse      Stick left / right : steer
//   ZR (hold)       : go forward                   ZL (hold) : reverse
//   A (bottom)      : jump                          B (right) : beep-beep horn
//   Y (left)        : lights on/off (turns the farm to sunset)
//   X (top)         : raise / lower the front bucket (carrying a hay bale: tip it out)
//   L / R           : left / right blinkers
//
// Cows, sheep and chickens hop and call out when you beep or drive close.
// Drive into a hay bale with the bucket down to scoop it up; X tips it out. Drop it on another bale to build a stack.
// Pumpkins get pushed around; trees, rocks, barns and windmills are solid.
Games.register({
  id: 'tractor', name: 'Tractor Farm', emoji: '🚜', color: '#e63946',
  create(api) {
    const { input, sfx } = api;
    const DAY_FOG = new THREE.Color('#cdeeff'), DUSK_FOG = new THREE.Color('#6d5d8e');
    const S = Kit3D.stage(api, { fog: ['#cdeeff', 36, 66], bloom: [0.55, 0.6, 1.2], exposure: 1.0, fov: 50, envIntensity: 0.55 });
    const { T, scene, camera, geo, mat, mesh } = S;

    const skyDome = Kit3D.sky(S, '#3b9be8', '#cdeeff', '#cdeeff', { sunDir: new T.Vector3(0.45, 0.45, -0.75) });
    const SKY = { dayTop: new T.Color('#3b9be8'), dayMid: new T.Color('#cdeeff'), duskTop: new T.Color('#1b1f52'), duskMid: new T.Color('#ff9a6a') };
    const hemi = new T.HemisphereLight('#d4f1ff', '#6b8a3a', 0.9); scene.add(hemi);
    const sun = Kit3D.sun(S, { intensity: 2.1, offset: [10, 20, 8], size: 24 });
    const SUN_DAY = new T.Color('#fff4dc'), SUN_DUSK = new T.Color('#ff8a50');

    // ---------- ground ----------
    const grassTex = S.canvasTex(512, (g, s) => {
      g.fillStyle = '#7cc653'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 30; i++) { g.fillStyle = `hsla(${U.rand(70, 100)},45%,${U.rand(40, 55)}%,.35)`; g.beginPath(); g.arc(U.rand(0, s), U.rand(0, s), U.rand(30, 100), 0, 7); g.fill(); }
      for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(150,110,70,.18)'; g.beginPath(); g.ellipse(U.rand(0, s), U.rand(0, s), U.rand(20, 60), U.rand(10, 30), U.rand(0, 3), 0, 7); g.fill(); }
      for (let i = 0; i < 8000; i++) { g.fillStyle = `hsl(${U.rand(70, 115)} ${U.rand(35, 60)}% ${U.rand(35, 60)}%)`; g.fillRect(U.rand(0, s), U.rand(0, s), 2, U.rand(3, 7)); }
    });
    const ground = Kit3D.infiniteGround(S, grassTex, { tile: 10 });

    // ---------- farm props ----------
    const red = mat('#d62828', { roughness: 0.6 }), white = mat('#f4f1ea', { roughness: 0.7 }), roofM = mat('#5b4636', { roughness: 0.8 });
    // trees, rocks, bushes and grass from the Simple Nature pack (Quaternius, app/assets/nature)
    const nat = (name, o) => Kit3D.prop(S, 'nature/nature', name, o);
    function tree() { return nat(U.pick(['Tree1', 'Tree2', 'Tree3', 'Tree4']), { height: U.rand(4.5, 6.5) }); }
    function rock() { return nat(U.pick(['Rock1', 'Rock2', 'Rock3']), { height: U.rand(0.9, 1.5) }); }
    function bush() { return nat(U.pick(['Bush1', 'Bush2', 'Bush3']), { height: U.rand(1, 1.5) }); }
    function grass() { return nat(U.pick(['Grass1', 'Grass2', 'Grass3']), { height: U.rand(0.5, 0.8) }); }
    function barn() {
      const g = new T.Group();
      const b = mesh(geo.box, red); b.scale.set(5, 3.6, 6); b.position.y = 1.8; g.add(b);
      const roof = mesh(S.track(new T.CylinderGeometry(3.3, 3.3, 6.4, 3, 1)), roofM); roof.rotation.set(Math.PI / 2, 0, Math.PI / 2); roof.scale.set(1, 1, 0.6); roof.position.y = 4.4; g.add(roof);
      const door = mesh(geo.box, white); door.scale.set(2.2, 2.6, 0.1); door.position.set(0, 1.3, 3.02); g.add(door);
      [[1, 1], [1, -1]].forEach(([, d]) => { const x = mesh(geo.box, red); x.scale.set(0.15, 3.3, 0.08); x.position.set(0, 1.3, 3.08); x.rotation.z = d * 0.66; g.add(x); });
      return g;
    }
    function windmill() {
      const g = new T.Group();
      const tower = mesh(S.track(new T.CylinderGeometry(0.5, 1.1, 7, 12)), white); tower.position.y = 3.5; g.add(tower);
      const cap = mesh(geo.cone, red); cap.scale.set(0.9, 1.1, 0.9); cap.position.y = 7.5; g.add(cap);
      const hub = new T.Group(); hub.position.set(0, 6.6, 0.9); g.add(hub);
      for (let k = 0; k < 4; k++) { const bl = mesh(geo.box, mat('#f7e6c4')); bl.scale.set(0.5, 3.2, 0.08); bl.position.y = 1.7; const p = new T.Group(); p.rotation.z = k * Math.PI / 2; p.add(bl); hub.add(p); }
      g.userData.spin = hub; return g;
    }
    const hayTex = S.canvasTex(128, (g, s) => { g.fillStyle = '#e8c35a'; g.fillRect(0, 0, s, s); for (let i = 0; i < 400; i++) { g.strokeStyle = `rgba(${U.randInt(150, 200)},${U.randInt(110, 150)},40,.5)`; g.beginPath(); const x = U.rand(0, s), y = U.rand(0, s); g.moveTo(x, y); g.lineTo(x + U.rand(-10, 10), y + U.rand(-3, 3)); g.stroke(); } });
    const hayM = S.track(new T.MeshStandardMaterial({ map: hayTex, roughness: 1 }));
    function hay() { const g = new T.Group(); g.userData.hay = true; const h = mesh(geo.cyl, hayM); h.scale.set(1, 1.3, 1); h.rotation.z = Math.PI / 2; h.position.y = 1; g.add(h); return g; }
    const pumpM = mat('#ff8c1a', { roughness: 0.5 });
    function pumpkin() { const g = new T.Group(); const p = mesh(geo.sphere, pumpM); p.scale.set(0.6, 0.45, 0.6); p.position.y = 0.42; g.add(p); const st = mesh(geo.cyl, mat('#3f7a2a')); st.scale.set(0.06, 0.25, 0.06); st.position.y = 0.92; g.add(st); g.scale.setScalar(U.rand(0.8, 1.4)); return g; }
    const flowerHead = mat('#ffd23f', { roughness: 0.6 }), flowerMid = mat('#6b3f1f');
    function sunflowers() {
      const g = new T.Group();
      for (let k = 0; k < 4; k++) {
        const x = U.rand(-0.7, 0.7), z = U.rand(-0.7, 0.7), h = U.rand(1.2, 1.8);
        const st = mesh(geo.cyl, mat('#3f9b3f'), { shadow: false }); st.scale.set(0.04, h, 0.04); st.position.set(x, h / 2, z); g.add(st);
        const hd = mesh(geo.cyl, flowerHead); hd.scale.set(0.32, 0.05, 0.32); hd.rotation.x = 1.2; hd.position.set(x, h, z + 0.05); g.add(hd);
        const md = mesh(geo.cyl, flowerMid); md.scale.set(0.15, 0.06, 0.15); md.rotation.x = 1.2; md.position.set(x, h + 0.02, z + 0.09); g.add(md);
      }
      return g;
    }
    function fence() {
      const g = new T.Group(); const wm = mat('#c9a27a', { roughness: 0.9 });
      for (let k = 0; k < 4; k++) { const p = mesh(geo.box, wm); p.scale.set(0.15, 1.1, 0.15); p.position.set(-2.25 + k * 1.5, 0.55, 0); g.add(p); }
      [0.4, 0.85].forEach(y => { const r = mesh(geo.box, wm); r.scale.set(4.8, 0.12, 0.08); r.position.y = y; g.add(r); });
      return g;
    }
    // animals
    const cowTex = S.canvasTex(256, (g, s) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s); for (let i = 0; i < 10; i++) { g.fillStyle = '#26221f'; g.beginPath(); g.ellipse(U.rand(0, s), U.rand(0, s), U.rand(15, 35), U.rand(12, 28), U.rand(0, 3), 0, 7); g.fill(); } });
    const cowM = S.track(new T.MeshStandardMaterial({ map: cowTex, roughness: 0.7 })), pinkM = mat('#ffb3c1', { roughness: 0.6 }), darkM = mat('#2b2522'), legM = mat('#efe9df');
    function eyes(head, s, z, y = 0.1) { [-1, 1].forEach(sd => { const e = Kit3D.eye(S, s, sd); e.position.set(sd * s * 1.4, y, z); head.add(e); }); }
    function cow() {
      const g = new T.Group(), body = new T.Group(); g.add(body);
      const b = mesh(geo.sphere, cowM); b.scale.set(0.75, 0.7, 1.15); b.position.y = 1.15; body.add(b);
      const head = new T.Group(); head.position.set(0, 1.55, 1.1); body.add(head);
      const h = mesh(geo.sphere, cowM); h.scale.set(0.42, 0.42, 0.48); head.add(h);
      const sn = mesh(geo.sphere, pinkM); sn.scale.set(0.34, 0.25, 0.22); sn.position.set(0, -0.15, 0.38); head.add(sn);
      [-1, 1].forEach(sd => { const ear = mesh(geo.sphereLo, cowM); ear.scale.set(0.2, 0.08, 0.12); ear.position.set(sd * 0.45, 0.18, -0.05); head.add(ear); const horn = mesh(geo.cone, mat('#f6e7c1')); horn.scale.set(0.06, 0.2, 0.06); horn.position.set(sd * 0.22, 0.42, -0.05); head.add(horn); });
      eyes(head, 0.1, 0.38, 0.12);
      [[-0.4, 0.6], [0.4, 0.6], [-0.4, -0.6], [0.4, -0.6]].forEach(([x, z]) => { const l = mesh(geo.cyl, legM); l.scale.set(0.12, 0.8, 0.12); l.position.set(x, 0.4, z); body.add(l); });
      g.userData.head = head; g.userData.body = body; return g;
    }
    const woolM = mat('#fbf8f2', { roughness: 1 });
    function sheep() {
      const g = new T.Group(), body = new T.Group(); g.add(body);
      for (let k = 0; k < 8; k++) { const w = mesh(geo.sphereLo, woolM); w.scale.setScalar(U.rand(0.38, 0.5)); w.position.set(U.rand(-0.35, 0.35), 0.95 + U.rand(-0.15, 0.2), U.rand(-0.5, 0.5)); body.add(w); }
      const head = new T.Group(); head.position.set(0, 1.15, 0.75); body.add(head);
      const h = mesh(geo.sphere, darkM); h.scale.set(0.26, 0.3, 0.32); head.add(h);
      const tuft = mesh(geo.sphereLo, woolM); tuft.scale.setScalar(0.2); tuft.position.set(0, 0.25, 0); head.add(tuft);
      eyes(head, 0.08, 0.26, 0.06);
      [[-0.25, 0.35], [0.25, 0.35], [-0.25, -0.35], [0.25, -0.35]].forEach(([x, z]) => { const l = mesh(geo.cyl, darkM); l.scale.set(0.07, 0.6, 0.07); l.position.set(x, 0.3, z); body.add(l); });
      g.userData.head = head; g.userData.body = body; return g;
    }
    function chicken() {
      const g = new T.Group(), body = new T.Group(); g.add(body);
      const b = mesh(geo.sphere, mat('#ffffff', { roughness: 0.7 })); b.scale.set(0.3, 0.3, 0.36); b.position.y = 0.5; body.add(b);
      const head = new T.Group(); head.position.set(0, 0.85, 0.2); body.add(head);
      const h = mesh(geo.sphere, mat('#ffffff', { roughness: 0.7 })); h.scale.setScalar(0.17); head.add(h);
      const comb = mesh(geo.sphereLo, mat('#e63946')); comb.scale.set(0.04, 0.09, 0.1); comb.position.y = 0.17; head.add(comb);
      const beak = mesh(geo.cone, mat('#ffb703')); beak.scale.set(0.05, 0.12, 0.05); beak.rotation.x = Math.PI / 2; beak.position.set(0, -0.02, 0.2); head.add(beak);
      eyes(head, 0.045, 0.13, 0.04);
      [-0.1, 0.1].forEach(x => { const l = mesh(geo.cyl, mat('#ffb703')); l.scale.set(0.025, 0.3, 0.025); l.position.set(x, 0.15, 0); body.add(l); });
      g.userData.head = head; g.userData.body = body; return g;
    }

    const world = Kit3D.scatter(S, [
      { make: tree, count: 22, radius: 1.1, kind: 'solid' },
      { make: rock, count: 10, radius: 1.1, kind: 'solid' },
      { make: bush, count: 18, radius: 0.8, kind: 'soft' },
      { make: grass, count: 40, radius: 0.4, kind: 'soft' },
      { make: barn, count: 3, radius: 4.2, kind: 'solid' },
      { make: windmill, count: 3, radius: 1.3, kind: 'solid' },
      { make: hay, count: 14, radius: 1.3, kind: 'push' },
      { make: pumpkin, count: 18, radius: 0.6, kind: 'push' },
      { make: sunflowers, count: 26, radius: 0.8, kind: 'soft' },
      { make: fence, count: 12, radius: 0.9, kind: 'soft' },
      { make: cow, count: 9, radius: 1.2, kind: 'cow' },
      { make: sheep, count: 10, radius: 0.9, kind: 'sheep' },
      { make: chicken, count: 12, radius: 0.5, kind: 'chicken' },
    ], { area: 130, avoid: 8 });
    const ANIMAL = { cow: 'moo', sheep: 'baa', chicken: 'cluck' };
    world.list.forEach(o => { if (ANIMAL[o.userData.kind]) Object.assign(o.userData, { hop: 0, vy: 0, call: 0, ph: Math.random() * 6 }); });

    // ---------- the tractor (faces +Z) ----------
    const tractor = new T.Group(); scene.add(tractor);
    const chassis = new T.Group(); tractor.add(chassis);
    // satin paint: glossy clearcoat on big flat panels mirrors the bright studio-light environment and blooms
    const paint = mat('#e63946', { roughness: 0.5, metalness: 0.05, envMapIntensity: 0.6 });
    const black = mat('#222226', { roughness: 0.5 }), rubber = mat('#1b1b1e', { roughness: 0.95 }), yellow = mat('#ffcc29', { roughness: 0.5, metalness: 0.1, envMapIntensity: 0.6 }), chrome = mat('#c9ced8', { metalness: 1, roughness: 0.4, envMapIntensity: 0.5 });
    const add = (parent, g, m, p, s, r) => { const x = mesh(g, m); x.position.set(...p); if (s) x.scale.set(...s); if (r) x.rotation.set(...r); parent.add(x); return x; };
    add(chassis, geo.box, paint, [0, 1.05, 0], [1.4, 0.5, 3.4]);
    add(chassis, geo.box, paint, [0, 1.6, 0.95], [1.25, 0.95, 1.8]);
    add(chassis, geo.box, black, [0, 1.55, 1.87], [1.0, 0.7, 0.06]);
    for (let k = 0; k < 5; k++) add(chassis, geo.box, chrome, [0, 1.3 + k * 0.12, 1.91], [0.9, 0.03, 0.03]);
    // cabin
    [[0.68, -1.4], [-0.68, -1.4], [0.68, 0.05], [-0.68, 0.05]].forEach(([x, z]) => add(chassis, geo.box, black, [x, 2.15, z], [0.09, 1.9, 0.09]));
    add(chassis, geo.box, paint, [0, 3.12, -0.67], [1.65, 0.14, 1.8]);
    const glass = mat('#bfe6ff', { roughness: 0.25, transparent: true, opacity: 0.2, metalness: 0, envMapIntensity: 0.3 });
    add(chassis, geo.box, glass, [0, 2.15, 0.05], [1.3, 1.8, 0.03], null).castShadow = false;
    add(chassis, geo.box, glass, [0, 2.15, -1.4], [1.3, 1.8, 0.03], null).castShadow = false;
    add(chassis, geo.box, black, [0, 1.45, -0.7], [0.6, 0.2, 0.6]);           // seat
    // the farmer
    const farmer = new T.Group(); farmer.position.set(0, 2.25, -0.65); chassis.add(farmer);
    add(farmer, geo.sphere, mat('#3a7bd5'), [0, -0.35, 0], [0.32, 0.4, 0.26]);
    add(farmer, geo.sphere, mat('#f2c39b', { roughness: 0.6 }), [0, 0.15, 0], [0.26, 0.27, 0.26]);
    [-1, 1].forEach(s => { const e = Kit3D.eye(S, 0.06, s); e.position.set(s * 0.09, 0.2, 0.22); farmer.add(e); });
    add(farmer, geo.cyl, mat('#e9c46a', { roughness: 0.8 }), [0, 0.38, 0], [0.42, 0.03, 0.42]);
    add(farmer, geo.cyl, mat('#e9c46a', { roughness: 0.8 }), [0, 0.47, 0], [0.2, 0.18, 0.2]);
    // exhaust
    add(chassis, geo.cyl, black, [0.42, 2.6, 1.35], [0.08, 1.3, 0.08]);
    add(chassis, geo.cyl, chrome, [0.42, 3.25, 1.35], [0.1, 0.08, 0.1]);
    // fenders
    [-1, 1].forEach(s => add(chassis, geo.box, paint, [s * 1.05, 2.05, -0.9], [0.8, 0.1, 1.9]));
    // lights
    const headM = S.track(new T.MeshStandardMaterial({ color: '#fffbe8', emissive: '#fff4c2', emissiveIntensity: 0.2 }));
    [-1, 1].forEach(s => add(chassis, geo.cyl, headM, [s * 0.42, 1.85, 1.86], [0.16, 0.06, 0.16], [Math.PI / 2, 0, 0]));
    [-1, 1].forEach(s => add(chassis, geo.box, headM, [s * 0.5, 3.12, 0.25], [0.3, 0.14, 0.08]));
    const beaconM = S.track(new T.MeshStandardMaterial({ color: '#ffb347', emissive: '#ff8c00', emissiveIntensity: 0, transparent: true, opacity: 0.9 }));
    add(chassis, geo.sphere, beaconM, [0, 3.28, -0.67], [0.18, 0.18, 0.18]);
    const blinkM = [-1, 1].map(() => S.track(new T.MeshStandardMaterial({ color: '#ffb347', emissive: '#ff9500', emissiveIntensity: 0 })));
    // blinkM[0] = right (-X), blinkM[1] = left (+X)
    [-1, 1].forEach((s, i) => { add(chassis, geo.sphereLo, blinkM[i], [s * 0.8, 3.12, 0.12], [0.1, 0.08, 0.1]); add(chassis, geo.sphereLo, blinkM[i], [s * 1.35, 2.1, -1.8], [0.1, 0.08, 0.1]); });
    const beams = [-1, 1].map(s => {
      const l = new T.SpotLight('#fff1c9', 0, 40, 0.42, 0.5, 1.2);
      l.position.set(s * 0.42, 1.85, 2); chassis.add(l);
      const tg = new T.Object3D(); tg.position.set(s * 0.6, 0, 14); chassis.add(tg); l.target = tg;
      return l;
    });
    const beaconLight = new T.PointLight('#ff9500', 0, 12, 1.5); beaconLight.position.set(0, 3.5, -0.67); chassis.add(beaconLight);
    // wheels
    function wheel(r, w, hub) {
      const g = new T.Group(), spin = new T.Group(); g.add(spin);
      add(spin, geo.cyl, rubber, [0, 0, 0], [r, w, r], [0, 0, Math.PI / 2]);
      add(spin, geo.cyl, yellow, [0, 0, 0], [r * hub, w * 1.04, r * hub], [0, 0, Math.PI / 2]);
      add(spin, geo.cyl, chrome, [0, 0, 0], [r * 0.18, w * 1.08, r * 0.18], [0, 0, Math.PI / 2]);
      const lugs = Math.round(r * 14);
      for (let k = 0; k < lugs; k++) { const a = k / lugs * Math.PI * 2; add(spin, geo.box, rubber, [0, Math.cos(a) * r, Math.sin(a) * r], [w * 0.9, 0.12, 0.2], [a, 0, 0]); }
      return { g, spin, r };
    }
    const rear = [-1, 1].map(s => { const w = wheel(1.05, 0.7, 0.55); w.g.position.set(s * 1.05, 1.05, -0.9); chassis.add(w.g); return w; });
    const front = [-1, 1].map(s => { const w = wheel(0.6, 0.42, 0.55); w.g.position.set(s * 0.85, 0.6, 1.35); chassis.add(w.g); return w; });
    // front loader bucket
    const loader = new T.Group(); loader.position.set(0, 1.55, 0.6); chassis.add(loader);
    [-1, 1].forEach(s => add(loader, geo.box, yellow, [s * 0.82, -0.5, 1.25], [0.12, 0.14, 2.75], [0.38, 0, 0]));
    const bucket = new T.Group(); bucket.position.set(0, -1.0, 2.55); loader.add(bucket);
    add(bucket, geo.box, yellow, [0, 0, -0.25], [1.9, 0.7, 0.08]);
    add(bucket, geo.box, yellow, [0, -0.33, 0.05], [1.9, 0.08, 0.65]);
    [-1, 1].forEach(s => add(bucket, geo.box, yellow, [s * 0.94, 0, 0.05], [0.06, 0.7, 0.65]));

    // smoke puffs (soft grey, not glowing)
    const smoke = Array.from({ length: 24 }, () => { const m = new T.Mesh(geo.sphereLo, S.track(new T.MeshStandardMaterial({ color: '#8f8f96', roughness: 1, transparent: true, opacity: 0, depthWrite: false }))); m.visible = false; scene.add(m); return { m, life: 0 }; });
    let smokeCursor = 0, smokeTimer = 0;
    function puff(strength = 1) {
      const s = smoke[smokeCursor = (smokeCursor + 1) % smoke.length];
      const p = new T.Vector3(0.42, 3.4, 1.35).applyMatrix4(chassis.matrixWorld);
      s.m.position.copy(p); s.life = 1; s.strength = strength; s.m.visible = true;
    }

    // tyre tracks
    const tyreTex = S.canvasTex(64, (g, s) => { g.fillStyle = '#fff'; for (let k = 0; k < 4; k++) g.fillRect(4, k * 16 + 2, s - 8, 9); }, { clamp: true, srgb: false });
    const tracks = Kit3D.decals(S, tyreTex, { count: 240, size: [0.6, 0.6], opacity: 0.3 });

    // ---------- state ----------
    const pos = new T.Vector3();
    let yaw = 0, speed = 0, steer = 0, jumpY = 0, vy = 0, air = false, squash = 0, tilt = 0;
    let lights = false, night = 0, bucketUp = false, bucketA = 0, blink = { side: 0, t: 0 }, odo = 0, t = 0, hornT = 0;
    const engine = sfx.engine();
    const fwd = () => new T.Vector3(Math.sin(yaw), 0, Math.cos(yaw));

    function animalsReact(radius, all = false) {
      let calls = 0;
      world.list.forEach(o => {
        const u = o.userData; if (!ANIMAL[u.kind]) return;
        const d = o.position.distanceTo(pos);
        if (d < radius && u.hop <= 0) {
          u.hop = 1; u.vy = U.rand(4, 6);
          if ((all ? calls < 3 : calls < 1) && u.call <= 0) { sfx[ANIMAL[u.kind]](); u.call = 2.5; calls++; const sp = S.toScreen(o.position.clone().setY(2.5)); if (!sp.behind) api.fx.floatEmoji(sp.x, sp.y, U.pick(['❤️', '🎵', '💛']), { size: 44, life: 1.2 }); }
        }
      });
    }

    function doAction(b) {
      switch (b) {
        case 0: if (!air) { air = true; vy = 8.5; sfx.boing(); puff(2); } break;
        case 1: sfx.horn(); hornT = 0.6; S.ring(pos.clone().setY(0.1), '#ffe08a', 10, 0.8, 0.5); animalsReact(16, true); input.rumble(0.4, 300); break;
        case 2: lights = !lights; sfx.tick(); sfx.synth({ type: 'square', freq: lights ? 880 : 520, dur: 0.12, vol: 0.12, cutoff: 3000 }); break;
        case 3: if (carry) dropBale(); else { bucketUp = !bucketUp; sfx.servo(); } break;
        case 4: blink = { side: blink.side === 1 ? 0 : 1, t: 5 }; break;
        case 5: blink = { side: blink.side === -1 ? 0 : -1, t: 5 }; break;
      }
    }

    // ---------- hay bales: drive into one with the bucket down to scoop it up, X tips it out (onto another bale = stack) ----------
    const BALE_H = 2, CARRY_POS = new T.Vector3(0, -0.37, 0.75);
    let carry = null, tipT = 0;
    const bales = () => world.list.filter(o => o.userData.hay);
    function grabBale(o) {
      const u = o.userData;
      world.list.splice(world.list.indexOf(o), 1);                  // carried: no wrapping/pushing while in the bucket
      bales().forEach(b => { if (b.userData.on === o) { b.userData.on = null; b.userData.fall = { vy: 0, vx: 0, vz: 0 }; } });   // bales on top tumble down
      u.on = null; u.fall = null; u.wob = 0; o.scale.copy(u.base); o.children[0].rotation.x = 0;
      bucket.attach(o); carry = o; u.grabT = 0;
      const ry = Math.atan2(Math.sin(o.rotation.y), Math.cos(o.rotation.y));
      u.from = { p: o.position.clone(), ry: ry > Math.PI / 2 ? ry - Math.PI : ry < -Math.PI / 2 ? ry + Math.PI : ry };   // a bale looks the same turned 180°
      bucketUp = true; sfx.servo(); sfx.note(9, { delay: 0.05 }); input.rumble(0.35, 120);
      S.sparkle(o.getWorldPosition(new T.Vector3()).setY(1.2), '#e8c35a', 16, 3, { gravity: 5, glow: 1.1 });
    }
    function dropBale() {
      const o = carry, u = o.userData, f = fwd(), out = 0.8 + Math.max(0, speed) * 0.3;
      carry = null; scene.attach(o); o.rotation.x = o.rotation.z = 0;
      u.fall = { vy: 2.5, vx: f.x * out, vz: f.z * out };
      world.list.push(o);
      tipT = 1; bucketUp = false; sfx.whoosh(); sfx.servo();
    }
    function landBale(o, base, y) {
      const u = o.userData;
      o.position.y = y; u.fall = null; u.wob = 0.7;
      S.shake(0.08); input.rumble(0.4, 100);
      if (base) {   // neat stack on the bale below; every level plays a higher note, three high = party
        u.on = base; o.position.x = base.position.x; o.position.z = base.position.z; o.rotation.y = base.rotation.y;
        let level = 1; for (let b = base; b; b = b.userData.on) level++;
        sfx.stomp(); sfx.note(3 + level * 2, { delay: 0.05 });
        S.sparkle(o.position.clone().setY(y + 0.2), '#ffd166', 24, 4, { gravity: 4, glow: 1.2, spread: 1 });
        const sp = S.toScreen(o.position.clone().setY(y + BALE_H + 0.8));
        if (!sp.behind) api.fx.floatEmoji(sp.x, sp.y, level >= 3 ? '🎉' : '⭐', { size: 54, life: 1.3 });
        if (level >= 3) { sfx.cheer(); api.fx.confetti(api.w, api.h); }
      } else {
        sfx.stomp(); S.ring(o.position.clone().setY(0.06), '#ffe6a8', 4, 0.5, 0.6);
        S.sparkle(o.position.clone().setY(0.3), '#e8c35a', 20, 3, { gravity: 6, glow: 1.1, spread: 1 });
      }
    }

    camera.position.set(0, 6, -11);

    return {
      resize: S.resize,
      update(dt) {
        t += dt;
        for (const b of input.pressed) doAction(b);

        // driving
        let throttle = -input.y;
        if (input.down.has(7)) throttle = 1;
        if (input.down.has(6)) throttle = -1;
        const target = (throttle > 0 ? throttle * 10 : throttle * 5) * CONFIG.stickSpeed;
        speed = U.lerp(speed, target, Math.min(1, dt * (Math.abs(target) > Math.abs(speed) ? 1.4 : 2.5)));
        steer = U.lerp(steer, input.x, Math.min(1, dt * 6));
        const dir = speed >= -0.1 ? 1 : -1;
        yaw -= steer * 1.7 * dt * dir * U.clamp(Math.abs(speed) / 3, 0.4, 1);
        const f = fwd();
        pos.addScaledVector(f, speed * dt);

        // scoop up a hay bale that's right in front of a lowered bucket
        if (!carry && bucketA < 0.35 && !air && speed > 0.3) {
          const all = bales(), under = new Set(all.map(b => b.userData.on).filter(Boolean));
          for (const o of all) {
            if (o.userData.fall || o.position.y > 0.5 || under.has(o)) continue;   // never pull the bottom out of a stack
            const rx = o.position.x - pos.x, rz = o.position.z - pos.z;
            const along = rx * f.x + rz * f.z, side = Math.abs(rx * f.z - rz * f.x);
            if (along > 1.5 && along < 3.8 && side < 1.7) { grabBale(o); break; }
          }
        }

        // collisions: solid props push the tractor; light props get pushed
        world.list.forEach(o => {
          const u = o.userData, k = u.kind;
          if (u.hay && (u.fall || o.position.y > 0.5)) return;   // falling / stacked bales: the tractor drives under the top ones
          const dx = o.position.x - pos.x, dz = o.position.z - pos.z, d = Math.hypot(dx, dz), min = u.r + 1.6;
          if (d >= min || d < 0.001) return;
          const nx = dx / d, nz = dz / d, push = min - d;
          if (k === 'solid') { pos.x -= nx * push; pos.z -= nz * push; speed *= 0.6; if (u.wob < 0.3) { u.wob = 0.6; sfx.boop(); input.rumble(0.3, 80); } }
          else if (k === 'push' || ANIMAL[k]) {
            o.position.x += nx * push; o.position.z += nz * push; u.wob = Math.max(u.wob, 0.5);
            if (k === 'push' && o.children[0]) o.children[0].rotation.x += push * (k === 'push' ? 1.2 : 0);
            if (ANIMAL[k]) animalsReact(min + 0.5);
          } else if (u.wob < 0.2) u.wob = 0.8;
        });
        if (Math.abs(speed) > 1) animalsReact(4);

        // jump
        if (air) { jumpY += vy * dt; vy -= 24 * dt; tilt = U.lerp(tilt, -0.15, dt * 6); if (jumpY <= 0) { jumpY = 0; air = false; squash = 1; sfx.stomp(); S.shake(0.15); input.rumble(0.5, 120); S.ring(pos.clone().setY(0.06), '#ffe6a8', 5, 0.5, 0.7); S.sparkle(pos.clone().setY(0.3), '#c8a878', 30, 4, { gravity: 6, glow: 1.1, spread: 1.2 }); world.nudge(pos.x, pos.z, 5, 0.7); } }
        else tilt = U.lerp(tilt, -speed * 0.006 + (speed - target) * 0.01, dt * 4);
        squash = Math.max(0, squash - dt * 4);
        const sq = Math.sin(squash * Math.PI) * 0.15;
        tractor.position.copy(pos); tractor.rotation.y = yaw;
        chassis.position.y = jumpY + Math.sin(t * 22) * 0.015 + Math.abs(Math.sin(t * 9)) * 0.04 * Math.min(1, Math.abs(speed) / 4);
        chassis.rotation.x = tilt; chassis.rotation.z = -steer * Math.min(1, Math.abs(speed) / 6) * 0.06;
        chassis.scale.set(1 + sq, 1 - sq, 1 + sq);
        rear.forEach(w => w.spin.rotation.x += speed * dt / w.r);
        front.forEach(w => { w.spin.rotation.x += speed * dt / w.r; w.g.rotation.y = -steer * 0.5; });
        farmer.rotation.y = -steer * 0.3; farmer.position.y = 2.25 + Math.abs(Math.sin(t * 9)) * 0.03 * Math.min(1, Math.abs(speed) / 4);

        // bucket
        bucketA = U.lerp(bucketA, bucketUp ? 1 : 0, Math.min(1, dt * 3));
        tipT = Math.max(0, tipT - dt * 1.6);
        loader.rotation.x = -0.95 * bucketA; bucket.rotation.x = 0.95 * bucketA + Math.sin(tipT * Math.PI) * 0.9;   // tips forward to drop a bale
        if (carry) {
          const u = carry.userData; u.grabT = Math.min(1, u.grabT + dt * 4); const e = U.ease(u.grabT);
          carry.position.lerpVectors(u.from.p, CARRY_POS, e); carry.rotation.set(0, U.lerp(u.from.ry, 0, e), 0);
        }
        bales().forEach(o => {
          const u = o.userData;
          if (u.fall) {
            u.fall.vy -= 22 * dt; u.fall.vx *= Math.pow(0.3, dt); u.fall.vz *= Math.pow(0.3, dt);
            o.position.x += u.fall.vx * dt; o.position.y += u.fall.vy * dt; o.position.z += u.fall.vz * dt;
            if (u.fall.vy < 0) {   // land on top of a nearby stack (generous: hops up onto it even from a bit low), or the ground
              const all = bales(), under = new Set(all.map(b => b.userData.on).filter(Boolean));
              let base = null, best = 2.2;
              for (const b of all) {
                if (b === o || b.userData.fall || under.has(b)) continue;   // only the top bale of each stack
                const d = Math.hypot(b.position.x - o.position.x, b.position.z - o.position.z);
                if (d < best) { best = d; base = b; }
              }
              const floor = base ? base.position.y + BALE_H : 0;
              if (o.position.y <= floor) landBale(o, base, floor);
            }
          } else if (u.on) { o.position.set(u.on.position.x, u.on.position.y + BALE_H, u.on.position.z); }
        });

        // tracks + smoke
        odo += Math.abs(speed) * dt;
        if (odo > 0.55 && !air) { odo = 0; [-1, 1].forEach(s => { const p = pos.clone().add(new T.Vector3(-f.z, 0, f.x).multiplyScalar(s * 1.05)).addScaledVector(f, -0.9); tracks.place(p.x, p.z, yaw); }); }
        smokeTimer -= dt;
        if (smokeTimer <= 0) { smokeTimer = 0.5 - Math.min(0.3, Math.abs(throttle) * 0.3); chassis.updateMatrixWorld(); puff(0.6 + Math.abs(throttle)); }
        smoke.forEach(s => {
          if (s.life <= 0) return;
          s.life -= dt * 0.9; s.m.position.y += dt * 2.2; s.m.position.addScaledVector(f, -speed * dt * 0.3);
          s.m.scale.setScalar(0.12 + (1 - s.life) * 0.45 * s.strength);
          s.m.material.opacity = Math.max(0, s.life) * 0.35; if (s.life <= 0) s.m.visible = false;
        });

        // lights, beacon, blinkers, dusk
        night = U.lerp(night, lights ? 1 : 0, Math.min(1, dt * 1.2));
        headM.emissiveIntensity = lights ? 2 : 0.1;
        beams.forEach(l => l.intensity = night * 260);
        const beacon = lights ? (Math.sin(t * 10) > 0 ? 1 : 0) : 0;
        beaconM.emissiveIntensity = beacon * 4; beaconLight.intensity = beacon * 8 * night;
        if (blink.t > 0) {
          blink.t -= dt;
          const on = Math.sin(t * 9) > 0;
          if (on !== blink.on) { blink.on = on; sfx.tick(); }
          blinkM[0].emissiveIntensity = blink.side === -1 && on ? 4 : 0;
          blinkM[1].emissiveIntensity = blink.side === 1 && on ? 4 : 0;
          if (blink.t <= 0) blink.side = 0;
        } else { blinkM[0].emissiveIntensity = blinkM[1].emissiveIntensity = 0; }
        const u = skyDome.material.uniforms;
        u.top.value.copy(SKY.dayTop).lerp(SKY.duskTop, night);
        u.mid.value.copy(SKY.dayMid).lerp(SKY.duskMid, night);
        u.bot.value.copy(DAY_FOG).lerp(DUSK_FOG, night);
        scene.fog.color.copy(DAY_FOG).lerp(DUSK_FOG, night);
        hemi.intensity = 0.9 - night * 0.65;
        sun.intensity = 2.1 - night * 1.75; sun.color.copy(SUN_DAY).lerp(SUN_DUSK, night);
        scene.environmentIntensity = 0.55 - night * 0.4;

        // animals idle + hop
        world.list.forEach(o => {
          const u = o.userData; if (!ANIMAL[u.kind]) return;
          u.call -= dt;
          if (u.hop > 0) { u.body.position.y += u.vy * dt; u.vy -= 18 * dt; if (u.body.position.y <= 0) { u.body.position.y = 0; u.hop = 0; } }
          u.head.rotation.x = Math.sin(t * 1.5 + u.ph) * 0.25 + 0.15;
          u.head.rotation.y = Math.sin(t * 0.6 + u.ph) * 0.4;
        });
        world.list.forEach(o => { if (o.userData.spin) o.userData.spin.rotation.z += dt * 1.2; });

        engine.set(Math.abs(speed) / 10);
        world.update(pos.x, pos.z, dt);
        ground.follow(pos.x, pos.z);
        sun.follow(pos.x, pos.z);

        // chase camera
        const camGoal = pos.clone().addScaledVector(f, -11).add(new T.Vector3(0, 6.2, 0));
        camera.position.lerp(camGoal, Math.min(1, dt * 2.5));
        camera.lookAt(pos.x + f.x * 3, 1.2 + jumpY * 0.4, pos.z + f.z * 3);
        skyDome.position.copy(camera.position);
        S.update(dt);
      },
      draw(ctx) {
        S.render();
        ctx.clearRect(0, 0, api.w, api.h);
        if (CONFIG.showGuides) Kit3D.drawGuide(ctx, api, { 0: '🦘', 1: '📯', 2: '💡', 3: carry ? '⬇️' : '🏗️', 4: '⬅️', 5: '➡️', 6: '⏪', 7: '⏩', stick: '🚜' }, 0.8);
      },
      destroy() { engine.stop(); S.destroy(); },
    };
  },
});
