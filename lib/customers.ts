/**
 * Agrupar pedidos por cliente real aunque el nombre se haya escrito distinto
 * ("Juan Pérez", "juan perez", "Juan Peres"), para saber cuántos pedidos lleva cada uno.
 *
 * Conservador a propósito (mismo criterio que lib/dishes.ts):
 *  - El correo manda más que nada (es la llave de la tarjeta de sellos): mismo correo → mismo cliente,
 *    aunque el nombre o el teléfono cambien; dos correos distintos → personas distintas.
 *  - Después, el teléfono: mismo número → mismo cliente, aunque el nombre cambie.
 *  - Dos teléfonos distintos → personas distintas, aunque el nombre sea igual.
 *  - Sin teléfono, solo se unen nombres casi idénticos (tildes, mayúsculas, hasta ~2 letras
 *    de diferencia en nombres largos). "Ana" ≠ "Ana María"; "Juan Pérez" ≠ "Juan Pereira".
 */

import { normalizeEmail } from "./contact";

const MIN_LEN_FUZZY = 10; // nombres cortos solo se unen si son idénticos ya normalizados
export const NAME_SIMILARITY = 0.88;

/** Minúsculas, sin tildes ni signos, espacios colapsados. */
export function normalizeName(name: string): string {
  return (name || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Clave del teléfono: últimos 8 dígitos (un número tico sin 506 ni espacios). Vacío si no hay uno usable. */
export function phoneKey(phone: string | undefined): string {
  const d = (phone || "").replace(/\D+/g, "");
  return d.length >= 8 ? d.slice(-8) : "";
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** ¿Es la misma persona escrita distinto? Entrada: nombres ya normalizados. */
export function sameName(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.split(" ").length !== b.split(" ").length) return false; // "Ana" ≠ "Ana María"
  if (Math.min(a.length, b.length) < MIN_LEN_FUZZY) return false;
  const sim = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
  return sim >= NAME_SIMILARITY;
}

export interface CustomerOrder {
  customerName: string;
  whatsapp?: string;
  email?: string;
  createdAt: string;
  total: number;
  status: string;
  eventId?: string;
}

export interface CustomerGroup {
  name: string;        // nombre que se muestra (la escritura más usada)
  orders: number;      // pedidos de este cliente
  paidOrders: number;
  paidTotal: number;   // CRC de los pagados
  lastOrderAt: string; // ISO del último pedido
  variants: string[];  // otras escrituras que se unieron
  email?: string;      // último correo conocido
  byPhone: boolean;    // true si alguna unión se hizo por teléfono
  byEmail: boolean;    // true si alguna unión se hizo por correo
}

interface Acc {
  key: string;                 // nombre normalizado del primer pedido (referencia para comparar)
  phones: Set<string>;
  emails: Set<string>;
  lastEmail: string;
  names: Map<string, number>;  // escritura original -> veces
  orders: number;
  paidOrders: number;
  paidTotal: number;
  lastOrderAt: string;
  byPhone: boolean;
  byEmail: boolean;
}

/** Agrupa los pedidos (sin los de evento privado) por cliente. Ordenado por pedidos, luego por último pedido. */
export function groupCustomers(all: CustomerOrder[]): CustomerGroup[] {
  const orders = all
    .filter((o) => !o.eventId && normalizeName(o.customerName))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const groups: Acc[] = [];
  for (const o of orders) {
    const nameKey = normalizeName(o.customerName);
    const ph = phoneKey(o.whatsapp);
    const em = normalizeEmail(o.email);

    let g: Acc | undefined;
    let viaPhone = false;
    let viaEmail = false;
    if (em) {
      g = groups.find((x) => x.emails.has(em));
      viaEmail = !!g && !sameName(g.key, nameKey);
    }
    if (!g && ph) {
      // por teléfono, salvo que el correo diga que es otra persona
      g = groups.find((x) => x.phones.has(ph) && (!em || x.emails.size === 0));
      viaPhone = !!g && !sameName(g.key, nameKey);
    }
    if (!g) {
      // por nombre: solo con grupos que no tengan un teléfono o un correo distinto al de este pedido
      const cands = groups.filter(
        (x) =>
          sameName(x.key, nameKey) &&
          (!ph || x.phones.size === 0 || x.phones.has(ph)) &&
          (!em || x.emails.size === 0 || x.emails.has(em))
      );
      g = cands.sort((a, b) => b.orders - a.orders)[0];
    }
    if (!g) {
      g = {
        key: nameKey,
        phones: new Set(),
        emails: new Set(),
        lastEmail: "",
        names: new Map(),
        orders: 0,
        paidOrders: 0,
        paidTotal: 0,
        lastOrderAt: o.createdAt,
        byPhone: false,
        byEmail: false,
      };
      groups.push(g);
    }
    if (ph) g.phones.add(ph);
    if (em) {
      g.emails.add(em);
      g.lastEmail = em;
    }
    if (viaPhone) g.byPhone = true;
    if (viaEmail) g.byEmail = true;
    const written = o.customerName.trim().replace(/\s+/g, " ");
    g.names.set(written, (g.names.get(written) || 0) + 1);
    g.orders += 1;
    if (o.status === "pagado") {
      g.paidOrders += 1;
      g.paidTotal += o.total || 0;
    }
    if (o.createdAt > g.lastOrderAt) g.lastOrderAt = o.createdAt;
  }

  return groups
    .map((g): CustomerGroup => {
      const names = [...g.names.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);
      return {
        name: names[0][0],
        orders: g.orders,
        paidOrders: g.paidOrders,
        paidTotal: g.paidTotal,
        lastOrderAt: g.lastOrderAt,
        variants: names.slice(1).map((n) => n[0]),
        ...(g.lastEmail ? { email: g.lastEmail } : {}),
        byPhone: g.byPhone,
        byEmail: g.byEmail,
      };
    })
    .sort((a, b) => b.orders - a.orders || b.lastOrderAt.localeCompare(a.lastOrderAt) || a.name.localeCompare(b.name));
}
