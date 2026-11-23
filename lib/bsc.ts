/**
 * Bistro Social Club — lógica pura del evento (sin acceso a la base): ventana horaria, validación de pedidos,
 * promo por persona, cuentas de la comanda y exportación. Todo en hora de Costa Rica (UTC−6, sin horario de verano).
 * El servidor es la autoridad: del cliente solo se leen ids, variantes y cantidades; el precio sale de la carta.
 */
import type { BscCatId, BscItem, BscPay, BscPrep, BscSettings, BscVariant, Order, OrderBscLine } from "./types";
import { crc } from "./format";

export const BSC_CATS: { id: BscCatId; name: string; sub?: string }[] = [
  { id: "tragos", name: "Tragos de la casa" },
  { id: "bebidas", name: "Cerveza y vino" },
  { id: "picar", name: "Para picar", sub: "El primero va incluido con tu primer trago" },
];
const CAT_ORDER: Record<BscCatId, number> = { tragos: 0, bebidas: 1, picar: 2 };
const isCat = (v: unknown): v is BscCatId => v === "tragos" || v === "bebidas" || v === "picar";

export const MAX_QTY_PER_LINE = 20;
export const MAX_LINES = 30;
export const PAY_METHODS: BscPay[] = ["efectivo", "sinpe", "tarjeta"];
export const PAY_LABEL: Record<BscPay | "sin", string> = { efectivo: "Efectivo", sinpe: "SINPE Móvil", tarjeta: "Tarjeta", sin: "Sin método" };
/** Fotos disponibles en /public/bsc/fotos para asignar a un ítem desde el panel. */
export const BSC_PHOTOS = ["gintonic.jpg", "paloma.jpg", "playero.jpg", "papitas.jpg", "fondue.jpg", "guacamole.jpg", "platito.jpg", "hummus.jpg"];
/** Los pedidos de la primera edición (19/11/2026) se guardaron sin edición: se les asigna esta. */
export const LEGACY_EDITION = "2026-11-19";
export const PREP_FLOW: BscPrep[] = ["recibido", "preparando", "entregado"];
export const PREP_LABEL: Record<BscPrep, string> = { recibido: "Recibido", preparando: "En preparación", entregado: "Entregado" };

// ── Ventana de disponibilidad ────────────────────────────────

export type BscState = "before" | "open" | "ended";

/** Antes de abrir, abierto o terminado. Si las fechas no se entienden, falla cerrado («ended»). */
export function bscState(now: Date, s: Pick<BscSettings, "availableFrom" | "availableUntil">): BscState {
  const from = Date.parse(s.availableFrom);
  const until = Date.parse(s.availableUntil);
  if (!Number.isFinite(from) || !Number.isFinite(until)) return "ended";
  const t = now.getTime();
  if (t < from) return "before";
  if (t >= until) return "ended";
  return "open";
}

/** ¿Se ve la pestaña y se aceptan pedidos ahora? (interruptor encendido y dentro de la ventana) */
export const bscOpen = (now: Date, s: BscSettings): boolean => s.enabled && bscState(now, s) === "open";

/** «2026-11-19T00:00» (hora de Costa Rica, como lo escribe el panel) → ISO con zona. "" si no es una fecha real. */
export function crLocalToIso(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec((v || "").trim());
  if (!m) return "";
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const probe = new Date(Date.UTC(y, mo - 1, d, h + 6, mi)); // la hora CR + 6 h = UTC
  if (!Number.isFinite(probe.getTime())) return "";
  const back = new Date(probe.getTime() - 6 * 3600_000);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d || back.getUTCHours() !== h) return "";
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00-06:00`;
}

/** ISO → «2026-11-19T00:00» en hora de Costa Rica (para el campo del panel). "" si no es una fecha. */
export function isoToCrLocal(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t - 6 * 3600_000).toISOString().slice(0, 16);
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const WEEKDAYS_LONG = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** «JUE 19 NOV · 7:30 PM» en hora de Costa Rica (con `long`: «JUEVES 19 NOV · 7:30 PM»). */
export function crDateTimeLabel(iso: string, long = false): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const d = new Date(t - 6 * 3600_000);
  const h24 = d.getUTCHours();
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const wd = (long ? WEEKDAYS_LONG : WEEKDAYS)[d.getUTCDay()];
  return `${wd} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} · ${h12}:${mm} ${h24 < 12 ? "am" : "pm"}`.toUpperCase();
}

/** Hora corta en Costa Rica, p. ej. «7:42 p. m.» (para la comanda). */
export function crTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const d = new Date(t - 6 * 3600_000);
  const h24 = d.getUTCHours();
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(d.getUTCMinutes()).padStart(2, "0")} ${h24 < 12 ? "a. m." : "p. m."}`;
}

// ── Ediciones (cada jueves es una edición con su comanda y sus totales) ──────

/** «2026-11-19» a partir de un instante, en hora de Costa Rica. */
export function crDate(iso: string): string {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t - 6 * 3600_000).toISOString().slice(0, 10) : "";
}

export const orderEdition = (o: Pick<Order, "bscEdition">): string => o.bscEdition || LEGACY_EDITION;

/** «Jueves 19 nov» para el selector de ediciones. */
export function editionLabel(id: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(id || "");
  if (!m) return id || "";
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const wd = WEEKDAYS_LONG[d.getUTCDay()];
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

const shiftIso = (iso: string, days: number): string => {
  const local = isoToCrLocal(new Date(Date.parse(iso) + days * 86_400_000).toISOString());
  return crLocalToIso(local);
};

/**
 * Datos para arrancar la próxima edición: mueve el evento y la ventana `days` días (por defecto una semana, mismas horas)
 * y estrena un `editionId` nuevo. La comanda de la edición anterior queda intacta y consultable.
 */
export function nextEditionPatch(s: Pick<BscSettings, "startsAt" | "availableFrom" | "availableUntil">, days = 7): Pick<BscSettings, "editionId" | "startsAt" | "availableFrom" | "availableUntil"> {
  const startsAt = shiftIso(s.startsAt, days);
  return { editionId: crDate(startsAt), startsAt, availableFrom: shiftIso(s.availableFrom, days), availableUntil: shiftIso(s.availableUntil, days) };
}

/** Id estable a partir de un nombre («Mojito de maracuyá» → «mojito-de-maracuya»), sin repetir los ya usados. */
export function slugId(name: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = (name || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "item";
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
  return id;
}

/** Sube o baja un ítem dentro de su categoría (el orden de la carta es el del arreglo). */
export function moveItem(items: BscItem[], id: string, dir: -1 | 1): BscItem[] {
  const i = items.findIndex((x) => x.id === id);
  if (i < 0) return items;
  let j = i + dir;
  while (j >= 0 && j < items.length && items[j].cat !== items[i].cat) j += dir;
  if (j < 0 || j >= items.length) return items;
  const out = [...items];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

// ── Carta ────────────────────────────────────────────────────

export const activeItems = (items: BscItem[]): BscItem[] => items.filter((i) => i.active);

/** Precio de una unidad: el de la variante si lo trae; si no, el del ítem. */
export function unitPrice(item: BscItem, variant?: BscVariant): number {
  return variant?.price ?? item.price;
}

/** «Desde ₡3.500» / «₡5.000» (para el encabezado de cada tarjeta). */
export function priceLabel(item: BscItem): string {
  const prices = item.variants?.length ? item.variants.map((v) => unitPrice(item, v)) : [item.price];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? crc(min) : `${crc(min)} / ${crc(max)}`;
}

// ── Validación del pedido (autoridad del servidor) ──────────

export type BscOrderCheck =
  | { ok: true; name: string; whatsapp: string; table: string; notes: string; lines: OrderBscLine[]; total: number }
  | { ok: false; error: string; code: "closed" | "invalid" };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Valida un pedido contra la carta y la ventana. Cantidades: enteros de 1 a 20; las líneas repetidas se suman. */
export function checkBscOrder(
  input: Record<string, unknown>,
  s: BscSettings,
  now: Date = new Date(),
  opts: { ignoreWindow?: boolean } = {}
): BscOrderCheck {
  if (!opts.ignoreWindow && !bscOpen(now, s)) return { ok: false, error: "Bistro Social Club no está recibiendo pedidos ahora.", code: "closed" };
  const bad = (error: string): BscOrderCheck => ({ ok: false, error, code: "invalid" });

  const name = str(input.customerName, 80);
  if (!name) return bad("Falta tu nombre.");

  const phoneRaw = str(input.whatsapp, 30);
  const digits = phoneRaw.replace(/\D/g, "");
  if (phoneRaw && (digits.length < 8 || digits.length > 15)) return bad("Revisá tu teléfono: tiene que tener 8 dígitos.");

  const raw = Array.isArray(input.lines) ? input.lines : [];
  if (raw.length > MAX_LINES) return bad("Son demasiados ítems en un solo pedido.");
  const byId = new Map(s.items.map((i) => [i.id, i]));
  const merged = new Map<string, OrderBscLine>();
  for (const l of raw) {
    if (!l || typeof l !== "object") continue;
    const id = str((l as Record<string, unknown>).id, 40);
    const qtyN = Math.floor(Number((l as Record<string, unknown>).qty));
    if (!Number.isFinite(qtyN) || qtyN <= 0) continue;
    const item = byId.get(id);
    if (!item || !item.active) return bad("Hay un ítem que ya no está disponible. Revisá tu pedido.");
    let variant: BscVariant | undefined;
    if (item.variants?.length) {
      const vid = str((l as Record<string, unknown>).variantId, 40);
      variant = item.variants.find((v) => v.id === vid);
      if (!variant) return bad(`Elegí la variante de ${item.name}.`);
    }
    const key = `${item.id}:${variant?.id || ""}`;
    const cur = merged.get(key);
    const qty = Math.min(MAX_QTY_PER_LINE, (cur?.qty || 0) + qtyN);
    const up = unitPrice(item, variant);
    merged.set(key, {
      id: item.id,
      cat: item.cat,
      name: item.name,
      ...(variant ? { variantId: variant.id, variantName: variant.name } : {}),
      qty,
      unitPrice: up,
      subtotal: up * qty,
      ...(item.promoTrigger ? { promoTrigger: true } : {}),
      ...(item.promoEligible ? { promoEligible: true } : {}),
    });
  }
  const lines = [...merged.values()];
  if (lines.length === 0) return bad("Tu pedido está vacío.");
  return {
    ok: true,
    name,
    whatsapp: phoneRaw,
    table: str(input.table, 40),
    notes: str(input.notes, 300),
    lines,
    total: lines.reduce((t, l) => t + l.subtotal, 0),
  };
}

// ── Promo: «Primer plato para picar incluido con tu primer trago» ───────────

export interface PromoResult {
  applied: boolean;
  amount: number;
  /** El plato que sale incluido (el primero que pidió la persona). */
  item?: { orderId: string; lineIndex: number; name: string };
}

type PromoOrder = Pick<Order, "id" | "seq" | "createdAt" | "bsc">;

/**
 * Regla (por persona, una sola vez): con al menos 1 trago de la casa (`promoTrigger`) en la cuenta, el **primer**
 * plato para picar (`promoEligible`) que haya pedido esa persona sale a ₡0 — sin importar el orden en que pidió
 * trago y plato, ni en cuántos pedidos lo hizo. Cerveza y vino no activan la promo (no tienen `promoTrigger`).
 */
export function applyPromo(orders: PromoOrder[]): PromoResult {
  const sorted = [...orders].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.seq - b.seq);
  let hasTrigger = false;
  let free: PromoResult["item"] & { price: number } | undefined;
  for (const o of sorted) {
    (o.bsc || []).forEach((l, i) => {
      if (l.promoTrigger && l.qty > 0) hasTrigger = true;
      if (!free && l.promoEligible && l.qty > 0) free = { orderId: o.id, lineIndex: i, name: l.name, price: l.unitPrice };
    });
  }
  if (!hasTrigger || !free) return { applied: false, amount: 0 };
  return { applied: true, amount: free.price, item: { orderId: free.orderId, lineIndex: free.lineIndex, name: free.name } };
}

// ── Cuentas (la comanda agrupa por persona) ─────────────────

const normName = (n: string) =>
  (n || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Misma persona = mismo teléfono (últimos 8 dígitos); sin teléfono, mismo nombre exacto (sin tildes ni mayúsculas). */
export function accountKey(o: Pick<Order, "customerName" | "whatsapp">): string {
  const digits = (o.whatsapp || "").replace(/\D/g, "");
  return digits.length >= 8 ? `t:${digits.slice(-8)}` : `n:${normName(o.customerName)}`;
}

export interface BscAccount {
  key: string;
  name: string;
  whatsapp: string;
  table: string;
  orders: Order[];
  subtotal: number;
  promo: PromoResult;
  total: number;
  /** Cuenta pagada = todos sus pedidos pagados; un pedido nuevo la vuelve a abrir sola. */
  paid: boolean;
  lastAt: string;
  /** Pedidos que todavía no se entregaron. */
  pendingPrep: number;
  /** Cómo y cuándo se cobró (solo si la cuenta está pagada). */
  pay?: BscPay;
  paidAt?: string;
}

export const prepOf = (o: Pick<Order, "bscPrep">): BscPrep => o.bscPrep || "recibido";

/** Agrupa los pedidos del evento por persona: abiertas primero y, dentro de cada grupo, la más reciente arriba. */
export function buildAccounts(orders: Order[]): BscAccount[] {
  const groups = new Map<string, Order[]>();
  for (const o of orders) {
    if (o.kind !== "bsc") continue;
    const k = accountKey(o);
    groups.set(k, [...(groups.get(k) || []), o]);
  }
  const out: BscAccount[] = [];
  for (const [key, list] of groups) {
    const chrono = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.seq - b.seq);
    const last = chrono[chrono.length - 1];
    const promo = applyPromo(chrono);
    const subtotal = chrono.reduce((t, o) => t + o.total, 0);
    const paid = chrono.every((o) => o.status === "pagado");
    const payer = paid ? [...chrono].reverse().find((o) => o.bscPay) : undefined;
    out.push({
      key,
      name: last.customerName,
      whatsapp: [...chrono].reverse().find((o) => o.whatsapp)?.whatsapp || "",
      table: [...chrono].reverse().find((o) => o.bscTable)?.bscTable || "",
      orders: chrono,
      subtotal,
      promo,
      total: subtotal - promo.amount,
      paid,
      lastAt: last.createdAt,
      pendingPrep: chrono.filter((o) => prepOf(o) !== "entregado").length,
      ...(payer?.bscPay ? { pay: payer.bscPay } : {}),
      ...(paid ? { paidAt: chrono.map((o) => o.bscPaidAt || "").sort().pop() || undefined } : {}),
    });
  }
  return out.sort((a, b) => Number(a.paid) - Number(b.paid) || b.lastAt.localeCompare(a.lastAt));
}

export interface BscTotals {
  cuentas: number;
  abiertas: number;
  /** Facturado: suma de los totales de todas las cuentas (con la promo ya descontada), cobradas o no. */
  ventas: number;
  /** Suma de las líneas pedidas antes de la promo: ventas + promoMonto = bruto. */
  bruto: number;
  cobrado: number;
  porCobrar: number;
  promos: number;
  promoMonto: number;
  /** Lo cobrado, por método (las cuentas pagadas sin método van en «sin»). */
  porMetodo: Record<BscPay | "sin", number>;
  /** Por ítem y variante: lo pedido, lo que salió (entregado), lo que falta y lo facturado en bruto. */
  items: { key: string; cat: BscCatId; name: string; variantName?: string; qty: number; delivered: number; pending: number; revenue: number }[];
}

export function eventTotals(accounts: BscAccount[]): BscTotals {
  const items = new Map<string, BscTotals["items"][number]>();
  for (const a of accounts) {
    for (const o of a.orders) {
      const pend = prepOf(o) !== "entregado";
      for (const l of o.bsc || []) {
        const key = `${l.id}:${l.variantId || ""}`;
        const cur = items.get(key) || { key, cat: l.cat, name: l.name, variantName: l.variantName, qty: 0, delivered: 0, pending: 0, revenue: 0 };
        cur.qty += l.qty;
        cur.revenue += l.subtotal;
        if (pend) cur.pending += l.qty;
        else cur.delivered += l.qty;
        items.set(key, cur);
      }
    }
  }
  const sum = (f: (a: BscAccount) => number, pick: (a: BscAccount) => boolean = () => true) => accounts.filter(pick).reduce((t, a) => t + f(a), 0);
  const porMetodo: BscTotals["porMetodo"] = { efectivo: 0, sinpe: 0, tarjeta: 0, sin: 0 };
  for (const a of accounts) if (a.paid) porMetodo[a.pay || "sin"] += a.total;
  return {
    cuentas: accounts.length,
    abiertas: accounts.filter((a) => !a.paid).length,
    ventas: sum((a) => a.total),
    bruto: sum((a) => a.subtotal),
    cobrado: sum((a) => a.total, (a) => a.paid),
    porCobrar: sum((a) => a.total, (a) => !a.paid),
    promos: accounts.filter((a) => a.promo.applied).length,
    promoMonto: sum((a) => a.promo.amount),
    porMetodo,
    items: [...items.values()].sort((a, b) => CAT_ORDER[a.cat] - CAT_ORDER[b.cat] || b.qty - a.qty || a.name.localeCompare(b.name)),
  };
}

/** Pedidos y facturación por hora (hora de Costa Rica), de la primera a la última hora con movimiento. */
export function salesByHour(orders: Order[]): { hour: number; label: string; orders: number; bruto: number }[] {
  const by = new Map<number, { orders: number; bruto: number }>();
  for (const o of orders) {
    if (o.kind !== "bsc") continue;
    const t = Date.parse(o.createdAt);
    if (!Number.isFinite(t)) continue;
    const h = new Date(t - 6 * 3600_000).getUTCHours();
    const cur = by.get(h) || { orders: 0, bruto: 0 };
    cur.orders += 1;
    cur.bruto += o.total;
    by.set(h, cur);
  }
  if (by.size === 0) return [];
  const hs = [...by.keys()];
  // la noche cruza la medianoche: se ordena desde la hora más temprana «de la tarde» hacia la madrugada
  const key = (h: number) => (h < 12 ? h + 24 : h);
  const lo = Math.min(...hs.map(key));
  const hi = Math.max(...hs.map(key));
  const out = [];
  for (let k = lo; k <= hi; k++) {
    const h = k % 24;
    const v = by.get(h) || { orders: 0, bruto: 0 };
    out.push({ hour: h, label: `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "a. m." : "p. m."}`, ...v });
  }
  return out;
}

/** Resumen por edición (para comparar jueves entre sí). Más reciente primero. */
export function editionsSummary(orders: Order[]): { id: string; label: string; pedidos: number; cuentas: number; ventas: number; cobrado: number; promoMonto: number }[] {
  const ids = [...new Set(orders.filter((o) => o.kind === "bsc").map(orderEdition))];
  return ids
    .map((id) => {
      const mine = orders.filter((o) => o.kind === "bsc" && orderEdition(o) === id);
      const t = eventTotals(buildAccounts(mine));
      return { id, label: editionLabel(id), pedidos: mine.length, cuentas: t.cuentas, ventas: t.ventas, cobrado: t.cobrado, promoMonto: t.promoMonto };
    })
    .sort((a, b) => b.id.localeCompare(a.id));
}

// ── Exportación (CSV para conciliar al cierre) ─────────────

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Una fila por línea de pedido + una fila de cierre por cuenta (promo y total). Con BOM para que Excel respete las tildes. */
export function accountsCsv(accounts: BscAccount[]): string {
  const rows: (string | number)[][] = [
    ["Cuenta", "Teléfono", "Mesa", "Pedido", "Hora", "Origen", "Preparación", "Ítem", "Variante", "Cantidad", "Precio unitario", "Subtotal", "Estado de la cuenta", "Método de pago", "Cobrada a las"],
  ];
  for (const a of accounts) {
    for (const o of a.orders) {
      for (const l of o.bsc || []) {
        rows.push([a.name, a.whatsapp, a.table, o.id, crTime(o.createdAt), o.bscBy === "staff" ? "Staff" : "Cliente", PREP_LABEL[prepOf(o)], l.name, l.variantName || "", l.qty, l.unitPrice, l.subtotal, "", "", ""]);
      }
    }
    if (a.promo.applied) rows.push([a.name, a.whatsapp, a.table, "", "", "", "", `Promo: ${a.promo.item?.name || ""} incluido`, "", 1, -a.promo.amount, -a.promo.amount, "", "", ""]);
    rows.push([a.name, a.whatsapp, a.table, "", "", "", "", "TOTAL DE LA CUENTA", "", "", "", a.total, a.paid ? "Pagada" : "Abierta", a.pay ? PAY_LABEL[a.pay] : "", a.paidAt ? crTime(a.paidAt) : ""]);
  }
  return "﻿" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n");
}

// ── Configuración: saneado de lo que llega del panel ────────

/** Une lo guardado con los valores por defecto, descartando lo inválido (fechas rotas → ventana por defecto). */
export function normalizeBsc(raw: Partial<BscSettings> | null | undefined, defaults: BscSettings): BscSettings {
  const r = raw || {};
  const validIso = (v: unknown) => (typeof v === "string" && Number.isFinite(Date.parse(v)) ? v : "");
  let from = validIso(r.availableFrom) || defaults.availableFrom;
  let until = validIso(r.availableUntil) || defaults.availableUntil;
  if (Date.parse(from) >= Date.parse(until)) {
    from = defaults.availableFrom;
    until = defaults.availableUntil;
  }
  const seen = new Set<string>();
  const items: BscItem[] = Array.isArray(r.items)
    ? r.items
        .filter((i) => i && typeof i.id === "string" && isCat(i.cat) && typeof i.name === "string")
        .map((i): BscItem => {
          const variants = Array.isArray(i.variants)
            ? i.variants
                .filter((v) => v && typeof v.id === "string" && typeof v.name === "string")
                .slice(0, 6)
                .map((v): BscVariant => ({
                  id: str(v.id, 30),
                  name: str(v.name, 60) || "Opción",
                  ...(v.price !== undefined && Number.isFinite(Number(v.price)) ? { price: Math.min(1_000_000, Math.max(0, Math.floor(Number(v.price)))) } : {}),
                }))
                .filter((v) => v.id)
            : [];
          return {
            id: str(i.id, 30),
            cat: i.cat,
            name: str(i.name, 80) || "Ítem",
            ...(str(i.desc, 200) ? { desc: str(i.desc, 200) } : {}),
            price: Math.min(1_000_000, Math.max(0, Math.floor(Number(i.price)) || 0)),
            ...(variants.length ? { variants } : {}),
            ...(typeof i.image === "string" && /^[a-z0-9-]+\.(jpg|png|webp)$/.test(i.image) ? { image: i.image } : {}),
            ...(i.promoTrigger ? { promoTrigger: true } : {}),
            ...(i.promoEligible ? { promoEligible: true } : {}),
            active: i.active !== false,
          };
        })
        .filter((i) => i.id && !seen.has(i.id) && (seen.add(i.id), true))
    : defaults.items;
  return {
    enabled: r.enabled === undefined ? defaults.enabled : r.enabled !== false,
    slug: defaults.slug,
    name: str(r.name, 60) || defaults.name,
    venue: str(r.venue, 80) || defaults.venue,
    editionId: typeof r.editionId === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.editionId) ? r.editionId : crDate(validIso(r.startsAt) || defaults.startsAt),
    startsAt: validIso(r.startsAt) || defaults.startsAt,
    availableFrom: from,
    availableUntil: until,
    items: items.length ? items : defaults.items,
  };
}
