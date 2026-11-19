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
/** Cuándo se muestra el contador (cierra en… + cupos) del hero: siempre, nunca, o solo cerca del cierre. */
export type HeroPillMode = "auto" | "siempre" | "nunca";

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
  /** Contador del hero: "auto" (solo cuando faltan `heroPillHours` h o menos para el cierre), "siempre" o "nunca". */
  heroPillMode?: HeroPillMode;
  heroPillHours?: number;
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
  /** Correo opcional (minúsculas): llave para vincular al cliente con su tarjeta de sellos. */
  email?: string;
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
  /** Pedido de Viaje Sano: vive aparte del ciclo semanal (sin ventana, sin cupos, sin platos del menú). */
  kind?: "viaje" | "bsc";
  pickupDate?: string;       // viaje: fecha de retiro elegida por el cliente (YYYY-MM-DD, hora CR)
  pickupConfirmed?: boolean; // viaje: el dueño ya confirmó fecha y hora por WhatsApp
  viaje?: OrderViajeLine[];  // viaje: bandejas y extras con el precio de ese momento
  viajePack?: string;        // viaje: pack con el que empezó el pedido (si lo hubo)
  viajeGift?: string;        // viaje: regalo por volumen que ganó (texto)
  /** Pedido del evento Bistro Social Club: vive aparte del ciclo semanal (sin ventana ni cupos). */
  bsc?: OrderBscLine[];      // bsc: tragos, bebidas y platos para picar, con el precio de ese momento
  bscTable?: string;         // bsc: mesa o referencia que dejó la persona (opcional)
  bscPrep?: BscPrep;         // bsc: estado de preparación (barra / cocina)
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
  /** Contador del hero (ver Settings.heroPillMode). Ausente en el evento. */
  heroPill?: { mode: HeroPillMode; hours: number };
  /** Solo con los pedidos cerrados: el menú que acaba de cerrar y los favoritos de siempre (nombres, datos reales). */
  closed?: { thisWeek: DishName[]; favorites: DishName[] };
  /** Viaje Sano: lo que decide si el hero muestra la tarjeta (abierta, «Disponible pronto» o nada). Ausente en el evento. */
  viaje?: { estado: ViajeEstado; fecha: string; destacar: "semana" | "viaje" };
  /** Bistro Social Club: true solo mientras está dentro de su ventana de pedidos (si no, la pestaña no aparece). */
  bsc?: boolean;
  /** Platos de este menú que están entre los más pedidos de siempre (datos reales). Ausente si hay pocos pedidos. */
  popular?: DishName[];
}


// ── Viaje Sano ────────────────────────────────────────────────
/** Lo controla el dueño desde Contenido: oculto (no existe), pronto («Disponible pronto») o abierto (se puede pedir). */
export type ViajeEstado = "oculto" | "pronto" | "abierto";

/** Categorías fijas del catálogo de viaje (sus reglas viven en `lib/viaje.ts`). */
export type ViajeCatId = "las" | "pec" | "cha" | "aco" | "pro" | "sal";

export interface ViajeItem {
  id: string;        // estable: lo referencian los packs y los pedidos
  cat: ViajeCatId;
  name: string;
  desc?: string;     // una línea (ej. "Jamón y queso")
  price: number;     // CRC por bandeja (o por unidad en proteínas y salsas)
  active: boolean;   // oculto del sitio si está apagado
}

/** Un pack = solo platos fuertes (bandejas de 4 porciones). Los extras se suman aparte. */
export interface ViajePack {
  id: string;
  name: string;
  items: Record<string, number>; // id de producto -> cantidad
}

/** Regalo por volumen: desde `at` colones se regala `text` (ej. "1 salsa de regalo"). 0 = apagado. */
export interface ViajeReward {
  at: number;
  text: string;
}

export interface ViajeSettings {
  estado: ViajeEstado;
  fecha: string;      // texto libre: "en las próximas semanas", "el 1 de diciembre"
  /** Cuál tarjeta del hero va rellena: la del menú semanal (por defecto) o la de Viaje Sano (temporada de viajes). */
  destacar: "semana" | "viaje";
  leadDays: number;   // anticipación mínima de retiro, en días (hora CR)
  chainText: string;  // aviso de cadena de frío junto a la fecha
  rewards: ViajeReward[];
  items: ViajeItem[];
  packs: ViajePack[];
}

/** Línea de un pedido de viaje, con el precio del momento (el servidor es la autoridad). */
export interface OrderViajeLine {
  id: string;
  cat: ViajeCatId;
  name: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
}

// ── Bistro Social Club (evento temporal con carta, promo y comanda) ──────────

export type BscPrep = "recibido" | "preparando" | "entregado";
export type BscCatId = "tragos" | "bebidas" | "picar";

export interface BscVariant {
  id: string;
  name: string;
  /** Solo si la variante cambia el precio (p. ej. el vino). Si falta, usa el precio del ítem. */
  price?: number;
}

export interface BscItem {
  id: string;
  cat: BscCatId;
  name: string;
  desc?: string;
  price: number; // 0 cuando el precio lo fija cada variante
  /** Variantes: si hay, la persona elige una (obligatorio). */
  variants?: BscVariant[];
  image?: string; // ruta bajo /bsc/fotos
  /** Con al menos uno de estos en la cuenta se activa la promo. */
  promoTrigger?: boolean;
  /** Estos platos pueden salir incluidos por la promo (el primero de la cuenta). */
  promoEligible?: boolean;
  active: boolean;
}

export interface BscSettings {
  /** Interruptor general: apagado, no hay pestaña, ni página, ni pedidos (la comanda del panel sí queda). */
  enabled: boolean;
  slug: string;
  name: string;
  venue: string;
  startsAt: string;       // inicio del evento (ISO con zona), solo para mostrar
  availableFrom: string;  // desde cuándo se ve y acepta pedidos (ISO)
  availableUntil: string; // hasta cuándo (ISO)
  items: BscItem[];
}

/** Línea de un pedido del evento: con el precio del momento (el servidor es la autoridad). */
export interface OrderBscLine {
  id: string;
  cat: BscCatId;
  name: string;
  variantId?: string;
  variantName?: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
  promoTrigger?: boolean;
  promoEligible?: boolean;
}
