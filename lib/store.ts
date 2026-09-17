import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { Redis } from "@upstash/redis";
import type { Settings, MarketCategory, Order, OrderStatus } from "./types";
import { DEFAULT_SETTINGS, DEFAULT_MARKET } from "./defaults";
import { getNextWindow } from "./windows";
import { priceForDishes } from "./pricing";

const K = {
  settings: "sano:settings",
  market: "sano:market",
  orders: "sano:orders", // hash: id -> Order
  seq: "sano:orderseq",
  kitchen: "sano:kitchen", // hash: windowId -> string[] (claves de ítems completados)
};

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
    const win = getNextWindow();

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
    const id = `SANO-${1000 + seq}`;
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

  /** Ítems del resumen de cocina marcados como completados en una ventana. */
  async getKitchenDone(windowId: string): Promise<string[]> {
    if (isPersistent()) {
      return (await redis().hget<string[]>(K.kitchen, windowId)) || [];
    }
    const db = await readFile();
    return db.kitchen?.[windowId] || [];
  },

  /** Marca/desmarca un ítem del resumen de cocina; devuelve la lista actualizada. */
  async setKitchenItemDone(windowId: string, key: string, done: boolean): Promise<string[]> {
    const current = await this.getKitchenDone(windowId);
    const set = new Set(current);
    if (done) set.add(key);
    else set.delete(key);
    const next = Array.from(set);
    if (isPersistent()) {
      await redis().hset(K.kitchen, { [windowId]: next });
    } else {
      const db = await readFile();
      db.kitchen = db.kitchen || {};
      db.kitchen[windowId] = next;
      await writeFile(db);
    }
    return next;
  },

  async nextSeq(): Promise<number> {
    if (isPersistent()) {
      return await redis().incr(K.seq);
    }
    const db = await readFile();
    db.seq = (db.seq || 0) + 1;
    await writeFile(db);
    return db.seq;
  },

  /** Cupos disponibles = totales − pedidos confirmados (pagados) de la ventana activa. */
  async computeCupos(): Promise<{ totales: number; disponibles: number; confirmados: number }> {
    const settings = await this.getSettings();
    const win = getNextWindow();
    const orders = await this.listOrders();
    const confirmados = orders.filter(
      (o) => o.status === "pagado" && o.windowId === win.id
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
interface DbFile {
  settings: Settings;
  market: MarketCategory[];
  orders: Record<string, Order>;
  seq: number;
  kitchen?: Record<string, string[]>;
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
    };
  } catch {
    return { settings: DEFAULT_SETTINGS, market: DEFAULT_MARKET, orders: {}, seq: 0, kitchen: {} };
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
