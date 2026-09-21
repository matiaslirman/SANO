import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { store } from "@/lib/store";
import { checkEventCode, createEventToken, EVENT_COOKIE, eventCookieOptions } from "@/lib/event-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ingreso al evento privado con el código que comparte el dueño. */
export async function POST(req: Request) {
  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const event = await store.getEvent();
  if (!event.active) {
    return NextResponse.json({ error: "No hay un evento activo en este momento." }, { status: 403 });
  }
  if (!checkEventCode(body.code || "", event.code)) {
    return NextResponse.json({ error: "Código incorrecto." }, { status: 401 });
  }
  const token = await createEventToken(event.code);
  const jar = await cookies();
  jar.set(EVENT_COOKIE, token, eventCookieOptions);
  return NextResponse.json({ ok: true });
}
