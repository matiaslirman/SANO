/** Descarga del wallet-pass de la tarjeta de cliente frecuente. */
export const LOYALTY_URL = "https://add2wallet.com/SANO%20by%2022Bistro/wallet-pass/61/download";

/** Marca en este dispositivo que la persona ya la descargó o ya la tiene (no se le vuelve a mostrar el pop-up). */
const KEY = "sano:loyalty";
export function loyaltyDone(): boolean {
  try {
    return localStorage.getItem(KEY) === "done";
  } catch {
    return false;
  }
}
export function markLoyaltyDone(): void {
  try {
    localStorage.setItem(KEY, "done");
  } catch {
    /* sin storage: se le puede volver a mostrar, no pasa nada */
  }
}
