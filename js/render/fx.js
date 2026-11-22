// Частицы: дым, листья, сердца, искры, снег/дождь (экранное пространство)

import { proj } from './iso.js';

export class FX {
  constructor() { this.world = []; this.screen = []; this.t = 0; }

  burst(x, y, kind, n = 6) {
    for (let i = 0; i < n; i++) this.spawnWorld(x, y, kind);
  }

  spawnWorld(x, y, kind) {
    const p = { x: proj(x, y).x + (Math.random() - 0.5) * 14, y: proj(x, y).y - Math.random() * 8, kind, age: 0, seed: Math.random() * 10 };
    switch (kind) {
      case 'heart': p.life = 1.6; p.vy = -22; p.vx = (Math.random() - 0.5) * 10; break;
      case 'sparkle': p.life = 1.1; p.vy = -8; p.vx = (Math.random() - 0.5) * 16; break;
      case 'dust': p.life = 0.9; p.vy = -12; p.vx = (Math.random() - 0.5) * 22; break;
      case 'anger': p.life = 0.7; p.vy = -30; p.vx = (Math.random() - 0.5) * 40; break;
      case 'zzz': p.life = 2.4; p.vy = -8; p.vx = 6; break;
      case 'smoke': p.life = 3.4; p.vy = -14 - Math.random() * 6; p.vx = (Math.random() - 0.5) * 6; break;
      case 'leaf': p.life = 3.2; p.vy = 10; p.vx = -6; break;
      case 'firefly': p.life = 4; p.vy = 0; p.vx = 0; break;
      default: p.life = 1;
    }
    this.world.push(p);
  }

  // Фоновая эмиссия: дым труб, листья, светлячки
  ambient(sim, dt) {
    this.t += dt;
    const season = sim.time.seasonIndex();
    const night = sim.time.hour() >= 20 || sim.time.hour() < 6;
    // дым из труб домов
    if (Math.random() < dt * (night || season === 3 ? 2.2 : 0.7)) {
      const houses = sim.world.buildingsOf('house');
      if (houses.length) {
        const b = houses[(Math.random() * houses.length) | 0];
        this.spawnWorld(b.x + b.w / 2 + 0.3, b.y + 0.2, 'smoke');
      }
    }
    // осенние листья
    if (season === 2 && Math.random() < dt * 3) {
      const trees = sim.world.trees;
      if (trees.length) { const t = trees[(Math.random() * trees.length) | 0]; this.spawnWorld(t.x, t.y, 'leaf'); }
    }
    // светлячки летом ночью
    if (season === 1 && night && Math.random() < dt * 2) {
      this.spawnWorld(6 + Math.random() * 26, 8 + Math.random() * 22, 'firefly');
    }
    // дождь и снег — экранное пространство
    if (sim.weather.rain || sim.weather.snow) {
      const target = sim.weather.storm ? 260 : sim.weather.snow ? 130 : 160;
      while (this.screen.length < target * dt * 2 && this.screen.length < target) {
        this.screen.push({
          x: Math.random(), y: Math.random(), speed: sim.weather.snow ? 0.05 + Math.random() * 0.05 : 0.9 + Math.random() * 0.5,
          drift: Math.random() * 2 - 1, seed: Math.random() * 10, snow: sim.weather.snow,
        });
      }
    }
  }

  update(dt) {
    for (let i = this.world.length - 1; i >= 0; i--) {
      const p = this.world[i];
      p.age += dt;
      if (p.age >= p.life) { this.world.splice(i, 1); continue; }
      p.x += (p.vx + Math.sin(this.t * 2 + p.seed) * 6) * dt;
      p.y += p.vy * dt;
      if (p.kind === 'leaf') p.vy = Math.min(18, p.vy + 8 * dt);
      if (p.kind === 'smoke') { p.vy *= (1 - 0.1 * dt); }
      if (p.kind === 'firefly') { p.x += Math.sin(this.t + p.seed * 3) * 12 * dt; p.y += Math.cos(this.t * 1.3 + p.seed * 2) * 8 * dt; }
    }
    for (const s of this.screen) {
      s.y += s.speed * dt;
      s.x += s.drift * dt * (s.snow ? 0.05 : 0.003);
      if (s.y > 1.05) { s.y = -0.05; s.x = Math.random(); }
    }
    if (this.screen.length && !(this._weatherOn)) this._weatherOn = true;
  }

  drawWorld(ctx) {
    for (const p of this.world) {
      const k = p.age / p.life;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - k) * (p.kind === 'smoke' ? 0.35 : 1);
      switch (p.kind) {
        case 'heart': drawHeart(ctx, p.x, p.y, 4.5); break;
        case 'sparkle': {
          ctx.strokeStyle = '#FFE9A0'; ctx.lineWidth = 1.2;
          const r = 3 + (1 - Math.abs(0.5 - k) * 2) * 3;
          ctx.beginPath();
          ctx.moveTo(p.x - r, p.y); ctx.lineTo(p.x + r, p.y);
          ctx.moveTo(p.x, p.y - r); ctx.lineTo(p.x, p.y + r);
          ctx.stroke(); break;
        }
        case 'dust': ctx.fillStyle = '#C9B08A'; ctx.beginPath(); ctx.arc(p.x, p.y, 2 + k * 5, 0, 6.28); ctx.fill(); break;
        case 'anger': {
          ctx.fillStyle = '#F08D5A';
          ctx.beginPath();
          for (let a = 0; a < 5; a++) {
            const ang = a / 5 * 6.28 - 1.57;
            ctx.lineTo(p.x + Math.cos(ang) * 4, p.y + Math.sin(ang) * 4);
            ctx.lineTo(p.x + Math.cos(ang + 0.63) * 1.6, p.y + Math.sin(ang + 0.63) * 1.6);
          }
          ctx.closePath(); ctx.fill(); break;
        }
        case 'zzz': ctx.fillStyle = '#8FA3B8'; ctx.font = 'bold 8px system-ui'; ctx.fillText('Z', p.x, p.y); break;
        case 'smoke': ctx.fillStyle = '#E8E4DC'; ctx.beginPath(); ctx.arc(p.x, p.y, 2.5 + k * 6, 0, 6.28); ctx.fill(); break;
        case 'leaf': ctx.fillStyle = ['#D98E4A', '#C9653B', '#E0B34F'][(p.seed * 3 | 0) % 3]; ctx.beginPath(); ctx.ellipse(p.x, p.y, 2.6, 1.4, k * 5, 0, 6.28); ctx.fill(); break;
        case 'firefly': {
          ctx.globalAlpha = Math.max(0, Math.sin(k * 3.14)) * 0.9;
          ctx.fillStyle = '#FFF3A0';
          ctx.shadowColor = '#FFE97A'; ctx.shadowBlur = 6;
          ctx.beginPath(); ctx.arc(p.x, p.y, 1.5, 0, 6.28); ctx.fill();
          ctx.shadowBlur = 0; break;
        }
      }
      ctx.restore();
    }
  }

  drawScreen(ctx, w, h) {
    if (!this.screen.length) return;
    ctx.save();
    if (this.screen[0].snow) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (const s of this.screen) {
        ctx.beginPath(); ctx.arc(s.x * w, s.y * h, 1.4, 0, 6.28); ctx.fill();
      }
    } else {
      ctx.strokeStyle = 'rgba(180,200,220,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (const s of this.screen) {
        ctx.moveTo(s.x * w, s.y * h);
        ctx.lineTo(s.x * w - 2, s.y * h - 10);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawHeart(ctx, x, y, s) {
  ctx.fillStyle = '#E46A6A';
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s, y - s * 0.6, x - s * 0.4, y - s * 1.1, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.4, y - s * 1.1, x + s, y - s * 0.6, x, y + s * 0.35);
  ctx.fill();
}
