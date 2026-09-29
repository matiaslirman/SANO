// Tests de fecha para la pausa de pedidos (lib/windows.ts).
// Correr con: node --experimental-strip-types scripts/test-windows.mts
import assert from "node:assert/strict";
import { getClientWindows, isOrderingPaused, getCycleWindows } from "../lib/windows.ts";

// 12:00 md Costa Rica = 18:00 UTC. Semana de prueba: oct 2026.
//   Dom 27 sep · Lun 28 · Jue 1 oct · Vie 2 · Sáb 3 · Dom 4 · Lun 5 · Jue 8
const at = (iso: string) => new Date(iso);
const ids = (a?: string, n?: Date) => getClientWindows(a, n).map((w) => w.id);

// El dueño publica el menú el domingo 27 sep (10:00 CR).
const ANCHOR = "2026-09-27T16:00:00.000Z";
const FRI = "2026-10-01"; // cierre jueves 12md -> entrega viernes
const MON = "2026-10-03"; // cierre sábado 12md -> entrega lunes

// 1) Recién publicado: ambas ventanas abiertas.
assert.deepEqual(ids(ANCHOR, at("2026-09-27T16:05:00Z")), [FRI, MON]);
assert.equal(isOrderingPaused(ANCHOR, at("2026-09-27T16:05:00Z")), false);

// 2) Un segundo antes del cierre del jueves: sigue todo abierto.
assert.deepEqual(ids(ANCHOR, at("2026-10-01T17:59:59Z")), [FRI, MON]);

// 3) Pasó el cierre del jueves 12md: el viernes se cierra (cutoff, no entrega), queda el lunes.
assert.deepEqual(ids(ANCHOR, at("2026-10-01T18:00:00Z")), [MON]);
assert.deepEqual(ids(ANCHOR, at("2026-10-02T15:00:00Z")), [MON]); // viernes de retiro, sigue el lunes
assert.equal(isOrderingPaused(ANCHOR, at("2026-10-02T15:00:00Z")), false);

// 4) Un segundo antes del cierre del sábado: todavía abierto.
assert.deepEqual(ids(ANCHOR, at("2026-10-03T17:59:59Z")), [MON]);
assert.equal(isOrderingPaused(ANCHOR, at("2026-10-03T17:59:59Z")), false);

// 5) Sábado 12md: se cierra la última ventana -> PAUSA.
assert.deepEqual(ids(ANCHOR, at("2026-10-03T18:00:00Z")), []);
assert.equal(isOrderingPaused(ANCHOR, at("2026-10-03T18:00:00Z")), true);

// 6) Sigue pausado el domingo, el lunes de retiro y semanas después (no auto-avanza).
for (const t of ["2026-10-04T12:00:00Z", "2026-10-05T15:00:00Z", "2026-10-08T17:59:59Z", "2026-10-20T12:00:00Z"]) {
  assert.equal(isOrderingPaused(ANCHOR, at(t)), true, t);
}

// 7) Publicar un menú nuevo (ancla nueva) reabre con el ciclo siguiente.
const NEW_ANCHOR = "2026-10-04T15:00:00.000Z"; // domingo 4 oct
assert.deepEqual(ids(NEW_ANCHOR, at("2026-10-04T15:01:00Z")), ["2026-10-08", "2026-10-10"]);
assert.equal(isOrderingPaused(NEW_ANCHOR, at("2026-10-04T15:01:00Z")), false);

// 8) Sin menú publicado nunca (sin ancla / ancla inválida): por reloj, jamás pausado.
assert.equal(isOrderingPaused(undefined, at("2026-10-03T18:00:00Z")), false);
assert.equal(isOrderingPaused("basura", at("2026-10-03T18:00:00Z")), false);
assert.equal(ids(undefined, at("2026-10-03T18:00:00Z")).length, 2);

// 9) El admin (getCycleWindows) NO cambia: sigue mostrando ventanas aunque el sitio esté pausado.
assert.ok(getCycleWindows(ANCHOR, at("2026-10-04T12:00:00Z")).length > 0);

console.log("windows: todos los tests OK");
