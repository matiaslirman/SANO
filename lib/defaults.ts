import type { Settings, MarketCategory, EventSettings, MonthlyIncome, ViajeSettings, BscSettings } from "./types";

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
  // Contador del hero: solo aparece cuando faltan 2 h o menos para el cierre.
  heroPillMode: "auto",
  heroPillHours: 2,
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

/**
 * Viaje Sano por defecto: el menú de bandejas para llevar de viaje.
 * Arranca en «pronto» (la tarjeta aparece apagada con «Disponible pronto»); el dueño lo abre desde Contenido.
 * Precios y packs son editables en el panel. Los packs llevan solo platos fuertes.
 */
export const DEFAULT_VIAJE: ViajeSettings = {
  estado: "pronto",
  fecha: "en las próximas semanas",
  destacar: "semana",
  leadDays: 7,
  chainText: "Las bandejas se entregan refrigeradas. Llevá una hielera para mantener la cadena de frío.",
  rewards: [
    { at: 60000, text: "1 salsa de regalo" },
    { at: 120000, text: "2 salsas de regalo" },
  ],
  items: [
    { id: "l1", cat: "las", name: "Lasaña de pollo", price: 18000, active: true },
    { id: "l2", cat: "las", name: "Lasaña de carne boloñesa", price: 18000, active: true },
    { id: "l3", cat: "las", name: "Lasaña de berenjena", price: 18000, active: true },
    { id: "l4", cat: "las", name: "Lasaña de pollo, hongos y salsa trufada", price: 18000, active: true },
    { id: "l5", cat: "las", name: "Lasaña de pollo con tocineta y hongos", price: 18000, active: true },
    { id: "l6", cat: "las", name: "Lasaña de berenjena parmesana", price: 15000, active: true },
    { id: "l7", cat: "las", name: "Lasaña de vegetales y salsa de tomate", price: 14000, active: true },
    { id: "p1", cat: "pec", name: "Pechugas cordon bleu", desc: "Jamón y queso", price: 20000, active: true },
    { id: "p2", cat: "pec", name: "Pechugas caprecce", desc: "Tomate, albahaca y queso", price: 20000, active: true },
    { id: "c1", cat: "cha", name: "Arroz chaufa de pollo", price: 15000, active: true },
    { id: "c2", cat: "cha", name: "Arroz chaufa de cerdo ahumado", price: 15000, active: true },
    { id: "a1", cat: "aco", name: "Puré de papas extra", price: 5000, active: true },
    { id: "a2", cat: "aco", name: "Vegetales salteados", price: 6000, active: true },
    { id: "a3", cat: "aco", name: "Papas a la crema", price: 6000, active: true },
    { id: "r1", cat: "pro", name: "Res mechada", price: 6500, active: true },
    { id: "r2", cat: "pro", name: "Pollo mechado", price: 6000, active: true },
    { id: "r3", cat: "pro", name: "Pulled pork", price: 6000, active: true },
    { id: "r4", cat: "pro", name: "Cubitos de lomo", price: 7500, active: true },
    { id: "r5", cat: "pro", name: "Pollo fajitas", price: 7000, active: true },
    { id: "r6", cat: "pro", name: "Bolitas de pechuga", price: 7500, active: true },
    { id: "r7", cat: "pro", name: "Albóndigas de res", price: 8000, active: true },
    { id: "s1", cat: "sal", name: "Tomate casera", price: 2500, active: true },
    { id: "s2", cat: "sal", name: "Miel BBQ", price: 2500, active: true },
    { id: "s3", cat: "sal", name: "Sweet and spicy", price: 2500, active: true },
    { id: "s4", cat: "sal", name: "Pesto", price: 2500, active: true },
    { id: "s5", cat: "sal", name: "Chimichurri fresco", price: 2500, active: true },
  ],
  packs: [
    { id: "escapada", name: "Escapada", items: { l1: 1, c1: 1 } },
    { id: "familia", name: "Familia", items: { l1: 1, l2: 1, p1: 1, c1: 1 } },
    { id: "semana", name: "Semana completa", items: { l1: 1, l2: 1, l3: 1, l7: 1, p1: 1, p2: 1, c1: 1, c2: 1 } },
  ],
};

// ── Bistro Social Club (evento del jueves 19 de noviembre de 2026) ───────────
// Fuente de verdad: el traspaso del evento. Las fechas llevan la zona de Costa Rica (UTC−6, sin horario de verano).
export const DEFAULT_BSC: BscSettings = {
  enabled: true,
  slug: "bistro-social-club",
  name: "Bistro Social Club",
  venue: "22Bistro · Ciudad Colón",
  editionId: "2026-11-19",
  startsAt: "2026-11-19T19:30:00-06:00",
  availableFrom: "2026-11-19T00:00:00-06:00",
  availableUntil: "2026-11-20T08:00:00-06:00",
  items: [
    {
      id: "gin-tonic", cat: "tragos", name: "Gin Tonic", price: 5000, promoTrigger: true, active: true, image: "gintonic.jpg",
      desc: "Beefeater + reducción de frutos rojos o maracuyá, o clásico + tónica + hielo.",
      variants: [{ id: "frutos-rojos", name: "Frutos rojos" }, { id: "maracuya", name: "Maracuyá" }, { id: "clasico", name: "Clásico" }],
    },
    {
      id: "paloma", cat: "tragos", name: "Paloma", price: 5000, promoTrigger: true, active: true, image: "paloma.jpg",
      desc: "José Cuervo añejo + borde de tajín + reducción de tamarindo o fresca + limón + hielo.",
      variants: [{ id: "tamarindo", name: "Tamarindo" }, { id: "fresca", name: "Fresca" }],
    },
    {
      id: "playero", cat: "tragos", name: "Playero", price: 5000, promoTrigger: true, active: true, image: "playero.jpg",
      desc: "Malibu + jugo de naranja + leche de coco + piña.",
    },
    { id: "cerveza", cat: "bebidas", name: "Cerveza", price: 2000, active: true },
    {
      // La carta dice «₡3.500 / ₡4.000» sin aclarar qué distingue los dos precios: quedan como dos variantes
      // con nombre neutro hasta que el dueño las renombre en el panel (Comanda → Configuración).
      id: "vino", cat: "bebidas", name: "Vino", price: 0, active: true,
      variants: [{ id: "v3500", name: "Opción ₡3.500", price: 3500 }, { id: "v4000", name: "Opción ₡4.000", price: 4000 }],
    },
    { id: "papitas-pinterest", cat: "picar", name: "Papitas Pinterest", price: 3000, active: true, image: "papitas.jpg", desc: "Papas fritas, chorizo español, aceitunas, guindilla y parmesano rallado por encima." },
    { id: "fondue", cat: "picar", name: "Fondue de queso", price: 3000, active: true, image: "fondue.jpg", desc: "Con pan de ajo y especias." },
    { id: "guacamole", cat: "picar", name: "Guacamole", price: 3000, active: true, image: "guacamole.jpg", desc: "Con chips." },
    { id: "carpaccio-salmon", cat: "picar", name: "Carpaccio de Salmón con Reducción Balsámica", price: 3000, active: true, image: "carpaccio-salmon.jpg" },
    { id: "hummus", cat: "picar", name: "Hummus", price: 3000, active: true, image: "hummus.jpg", desc: "Con vegetales." },
  ],
  cortesia: { tragos: 1, options: [{ id: "1" }, { id: "2" }] },
  combo: { enabled: true, qty: 2, price: 9000 },
  autoWeekly: true,
};
