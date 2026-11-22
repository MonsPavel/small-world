// Житель: сущность с личностью, потребностями, навыками, отношениями и памятью

import { ECO } from './defs.js';

export const SKIN_TONES = ['#F2C9A0', '#E5B489', '#C99868'];
export const HAIR_COLORS = ['#3B2A1E', '#6B4A2B', '#8A6239', '#B08956', '#2E2E38', '#9C9C9C', '#D9C48E'];

let NEXT_ID = 1;
export function resetIds() { NEXT_ID = 1; }

export class Villager {
  constructor(o) {
    this.id = NEXT_ID++;
    Object.assign(this, {
      name: '?', surname: '?', sex: 'm', age: 30,
      traits: { soc: 0.5, dil: 0.5, cur: 0.5, agg: 0.3, gen: 0.5, cau: 0.5 },
      skills: { farming: 0.05, woodcutting: 0.05, mining: 0.05, crafting: 0.05, fishing: 0.05, trading: 0.05, building: 0.05, social: 0.1 },
      needs: { food: 90, energy: 90, social: 75 },
      health: 100, money: 10,
      profession: 'none', workplaceId: null, homeId: null,
      spouseId: null, parents: [], children: [],
      rel: new Map(),       // id -> { a: симпатия -100..100, t: доверие 0..100 }
      memories: [],         // { day, type, otherId, text, weight }
      log: [],              // история жизни { day, text, icon }
      x: 18, y: 18, path: [],
      action: null, thinkCd: 0,
      exploreCd: 0, marketCd: 0, visitCd: 0,
      emote: null,          // { kind, until }
      indoor: false, carrying: null,
      bornDay: 0, alive: true, gone: false, deadDay: -1, deadCause: '',
      walkPhase: Math.random() * 6.28,
      skin: SKIN_TONES[0], hair: HAIR_COLORS[0], hairStyle: 0,
      moodBuffs: [],        // { label, v, untilDay }
      sick: false, sickSince: -1,
      xpFlash: 0,
    }, o);
  }

  fullName() { return `${this.name} ${this.surname}`; }
  shortName() { return this.name; }
  isChild(sim) { return this.age < 16; }
  home(sim) { return sim.world.buildings.find((b) => b.id === this.homeId) || null; }
  workplace(sim) { return sim.world.buildings.find((b) => b.id === this.workplaceId) || null; }
  spouse(sim) { return this.spouseId ? sim.villagers.get(this.spouseId) : null; }
  homeDoor(sim) { const h = this.home(sim); return h ? h.door : { x: 18, y: 18 }; }

  relTo(id) {
    if (!this.rel.has(id)) this.rel.set(id, { a: 0, t: 30 });
    return this.rel.get(id);
  }

  // Потребности: затухание в сим-минутах
  tickNeeds(dtMin, sim) {
    const h = dtMin / 60;
    const sleeping = this.action && this.action.type === 'sleep';
    this.needs.food = Math.max(0, this.needs.food - ECO.DECAY.food * h);
    if (sleeping) this.needs.energy = Math.min(100, this.needs.energy + ECO.SLEEP_REGEN * h);
    else this.needs.energy = Math.max(0, this.needs.energy - ECO.DECAY.energy * h);
    this.needs.social = Math.max(0, this.needs.social - ECO.DECAY.social * h);
    // здоровье
    if (this.needs.food <= 0.5) this.health = Math.max(0, this.health - 8 * h / 24 * 24); // голод: -8/день
    else if (this.needs.food > 35 && !this.sick) this.health = Math.min(100, this.health + 11 * h / 24);
    if (sleeping) this.health = Math.min(100, this.health + 4 * h / 24); // сон лечит
    if (this.sick) this.health = Math.max(5, this.health - (this.wasCared ? 0 : 5) * h / 24);
    this.wasCared = false;
    // истощение
    if (this.needs.energy <= 0.5) this.health = Math.max(0, this.health - 4 * h / 24);
    if (this.emote && sim.time.total > this.emote.until) this.emote = null;
  }

  addBuff(label, v, days, sim) {
    this.moodBuffs = this.moodBuffs.filter((b) => b.label !== label);
    this.moodBuffs.push({ label, v, untilDay: sim.time.dayIndex() + days });
  }
  trimBuffs(day) {
    if (this.moodBuffs.some((b) => b.untilDay < day)) this.moodBuffs = this.moodBuffs.filter((b) => b.untilDay >= day);
  }

  mood(sim) {
    if (!this.alive) return 0;
    const n = this.needs;
    let m = 12 + 42 * ((n.food + n.energy + n.social) / 300) + 18 * (this.health / 100);
    // отношения: близкие связи
    let best = 0, sum = 0, cnt = 0;
    for (const [id, r] of this.rel) {
      const o = sim.villagers.get(id);
      if (!o || !o.alive) continue;
      sum += r.a; cnt++;
      if (r.a > best) best = r.a;
    }
    if (cnt) m += 10 * clamp((sum / cnt) / 60, -1, 1);
    m += 8 * clamp(best / 80, 0, 1);
    if (this.spouseId) m += 4;
    if (this.sick) m -= 14;
    if (!this.homeId) m -= 8;
    for (const b of this.moodBuffs) m += b.v;
    return clamp(m, 0, 100);
  }

  remember(sim, type, otherId, text, weight = 1) {
    this.memories.push({ day: sim.time.dayIndex(), type, otherId, text, weight });
    if (this.memories.length > 40) this.memories.shift();
  }
  addLog(sim, text, icon = 'info') {
    this.log.push({ day: sim.time.dayIndex(), text, icon });
    if (this.log.length > 40) this.log.shift();
  }

  skillUp(name, amount) {
    this.skills[name] = clamp(this.skills[name] + amount, 0, 1);
  }
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function clamp01(v) { return clamp(v, 0, 1); }
