// Экономика: производство, склад, рынок, цены, стройка

import { ECO } from './defs.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function deposit(sim, v, good, qty) {
  const cap = good === 'food' ? sim.world.foodCap() : Infinity;
  const space = Math.max(0, cap - sim.world.stockpile[good]);
  sim.world.stockpile[good] += Math.min(qty, space);
  v.money += ECO.WAGE;
  if (sim.world.stockpile[good] < 1 && good === 'food') sim.flags.foodEmptySince ??= sim.time.dayIndex();
}

export function takeMeal(sim, v) {
  const sp = sim.world.stockpile;
  if (sp.food >= ECO.MEAL_FOOD) {
    const ration = sp.food < 45; // скудный паёк — растянуть запас
    sp.food -= ration ? 3 : ECO.MEAL_FOOD;
    v.needs.food = Math.min(100, v.needs.food + (ration ? 28 : ECO.MEAL_SATIETY));
    if (ration && !sim.flags.rationNotice) {
      sim.flags.rationNotice = true;
      sim.journal({ cat: 'alert', icon: 'food', text: 'Скудный паёк: еды впритык, трапезы урезаны' });
    }
    if (sp.food > 90) sim.flags.rationNotice = false;
    return true;
  }
  v.needs.food = Math.min(100, v.needs.food + 10); // недоедание
  return false;
}

export function prices(sim) {
  const sp = sim.world.stockpile, out = {};
  for (const g of ['food', 'wood', 'stone', 'tools']) {
    const target = ECO.TARGETS[g];
    const ratio = clamp(target / Math.max(1, sp[g]), 0.4, 2.4);
    out[g] = Math.round(ECO.PRICES[g] * ratio * 10) / 10;
  }
  return out;
}

// Торговая смена: караваны, покупка/продажа
export function tradeCycle(sim, trader) {
  const sp = sim.world.stockpile;
  const pr = prices(sim);
  const skill = trader.skills.trading;
  let profit = 0, soldText = [], boughtText = [];
  // продаём излишки; еда — только при большом профиците (запас на голодный день)
  for (const g of ['wood', 'stone', 'tools', 'food']) {
    const target = g === 'food' ? 320 : ECO.TARGETS[g] * 1.6;
    if (sp[g] > target) {
      const qty = Math.floor(Math.min(14 + skill * 16, sp[g] - target * 0.95));
      if (qty > 3) {
        const gain = Math.round(qty * pr[g] * (0.9 + skill * 0.25));
        sp[g] -= qty; sp.money += gain; profit += gain;
        soldText.push(`${GOOD_ACC[g].toLowerCase()} ×${qty}`);
      }
    }
  }
  // докупаем дефицитное: еду заранее, материалы — при профиците казны
  const buys = [
    { g: 'food', need: sp.food < 160, qty: 26 + skill * 22 },
    { g: 'tools', need: sp.tools < 4, qty: 3 },
    { g: 'wood', need: sp.wood < ECO.TARGETS.wood * 0.4 && sp.money > 260, qty: 24 },
    { g: 'stone', need: sp.stone < ECO.TARGETS.stone * 0.4 && sp.money > 260, qty: 20 },
  ];
  for (const b of buys) {
    if (!b.need || sp.money < 80) continue;
    const qty = Math.floor(Math.min(b.qty, sp.money / (pr[b.g] * 1.2)));
    if (qty >= 1) {
      const cost = Math.round(qty * pr[b.g] * 1.2);
      sp[b.g] += qty; sp.money -= cost;
      boughtText.push(`${GOOD_ACC[b.g].toLowerCase()} ×${qty}`);
    }
  }
  const nowMin = sim.time.total;
  const throttled = nowMin - (sim.flags.lastTradeJournal ?? -1e9) < 600;
  if ((soldText.length || boughtText.length) && !throttled) {
    sim.flags.lastTradeJournal = nowMin;
    const parts = [];
    if (soldText.length) parts.push(`увёз: ${soldText.join(', ')} (+${profit} м.)`);
    if (boughtText.length) parts.push(`привёз: ${boughtText.join(', ')}`);
    sim.journal({ cat: 'econ', icon: 'coin', text: `Караван ${trader.name} — ${parts.join(', ')}` });
  }
  if (soldText.length || boughtText.length) trader.skillUp('trading', 0.05);
  sim.flags.lastTradeDay = sim.time.dayIndex();
}

const GOOD_ACC = { food: 'Еда', wood: 'Древесина', stone: 'Камень', tools: 'Инструменты' };

// Дневной дефицит (влияет на решения)
export function computeShortage(sim) {
  const sp = sim.world.stockpile;
  sim.shortage = {
    food: sp.food < 70,
    wood: sp.wood < 40,
    stone: sp.stone < 30,
    tools: sp.tools < 3,
    severeFood: sp.food < 20,
  };
}
