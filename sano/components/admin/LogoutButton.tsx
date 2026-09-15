"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/admin/login");
      router.refresh();
    }
  }
  return (
    <button className="logout" onClick={logout} disabled={busy}>
      {busy ? "Saliendo…" : "Cerrar sesión"}
    </button>
  );
}
