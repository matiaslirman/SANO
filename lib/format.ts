/**
 * Formato de colones costarricenses: ₡56.500
 * (sin decimales, punto como separador de miles).
 * Implementación determinística para que coincida en server y cliente
 * (evita mismatches de hidratación).
 */
export function crc(n: number): string {
  const neg = n < 0;
  const rounded = Math.round(Math.abs(n));
  const s = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (neg ? "-" : "") + "₡" + s;
}

/** "Viernes 19 de septiembre" -> "vie 19 sep" (para los botones de día de retiro). Si no se entiende, lo devuelve igual. */
export function shortDeliveryLabel(label: string): string {
  const m = /^(\S+)\s+(\d{1,2})\s+de\s+(\S+)$/i.exec((label || "").trim());
  if (!m) return label;
  return `${m[1].slice(0, 3).toLowerCase()} ${m[2]} ${m[3].slice(0, 3).toLowerCase()}`;
}
