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

export function getNextWindow(now: Date = new Date()): DeliveryWindow {
  const thu = nextCutoffForDow(now, 4); // Jueves -> Viernes
  const sat = nextCutoffForDow(now, 6); // Sábado -> Lunes
  const isThu = thu.getTime() <= sat.getTime();
  const cutoff = isThu ? thu : sat;
  const offset = isThu ? 1 : 2; // días desde el cierre hasta la entrega

  const delivery = new Date(cutoff.getTime());
  delivery.setUTCDate(delivery.getUTCDate() + offset);

  const dLabel = DIAS[delivery.getUTCDay()];
  const day = delivery.getUTCDate();
  const month = delivery.getUTCMonth();

  return {
    id: cutoff.toISOString().slice(0, 10),
    cutoff,
    cutoffISO: cutoff.toISOString(),
    deliveryLabel: dLabel,
    deliveryDateLabel: `${dLabel} ${day} de ${MESES[month]}`,
    shortLabel: `Entrega ${dLabel} ${day} ${MESES_CORTO[month]}`,
  };
}
