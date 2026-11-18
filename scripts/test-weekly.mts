// Tests de los textos y cuentas nuevos del menú semanal: línea de precio, plazo de la tarjeta, avance de combos y días de retiro.
// Correr con: node --experimental-strip-types --import ./scripts/ts-extensionless.mjs scripts/test-weekly.mts
import assert from "node:assert/strict";
import { menuPriceLine, tileDeadline } from "../lib/hero.ts";
import { comboProgress, priceForDishes } from "../lib/pricing.ts";
import { shortDeliveryLabel } from "../lib/format.ts";

const combos = [{ min: 6, price: 31000 }, { min: 10, price: 51000 }, { min: 15, price: 75500 }];

// Línea de precio del menú
assert.equal(menuPriceLine(5500, combos), "₡5.500 c/u · combo de 6 por ₡31.000");
assert.equal(menuPriceLine(5500, [...combos].reverse()), "₡5.500 c/u · combo de 6 por ₡31.000", "usa el combo más chico sin importar el orden");
assert.equal(menuPriceLine(5500, []), "₡5.500 c/u");

// Plazo en la tarjeta «Esta semana»
assert.equal(tileDeadline("2026-10-18T01:30:00.000Z"), "Platos listos · pedí hasta el sábado 7:30 p. m.");
assert.equal(tileDeadline("2026-10-15T18:00:00.000Z"), "Platos listos · pedí hasta el jueves 12 md");
assert.equal(tileDeadline(undefined), "Platos listos para retirar");
assert.equal(tileDeadline("basura"), "Platos listos para retirar");

// Avance de la barra de combos
const p0 = comboProgress(0, 5500, combos);
assert.equal(p0.pct, 0);
assert.deepEqual(p0.ticks.map(Math.round), [40, 67]);
assert.equal(p0.next?.min, 6);
const p4 = comboProgress(4, 5500, combos);
assert.equal(p4.next?.min, 6);
assert.equal(p4.nextSavings, 2000);                  // 6 × 5.500 − 31.000
assert.equal(Math.round(p4.pct), 27);
const p6 = comboProgress(6, 5500, combos);
assert.equal(p6.next?.min, 10);
assert.equal(p6.nextSavings, 4000);                  // 10 × 5.500 − 51.000
const p10 = comboProgress(10, 5500, combos);
assert.equal(p10.next?.min, 15);
assert.equal(p10.nextSavings, 7000);                 // 15 × 5.500 − 75.500
const p15 = comboProgress(15, 5500, combos);
assert.equal(p15.next, null);
assert.equal(p15.pct, 100);
assert.equal(comboProgress(40, 5500, combos).pct, 100, "no pasa de 100");
assert.deepEqual(comboProgress(3, 5500, []), { pct: 0, ticks: [], next: null, nextSavings: 0 });
// Los precios del servidor no cambiaron: 4 → 22.000, 6 → 31.000, 7 → 36.500, 10 → 51.000.
assert.deepEqual([4, 6, 7, 10, 15, 16].map((q) => priceForDishes(q, 5500, combos)), [22000, 31000, 36500, 51000, 75500, 81000]);

// Día de retiro compacto
assert.equal(shortDeliveryLabel("Viernes 19 de septiembre"), "vie 19 sep");
assert.equal(shortDeliveryLabel("Lunes 1 de diciembre"), "lun 1 dic");
assert.equal(shortDeliveryLabel("Retiro coordinado para el viaje"), "Retiro coordinado para el viaje", "etiquetas libres (evento) quedan igual");
assert.equal(shortDeliveryLabel(""), "");

console.log("weekly: todos los tests OK");
