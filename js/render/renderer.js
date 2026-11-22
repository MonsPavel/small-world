// Рендерер: слои, камера, свет день/ночь, погода, пикинг

import { proj, unproj } from './iso.js';
import { bakeTerrain } from './terrain.js';
import { drawBuilding, drawWell, drawLamp, drawPier, drawGrave, drawProject } from './buildings.js';
import { drawTree, drawVillagerFigure, drawEmote, drawNameTag, drawSelectionRing } from './entities.js';
import { FX } from './fx.js';
import { T } from '../sim/world.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cam = { ix: 0, iy: 592, zoom: 1 };
    this.fx = new FX();
    this.selected = null;
    this.hover = null;
    this.follow = false;
    this.sim = null;
    this.bake = null; this.bakeKey = '';
    this.waterTiles = [];
    this.onSelect = null; this.onHover = null;
    this._drag = null; this._moved = 0;
    this._bindEvents();
  }

  attach(sim) {
    this.sim = sim;
    this.bakeKey = '';
    const c = proj(sim.world.C, sim.world.C);
    this.cam.ix = c.x; this.cam.iy = c.y; this.cam.zoom = this.fitZoom();
    this.selected = null; this.follow = false;
    this.fx = new FX();
  }

  fitZoom() {
    const cw = this.canvas.clientWidth || 1280, ch = this.canvas.clientHeight || 720;
    return Math.max(0.38, Math.min(1.15, Math.min(cw / 2500, ch / 1500)));
  }

  _bindEvents() {
    const cv = this.canvas;
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId);
      this._drag = { x: e.clientX, y: e.clientY };
      this._moved = 0;
    });
    cv.addEventListener('pointermove', (e) => {
      if (this._drag) {
        const dx = e.clientX - this._drag.x, dy = e.clientY - this._drag.y;
        this._moved += Math.abs(dx) + Math.abs(dy);
        this.cam.ix -= dx / this.cam.zoom;
        this.cam.iy -= dy / this.cam.zoom;
        this._drag = { x: e.clientX, y: e.clientY };
        this.follow = false;
      } else {
        const hit = this.pick(e.clientX, e.clientY);
        if (hit !== this.hover) { this.hover = hit; this.onHover?.(hit, e); }
        cv.style.cursor = hit ? 'pointer' : 'grab';
      }
    });
    cv.addEventListener('pointerup', (e) => {
      const wasClick = this._moved < 6;
      this._drag = null;
      if (wasClick) {
        const hit = this.pick(e.clientX, e.clientY);
        this.onSelect?.(hit);
      }
    });
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const before = this.screenToIso(e.clientX, e.clientY);
      this.cam.zoom = Math.max(0.34, Math.min(2.6, this.cam.zoom * Math.exp(-e.deltaY * 0.0012)));
      const after = this.screenToIso(e.clientX, e.clientY);
      this.cam.ix += before.x - after.x;
      this.cam.iy += before.y - after.y;
    }, { passive: false });
  }

  screenToIso(cx, cy) {
    const r = this.canvas.getBoundingClientRect();
    const x = (cx - r.left - r.width / 2) / this.cam.zoom + this.cam.ix;
    const y = (cy - r.top - r.height / 2) / this.cam.zoom + this.cam.iy;
    return { x, y };
  }
  isoToScreen(ix, iy) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (ix - this.cam.ix) * this.cam.zoom + r.width / 2,
      y: (iy - this.cam.iy) * this.cam.zoom + r.height / 2,
    };
  }

  pick(cx, cy) {
    if (!this.sim) return null;
    const iso = this.screenToIso(cx, cy);
    const tile = unproj(iso.x, iso.y);
    // сначала жители (точнее)
    let best = null, bd = 14;
    for (const v of this.sim.alive()) {
      if (v.indoor) continue;
      const p = proj(v.x, v.y);
      const d = Math.hypot(p.x - iso.x, p.y - (iso.y - 6));
      if (d < bd) { bd = d; best = { kind: 'villager', v }; }
    }
    if (best) return best;
    const w = this.sim.world;
    const i = Math.floor(tile.x), j = Math.floor(tile.y);
    const b = w.buildings.find((b) => i >= b.x && i < b.x + b.w && j >= b.y && j < b.y + b.h);
    if (b) return { kind: 'building', b };
    const g = w.graves.find((g) => i === g.x && j === g.y);
    if (g) return { kind: 'grave', g };
    return null;
  }

  ensureBake(sim) {
    const key = `${sim.world._blockVersion}:${sim.time.seasonIndex()}:${sim.world.buildings.length}`;
    if (key === this.bakeKey) return;
    this.bakeKey = key;
    this.bake = bakeTerrain(sim.world, sim.time.seasonIndex(), sim.time.dayOfSeason());
    this.waterTiles = [];
    const w = sim.world;
    for (let j = 0; j < w.H; j++) for (let i = 0; i < w.W; i++) {
      if (w.isLand(i, j) && w.t(i, j) === T.WATER) this.waterTiles.push({ i, j });
    }
  }

  darkness(sim) {
    const h = sim.time.hour();
    let d;
    if (h >= 21.5 || h < 4.5) d = 1;
    else if (h >= 19) d = (h - 19) / 2.5;
    else if (h < 7) d = 1 - (h - 4.5) / 2.5;
    else d = 0;
    if (sim.weather.storm) d = Math.min(1, d + 0.22);
    else if (sim.weather.rain || sim.weather.snow) d = Math.min(1, d + 0.08);
    return d;
  }

  draw(sim, t, dt) {
    const cv = this.canvas, ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const cw = cv.clientWidth, ch = cv.clientHeight;
    if (cv.width !== cw * dpr || cv.height !== ch * dpr) { cv.width = cw * dpr; cv.height = ch * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.ensureBake(sim);
    this.fx.ambient(sim, dt);
    this.fx.update(dt);
    // consume sim fx
    while (sim.fxQueue.length) {
      const q = sim.fxQueue.shift();
      this.fx.burst(q.x, q.y, q.kind, q.n);
    }

    // следование за выбранным
    if (this.follow && this.selected?.alive) {
      const p = proj(this.selected.x, this.selected.y);
      this.cam.ix += (p.x - this.cam.ix) * Math.min(1, dt * 3);
      this.cam.iy += (p.y - this.cam.iy) * Math.min(1, dt * 3);
    }

    const d = this.darkness(sim);
    const season = sim.time.seasonIndex();

    // ==== небо ====
    const sky = ctx.createLinearGradient(0, 0, 0, ch);
    const topC = lerpC([233, 240, 244], [38, 48, 72], d), botC = lerpC([247, 243, 233], [58, 66, 88], d);
    sky.addColorStop(0, topC); sky.addColorStop(1, botC);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, cw, ch);
    // облака
    ctx.save();
    ctx.globalAlpha = d > 0.5 ? 0.06 : 0.14;
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < 4; i++) {
      const cx2 = ((t * (6 + i * 2.4) + i * 640) % (cw + 500)) - 250;
      const cy2 = 60 + i * 84;
      ctx.beginPath();
      ctx.ellipse(cx2, cy2, 130, 26, 0, 0, 6.28);
      ctx.ellipse(cx2 + 70, cy2 + 10, 90, 20, 0, 0, 6.28);
      ctx.fill();
    }
    ctx.restore();

    // ==== мир (изометрия) ====
    ctx.save();
    ctx.translate(cw / 2, ch / 2);
    ctx.scale(this.cam.zoom, this.cam.zoom);
    ctx.translate(-this.cam.ix, -this.cam.iy);

    // тень острова
    const cc = proj(sim.world.C, sim.world.C);
    const shGrad = ctx.createRadialGradient(cc.x, cc.y + 90, 100, cc.x, cc.y + 90, 1350);
    shGrad.addColorStop(0, 'rgba(40,50,60,0.22)');
    shGrad.addColorStop(1, 'rgba(40,50,60,0)');
    ctx.fillStyle = shGrad;
    ctx.save();
    ctx.translate(cc.x, cc.y + 90); ctx.scale(1, 0.42); ctx.translate(-cc.x, -(cc.y + 90));
    ctx.beginPath(); ctx.arc(cc.x, cc.y + 90, 1350, 0, 6.28); ctx.fill();
    ctx.restore();

    // местность
    ctx.drawImage(this.bake.canvas, -this.bake.ox, -this.bake.oy);

    // мерцание воды
    ctx.lineWidth = 1.1;
    for (const wt of this.waterTiles) {
      const ph = Math.sin(t * 1.6 + (wt.i * 7 + wt.j * 13) * 0.35);
      if (ph < 0.3) continue;
      const p = proj(wt.i + 0.5, wt.j + 0.5);
      ctx.strokeStyle = `rgba(255,255,255,${0.12 + ph * 0.14})`;
      ctx.beginPath();
      ctx.moveTo(p.x - 8, p.y);
      ctx.quadraticCurveTo(p.x, p.y - 2.2, p.x + 8, p.y);
      ctx.stroke();
    }

    // ==== объекты с сортировкой по глубине ====
    const glow = [];
    const night = d > 0.45;
    const items = [];
    const w = sim.world;

    items.push({ d: (25 + 26) + (26 + 27), draw: () => drawPier(ctx, w, t) });
    items.push({ d: 37.2, draw: () => drawWell(ctx, t) });
    items.push({ d: 33.2, draw: () => drawLamp(ctx, 16.4, 16.4, night, glow) });
    items.push({ d: 43.4, draw: () => drawLamp(ctx, 21.6, 21.6, night, glow) });

    for (const g of w.graves) items.push({ d: g.x + g.y + 0.4, draw: () => drawGrave(ctx, g, season) });
    for (const tr of w.trees) items.push({ d: tr.x + tr.y + 1, draw: () => drawTree(ctx, tr, season, t) });
    for (const b of w.buildings) {
      items.push({
        d: (b.x + b.w - 1) + (b.y + b.h - 1) + 0.45,
        draw: () => drawBuilding(ctx, b, { glow: night ? glow : null }),
      });
    }
    if (w.project) {
      const p = w.project;
      items.push({ d: (p.x + p.w - 1) + (p.y + p.h - 1) + 0.46, draw: () => drawProject(ctx, p) });
    }
    // спящие в домах — Z над крышей
    for (const v of sim.alive()) {
      if (v.indoor && v.action?.type === 'sleep') {
        const h = v.home(sim);
        if (h) {
          const p = proj(h.x + h.w / 2, h.y + h.h / 2);
          items.push({ d: (h.x + h.w - 1) + (h.y + h.h - 1) + 0.6, draw: () => {
            ctx.globalAlpha = 0.55 + Math.sin(t * 2 + v.id) * 0.25;
            ctx.fillStyle = '#7A8CA0';
            ctx.font = 'bold 9px system-ui';
            ctx.fillText('z', p.x + 6, p.y - 64);
            ctx.font = 'bold 7px system-ui';
            ctx.fillText('z', p.x + 13, p.y - 56);
            ctx.globalAlpha = 1;
          } });
        }
      }
    }
    // жители
    for (const v of sim.alive()) {
      if (v.indoor) continue;
      const p = proj(v.x, v.y);
      items.push({
        d: v.x + v.y + 0.5,
        draw: () => {
          drawVillagerFigure(ctx, v, p.x, p.y, 1, t, v.path?.length > 0);
          if (v.emote) drawEmote(ctx, v.emote.kind, p.x, p.y, t);
        },
      });
    }

    items.sort((a, b) => a.d - b.d);
    for (const it of items) it.draw();

    // частицы (в мировых координатах)
    this.fx.drawWorld(ctx);

    // выделение и подписи
    if (this.selected?.alive && !this.selected.indoor) {
      const v = this.selected;
      const p = proj(v.x, v.y);
      drawSelectionRing(ctx, p.x, p.y, t);
      drawNameTag(ctx, v.name, p.x, p.y - 2);
    }
    if (this.hover?.kind === 'villager' && this.hover.v !== this.selected) {
      const p = proj(this.hover.v.x, this.hover.v.y);
      drawNameTag(ctx, this.hover.v.name, p.x, p.y);
    }
    if (this.hover?.kind === 'building') {
      const b = this.hover.b;
      const p = proj(b.x + b.w / 2, b.y + b.h / 2);
      drawNameTag(ctx, b.def.label, p.x, p.y - 58);
    }

    ctx.restore();

    // ==== освещение ====
    if (d > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = d * 0.72;
      ctx.fillStyle = 'rgb(148,160,205)';
      ctx.fillRect(0, 0, cw, ch);
      ctx.restore();
      // закат/рассвет
      const h = sim.time.hour();
      const dusk = Math.max(0, 1 - Math.abs(h - 19.5) / 2) + Math.max(0, 1 - Math.abs(h - 5.5) / 2);
      if (dusk > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = Math.min(0.35, dusk * 0.3);
        ctx.fillStyle = 'rgb(255,150,70)';
        ctx.fillRect(0, 0, cw, ch);
        ctx.restore();
      }
      // тёплые окна и фонари
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const g of glow) {
        const s = this.isoToScreen(g.x, g.y);
        const r = g.r * this.cam.zoom;
        const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r);
        grad.addColorStop(0, `rgba(255,190,90,${0.5 * d})`);
        grad.addColorStop(1, 'rgba(255,190,90,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(s.x - r, s.y - r, r * 2, r * 2);
      }
      ctx.restore();
    }
    if (sim.weather.storm && Math.sin(t * 0.7) > 0.995) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(0, 0, cw, ch);
    }

    // ==== погода и виньетка ====
    this.fx.drawScreen(ctx, cw, ch);
    const vg = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.45, cw / 2, ch / 2, Math.max(cw, ch) * 0.75);
    vg.addColorStop(0, 'rgba(30,40,50,0)');
    vg.addColorStop(1, 'rgba(30,40,50,0.24)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, cw, ch);
  }
}

function lerpC(a, b, t) {
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}
