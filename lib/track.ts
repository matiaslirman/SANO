/** Contadores de uso (sin datos personales): qué pasa con el pop-up de la tarjeta y el aviso de menú. */
export const TRACK_EVENTS = [
  "loyalty_shown",    // se mostró el pop-up de la tarjeta
  "loyalty_download", // tocó "Descargá tu tarjeta"
  "loyalty_have",     // tocó "Ya la tengo"
  "loyalty_later",    // cerró / "Ahora no"
  "menu_alert",       // tocó "Avisame cuando salga el menú" con los pedidos cerrados
] as const;
export type TrackEvent = (typeof TRACK_EVENTS)[number];

export function isTrackEvent(v: unknown): v is TrackEvent {
  return typeof v === "string" && (TRACK_EVENTS as readonly string[]).includes(v);
}

/** Avisa al servidor (fire-and-forget; no rompe nada si falla). */
export function track(event: TrackEvent): void {
  try {
    void fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* silencioso */
  }
}
