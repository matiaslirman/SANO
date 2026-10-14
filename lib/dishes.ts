/**
 * Unir platos que son el mismo pero se escribieron distinto (tilde, mayúscula,
 * un error de ortografía), para que el ranking cuente el plato real.
 *
 * Conservador a propósito: solo se unen nombres casi idénticos. Un plato con una
 * palabra distinta ("Pasta Alfredo" vs "Pasta Carbonara") o con partes de más
 * ("Pasta Corta Carbonara" vs "Pasta Carbonara") NO se une.
 */

const STOP = new Set(["de", "del", "la", "el", "los", "las", "con", "y", "en", "al", "a", "e"]);

/** Minúsculas, sin tildes ni signos, sin conectores ("de", "con"…) y con espacios colapsados. */
export function normalizeDish(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !STOP.has(w))
    .join(" ");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

const digits = (s: string) => (s.match(/\d+/g) || []).join(",");

/** Umbral de similitud (1 = idéntico). 0.9 ≈ hasta 2 letras distintas en un nombre de ~25. */
export const DISH_SIMILARITY = 0.9;
const MIN_LEN_FUZZY = 12; // nombres cortos solo se unen si son idénticos (ya normalizados)

/** ¿Son el mismo plato escrito distinto? Entrada: nombres ya normalizados. */
export function sameDish(a: string, b: string): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (digits(a) !== digits(b)) return false; // "Combo 1" ≠ "Combo 2"
  if (Math.min(a.length, b.length) < MIN_LEN_FUZZY) return false;
  const sim = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
  return sim >= DISH_SIMILARITY;
}

export interface DishGroup {
  name: string;        // nombre que se muestra
  qty: number;         // unidades sumadas
  variants: string[];  // otras escrituras que se unieron (sin el nombre mostrado)
}

/**
 * Agrupa platos por parecido. El nombre mostrado es el que está en el menú actual
 * (`preferred`) si hay uno, y si no el más pedido. Cada nombre se compara contra el
 * nombre mostrado del grupo (no en cadena), así no se arrastran uniones por transitividad.
 */
export function groupDishes(
  items: { name: string; qty: number }[],
  preferred: string[] = []
): DishGroup[] {
  const totals = new Map<string, number>();
  for (const it of items) {
    const n = (it.name || "").trim();
    if (!n || it.qty <= 0) continue;
    totals.set(n, (totals.get(n) || 0) + it.qty);
  }
  const pref = new Set(preferred.map((p) => p.trim()));
  // los del menú actual primero (mandan el nombre); luego el más pedido
  const names = [...totals.keys()].sort(
    (a, b) => Number(pref.has(b)) - Number(pref.has(a)) || (totals.get(b)! - totals.get(a)!) || a.localeCompare(b)
  );

  const groups: { name: string; key: string; qty: number; variants: string[] }[] = [];
  for (const n of names) {
    const key = normalizeDish(n);
    const g = groups.find((x) => sameDish(x.key, key));
    if (g) {
      g.qty += totals.get(n)!;
      g.variants.push(n);
    } else {
      groups.push({ name: n, key, qty: totals.get(n)!, variants: [] });
    }
  }
  return groups
    .map((g) => ({ name: g.name, qty: g.qty, variants: g.variants }))
    .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name));
}
