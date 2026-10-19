import { groupDishes, normalizeDish, sameDish } from "./dishes";

/** Cuántos favoritos se muestran con la tienda cerrada. */
export const FAVORITES_COUNT = 10;

interface OrderLike {
  eventId?: string;
  dishes: { name: string; qty: number }[];
}

/**
 * Los platos más pedidos de siempre (solo el nombre, sin cifras), con datos reales:
 * cuenta todos los pedidos (pagados y pendientes, sin eventos), une escrituras casi
 * idénticas (`groupDishes`) y deja afuera los que ya están en el menú de esta semana
 * para no mostrarlos dos veces. Manda el nombre del menú actual.
 */
export function topDishes(orders: OrderLike[], menu: string[], n: number = FAVORITES_COUNT): string[] {
  const items: { name: string; qty: number }[] = [];
  for (const o of orders) {
    if (o.eventId) continue;
    for (const d of o.dishes) items.push({ name: d.name, qty: d.qty });
  }
  const inMenu = menu.map(normalizeDish);
  return groupDishes(items, menu)
    .filter((g) => !inMenu.some((m) => sameDish(m, normalizeDish(g.name))))
    .slice(0, n)
    .map((g) => g.name);
}

/** Mensaje de WhatsApp de "Avisame cuando salga el menú", con los platos que la persona quiere que vuelvan. */
export function menuAlertMessage(picks: string[]): string {
  const base = "Hola Sano 👋 Avisame apenas salga el menú de la próxima semana, por favor.";
  const names = picks.map((p) => p.trim()).filter(Boolean);
  return names.length ? `${base} Me encantaría que vuelvan: ${names.join(", ")}.` : base;
}
