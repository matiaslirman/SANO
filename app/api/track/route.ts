import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { isTrackEvent } from "@/lib/track";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cuenta un evento de uso (público; solo acepta nombres de la lista, sin datos personales). */
export async function POST(req: Request) {
  let body: { event?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!isTrackEvent(body.event)) {
    return NextResponse.json({ error: "Evento inválido" }, { status: 400 });
  }
  try {
    await store.trackEvent(body.event);
  } catch {
    /* un contador nunca debe romper la experiencia */
  }
  return NextResponse.json({ ok: true });
}
