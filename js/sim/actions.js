// Исполнение действий: движение, фазы, завершение с эффектами

import { WALK_TILES_PER_MIN, ECO, PROFESSIONS, vform } from './defs.js';
import { interact, conflict, help, resourceDispute } from './social.js';
import { deposit, takeMeal, tradeCycle } from './economy.js';

const PLAZA = { x: 18, y: 18 };

// Человекочитаемое описание текущего занятия (для UI)
export function actionLabel(sim, v) {
  const a = v.action;
  if (!a) return 'Размышляет';
  const who = (id) => { const o = sim.villagers.get(id); return o ? o.name : ''; };
  switch (a.type) {
    case 'sleep': return v.sick ? 'Отдыхает (болезнь)' : 'Спит';
    case 'rest': return 'Отдыхает';
    case 'eat': return a.phase === 'move' ? 'Идёт обедать' : 'Обедает';
    case 'forage': return a.phase === 'move' ? 'Ищет еду в лесу' : 'Собирает ягоды и коренья';
    case 'work': return workLabel(sim, v, a);
    case 'build': {
      const p = sim.world.project, r = sim.world.repair;
      const what = a.data?.isRepair ? (r ? r.def.label.toLowerCase() : 'здание') : (p ? BUILD_LABEL[p.type] : '');
      return a.phase === 'move' ? `Идёт на стройку (${what})` : `Строит: ${what}`;
    }
    case 'gather': return a.phase === 'move' ? 'Идёт за ресурсами' : (a.data.good === 'wood' ? 'Заготавливает древесину' : 'Добывает камень');
    case 'social': return a.phase === 'move' ? `Идёт к ${who(a.partnerId)}` : `Разговаривает с ${who(a.partnerId)}`;
    case 'visit': return a.phase === 'move' ? `Идёт в гости к ${who(a.partnerId)}` : `В гостях у ${who(a.partnerId)}`;
    case 'help_care': return a.phase === 'move' ? `Спешит помочь ${who(a.partnerId)}` : `Заботится о ${who(a.partnerId)}`;
    case 'confront': return a.phase === 'move' ? `Ищет ${who(a.partnerId)}` : 'Выясняет отношения';
    case 'market': return a.phase === 'move' ? 'Идёт на рынок' : 'Торгуется на рынке';
    case 'stroll': return 'Гуляет';
    case 'explore': return 'Исследует окрестности';
    case 'play': return 'Играет';
    case 'gathering': return 'На празднике у колодца';
    case 'leave': return 'Покидает поселение';
    case 'arrive': return 'Приближается к поселению';
    default: return 'Занят';
  }
}
const BUILD_LABEL = { house: 'дом', farm: 'ферма', workshop: 'мастерская', market: 'рынок', granary: 'амбар' };

function workLabel(sim, v, a) {
  const p = v.profession;
  const moving = a.phase === 'move';
  switch (p) {
    case 'farmer': return moving ? 'Идёт в поле' : 'Работает в поле';
    case 'woodcutter': return moving ? 'Идёт в лес' : 'Рубит лес';
    case 'miner': return moving ? 'Идёт в каменоломню' : 'Добывает камень';
    case 'fisher': return moving ? 'Идёт на пирс' : 'Ловит рыбу';
    case 'artisan': return moving ? 'Идёт в мастерскую' : 'Изготавливает инструменты';
    case 'trader': return moving ? 'Идёт на рынок' : 'Торгует';
    case 'builder': return moving ? 'Идёт на работу' : 'Трудится';
    default: return 'Работает';
  }
}

// ===== Запуск действия: определяем цель =====
export function startAction(sim, v, a) {
  a.phase = 'move'; a.t = 0; a.data = a.data || {};
  const w = sim.world;
  const home = v.home(sim);
  switch (a.type) {
    case 'sleep': case 'rest':
      a.target = home ? { ...home.door } : { ...PLAZA }; a.data.homeless = !home; break;
    case 'eat':
      a.target = home ? { ...home.door } : (w.buildingsOf('market')[0]?.door || { ...PLAZA }); break;
    case 'forage': {
      const fz = w.forestZone;
      a.target = { x: sim.rng.range(fz.x0, fz.x1), y: sim.rng.range(fz.y0, fz.y1) }; break;
    }
    case 'work': case 'gather': {
      if (a.type === 'gather' && a.data.good === 'stone') { const r = w.randomRock(); a.target = r; break; }
      const tree = w.takeTree(v);
      if (!tree) { // лес вырублен — камень или отмена
        const r = w.randomRock(); a.target = r; a.data.good = 'stone';
      } else { a.target = { x: tree.x, y: tree.y }; a.data.tree = tree; a.data.good = a.data.good || 'wood'; }
      break;
    }
    case 'build': {
      const p = w.project, r = w.repair;
      if (a.data?.isRepair && r) a.target = { ...r.door };
      else if (p) a.target = { x: p.x + p.w / 2, y: p.y + p.h / 2 };
      else { a.type = 'stroll'; a.target = { ...PLAZA }; }
      break;
    }
    case 'market': a.target = { ...w.buildingsOf('market')[0]?.door || PLAZA }; break;
    case 'stroll': a.target = strollTarget(sim, v); break;
    case 'explore': {
      const unfound = w.pois.filter((p) => !p.found);
      const poi = unfound.length ? sim.rng.pick(unfound) : null;
      if (poi) { a.target = { x: poi.x + sim.rng.range(-1, 1), y: poi.y + sim.rng.range(-1, 1) }; a.data.poi = poi.id; }
      else a.target = { x: sim.rng.range(4, 33), y: sim.rng.range(4, 33) };
      break;
    }
    case 'play': {
      const base = home ? home.door : PLAZA;
      a.target = { x: base.x + sim.rng.range(-3, 3), y: base.y + sim.rng.range(-3, 3) }; break;
    }
    case 'gathering': a.target = { x: PLAZA.x + sim.rng.range(-2, 2), y: PLAZA.y + sim.rng.range(-2, 2) }; break;
    case 'leave': a.target = { x: 2, y: Math.round(sim.world.C) }; break;
    case 'arrive': a.target = { ...PLAZA }; break;
    default: a.target = targetForPartner(sim, v, a);
  }
  if (a.type === 'work') workTarget(sim, v, a);
  v.path = [];
  return a;
}

function workTarget(sim, v, a) {
  const w = sim.world;
  switch (v.profession) {
    case 'farmer': {
      const farm = v.workplace(sim) || w.buildingsOf('farm')[0];
      a.target = farm ? w.randomFieldTile(farm) : { ...PLAZA }; break;
    }
    case 'woodcutter': {
      const tree = w.takeTree(v);
      if (tree) { a.target = { x: tree.x, y: tree.y }; a.data.tree = tree; }
      else { a.type = 'gather'; const r = w.randomRock(); a.target = r; a.data = { good: 'stone' }; }
      break;
    }
    case 'miner': a.target = w.randomRock(); break;
    case 'fisher': a.target = { ...w.pierEnd }; break;
    case 'artisan': a.target = { ...(v.workplace(sim) || w.buildingsOf('workshop')[0]).door }; break;
    case 'trader': a.target = { ...(v.workplace(sim) || w.buildingsOf('market')[0]).door }; break;
    case 'builder': {
      if (w.repair) { a.type = 'build'; a.data.isRepair = true; a.target = { ...w.repair.door }; }
      else if (w.project) { a.type = 'build'; a.target = { x: w.project.x + w.project.w / 2, y: w.project.y + w.project.h / 2 }; }
      else { a.type = 'gather'; const tree = w.takeTree(v); if (tree) { a.target = { x: tree.x, y: tree.y }; a.data = { tree, good: 'wood' }; } else { a.target = w.randomRock(); a.data = { good: 'stone' }; } }
      break;
    }
    default: { // без профессии — помочь делом
      a.type = 'gather';
      const tree = w.takeTree(v);
      if (tree) { a.target = { x: tree.x, y: tree.y }; a.data = { tree, good: 'wood' }; }
      else { a.target = w.randomRock(); a.data = { good: 'stone' }; }
    }
  }
}

function targetForPartner(sim, v, a) {
  const o = sim.villagers.get(a.partnerId);
  if (!o || !o.alive) { a.type = 'stroll'; return strollTarget(sim, v); }
  return { x: o.x, y: o.y };
}

function strollTarget(sim, v) {
  const opts = [PLAZA, { x: 30, y: 24 }, { x: 10, y: 8 }, { x: 24, y: 33 }];
  for (const p of sim.world.pois) if (p.found) opts.push({ x: p.x, y: p.y });
  const t = sim.rng.pick(opts);
  return { x: t.x + sim.rng.range(-1.5, 1.5), y: t.y + sim.rng.range(-1.5, 1.5) };
}

// ===== Шаг жителя: движение + фаза действия =====
export function stepVillager(sim, v, dtMin) {
  const a = v.action;
  if (!a) return;

  if (a.phase === 'move') {
    // динамическая цель: партнёр может двигаться
    let dest = a.target;
    if (a.partnerId != null) {
      const o = sim.villagers.get(a.partnerId);
      if (!o || !o.alive) { cancel(v); return; }
      dest = { x: o.x, y: o.y };
    }
    const near = Math.hypot(v.x - dest.x, v.y - dest.y);

    // взаимодействие начинается при сближении
    if (near < 1.15 && ['social', 'confront'].includes(a.type)) { engage(sim, v, a); return; }
    if (near < 1.15 && a.type === 'help_care') { beginDoing(sim, v, a); return; }

    if (!v.path.length && near > 0.4) {
      const path = sim.world.findPath(v, dest);
      if (!path) { cancel(v); v.thinkCd = 5; return; }
      v.path = path;
      if (a.partnerId != null) a._lastDest = { ...dest };
    }
    // перепрокладка, если партнёр ушёл
    if (a.partnerId != null && a._lastDest && Math.hypot(dest.x - a._lastDest.x, dest.y - a._lastDest.y) > 1.6) {
      const path = sim.world.findPath(v, dest);
      if (path) { v.path = path; a._lastDest = { ...dest }; }
    }
    moveAlong(sim, v, dtMin);
    const nowNear = a.partnerId != null
      ? Math.hypot(v.x - dest.x, v.y - dest.y)
      : Math.hypot(v.x - a.target.x, v.y - a.target.y);
    if (nowNear < 0.5 || (!v.path.length && nowNear < 1.2)) {
      beginDoing(sim, v, a);
    }
    return;
  }

  // фаза 'do'
  a.t += dtMin;
  if (a.type === 'sleep') {
    const h = sim.time.hour();
    if (h >= 6 && h < 21 && v.needs.energy > 92) return resolve(sim, v, a);
    if (h >= 7 && h < 21 && v.needs.food < 6) return resolve(sim, v, a); // голод будит
    if (a.t >= (a.dur || 1e9) && h >= 5.5) return resolve(sim, v, a);
    if (a.t >= a.dur + 240) return resolve(sim, v, a); // страховка
    return;
  }
  if (a.type === 'work' && v.profession === 'trader') {
    if (Math.floor(a.t / 110) > Math.floor((a.t - dtMin) / 110)) tradeCycle(sim, v);
  }
  if (a.t >= a.dur) resolve(sim, v, a);
}

function moveAlong(sim, v, dtMin) {
  if (!v.path.length) return;
  let speed = WALK_TILES_PER_MIN * (v.sick ? 0.6 : v.age >= 65 ? 0.85 : v.isChild(sim) ? 1.1 : 1) * (v.carrying ? 0.9 : 1);
  let budget = speed * dtMin;
  while (budget > 0 && v.path.length) {
    const wp = v.path[0];
    const dx = wp.x - v.x, dy = wp.y - v.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-4) { v.path.shift(); continue; }
    const step = Math.min(budget, d);
    v.x += (dx / d) * step; v.y += (dy / d) * step;
    v.walkPhase += step * 2.2;
    budget -= step;
    if (step >= d - 1e-6) v.path.shift();
  }
}

function beginDoing(sim, v, a) {
  a.phase = 'do'; a.t = 0; v.path = [];
  switch (a.type) {
    case 'sleep': case 'rest': v.indoor = !a.data.homeless; v.emote = { kind: 'zzz', until: Infinity }; sim.fxBurst(v.x, v.y, 'zzz', 1); break;
    case 'eat': v.indoor = true; v.emote = { kind: 'eat', until: sim.time.total + 30 }; a.dur = a.dur || 22; break;
    case 'work': case 'gather': {
      a.dur = a.dur || (150 + sim.rng.range(0, 60));
      const em = { farmer: 'eat', woodcutter: 'tool', miner: 'tool', fisher: 'fish', artisan: 'tool', trader: 'coin', builder: 'tool' }[v.profession] || 'tool';
      v.emote = { kind: em, until: sim.time.total + a.dur };
      if (v.profession === 'trader') tradeCycle(sim, v); // утренний закуп — до пика завтраков
      if (a.data.tree) v.carrying = 'wood';
      else if (v.profession === 'farmer') v.carrying = 'food';
      else if (v.profession === 'fisher') v.carrying = 'fish';
      else if (v.profession === 'miner' || a.data?.good === 'stone') v.carrying = 'stone';
      break;
    }
    case 'build': a.dur = a.dur || 150; v.emote = { kind: 'tool', until: sim.time.total + a.dur }; v.carrying = 'wood'; sim.fxBurst(v.x, v.y, 'dust', 4); break;
    case 'forage': a.dur = a.dur || 60; v.emote = { kind: 'eat', until: sim.time.total + 60 }; v.carrying = 'food'; break;
    case 'stroll': a.dur = a.dur || 35; break;
    case 'explore': a.dur = a.dur || 40; break;
    case 'play': a.dur = a.dur || 40; v.emote = { kind: 'talk', until: sim.time.total + 40 }; break;
    case 'market': a.dur = a.dur || 40; v.emote = { kind: 'coin', until: sim.time.total + 40 }; break;
    case 'visit': a.dur = a.dur || 50; v.emote = { kind: 'heart', until: sim.time.total + 50 }; break;
    case 'gathering': a.dur = a.dur || 60; v.emote = { kind: 'talk', until: sim.time.total + 60 }; break;
    case 'help_care': a.dur = a.dur || 45; v.emote = { kind: 'heart', until: sim.time.total + 45 }; break;
    default: a.dur = a.dur || 30;
  }
}

// двое начинают разговор
function engage(sim, v, a) {
  const o = sim.villagers.get(a.partnerId);
  if (!o || !o.alive) { cancel(v); return; }
  const dur = a.type === 'confront' ? 20 : 22 + sim.rng.range(0, 18);
  a.phase = 'do'; a.t = 0; a.dur = dur;
  // партнёр прерывается на разговор, если занятие прерываемое
  const interruptible = !o.action || ['stroll', 'play', 'market', 'gathering', 'social', null].includes(o.action.type);
  if (interruptible) {
    o.action = { type: 'social', partnerId: v.id, phase: 'do', t: 0, dur, data: { passive: true }, target: { x: v.x, y: v.y } };
    o.path = [];
    o.emote = { kind: 'talk', until: sim.time.total + dur };
  }
  v.emote = { kind: 'talk', until: sim.time.total + dur };
}

function cancel(v) { v.action = null; v.path = []; v.indoor = false; v.carrying = null; }

// ===== Завершение действия =====
function resolve(sim, v, a) {
  const w = sim.world, rng = sim.rng;
  v.action = null; v.indoor = false;
  const carried = v.carrying; v.carrying = null;
  switch (a.type) {
    case 'sleep': case 'rest': {
      v.emote = null;
      if (a.type === 'rest') { v.health = Math.min(100, v.health + 14); if (v.health > 55) v.sick = false; }
      break;
    }
    case 'eat': {
      const ok = takeMeal(sim, v);
      if (!ok) v.thinkCd = 0; // сразу искать еду
      break;
    }
    case 'forage': {
      const qty = (v.isChild(sim) ? 3 : 5) + v.skills.farming * 5 + rng.range(0, 3);
      deposit(sim, v, 'food', qty);
      v.moodBuffs.push({ label: 'foraged', v: -1, untilDay: sim.time.dayIndex() });
      break;
    }
    case 'work': resolveWork(sim, v, a); break;
    case 'gather': {
      if (a.data.good === 'stone') deposit(sim, v, 'stone', 7 + v.skills.mining * 5);
      else {
        const tree = a.data.tree;
        if (tree) { tree.wood -= 1; if (tree.wood <= 0) { tree.stump = true; tree.regrow = sim.time.dayIndex() + 12 + rng.int(8); } }
        deposit(sim, v, 'wood', 8 + v.skills.woodcutting * 6);
      }
      break;
    }
    case 'build': {
      if (a.data?.isRepair && w.repair) {
        w.repair.condition = Math.min(100, w.repair.condition + 38);
        w.repair.contributors ??= new Set(); w.repair.contributors.add(v.name);
        if (w.repair.condition >= 100) {
          sim.journal({ cat: 'build', icon: 'tool', text: `${w.repair.def.label} восстановлен после бури — трудились: ${[...w.repair.contributors].join(', ') || v.name}` });
          w.repair = null;
        }
      } else if (w.project) {
        const main = v.profession === 'builder';
        w.project.progress += (main ? 20 + v.skills.building * 16 : 9 + v.traits.gen * 6);
        sim.fxBurst(w.project.x + w.project.w / 2, w.project.y + w.project.h / 2, 'dust', 3);
        if (w.project.progress >= 100) sim.completeProject();
      }
      break;
    }
    case 'social': {
      const o = sim.villagers.get(a.partnerId);
      if (o && o.alive) {
        const kind = v.pendingGift === o.id ? 'gift' : a.data?.feast ? 'feast' : 'chat';
        if (kind === 'gift') v.pendingGift = null;
        interact(sim, v, o, kind);
      }
      break;
    }
    case 'visit': {
      const o = sim.villagers.get(a.partnerId);
      if (o && o.alive && Math.hypot(o.x - v.x, o.y - v.y) < 2.2) interact(sim, v, o, 'visit');
      else { v.needs.social = Math.min(100, v.needs.social + 10); v.addBuff('walk', 2, 1, sim); }
      v.visitCd = 240 + rng.range(0, 240);
      break;
    }
    case 'help_care': {
      const o = sim.villagers.get(a.partnerId);
      if (o && o.alive && o.sick) {
        help(sim, v, o, 'уход во время болезни');
        o.wasCared = true; o.health = Math.min(100, o.health + 14);
        if (o.health > 60) { o.sick = false; sim.journal({ cat: 'people', icon: 'heart', text: `${o.name} идёт на поправку — благодаря заботе ${v.name}` }); o.addLog(sim, `${vform(o, 'Выздоровел', 'Выздоровела')} благодаря заботе ${v.name}`, 'heart'); }
      }
      break;
    }
    case 'confront': {
      const o = sim.villagers.get(a.partnerId);
      if (o && o.alive) conflict(sim, v, o, 'старые счёты');
      break;
    }
    case 'market': {
      if (v.money >= 6) {
        v.money -= 5; v.addBuff('treat', 4, 1, sim);
        if (v.traits.gen > 0.5 && v.money >= 8) {
          const friend = bestFriend(sim, v);
          if (friend && rng.chance(0.6)) { v.money -= 6; v.pendingGift = friend.id; }
        }
      }
      v.marketCd = 400 + rng.range(0, 300);
      break;
    }
    case 'stroll': v.addBuff('walk', 2, 1, sim); v.needs.social += 3; break;
    case 'explore': {
      v.exploreCd = 900 + rng.range(0, 600);
      const poi = w.pois.find((p) => p.id === a.data.poi);
      if (poi && !poi.found && Math.hypot(poi.x - v.x, poi.y - v.y) < 2.6) {
        poi.found = true; poi.foundBy = v.name; poi.foundDay = sim.time.dayIndex();
        if (poi.kind !== 'mood') w.stockpile[poi.kind] += poi.qty;
        v.addBuff('discovery', 8, 3, sim);
        v.addLog(sim, `${vform(v, 'Нашёл', 'Нашла')} ${poi.label}`, 'star');
        sim.journal({ cat: 'nature', icon: 'star', text: `${v.name} ${vform(v, 'обнаружил', 'обнаружила')} ${poi.label}${poi.kind !== 'mood' ? ` (+${poi.qty})` : ''}` });
        sim.fxBurst(v.x, v.y, 'sparkle', 8);
      } else {
        v.addBuff('discovery', 3, 1, sim);
      }
      break;
    }
    case 'play': v.needs.social = Math.min(100, v.needs.social + 12); v.addBuff('play', 3, 1, sim); v.needs.energy -= 3; break;
    case 'gathering': {
      v.addBuff('feast', 6, 2, sim);
      const near = [...sim.alive()].filter((o) => o !== v && Math.hypot(o.x - v.x, o.y - v.y) < 3 && o.action?.type === 'gathering');
      if (near.length) interact(sim, v, sim.rng.pick(near), 'feast');
      break;
    }
    case 'leave': {
      v.alive = false; v.gone = true; v.deadDay = sim.time.dayIndex();
      sim.journal({ cat: 'people', icon: 'leave', text: `${v.name} ${vform(v, 'покинул', 'покинула')} поселение` });
      break;
    }
    case 'arrive': {
      v.addLog(sim, `${vform(v, 'Поселился', 'Поселилась')} в поселении`, 'star');
      break;
    }
  }
}

function resolveWork(sim, v, a) {
  const w = sim.world, rng = sim.rng, sk = (s) => v.skills[s];
  const season = sim.time.seasonIndex();
  const useTool = (consumeP) => {
    if (w.stockpile.tools > 0 && rng.chance(consumeP)) { w.stockpile.tools -= 1; return 1.5; }
    return 1;
  };
  switch (v.profession) {
    case 'farmer': {
      const qty = Math.round((55 + sk('farming') * 45) * ECO.SEASON_FARM[season] * rng.range(0.9, 1.15));
      deposit(sim, v, 'food', qty);
      v.skillUp('farming', 0.04);
      break;
    }
    case 'woodcutter': {
      const tree = a.data.tree;
      // спор за одно дерево
      const rival = [...sim.alive()].find((o) => o !== v && o.action?.type === 'work' && o.profession === 'woodcutter' && o.action.data?.tree === tree);
      if (rival && resourceDispute(sim, v, rival, 'дерево')) { cancel(v); return; }
      const qty = Math.round((16 + sk('woodcutting') * 14) * useTool(0.22));
      if (tree) { tree.wood -= 1; if (tree.wood <= 0) { tree.stump = true; tree.regrow = sim.time.dayIndex() + 12 + rng.int(8); } }
      deposit(sim, v, 'wood', qty);
      v.skillUp('woodcutting', 0.04);
      break;
    }
    case 'miner': {
      const qty = Math.round((14 + sk('mining') * 12) * useTool(0.2));
      deposit(sim, v, 'stone', qty);
      v.skillUp('mining', 0.04);
      break;
    }
    case 'fisher': {
      const qty = Math.round((30 + sk('fishing') * 25) * ECO.SEASON_FISH[season] * rng.range(0.85, 1.2));
      deposit(sim, v, 'food', qty);
      v.skillUp('fishing', 0.04);
      break;
    }
    case 'artisan': {
      if (w.stockpile.wood >= 3 && w.stockpile.stone >= 2) {
        w.stockpile.wood -= 3; w.stockpile.stone -= 2;
        deposit(sim, v, 'tools', 1 + (sk('crafting') > 0.55 ? 1 : 0));
        v.skillUp('crafting', 0.05);
      } else { v.thinkCd = 0; } // материалов нет — переиграть
      break;
    }
    case 'trader': tradeCycle(sim, v); v.skillUp('trading', 0.04); break;
    case 'builder': v.skillUp('building', 0.05); break;
  }
}

function bestFriend(sim, v) {
  let best = null, ba = -1;
  for (const [id, r] of v.rel) {
    const o = sim.villagers.get(id);
    if (o && o.alive && r.a > ba) { ba = r.a; best = o; }
  }
  return ba > 40 ? best : null;
}
