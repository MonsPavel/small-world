// Общие определения: профессии, здания, товары, черты характера

export const PROFESSIONS = {
  farmer:    { label: 'Фермер',      color: '#8FBF5A', skill: 'farming',     workplace: 'farm' },
  woodcutter:{ label: 'Лесоруб',     color: '#C08A4E', skill: 'woodcutting', workplace: 'forest' },
  miner:     { label: 'Шахтёр',      color: '#98A2AE', skill: 'mining',     workplace: 'quarry' },
  artisan:   { label: 'Ремесленник', color: '#D9A03F', skill: 'crafting',   workplace: 'workshop' },
  fisher:    { label: 'Рыбак',       color: '#5BB8C9', skill: 'fishing',    workplace: 'pier' },
  trader:    { label: 'Торговец',    color: '#C97B7B', skill: 'trading',    workplace: 'market' },
  builder:   { label: 'Строитель',   color: '#A78BFA', skill: 'building',   workplace: null },
  none:      { label: 'Ребёнок',     color: '#E4D8C3', skill: null,         workplace: null },
  retired:   { label: 'На пенсии',   color: '#C6BFB0', skill: null,         workplace: null },
};

export const SKILL_LABELS = {
  farming: 'Земледелие', woodcutting: 'Лесозаготовка', mining: 'Горное дело',
  crafting: 'Ремесло', fishing: 'Рыбная ловля', trading: 'Торговля',
  building: 'Строительство', social: 'Общение',
};

export const TRAIT_LABELS = {
  soc: 'Общительность', dil: 'Трудолюбие', cur: 'Любопытство',
  agg: 'Вспыльчивость', gen: 'Щедрость', cau: 'Осторожность',
};

export const GOODS = {
  food:  { label: 'Еда',        icon: 'food' },
  wood:  { label: 'Древесина',  icon: 'wood' },
  stone: { label: 'Камень',     icon: 'stone' },
  tools: { label: 'Инструменты',icon: 'tools' },
  money: { label: 'Монеты',     icon: 'coin' },
};

export const BUILDING_DEFS = {
  house:    { label: 'Дом',         w: 2, h: 2, beds: 4, cost: { wood: 55, stone: 25 }, work: 100 },
  farm:     { label: 'Ферма',       w: 4, h: 4, beds: 0, cost: { wood: 35, stone: 10 }, work: 80 },
  workshop: { label: 'Мастерская',  w: 2, h: 2, beds: 0, cost: { wood: 50, stone: 35 }, work: 110 },
  market:   { label: 'Рынок',       w: 2, h: 2, beds: 0, cost: { wood: 40, stone: 15 }, work: 80 },
  granary:  { label: 'Амбар',       w: 2, h: 2, beds: 0, foodCap: 500, cost: { wood: 45, stone: 30 }, work: 90 },
};

export const SEASON_LABELS = ['Весна', 'Лето', 'Осень', 'Зима'];
export const SEASON_KEYS = ['spring', 'summer', 'autumn', 'winter'];

// форма глагола по полу жителя
export const vform = (v, m, f) => (v.sex === 'f' ? f : m);

// Экономические константы
export const ECO = {
  MEAL_FOOD: 6,              // еды за приём пищи
  MEAL_SATIETY: 55,          // восстановление сытости
  DECAY: { food: 4.2, energy: 3.6, social: 3.1 }, // в час
  SLEEP_REGEN: 13.5,         // энергия в час сна
  WAGE: 3,                   // монет за рабочую смену
  PRICES: { food: 1.4, wood: 1.0, stone: 1.2, tools: 8 },
  TARGETS: { food: 150, wood: 90, stone: 60, tools: 6 },
  SEASON_FARM: [1.15, 1.3, 1.0, 0.65],
  SEASON_FISH: [1.0, 1.1, 1.0, 0.8],
  FOOD_CAP_BASE: 300,
};

export const WALK_TILES_PER_MIN = 0.18; // скорость пешком, тайлов в сим-минуту
