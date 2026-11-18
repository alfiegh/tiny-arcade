// TREASURE SEAS (3D) — sail an endless ocean of pirate islands, hop ashore, dig up treasure and find your crew.
// Made to explore and to learn the controller: every button does one clear thing, the same on sea and on land
// where it can (bottom = hop/jump, right = cannon/sword, top = spyglass/dig, left = horn/wave, L/R, ZL/ZR).
//
//   SAILING  stick: sail that way   A: hop the ship   B: fire the cannon   L / R: side cannons
//            X: spyglass (red dashes point to the nearest treasure or crewmate)   Y: ship's horn   ZL / ZR: wind boost
//   ON LAND  stick: walk   A: jump   B: sword (smash barrels)   X: dig (3 digs on a red X = treasure chest)
//            Y: wave   L / R: play the lute (skeletons dance)   ZL / ZR: run
//
// Sail into a beach to go ashore; walk back to your ship to sail on. The other pirates wait on islands and join your
// crew when you find them. Sharks leap, kraken tentacles play peekaboo (a cannonball makes them duck and drop gems),
// fish jump, a big galleon cruises around. No losing, no timer, no reading. Models: Quaternius "Pirate Kit" (CC0).
Games.register({
  id: 'treasure-seas', name: 'Treasure Seas', emoji: '🏴‍☠️', color: '#1fa5c9',
  assets: ['pirate/'],   // lazily loaded pack
  create(api) {
    const { input, sfx } = api;
    const game = this;
    const S = Kit3D.stage(api, { fog: ['#c4ecff', 70, 170], bloom: [0.3, 0.5, 1.35], exposure: 1.0, fov: 45, envIntensity: 0.6 });
    const { T, scene, camera, geo, mat, mesh } = S;
    const sky = Kit3D.sky(S, '#2f8fe0', '#bfe9ff', '#c4ecff', { sunDir: new T.Vector3(0.5, 0.5, -0.6) });
    scene.add(new T.HemisphereLight('#e6f7ff', '#c9a86a', 0.95));
    const sun = Kit3D.sun(S, { intensity: 1.9, offset: [14, 26, 10], size: 34 });

    const PIRATES = ['Characters_Captain_Barbarossa', 'Characters_Anne', 'Characters_Henry', 'Characters_Mako', 'Characters_Sharky'];
    const CELL = 64, ISLAND_Y = 0.55;

    // ---------- model helpers ----------
    const A = n => Assets.get('pirate/' + n);
    const tidy = m => { m.roughness = Math.max(m.roughness ?? 1, 0.55); m.metalness = 0; };
    const sizeCache = {};
    function prop(name, { height, scale = 1, shadow = true } = {}) {
      const src = A(name); const g = new T.Group(); if (!src) return g;
      const m = src.scene.clone(true);
      if (!sizeCache[name]) { const b = new T.Box3().setFromObject(src.scene); sizeCache[name] = { h: b.max.y - b.min.y, y0: b.min.y }; }
      if (height) scale = height / sizeCache[name].h;
      m.scale.setScalar(scale);
      m.traverse(n => { if (n.isMesh) { n.castShadow = shadow; n.receiveShadow = true; tidy(n.material); } });
      g.add(m); return g;
    }
    const grounded = (name, o) => { const g = prop(name, o); const c = g.children[0]; if (c) c.position.y = -sizeCache[name].y0 * c.scale.x; return g; };
    function actor(name, { height, scale } = {}) {
      const asset = A(name), root = new T.Group(), model = T.SkeletonUtils.clone(asset.scene); root.add(model);
      model.traverse(n => { if (n.isMesh) { n.castShadow = true; n.frustumCulled = false; tidy(n.material); } });
      if (height || scale) { const b = new T.Box3().setFromObject(model, true), s = scale || height / (b.max.y - b.min.y); model.scale.setScalar(s); }
      const mixer = new T.AnimationMixer(model), acts = {};
      asset.animations.forEach(c => { acts[c.name] = mixer.clipAction(c); });
      let cur = null, oneT = 0;
      function to(n, loop, ts) {
        const a = acts[n]; if (!a) return false;
        if (cur === a && loop) { a.setEffectiveTimeScale(ts); return true; }
        a.reset(); a.setLoop(loop ? T.LoopRepeat : T.LoopOnce, Infinity); a.clampWhenFinished = !loop; a.setEffectiveTimeScale(ts); a.play();
        if (cur && cur !== a) a.crossFadeFrom(cur, 0.15, false);
        cur = a; return true;
      }
      return {
        root, model, has: n => !!acts[n],
        loop(n, ts = 1) { if (oneT <= 0) to(n, true, ts); },
        once(n, ts = 1) { if (to(n, false, ts)) oneT = acts[n].getClip().duration / ts * 0.85; },
        busy: () => oneT > 0,
        update(dt) { oneT -= dt; mixer.update(dt); },
      };
    }
    const yawTo = (cur, target, k) => { let d = target - cur; d = Math.atan2(Math.sin(d), Math.cos(d)); return cur + d * k; };

    // ---------- sea ----------
    const waveTex = S.canvasTex(256, (g, s) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(190,235,255,${U.rand(0.35, 0.7)})`; g.lineWidth = U.rand(2, 4); g.beginPath(); const x = U.rand(0, s), y = U.rand(0, s), w = U.rand(14, 40); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 6, x + w, y); g.stroke(); }
    }, { repeat: 60 });
    const sea = new T.Mesh(S.track(new T.PlaneGeometry(700, 700)), S.track(new T.MeshStandardMaterial({ color: '#28aee0', map: waveTex, roughness: 0.25, metalness: 0 })));
    sea.rotation.x = -Math.PI / 2; sea.receiveShadow = true; scene.add(sea);
    const sandTex = S.canvasTex(256, (g, s) => { g.fillStyle = '#f3d9a2'; g.fillRect(0, 0, s, s); for (let i = 0; i < 2600; i++) { g.fillStyle = `hsl(${U.rand(35, 45)} ${U.rand(50, 70)}% ${U.rand(68, 86)}%)`; g.fillRect(U.rand(0, s), U.rand(0, s), 2, 2); } }, { repeat: 4 });
    const sandM = S.track(new T.MeshStandardMaterial({ map: sandTex, roughness: 0.95 }));
    const shoreTex = S.canvasTex(256, (g, s) => {   // shallow turquoise ring with a white foam line at the beach
      const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      r.addColorStop(0, 'rgba(120,230,240,.9)'); r.addColorStop(0.74, 'rgba(120,230,240,.85)'); r.addColorStop(0.78, 'rgba(255,255,255,.95)');
      r.addColorStop(0.83, 'rgba(110,225,235,.7)'); r.addColorStop(1, 'rgba(60,190,230,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s);
    }, { clamp: true });
    const shoreM = S.track(new T.MeshBasicMaterial({ map: shoreTex, transparent: true, depthWrite: false }));
    const splashM = S.track(new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false }));
    const fx = [];   // short-lived bits: splashes, flying coins, cannonballs, debris
    function splash(x, z, big = 1) {
      S.sparkle(new T.Vector3(x, 0.3, z), '#e8fbff', 16 * big, 4 * big, { gravity: 9, glow: 1.05, life: 0.7 });
      S.ring(new T.Vector3(x, 0.06, z), '#ffffff', 2.2 * big, 0.6, 0.6);
    }

    // ---------- islands & sea life, built per cell around you ----------
    const cellState = new Map();   // remembers what you've done on every island
    const built = new Map(), queue = [];
    const islands = [], floats = [], sharks = [], krakens = [], galleons = [];
    let crewLeft = [];            // pirates still waiting somewhere (filled after you pick yours)
    const assigned = new Set();
    const H = (i, j, k) => Kit3D.hash(i * 7.31 + k * 13.7, j * 3.17 - k * 5.3);
    const stateOf = key => { let s = cellState.get(key); if (!s) cellState.set(key, s = { taken: new Set() }); return s; };
    const GOLD_PICKS = ['UI_Gold', 'Prop_Coins', 'UI_ChickenLeg', 'UI_Wheat', 'UI_Wood', 'UI_Rocks', 'UI_Paper', 'UI_Swords', 'Prop_GoldBag'];
    const GEMS = ['UI_Gem_Blue', 'UI_Gem_Green', 'UI_Gem_Pink'];

    function buildCell(i, j) {
      const key = i + ',' + j, st = stateOf(key), cell = { key, i, j, group: new T.Group(), actors: [], island: null, sea: [] };
      scene.add(cell.group);
      const cx = i * CELL + (H(i, j, 1) - 0.5) * 22, cz = j * CELL + (H(i, j, 2) - 0.5) * 22;
      const start = i === 0 && j === 0;
      if (start || H(i, j, 3) > 0.28) {
        const types = ['palm', 'town', 'skull', 'cliff', 'palm', 'tiny', 'town', 'cliff'];
        const type = start ? 'town' : types[Math.floor(H(i, j, 4) * types.length)];
        cell.island = buildIsland(cell, st, start ? 0 : cx, start ? 0 : cz, type, start);
      }
      // sea life around (kept away from the island)
      const free = (x, z, pad) => !cell.island || Math.hypot(x - cell.island.x, z - cell.island.z) > cell.island.R + pad;
      const rnd = k => H(i, j, 10 + k);
      for (let k = 0; k < 3; k++) {
        const x = i * CELL + (rnd(k) - 0.5) * CELL, z = j * CELL + (rnd(k + 5) - 0.5) * CELL, id = 'f' + k;
        if (st.taken.has(id) || !free(x, z, 5) || (start && Math.hypot(x, z) < 26)) continue;
        const kind = ['Prop_Barrel', 'Prop_Bottle_1', 'Prop_GoldBag', 'Prop_Barrel', 'Prop_Bottle_2'][Math.floor(rnd(k + 9) * 5)];
        const m = prop(kind, { height: kind === 'Prop_Barrel' ? 1.1 : 0.8 }); m.position.set(x, 0, z); cell.group.add(m);
        floats.push({ cell, st, id, m, x, z, kind, ph: rnd(k + 2) * 6 });
      }
      if (!start && rnd(20) < 0.3) {   // a friendly shark circling
        const a = actor('Characters_Shark', { scale: 0.65 }); a.loop('Swim'); cell.group.add(a.root);
        const c = { x: i * CELL + (rnd(21) - 0.5) * 30, z: j * CELL + (rnd(22) - 0.5) * 30 };
        if (free(c.x, c.z, 9)) sharks.push({ cell, a, c, r: 7, ang: rnd(23) * 6, leap: 0, cool: 2 }); else cell.group.remove(a.root);
      }
      if (!start && rnd(24) < 0.22) {  // kraken tentacles playing peekaboo
        const c = { x: i * CELL + (rnd(25) - 0.5) * 34, z: j * CELL + (rnd(26) - 0.5) * 34 };
        if (free(c.x, c.z, 10)) {
          const k = { cell, c, arms: [] };
          [[0, 0, 'big'], [3.5, 1.5, 'big'], [-3, 2.5, 'small'], [1.5, -3, 'small']].forEach(([dx, dz, size], n) => {
            const big = size === 'big';
            const o = big ? actor('Characters_Tentacle', { height: 7 }) : null;
            const root = big ? o.root : prop('Enemy_Tentacle', { height: 4 });
            if (o) o.loop('Tentacle_Idle', 0.8 + n * 0.1);
            root.position.set(c.x + dx, -8, c.z + dz); root.rotation.y = rnd(27 + n) * 6; cell.group.add(root);
            k.arms.push({ root, a: o, x: c.x + dx, z: c.z + dz, y: -8, down: 0, ph: n * 1.3 });
          });
          krakens.push(k);
        }
      }
      if (!start && rnd(30) < 0.12) {  // the big galleon cruising in circles
        const g = prop('Ship_Large', { scale: 1 }); g.children[0].rotation.y = Math.PI / 2; cell.group.add(g);
        galleons.push({ cell, g, c: { x: i * CELL, z: j * CELL }, r: 24, ang: rnd(31) * 6, puff: 3 });
      }
      built.set(key, cell);
    }
    function dropCell(cell) {
      scene.remove(cell.group);
      for (const list of [islands, floats, sharks, krakens, galleons]) for (let k = list.length - 1; k >= 0; k--) if (list[k].cell === cell) list.splice(k, 1);
      if (cell.island && cell.island.crewName && !cell.island.st.crewTaken) assigned.delete(cell.island.crewName);
      built.delete(cell.key);
    }

    function buildIsland(cell, st, x, z, type, start) {
      const R = { palm: 11, town: 15, skull: 13, cliff: 13, tiny: 6 }[type];
      const I = { cell, st, x, z, R, type, colliders: [], picks: [], breakables: [], skeletons: [], tall: [], xMark: null, crew: null, crewName: null };
      const g = new T.Group(); g.position.set(x, 0, z); cell.group.add(g); I.g = g;
      const sand = new T.Mesh(S.track(new T.CylinderGeometry(R, R + 1.4, 1.6, 48)), sandM); sand.position.y = ISLAND_Y - 0.8; sand.receiveShadow = true; g.add(sand);
      const shore = new T.Mesh(S.track(new T.CircleGeometry((R + 1.2) / 0.78, 48)), shoreM); shore.rotation.x = -Math.PI / 2; shore.position.y = 0.03; g.add(shore);
      const rnd = (() => { let s = H(cell.i, cell.j, 40) * 1000 + 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
      const place = (obj, ang, dist, { r = 0, y = ISLAND_Y, rot } = {}) => {
        const px = Math.cos(ang) * dist, pz = Math.sin(ang) * dist;
        obj.position.set(px, y, pz); obj.rotation.y = rot ?? rnd() * 6.28; g.add(obj);
        if (r) I.colliders.push({ x: x + px, z: z + pz, r });
        return obj;
      };
      const tall = (obj, r) => {   // big scenery fades out when it stands between the camera and you
        const mats = []; obj.traverse(n => { if (n.isMesh) { n.material = n.material.clone(); n.material.transparent = true; mats.push(n.material); } });
        I.tall.push({ obj, mats, x: x + obj.position.x, z: z + obj.position.z, r, op: 1 }); return obj;
      };
      const ring = (n, d0, d1, fn) => { for (let k = 0; k < n; k++) fn(rnd() * 6.28, d0 + rnd() * (d1 - d0), k); };
      const palms = (n, d0 = 2, d1 = R - 2) => ring(n, d0, d1, (a, d) => tall(place(grounded('Environment_PalmTree_' + (1 + Math.floor(rnd() * 3)), { height: 3.6 + rnd() * 1.6 }), a, d, { r: 0.6 }), 1.6));
      const rocks = n => ring(n, 2, R - 1.2, (a, d) => place(grounded('Environment_Rock_' + (1 + Math.floor(rnd() * 5)), { height: 0.5 + rnd() * 0.6 }), a, d, { r: 0.4 }));
      const pick = (name, a, d, gold, gem) => {   // a spinning goodie to walk into
        const id = 'p' + I.picks.length; if (st.taken.has(id)) { I.picks.push(null); return; }
        const m = prop(name, { height: name.startsWith('UI_Gem') ? 0.75 : 0.6 }); const o = place(m, a, d, { y: ISLAND_Y + 0.9 });
        I.picks.push({ id, m: o, wx: x + o.position.x, wz: z + o.position.z, gold, gem, ph: rnd() * 6 });
      };
      const goodies = n => ring(n, 1.5, R - 1.8, (a, d) => { const isGem = rnd() < 0.35; const name = isGem ? GEMS[Math.floor(rnd() * 3)] : GOLD_PICKS[Math.floor(rnd() * GOLD_PICKS.length)]; pick(name, a, d, isGem ? 0 : name === 'Prop_GoldBag' ? 5 : name === 'UI_Gold' || name === 'Prop_Coins' ? 3 : 1, isGem ? name : null); });
      const barrel = (a, d) => { const id = 'b' + I.breakables.length; if (st.taken.has(id)) { I.breakables.push(null); return; } const m = place(grounded('Prop_Barrel', { height: 1.1 }), a, d, { r: 0.55 }); I.breakables.push({ id, m, wx: x + m.position.x, wz: z + m.position.z, col: I.colliders[I.colliders.length - 1] }); };
      const treasure = (gold) => {   // a red X (with a dotted trail from the beach) hiding a chest
        const a = rnd() * 6.28, d = R * 0.45;
        const xm = place(prop('UI_Red_X', { scale: 1.3 }), a, d, { y: ISLAND_Y + 0.03 });
        I.xMark = { m: xm, wx: x + xm.position.x, wz: z + xm.position.z, digs: 0, gold, done: !!st.dug };
        if (st.dug) { xm.visible = false; const c = place(grounded('Prop_Chest_Gold', { height: 1.2 }), a, d, { r: 0.8 }); c.rotation.y = -a - Math.PI / 2; }
        for (let k = 1; k <= 4; k++) { const dd = d + k * 1.35; if (dd > R - 0.8) break; place(prop('UI_Red_Dash', { scale: 1.6 }), a, dd, { y: ISLAND_Y + 0.03, rot: -a }); }
      };
      const crew = () => {     // one of the missing pirates may wait here
        if (start) return;
        if (!st.crewChecked) { st.crewChecked = true; const free = crewLeft.filter(n => !assigned.has(n)); if (free.length && rnd() < 0.75) st.crew = free[0]; }
        if (!st.crew || st.crewTaken || !crewLeft.includes(st.crew) || assigned.has(st.crew)) return;   // still missing and not shown elsewhere
        assigned.add(st.crew); I.crewName = st.crew;
        const a = actor(st.crew); a.loop('Idle'); const ang = Math.PI / 2 + (rnd() - 0.5);   // on the south beach, facing the sea
        a.root.position.set(x + Math.cos(ang) * (R - 2.2), ISLAND_Y, z + Math.sin(ang) * (R - 2.2)); a.root.rotation.y = 0; cell.group.add(a.root);
        I.crew = { a, name: st.crew, waveT: 1 };
      };

      if (type === 'palm') { palms(5); rocks(4); treasure(10); goodies(3); place(grounded('Prop_Bucket', { height: 0.6 }), rnd() * 6, R - 2.5, { r: 0.4 }); crew(); }
      else if (type === 'tiny') { palms(1, 0.5, 1.5); rocks(1); goodies(2); place(grounded(rnd() < 0.5 ? 'Prop_Bottle_1' : 'Prop_Bottle_2', { height: 0.7 }), rnd() * 6, 3, { r: 0.3 }).rotation.z = 1.3; }
      else if (type === 'cliff') {
        ring(3, R - 3.5, R - 2.5, (a, d, k) => { const ang = -Math.PI / 2 + (k - 1) * 0.9 + (rnd() - 0.5) * 0.3; tall(place(grounded('Environment_Cliff' + (1 + Math.floor(rnd() * 4)), { height: 5 + rnd() * 2.5 }), ang, d, { r: 3.2, y: ISLAND_Y - 0.6 }), 4); });
        palms(2, 2, R * 0.5); rocks(3); goodies(4); treasure(12);
        place(grounded('Prop_Bottle_2', { height: 0.7 }), rnd() * 6, 4, { r: 0.3 }); crew();
      } else if (type === 'skull') {
        tall(place(grounded('Environment_Skulls', { height: 6 }), -Math.PI / 2, R - 4.5, { r: 3.4, rot: 0, y: ISLAND_Y - 0.9 }), 4);
        place(grounded('Environment_LargeBones', { height: 2.6 }), Math.PI * 0.15, R * 0.55, { r: 2.4 });
        ring(3, 3, R - 2, (a, d) => place(grounded('Prop_Skull', { height: 0.5 }), a, d));
        place(grounded('Prop_Bomb', { height: 0.6 }), rnd() * 6, R - 3, { r: 0.3 });
        const sw = place(prop('Weapon_Cutlass', { height: 1.2 }), rnd() * 6, R * 0.35, { y: ISLAND_Y + 0.35 }); sw.rotation.z = 0.25;
        ['Characters_Skeleton', 'Characters_Skeleton_Headless'].forEach((n, k) => {
          const a = actor(n); a.loop('Idle'); const ang = Math.PI * (0.6 + k * 0.5), d = R * 0.5;
          a.root.position.set(x + Math.cos(ang) * d, ISLAND_Y, z + Math.sin(ang) * d); cell.group.add(a.root);
          I.skeletons.push({ a, dance: 0 }); I.colliders.push({ x: a.root.position.x, z: a.root.position.z, r: 0.5 });
        });
        treasure(20); goodies(3); palms(1, R - 3, R - 2);
      } else if (type === 'town') {
        const big = rnd() < 0.5 ? 'Environment_House1' : 'Environment_House3';
        tall(place(grounded(big, { scale: 0.75 }), -Math.PI / 2, R * 0.45, { r: 4.2, rot: 0 }), 5.5);
        tall(place(grounded('Environment_House2', { scale: 0.75 }), -Math.PI * 0.12, R * 0.62, { r: 1.8 }), 2.5);
        // dock sticking out into the sea, with poles, an anchor and a bucket of fish
        const da = Math.PI * (start ? 0.5 : 0.35 + rnd() * 0.3);
        for (let k = 0; k < 3; k++) { const dock = grounded(k === 2 && rnd() < 0.6 ? 'Environment_Dock_Broken' : 'Environment_Dock', { scale: 1.1 }); place(dock, da, R - 0.6 + k * 2.4, { y: -2.15, rot: -da + Math.PI }); }
        place(grounded('Environment_Dock_Pole', { scale: 1.1 }), da + 0.12, R + 6.5, { y: -2.15 });
        place(grounded('Prop_Anchor', { scale: 1.2 }), da - 0.18, R - 1.8, { r: 0.5 });   // lies flat (scale, not height)
        place(grounded('Prop_Bucket_Fishes', { height: 0.7 }), da + 0.22, R - 1.8, { r: 0.5 });
        place(grounded('Prop_Fish_Tuna', { height: 0.5 }), da + 0.32, R - 2.4).rotation.z = Math.PI / 2;
        // cannon looking out to sea with balls and a bomb
        const ca = da + Math.PI * 0.45;
        place(grounded('Prop_Cannon', { height: 1.1 }), ca, R - 2, { r: 0.9, rot: -ca + Math.PI });
        place(grounded('Prop_CannonBall', { height: 0.35 }), ca + 0.12, R - 2.8); place(grounded('Prop_CannonBall', { height: 0.35 }), ca + 0.16, R - 3.2);
        place(grounded('Prop_Bomb', { height: 0.6 }), ca - 0.15, R - 2.9, { r: 0.3 });
        // sawmill + wood, weapons laid out on the barrels
        place(grounded('Environment_Sawmill', { height: 0.7 }), Math.PI * 1.1, R * 0.55, { r: 1.2 });
        place(grounded('UI_Wood', { height: 0.6 }), Math.PI * 1.17, R * 0.72);
        const weapons = ['Weapon_Pistol', 'Weapon_Rifle', 'Weapon_AxeRifle', 'Weapon_DoubleShotgun', 'Weapon_Axe', 'Weapon_Dagger', 'Weapon_DoubleAxe', 'Weapon_Sword_1', 'Weapon_Sword_2'];
        for (let k = 0; k < 2; k++) { const w = place(prop(weapons[Math.floor(rnd() * weapons.length)], { height: 1 }), Math.PI * (0.85 + k * 0.08), R * 0.38, { y: ISLAND_Y + 0.12 }); w.rotation.set(Math.PI / 2, 0, rnd() * 6); }
        place(grounded('Prop_Chest_Closed', { height: 0.8 }), Math.PI * 0.95, R * 0.25, { r: 0.7 });
        for (let k = 0; k < 4; k++) barrel(Math.PI * (0.62 + k * 0.1), R * 0.48 + (k % 2) * 1.2);
        if (start) [Math.PI * 1.15, Math.PI * 1.85, Math.PI * 0.05].forEach(a => place(grounded('Environment_PalmTree_1', { height: 4.2 }), a, R - 2.5, { r: 0.6 }));   // keep the pick-your-pirate beach clear
        else { palms(3, R - 4, R - 2); goodies(2); crew(); }
      }
      islands.push(I);
      return I;
    }
    function updateCells(px, pz, now) {
      const ci = Math.round(px / CELL), cj = Math.round(pz / CELL);
      for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) { const k = (ci + di) + ',' + (cj + dj); if (!built.has(k) && !queue.includes(k)) queue.push(k); }
      // nearest first; one cell per frame so building never hitches
      queue.sort((a, b) => { const [ai, aj] = a.split(',').map(Number), [bi, bj] = b.split(',').map(Number); return Math.hypot(ai - ci, aj - cj) - Math.hypot(bi - ci, bj - cj); });
      for (let n = 0; n < (now ? 25 : 1) && queue.length; n++) { const [i, j] = queue.shift().split(',').map(Number); if (Math.abs(i - ci) <= 2 && Math.abs(j - cj) <= 2) buildCell(i, j); }
      for (const c of [...built.values()]) if (Math.abs(c.i - ci) > 3 || Math.abs(c.j - cj) > 3) dropCell(c);
    }

    // ---------- your ship ----------
    const ship = { root: new T.Group(), inner: new T.Group(), x: 5.3, z: 16.4, yaw: Math.PI / 2, vx: 0, vz: 0, hop: 0, hopV: 0, landCool: 0 };
    ship.root.add(ship.inner); scene.add(ship.root);
    const hull = prop('Ship_Small', { scale: 1.15 }); hull.children[0].rotation.y = Math.PI / 2; hull.position.y = -0.62; ship.inner.add(hull);
    const mast = mesh(geo.cyl, mat('#7a4f2a', { roughness: 0.8 })); mast.scale.set(0.09, 3.6, 0.09); mast.position.set(0, 2.0, 0.35); ship.inner.add(mast);
    const sailTex = S.canvasTex(128, (g, s) => { for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? '#f4efe4' : '#d8323a'; g.fillRect(k * s / 6, 0, s / 6, s); } });
    const sail = new T.Mesh(S.track(new T.PlaneGeometry(2.2, 1.9, 8, 4)), S.track(new T.MeshStandardMaterial({ map: sailTex, side: T.DoubleSide, roughness: 0.8 })));
    sail.position.set(0, 2.45, 0.38); sail.castShadow = true; ship.inner.add(sail);
    const sailBase = sail.geometry.attributes.position.array.slice();
    const flag = new T.Mesh(S.track(new T.PlaneGeometry(0.6, 0.38)), mat('#1d1d24', { side: T.DoubleSide })); flag.position.set(0.3, 3.95, 0.35); ship.inner.add(flag);
    const DECK = [[0, -1.1], [-0.55, 0.9], [0.55, 0.9], [-0.55, -0.2], [0.55, -0.2]];   // helm first, then crew spots (x, z on the boat)
    const DECK_Y = 0.3;
    // while you're ashore a gold arrow bobs over the ship ("that's the way back")
    const beacon = mesh(S.track(new T.ConeGeometry(0.45, 0.9, 4)), mat('#ffc61a', { emissive: '#ff9d00', emissiveIntensity: 0.4, roughness: 0.4 }), { shadow: false });
    beacon.rotation.x = Math.PI; scene.add(beacon);
    const wake = [];

    // ---------- you & your crew ----------
    let mode = 'pick', player = null, sel = game.pick || 0, stickHeld = false, settleT = 0.4, idleT = 0, t = 0;
    const me = { x: 0, z: 8, y: ISLAND_Y, vy: 0, yaw: 0, vx: 0, vz: 0, hop: null, lute: 0, island: null };
    const crew = [], trail = [];
    let edgeT = 0;
    let gold = 0, gems = { UI_Gem_Blue: 0, UI_Gem_Green: 0, UI_Gem_Pink: 0 }, nextCheer = 25;
    const spy = { t: 0, dashes: [] };
    const cands = PIRATES.map((n, i) => { const a = actor(n); a.root.position.set(-3.8 + i * 1.9, ISLAND_Y, 5); scene.add(a.root); a.loop('Idle'); return a; });
    const spot = new T.Mesh(S.track(new T.RingGeometry(0.75, 0.95, 40)), S.track(new T.MeshBasicMaterial({ color: '#fff2a8', transparent: true, opacity: 0.8, depthWrite: false })));
    spot.rotation.x = -Math.PI / 2; scene.add(spot);
    S.hero = () => {   // menu icon (tools/make-icons.js, hidden window only): your pirate next to an open treasure chest
      const p = cands[sel].root, c = grounded('Prop_Chest_Gold', { height: 1.1 }); c.position.set(p.position.x + 1.1, ISLAND_Y, p.position.z + 0.2); c.rotation.y = -0.5; scene.add(c);
      p.rotation.y = 0.3; return [p, c];
    };
    S.debug = { me, ship, islands, built, crew };   // DevTools
    S.state = () => ({ mode, x: +(mode === 'sail' ? ship.x : me.x).toFixed(1), z: +(mode === 'sail' ? ship.z : me.z).toFixed(1), gold, gems: Object.values(gems).reduce((a, b) => a + b, 0), crew: crew.length, waiting: islands.filter(I => I.crew).length, cells: built.size, islands: islands.length, onIsland: me.island && me.island.type, xDone: me.island && me.island.xMark && me.island.xMark.done });

    function coin(n = 1, at) {
      gold += n; sfx.note(19, { type: 'square', dur: 0.07, vol: 0.09 }); sfx.note(24, { type: 'square', dur: 0.2, vol: 0.09, delay: 0.07 });
      if (at) S.sparkle(at, '#ffd23f', 10, 3, { glow: 1.2, life: 0.6 });
      if (gold >= nextCheer) { nextCheer += 25; sfx.cheer(); input.rumble(0.4, 200); }
    }
    function fling(name, from, n = 1) {   // goodies spring out (chests, barrels, tentacles) and are counted straight away
      for (let k = 0; k < n; k++) {
        const m = prop(name, { height: 0.5 }); m.position.copy(from); scene.add(m);
        const a = Math.random() * 6.28, sp = U.rand(1.5, 3.5);
        fx.push({ m, vx: Math.cos(a) * sp, vy: U.rand(6, 9), vz: Math.sin(a) * sp, life: 0.9, spin: 8 });
      }
    }
    function addCrew(name, from) {
      const a = actor(name); a.root.position.copy(from); scene.add(a.root);
      crew.push({ a, name, x: from.x, z: from.z, y: from.y, yaw: 0 });
      crewLeft = crewLeft.filter(n => n !== name); assigned.delete(name);
    }
    function sword() {
      if (player.busy()) return;
      player.once('Sword', 1.4); sfx.whoosh(); input.rumble(0.2, 60);
      const fx0 = me.x + Math.sin(me.yaw) * 1.1, fz0 = me.z + Math.cos(me.yaw) * 1.1;
      for (const I of islands) {
        I.breakables.forEach((b, k) => {
          if (!b || Math.hypot(b.wx - fx0, b.wz - fz0) > 1.4) return;
          b.m.parent.remove(b.m); I.breakables[k] = null; I.st.taken.add(b.id); I.colliders.splice(I.colliders.indexOf(b.col), 1);
          sfx.drum('clap'); S.shake(0.08); S.sparkle(new T.Vector3(b.wx, 1, b.wz), '#c08a4a', 24, 4, { gravity: 8, glow: 1.05 });
          fling(Math.random() < 0.5 ? 'UI_Gold' : 'Prop_Coins', new T.Vector3(b.wx, 1.2, b.wz), 2); coin(3);
        });
        I.skeletons.forEach(s => { if (Math.hypot(s.a.root.position.x - fx0, s.a.root.position.z - fz0) < 1.6) { s.a.once('HitReact'); sfx.boing(); S.sparkle(s.a.root.position.clone().setY(1.4), '#fff6e0', 14, 3, { glow: 1.1 }); } });
      }
    }
    function dig() {
      if (player.busy()) return;
      player.once('Duck', 1.6); input.rumble(0.25, 80);
      const at = new T.Vector3(me.x + Math.sin(me.yaw) * 0.7, ISLAND_Y + 0.1, me.z + Math.cos(me.yaw) * 0.7);
      S.sparkle(at, '#e8c98a', 18, 3, { gravity: 8, glow: 1.0, life: 0.6 }); sfx.synth({ type: 'triangle', freq: 180, slideTo: 120, dur: 0.12, vol: 0.15 });
      const I = me.island, X = I && I.xMark;
      if (X && !X.done && Math.hypot(X.wx - at.x, X.wz - at.z) < 2) {
        X.digs++; X.m.scale.setScalar(1 + X.digs * 0.12); sfx.drum('tom');
        if (X.digs >= 3) openTreasure(I, X);
      } else if (Math.random() < 0.15) { fling('UI_Rocks', at); coin(1); }
    }
    function openTreasure(I, X) {
      X.done = true; I.st.dug = true; X.m.visible = false;
      const chest = grounded('Prop_Chest_Closed', { height: 1.1 }); chest.position.set(X.wx, ISLAND_Y - 1.2, X.wz); chest.rotation.y = me.yaw + Math.PI; scene.add(chest);
      fx.push({ m: chest, rise: 0, life: 99, chest: true, I, X });
      sfx.servo();
    }
    function openChestNow(e) {
      e.m.visible = false;
      const open = grounded('Prop_Chest_Gold', { height: 1.3 }); open.position.set(e.X.wx, ISLAND_Y, e.X.wz); open.rotation.copy(e.m.rotation); scene.add(open);
      e.I.cell.group.attach(open);
      const at = new T.Vector3(e.X.wx, ISLAND_Y + 1.2, e.X.wz);
      fling('UI_Gold', at, 5); fling('Prop_Coins', at, 3); fling(GEMS[Math.floor(Math.random() * 3)], at, 2);
      coin(e.X.gold, at); GEMS.forEach(g => { if (Math.random() < 0.6) gems[g]++; });
      api.celebrate(); sfx.firework(); setTimeout(() => sfx.firework(), 300); S.shake(0.2);
      [0, 200, 450].forEach(d => setTimeout(() => S.sparkle(at.clone().add(new T.Vector3(U.rand(-1, 1), U.rand(1, 3), U.rand(-1, 1))), U.pick(U.RAINBOW), 40, 5, { glow: 1.3 }), d));
    }
    function lute(dir) {
      me.lute = 2.2;
      const notes = dir > 0 ? [0, 4, 7, 12, 7, 12, 16] : [12, 7, 9, 5, 7, 4, 0];
      notes.forEach((n, k) => sfx.note(8 + n, { type: 'triangle', dur: 0.25, vol: 0.18, delay: k * 0.16 }));
      for (const I of islands) I.skeletons.forEach(s => { if (Math.hypot(s.a.root.position.x - me.x, s.a.root.position.z - me.z) < 14) s.dance = 2.5; });
      crew.forEach(c => c.a.once('Yes'));
      const sp = S.toScreen(new T.Vector3(me.x, ISLAND_Y + 2.4, me.z)); if (!sp.behind) api.fx.floatEmoji(sp.x, sp.y, U.pick(['🎵', '🎶']), { size: 60, life: 1.4 });
    }
    // the lute appears in the hand that holds the character's weapon while playing
    let luteMesh = null, weaponNode = null;
    function setupHands() {
      player.model.traverse(n => { if (!weaponNode && /^Weapon_/.test(n.name)) weaponNode = n; });
      if (weaponNode) { luteMesh = prop('Weapon_Lute', { scale: 1 }); luteMesh.visible = false; weaponNode.parent.add(luteMesh); luteMesh.position.copy(weaponNode.position); luteMesh.quaternion.copy(weaponNode.quaternion); }
    }

    // ---------- sea actions ----------
    function cannon(side) {   // side: 0 = forward, -1 = left, 1 = right
      const fwd = new T.Vector3(Math.sin(ship.yaw), 0, Math.cos(ship.yaw)), right = new T.Vector3(-fwd.z, 0, fwd.x);
      const dir = side === 0 ? fwd : right.clone().multiplyScalar(side);
      const from = new T.Vector3(ship.x, 1.2, ship.z).addScaledVector(dir, side === 0 ? 2.8 : 1.2);
      const ball = prop('Prop_CannonBall', { height: 0.45 }); ball.position.copy(from); scene.add(ball);
      fx.push({ m: ball, vx: dir.x * 17 + ship.vx, vy: 6, vz: dir.z * 17 + ship.vz, life: 3, ball: true });
      sfx.drum('kick'); sfx.synth({ type: 'sawtooth', freq: 90, slideTo: 40, dur: 0.3, vol: 0.2, cutoff: 500 }); input.rumble(0.6, 120); S.shake(0.1);
      S.sparkle(from, '#d9d9d9', 14, 3, { gravity: -1, glow: 1.0, life: 0.8 });
      ship.vx -= dir.x * 1.5; ship.vz -= dir.z * 1.5;
    }
    function ballLands(b) {
      const p = b.m.position;
      for (const k of krakens) k.arms.forEach(arm => {
        if (arm.down <= 0 && arm.y > -3 && Math.hypot(arm.x - p.x, arm.z - p.z) < 3) {
          arm.down = 7; sfx.pop(); sfx.boing(); splash(arm.x, arm.z, 1.6);
          const g = GEMS[Math.floor(Math.random() * 3)]; gems[g]++; fling(g, new T.Vector3(arm.x, 1, arm.z), 1); coin(2);
        }
      });
      for (const f of floats) if (!f.gone && Math.hypot(f.x - p.x, f.z - p.z) < 2.2) collectFloat(f);
      for (const g of galleons) if (Math.hypot(g.g.position.x - p.x, g.g.position.z - p.z) < 6) { S.sparkle(p.clone().setY(3), '#ffd23f', 30, 5, { glow: 1.2 }); coin(3); sfx.boop(); }
      sharks.forEach(s => { if (Math.hypot(s.a.root.position.x - p.x, s.a.root.position.z - p.z) < 5) s.leap = 1; });
      splash(p.x, p.z, 1.2); sfx.whoosh();
    }
    function collectFloat(f) {
      f.gone = true; f.st.taken.add(f.id); f.m.parent.remove(f.m); splash(f.x, f.z);
      const at = new T.Vector3(f.x, 1, f.z);
      if (f.kind === 'Prop_Barrel') { fling('UI_Gold', at, 2); coin(3, at); sfx.drum('clap'); }
      else if (f.kind === 'Prop_GoldBag') { fling('Prop_Coins', at, 3); coin(5, at); }
      else { fling('UI_Paper', at, 1); const g = GEMS[Math.floor(Math.random() * 3)]; gems[g]++; coin(2, at); sfx.sparkle(); }
    }
    function spyglass() {
      // nearest unopened treasure or waiting crewmate (else the nearest island you haven't landed on)
      let best = null, bd = 1e9; const px = ship.x, pz = ship.z;
      for (const I of islands) {
        const want = (I.xMark && !I.xMark.done) || (I.crew && !I.st.crewTaken), d = Math.hypot(I.x - px, I.z - pz);
        const score = want ? d : I.st.visited ? 1e9 : d + 60;
        if (score < bd) { bd = score; best = I; }
      }
      spy.dashes.forEach(d => scene.remove(d.m)); spy.dashes = [];
      if (!best) return;
      const ang = Math.atan2(best.x - px, best.z - pz), len = Math.min(Math.hypot(best.x - px, best.z - pz) - best.R - 2, 26);
      for (let k = 0; k < Math.max(2, Math.floor(len / 2.6)); k++) {
        const m = prop('UI_Red_Dash', { scale: 2.6, shadow: false }); const d = 3 + k * 2.6;
        m.position.set(px + Math.sin(ang) * d, 0.06, pz + Math.cos(ang) * d); m.rotation.y = ang + Math.PI / 2; m.visible = false; scene.add(m);
        spy.dashes.push({ m, at: k * 0.09 });
      }
      spy.t = 6; sfx.sparkle(); sfx.chime();
    }

    // ---------- pick your pirate ----------
    function choose(d) { sel = (sel + d + PIRATES.length) % PIRATES.length; settleT = 0.25; sfx.tick(); sfx.whoosh(); input.rumble(0.2, 50); }
    function pick() {
      mode = 'walk'; game.pick = sel; player = cands[sel];
      cands.forEach(c => { if (c !== player) { S.sparkle(c.root.position.clone().setY(1.2), U.pick(U.RAINBOW), 24, 4, { glow: 1.2 }); scene.remove(c.root); } });
      crewLeft = PIRATES.filter((n, i) => i !== sel);
      for (const c of [...built.values()]) if (c.island) { const s = c.island.st; delete s.crewChecked; }
      for (const c of [...built.values()]) dropCell(c);   // rebuild so the missing crew can be waiting on islands
      updateCells(0, 0, true);
      me.x = player.root.position.x; me.z = player.root.position.z; me.island = islands.find(I => I.cell.key === '0,0'); me.island.st.visited = true;
      player.once('Yes'); sfx.cheer(); input.rumble(0.5, 200); spot.visible = false;
      setupHands();
    }
    function updatePicker(dt) {
      for (const b of input.pressed) {
        if (b === 14 || b === 4 || b === 6) choose(-1);
        else if (b === 15 || b === 5 || b === 7) choose(1);
        else if (b === 12 || b === 13) { cands[sel].once('Wave'); sfx.chime(); }
        else if ([0, 1, 2, 3, 9].includes(b)) { pick(); return; }
      }
      if (input.down.has(14) || input.down.has(15)) stickHeld = true;
      else if (Math.abs(input.x) > 0.6) { if (!stickHeld) { choose(input.x > 0 ? 1 : -1); stickHeld = true; } }
      else if (Math.abs(input.x) < 0.3) stickHeld = false;
      settleT -= dt; idleT -= dt;
      if (settleT <= 0 && settleT > -dt * 1.5) { cands[sel].once('Wave'); sfx.note(7 + sel * 2); idleT = 3; }
      if (idleT <= 0 && settleT < 0) { idleT = 3; cands[sel].once(U.pick(['Wave', 'Yes'])); }
      cands.forEach((c, i) => {
        const on = i === sel; c.root.scale.setScalar(U.lerp(c.root.scale.x, on ? 1.3 : 0.95, Math.min(1, dt * 8)));
        c.root.rotation.y = U.lerp(c.root.rotation.y, on ? 0 : (i < sel ? 0.5 : -0.5), Math.min(1, dt * 6)); c.update(dt);
      });
      spot.position.set(cands[sel].root.position.x, ISLAND_Y + 0.03, 5); spot.material.opacity = 0.6 + Math.sin(t * 4) * 0.2;
      camera.position.lerp(new T.Vector3(0, 4.3, 15), Math.min(1, dt * 3)); camera.lookAt(0, 1.4, 5);
    }

    // ---------- walking ----------
    function updateWalk(dt) {
      for (const b of input.pressed) {
        if (b === 0 && me.y <= ISLAND_Y + 0.01 && !me.hop) { me.vy = 7; player.once('Jump', 1.4); sfx.boing(); }
        else if (b === 1) sword();
        else if (b === 3) dig();
        else if (b === 2) { player.once('Wave'); sfx.synth({ type: 'triangle', freq: 523, dur: 0.15, vol: 0.15 }); sfx.synth({ type: 'triangle', freq: 784, dur: 0.25, vol: 0.15, delay: 0.15 }); crew.forEach(c => c.a.once('Wave')); for (const I of islands) I.skeletons.forEach(s => s.a.once('Wave')); if (me.island && me.island.crew) me.island.crew.a.once('Wave'); }
        else if (b === 4) lute(-1); else if (b === 5) lute(1);
      }
      if (me.hop) {   // hopping between ship and island
        const h = me.hop; h.t += dt / 0.6; const k = Math.min(1, h.t);
        me.x = U.lerp(h.fx, h.tx, k); me.z = U.lerp(h.fz, h.tz, k); me.y = U.lerp(h.fy, h.ty, k) + Math.sin(k * Math.PI) * 1.6;
        if (k >= 1) { me.hop = null; if (h.then) h.then(); }
      } else {
        const run = input.down.has(6) || input.down.has(7), sp = (run ? 7.5 : 4.6) * CONFIG.stickSpeed;
        me.vx = U.lerp(me.vx, input.x * sp, Math.min(1, dt * 8)); me.vz = U.lerp(me.vz, input.y * sp, Math.min(1, dt * 8));
        if (me.lute > 0) { me.vx *= 0.3; me.vz *= 0.3; }
        me.x += me.vx * dt; me.z += me.vz * dt;
        const spd = Math.hypot(me.vx, me.vz); if (spd > 0.4) me.yaw = yawTo(me.yaw, Math.atan2(me.vx, me.vz), Math.min(1, dt * 10));
        const I = me.island;
        I.colliders.forEach(c => { const dx = me.x - c.x, dz = me.z - c.z, d = Math.hypot(dx, dz), m = c.r + 0.35; if (d < m && d > 0.001) { me.x = c.x + dx / d * m; me.z = c.z + dz / d * m; } });
        const dx = me.x - I.x, dz = me.z - I.z, d = Math.hypot(dx, dz), lim = I.R - 0.5;
        if (d > lim) {
          if (Math.hypot(me.x - ship.x, me.z - ship.z) < 6) board();   // walk to the ship to sail on
          else {
            me.x = I.x + dx / d * lim; me.z = I.z + dz / d * lim;
            edgeT += dt; if (edgeT > 1) { if (!ship.come) sfx.horn(); ship.come = { I, ang: Math.atan2(dz, dx) }; }   // keep pushing at the beach: the ship sails round to you
          }
        } else edgeT = 0;
        me.vy -= 22 * dt; me.y = Math.max(ISLAND_Y, me.y + me.vy * dt); if (me.y === ISLAND_Y) me.vy = 0;
        if (!player.busy()) player.loop(me.y > ISLAND_Y + 0.05 ? 'Jump_Idle' : spd > 5 ? 'Run' : spd > 0.4 ? 'Walk' : 'Idle', spd > 5 ? spd / 7.5 : 1);
        // goodies, crewmate, treasure
        I.picks.forEach((p, k) => { if (p && Math.hypot(p.wx - me.x, p.wz - me.z) < 1.1) { p.m.parent.remove(p.m); I.picks[k] = null; I.st.taken.add(p.id); if (p.gem) { gems[p.gem]++; sfx.sparkle(); } coin(p.gold || 1, new T.Vector3(p.wx, 1.4, p.wz)); } });
        if (I.crew && !I.st.crewTaken && Math.hypot(I.crew.a.root.position.x - me.x, I.crew.a.root.position.z - me.z) < 2.4) {
          I.st.crewTaken = true; const c = I.crew; I.crew = null; I.cell.group.remove(c.a.root);
          addCrew(c.name, c.a.root.position.clone()); crew[crew.length - 1].a.once('Yes');
          api.celebrate(); sfx.horn(); S.sparkle(new T.Vector3(me.x, 2, me.z), U.pick(U.RAINBOW), 50, 5, { glow: 1.3 });
        }
      }
      if (luteMesh) { luteMesh.visible = me.lute > 0; weaponNode.visible = me.lute <= 0; }
      me.lute -= dt;
      player.root.position.set(me.x, me.y, me.z); player.root.rotation.y = me.yaw; player.update(dt);
      // the crew follows your footsteps
      trail.push({ t, x: me.x, z: me.z, y: me.y });
      while (trail.length && trail[0].t < t - 5) trail.shift();
      crew.forEach((c, i) => {
        const want = t - 0.45 * (i + 1); let p = trail[0]; for (let k = trail.length - 1; k >= 0; k--) if (trail[k].t <= want) { p = trail[k]; break; }
        const ox = c.x; c.x = U.lerp(c.x, p.x, Math.min(1, dt * 6)); c.z = U.lerp(c.z, p.z, Math.min(1, dt * 6)); c.y = U.lerp(c.y, p.y, Math.min(1, dt * 8));
        const v = Math.hypot(c.x - ox, c.z - p.z) / dt;
        if (Math.hypot(c.x - me.x, c.z - me.z) > 1.2) { if (v > 0.2) c.yaw = yawTo(c.yaw, Math.atan2(p.x - c.x, p.z - c.z), Math.min(1, dt * 8)); c.a.loop(Math.hypot(p.x - c.x, p.z - c.z) > 0.3 ? 'Run' : 'Idle'); } else c.a.loop('Idle');
        c.a.root.position.set(c.x, c.y, c.z); c.a.root.rotation.y = c.yaw; c.a.update(dt);
      });
      camGoal.set(me.x, 9.5, me.z + 12); camLook.set(me.x, 1.2, me.z);
    }
    function board() {
      const deck = deckPoint(0);
      me.hop = { t: 0, fx: me.x, fz: me.z, fy: me.y, tx: deck.x, tz: deck.z, ty: deck.y, then: () => {
        mode = 'sail'; me.island = null; ship.landCool = 1.2;
        const I = islands.reduce((a, b) => Math.hypot(b.x - ship.x, b.z - ship.z) < Math.hypot(a.x - ship.x, a.z - ship.z) ? b : a);
        const nx = ship.x - I.x, nz = ship.z - I.z, d = Math.hypot(nx, nz); ship.vx = nx / d * 4; ship.vz = nz / d * 4;   // drift off the beach
      } };
      player.once('Jump', 1.2); sfx.boing();
      crew.forEach((c, i) => { const p = deckPoint(i + 1); setTimeout(() => { c.x = p.x; c.z = p.z; }, 300 + i * 120); });
    }
    function land(I) {
      mode = 'walk'; me.island = I; I.st.visited = true;
      const nx = I.x - ship.x, nz = I.z - ship.z, d = Math.hypot(nx, nz);
      ship.vx = ship.vz = 0;
      const tx = I.x - nx / d * (I.R - 1.6), tz = I.z - nz / d * (I.R - 1.6);
      me.hop = { t: 0, fx: me.x, fz: me.z, fy: me.y, tx, tz, ty: ISLAND_Y };
      me.yaw = Math.atan2(nx, nz); player.once('Jump', 1.2); sfx.boing(); splash(ship.x + nx / d * 2, ship.z + nz / d * 2, 0.7);
      crew.forEach((c, i) => { c.x = tx - nx / d * (i + 1) * 0.8; c.z = tz - nz / d * (i + 1) * 0.8; c.y = ISLAND_Y; });
      trail.length = 0;
    }
    function deckPoint(k) {
      const [lx, lz] = DECK[k % DECK.length], c = Math.cos(ship.yaw), s = Math.sin(ship.yaw);
      return { x: ship.x + lx * c + lz * s, z: ship.z - lx * s + lz * c, y: DECK_Y + ship.hop };
    }

    // ---------- sailing ----------
    function updateSail(dt) {
      for (const b of input.pressed) {
        if (b === 0 && ship.hop <= 0.01) { ship.hopV = 5; sfx.boing(); splash(ship.x, ship.z, 1); }
        else if (b === 1) cannon(0);
        else if (b === 4) cannon(-1); else if (b === 5) cannon(1);
        else if (b === 3) spyglass();
        else if (b === 2) { sfx.horn(); crew.forEach(c => c.a.once('Wave')); player.once('Wave'); sharks.forEach(s => { if (Math.hypot(s.a.root.position.x - ship.x, s.a.root.position.z - ship.z) < 35) s.leap = 1; }); krakens.forEach(k => k.arms.forEach(a => { if (a.a) a.a.once('Tentacle_Poke'); })); }
      }
      const boost = input.down.has(6) || input.down.has(7), sp = (boost ? 13 : 8.5) * CONFIG.stickSpeed;
      ship.vx = U.lerp(ship.vx, input.x * sp, Math.min(1, dt * 1.4)); ship.vz = U.lerp(ship.vz, input.y * sp, Math.min(1, dt * 1.4));
      ship.x += ship.vx * dt; ship.z += ship.vz * dt;
      const spd = Math.hypot(ship.vx, ship.vz);
      if (Math.hypot(input.x, input.y) > 0.25 && spd > 0.6) ship.yaw = yawTo(ship.yaw, Math.atan2(ship.vx, ship.vz), Math.min(1, dt * 2.5));   // steer by the stick only (cannon recoil mustn't spin the ship)
      ship.landCool -= dt;
      for (const I of islands) {
        const dx = ship.x - I.x, dz = ship.z - I.z, d = Math.hypot(dx, dz), m = I.R + 2.1;
        if (d < m) {
          ship.x = I.x + dx / d * m; ship.z = I.z + dz / d * m;
          const toward = -(ship.vx * dx + ship.vz * dz) / d;
          if (ship.landCool <= 0 && toward > 1) { land(I); break; }   // sailing into a beach = go ashore
        }
      }
      for (const g of galleons) { const gp = g.g.position, dx = ship.x - gp.x, dz = ship.z - gp.z, d = Math.hypot(dx, dz); if (d < 7.5) { ship.x = gp.x + dx / d * 7.5; ship.z = gp.z + dz / d * 7.5; } }
      for (const f of floats) if (!f.gone && Math.hypot(f.x - ship.x, f.z - ship.z) < 2.6) collectFloat(f);
      // wake foam
      if (spd > 2 && Math.random() < dt * 14) {
        const back = new T.Vector3(ship.x - Math.sin(ship.yaw) * 2.4, 0.05, ship.z - Math.cos(ship.yaw) * 2.4);
        const w = new T.Mesh(geo.sphereLo, splashM.clone()); w.scale.set(0.5, 0.05, 0.5); w.position.copy(back).add(new T.Vector3(U.rand(-0.4, 0.4), 0, U.rand(-0.4, 0.4))); scene.add(w); wake.push({ m: w, life: 1.4 });
      }
      // player and crew ride on deck
      const p0 = deckPoint(0); me.x = p0.x; me.z = p0.z; me.y = p0.y; me.yaw = ship.yaw;
      player.root.position.set(me.x, me.y, me.z); player.root.rotation.y = ship.yaw; if (!player.busy()) player.loop('Idle'); player.update(dt);
      if (luteMesh) { luteMesh.visible = false; weaponNode.visible = true; }
      crew.forEach((c, i) => { const p = deckPoint(i + 1); c.x = p.x; c.z = p.z; c.y = p.y; c.a.root.position.set(p.x, p.y, p.z); c.a.root.rotation.y = ship.yaw + (i % 2 ? -0.6 : 0.6); c.a.loop('Idle'); c.a.update(dt); });
      const zoom = spy.t > 0 ? 1.35 : 1;
      camGoal.set(ship.x, 12 * zoom, ship.z + 14 * zoom); camLook.set(ship.x + ship.vx * 0.4, 0.5, ship.z + ship.vz * 0.4);
    }
    const camGoal = new T.Vector3(0, 4, 13.5), camLook = new T.Vector3(0, 1.5, 5), camLookNow = camLook.clone();

    updateCells(0, 0, true);
    camera.position.copy(camGoal);

    return {
      resize: S.resize,
      update(dt) {
        t += dt;
        if (mode === 'pick') updatePicker(dt);
        else {
          if (mode === 'walk') updateWalk(dt); else updateSail(dt);
          camera.position.lerp(camGoal, Math.min(1, dt * 2.5)); camLookNow.lerp(camLook, Math.min(1, dt * 4)); camera.lookAt(camLookNow);
          updateCells(mode === 'sail' ? ship.x : me.x, mode === 'sail' ? ship.z : me.z);
        }
        // the ship sailing round the island to pick you up
        if (ship.come) {
          const c = ship.come, a0 = Math.atan2(ship.z - c.I.z, ship.x - c.I.x); let da = c.ang - a0; da = Math.atan2(Math.sin(da), Math.cos(da));
          const step = Math.sign(da) * Math.min(Math.abs(da), dt * 18 / (c.I.R + 2.1)), a1 = a0 + step, r = c.I.R + 2.1;
          ship.x = c.I.x + Math.cos(a1) * r; ship.z = c.I.z + Math.sin(a1) * r;
          ship.yaw = yawTo(ship.yaw, Math.atan2(-Math.sin(a1) * Math.sign(da), Math.cos(a1) * Math.sign(da)), Math.min(1, dt * 5));
          ship.vx = -Math.sin(a1) * Math.sign(da) * 12; ship.vz = Math.cos(a1) * Math.sign(da) * 12;
          if (Math.abs(da) < 0.03 || mode !== 'walk') { ship.come = null; ship.vx = ship.vz = 0; }
        }
        beacon.visible = mode === 'walk' && !me.hop;
        beacon.position.set(ship.x, 4.6 + Math.sin(t * 4) * 0.3, ship.z); beacon.rotation.y = t * 2;
        // ship bobbing + sail billow (also while docked)
        ship.hopV -= 14 * dt; ship.hop = Math.max(0, ship.hop + ship.hopV * dt); if (ship.hop === 0 && ship.hopV < 0) { if (ship.hopV < -3) splash(ship.x, ship.z, 0.8); ship.hopV = 0; }
        ship.root.position.set(ship.x, ship.hop, ship.z); ship.root.rotation.y = ship.yaw;
        const spd = Math.hypot(ship.vx, ship.vz);
        ship.inner.rotation.z = Math.sin(t * 1.3) * 0.04; ship.inner.rotation.x = Math.sin(t * 1.7) * 0.03 - spd * 0.004; ship.inner.position.y = Math.sin(t * 1.9) * 0.06;
        const sp = sail.geometry.attributes.position, puff = 0.15 + Math.min(1, spd / 10) * 0.45;
        for (let k = 0; k < sp.count; k++) { const x = sailBase[k * 3], y = sailBase[k * 3 + 1]; sp.setZ(k, (1 - (x / 1.1) ** 2) * (0.6 + 0.4 * (1 - Math.abs(y))) * puff + Math.sin(t * 6 + x * 2) * 0.03); }
        sp.needsUpdate = true; flag.rotation.y = Math.sin(t * 5) * 0.3;
        // sea scrolls with you
        const cx = mode === 'pick' ? 0 : camera.position.x, cz = mode === 'pick' ? 0 : camera.position.z - 18;
        sea.position.set(cx, 0, cz); waveTex.offset.set(cx / 700 * 60 + t * 0.01, -cz / 700 * 60 + t * 0.006);
        sun.follow(cx, cz); sky.position.copy(camera.position);
        // floating things bob; goodies spin
        floats.forEach(f => { if (f.gone) return; f.m.position.y = Math.sin(t * 1.6 + f.ph) * 0.12 - 0.15; f.m.rotation.y += dt * 0.3; f.m.rotation.z = Math.sin(t * 1.3 + f.ph) * 0.15; });
        islands.forEach(I => {
          I.picks.forEach(p => { if (p) { p.m.rotation.y = t * 2 + p.ph; p.m.position.y = ISLAND_Y + 0.9 + Math.sin(t * 3 + p.ph) * 0.12; } });
          if (I.xMark && !I.xMark.done) I.xMark.m.rotation.y = Math.sin(t * 2) * 0.08;
          const fx0 = mode === 'sail' ? ship.x : me.x, fz0 = mode === 'sail' ? ship.z : me.z;
          I.tall.forEach(o => {   // see-through when between the camera (always south) and you
            const hide = mode !== 'pick' && o.z > fz0 - 1 && o.z < camera.position.z && Math.abs(o.x - fx0) < o.r + 1.5;
            const op = U.lerp(o.op, hide ? 0.22 : 1, Math.min(1, dt * 6));
            if (Math.abs(op - o.op) > 0.002 || (op === 1) !== (o.op === 1)) o.mats.forEach(m => { m.opacity = op; m.depthWrite = op > 0.95; });
            o.op = op > 0.995 ? 1 : op;
          });
          I.skeletons.forEach(s => { s.dance -= dt; if (s.dance > 0) s.a.loop(Math.sin(t * 3) > 0 ? 'Yes' : 'Wave'); else s.a.loop('Idle'); s.a.root.rotation.y = s.dance > 0 ? t * 3 : Math.atan2(me.x - s.a.root.position.x, me.z - s.a.root.position.z); s.a.update(dt); });
          if (I.crew) { const c = I.crew; c.waveT -= dt; if (c.waveT <= 0) { c.waveT = 2.5; c.a.once('Wave'); } c.a.root.rotation.y = Math.atan2(me.x - c.a.root.position.x, me.z - c.a.root.position.z); c.a.update(dt); }
        });
        // sharks circle, leap when you pass or honk
        sharks.forEach(s => {
          s.ang += dt * 0.5; s.cool -= dt;
          const x = s.c.x + Math.cos(s.ang) * s.r, z = s.c.z + Math.sin(s.ang) * s.r;
          if (s.leap === 0 && s.cool <= 0 && Math.hypot(x - ship.x, z - ship.z) < 12) s.leap = 1;
          let y = -0.75;
          if (s.leap > 0) { s.leap -= dt * 0.8; const k = 1 - s.leap; y = -0.75 + Math.sin(k * Math.PI) * 2.6; if (s.leap <= 0) { s.leap = 0; s.cool = 4; splash(x, z, 1.2); } if (k < 0.05) { s.a.once('Swim_Bite'); splash(x, z); } }
          s.a.root.position.set(x, y, z); s.a.root.rotation.set(s.leap > 0 ? -Math.cos((1 - s.leap) * Math.PI) * 0.6 : 0, s.ang + Math.PI, 0, 'YXZ');
          s.a.loop('Swim'); s.a.update(dt);
        });
        // kraken tentacles rise when you come close, duck when hit
        krakens.forEach(k => {
          const near = Math.hypot(k.c.x - ship.x, k.c.z - ship.z) < 30;
          k.arms.forEach(a => {
            a.down -= dt;
            const target = a.down > 0 ? -9 : near ? (a.a ? -0.8 : -0.4) : -9;
            a.y = U.lerp(a.y, target, Math.min(1, dt * (a.down > 0 ? 4 : 1.2)));
            a.root.position.y = a.y; if (!a.a) a.root.rotation.z = Math.sin(t * 1.5 + a.ph) * 0.25; else a.a.update(dt);
          });
        });
        galleons.forEach(g => {
          g.ang += dt * 0.11; const x = g.c.x + Math.cos(g.ang) * g.r, z = g.c.z + Math.sin(g.ang) * g.r;
          g.g.position.set(x, Math.sin(t * 1.1) * 0.1, z); g.g.rotation.y = -g.ang; g.g.rotation.z = Math.sin(t * 0.9) * 0.03;
          g.puff -= dt; if (g.puff <= 0 && Math.hypot(x - ship.x, z - ship.z) < 45) { g.puff = U.rand(3, 6); S.sparkle(new T.Vector3(x, 2.5, z), '#e8e8e8', 20, 3, { gravity: -1, glow: 1.0, life: 1 }); sfx.drum('kick'); }
        });
        // fish leap near the ship now and then
        if (mode === 'sail' && Math.random() < dt * 0.35) {
          const f = prop(Math.random() < 0.5 ? 'Prop_Fish_Mackerel' : 'Prop_Fish_Tuna', { height: 0.6 }), a = Math.random() * 6.28;
          const x = ship.x + Math.cos(a) * U.rand(5, 9), z = ship.z + Math.sin(a) * U.rand(5, 9); f.position.set(x, 0, z); f.rotation.y = a; scene.add(f);
          fx.push({ m: f, vx: Math.cos(a + 1.57) * 3, vy: 7, vz: Math.sin(a + 1.57) * 3, life: 1.1, fish: true }); splash(x, z, 0.6);
        }
        // short-lived bits
        for (let k = fx.length - 1; k >= 0; k--) {
          const e = fx[k]; e.life -= dt;
          if (e.chest) {   // treasure chest rising from the sand, then bursting open
            e.rise += dt; e.m.position.y = ISLAND_Y - 1.2 + Math.min(1, e.rise / 0.8) * 1.2; e.m.rotation.z = Math.sin(e.rise * 30) * 0.05 * (e.rise < 0.8 ? 1 : 0);
            if (e.rise > 1.2) { openChestNow(e); e.life = 0; }
          } else {
            e.vy -= 20 * dt; e.m.position.x += e.vx * dt; e.m.position.y += e.vy * dt; e.m.position.z += e.vz * dt;
            if (e.spin) e.m.rotation.y += e.spin * dt;
            if (e.fish) e.m.rotation.z = -Math.atan2(e.vy, 4);
            if (e.ball && e.m.position.y < 0.1) { ballLands(e); e.life = 0; }
            if (e.fish && e.m.position.y < -0.2 && e.vy < 0) { splash(e.m.position.x, e.m.position.z, 0.5); e.life = 0; }
          }
          if (e.life <= 0) { if (!e.chest || !e.m.visible) scene.remove(e.m); fx.splice(k, 1); }
        }
        for (let k = wake.length - 1; k >= 0; k--) { const w = wake[k]; w.life -= dt; w.m.scale.x = w.m.scale.z = 0.35 + (1.4 - w.life) * 0.5; w.m.scale.y = 0.02; w.m.material.opacity = Math.max(0, w.life / 1.4) * 0.4; if (w.life <= 0) { scene.remove(w.m); w.m.material.dispose(); wake.splice(k, 1); } }
        // spyglass dashes appear one after another, then fade
        if (spy.t > 0) { spy.t -= dt; spy.dashes.forEach(d => { d.m.visible = 6 - spy.t > d.at; d.m.scale.setScalar(spy.t < 1 ? spy.t : 1); }); if (spy.t <= 0) { spy.dashes.forEach(d => scene.remove(d.m)); spy.dashes = []; } }
        S.update(dt);
      },
      draw(ctx) {
        S.render();
        ctx.clearRect(0, 0, api.w, api.h);
        const w = api.w, h = api.h;
        if (mode === 'pick') {
          const p = Math.sin(t * 4);
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 12;
          ctx.font = `${Math.round(h * 0.11)}px system-ui`;
          ctx.fillText('◀', w * 0.07 - p * 8, h * 0.5); ctx.fillText('▶', w * 0.93 + p * 8, h * 0.5);
          const r = h * 0.055 * (1 + 0.08 * Math.abs(p));
          ctx.fillStyle = U.BTN_COLORS[0]; ctx.beginPath(); ctx.arc(w / 2, h * 0.88, r, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0; ctx.lineWidth = r * 0.12; ctx.strokeStyle = '#fff'; ctx.stroke();
          U.emoji(ctx, '👍', w / 2, h * 0.88, r * 1.1);
          return;
        }
        // gold, gems (blue, green, pink) and your crew
        const s = Math.max(24, h * 0.042);
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 8; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.font = `800 ${s}px ui-rounded, system-ui, sans-serif`;
        ctx.fillStyle = '#ffcc33'; ctx.beginPath(); ctx.arc(30 + s * 0.5, 26 + s * 0.5, s * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillText(gold, 38 + s * 1.05, 28 + s * 0.5);
        [['UI_Gem_Blue', '#3fc1ff'], ['UI_Gem_Green', '#7ed957'], ['UI_Gem_Pink', '#ff6fd8']].forEach(([g, c], k) => {
          const x = 30 + k * s * 2.6, y = 26 + s * 1.9;
          ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x + s * 0.5, y); ctx.lineTo(x + s, y + s * 0.4); ctx.lineTo(x + s * 0.5, y + s); ctx.lineTo(x, y + s * 0.4); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.font = `800 ${s * 0.8}px ui-rounded, system-ui, sans-serif`; ctx.fillText(gems[g], x + s * 1.15, y + s * 0.55);
        });
        crew.forEach((c, i) => U.emoji(ctx, '🏴‍☠️', w - 40 - i * s * 1.3, 26 + s * 0.5, s));
        ctx.restore();
        if (CONFIG.showGuides) Kit3D.drawGuide(ctx, api, mode === 'sail'
          ? { 0: '🌊', 1: '💣', 2: '📯', 3: '🔭', 4: '💥', 5: '💥', 6: '💨', 7: '💨', stick: '⛵' }
          : { 0: '🦘', 1: '⚔️', 2: '👋', 3: '⛏️', 4: '🎸', 5: '🎸', 6: '🏃', 7: '🏃', stick: '🚶' }, 0.8);
      },
      destroy: S.destroy,
    };
  },
});
