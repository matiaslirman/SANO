import type { MonthlyIncome, Order } from "./types";

/**
 * Meses calendario en hora de Costa Rica (UTC-6, sin horario de verano), para
 * que un pedido hecho a las 11 p.m. del 30 no caiga en el mes siguiente por UTC.
 */
const CR_OFFSET_MS = 6 * 60 * 60 * 1000;

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** "YYYY-MM" del mes (hora CR) en que cae un instante ISO. "" si la fecha es inválida. */
export function crMonthKey(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  return new Date(t - CR_OFFSET_MS).toISOString().slice(0, 7);
}

/** Mes en curso ("YYYY-MM", hora CR). */
export function currentMonthKey(now: Date = new Date()): string {
  return crMonthKey(now.toISOString());
}

/** "2026-10" -> "Octubre 2026" */
export function monthLabel(key: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return key;
  const name = MESES[parseInt(m[2], 10) - 1];
  return name ? `${name} ${m[1]}` : key;
}

export interface MonthRow {
  month: string;          // "YYYY-MM"
  label: string;
  income: number;         // ingreso del mes que se muestra (ver reconcileMonths)
  platform: number;       // pagados registrados por la plataforma ese mes
  manual: number | null;  // consolidado cargado a mano en Contenido (null = no hay)
  projected: number;      // todos los pedidos del mes (pagados + pendientes)
  receivable: number;     // projected - platform (lo que falta cobrar)
  orders: number;
  paidOrders: number;
  source: "plataforma" | "manual";
}

/**
 * Ingreso por mes = pedidos PAGADOS agrupados por la fecha del pedido (hora CR).
 *
 * El histórico manual cubre meses anteriores a la plataforma y ventas fuera del
 * sitio. Para no duplicar ni perder plata, cada mes toma el MAYOR entre lo que
 * registró la plataforma y lo cargado a mano: un mes nuevo se actualiza solo con
 * cada pedido pagado, y un mes viejo con consolidado no baja si la plataforma
 * vio menos. El mes en curso siempre aparece, aunque todavía no tenga pedidos.
 * Devuelve los meses ordenados de más antiguo a más reciente.
 */
export function reconcileMonths(
  orders: Order[],
  history: MonthlyIncome[],
  now: Date = new Date()
): MonthRow[] {
  const byMonth = new Map<string, { platform: number; projected: number; orders: number; paidOrders: number }>();
  for (const o of orders) {
    const key = crMonthKey(o.createdAt);
    if (!key) continue;
    const m = byMonth.get(key) || { platform: 0, projected: 0, orders: 0, paidOrders: 0 };
    m.projected += o.total;
    m.orders += 1;
    if (o.status === "pagado") {
      m.platform += o.total;
      m.paidOrders += 1;
    }
    byMonth.set(key, m);
  }

  const manual = new Map<string, number>();
  for (const h of history) if (/^\d{4}-\d{2}$/.test(h.month)) manual.set(h.month, (manual.get(h.month) || 0) + h.amount);

  const keys = new Set<string>([...byMonth.keys(), ...manual.keys(), currentMonthKey(now)]);
  return [...keys]
    .sort()
    .map((month) => {
      const m = byMonth.get(month) || { platform: 0, projected: 0, orders: 0, paidOrders: 0 };
      const man = manual.has(month) ? (manual.get(month) as number) : null;
      const income = Math.max(m.platform, man ?? 0);
      return {
        month,
        label: monthLabel(month),
        income,
        platform: m.platform,
        manual: man,
        projected: m.projected,
        receivable: m.projected - m.platform,
        orders: m.orders,
        paidOrders: m.paidOrders,
        source: m.platform >= (man ?? 0) ? "plataforma" : "manual",
      };
    });
}

/** Mes anterior a "YYYY-MM". */
export function prevMonthKey(key: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return "";
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
}

/**
 * Filtro de tiempo por fecha del pedido: "all", "cur" (mes en curso), "prev" (mes anterior),
 * "30d" / "7d" (últimos días, corridos desde ahora) o un mes "YYYY-MM" (hora CR).
 */
export function inRange(createdAt: string, range: string, now: Date = new Date()): boolean {
  if (range === "all") return true;
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return false;
  if (range === "30d" || range === "7d") {
    const days = range === "30d" ? 30 : 7;
    return t <= now.getTime() && t >= now.getTime() - days * 86400000;
  }
  const key = crMonthKey(createdAt);
  const cur = currentMonthKey(now);
  if (range === "cur") return key === cur;
  if (range === "prev") return key === prevMonthKey(cur);
  return key === range;
}
