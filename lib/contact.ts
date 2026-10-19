/** Correo opcional del cliente (llave para vincular sus pedidos con la tarjeta de sellos) y datos recordados en el celular. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Minúsculas y sin espacios. Vacío si no tiene forma de correo. */
export function normalizeEmail(raw: string | undefined | null): string {
  const e = (raw || "").trim().toLowerCase();
  return e.length <= 120 && EMAIL_RE.test(e) ? e : "";
}

export function isValidEmail(raw: string | undefined | null): boolean {
  return normalizeEmail(raw) !== "";
}

export interface SavedContact {
  name: string;
  phone: string;
  email: string;
}

/** Solo en este dispositivo (localStorage): la persona lo escribe una vez y las siguientes aparece solo. */
const KEY = "sano:contact";

export function loadContact(): SavedContact | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    return {
      name: typeof c.name === "string" ? c.name.slice(0, 80) : "",
      phone: typeof c.phone === "string" ? c.phone.slice(0, 40) : "",
      email: normalizeEmail(c.email),
    };
  } catch {
    return null;
  }
}

export function saveContact(c: SavedContact): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ name: c.name.trim(), phone: c.phone.trim(), email: normalizeEmail(c.email) }));
  } catch {
    /* sin storage: solo no se recuerda */
  }
}
