// Мир: карта (октагональный остров), здания, деревья, ресурсы, пути (A*)

import { hash01 } from './rng.js';
import { BUILDING_DEFS } from './defs.js';

export const T = { GRASS: 0, WATER: 1, SAND: 2, ROCK: 3, ROAD: 4, PLAZA: 5, FIELD: 6, PIER: 7 };

export const POIS = [
  { id: 'berries',  label: 'ягодную поляну',     kind: 'food',  qty: 42 },
  { id: 'mushrooms',label: 'грибное место',      kind: 'food',  qty: 26 },
  { id: 'oak',      label: 'старый дуб',         kind: 'wood',  qty: 30 },
  { id: 'cliff',    label: 'смотровую скалу',    kind: 'stone', qty: 22 },
  { id: 'shore',    label: 'берег озера',        kind: 'mood',  qty: 12 },
  { id: 'hut',      label: 'заброшенную хижину', kind: 'tools', qty: 2 },
];
const POI_POS = [[18, 4], [4, 7], [4, 26], [32, 10], [33, 29], [12, 33]];

export class World {
  constructor(rng, name) {
    this.rng = rng;
    this.name = name;
    this.W = 38; this.H = 38; this.C = 18.5;
    this.tiles = new Uint8Array(this.W * this.H);
    this.shade = new Float32Array(this.W * this.H);
    this.trees = [];
    this.buildings = [];
    this.graves = [];
    this.nextBuildingId = 1;
    this.project = null;          // стройка
    this.repair = null;          // ремонт повреждённого здания
    this.stockpile = { food: 190, wood: 110, stone: 60, tools: 4, money: 70 };
    this.block = new Uint8Array(this.W * this.H); // непроходимость зданий
    this._blockVersion = 0;
    this.generate();
  }

  idx(i, j) { return j * this.W + i; }
  inB(i, j) { return i >= 0 && j >= 0 && i < this.W && j < this.H; }

  // октагональная маска острова
  isLand(i, j) {
    const di = Math.abs(i - this.C), dj = Math.abs(j - this.C);
    return di <= 17.5 && dj <= 17.5 && !(di > 14 && dj > 14);
  }

  t(i, j) { return this.inB(i, j) ? this.tiles[this.idx(i, j)] : T.WATER; }
  setT(i, j, v) { if (this.inB(i, j)) this.tiles[this.idx(i, j)] = v; }

  walkTile(i, j) {
    if (!this.inB(i, j) || !this.isLand(i, j)) return false;
    const tt = this.tiles[this.idx(i, j)];
    if (tt === T.WATER) return false;
    if (this.block[this.idx(i, j)]) return false;
    return true;
  }

  generate() {
    const rng = this.rng;
    const W = this.W, H = this.H;
    // базовая трава + оттенки
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      this.tiles[this.idx(i, j)] = this.isLand(i, j) ? T.GRASS : T.WATER;
      this.shade[this.idx(i, j)] = hash01(i, j, 7);
    }
    // озеро на юго-востоке
    const lc = { x: 27.5, y: 28.5 };
    this.lakeCenter = lc;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const d = Math.hypot(i - lc.x, j - lc.y);
      if (d <= 4.6 && this.isLand(i, j)) this.setT(i, j, T.WATER);
      else if (d <= 5.8 && this.isLand(i, j) && this.t(i, j) === T.GRASS) this.setT(i, j, T.SAND);
    }
    // каменистая площадка (юго-запад)
    for (let j = 26; j <= 31; j++) for (let i = 5; i <= 11; i++) {
      if (this.t(i, j) === T.GRASS && hash01(i, j, 3) > 0.25) this.setT(i, j, T.ROCK);
    }
    // площадь в центре
    for (let j = 16; j <= 21; j++) for (let i = 16; i <= 21; i++) this.setT(i, j, T.PLAZA);
    // дороги крестом
    for (let j = 6; j <= 31; j++) for (const i of [18, 19]) if (this.t(i, j) === T.GRASS) this.setT(i, j, T.ROAD);
    for (let i = 6; i <= 31; i++) for (const j of [18, 19]) if (this.t(i, j) === T.GRASS) this.setT(i, j, T.ROAD);
    // пирс в озеро
    this.setT(25, 26, T.PIER); this.setT(26, 27, T.PIER);
    this.pierEnd = { x: 26, y: 27 };

    // POI для исследователей
    this.pois = POIS.map((p, k) => ({ ...p, x: POI_POS[k][0], y: POI_POS[k][1], found: false, foundBy: null, foundDay: -1 }));

    // здания
    this.addBuilding('house', 8, 11); this.addBuilding('house', 13, 11);
    this.addBuilding('house', 23, 11); this.addBuilding('house', 28, 11);
    this.addBuilding('house', 8, 22);
    this.addBuilding('workshop', 14, 15);
    this.addBuilding('market', 22, 15);
    this.addBuilding('farm', 25, 12);
    this.addBuilding('quarrysite', 5, 25); // «каменоломня» — визуальный каркас среди камней

    // поля фермы (кроме амбара 2x2 в углу)
    const farm = this.buildings.find((b) => b.type === 'farm');
    for (let j = farm.y; j < farm.y + farm.h; j++) for (let i = farm.x; i < farm.x + farm.w; i++) {
      if (this.t(i, j) === T.GRASS) this.setT(i, j, T.FIELD);
    }
    // кладбище (запад)
    this.cemetery = { x0: 3, y0: 20, x1: 6, y1: 24 };

    // деревья: лес на западе + рощица на юго-западе + россыпь
    const poiClear = (i, j) => this.pois.every((p) => Math.hypot(p.x - i, p.y - j) > 1.6);
    const inCem = (i, j) => i >= this.cemetery.x0 - 1 && i <= this.cemetery.x1 + 1 && j >= this.cemetery.y0 - 1 && j <= this.cemetery.y1 + 1;
    const addTree = (i, j, p) => {
      if (!this.isLand(i, j) || this.t(i, j) !== T.GRASS || !poiClear(i, j) || inCem(i, j)) return;
      if (this.nearBuilding(i, j, 1.5)) return;
      if (rng.chance(p)) {
        this.trees.push({ x: i, y: j, pine: rng.chance(0.3), size: rng.range(0.8, 1.25), wood: 3, phase: rng.range(0, 6.28), stump: false, regrow: 0 });
      }
    };
    for (let j = 5; j <= 16; j++) for (let i = 3; i <= 11; i++) addTree(i, j, 0.55);
    for (let j = 17; j <= 30; j++) for (let i = 3; i <= 7; i++) addTree(i, j, 0.22);
    for (let j = 3; j <= 34; j++) for (let i = 3; i <= 34; i++) addTree(i, j, 0.045);

    this.forestZone = { x0: 3, y0: 5, x1: 11, y1: 30 };
    this.quarryZone = { x0: 5, y0: 25, x1: 11, y1: 31 };

    // свободные места под застройку
    this.buildSpots = this.scanBuildSpots();
  }

  nearBuilding(i, j, pad) {
    return this.buildings.some((b) => i >= b.x - pad && i < b.x + b.w + pad && j >= b.y - pad && j < b.y + b.h + pad);
  }

  scanBuildSpots() {
    const spots = [];
    for (let j = 5; j <= 30; j++) for (let i = 5; i <= 30; i++) {
      const di = Math.abs(i - this.C), dj = Math.abs(j - this.C);
      if (di > 13 || dj > 13) continue;
      if (Math.hypot(i - this.lakeCenter.x, j - this.lakeCenter.y) < 9) continue;
      if (i >= this.cemetery.x0 - 1 && i <= this.cemetery.x1 + 1 && j >= this.cemetery.y0 - 1 && j <= this.cemetery.y1 + 1) continue;
      let ok = true;
      for (let jj = j - 1; jj <= j + 3 && ok; jj++) for (let ii = i - 1; ii <= i + 3 && ok; ii++) {
        if (!this.inB(ii, jj) || !this.isLand(ii, jj)) { ok = false; break; }
        if (jj >= j && jj <= j + 2 && ii >= i && ii <= i + 2) {
          if (this.t(ii, jj) !== T.GRASS || this.block[this.idx(ii, jj)]) ok = false;
        } else if (this.block[this.idx(ii, jj)]) ok = false;
      }
      if (ok) spots.push({ x: i, y: j, d: di + dj });
    }
    spots.sort((a, b) => a.d - b.d);
    return spots.slice(0, 16);
  }

  addBuilding(type, x, y, finished = true) {
    const def = BUILDING_DEFS[type] || { label: 'Каменоломня', w: 2, h: 2, beds: 0, cost: {}, work: 80 };
    const b = {
      id: this.nextBuildingId++, type, x, y, w: def.w, h: def.h,
      door: { x: x + Math.floor((def.w - 1) / 2), y: y + def.h },
      condition: 100, progress: finished ? 100 : 0, residents: [], def,
    };
    this.buildings.push(b);
    this.rebuildBlock();
    return b;
  }

  rebuildBlock() {
    this.block.fill(0);
    for (const b of this.buildings) {
      if (b.type === 'farm') { // у фермы блокируется только амбар 2x2
        for (let j = b.y; j < b.y + 2; j++) for (let i = b.x; i < b.x + 2; i++) this.block[this.idx(i, j)] = 1;
        continue;
      }
      if (b.type === 'quarrysite') continue;
      for (let j = b.y; j < b.y + b.h; j++) for (let i = b.x; i < b.x + b.w; i++) this.block[this.idx(i, j)] = 1;
    }
    if (this.project) {
      for (let j = this.project.y; j < this.project.y + this.project.h; j++)
        for (let i = this.project.x; i < this.project.x + this.project.w; i++) this.block[this.idx(i, j)] = 0; // стройка проходима
    }
    this._blockVersion++;
  }

  buildingsOf(type) { return this.buildings.filter((b) => b.type === type); }
  bedsTotal() { return this.buildings.reduce((s, b) => s + (b.def.beds || 0), 0); }
  foodCap() { return this.buildings.reduce((s, b) => s + (b.def.foodCap || 0), 0) + 600; }

  hasTree() { return this.trees.some((t) => !t.stump && t.wood > 0); }
  takeTree(target) { // лесоруб выбирает дерево
    const cand = this.trees.filter((t) => !t.stump && t.wood > 0);
    if (!cand.length) return null;
    return target
      ? cand.sort((a, b) => (Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y)))[0]
      : this.rng.pick(cand);
  }
  randomRock() {
    const cand = [];
    for (let j = this.quarryZone.y0; j <= this.quarryZone.y1; j++)
      for (let i = this.quarryZone.x0; i <= this.quarryZone.x1; i++)
        if (this.t(i, j) === T.ROCK) cand.push({ x: i, y: j });
    return cand.length ? this.rng.pick(cand) : { x: 8, y: 28 };
  }
  randomFieldTile(farm) {
    const cand = [];
    for (let j = farm.y; j < farm.y + farm.h; j++) for (let i = farm.x; i < farm.x + farm.w; i++)
      if (this.t(i, j) === T.FIELD) cand.push({ x: i, y: j });
    return cand.length ? this.rng.pick(cand) : farm.door;
  }

  // A*: 8 направлений, без срезания углов
  findPath(from, to) {
    const si = Math.round(from.x), sj = Math.round(from.y);
    let ti = Math.round(to.x), tj = Math.round(to.y);
    if (!this.walkTile(ti, tj)) {
      const alt = this.nearestWalkable(ti, tj, 4);
      if (!alt) return null;
      ti = alt[0]; tj = alt[1];
    }
    if (si === ti && sj === tj) return [];
    const W = this.W;
    const open = new MinHeap();
    const gScore = new Float32Array(W * this.H).fill(Infinity);
    const came = new Int32Array(W * this.H).fill(-1);
    const closed = new Uint8Array(W * this.H);
    const h = (i, j) => { const dx = Math.abs(i - ti), dy = Math.abs(j - tj); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
    const start = this.idx(si, sj);
    gScore[start] = 0;
    open.push(start, h(si, sj));
    const goal = this.idx(ti, tj);
    let iter = 0;
    while (open.size() && iter++ < 6000) {
      const cur = open.pop();
      if (cur === goal) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      const ci = cur % W, cj = (cur / W) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di, nj = cj + dj;
        if (!this.walkTile(ni, nj)) continue;
        if (di && dj && (!this.walkTile(ci + di, cj) || !this.walkTile(ci, cj + dj))) continue;
        const nid = this.idx(ni, nj);
        if (closed[nid]) continue;
        const step = (di && dj) ? 1.414 : 1;
        const ng = gScore[cur] + step;
        if (ng < gScore[nid]) {
          gScore[nid] = ng; came[nid] = cur;
          open.push(nid, ng + h(ni, nj));
        }
      }
    }
    if (came[goal] === -1 && goal !== start) return null;
    const path = [];
    let c = goal;
    while (c !== start && c !== -1) { path.push({ x: c % W, y: (c / W) | 0 }); c = came[c]; }
    path.reverse();
    return path;
  }

  nearestWalkable(i, j, r) {
    for (let d = 1; d <= r; d++) {
      for (let dj = -d; dj <= d; dj++) for (let di = -d; di <= d; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== d) continue;
        if (this.walkTile(i + di, j + dj)) return [i + di, j + dj];
      }
    }
    return null;
  }

  placeGrave(rng) {
    const used = new Set(this.graves.map((g) => `${g.x},${g.y}`));
    for (let j = this.cemetery.y0; j <= this.cemetery.y1; j++)
      for (let i = this.cemetery.x0; i <= this.cemetery.x1; i++) {
        if (!used.has(`${i},${j}`) && rng.chance(0.9)) return { x: i, y: j };
      }
    return null;
  }
}

class MinHeap {
  constructor() { this.a = []; }
  size() { return this.a.length; }
  push(v, p) { this.a.push([p, v]); this.up(this.a.length - 1); }
  pop() {
    const top = this.a[0][1];
    const last = this.a.pop();
    if (this.a.length) { this.a[0] = last; this.down(0); }
    return top;
  }
  up(i) { while (i > 0) { const p = (i - 1) >> 1; if (this.a[p][0] <= this.a[i][0]) break; [this.a[p], this.a[i]] = [this.a[i], this.a[p]]; i = p; } }
  down(i) {
    const n = this.a.length;
    while (true) {
      let l = 2 * i + 1, r = l + 1, m = i;
      if (l < n && this.a[l][0] < this.a[m][0]) m = l;
      if (r < n && this.a[r][0] < this.a[m][0]) m = r;
      if (m === i) break;
      [this.a[m], this.a[i]] = [this.a[i], this.a[m]]; i = m;
    }
  }
}
