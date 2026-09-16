import { readFileSync, writeFileSync } from "node:fs";

const FILES = [
  "package.json", "tsconfig.json", "next.config.mjs", "middleware.ts",
  "app/globals.css", "app/layout.tsx", "app/page.tsx",
  "app/admin/admin.css", "app/admin/layout.tsx", "app/admin/page.tsx",
  "app/admin/login/page.tsx", "app/admin/pedidos/page.tsx", "app/admin/cocina/page.tsx", "app/admin/contenido/page.tsx",
  "app/api/status/route.ts", "app/api/orders/route.ts", "app/api/orders/[id]/route.ts",
  "app/api/settings/route.ts", "app/api/market/route.ts",
  "app/api/auth/login/route.ts", "app/api/auth/logout/route.ts",
  "components/SiteHeader.tsx", "components/SiteFooter.tsx", "components/Ordering.tsx",
  "components/admin/AdminShell.tsx", "components/admin/LogoutButton.tsx",
  "components/admin/OrdersView.tsx", "components/admin/KitchenView.tsx", "components/admin/ContentEditor.tsx",
  "lib/types.ts", "lib/pricing.ts", "lib/windows.ts", "lib/format.ts",
  "lib/defaults.ts", "lib/store.ts", "lib/auth.ts", "lib/auth-server.ts", "lib/brand.tsx",
  "public/brand/logo-seal.svg",
];

const out = FILES.map((f) => ({ file: f, data: readFileSync(f, "utf8") }));
// one entry per line for reliable reading/verification (still valid JSON)
const json = "[\n" + out.map((e) => JSON.stringify(e)).join(",\n") + "\n]\n";
writeFileSync("deploy-manifest.json", json);
const raw = out.reduce((s, e) => s + e.data.length, 0);
console.log(`files: ${out.length} | raw chars: ${raw} | manifest bytes: ${json.length}`);
