import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { Redis } from "@upstash/redis";
import type { Settings, MarketCategory, Order, OrderStatus, EventSettings, PublicStatus } from "./types";
import { DEFAULT_SETTINGS, DEFAULT_MARKET, DEFAULT_EVENT } from "./defaults";
import { getNextWindow, getClientWindows, windowFromId } from "./windows";
import { priceForDishes } from "./pricing";

const K = {
  settings: "sano:settings",
  market: "sano:market",
  orders: "sano:orders", // hash: id -> Order
  seq: "sano:orderseq",
  kitchen: "sano:kitchen", // hash: windowId -> string[] (claves de ítems completados)
  event: "sano:event", // configuración del evento privado
};

/** Clave estable del evento (agrupa sus pedidos) derivada del título. */
export function eventKeyFromTitle(title: string): string {
  const slug = (title || "evento")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `evt-${slug || "evento"}`;
}

// Piso del contador de órdenes: el próximo número real del negocio arranca en 223.
// El contador nunca baja de acá, así los IDs siguen la numeración real (SANO-223, 224…).
const ORDER_SEQ_FLOOR = 222;

// ── Backend selection ─────────────────────────────────────────
// Detecta las credenciales del store Redis (Upstash / Vercel KV) sin importar
// el nombre exacto que Vercel les haya puesto (con o sin prefijo). Prueba los
// nombres conocidos y, si no, escanea cualquier variable *REST_API_URL /
// *REDIS_REST_URL y su token de escritura.
function kvEnv() {
  const e = process.env;
  let url =
    e.KV_REST_API_URL ||
    e.UPSTASH_REDIS_REST_URL ||
    e.REDIS_REST_API_URL ||
    "";
  let token =
    e.KV_REST_API_TOKEN ||
    e.UPSTASH_REDIS_REST_TOKEN ||
    e.REDIS_REST_API_TOKEN ||
    "";

  if (!url) {
    const key = Object.keys(e).find(
      (k) => /(REST_API_URL|REDIS_REST_URL)$/i.test(k) && String(e[k]).startsWith("https://")
    );
    if (key) url = e[key] || "";
  }
  if (!token) {
    const key = Object.keys(e).find(
      (k) => /(REST_API_TOKEN|REDIS_REST_TOKEN)$/i.test(k) && !/READ_ONLY/i.test(k) && e[k]
    );
    if (key) token = e[key] || "";
  }
  return url && token ? { url, token } : null;
}

export function isPersistent(): boolean {
  return kvEnv() !== null;
}

let _redis: Redis | null = null;
function redis(): Redis {
  if (!_redis) {
    const env = kvEnv();
    if (!env) throw new Error("KV no configurado");
    _redis = new Redis({ url: env.url, token: env.token });
  }
  return _redis;
}

// ── Input from the client when creating an order ──────────────
export interface NewOrderInput {
  customerName: string;
  whatsapp?: string;
  notes?: string;
  windowId?: string; // entrega elegida por el cliente (una de las ofrecidas)
  dishes: { name: string; qty: number }[];
  market: { category: string; name: string; qty: number }[];
}

// ── Public API ────────────────────────────────────────────────
export const store = {
  isPersistent,

  async getSettings(): Promise<Settings> {
    if (isPersistent()) {
      const s = (await redis().get<Settings>(K.settings)) || null;
      if (!s) {
        await redis().set(K.settings, DEFAULT_SETTINGS);
        return DEFAULT_SETTINGS;
      }
      return { ...DEFAULT_SETTINGS, ...s };
    }
    const db = await readFile();
    return db.settings;
  },

  async saveSettings(patch: Partial<Settings>): Promise<Settings> {
    const current = await this.getSettings();
    const next: Settings = { ...current, ...patch };
    if (isPersistent()) {
      await redis().set(K.settings, next);
    } else {
      const db = await readFile();
      db.settings = next;
      await writeFile(db);
    }
    return next;
  },

  async getMarket(): Promise<MarketCategory[]> {
    if (isPersistent()) {
      const m = (await redis().get<MarketCategory[]>(K.market)) || null;
      if (!m) {
        await redis().set(K.market, DEFAULT_MARKET);
        return DEFAULT_MARKET;
      }
      return m;
    }
    const db = await readFile();
    return db.market;
  },

  async saveMarket(market: MarketCategory[]): Promise<MarketCategory[]> {
    if (isPersistent()) {
      await redis().set(K.market, market);
    } else {
      const db = await readFile();
      db.market = market;
      await writeFile(db);
    }
    return market;
  },

  // ── Evento privado ──────────────────────────────────────────
  async getEvent(): Promise<EventSettings> {
    if (isPersistent()) {
      const e = (await redis().get<EventSettings>(K.event)) || null;
      if (!e) {
        await redis().set(K.event, DEFAULT_EVENT);
        return DEFAULT_EVENT;
      }
      return { ...DEFAULT_EVENT, ...e };
    }
    const db = await readFile();
    return db.event || DEFAULT_EVENT;
  },

  async saveEvent(patch: Partial<EventSettings>): Promise<EventSettings> {
    const current = await this.getEvent();
    const next: EventSettings = { ...current, ...patch };
    if (isPersistent()) {
      await redis().set(K.event, next);
    } else {
      const db = await readFile();
      db.event = next;
      await writeFile(db);
    }
    return next;
  },

  /**
   * Estado público del evento con la forma de `PublicStatus` (para reusar el
   * componente de pedido). Una sola ventana fija con la etiqueta del evento y
   * los cupos del evento. Los precios (basePrice/combos) son los globales.
   */
  async getEventStatus(): Promise<{ event: EventSettings; eventId: string; status: PublicStatus }> {
    const settings = await this.getSettings();
    const event = await this.getEvent();
    const eventId = eventKeyFromTitle(event.title);
    const orders = await this.listOrders();
    const confirmados = orders.filter((o) => o.status === "pagado" && o.eventId === eventId).length;
    const status: PublicStatus = {
      menu: event.menu,
      weekLabel: event.title,
      basePrice: settings.basePrice,
      combos: settings.combos,
      windows: [
        {
          id: eventId,
          // Sin cierre real: el evento no usa el countdown de la home.
          cutoffISO: new Date(Date.now() + 365 * 864e5).toISOString(),
          deliveryLabel: "",
          deliveryDateLabel: event.deliveryLabel,
          cuposTotales: event.cuposTotales,
          cuposDisponibles: Math.max(0, event.cuposTotales - confirmados),
        },
      ],
    };
    return { event, eventId, status };
  },

  async listOrders(): Promise<Order[]> {
    let orders: Order[];
    if (isPersistent()) {
      const all = (await redis().hgetall<Record<string, Order>>(K.orders)) || {};
      orders = Object.values(all);
    } else {
      const db = await readFile();
      orders = Object.values(db.orders);
    }
    return orders.sort((a, b) => b.seq - a.seq);
  },

  async getOrder(id: string): Promise<Order | null> {
    if (isPersistent()) {
      return (await redis().hget<Order>(K.orders, id)) || null;
    }
    const db = await readFile();
    return db.orders[id] || null;
  },

  async createOrder(input: NewOrderInput): Promise<Order> {
    const settings = await this.getSettings();
    const market = await this.getMarket();
    // Ventana del ciclo actual (atado al menú). Respeta la elegida por el cliente
    // si sigue abierta; si no (ej. pedido tardío), cae en la del ciclo actual.
    const offered = getClientWindows(settings.menuPublishedAt);
    const win = offered.find((w) => w.id === input.windowId) || offered[0] || getNextWindow();

    // Dishes: only keep known menu items with qty > 0
    const dishes = (input.dishes || [])
      .filter((d) => d.qty > 0 && settings.menu.includes(d.name))
      .map((d) => ({ name: d.name, qty: Math.floor(d.qty) }));
    const dishesQty = dishes.reduce((s, d) => s + d.qty, 0);
    const dishesTotal = priceForDishes(dishesQty, settings.basePrice, settings.combos);

    // Market: resolve unit price from the catalog (server authoritative)
    const marketLines = [];
    for (const m of input.market || []) {
      if (!m.qty || m.qty <= 0) continue;
      const cat = market.find((c) => c.name === m.category);
      if (!cat || !cat.items.includes(m.name)) continue;
      const qty = Math.floor(m.qty);
      marketLines.push({
        category: cat.name,
        name: m.name,
        qty,
        unitPrice: cat.price,
        subtotal: qty * cat.price,
      });
    }
    const marketTotal = marketLines.reduce((s, l) => s + l.subtotal, 0);

    const seq = await this.nextSeq();
    const id = `SANO-${seq}`;
    const order: Order = {
      id,
      seq,
      createdAt: new Date().toISOString(),
      windowId: win.id,
      windowLabel: win.shortLabel,
      customerName: (input.customerName || "").slice(0, 80).trim() || "Cliente",
      whatsapp: (input.whatsapp || "").slice(0, 40).trim(),
      notes: (input.notes || "").slice(0, 500).trim(),
      dishes,
      market: marketLines,
      dishesQty,
      dishesTotal,
      marketTotal,
      total: dishesTotal + marketTotal,
      status: "pendiente",
      completed: false,
    };

    if (isPersistent()) {
      await redis().hset(K.orders, { [id]: order });
    } else {
      const db = await readFile();
      db.orders[id] = order;
      await writeFile(db);
    }
    return order;
  },

  /**
   * Pedido de un evento privado. Mismo flujo/precios que un pedido normal
   * (reusa basePrice/combos globales), pero valida contra el menú del evento
   * y lo agrupa en la ventana fija del evento. Sin Sano Market.
   */
  async createEventOrder(input: NewOrderInput): Promise<Order> {
    const settings = await this.getSettings();
    const event = await this.getEvent();
    const eventId = eventKeyFromTitle(event.title);

    const dishes = (input.dishes || [])
      .filter((d) => d.qty > 0 && event.menu.includes(d.name))
      .map((d) => ({ name: d.name, qty: Math.floor(d.qty) }));
    const dishesQty = dishes.reduce((s, d) => s + d.qty, 0);
    const dishesTotal = priceForDishes(dishesQty, settings.basePrice, settings.combos);

    const seq = await this.nextSeq();
    const id = `SANO-${seq}`;
    const order: Order = {
      id,
      seq,
      createdAt: new Date().toISOString(),
      windowId: eventId,
      windowLabel: event.deliveryLabel,
      customerName: (input.customerName || "").slice(0, 80).trim() || "Cliente",
      whatsapp: (input.whatsapp || "").slice(0, 40).trim(),
      notes: (input.notes || "").slice(0, 500).trim(),
      dishes,
      market: [],
      dishesQty,
      dishesTotal,
      marketTotal: 0,
      total: dishesTotal,
      status: "pendiente",
      completed: false,
      eventId,
    };

    if (isPersistent()) {
      await redis().hset(K.orders, { [id]: order });
    } else {
      const db = await readFile();
      db.orders[id] = order;
      await writeFile(db);
    }
    return order;
  },

  async updateOrder(
    id: string,
    patch: { status?: OrderStatus; completed?: boolean }
  ): Promise<Order | null> {
    const order = await this.getOrder(id);
    if (!order) return null;
    if (patch.status === "pendiente" || patch.status === "pagado") order.status = patch.status;
    if (typeof patch.completed === "boolean") order.completed = patch.completed;
    if (isPersistent()) {
      await redis().hset(K.orders, { [id]: order });
    } else {
      const db = await readFile();
      db.orders[id] = order;
      await writeFile(db);
    }
    return order;
  },

  async deleteOrder(id: string): Promise<void> {
    if (isPersistent()) {
      await redis().hdel(K.orders, id);
    } else {
      const db = await readFile();
      delete db.orders[id];
      await writeFile(db);
    }
  },

  /**
   * Ítems del resumen de cocina completados en una ventana, como mapa
   * `clave -> cantidad completada`. Guardar la cantidad permite reabrir un
   * ítem cuando entran pedidos nuevos que la aumentan (trazabilidad de lo
   * que falta producir).
   */
  async getKitchenDone(windowId: string): Promise<Record<string, number>> {
    let raw: unknown;
    if (isPersistent()) {
      raw = await redis().hget(K.kitchen, windowId);
    } else {
      const db = await readFile();
      raw = db.kitchen?.[windowId];
    }
    return normalizeKitchen(raw);
  },

  /** Marca/desmarca un ítem; al marcar guarda la cantidad. Devuelve el mapa actualizado. */
  async setKitchenItemDone(
    windowId: string,
    key: string,
    done: boolean,
    qty: number
  ): Promise<Record<string, number>> {
    const current = await this.getKitchenDone(windowId);
    if (done) current[key] = Math.max(0, Math.floor(qty) || 0);
    else delete current[key];
    if (isPersistent()) {
      await redis().hset(K.kitchen, { [windowId]: current });
    } else {
      const db = await readFile();
      db.kitchen = db.kitchen || {};
      db.kitchen[windowId] = current;
      await writeFile(db);
    }
    return current;
  },

  async nextSeq(): Promise<number> {
    if (isPersistent()) {
      // Asegura el piso antes de incrementar: el próximo número nunca baja del real del negocio.
      const cur = await redis().get<number>(K.seq);
      if (typeof cur !== "number" || cur < ORDER_SEQ_FLOOR) {
        await redis().set(K.seq, ORDER_SEQ_FLOOR);
      }
      return await redis().incr(K.seq);
    }
    const db = await readFile();
    db.seq = Math.max(db.seq || 0, ORDER_SEQ_FLOOR) + 1;
    await writeFile(db);
    return db.seq;
  },

  /** Cambia el número de un pedido (renumerar). Devuelve el pedido con el nuevo ID. */
  async renumberOrder(oldId: string, newNumber: number): Promise<Order | null> {
    const order = await this.getOrder(oldId);
    if (!order) return null;
    const seq = Math.max(1, Math.floor(newNumber));
    const newId = `SANO-${seq}`;
    if (newId !== oldId && (await this.getOrder(newId))) {
      throw new Error(`Ya existe un pedido ${newId}`);
    }
    order.id = newId;
    order.seq = seq;
    if (isPersistent()) {
      if (newId !== oldId) await redis().hdel(K.orders, oldId);
      await redis().hset(K.orders, { [newId]: order });
    } else {
      const db = await readFile();
      if (newId !== oldId) delete db.orders[oldId];
      db.orders[newId] = order;
      await writeFile(db);
    }
    return order;
  },

  /** Cambia la ventana (fecha de entrega) de un pedido. */
  async setOrderWindow(id: string, windowId: string): Promise<Order | null> {
    const order = await this.getOrder(id);
    if (!order) return null;
    const win = windowFromId(windowId);
    if (!win) throw new Error("Ventana de entrega inválida");
    order.windowId = win.id;
    order.windowLabel = win.shortLabel;
    if (isPersistent()) {
      await redis().hset(K.orders, { [id]: order });
    } else {
      const db = await readFile();
      db.orders[id] = order;
      await writeFile(db);
    }
    return order;
  },

  /** Cupos disponibles = totales − pedidos confirmados (pagados) de la ventana activa. */
  async computeCupos(): Promise<{ totales: number; disponibles: number; confirmados: number }> {
    return this.computeCuposFor(getNextWindow().id);
  },

  /** Cupos de una ventana específica. */
  async computeCuposFor(
    windowId: string
  ): Promise<{ totales: number; disponibles: number; confirmados: number }> {
    const settings = await this.getSettings();
    const orders = await this.listOrders();
    const confirmados = orders.filter(
      (o) => o.status === "pagado" && o.windowId === windowId
    ).length;
    const totales = settings.cuposTotales;
    return {
      totales,
      confirmados,
      disponibles: Math.max(0, totales - confirmados),
    };
  },
};

// ── File backend (solo desarrollo local / fallback) ───────────
/**
 * Normaliza el valor guardado del checklist de cocina a `clave -> cantidad`.
 * Tolera el formato viejo (array de claves completadas) tratándolo como
 * "completado sin límite de cantidad".
 */
function normalizeKitchen(raw: unknown): Record<string, number> {
  if (!raw) return {};
  if (Array.isArray(raw)) {
    const out: Record<string, number> = {};
    for (const k of raw) if (typeof k === "string") out[k] = Number.MAX_SAFE_INTEGER;
    return out;
  }
  if (typeof raw === "object") {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const n = Number(v);
      if (Number.isFinite(n)) out[k] = n;
    }
    return out;
  }
  return {};
}

interface DbFile {
  settings: Settings;
  market: MarketCategory[];
  orders: Record<string, Order>;
  seq: number;
  kitchen?: Record<string, Record<string, number>>;
  event?: EventSettings;
}

function dataFile(): string {
  const base = process.env.VERCEL ? path.join(os.tmpdir(), "sano-data") : path.join(process.cwd(), ".data");
  return path.join(base, "db.json");
}

let _writeChain: Promise<void> = Promise.resolve();

async function readFile(): Promise<DbFile> {
  try {
    const raw = await fs.readFile(dataFile(), "utf8");
    const parsed = JSON.parse(raw) as Partial<DbFile>;
    return {
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
      market: parsed.market || DEFAULT_MARKET,
      orders: parsed.orders || {},
      seq: parsed.seq || 0,
      kitchen: parsed.kitchen || {},
      event: parsed.event ? { ...DEFAULT_EVENT, ...parsed.event } : DEFAULT_EVENT,
    };
  } catch {
    return { settings: DEFAULT_SETTINGS, market: DEFAULT_MARKET, orders: {}, seq: 0, kitchen: {}, event: DEFAULT_EVENT };
  }
}

async function writeFile(db: DbFile): Promise<void> {
  _writeChain = _writeChain.then(async () => {
    try {
      const file = dataFile();
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, JSON.stringify(db, null, 2), "utf8");
    } catch (e) {
      // en Vercel sin KV el filesystem es efímero/solo lectura; no rompemos la request
      console.warn("No se pudo escribir el almacén local:", (e as Error).message);
    }
  });
  return _writeChain;
}
