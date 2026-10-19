// Tests de la línea de cierre, el precio y la regla del contador del hero (lib/hero.ts).
// Correr con: node --experimental-strip-types --import ./scripts/ts-extensionless.mjs scripts/test-hero.mts
import assert from "node:assert/strict";
import { shouldShowHeroPill, resolveHeroPill, cutoffDayLabel, cutoffTimeLabel, closingLine, heroPriceLine, HERO_PILL_DEFAULT_HOURS } from "../lib/hero.ts";

// Modo auto: solo a ≤ N horas del cierre, y nunca después de cerrado.
assert.equal(shouldShowHeroPill("auto", 2, 121, false), false);
assert.equal(shouldShowHeroPill("auto", 2, 120, false), true);   // justo 2 h
assert.equal(shouldShowHeroPill("auto", 2, 45, false), true);
assert.equal(shouldShowHeroPill("auto", 2, 0, false), true);     // último minuto
assert.equal(shouldShowHeroPill("auto", 2, 0, true), false);     // ya cerró: escondido
assert.equal(shouldShowHeroPill("auto", 2, Infinity, false), false); // antes de que arranque el reloj
assert.equal(shouldShowHeroPill("auto", 1, 90, false), false);   // umbral editable: 1 h
assert.equal(shouldShowHeroPill("auto", 5, 250, false), true);   // umbral editable: 5 h
assert.equal(shouldShowHeroPill("siempre", 2, 5000, false), true);
assert.equal(shouldShowHeroPill("siempre", 2, Infinity, true), true);
assert.equal(shouldShowHeroPill("nunca", 2, 10, false), false);

// Valores por defecto y saneados.
assert.deepEqual(resolveHeroPill({}), { mode: "auto", hours: HERO_PILL_DEFAULT_HOURS });
assert.deepEqual(resolveHeroPill({ heroPillMode: "siempre", heroPillHours: 6 }), { mode: "siempre", hours: 6 });
assert.deepEqual(resolveHeroPill({ heroPillMode: "raro" as never, heroPillHours: 0 }), { mode: "auto", hours: 2 });
assert.deepEqual(resolveHeroPill({ heroPillHours: 9999 }), { mode: "auto", hours: 72 });
assert.deepEqual(resolveHeroPill({ heroPillHours: -3 }), { mode: "auto", hours: 2 });

// Día del cierre en hora CR (jueves 12 md = 18:00 UTC; sábado 7:30 p. m. = domingo 01:30 UTC).
assert.equal(cutoffDayLabel("2026-10-15T18:00:00.000Z"), "jueves");
assert.equal(cutoffDayLabel("2026-10-18T01:30:00.000Z"), "sábado"); // en UTC ya es domingo
assert.equal(cutoffDayLabel("basura"), "");
assert.equal(
  closingLine("2026-10-18T01:30:00.000Z", "Lunes 19 de octubre"),
  "Pedidos abiertos hasta el sábado 7:30 p. m. · Retiro lunes 19 de octubre"
);
assert.equal(cutoffTimeLabel("2026-10-15T18:00:00.000Z"), "12 md");
assert.equal(cutoffTimeLabel("2026-10-18T01:30:00.000Z"), "7:30 p. m.");
assert.equal(cutoffTimeLabel("2026-10-18T02:00:00.000Z"), "8 p. m.");
assert.equal(cutoffTimeLabel("2026-10-17T15:00:00.000Z"), "9 a. m.");
assert.equal(cutoffTimeLabel("basura"), "");
assert.equal(closingLine("2026-10-15T18:00:00.000Z", ""), "Pedidos abiertos hasta el jueves 12 md");

// Línea de precio con los precios reales; sin combos, solo el precio base.
const combos = [{ min: 10, price: 51000 }, { min: 6, price: 31000 }, { min: 15, price: 75500 }];
assert.equal(heroPriceLine(5500, combos), "Platos desde ₡5.500 · Combo de 6 por ₡31.000");
assert.equal(heroPriceLine(5500, []), "Platos desde ₡5.500");

console.log("hero: todos los tests OK");
