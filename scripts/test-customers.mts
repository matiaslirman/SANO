// Tests de la unión de clientes (lib/customers.ts).
// Correr con: node --experimental-strip-types --import ./scripts/ts-extensionless.mjs scripts/test-customers.mts
import assert from "node:assert/strict";
import { normalizeName, phoneKey, sameName, groupCustomers } from "../lib/customers.ts";

const same = (a: string, b: string) => sameName(normalizeName(a), normalizeName(b));

// Se unen: tildes, mayúsculas, espacios, error chico en nombre largo.
assert.ok(same("Juan Pérez", "juan perez"));
assert.ok(same("María  Fernanda Solís", "Maria Fernanda Solis"));
assert.ok(same("Maria Fernanda Solis", "Maria Fernanda Soliz"));

// NO se unen: nombres distintos o con partes de más.
assert.ok(!same("Ana", "Ana María"));
assert.ok(!same("Juan Pérez", "Juan Pereira"));
assert.ok(!same("Luis Mora", "Luis Mena")); // cortos: solo idénticos
assert.ok(!same("Carlos Jiménez Rojas", "Carlos Jiménez Solano"));

assert.equal(phoneKey("+506 8319-3498"), "83193498");
assert.equal(phoneKey("8319 3498"), "83193498");
assert.equal(phoneKey("12"), "");
assert.equal(phoneKey(undefined), "");

let n = 0;
const o = (customerName: string, whatsapp = "", status = "pagado", total = 10000, eventId?: string) => ({
  customerName,
  whatsapp,
  status,
  total,
  eventId,
  createdAt: new Date(Date.UTC(2026, 9, 1, 12, 0, n++)).toISOString(),
});

// Cuenta pedidos por cliente uniendo variantes
let g = groupCustomers([o("Juan Pérez"), o("juan perez"), o("JUAN PÉREZ", "", "pendiente"), o("Ana López")]);
assert.equal(g.length, 2);
assert.equal(g[0].orders, 3);
assert.equal(g[0].paidOrders, 2);
assert.equal(g[0].paidTotal, 20000);
assert.equal(g[0].name, "Juan Pérez" === g[0].name ? "Juan Pérez" : g[0].name);
assert.equal(g[0].variants.length, 2);
assert.equal(g[1].orders, 1);

// El teléfono manda: mismo número une nombres distintos
g = groupCustomers([o("Juan", "8319-3498"), o("Juanito Pérez", "+506 83193498")]);
assert.equal(g.length, 1);
assert.equal(g[0].orders, 2);
assert.ok(g[0].byPhone);

// Teléfonos distintos = personas distintas, aunque el nombre sea igual
g = groupCustomers([o("María Fernanda Solís", "8888-1111"), o("María Fernanda Solís", "7777-2222")]);
assert.equal(g.length, 2);

// Un pedido sin teléfono se une al cliente por nombre
g = groupCustomers([o("María Fernanda Solís", "8888-1111"), o("Maria Fernanda Solis")]);
assert.equal(g.length, 1);
assert.equal(g[0].orders, 2);

// Eventos y nombres vacíos no cuentan
g = groupCustomers([o("Juan Pérez"), o("Juan Pérez", "", "pagado", 5000, "evt-x"), o("   ")]);
assert.equal(g.length, 1);
assert.equal(g[0].orders, 1);

// Ordena por pedidos
g = groupCustomers([o("Ana López"), o("Luis Mora"), o("Luis Mora")]);
assert.equal(g[0].name, "Luis Mora");

console.log("customers: OK");
