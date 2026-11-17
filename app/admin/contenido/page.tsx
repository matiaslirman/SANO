import { AdminShell } from "@/components/admin/AdminShell";
import { ContentEditor } from "@/components/admin/ContentEditor";
import { store } from "@/lib/store";
import { getCycleWindows } from "@/lib/windows";
import { groupDishes } from "@/lib/dishes";

export const dynamic = "force-dynamic";

/** "Viernes 30 de octubre" -> "30 OCTUBRE" (rango de fechas por defecto para el arte del menú). */
function artDate(deliveryDateLabel: string): string {
  const p = deliveryDateLabel.trim().split(/\s+/);
  const day = p[1] ?? "";
  const month = p[p.length - 1] ?? "";
  return `${day} ${month.toUpperCase()}`.trim();
}

export default async function ContenidoPage() {
  const settings = await store.getSettings();
  const market = await store.getMarket();
  const event = await store.getEvent();

  // Rango de fechas del ciclo actual (primera y última entrega), como prefijo editable del arte.
  const wins = getCycleWindows(settings.menuPublishedAt);
  const defaultDateA = wins[0] ? artDate(wins[0].deliveryDateLabel) : "";
  const defaultDateB = wins.length ? artDate(wins[wins.length - 1].deliveryDateLabel) : "";

  // Historial de platos de semanas anteriores (datos reales, sin eventos): los más pedidos primero,
  // nombres agrupados (une tildes/mayúsculas/typos). Sirve para volver a incluirlos sin armar todo de cero.
  const orders = await store.listOrders();
  const items = orders
    .filter((o) => !o.eventId)
    .flatMap((o) => o.dishes.map((d) => ({ name: d.name, qty: d.qty })));
  const dishHistory = groupDishes(items, settings.menu).map((g) => g.name).slice(0, 40);

  return (
    <AdminShell active="contenido" title="Contenido">
      <ContentEditor
        initialSettings={settings}
        initialMarket={market}
        initialEvent={event}
        defaultDateA={defaultDateA}
        defaultDateB={defaultDateB}
        dishHistory={dishHistory}
      />
    </AdminShell>
  );
}
