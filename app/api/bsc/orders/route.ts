import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { isAdmin } from "@/lib/auth-server";
import { accountKey, bscOpen, buildAccounts, checkBscOrder } from "@/lib/bsc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Crear un pedido de Bistro Social Club (público, solo dentro de la ventana). La validación del servidor es la que
 * manda: del cliente solo se leen ids, variantes y cantidades; los precios salen de la carta. Fuera de la ventana
 * (o con el interruptor apagado) responde 409; el dueño logueado puede probarlo igual.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const settings = await store.getBsc();
  const admin = await isAdmin();
  if (!bscOpen(new Date(), settings) && !admin) {
    return NextResponse.json({ error: "Bistro Social Club no está recibiendo pedidos ahora.", closed: true }, { status: 409 });
  }

  const check = checkBscOrder(body, settings, new Date(), { ignoreWindow: admin });
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.code === "closed" ? 409 : 400 });

  // «staff» solo lo puede marcar quien tiene sesión del panel (así se distingue lo que cargó el equipo de lo que pidió el cliente)
  const by = admin && body.staff === true ? "staff" : "cliente";
  const order = await store.createBscOrder(check, { edition: settings.editionId, by });

  // Resumen de la cuenta de ESA persona (mismo teléfono o nombre): solo montos, sin líneas ni datos de otras personas.
  const key = accountKey(order);
  const mine = buildAccounts((await store.listBscOrders()).filter((o) => accountKey(o) === key))[0];
  const account = mine
    ? {
        orders: mine.orders.length,
        subtotal: mine.subtotal,
        promo: { applied: mine.promo.applied, amount: mine.promo.amount, item: mine.promo.item?.name || "" },
        total: mine.total,
      }
    : undefined;

  return NextResponse.json(
    { order: { id: order.id, createdAt: order.createdAt, bscEdition: order.bscEdition, customerName: order.customerName, bsc: order.bsc, total: order.total, bscTable: order.bscTable }, account },
    { status: 201 }
  );
}

/** Pedidos del evento + configuración (solo staff con sesión del panel). */
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const [orders, settings] = await Promise.all([store.listBscOrders(), store.getBsc()]);
  return NextResponse.json({ orders, settings }, { headers: { "Cache-Control": "no-store" } });
}
