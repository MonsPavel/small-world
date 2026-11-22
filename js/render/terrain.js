// Запечённая местность: тайлы, грунт острова (эффект диорамы), декор сезонов

import { T } from '../sim/world.js';
import { hash01 } from '../sim/rng.js';
import { proj, shade } from './iso.js';

const PAD = 24, SOIL = 40;

const PALETTES = {
  spring: { grass: ['#79B45F', '#71AB58', '#82BC66'], field: '#8A6B42', dirt: '#B39468', water: '#5FA8C7', deep: '#4C93B5', plaza: '#C9C2B2', plazaAlt: '#BFB8A6', rock: '#A8ABB0', sand: '#E4D5A8', crop: '#7FBF5A' },
  summer: { grass: ['#6DA85E', '#639C55', '#77B367'], field: '#8A6B42', dirt: '#B39468', water: '#57A3C6', deep: '#4389AE', plaza: '#C9C2B2', plazaAlt: '#BFB8A6', rock: '#A8ABB0', sand: '#E4D5A8', crop: '#4E9E3F' },
  autumn: { grass: ['#B09548', '#A58940', '#BAA057'], field: '#84613A', dirt: '#AE8D60', water: '#5C9AB8', deep: '#4A87A6', plaza: '#C9C2B2', plazaAlt: '#BFB8A6', rock: '#A8ABB0', sand: '#DFCE9E', crop: '#D9A83F' },
  winter: { grass: ['#E6ECEF', '#DDE6EA', '#EFF4F6'], field: '#B9B0A2', dirt: '#C4BBAB', water: '#7FB4CC', deep: '#6AA2BC', plaza: '#D6D3CC', plazaAlt: '#CCC9C1', rock: '#B8BCC2', sand: '#EDE7D4', crop: '#CFc9b9' },
};
const SEASON_KEYS = ['spring', 'summer', 'autumn', 'winter'];

export function bakeTerrain(world, seasonIdx, dayOfSeason) {
  const pal = PALETTES[SEASON_KEYS[seasonIdx]];
  const c = document.createElement('canvas');
  const W = world.W, H = world.H;
  const minX = -(H - 1) * 32 - PAD, maxX = (W - 1) * 32 + PAD;
  const maxY = (W + H - 2) * 16 + SOIL + PAD;
  c.width = maxX - minX; c.height = maxY;
  const ox = -minX, oy = PAD;
  const ctx = c.getContext('2d');

  // водная подложка (под островом тоже — озеро «висит» в блоке)
  // рисуем тайлы
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!world.isLand(i, j)) continue;
    const tt = world.tiles[world.idx(i, j)];
    const sh = hash01(i, j, 11);
    const p = proj(i, j);
    const x = p.x + ox, y = p.y + oy;
    let color;
    switch (tt) {
      case T.WATER: case T.PIER: color = sh > 0.5 ? pal.water : pal.deep; break;
      case T.SAND: color = shade(pal.sand, 0.96 + sh * 0.08); break;
      case T.ROCK: color = shade(pal.rock, 0.9 + sh * 0.16); break;
      case T.ROAD: color = shade(pal.dirt, 0.92 + sh * 0.12); break;
      case T.PLAZA: color = ((i + j) % 2 === 0) ? pal.plaza : pal.plazaAlt; break;
      case T.FIELD: color = shade(pal.field, 0.94 + sh * 0.1); break;
      default: color = pal.grass[(sh * 3) | 0];
    }
    ctx.fillStyle = color;
    diamond(ctx, x, y);
    ctx.fill();

    // детали тайла
    if (tt === T.GRASS) {
      if (seasonIdx !== 3) {
        ctx.strokeStyle = shade(color, 0.82); ctx.lineWidth = 1;
        const n = (sh * 3) | 0;
        for (let k = 0; k < n; k++) {
          const hx = hash01(i, j, 40 + k), hy = hash01(i, j, 80 + k);
          const px = x + (hx - 0.5) * 34, py = y + 10 + hy * 12;
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + (hx > 0.5 ? 1.5 : -1.5), py - 3); ctx.stroke();
        }
      }
      // цветы весной/летом
      if (seasonIdx <= 1 && hash01(i, j, 5) > 0.86) {
        const fc = ['#F2A3B3', '#F7E8A0', '#FFFFFF', '#C9A3E0'];
        for (let k = 0; k < 2; k++) {
          ctx.fillStyle = fc[(hash01(i, j, 90 + k) * 4) | 0];
          ctx.beginPath(); ctx.arc(x + (hash01(i, j, 60 + k) - 0.5) * 28, y + 10 + hash01(i, j, 70 + k) * 10, 1.4, 0, 6.28); ctx.fill();
        }
      }
      if (seasonIdx === 3 && hash01(i, j, 9) > 0.55) { // снежные наносы
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        diamond(ctx, x, y); ctx.fill();
      }
    }
    if (tt === T.ROAD) {
      ctx.fillStyle = shade(pal.dirt, 0.8);
      for (let k = 0; k < 2; k++) {
        if (hash01(i, j, 100 + k) > 0.5) {
          ctx.beginPath(); ctx.arc(x + (hash01(i, j, 120 + k) - 0.5) * 24, y + 8 + hash01(i, j, 130 + k) * 12, 1.6, 0, 6.28); ctx.fill();
        }
      }
    }
    if (tt === T.FIELD) {
      drawCrops(ctx, x, y, seasonIdx, dayOfSeason, sh);
    }
  }

  // прибрежная пена у кромки воды
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.2;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!world.isLand(i, j) || world.t(i, j) !== T.WATER) continue;
    const p = proj(i, j); const x = p.x + ox, y = p.y + oy;
    const landNear = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => {
      const tt = world.t(i + di, j + dj);
      return tt !== T.WATER && tt !== T.PIER && world.isLand(i + di, j + dj);
    });
    if (landNear) { ctx.strokeStyle = 'rgba(255,255,255,0.4)'; diamond(ctx, x, y); ctx.stroke(); }
  }

  // грунтовые «стороны» острова — эффект диорамы
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!world.isLand(i, j)) continue;
    const p = proj(i, j); const x = p.x + ox, y = p.y + oy;
    const e = [i + 1, j], s = [i, j + 1];
    const g1 = ctx.createLinearGradient(x, y + 16, x, y + 16 + SOIL);
    g1.addColorStop(0, '#8A6A44'); g1.addColorStop(0.35, '#6E5233'); g1.addColorStop(1, '#4A3620');
    const g2 = ctx.createLinearGradient(x, y + 32, x, y + 32 + SOIL);
    g2.addColorStop(0, '#8A6A44'); g2.addColorStop(0.35, '#6E5233'); g2.addColorStop(1, '#4A3620');
    if (!world.isLand(...e)) { // восточный склон
      ctx.fillStyle = g1;
      ctx.beginPath();
      ctx.moveTo(x + 32, y + 16); ctx.lineTo(x + 64, y + 32);
      ctx.lineTo(x + 64, y + 32 + SOIL); ctx.lineTo(x + 32, y + 16 + SOIL);
      ctx.closePath(); ctx.fill();
    }
    if (!world.isLand(...s)) { // южный склон
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.moveTo(x, y + 32); ctx.lineTo(x + 32, y + 48);
      ctx.lineTo(x + 32, y + 48 + SOIL); ctx.lineTo(x, y + 32 + SOIL);
      ctx.closePath(); ctx.fill();
    }
  }
  // тёмная кромка травы по краю
  ctx.strokeStyle = 'rgba(40,60,30,0.25)'; ctx.lineWidth = 2;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!world.isLand(i, j)) continue;
    const open = [[1, 0], [0, 1], [-1, 0], [0, -1]].some(([di, dj]) => !world.isLand(i + di, j + dj));
    if (open) { const p = proj(i, j); diamond(ctx, p.x + ox, p.y + oy); ctx.stroke(); }
  }

  return { canvas: c, ox, oy };
}

function diamond(ctx, x, y) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 32, y + 16);
  ctx.lineTo(x, y + 32);
  ctx.lineTo(x - 32, y + 16);
  ctx.closePath();
}

function drawCrops(ctx, x, y, season, dayOfSeason, sh) {
  if (season === 3) { // зима — стерня под снегом
    ctx.strokeStyle = 'rgba(160,150,130,0.6)';
    for (let r = 0; r < 3; r++) {
      ctx.beginPath(); ctx.moveTo(x - 20 + r * 5, y + 6 + r * 8); ctx.lineTo(x + 12 + r * 5, y + 22 + r * 8); ctx.stroke();
    }
    return;
  }
  const growth = season === 0 ? 0.3 + dayOfSeason / 8 * 0.4 : season === 1 ? 0.8 : 1;
  const colors = { 0: '#8FD06A', 1: '#4E9E3F', 2: '#D9A83F' };
  ctx.strokeStyle = colors[season];
  ctx.lineWidth = Math.max(1.4, 2.6 * growth);
  for (let r = 0; r < 3; r++) {
    for (let k = 0; k < 3; k++) {
      const px = x - 18 + r * 12 + k * 4, py = y + 8 + r * 8 + k * 2;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 2, py - 5 * growth); ctx.stroke();
    }
  }
  if (season === 2) { // спелые колосья
    ctx.fillStyle = '#E8C558';
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) {
      const px = x - 18 + r * 12 + k * 4, py = y + 8 + r * 8 + k * 2;
      ctx.beginPath(); ctx.ellipse(px + 2, py - 6, 1.6, 2.6, 0, 0, 6.28); ctx.fill();
    }
  }
}
