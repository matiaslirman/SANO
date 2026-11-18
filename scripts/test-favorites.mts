// Tests de los favoritos y del mensaje de aviso (lib/favorites.ts).
// Correr con: node --experimental-strip-types --import ./scripts/ts-extensionless.mjs scripts/test-favorites.mts
import assert from "node:assert/strict";
import { topDishes, menuAlertMessage } from "../lib/favorites.ts";

const o = (dishes: [string, number][], eventId?: string) => ({ eventId, dishes: dishes.map(([name, qty]) => ({ name, qty })) });

const orders = [
  o([["Lasaña de Carne a la Boloñesa", 3], ["Mongolian de Lomito con Arroz", 1]]),
  o([["Lasaña de Carne a la Boloñesa", 2]]),
  o([["Pechuga a la Plancha con Fettuccine al Pesto Cremoso", 3]]),
  o([["Mongolian de Lomito con Arroz", 1]]),
  o([["Plato solo de evento muy pedido", 50]], "evt-x"),
];

// Ordena por cantidad real y deja afuera los eventos.
assert.deepEqual(topDishes(orders, []), [
  "Lasaña de Carne a la Boloñesa",
  "Pechuga a la Plancha con Fettuccine al Pesto Cremoso",
  "Mongolian de Lomito con Arroz",
]);

// Une escrituras casi idénticas (tilde, mayúscula, typo chico) en un solo favorito.
const typos = [
  o([["Pechuga a la Plancha con Fettuccine al Pesto Cremoso", 2]]),
  o([["pechuga a la plancha con fetuccine al pesto cremoso", 2]]),
  o([["Lasaña de Carne a la Boloñesa", 3]]),
];
assert.equal(topDishes(typos, []).length, 2);
assert.equal(topDishes(typos, [])[0], "Pechuga a la Plancha con Fettuccine al Pesto Cremoso");

// No repite lo que ya está en el menú de esta semana (aunque esté escrito distinto).
assert.deepEqual(topDishes(orders, ["Lasaña de Carne a la Bolonesa"]), [
  "Pechuga a la Plancha con Fettuccine al Pesto Cremoso",
  "Mongolian de Lomito con Arroz",
]);

// Límite y sin pedidos.
assert.equal(topDishes(orders, [], 1).length, 1);
assert.deepEqual(topDishes([], ["X"]), []);

// Mensaje de WhatsApp: sin selección es el de siempre; con selección lista los platos.
assert.equal(menuAlertMessage([]), "Hola Sano 👋 Avisame apenas salga el menú de la próxima semana, por favor.");
assert.equal(
  menuAlertMessage(["Lasaña de Carne a la Boloñesa", " Mongolian de Lomito con Arroz "]),
  "Hola Sano 👋 Avisame apenas salga el menú de la próxima semana, por favor. Me encantaría que vuelvan: Lasaña de Carne a la Boloñesa, Mongolian de Lomito con Arroz."
);

console.log("favorites: OK");

// ── «Más pedido»: solo con datos reales y suficientes ──
import { popularInMenu, POPULAR_MIN_ORDERS, POPULAR_MIN_QTY } from "../lib/favorites.ts";
const menu = ["Lasaña Boloñesa", "Pechuga Cordon Bleu con Puré", "Crepa de Espinaca y Hongos", "Costilla 22Bistro con Arroz"];
const many = (name: string, qty: number, times: number) => Array.from({ length: times }, () => o([[name, qty]]));
// Pocos pedidos: no se etiqueta nada (sería ruido, no dato).
assert.deepEqual(popularInMenu(many("Lasaña Boloñesa", 3, POPULAR_MIN_ORDERS - 1), menu), []);
// Con suficientes: los 2 más pedidos del menú, en orden de cantidad.
const hist = [
  ...many("Lasaña Boloñesa", 2, 6),                       // 12
  ...many("Pechuga Cordon Bleu con Puré", 1, 9),          // 9
  ...many("Crepa de Espinaca y Hongos", 1, 3),            // 3 → no llega al mínimo
  ...many("Plato que ya no está en el menú", 5, 8),       // 40, pero no es de este menú
  o([["Costilla 22Bistro con Arroz", 99]], "evt-x"),      // eventos no cuentan
];
assert.ok(hist.length >= POPULAR_MIN_ORDERS);
assert.deepEqual(popularInMenu(hist, menu), ["Lasaña Boloñesa", "Pechuga Cordon Bleu con Puré"]);
assert.deepEqual(popularInMenu(hist, menu, 1), ["Lasaña Boloñesa"]);
// Une escrituras casi idénticas y devuelve el nombre tal como está en el menú.
const conTilde = [...hist, ...many("Pechuga Cordon Bleu con Pure", 4, 2)]; // tilde distinta: 9 + 8 = 17 → pasa a ser la más pedida
assert.deepEqual(popularInMenu(conTilde, menu)[0], "Pechuga Cordon Bleu con Puré");
// Mínimo de unidades por plato.
assert.deepEqual(popularInMenu([...many("Crepa de Espinaca y Hongos", 1, POPULAR_MIN_QTY - 1), ...many("Otro", 1, 30)], menu), []);
console.log("favorites (popularInMenu): OK");
