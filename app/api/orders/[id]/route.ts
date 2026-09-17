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
  let body: { status?: OrderStatus; completed?: boolean; renumber?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // Renumerar (cambiar el N° de la orden)
  if (typeof body.renumber === "number" && Number.isFinite(body.renumber)) {
    if (body.renumber < 1) {
      return NextResponse.json({ error: "El número debe ser mayor a 0" }, { status: 400 });
    }
    try {
      const order = await store.renumberOrder(id, body.renumber);
      if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
      const cupos = await store.computeCupos();
      return NextResponse.json({ order, cupos });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 409 });
    }
  }

  const hasStatus = body.status === "pendiente" || body.status === "pagado";
  const hasCompleted = typeof body.completed === "boolean";
  if (!hasStatus && !hasCompleted) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }
  const order = await store.updateOrder(id, {
    status: hasStatus ? body.status : undefined,
    completed: hasCompleted ? body.completed : undefined,
  });
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
