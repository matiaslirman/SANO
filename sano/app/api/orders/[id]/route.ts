import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { isAdmin } from "@/lib/auth-server";
import type { OrderStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  let body: { status?: OrderStatus };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (body.status !== "pendiente" && body.status !== "pagado") {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }
  const order = await store.updateOrderStatus(id, body.status);
  if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  const cupos = await store.computeCupos();
  return NextResponse.json({ order, cupos });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  await store.deleteOrder(id);
  return NextResponse.json({ ok: true });
}
