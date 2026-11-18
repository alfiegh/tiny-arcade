// BUTTON PARTY (3D) — pure cause and effect in a disco room.
// Every press launches a shiny toy that bounces and piles up; the floor tiles light up.
// The stick rolls the smiley buddy around, and it can bump into the toy pile.
// Teaches: "when I press, something happens", and that the stick moves things.
Games.register({
  id: 'button-party', name: 'Button Party', emoji: '🎉', color: '#f15bb5',
  create(api) {
    const { input, sfx } = api;
    const S = Kit3D.stage(api, { background: '#241345', bloom: [0.55, 0.5, 1.25], exposure: 1.0, fov: 42, envIntensity: 0.6 });
    const { T, scene, camera, geo, mat, mesh } = S;
    camera.position.set(0, 11.5, 15.5);
    camera.lookAt(0, 0, 0.6);

    const BX = 9, BZ0 = -5.4, BZ1 = 5.6;   // play area

    // ---------- room ----------
    scene.add(new T.HemisphereLight('#ffd6f5', '#3a1a5a', 0.75));
    const key = new T.DirectionalLight('#fff0e0', 1.6);
    key.position.set(4, 16, 9); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -13, right: 13, top: 10, bottom: -10, near: 1, far: 40 });
    key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02;
    scene.add(key);

    // disco floor
    const tiles = [];
    const TS = 1.6, NX = 12, NZ = 10, ZOFF = 1.6;   // extra rows towards the camera so the floor fills the screen
    const tileGeo = S.track(new T.BoxGeometry(TS * 0.96, 0.2, TS * 0.96));
    for (let ix = 0; ix < NX; ix++) for (let iz = 0; iz < NZ; iz++) {
      const m = S.track(new T.MeshStandardMaterial({ color: (ix + iz) % 2 ? '#3b2266' : '#2e1a52', roughness: 0.25, metalness: 0.1, emissive: '#000000' }));
      const t = new T.Mesh(tileGeo, m);
      t.position.set((ix - NX / 2 + 0.5) * TS, -0.1, (iz - NZ / 2 + 0.5) * TS + ZOFF);
      t.receiveShadow = true; scene.add(t);
      tiles.push({ m, glow: 0, color: new T.Color() });
    }
    function lightTiles(x, z, color, radius = 2.5) {
      const c = new T.Color(color);
      tiles.forEach((tl, i) => {
        const tx = (Math.floor(i / NZ) - NX / 2 + 0.5) * TS, tz = (i % NZ - NZ / 2 + 0.5) * TS + ZOFF;
        if (Math.hypot(tx - x, tz - z) < radius * TS || Math.random() < 0.06) { tl.glow = 1; tl.color.copy(c); }
      });
    }

    // walls + bunting + disco ball
    const wallM = mat('#ff9ad5', { roughness: 0.9 });
    const back = mesh(geo.box, wallM); back.scale.set(24, 9, 0.4); back.position.set(0, 4.3, BZ0 - 1.3); scene.add(back);
    [-1, 1].forEach(s => { const w = mesh(geo.box, mat('#c58bff', { roughness: 0.9 })); w.scale.set(0.4, 3, 17); w.position.set(s * (BX + 1.2), 1.4, 1.2); scene.add(w); });
    const flagShape = new T.Shape(); flagShape.moveTo(-0.35, 0); flagShape.lineTo(0.35, 0); flagShape.lineTo(0, -0.7); flagShape.lineTo(-0.35, 0);
    const flagGeo = S.track(new T.ShapeGeometry(flagShape));
    for (let i = 0; i < 26; i++) {
      const x = -11 + i * 0.88, y = 7.4 - Math.sin((i / 25) * Math.PI) * 1.2;
      const f = new T.Mesh(flagGeo, mat(U.RAINBOW[i % U.RAINBOW.length], { side: T.DoubleSide, roughness: 0.7 }));
      f.position.set(x, y, BZ0 - 1.05); scene.add(f);
    }
    const ball = new T.Mesh(S.track(new T.IcosahedronGeometry(1.1, 2)), S.track(new T.MeshStandardMaterial({ color: '#dfe6f0', metalness: 1, roughness: 0.08, flatShading: true })));
    ball.position.set(0, 7.6, -1.5); scene.add(ball);
    const string = mesh(geo.cyl, mat('#aaa'), { shadow: false }); string.scale.set(0.02, 3, 0.02); string.position.set(0, 9.6, -1.5); scene.add(string);

    // sweeping coloured spotlights
    const spots = ['#ff4d6d', '#3fa7ff', '#ffd23f'].map((c, i) => {
      const l = new T.SpotLight(c, 35, 30, 0.35, 0.6, 1.5);
      l.position.set(-6 + i * 6, 10, 2); scene.add(l); scene.add(l.target);
      l.userData.base = new T.Color(c); return l;
    });

    // ---------- buddy ----------
    const buddy = new T.Group();
    S.hero = buddy;   // what the menu icon shows (tools/make-icons.js)
    const bodyM = mat('#ffd23f', { physical: true, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 });
    const bodyMesh = mesh(geo.sphere, bodyM); buddy.add(bodyMesh);
    const face = new T.Group(); buddy.add(face);
    [-1, 1].forEach(s => { const e = Kit3D.eye(S, 0.22, s); e.position.set(s * 0.36, 0.25, 0.85); face.add(e); });
    const smile = new T.Mesh(S.track(new T.TorusGeometry(0.34, 0.07, 10, 24, Math.PI)), mat('#3a1f2b'));
    smile.rotation.z = Math.PI; smile.position.set(0, -0.12, 0.93); face.add(smile);
    [-1, 1].forEach(s => { const c = mesh(geo.sphereLo, mat('#ff8fb1', { transparent: true, opacity: 0.8 }), { shadow: false }); c.scale.set(0.14, 0.09, 0.05); c.position.set(s * 0.62, -0.05, 0.76); face.add(c); });
    scene.add(buddy);
    const bp = new T.Vector3(0, 1, 1.5), bv = new T.Vector3();
    let squash = 0;

    // rainbow trail
    const trailM = Array.from({ length: 7 }, (_, i) => S.track(new T.MeshBasicMaterial({ color: new T.Color(U.RAINBOW[i]).multiplyScalar(1.6) })));
    const trail = Array.from({ length: 70 }, (_, i) => { const m = new T.Mesh(geo.sphereLo, trailM[i % 7]); m.visible = false; scene.add(m); return { m, life: 0 }; });
    let trailCursor = 0, trailTimer = 0;

    // ---------- toys ----------
    const starShape = new T.Shape();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.24 : 0.55, a = Math.PI / 2 + i * Math.PI / 5; i ? starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    const heart = new T.Shape();
    heart.moveTo(0, -0.45); heart.bezierCurveTo(-0.7, 0, -0.45, 0.6, 0, 0.3); heart.bezierCurveTo(0.45, 0.6, 0.7, 0, 0, -0.45);
    const ext = { depth: 0.25, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.07, bevelSegments: 4 };
    const shapes = [
      { g: S.track(new T.SphereGeometry(0.5, 24, 16)), r: 0.5 },
      { g: S.track(new T.BoxGeometry(0.8, 0.8, 0.8, 2, 2, 2)), r: 0.5 },
      { g: S.track(new T.ExtrudeGeometry(starShape, ext)).center(), r: 0.5 },
      { g: S.track(new T.ExtrudeGeometry(heart, ext)).center(), r: 0.48 },
      { g: S.track(new T.TorusGeometry(0.34, 0.17, 14, 28)), r: 0.5 },
      { g: S.track(new T.ConeGeometry(0.45, 0.9, 24)), r: 0.48 },
      { g: S.track(new T.CylinderGeometry(0.4, 0.4, 0.7, 24)), r: 0.48 },
    ];
    const toyMats = U.RAINBOW.map(c => mat(c, { physical: true, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 }));
    let toys = [];
    const MAX_TOYS = 45;

    function spawnToy(color) {
      const sh = U.pick(shapes);
      const m = mesh(sh.g, color ? mat(color, { physical: true, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 }) : U.pick(toyMats));
      m.position.set(bp.x, bp.y + 1.3, bp.z);
      const a = Math.random() * Math.PI * 2, sp = U.rand(3, 6.5);
      const toy = { m, r: sh.r, v: new T.Vector3(Math.cos(a) * sp, U.rand(8, 12), Math.sin(a) * sp * 0.7), w: new T.Vector3(U.rand(-6, 6), U.rand(-6, 6), U.rand(-6, 6)), grow: 0, dying: 0 };
      m.scale.setScalar(0.01);
      scene.add(m); toys.push(toy);
      if (toys.filter(t => !t.dying).length > MAX_TOYS) toys.find(t => !t.dying).dying = 0.001;
    }

    let presses = 0, t = 0, bumpCool = 0, ballSpin = 0.3;

    return {
      resize: S.resize,
      update(dt) {
        t += dt;
        // buddy movement
        const sp = 8 * CONFIG.stickSpeed;
        bv.x = U.lerp(bv.x, input.x * sp, Math.min(1, dt * 6));
        bv.z = U.lerp(bv.z, input.y * sp, Math.min(1, dt * 6));
        bp.x = U.clamp(bp.x + bv.x * dt, -BX, BX);
        bp.z = U.clamp(bp.z + bv.z * dt, BZ0, BZ1);
        const speed = Math.hypot(bv.x, bv.z);
        bp.y = 1 + Math.abs(Math.sin(t * 9)) * 0.25 * Math.min(1, speed / 4);
        squash = Math.max(0, squash - dt * 4);
        const sq = Math.sin(squash * Math.PI) * 0.3;
        buddy.position.copy(bp);
        buddy.scale.set(1 + sq, 1 - sq, 1 + sq);
        buddy.rotation.z = U.lerp(buddy.rotation.z, -bv.x * 0.04, Math.min(1, dt * 6));
        buddy.rotation.x = U.lerp(buddy.rotation.x, bv.z * 0.04, Math.min(1, dt * 6));
        buddy.rotation.y = U.lerp(buddy.rotation.y, bv.x * 0.05, Math.min(1, dt * 6));

        trailTimer -= dt;
        if (speed > 1 && trailTimer <= 0) {
          trailTimer = 0.04;
          const tr = trail[trailCursor = (trailCursor + 1) % trail.length];
          tr.m.position.set(bp.x, 0.35, bp.z); tr.life = 1.2; tr.m.visible = true;
          if (Math.random() < 0.15) sfx.note(U.randInt(5, 12), { vol: 0.06, dur: 0.25, type: 'sine' });
        }
        trail.forEach(tr => { if (tr.life > 0) { tr.life -= dt; tr.m.scale.setScalar(Math.max(0.01, tr.life * 0.32)); if (tr.life <= 0) tr.m.visible = false; } });

        // presses
        for (const b of input.pressed) {
          if (b === 8 || b === 9) continue;
          const color = U.BTN_COLORS[b] || U.pick(U.RAINBOW);
          presses++; squash = 1;
          sfx.note((presses % 10) + (b % 4));
          spawnToy(b < 4 ? null : color);
          S.sparkle(new T.Vector3(bp.x, bp.y + 0.8, bp.z), color, 40, 7, { gravity: 6, life: 1 });
          S.ring(new T.Vector3(bp.x, 0.03, bp.z), color, 4.5, 0.6);
          lightTiles(bp.x, bp.z, color);
          spots.forEach(l => l.color.set(color));
          input.rumble(0.25, 60);
          if (presses % 12 === 0) {
            api.celebrate(); ballSpin = 5;
            for (let k = 0; k < 6; k++) S.sparkle(new T.Vector3(U.rand(-9, 9), 9, U.rand(-4, 3)), U.pick(U.RAINBOW), 30, 3, { gravity: 5, life: 2.4 });
          }
        }

        // toy physics
        const G = 22;
        bumpCool -= dt;
        for (const ty of toys) {
          ty.grow = Math.min(1, ty.grow + dt * 5);
          if (ty.dying) { ty.dying += dt * 2; }
          const s = ty.dying ? Math.max(0, 1 - ty.dying) : U.ease(ty.grow);
          ty.m.scale.setScalar(Math.max(0.001, s));
          ty.v.y -= G * dt;
          ty.m.position.addScaledVector(ty.v, dt);
          const p = ty.m.position;
          if (p.y < ty.r) {
            p.y = ty.r;
            if (ty.v.y < -2) { ty.v.y *= -0.5; if (ty.v.y > 3 && Math.random() < 0.3) sfx.boop(); } else ty.v.y = 0;
            ty.v.x *= Math.pow(0.15, dt); ty.v.z *= Math.pow(0.15, dt); ty.w.multiplyScalar(Math.pow(0.2, dt));
          }
          if (p.x < -BX - 0.5) { p.x = -BX - 0.5; ty.v.x = Math.abs(ty.v.x) * 0.6; }
          if (p.x > BX + 0.5) { p.x = BX + 0.5; ty.v.x = -Math.abs(ty.v.x) * 0.6; }
          if (p.z < BZ0 - 0.6) { p.z = BZ0 - 0.6; ty.v.z = Math.abs(ty.v.z) * 0.6; }
          if (p.z > BZ1 + 0.3) { p.z = BZ1 + 0.3; ty.v.z = -Math.abs(ty.v.z) * 0.6; }
          ty.m.rotation.x += ty.w.x * dt; ty.m.rotation.y += ty.w.y * dt; ty.m.rotation.z += ty.w.z * dt;
          // bump with buddy
          const dx = p.x - bp.x, dy = p.y - bp.y, dz = p.z - bp.z, d = Math.hypot(dx, dy, dz);
          if (d < ty.r + 1 && d > 0.001 && ty.grow > 0.9) {
            const push = (ty.r + 1 - d);
            p.x += dx / d * push; p.y += Math.max(0, dy / d * push); p.z += dz / d * push;
            ty.v.x += dx / d * (3 + speed * 0.8); ty.v.z += dz / d * (3 + speed * 0.8); ty.v.y += 2 + speed * 0.5;
            ty.w.set(U.rand(-8, 8), U.rand(-8, 8), U.rand(-8, 8));
            if (bumpCool <= 0) { sfx.boop(); bumpCool = 0.12; }
          }
        }
        // toy–toy collisions (simple sphere push)
        for (let i = 0; i < toys.length; i++) for (let j = i + 1; j < toys.length; j++) {
          const a = toys[i].m.position, b = toys[j].m.position;
          const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz), min = toys[i].r + toys[j].r;
          if (d < min && d > 0.0001) {
            const k = (min - d) / d * 0.5;
            a.x -= dx * k; a.y -= dy * k; a.z -= dz * k; b.x += dx * k; b.y += dy * k; b.z += dz * k;
            const va = toys[i].v, vb = toys[j].v;
            const rel = (vb.x - va.x) * dx + (vb.y - va.y) * dy + (vb.z - va.z) * dz;
            if (rel < 0) { const imp = rel / (d * d) * 0.8; va.x += dx * imp; va.y += dy * imp; va.z += dz * imp; vb.x -= dx * imp; vb.y -= dy * imp; vb.z -= dz * imp; }
          }
        }
        toys = toys.filter(ty => { if (ty.dying >= 1) { scene.remove(ty.m); return false; } return true; });

        // lights & tiles
        tiles.forEach(tl => {
          if (tl.glow > 0) { tl.glow = Math.max(0, tl.glow - dt * 1.4); tl.m.emissive.copy(tl.color).multiplyScalar(tl.glow * 1.1); }
        });
        spots.forEach((l, i) => {
          l.target.position.set(Math.sin(t * 0.7 + i * 2) * 7, 0, Math.cos(t * 0.9 + i) * 3);
          l.color.lerp(l.userData.base, Math.min(1, dt * 1.5));
        });
        ballSpin = U.lerp(ballSpin, 0.3, Math.min(1, dt * 0.8));
        ball.rotation.y += dt * ballSpin;
        S.update(dt);
      },
      draw(ctx) {
        S.render();
        ctx.clearRect(0, 0, api.w, api.h);
        if (presses === 0 && t > 2) {          // gentle nudge for the very first press
          const sp = S.toScreen(new T.Vector3(bp.x, bp.y, bp.z));
          const p = 0.5 + Math.sin(t * 5) * 0.5;
          [[0, 1], [1, 0], [-1, 0], [0, -1]].forEach(([dx, dy], i) => {
            ctx.globalAlpha = 0.6 + p * 0.4; ctx.fillStyle = U.BTN_COLORS[i];
            ctx.beginPath(); ctx.arc(sp.x + dx * 110, sp.y + dy * 110, 18 + p * 6, 0, Math.PI * 2); ctx.fill();
          });
          ctx.globalAlpha = 1;
        }
      },
      destroy: S.destroy,
    };
  },
});
