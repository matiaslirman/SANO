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
