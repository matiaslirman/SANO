/**
 * Autenticación simple del panel del dueño.
 * Cookie de sesión firmada con HMAC-SHA256 (Web Crypto → sirve en Node y Edge).
 * No guarda estado en servidor: la validez se verifica con la firma.
 */

export const SESSION_COOKIE = "sano_admin";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 días

function secret(): string {
  return process.env.SESSION_SECRET || "sano-dev-secret-change-me";
}

function adminPassword(): string {
  return process.env.ADMIN_PASSWORD || "sano-2bistro";
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

/** Comparación en tiempo constante para evitar timing attacks. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export function checkPassword(input: string): boolean {
  return safeEqual(input || "", adminPassword());
}

export async function createSessionToken(): Promise<string> {
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ iat: Date.now() })));
  const sig = await hmac(payload);
  return `${payload}.${sig}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
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
    if (typeof json.iat !== "number") return false;
    if (Date.now() - json.iat > MAX_AGE_SECONDS * 1000) return false;
    return true;
  } catch {
    return false;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};
