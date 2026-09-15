import type { Settings, MarketCategory } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  menu: [
    "Berenjena Rellena con Carne Gratinada",
    "Milanesa de Pollo Caprecce",
    "Spaghetti con Tomate y Mini Albóndigas de Res",
    "Pechuga Cordon Bleu con Puré",
    "Pasta Corta Carbonara con Pollo",
    "Crepa de Espinaca y Hongos en Salsa Blanca",
    "Costilla 22Bistro con Arroz y Vegetales",
  ],
  weekLabel: "Menú de esta semana",
  cuposTotales: 15,
  basePrice: 5500,
  combos: [
    { min: 6, price: 31000 },
    { min: 10, price: 51000 },
    { min: 15, price: 75500 },
  ],
};

export const DEFAULT_MARKET: MarketCategory[] = [
  {
    id: "dulcitos",
    name: "Dulcitos SANO",
    price: 2500,
    unit: "porción",
    items: [
      "Crepas con Dulce de Leche Casero",
      "Brownie Cacao Orgánico",
      "Frasco Dulce de Leche Casero",
    ],
  },
  {
    id: "salsas",
    name: "Salsas SANO",
    price: 2000,
    unit: "5oz",
    items: ["Pesto Cremoso", "Tomate Casera", "Chimichurri"],
  },
  {
    id: "acompanamientos",
    name: "Acompañamientos SANO",
    price: 3000,
    unit: "250gr",
    items: [
      "Vegetales Salteados",
      "Arroz",
      "Fettuccini Aceite Oliva",
      "Puré de Papa",
      "Papitas Bistro",
    ],
  },
  {
    id: "proteinas",
    name: "Proteínas SANO",
    price: 4500,
    unit: "250gr",
    suggested: true,
    items: [
      "Pechuga a la Plancha",
      "Desmechada de Pollo",
      "Pulled Pork (desmechada de cerdo)",
      "Desmechada de Res",
    ],
  },
  {
    id: "pan",
    name: "Pan de Masa Madre SANO",
    price: 5000,
    unit: "unidad",
    suggested: true,
    items: ["Pan de Masa Madre Sencillo", "Pan de Masa Madre Sencillo con Romero"],
  },
  {
    id: "picaditas",
    name: "Picaditas SANO",
    price: 3750,
    unit: "unidad",
    items: [
      "Hongos Grill al Ajillo Conserva",
      "Tomates Cherry y Ajos Confitados en Aceite de Oliva y Romero",
      "Queso Tipo Feta Marinado Aceite de Oliva y Hierbas Mediterráneas",
    ],
  },
  {
    id: "pizza",
    name: "Pizza SANO Personal",
    price: 5000,
    unit: "unidad",
    items: ["Margarita", "Jamón y Hongos"],
  },
];

/** Productos destacados que se muestran en el upsell del checkout (categoría, índice). */
export const SUGGESTED_UPSELL: { catId: string; itemIndex: number }[] = [
  { catId: "proteinas", itemIndex: 0 }, // Pechuga a la Plancha
  { catId: "pan", itemIndex: 0 },       // Pan de Masa Madre Sencillo
  { catId: "dulcitos", itemIndex: 1 },  // Brownie Cacao Orgánico
  { catId: "salsas", itemIndex: 0 },    // Pesto Cremoso
];
