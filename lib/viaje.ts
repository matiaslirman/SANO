import type {
  Order,
  OrderViajeLine,
  ViajeCatId,
  ViajeItem,
  ViajePack,
  ViajeReward,
  ViajeSettings,
} from "./types";
import { crc } from "./format";

/**
 * Viaje Sano — lógica pura (sin servidor): la comparten la página del cliente, la API y el panel.
 *
 * Regla única de medida:
 *   1 porción  = lo que come 1 persona en un almuerzo o cena
 *   1 bandeja  = 4 porciones = 1 almuerzo o cena para 4 personas
 * Solo las bandejas de platos fuertes (lasañas, pechugas rellenas, arroz chaufa) cuentan como porciones y
 * llenan la meta. Acompañamientos, proteínas y salsas son extras: se suman aparte y no cuentan.
 */

export const PORTIONS_PER_TRAY = 4;

export interface ViajeCat {
  id: ViajeCatId;
  name: string;
  chip?: string;       // nombre corto para el botón de categoría
  sing: string;
  plur: string;
  rule: string;        // regla visible en el encabezado de la categoría
  unit: string;        // unidad visible en cada fila
  short: string;       // unidad corta (mensaje de WhatsApp)
  tray: boolean;       // ¿es un plato fuerte (bandeja de 4 porciones que cuenta)?
  perPortion: boolean; // ¿se muestra su precio por porción?
}

export const VIAJE_CATS: ViajeCat[] = [
  { id: "las", name: "Lasañas", sing: "lasaña", plur: "lasañas", rule: "Cada bandeja = 4 porciones", unit: "Bandeja de 4 porciones", short: "4 porciones", tray: true, perPortion: true },
  { id: "pec", name: "Pechugas rellenas con puré de papas", chip: "Pechugas", sing: "bandeja de pechugas rellenas", plur: "bandejas de pechugas rellenas", rule: "Cada bandeja = 4 porciones", unit: "Bandeja de 4 porciones", short: "4 porciones", tray: true, perPortion: true },
  { id: "cha", name: "Arroz chaufa", sing: "arroz chaufa", plur: "arroz chaufa", rule: "Cada bandeja = 4 porciones", unit: "Bandeja de 4 porciones", short: "4 porciones", tray: true, perPortion: true },
  { id: "aco", name: "Acompañamientos", sing: "acompañamiento", plur: "acompañamientos", rule: "Bandeja extra de 4 porciones", unit: "Extra · 4 porciones", short: "4 porciones", tray: false, perPortion: false },
  { id: "pro", name: "Proteínas", sing: "proteína", plur: "proteínas", rule: "500 g cada una", unit: "Extra · 500 g", short: "500 g", tray: false, perPortion: false },
  { id: "sal", name: "Salsas", sing: "salsa", plur: "salsas", rule: "250 g cada una", unit: "Extra · 250 g", short: "250 g", tray: false, perPortion: false },
];

export const VIAJE_CAT: Record<ViajeCatId, ViajeCat> = Object.fromEntries(VIAJE_CATS.map((c) => [c.id, c])) as Record<ViajeCatId, ViajeCat>;

export const isCatId = (v: unknown): v is ViajeCatId => typeof v === "string" && v in VIAJE_CAT;

/** Límites de seguridad de un pedido (la API los vuelve a aplicar). */
export const MAX_QTY_PER_LINE = 20;
export const MAX_LINES = 40;
export const MAX_PICKUP_AHEAD_DAYS = 180;
export const LEAD_DAYS_MIN = 1;
export const LEAD_DAYS_MAX = 21;

/** Carrito: id de producto -> cantidad. */
export type ViajeCart = Record<string, number>;

export const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

// ── Catálogo y cuentas ───────────────────────────────────────

export function indexItems(items: ViajeItem[]): Map<string, ViajeItem> {
  return new Map(items.map((i) => [i.id, i]));
}

/** Productos que se pueden pedir (activos), en el orden de sus categorías. */
export function activeItems(items: ViajeItem[]): ViajeItem[] {
  const order = new Map(VIAJE_CATS.map((c, i) => [c.id, i]));
  return items.filter((i) => i.active).sort((a, b) => (order.get(a.cat) ?? 99) - (order.get(b.cat) ?? 99));
}

const entries = (cart: ViajeCart) => Object.entries(cart).filter(([, q]) => q > 0);

/** Bandejas de platos fuertes del carrito. */
export function trays(cart: ViajeCart, items: ViajeItem[]): number {
  const idx = indexItems(items);
  return entries(cart).reduce((s, [id, q]) => s + (idx.get(id) && VIAJE_CAT[idx.get(id)!.cat].tray ? q : 0), 0);
}

export const portions = (cart: ViajeCart, items: ViajeItem[]) => trays(cart, items) * PORTIONS_PER_TRAY;

export function cartTotal(cart: ViajeCart, items: ViajeItem[]): number {
  const idx = indexItems(items);
  return entries(cart).reduce((s, [id, q]) => s + (idx.get(id)?.price ?? 0) * q, 0);
}

/** Lo que cuestan solo las bandejas de platos fuertes. */
export function traysTotal(cart: ViajeCart, items: ViajeItem[]): number {
  const idx = indexItems(items);
  return entries(cart).reduce((s, [id, q]) => {
    const it = idx.get(id);
    return s + (it && VIAJE_CAT[it.cat].tray ? it.price * q : 0);
  }, 0);
}

/** Precio por porción de plato fuerte (extras aparte), redondeado al colón. 0 si no hay platos fuertes. */
export function perPortion(cart: ViajeCart, items: ViajeItem[]): number {
  const p = portions(cart, items);
  return p ? Math.round(traysTotal(cart, items) / p) : 0;
}

/** Bandejas que hacen falta: personas × (almuerzos + cenas) / 4, hacia arriba. 0 si no hay comidas. */
export function neededTrays(people: number, lunches: number, dinners: number): number {
  const meals = Math.max(0, Math.floor(lunches)) + Math.max(0, Math.floor(dinners));
  const p = Math.max(0, Math.floor(people));
  if (!meals || !p) return 0;
  return Math.ceil((p * meals) / PORTIONS_PER_TRAY);
}

// ── Packs ───────────────────────────────────────────────────

/** ¿Todos los productos del pack están activos? Un pack con algo apagado no se ofrece. */
export function packAvailable(pack: ViajePack, items: ViajeItem[]): boolean {
  const idx = indexItems(items);
  const lines = entries(pack.items);
  return lines.length > 0 && lines.every(([id]) => idx.get(id)?.active);
}

export interface Recommendation {
  pack: ViajePack;
  diff: number;   // bandejas del pack − bandejas necesarias (+ sobra, − falta)
  base: boolean;  // true: el pack es solo un punto de partida y hay que sumar bandejas
}

/**
 * Recomienda el pack que mejor calza: solo si queda a una bandeja o menos de lo que se necesita.
 * Si no hay ninguno tan cerca, propone como base el pack más grande que no pase de lo necesario.
 */
export function recommendPack(needed: number, packs: ViajePack[], items: ViajeItem[]): Recommendation | null {
  if (needed <= 0) return null;
  const list = packs
    .filter((p) => packAvailable(p, items))
    .map((p) => ({ p, t: trays(p.items, items) }))
    .filter((x) => x.t > 0)
    .sort((a, b) => a.t - b.t);
  if (!list.length) return null;
  const scored = list
    .map((x) => ({ ...x, diff: x.t - needed }))
    .sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff) || b.diff - a.diff);
  const best = scored[0];
  if (Math.abs(best.diff) <= 1) return { pack: best.p, diff: best.diff, base: false };
  const below = list.filter((x) => x.t <= needed).pop() || list[0];
  return { pack: below.p, diff: below.t - needed, base: true };
}

// ── Regalo por volumen ──────────────────────────────────────

const activeRewards = (rewards: ViajeReward[]) => rewards.filter((r) => r.at > 0 && r.text.trim()).sort((a, b) => a.at - b.at);

/** El regalo más alto que ya se ganó con este total (o null). */
export function giftFor(total: number, rewards: ViajeReward[]): ViajeReward | null {
  const got = activeRewards(rewards).filter((r) => total >= r.at);
  return got.length ? got[got.length - 1] : null;
}

/** El próximo regalo por ganar (o null si ya llegó al último o no hay). */
export function nextReward(total: number, rewards: ViajeReward[]): ViajeReward | null {
  return activeRewards(rewards).find((r) => total < r.at) || null;
}

// ── Fecha de retiro (hora de Costa Rica, UTC-6 todo el año) ──

const CR_OFFSET_MS = 6 * 3600 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const pad2 = (n: number) => String(n).padStart(2, "0");
const isoOfUTC = (d: Date) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;

/** Fecha de hoy en Costa Rica como YYYY-MM-DD (el cambio de día es a las 06:00 UTC). */
export function crToday(now: Date = new Date()): string {
  return isoOfUTC(new Date(now.getTime() - CR_OFFSET_MS));
}

/** Suma días a una fecha YYYY-MM-DD. */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoOfUTC(d);
}

/** Primera fecha de retiro posible: hoy (hora CR) + anticipación. */
export function minPickupDate(now: Date = new Date(), leadDays: number = 7): string {
  return addDays(crToday(now), clampLead(leadDays));
}

export function clampLead(n: unknown): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return 7;
  return Math.min(LEAD_DAYS_MAX, Math.max(LEAD_DAYS_MIN, v));
}

/** ¿Es una fecha real del calendario, con formato YYYY-MM-DD? */
export function isRealDate(v: unknown): v is string {
  if (typeof v !== "string" || !DATE_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && isoOfUTC(d) === v;
}

/** ¿La fecha cumple la anticipación mínima y no queda absurdamente lejos? */
export function isValidPickup(date: unknown, now: Date = new Date(), leadDays: number = 7): date is string {
  if (!isRealDate(date)) return false;
  const min = minPickupDate(now, leadDays);
  return date >= min && date <= addDays(crToday(now), MAX_PICKUP_AHEAD_DAYS);
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MESES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "sábado 20 de diciembre" */
export function longDate(iso: string): string {
  if (!isRealDate(iso)) return "";
  const d = new Date(`${iso}T12:00:00.000Z`);
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}

/** "sáb 20 dic" */
export function shortDate(iso: string): string {
  if (!isRealDate(iso)) return "";
  const d = new Date(`${iso}T12:00:00.000Z`);
  return `${DIAS[d.getUTCDay()].slice(0, 3)} ${d.getUTCDate()} ${MESES_CORTO[d.getUTCMonth()]}`;
}

// ── Cambiar sabor ───────────────────────────────────────────

export interface SwapOption {
  item: ViajeItem;
  diff: number; // precio de la opción − precio actual
}

/** Otras opciones activas de la misma categoría, con la diferencia de precio. */
export function swapOptions(id: string, items: ViajeItem[]): SwapOption[] {
  const cur = items.find((i) => i.id === id);
  if (!cur) return [];
  return items.filter((i) => i.active && i.cat === cur.cat && i.id !== id).map((item) => ({ item, diff: item.price - cur.price }));
}

/** Cambia 1 unidad de `from` por `to` (misma categoría). Devuelve un carrito nuevo. */
export function swapOne(cart: ViajeCart, from: string, to: string): ViajeCart {
  const next = { ...cart };
  next[from] = (next[from] || 1) - 1;
  if (next[from] <= 0) delete next[from];
  next[to] = (next[to] || 0) + 1;
  return next;
}

/** ¿El carrito es exactamente el contenido del pack? (para marcarlo «editado» si no) */
export function isPackEdited(cart: ViajeCart, pack: ViajePack): boolean {
  const ids = new Set([...Object.keys(pack.items), ...Object.keys(cart)]);
  for (const id of ids) if ((pack.items[id] || 0) !== (cart[id] || 0)) return true;
  return false;
}

// ── Pedido: validación y armado (el servidor es la autoridad de precios) ──

export interface ViajeOrderInput {
  customerName?: unknown;
  whatsapp?: unknown;
  notes?: unknown;
  pickupDate?: unknown;
  packId?: unknown;
  lines?: unknown;
}

export type ViajeOrderCheck =
  | {
      ok: true;
      name: string;
      whatsapp: string;
      notes: string;
      pickupDate: string;
      packId?: string;
      lines: OrderViajeLine[];
      total: number;
      gift: ViajeReward | null;
    }
  | { ok: false; error: string };

/** Valida un pedido contra la configuración actual y arma las líneas con los precios del servidor. */
export function checkViajeOrder(input: ViajeOrderInput, s: ViajeSettings, now: Date = new Date()): ViajeOrderCheck {
  const name = typeof input.customerName === "string" ? input.customerName.trim().slice(0, 80) : "";
  if (!name) return { ok: false, error: "Falta tu nombre." };

  if (!isRealDate(input.pickupDate)) return { ok: false, error: "Elegí el día de retiro." };
  if (!isValidPickup(input.pickupDate, now, s.leadDays)) {
    return { ok: false, error: `Pedí con ${s.leadDays} ${plural(s.leadDays, "día", "días")} de anticipación: elegí desde el ${longDate(minPickupDate(now, s.leadDays))}.` };
  }

  if (!Array.isArray(input.lines) || input.lines.length === 0) return { ok: false, error: "Tu pedido está vacío." };
  if (input.lines.length > MAX_LINES) return { ok: false, error: "El pedido tiene demasiados productos distintos." };

  const idx = indexItems(s.items);
  const merged = new Map<string, number>();
  for (const raw of input.lines as unknown[]) {
    const l = raw as { id?: unknown; qty?: unknown };
    const id = typeof l?.id === "string" ? l.id : "";
    const qty = Math.floor(Number(l?.qty));
    const it = idx.get(id);
    if (!it || !it.active) return { ok: false, error: "Hay un producto que ya no está disponible. Revisá tu pedido." };
    if (!Number.isFinite(qty) || qty < 1) continue;
    merged.set(id, Math.min(MAX_QTY_PER_LINE, (merged.get(id) || 0) + qty));
  }
  if (merged.size === 0) return { ok: false, error: "Tu pedido está vacío." };

  const lines: OrderViajeLine[] = [];
  for (const [id, qty] of merged) {
    const it = idx.get(id)!;
    lines.push({ id, cat: it.cat, name: it.name, qty, unitPrice: it.price, subtotal: it.price * qty });
  }
  const order = new Map(VIAJE_CATS.map((c, i) => [c.id, i]));
  lines.sort((a, b) => (order.get(a.cat) ?? 99) - (order.get(b.cat) ?? 99));
  const total = lines.reduce((sum, l) => sum + l.subtotal, 0);

  const packId = typeof input.packId === "string" && s.packs.some((p) => p.id === input.packId) ? (input.packId as string) : undefined;
  return {
    ok: true,
    name,
    whatsapp: typeof input.whatsapp === "string" ? input.whatsapp.trim().slice(0, 40) : "",
    notes: typeof input.notes === "string" ? input.notes.trim().slice(0, 500) : "",
    pickupDate: input.pickupDate,
    packId,
    lines,
    total,
    gift: giftFor(total, s.rewards),
  };
}

/** Carrito (id -> cantidad) a partir de las líneas de un pedido. */
export function cartOfLines(lines: OrderViajeLine[]): ViajeCart {
  const cart: ViajeCart = {};
  for (const l of lines) cart[l.id] = (cart[l.id] || 0) + l.qty;
  return cart;
}

/** Porciones y bandejas de un pedido guardado (usa la categoría de cada línea, no el catálogo actual). */
export function orderTrays(lines: OrderViajeLine[]): number {
  return lines.reduce((s, l) => s + (VIAJE_CAT[l.cat]?.tray ? l.qty : 0), 0);
}

export const lyc = (n: number) => `${n} ${plural(n, "almuerzo o cena", "almuerzos o cenas")}`;

// ── Mensajes de WhatsApp ────────────────────────────────────

/** Mensaje del cliente al confirmar su pedido (se arma con el pedido ya creado por el servidor). */
export function viajeOrderMessage(order: Order): string {
  const L: string[] = [];
  L.push("¡Hola Sano! 👋 Quiero confirmar mi pedido de VIAJE SANO:");
  L.push("");
  L.push(`*Orden ${order.id}* · ${order.customerName}`);
  L.push(order.pickupDate ? `Retiro que prefiero: ${longDate(order.pickupDate)}. ¿Me confirmás fecha y hora?` : "Retiro: a coordinar.");
  L.push("📍 Retiro en el local (pick-up). Si necesito envío, lo coordino por mi cuenta.");
  const lines = order.viaje || [];
  for (const cat of VIAJE_CATS) {
    const rows = lines.filter((l) => l.cat === cat.id);
    if (!rows.length) continue;
    L.push("", `*${cat.name.toUpperCase()}*`);
    for (const l of rows) L.push(`x${l.qty}  ${l.name} (${cat.short}) — ${crc(l.subtotal)}`);
  }
  const t = orderTrays(lines);
  L.push("");
  if (t) L.push(`Platos fuertes: ${t * PORTIONS_PER_TRAY} porciones (${lyc(t)} para 4 personas)`);
  L.push(`*TOTAL: ${crc(order.total)}*`);
  if (order.viajeGift) L.push(`🎁 ${order.viajeGift} (la elijo al confirmar)`);
  if (order.notes) L.push("", `📝 ${order.notes}`);
  return L.join("\n");
}

/** Teléfono tico a formato wa.me: 8 dígitos llevan 506 adelante. "" si no sirve. */
export function waNumber(raw: string | undefined): string {
  const d = (raw || "").replace(/\D/g, "");
  if (d.length === 8) return `506${d}`;
  return d.length >= 10 ? d : "";
}

/** Mensaje del dueño para confirmar la fecha de retiro (y pedir la hora). */
export function confirmPickupMessage(order: Order): string {
  const first = (order.customerName || "").trim().split(/\s+/)[0] || "";
  return [
    `¡Hola ${first}! Te escribimos de SANO.`,
    `Tu pedido ${order.id} de Viaje Sano queda para el ${order.pickupDate ? longDate(order.pickupDate) : "día que elegiste"}.`,
    "¿A qué hora pasás a retirarlo? Recordá llevar una hielera para mantener la cadena de frío.",
  ].join("\n");
}

/** Mensaje de «Avisame cuando abra» (la tarjeta «Disponible pronto»). */
export function viajeAlertMessage(): string {
  return "Hola Sano 👋 Avisame apenas abra Viaje Sano (las bandejas para llevar de viaje), por favor.";
}

// ── Configuración: saneado de lo que llega del panel ────────

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Une la configuración guardada con los valores por defecto, descartando lo inválido. */
export function normalizeViaje(raw: Partial<ViajeSettings> | null | undefined, defaults: ViajeSettings): ViajeSettings {
  const r = raw || {};
  const estado = r.estado === "oculto" || r.estado === "pronto" || r.estado === "abierto" ? r.estado : defaults.estado;

  const items: ViajeItem[] = Array.isArray(r.items)
    ? r.items
        .filter((i) => i && typeof i.id === "string" && isCatId(i.cat) && typeof i.name === "string")
        .map((i) => ({
          id: i.id.slice(0, 20),
          cat: i.cat,
          name: str(i.name, 90) || "Producto",
          ...(str(i.desc, 90) ? { desc: str(i.desc, 90) } : {}),
          price: Math.min(10_000_000, Math.max(0, Math.floor(Number(i.price)) || 0)),
          active: i.active !== false,
        }))
    : defaults.items;

  const ids = new Set(items.map((i) => i.id));
  const packs: ViajePack[] = Array.isArray(r.packs)
    ? r.packs
        .filter((p) => p && typeof p.id === "string" && p.items && typeof p.items === "object")
        .map((p) => ({
          id: p.id.slice(0, 20),
          name: str(p.name, 40) || "Pack",
          items: Object.fromEntries(
            Object.entries(p.items)
              .filter(([id, q]) => ids.has(id) && Number.isFinite(Number(q)) && Number(q) > 0)
              .map(([id, q]) => [id, Math.min(MAX_QTY_PER_LINE, Math.floor(Number(q)))])
          ),
        }))
        .filter((p) => Object.keys(p.items).length > 0)
    : defaults.packs;

  const rewards: ViajeReward[] = Array.isArray(r.rewards)
    ? r.rewards
        .filter((w) => w && Number.isFinite(Number(w.at)))
        .map((w) => ({ at: Math.min(10_000_000, Math.max(0, Math.floor(Number(w.at)))), text: str(w.text, 60) }))
        .slice(0, 4)
    : defaults.rewards;

  return {
    estado,
    fecha: str(r.fecha, 40) || defaults.fecha,
    destacar: r.destacar === "viaje" ? "viaje" : r.destacar === "semana" ? "semana" : defaults.destacar,
    leadDays: r.leadDays === undefined ? defaults.leadDays : clampLead(r.leadDays),
    chainText: str(r.chainText, 220) || defaults.chainText,
    rewards,
    items,
    packs,
  };
}
