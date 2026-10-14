// Tests de la analítica mensual (lib/months.ts).
// Correr con: node --experimental-strip-types scripts/test-months.mts
import assert from "node:assert/strict";
import { crMonthKey, currentMonthKey, monthLabel, reconcileMonths, prevMonthKey, inRange } from "../lib/months.ts";

// Mes en hora de Costa Rica (UTC-6): el cambio de mes es a las 06:00 UTC.
assert.equal(crMonthKey("2026-10-01T05:59:59Z"), "2026-09"); // 11:59 p.m. del 30 sep en CR
assert.equal(crMonthKey("2026-10-01T06:00:00Z"), "2026-10"); // 12:00 a.m. del 1 oct en CR
assert.equal(crMonthKey("2026-12-31T23:00:00Z"), "2026-12");
assert.equal(crMonthKey("2027-01-01T05:00:00Z"), "2026-12");
assert.equal(crMonthKey("basura"), "");
assert.equal(currentMonthKey(new Date("2026-10-14T15:00:00Z")), "2026-10");
assert.equal(monthLabel("2026-10"), "Octubre 2026");
assert.equal(monthLabel("2026-01"), "Enero 2026");

const o = (id: number, createdAt: string, total: number, status: "pagado" | "pendiente") =>
  ({ id: `SANO-${id}`, seq: id, createdAt, total, status } as never);
const hist = [
  { month: "2026-09", label: "Septiembre 2026", amount: 1116500 },
  { month: "2026-10", label: "Octubre 2026", amount: 93000 },
];
const now = new Date("2026-10-14T15:00:00Z");

// Octubre: la plataforma ya superó el 93.000 manual -> el mes se actualiza solo.
let rows = reconcileMonths(
  [
    o(1, "2026-10-02T15:00:00Z", 60000, "pagado"),
    o(2, "2026-10-09T15:00:00Z", 70000, "pagado"),
    o(3, "2026-10-12T15:00:00Z", 25000, "pendiente"),
    o(4, "2026-09-29T15:00:00Z", 20000, "pagado"), // septiembre: la plataforma ve menos que el consolidado
  ],
  hist,
  now
);
const oct = rows.find((r) => r.month === "2026-10")!;
assert.equal(oct.income, 130000);
assert.equal(oct.source, "plataforma");
assert.equal(oct.projected, 155000);
assert.equal(oct.receivable, 25000);
assert.equal(oct.orders, 3);
assert.equal(oct.paidOrders, 2);

// Septiembre: el consolidado manual (mayor) no se pisa ni se le suma la plataforma.
const sep = rows.find((r) => r.month === "2026-09")!;
assert.equal(sep.income, 1116500);
assert.equal(sep.source, "manual");

// Un pedido nuevo pagado en octubre sube el mes (tracking en vivo).
rows = reconcileMonths([o(1, "2026-10-02T15:00:00Z", 200000, "pagado")], hist, now);
assert.equal(rows.find((r) => r.month === "2026-10")!.income, 200000);

// Con menos que el manual, no baja del manual.
rows = reconcileMonths([o(1, "2026-10-02T15:00:00Z", 10000, "pagado")], hist, now);
assert.equal(rows.find((r) => r.month === "2026-10")!.income, 93000);

// El mes en curso siempre aparece, y se agrega solo al cambiar de mes.
rows = reconcileMonths([], [], new Date("2026-11-01T07:00:00Z"));
assert.deepEqual(rows.map((r) => r.month), ["2026-11"]);
assert.equal(rows[0].income, 0);

// Orden ascendente por mes; pendientes no cuentan como ingreso.
rows = reconcileMonths([o(1, "2026-08-10T15:00:00Z", 50000, "pendiente")], hist, now);
assert.deepEqual(rows.map((r) => r.month), ["2026-08", "2026-09", "2026-10"]);
assert.equal(rows[0].income, 0);
assert.equal(rows[0].projected, 50000);
assert.equal(rows[0].receivable, 50000);

// Filtros de tiempo del ranking.
const nowR = new Date("2026-10-14T15:00:00Z");
assert.equal(prevMonthKey("2026-10"), "2026-09");
assert.equal(prevMonthKey("2026-01"), "2025-12");
assert.ok(inRange("2020-01-01T00:00:00Z", "all", nowR));
assert.ok(inRange("2026-10-02T15:00:00Z", "cur", nowR));
assert.ok(!inRange("2026-09-30T15:00:00Z", "cur", nowR));
assert.ok(inRange("2026-09-30T15:00:00Z", "prev", nowR));
assert.ok(!inRange("2026-10-01T05:59:00Z", "cur", nowR)); // todavía 30 sep en CR
assert.ok(inRange("2026-10-01T05:59:00Z", "prev", nowR));
assert.ok(inRange("2026-10-08T15:00:00Z", "7d", nowR));
assert.ok(!inRange("2026-10-06T14:00:00Z", "7d", nowR));
assert.ok(inRange("2026-09-20T15:00:00Z", "30d", nowR));
assert.ok(!inRange("2026-09-10T15:00:00Z", "30d", nowR));
assert.ok(!inRange("2026-10-20T15:00:00Z", "30d", nowR)); // futuro: no
assert.ok(inRange("2026-08-15T15:00:00Z", "2026-08", nowR));
assert.ok(!inRange("basura", "cur", nowR));

console.log("months: todos los tests OK");
