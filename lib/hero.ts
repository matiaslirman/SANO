import type { ComboTier, HeroPillMode, Settings } from "./types";
import { crc } from "./format";

/** Cuántas horas antes del cierre aparece el contador del hero (valor por defecto; editable en Contenido). */
export const HERO_PILL_DEFAULT_HOURS = 2;
export const HERO_PILL_MAX_HOURS = 72;

const MODES: HeroPillMode[] = ["auto", "siempre", "nunca"];

/** Modo y horas del contador del hero, con valores por defecto y saneados (para el sitio público). */
export function resolveHeroPill(s: Pick<Settings, "heroPillMode" | "heroPillHours">): { mode: HeroPillMode; hours: number } {
  const mode = MODES.includes(s.heroPillMode as HeroPillMode) ? (s.heroPillMode as HeroPillMode) : "auto";
  const h = Math.floor(Number(s.heroPillHours));
  const hours = Number.isFinite(h) && h >= 1 ? Math.min(h, HERO_PILL_MAX_HOURS) : HERO_PILL_DEFAULT_HOURS;
  return { mode, hours };
}

/**
 * ¿Se muestra el contador (pill) del hero?
 * - "siempre": siempre. - "nunca": nunca.
 * - "auto": solo cuando faltan `hours` horas o menos para el cierre; después del cierre queda escondido.
 * `minutesLeft` es Infinity hasta que el reloj del cliente arranca (así no aparece antes de tiempo).
 */
export function shouldShowHeroPill(mode: HeroPillMode, hours: number, minutesLeft: number, closed: boolean): boolean {
  if (mode === "siempre") return true;
  if (mode === "nunca") return false;
  return !closed && minutesLeft <= hours * 60;
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** Día de la semana del cierre en hora de Costa Rica (UTC-6): "sábado". */
export function cutoffDayLabel(cutoffISO: string): string {
  const t = new Date(cutoffISO).getTime();
  if (Number.isNaN(t)) return "";
  return DIAS[new Date(t - 6 * 3600 * 1000).getUTCDay()];
}

/** "Pedidos abiertos hasta el sábado 12 md · Retiro lunes 19 de octubre" */
export function closingLine(cutoffISO: string, deliveryDateLabel: string): string {
  const day = cutoffDayLabel(cutoffISO);
  if (!day) return "";
  const retiro = deliveryDateLabel ? ` · Retiro ${deliveryDateLabel.charAt(0).toLowerCase()}${deliveryDateLabel.slice(1)}` : "";
  return `Pedidos abiertos hasta el ${day} 12 md${retiro}`;
}

/** "Platos desde ₡5.500 · Combo de 6 por ₡31.000" (con los precios reales del sitio). */
export function heroPriceLine(basePrice: number, combos: ComboTier[]): string {
  const first = [...combos].sort((a, b) => a.min - b.min)[0];
  const base = `Platos desde ${crc(basePrice)}`;
  return first ? `${base} · Combo de ${first.min} por ${crc(first.price)}` : base;
}
