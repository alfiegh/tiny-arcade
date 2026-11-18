// DINO WORLD (3D) — be a dinosaur and roam an endless prehistoric meadow.
// The world wraps around you, so you can walk forever in any direction.
//
//   Stick / D-pad : walk (push further to run)
//   A (bottom)    : jump            B (right) : ROAR
//   Y (left)      : sneeze          X (top)   : dance
//   L / R         : wave left / right hand
//   ZL / ZR       : lift left / right leg (and STOMP)
//
// Walk into a spotted egg to hatch a baby dino; babies follow you and copy what you do.
Games.register({
  id: 'dino-world', name: 'Dino World', emoji: '🦖', color: '#36d27a',
  create(api) {
    const { input, sfx } = api;
    const S = Kit3D.stage(api, { fog: ['#c6ecff', 36, 66], bloom: [0.45, 0.6, 1.25], exposure: 1.0, fov: 50, envIntensity: 0.55 });
    const { T, scene, camera, geo, mat, mesh } = S;

    const skyDome = Kit3D.sky(S, '#3b9be8', '#c6ecff', '#c6ecff', { sunDir: new T.Vector3(0.45, 0.5, -0.75) });
    scene.add(new T.HemisphereLight('#d4f1ff', '#5d8a3a', 0.9));
    const sun = Kit3D.sun(S, { intensity: 2.1, offset: [9, 20, 12], size: 22 });

    // ---------- ground ----------
    const grassTex = S.canvasTex(512, (g, s) => {
      g.fillStyle = '#6cc04a'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 40; i++) { g.fillStyle = `hsla(${U.rand(85, 115)},50%,${U.rand(38, 52)}%,.35)`; g.beginPath(); g.arc(U.rand(0, s), U.rand(0, s), U.rand(30, 90), 0, 7); g.fill(); }
      for (let i = 0; i < 9000; i++) { g.fillStyle = `hsl(${U.rand(80, 125)} ${U.rand(40, 65)}% ${U.rand(32, 58)}%)`; g.fillRect(U.rand(0, s), U.rand(0, s), 2, U.rand(3, 8)); }
      for (let i = 0; i < 60; i++) { g.fillStyle = U.pick(['#fff', '#ffe066', '#ff9ad5']); g.beginPath(); g.arc(U.rand(0, s), U.rand(0, s), 2.5, 0, 7); g.fill(); }
    });
    const ground = Kit3D.infiniteGround(S, grassTex, { tile: 9 });

    // ---------- props ----------
    const trunkM = mat('#9a6b47', { roughness: 0.9 }), palmLeafM = mat('#3eaa52', { roughness: 0.7, side: T.DoubleSide });
    const leafMs = ['#3fa34d', '#57b947', '#2f8f45', '#7cc84a'].map(c => mat(c, { roughness: 0.8 }));
    function palm() {
      const g = new T.Group(); let x = 0, y = 0; const lean = U.rand(0.03, 0.08);
      for (let i = 0; i < 7; i++) { const s = mesh(geo.cyl, trunkM); s.scale.set(0.28 - i * 0.015, 0.62, 0.28 - i * 0.015); s.position.set(x, y + 0.31, 0); g.add(s); y += 0.6; x += lean * i; }
      for (let k = 0; k < 7; k++) {
        const pivot = new T.Group(); pivot.position.set(x, y, 0); pivot.rotation.y = k / 7 * Math.PI * 2; g.add(pivot);
        const l = mesh(geo.sphereLo, palmLeafM); l.scale.set(0.35, 0.06, 1.6); l.position.set(0, -0.35, 1.3); l.rotation.x = 0.45; pivot.add(l);
      }
      for (let k = 0; k < 3; k++) { const c = mesh(geo.sphereLo, mat('#6b4a2b')); c.scale.setScalar(0.18); c.position.set(x + Math.cos(k * 2) * 0.25, y - 0.25, Math.sin(k * 2) * 0.25); g.add(c); }
      g.scale.setScalar(U.rand(0.9, 1.3)); return g;
    }
    // trees, rocks, bushes and grass from the Simple Nature pack (Quaternius, app/assets/nature)
    const nat = (name, o) => Kit3D.prop(S, 'nature/nature', name, o);
    function roundTree() { return nat(U.pick(['Tree1', 'Tree2', 'Tree3', 'Tree4']), { height: U.rand(4.5, 7) }); }
    function bush() { return nat(U.pick(['Bush1', 'Bush2', 'Bush3']), { height: U.rand(1, 1.6) }); }
    function grass() { return nat(U.pick(['Grass1', 'Grass2', 'Grass3']), { height: U.rand(0.5, 0.9) }); }
    function fern() {
      const g = new T.Group(); const m = U.pick(leafMs);
      for (let k = 0; k < 7; k++) { const c = mesh(geo.cone, m); c.scale.set(0.12, 1.3, 0.3); c.position.y = 0.55; c.rotation.set(Math.cos(k) * 0.6, k, Math.sin(k) * 0.6); g.add(c); }
      g.scale.setScalar(U.rand(0.7, 1.2)); return g;
    }
    function rock() { return nat(U.pick(['Rock1', 'Rock2', 'Rock3']), { height: U.rand(0.6, 1.6) }); }
    const flowerMs = ['#ff5fa2', '#ffd23f', '#ffffff', '#9b5de5', '#ff9f1c', '#3fa7ff'].map(c => mat(c, { roughness: 0.6 }));
    const stemM = mat('#3f9b3f');
    function flowers() {
      const g = new T.Group();
      for (let k = 0; k < 5; k++) {
        const x = U.rand(-0.5, 0.5), z = U.rand(-0.5, 0.5), h = U.rand(0.3, 0.6);
        const st = mesh(geo.cyl, stemM, { shadow: false }); st.scale.set(0.025, h, 0.025); st.position.set(x, h / 2, z); g.add(st);
        const hd = mesh(geo.sphereLo, U.pick(flowerMs), { shadow: false }); hd.scale.set(0.14, 0.08, 0.14); hd.position.set(x, h, z); g.add(hd);
      }
      return g;
    }
    const capM = mat('#ff4d4d', { roughness: 0.4 }), dotM = mat('#ffffff', { roughness: 0.5 });
    function mushroom() {
      const g = new T.Group();
      const st = mesh(geo.cyl, mat('#f6efe0')); st.scale.set(0.18, 0.5, 0.18); st.position.y = 0.25; g.add(st);
      const cap = mesh(S.track(new T.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2)), capM); cap.scale.set(0.5, 0.35, 0.5); cap.position.y = 0.45; g.add(cap);
      for (let k = 0; k < 5; k++) { const d = mesh(geo.sphereLo, dotM, { shadow: false }); d.scale.setScalar(0.07); const a = k * 1.3; d.position.set(Math.cos(a) * 0.3, 0.68, Math.sin(a) * 0.3); g.add(d); }
      g.scale.setScalar(U.rand(0.8, 1.6)); return g;
    }
    const eggTex = S.canvasTex(256, (g, s) => {
      g.fillStyle = '#fff6df'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 26; i++) { g.fillStyle = U.pick(['#7ed957', '#5ec8ff', '#ff9ad5', '#ffb347']); g.beginPath(); g.ellipse(U.rand(0, s), U.rand(20, s - 20), U.rand(8, 18), U.rand(6, 14), 0, 0, 7); g.fill(); }
    });
    const eggM = S.track(new T.MeshStandardMaterial({ map: eggTex, roughness: 0.45 }));
    function egg() { const g = new T.Group(); const e = mesh(geo.sphere, eggM); e.scale.set(0.55, 0.72, 0.55); e.position.y = 0.68; g.add(e); return g; }

    const world = Kit3D.scatter(S, [
      { make: palm, count: 26, radius: 0.8 },
      { make: roundTree, count: 18, radius: 1.2 },
      { make: fern, count: 40, radius: 0.6 },
      { make: rock, count: 28, radius: 0.9 },
      { make: bush, count: 24, radius: 0.8 },
      { make: grass, count: 50, radius: 0.4 },
      { make: flowers, count: 70, radius: 0.5 },
      { make: mushroom, count: 16, radius: 0.5 },
      { make: egg, count: 9, radius: 0.6, kind: 'egg' },
    ], { area: 120, avoid: 7 });

    // far-away volcanoes that always stay on the horizon
    const horizon = new T.Group(); scene.add(horizon);
    const volcM = S.track(new T.MeshStandardMaterial({ color: '#a7b4d0', roughness: 1, fog: false, emissive: '#7f8db0', emissiveIntensity: 0.35 }));
    const lavaM = S.track(new T.MeshBasicMaterial({ color: new T.Color('#ff7a2a').multiplyScalar(1.6), fog: false }));
    [[-80, -170, 20], [70, -180, 26], [180, -60, 18], [-180, -40, 20]].forEach(([x, z, h]) => {
      const v = new T.Mesh(S.track(new T.CylinderGeometry(h * 0.18, h * 0.9, h, 24, 1, true)), volcM); v.position.set(x, h / 2 - 2, z); horizon.add(v);
      const lava = new T.Mesh(geo.cyl, lavaM); lava.scale.set(h * 0.17, 0.3, h * 0.17); lava.position.set(x, h - 2, z); horizon.add(lava);
    });
    const smoke = [];
    for (let i = 0; i < 14; i++) {
      const s = new T.Mesh(geo.sphereLo, S.track(new T.MeshBasicMaterial({ color: '#d8d0e0', transparent: true, opacity: 0.5, fog: false, depthWrite: false })));
      s.userData = { t: i / 14, base: i % 2 ? new T.Vector3(-80, 18, -170) : new T.Vector3(70, 24, -180) };
      horizon.add(s); smoke.push(s);
    }

    // footprints
    const printTex = S.canvasTex(128, (g, s) => {
      g.fillStyle = '#fff';
      g.beginPath(); g.ellipse(s / 2, s * 0.62, s * 0.2, s * 0.24, 0, 0, 7); g.fill();
      [-0.22, 0, 0.22].forEach(dx => { g.beginPath(); g.ellipse(s / 2 + dx * s, s * 0.28, s * 0.07, s * 0.13, dx * 2, 0, 7); g.fill(); });
    }, { clamp: true, srgb: false });
    const prints = Kit3D.decals(S, printTex, { count: 120, size: [0.9, 1.0], opacity: 0.28 });

    // ---------- the dino ----------
    const dino = Kit3D.makeDinoModel(S, 'trex');
    scene.add(dino.root);
    S.hero = dino.root;   // what the menu icon shows (tools/make-icons.js)
    const pos = new T.Vector3(), vel = new T.Vector3();
    let yaw = 0, lastStep = 0;
    const forward = () => new T.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const headPos = () => pos.clone().add(forward().multiplyScalar(1.9)).setY(2.8);

    // babies
    // each egg hatches a different kind of baby dino
    const BABY_KINDS = ['triceratops', 'stegosaurus', 'velociraptor', 'parasaurolophus', 'apatosaurus', 'trex'];
    const babies = [];
    function hatch(e) {
      e.visible = false; e.userData.hatchedAt = performance.now();
      const p = e.position.clone();
      S.sparkle(p.clone().setY(0.8), '#fff6df', 40, 5, { gravity: 6 });
      S.sparkle(p.clone().setY(0.8), U.pick(U.RAINBOW), 30, 4, { gravity: 3 });
      sfx.pop(); sfx.chime();
      if (babies.length >= 6) return;
      const kind = BABY_KINDS[babies.length % BABY_KINDS.length];
      const b = Kit3D.makeDinoModel(S, kind, { height: Kit3D.DINO_SPECIES[kind].height * 0.45 });
      b.root.position.copy(p); scene.add(b.root);
      b.do('happy');
      babies.push({ rig: b, yaw: 0 });
      api.celebrate();
    }
    const copy = (name) => babies.forEach((b, i) => setTimeout(() => b.rig.do(name), 120 + i * 110));

    // action effects
    dino.onLand = () => {
      sfx.stomp(); S.shake(0.18); input.rumble(0.5, 120);
      S.ring(pos.clone().setY(0.05), '#ffe6a8', 4, 0.5, 0.7);
      S.sparkle(pos.clone().setY(0.2), '#d9c49a', 30, 4, { gravity: 6, glow: 1.2, spread: 0.8 });
      world.nudge(pos.x, pos.z, 4, 0.8);
    };
    dino.onStomp = (side) => {
      sfx.stomp(); S.shake(0.22); input.rumble(0.6, 140);
      const f = forward(), right = new T.Vector3(-f.z, 0, f.x);
      const p = pos.clone().addScaledVector(right, -side * 0.62).addScaledVector(f, 0.4).setY(0.05);
      S.ring(p, '#ffe6a8', 4.5, 0.6, 0.7);
      S.sparkle(p.clone().setY(0.2), '#d9c49a', 30, 4, { gravity: 6, glow: 1.2 });
      prints.place(p.x, p.z, yaw);
      world.nudge(p.x, p.z, 5, 0.9);
    };
    dino.onSneeze = () => {
      const hp = headPos();
      S.sparkle(hp, '#e8fff0', 50, 7, { gravity: 1, life: 0.9, glow: 1.5 });
      S.sparkle(hp, '#b8ffcb', 20, 9, { gravity: 0, life: 0.6 });
      S.shake(0.1);
      const f = forward();
      world.nudge(pos.x + f.x * 4, pos.z + f.z * 4, 3.5, 1);
      const sp = S.toScreen(hp); api.fx.floatEmoji(sp.x, sp.y, '💨', { size: 70, life: 1, vx: (f.x > 0 ? 1 : -1) * 120, vy: -40 });
    };

    function doAction(b) {
      switch (b) {
        case 0: if (!dino.airborne) { dino.do('jump'); copy('jump'); sfx.boing(); } break;
        case 1: if (!dino.busy('roar')) {
          dino.do('roar'); copy('roar'); sfx.roar(); input.rumble(0.9, 700);
          S.shake(0.35);
          [0, 200, 400].forEach(d => setTimeout(() => S.ring(pos.clone().setY(0.06), '#fff1b8', 12, 0.9, 0.5), d));
          world.nudge(pos.x, pos.z, 13, 1);
          world.list.forEach(o => { if (o.userData.r >= 0.8 && o.position.distanceTo(pos) < 14) S.sparkle(new T.Vector3(o.position.x, 3.5, o.position.z), U.pick(['#57b947', '#7cc84a', '#ffd23f']), 10, 3, { gravity: 4, glow: 1.2, life: 1.4 }); });
        } break;
        case 2: if (!dino.busy('sneeze')) { dino.do('sneeze'); copy('sneeze'); sfx.sneeze(); } break;
        case 3: if (!dino.busy('dance')) { dino.do('dance'); copy('dance'); sfx.melody([0, 2, 4, 2, 4, 7, 4, 7, 9, 7, 4, 2, 0, 4, 7, 12], 0.15); } break;
        case 4: dino.do('waveL'); copy('waveL'); sfx.chime(); break;
        case 5: dino.do('waveR'); copy('waveR'); sfx.chime(); break;
        case 6: if (!dino.busy('legL')) { dino.do('legL'); copy('legL'); sfx.servo(); } break;
        case 7: if (!dino.busy('legR')) { dino.do('legR'); copy('legR'); sfx.servo(); } break;
      }
    }

    let t = 0, danceSpark = 0, bumpCool = 0;
    camera.position.set(0, 7, 12.5);

    return {
      resize: S.resize,
      update(dt) {
        t += dt;
        for (const b of input.pressed) doAction(b);

        // movement: camera-relative (stick up = walk away from the camera)
        const sp = 7.5 * CONFIG.stickSpeed;
        const busyPose = dino.busy('legL') || dino.busy('legR');
        const tx = input.x * sp * (busyPose ? 0.3 : 1), tz = input.y * sp * (busyPose ? 0.3 : 1);
        vel.x = U.lerp(vel.x, tx, Math.min(1, dt * 5)); vel.z = U.lerp(vel.z, tz, Math.min(1, dt * 5));
        pos.addScaledVector(vel, dt);
        const speed = Math.hypot(vel.x, vel.z);
        if (speed > 0.4) {
          const target = Math.atan2(vel.x, vel.z);
          let d = target - yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
          yaw += d * Math.min(1, dt * 8);
        }
        dino.root.position.copy(pos); dino.root.rotation.y = yaw;
        dino.update(dt, speed);

        // footsteps
        if (speed > 1 && !dino.airborne) {
          const step = Math.floor(t * (1.5 + speed * 0.25) * 2);
          if (step !== lastStep) {
            lastStep = step;
            const f = forward(), right = new T.Vector3(-f.z, 0, f.x), side = step % 2 ? 1 : -1;
            prints.place(pos.x + right.x * side * 0.6, pos.z + right.z * side * 0.6, yaw);
            sfx.drum('tom');
            if (speed > 5) S.sparkle(pos.clone().setY(0.15), '#d9c49a', 4, 2, { gravity: 4, glow: 1, life: 0.5 });
          }
        }

        // brush past props
        bumpCool -= dt;
        const touched = world.nudge(pos.x, pos.z, 1.2, 0.6);
        for (const o of touched) {
          if (o.userData.kind === 'egg' && o.visible) hatch(o);
          else if (bumpCool <= 0 && speed > 1) { sfx.boop(); bumpCool = 0.3; }
        }
        // re-show hatched eggs once they're far away
        world.list.forEach(o => { if (o.userData.kind === 'egg' && !o.visible && o.position.distanceTo(pos) > 45) o.visible = true; });

        // babies follow in a line and copy actions
        let leader = { p: pos, yaw };
        babies.forEach((b, i) => {
          const lp = leader.p, ly = leader.yaw;
          const target = lp.clone().add(new T.Vector3(-Math.sin(ly), 0, -Math.cos(ly)).multiplyScalar(i === 0 ? 2.8 : 1.6));
          const bp = b.rig.root.position;
          const before = bp.clone();
          bp.lerp(target.setY(0), Math.min(1, dt * 3));
          const mv = bp.clone().sub(before); const bs = mv.length() / dt;
          if (bs > 0.3) { let d = Math.atan2(mv.x, mv.z) - b.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); b.yaw += d * Math.min(1, dt * 8); }
          b.rig.root.rotation.y = b.yaw;
          b.rig.update(dt, bs);
          leader = { p: bp, yaw: b.yaw };
        });

        if (dino.busy('dance')) { danceSpark -= dt; if (danceSpark <= 0) { danceSpark = 0.08; S.sparkle(pos.clone().add(new T.Vector3(U.rand(-2, 2), U.rand(1, 4), U.rand(-2, 2))), U.pick(U.RAINBOW), 6, 2, { life: 0.8 }); } }

        // world follows
        world.update(pos.x, pos.z, dt);
        ground.follow(pos.x, pos.z);
        sun.follow(pos.x, pos.z);
        horizon.position.set(pos.x, 0, pos.z);
        smoke.forEach(s => { const d = s.userData; d.t = (d.t + dt * 0.05) % 1; s.position.copy(d.base).add(new T.Vector3(d.t * 12, d.t * 26, 0)); s.scale.setScalar(3 + d.t * 9); s.material.opacity = 0.5 * (1 - d.t); });

        // camera follows from a fixed angle
        const camTarget = new T.Vector3(pos.x, 7, pos.z + 12.5);
        camera.position.lerp(camTarget, Math.min(1, dt * 3));
        camera.lookAt(pos.x, 2 + dino.inner.position.y * 0.3, pos.z);
        skyDome.position.copy(camera.position);
        S.update(dt);
      },
      draw(ctx) {
        S.render();
        ctx.clearRect(0, 0, api.w, api.h);
        if (babies.length) {
          ctx.font = `800 ${Math.max(26, api.h * 0.045)}px ui-rounded, system-ui, sans-serif`;
          ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
          ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 8;
          U.emoji(ctx, '🥚', 44, 44, 46); ctx.fillText(babies.length, 76, 48);
          ctx.shadowBlur = 0;
        }
        if (CONFIG.showGuides) Kit3D.drawGuide(ctx, api, { 0: '🦘', 1: '🦖', 2: '🤧', 3: '💃', 4: '👋', 5: '👋', 6: '🦵', 7: '🦵', stick: '🚶' }, 0.8);
      },
      destroy: S.destroy,
    };
  },
});
