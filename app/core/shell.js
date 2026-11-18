// Launcher menu + game loop
(() => {
  const cv = document.getElementById('stage');
  const ctx = cv.getContext('2d');
  const hintEl = document.getElementById('parent-hint');
  const meterEl = document.getElementById('back-meter');
  const meterBar = meterEl.firstElementChild;

  const api = {
    w: 0, h: 0, input: Input, sfx: Sfx, fx: Fx,
    celebrate() {
      Fx.confetti(api.w, api.h);
      Sfx.cheer();
      Input.rumble(0.6, 300);
    },
  };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    api.w = innerWidth; api.h = innerHeight;
    cv.width = api.w * dpr; cv.height = api.h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    current?.resize?.();
  }
  addEventListener('resize', resize);

  let mode = 'menu', current = null, selected = 0, scroll = 0, t = 0, fade = 1, pending = null;
  let hintTimer = 0;
  // loading screen: shown once the fade is fully dark, kept up while the game builds and its first frames compile shaders
  const loaderEl = document.getElementById('loader');
  let loadFrames = 0, loaderHideIn = 0;
  function showLoader(game) {
    const em = loaderEl.querySelector('.ld-emoji'), img = loaderEl.querySelector('.ld-icon');
    em.textContent = ''; img.style.display = 'block';
    img.onerror = () => { img.style.display = 'none'; em.textContent = game.emoji; };   // no icon file: emoji
    img.src = `assets/icons/${game.id}.png`;
    loaderEl.querySelector('.ld-tile').style.background = game.color;
    loaderEl.classList.add('on'); loadFrames = 0;
  }
  let assetsReady = typeof Assets === 'undefined';
  if (!assetsReady) Assets.ready.then(() => { assetsReady = true; });
  // menu icons: 3D renders of each game's hero (app/assets/icons/<id>.png, made by `npm run icons`); emoji until loaded / if missing
  const icons = {};
  Games.list.forEach(g => { const im = new Image(); im.onload = () => { icons[g.id] = im; }; im.src = `assets/icons/${g.id}.png`; });
  const bubbles = Array.from({ length: 26 }, () => ({ x: Math.random(), y: Math.random(), r: U.rand(10, 46), s: U.rand(0.02, 0.06), c: U.pick(U.RAINBOW) }));

  function startGame(i) {
    Sfx.whoosh(); Sfx.note(5); Sfx.note(7, { delay: 0.1 }); Sfx.note(10, { delay: 0.2 });
    Input.rumble(0.3, 120);
    pending = () => {
      Fx.clear();
      current = Games.list[i].create(api);
      mode = 'game';
      showHint();
    };
    pending.loading = Games.list[i];
  }
  function toMenu() {
    if (mode === 'menu') return;
    pending = () => {
      current?.destroy?.();
      current = null; mode = 'menu'; Fx.clear();
      Sfx.speak(CONFIG.words.welcome, { force: true });
      showHint();
    };
  }
  function showHint() { hintTimer = 6; }

  // ---------- MENU ----------
  function updateMenu(dt) {
    const n = Games.list.length;
    if (Input.flickX) {
      selected = (selected + Input.flickX + n) % n;
      Sfx.note(selected + 3); Input.rumble(0.15, 40);
      Sfx.speak(Games.list[selected].name, { force: true });
    }
    if (Input.actions.length || Input.pressed.includes(9)) startGame(selected);
    // gently wrap the scroll so it takes the short way round
    let target = selected;
    if (target - scroll > n / 2) scroll += n; else if (scroll - target > n / 2) scroll -= n;
    scroll = U.lerp(scroll, target, Math.min(1, dt * 9));
  }

  function drawMenu() {
    const { w, h } = api;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#2b1d6b'); g.addColorStop(1, '#5a2a8a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    for (const b of bubbles) {
      b.y -= b.s * 0.016; if (b.y < -0.1) { b.y = 1.1; b.x = Math.random(); }
      ctx.globalAlpha = 0.18; ctx.fillStyle = b.c;
      ctx.beginPath(); ctx.arc(b.x * w + Math.sin(t + b.r) * 20, b.y * h, b.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // title
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 ${Math.min(w * 0.07, 84)}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.fillText('Tiny Arcade', w / 2, h * 0.13 + Math.sin(t * 2) * 4);

    // carousel
    const n = Games.list.length;
    const size = Math.min(w * 0.3, h * 0.46);
    const gap = size * 0.95;
    for (let k = -2; k <= 2; k++) {
      const i = ((Math.round(scroll) + k) % n + n) % n;
      const offset = Math.round(scroll) + k - scroll;
      const x = w / 2 + offset * gap;
      const focus = Math.max(0, 1 - Math.abs(offset));
      const s = size * (0.62 + 0.38 * focus) * (i === selected ? 1 + Math.sin(t * 5) * 0.025 : 1);
      const y = h * 0.52;
      const game = Games.list[i];
      ctx.globalAlpha = 0.45 + 0.55 * focus;
      ctx.fillStyle = game.color;
      ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 30 * focus; ctx.shadowOffsetY = 12 * focus;
      U.roundRect(ctx, x - s / 2, y - s / 2, s, s, s * 0.18); ctx.fill();
      ctx.shadowColor = 'transparent';
      if (focus > 0.5) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 8; ctx.stroke(); }
      const icon = icons[game.id];
      if (icon) {   // the 3D hero, bobbing gently, with a soft shadow so it sits on the tile
        const is = s * 0.84, bob = Math.sin(t * 3 + i) * s * 0.015 * focus;
        ctx.save();
        ctx.translate(x, y - s * 0.07 + bob); ctx.rotate(Math.sin(t * 2 + i) * 0.03 * focus);
        ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = s * 0.05; ctx.shadowOffsetY = s * 0.03;
        ctx.drawImage(icon, -is / 2, -is / 2, is, is);
        ctx.restore();
      } else U.emoji(ctx, game.emoji, x, y - s * 0.06, s * 0.5, Math.sin(t * 3 + i) * 0.08 * focus, 0.45 + 0.55 * focus);
      ctx.fillStyle = '#fff';
      ctx.font = `800 ${s * 0.11}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`;
      ctx.fillText(game.name, x, y + s * 0.34);
    }
    ctx.globalAlpha = 1;

    // arrows
    const ax = Math.sin(t * 4) * 8;
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.font = `${size * 0.22}px system-ui`;
    ctx.fillText('◀', w / 2 - gap * 1.35 - ax, h * 0.52);
    ctx.fillText('▶', w / 2 + gap * 1.35 + ax, h * 0.52);

    // "press a button" with the four coloured buttons bouncing
    const by = h * 0.88, br = Math.min(26, h * 0.03);
    [[0, 1], [1, 0], [0, -1], [-1, 0]].forEach(([dx, dy], i) => {
      const bounce = Math.max(0, Math.sin(t * 6 - i * 0.9)) * 8;
      const idx = [0, 1, 3, 2][i]; // bottom, right, top, left
      ctx.fillStyle = U.BTN_COLORS[idx];
      ctx.beginPath(); ctx.arc(w / 2 + dx * br * 1.6, by + dy * br * 1.6 - bounce, br, 0, Math.PI * 2); ctx.fill();
    });

    // controller status
    const connected = Input.pads.length > 0;
    ctx.font = `600 ${Math.max(14, h * 0.022)}px system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillStyle = connected ? '#7dffb0' : '#ffd166';
    ctx.fillText(connected ? `🎮 Controller ready` : '🎮 Turn on the controller and press a button', w - 20, 28);
    ctx.textAlign = 'center';
  }

  // ---------- LOOP ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    Input.poll(dt);

    // parent escape hatch
    const need = CONFIG.backHoldSeconds;
    if (mode === 'game') {
      if (Input.escape || Input.backHeld >= need) toMenu();
      meterEl.classList.toggle('on', Input.backHeld > 0.1);
      meterBar.style.width = `${Math.min(100, (Input.backHeld / need) * 100)}%`;
    } else {
      meterEl.classList.remove('on');
      if (Input.escape && window.tinyArcade?.isElectron) window.tinyArcade.toggleFullscreen();
    }
    hintTimer -= dt;
    hintEl.classList.toggle('hidden', hintTimer <= 0 && mode === 'game');

    // fade transitions
    if (pending) {
      fade = Math.min(1, fade + dt * 4);
      if (fade >= 1) {
        const game = pending.loading;
        if (game && !loaderEl.classList.contains('on')) showLoader(game);
        if (game) loadFrames++;
        // wait for the 3D models (first launch) and let the loader paint before the heavy create()
        if (assetsReady && (!game || loadFrames > 2)) { pending(); pending = null; if (game) loaderHideIn = 3; }
      }
    }
    else fade = Math.max(0, fade - dt * 3);

    if (!pending) {
      if (mode === 'menu') updateMenu(dt);
      else current.update(dt);
    }
    Fx.update(dt);

    if (mode === 'menu') drawMenu(); else current.draw(ctx);
    Fx.draw(ctx);

    if (fade > 0) { ctx.fillStyle = `rgba(27,20,64,${fade})`; ctx.fillRect(0, 0, api.w, api.h); }
    if (loaderHideIn > 0 && --loaderHideIn === 0) loaderEl.classList.remove('on');   // game has drawn a few frames: fade the loader out
    requestAnimationFrame(frame);
  }

  resize();
  showHint();
  // Developer shortcut: open index.html#dino-world (any game id) to jump straight into a game
  const wanted = Games.list.findIndex(g => g.id === location.hash.slice(1));
  if (wanted >= 0) { selected = wanted; scroll = wanted; startGame(wanted); }
  setTimeout(() => Sfx.speak(CONFIG.words.welcome), 600);
  addEventListener('gamepadconnected', () => { Sfx.cheer(); Input.rumble(0.4, 200); });
  requestAnimationFrame(frame);
})();
