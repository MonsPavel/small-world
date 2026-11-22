// Социальная система: взаимодействия, отношения, память, конфликты, пары

import { PROFESSIONS, vform } from './defs.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Основное взаимодействие двух жителей. kind: 'chat' | 'visit' | 'workTogether' | 'gift' | 'feast'
export function interact(sim, a, b, kind = 'chat') {
  if (!a.alive || !b.alive || a.id === b.id) return;
  const ra = a.relTo(b.id), rb = b.relTo(a.id);
  const compat = 1 - Math.abs(a.traits.soc - b.traits.soc) * 0.5 - Math.abs(a.traits.gen - b.traits.gen) * 0.3;
  const warmth = (ra.a + rb.a) / 2 / 100; // -1..1
  let base = kind === 'visit' ? 5 : kind === 'feast' ? 7 : kind === 'gift' ? 9 : kind === 'workTogether' ? 3 : 3.2;
  let delta = base * compat * (0.7 + warmth * 0.3 + 0.3);
  let trust = (kind === 'workTogether' ? 2.5 : 1.6) * compat;

  // вспыльчивость может испортить разговор
  const aggAvg = (a.traits.agg + b.traits.agg) / 2;
  const tension = ra.a < -15 && ra.t < 45;
  let conflicted = false;
  if (tension && aggAvg > 0.45 && sim.rng.chance(0.3 + aggAvg * 0.25)) {
    conflicted = true;
    conflict(sim, a, b, 'словесная перепалка');
  } else {
    ra.a = clamp(ra.a + delta, -100, 100); rb.a = clamp(rb.a + delta, -100, 100);
    ra.t = clamp(ra.t + trust, 0, 100); rb.t = clamp(rb.t + trust, 0, 100);
    a.needs.social = Math.min(100, a.needs.social + (kind === 'feast' ? 30 : 16));
    b.needs.social = Math.min(100, b.needs.social + (kind === 'feast' ? 30 : 16));
    a.skillUp('social', 0.012); b.skillUp('social', 0.012);
    if (kind === 'gift') {
      a.remember(sim, 'gift', b.id, `${vform(a, 'Сделал', 'Сделала')} подарок: ${b.name}`, 1.2);
      b.remember(sim, 'gift', a.id, `${vform(b, 'Получил', 'Получила')} подарок от ${a.name}`, 1.4);
      b.addBuff('gift', 8, 2, sim);
    }
    // значимая дружба
    if (ra.a > 60 && !a.memories.some((m) => m.type === 'friend' && m.otherId === b.id)) {
      a.remember(sim, 'friend', b.id, `Завязалась дружба с ${b.name}`, 1.5);
      b.remember(sim, 'friend', a.id, `Завязалась дружба с ${a.name}`, 1.5);
      if (sim.rng.chance(0.4)) sim.journal({ cat: 'social', icon: 'heart', text: `${a.name} и ${b.name} стали друзьями` });
    }
    // пара?
    tryCouple(sim, a, b);
  }
  sim.pulse(a, conflicted ? 'anger' : 'talk');
  sim.pulse(b, conflicted ? 'anger' : 'talk');
}

export function conflict(sim, a, b, reason) {
  const ra = a.relTo(b.id), rb = b.relTo(a.id);
  const wasFriends = Math.min(ra.a, rb.a) > 55;
  ra.a = clamp(ra.a - 16, -100, 100); rb.a = clamp(rb.a - 16, -100, 100);
  ra.t = clamp(ra.t - 12, 0, 100); rb.t = clamp(rb.t - 12, 0, 100);
  a.addBuff('conflict', -7, 2, sim); b.addBuff('conflict', -7, 2, sim);
  a.needs.social = Math.max(0, a.needs.social - 10);
  const txt = wasFriends ? 'ссора разрушает дружбу' : 'конфликт';
  a.remember(sim, 'conflict', b.id, `${txt} с ${b.name} (${reason})`, 1.6);
  b.remember(sim, 'conflict', a.id, `${txt} с ${a.name} (${reason})`, 1.6);
  if (wasFriends) {
    a.remember(sim, 'betrayal', b.id, `Предательство: ${a.name} ${vform(a, 'считал', 'считала')} ${b.name} другом`, 2);
    sim.journal({ cat: 'alert', icon: 'anger', text: `${a.name} и ${b.name}: былая дружба дала трещину — ${reason}` });
  } else {
    sim.journal({ cat: 'social', icon: 'anger', text: `${a.name} и ${b.name} поссорились (${reason})` });
  }
}

// Спор из-за ресурса (двое претендуют на одно)
export function resourceDispute(sim, a, b, what) {
  const ra = a.relTo(b.id);
  if (ra.a < 5 || (a.traits.agg + b.traits.agg) / 2 < 0.4) return false;
  if (sim.rng.chance(0.22 + (a.traits.agg + b.traits.agg) / 2 * 0.35)) {
    conflict(sim, a, b, `спор из-за ${what}`);
    return true;
  }
  return false;
}

export function tryCouple(sim, a, b) {
  if (a.spouseId || b.spouseId) return;
  if (a.isChild(sim) || b.isChild(sim)) return;
  if (a.sex === b.sex) return; // классическая модель пар для рождаемости
  if (a.age < 18 || b.age < 18 || a.age > 46 || b.age > 46) return;
  const ra = a.relTo(b.id), rb = b.relTo(a.id);
  if (ra.a > 78 && rb.a > 78 && ra.t > 62 && rb.t > 62) {
    a.spouseId = b.id; b.spouseId = a.id;
    // селятся вместе: к тому, у кого есть дом, иначе давление на жильё
    const ah = a.homeId, bh = b.homeId;
    let homeId = ah || bh || null;
    if (homeId) { a.homeId = homeId; b.homeId = homeId; }
    a.remember(sim, 'bond', b.id, `${vform(a, 'Стал', 'Стала')} парой с ${b.name}`, 2);
    b.remember(sim, 'bond', a.id, `${vform(b, 'Стал', 'Стала')} парой с ${a.name}`, 2);
    a.addBuff('love', 14, 4, sim); b.addBuff('love', 14, 4, sim);
    a.addLog(sim, `${vform(a, 'Вступил', 'Вступила')} в пару с ${b.name}`, 'heart');
    b.addLog(sim, `${vform(b, 'Вступил', 'Вступила')} в пару с ${a.name}`, 'heart');
    sim.journal({ cat: 'social', icon: 'heart', text: `${a.name} и ${b.name} теперь вместе 💞`.replace(' 💞', '') });
    sim.fxBurst(a.x, a.y, 'heart', 8);
  }
}

// Помощь (влияние на отношения)
export function help(sim, helper, needy, what) {
  const rh = helper.relTo(needy.id), rn = needy.relTo(helper.id);
  rh.a = clamp(rh.a + 7, -100, 100); rn.a = clamp(rn.a + 11, -100, 100);
  rh.t = clamp(rh.t + 6, 0, 100); rn.t = clamp(rn.t + 10, 0, 100);
  needy.remember(sim, 'help', helper.id, `${helper.name} ${vform(helper, 'помог', 'помогла')}: ${what}`, 1.8);
  helper.remember(sim, 'help', needy.id, `${vform(helper, 'Помог', 'Помогла')} ${needy.name}: ${what}`, 1);
  needy.addBuff('helped', 7, 3, sim);
  sim.pulse(helper, 'tool'); sim.pulse(needy, 'heart');
}

// Ежедневный дрейф отношений к норме (память гаснет медленно)
export function dailyDrift(sim) {
  for (const v of sim.alive()) {
    for (const [id, r] of v.rel) {
      const o = sim.villagers.get(id);
      const fam = isFamily(v, o);
      r.a += (r.a > 0 ? -1 : 1) * Math.min(Math.abs(r.a), fam ? 0.05 : 0.25);
      r.t += (50 - r.t) * 0.01;
    }
    // память тускнеет
    for (const m of v.memories) m.weight *= 0.995;
  }
}

export function isFamily(a, b) {
  if (!a || !b) return false;
  return a.spouseId === b.id || a.parents.includes(b.id) || b.parents.includes(a.id) ||
    a.children.includes(b.id) || (a.surname === b.surname && (a.isChild() || b.isChild()));
}

export function relLabel(a, b) {
  if (a.spouseId === b.id) return 'Пара';
  if (a.parents.includes(b.id)) return b.sex === 'm' ? 'Отец' : 'Мать';
  if (b.parents.includes(a.id)) return b.sex === 'm' ? 'Сын' : 'Дочь';
  const ra = a.relTo(b.id);
  if (ra.a > 60) return 'Друг';
  if (ra.a < -35) return 'Неприязнь';
  if (a.surname === b.surname) return 'Родня';
  return 'Знакомый';
}
