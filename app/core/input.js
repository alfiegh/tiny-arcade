// Merges every connected controller + the keyboard into ONE friendly "pad".
// Toddler rules: any face/shoulder button counts as an action, D-pad and either stick move.
const Input = (() => {
  const DEAD = 0.22;
  const ACTION_BUTTONS = new Set([0, 1, 2, 3, 4, 5, 6, 7, 10, 11]);
  const KEY_TO_BTN = { Space: 0, KeyX: 1, KeyZ: 2, KeyC: 3, KeyQ: 4, KeyE: 5, Enter: 9 };
  const KEY_TO_DPAD = { ArrowUp: 12, ArrowDown: 13, ArrowLeft: 14, ArrowRight: 15, KeyW: 12, KeyS: 13, KeyA: 14, KeyD: 15 };

  const keys = {};
  const keyQueue = [];
  let escQueued = false;
  addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey) return; // leave Cmd+Q etc. alone
    if (!keys[e.code]) {
      if (e.code === 'Escape') escQueued = true;
      if (e.code in KEY_TO_BTN) keyQueue.push(KEY_TO_BTN[e.code]);
      if (e.code in KEY_TO_DPAD) keyQueue.push(KEY_TO_DPAD[e.code]);
    }
    keys[e.code] = true;
    e.preventDefault();
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  // Hat switch used by some controllers in D-input mode (usually axis 9)
  function hat(gp) {
    const v = gp.axes[9];
    if (v === undefined || Math.abs(v) > 1.05) return [0, 0];
    const dirs = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
    const i = Math.round((v + 1) * 3.5);
    return dirs[i] || [0, 0];
  }

  const prevBtns = {};
  let lastFlick = 0, lastFlickY = 0;

  const s = {
    x: 0, y: 0,            // movement, unit circle
    moving: false,
    pressed: [],           // button indices pressed THIS frame (D-pad included as 12–15)
    actions: [],           // pressed action buttons this frame
    down: new Set(),
    flickX: 0, flickY: 0,  // -1/0/1 one-shot when stick/D-pad is pushed (for menus)
    escape: false,
    backHeld: 0,           // seconds SELECT+START held together
    pads: [],              // connected Gamepad objects
    idle: 0,               // seconds since any input
  };

  function poll(dt) {
    let x = 0, y = 0;
    const pressed = [];
    const down = new Set();
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(p => p && p.connected) : [];

    for (const gp of pads) {
      let ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      if (Math.hypot(ax, ay) < DEAD) { ax = 0; ay = 0; }
      if (!ax && !ay && gp.mapping === 'standard') {        // right stick works too
        const rx = gp.axes[2] || 0, ry = gp.axes[3] || 0;
        if (Math.hypot(rx, ry) > 0.35) { ax = rx; ay = ry; }
      }
      const btn = gp.buttons.map(b => b.pressed || b.value > 0.5);
      if (gp.mapping === 'standard') {
        if (btn[14]) ax = -1; if (btn[15]) ax = 1; if (btn[12]) ay = -1; if (btn[13]) ay = 1;
      } else {
        const [hx, hy] = hat(gp);
        if (hx || hy) {
          ax = hx; ay = hy;
          // fake D-pad presses so games that react to D-pad still work
          if (hy < 0) btn[12] = true; if (hy > 0) btn[13] = true; if (hx < 0) btn[14] = true; if (hx > 0) btn[15] = true;
        }
      }
      if (Math.abs(ax) > Math.abs(x)) x = ax;
      if (Math.abs(ay) > Math.abs(y)) y = ay;
      const prev = prevBtns[gp.index] || [];
      btn.forEach((v, i) => { if (v) down.add(i); if (v && !prev[i]) pressed.push(i); });
      prevBtns[gp.index] = btn;
    }

    // keyboard
    const kx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
    const ky = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
    if (kx) x = kx; if (ky) y = ky;
    for (const [code, b] of Object.entries(KEY_TO_BTN)) if (keys[code]) down.add(b);
    pressed.push(...keyQueue.splice(0));

    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }

    // one-shot flicks for menu navigation (with hysteresis)
    s.flickX = 0; s.flickY = 0;
    if (Math.abs(x) > 0.6 && Math.abs(lastFlick) < 0.35) s.flickX = Math.sign(x);
    if (Math.abs(y) > 0.6 && Math.abs(lastFlickY) < 0.35) s.flickY = Math.sign(y);
    lastFlick = x; lastFlickY = y;

    s.x = x; s.y = y; s.moving = m > 0.05;
    s.pressed = pressed;
    s.actions = pressed.filter(b => ACTION_BUTTONS.has(b));
    s.down = down;
    s.pads = pads;
    s.escape = escQueued; escQueued = false;
    s.backHeld = down.has(8) && down.has(9) ? s.backHeld + dt : 0;
    s.idle = (pressed.length || s.moving) ? 0 : s.idle + dt;
  }

  function rumble(strength = 0.5, ms = 120) {
    if (!window.CONFIG.rumble) return;
    for (const gp of s.pads) {
      try {
        gp.vibrationActuator?.playEffect('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.7 });
      } catch (e) { /* not supported */ }
    }
  }

  return Object.assign(s, { poll, rumble });
})();
