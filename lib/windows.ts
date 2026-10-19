/**
 * Ventanas de entrega de Sano.
 *
 * Dos cierres de pedido por semana (hora de Costa Rica, UTC-6, sin horario de verano):
 *   - Jueves 12:00 md     -> entrega Viernes  (8:00 a.m. – 12:00 md)
 *   - Sábado 7:30 p. m.   -> entrega Lunes    (8:00 a.m. – 12:00 md)
 *
 * El cálculo se hace en "hora CR" (UTC-6) sin depender del huso del servidor. El sábado 7:30 p. m. CR
 * ya es domingo 01:30 UTC, por eso el `id` de la ventana es la fecha CR del cierre (el sábado) y no la
 * fecha UTC: así los pedidos ya guardados con id de sábado siguen cayendo en la misma ventana.
 */

export interface DeliveryWindow {
  id: string;            // YYYY-MM-DD del cierre en fecha CR (el sábado, aunque en UTC ya sea domingo)
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

/** Costa Rica = UTC-6 todo el año. */
const CR_OFFSET_MS = 6 * 3600 * 1000;

/** Hora de cierre (hora CR) y días hasta la entrega, por día de la semana (0 = domingo). */
const CUTOFFS: Record<number, { hour: number; minute: number; deliver: number }> = {
  4: { hour: 12, minute: 0, deliver: 1 },  // Jueves 12 md      -> Viernes
  6: { hour: 19, minute: 30, deliver: 2 }, // Sábado 7:30 p. m. -> Lunes
};
const DEFAULT_CUTOFF = { hour: 12, minute: 0, deliver: 2 }; // ids de otros días (reasignación a mano)

/** Fecha "de pared" CR: un Date cuyos campos UTC son la hora CR. */
const toCR = (d: Date) => new Date(d.getTime() - CR_OFFSET_MS);
const fromCR = (d: Date) => new Date(d.getTime() + CR_OFFSET_MS);

/** Instante del cierre para una fecha CR (campos UTC de `crDay`: año/mes/día) y un día de la semana. */
function cutoffAt(crDay: Date, dow: number): Date {
  const c = CUTOFFS[dow] || DEFAULT_CUTOFF;
  return fromCR(new Date(Date.UTC(crDay.getUTCFullYear(), crDay.getUTCMonth(), crDay.getUTCDate(), c.hour, c.minute, 0, 0)));
}

function nextCutoffForDow(now: Date, dow: number): Date {
  const cr = toCR(now);
  const day = new Date(Date.UTC(cr.getUTCFullYear(), cr.getUTCMonth(), cr.getUTCDate()));
  let diff = (dow - day.getUTCDay() + 7) % 7;
  if (diff === 0 && cutoffAt(day, dow).getTime() <= now.getTime()) diff = 7;
  day.setUTCDate(day.getUTCDate() + diff);
  return cutoffAt(day, dow);
}

function buildWindow(cutoff: Date, offset: number): DeliveryWindow {
  const cr = toCR(cutoff);
  // Fin del retiro: 12:00 md CR del día de entrega.
  const deliveryCR = new Date(Date.UTC(cr.getUTCFullYear(), cr.getUTCMonth(), cr.getUTCDate() + offset, 12, 0, 0, 0));
  const delivery = fromCR(deliveryCR);

  const dLabel = DIAS[deliveryCR.getUTCDay()];
  const day = deliveryCR.getUTCDate();
  const month = deliveryCR.getUTCMonth();

  return {
    id: cr.toISOString().slice(0, 10),
    cutoff,
    cutoffISO: cutoff.toISOString(),
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
  const mon = buildWindow(nextCutoffForDow(now, 6), 2); // Sábado 7:30 p. m. -> Lunes
  return [fri, mon].sort((a, b) => a.cutoff.getTime() - b.cutoff.getTime());
}

/**
 * Reconstruye una ventana a partir de su id (fecha de cierre YYYY-MM-DD).
 * Jueves -> entrega Viernes (+1); Sábado -> entrega Lunes (+2).
 */
export function windowFromId(id: string): DeliveryWindow | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(id)) return null;
  const day = new Date(`${id}T00:00:00.000Z`); // fecha CR
  if (Number.isNaN(day.getTime())) return null;
  const dow = day.getUTCDay();
  const offset = (CUTOFFS[dow] || DEFAULT_CUTOFF).deliver;
  return buildWindow(cutoffAt(day, dow), offset);
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

/** Mensaje que ve el cliente cuando el sitio está pausado (sin ventanas abiertas). */
export const ORDERS_PAUSED_TITLE = "Pedidos cerrados por ahora";
export const ORDERS_PAUSED_MESSAGE = "Abrimos apenas publiquemos el nuevo menú 🍽️";

/**
 * Entregas en las que el cliente puede pedir ahora: las del ciclo del menú
 * publicado cuyo CIERRE de pedidos (`cutoff`, no la entrega) todavía no pasó.
 *
 * Si el menú ya se publicó y todas las ventanas de su ciclo cerraron, devuelve
 * vacío: el sitio queda **pausado** hasta que el dueño publique un menú nuevo
 * (eso re-fija `menuPublishedAt` y abre la semana). No auto-avanza por reloj.
 *
 * Solo si nunca se publicó un menú (sin ancla) se usan las próximas ventanas
 * por reloj, para que una instalación nueva no arranque pausada.
 */
export function getClientWindows(anchorISO?: string, now: Date = new Date()): DeliveryWindow[] {
  const anchor = anchorISO ? new Date(anchorISO) : null;
  if (!anchor || Number.isNaN(anchor.getTime())) return getOfferedWindows(now);
  return getOfferedWindows(anchor).filter((w) => w.cutoff.getTime() > now.getTime());
}

/** true si no hay ninguna ventana abierta para pedir (ver `getClientWindows`). */
export function isOrderingPaused(anchorISO?: string, now: Date = new Date()): boolean {
  return getClientWindows(anchorISO, now).length === 0;
}

/** Todas las ventanas viernes/lunes en un rango (para reasignar pedidos a mano). Más reciente primero. */
export function getWindowRange(now: Date = new Date(), backDays = 42, fwdDays = 42): DeliveryWindow[] {
  const out: DeliveryWindow[] = [];
  const cr = toCR(new Date(now.getTime() - backDays * 86400000));
  const d = new Date(Date.UTC(cr.getUTCFullYear(), cr.getUTCMonth(), cr.getUTCDate()));
  const end = now.getTime() + fwdDays * 86400000;
  while (fromCR(d).getTime() <= end) {
    const dow = d.getUTCDay();
    const c = CUTOFFS[dow];
    if (c) out.push(buildWindow(cutoffAt(d, dow), c.deliver));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out.sort((a, b) => b.cutoff.getTime() - a.cutoff.getTime());
}
