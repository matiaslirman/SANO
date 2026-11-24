// Tests del evento Bistro Social Club (lib/bsc.ts): ventana horaria, validación, promo, cuentas y exportación.
// Correr con: node --experimental-strip-types --import ./scripts/ts-extensionless.mjs scripts/test-bsc.mts
import assert from "node:assert/strict";
import {
  courtesyOf, cortesiaLabel, cortesiaOptions, CORTESIA_ID,
  bscState, bscOpen, crLocalToIso, isoToCrLocal, crDateTimeLabel, crTime, checkBscOrder, applyPromo, accountKey,
  buildAccounts, eventTotals, accountsCsv, normalizeBsc, priceLabel,
  crDate, orderEdition, editionLabel, nextEditionPatch, slugId, moveItem, salesByHour, editionsSummary, LEGACY_EDITION,
} from "../lib/bsc.ts";
import { DEFAULT_BSC } from "../lib/defaults.ts";
import type { Order, OrderBscLine } from "../lib/types.ts";

const S = DEFAULT_BSC;

// ── Ventana: 00:00 CR del jueves 19 = 06:00Z; 08:00 CR del viernes 20 = 14:00Z ──
assert.equal(bscState(new Date("2026-11-19T05:59:59Z"), S), "before");
assert.equal(bscState(new Date("2026-11-19T06:00:00Z"), S), "open");
assert.equal(bscState(new Date("2026-11-20T13:59:59Z"), S), "open");
assert.equal(bscState(new Date("2026-11-20T14:00:00Z"), S), "ended");
assert.equal(bscState(new Date("2026-11-19T20:00:00Z"), { availableFrom: "basura", availableUntil: "basura" }), "ended"); // falla cerrado
assert.ok(bscOpen(new Date("2026-11-19T20:00:00Z"), S));
assert.ok(!bscOpen(new Date("2026-11-19T20:00:00Z"), { ...S, enabled: false }));
assert.ok(!bscOpen(new Date("2026-11-21T20:00:00Z"), S));

// ── Fechas del panel (hora CR) ──
assert.equal(crLocalToIso("2026-11-19T00:00"), "2026-11-19T00:00:00-06:00");
assert.equal(crLocalToIso("2026-02-30T10:00"), "");
assert.equal(crLocalToIso("basura"), "");
assert.equal(isoToCrLocal("2026-11-20T14:00:00Z"), "2026-11-20T08:00");
assert.equal(isoToCrLocal(crLocalToIso("2026-11-19T23:30")), "2026-11-19T23:30");
assert.equal(crDateTimeLabel("2026-11-19T19:30:00-06:00"), "JUE 19 NOV · 7:30 PM");
assert.equal(crDateTimeLabel("2026-11-19T19:30:00-06:00", true), "JUEVES 19 NOV · 7:30 PM");
assert.equal(crTime("2026-11-20T01:42:00Z"), "7:42 p. m.");
assert.equal(crTime("2026-11-19T14:05:00Z"), "8:05 a. m.");

// ── Validación del pedido ──
const NOW = new Date("2026-11-19T20:00:00Z");
const ok = (input: Record<string, unknown>) => {
  const c = checkBscOrder(input, S, NOW);
  assert.ok(c.ok, c.ok ? "" : c.error);
  return c.ok ? c : (undefined as never);
};
const err = (input: Record<string, unknown>, now = NOW) => {
  const c = checkBscOrder(input, S, now);
  assert.ok(!c.ok);
  return c.ok ? (undefined as never) : c;
};
assert.equal(err({ customerName: "Ana", lines: [{ id: "cerveza", qty: 1 }] }, new Date("2026-11-21T00:00:00Z")).code, "closed");
assert.equal(err({ customerName: "Ana", lines: [{ id: "cerveza", qty: 1 }] }, new Date("2026-11-19T05:00:00Z")).code, "closed");
assert.match(err({ customerName: "", lines: [{ id: "cerveza", qty: 1 }] }).error, /nombre/);
assert.match(err({ customerName: "Ana", whatsapp: "123", lines: [{ id: "cerveza", qty: 1 }] }).error, /teléfono/);
assert.match(err({ customerName: "Ana", lines: [] }).error, /vacío/);
assert.match(err({ customerName: "Ana", lines: [{ id: "cerveza", qty: -3 }] }).error, /vacío/); // cantidad negativa: se descarta
assert.match(err({ customerName: "Ana", lines: [{ id: "no-existe", qty: 1 }] }).error, /ya no está disponible/);
assert.equal(err({ customerName: "Ana", lines: [{ id: "gin-tonic", qty: 1 }] }).error, "Elegí la variante de Gin Tonic.");
assert.equal(err({ customerName: "Ana", lines: [{ id: "gin-tonic", variantId: "otra", qty: 1 }] }).error, "Elegí la variante de Gin Tonic.");
assert.match(err({ customerName: "Ana", lines: [{ id: "vino", qty: 1 }] }).error, /variante de Vino/);
const inactive = { ...S, items: S.items.map((i) => (i.id === "fondue" ? { ...i, active: false } : i)) };
assert.ok(!checkBscOrder({ customerName: "Ana", lines: [{ id: "fondue", qty: 1 }] }, inactive, NOW).ok);

const c1 = ok({ customerName: "  Ana  ", whatsapp: "8888 7777", table: "Mesa 4", lines: [
  { id: "gin-tonic", variantId: "maracuya", qty: 1, price: 1, unitPrice: 1, total: 1 }, // el precio del cliente se ignora
  { id: "gin-tonic", variantId: "maracuya", qty: 1 }, // repetida: se suma
  { id: "vino", variantId: "v4000", qty: 1 },
  { id: "hummus", qty: 999 }, // se limita a 20
] });
assert.equal(c1.name, "Ana");
assert.equal(c1.table, "Mesa 4");
assert.equal(c1.lines.length, 3);
assert.equal(c1.lines[0].qty, 2);
assert.equal(c1.lines[0].unitPrice, 5000);
assert.equal(c1.lines[1].unitPrice, 4000); // precio de la variante
assert.equal(c1.lines[2].qty, 20);
assert.equal(c1.total, 2 * 5000 + 4000 + 20 * 3000);
assert.ok(c1.lines[0].promoTrigger && !c1.lines[1].promoTrigger);
assert.equal(c1.lines[2].promoEligible, undefined); // la regla vieja (plato incluido) ya no se aplica a pedidos nuevos
assert.equal(priceLabel(S.items.find((i) => i.id === "vino")!), "₡3.500 / ₡4.000");
assert.equal(priceLabel(S.items.find((i) => i.id === "playero")!), "₡5.000");

// ── Promo ──
let seqN = 0;
const L = (id: string, name: string, qty: number, unit: number, flag?: "t" | "p", variantName?: string): OrderBscLine => ({
  id, cat: flag === "p" ? "picar" : flag === "t" ? "tragos" : "bebidas", name, qty, unitPrice: unit, subtotal: unit * qty,
  ...(variantName ? { variantId: variantName.toLowerCase(), variantName } : {}),
  ...(flag === "t" ? { promoTrigger: true } : {}),
  ...(flag === "p" ? { promoEligible: true } : {}),
});
const trago = (qty = 1) => L("gin-tonic", "Gin Tonic", qty, 5000, "t", "Clásico");
const playero = (qty = 1) => L("playero", "Playero", qty, 5000, "t");
const plato = (id = "guacamole", name = "Guacamole", qty = 1) => L(id, name, qty, 3000, "p");
const cerveza = (qty = 1) => L("cerveza", "Cerveza", qty, 2000);
const vino = () => L("vino", "Vino", 1, 3500, undefined, "v3500");
const O = (name: string, phone: string, at: string, lines: OrderBscLine[], status: "pendiente" | "pagado" = "pendiente", prep?: "recibido" | "preparando" | "entregado", table?: string): Order => {
  seqN += 1;
  return {
    id: `SANO-${300 + seqN}`, seq: 300 + seqN, createdAt: at, windowId: "bsc", windowLabel: "Bistro Social Club",
    customerName: name, whatsapp: phone, notes: "", dishes: [], market: [], dishesQty: 0, dishesTotal: 0, marketTotal: 0,
    total: lines.reduce((t, l) => t + l.subtotal, 0), status, completed: false, kind: "bsc", bsc: lines,
    ...(prep ? { bscPrep: prep } : {}), ...(table ? { bscTable: table } : {}),
  };
};
const T0 = "2026-11-20T01:00:00Z";
const T1 = "2026-11-20T01:10:00Z";
const T2 = "2026-11-20T01:20:00Z";
// trago antes que plato
let p = applyPromo([O("A", "", T0, [trago(), plato()])]);
assert.deepEqual([p.applied, p.amount, p.item?.name], [true, 3000, "Guacamole"]);
// plato antes que trago (en pedidos distintos): se aplica cuando llega el trago
const oPlato = O("A", "", T0, [plato("fondue", "Fondue de queso")]);
p = applyPromo([oPlato]);
assert.equal(p.applied, false); // todavía sin trago
p = applyPromo([oPlato, O("A", "", T1, [trago()])]);
assert.deepEqual([p.applied, p.amount, p.item?.orderId, p.item?.name], [true, 3000, oPlato.id, "Fondue de queso"]);
// varios tragos: sigue siendo UNA promo por persona
p = applyPromo([O("A", "", T0, [trago(3), playero(2), plato()])]);
assert.equal(p.amount, 3000);
// solo cerveza, o vino: no activan la promo
assert.equal(applyPromo([O("A", "", T0, [cerveza(4), plato()])]).applied, false);
assert.equal(applyPromo([O("A", "", T0, [vino(), plato()])]).applied, false);
// solo trago, o solo plato
assert.equal(applyPromo([O("A", "", T0, [trago()])]).applied, false);
assert.equal(applyPromo([O("A", "", T0, [plato()])]).applied, false);
// dos platos distintos: solo el primero sale incluido
p = applyPromo([O("A", "", T0, [trago(), plato("papitas-pinterest", "Papitas Pinterest"), plato("hummus", "Hummus")])]);
assert.deepEqual([p.amount, p.item?.name], [3000, "Papitas Pinterest"]);
// 2 unidades del mismo plato: se descuenta una sola
assert.equal(applyPromo([O("A", "", T0, [trago(), plato("guacamole", "Guacamole", 2)])]).amount, 3000);
// el «primero» es el más antiguo aunque el pedido llegue desordenado
const late = O("A", "", T2, [plato("hummus", "Hummus")]);
const early = O("A", "", T0, [plato("fondue", "Fondue de queso")]);
p = applyPromo([late, early, O("A", "", T1, [trago()])]);
assert.equal(p.item?.name, "Fondue de queso");

// ── Cuentas ──
assert.equal(accountKey({ customerName: "Ana", whatsapp: "8888-7777" }), "t:88887777");
assert.equal(accountKey({ customerName: "Otra", whatsapp: "+506 8888 7777" }), "t:88887777"); // mismo teléfono = misma persona
assert.equal(accountKey({ customerName: "María  Pérez", whatsapp: "" }), "n:maria perez");
assert.notEqual(accountKey({ customerName: "Ana", whatsapp: "" }), accountKey({ customerName: "Ana María", whatsapp: "" }));
assert.notEqual(accountKey({ customerName: "Ana", whatsapp: "88887777" }), accountKey({ customerName: "Ana", whatsapp: "88880000" }));

const a1 = O("Ana", "8888 7777", T0, [trago(), plato()], "pendiente", "entregado", "Mesa 4");
const a2 = O("Ana Gómez", "+506 88887777", T2, [cerveza(2)], "pendiente", "recibido");
const b1 = O("Beto", "", T1, [cerveza(1)], "pagado", "entregado");
const c0 = O("Carla", "7000 1111", T1, [vino(), plato()], "pagado", "entregado");
const not = { ...O("X", "", T0, [cerveza()]), kind: undefined } as Order; // un pedido que no es del evento se ignora
const acc = buildAccounts([a1, a2, b1, c0, not]);
assert.equal(acc.length, 3);
const ana = acc.find((a) => a.key === "t:88887777")!;
assert.equal(ana.orders.length, 2);
assert.equal(ana.name, "Ana Gómez"); // el nombre del pedido más reciente
assert.equal(ana.table, "Mesa 4");
assert.equal(ana.subtotal, 5000 + 3000 + 4000);
assert.equal(ana.promo.amount, 3000);
assert.equal(ana.total, 9000);
assert.equal(ana.paid, false);
assert.equal(ana.pendingPrep, 1);
const carla = acc.find((a) => a.name === "Carla")!;
assert.equal(carla.promo.applied, false); // vino no activa la promo
assert.equal(carla.total, 6500);
assert.ok(carla.paid);
assert.deepEqual(acc.map((a) => a.paid), [false, true, true]); // abiertas primero
// una cuenta pagada se reabre sola con un pedido nuevo
assert.equal(buildAccounts([{ ...a1, status: "pagado" }]).at(0)!.paid, true);
assert.equal(buildAccounts([{ ...a1, status: "pagado" }, { ...a2, status: "pendiente" }]).at(0)!.paid, false);

const tot = eventTotals(acc);
assert.equal(tot.cuentas, 3);
assert.equal(tot.abiertas, 1);
assert.equal(tot.ventas, 9000 + 2000 + 6500);
assert.equal(tot.cobrado, 2000 + 6500);
assert.equal(tot.porCobrar, 9000);
assert.equal(tot.promos, 1);
assert.equal(tot.promoMonto, 3000);
const cervezaRow = tot.items.find((i) => i.name === "Cerveza")!;
assert.deepEqual([cervezaRow.qty, cervezaRow.pending], [3, 2]); // 2 de Ana sin entregar; 1 de Beto entregada
assert.equal(tot.items[0].cat, "tragos"); // tragos primero, luego bebidas, luego picar

// ── CSV ──
const csv = accountsCsv(acc);
assert.ok(csv.startsWith("﻿"));
assert.ok(csv.includes("TOTAL DE LA CUENTA"));
assert.ok(csv.includes("Promo: Guacamole incluido"));
assert.ok(accountsCsv([O('Pepe "el rápido"', "", T0, [cerveza()])].flatMap((o) => buildAccounts([o]))).includes('"Pepe ""el rápido"""'));

// ── Configuración ──
const bad = normalizeBsc({ availableFrom: "2026-11-21T00:00:00-06:00", availableUntil: "2026-11-20T00:00:00-06:00" }, S);
assert.equal(bad.availableFrom, S.availableFrom); // ventana al revés → vuelve a la de por defecto
assert.equal(normalizeBsc({ enabled: false }, S).enabled, false);
assert.equal(normalizeBsc({}, S).items.length, S.items.length);
const dup = normalizeBsc({ items: [
  { id: "a", cat: "tragos", name: "A", price: 10, active: true, image: "../../etc/passwd" },
  { id: "a", cat: "tragos", name: "Repetido", price: 20, active: true },
  { id: "b", cat: "mala", name: "B", price: 1, active: true } as never,
] }, S);
assert.equal(dup.items.length, 1);
assert.equal(dup.items[0].image, undefined); // rutas de imagen raras se descartan
assert.equal(normalizeBsc({ items: [] }, S).items.length, S.items.length); // sin ítems válidos → carta por defecto

// ═══ Segunda edición, carta editable y tracking de ventas ═══════════════════════════════════

// ── Ediciones ──
assert.equal(crDate("2026-11-20T01:00:00Z"), "2026-11-19"); // 7 p. m. del jueves en CR sigue siendo jueves
assert.equal(crDate("2026-11-20T06:00:00Z"), "2026-11-20");
assert.equal(crDate("basura"), "");
assert.equal(LEGACY_EDITION, "2026-11-19");
assert.equal(orderEdition({}), "2026-11-19"); // los pedidos de la primera edición no traían edición
assert.equal(orderEdition({ bscEdition: "2026-11-26" }), "2026-11-26");
assert.equal(editionLabel("2026-11-26"), "Jueves 26 nov");
assert.equal(editionLabel("basura"), "basura");
assert.equal(S.editionId, "2026-11-19");
assert.equal(normalizeBsc({ startsAt: "2026-11-26T19:30:00-06:00", availableFrom: "2026-11-26T00:00:00-06:00", availableUntil: "2026-11-27T08:00:00-06:00" }, S).editionId, "2026-11-26"); // sin edición guardada: sale del evento
assert.equal(normalizeBsc({ editionId: "2026-12-03" }, S).editionId, "2026-12-03");
assert.equal(normalizeBsc({ editionId: "cualquier cosa" }, S).editionId, "2026-11-19");
const next = nextEditionPatch(S);
assert.deepEqual(next, {
  editionId: "2026-11-26",
  startsAt: "2026-11-26T19:30:00-06:00",
  availableFrom: "2026-11-26T00:00:00-06:00",
  availableUntil: "2026-11-27T08:00:00-06:00",
});
assert.equal(nextEditionPatch(next).editionId, "2026-12-03");
assert.ok(bscOpen(new Date("2026-11-26T20:00:00Z"), { ...S, ...next })); // abierto el jueves 26
assert.ok(!bscOpen(new Date("2026-11-27T14:00:00Z"), { ...S, ...next })); // cerrado el viernes 27 a las 08:00 CR

// ── Carta: ids y orden ──
assert.equal(slugId("Mojito de maracuyá", []), "mojito-de-maracuya");
assert.equal(slugId("Cerveza", ["cerveza"]), "cerveza-2");
assert.equal(slugId("Cerveza", ["cerveza", "cerveza-2"]), "cerveza-3");
assert.equal(slugId("¡¡¡", []), "item");
assert.ok(slugId("Un nombre larguísimo para un trago que no termina nunca jamás", []).length <= 24);
const ids = (items: typeof S.items) => items.map((i) => i.id);
const up = moveItem(S.items, "paloma", -1);
assert.deepEqual(ids(up).slice(0, 3), ["paloma", "gin-tonic", "playero"]);
assert.deepEqual(ids(moveItem(S.items, "gin-tonic", -1)), ids(S.items)); // ya es el primero de su categoría: no cruza a otra
assert.deepEqual(ids(moveItem(S.items, "playero", 1)), ids(S.items)); // el último de tragos no se mueve a bebidas
assert.equal(ids(moveItem(S.items, "cerveza", -1))[3], "cerveza"); // no sube a «tragos»
assert.equal(moveItem(S.items, "no-existe", 1), S.items);
const added = normalizeBsc({ items: [...S.items, { id: "mojito", cat: "tragos", name: "Mojito", price: 5500, promoTrigger: true, active: true, variants: [{ id: "clasico", name: "Clásico" }, { id: "fresa", name: "Fresa", price: 6000 }] }] }, S);
const mojito = added.items.find((i) => i.id === "mojito")!;
assert.equal(mojito.variants?.length, 2);
assert.equal(unitPriceOf(mojito, "fresa"), 6000);
assert.equal(unitPriceOf(mojito, "clasico"), 5500);
function unitPriceOf(item: (typeof S.items)[number], vid: string) {
  const c = checkBscOrder({ customerName: "A", lines: [{ id: item.id, variantId: vid, qty: 1 }] }, added, NOW);
  assert.ok(c.ok);
  return c.ok ? c.lines[0].unitPrice : 0;
}
assert.ok(checkBscOrder({ customerName: "A", lines: [{ id: "mojito", variantId: "fresa", qty: 1 }] }, added, NOW).ok); // un ítem nuevo ya se puede pedir
const removed = normalizeBsc({ items: S.items.filter((i) => i.id !== "fondue") }, S);
assert.ok(!checkBscOrder({ customerName: "A", lines: [{ id: "fondue", qty: 1 }] }, removed, NOW).ok); // y uno quitado ya no
assert.equal(removed.items.length, S.items.length - 1);

// ── Cobro por método y tracking ──
const PAY = (o: Order, pay: "efectivo" | "sinpe" | "tarjeta", at: string): Order => ({ ...o, status: "pagado", bscPay: pay, bscPaidAt: at });
const e1 = O("Uno", "7111 0001", T0, [trago(2), plato()], "pendiente", "entregado"); // 10.000 + 3.000, promo −3.000 → 10.000
const e2 = O("Dos", "7111 0002", T1, [cerveza(3), vino()], "pendiente", "preparando"); // 6.000 + 3.500 = 9.500
const e3 = O("Tres", "7111 0003", T2, [playero(1)], "pendiente", "recibido"); // 5.000
const e4 = O("Cuatro", "7111 0004", T2, [cerveza(1)], "pendiente", "entregado"); // 2.000
const orders2 = [
  PAY(e1, "efectivo", "2026-11-20T02:00:00Z"),
  PAY(e2, "sinpe", "2026-11-20T02:10:00Z"),
  e3,
  { ...e4, status: "pagado" as const }, // cobrada sin método
];
const acc2 = buildAccounts(orders2);
const tot2 = eventTotals(acc2);
assert.equal(tot2.ventas, 10000 + 9500 + 5000 + 2000);
assert.equal(tot2.bruto, 13000 + 9500 + 5000 + 2000);
assert.equal(tot2.bruto - tot2.promoMonto, tot2.ventas); // lo vendido cuadra con lo facturado
assert.equal(tot2.cobrado, 10000 + 9500 + 2000);
assert.equal(tot2.porCobrar, 5000);
assert.equal(tot2.cobrado + tot2.porCobrar, tot2.ventas);
assert.deepEqual(tot2.porMetodo, { efectivo: 10000, sinpe: 9500, tarjeta: 0, sin: 2000 });
assert.equal(Object.values(tot2.porMetodo).reduce((a, b) => a + b, 0), tot2.cobrado); // los métodos suman lo cobrado
const uno = acc2.find((a) => a.name === "Uno")!;
assert.deepEqual([uno.pay, uno.paidAt], ["efectivo", "2026-11-20T02:00:00Z"]);
assert.equal(acc2.find((a) => a.name === "Tres")!.pay, undefined);
// por ítem: lo pedido, lo que salió, lo que falta y lo facturado
const tr = tot2.items.find((i) => i.name === "Gin Tonic")!;
assert.deepEqual([tr.qty, tr.delivered, tr.pending, tr.revenue], [2, 2, 0, 10000]);
const cz = tot2.items.find((i) => i.name === "Cerveza")!;
assert.deepEqual([cz.qty, cz.delivered, cz.pending, cz.revenue], [4, 1, 3, 8000]); // 3 del pedido «preparando», 1 entregada
assert.equal(tot2.items.reduce((t, i) => t + i.revenue, 0), tot2.bruto); // los ingresos por ítem suman el bruto
assert.ok(tot2.items.every((i) => i.qty === i.delivered + i.pending));
// reabrir una cuenta pierde método y hora
const reopened = buildAccounts([PAY(e1, "efectivo", "2026-11-20T02:00:00Z"), { ...e1, id: "SANO-999", seq: 999, createdAt: T2, status: "pendiente" }]);
assert.equal(reopened[0].paid, false);
assert.equal(reopened[0].pay, undefined);

// ── Ventas por hora (la noche cruza la medianoche) ──
const h1 = O("H", "", "2026-11-20T01:30:00Z", [cerveza(1)]); // 7:30 p. m. CR
const h2 = O("H", "", "2026-11-20T01:50:00Z", [cerveza(2)]); // 7:50 p. m. CR
const h3 = O("H", "", "2026-11-20T03:10:00Z", [cerveza(1)]); // 9:10 p. m. CR
const h4 = O("H", "", "2026-11-20T06:15:00Z", [cerveza(5)]); // 12:15 a. m. CR (ya viernes)
const hours = salesByHour([h1, h2, h3, h4, { ...h1, kind: undefined } as Order]);
assert.deepEqual(hours.map((h) => h.label), ["7 p. m.", "8 p. m.", "9 p. m.", "10 p. m.", "11 p. m.", "12 a. m."]);
assert.deepEqual(hours.map((h) => h.orders), [2, 0, 1, 0, 0, 1]);
assert.equal(hours[0].bruto, 2000 + 4000);
assert.equal(hours.reduce((t, h) => t + h.bruto, 0), h1.total + h2.total + h3.total + h4.total);
assert.deepEqual(salesByHour([]), []);

// ── Resumen por edición ──
const ed2a = { ...O("Jueves2", "7222 0001", T1, [trago(1), plato()]), bscEdition: "2026-11-26" } as Order;
const sum = editionsSummary([...orders2, ed2a]);
assert.deepEqual(sum.map((e) => e.id), ["2026-11-26", "2026-11-19"]); // más reciente primero
assert.equal(sum[0].ventas, 5000); // trago + plato incluido por promo
assert.equal(sum[0].promoMonto, 3000);
assert.equal(sum[1].ventas, tot2.ventas);
assert.equal(sum[1].pedidos, 4);
// una edición no se mezcla con la otra en las cuentas
const same = [{ ...O("Ana", "7333 0001", T0, [cerveza()]), bscEdition: "2026-11-19" } as Order, { ...O("Ana", "7333 0001", T1, [cerveza()]), bscEdition: "2026-11-26" } as Order];
assert.equal(buildAccounts(same.filter((o) => orderEdition(o) === "2026-11-26")).length, 1);
assert.equal(buildAccounts(same.filter((o) => orderEdition(o) === "2026-11-26"))[0].orders.length, 1);

// ── CSV con origen y cobro ──
const csv2 = accountsCsv(acc2);
const head = csv2.replace("\uFEFF", "").split("\r\n")[0].split(";");
assert.deepEqual(head.slice(5, 6).concat(head.slice(13)), ["Origen", "Método de pago", "Cobrada a las"]);
assert.ok(csv2.includes("Efectivo") && csv2.includes("SINPE Móvil"));
assert.ok(accountsCsv(buildAccounts([{ ...e1, bscBy: "staff" } as Order])).includes(";Staff;"));
assert.ok(accountsCsv(buildAccounts([e1])).includes(";Cliente;"));

console.log("bsc (ediciones y tracking): todos los tests OK");

// ═══ Cortesía: 2 tragos → Opción 1 u Opción 2 (la da el restaurante) y carpaccio ═══════════════

// ── Carta: el carpaccio reemplaza al platito mixto ──
assert.ok(S.items.some((i) => i.id === "carpaccio-salmon" && i.name === "Carpaccio de Salmón con Reducción Balsámica" && i.image === "carpaccio-salmon.jpg" && i.price === 3000));
assert.ok(!S.items.some((i) => i.id === "platito-mixto"));
assert.equal(S.items.length, 10);
assert.ok(S.items.every((i) => !i.promoEligible)); // la regla vieja ya no está en la carta
assert.deepEqual(S.cortesia, { tragos: 2, options: [{ id: "1" }, { id: "2" }] });
// migración de lo ya guardado (producción): conserva posición, precio y visibilidad
const legacyItems = [
  ...S.items.filter((i) => i.id !== "carpaccio-salmon").slice(0, 8),
  { id: "platito-mixto", cat: "picar" as const, name: "Platito mixto", price: 3500, active: false, image: "platito.jpg", promoEligible: true },
  ...S.items.filter((i) => i.id === "hummus"),
];
const mig = normalizeBsc({ items: legacyItems }, S);
const at = mig.items.findIndex((i) => i.id === "carpaccio-salmon");
assert.equal(at, legacyItems.findIndex((i) => i.id === "platito-mixto")); // misma posición
assert.deepEqual([mig.items[at].price, mig.items[at].active, mig.items[at].image], [3500, false, "carpaccio-salmon.jpg"]);
assert.ok(!mig.items.some((i) => i.id === "platito-mixto"));
assert.ok(mig.items.every((i) => i.promoEligible === undefined));
assert.equal(normalizeBsc({ items: mig.items }, S).items.length, mig.items.length); // idempotente
const renamed = normalizeBsc({ items: legacyItems.map((i) => (i.id === "platito-mixto" ? { ...i, name: "Mi platito" } : i)) }, S);
assert.ok(renamed.items.some((i) => i.id === "platito-mixto")); // si el dueño ya lo renombró, no se toca

// ── Configuración de la cortesía ──
assert.deepEqual(normalizeBsc({}, S).cortesia, { tragos: 2, options: [{ id: "1" }, { id: "2" }] });
assert.equal(normalizeBsc({ cortesia: { tragos: 3, options: [] } }, S).cortesia.tragos, 3);
assert.equal(normalizeBsc({ cortesia: { tragos: 99, options: [] } }, S).cortesia.tragos, 10);
assert.equal(normalizeBsc({ cortesia: { tragos: 0, options: [] } }, S).cortesia.tragos, 2); // inválido → valor por defecto
const cdesc = normalizeBsc({ cortesia: { tragos: 2, options: [{ id: "1", desc: "Algo rico" }, { id: "9" as never }, { id: "2", desc: "x".repeat(300) }] } }, S).cortesia;
assert.equal(cdesc.options.length, 2); // siempre exactamente dos opciones
assert.deepEqual(cdesc.options.map((o) => o.id), ["1", "2"]);
assert.equal(cdesc.options[0].desc, "Algo rico");
assert.equal(cdesc.options[1].desc?.length, 120);
assert.deepEqual(cortesiaOptions(S), [{ id: "1", label: "Opción 1", desc: "" }, { id: "2", label: "Opción 2", desc: "" }]);
assert.equal(cortesiaLabel("2"), "Opción 2");

// ── courtesyOf: tragos de la casa y cortesía ya dada ──
const mk = (id: string, lines: OrderBscLine[]) => ({ id, bsc: lines });
const COR = (opt: string): OrderBscLine => ({ id: CORTESIA_ID, cat: "cortesia", name: `Cortesía · Opción ${opt}`, cortesia: opt, qty: 1, unitPrice: 0, subtotal: 0 });
assert.deepEqual(courtesyOf([], 2), { tragos: 0, qualifies: false });
assert.deepEqual(courtesyOf([mk("A", [trago(1)])], 2), { tragos: 1, qualifies: false });
assert.equal(courtesyOf([mk("A", [trago(1)]), mk("B", [playero(1)])], 2).qualifies, true); // 2 tragos en pedidos distintos
assert.equal(courtesyOf([mk("A", [trago(2)])], 3).qualifies, false); // el mínimo es configurable
assert.equal(courtesyOf([mk("A", [cerveza(5), vino()])], 2).tragos, 0); // cerveza y vino no cuentan
assert.deepEqual(courtesyOf([mk("A", [trago(2)]), mk("B", [COR("2")])], 2).given, { orderId: "B", optionId: "2" });
assert.equal(courtesyOf([mk("A", [COR("1")])], 2).tragos, 0); // la cortesía misma no cuenta como trago

// ── checkBscOrder con cortesía ──
const lineIds = (lines: { id: string }[]) => lines.map((l) => l.id);
const gin = (q: number) => ({ id: "gin-tonic", variantId: "clasico", qty: q });
// 2 tragos en el mismo pedido + Opción 1
const k1 = ok({ customerName: "Ana", lines: [gin(2), { id: "cortesia", optionId: "1" }] });
assert.equal(k1.total, 10000); // la cortesía no suma nada
const kl = k1.lines[k1.lines.length - 1];
assert.deepEqual([kl.id, kl.cat, kl.name, kl.cortesia, kl.qty, kl.unitPrice, kl.subtotal], ["cortesia", "cortesia", "Cortesía · Opción 1", "1", 1, 0, 0]);
assert.deepEqual(lineIds(k1.lines), ["gin-tonic", "cortesia"]);
// 1 trago solo: no alcanza
assert.match(err({ customerName: "Ana", lines: [gin(1), { id: "cortesia", optionId: "1" }] }).error, /hacen falta 2 tragos.*llevás 1/);
// cerveza y vino no cuentan
assert.match(err({ customerName: "Ana", lines: [{ id: "cerveza", qty: 4 }, { id: "vino", variantId: "v3500", qty: 2 }, { id: "cortesia", optionId: "2" }] }).error, /llevás 0/);
// 1 trago ya pedido antes + 1 ahora = 2 → alcanza
const before1 = [mk("SANO-1", [trago(1)])];
const k2 = checkBscOrder({ customerName: "Ana", lines: [{ id: "playero", qty: 1 }, { id: "cortesia", optionId: "2" }] }, S, NOW, { accountOrders: before1 });
assert.ok(k2.ok && k2.lines.at(-1)!.name === "Cortesía · Opción 2");
// pedido solo de cortesía (el staff la entrega cuando ya calificó en pedidos anteriores)
const k3 = checkBscOrder({ customerName: "Ana", lines: [{ id: "cortesia", optionId: "1" }] }, S, NOW, { accountOrders: [mk("SANO-1", [trago(2)])] });
assert.ok(k3.ok && k3.total === 0 && k3.lines.length === 1);
// ya la recibió: una por persona
const dupC = checkBscOrder({ customerName: "Ana", lines: [gin(2), { id: "cortesia", optionId: "1" }] }, S, NOW, { accountOrders: [mk("SANO-1", [trago(2), COR("2")])] });
assert.ok(!dupC.ok && /Ya recibiste tu cortesía/.test(dupC.error));
// opción inexistente, y dos cortesías en un pedido
assert.match(err({ customerName: "Ana", lines: [gin(2), { id: "cortesia", optionId: "3" }] }).error, /Opción 1 o la Opción 2/);
assert.match(err({ customerName: "Ana", lines: [gin(2), { id: "cortesia", optionId: "1" }, { id: "cortesia", optionId: "2" }] }).error, /una por persona/);
assert.match(err({ customerName: "Ana", lines: [gin(2), { id: "cortesia" }] }).error, /Opción 1 o la Opción 2/); // sin opción
// el mínimo configurable (3 tragos)
const s3 = { ...S, cortesia: { ...S.cortesia, tragos: 3 } };
assert.ok(!checkBscOrder({ customerName: "A", lines: [gin(2), { id: "cortesia", optionId: "1" }] }, s3, NOW).ok);
assert.ok(checkBscOrder({ customerName: "A", lines: [gin(3), { id: "cortesia", optionId: "1" }] }, s3, NOW).ok);
// una cortesía sin nada más NO califica
assert.match(err({ customerName: "Ana", lines: [{ id: "cortesia", optionId: "1" }] }).error, /llevás 0/);
// el cliente no puede ponerle precio a la cortesía ni usar el id como ítem de la carta
const k4 = ok({ customerName: "Ana", lines: [gin(2), { id: "cortesia", optionId: "1", qty: 5, price: 9999, unitPrice: 9999 }] });
assert.equal(k4.total, 10000);
// los platos ya no regalan nada por sí mismos (regla vieja desactivada para pedidos nuevos)
const k5 = ok({ customerName: "Ana", lines: [gin(3), { id: "guacamole", qty: 1 }] });
assert.equal(applyPromo([{ id: "x", seq: 1, createdAt: T0, bsc: k5.lines }]).applied, false);

// ── Cuentas y totales con cortesías ──
const cA = O("Cortes Uno", "7444 0001", T0, [trago(2), COR("1")], "pendiente", "entregado"); // la cortesía se entregó
const cB = O("Cortes Dos", "7444 0002", T1, [playero(2), COR("2")], "pendiente", "recibido"); // falta entregarla
// las líneas de un pedido NUEVO salen de checkBscOrder (sin la marca vieja de «plato incluido»)
const cC = O("Cortes Tres", "7444 0003", T2, ok({ customerName: "Cortes Tres", lines: [gin(1), { id: "guacamole", qty: 1 }] }).lines, "pendiente", "entregado");
const accC = buildAccounts([cA, cB, cC]);
const one = accC.find((a) => a.name === "Cortes Uno")!;
assert.deepEqual([one.tragos, one.cortesia], [2, { orderId: cA.id, optionId: "1" }]);
assert.equal(one.total, 10000); // la cortesía no cambia el total de la cuenta
assert.equal(accC.find((a) => a.name === "Cortes Tres")!.cortesia, undefined);
assert.equal(accC.find((a) => a.name === "Cortes Tres")!.promo.applied, false); // nada se regala por el plato
const tC = eventTotals(accC);
assert.deepEqual(tC.cortesias, { total: 2, pendientes: 1, porOpcion: { "1": { total: 1, pendientes: 0 }, "2": { total: 1, pendientes: 1 } } });
assert.ok(!tC.items.some((i) => i.name.startsWith("Cortesía"))); // no aparecen como ítems vendidos
assert.equal(tC.bruto, 10000 + 10000 + 5000 + 3000);
assert.equal(tC.bruto - tC.promoMonto, tC.ventas); // sigue cuadrando
assert.ok(accountsCsv(accC).includes("Cortesía · Opción 1") && accountsCsv(accC).includes("Cortesía · Opción 2"));
// la primera edición no cambia: sus pedidos con la regla vieja conservan su descuento
const old1 = O("Vieja", "7555 0001", T0, [trago(1), plato()]);
assert.equal(buildAccounts([old1])[0].promo.amount, 3000);

console.log("bsc (cortesía y carpaccio): todos los tests OK");

console.log("bsc: todos los tests OK");
