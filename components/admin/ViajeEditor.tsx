"use client";

import { useMemo, useState } from "react";
import type { ViajeSettings, ViajeEstado, ViajeItem, ViajePack, ViajeReward, ViajeCatId } from "@/lib/types";
import { crc } from "@/lib/format";
import { VIAJE_CATS, PORTIONS_PER_TRAY, cartTotal, trays, plural, LEAD_DAYS_MIN, LEAD_DAYS_MAX } from "@/lib/viaje";

const ESTADOS: { id: ViajeEstado; t: string; d: string }[] = [
  { id: "oculto", t: "Oculto", d: "No se ve en el sitio. Mientras lo armás." },
  { id: "pronto", t: "Disponible pronto", d: "Tarjeta atenuada en la portada con «Avisame cuando abra» por WhatsApp." },
  { id: "abierto", t: "Abierto", d: "Los clientes arman y envían su pedido." },
];

const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.floor(Math.random() * 99)}`;

/** Editor de Viaje Sano: estado en el sitio, reglas, catálogo con precios, packs y premios. */
export function ViajeEditor({ initial }: { initial: ViajeSettings }) {
  const [estado, setEstado] = useState<ViajeEstado>(initial.estado);
  const [fecha, setFecha] = useState(initial.fecha);
  const [destacar, setDestacar] = useState(initial.destacar);
  const [leadDays, setLeadDays] = useState(initial.leadDays);
  const [chainText, setChainText] = useState(initial.chainText);
  const [rewards, setRewards] = useState<ViajeReward[]>(initial.rewards);
  const [items, setItems] = useState<ViajeItem[]>(initial.items);
  const [packs, setPacks] = useState<ViajePack[]>(initial.packs);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const setItem = (id: string, patch: Partial<ViajeItem>) => setItems((s) => s.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const setPack = (pid: string, fn: (p: ViajePack) => ViajePack) => setPacks((s) => s.map((p) => (p.id === pid ? fn(p) : p)));

  async function save() {
    setBusy(true);
    setSaved(false);
    setErr("");
    try {
      const r = await fetch("/api/viaje/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado, fecha, destacar, leadDays, chainText, rewards, items, packs }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo guardar.");
      const v: ViajeSettings = d.viaje;
      // lo que el servidor descartó (packs vacíos, etc.) se refleja acá
      setEstado(v.estado); setFecha(v.fecha); setDestacar(v.destacar); setLeadDays(v.leadDays); setChainText(v.chainText);
      setRewards(v.rewards); setItems(v.items); setPacks(v.packs);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="editcard" id="viaje">
      <h3>Viaje Sano</h3>
      <div className="sub">
        Las bandejas para llevar de viaje (<a href="/viaje-sano" target="_blank" rel="noopener noreferrer" style={{ color: "var(--bordo)", fontWeight: 600 }}>/viaje-sano</a>). 1 bandeja = {PORTIONS_PER_TRAY} porciones; los pedidos
        no usan cupos y se ven en la pestaña <b>Viaje Sano</b>.
      </div>

      <div className="field" style={{ marginTop: 0 }}>
        <label>Estado en el sitio</label>
        <div className="vj-estados" role="radiogroup" aria-label="Estado de Viaje Sano">
          {ESTADOS.map((e) => (
            <button key={e.id} type="button" role="radio" aria-checked={estado === e.id} className={`vj-eopt${estado === e.id ? " on" : ""}`} onClick={() => setEstado(e.id)}>
              <b>{e.t}</b>
              <small>{e.d}</small>
            </button>
          ))}
        </div>
        <div className="ev-hint">
          Aunque esté <b>Oculto</b> o <b>Disponible pronto</b>, vos podés ver y probar la página real entrando a /viaje-sano con la sesión del panel.
        </div>
      </div>

      <div className="ev-grid" style={{ marginTop: 14 }}>
        <div className="field">
          <label>«Disponible pronto» dice…</label>
          <input value={fecha} onChange={(e) => setFecha(e.target.value)} maxLength={40} placeholder="en las próximas semanas" />
        </div>
        <div className="field">
          <label>Tarjeta destacada en la portada</label>
          <select className="vj-sel" value={destacar} onChange={(e) => setDestacar(e.target.value === "viaje" ? "viaje" : "semana")}>
            <option value="semana">Esta semana (menú semanal)</option>
            <option value="viaje">Viaje Sano (temporada de viajes)</option>
          </select>
        </div>
        <div className="field">
          <label>Anticipación mínima de retiro (días)</label>
          <input type="number" min={LEAD_DAYS_MIN} max={LEAD_DAYS_MAX} value={leadDays} onChange={(e) => setLeadDays(parseInt(e.target.value) || LEAD_DAYS_MIN)} />
        </div>
      </div>
      <div className="field">
        <label>Aviso de cadena de frío</label>
        <textarea value={chainText} onChange={(e) => setChainText(e.target.value)} maxLength={220} style={{ minHeight: 60 }} />
      </div>

      <h4 className="vj-h4">Productos y precios</h4>
      <div className="sub" style={{ marginBottom: 8 }}>
        Los platos fuertes (lasañas, pechugas, chaufa) son <b>bandejas de {PORTIONS_PER_TRAY} porciones</b>. Para sacar algo de la venta, desmarcá «Activo» (así no se rompen los packs).
      </div>
      {VIAJE_CATS.map((c) => {
        const list = items.filter((i) => i.cat === c.id);
        return (
          <div className="vj-ecat" key={c.id}>
            <div className="vj-ecat-h">
              {c.name} <small>{c.tray ? `bandeja de ${PORTIONS_PER_TRAY} porciones` : c.unit || "unidad"}</small>
            </div>
            {list.map((i) => (
              <div className={`vj-erow${i.active ? "" : " off"}`} key={i.id}>
                <input value={i.name} onChange={(e) => setItem(i.id, { name: e.target.value })} aria-label="Nombre" maxLength={90} />
                <input value={i.desc || ""} onChange={(e) => setItem(i.id, { desc: e.target.value })} aria-label="Descripción" placeholder="Descripción (opcional)" maxLength={90} />
                <input className="num" type="number" min={0} value={i.price} onChange={(e) => setItem(i.id, { price: parseInt(e.target.value) || 0 })} aria-label="Precio en colones" />
                <label className="chk">
                  <input type="checkbox" checked={i.active} onChange={(e) => setItem(i.id, { active: e.target.checked })} /> Activo
                </label>
              </div>
            ))}
            <button
              type="button"
              className="obtn"
              onClick={() => setItems((s) => [...s, { id: uid("x"), cat: c.id as ViajeCatId, name: "Nuevo producto", price: 0, active: false }])}
            >
              + Agregar a {c.name}
            </button>
          </div>
        );
      })}

      <h4 className="vj-h4">Packs</h4>
      <div className="sub" style={{ marginBottom: 8 }}>
        Los packs sugeridos que ve el cliente. Se arman con bandejas (platos fuertes) y extras; el cliente luego puede cambiar cualquier plato.
      </div>
      {packs.map((p) => {
        const cart = p.items;
        const t = trays(cart, items);
        return (
          <div className="vj-epack" key={p.id}>
            <div className="vj-epack-h">
              <input value={p.name} onChange={(e) => setPack(p.id, (x) => ({ ...x, name: e.target.value }))} aria-label="Nombre del pack" maxLength={40} />
              <span className="sum">
                {t} {plural(t, "bandeja", "bandejas")} · {t * PORTIONS_PER_TRAY} porciones · <b>{crc(cartTotal(cart, items))}</b>
              </span>
              <button type="button" className="obtn danger" onClick={() => setPacks((s) => s.filter((x) => x.id !== p.id))}>Quitar pack</button>
            </div>
            {Object.entries(p.items).map(([id, q]) => (
              <div className="vj-erow pk" key={id}>
                <span className="nm">{itemById.get(id)?.name || id}</span>
                <input
                  className="num"
                  type="number"
                  min={1}
                  max={20}
                  value={q}
                  aria-label={`Cantidad de ${itemById.get(id)?.name || id}`}
                  onChange={(e) => setPack(p.id, (x) => ({ ...x, items: { ...x.items, [id]: Math.max(1, parseInt(e.target.value) || 1) } }))}
                />
                <button
                  type="button"
                  className="obtn"
                  onClick={() => setPack(p.id, (x) => { const n = { ...x.items }; delete n[id]; return { ...x, items: n }; })}
                >
                  Quitar
                </button>
              </div>
            ))}
            <select
              className="vj-sel"
              value=""
              aria-label={`Agregar producto al pack ${p.name}`}
              onChange={(e) => e.target.value && setPack(p.id, (x) => ({ ...x, items: { ...x.items, [e.target.value]: x.items[e.target.value] || 1 } }))}
            >
              <option value="">+ Agregar producto al pack…</option>
              {items.filter((i) => !(i.id in p.items)).map((i) => (
                <option key={i.id} value={i.id}>{i.name}{i.active ? "" : " (inactivo)"}</option>
              ))}
            </select>
          </div>
        );
      })}
      <button type="button" className="obtn" onClick={() => setPacks((s) => [...s, { id: uid("p"), name: "Nuevo pack", items: {} }])}>
        + Agregar pack
      </button>
      <div className="ev-hint">Un pack sin productos se descarta al guardar. Un pack con productos inactivos no se le muestra al cliente.</div>

      <h4 className="vj-h4">Premios por monto</h4>
      <div className="sub" style={{ marginBottom: 8 }}>Regalos que se desbloquean al llegar a cierto total (se muestran con una barra de progreso). Máximo 4.</div>
      <div className="edit-list">
        {rewards.map((w, i) => (
          <div className="er" key={i}>
            <input className="er-extra" type="number" min={0} value={w.at} aria-label="Monto en colones" onChange={(e) => setRewards((s) => s.map((x, j) => (j === i ? { ...x, at: parseInt(e.target.value) || 0 } : x)))} />
            <input value={w.text} maxLength={60} aria-label="Premio" placeholder="1 salsa de regalo" onChange={(e) => setRewards((s) => s.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
            <button type="button" className="obtn" onClick={() => setRewards((s) => s.filter((_, j) => j !== i))}>Quitar</button>
          </div>
        ))}
      </div>
      {rewards.length < 4 && (
        <button type="button" className="obtn" style={{ marginTop: 10 }} onClick={() => setRewards((s) => [...s, { at: 0, text: "" }])}>
          + Agregar premio
        </button>
      )}

      <div>
        <button className="save-btn" onClick={save} disabled={busy}>{busy ? "Guardando…" : "Guardar Viaje Sano"}</button>
        {saved && <span className="saved-msg">✓ Guardado</span>}
        {err && <span className="saved-msg" style={{ color: "#9a2020" }}>{err}</span>}
      </div>
    </div>
  );
}
