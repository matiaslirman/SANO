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

export interface Settings {
  menu: DishName[];        // 7 (or N) weekly dishes
  weekLabel: string;       // e.g. "Semana del 15 al 21 sep"
  cuposTotales: number;    // capacity per delivery window
  basePrice: number;       // CRC per dish (no combo)
  combos: ComboTier[];     // volume combo tiers
}

export type OrderStatus = "pendiente" | "pagado";

export interface OrderDishLine {
  name: string;
  qty: number;
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
  total: number;
  status: OrderStatus;
  completed?: boolean; // "tachado" — entregado/completado por el dueño
}

export interface PublicStatus {
  menu: DishName[];
  weekLabel: string;
  cuposTotales: number;
  cuposDisponibles: number;
  basePrice: number;
  combos: ComboTier[];
  window: {
    id: string;
    cutoffISO: string;      // absolute instant of order close
    deliveryLabel: string;  // "Viernes"
    deliveryDateLabel: string; // "Viernes 19 de septiembre"
  };
}
