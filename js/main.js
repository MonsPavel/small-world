// Точка входа: игровой цикл, связь симуляции, рендера и UI

import { Simulation } from './sim/simulation.js';
import { Renderer } from './render/renderer.js';
import { UI } from './ui/ui.js';

const SPEED_MIN_PER_SEC = 12; // 1 сек реального времени = 12 сим-минут при ×1

const canvas = document.getElementById('world');
const renderer = new Renderer(canvas);
const ui = new UI();
let sim = new Simulation();

renderer.attach(sim);
ui.setSim(sim);
renderer.onSelect = (hit) => ui.select(hit);
renderer.onHover = (hit, e) => ui.showTooltip(hit, e);
ui.onFollow = (v) => { renderer.selected = v; renderer.follow = !!v; };
ui.onFollowToggle = () => {
  if (ui.selected?.kind === 'villager') {
    renderer.selected = sim.byId(ui.selected.id);
    renderer.follow = !renderer.follow;
    ui.followOn = renderer.follow;
    ui.refreshInspector(true);
  }
};
ui.onReset = () => resetWorld();

function resetWorld() {
  sim = new Simulation();
  window.__sim = sim;
  renderer.attach(sim);
  ui.setSim(sim);
  ui._settleShown = false;
  ui.toast(`Создан новый мир · ${sim.world.name} · seed ${sim.seed}`);
}

window.__sim = sim; // отладка/тесты

// кнопка «Поселение» — панель статистики
document.getElementById('btn-settle').addEventListener('click', () => {
  ui._settleShown = true;
  ui.showSettlement();
});

ui.setSpeed(1);
ui._settleShown = false;

// игровая пауза на время интро
let introPause = true;
ui.showIntro(sim, () => { introPause = false; });

let last = performance.now();
let uiAcc = 0;

function frame(now) {
  const dtReal = Math.min(0.1, (now - last) / 1000);
  last = now;
  const speed = ui.paused || introPause ? 0 : ui.speed;
  if (speed > 0) sim.update(dtReal * SPEED_MIN_PER_SEC * speed);
  renderer.draw(sim, now / 1000, dtReal);
  uiAcc += dtReal;
  if (uiAcc > 0.25) { uiAcc = 0; ui.refresh(); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { ui._lastSpeed = ui.speed; ui.setSpeed(0); }
});

// «обзор поселения» по двойному клику на пустое место
canvas.addEventListener('dblclick', (e) => {
  if (!renderer.pick(e.clientX, e.clientY)) {
    ui._settleShown = true;
    ui.showSettlement();
  }
});

export { };
