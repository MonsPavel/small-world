// Оркестратор: связывает мир, жителей, мозг, действия, экономику и события

import { makeRng } from './rng.js';
import { TimeSystem } from './time.js';
import { World } from './world.js';
import { Villager, resetIds, SKIN_TONES, HAIR_COLORS } from './villager.js';
import { decide } from './brain.js';
import { startAction, stepVillager } from './actions.js';
import { interact, dailyDrift, isFamily } from './social.js';
import { computeShortage } from './economy.js';
import { rollWeather, planConstruction, dailyLife, onSeasonChange } from './events.js';
import { MALE_NAMES, FEMALE_NAMES, uniqueName, SETTLEMENT_NAMES } from './names.js';
import { PROFESSIONS, vform } from './defs.js';

export class Simulation {
  constructor(seed = (Math.random() * 1e9) | 0) {
    this.seed = seed;
    this.rng = makeRng(seed);
    this.time = new TimeSystem(6 * 60);
    resetIds();
    this.usedNames = new Set();
    this.world = new World(this.rng, this.rng.pick(SETTLEMENT_NAMES));
    this.villagers = new Map();
    this.journalEntries = [];
    this.journalId = 1;
    this.weather = { kind: 'clear', rain: false, storm: false, snow: false };
    this.shortage = {};
    this.flags = {};
    this.gathering = null;
    this.stats = { history: [] };
    this.fxQueue = [];
    this.pairCd = new Map();
    this._lastDay = 0;
    this._lastSeason = 0;
    this._shortageAcc = 0;
    this.spawnInitialPopulation();
    computeShortage(this);
    this.journal({ cat: 'info', icon: 'star', text: `Поселение ${this.world.name} основано. Жителей: ${this.alive().length}` });
  }

  alive() { const out = []; for (const v of this.villagers.values()) if (v.alive) out.push(v); return out; }
  byId(id) { return this.villagers.get(id); }

  journal(e) {
    this.journalEntries.push({
      id: this.journalId++, cat: e.cat || 'info', icon: e.icon || 'info', text: e.text,
      day: this.time.dayIndex(), time: this.time.hhmm(),
    });
    if (this.journalEntries.length > 200) this.journalEntries.shift();
  }
  pulse(v, kind) { if (v?.alive) v.emote = { kind, until: this.time.total + 40 }; }
  fxBurst(x, y, kind, n = 6) { this.fxQueue.push({ x, y, kind, n }); }

  // ===== стартовое население =====
  spawnInitialPopulation() {
    const rng = this.rng;
    const houses = this.world.buildingsOf('house');
    const mk = (o) => {
      const v = new Villager(o);
      v.skin = rng.pick(SKIN_TONES);
      v.hair = rng.pick(HAIR_COLORS);
      v.hairStyle = rng.int(3);
      v.bornDay = -v.age * 32 + rng.int(32);
      this.villagers.set(v.id, v);
      return v;
    };
    const rnd = () => ({ soc: rng.range(0.15, 0.9), dil: rng.range(0.15, 0.9), cur: rng.range(0.1, 0.9), agg: rng.range(0.05, 0.85), gen: rng.range(0.15, 0.9), cau: rng.range(0.15, 0.9) });
    const nm = (male) => uniqueName(male ? MALE_NAMES : FEMALE_NAMES, rng, this.usedNames);
    const sk = (list) => { const s = {}; for (const k of ['farming', 'woodcutting', 'mining', 'crafting', 'fishing', 'trading', 'building', 'social']) s[k] = rng.range(0.03, 0.18); for (const k of list) s[k] = rng.range(0.25, 0.5); return s; };

    const farm = this.world.buildingsOf('farm')[0];
    const ws = this.world.buildingsOf('workshop')[0];
    const mk2 = this.world.buildingsOf('market')[0];

    // семьи
    const p1 = mk({ name: nm(true), surname: 'Соколов', sex: 'm', age: 34, traits: rnd(), skills: sk(['farming']), profession: 'farmer', workplaceId: farm?.id });
    const p2 = mk({ name: nm(false), surname: 'Соколов', sex: 'f', age: 31, traits: rnd(), skills: sk(['crafting']), profession: 'artisan', workplaceId: ws?.id });
    const p3 = mk({ name: nm(true), surname: 'Воробьёв', sex: 'm', age: 41, traits: rnd(), skills: sk(['woodcutting']), profession: 'woodcutter' });
    const p4 = mk({ name: nm(false), surname: 'Воробьёв', sex: 'f', age: 38, traits: rnd(), skills: sk(['farming']), profession: 'farmer', workplaceId: farm?.id });
    const p5 = mk({ name: nm(true), surname: 'Кузнецов', sex: 'm', age: 52, traits: rnd(), skills: sk(['building']), profession: 'builder' });
    const p6 = mk({ name: nm(false), surname: 'Кузнецов', sex: 'f', age: 49, traits: rnd(), skills: sk(['trading']), profession: 'trader', workplaceId: mk2?.id });
    const p7 = mk({ name: nm(true), surname: 'Морозов', sex: 'm', age: 27, traits: rnd(), skills: sk(['mining']), profession: 'miner' });
    const p8 = mk({ name: nm(false), surname: 'Морозов', sex: 'f', age: 25, traits: rnd(), skills: sk(['fishing']), profession: 'fisher' });
    const p9 = mk({ name: nm(false), surname: 'Волков', sex: 'f', age: 36, traits: rnd(), skills: sk(['farming']), profession: 'farmer', workplaceId: farm?.id });

    const kids = [
      mk({ name: nm(false), surname: 'Соколов', sex: 'f', age: 8, traits: rnd(), skills: sk([]), profession: 'none', parents: [p1.id, p2.id] }),
      mk({ name: nm(true), surname: 'Соколов', sex: 'm', age: 5, traits: rnd(), skills: sk([]), profession: 'none', parents: [p1.id, p2.id] }),
      mk({ name: nm(true), surname: 'Воробьёв', sex: 'm', age: 12, traits: rnd(), skills: sk([]), profession: 'none', parents: [p3.id, p4.id] }),
      mk({ name: nm(false), surname: 'Воробьёв', sex: 'f', age: 9, traits: rnd(), skills: sk([]), profession: 'none', parents: [p3.id, p4.id] }),
      mk({ name: nm(true), surname: 'Кузнецов', sex: 'm', age: 15, traits: rnd(), skills: sk([]), profession: 'none', parents: [p5.id, p6.id] }),
      mk({ name: nm(true), surname: 'Волков', sex: 'm', age: 10, traits: rnd(), skills: sk([]), profession: 'none', parents: [p9.id] }),
    ];
    p1.children = [kids[0].id, kids[1].id]; p2.children = p1.children;
    p3.children = [kids[2].id, kids[3].id]; p4.children = p3.children;
    p5.children = [kids[4].id]; p6.children = p5.children;
    p9.children = [kids[5].id];

    // одиночки
    const singles = [
      mk({ name: nm(true), surname: 'Белов', sex: 'm', age: 63, traits: rnd(), skills: sk([]), profession: 'retired' }),
      mk({ name: nm(false), surname: 'Орлова', sex: 'f', age: 67, traits: rnd(), skills: sk([]), profession: 'retired' }),
      mk({ name: nm(true), surname: 'Зайцев', sex: 'm', age: 29, traits: rnd(), skills: sk(['woodcutting']), profession: 'woodcutter' }),
      mk({ name: nm(false), surname: 'Лебедева', sex: 'f', age: 22, traits: rnd(), skills: sk(['farming']), profession: 'farmer', workplaceId: farm?.id }),
      mk({ name: nm(true), surname: 'Гусев', sex: 'm', age: 45, traits: rnd(), skills: sk(['mining']), profession: 'miner' }),
    ];

    // пары
    const couple = (a, b) => { a.spouseId = b.id; b.spouseId = a.id; };
    couple(p1, p2); couple(p3, p4); couple(p5, p6); couple(p7, p8);

    // дома
    const homes = [[p1, p2, kids[0], kids[1]], [p3, p4, kids[2], kids[3]], [p5, p6, kids[4], singles[2]], [p7, p8, singles[3], singles[4]], [p9, kids[5], singles[0], singles[1]]];
    homes.forEach((fam, i) => { const h = houses[i]; if (!h) return; for (const v of fam) { v.homeId = h.id; v.x = h.door.x + this.rng.range(-1.5, 1.5); v.y = h.door.y + this.rng.range(0, 1.5); } });

    // стартовые отношения
    const seedRel = (a, b, aff, trust) => { const ra = a.relTo(b.id), rb = b.relTo(a.id); ra.a = aff; rb.a = aff; ra.t = trust; rb.t = trust; };
    for (const [a, b] of [[p1, p2], [p3, p4], [p5, p6], [p7, p8]]) seedRel(a, b, 70 + rng.int(18), 68 + rng.int(20));
    for (const k of kids) {
      for (const pid of k.parents) {
        const pv = this.villagers.get(pid);
        if (pv) seedRel(k, pv, 55 + rng.int(15), 65);
      }
    }
    seedRel(kids[0], kids[3], 62, 50); // подруги
    seedRel(kids[2], kids[4], 45, 45);
    // соседи по домам
    for (const fam of homes) for (let i = 0; i < fam.length; i++) for (let j = i + 1; j < fam.length; j++) {
      if (!fam[i].rel.has(fam[j].id)) seedRel(fam[i], fam[j], 8 + rng.int(20), 30 + rng.int(15));
    }
    // добыча драмы: застарелая вражда
    seedRel(p1, p7, -38, 24);
    p1.remember(this, 'conflict', p7.id, `Спор из-за инструментов с ${p7.name}`, 1.4);
    p7.remember(this, 'conflict', p1.id, `Спор из-за инструментов с ${p1.name}`, 1.4);
    p1.addLog(this, `Давний конфликт с ${p7.name}`, 'anger');
    p7.addLog(this, `Давний конфликт с ${p1.name}`, 'anger');
    // вдова
    p9.addLog(this, 'Муж не вернулся с озера прошлой осенью', 'cross');
  }

  // ===== главный шаг =====
  update(dtMin) {
    if (dtMin <= 0) return;
    this.time.advance(dtMin);
    const day = this.time.dayIndex();
    const season = this.time.seasonIndex();
    const dayChanged = day !== this._lastDay;
    const seasonChanged = season !== this._lastSeason;

    if (dayChanged) {
      if (day > 0 && day % 32 === 0) { for (const v of this.alive()) v.age++; }
      rollWeather(this);
      dailyDrift(this);
      dailyLife(this);
      planConstruction(this);
      computeShortage(this);
      // рост деревьев
      for (const t of this.world.trees) {
        if (t.stump && t.regrow <= day && t.regrow > 0) { t.stump = false; t.wood = 1; t.size = 0.45; }
        else if (!t.stump && t.size < 1.2 && this.rng.chance(0.06)) t.size += 0.05;
        if (!t.stump && t.wood < 3 && this.rng.chance(0.05)) t.wood += 1;
      }
      this.stats.history.push({ day, pop: this.alive().length, mood: Math.round(this.avgMood()), food: Math.round(this.world.stockpile.food) });
      if (this.stats.history.length > 240) this.stats.history.shift();
      for (const v of this.alive()) v.trimBuffs(day);
    }
    if (seasonChanged) onSeasonChange(this);
    this._lastDay = day; this._lastSeason = season;

    // жители
    for (const v of this.alive()) {
      v.tickNeeds(dtMin, this);
      if (v.exploreCd > 0) v.exploreCd -= dtMin;
      if (v.marketCd > 0) v.marketCd -= dtMin;
      if (v.visitCd > 0) v.visitCd -= dtMin;

      // срочные прерывания
      const a = v.action;
      if (a) {
        if (a.type !== 'eat' && a.type !== 'sleep' && v.needs.food < 8) { v.action = null; v.path = []; }
        else if (a.type !== 'sleep' && v.needs.energy < 6) { v.action = null; v.path = []; }
        else if (v.sick && ['work', 'gather', 'stroll', 'explore', 'build', 'market', 'play'].includes(a.type)) { v.action = null; v.path = []; }
        // сторожевой таймер: путник без пути и без прогресса — принудительно переиграть
        if (v.action && v.action.phase === 'move' && !v.path.length) {
          let dx = v.action.target?.x ?? v.x, dy = v.action.target?.y ?? v.y;
          if (v.action.partnerId != null) {
            const o = this.villagers.get(v.action.partnerId);
            if (o?.alive) { dx = o.x; dy = o.y; }
          }
          const stallDist = Math.hypot(v.x - dx, v.y - dy);
          if (stallDist > 1.2) {
            v._stall = (v._stall || 0) + dtMin;
            if (v._stall > 30) { v.action = null; v.path = []; v.thinkCd = 0; v._stall = 0; }
          } else v._stall = 0;
        } else v._stall = 0;
      }
      if (!v.action) {
        v.thinkCd -= dtMin;
        if (v.thinkCd <= 0) {
          const choice = decide(this, v);
          v.action = startAction(this, v, choice);
          v.thinkCd = 12;
        }
      } else {
        stepVillager(this, v, dtMin);
      }
    }

    this.proximityChats(dtMin);

    // дефицит пересчитываем раз в час сим-времени
    this._shortageAcc += dtMin;
    if (this._shortageAcc > 60) { this._shortageAcc = 0; computeShortage(this); }
  }

  proximityChats(dtMin) {
    const list = this.alive();
    const now = this.time.total;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.indoor || !a.action) continue;
      const busyA = ['sleep', 'work', 'build', 'eat', 'rest'].includes(a.action.type) && a.action.phase === 'do';
      if (busyA) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.indoor || !b.action) continue;
        const busyB = ['sleep', 'work', 'build', 'eat', 'rest'].includes(b.action.type) && b.action.phase === 'do';
        if (busyB) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > 1.5) continue;
        const key = a.id < b.id ? `${a.id}_${b.id}` : `${b.id}_${a.id}`;
        const cd = this.pairCd.get(key) || 0;
        if (now < cd) continue;
        this.pairCd.set(key, now + 420 + this.rng.range(0, 300));
        // короткая живая беседа
        a.needs.social = Math.min(100, a.needs.social + 7);
        b.needs.social = Math.min(100, b.needs.social + 7);
        const ra = a.relTo(b.id), rb = b.relTo(a.id);
        ra.a = Math.max(-100, Math.min(100, ra.a + 1.0)); rb.a = Math.max(-100, Math.min(100, rb.a + 1.0));
        this.pulse(a, 'talk'); this.pulse(b, 'talk');
        if (this.rng.chance(0.35)) interact(this, a, b, 'chat');
      }
    }
  }

  avgMood() {
    const list = this.alive();
    if (!list.length) return 0;
    return list.reduce((s, v) => s + v.mood(this), 0) / list.length;
  }

  // ===== события жизни =====
  spawnChild(m, f) {
    const rng = this.rng;
    const sex = rng.chance(0.5) ? 'm' : 'f';
    const name = uniqueName(sex === 'm' ? MALE_NAMES : FEMALE_NAMES, rng, this.usedNames);
    const mix = (k) => Math.max(0.05, Math.min(0.95, ((m.traits[k] + f.traits[k]) / 2) + rng.range(-0.18, 0.18)));
    const traits = { soc: mix('soc'), dil: mix('dil'), cur: mix('cur'), agg: mix('agg'), gen: mix('gen'), cau: mix('cau') };
    const child = new Villager({ name, surname: f.surname, sex, age: 0, traits, skills: { farming: 0.05, woodcutting: 0.05, mining: 0.05, crafting: 0.05, fishing: 0.05, trading: 0.05, building: 0.05, social: 0.15 }, profession: 'none', homeId: m.homeId, parents: [m.id, f.id], bornDay: this.time.dayIndex() });
    child.skin = rng.pick(SKIN_TONES); child.hair = rng.pick(HAIR_COLORS); child.hairStyle = rng.int(3);
    child.x = m.x; child.y = m.y;
    this.villagers.set(child.id, child);
    m.children.push(child.id); f.children.push(child.id);
    for (const p of [m, f]) {
      seedFamilyRel(p, child, this);
      p.addBuff('birth', 10, 5, this);
      p.addLog(this, `${sex === 'm' ? 'Родился сын' : 'Родилась дочь'} — ${name}`, 'heart');
    }
    this.journal({ cat: 'people', icon: 'heart', text: `У ${m.name} и ${f.name} родился(ась) ${sex === 'm' ? 'сын' : 'дочь'} — ${name}` });
    this.fxBurst(m.x, m.y, 'heart', 6);
  }

  spawnNewcomer() {
    const rng = this.rng;
    const sex = rng.chance(0.5) ? 'm' : 'f';
    const name = uniqueName(sex === 'm' ? MALE_NAMES : FEMALE_NAMES, rng, this.usedNames);
    const surnames = ['Соловьёв', 'Титов', 'Мартынов', 'Егоров', 'Дьяков', 'Селезнёв', 'Чижов', 'Гранин', 'Озеров', 'Романов'];
    const v = new Villager({
      name, surname: rng.pick(surnames), sex, age: rng.range(19, 38) | 0,
      traits: { soc: rng.range(0.2, 0.9), dil: rng.range(0.2, 0.9), cur: rng.range(0.2, 0.95), agg: rng.range(0.05, 0.7), gen: rng.range(0.2, 0.9), cau: rng.range(0.15, 0.8) },
      profession: 'none', x: 2, y: 18,
    });
    v.skin = rng.pick(SKIN_TONES); v.hair = rng.pick(HAIR_COLORS); v.hairStyle = rng.int(3);
    v.bornDay = -v.age * 32 + rng.int(32);
    this.villagers.set(v.id, v);
    v.action = { type: 'arrive', phase: 'move', t: 0, data: {}, target: { x: 18, y: 18 } };
    // дом с меньшим числом жильцов
    let best = null, cnt = 99;
    for (const h of this.world.buildingsOf('house')) {
      const c = this.alive().filter((o) => o.homeId === h.id).length;
      if (c < 4 && c < cnt) { cnt = c; best = h; }
    }
    if (best) v.homeId = best.id;
    this.assignProfession(v, true);
    this.journal({ cat: 'people', icon: 'star', text: `${v.name} ${vform(v, 'прибыл', 'прибыла')} в поселение — ${PROFESSIONS[v.profession].label.toLowerCase()}` });
  }

  adultTransition(v) {
    this.assignProfession(v, false);
  }

  assignProfession(v, silent = false) {
    const alive = this.alive();
    const count = (p) => alive.filter((o) => o.profession === p).length;
    const pop = alive.length;
    const targets = {
      farmer: Math.max(2, Math.round(pop / 6)),
      woodcutter: 1 + (this.world.stockpile.wood < 120 ? 1 : 0),
      miner: this.world.stockpile.stone < 80 ? 2 : 1,
      artisan: this.world.buildingsOf('workshop').length ? 1 : 0,
      trader: this.world.buildingsOf('market').length ? 1 : 0,
      fisher: 1,
      builder: 1 + (this.world.project ? 1 : 0),
    };
    const parentBoost = (p) => {
      const prof = { farmer: 'farming', woodcutter: 'woodcutting', miner: 'mining', artisan: 'crafting', fisher: 'fishing', trader: 'trading', builder: 'building' }[p];
      let s = v.skills[prof] || 0;
      for (const pid of v.parents) { const pv = this.villagers.get(pid); if (pv?.profession === p) s += 0.35; }
      return s;
    };
    let best = null, bestS = -1;
    for (const [p, t] of Object.entries(targets)) {
      const deficit = t - count(p);
      const s = Math.max(0, deficit) * 1.5 + parentBoost(p) + this.rng.range(0, 0.6);
      if (s > bestS) { bestS = s; best = p; }
    }
    if (!best) best = 'farmer';
    v.profession = best;
    const wp = { farmer: 'farm', workshop: 'workshop', market: 'market' }[best];
    if (wp) v.workplaceId = this.world.buildingsOf(wp)[0]?.id || null;
    v.addLog(this, `${vform(v, 'Стал', 'Стала')} ${PROFESSIONS[best].label.toLowerCase()}`, 'tool');
    if (!silent) this.journal({ cat: 'people', icon: 'tool', text: `${v.name} ${vform(v, 'вырос', 'выросла')} и ${vform(v, 'стал', 'стала')} ${PROFESSIONS[best].label.toLowerCase()}` });
  }

  killVillager(v, cause) {
    v.alive = false; v.deadDay = this.time.dayIndex(); v.deadCause = cause;
    v.action = null;
    const grave = this.world.placeGrave(this.rng);
    if (grave) this.world.graves.push({ ...grave, day: v.deadDay, name: v.name });
    this.journal({ cat: 'alert', icon: 'skull', text: `${v.name} ${v.sex === 'm' ? 'ушёл' : 'ушла'} из жизни (${cause})` });
    // скорбь близких
    for (const o of this.alive()) {
      if (o.spouseId === v.id) {
        o.spouseId = null;
        o.addBuff('grief', -16, 6, this);
        o.remember(this, 'loss', v.id, `${vform(o, 'Потерял', 'Потеряла')} ${v.name}`, 2.5);
        o.addLog(this, `${vform(o, 'Потерял', 'Потеряла')} ${v.name}`, 'skull');
      } else if (o.rel.has(v.id)) {
        const r = o.rel.get(v.id);
        if (r.a > 45) { o.addBuff('grief', -7, 3, this); o.addLog(this, `Не стало ${v.name}`, 'skull'); }
      }
    }
  }

  completeProject() {
    const w = this.world;
    const p = w.project;
    if (!p) return;
    const b = w.addBuilding(p.type, p.x, p.y, true);
    if (p.type === 'farm') {
      for (let j = b.y; j < b.y + b.h; j++) for (let i = b.x; i < b.x + b.w; i++) if (w.t(i, j) === 0) w.setT(i, j, 6);
    }
    this.journal({ cat: 'build', icon: 'hammer', text: `Построено: ${p.def.label.toLowerCase()}` });
    if (p.type === 'house') {
      // заселение бездомных
      const homeless = this.alive().filter((v) => !v.homeId).sort((a, b2) => a.mood(this) - b2.mood(this));
      for (const v of homeless.slice(0, 4)) { v.homeId = b.id; v.addLog(this, vform(v, 'Переехал', 'Переехала') + ' в новый дом', 'hammer'); }
      if (homeless.length) this.journal({ cat: 'build', icon: 'hammer', text: `${homeless.slice(0, 4).map((v) => v.name).join(', ')} заселились в новый дом` });
    } else {
      const free = this.alive().find((v) => v.profession === 'none' && !v.isChild(this));
      if (free) this.assignProfession(free, true);
    }
    w.buildSpots = w.buildSpots.filter((s) => !(s.x >= p.x - 1 && s.x <= p.x + p.w && s.y >= p.y - 1 && s.y <= p.y + p.h));
    w.project = null;
    this.fxBurst(p.x + p.w / 2, p.y + p.h / 2, 'sparkle', 12);
  }
}

function seedFamilyRel(parent, child, sim) {
  const rp = parent.relTo(child.id), rc = child.relTo(parent.id);
  rp.a = 65; rc.a = 65; rp.t = 75; rc.t = 75;
}
