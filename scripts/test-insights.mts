// Tests de los insights (lib/insights.ts).
// Correr con: node --experimental-strip-types --import ./scripts/ts-extensionless.mjs scripts/test-insights.mts
import assert from "node:assert/strict";
import { computeInsights, MIN_ORDERS } from "../lib/insights.ts";

const combos = [{ min: 6, price: 31000 }, { min: 10, price: 51000 }, { min: 15, price: 75500 }];
const opts = { menu: ["Milanesa de Pollo Caprecce", "Pechuga Cordon Bleu con Puré", "Pasta Carbonara con Pollo", "Crepa de Espinaca"], combos, basePrice: 5500 };
let n = 0;
const order = (dishes: [string, number][], extra: Partial<Record<string, unknown>> = {}) => {
  n += 1;
  const dishesQty = dishes.reduce((s, d) => s + d[1], 0);
  return {
    id: `SANO-${n}`, seq: n, createdAt: "2026-10-05T15:00:00Z", windowId: "2026-10-01", customerName: `C${n % 6}`,
    dishes: dishes.map(([name, qty]) => ({ name, qty })), market: [], dishesQty, dishesTotal: 0, marketTotal: 0, total: 0,
    status: "pagado", ...extra,
  } as never;
};
const M = "Milanesa de Pollo Caprecce", P = "Pechuga Cordon Bleu con Puré", C = "Pasta Carbonara con Pollo", E = "Crepa de Espinaca";
const find = (r: ReturnType<typeof computeInsights>, id: string) => r.insights.find((i) => i.id === id);

// Poca muestra: no se da ningún consejo.
let r = computeInsights([order([[M, 6]])], opts);
assert.equal(r.enough, false);
assert.equal(r.insights.length, 0);
assert.equal(MIN_ORDERS, 10);

// Pedidos de evento no cuentan.
r = computeInsights(Array.from({ length: 12 }, () => order([[M, 4]], { eventId: "playa" })), opts);
assert.equal(r.enough, false);

// Escenario: 4 platos es lo más pedido y no tiene combo; varios quedan a 1 plato del combo 6.
const orders = [
  ...Array.from({ length: 6 }, () => order([[M, 2], [P, 2]])),          // 4 platos, pack M+P
  ...Array.from({ length: 4 }, () => order([[M, 3], [C, 2]])),          // 5 platos (a 1 del Combo 6)
  ...Array.from({ length: 3 }, () => order([[M, 6]])),                  // Combo 6
  order([[M, 6]], { extrasTotal: 2500, dishes: [{ name: M, qty: 6, extraQty: 2 }] }),
  order([[C, 1]]),
];
r = computeInsights(orders, opts);
assert.equal(r.enough, true);
const gap = find(r, "combo-gap")!;
assert.ok(gap.fact.includes("4 platos"), gap.fact);
assert.ok(gap.action.includes("Combo") === false && gap.action.includes("combo de 4 platos"));
const near = find(r, "combo-near")!;
assert.ok(near.fact.startsWith("4 pedidos"), near.fact);
assert.ok(near.fact.includes("Combo 6"));
const top = find(r, "combo-top")!;
assert.ok(top.fact.includes("platos sueltos"), top.fact); // 10 de 14 pedidos no llegan al Combo 6

// Cuando un combo gana, se nombra con su rango.
const r2 = computeInsights(
  [...Array.from({ length: 8 }, () => order([[M, 7]])), ...Array.from({ length: 3 }, () => order([[M, 2]]))],
  opts
);
assert.ok(find(r2, "combo-top")!.fact.startsWith("El Combo 6–9 platos es el más elegido"), find(r2, "combo-top")!.fact);
const pack = find(r, "pack-dishes")!;
assert.ok(pack.fact.includes("Milanesa de Pollo Caprecce + Pechuga Cordon Bleu con Puré"), pack.fact);
assert.ok(find(r, "market"));
assert.ok(find(r, "extra") === undefined, "menos de 3 pedidos con extra: no hay insight");
// Sin 4 platos distintos y 30 unidades no hay insights de platos más/menos pedidos.
assert.equal(find(r, "dish-top"), undefined);

// Platos más/menos pedidos con nombres unificados (variante con tilde y minúsculas cuentan como el mismo).
const many = [
  ...Array.from({ length: 6 }, () => order([[M, 5]])),
  ...Array.from({ length: 4 }, () => order([["milanesa de pollo caprese", 5]])),
  ...Array.from({ length: 3 }, () => order([[P, 3]])),
  order([[C, 1]]), order([[E, 1]]),
];
r = computeInsights(many, opts);
const dt = find(r, "dish-top")!;
assert.ok(dt.fact.startsWith("Milanesa de Pollo Caprecce"), dt.fact);
assert.ok(dt.fact.includes("50 unidades"), dt.fact); // 30 + 20 unidos
const low = find(r, "dish-low")!;
assert.ok(low.fact.includes("Crepa de Espinaca") && low.fact.includes("Pasta Carbonara con Pollo"));

// Proteína Extra con 3+ pedidos.
r = computeInsights(
  [...Array.from({ length: 8 }, () => order([[M, 2]])), ...Array.from({ length: 3 }, () => order([[M, 2]], { extrasTotal: 2500, dishes: [{ name: M, qty: 2, extraQty: 1 }] }))],
  opts
);
assert.ok(find(r, "extra")!.fact.includes("27%") || find(r, "extra")!.fact.includes("(3)"));

// Día dominante.
r = computeInsights(Array.from({ length: 12 }, () => order([[M, 2]], { windowId: "2026-10-01" })), opts); // jueves -> viernes
assert.ok(find(r, "day")!.fact.includes("viernes"));

console.log("insights: todos los tests OK");
