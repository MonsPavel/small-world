// Здения в изометрии: призмы, крыши, детали. Собирает точки света окон.

import { proj, shade } from './iso.js';

export function drawBuilding(ctx, b, opts) {
  const n = proj(b.x, b.y), e = proj(b.x + b.w, b.y), s = proj(b.x + b.w, b.y + b.h), w = proj(b.x, b.y + b.h);
  const glow = opts.glow;
  switch (b.type) {
    case 'house': drawHouse(ctx, b, n, e, s, w, glow); break;
    case 'farm': drawBarn(ctx, b, n, e, s, w, glow); break;
    case 'workshop': drawWorkshop(ctx, b, n, e, s, w, glow); break;
    case 'market': drawMarket(ctx, b, n, e, s, w); break;
    case 'granary': drawGranary(ctx, b, n, e, s, w, glow); break;
    case 'quarrysite': drawQuarry(ctx, b, n, e, s, w); break;
    default: drawHouse(ctx, b, n, e, s, w, glow);
  }
  // индикатор повреждения
  if (b.condition < 55) {
    const c = proj(b.x + b.w / 2, b.y + b.h / 2);
    ctx.fillStyle = 'rgba(240,110,110,0.95)';
    ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('⚠', c.x, c.y - 52);
    ctx.textAlign = 'left';
  }
}

function prism(ctx, n, e, s, w, hgt, wall, rh, roofC) {
  const N = { x: n.x, y: n.y - hgt }, E = { x: e.x, y: e.y - hgt }, S = { x: s.x, y: s.y - hgt }, W = { x: w.x, y: w.y - hgt };
  // стены: южная (левая видимая) и восточная (правая видимая)
  ctx.fillStyle = shade(wall, 0.68);
  poly(ctx, [W, S, { x: S.x, y: S.y + 0.01 }]); // заглушка (не видна)
  ctx.fillStyle = shade(wall, 0.72);
  poly(ctx, [W, S, { x: s.x, y: s.y }, { x: w.x, y: w.y }]); // юго-западная стена
  ctx.fillStyle = shade(wall, 0.88);
  poly(ctx, [E, S, { x: s.x, y: s.y }, { x: e.x, y: e.y }]); // юго-восточная стена
  // фронтоны и крыша
  const R1 = { x: (N.x + E.x) / 2, y: (N.y + E.y) / 2 - rh };
  const R2 = { x: (W.x + S.x) / 2, y: (W.y + S.y) / 2 - rh };
  ctx.fillStyle = shade(wall, 0.8);
  poly(ctx, [N, E, R1]); // северо-восточный фронтон
  ctx.fillStyle = shade(wall, 0.66);
  poly(ctx, [S, W, R2]); // юго-западный фронтон
  ctx.fillStyle = shade(roofC, 0.9);
  poly(ctx, [E, S, R2, R1]); // правый скат
  ctx.fillStyle = shade(roofC, 1.06);
  poly(ctx, [W, N, R1, R2]); // левый скат
  // конёк
  ctx.strokeStyle = shade(roofC, 0.6); ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(R1.x, R1.y); ctx.lineTo(R2.x, R2.y); ctx.stroke();
  return { N, E, S, W, R1, R2 };
}

function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath(); ctx.fill();
}

function windowAt(ctx, glow, x, y, w, h, night) {
  ctx.fillStyle = night ? '#FFD98A' : '#4A5B74';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(30,30,40,0.5)'; ctx.lineWidth = 0.8;
  ctx.strokeRect(x, y, w, h);
  if (night) glow.push({ x: x + w / 2, y: y + h / 2, r: 26 });
}

function drawHouse(ctx, b, n, e, s, w, glow) {
  const night = glow !== null;
  const palette = [['#F2E4CC', '#C96F4A'], ['#E8D5B5', '#B25B48'], ['#DCC9A8', '#8A6F5A']][b.id % 3];
  const P = prism(ctx, n, e, s, w, 22, palette[0], 14, palette[1]);
  // дверь на юго-восточной стене
  const dx = (e.x + s.x) / 2, dy = (e.y + s.y) / 2;
  ctx.fillStyle = '#5C4128';
  ctx.fillRect(dx - 3.5, dy - 1, 7, 11);
  // окна
  windowAt(ctx, glow, dx + 10, dy - 9, 6, 6, night);
  const wx = (w.x + s.x) / 2, wy = (w.y + s.y) / 2;
  windowAt(ctx, glow, wx + 4, wy - 10, 6, 6, night);
  // труба
  ctx.fillStyle = '#8A7A6A';
  ctx.fillRect(P.R2.x - 6, P.R2.y - 6, 6, 12);
  ctx.fillStyle = '#6E6154';
  ctx.fillRect(P.R2.x - 7, P.R2.y - 8, 8, 3);
  b._chimney = { x: P.R2.x - 3, y: P.R2.y - 8 };
}

function drawBarn(ctx, b, n, e, s, w, glow) {
  // амбар фермы 2x2 в углу участка
  const n2 = n, e2 = proj(b.x + 2, b.y), s2 = proj(b.x + 2, b.y + 2), w2 = proj(b.x, b.y + 2);
  prism(ctx, n2, e2, s2, w2, 18, '#B08968', 12, '#8A5A3B');
  // ворота
  const dx = (e2.x + s2.x) / 2, dy = (e2.y + s2.y) / 2;
  ctx.fillStyle = '#5C4128';
  ctx.fillRect(dx - 4, dy - 2, 8, 12);
  ctx.strokeStyle = '#4A3420'; ctx.lineWidth = 1;
  ctx.strokeRect(dx - 4, dy - 2, 8, 12);
  // сено у амбара
  const c = proj(b.x + 2.6, b.y + 1);
  ctx.fillStyle = '#E0C068';
  ctx.beginPath(); ctx.ellipse(c.x, c.y, 5, 3.4, 0, 0, 6.28); ctx.fill();
  ctx.strokeStyle = '#B99B45'; ctx.beginPath(); ctx.ellipse(c.x, c.y, 5, 3.4, 0, 0, 3.14); ctx.stroke();
}

function drawWorkshop(ctx, b, n, e, s, w, glow) {
  const P = prism(ctx, n, e, s, w, 20, '#C9B49A', 11, '#6E7B8A');
  const dx = (e.x + s.x) / 2, dy = (e.y + s.y) / 2;
  ctx.fillStyle = '#4A4038';
  ctx.fillRect(dx - 4, dy - 1, 8, 11); // ворота
  windowAt(ctx, glow, (w.x + s.x) / 2 + 4, (w.y + s.y) / 2 - 9, 6, 5, glow !== null);
  // труба-горн
  ctx.fillStyle = '#7A7168';
  ctx.fillRect(P.R1.x - 2, P.R1.y + 2, 7, 10);
  // наковальня у входа
  const a = proj(b.x + b.w + 0.4, b.y + b.h - 0.5);
  ctx.fillStyle = '#5A5F66';
  ctx.fillRect(a.x - 3, a.y - 6, 6, 3);
  ctx.fillRect(a.x - 1.5, a.y - 3, 3, 3);
}

function drawMarket(ctx, b, n, e, s, w) {
  // два прилавка с полосатыми навесами
  const stalls = [
    { cx: b.x + 0.9, cy: b.y + 0.9, c1: '#D96A5A', c2: '#F2E8D5' },
    { cx: b.x + 1.4, cy: b.y + 1.6, c1: '#5AA8B8', c2: '#F2E8D5' },
  ];
  for (const st of stalls) {
    const c = proj(st.cx, st.cy);
    // прилавок
    ctx.fillStyle = '#A8845F';
    ctx.fillRect(c.x - 14, c.y - 8, 14, 10);
    // столбы
    ctx.strokeStyle = '#7A5F42'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(c.x - 13, c.y - 8); ctx.lineTo(c.x - 13, c.y - 22);
    ctx.moveTo(c.x + 1, c.y - 1); ctx.lineTo(c.x + 1, c.y - 15);
    ctx.stroke();
    // навес
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 === 0 ? st.c1 : st.c2;
      poly(ctx, [
        { x: c.x - 14 + i * 4, y: c.y - 22 },
        { x: c.x - 10 + i * 4, y: c.y - 22 },
        { x: c.x - 8 + i * 4, y: c.y - 14 },
        { x: c.x - 12 + i * 4, y: c.y - 14 },
      ]);
    }
  }
  // ящики
  const c2 = proj(b.x + 0.3, b.y + b.h - 0.4);
  ctx.fillStyle = '#B08968'; ctx.fillRect(c2.x, c2.y - 5, 8, 6);
  ctx.fillStyle = '#9A7452'; ctx.fillRect(c2.x + 2, c2.y - 9, 6, 5);
}

function drawGranary(ctx, b, n, e, s, w, glow) {
  // амбар на сваях
  ctx.strokeStyle = '#8A7458'; ctx.lineWidth = 2;
  const legs = [[n, e], [e, s], [s, w], [w, n]];
  for (const [a, c] of legs) {
    ctx.beginPath(); ctx.moveTo((a.x + c.x) / 2, (a.y + c.y) / 2); ctx.lineTo((a.x + c.x) / 2, (a.y + c.y) / 2 + 8); ctx.stroke();
  }
  prism(ctx, n, e, s, w, 20, '#D9C9A8', 12, '#A08A4F');
  // мешки
  const c = proj(b.x + 0.6, b.y + b.h + 0.3);
  ctx.fillStyle = '#E0D0A0';
  ctx.beginPath(); ctx.arc(c.x, c.y, 3, 0, 6.28); ctx.fill();
  ctx.beginPath(); ctx.arc(c.x + 5, c.y + 1, 2.6, 0, 6.28); ctx.fill();
}

function drawQuarry(ctx, b, n, e, s, w) {
  const c = proj(b.x + 1, b.y + 1);
  // куча камней
  ctx.fillStyle = '#9AA3AD';
  poly(ctx, [{ x: c.x - 16, y: c.y + 4 }, { x: c.x - 6, y: c.y - 6 }, { x: c.x + 6, y: c.y - 3 }, { x: c.x + 14, y: c.y + 6 }, { x: c.x, y: c.y + 12 }]);
  ctx.fillStyle = '#B4BCC4';
  poly(ctx, [{ x: c.x - 8, y: c.y + 2 }, { x: c.x - 2, y: c.y - 9 }, { x: c.x + 7, y: c.y - 5 }, { x: c.x + 2, y: c.y + 4 }]);
  // деревянная рама
  ctx.strokeStyle = '#7A5F42'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(c.x + 12, c.y + 8); ctx.lineTo(c.x + 16, c.y - 10);
  ctx.moveTo(c.x + 22, c.y + 12); ctx.lineTo(c.x + 18, c.y - 8);
  ctx.moveTo(c.x + 15, c.y - 9); ctx.lineTo(c.x + 19, c.y - 8);
  ctx.stroke();
}

// ==== малые формы ====
export function drawWell(ctx, t) {
  const c = proj(18.5, 18.5);
  // каменный колодец
  ctx.fillStyle = '#A8ABB0';
  poly(ctx, [{ x: c.x - 10, y: c.y - 5 }, { x: c.x, y: c.y }, { x: c.x, y: c.y + 10 }, { x: c.x - 10, y: c.y + 5 }]);
  ctx.fillStyle = '#8E939A';
  poly(ctx, [{ x: c.x, y: c.y }, { x: c.x + 10, y: c.y - 5 }, { x: c.x + 10, y: c.y + 5 }, { x: c.x, y: c.y + 10 }]);
  // вода в колодце
  ctx.fillStyle = '#5FA8C7';
  poly(ctx, [{ x: c.x - 7, y: c.y - 3.5 }, { x: c.x, y: c.y }, { x: c.x, y: c.y + 7 }, { x: c.x - 7, y: c.y + 3.5 }]);
  // стойки и крыша
  ctx.strokeStyle = '#7A5F42'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(c.x - 8, c.y - 4); ctx.lineTo(c.x - 8, c.y - 22);
  ctx.moveTo(c.x + 8, c.y - 4); ctx.lineTo(c.x + 8, c.y - 22);
  ctx.stroke();
  ctx.fillStyle = '#B25B48';
  poly(ctx, [{ x: c.x - 12, y: c.y - 20 }, { x: c.x, y: c.y - 26 }, { x: c.x + 12, y: c.y - 20 }, { x: c.x, y: c.y - 15 }]);
  // ведро
  const bob = Math.sin(t * 1.2) * 1.5;
  ctx.fillStyle = '#8A7458';
  ctx.fillRect(c.x - 2.5, c.y - 16 + bob, 5, 4);
}

export function drawLamp(ctx, x, y, night, glow) {
  const c = proj(x, y);
  ctx.strokeStyle = '#5F5245'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x, c.y - 20); ctx.stroke();
  ctx.fillStyle = night ? '#FFD98A' : '#C9BFB0';
  ctx.fillRect(c.x - 2.5, c.y - 26, 5, 7);
  ctx.strokeStyle = '#5F5245'; ctx.lineWidth = 1;
  ctx.strokeRect(c.x - 2.5, c.y - 26, 5, 7);
  if (night) glow.push({ x: c.x, y: c.y - 22, r: 46 });
}

export function drawPier(ctx, world, t) {
  // настил поверх воды
  const tiles = [[25, 26], [26, 27]];
  for (const [i, j] of tiles) {
    const p = proj(i, j);
    ctx.fillStyle = '#9A7452';
    poly(ctx, [{ x: p.x, y: p.y }, { x: p.x + 32, y: p.y + 16 }, { x: p.x, y: p.y + 32 }, { x: p.x - 32, y: p.y + 16 }]);
    ctx.strokeStyle = '#7A5A3C'; ctx.lineWidth = 1;
    for (let k = 1; k < 4; k++) {
      ctx.beginPath();
      ctx.moveTo(p.x - 32 + k * 16, p.y + 16 - k * 8);
      ctx.lineTo(p.x - 32 + (k + 1) * 16, p.y + 8 + (k - 1) * 8);
      ctx.stroke();
    }
  }
  // сваи
  ctx.fillStyle = '#6E5233';
  for (const [i, j] of tiles) {
    const p = proj(i + 0.2, j + 0.2);
    ctx.fillRect(p.x - 16, p.y + 12, 3, 8);
    ctx.fillRect(p.x + 12, p.y + 20, 3, 8);
  }
  // лодка
  const bob = Math.sin(t * 1.4) * 1.2;
  const bp = proj(27.6, 28.2);
  ctx.save();
  ctx.translate(bp.x, bp.y + bob);
  ctx.fillStyle = '#B08968';
  ctx.beginPath(); ctx.ellipse(0, 0, 12, 4.5, 0.2, 0, 6.28); ctx.fill();
  ctx.fillStyle = '#8A6A48';
  ctx.beginPath(); ctx.ellipse(0, -1.5, 12, 4.5, 0.2, 0, 3.14); ctx.fill();
  ctx.strokeStyle = '#6E5233'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, -12); ctx.stroke();
  ctx.restore();
}

export function drawGrave(ctx, g, season) {
  const p = proj(g.x + 0.5, g.y + 0.5);
  if (g.cross) {
    ctx.strokeStyle = '#8A7458'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - 10);
    ctx.moveTo(p.x - 3.5, p.y - 7); ctx.lineTo(p.x + 3.5, p.y - 7);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#A8ABB0';
    ctx.beginPath();
    ctx.moveTo(p.x - 4, p.y);
    ctx.lineTo(p.x - 4, p.y - 7);
    ctx.arc(p.x, p.y - 7, 4, Math.PI, 0);
    ctx.lineTo(p.x + 4, p.y);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = season === 3 ? '#E6ECEF' : '#B9A98A';
  ctx.beginPath(); ctx.ellipse(p.x, p.y + 1, 7, 3, 0, 0, 6.28); ctx.fill();
}

export function drawProject(ctx, p) {
  const n = proj(p.x, p.y), e = proj(p.x + p.w, p.y), s = proj(p.x + p.w, p.y + p.h), w = proj(p.x, p.y + p.h);
  // разметка
  ctx.strokeStyle = '#D9C9A0'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(n.x, n.y); ctx.lineTo(e.x, e.y); ctx.lineTo(s.x, s.y); ctx.lineTo(w.x, w.y); ctx.closePath();
  ctx.stroke(); ctx.setLineDash([]);
  // штабели материалов
  const c = proj(p.x + 0.6, p.y + p.h - 0.5);
  ctx.fillStyle = '#9A7452';
  for (let i = 0; i < 3; i++) ctx.fillRect(c.x + i * 5, c.y - 3 - (i % 2) * 3, 8, 3.5);
  ctx.fillStyle = '#A8ABB0';
  ctx.beginPath(); ctx.arc(c.x + 26, c.y, 5, 0, 6.28); ctx.arc(c.x + 31, c.y + 2, 4, 0, 6.28); ctx.fill();
  // каркас по прогрессу
  const pr = p.progress / 100;
  ctx.strokeStyle = '#B08968'; ctx.lineWidth = 2;
  const hgt = 24 * pr;
  ctx.beginPath();
  ctx.moveTo(n.x + 6, n.y + 3); ctx.lineTo(n.x + 6, n.y + 3 - hgt * 0.6);
  ctx.moveTo(e.x - 6, e.y + 3); ctx.lineTo(e.x - 6, e.y + 3 - hgt * 0.6);
  ctx.moveTo(w.x - 6, w.y - 3); ctx.lineTo(w.x - 6, w.y - 3 - hgt);
  ctx.moveTo(s.x + 6, s.y - 3); ctx.lineTo(s.x + 6, s.y - 3 - hgt);
  if (pr > 0.25) { ctx.moveTo(w.x - 6, w.y - 3 - hgt * 0.5); ctx.lineTo(s.x + 6, s.y - 3 - hgt * 0.5); }
  ctx.stroke();
  if (pr > 0.5) {
    ctx.fillStyle = shade('#F2E4CC', 0.9);
    poly(ctx, [w, s, { x: s.x, y: s.y - hgt * 0.5 }, { x: w.x, y: w.y - hgt * 0.5 }]);
  }
  // индикатор прогресса
  const mid = proj(p.x + p.w / 2, p.y + p.h / 2);
  ctx.fillStyle = 'rgba(20,24,30,0.55)';
  ctx.fillRect(mid.x - 16, mid.y - 34, 32, 5);
  ctx.fillStyle = '#8FBF5A';
  ctx.fillRect(mid.x - 15, mid.y - 33, 30 * Math.min(1, pr), 3);
}
