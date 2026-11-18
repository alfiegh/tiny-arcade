// BLOCK HOP (3D side-scroller) — run, jump and bonk through an endless blocky world (Quaternius "Cube World").
//
//   Stick / D-pad : run                       A (bottom) / X (top) : jump (hold = higher, again in the air = double jump)
//   B (right) / Y (left) : punch              ZL / ZR : dash          L / R : wave
//
// First pick a cube kid (D-pad left/right, any face button). Then run right:
// bump or punch ? blocks for coins (sometimes a star: sparkly super speed), smash bricks and crates,
// stomp or punch the goblins & co (they pop into coins). Walking into one just bounces you back; falling into a gap
// floats you back up in a bubble. No losing, no timer. Every treasure chest opens with fireworks, an animal friend
// jumps out and follows you, and the world changes: meadow -> snow -> cheese land -> crystal cave -> ...
Games.register({
  id: 'block-hop', name: 'Block Hop', emoji: '🍄', color: '#ffb703',
  assets: ['cube/'],   // lazily loaded pack (parsed behind the loading screen)
  create(api) {
    const { input, sfx } = api;
    const game = this;   // remembers the last picked kid
    const S = Kit3D.stage(api, { fog: ['#d9f2ff', 34, 75], bloom: [0.3, 0.5, 1.35], exposure: 0.95, fov: 38, envIntensity: 0.6 });
    const { T, scene, camera, geo, mat, mesh } = S;

    const THEMES = [
      { top: 'Block_Grass', fill: 'Block_Dirt', sky: ['#3b9be8', '#bfe6ff', '#d9f2ff'], hill: '#7cc84a', foes: ['Goblin', 'Hedgehog'],
        deco: ['Tree_1', 'Tree_2', 'Tree_3', 'Bush', 'Flowers_1', 'Flowers_2', 'Grass_Big', 'Rock1'] },
      { top: 'Block_Snow', fill: 'Block_Stone', sky: ['#4f8fd6', '#b9d8f5', '#d6e8f8'], hill: '#a9c4dc', foes: ['Yeti', 'Hedgehog'],
        deco: ['DeadTree_1', 'DeadTree_2', 'Rock1', 'Rock2', 'Crystal_Small', 'Bush'] },
      { top: 'Block_Cheese', fill: 'Block_Cheese', sky: ['#ff9966', '#ffd9a0', '#fff0d0'], hill: '#ffcf4d', foes: ['Zombie', 'Goblin'],
        deco: ['Flowers_2', 'Bamboo', 'Plant_2', 'Plant_3', 'Tree_2'] },
      { top: 'Block_Stone', fill: 'Block_Coal', sky: ['#4a3a8c', '#b39aff', '#d6c8ff'], hill: '#8f84c0', foes: ['Skeleton', 'Hedgehog'],
        deco: ['Crystal_Big', 'Crystal_Small', 'Rock2', 'Rock1'] },
    ];
    const CHARS = ['Character_Male_1', 'Character_Female_1', 'Character_Male_2', 'Character_Female_2'];
    const FRIENDS = ['Chick', 'Pig', 'Dog', 'Cat', 'Sheep', 'Horse'];
    const FRIEND_H = { Chick: 0.65, Pig: 0.85, Dog: 0.9, Cat: 0.75, Sheep: 0.95, Horse: 1.5 };
    const FRIEND_EMOJI = { Chick: '🐤', Pig: '🐷', Dog: '🐶', Cat: '🐱', Sheep: '🐑', Horse: '🐴' };
    const FOE_H = { Goblin: 1.3, Zombie: 1.4, Skeleton: 1.45, Yeti: 1.6, Hedgehog: 0.75 };
    const DECO_H = { Tree_1: 4.2, Tree_2: 3.8, Tree_3: 4.6, DeadTree_1: 3.6, DeadTree_2: 3.2, Bamboo: 3.4, Crystal_Big: 2.4, Bush: 1.1,
      Flowers_1: 0.7, Flowers_2: 0.7, Grass_Big: 0.6, Mushroom: 1.0, Rock1: 0.9, Rock2: 1.2, Crystal_Small: 1.0, Plant_2: 0.9, Plant_3: 1.1 };

    // ---------- sky, light ----------
    const sky = Kit3D.sky(S, ...THEMES[0].sky, { sunDir: new T.Vector3(0.4, 0.55, 0.7) });
    const hemi = new T.HemisphereLight('#e8f6ff', '#6b7a4a', 0.9); scene.add(hemi);
    const sun = Kit3D.sun(S, { intensity: 1.7, offset: [6, 18, 12], size: 26 });
    const skyCols = { top: new T.Color(), mid: new T.Color(), bot: new T.Color() };

    // ---------- model helpers ----------
    const A = n => Assets.get('cube/' + n);
    // pixel-art blocks stay crisp; the 32px colour-palette atlas must keep smooth filtering (cells are 1px: nearest picks neighbours)
    const FLOWER_COLS = { 'Material.001': '#ffd23f', 'Material.020': '#5fb544' };   // these flower materials are empty in the source files
    const crisp = m => {
      if (m.map && m.map.image && m.map.image.width > 32) { m.map.magFilter = T.NearestFilter; m.map.needsUpdate = true; }
      if (!m.map && FLOWER_COLS[m.name]) m.color.set(FLOWER_COLS[m.name]);
      m.roughness = Math.max(m.roughness ?? 1, 0.6); m.metalness = 0;
    };
    const blockCache = {};
    function block(name) {   // geometry (unit cube) + material of a block model
      if (blockCache[name]) return blockCache[name];
      const src = A(name).scene; src.updateMatrixWorld(true);
      const m = src.getObjectByProperty('isMesh', true);
      const g = S.track(m.geometry.clone().applyMatrix4(m.matrixWorld));
      g.computeBoundingBox(); const s = 1 / (g.boundingBox.max.x - g.boundingBox.min.x); g.scale(s, s, s);
      crisp(m.material);
      if (name === 'QuestionMark') { m.material.color.set('#ffe680'); m.material.emissive.set('#ffa600'); m.material.emissiveIntensity = 0.35; }   // classic golden ? block (used ones stay grey)
      return (blockCache[name] = { geo: g, mat: m.material });
    }
    const propH = {};
    function prop(name, height) {   // static scenery clone standing on y=0
      const src = A(name).scene, m = src.clone(true), g = new T.Group();
      if (!propH[name]) { const b = new T.Box3().setFromObject(src); propH[name] = { h: b.max.y - b.min.y, y0: b.min.y }; }
      const s = height / propH[name].h; m.scale.setScalar(s); m.position.y = -propH[name].y0 * s;
      m.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; crisp(n.material); } });
      g.add(m); return g;
    }
    function actor(name, height, { ownMaterials = false } = {}) {   // animated character / enemy / animal
      const asset = A(name), root = new T.Group(), model = T.SkeletonUtils.clone(asset.scene); root.add(model);
      const mats = [];
      model.traverse(n => { if (n.isMesh) { n.castShadow = true; n.frustumCulled = false; if (ownMaterials) n.material = S.track(n.material.clone()); crisp(n.material); mats.push(n.material); } });
      const box = new T.Box3().setFromObject(model, true), s = height / (box.max.y - box.min.y);
      model.scale.setScalar(s); model.position.y = -box.min.y * s;
      const mixer = new T.AnimationMixer(model), acts = {};
      asset.animations.forEach(c => { acts[c.name] = mixer.clipAction(c); });
      let cur = null, oneT = 0;
      function to(n, loop, ts) {
        const a = acts[n]; if (!a) return false;
        if (cur === a && loop) { a.setEffectiveTimeScale(ts); return true; }
        a.reset(); a.setLoop(loop ? T.LoopRepeat : T.LoopOnce, Infinity); a.clampWhenFinished = !loop; a.setEffectiveTimeScale(ts); a.play();
        if (cur && cur !== a) a.crossFadeFrom(cur, 0.12, false);
        cur = a; return true;
      }
      return {
        root, model, mats, has: n => !!acts[n],
        loop(n, ts = 1) { if (oneT <= 0) to(n, true, ts); },
        once(n, ts = 1) { if (to(n, false, ts)) oneT = acts[n].getClip().duration / ts * 0.85; },
        busy: () => oneT > 0,
        update(dt) { oneT -= dt; mixer.update(dt); },
      };
    }
    const faceYaw = f => f > 0 ? 1.1 : -1.1;   // side-on, turned a little towards the camera

    // ---------- level: tiles, generated in pieces ahead of the player, dropped behind ----------
    const BOTTOM = -4, tk = (x, y) => x + ',' + y;
    const tiles = new Map(), ground = new Map(), GROUND = { kind: 'g' };
    const pieces = [], coins = [], foes = [], items = [], fx = [], chests = [];
    const gen = { x: -12, h: 2, zone: 0, sinceFlag: 0, qCount: 0 };
    let minX = -12, zoneShown = 0;
    const hillMats = THEMES.map(th => mat(th.hill, { roughness: 1 }));
    const cloudM = mat('#e6eef8', { roughness: 1 });
    const coinM = mat('#ffc61a', { metalness: 0.3, roughness: 0.45, emissive: '#ff9d00', emissiveIntensity: 0.12 });
    const poleM = mat('#cfc8bd', { roughness: 0.6 });

    function newPiece() { const P = { group: new T.Group(), inst: new Map(), x0: gen.x, x1: gen.x }; return P; }
    function put(P, name, x, y, z = 0) { let a = P.inst.get(name); if (!a) P.inst.set(name, a = []); a.push(x + 0.5, y + 0.5, z); }
    function col(P, h, th) {
      const x = gen.x++; P.x1 = gen.x;
      ground.set(x, h);
      if (h == null) return x;
      for (let y = BOTTOM; y < h; y++) {
        const name = y === h - 1 ? th.top : th.fill;
        for (let z = -3; z <= 1; z++) put(P, name, x, y, z);
        tiles.set(tk(x, y), GROUND);
      }
      return x;
    }
    function deco(P, x, h, th, chance = 0.45) {
      if (Math.random() > chance) return;
      const name = U.pick(th.deco), p = prop(name, (DECO_H[name] || 1) * U.rand(0.85, 1.2));
      p.position.set(x + 0.5 + U.rand(-0.3, 0.3), h, U.rand(-2.9, -1.8)); p.rotation.y = U.rand(0, 6.3);
      P.group.add(p);
    }
    function backdrop(P, th) {   // far blocky hills and cube clouds
      for (let k = 0; k < 2; k++) {
        const hm = mesh(geo.box, hillMats[THEMES.indexOf(th)], { shadow: false });
        const w = U.rand(5, 11), h = U.rand(4, 10);
        hm.scale.set(w, h, U.rand(3, 6)); hm.position.set(U.rand(P.x0, P.x1 + 4), BOTTOM + h / 2, U.rand(-20, -13)); P.group.add(hm);
      }
      if (Math.random() < 0.7) {
        const c = new T.Group(), y = U.rand(9, 13);
        for (let k = 0; k < 3; k++) { const b = mesh(geo.box, cloudM, { shadow: false }); b.scale.set(U.rand(1.6, 2.6), U.rand(0.9, 1.4), 1.4); b.position.set(k * 1.5 - 1.5, k === 1 ? 0.5 : 0, 0); c.add(b); }
        c.position.set(U.rand(P.x0, P.x1), y, U.rand(-16, -9)); P.group.add(c);
      }
    }
    function addTile(P, kind, x, y) {   // ? block / brick / crate / plank: its own mesh so it can bump or break
      const name = { q: 'QuestionMark', brick: 'Block_Brick', crate: 'Block_Crate', plank: 'Block_WoodPlanks' }[kind];
      const b = block(name), m = new T.Mesh(b.geo, b.mat); m.castShadow = m.receiveShadow = true;
      m.position.set(x + 0.5, y + 0.5, 0); P.group.add(m);
      const t = { kind, x, y, mesh: m, bump: 0 }; tiles.set(tk(x, y), t); return t;
    }
    function addCoin(x, y) { const g = new T.Group(); const c = mesh(geo.cyl, coinM); c.scale.set(0.34, 0.07, 0.34); c.rotation.x = Math.PI / 2; g.add(c); g.position.set(x, y, 0); scene.add(g); coins.push({ g, x, y, ph: Math.random() * 6 }); }
    function coinArc(x0, x1, yBase, lift = 1.2) { for (let x = x0; x <= x1; x++) { const k = (x - x0) / Math.max(1, x1 - x0); addCoin(x + 0.5, yBase + Math.sin(k * Math.PI) * lift); } }
    function spawnFoe(name, x, y) {
      const a = actor(name, FOE_H[name] || 1.3), f = { a, name, x, y, vx: 0, vy: 0, w: name === 'Hedgehog' ? 0.9 : 0.8, h: FOE_H[name] || 1.3, dir: -1, dead: 0, ground: false, walk: name === 'Hedgehog' ? 0.6 : 1.4 };
      a.root.position.set(x, y, 0); scene.add(a.root); a.loop(a.has('Walk') ? 'Walk' : 'Idle'); foes.push(f);
    }

    // piece types (all generous for little thumbs: gaps 1-3, every height reachable with one jump)
    function flatPiece(P, th) {
      const len = U.randInt(6, 9), h = gen.h, x0 = gen.x;
      for (let i = 0; i < len; i++) deco(P, col(P, h, th), h, th);
      const r = Math.random();
      if (r < 0.45) {   // a row of ? blocks and bricks to bump
        const n = U.randInt(1, 3), s = x0 + U.randInt(1, len - n - 1);
        for (let i = 0; i < n; i++) addTile(P, (n === 1 || i === 1 || Math.random() < 0.4) ? 'q' : 'brick', s + i, h + 3);
        if (Math.random() < 0.4) coinArc(s, s + n - 1, h + 5.2, 0.3);
      } else if (r < 0.75) coinArc(x0 + 1, x0 + len - 2, h + 1.6, 1.4);
      else addTile(P, 'crate', x0 + U.randInt(2, len - 2), h);
      if (gen.x > 18 && Math.random() < 0.6) spawnFoe(U.pick(th.foes), x0 + len * 0.6, h);
    }
    function gapPiece(P, th) {
      const h = gen.h, w = Math.random() < 0.5 ? 1 : Math.random() < 0.8 ? 2 : 3;
      for (let i = 0; i < 2; i++) col(P, h, th);
      const g0 = gen.x; for (let i = 0; i < w; i++) col(P, null, th);
      coinArc(g0 - 1, g0 + w, h + 1.8, 1.5);
      for (let i = 0; i < 2; i++) deco(P, col(P, h, th), h, th);
    }
    function stepPiece(P, th) {
      const dh = U.pick([-2, -1, 1, 1]);   // up steps are one block: no held jump needed gen.h = U.clamp(gen.h + dh, 1, 5);
      const len = U.randInt(4, 6), x0 = gen.x;
      for (let i = 0; i < len; i++) deco(P, col(P, gen.h, th), gen.h, th);
      addCoin(x0 + 0.5, gen.h + 1);
    }
    function stairsPiece(P, th) {
      const h = gen.h, top = Math.min(h + 3, 7);
      for (let y = h + 1; y <= top; y++) col(P, y, th);
      const t0 = gen.x; col(P, top, th); col(P, top, th);
      coinArc(t0, t0 + 1, top + 1.2, 0.2);
      for (let y = top - 1; y >= h; y--) col(P, y, th);
    }
    function platformPiece(P, th) {
      const h = gen.h;
      for (let i = 0; i < 2; i++) col(P, h, th);
      const g0 = gen.x; for (let i = 0; i < 4; i++) col(P, null, th);
      for (let i = 1; i <= 2; i++) addTile(P, 'plank', g0 + i, h + 1);
      coinArc(g0 + 1, g0 + 2, h + 2.8, 0.3);
      for (let i = 0; i < 2; i++) deco(P, col(P, h, th), h, th);
    }
    function wallPiece(P, th) {
      const h = gen.h;
      for (let i = 0; i < 3; i++) col(P, h, th);
      col(P, h + 2, th); col(P, h + 2, th);
      addCoin(gen.x - 1, h + 3);
      for (let i = 0; i < 3; i++) deco(P, col(P, h, th), h, th);
      if (Math.random() < 0.5) spawnFoe(U.pick(th.foes), gen.x - 1.5, h);
    }
    function chestPiece(P, th) {   // treasure chest + flag: opens with fireworks, a friend jumps out, the world changes after it
      const h = gen.h, x0 = gen.x;
      for (let i = 0; i < 10; i++) col(P, h, th);
      const chest = prop('Chest_Closed', 1.1); chest.position.set(x0 + 4.5, h, -0.2); chest.rotation.y = 0.25; P.group.add(chest);
      const flag = new T.Group(); flag.position.set(x0 + 7.5, h, -0.4); P.group.add(flag);
      const pole = mesh(geo.cyl, poleM); pole.scale.set(0.08, 6, 0.08); pole.position.y = 3; flag.add(pole);
      const ball = mesh(geo.sphereLo, coinM); ball.scale.setScalar(0.22); ball.position.y = 6.1; flag.add(ball);
      const cloth = mesh(geo.box, mat(U.pick(['#ff4d6d', '#3fa7ff', '#7ed957', '#b06bff']), { roughness: 0.6, side: T.DoubleSide })); cloth.scale.set(1.3, 0.85, 0.05); cloth.position.set(0.7, 1, 0); flag.add(cloth);
      chests.push({ x: x0 + 4.5, y: h, chest, cloth, open: false, zone: gen.zone, P });
      gen.zone++; gen.sinceFlag = 0;
    }
    function startPiece(P, th) {
      for (let i = 0; i < 2; i++) col(P, 12, th);                    // a tall wall on the far left
      while (gen.x < 15) deco(P, col(P, gen.h, th), gen.h, th, 0.35);
    }
    function finish(P) {
      for (const [name, a] of P.inst) {
        const b = block(name), n = a.length / 3, im = new T.InstancedMesh(b.geo, b.mat, n), m4 = new T.Matrix4();
        for (let i = 0; i < n; i++) im.setMatrixAt(i, m4.makeTranslation(a[i * 3], a[i * 3 + 1], a[i * 3 + 2]));
        im.castShadow = im.receiveShadow = true; P.group.add(im);
      }
      P.inst = null; scene.add(P.group); pieces.push(P);
    }
    function genPiece() {
      const th = THEMES[gen.zone % THEMES.length], P = newPiece();
      if (gen.x < 0) startPiece(P, th);
      else if (gen.sinceFlag > 60) chestPiece(P, th);
      else { const r = Math.random(); (r < 0.3 ? flatPiece : r < 0.46 ? gapPiece : r < 0.6 ? stepPiece : r < 0.72 ? stairsPiece : r < 0.86 ? platformPiece : wallPiece)(P, th); }
      gen.sinceFlag += P.x1 - P.x0;
      backdrop(P, th); finish(P);
    }
    function dropBehind(cut) {
      while (pieces.length && pieces[0].x1 < cut) {
        const P = pieces.shift();
        scene.remove(P.group); P.group.traverse(o => { if (o.isInstancedMesh) o.dispose(); });
        for (let x = P.x0; x < P.x1; x++) { ground.delete(x); for (let y = BOTTOM; y < 14; y++) tiles.delete(tk(x, y)); }
        minX = P.x1;
      }
      for (const list of [coins, foes]) for (let i = list.length - 1; i >= 0; i--) { const o = list[i]; if (o.x < minX) { scene.remove(o.g || o.a.root); list.splice(i, 1); } }
    }
    while (gen.x < 40) genPiece();

    // ---------- physics (tile grid, feet-centred boxes) ----------
    function move(b, dt, onHead) {
      const hw = b.w / 2; b.wall = 0;
      b.x += b.vx * dt;
      for (let y = Math.floor(b.y + 0.05); y <= Math.floor(b.y + b.h - 0.05); y++) {
        if (b.vx > 0) { const tx = Math.floor(b.x + hw); if (tiles.has(tk(tx, y))) { b.x = tx - hw - 0.001; b.vx = 0; b.wall = 1; } }
        else if (b.vx < 0) { const tx = Math.floor(b.x - hw); if (tiles.has(tk(tx, y))) { b.x = tx + 1 + hw + 0.001; b.vx = 0; b.wall = -1; } }
      }
      b.y += b.vy * dt; b.ground = false;
      const x0 = Math.floor(b.x - hw + 0.05), x1 = Math.floor(b.x + hw - 0.05);
      if (b.vy <= 0) {
        const ty = Math.floor(b.y);
        for (let x = x0; x <= x1; x++) if (tiles.has(tk(x, ty))) { b.y = ty + 1; b.vy = 0; b.ground = true; break; }
      } else {
        const ty = Math.floor(b.y + b.h); let hit = null;
        for (let x = x0; x <= x1; x++) { const t = tiles.get(tk(x, ty)); if (t && (!hit || Math.abs(x + 0.5 - b.x) < Math.abs(hit.x + 0.5 - b.x))) hit = t === GROUND ? { kind: 'g', x, y: ty } : t; }
        if (hit) { b.y = ty - b.h - 0.001; b.vy = 0; onHead && onHead(hit); }
      }
    }

    // ---------- the player ----------
    const P = { x: 3, y: gen.h, vx: 0, vy: 0, w: 0.7, h: 1.5, face: 1, ground: true, coyote: 0, buffer: 0, jumps: 0, hurt: 0, star: 0, bubble: null, punchCD: 0, yaw: 1.1, squash: 0 };
    let hero = null, coinsN = 0, nextBonus = 25, t = 0, camX = 5.5, camY = gen.h, camGoalY = gen.h, lastSafe = { x: 3, y: gen.h };
    const friends = [], trail = [];
    const bubbleM = S.track(new T.MeshPhysicalMaterial({ color: '#bfe9ff', transparent: true, opacity: 0.35, roughness: 0.05, clearcoat: 1, depthWrite: false }));
    const bubble = new T.Mesh(geo.sphere, bubbleM); bubble.visible = false; scene.add(bubble);
    // water at the bottom of every gap (hidden inside the ground elsewhere); falling in = splash + bubble ride back
    const water = new T.Mesh(S.track(new T.PlaneGeometry(90, 6)), S.track(new T.MeshStandardMaterial({ color: '#3fa7e8', roughness: 0.2, metalness: 0, transparent: true, opacity: 0.85 })));
    water.rotation.x = -Math.PI / 2; water.position.set(0, -1.2, -1); scene.add(water);

    function coinGet(x, y) {
      coinsN++; sfx.note(19, { type: 'square', dur: 0.07, vol: 0.09 }); sfx.note(24, { type: 'square', dur: 0.22, vol: 0.09, delay: 0.07 });
      S.sparkle(new T.Vector3(x, y, 0.3), '#ffd23f', 8, 2.5, { glow: 1.2, life: 0.5 });
      if (coinsN >= nextBonus) { nextBonus += 25; sfx.cheer(); S.sparkle(new T.Vector3(P.x, P.y + 1, 0.5), U.pick(U.RAINBOW), 50, 6, { glow: 1.3 }); input.rumble(0.4, 200); }
    }
    function popCoin(x, y, delay = 0) {   // a coin springs out (blocks, enemies, chests) and counts straight away
      setTimeout(() => {
        const g = new T.Group(); const c = mesh(geo.cyl, coinM); c.scale.set(0.34, 0.07, 0.34); c.rotation.x = Math.PI / 2; g.add(c);
        g.position.set(x, y, 0.2); scene.add(g); fx.push({ g, vy: 9, life: 0.55, spin: 1 }); coinGet(x, y);
      }, delay);
    }
    function debris(t, n = 6) {
      const b = block({ brick: 'Block_Brick', crate: 'Block_Crate', q: 'QuestionMark' }[t.kind] || 'Block_Brick');
      for (let k = 0; k < n; k++) {
        const m = new T.Mesh(b.geo, b.mat); m.scale.setScalar(0.35); m.position.set(t.x + 0.5 + U.rand(-0.3, 0.3), t.y + 0.5 + U.rand(-0.3, 0.3), U.rand(-0.3, 0.3));
        scene.add(m); fx.push({ g: m, vx: U.rand(-4, 4), vy: U.rand(5, 10), vz: U.rand(-2, 2), rot: U.rand(-8, 8), life: 1.1, grav: 1 });
      }
    }
    function defeat(f, how) {
      if (f.dead) return;
      f.dead = 0.9; f.vx = 0; f.a.once(f.a.has('Death') ? 'Death' : 'Idle', 1.6);
      sfx.pop(); if (how === 'stomp') sfx.boing(); input.rumble(0.4, 100);
      S.sparkle(new T.Vector3(f.x, f.y + f.h * 0.6, 0.3), '#ffffff', 20, 4, { glow: 1.2 });
      popCoin(f.x, f.y + f.h, 120); popCoin(f.x, f.y + f.h, 300);
    }
    function hitTile(t, fromBelow) {
      if (t.kind === 'q' && !t.used) {
        t.used = true; t.bump = 1; const b = block('PB_Blank'); t.mesh.geometry = b.geo; t.mesh.material = b.mat;
        gen.qCount++;
        if (gen.qCount % 5 === 0 && P.star <= 0) { items.push(makeStar(t.x + 0.5, t.y + 1.2)); sfx.sparkle(); }
        else popCoin(t.x + 0.5, t.y + 1.2);
        sfx.boop();
      } else if (t.kind === 'brick' || t.kind === 'crate') {
        tiles.delete(tk(t.x, t.y)); t.mesh.parent.remove(t.mesh); debris(t);
        sfx.drum('clap'); S.shake(0.08); input.rumble(0.35, 80);
        if (t.kind === 'crate' || Math.random() < 0.35) { popCoin(t.x + 0.5, t.y + 1); if (t.kind === 'crate') popCoin(t.x + 0.5, t.y + 1, 150); }
      } else { if (t.mesh) t.bump = 1; sfx.boop(); }
      if (fromBelow) foes.forEach(f => { if (!f.dead && Math.abs(f.x - (t.x + 0.5)) < 0.9 && Math.abs(f.y - (t.y + 1)) < 0.2) defeat(f, 'bump'); });   // bonk from below
    }
    function makeStar(x, y) {
      const sh = new T.Shape();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.24 : 0.55, a = Math.PI / 2 + i * Math.PI / 5; i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
      const m = mesh(S.track(new T.ExtrudeGeometry(sh, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.07, bevelSegments: 3 }).center()), mat('#ffc61a', { roughness: 0.4, emissive: '#ff9d00', emissiveIntensity: 0.35 }));
      m.position.set(x, y - 0.6, 0); scene.add(m);
      return { kind: 'star', m, x, y, rise: 0 };
    }
    function jumpFx(n) {
      sfx.synth({ type: 'square', freq: n === 1 ? 330 : 440, slideTo: n === 1 ? 660 : 990, dur: 0.16, vol: 0.08, cutoff: 2600 });
      hero.once(hero.has('Jump') ? 'Jump' : 'Jump_Idle', 1.6);
      if (n === 2) { S.sparkle(new T.Vector3(P.x, P.y + 0.2, 0.2), '#ffffff', 14, 3, { glow: 1.1, life: 0.5 }); S.ring(new T.Vector3(P.x, P.y + 0.1, 0), '#ffffff', 1.5, 0.4, 0.5); }
    }
    function punch() {
      if (P.punchCD > 0) return; P.punchCD = 0.3;
      hero.once('Punch', 1.7); sfx.whoosh(); input.rumble(0.2, 50);
      const hx = P.x + P.face * 0.95;
      foes.forEach(f => { if (!f.dead && Math.abs(f.x - hx) < 0.75 + f.w / 2 && f.y < P.y + 1.4 && f.y + f.h > P.y + 0.2) defeat(f, 'punch'); });
      for (const yy of [P.y + 0.5, P.y + 1.2]) { const t = tiles.get(tk(Math.floor(hx), Math.floor(yy))); if (t && t !== GROUND) { hitTile(t, false); break; } }
      S.sparkle(new T.Vector3(hx, P.y + 0.9, 0.3), '#fff6c8', 6, 2, { glow: 1.1, life: 0.3 });
    }
    function openChest(c) {
      c.open = true;
      const open = prop('Chest_Open', 1.1); open.position.copy(c.chest.position); open.rotation.copy(c.chest.rotation); c.chest.parent.add(open); c.chest.visible = false;
      for (let k = 0; k < 8; k++) popCoin(c.x + U.rand(-0.4, 0.4), c.y + 1.2, k * 90);
      api.celebrate(); sfx.firework(); setTimeout(() => sfx.firework(), 350); S.shake(0.15);
      [0, 250, 500].forEach(d => setTimeout(() => S.sparkle(new T.Vector3(c.x + U.rand(-2, 3), c.y + U.rand(3, 6), -0.5), U.pick(U.RAINBOW), 50, 6, { glow: 1.4 }), d));
      if (friends.length < FRIENDS.length) {   // a new animal friend hops out and tags along
        const name = FRIENDS[friends.length], a = actor(name, FRIEND_H[name]);
        a.root.position.set(c.x, c.y + 0.5, -0.3); scene.add(a.root);
        friends.push({ a, name, x: c.x, y: c.y, face: 1, hop: 1 });
        const sp = S.toScreen(new T.Vector3(c.x, c.y + 2.5, 0)); if (!sp.behind) api.fx.floatEmoji(sp.x, sp.y, FRIEND_EMOJI[name], { size: 90, life: 1.8 });
      }
      zoneShown = c.zone + 1;
    }

    // ---------- pick your cube kid ----------
    let picking = true, sel = game.pick || 0, stickHeld = false, settleT = 0.4, idleT = 0;
    const cands = CHARS.map((n, i) => { const a = actor(n, 1.6, { ownMaterials: true }); a.root.position.set(1.5 + i * 2.2, gen.h, 0.3); scene.add(a.root); a.loop('Idle'); return a; });
    const spot = new T.Mesh(S.track(new T.RingGeometry(0.75, 0.95, 40)), S.track(new T.MeshBasicMaterial({ color: '#fff2a8', transparent: true, opacity: 0.8, depthWrite: false })));
    spot.rotation.x = -Math.PI / 2; scene.add(spot);
    S.hero = () => {   // menu icon (tools/make-icons.js, hidden window only): the kid under a ? block with a coin
      const a = cands[sel], q = new T.Mesh(block('QuestionMark').geo, block('QuestionMark').mat);
      a.root.rotation.y = 0.35; q.position.set(a.root.position.x, gen.h + 2.6, 0.3); scene.add(q);
      const c = new T.Group(); const cm = mesh(geo.cyl, coinM); cm.scale.set(0.34, 0.07, 0.34); cm.rotation.x = Math.PI / 2; c.add(cm); c.position.set(a.root.position.x + 0.9, gen.h + 1.9, 0.3); scene.add(c);
      return [a.root, q, c];
    };
    function choose(d) { sel = (sel + d + CHARS.length) % CHARS.length; settleT = 0.25; sfx.tick(); sfx.whoosh(); input.rumble(0.2, 50); }
    function pick() {
      picking = false; game.pick = sel; hero = cands[sel];
      cands.forEach(c => { if (c !== hero) { S.sparkle(c.root.position.clone().setY(gen.h + 0.8), U.pick(U.RAINBOW), 24, 4, { glow: 1.2 }); scene.remove(c.root); } });
      P.x = hero.root.position.x; P.y = gen.h; lastSafe = { x: P.x, y: P.y }; hero.root.position.z = 0;
      hero.once('Yes'); sfx.cheer(); input.rumble(0.5, 200); spot.visible = false;
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
        const on = i === sel, s = U.lerp(c.root.scale.x, on ? 1.25 : 0.9, Math.min(1, dt * 8));
        c.root.scale.setScalar(s); c.root.rotation.y = U.lerp(c.root.rotation.y, on ? 0 : (i < sel ? 0.5 : -0.5), Math.min(1, dt * 6));
        c.update(dt);
      });
      spot.position.set(cands[sel].root.position.x, gen.h + 0.03, 0.3); spot.material.opacity = 0.6 + Math.sin(t * 4) * 0.2;
      camera.position.lerp(new T.Vector3(4.8, gen.h + 2.5, 10.5), Math.min(1, dt * 3)); camera.lookAt(4.8, gen.h + 1.1, 0);
    }
    camera.position.set(4.8, gen.h + 2.5, 10.5);
    S.debug = { P, ground, tiles };   // DevTools: __stage.debug.P.x = ...
    S.state = () => ({ x: +P.x.toFixed(1), y: +P.y.toFixed(1), coins: coinsN, friends: friends.length, zone: zoneShown, foes: foes.length, star: P.star > 0, bubble: !!P.bubble });   // for tests / DevTools

    // ---------- play ----------
    function updatePlay(dt) {
      for (const b of input.pressed) {
        if (b === 0 || b === 3) P.buffer = 0.15;
        else if (b === 1 || b === 2) punch();
        else if (b === 4 || b === 5) { hero.once('Wave'); sfx.chime(); }
      }
      P.punchCD -= dt; P.hurt -= dt; P.buffer -= dt;
      const jumpHeld = input.down.has(0) || input.down.has(3), dash = input.down.has(6) || input.down.has(7);

      if (P.bubble) {   // floating back to safety after a fall
        const B = P.bubble; B.t += dt; const k = U.ease(Math.min(1, B.t / 1.3));
        P.x = U.lerp(B.fx, lastSafe.x, k); P.y = U.lerp(B.fy, lastSafe.y + 1.2, k) + Math.sin(B.t * 6) * 0.08;
        bubble.visible = true; bubble.position.set(P.x, P.y + 0.8, 0); bubble.scale.setScalar(1.05 + Math.sin(B.t * 8) * 0.05);
        if (Math.random() < dt * 8) sfx.bubble();
        if (B.t > 1.5) { P.bubble = null; bubble.visible = false; P.vx = P.vy = 0; sfx.pop(); S.sparkle(new T.Vector3(P.x, P.y + 0.8, 0.3), '#bfe9ff', 24, 4, { glow: 1.2 }); }
        hero.loop('Jump_Idle');
      } else {
        // run
        const top = (dash ? 10 : 6.5) * (P.star > 0 ? 1.3 : 1) * CONFIG.stickSpeed, target = input.x * top;
        if (P.hurt < 0.45) { const acc = (P.ground ? 45 : 28) * dt; P.vx += U.clamp(target - P.vx, -acc, acc); }
        if (Math.abs(input.x) > 0.2) P.face = Math.sign(input.x);
        // jump: coyote time + buffer + a double jump
        if (P.ground) { P.coyote = 0.12; P.jumps = 0; } else P.coyote -= dt;
        if (P.buffer > 0) {
          if (P.coyote > 0) { P.vy = 12; P.coyote = 0; P.buffer = 0; P.jumps = 1; jumpFx(1); }
          else if (P.jumps < 2) { P.vy = 11; P.buffer = 0; P.jumps = 2; jumpFx(2); }
        }
        P.vy = Math.max(-18, P.vy - 36 * (P.vy > 0 && jumpHeld ? 0.5 : 1) * dt);
        const was = P.ground;
        move(P, dt, tl => hitTile(tl, true));
        if (P.x < minX + 0.4) { P.x = minX + 0.4; P.vx = Math.max(0, P.vx); }
        if (P.ground && !was) { P.squash = 1; sfx.synth({ type: 'sine', freq: 140, slideTo: 90, dur: 0.08, vol: 0.12 }); }
        if (P.ground && tiles.has(tk(Math.floor(P.x - 0.45), Math.floor(P.y - 0.5))) && tiles.has(tk(Math.floor(P.x + 0.45), Math.floor(P.y - 0.5)))) lastSafe = { x: P.x, y: P.y };
        if (P.y < -0.9) {
          P.bubble = { t: 0, fx: P.x, fy: P.y }; sfx.bubble(); sfx.whoosh(); input.rumble(0.3, 150);
          S.sparkle(new T.Vector3(P.x, -1.1, 0.3), '#bfe9ff', 30, 5, { gravity: 8, glow: 1.1 }); S.ring(new T.Vector3(P.x, -1.15, 0), '#ffffff', 2, 0.6, 0.6);
        }
        // animation
        if (!P.ground) hero.loop('Jump_Idle');
        else if (Math.abs(P.vx) > 0.6) hero.loop('Run', U.clamp(Math.abs(P.vx) / 6.5, 0.7, 1.6));
        else hero.loop('Idle');
      }
      // star power: sparkly, fast, enemies pop on touch
      if (P.star > 0) {
        P.star -= dt;
        const c = new T.Color().setHSL((t * 1.5) % 1, 0.9, 0.55);
        hero.mats.forEach(m => { m.emissive.copy(c); m.emissiveIntensity = P.star > 0 ? 0.45 : 0; });
        if (Math.random() < 0.6) S.sparkle(new T.Vector3(P.x, P.y + U.rand(0.2, 1.4), 0.3), U.pick(U.RAINBOW), 2, 1.5, { glow: 1.2, life: 0.5 });
      }
      P.squash = Math.max(0, P.squash - dt * 5);
      P.yaw = U.lerp(P.yaw, faceYaw(P.face), Math.min(1, dt * 12));
      hero.root.position.set(P.x, P.y, 0); hero.root.rotation.y = P.yaw;
      const sq = Math.sin(P.squash * Math.PI) * 0.12; hero.root.scale.set(1 + sq, 1 - sq, 1 + sq);
      hero.update(dt);

      // enemies
      foes.forEach(f => {
        if (Math.abs(f.x - camX) > 24) return;
        if (f.dead) { f.dead -= dt; f.a.update(dt); if (f.dead <= 0) { scene.remove(f.a.root); f.gone = true; } return; }
        f.vx = f.dir * f.walk; f.vy = Math.max(-18, f.vy - 36 * dt);
        move(f, dt);
        if (f.wall) f.dir = -f.wall;
        else if (f.ground && !tiles.has(tk(Math.floor(f.x + f.dir * 0.55), Math.floor(f.y - 0.5)))) f.dir *= -1;   // turn at edges
        if (f.y < -1) { S.sparkle(new T.Vector3(f.x, -1.1, 0.3), '#bfe9ff', 16, 3, { gravity: 8 }); scene.remove(f.a.root); f.gone = true; return; }
        f.a.root.position.set(f.x, f.y, 0); f.a.root.rotation.y = faceYaw(f.dir); f.a.update(dt);
        // meet the player
        if (P.bubble) return;
        const dx = P.x - f.x;
        if (Math.abs(dx) < (P.w + f.w) / 2 && P.y < f.y + f.h && P.y + P.h > f.y) {
          if (P.star > 0) defeat(f, 'star');
          else if (P.vy < 0 && P.y > f.y + f.h * 0.4) { defeat(f, 'stomp'); P.vy = jumpHeld ? 13 : 9; P.jumps = 1; }
          else if (P.hurt <= 0) {   // just a bounce back: no losing
            P.hurt = 0.7; P.vx = Math.sign(dx || 1) * 8; P.vy = 6; f.dir = -Math.sign(dx || 1);
            hero.once('HitReact', 1.4); sfx.boop(); input.rumble(0.5, 150); S.sparkle(new T.Vector3(P.x - dx / 2, P.y + 1, 0.4), '#fff6c8', 12, 3, { glow: 1.2 });
          }
        }
      });
      for (let i = foes.length - 1; i >= 0; i--) if (foes[i].gone) foes.splice(i, 1);

      // coins, star items, chests
      for (let i = coins.length - 1; i >= 0; i--) {
        const c = coins[i]; c.g.rotation.y = t * 3 + c.ph;
        if (!P.bubble && Math.abs(c.x - P.x) < 0.65 && c.y > P.y - 0.3 && c.y < P.y + P.h + 0.3) { coinGet(c.x, c.y); scene.remove(c.g); coins.splice(i, 1); }
      }
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i]; it.rise = Math.min(1, it.rise + dt * 2);
        it.m.position.set(it.x, it.y - 0.6 + it.rise * 0.6 + Math.sin(t * 4) * 0.12, 0); it.m.rotation.y = t * 3;
        if (Math.abs(it.x - P.x) < 0.8 && it.y > P.y - 0.4 && it.y < P.y + P.h + 0.6) {
          scene.remove(it.m); items.splice(i, 1); P.star = 8;
          sfx.melody([0, 4, 7, 12, 7, 12, 16, 19], 0.08, 8); api.fx.confetti(api.w, api.h); input.rumble(0.6, 300);
        }
      }
      chests.forEach(c => { if (!c.open && P.x > c.x - 0.9 && Math.abs(P.y - c.y) < 2) openChest(c); if (c.open && c.cloth.position.y < 5.4) c.cloth.position.y += dt * 4; });

      // friends follow along the path the player took (hopping where the player jumped)
      trail.push({ t, x: P.x, y: P.y, face: P.face });
      while (trail.length && trail[0].t < t - 4) trail.shift();
      friends.forEach((fr, i) => {
        const want = t - 0.32 * (i + 1); let p = trail[0];
        for (let k = trail.length - 1; k >= 0; k--) if (trail[k].t <= want) { p = trail[k]; break; }
        if (!p) return;
        fr.hop = Math.max(0, fr.hop - dt * 2);
        const px = fr.x; fr.x = U.lerp(fr.x, p.x - p.face * 0.4, Math.min(1, dt * 10)); fr.y = U.lerp(fr.y, p.y, Math.min(1, dt * 10));
        const v = (fr.x - px) / dt; if (Math.abs(v) > 0.3) fr.face = Math.sign(v);
        const air = fr.y > (ground.get(Math.floor(fr.x)) ?? -9) + 0.3;
        fr.a.loop(air && fr.a.has('Jump_Loop') ? 'Jump_Loop' : Math.abs(v) > 0.4 ? 'Run' : 'Idle');
        fr.a.root.position.set(fr.x, fr.y + Math.sin(fr.hop * Math.PI) * 1.2, -0.35 - i * 0.12); fr.a.root.rotation.y = faceYaw(fr.face); fr.a.update(dt);
      });

      // camera: look ahead the way you run, follow height softly; the world is built ahead and dropped behind
      camX = U.lerp(camX, Math.max(minX + 8, P.x + P.face * 1.1), Math.min(1, dt * 3));
      if (P.ground || P.bubble) camGoalY = Math.max(P.y, 1);
      else if (P.y > camGoalY + 3.5) camGoalY = P.y - 3.5;
      else if (P.y < camGoalY - 1.5) camGoalY = P.y + 1.5;
      camY = U.lerp(camY, camGoalY, Math.min(1, dt * 2.5));
      camera.position.set(camX, camY + 3.2, 12.5); camera.lookAt(camX, camY + 2.1, 0);
      while (gen.x < camX + 36) genPiece();
      dropBehind(camX - 28);
    }

    return {
      resize: S.resize,
      update(dt) {
        t += dt;
        if (picking) updatePicker(dt); else updatePlay(dt);
        // bumped blocks, flying coins and debris
        tiles.forEach(tl => { if (tl.bump > 0) { tl.bump = Math.max(0, tl.bump - dt * 5); tl.mesh.position.y = tl.y + 0.5 + Math.sin(tl.bump * Math.PI) * 0.3; } });
        for (let i = fx.length - 1; i >= 0; i--) {
          const e = fx[i]; e.life -= dt;
          if (e.spin) { e.g.position.y += e.vy * dt; e.vy -= 25 * dt; e.g.rotation.y += dt * 18; }
          else { e.g.position.x += e.vx * dt; e.g.position.y += e.vy * dt; e.g.position.z += e.vz * dt; e.vy -= 25 * dt; e.g.rotation.x += e.rot * dt; e.g.rotation.z += e.rot * dt; }
          if (e.life <= 0) { scene.remove(e.g); fx.splice(i, 1); }
        }
        // sky changes with the world you're in
        const th = THEMES[zoneShown % THEMES.length], u = sky.material.uniforms, k = Math.min(1, dt * 1.5);
        u.top.value.lerp(skyCols.top.set(th.sky[0]), k); u.mid.value.lerp(skyCols.mid.set(th.sky[1]), k); u.bot.value.lerp(skyCols.bot.set(th.sky[2]), k);
        scene.fog.color.lerp(skyCols.bot, k);
        sky.position.copy(camera.position);
        sun.follow(camX, 0); water.position.x = camX;
        S.update(dt);
      },
      draw(ctx) {
        S.render();
        ctx.clearRect(0, 0, api.w, api.h);
        const w = api.w, h = api.h;
        if (picking) {   // no reading: arrows to choose, the bottom button to go
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
        // coins (a drawn coin + the count) and the friends you've found
        const s = Math.max(26, h * 0.045);
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 8;
        ctx.fillStyle = '#ffcc33'; ctx.beginPath(); ctx.arc(30 + s * 0.5, 26 + s * 0.5, s * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0; ctx.fillStyle = '#ff9d00'; ctx.beginPath(); ctx.arc(30 + s * 0.5, 26 + s * 0.5, s * 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.shadowBlur = 8; ctx.font = `800 ${s}px ui-rounded, system-ui, sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(coinsN, 38 + s * 1.1, 28 + s * 0.5);
        friends.forEach((fr, i) => U.emoji(ctx, FRIEND_EMOJI[fr.name], w - 40 - i * s * 1.25, 26 + s * 0.5, s));
        ctx.restore();
        if (CONFIG.showGuides) Kit3D.drawGuide(ctx, api, { 0: '⬆️', 1: '👊', 2: '👊', 3: '⬆️', 4: '👋', 5: '👋', 6: '💨', 7: '💨', stick: '🏃' }, 0.8);
      },
      destroy: S.destroy,
    };
  },
});
