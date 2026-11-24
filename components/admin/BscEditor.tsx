"use client";

import { useState } from "react";
import type { BscCatId, BscItem, BscSettings } from "@/lib/types";
import { BSC_CATS, BSC_PHOTOS, crLocalToIso, editionLabel, isoToCrLocal, moveItem, nextEditionPatch, slugId } from "@/lib/bsc";

/** Carta y edición: se agregan, quitan y ordenan platos y bebidas; se fijan las fechas y se arranca la próxima edición. */
export function BscEditor({ settings, onSaved }: { settings: BscSettings; onSaved: (s: BscSettings) => void }) {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [name, setName] = useState(settings.name);
  const [venue, setVenue] = useState(settings.venue);
  const [startsAt, setStartsAt] = useState(isoToCrLocal(settings.startsAt));
  const [from, setFrom] = useState(isoToCrLocal(settings.availableFrom));
  const [until, setUntil] = useState(isoToCrLocal(settings.availableUntil));
  const [items, setItems] = useState<BscItem[]>(settings.items);
  const [cTragos, setCTragos] = useState<number>(settings.cortesia.tragos);
  const [cDesc, setCDesc] = useState<Record<string, string>>({ "1": settings.cortesia.options.find((o) => o.id === "1")?.desc || "", "2": settings.cortesia.options.find((o) => o.id === "2")?.desc || "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const setItem = (id: string, patch: Partial<BscItem>) => setItems((s) => s.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const setVariant = (id: string, vid: string, patch: { name?: string; price?: number | undefined }) =>
    setItems((s) => s.map((i) => (i.id === id ? { ...i, variants: i.variants?.map((v) => (v.id === vid ? { ...v, ...patch } : v)) } : i)));

  function addItem(cat: BscCatId) {
    const id = slugId("nuevo item", items.map((i) => i.id));
    setItems((s) => [...s, { id, cat, name: "", price: 0, active: true, ...(cat === "tragos" ? { promoTrigger: true } : {}) }]);
  }
  function removeItem(i: BscItem) {
    if (!confirm(`¿Quitar «${i.name || "este ítem"}» de la carta?\nLos pedidos que ya lo tienen no se tocan. Si solo se acabó, usá «Agotado» en la Comanda.`)) return;
    setItems((s) => s.filter((x) => x.id !== i.id));
  }
  function addVariant(i: BscItem) {
    const vid = slugId("opcion", (i.variants || []).map((v) => v.id));
    setItem(i.id, { variants: [...(i.variants || []), { id: vid, name: "" }] });
  }
  function removeVariant(i: BscItem, vid: string) {
    const left = (i.variants || []).filter((v) => v.id !== vid);
    setItem(i.id, { variants: left.length ? left : undefined });
  }

  /** Revisa lo mínimo antes de guardar y arma el cuerpo con ids definitivos (a partir del nombre) para los ítems nuevos. */
  function prepare(): BscItem[] | string {
    const taken = new Set<string>();
    const out: BscItem[] = [];
    for (const it of items) {
      const nm = it.name.trim();
      if (!nm) return "Hay un ítem sin nombre. Escribile un nombre o quitalo.";
      const known = new Set((settings.items.find((s) => s.id === it.id)?.variants || []).map((v) => v.id));
      const vtaken = new Set<string>(known);
      const vs = (it.variants || []).map((v) => {
        const vn = v.name.trim();
        // las variantes nuevas estrenan un id legible a partir de su nombre; las que ya existían conservan el suyo
        const vid = known.has(v.id) ? v.id : slugId(vn || "opcion", vtaken);
        vtaken.add(vid);
        return { ...v, id: vid, name: vn };
      });
      if (vs.some((v) => !v.name)) return `«${nm}» tiene una variante sin nombre.`;
      const priced = vs.length > 0 && vs.every((v) => (v.price || 0) > 0);
      if (!priced && !(it.price > 0)) return `«${nm}» no tiene precio.`;
      // los ítems nuevos (id provisional) estrenan un id legible; los que ya existían conservan el suyo (los pedidos lo usan)
      const existing = settings.items.some((s) => s.id === it.id);
      const id = existing ? it.id : slugId(nm, [...settings.items.map((s) => s.id), ...taken]);
      taken.add(id);
      out.push({ ...it, id, name: nm, ...(vs.length ? { variants: vs } : { variants: undefined }) });
    }
    return out;
  }

  async function save(extra: Partial<BscSettings> = {}, then?: () => void) {
    setMsg("");
    setErr("");
    const f = crLocalToIso(from);
    const u = crLocalToIso(until);
    const s = crLocalToIso(startsAt);
    if (!f || !u || !s || Date.parse(f) >= Date.parse(u)) return setErr("Revisá las fechas: «hasta» tiene que ser después de «desde».");
    const prepared = prepare();
    if (typeof prepared === "string") return setErr(prepared);
    setBusy(true);
    try {
      const r = await fetch("/api/bsc/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled, name, venue, startsAt: s, availableFrom: f, availableUntil: u, items: prepared,
          cortesia: { tragos: cTragos, options: [{ id: "1", desc: cDesc["1"] }, { id: "2", desc: cDesc["2"] }] },
          ...extra,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo guardar.");
      const saved: BscSettings = d.settings;
      onSaved(saved);
      setItems(saved.items);
      setStartsAt(isoToCrLocal(saved.startsAt));
      setFrom(isoToCrLocal(saved.availableFrom));
      setUntil(isoToCrLocal(saved.availableUntil));
      setMsg("✓ Guardado");
      setTimeout(() => setMsg(""), 2500);
      then?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  function nuevaEdicion() {
    const cur = { startsAt: settings.startsAt, availableFrom: settings.availableFrom, availableUntil: settings.availableUntil };
    const p = nextEditionPatch(cur, 7);
    if (!confirm(
      `Vas a empezar la edición del ${editionLabel(p.editionId)}.\n\n` +
      `• La comanda y los totales de la edición actual (${editionLabel(settings.editionId)}) quedan guardados y se pueden consultar.\n` +
      `• La página de los clientes abre ${new Date(Date.parse(p.availableFrom)).toLocaleString("es-CR", { timeZone: "America/Costa_Rica", weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" })} (hora de Costa Rica).\n\n¿Seguimos?`
    )) return;
    void save({ editionId: p.editionId, startsAt: p.startsAt, availableFrom: p.availableFrom, availableUntil: p.availableUntil });
  }

  return (
    <>
      <div className="editcard bsc-adm-edit">
        <h3>Edición y fechas</h3>
        <div className="sub">
          Edición en curso: <b>{editionLabel(settings.editionId)}</b>. Cada edición tiene su propia comanda y sus propios totales. La ventana (hora de Costa Rica) la valida el servidor:
          fuera de ella los clientes no pueden pedir, aunque tengan la página abierta.
        </div>

        <button type="button" className="save-btn" onClick={nuevaEdicion} disabled={busy} style={{ marginTop: 0 }}>
          Empezar la próxima edición (+7 días)
        </button>
        <div className="ev-hint">Mueve el evento y la ventana una semana, con las mismas horas, y abre una comanda nueva en cero. Después podés ajustar fechas y carta acá abajo.</div>

        <label className="ev-toggle" style={{ marginTop: 16 }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Evento encendido (pestaña en el sitio y pedidos de clientes)
        </label>
        <div className="ev-grid">
          <div className="field"><label>Nombre del evento</label><input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></div>
          <div className="field"><label>Lugar</label><input value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={80} /></div>
          <div className="field"><label>Empieza (se muestra en la página)</label><input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></div>
          <div />
          <div className="field"><label>Se ve y recibe pedidos desde</label><input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="field"><label>Hasta</label><input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} /></div>
        </div>
      </div>

      <div className="editcard bsc-adm-edit">
        <h3>Cortesía</h3>
        <div className="sub">
          Al llegar, con su primer trago de la casa (o la cantidad que pongas abajo), cada persona gana <b>una cortesía</b>: la <b>Opción 1</b> o la <b>Opción 2</b>. La da el restaurante.
          Al equipo siempre se le muestra solo «Opción 1» u «Opción 2»; el texto de abajo es <b>solo para el cliente</b> (si lo dejás vacío, el cliente ve solo la etiqueta).
        </div>
        <div className="ev-grid">
          <div className="field"><label>Tragos necesarios para la cortesía</label><input type="number" min={1} max={10} value={cTragos} onChange={(e) => setCTragos(parseInt(e.target.value) || 1)} /></div>
          <div />
          <div className="field"><label>Opción 1 · texto para el cliente (opcional)</label><input value={cDesc["1"]} onChange={(e) => setCDesc((d) => ({ ...d, "1": e.target.value }))} maxLength={120} placeholder="Ej: Algo para picar" /></div>
          <div className="field"><label>Opción 2 · texto para el cliente (opcional)</label><input value={cDesc["2"]} onChange={(e) => setCDesc((d) => ({ ...d, "2": e.target.value }))} maxLength={120} placeholder="Ej: Algo dulce" /></div>
        </div>
        <div>
          <button className="save-btn" onClick={() => save()} disabled={busy}>{busy ? "Guardando…" : "Guardar cambios"}</button>
          {msg && <span className="saved-msg">{msg}</span>}
          {err && <span className="saved-msg" style={{ color: "#9a2020" }}>{err}</span>}
        </div>
      </div>

      <div className="editcard bsc-adm-edit">
        <h3>Carta</h3>
        <div className="sub">
          Agregá platos y bebidas, cambiá precios y orden. Para marcar algo como <b>agotado</b> esta noche usá la pestaña Comanda (un toque). Un ítem quitado no afecta los pedidos ya hechos.
        </div>

        {BSC_CATS.map((cat) => (
          <div className="vj-ecat" key={cat.id}>
            <div className="vj-ecat-h">{cat.name}</div>
            {items.filter((i) => i.cat === cat.id).map((i) => (
              <div key={i.id} className={`bsc-adm-item${i.active ? "" : " off"}`}>
                <div className="row">
                  <span className="mv">
                    <button type="button" onClick={() => setItems((s) => moveItem(s, i.id, -1))} aria-label={`Subir ${i.name || "ítem"}`}>▲</button>
                    <button type="button" onClick={() => setItems((s) => moveItem(s, i.id, 1))} aria-label={`Bajar ${i.name || "ítem"}`}>▼</button>
                  </span>
                  <input value={i.name} onChange={(e) => setItem(i.id, { name: e.target.value })} aria-label="Nombre" placeholder="Nombre" maxLength={80} />
                  <input className="num" type="number" min={0} value={i.price} onChange={(e) => setItem(i.id, { price: parseInt(e.target.value) || 0 })} aria-label={`Precio de ${i.name || "ítem"}`} title="Precio base (₡)" />
                  <button type="button" className="obtn danger" onClick={() => removeItem(i)} aria-label={`Quitar ${i.name || "ítem"}`}>✕</button>
                </div>
                <div className="row opts">
                  <input value={i.desc || ""} onChange={(e) => setItem(i.id, { desc: e.target.value })} aria-label="Descripción" placeholder="Descripción (opcional)" maxLength={200} />
                  <select value={i.image || ""} onChange={(e) => setItem(i.id, { image: e.target.value || undefined })} aria-label={`Foto de ${i.name || "ítem"}`}>
                    <option value="">Sin foto</option>
                    {BSC_PHOTOS.map((p) => <option key={p} value={p}>{p.replace(/\.\w+$/, "")}</option>)}
                  </select>
                </div>
                <div className="row opts">
                  <label className="chk"><input type="checkbox" checked={i.active} onChange={(e) => setItem(i.id, { active: e.target.checked })} /> Visible</label>
                  {cat.id !== "picar" && (
                    <label className="chk"><input type="checkbox" checked={!!i.promoTrigger} onChange={(e) => setItem(i.id, { promoTrigger: e.target.checked })} /> Cuenta para la cortesía</label>
                  )}
                </div>
                {i.variants?.map((v) => (
                  <div className="row var" key={v.id}>
                    <span className="vlbl">Variante</span>
                    <input value={v.name} onChange={(e) => setVariant(i.id, v.id, { name: e.target.value })} aria-label={`Nombre de la variante de ${i.name}`} placeholder="Nombre" maxLength={60} />
                    <input
                      className="num"
                      type="number"
                      min={0}
                      value={v.price ?? ""}
                      placeholder="= base"
                      onChange={(e) => setVariant(i.id, v.id, { price: e.target.value === "" ? undefined : parseInt(e.target.value) || 0 })}
                      aria-label={`Precio de ${v.name || "la variante"} (vacío = el precio base)`}
                    />
                    <button type="button" className="obtn" onClick={() => removeVariant(i, v.id)} aria-label={`Quitar la variante ${v.name}`}>✕</button>
                  </div>
                ))}
                <button type="button" className="obtn bsc-adm-addvar" onClick={() => addVariant(i)}>+ Variante</button>
              </div>
            ))}
            <button type="button" className="obtn" style={{ marginTop: 8 }} onClick={() => addItem(cat.id)}>+ Agregar a {cat.name}</button>
          </div>
        ))}

        <div className="ev-hint">
          Con variantes, la persona tiene que elegir una. Una variante sin precio usa el precio base; con precio propio (como el vino) el base puede quedar en 0.
          La cortesía se gana con los tragos marcados «Cuenta para la cortesía» (hoy, los tragos de la casa; cerveza y vino no).
        </div>

        <div>
          <button className="save-btn" onClick={() => save()} disabled={busy}>{busy ? "Guardando…" : "Guardar cambios"}</button>
          {msg && <span className="saved-msg">{msg}</span>}
          {err && <span className="saved-msg" style={{ color: "#9a2020" }}>{err}</span>}
        </div>
      </div>
    </>
  );
}
