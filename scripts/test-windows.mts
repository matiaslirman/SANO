// Tests de fecha para la pausa de pedidos (lib/windows.ts).
// Correr con: node --experimental-strip-types scripts/test-windows.mts
import assert from "node:assert/strict";
import { getClientWindows, isOrderingPaused, getCycleWindows, windowFromId, getWindowRange, getNextWindow } from "../lib/windows.ts";

// Cierres (hora CR = UTC-6): jueves 12:00 md = 18:00 UTC · sábado 7:30 p. m. = domingo 01:30 UTC.
// Semana de prueba: oct 2026.
//   Dom 27 sep · Lun 28 · Jue 1 oct · Vie 2 · Sáb 3 · Dom 4 · Lun 5 · Jue 8
const at = (iso: string) => new Date(iso);
const ids = (a?: string, n?: Date) => getClientWindows(a, n).map((w) => w.id);

// El dueño publica el menú el domingo 27 sep (10:00 CR).
const ANCHOR = "2026-09-27T16:00:00.000Z";
const FRI = "2026-10-01"; // cierre jueves 12md -> entrega viernes
const MON = "2026-10-03"; // cierre sábado 7:30 p. m. -> entrega lunes (el id es la fecha CR del sábado)

// 1) Recién publicado: ambas ventanas abiertas.
assert.deepEqual(ids(ANCHOR, at("2026-09-27T16:05:00Z")), [FRI, MON]);
assert.equal(isOrderingPaused(ANCHOR, at("2026-09-27T16:05:00Z")), false);

// 2) Un segundo antes del cierre del jueves: sigue todo abierto.
assert.deepEqual(ids(ANCHOR, at("2026-10-01T17:59:59Z")), [FRI, MON]);

// 3) Pasó el cierre del jueves 12md: el viernes se cierra (cutoff, no entrega), queda el lunes.
assert.deepEqual(ids(ANCHOR, at("2026-10-01T18:00:00Z")), [MON]);
assert.deepEqual(ids(ANCHOR, at("2026-10-02T15:00:00Z")), [MON]); // viernes de retiro, sigue el lunes
assert.equal(isOrderingPaused(ANCHOR, at("2026-10-02T15:00:00Z")), false);

// 4) El sábado a las 12 md ya NO cierra: sigue abierto hasta las 7:30 p. m. (01:30 UTC del domingo).
assert.deepEqual(ids(ANCHOR, at("2026-10-03T18:00:00Z")), [MON]);
assert.deepEqual(ids(ANCHOR, at("2026-10-03T23:00:00Z")), [MON]); // 5:00 p. m. CR
assert.deepEqual(ids(ANCHOR, at("2026-10-04T01:29:59Z")), [MON]); // 7:29:59 p. m. CR
assert.equal(isOrderingPaused(ANCHOR, at("2026-10-04T01:29:59Z")), false);

// 5) Sábado 7:30 p. m.: se cierra la última ventana -> PAUSA.
assert.deepEqual(ids(ANCHOR, at("2026-10-04T01:30:00Z")), []);
assert.equal(isOrderingPaused(ANCHOR, at("2026-10-04T01:30:00Z")), true);

// 6) Sigue pausado el domingo, el lunes de retiro y semanas después (no auto-avanza).
for (const t of ["2026-10-04T12:00:00Z", "2026-10-05T15:00:00Z", "2026-10-08T17:59:59Z", "2026-10-20T12:00:00Z"]) {
  assert.equal(isOrderingPaused(ANCHOR, at(t)), true, t);
}

// 7) Publicar un menú nuevo (ancla nueva) reabre con el ciclo siguiente.
const NEW_ANCHOR = "2026-10-04T15:00:00.000Z"; // domingo 4 oct
assert.deepEqual(ids(NEW_ANCHOR, at("2026-10-04T15:01:00Z")), ["2026-10-08", "2026-10-10"]);
assert.equal(isOrderingPaused(NEW_ANCHOR, at("2026-10-04T15:01:00Z")), false);

// 8) Sin menú publicado nunca (sin ancla / ancla inválida): por reloj, jamás pausado.
assert.equal(isOrderingPaused(undefined, at("2026-10-04T01:30:00Z")), false);
assert.equal(isOrderingPaused("basura", at("2026-10-04T01:30:00Z")), false);
assert.equal(ids(undefined, at("2026-10-04T01:30:00Z")).length, 2);

// 9) El admin (getCycleWindows) NO cambia: sigue mostrando ventanas aunque el sitio esté pausado.
assert.ok(getCycleWindows(ANCHOR, at("2026-10-04T12:00:00Z")).length > 0);

// 10) El id del sábado sigue siendo la fecha CR del sábado (no la del domingo UTC): los pedidos ya guardados no se mueven.
const sat = getClientWindows(ANCHOR, at("2026-09-27T16:05:00Z"))[1];
assert.equal(sat.id, "2026-10-03");
assert.equal(sat.cutoffISO, "2026-10-04T01:30:00.000Z");
assert.equal(sat.deliveryDateLabel, "Lunes 5 de octubre");
assert.equal(sat.deliveryISO, "2026-10-05T18:00:00.000Z"); // fin del retiro: lunes 12 md CR
assert.equal(sat.shortLabel, "Entrega Lunes 5 oct");
// el jueves no cambia
const thu = getClientWindows(ANCHOR, at("2026-09-27T16:05:00Z"))[0];
assert.equal(thu.cutoffISO, "2026-10-01T18:00:00.000Z");
assert.equal(thu.deliveryISO, "2026-10-02T18:00:00.000Z");

// 11) windowFromId reconstruye lo mismo (jueves 12 md · sábado 7:30 p. m.).
assert.equal(windowFromId("2026-10-03")?.cutoffISO, "2026-10-04T01:30:00.000Z");
assert.equal(windowFromId("2026-10-03")?.deliveryLabel, "Lunes");
assert.equal(windowFromId("2026-10-01")?.cutoffISO, "2026-10-01T18:00:00.000Z");
assert.equal(windowFromId("2026-10-01")?.deliveryLabel, "Viernes");
assert.equal(windowFromId("nada"), null);

// 12) getWindowRange: ids jueves/sábado en fecha CR, ordenados del más reciente al más viejo.
const range = getWindowRange(at("2026-10-05T15:00:00Z"), 14, 14);
assert.ok(range.some((w) => w.id === "2026-10-03" && w.cutoffISO === "2026-10-04T01:30:00.000Z"));
assert.ok(range.some((w) => w.id === "2026-10-08" && w.cutoffISO === "2026-10-08T18:00:00.000Z"));
for (let i = 1; i < range.length; i++) assert.ok(range[i - 1].cutoff.getTime() > range[i].cutoff.getTime());

// 13) getNextWindow: el sábado a las 3 p. m. CR el próximo cierre sigue siendo ese sábado (antes ya habría pasado).
assert.equal(getNextWindow(at("2026-10-03T21:00:00Z")).id, "2026-10-03");
assert.equal(getNextWindow(at("2026-10-04T01:30:00Z")).id, "2026-10-08");

console.log("windows: todos los tests OK");
