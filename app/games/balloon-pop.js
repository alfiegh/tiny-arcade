// BALLOON POP (3D) — fly the magic star to a balloon, press any button to pop it.
// The star pops everything within a generous radius; a balloon under the star wiggles
// and shows the four buttons as a hint.
// Teaches: move THEN press (stick + button together).
Games.register({
  id: 'balloon-pop', name: 'Balloon Pop', emoji: '🎈', color: '#ff4d6d',
  create(api) {
    const { input, sfx } = api;
    const S = Kit3D.stage(api, { bloom: [0.5, 0.6, 1.15], exposure: 1.0, fov: 45, envIntensity: 0.6, fog: ['#cfeeff', 40, 120] });
    const { T, scene, camera, geo, mat, mesh } = S;
    const CAM_Z = 18;
    camera.position.set(0, 3, CAM_Z);
    camera.lookAt(0, 3.2, 0);

    Kit3D.sky(S, '#3d9bea', '#bfe6ff', '#cfeeff', { sunDir: new T.Vector3(0.5, 0.45, -0.7) });
    scene.add(new T.HemisphereLight('#cfeeff', '#4c8a3a', 0.8));
    const sun = Kit3D.sun(S, { intensity: 2.0, offset: [10, 20, 14], size: 20 });
    sun.follow(0, 0);

    // ---------- meadow ----------
    const GROUND_Y = -4;
    const grass = S.canvasTex(256, (g, s) => {
      g.fillStyle = '#5fb84a'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 2500; i++) { g.fillStyle = `hsl(${U.rand(90, 120)} ${U.rand(40, 60)}% ${U.rand(35, 55)}%)`; g.fillRect(U.rand(0, s), U.rand(0, s), 2, U.rand(3, 7)); }
    }, { repeat: 30 });
    const ground = mesh(S.track(new T.PlaneGeometry(300, 300)), S.track(new T.MeshStandardMaterial({ map: grass, roughness: 1 })), { shadow: false });
    ground.rotation.x = -Math.PI / 2; ground.position.y = GROUND_Y; scene.add(ground);
    const hillM = mat('#6cc24a', { roughness: 0.95 }), hill2 = mat('#4fae45', { roughness: 0.95 });
    [[-30, -50, 22], [5, -65, 30], [38, -55, 24], [-60, -70, 28], [70, -75, 30]].forEach(([x, z, r], i) => {
      const h = mesh(geo.sphere, i % 2 ? hillM : hill2, { shadow: false }); h.scale.set(r * 1.4, r * 0.55, r); h.position.set(x, GROUND_Y - 2, z); scene.add(h);
    });
    const trunkM = mat('#8a5a3c', { roughness: 0.9 }), leafMs = ['#3fa34d', '#57b947', '#2f8f45'].map(c => mat(c, { roughness: 0.8 }));
    function tree(x, z, s) {
      const g = new T.Group(); g.position.set(x, GROUND_Y, z); g.scale.setScalar(s);
      const tr = mesh(geo.cyl, trunkM); tr.scale.set(0.3, 2.2, 0.3); tr.position.y = 1.1; g.add(tr);
      [[0, 2.8, 0, 1.3], [0.7, 2.4, 0.2, 0.9], [-0.7, 2.5, -0.1, 0.95], [0, 3.6, 0, 0.9]].forEach(([a, b, c, r], i) => { const l = mesh(geo.sphereLo, leafMs[i % 3]); l.scale.setScalar(r); l.position.set(a, b, c); g.add(l); });
      scene.add(g);
    }
    [[-16, -10, 1.6], [-21, -18, 2], [17, -8, 1.5], [23, -16, 2.1], [-10, -24, 1.8], [11, -26, 2]].forEach(a => tree(...a));
    const flowerMs = ['#ff5fa2', '#ffd23f', '#ffffff', '#9b5de5', '#ff9f1c'].map(c => mat(c, { roughness: 0.6 }));
    for (let i = 0; i < 90; i++) {
      const f = mesh(geo.sphereLo, U.pick(flowerMs), { shadow: false });
      f.scale.setScalar(U.rand(0.12, 0.22)); f.position.set(U.rand(-25, 25), GROUND_Y + 0.12, U.rand(-12, 8)); scene.add(f);
    }
    // clouds
    const cloudM = mat('#ffffff', { roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.15 });
    const clouds = Array.from({ length: 7 }, (_, i) => {
      const g = new T.Group();
      for (let k = 0; k < 5; k++) { const c = mesh(geo.sphereLo, cloudM, { shadow: false }); c.scale.setScalar(U.rand(1.2, 2.2)); c.position.set(k * 1.5 - 3, Math.sin(k) * 0.6, U.rand(-0.5, 0.5)); g.add(c); }
      g.position.set(U.rand(-40, 40), U.rand(12, 20), U.rand(-35, -20)); g.userData.v = U.rand(0.4, 1.0);
      scene.add(g); return g;
    });

    // ---------- the magic star ----------
    const starShape = new T.Shape();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.3 : 0.7, a = Math.PI / 2 + i * Math.PI / 5; i ? starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    const starGeo = S.track(new T.ExtrudeGeometry(starShape, { depth: 0.25, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 4 })).center();
    const wand = mesh(starGeo, mat('#ffcc33', { metalness: 0.5, roughness: 0.2, emissive: '#ffb300', emissiveIntensity: 2.2 }));
    const halo = new T.Sprite(S.track(new T.SpriteMaterial({ map: S.sparkTex, color: '#fff2a8', transparent: true, opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false })));
    halo.scale.setScalar(4.2); wand.add(halo);
    const wandLight = new T.PointLight('#ffd76a', 12, 8, 1.6); wand.add(wandLight);
    scene.add(wand);
    const wp = new T.Vector3(0, 2, 1), wv = new T.Vector3();
    let zap = 0;

    // ---------- balloons ----------
    let balloons = [], spawn = 0.3, popped = 0, t = 0;
    const knotGeo = S.track(new T.ConeGeometry(0.16, 0.3, 12));
    const stringM = S.track(new T.LineBasicMaterial({ color: '#f0f0f0' }));
    function bounds() { const v = S.viewSize(CAM_Z); return { x: v.w - 1.2, yMin: GROUND_Y + 1.5, yMax: 3.2 + v.h - 1.2 }; }
    function addBalloon(y) {
      const B = bounds();
      const r = U.rand(0.95, 1.2), color = U.pick(U.RAINBOW);
      const g = new T.Group();
      const m = mat(color, { physical: true, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0.3 });
      const body = mesh(geo.sphere, m); body.scale.set(r, r * 1.18, r); g.add(body);
      const knot = mesh(knotGeo, m); knot.position.y = -r * 1.2; knot.rotation.x = Math.PI; g.add(knot);
      const pts = new Float32Array(10 * 3);
      const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.BufferAttribute(pts, 3));
      const line = new T.Line(lg, stringM);
      g.add(line);
      g.position.set(U.rand(-B.x, B.x), y ?? (GROUND_Y - 1), U.rand(-0.6, 0.6));
      g.scale.setScalar(0.01);
      scene.add(g);
      balloons.push({ g, body, r, color, pts, lg, speed: U.rand(1.1, 1.7), sway: Math.random() * 6, wob: 0, grow: 0, prize: U.pick([...U.ANIMALS, ...U.TREATS]) });
    }
    for (let i = 0; i < 4; i++) addBalloon(U.rand(-1, 8));

    function pop(b) {
      b.popped = true; popped++;
      sfx.pop(); sfx.note(popped % 10 + 3, { delay: 0.05 });
      S.sparkle(b.g.position, b.color, 60, 9, { gravity: 9, life: 1.1, glow: 2.2 });
      S.sparkle(b.g.position, '#ffffff', 20, 5, { gravity: 2, life: 0.6 });
      const sp = S.toScreen(b.g.position);
      api.fx.floatEmoji(sp.x, sp.y, b.prize, { size: Math.max(70, api.h * 0.11), life: 1.8, vy: -90 });
      input.rumble(0.45, 90);
      S.shake(0.05);
      scene.remove(b.g); b.lg.dispose();
      if (popped % 8 === 0) api.celebrate();
    }

    return {
      resize: S.resize,
      update(dt) {
        t += dt;
        const B = bounds();
        const sp = 11 * CONFIG.stickSpeed;
        wv.x = U.lerp(wv.x, input.x * sp, Math.min(1, dt * 7));
        wv.y = U.lerp(wv.y, -input.y * sp, Math.min(1, dt * 7));
        wp.x = U.clamp(wp.x + wv.x * dt, -B.x, B.x);
        wp.y = U.clamp(wp.y + wv.y * dt, B.yMin, B.yMax);
        zap = Math.max(0, zap - dt * 4);
        wand.position.set(wp.x, wp.y, 1);
        wand.rotation.z = Math.sin(t * 2) * 0.2 - wv.x * 0.03 + zap * 2;
        wand.rotation.y = t * 1.5;
        wand.scale.setScalar(1 + zap * 0.35);
        if (input.moving && Math.random() < 0.6) S.sparkle(wand.position, U.pick(['#fff2a8', '#ffd23f', '#ffffff']), 2, 1, { gravity: 1.5, life: 0.7 });

        spawn -= dt;
        if (spawn <= 0 && balloons.length < 7) { addBalloon(); spawn = U.rand(0.9, 1.5); }

        const reach = 2.2;
        for (const b of balloons) {
          b.grow = Math.min(1, b.grow + dt * 2);
          b.g.position.y += b.speed * dt; b.sway += dt;
          b.g.position.x += Math.sin(b.sway * 1.3) * 0.5 * dt;
          b.hover = Math.hypot(b.g.position.x - wp.x, b.g.position.y - wp.y) < reach && b.grow > 0.5;
          b.wob = b.hover ? b.wob + dt * 12 : 0;
          const wob = Math.sin(b.wob) * 0.12;
          b.g.rotation.z = wob + Math.sin(b.sway) * 0.06;
          b.g.scale.setScalar(U.ease(b.grow) * (1 + Math.sin(b.wob * 1.3) * 0.03));
          // string sways below the balloon
          for (let k = 0; k < 10; k++) {
            const f = k / 9;
            b.pts[k * 3] = Math.sin(b.sway * 2 + f * 3) * 0.25 * f;
            b.pts[k * 3 + 1] = -b.r * 1.32 - f * 3.2;
            b.pts[k * 3 + 2] = 0;
          }
          b.lg.attributes.position.needsUpdate = true;
        }

        if (input.actions.length) {
          zap = 1;
          const hits = balloons.filter(b => b.hover);
          if (hits.length) hits.forEach(pop);
          else { sfx.chime(); }
          S.sparkle(wand.position, '#fff2a8', 24, 5, { life: 0.6 });
        }
        balloons = balloons.filter(b => { if (b.popped) return false; if (b.g.position.y > B.yMax + 6) { scene.remove(b.g); b.lg.dispose(); return false; } return true; });
        clouds.forEach(c => { c.position.x += c.userData.v * dt; if (c.position.x > 50) c.position.x = -50; });
        S.update(dt);
      },
      draw(ctx) {
        S.render();
        ctx.clearRect(0, 0, api.w, api.h);
        const p = 0.5 + Math.sin(t * 8) * 0.5;
        for (const b of balloons) {
          if (!b.hover) continue;     // hint: "press a button!"
          const sp = S.toScreen(new T.Vector3(b.g.position.x, b.g.position.y + b.r * 1.7, b.g.position.z));
          [[0, 1], [1, 0], [-1, 0], [0, -1]].forEach(([dx, dy], i) => {
            ctx.globalAlpha = 0.75 + p * 0.25; ctx.fillStyle = U.BTN_COLORS[i];
            ctx.beginPath(); ctx.arc(sp.x + dx * 17, sp.y + dy * 17, 9 + p * 2, 0, Math.PI * 2); ctx.fill();
          });
        }
        ctx.globalAlpha = 1;
      },
      destroy: S.destroy,
    };
  },
});
