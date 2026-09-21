/**
 * Ventanas de entrega de Sano.
 *
 * Dos cierres de pedido por semana (hora de Costa Rica, UTC-6, sin horario de verano):
 *   - Jueves 12:00 md  -> entrega Viernes  (8:00 a.m. – 12:00 md)
 *   - Sábado 12:00 md   -> entrega Lunes    (8:00 a.m. – 12:00 md)
 *
 * 12:00 en Costa Rica = 18:00 UTC del mismo día calendario.
 * Todo el cálculo se hace en UTC para no depender del huso del servidor.
 */

export interface DeliveryWindow {
  id: string;            // YYYY-MM-DD del cierre (= fecha CR)
  cutoff: Date;          // instante absoluto del cierre
  cutoffISO: string;
  deliveryEnd: Date;     // fin del retiro (12:00 md CR del día de entrega)
  deliveryISO: string;   // ISO del fin del retiro
  deliveryLabel: string;     // "Viernes" | "Lunes"
  deliveryDateLabel: string; // "Viernes 19 de septiembre"
  shortLabel: string;        // "Entrega Viernes 19 sep"
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const MESES_CORTO = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const HOUR_UTC = 18; // 12:00 CR

function nextCutoffForDow(now: Date, dowUTC: number): Date {
  const d = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), HOUR_UTC, 0, 0, 0
  ));
  let diff = (dowUTC - d.getUTCDay() + 7) % 7;
  if (diff === 0 && d.getTime() <= now.getTime()) diff = 7;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

function buildWindow(cutoff: Date, offset: number): DeliveryWindow {
  const delivery = new Date(cutoff.getTime());
  delivery.setUTCDate(delivery.getUTCDate() + offset);

  const dLabel = DIAS[delivery.getUTCDay()];
  const day = delivery.getUTCDate();
  const month = delivery.getUTCMonth();

  return {
    id: cutoff.toISOString().slice(0, 10),
    cutoff,
    cutoffISO: cutoff.toISOString(),
    // `delivery` cae a las 18:00 UTC (= 12 md CR) del día de entrega: fin del retiro.
    deliveryEnd: delivery,
    deliveryISO: delivery.toISOString(),
    deliveryLabel: dLabel,
    deliveryDateLabel: `${dLabel} ${day} de ${MESES[month]}`,
    shortLabel: `Entrega ${dLabel} ${day} ${MESES_CORTO[month]}`,
  };
}

/** El próximo cierre (la ventana más cercana). */
export function getNextWindow(now: Date = new Date()): DeliveryWindow {
  const thu = nextCutoffForDow(now, 4); // Jueves -> Viernes
  const sat = nextCutoffForDow(now, 6); // Sábado -> Lunes
  const isThu = thu.getTime() <= sat.getTime();
  return buildWindow(isThu ? thu : sat, isThu ? 1 : 2);
}

/** Las entregas ofrecidas al cliente: el próximo viernes y el próximo lunes, ordenadas por cierre. */
export function getOfferedWindows(now: Date = new Date()): DeliveryWindow[] {
  const fri = buildWindow(nextCutoffForDow(now, 4), 1); // Jueves 12md -> Viernes
  const mon = buildWindow(nextCutoffForDow(now, 6), 2); // Sábado 12md -> Lunes
  return [fri, mon].sort((a, b) => a.cutoff.getTime() - b.cutoff.getTime());
}

/**
 * Reconstruye una ventana a partir de su id (fecha de cierre YYYY-MM-DD).
 * Jueves -> entrega Viernes (+1); Sábado -> entrega Lunes (+2).
 */
export function windowFromId(id: string): DeliveryWindow | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(id)) return null;
  const cutoff = new Date(`${id}T${String(HOUR_UTC).padStart(2, "0")}:00:00.000Z`);
  if (Number.isNaN(cutoff.getTime())) return null;
  const dow = cutoff.getUTCDay();
  const offset = dow === 4 ? 1 : dow === 6 ? 2 : 2; // por defecto, entrega 2 días después
  return buildWindow(cutoff, offset);
}

/**
 * Ciclo de entregas atado al menú: las dos ventanas (viernes + lunes) de la
 * semana del menú publicado. Se congela en el momento en que el dueño publica
 * el menú (`anchorISO`). Si no hay ancla, o el ciclo ya venció (su última
 * entrega pasó), cae al ciclo por reloj para no dejar el sitio sin ventanas.
 */
export function getCycleWindows(anchorISO?: string, now: Date = new Date()): DeliveryWindow[] {
  const anchor = anchorISO ? new Date(anchorISO) : null;
  if (!anchor || Number.isNaN(anchor.getTime())) return getOfferedWindows(now);
  const wins = getOfferedWindows(anchor);
  const lastDelivery = Math.max(...wins.map((w) => w.deliveryEnd.getTime()));
  if (lastDelivery < now.getTime()) return getOfferedWindows(now);
  return wins;
}

/** Entregas que el cliente puede elegir ahora: las del ciclo cuyo retiro no pasó. */
export function getClientWindows(anchorISO?: string, now: Date = new Date()): DeliveryWindow[] {
  const open = getCycleWindows(anchorISO, now).filter((w) => w.deliveryEnd.getTime() >= now.getTime());
  return open.length
    ? open
    : getOfferedWindows(now).filter((w) => w.deliveryEnd.getTime() >= now.getTime());
}

/** Todas las ventanas viernes/lunes en un rango (para reasignar pedidos a mano). Más reciente primero. */
export function getWindowRange(now: Date = new Date(), backDays = 42, fwdDays = 42): DeliveryWindow[] {
  const out: DeliveryWindow[] = [];
  const start = new Date(now.getTime() - backDays * 86400000);
  const end = now.getTime() + fwdDays * 86400000;
  const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), HOUR_UTC, 0, 0, 0));
  while (d.getTime() <= end) {
    const dow = d.getUTCDay();
    if (dow === 4) out.push(buildWindow(new Date(d), 1)); // Jueves -> Viernes
    else if (dow === 6) out.push(buildWindow(new Date(d), 2)); // Sábado -> Lunes
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out.sort((a, b) => b.cutoff.getTime() - a.cutoff.getTime());
}
