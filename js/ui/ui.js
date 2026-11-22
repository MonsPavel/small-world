// Интерфейс наблюдения: топбар, инспектор, хроника, тултипы, модалки

import { PROFESSIONS, TRAIT_LABELS, SKILL_LABELS, GOODS } from '../sim/defs.js';
import { actionLabel } from '../sim/actions.js';
import { relLabel, isFamily } from '../sim/social.js';
import { drawVillagerFigure } from '../render/entities.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const CAT_COLORS = {
  social: '#F2A3B3', people: '#7FD1C0', build: '#D4A96A', econ: '#E8C558',
  nature: '#9CCB7A', alert: '#F08D8D', info: '#A9B7C6',
};

const ICONS = {
  sun: '<circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M13 3l-1.4 1.4M4.4 11.6L3 13"/>',
  cloud: '<path d="M4.5 12a2.5 2.5 0 1 1 .4-4.97A3.5 3.5 0 0 1 11.5 6a3 3 0 0 1 0 6z"/>',
  rain: '<path d="M4.5 10a2.5 2.5 0 1 1 .4-4.97A3.5 3.5 0 0 1 11.5 4a3 3 0 0 1 0 6z"/><path d="M5 12.5l-.8 2M8 12.5l-.8 2M11 12.5l-.8 2"/>',
  storm: '<path d="M4.5 9a2.5 2.5 0 1 1 .4-4.97A3.5 3.5 0 0 1 11.5 3a3 3 0 0 1 0 6z"/><path d="M8.5 9L6.5 12h2l-1 3 3.5-4h-2l1-2z" fill="currentColor" stroke="none"/>',
  snow: '<path d="M8 2v12M3 5l10 6M13 5L3 11M8 2l-1.5 1.5M8 2l1.5 1.5M8 14l-1.5-1.5M8 14l1.5-1.5"/>',
  people: '<circle cx="5.5" cy="5.5" r="2"/><path d="M2 13c0-2 1.5-3.5 3.5-3.5S9 11 9 13z"/><circle cx="11" cy="6" r="1.6"/><path d="M9.5 13c0-1.6 1-2.6 2.3-2.6 1 0 2 .7 2.2 2.6z"/>',
  food: '<path d="M8 14V5"/><path d="M8 6c-2 0-3-1-3-2.5C6.5 3.5 8 4 8 6zM8 6c2 0 3-1 3-2.5C9.5 3.5 8 4 8 6zM8 9.5c-2 0-3-1-3-2.5 1.5 0 3 .5 3 2.5zM8 9.5c2 0 3-1 3-2.5-1.5 0-3 .5-3 2.5zM8 13c-2 0-3-1-3-2.5 1.5 0 3 .5 3 2.5zM8 13c2 0 3-1 3-2.5-1.5 0-3 .5-3 2.5z"/>',
  wood: '<circle cx="4" cy="8" r="2.6"/><path d="M4 5.4h8.5v5.2H4"/><path d="M4 8h8.5"/><circle cx="4" cy="8" r=".8"/>',
  stone: '<path d="M3 12l1.5-5L8 4l4 2 1 6z"/><path d="M4.5 7L8 8l4-2M8 8v4"/>',
  tools: '<path d="M9.5 3.5L12 6l2-2-1.2-1.2a4 4 0 0 0-3.3-1.1L3 4l1.5 1.5 3.6-1.2"/><path d="M10.5 5.5L4 12l-.5 2.5L6 14l6.5-6.5"/>',
  coin: '<circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="8" r="2.5"/>',
  mood: '<circle cx="8" cy="8" r="6"/><path d="M5.5 9.5c.6 1.2 1.5 1.8 2.5 1.8s1.9-.6 2.5-1.8"/><circle cx="5.8" cy="6.5" r=".5" fill="currentColor"/><circle cx="10.2" cy="6.5" r=".5" fill="currentColor"/>',
  heart: '<path d="M8 13.6C4.5 11 2.4 8.8 2.4 6.4 2.4 4.6 3.8 3.4 5.3 3.4c1 0 2 .5 2.7 1.6C8.7 3.9 9.7 3.4 10.7 3.4c1.5 0 2.9 1.2 2.9 3 0 2.4-2.1 4.6-5.6 7.2z" fill="currentColor" stroke="none"/>',
  anger: '<path d="M8.7 1.5L3 9h3.5l-1 5.5L12 7H8.2l1.5-5.5z" fill="currentColor" stroke="none"/>',
  skull: '<path d="M8 2a5 5 0 0 0-5 5c0 1.8.9 3.2 2 4v2.5h6V11c1.1-.8 2-2.2 2-4a5 5 0 0 0-5-5z"/><circle cx="6" cy="7" r="1" fill="currentColor"/><circle cx="10" cy="7" r="1" fill="currentColor"/><path d="M8 9.5l-.7 1.5h1.4z" fill="currentColor"/>',
  star: '<path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.2L8 11.5l-3.8 2 .7-4.2-3.1-3 4.3-.6z" fill="currentColor" stroke="none"/>',
  music: '<path d="M6 12.5V4l6-1v8.5"/><circle cx="4.5" cy="12.5" r="1.7" fill="currentColor"/><circle cx="10.5" cy="11.5" r="1.7" fill="currentColor"/>',
  leaf: '<path d="M13 3C7 3 3.5 6 3.5 10c0 1.4.5 2.4 1 3 .6-4 3.4-6.8 7-8-3.4 2-5.6 5-6 8.5 4 .5 7.5-2.5 7.5-7z"/>',
  blossom: '<circle cx="8" cy="8" r="1.5"/><path d="M8 2.5v3M8 10.5v3M2.5 8h3M10.5 8h3M4.2 4.2l2 2M9.8 9.8l2 2M11.8 4.2l-2 2M6.2 9.8l-2 2"/>',
  cross: '<circle cx="8" cy="8" r="6"/><path d="M8 5v6M5 8h6"/>',
  leave: '<path d="M6 3H3v10h3"/><path d="M9 5.5L12.5 8 9 10.5M6 8h6"/>',
  info: '<circle cx="8" cy="8" r="6"/><path d="M8 7v4M8 5v.2"/>',
  hammer: '<path d="M9.5 3.5L12 6l2-2-1.2-1.2a4 4 0 0 0-3.3-1.1L3 4l1.5 1.5 3.6-1.2"/><path d="M10.5 5.5L4 12l-.5 2.5L6 14l6.5-6.5"/>',
  tool: '<path d="M9.5 3.5L12 6l2-2-1.2-1.2a4 4 0 0 0-3.3-1.1L3 4l1.5 1.5 3.6-1.2"/><path d="M10.5 5.5L4 12l-.5 2.5L6 14l6.5-6.5"/>',
  pause: '<path d="M5.5 3v10M10.5 3v10"/>',
  play: '<path d="M5 3l8 5-8 5z" fill="currentColor" stroke="none"/>',
  ff: '<path d="M2.5 3.5L8 8l-5.5 4.5zM8.5 3.5L14 8l-5.5 4.5z" fill="currentColor" stroke="none"/>',
  target: '<circle cx="8" cy="8" r="5"/><circle cx="8" cy="8" r="1.4" fill="currentColor"/><path d="M8 1v2.5M8 12.5V15M1 8h2.5M12.5 8H15"/>',
  book: '<path d="M3 3.5c2-1 4-1 5 0 1-1 3-1 5 0V12c-2-1-4-1-5 0-1-1-3-1-5 0z"/><path d="M8 3.5V12"/>',
  reset: '<path d="M13 8a5 5 0 1 1-1.7-3.8"/><path d="M13 2v3h-3"/>',
  help: '<circle cx="8" cy="8" r="6"/><path d="M6.2 6.2c.2-1 1-1.7 1.9-1.7 1 0 1.9.8 1.9 1.8 0 1.4-1.9 1.6-1.9 3"/><circle cx="8" cy="11.6" r=".4" fill="currentColor"/>',
};

export function icon(name, size = 15) {
  const p = ICONS[name] || ICONS.info;
  return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
}

export class UI {
  constructor() {
    this.topbar = document.getElementById('topbar');
    this.inspector = document.getElementById('inspector');
    this.journalList = document.getElementById('journal-list');
    this.tooltip = document.getElementById('tooltip');
    this.modalRoot = document.getElementById('modal-root');
    this.sim = null;
    this.selected = null;
    this.speed = 1;
    this.paused = false;
    this._lastJournalId = 0;
    this._collapsed = false;
    this._buildTopbar();
    this._bindShortcuts();
    this._bindJournalToggle();
  }

  setSim(sim) {
    this.sim = sim;
    this.selected = null;
    this.inspector.classList.add('hidden');
    this._lastJournalId = 0;
    this.journalList.innerHTML = '';
    this.refreshJournal(true);
    this.refreshTopbar();
  }

  // ================= TOPBAR =================
  _buildTopbar() {
    this.topbar.innerHTML = `
      <div class="tb-group" id="tb-date">
        <span class="tb-ico" id="tb-weather"></span>
        <div class="tb-date-main"><b id="tb-day"></b><span id="tb-season"></span></div>
        <span class="tb-clock" id="tb-clock"></span>
      </div>
      <div class="tb-sep"></div>
      <div class="tb-group" id="tb-stats"></div>
      <div class="tb-sep"></div>
      <div class="tb-group tb-controls">
        <div class="speed-switch" id="speed-switch"></div>
        <button class="tb-btn" id="btn-help" title="Справка (H)">${icon('help')}</button>
        <button class="tb-btn danger" id="btn-reset" title="Новый мир (R)">${icon('reset')}</button>
      </div>`;
    const sw = document.getElementById('speed-switch');
    const speeds = [
      { v: 0, label: icon('pause'), title: 'Пауза (Space)' },
      { v: 1, label: icon('play'), title: 'Обычная скорость (1)' },
      { v: 2, label: '×2', title: 'Ускорить ×2 (2)' },
      { v: 4, label: '×4', title: 'Ускорить ×4 (3)' },
      { v: 8, label: '×8', title: 'Ускорить ×8 (4)' },
    ];
    for (const s of speeds) {
      const b = document.createElement('button');
      b.className = 'speed-btn';
      b.dataset.v = s.v;
      b.title = s.title;
      b.innerHTML = s.label;
      b.addEventListener('click', () => this.setSpeed(s.v));
      sw.appendChild(b);
    }
    document.getElementById('btn-help').addEventListener('click', () => this.showHelp());
    document.getElementById('btn-reset').addEventListener('click', () => this.confirmReset());
  }

  setSpeed(v) {
    this.speed = v;
    this.paused = v === 0;
    document.querySelectorAll('.speed-btn').forEach((b) => b.classList.toggle('active', +b.dataset.v === v));
    this.onSpeedChange?.(v);
  }

  refreshTopbar() {
    const sim = this.sim; if (!sim) return;
    const wIcons = { clear: 'sun', cloudy: 'cloud', rain: 'rain', storm: 'storm' };
    const wName = { clear: 'Ясно', cloudy: 'Облачно', rain: sim.weather.snow ? 'Снег' : 'Дождь', storm: sim.weather.snow ? 'Метель' : 'Буря' };
    document.getElementById('tb-weather').innerHTML = icon(sim.weather.snow ? 'snow' : wIcons[sim.weather.kind], 18);
    document.getElementById('tb-day').textContent = sim.time.dayLabel();
    document.getElementById('tb-season').textContent = `${sim.time.seasonLabel()} · ${wName[sim.weather.kind]}`;
    document.getElementById('tb-clock').textContent = sim.time.hhmm();
    const sp = sim.world.stockpile;
    const pop = sim.alive().length;
    const mood = Math.round(sim.avgMood());
    document.getElementById('tb-stats').innerHTML = `
      ${chip('people', pop, 'Население')}
      ${chip('food', Math.round(sp.food), `Еда (склад), запас на ${Math.floor(sp.food / Math.max(1, pop) / 21)} д.`)}
      ${chip('wood', Math.round(sp.wood), 'Древесина')}
      ${chip('stone', Math.round(sp.stone), 'Камень')}
      ${chip('tools', Math.round(sp.tools), 'Инструменты')}
      ${chip('coin', Math.round(sp.money), 'Казна поселения')}
      ${chip('mood', mood + '%', 'Среднее настроение')}`;
  }

  // ================= JOURNAL =================
  refreshJournal(force = false) {
    const sim = this.sim; if (!sim) return;
    const entries = sim.journalEntries;
    if (!force && entries.length && entries[entries.length - 1].id === this._lastJournalId) return;
    const fresh = entries.filter((e) => e.id > this._lastJournalId);
    if (!force && !fresh.length) return;
    this._lastJournalId = entries.length ? entries[entries.length - 1].id : 0;
    const frag = document.createDocumentFragment();
    const list = entries.slice(-70);
    if (force) this.journalList.innerHTML = '';
    for (const e of list.slice(force ? 0 : Math.max(0, list.length - fresh.length))) {
      const li = document.createElement('li');
      li.className = `j-item cat-${e.cat}`;
      li.innerHTML = `
        <span class="j-ico" style="color:${CAT_COLORS[e.cat] || CAT_COLORS.info}">${icon(e.icon)}</span>
        <div class="j-body">
          <div class="j-text">${e.text}</div>
          <div class="j-meta">День ${e.day + 1} · ${e.time}</div>
        </div>`;
      frag.appendChild(li);
    }
    this.journalList.appendChild(frag);
    this.journalList.scrollTop = this.journalList.scrollHeight;
    while (this.journalList.children.length > 70) this.journalList.removeChild(this.journalList.firstChild);
  }

  _bindJournalToggle() {
    const head = document.getElementById('journal-head');
    head.addEventListener('click', () => {
      this._collapsed = !this._collapsed;
      document.getElementById('journal-box').classList.toggle('collapsed', this._collapsed);
    });
  }

  // ================= INSPECTOR =================
  select(hit) {
    if (!hit) { this.selected = null; this.inspector.classList.add('hidden'); return; }
    if (hit.kind === 'villager') this.selected = { kind: 'villager', id: hit.v.id };
    else if (hit.kind === 'building') this.selected = { kind: 'building', id: hit.b.id };
    else if (hit.kind === 'grave') {
      const g = hit.g;
      const who = this.sim ? [...this.sim.villagers.values()].find((v) => v.name === g.name) : null;
      this.showGrave(who, g);
      return;
    }
    this.inspector.classList.remove('hidden');
    this.refreshInspector(true);
  }

  selectVillagerById(id) {
    const v = this.sim.byId(id);
    if (v) { this.selected = { kind: 'villager', id }; this.inspector.classList.remove('hidden'); this.refreshInspector(true); }
  }

  refreshInspector(force = false) {
    if (!this.sim || !this.selected) return;
    const el = this.inspector;
    if (this.selected.kind === 'villager') {
      const v = this.sim.byId(this.selected.id);
      if (!v) { this.selected = null; el.classList.add('hidden'); return; }
      if (!v.alive) { this.renderDead(v); return; }
      el.innerHTML = this.villagerHTML(v);
      this._wireVillagerPanel(v);
      this._drawPortrait(v);
      this._drawMood(v);
    } else if (this.selected.kind === 'building') {
      const b = this.sim.world.buildings.find((x) => x.id === this.selected.id);
      if (!b) { this.selected = null; el.classList.add('hidden'); return; }
      el.innerHTML = this.buildingHTML(b);
    }
  }

  villagerHTML(v) {
    const sim = this.sim;
    const prof = PROFESSIONS[v.profession] || PROFESSIONS.none;
    const act = v.action;
    const prog = act && act.dur ? clamp(act.t / act.dur, 0, 1) : 0;
    const rels = [...v.rel.entries()]
      .map(([id, r]) => ({ o: sim.byId(id), r }))
      .filter(({ o }) => o)
      .sort((a, b) => (isFamily(v, b.o) ? 1 : 0) + Math.abs(b.r.a) - (isFamily(v, a.o) ? 1 : 0) - Math.abs(a.r.a))
      .slice(0, 8);
    const topSkills = Object.entries(v.skills).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const mems = v.memories.slice(-6).reverse();
    const logs = v.log.slice(-9).reverse();
    return `
    <div class="insp-head">
      <canvas class="portrait" id="portrait" width="76" height="76"></canvas>
      <div class="insp-title">
        <h2>${v.name} <span class="surname">${femSurname(v)}</span></h2>
        <div class="sub">${v.age} ${plural(v.age, 'год', 'года', 'лет')} · ${v.sex === 'm' ? 'мужчина' : 'женщина'} ·
          <span style="color:${prof.color}">${prof.label}</span></div>
        <div class="status">${icon('target', 13)} ${actionLabel(sim, v)}</div>
        ${act && act.dur ? `<div class="pbar thin"><i style="width:${prog * 100}%"></i></div>` : ''}
      </div>
      <button class="tb-btn insp-close" id="insp-close" title="Закрыть (Esc)">✕</button>
    </div>
    <div class="insp-scroll">
      <section>
        <h3>Потребности</h3>
        ${bar('Питание', v.needs.food, '#E0A458')}
        ${bar('Энергия', v.needs.energy, '#7FD1C0')}
        ${bar('Общение', v.needs.social, '#F2A3B3')}
        ${bar('Здоровье', v.health, v.sick ? '#F08D8D' : '#9CCB7A')}
        ${v.sick ? `<div class="note warn">${icon('cross', 13)} Болеет — нужен уход и отдых</div>` : ''}
      </section>
      <section>
        <h3>Характер</h3>
        <div class="traits-grid">
          ${Object.entries(TRAIT_LABELS).map(([k, lb]) => traitBar(lb, v.traits[k])).join('')}
        </div>
      </section>
      <section>
        <h3>Навыки</h3>
        ${topSkills.map(([k, s]) => bar(SKILL_LABELS[k] || k, s * 100, '#A78BFA')).join('')}
        <div class="mini muted">Монет: ${Math.round(v.money)}</div>
      </section>
      <section>
        <h3>Отношения</h3>
        ${rels.length ? rels.map(({ o, r }) => relRow(v, o, r)).join('') : '<div class="mini muted">Пока никого не знает</div>'}
      </section>
      <section>
        <h3>Память</h3>
        ${mems.length ? mems.map((m) => `<div class="mini mem"><span class="day">Д${m.day + 1}</span> ${m.text}</div>`).join('') : '<div class="mini muted">Ничего значимого</div>'}
      </section>
      <section>
        <h3>История жизни</h3>
        ${logs.length ? logs.map((l) => `<div class="mini mem"><span class="day">Д${l.day + 1}</span> ${l.text}</div>`).join('') : '<div class="mini muted">История только начинается</div>'}
      </section>
      <div class="insp-actions">
        <button class="btn" id="btn-follow">${icon('target', 13)} ${this.followOn ? 'Не следить' : 'Следить'}</button>
      </div>
    </div>`;
  }

  _wireVillagerPanel(v) {
    const close = document.getElementById('insp-close');
    close?.addEventListener('click', () => this.select(null));
    const follow = document.getElementById('btn-follow');
    follow?.addEventListener('click', () => {
      this.followOn = !this.followOn;
      this.onFollow?.(this.followOn ? v : null);
      follow.innerHTML = `${icon('target', 13)} ${this.followOn ? 'Не следить' : 'Следить'}`;
    });
    this.inspector.querySelectorAll('[data-vid]').forEach((el) => {
      el.addEventListener('click', () => this.selectVillagerById(+el.dataset.vid));
    });
  }

  _drawPortrait(v) {
    const c = document.getElementById('portrait');
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 76, 76);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.arc(38, 38, 37, 0, 6.28); ctx.fill();
    drawVillagerFigure(ctx, v, 38, 62, 3.6, performance.now() / 1000, false);
  }

  _drawMood() {}

  renderDead(v) {
    this.inspector.innerHTML = `
      <div class="insp-head">
        <div class="portrait dead">✝</div>
        <div class="insp-title">
          <h2>${v.name} <span class="surname">${femSurname(v)}</span></h2>
          <div class="sub">${v.deadCause || ''} · день ${v.deadDay + 1}</div>
        </div>
        <button class="tb-btn insp-close" id="insp-close">✕</button>
      </div>
      <div class="insp-scroll">
        <section><h3>История жизни</h3>
        ${v.log.slice(-12).reverse().map((l) => `<div class="mini mem"><span class="day">Д${l.day + 1}</span> ${l.text}</div>`).join('')}
        </section>
      </div>`;
    document.getElementById('insp-close')?.addEventListener('click', () => this.select(null));
  }

  showGrave(who, g) {
    this.inspector.classList.remove('hidden');
    this.inspector.innerHTML = `
      <div class="insp-head">
        <div class="portrait dead">✝</div>
        <div class="insp-title">
          <h2>${g.name}</h2>
          <div class="sub">Похоронен(а) на кладбище · день ${g.day + 1}</div>
        </div>
        <button class="tb-btn insp-close" id="insp-close">✕</button>
      </div>
      <div class="insp-scroll">
        <section><h3>История жизни</h3>
        ${who ? who.log.slice(-12).reverse().map((l) => `<div class="mini mem"><span class="day">Д${l.day + 1}</span> ${l.text}</div>`).join('') : '<div class="mini muted">Данные утрачены</div>'}
        </section>
      </div>`;
    document.getElementById('insp-close')?.addEventListener('click', () => this.select(null));
  }

  buildingHTML(b) {
    const sim = this.sim;
    const residents = sim.alive().filter((v) => v.homeId === b.id);
    const workers = sim.alive().filter((v) => v.workplaceId === b.id);
    const beds = b.def.beds || 0;
    return `
    <div class="insp-head">
      <div class="portrait building" style="background:${b.type === 'house' ? '#C96F4A33' : '#7FD1C022'}">${icon('hammer', 30)}</div>
      <div class="insp-title">
        <h2>${b.def.label}</h2>
        <div class="sub">Состояние: ${Math.round(b.condition)}%</div>
        ${b.condition < 100 ? bar('Прочность', b.condition, '#F08D8D') : ''}
      </div>
      <button class="tb-btn insp-close" id="insp-close">✕</button>
    </div>
    <div class="insp-scroll">
      ${beds ? `<section><h3>Жильцы (${residents.length}/${beds})</h3>
        ${residents.map((v) => `<div class="mini click" data-vid="${v.id}">${dot(v)} ${v.name} ${femSurname(v)}</div>`).join('') || '<div class="mini muted">Пусто</div>'}
      </section>` : ''}
      ${workers.length ? `<section><h3>Работают здесь</h3>
        ${workers.map((v) => `<div class="mini click" data-vid="${v.id}">${dot(v)} ${v.name} ${femSurname(v)}</div>`).join('')}
      </section>` : ''}
    </div>`;
  }

  // поселение — показывается, когда никто не выбран
  showSettlement() {
    if (!this.sim) return;
    this.selected = null;
    this.inspector.classList.remove('hidden');
    this.renderSettlement();
  }

  renderSettlement() {
    const sim = this.sim;
    const list = sim.alive();
    const sp = sim.world.stockpile;
    const profCount = {};
    for (const v of list) profCount[v.profession] = (profCount[v.profession] || 0) + 1;
    const children = list.filter((v) => v.age < 16).length;
    const cap = sim.world.foodCap();
    this.inspector.innerHTML = `
      <div class="insp-head settle">
        <div class="insp-title">
          <h2>${sim.world.name}</h2>
          <div class="sub">поселение · год ${sim.time.year()} · seed ${sim.seed}</div>
        </div>
        <button class="tb-btn insp-close" id="insp-close" title="Скрыть (Esc)">✕</button>
      </div>
      <div class="insp-scroll">
        <section>
          <h3>Население</h3>
          <div class="big-stat">${list.length} <span>жителей</span></div>
          <div class="mini muted">Взрослых ${list.length - children} · детей ${children} · мест в домах ${sim.world.bedsTotal()}</div>
          <canvas id="pop-spark" width="272" height="54"></canvas>
        </section>
        <section>
          <h3>Настроение</h3>
          ${bar('Среднее по поселению', sim.avgMood(), '#7FD1C0')}
        </section>
        <section>
          <h3>Склад (${Math.round(sp.food)}/${cap} еды)</h3>
          ${bar('Еда', (sp.food / cap) * 100, '#E0A458')}
          ${bar('Древесина', Math.min(100, sp.wood / 2), '#B07D4F')}
          ${bar('Камень', Math.min(100, sp.stone / 1.5), '#9AA3AD')}
          ${bar('Инструменты', Math.min(100, sp.tools * 10), '#7D8CA3')}
          <div class="mini muted">Казна: ${Math.round(sp.money)} монет</div>
          ${sim.world.project ? `<div class="note">${icon('hammer', 13)} Стройка: ${sim.world.project.def.label.toLowerCase()} — ${Math.round(sim.world.project.progress)}%</div>` : ''}
        </section>
        <section>
          <h3>Занятость</h3>
          ${Object.entries(profCount).filter(([p]) => p !== 'none').sort((a, b) => b[1] - a[1]).map(([p, n]) =>
            `<div class="mini"><span class="pdot" style="background:${PROFESSIONS[p].color}"></span>${PROFESSIONS[p].label} — ${n}</div>`).join('')}
        </section>
        <section>
          <h3>Жители</h3>
          <div class="roster">
            ${list.slice().sort((a, b) => a.age - b.age).map((v) => `
              <button class="roster-chip" data-vid="${v.id}">${dot(v)} ${v.name}</button>`).join('')}
          </div>
        </section>
      </div>`;
    document.getElementById('insp-close')?.addEventListener('click', () => this.inspector.classList.add('hidden'));
    this.inspector.querySelectorAll('[data-vid]').forEach((el) => {
      el.addEventListener('click', () => this.selectVillagerById(+el.dataset.vid));
    });
    this._drawSpark();
  }

  _drawSpark() {
    const c = document.getElementById('pop-spark');
    if (!c || !this.sim) return;
    const ctx = c.getContext('2d');
    const h = this.sim.stats.history;
    ctx.clearRect(0, 0, c.width, c.height);
    if (h.length < 2) {
      ctx.fillStyle = 'rgba(233,237,242,0.4)'; ctx.font = '11px system-ui';
      ctx.fillText('История накапливается…', 8, 28);
      return;
    }
    const maxPop = Math.max(...h.map((x) => x.pop), 10);
    const W2 = c.width - 4, H2 = c.height - 4;
    const line = (key, color, scale) => {
      ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.beginPath();
      h.forEach((p, i) => {
        const x = 2 + (i / (h.length - 1)) * W2;
        const y = 2 + H2 - (p[key] / scale) * H2;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.stroke();
    };
    line('pop', '#7FD1C0', maxPop * 1.1);
    line('mood', 'rgba(242,163,179,0.7)', 100);
    ctx.fillStyle = 'rgba(233,237,242,0.5)'; ctx.font = '10px system-ui';
    ctx.fillText(`население (макс. ${maxPop})`, 6, 10);
    ctx.fillText('настроение', 6, 22);
  }

  // ================= прочее =================
  showTooltip(hit, e) {
    if (!hit) { this.tooltip.classList.add('hidden'); return; }
    let html = '';
    if (hit.kind === 'villager') {
      const v = hit.v;
      const prof = PROFESSIONS[v.profession];
      html = `<b>${v.name} ${femSurname(v)}</b><span>${prof.label} · ${actionLabel(this.sim, v)}</span>`;
    } else if (hit.kind === 'building') {
      html = `<b>${hit.b.def.label}</b><span>состояние ${Math.round(hit.b.condition)}%</span>`;
    } else if (hit.kind === 'grave') {
      html = `<b>${hit.g.name}</b><span>память о жителе</span>`;
    }
    this.tooltip.innerHTML = html;
    this.tooltip.classList.remove('hidden');
    const x = Math.min(e.clientX + 14, window.innerWidth - 190);
    const y = Math.min(e.clientY + 14, window.innerHeight - 70);
    this.tooltip.style.left = `${x}px`;
    this.tooltip.style.top = `${y}px`;
  }

  confirmReset() {
    this.modal(`
      <h2>Начать новый мир?</h2>
      <p>Текущее поселение и все его жители исчезнут. Будет создан новый мир с новым зерном случайности.</p>
      <div class="modal-actions">
        <button class="btn" id="m-cancel">Остаться</button>
        <button class="btn primary" id="m-ok">Новый мир</button>
      </div>`, (root) => {
      document.getElementById('m-cancel').addEventListener('click', () => this.closeModal());
      document.getElementById('m-ok').addEventListener('click', () => { this.closeModal(); this.onReset?.(); });
    });
  }

  showHelp() {
    this.modal(`
      <h2>Как наблюдать</h2>
      <div class="help-grid">
        <div><b>Клик по жителю</b><span>карточка: потребности, характер, отношения, история</span></div>
        <div><b>Клик по зданию</b><span>жильцы и работники</span></div>
        <div><b>Перетаскивание</b><span>перемещение камеры</span></div>
        <div><b>Колесо мыши</b><span>зум</span></div>
        <div><b>Space / 1–4</b><span>пауза и скорость времени</span></div>
        <div><b>F</b><span>следить за выбранным жителем</span></div>
        <div><b>Esc</b><span>снять выбор</span></div>
        <div><b>R</b><span>новый мир</span></div>
      </div>
      <p class="muted small">Мир живёт сам: жители работают, дружат, ссорятся, строят, влюбляются, болеют и старятся. Сезоны сменяют друг друга, урожай зависит от времени года, а события рождаются из самой симуляции.</p>
      <div class="modal-actions"><button class="btn primary" id="m-ok">Наблюдать</button></div>`, (root) => {
      document.getElementById('m-ok').addEventListener('click', () => this.closeModal());
    });
  }

  showIntro(sim, onStart) {
    this.modal(`
      <div class="intro">
        <div class="intro-kicker">маленький мир</div>
        <h1>${sim.world.name}</h1>
        <p>Изолированное поселение на зелёном острове. Двадцать жителей со своими характерами и потребностями уже проснулись и начали жить самостоятельной жизнью — без сценария и подсказок.</p>
        <p class="muted small">Наблюдайте. Выбирайте жителей кликом. Меняйте скорость времени. Остальное сделает мир.</p>
        <div class="modal-actions"><button class="btn primary" id="m-ok">Начать наблюдение</button></div>
      </div>`, () => {
      document.getElementById('m-ok').addEventListener('click', () => { this.closeModal(); onStart?.(); });
    });
  }

  modal(html, wire) {
    this.modalRoot.innerHTML = `<div class="modal-backdrop"><div class="modal glass">${html}</div></div>`;
    this.modalRoot.classList.remove('hidden');
    wire?.(this.modalRoot);
  }
  closeModal() { this.modalRoot.classList.add('hidden'); this.modalRoot.innerHTML = ''; }

  toast(text) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    document.getElementById('toasts').appendChild(t);
    setTimeout(() => t.classList.add('on'), 30);
    setTimeout(() => { t.classList.remove('on'); setTimeout(() => t.remove(), 400); }, 3200);
  }

  _bindShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      switch (e.code) {
        case 'Space': e.preventDefault(); this.setSpeed(this.paused ? (this._lastSpeed || 1) : 0); if (!this.paused) this._lastSpeed = this.speed; break;
        case 'Digit1': this.setSpeed(1); break;
        case 'Digit2': this.setSpeed(2); break;
        case 'Digit3': this.setSpeed(4); break;
        case 'Digit4': this.setSpeed(8); break;
        case 'Escape':
          if (!this.modalRoot.classList.contains('hidden')) this.closeModal();
          else this.select(null);
          break;
        case 'KeyF': this.onFollowToggle?.(); break;
        case 'KeyH': this.showHelp(); break;
        case 'KeyR': this.confirmReset(); break;
      }
    });
  }

  refresh() {
    this.refreshTopbar();
    this.refreshJournal();
    if (this.selected) this.refreshInspector();
    else if (!this.inspector.classList.contains('hidden') && this._settleShown) this.renderSettlement();
  }
}

// ==== мелкие помощники разметки ====
function chip(ic, val, title) { return `<span class="tb-stat" title="${title}">${icon(ic)}<b>${val}</b></span>`; }
function bar(label, val, color) {
  const v = clamp(val, 0, 100);
  return `<div class="bar"><div class="bar-l"><span>${label}</span><b>${Math.round(v)}%</b></div><div class="pbar"><i style="width:${v}%;background:${color}"></i></div></div>`;
}
function traitBar(label, val) {
  const pct = clamp(val * 100, 4, 100);
  const interp = val < 0.34 ? '#8FB8D4' : val < 0.67 ? '#B8C9A0' : '#E0B070';
  return `<div class="tbar"><span>${label}</span><div class="pbar mini"><i style="width:${pct}%;background:${interp}"></i></div></div>`;
}
function relRow(v, o, r) {
  const label = relLabel(v, o);
  const pos = clamp((r.a + 100) / 2, 0, 100);
  const trustDots = Array.from({ length: 5 }, (_, i) => `<i class="${r.t > (i + 1) * 18 ? 'on' : ''}"></i>`).join('');
  return `<div class="rel-row click" data-vid="${o.id}">
    <div class="rel-head">
      ${dot(o)}<span class="rel-name">${o.name}</span>
      <span class="rel-kind ${r.a < -20 ? 'neg' : r.a > 45 ? 'pos' : ''}">${label}${o.alive ? '' : ' †'}</span>
    </div>
    <div class="rel-vis">
      <div class="affbar"><i style="left:${pos}%"></i></div>
      <div class="trust" title="Доверие">${trustDots}</div>
    </div>
  </div>`;
}
function dot(v) {
  const prof = PROFESSIONS[v.profession] || PROFESSIONS.none;
  return `<span class="pdot" style="background:${prof.color}"></span>`;
}
function femSurname(v) {
  if (v.sex !== 'f') return v.surname;
  const s = v.surname;
  if (/(ов|ев|ёв|ин|ын)$/.test(s)) return s + 'а';
  if (/ский$/.test(s)) return s.replace(/ский$/, 'ская');
  if (/ич$/.test(s)) return s;
  return s;
}
function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
