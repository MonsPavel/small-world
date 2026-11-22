// Мозг: осмысленный выбор действий (utility AI). Каждый кандидат оценивается
// по потребностям, чертам характера и состоянию мира — затем выбирается лучший.

import { PROFESSIONS } from './defs.js';
import { isFamily, relLabel } from './social.js';

const NOISE = 0.05;

export function decide(sim, v) {
  const h = sim.time.hour();
  const night = sim.time.isNight();
  const cands = [];
  const push = (type, score, data = {}) => { if (score > 0.01) cands.push({ type, score: score + sim.rng.range(-NOISE, NOISE), ...data }); };
  const n = v.needs;
  const tr = v.traits;

  // ===== СОН =====
  if (night) {
    push('sleep', 2.2 + (1 - n.energy / 100) * 0.8 - tr.cur * 0.05);
  } else {
    push('sleep', (1 - n.energy / 100) ** 2 * 1.5);
    if (v.sick && v.health < 45) push('rest', 1.6);
    else if (v.health < 35) push('rest', 1.3);
  }
  // буря — осторожные сидят дома
  if (sim.weather.storm && tr.cau > 0.4 && !night) push('sleep', 0.5 + tr.cau * 0.5);

  // ===== ЕДА =====
  const hunger = (1 - n.food / 100) ** 1.4;
  if (sim.world.stockpile.food >= 7 || v.sick === false) {
    push('eat', hunger * 2.2 + (h > 6 && h < 9 && n.food < 45 ? 0.25 : 0));
  }
  if (sim.shortage.food && h > 6 && h < 20) {
    push('forage', hunger * 1.8 + 0.25 + (v.isChild(sim) ? 0.2 : 0), {}); // лес может спасти (и дети собирают ягоды)
  }

  // ===== РАБОТА =====
  const workday = h >= 7 && h < 19 && !night;
  const able = n.energy > 22 && n.food > 14 && v.health > 32 && !v.sick;
  if (!v.isChild(sim) && v.profession !== 'retired' && workday && able) {
    const p = v.profession;
    let s = 0.55 + tr.dil * 0.42;
    if (v.needs.energy < 45) s -= 0.18;
    if (v.needs.food < 32) s -= 0.3; // голодный работает неохотно
    // дефицит подталкивает всех, а смежные профессии — особенно
    if (p === 'farmer' && sim.shortage.food) s += 0.5;
    if (p === 'woodcutter' && sim.shortage.wood) s += 0.5;
    if (p === 'miner' && sim.shortage.stone) s += 0.45;
    if (p === 'artisan' && sim.shortage.tools && sim.world.stockpile.wood > 8 && sim.world.stockpile.stone > 5) s += 0.4;
    if (p === 'builder') {
      if (sim.world.project) s += 0.6;
      else if (sim.world.repair) s += 0.7;
      else s -= 0.35; // без стройки строитель подрабатывает заготовкой
    }
    push('work', s);
  }

  // ===== СТРОЙКА (волонтёры вечером) =====
  if (!v.isChild(sim) && v.profession !== 'retired' && v.health > 40) {
    const urgent = sim.world.project && (sim.shortage.wood || sim.shortage.food || sim.flags.housingPressure);
    if ((h >= 17 && h < 20 || urgent) && (sim.world.project || sim.world.repair)) {
      push('build', 0.34 + tr.gen * 0.3 + tr.dil * 0.2 + (urgent ? 0.3 : 0));
    }
  }

  // ===== ЗАГОТОВКА (безработные/дефицит) =====
  if (!v.isChild(sim) && v.profession !== 'retired' && able && h >= 7 && h < 19) {
    if (v.profession === 'none' || (v.profession !== 'woodcutter' && sim.shortage.wood && sim.world.stockpile.wood < 20)) {
      push('gather', 0.3 + (sim.shortage.wood ? 0.55 : 0) + tr.dil * 0.2, { good: 'wood' });
    }
    if (sim.shortage.stone && v.profession !== 'miner') {
      push('gather', 0.28 + (sim.world.stockpile.stone < 12 ? 0.35 : 0), { good: 'stone' });
    }
  }

  // ===== ОБЩЕНИЕ =====
  const partner = pickPartner(sim, v, null);
  if (partner) {
    const evening = h >= 17 && h < 22 ? 1.35 : 1;
    push('social', (1 - n.social / 100) ** 1.2 * (0.34 + tr.soc * 0.5) * evening, { partnerId: partner.id });
  }
  // визит к другу
  const friend = pickPartner(sim, v, 45);
  if (friend && h >= 16 && h < 21 && v.visitCd <= 0) {
    push('visit', (0.2 + tr.soc * 0.3) * (relA(v, friend) / 100 + 0.4), { partnerId: friend.id });
  }
  // забота о больных
  const sickFriend = [...sim.alive()].find((o) => o.sick && (isFamily(v, o) || relA(v, o) > 35) && v.id !== o.id);
  if (sickFriend && h >= 8 && h < 20) {
    push('help_care', 0.3 + tr.gen * 0.5 + (isFamily(v, sickFriend) ? 0.25 : 0), { partnerId: sickFriend.id });
  }
  // конфронтация со врагом (редко, при свежей обиде)
  const enemy = pickEnemy(sim, v);
  if (enemy && h >= 9 && h < 20 && tr.agg > 0.5) {
    push('confront', tr.agg * 0.34 * (relA(v, enemy) < -40 ? 1.2 : 0.7));
  }

  // ===== РЫНОК (досуг) =====
  if (!v.isChild(sim) && h >= 9 && h < 18 && v.marketCd <= 0) {
    push('market', 0.16 + tr.soc * 0.14 + (v.money > 18 ? 0.12 : 0) + tr.gen * 0.1);
  }

  // ===== ПРОГУЛКА / ИССЛЕДОВАНИЕ =====
  const niceWeather = !sim.weather.rain && !sim.weather.storm;
  push('stroll', 0.13 + tr.cur * 0.16 + (h >= 17 && h < 20 ? 0.1 : 0) + (niceWeather ? 0.08 : -0.1));
  if (!v.isChild(sim) && v.exploreCd <= 0 && h >= 8 && h < 17 && niceWeather) {
    const unexplored = sim.world.pois.some((p) => !p.found);
    if (unexplored) push('explore', 0.22 + tr.cur * 0.55 - tr.cau * 0.12);
  }
  // дети — игра
  if (v.isChild(sim)) {
    push('play', 0.4 + tr.cur * 0.3 + (1 - n.social / 100) * 0.3);
  }
  // общий вечер у площади
  if (sim.gathering && sim.gathering.day === sim.time.dayIndex() && h >= 18) {
    push('gathering', 0.85 + tr.soc * 0.3);
  }

  if (!cands.length) push('stroll', 0.2);
  cands.sort((a, b) => b.score - a.score);
  return cands[0];
}

function relA(v, o) { return v.rel.has(o.id) ? v.rel.get(o.id).a : 0; }

export function pickPartner(sim, v, minAffinity) {
  let best = null, bestS = -1;
  for (const o of sim.alive()) {
    if (o.id === v.id) continue;
    const a = relA(v, o);
    if (minAffinity !== null && a < minAffinity) continue;
    const busy = o.action && !['stroll', 'play', 'market', 'gathering', null].includes(o.action.type);
    if (busy && Math.hypot(o.x - v.x, o.y - v.y) > 3) continue;
    const fam = isFamily(v, o) ? 0.35 : 0;
    const s = a / 100 + fam + o.traits.soc * 0.2 - Math.hypot(o.x - v.x, o.y - v.y) / 60;
    if (s > bestS) { bestS = s; best = o; }
  }
  return bestS > -0.25 ? best : null;
}

function pickEnemy(sim, v) {
  let worst = null, worstA = -10;
  for (const [id, r] of v.rel) {
    if (r.a < worstA && r.a < -20) {
      const o = sim.villagers.get(id);
      if (o && o.alive && Math.hypot(o.x - v.x, o.y - v.y) < 26) { worstA = r.a; worst = o; }
    }
  }
  const fresh = v.memories.some((m) => m.type === 'conflict' && m.otherId === worst?.id && m.weight > 0.8);
  return fresh ? worst : null;
}
