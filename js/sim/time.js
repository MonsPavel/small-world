// Календарь: сим-минуты → дни, сезоны, годы. 1 день = 1440 мин, сезон = 8 дней.

export const MIN_PER_DAY = 1440;
export const SEASON_DAYS = 8;
export const DAYS_PER_YEAR = SEASON_DAYS * 4;

import { SEASON_LABELS } from './defs.js';

export class TimeSystem {
  constructor(startMin = 6 * 60) { this.total = startMin; }
  advance(m) { this.total += m; }

  dayIndex() { return Math.floor(this.total / MIN_PER_DAY); }
  minuteOfDay() { return this.total % MIN_PER_DAY; }
  hour() { return this.minuteOfDay() / 60; }
  seasonIndex() { return Math.floor(this.dayIndex() / SEASON_DAYS) % 4; }
  year() { return Math.floor(this.dayIndex() / DAYS_PER_YEAR) + 1; }
  dayOfSeason() { return (this.dayIndex() % SEASON_DAYS) + 1; }

  dayLabel() { return `День ${this.dayIndex() + 1}`; }
  seasonLabel() { return `${SEASON_LABELS[this.seasonIndex()]}, год ${this.year()}`; }
  hhmm() {
    const m = Math.floor(this.minuteOfDay());
    const h = Math.floor(m / 60), mm = m % 60;
    return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }
  isNight() { const h = this.hour(); return h >= 22 || h < 6; }
  minutesUntil(hourTarget) {
    const cur = this.hour();
    let d = hourTarget - cur;
    if (d <= 0) d += 24;
    return d * 60;
  }
}
