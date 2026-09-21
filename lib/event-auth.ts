import "server-only";

/**
 * Acceso al evento privado.
 * Mismo esquema que el login del dueño (cookie firmada con HMAC-SHA256), pero
 * con su propia cookie y ligada a una huella del código actual: si el dueño
 * cambia el código del evento, las cookies viejas dejan de servir.
 */

export const EVENT_COOKIE = "sano_evento";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 días

function secret(): string {
  return process.env.SESSION_SECRET || "sano-dev-secret-change-me";
}

/** Normaliza el código para comparar/derivar: sin espacios extremos y en mayúsculas. */
function normalizeCode(code: string): string {
  return (code || "").trim().toUpperCase();
}

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return b64url(sig);
}

/** Comparación en tiempo constante. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

/** Huella corta del código actual: si el código cambia, cambia la huella. */
async function codeFingerprint(code: string): Promise<string> {
  return (await hmac(`evt:${normalizeCode(code)}`)).slice(0, 16);
}

/** ¿El código ingresado coincide con el del evento? (case-insensitive, trim). */
export function checkEventCode(input: string, currentCode: string): boolean {
  const a = normalizeCode(input);
  const b = normalizeCode(currentCode);
  return b.length > 0 && safeEqual(a, b);
}

export async function createEventToken(currentCode: string): Promise<string> {
  const cf = await codeFingerprint(currentCode);
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ evt: true, cf, iat: Date.now() })));
  const sig = await hmac(payload);
  return `${payload}.${sig}`;
}

/** Válida la cookie contra el código ACTUAL del evento (huella incluida). */
export async function verifyEventToken(
  token: string | undefined | null,
  currentCode: string
): Promise<boolean> {
  if (!token || !token.includes(".")) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = await hmac(payload);
  if (!safeEqual(sig, expected)) return false;
  try {
    const json = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(payload.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))
      )
    );
    if (json.evt !== true || typeof json.iat !== "number" || typeof json.cf !== "string") return false;
    if (Date.now() - json.iat > MAX_AGE_SECONDS * 1000) return false;
    const cf = await codeFingerprint(currentCode);
    return safeEqual(json.cf, cf);
  } catch {
    return false;
  }
}

export const eventCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};
