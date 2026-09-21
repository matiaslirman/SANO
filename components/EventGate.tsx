"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Seal } from "@/lib/brand";

/** Puerta de acceso al evento privado: pide el código y, si es correcto, recarga
 *  la página para mostrar el flujo de pedido. */
export function EventGate({ title, subtitle }: { title: string; subtitle: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/evento/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || "No se pudo entrar");
      }
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="gate">
      <form className="gate-card" onSubmit={submit}>
        <div className="gate-seal">
          <Seal />
        </div>
        <h1>{title}</h1>
        <p>{subtitle || "Ingresá el código del evento para ver el menú."}</p>
        <div className="gate-field">
          <label htmlFor="code">Código del evento</label>
          <input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="Ej: PLAYA"
          />
        </div>
        {err && <div className="gate-err">{err}</div>}
        <button className="gate-btn" type="submit" disabled={busy || !code.trim()}>
          {busy ? "Entrando…" : "Entrar al evento"}
        </button>
        <Link href="/" className="gate-back">
          ← Volver al sitio
        </Link>
      </form>
    </div>
  );
}
