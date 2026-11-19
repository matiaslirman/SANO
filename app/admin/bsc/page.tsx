import { AdminShell } from "@/components/admin/AdminShell";
import { BscView } from "@/components/admin/BscView";
import { store, isPersistent } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function BscPage() {
  const [orders, settings] = await Promise.all([store.listBscOrders(), store.getBsc()]);
  return (
    <AdminShell active="bsc" title="Bistro Social Club">
      {!isPersistent() && (
        <div className="warn-banner">
          ⚠️ <b>Base de datos no configurada.</b> Los pedidos no se están guardando de forma permanente. Conectá un store KV
          (Upstash) en Vercel y agregá las variables de entorno para activar el guardado.
        </div>
      )}
      <BscView initial={{ orders, settings }} />
    </AdminShell>
  );
}
