// Particles, confetti and floating emoji, shared by all games.
const Fx = (() => {
  let parts = [];

  function burst(x, y, color, n = 16, { speed = 320, size = 8, life = 0.9, gravity = 300, shape = 'circle' } = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = U.rand(0.3, 1) * speed;
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: gravity, life, max: life,
        size: U.rand(0.6, 1.2) * size, color: Array.isArray(color) ? U.pick(color) : color, shape, rot: Math.random() * 6, vr: U.rand(-6, 6) });
    }
  }
  function ring(x, y, color, maxR = 120, life = 0.5) {
    parts.push({ ring: true, x, y, r: 10, maxR, color, life, max: life });
  }
  function floatEmoji(x, y, ch, { size = 80, life = 1.6, vy = -120, vx = 0 } = {}) {
    parts.push({ emoji: ch, x, y, vx, vy, size, life, max: life, g: 0, rot: U.rand(-0.3, 0.3), vr: U.rand(-1, 1) });
  }
  function confetti(w, h) {
    for (let i = 0; i < 140; i++) {
      parts.push({ x: U.rand(0, w), y: U.rand(-h * 0.6, -10), vx: U.rand(-60, 60), vy: U.rand(80, 260), g: 60,
        life: 3.2, max: 3.2, size: U.rand(8, 16), color: U.pick(U.RAINBOW), shape: Math.random() < 0.5 ? 'rect' : 'star', rot: Math.random() * 6, vr: U.rand(-8, 8) });
    }
  }

  function update(dt) {
    for (const p of parts) {
      p.life -= dt;
      if (p.ring) { p.r += (p.maxR - p.r) * Math.min(1, dt * 8); continue; }
      p.vy += (p.g || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += (p.vr || 0) * dt;
    }
    parts = parts.filter(p => p.life > 0);
    if (parts.length > 900) parts.splice(0, parts.length - 900);
  }

  function draw(ctx) {
    for (const p of parts) {
      const a = Math.max(0, Math.min(1, p.life / (p.max * 0.5)));
      if (p.ring) {
        ctx.globalAlpha = a; ctx.strokeStyle = p.color; ctx.lineWidth = 8 * a + 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
      } else if (p.emoji) {
        U.emoji(ctx, p.emoji, p.x, p.y, p.size, p.rot, a);
      } else {
        ctx.globalAlpha = a; ctx.fillStyle = p.color;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        if (p.shape === 'rect') ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        else if (p.shape === 'star') { U.starPath(ctx, 0, 0, p.size * 0.7); ctx.fill(); }
        else { ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  return { burst, ring, floatEmoji, confetti, update, draw, clear: () => { parts = []; } };
})();
