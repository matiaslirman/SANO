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
