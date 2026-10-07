import type { Settings, MarketCategory, EventSettings, MonthlyIncome } from "./types";

/**
 * Ingreso histórico del negocio (hoja "SANO MONTHLY REPORT"), sep-2025 → oct-2026.
 * El mes en curso lo mantiene el dueño desde Contenido: ya refleja lo que registró
 * la plataforma, así que el Total global NO vuelve a sumarle los pedidos del sitio.
 */
export const DEFAULT_HISTORY: MonthlyIncome[] = [
  { month: "2025-09", label: "Septiembre 2025", amount: 248000 },
  { month: "2025-10", label: "Octubre 2025", amount: 743500 },
  { month: "2025-11", label: "Noviembre 2025", amount: 889000 },
  { month: "2025-12", label: "Diciembre 2025", amount: 433500 },
  { month: "2026-01", label: "Enero 2026", amount: 807750 },
  { month: "2026-02", label: "Febrero 2026", amount: 404750 },
  { month: "2026-03", label: "Marzo 2026", amount: 487750 },
  { month: "2026-04", label: "Abril 2026", amount: 899000 },
  { month: "2026-05", label: "Mayo 2026", amount: 578000 },
  { month: "2026-06", label: "Junio 2026", amount: 525500 },
  { month: "2026-07", label: "Julio 2026", amount: 268000 },
  { month: "2026-08", label: "Agosto 2026", amount: 609000 },
  { month: "2026-09", label: "Septiembre 2026", amount: 1116500 },
  { month: "2026-10", label: "Octubre 2026", amount: 93000 },
];

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
  // "Proteína Extra" arranca desactivada: se enciende poniendo un precio en Contenido.
  proteinExtraPrice: 0,
  proteinExtraByDish: {},
  history: DEFAULT_HISTORY,
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

/**
 * Evento privado por defecto: los paquetes para el viaje a la playa.
 * El dueño lo edita desde el panel (Contenido → Evento privado) para este y
 * futuros eventos. Arranca apagado hasta que el dueño lo activa.
 */
export const DEFAULT_EVENT: EventSettings = {
  active: false,
  title: "Paquetes para el Viaje",
  subtitle: "Menú especial del grupo. Elegí tus platos y coordinás todo por WhatsApp.",
  code: "PLAYA",
  menu: [
    "Lasagna de Pollo con Hongos y Salsa Blanca",
    "Albóndigas de Res con Puré y Salsa de Tomate",
    "Pasta Corta Carbonara con Pollo",
    "Mongolian de Res con Arroz y Vegetales",
    "Crepa de Pollo Gratinada con Salsa Blanca",
    "Costilla 22Bistro con Arroz y Vegetales",
    "Milanesa Caprecce Gratinada con Arroz",
    "Pasta Pesto Cremoso con Pollo",
    "Ravioles de Ricotta a la Boloñesa",
  ],
  deliveryLabel: "Retiro coordinado para el viaje",
  cuposTotales: 30,
};

/** Productos destacados que se muestran en el upsell del checkout (categoría, índice). */
export const SUGGESTED_UPSELL: { catId: string; itemIndex: number }[] = [
  { catId: "proteinas", itemIndex: 0 }, // Pechuga a la Plancha
  { catId: "pan", itemIndex: 0 },       // Pan de Masa Madre Sencillo
  { catId: "dulcitos", itemIndex: 1 },  // Brownie Cacao Orgánico
  { catId: "salsas", itemIndex: 0 },    // Pesto Cremoso
];
