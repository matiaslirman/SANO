// Tests de Viaje Sano (lib/viaje.ts): cuentas de porciones, recomendación de pack, fecha mínima en hora CR,
// validación del pedido (el servidor es la autoridad de precios), cambio de sabor y mensajes de WhatsApp.
// Correr con: node --experimental-strip-types --import ./scripts/ts-extensionless.mjs scripts/test-viaje.mts
import assert from "node:assert/strict";
import {
  trays, portions, cartTotal, traysTotal, perPortion, neededTrays, packAvailable, recommendPack, giftFor, nextReward,
  crToday, addDays, minPickupDate, isRealDate, isValidPickup, clampLead, longDate, shortDate,
  swapOptions, swapOne, isPackEdited, checkViajeOrder, cartOfLines, orderTrays,
  viajeOrderMessage, confirmPickupMessage, viajeAlertMessage, waNumber, normalizeViaje, MAX_QTY_PER_LINE, MAX_LINES,
} from "../lib/viaje.ts";
import { DEFAULT_VIAJE } from "../lib/defaults.ts";
import type { Order, ViajeSettings } from "../lib/types.ts";

const S: ViajeSettings = JSON.parse(JSON.stringify(DEFAULT_VIAJE));
const items = S.items;
const pack = (id: string) => S.packs.find((p) => p.id === id)!;

// ── Porciones: solo las bandejas de platos fuertes cuentan ──
assert.equal(trays({ l1: 2, c1: 1 }, items), 3);
assert.equal(portions({ l1: 2, c1: 1 }, items), 12);
assert.equal(trays({ l1: 1, a1: 3, r1: 2, s1: 5 }, items), 1, "acompañamientos, proteínas y salsas no cuentan como bandejas");
assert.equal(portions({ r1: 2, s1: 5 }, items), 0);
assert.equal(trays({ zzz: 4 }, items), 0, "un id desconocido no suma");
assert.equal(trays({ l1: 0, l2: -3 }, items), 0);

// ── Precios: el pack Familia son 2 lasañas de ₡18.000 + pechugas ₡20.000 + chaufa ₡15.000 ──
assert.equal(cartTotal(pack("familia").items, items), 71000);
assert.equal(traysTotal(pack("familia").items, items), 71000);
assert.equal(portions(pack("familia").items, items), 16);
assert.equal(perPortion(pack("familia").items, items), 4438); // 71.000 / 16 = 4.437,5
assert.equal(perPortion(pack("escapada").items, items), 4125); // 33.000 / 8
assert.equal(cartTotal(pack("semana").items, items), 138000);
assert.equal(perPortion(pack("semana").items, items), 4313);
// Con extras, el precio por porción de plato fuerte NO se infla.
const conExtras = { ...pack("escapada").items, r1: 1, s1: 1 };
assert.equal(cartTotal(conExtras, items), 33000 + 6500 + 2500);
assert.equal(perPortion(conExtras, items), 4125);
assert.equal(perPortion({ r1: 2 }, items), 0, "sin platos fuertes no hay precio por porción");

// ── Calculadora ──
assert.equal(neededTrays(4, 2, 2), 4);   // 4 personas, 4 comidas = 16 porciones = 4 bandejas
assert.equal(neededTrays(3, 3, 3), 5);   // 18 porciones → 4,5 → 5
assert.equal(neededTrays(1, 1, 0), 1);   // 1 porción también pide una bandeja
assert.equal(neededTrays(4, 0, 0), 0);
assert.equal(neededTrays(0, 2, 2), 0);
assert.equal(neededTrays(4, 6, 6), 12);

// ── Recomendación de pack (2, 4 y 8 bandejas) ──
const rec = (n: number) => recommendPack(n, S.packs, items)!;
assert.equal(recommendPack(0, S.packs, items), null);
assert.deepEqual([rec(1).pack.id, rec(1).diff, rec(1).base], ["escapada", 1, false]);
assert.deepEqual([rec(2).pack.id, rec(2).diff], ["escapada", 0]);
assert.deepEqual([rec(3).pack.id, rec(3).diff], ["familia", 1], "con empate prefiere el que sobra, no el que falta");
assert.deepEqual([rec(4).pack.id, rec(4).diff], ["familia", 0]);
assert.deepEqual([rec(5).pack.id, rec(5).diff, rec(5).base], ["familia", -1, false]);
assert.deepEqual([rec(6).pack.id, rec(6).diff, rec(6).base], ["familia", -2, true], "a 2 de distancia solo sirve de base");
assert.deepEqual([rec(7).pack.id, rec(7).diff, rec(7).base], ["semana", 1, false]);
assert.deepEqual([rec(8).pack.id, rec(8).diff], ["semana", 0]);
assert.deepEqual([rec(9).pack.id, rec(9).diff, rec(9).base], ["semana", -1, false]);
assert.deepEqual([rec(12).pack.id, rec(12).diff, rec(12).base], ["semana", -4, true]);
// Un pack con un producto apagado no se ofrece.
const apagado = JSON.parse(JSON.stringify(S)) as ViajeSettings;
apagado.items.find((i) => i.id === "p1")!.active = false;
assert.equal(packAvailable(apagado.packs.find((p) => p.id === "familia")!, apagado.items), false);
assert.equal(packAvailable(apagado.packs.find((p) => p.id === "escapada")!, apagado.items), true);
assert.notEqual(recommendPack(4, apagado.packs, apagado.items)!.pack.id, "familia");
assert.equal(recommendPack(4, [], items), null);

// ── Regalo por volumen ──
assert.equal(giftFor(59999, S.rewards), null);
assert.equal(giftFor(60000, S.rewards)!.text, "1 salsa de regalo");
assert.equal(giftFor(119999, S.rewards)!.text, "1 salsa de regalo");
assert.equal(giftFor(120000, S.rewards)!.text, "2 salsas de regalo");
assert.equal(nextReward(0, S.rewards)!.at, 60000);
assert.equal(nextReward(60000, S.rewards)!.at, 120000);
assert.equal(nextReward(120000, S.rewards), null);
assert.equal(giftFor(99999, [{ at: 0, text: "x" }]), null, "monto 0 = apagado");
assert.equal(giftFor(99999, [{ at: 5, text: "  " }]), null, "sin texto = apagado");

// ── Fecha mínima en hora de Costa Rica (UTC-6) ──
assert.equal(crToday(new Date("2026-11-18T05:59:00Z")), "2026-11-17", "las 23:59 CR todavía es el 17");
assert.equal(crToday(new Date("2026-11-18T06:00:00Z")), "2026-11-18", "a las 06:00 UTC cambia el día en CR");
assert.equal(crToday(new Date("2026-12-31T23:30:00Z")), "2026-12-31");
assert.equal(crToday(new Date("2027-01-01T05:30:00Z")), "2026-12-31", "cruce de año");
assert.equal(addDays("2026-11-28", 5), "2026-12-03");
assert.equal(addDays("2026-12-30", 3), "2027-01-02");
assert.equal(addDays("2028-02-27", 2), "2028-02-29", "año bisiesto");
assert.equal(minPickupDate(new Date("2026-11-18T18:00:00Z"), 7), "2026-11-25");
assert.equal(minPickupDate(new Date("2026-11-18T05:00:00Z"), 7), "2026-11-24", "madrugada UTC = noche del día anterior en CR");
assert.equal(clampLead(0), 1);
assert.equal(clampLead(99), 21);
assert.equal(clampLead("x"), 7);
assert.equal(clampLead(3.9), 3);
const now = new Date("2026-11-18T18:00:00Z");
assert.equal(isValidPickup("2026-11-25", now, 7), true);
assert.equal(isValidPickup("2026-11-24", now, 7), false, "un día antes del mínimo");
assert.equal(isValidPickup("2026-11-18", now, 7), false);
assert.equal(isValidPickup("2026-02-30", now, 7), false, "fecha que no existe");
assert.equal(isValidPickup("25/11/2026", now, 7), false);
assert.equal(isValidPickup("", now, 7), false);
assert.equal(isValidPickup(null, now, 7), false);
assert.equal(isValidPickup("2031-01-01", now, 7), false, "demasiado lejos");
assert.equal(isValidPickup("2026-11-21", now, 3), true, "con 3 días de anticipación");
assert.equal(isRealDate("2028-02-29"), true);
assert.equal(isRealDate("2027-02-29"), false);
assert.equal(longDate("2026-12-20"), "domingo 20 de diciembre");
assert.equal(shortDate("2026-12-20"), "dom 20 dic");
assert.equal(longDate("basura"), "");

// ── Cambiar sabor ──
const opts = swapOptions("l1", items);
assert.equal(opts.length, 6, "las otras 6 lasañas");
assert.ok(opts.every((o) => o.item.cat === "las" && o.item.id !== "l1"));
assert.equal(opts.find((o) => o.item.id === "l7")!.diff, -4000);
assert.equal(opts.find((o) => o.item.id === "l2")!.diff, 0);
assert.equal(swapOptions("zzz", items).length, 0);
const sinTrufada = JSON.parse(JSON.stringify(items)) as typeof items;
sinTrufada.find((i) => i.id === "l4")!.active = false;
assert.equal(swapOptions("l1", sinTrufada).some((o) => o.item.id === "l4"), false, "no ofrece productos apagados");
assert.deepEqual(swapOne({ l1: 1, c1: 1 }, "l1", "l2"), { l2: 1, c1: 1 });
assert.deepEqual(swapOne({ l1: 2 }, "l1", "l2"), { l1: 1, l2: 1 });
assert.deepEqual(swapOne({ l1: 1, l2: 1 }, "l1", "l2"), { l2: 2 });
assert.equal(isPackEdited(pack("familia").items, pack("familia")), false);
assert.equal(isPackEdited(swapOne(pack("familia").items, "l1", "l3"), pack("familia")), true);
assert.equal(isPackEdited({ ...pack("familia").items, s1: 1 }, pack("familia")), true);

// ── Pedido: lo valida y lo arma el servidor ──
const base = { customerName: "María Fernández", whatsapp: "8811 2233", notes: "sin cebolla", pickupDate: "2026-11-25", lines: [{ id: "l1", qty: 1 }, { id: "l2", qty: 1 }, { id: "p1", qty: 1 }, { id: "c1", qty: 1 }] };
const ok = checkViajeOrder(base, S, now);
assert.equal(ok.ok, true);
if (ok.ok) {
  assert.equal(ok.total, 71000);
  assert.equal(ok.lines.length, 4);
  assert.equal(ok.lines[0].cat, "las", "ordenado por categoría");
  assert.equal(ok.lines.find((l) => l.id === "p1")!.unitPrice, 20000);
  assert.equal(ok.gift!.text, "1 salsa de regalo");
  assert.equal(ok.whatsapp, "8811 2233");
}
// El cliente no puede fijar precios, aunque lo intente.
const tramposo = checkViajeOrder({ ...base, lines: [{ id: "l1", qty: 1, price: 1, unitPrice: 1, subtotal: 1 }], total: 1 } as never, S, now);
assert.equal(tramposo.ok && tramposo.total, 18000);
// Reglas
const err = (input: object) => { const r = checkViajeOrder(input as never, S, now); return r.ok ? "" : r.error; };
assert.match(err({ ...base, customerName: "   " }), /nombre/i);
assert.match(err({ ...base, customerName: undefined }), /nombre/i);
assert.match(err({ ...base, pickupDate: undefined }), /día de retiro/i);
assert.match(err({ ...base, pickupDate: "2026-11-20" }), /7 días de anticipación.*martes 24 de noviembre|miércoles 25 de noviembre/);
assert.match(err({ ...base, pickupDate: "2026-13-45" }), /día de retiro/i);
assert.match(err({ ...base, lines: [] }), /vacío/i);
assert.match(err({ ...base, lines: "no" }), /vacío/i);
assert.match(err({ ...base, lines: [{ id: "l1", qty: 0 }] }), /vacío/i);
assert.match(err({ ...base, lines: [{ id: "l1", qty: -2 }] }), /vacío/i);
assert.match(err({ ...base, lines: [{ id: "nope", qty: 1 }] }), /ya no está disponible/i);
assert.match(err({ ...base, lines: Array.from({ length: MAX_LINES + 1 }, () => ({ id: "l1", qty: 1 })) }), /demasiados/i);
const apag = JSON.parse(JSON.stringify(S)) as ViajeSettings;
apag.items.find((i) => i.id === "l1")!.active = false;
assert.match((checkViajeOrder(base, apag, now) as { error: string }).error, /ya no está disponible/i, "un producto apagado no se puede pedir");
// Cantidades: se suman las repetidas y se topan.
const rep = checkViajeOrder({ ...base, lines: [{ id: "l1", qty: 2 }, { id: "l1", qty: 3 }] }, S, now);
assert.equal(rep.ok && rep.lines.length, 1);
assert.equal(rep.ok && rep.lines[0].qty, 5);
const tope = checkViajeOrder({ ...base, lines: [{ id: "l1", qty: 999 }] }, S, now);
assert.equal(tope.ok && tope.lines[0].qty, MAX_QTY_PER_LINE);
const frac = checkViajeOrder({ ...base, lines: [{ id: "l1", qty: 2.9 }] }, S, now);
assert.equal(frac.ok && frac.lines[0].qty, 2);
// Texto: se recorta
const largo = checkViajeOrder({ ...base, customerName: "x".repeat(300), notes: "n".repeat(900) }, S, now);
assert.equal(largo.ok && largo.name.length, 80);
assert.equal(largo.ok && largo.notes.length, 500);
// El pack solo se guarda si existe
assert.equal(checkViajeOrder({ ...base, packId: "familia" }, S, now).ok && (checkViajeOrder({ ...base, packId: "familia" }, S, now) as { packId?: string }).packId, "familia");
assert.equal((checkViajeOrder({ ...base, packId: "inventado" }, S, now) as { packId?: string }).packId, undefined);
// Anticipación configurable
const s3 = { ...S, leadDays: 3 };
assert.equal(checkViajeOrder({ ...base, pickupDate: "2026-11-21" }, s3, now).ok, true);
assert.equal(checkViajeOrder({ ...base, pickupDate: "2026-11-20" }, s3, now).ok, false);

// ── Pedido guardado → carrito y bandejas ──
if (ok.ok) {
  assert.deepEqual(cartOfLines(ok.lines), { l1: 1, l2: 1, p1: 1, c1: 1 });
  assert.equal(orderTrays(ok.lines), 4);
}
assert.equal(orderTrays([{ id: "r1", cat: "pro", name: "x", qty: 3, unitPrice: 1, subtotal: 3 }]), 0);

// ── Mensajes ──
const pedido: Order = {
  id: "SANO-236", seq: 236, createdAt: "2026-11-18T18:00:00.000Z", windowId: "viaje", windowLabel: "Viaje Sano",
  customerName: "María Fernández", whatsapp: "8811 2233", notes: "sin cebolla", dishes: [], market: [], dishesQty: 0, dishesTotal: 0, marketTotal: 0,
  total: 71000, status: "pendiente", kind: "viaje", pickupDate: "2026-12-20", viajeGift: "1 salsa de regalo",
  viaje: ok.ok ? ok.lines : [],
};
const msg = viajeOrderMessage(pedido);
assert.match(msg, /VIAJE SANO/);
assert.match(msg, /\*Orden SANO-236\* · María Fernández/);
assert.match(msg, /domingo 20 de diciembre/);
assert.match(msg, /\*LASAÑAS\*/);
assert.match(msg, /x1 {2}Lasaña de pollo \(4 porciones\) — ₡18\.000/);
assert.match(msg, /Platos fuertes: 16 porciones \(4 almuerzos o cenas para 4 personas\)/);
assert.match(msg, /\*TOTAL: ₡71\.000\*/);
assert.match(msg, /🎁 1 salsa de regalo/);
assert.match(msg, /📝 sin cebolla/);
const conf = confirmPickupMessage(pedido);
assert.match(conf, /Hola María!/);
assert.match(conf, /SANO-236/);
assert.match(conf, /domingo 20 de diciembre/);
assert.match(conf, /hielera/);
assert.match(viajeAlertMessage(), /Viaje Sano/);
assert.equal(waNumber("8811 2233"), "50688112233");
assert.equal(waNumber("+506 8811-2233"), "50688112233");
assert.equal(waNumber("123"), "");
assert.equal(waNumber(undefined), "");

// ── Configuración: se sanea lo que llega del panel ──
const n1 = normalizeViaje({ estado: "raro" as never, leadDays: 999, fecha: "  el 1 de dic  " }, DEFAULT_VIAJE);
assert.equal(n1.estado, "pronto", "estado inválido → el de por defecto");
assert.equal(n1.leadDays, 21);
assert.equal(n1.fecha, "el 1 de dic");
assert.equal(n1.items.length, DEFAULT_VIAJE.items.length, "sin lista de productos usa los de por defecto");
const n2 = normalizeViaje({ items: [{ id: "x", cat: "las", name: "Lasaña X", price: -5.7 as never, active: true }, { id: "y", cat: "zzz" as never, name: "malo", price: 1, active: true }], packs: [{ id: "p", name: "P", items: { x: 2, fantasma: 1, y: 0 } }, { id: "vacio", name: "V", items: { fantasma: 1 } }] }, DEFAULT_VIAJE);
assert.equal(n2.items.length, 1, "descarta categorías inválidas");
assert.equal(n2.items[0].price, 0, "precio negativo → 0");
assert.deepEqual(n2.packs.map((p) => p.id), ["p"], "descarta packs sin productos válidos");
assert.deepEqual(n2.packs[0].items, { x: 2 });
const n3 = normalizeViaje({ rewards: [{ at: 40000, text: "una salsa" }, { at: -1, text: "x" }, { at: 9e9, text: "y" }] }, DEFAULT_VIAJE);
assert.deepEqual(n3.rewards.map((r) => r.at), [40000, 0, 10000000]);
assert.equal(normalizeViaje(null, DEFAULT_VIAJE).estado, "pronto");
assert.equal(normalizeViaje({ destacar: "viaje" }, DEFAULT_VIAJE).destacar, "viaje");
assert.equal(normalizeViaje({ destacar: "otra" as never }, DEFAULT_VIAJE).destacar, "semana", "valor inválido → el de por defecto");
assert.equal(normalizeViaje(null, DEFAULT_VIAJE).destacar, "semana");
assert.equal(normalizeViaje({ estado: "abierto" }, DEFAULT_VIAJE).estado, "abierto");

// ── Los productos por defecto son consistentes ──
const ids = items.map((i) => i.id);
assert.equal(new Set(ids).size, ids.length, "ids únicos");
for (const p of S.packs) for (const id of Object.keys(p.items)) assert.ok(ids.includes(id), `el pack ${p.id} usa un id que existe (${id})`);
for (const p of S.packs) assert.ok(trays(p.items, items) === Object.values(p.items).reduce((a, b) => a + b, 0), `el pack ${p.id} lleva solo platos fuertes`);
assert.deepEqual(S.packs.map((p) => trays(p.items, items)), [2, 4, 8]);

console.log("viaje: todos los tests OK");
