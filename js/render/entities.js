// Деревья и жители: фигурки, эмодзи-пузыри, переносимые предметы

import { proj, shade } from './iso.js';
import { PROFESSIONS } from '../sim/defs.js';

const FOLIAGE = {
  spring: ['#6FA85A', '#7FBF66', '#5E9850'],
  summer: ['#5E9A4E', '#6FB35C', '#4F8A42'],
  autumn: ['#C98A3F', '#D9A03F', '#B26E35'],
  winter: ['#E8EEF1', '#DCE6EA', '#CFDCE2'],
};
const SEASON_KEYS = ['spring', 'summer', 'autumn', 'winter'];

export function drawTree(ctx, tree, season, t) {
  const p = proj(tree.x + 0.5, tree.y + 0.5);
  const sway = Math.sin(t * 0.9 + tree.phase) * 0.018;
  if (tree.stump) {
    ctx.fillStyle = '#8A6A48';
    ctx.beginPath(); ctx.ellipse(p.x, p.y - 2, 3.2 * tree.size, 2 * tree.size, 0, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#C9A96E';
    ctx.beginPath(); ctx.ellipse(p.x, p.y - 3, 2.4 * tree.size, 1.4 * tree.size, 0, 0, 6.28); ctx.fill();
    return;
  }
  const s = tree.size;
  // тень
  ctx.fillStyle = 'rgba(40,60,40,0.18)';
  ctx.beginPath(); ctx.ellipse(p.x + 2, p.y + 2, 11 * s, 5 * s, 0, 0, 6.28); ctx.fill();
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(sway);
  const fol = FOLIAGE[SEASON_KEYS[season]];
  if (tree.pine) {
    ctx.fillStyle = season === 3 ? '#5E7A6A' : '#4E7A4A';
    ctx.fillRect(-1.5 * s, -8 * s, 3 * s, 8 * s);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = shade(season === 3 ? '#6E8A7A' : '#3E6E3E', 1 - i * 0.12);
      const w = (14 - i * 3) * s, y = -8 * s - i * 7 * s;
      ctx.beginPath();
      ctx.moveTo(-w / 2, y); ctx.lineTo(0, y - 10 * s); ctx.lineTo(w / 2, y);
      ctx.closePath(); ctx.fill();
    }
    if (season === 3) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath(); ctx.moveTo(-4 * s, -22 * s); ctx.lineTo(0, -30 * s); ctx.lineTo(4 * s, -22 * s); ctx.closePath(); ctx.fill();
    }
  } else {
    ctx.fillStyle = '#7A5A3C';
    ctx.fillRect(-1.8 * s, -9 * s, 3.6 * s, 9 * s);
    const cy = [-16, -22, -27], cx = [-4, 5, 0], r = [9, 8, 7];
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = fol[i % 3];
      ctx.beginPath(); ctx.ellipse(cx[i] * s * 0.6, cy[i] * s, r[i] * s, (r[i] - 1.5) * s, 0, 0, 6.28); ctx.fill();
    }
    if (season === 3) {
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.beginPath(); ctx.ellipse(0, -27 * s, 6 * s, 3.5 * s, 0, 0, 6.28); ctx.fill();
    }
  }
  ctx.restore();
}

// ==== жители ====
export function drawVillagerFigure(ctx, v, sx, sy, scale, t, walking) {
  const prof = PROFESSIONS[v.profession] || PROFESSIONS.none;
  const child = v.age < 16;
  const sc = scale * (child ? 0.72 : 1);
  const bob = walking ? Math.abs(Math.sin(v.walkPhase)) * 1.2 : 0;
  const legA = walking ? Math.sin(v.walkPhase) * 2.4 : 0;
  const y0 = sy - bob;

  // тень
  ctx.fillStyle = 'rgba(40,60,40,0.22)';
  ctx.beginPath(); ctx.ellipse(sx, sy + 1, 5 * sc, 2.4 * sc, 0, 0, 6.28); ctx.fill();

  // ноги
  ctx.fillStyle = '#4A4038';
  ctx.fillRect(sx - 2.6 * sc, y0 - 4 * sc + legA * 0.5, 1.8 * sc, 4 * sc);
  ctx.fillRect(sx + 0.8 * sc, y0 - 4 * sc - legA * 0.5, 1.8 * sc, 4 * sc);

  // тело
  const bw = 6.4 * sc, bh = 8.6 * sc;
  const elder = v.age >= 62;
  const bodyY = y0 - 4 * sc - bh + (elder ? 1 : 0);
  ctx.fillStyle = prof.color;
  roundedRect(ctx, sx - bw / 2, bodyY, bw, bh, 2.4 * sc);
  ctx.fill();
  ctx.strokeStyle = shade(prof.color, 0.6); ctx.lineWidth = 0.8;
  roundedRect(ctx, sx - bw / 2, bodyY, bw, bh, 2.4 * sc);
  ctx.stroke();
  // «фартук»/деталь
  ctx.fillStyle = shade(prof.color, 0.78);
  ctx.fillRect(sx - bw / 2 + 1, bodyY + bh * 0.55, bw - 2, bh * 0.28);

  // голова
  const hy = bodyY - 3.2 * sc + (elder ? 1.2 : 0);
  ctx.fillStyle = v.sick ? '#B8C2A8' : v.skin;
  ctx.beginPath(); ctx.arc(sx, hy, 3.1 * sc, 0, 6.28); ctx.fill();
  // волосы
  ctx.fillStyle = elder ? '#C9C9C9' : v.hair;
  ctx.beginPath(); ctx.arc(sx, hy - 0.8 * sc, 3.1 * sc, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
  if (v.sex === 'f' && v.hairStyle === 2) { // пучок
    ctx.beginPath(); ctx.arc(sx + 2.6 * sc, hy - 2 * sc, 1.3 * sc, 0, 6.28); ctx.fill();
  }
  // шляпы профессий
  if (v.profession === 'farmer') {
    ctx.fillStyle = '#E0C068';
    ctx.beginPath(); ctx.ellipse(sx, hy - 2.6 * sc, 4.4 * sc, 1.6 * sc, 0, 0, 6.28); ctx.fill();
  } else if (v.profession === 'miner') {
    ctx.fillStyle = '#8E939A';
    ctx.beginPath(); ctx.arc(sx, hy - 1.2 * sc, 3 * sc, Math.PI, 0); ctx.fill();
  } else if (v.profession === 'fisher') {
    ctx.fillStyle = '#E8C558';
    ctx.beginPath(); ctx.ellipse(sx, hy - 2.4 * sc, 3.4 * sc, 1.2 * sc, 0, 0, 6.28); ctx.fill();
  }
  // переносимый предмет
  if (v.carrying) drawCarry(ctx, v.carrying, sx + bw / 2 + 1, bodyY + bh * 0.35, sc);
}

function drawCarry(ctx, kind, x, y, sc) {
  switch (kind) {
    case 'wood':
      ctx.fillStyle = '#9A7452'; ctx.fillRect(x, y - 1, 6 * sc, 2.4 * sc);
      ctx.fillStyle = '#C9A96E'; ctx.fillRect(x + 5.4 * sc, y - 1, 1.4 * sc, 2.4 * sc);
      break;
    case 'food':
      ctx.fillStyle = '#E0A458';
      ctx.beginPath(); ctx.ellipse(x + 2 * sc, y, 2.6 * sc, 1.8 * sc, 0, 0, 6.28); ctx.fill();
      break;
    case 'fish':
      ctx.fillStyle = '#7AC4D4';
      ctx.beginPath(); ctx.ellipse(x + 2 * sc, y, 3 * sc, 1.4 * sc, 0, 0, 6.28); ctx.fill();
      break;
    case 'stone':
      ctx.fillStyle = '#A8ABB0';
      ctx.beginPath(); ctx.arc(x + 2 * sc, y, 2 * sc, 0, 6.28); ctx.fill();
      break;
  }
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// пузырь-эмоция над головой
export function drawEmote(ctx, kind, sx, sy, t) {
  const bobY = Math.sin(t * 2.4) * 1.2;
  const bx = sx + 7, by = sy - 26 + bobY;
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.strokeStyle = 'rgba(60,70,80,0.35)'; ctx.lineWidth = 1;
  roundedRect(ctx, bx - 8, by - 7, 16, 14, 4); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(bx - 3, by + 6.6); ctx.lineTo(bx - 5.5, by + 11); ctx.lineTo(bx + 1, by + 6.8);
  ctx.closePath(); ctx.fill();
  switch (kind) {
    case 'talk': {
      ctx.fillStyle = '#6E7B8A';
      for (let i = 0; i < 3; i++) {
        const a = 0.35 + 0.65 * Math.abs(Math.sin(t * 3 + i * 0.9));
        ctx.globalAlpha = a;
        ctx.beginPath(); ctx.arc(bx - 4 + i * 4, by, 1.7, 0, 6.28); ctx.fill();
      }
      ctx.globalAlpha = 1; break;
    }
    case 'heart': {
      ctx.fillStyle = '#E46A6A';
      heartPath(ctx, bx, by, 4);
      ctx.fill(); break;
    }
    case 'zzz': {
      ctx.fillStyle = '#7A8CA0';
      ctx.font = `bold ${6 + Math.sin(t * 2) * 1.4}px system-ui`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Z z', bx, by);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; break;
    }
    case 'anger': {
      ctx.fillStyle = '#E46A5A';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const ang = i / 8 * 6.28;
        const r = i % 2 === 0 ? 4.6 : 2;
        ctx.lineTo(bx + Math.cos(ang) * r, by + Math.sin(ang) * r);
      }
      ctx.closePath(); ctx.fill(); break;
    }
    case 'eat': {
      ctx.fillStyle = '#E0A458';
      ctx.beginPath(); ctx.ellipse(bx - 1, by, 4, 2.8, -0.4, 0, 6.28); ctx.fill();
      ctx.strokeStyle = '#B08956'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx - 4, by - 2); ctx.lineTo(bx - 1, by + 0.5); ctx.stroke(); break;
    }
    case 'coin': {
      ctx.fillStyle = '#E8C558';
      ctx.beginPath(); ctx.arc(bx, by, 3.6, 0, 6.28); ctx.fill();
      ctx.strokeStyle = '#B8952F'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(bx, by, 3.6, 0, 6.28); ctx.stroke();
      ctx.fillStyle = '#B8952F'; ctx.font = 'bold 5px system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('м', bx, by + 0.5);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; break;
    }
    case 'tool': {
      ctx.strokeStyle = '#8A94A0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(bx - 4, by + 3); ctx.lineTo(bx + 3, by - 4); ctx.stroke();
      ctx.fillStyle = '#8A94A0';
      ctx.beginPath(); ctx.arc(bx + 3.4, by - 4.4, 2.2, 0, 6.28); ctx.fill(); break;
    }
    case 'fish': {
      ctx.fillStyle = '#7AC4D4';
      ctx.beginPath(); ctx.ellipse(bx - 1, by, 4, 2.2, 0, 0, 6.28); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(bx + 2.6, by); ctx.lineTo(bx + 5, by - 2.2); ctx.lineTo(bx + 5, by + 2.2);
      ctx.closePath(); ctx.fill(); break;
    }
    case 'cross': {
      ctx.strokeStyle = '#E47A7A'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx - 3, by - 3); ctx.lineTo(bx + 3, by + 3);
      ctx.moveTo(bx + 3, by - 3); ctx.lineTo(bx - 3, by + 3);
      ctx.stroke(); break;
    }
    case 'star': {
      ctx.fillStyle = '#F2CE5E';
      starPath(ctx, bx, by, 4.4, 5);
      ctx.fill(); break;
    }
  }
}

export function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.4);
  ctx.bezierCurveTo(x - s * 1.1, y - s * 0.5, x - s * 0.45, y - s * 1.2, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 0.45, y - s * 1.2, x + s * 1.1, y - s * 0.5, x, y + s * 0.4);
  ctx.closePath();
}

export function starPath(ctx, x, y, r, n) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const ang = i / (n * 2) * 6.28 - 1.57;
    const rr = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
  }
  ctx.closePath();
}

// имя над жителем
export function drawNameTag(ctx, text, sx, sy, color = '#FFFFFF') {
  ctx.font = '600 10px system-ui';
  const w = ctx.measureText(text).width + 10;
  ctx.fillStyle = 'rgba(20,24,30,0.72)';
  roundedRect(ctx, sx - w / 2, sy - 30, w, 14, 6); ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, sx, sy - 22.5);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

// кольцо выбора
export function drawSelectionRing(ctx, sx, sy, t) {
  ctx.strokeStyle = `rgba(126,209,191,${0.75 + Math.sin(t * 3) * 0.2})`;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(sx, sy + 1, 9 + Math.sin(t * 3) * 1.2, 4.6 + Math.sin(t * 3) * 0.6, 0, 0, 6.28);
  ctx.stroke();
}
