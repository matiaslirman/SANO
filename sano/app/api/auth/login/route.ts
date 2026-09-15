import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { checkPassword, createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!checkPassword(body.password || "")) {
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
  }
  const token = await createSessionToken();
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions);
  return NextResponse.json({ ok: true });
}
