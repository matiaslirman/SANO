import { AdminShell } from "@/components/admin/AdminShell";
import { AnaliticaView } from "@/components/admin/AnaliticaView";
import { store, isPersistent } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function AnaliticaPage() {
  const orders = await store.listOrders();
  const settings = await store.getSettings();

  return (
    <AdminShell active="analitica" title="Analítica">
      {!isPersistent() && (
        <div className="warn-banner">
          ⚠️ <b>Base de datos no configurada.</b> Los datos que ves acá son de la sesión actual y no persisten.
          Conectá un store KV (Upstash) en Vercel para el histórico real.
        </div>
      )}
      <AnaliticaView initial={{ orders, combos: settings.combos }} />
    </AdminShell>
  );
}
