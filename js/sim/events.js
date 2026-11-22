// События мира: погода, катастрофы, дни жизни (рождения, смерти, переезды), праздники

import { vform } from './defs.js';

export function rollWeather(sim) {
  const rng = sim.rng;
  const season = sim.time.seasonIndex();
  const table = [
    { clear: 0.5, cloudy: 0.3, rain: 0.16, storm: 0.04 }, // весна
    { clear: 0.55, cloudy: 0.25, rain: 0.14, storm: 0.06 }, // лето
    { clear: 0.4, cloudy: 0.32, rain: 0.2, storm: 0.08 }, // осень
    { clear: 0.42, cloudy: 0.3, rain: 0.0, storm: 0.04 }, // зима (snow)
  ][season];
  let r = rng.float(), acc = 0, kind = 'clear';
  for (const [k, p] of Object.entries(table)) { acc += p; if (r <= acc) { kind = k; break; } }
  const prev = sim.weather.kind;
  sim.weather = {
    kind, rain: kind === 'rain' || kind === 'storm', storm: kind === 'storm',
    snow: season === 3 && (kind === 'rain' || kind === 'cloudy') && rng.chance(0.7),
  };
  if (kind === 'storm') {
    sim.journal({ cat: 'nature', icon: 'storm', text: season === 3 ? 'Над поселением бушует метель' : 'Разразилась буря' });
    // повреждение здания
    const dmg = [...sim.world.buildings].filter((b) => b.condition > 0);
    if (dmg.length && rng.chance(0.75)) {
      const b = rng.pick(dmg);
      b.condition = Math.max(8, b.condition - rng.int(30) - 18);
      sim.world.repair = b;
      sim.journal({ cat: 'alert', icon: 'storm', text: `Буря повредила ${b.def.label.toLowerCase()} — нужен ремонт` });
    }
  } else if (prev === 'storm') {
    sim.journal({ cat: 'nature', icon: 'sun', text: 'Буря утихла' });
  }
  if (sim.weather.snow && !sim.flags.snowAnnounced) {
    sim.flags.snowAnnounced = true;
    sim.journal({ cat: 'nature', icon: 'snow', text: 'Выпал первый снег' });
  }
}

// Планировщик поселения: что строить дальше
export function planConstruction(sim) {
  const w = sim.world;
  if (w.project || w.repair) return;
  const alive = [...sim.alive()];
  const pop = alive.length;
  const beds = w.bedsTotal();
  sim.flags.housingPressure = beds - pop < 1;
  const afford = (cost) => Object.entries(cost).every(([g, q]) => w.stockpile[g] >= q);

  let want = null;
  if (w.repair) return; // сначала ремонт (обрабатывается в работе)
  if (sim.flags.housingPressure) want = 'house';
  else if (w.stockpile.food > 120 && sim.time.seasonIndex() === 2 && !w.buildingsOf('granary').length && afford({ wood: 45, stone: 30 })) want = 'granary';
  else if (w.stockpile.food < 90 && w.buildingsOf('farm').length < 3 && afford({ wood: 35, stone: 10 })) want = 'farm';
  else if (beds - pop >= 1 && w.stockpile.wood > 140 && w.stockpile.stone > 70) want = 'house'; // профицит — расширяемся

  if (!want) return;
  const def = BUILD_DEFS[want];
  if (!afford(def.cost)) {
    if (!sim.flags.lackNoticeDay || sim.time.dayIndex() - sim.flags.lackNoticeDay > 2) {
      sim.flags.lackNoticeDay = sim.time.dayIndex();
      sim.journal({ cat: 'econ', icon: 'wood', text: `Поселению нужен ${def.label.toLowerCase()} — не хватает материалов` });
    }
    return;
  }
  const spot = w.buildSpots.find((s) => spotFree(w, s, def));
  if (!spot) return;
  for (const [g, q] of Object.entries(def.cost)) w.stockpile[g] -= q;
  w.project = { type: want, x: spot.x, y: spot.y, w: def.w, h: def.h, progress: 0, def };
  sim.journal({ cat: 'build', icon: 'hammer', text: `Начато строительство: ${def.label.toLowerCase()}` });
}

function spotFree(w, s, def) {
  for (let j = s.y; j < s.y + def.h; j++) for (let i = s.x; i < s.x + def.w; i++) {
    if (w.t(i, j) !== 0 && w.t(i, j) !== 6) return false;
    if (w.block[w.idx(i, j)]) return false;
  }
  return true;
}
import { BUILDING_DEFS as BUILD_DEFS } from './defs.js';

// Ежедневная проверка жизни: рождения, смерти, болезни, отъезды, взросление
export function dailyLife(sim) {
  const rng = sim.rng, w = sim.world;
  const day = sim.time.dayIndex();
  const alive = [...sim.alive()];

  // ==== рождения ====
  for (const m of alive) {
    if (m.sex !== 'f' || !m.spouseId) continue;
    const sp = sim.villagers.get(m.spouseId);
    if (!sp || !sp.alive) continue;
    if (m.age < 18 || m.age > 40) continue;
    if (m.sick || sp.sick) continue;
    const foodOk = w.stockpile.food > 60;
    if (foodOk && rng.chance(0.02 + (m.relTo(sp.id).a > 70 ? 0.012 : 0))) sim.spawnChild(m, sp);
  }

  // ==== болезни ====
  const season = sim.time.seasonIndex();
  for (const v of alive) {
    if (!v.sick && v.health > 60 && rng.chance(season === 3 ? 0.014 : 0.007)) {
      v.sick = true; v.sickSince = day; v.action = null; v.path = [];
      v.addLog(sim, vform(v, 'Заболел', 'Заболела'), 'cross');
      sim.journal({ cat: 'people', icon: 'cross', text: `${v.name} ${vform(v, 'заболел', 'заболела')} и нуждается в уходе` });
    }
  }

  // ==== смерти ====
  for (const v of alive) {
    let p = 0, cause = '';
    if (v.age < 55) p = 0.0004;
    else if (v.age < 65) p = 0.004;
    else if (v.age < 72) p = 0.014;
    else if (v.age < 80) p = 0.05;
    else p = 0.14;
    if (v.sick && v.health < 25) p += 0.03;
    if (v.needs.food <= 0.5) p += 0.02;
    if (rng.chance(p)) { sim.killVillager(v, v.age >= 55 ? 'от старости' : 'от болезни'); continue; }
    if (v.health <= 1) sim.killVillager(v, v.needs.food <= 1 ? 'от голода' : 'от истощения');
  }

  // ==== отъезды (хронически несчастные) ====
  for (const v of alive) {
    if (v.isChild(sim) || v.gone) continue;
    if (v.mood(sim) < 22 && v.needs.food < 35 && rng.chance(0.05) && v.age >= 17 && !v.spouseId) {
      v.action = { type: 'leave', phase: 'move', t: 0, data: {}, target: { x: 2, y: 18 } };
      v.path = [];
      v.addLog(sim, vform(v, 'Решил', 'Решила') + ' покинуть поселение', 'leave');
      break;
    }
  }

  // ==== приезжие ====
  const beds = w.bedsTotal();
  if (beds - alive.length >= 2 && rng.chance(0.07) && alive.length < 34) {
    sim.spawnNewcomer();
  }

  // ==== взросление и профессии ====
  for (const v of alive) {
    if (v.isChild(sim) && v.age >= 16) sim.adultTransition(v);
    if (v.profession !== 'retired' && v.age >= 66 && v.profession !== 'none') {
      v.profession = 'retired';
      v.workplaceId = null;
      v.addLog(sim, vform(v, 'Вышел', 'Вышла') + ' на пенсию', 'info');
      sim.journal({ cat: 'people', icon: 'info', text: `${v.name} ${vform(v, 'вышел', 'вышла')} на пенсию` });
    }
  }

  // ==== переназначение профессий при нехватке кормильцев ====
  if (!sim.flags.reassignedDay || day > sim.flags.reassignedDay) {
    const workers = alive.filter((v) => !v.isChild(sim) && !['retired', 'none'].includes(v.profession) && v.health > 40);
    const cnt = {};
    for (const wk of workers) cnt[wk.profession] = (cnt[wk.profession] || 0) + 1;
    const foodWorkers = (cnt.farmer || 0) + (cnt.fisher || 0);
    const need = Math.max(2, Math.round(alive.length / 6));
    if (foodWorkers < need && workers.length > 4) {
      const surplus = ['woodcutter', 'miner', 'artisan', 'builder', 'trader']
        .filter((p) => (cnt[p] || 0) > 1)
        .sort((a, b) => (cnt[b] || 0) - (cnt[a] || 0));
      if (surplus.length) {
        const cand = workers.filter((wk) => wk.profession === surplus[0] && !wk.sick)[0];
        if (cand) {
          const to = (cnt.farmer || 0) <= (cnt.fisher || 0) && sim.world.buildingsOf('farm').length ? 'farmer' : 'fisher';
          cand.profession = to;
          cand.workplaceId = to === 'farmer' ? sim.world.buildingsOf('farm')[0]?.id || null : null;
          cand.addLog(sim, `${vform(cand, 'Сменил', 'Сменила')} ремесло: теперь кормит поселение`, 'tool');
          sim.journal({ cat: 'econ', icon: 'tool', text: `${cand.name} ${vform(cand, 'переквалифицировался', 'переквалифицировалась')} — в поселении не хватает кормильцев` });
          sim.flags.reassignedDay = day;
        }
      }
    }
  }

  // ==== праздник ====
  const mood = sim.avgMood();
  if (!sim.gathering && mood > 66 && w.stockpile.food > 130 && day - (sim.flags.lastFeast ?? -10) > 8 && rng.chance(0.35)) {
    sim.flags.lastFeast = day;
    sim.gathering = { day: day + 1, kind: 'feast' };
    sim.journal({ cat: 'social', icon: 'music', text: 'Поселение готовится к празднику у колодца' });
  }
  if (sim.gathering && sim.gathering.day === day && sim.gathering.kind === 'feast' && !sim.gathering.announced) {
    sim.gathering.announced = true;
    sim.journal({ cat: 'social', icon: 'music', text: 'Вечером — общий праздник у колодца' });
  }
  if (sim.gathering && day > sim.gathering.day) sim.gathering = null;

  // ==== предупреждение о еде ====
  if (w.stockpile.food < 10 && !sim.flags.foodWarned) {
    sim.flags.foodWarned = true;
    sim.journal({ cat: 'alert', icon: 'food', text: 'В поселении закончилась еда' });
  }
  if (w.stockpile.food > 40) sim.flags.foodWarned = false;
  if (w.stockpile.tools < 2 && !sim.flags.toolsWarned) {
    sim.flags.toolsWarned = true;
    sim.journal({ cat: 'econ', icon: 'tools', text: 'Поселению не хватает инструментов' });
  }
  if (w.stockpile.tools > 4) sim.flags.toolsWarned = false;
}

// Сезонная смена
export function onSeasonChange(sim) {
  const s = sim.time.seasonIndex();
  const names = ['Наступила весна', 'Наступило лето', 'Наступила осень', 'Наступила зима'];
  sim.journal({ cat: 'nature', icon: ['blossom', 'sun', 'leaf', 'snow'][s], text: names[s] });
  sim.flags.snowAnnounced = s === 3 ? false : sim.flags.snowAnnounced;
  // деревья восстанавливаются весной быстрее
  if (s === 0) {
    for (const t of sim.world.trees) if (t.stump && sim.rng.chance(0.3)) t.regrow = sim.time.dayIndex();
  }
}
