// Small shared helpers
const U = {
  rand: (a, b) => a + Math.random() * (b - a),
  randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  pick: arr => arr[Math.floor(Math.random() * arr.length)],
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  lerp: (a, b, t) => a + (b - a) * t,
  dist: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),
  ease: t => 1 - Math.pow(1 - t, 3),

  // Colours by face-button POSITION (standard mapping): 0 bottom, 1 right, 2 left, 3 top
  BTN_COLORS: ['#36d27a', '#ff4d6d', '#3fa7ff', '#ffcc33'],
  RAINBOW: ['#ff4d6d', '#ff9f1c', '#ffcc33', '#36d27a', '#3fa7ff', '#9b5de5', '#f15bb5'],

  ANIMALS: ['🐶', '🐱', '🐮', '🐷', '🐸', '🦁', '🐵', '🐰', '🦆', '🐘', '🐻', '🐼', '🐥', '🦒'],
  TREATS: ['🍓', '🍌', '🍎', '🍉', '🧁', '🍪', '🍒'],
  SHINY: ['⭐', '🌈', '❤️', '🌸', '🦋', '🐞', '✨', '🌟'],

  emoji(ctx, ch, x, y, size, rot = 0, alpha = 1, flip = false) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    if (flip) ctx.scale(-1, 1);
    ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, 0, size * 0.05);
    ctx.restore();
  },

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  starPath(ctx, x, y, r, points = 5, inner = 0.5, rot = -Math.PI / 2) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const rr = i % 2 ? r * inner : r;
      const a = rot + (i * Math.PI) / points;
      i ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
  },
};
