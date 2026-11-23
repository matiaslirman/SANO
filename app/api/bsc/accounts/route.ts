import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { isAdmin } from "@/lib/auth-server";
import { PAY_METHODS } from "@/lib/bsc";
import type { BscPay } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cerrar o reabrir una cuenta (solo staff). Al cobrar se marcan todos sus pedidos como pagados, con el método
 * (efectivo, SINPE o tarjeta) y la hora; al reabrir se borran. Solo toca pedidos del evento: cualquier otro id se ignora.
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  let body: { ids?: unknown; status?: unknown; method?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const status = body.status === "pagado" || body.status === "pendiente" ? body.status : null;
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string").slice(0, 200) : [];
  if (!status || ids.length === 0) return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });

  const method = PAY_METHODS.find((m) => m === body.method) as BscPay | undefined;
  if (status === "pagado" && !method) return NextResponse.json({ error: "Elegí cómo se cobró: efectivo, SINPE o tarjeta." }, { status: 400 });

  const mine = new Set((await store.listBscOrders()).map((o) => o.id));
  const paidAt = new Date().toISOString();
  const updated = [];
  for (const id of ids) {
    if (!mine.has(id)) continue;
    const o = await store.updateOrder(id, status === "pagado" ? { status, bscPay: method, bscPaidAt: paidAt } : { status, bscPay: null, bscPaidAt: null });
    if (o) updated.push(o);
  }
  return NextResponse.json({ orders: updated });
}
