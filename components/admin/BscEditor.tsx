"use client";

import { useState } from "react";
import type { BscItem, BscSettings } from "@/lib/types";
import { BSC_CATS, crLocalToIso, isoToCrLocal } from "@/lib/bsc";

/** Configuración del evento: interruptor, ventana (hora de Costa Rica) y carta con precios y reglas de la promo. */
export function BscEditor({ settings, onSaved }: { settings: BscSettings; onSaved: (s: BscSettings) => void }) {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [from, setFrom] = useState(isoToCrLocal(settings.availableFrom));
  const [until, setUntil] = useState(isoToCrLocal(settings.availableUntil));
  const [items, setItems] = useState<BscItem[]>(settings.items);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const setItem = (id: string, patch: Partial<BscItem>) => setItems((s) => s.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const setVariant = (id: string, vid: string, patch: { name?: string; price?: number }) =>
    setItems((s) => s.map((i) => (i.id === id ? { ...i, variants: i.variants?.map((v) => (v.id === vid ? { ...v, ...patch } : v)) } : i)));

  async function save() {
    setBusy(true);
    setMsg("");
    setErr("");
    const f = crLocalToIso(from);
    const u = crLocalToIso(until);
    if (!f || !u || Date.parse(f) >= Date.parse(u)) {
      setErr("Revisá las fechas: «hasta» tiene que ser después de «desde».");
      setBusy(false);
      return;
    }
    try {
      const r = await fetch("/api/bsc/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, availableFrom: f, availableUntil: u, items }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo guardar.");
      onSaved(d.settings);
      setItems(d.settings.items);
      setMsg("✓ Guardado");
      setTimeout(() => setMsg(""), 2500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="editcard bsc-adm-edit">
      <summary><h3 style={{ display: "inline" }}>Configuración del evento</h3></summary>
      <div className="sub" style={{ marginTop: 6 }}>
        Interruptor, ventana de pedidos (hora de Costa Rica) y carta. La validación de la ventana la hace el servidor: fuera de ella no entran pedidos aunque alguien tenga la página abierta.
      </div>

      <label className="ev-toggle">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Evento encendido (pestaña en el sitio y pedidos)
      </label>

      <div className="ev-grid">
        <div className="field">
          <label>Se ve y recibe pedidos desde</label>
          <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field">
          <label>Hasta</label>
          <input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} />
        </div>
      </div>

      {BSC_CATS.map((cat) => (
        <div className="vj-ecat" key={cat.id}>
          <div className="vj-ecat-h">{cat.name}</div>
          {items.filter((i) => i.cat === cat.id).map((i) => (
            <div key={i.id} className={`bsc-adm-item${i.active ? "" : " off"}`}>
              <div className="row">
                <input value={i.name} onChange={(e) => setItem(i.id, { name: e.target.value })} aria-label="Nombre" maxLength={80} />
                {!i.variants?.length && (
                  <input className="num" type="number" min={0} value={i.price} onChange={(e) => setItem(i.id, { price: parseInt(e.target.value) || 0 })} aria-label={`Precio de ${i.name}`} />
                )}
                <label className="chk"><input type="checkbox" checked={i.active} onChange={(e) => setItem(i.id, { active: e.target.checked })} /> Activo</label>
                {cat.id === "picar" ? (
                  <label className="chk"><input type="checkbox" checked={!!i.promoEligible} onChange={(e) => setItem(i.id, { promoEligible: e.target.checked })} /> Puede salir incluido</label>
                ) : (
                  <label className="chk"><input type="checkbox" checked={!!i.promoTrigger} onChange={(e) => setItem(i.id, { promoTrigger: e.target.checked })} /> Activa la promo</label>
                )}
              </div>
              {i.variants?.map((v) => (
                <div className="row var" key={v.id}>
                  <span className="vlbl">Variante</span>
                  <input value={v.name} onChange={(e) => setVariant(i.id, v.id, { name: e.target.value })} aria-label={`Nombre de la variante de ${i.name}`} maxLength={60} />
                  {v.price !== undefined && (
                    <input className="num" type="number" min={0} value={v.price} onChange={(e) => setVariant(i.id, v.id, { price: parseInt(e.target.value) || 0 })} aria-label={`Precio de ${v.name}`} />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}

      <div className="ev-hint">
        Para el vino, renombrá las dos opciones (₡3.500 y ₡4.000) cuando confirmes qué distingue a cada una. La promo se activa con los ítems marcados «Activa la promo»
        (hoy: los tragos de la casa; cerveza y vino no) y descuenta el primer plato marcado «Puede salir incluido», una vez por persona.
      </div>

      <div>
        <button className="save-btn" onClick={save} disabled={busy}>{busy ? "Guardando…" : "Guardar configuración"}</button>
        {msg && <span className="saved-msg">{msg}</span>}
        {err && <span className="saved-msg" style={{ color: "#9a2020" }}>{err}</span>}
      </div>
    </details>
  );
}
