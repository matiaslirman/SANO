export type DishName = string;

export interface MarketCategory {
  id: string;
  name: string;       // e.g. "Proteínas SANO"
  price: number;      // fixed unit price (CRC)
  unit: string;       // e.g. "250gr"
  suggested?: boolean; // shown in the checkout upsell
  items: string[];    // product names within the category
}

export interface ComboTier {
  min: number;   // minimum number of dishes to unlock this combo price
  price: number; // total price at exactly `min` dishes
}

/**
 * Ingreso mensual histórico del negocio. Lo mantiene el dueño desde Contenido:
 * es el consolidado real (incluye el mes en curso con lo que ya registró la
 * plataforma), así que NO se le vuelven a sumar los pedidos del sitio encima.
 */
export interface MonthlyIncome {
  month: string;  // "YYYY-MM"
  label: string;  // "Septiembre 2025"
  amount: number; // CRC
}

export interface Settings {
  menu: DishName[];        // 7 (or N) weekly dishes
  weekLabel: string;       // e.g. "Semana del 15 al 21 sep"
  cuposTotales: number;    // capacity per delivery window
  basePrice: number;       // CRC per dish (no combo)
  combos: ComboTier[];     // volume combo tiers
  menuPublishedAt?: string; // ISO: cuándo se publicó el menú → ancla del ciclo de entregas
  /** "Proteína Extra": precio por defecto de agrandar la proteína de un plato (CRC). 0 = desactivado. */
  proteinExtraPrice?: number;
  /** Precio propio por plato (clave = nombre del plato). 0 = ese plato no ofrece el extra. Sin clave = precio por defecto. */
  proteinExtraByDish?: Record<string, number>;
  /** Ingreso histórico mensual del negocio (editable en Contenido). */
  history?: MonthlyIncome[];
}

/**
 * Evento privado: una "ventana" aparte del sitio (ej. paquetes para un viaje),
 * protegida por un código y editable desde el panel — mismo flujo, layout y
 * precios que el menú semanal, pero con su propia lista de platos y una fecha
 * de entrega fija. Reutiliza `basePrice` y `combos` de Settings.
 */
export interface EventSettings {
  active: boolean;        // si está encendido, se puede entrar con el código
  title: string;          // "Paquetes Viaje a la Playa"
  subtitle: string;       // bajada corta en el hero
  code: string;           // código de acceso que comparte el dueño
  menu: DishName[];        // platos del evento
  deliveryLabel: string;  // fecha/etiqueta fija de retiro, ej. "Retiro jueves 2 oct · 8 a.m.–12 md"
  cuposTotales: number;   // capacidad del evento
}

export type OrderStatus = "pendiente" | "pagado";

export interface OrderDishLine {
  name: string;
  qty: number;
  extraQty?: number;  // cuántas de las `qty` unidades llevan "Proteína Extra"
  extraUnit?: number; // precio unitario del extra al momento del pedido
}

export interface OrderMarketLine {
  category: string;
  name: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
}

export interface Order {
  id: string;              // "SANO-1042"
  seq: number;             // numeric sequence
  createdAt: string;       // ISO
  windowId: string;        // YYYY-MM-DD of the order-close cutoff
  windowLabel: string;     // e.g. "Entrega Viernes 19 sep"
  customerName: string;
  whatsapp: string;
  notes: string;
  dishes: OrderDishLine[];
  market: OrderMarketLine[];
  dishesQty: number;
  dishesTotal: number;
  marketTotal: number;
  extrasTotal?: number; // suma de "Proteína Extra" (se suma al total; no cuenta para el combo)
  total: number;
  status: OrderStatus;
  completed?: boolean; // "tachado" — entregado/completado por el dueño
  eventId?: string;    // si viene de un evento privado: clave del evento (agrupa su pestaña)
}

export interface WindowInfo {
  id: string;
  cutoffISO: string;         // absolute instant of order close
  deliveryLabel: string;     // "Viernes"
  deliveryDateLabel: string; // "Viernes 19 de septiembre"
  cuposTotales: number;
  cuposDisponibles: number;
}

export interface PublicStatus {
  menu: DishName[];
  weekLabel: string;
  basePrice: number;
  combos: ComboTier[];
  windows: WindowInfo[];     // entregas ofrecidas (próximo viernes + próximo lunes)
  /** Proteína Extra: precio por plato del menú actual. Sin clave o 0 = no disponible. Ausente en el evento. */
  extraPrices?: Record<DishName, number>;
}
