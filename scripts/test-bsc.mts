// Tests del evento Bistro Social Club (lib/bsc.ts): ventana horaria, validación, promo, cuentas y exportación.
// Correr con: node --experimental-strip-types --import ./scripts/ts-extensionless.mjs scripts/test-bsc.mts
import assert from "node:assert/strict";
import {
  bscState, bscOpen, crLocalToIso, isoToCrLocal, crDateTimeLabel, crTime, checkBscOrder, applyPromo, accountKey,
  buildAccounts, eventTotals, accountsCsv, normalizeBsc, priceLabel,
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
assert.ok(c1.lines[0].promoTrigger && !c1.lines[1].promoTrigger && c1.lines[2].promoEligible);
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

console.log("bsc: todos los tests OK");
