import type { ComboTier, Order } from "./types";
import { canonicalMap, groupDishes } from "./dishes";
import { crc } from "./format";

/**
 * Insights accionables a partir de los pedidos reales. Reglas simples y deterministas
 * (nada inventado): cada insight muestra el dato que lo respalda y solo aparece si hay
 * muestra suficiente. Los pedidos de evento privado no entran (son compras en bloque
 * y distorsionan tamaños y combos).
 */

export const MIN_ORDERS = 10; // por debajo de esto no se da ningún consejo

export interface Insight {
  id: string;
  icon: string;
  fact: string;   // lo que muestran los datos
  action: string; // qué podrías hacer
}

export interface InsightsResult {
  insights: Insight[];
  orders: number; // pedidos considerados
  enough: boolean;
}

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

function tierIndex(qty: number, tiers: ComboTier[]): number {
  let idx = -1;
  tiers.forEach((t, i) => {
    if (qty >= t.min) idx = i;
  });
  return idx;
}

export function computeInsights(
  allOrders: Order[],
  opts: { menu: string[]; combos: ComboTier[]; basePrice: number }
): InsightsResult {
  const orders = allOrders.filter((o) => !o.eventId);
  const withDishes = orders.filter((o) => o.dishesQty > 0);
  const out: Insight[] = [];
  if (orders.length < MIN_ORDERS) return { insights: out, orders: orders.length, enough: false };

  const tiers = [...opts.combos].sort((a, b) => a.min - b.min);
  const base = opts.basePrice;

  // ── 1) Combo más vendido ──
  if (tiers.length && withDishes.length >= MIN_ORDERS) {
    const counts = new Array(tiers.length + 1).fill(0); // índice 0 = sueltos (sin combo)
    for (const o of withDishes) counts[tierIndex(o.dishesQty, tiers) + 1] += 1;
    const top = counts.indexOf(Math.max(...counts));
    const share = pct(counts[top], withDishes.length);
    if (top === 0) {
      out.push({
        id: "combo-top",
        icon: "🧮",
        fact: `La mayoría de los pedidos (${share}%, ${counts[0]} de ${withDishes.length}) son de platos sueltos: no llegan a ningún combo.`,
        action: `Revisá si el mínimo del primer combo (${tiers[0].min} platos) está muy alto para tus clientes.`,
      });
    } else {
      const t = tiers[top - 1];
      const next = tiers[top];
      out.push({
        id: "combo-top",
        icon: "🏆",
        fact: `El Combo ${t.min}${next ? `–${next.min - 1}` : "+"} platos es el más elegido: ${plural(counts[top], "pedido", "pedidos")} de ${withDishes.length} (${share}%).`,
        action: "Es tu combo estrella: mantené su precio y destacalo en el hero y en el menú.",
      });
    }
  }

  // ── 2) Tamaño de pedido frecuente sin combo ──
  if (tiers.length && withDishes.length >= MIN_ORDERS) {
    const bySize = new Map<number, number>();
    for (const o of withDishes) bySize.set(o.dishesQty, (bySize.get(o.dishesQty) || 0) + 1);
    const [size, count] = [...bySize.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
    if (size < tiers[0].min && size >= 2 && count >= 3 && pct(count, withDishes.length) >= 25) {
      const avgDisc = tiers.reduce((s, t) => s + (1 - t.price / (t.min * base)), 0) / tiers.length;
      const ref = Math.round((size * base * (1 - avgDisc)) / 50) * 50;
      out.push({
        id: "combo-gap",
        icon: "🆕",
        fact: `El tamaño más pedido es de ${size} platos (${count} de ${withDishes.length} pedidos, ${pct(count, withDishes.length)}%) y hoy no tiene combo: pagan ${crc(size * base)} a precio base.`,
        action: `Probá un combo de ${size} platos. Con el descuento promedio de tus combos actuales (~${Math.round(avgDisc * 100)}%) quedaría cerca de ${crc(ref)} (solo una referencia: el precio lo definís vos).`,
      });
    }
  }

  // ── 3) Pedidos a 1 plato de un combo ──
  if (tiers.length && withDishes.length >= MIN_ORDERS) {
    let best: { t: ComboTier; n: number } | null = null;
    for (const t of tiers) {
      const n = withDishes.filter((o) => o.dishesQty === t.min - 1).length;
      if (!best || n > best.n) best = { t, n };
    }
    if (best && best.n >= 3 && pct(best.n, withDishes.length) >= 10) {
      out.push({
        id: "combo-near",
        icon: "🎯",
        fact: `${plural(best.n, "pedido", "pedidos")} (${pct(best.n, withDishes.length)}%) quedaron a 1 plato del Combo ${best.t.min}.`,
        action: `Hay ventas a un paso: el checkout ya avisa cuánto falta, pero podés mostrarlo antes (en cada plato) o probar bajar el mínimo a ${best.t.min - 1}.`,
      });
    }
  }

  // ── 4) Platos: cuál mantener y cuáles rotar (con nombres unificados) ──
  const dishItems = withDishes.flatMap((o) => o.dishes.map((d) => ({ name: d.name, qty: d.qty })));
  const groups = groupDishes(dishItems, opts.menu);
  const totalUnits = groups.reduce((s, g) => s + g.qty, 0);
  if (groups.length >= 4 && totalUnits >= 30) {
    const top = groups[0];
    out.push({
      id: "dish-top",
      icon: "⭐",
      fact: `${top.name} es el plato más pedido: ${top.qty} unidades (${pct(top.qty, totalUnits)}% de los platos).`,
      action: "Mantenelo fijo en el menú o usalo como plato ancla de un paquete.",
    });
    const avg = totalUnits / groups.length;
    const low = groups.filter((g) => g.qty <= avg * 0.5).slice(-3).reverse();
    if (low.length) {
      out.push({
        id: "dish-low",
        icon: "🔄",
        fact: `Los menos pedidos: ${low.map((g) => `${g.name} (${g.qty} ud)`).join(", ")}.`,
        action: "Candidatos a rotar o reformular. Ojo: un plato que estuvo pocas semanas en el menú vende menos solo por eso.",
      });
    }
  }

  // ── 5) Paquetes: platos que se piden juntos / plato + Market ──
  const canon = canonicalMap(dishItems, opts.menu);
  const pairCount = new Map<string, number>();
  let multi = 0;
  for (const o of withDishes) {
    const names = [...new Set(o.dishes.map((d) => canon.get(d.name) || d.name))].sort();
    if (names.length < 2) continue;
    multi += 1;
    for (let i = 0; i < names.length; i++)
      for (let j = i + 1; j < names.length; j++) {
        const k = `${names[i]}\u0000${names[j]}`;
        pairCount.set(k, (pairCount.get(k) || 0) + 1);
      }
  }
  if (multi >= MIN_ORDERS) {
    const top = [...pairCount.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 3 && pct(top[1], multi) >= 15) {
      const [a, b] = top[0].split("\u0000");
      out.push({
        id: "pack-dishes",
        icon: "📦",
        fact: `${a} + ${b} se piden juntos en ${plural(top[1], "pedido", "pedidos")} (${pct(top[1], multi)}% de los pedidos con 2 o más platos distintos).`,
        action: `Armá un paquete “${a} + ${b}” o mostralos juntos en el menú.`,
      });
    }
  }
  const dishOrders = new Map<string, number>();
  const dmPair = new Map<string, number>();
  for (const o of withDishes) {
    const ds = [...new Set(o.dishes.map((d) => canon.get(d.name) || d.name))];
    const ms = [...new Set(o.market.map((m) => m.name))];
    for (const d of ds) {
      dishOrders.set(d, (dishOrders.get(d) || 0) + 1);
      for (const m of ms) dmPair.set(`${d}\u0000${m}`, (dmPair.get(`${d}\u0000${m}`) || 0) + 1);
    }
  }
  const dmTop = [...dmPair.entries()]
    .map(([k, n]) => ({ k, n, share: n / (dishOrders.get(k.split("\u0000")[0]) || 1) }))
    .filter((x) => x.n >= 3 && x.share >= 0.2)
    .sort((a, b) => b.n - a.n || b.share - a.share)[0];
  if (dmTop) {
    const [d, m] = dmTop.k.split("\u0000");
    out.push({
      id: "pack-market",
      icon: "🧺",
      fact: `El ${Math.round(dmTop.share * 100)}% de los pedidos con ${d} también llevan ${m} (${plural(dmTop.n, "pedido", "pedidos")}).`,
      action: `Ofrecé “${d} + ${m}” como paquete o sugerilo en el checkout cuando elijan ese plato.`,
    });
  }

  // ── 6) Sano Market ──
  const withMarket = orders.filter((o) => o.market.length > 0);
  {
    const mk = new Map<string, number>();
    for (const o of withMarket) for (const m of o.market) mk.set(m.name, (mk.get(m.name) || 0) + m.qty);
    const topM = [...mk.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([n]) => n);
    const share = pct(withMarket.length, orders.length);
    out.push({
      id: "market",
      icon: "🛒",
      fact: `El ${share}% de los pedidos suma Sano Market (${withMarket.length} de ${orders.length})${topM.length ? `. Lo más pedido: ${topM.join(" y ")}` : ""}.`,
      action:
        share < 30
          ? "Hay espacio para crecer: probá destacar esos productos en el checkout o dentro de un paquete con un plato."
          : "Está funcionando: mantené esos productos visibles en el checkout.",
    });
  }

  // ── 7) Proteína Extra ──
  const withExtra = orders.filter((o) => (o.extrasTotal || 0) > 0);
  if (withExtra.length >= 3) {
    const byDish = new Map<string, number>();
    for (const o of withExtra)
      for (const d of o.dishes) if (d.extraQty) byDish.set(canon.get(d.name) || d.name, (byDish.get(canon.get(d.name) || d.name) || 0) + d.extraQty);
    const [topD, topN] = [...byDish.entries()].sort((a, b) => b[1] - a[1])[0];
    out.push({
      id: "extra",
      icon: "💪",
      fact: `${pct(withExtra.length, orders.length)}% de los pedidos llevan Proteína Extra (${withExtra.length}). Donde más se usa: ${topD} (${topN} ud).`,
      action: "Es una buena palanca para el público deportista: probá ofrecerla como “versión Pro” de ese plato.",
    });
  }

  // ── 8) Viernes vs lunes ──
  {
    const days = { Viernes: 0, Lunes: 0 };
    for (const o of orders) {
      const dow = new Date(`${o.windowId}T12:00:00Z`).getUTCDay();
      if (dow === 4) days.Viernes += 1;
      else if (dow === 6) days.Lunes += 1;
    }
    const tot = days.Viernes + days.Lunes;
    const [day, n] = (Object.entries(days) as [string, number][]).sort((a, b) => b[1] - a[1])[0];
    if (tot >= MIN_ORDERS && pct(n, tot) >= 65) {
      const other = day === "Viernes" ? "lunes" : "viernes";
      out.push({
        id: "day",
        icon: "📅",
        fact: `El ${pct(n, tot)}% de los pedidos son para el ${day.toLowerCase()} (${n} de ${tot}).`,
        action: `Reforzá producción y cupos para el ${day.toLowerCase()} y probá un recordatorio o promo para impulsar el ${other}.`,
      });
    }
  }

  // ── 9) Clientes que repiten (por nombre) ──
  {
    const byName = new Map<string, number>();
    for (const o of orders) {
      const k = norm(o.customerName || "");
      if (k) byName.set(k, (byName.get(k) || 0) + 1);
    }
    const customers = byName.size;
    const repeat = [...byName.values()].filter((n) => n >= 2).length;
    if (customers >= 5) {
      out.push({
        id: "repeat",
        icon: "🔁",
        fact: `${repeat} de ${customers} clientes (${pct(repeat, customers)}%) ya volvieron a pedir (se cuentan por nombre).`,
        action: "Son tu base: cuidalos con la tarjeta de cliente frecuente y avisales cuando salga el menú nuevo.",
      });
    }
  }

  return { insights: out, orders: orders.length, enough: true };
}
