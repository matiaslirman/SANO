// Tests de la unión de platos parecidos (lib/dishes.ts).
// Correr con: node --experimental-strip-types scripts/test-dishes.mts
import assert from "node:assert/strict";
import { normalizeDish, sameDish, groupDishes } from "../lib/dishes.ts";

const same = (a: string, b: string) => sameDish(normalizeDish(a), normalizeDish(b));

// Se unen: tildes, mayúsculas, espacios, signos, conectores, errores de ortografía chicos.
assert.ok(same("Pechuga Cordon Bleu con Puré", "pechuga cordón bleu con pure"));
assert.ok(same("Milanesa de Pollo Caprecce", "Milanesa de Pollo Caprese"));
assert.ok(same("Milanesa de Pollo Caprecce", "  Milanesa  de pollo  Caprecce. "));
assert.ok(same("Spaghetti con Tomate y Mini Albóndigas de Res", "Espaghetti con Tomate y Mini Albondigas de Res"));
assert.ok(same("Costilla 22Bistro con Arroz y Vegetales", "Costilla 22Bistro con Arroz y Vegetale"));
assert.ok(same("Berenjena Rellena con Carne Gratinada", "Berenjena Rellena con Carne Gratinada"));

// NO se unen: platos distintos aunque se parezcan o con mucha diferencia.
assert.ok(!same("Pasta Corta Carbonara con Pollo", "Pasta Carbonara con Pollo")); // parte de más
assert.ok(!same("Pasta Alfredo con Pollo", "Pasta Carbonara con Pollo"));        // palabra distinta
assert.ok(!same("Lasagna de Carne", "Lasagna de Cerdo"));
assert.ok(!same("Milanesa de Pollo Caprecce", "Milanesa de Res Caprecce"));
assert.ok(!same("Crepa de Espinaca y Hongos en Salsa Blanca", "Crepa de Pollo Gratinada con Salsa Blanca"));
assert.ok(!same("Combo 1 Fit", "Combo 2 Fit"));  // números distintos
assert.ok(same("Arroz", "Arroz!"));             // el signo no cuenta: idénticos al normalizar
assert.ok(same("Arroz", "ARROZ"));               // idéntico tras normalizar
assert.ok(!same("Arroz", "Arrozz"));             // corto: solo idéntico, no difuso

// Agrupación: suma, nombre del menú actual manda, variantes listadas, orden por unidades.
const items = [
  { name: "Milanesa de Pollo Caprese", qty: 5 },
  { name: "Milanesa de Pollo Caprecce", qty: 3 },
  { name: "milanesa de pollo caprecce", qty: 2 },
  { name: "Pasta Alfredo con Pollo", qty: 4 },
  { name: "Pasta Carbonara con Pollo", qty: 1 },
];
let g = groupDishes(items, ["Milanesa de Pollo Caprecce"]);
assert.equal(g.length, 3);
assert.equal(g[0].name, "Milanesa de Pollo Caprecce"); // nombre del menú actual
assert.equal(g[0].qty, 10);
assert.deepEqual([...g[0].variants].sort(), ["Milanesa de Pollo Caprese", "milanesa de pollo caprecce"].sort());
assert.equal(g[1].name, "Pasta Alfredo con Pollo");
assert.equal(g[1].qty, 4);
assert.equal(g[2].qty, 1);

// Sin menú: manda el más pedido.
g = groupDishes(items, []);
assert.equal(g[0].name, "Milanesa de Pollo Caprese");
assert.equal(g[0].qty, 10);

// Ignora cantidades 0 y nombres vacíos; no hay transitividad en cadena.
g = groupDishes([{ name: "", qty: 3 }, { name: "X plato largo ok", qty: 0 }], []);
assert.equal(g.length, 0);

console.log("dishes: todos los tests OK");
