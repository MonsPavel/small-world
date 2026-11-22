// Изометрическая проекция 2:1

export const HW = 32, HH = 16; // половины размеров тайла

export function proj(wx, wy) { return { x: (wx - wy) * HW, y: (wx + wy) * HH }; }
export function unproj(sx, sy) { return { x: (sx / HW + sy / HH) / 2, y: (sy / HH - sx / HW) / 2 }; }

export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return `rgb(${r},${g},${b})`;
}
