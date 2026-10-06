import type { ComboTier, Settings } from "./types";

/** Nombre del extra de porción de proteína (público deportista). */
export const PROTEIN_EXTRA_LABEL = "Proteína Extra";

/**
 * Precio de "Proteína Extra" por plato del menú actual. Cada plato usa su precio
 * propio si lo tiene; si no, el general. 0 = ese plato no ofrece el extra.
 */
export function resolveExtraPrices(
  s: Pick<Settings, "menu" | "proteinExtraPrice" | "proteinExtraByDish">
): Record<string, number> {
  const base = Math.max(0, Math.floor(s.proteinExtraPrice || 0));
  const by = s.proteinExtraByDish || {};
  const out: Record<string, number> = {};
  for (const dish of s.menu) {
    const own = by[dish];
    out[dish] = typeof own === "number" && own >= 0 ? Math.floor(own) : base;
  }
  return out;
}

/**
 * Precio de los Platos Listos según la cantidad TOTAL de unidades
 * (sumando todas las opciones/sabores elegidos).
 *
 * Regla: se aplica el combo más alto cuyo mínimo sea <= cantidad, y las
 * unidades excedentes se cobran al precio base. Si la cantidad no llega
 * a ningún combo, todo va a precio base.
 *
 * Ej. con base 5500 y combos [{6,31000},{10,51000},{15,75500}]:
 *   5 -> 27500 | 6 -> 31000 | 9 -> 47500 | 10 -> 51000 | 14 -> 72500 | 16 -> 81000
 *
 * Es fácil de ajustar: cambiá `basePrice` y `combos` en la configuración (admin).
 */
export function priceForDishes(
  qty: number,
  basePrice: number,
  combos: ComboTier[]
): number {
  if (qty <= 0) return 0;
  const sorted = [...combos].sort((a, b) => a.min - b.min);
  let best: ComboTier | null = null;
  for (const c of sorted) {
    if (qty >= c.min) best = c;
  }
  if (!best) return qty * basePrice;
  return best.price + (qty - best.min) * basePrice;
}

/** Etiqueta del combo aplicado, o "" si no hay combo. */
export function comboLabel(qty: number, combos: ComboTier[]): string {
  const sorted = [...combos].sort((a, b) => b.min - a.min);
  for (const c of sorted) {
    if (qty >= c.min) return `Combo ${c.min}`;
  }
  return "";
}

/** Próximo combo por alcanzar (para el empujón de upsell), o null. */
export function nextCombo(qty: number, combos: ComboTier[]): ComboTier | null {
  const sorted = [...combos].sort((a, b) => a.min - b.min);
  for (const c of sorted) {
    if (qty < c.min) return c;
  }
  return null;
}

/** Ahorro frente a pagar todo a precio base. */
export function savingsVsBase(
  qty: number,
  basePrice: number,
  combos: ComboTier[]
): number {
  return qty * basePrice - priceForDishes(qty, basePrice, combos);
}
