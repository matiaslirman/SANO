# SANO — contexto del proyecto

Sitio de pedidos de **SANO by 22 Bistro** (Ciudad Colón, Costa Rica): platos de chef listos
para retirar. El cliente arma el pedido y lo confirma **por WhatsApp**; no hay pasarela de pago.
El dueño gestiona todo desde `/admin`.

**Producción:** https://sano-pied.vercel.app — Vercel auto-despliega `main`.

---

## Stack
Next.js 15 (App Router) · React 19 · TypeScript · CSS plano (sin framework de UI).

## Reglas que no se rompen
- **No modificar el branding.** Usar los recursos oficiales: `lib/brand.tsx` (`Wordmark`, `Seal`)
  y `public/brand/*.svg`. Paleta: bordó `#921A1B`, crema `#FFF1B4` (tokens en `app/globals.css`).
- **Nunca inventar datos.** Las métricas y los cupos salen de pedidos reales.
- Español rioplatense/tico con voseo ("Elegí", "Sumá") en toda la UI.
- **El diseño actual se queda.** En octubre 2026 se prototipó el rediseño tipográfico que propone
  la skill `sano-visual-redesign` y el dueño lo descartó. No volver a proponerlo ni cargar esa
  skill: los cambios de UI van sobre el diseño que ya está.

## Arquitectura
- `app/page.tsx` — landing pública. Renderiza `components/Ordering.tsx`.
- `components/Ordering.tsx` — **todo el flujo de pedido del cliente** (hero, selector de día,
  menú, Sano Market, checkout → WhatsApp). Tiene un **"modo evento"** (prop `event`) que reusa el
  mismo componente sin selector de día, sin Market y sin countdown.
- `app/evento/page.tsx` — ventana privada protegida por código (`components/EventGate.tsx`).
- `app/admin/*` — panel: **Pedidos · Resumen cocina · Etiquetas · Analítica · Contenido**
  (pestañas en `components/admin/AdminShell.tsx`).
- `lib/store.ts` — **toda la persistencia**. Upstash Redis KV si hay credenciales (`kvEnv()`);
  si no, fallback a `.data/db.json` (efímero en Vercel).
- `lib/windows.ts` — ventanas de entrega. `lib/pricing.ts` — precios y combos.
- `lib/types.ts` / `lib/defaults.ts` — modelo y semillas.

### Ventanas de entrega (clave del negocio)
Dos cierres por semana: **jueves 12 md → entrega viernes** y **sábado 12 md → entrega lunes**
(`HOUR_UTC=18` = 12 md Costa Rica). El ciclo está **atado al menú**: al guardar el menú en
Contenido se fija `Settings.menuPublishedAt` y eso congela las dos ventanas de esa semana.
Un pedido que entra tarde cae en el **ciclo actual**, no en el siguiente.
Cuando el ciclo cierra y no se publicó menú nuevo, **los pedidos se pausan**
(`OrdersPausedError` en `lib/store.ts`); publicar un menú reabre.

### Pedidos
IDs `SANO-<n>` con piso 222 (`ORDER_SEQ_FLOOR`). Estados: `pendiente` / `pagado`, más
`completed` (entregado). Los de evento llevan `eventId`. El teléfono (`whatsapp`) es opcional.

## Panel admin
- **Pedidos** — dropdown de día (`components/admin/DaySelect.tsx`), cupos, marcar pagado,
  completar, renumerar, mover de día, y **"Recordar pago"** (abre WhatsApp con el mensaje escrito;
  solo en pendientes que dejaron teléfono).
- **Resumen cocina** — checklist de producción por ítem, compartido entre pantallas; se reabre
  solo si entra un pedido que aumenta la cantidad.
- **Etiquetas** — resumen grande por cliente para escribir las etiquetas a mano.
- **Analítica** — ingreso proyectado / confirmado / por cobrar, tasa de pago, ticket promedio,
  producción por plato, platos y Market más vendidos, y el **ingreso histórico del negocio**.
- **Contenido** — menú semanal (guardar = abrir la semana), cupos, precios y combos,
  Proteína Extra, Sano Market, Evento privado e **Ingreso histórico**.

### Ingreso histórico (`Settings.history`)
Consolidado mensual que mantiene el dueño (seed en `lib/defaults.ts`, 14 meses desde sep-2025).
**El mes en curso ya incluye lo que registró la plataforma**, por eso el **Total global** es la
suma de esa tabla y **no** se le vuelven a sumar los pedidos del sitio. No duplicar.

## Desarrollo
```bash
npm run build                 # incluye typecheck + lint; que pase SIEMPRE antes de subir
rm -rf .data && PORT=3111 npm start   # preview local con estado limpio
```
Login del panel en local: contraseña `sano-2bistro` (env `ADMIN_PASSWORD`).

### Capturas (verificación visual, sin instalar nada)
Playwright ya está en la máquina:
```js
import pw from "/opt/node22/lib/node_modules/playwright/node_modules/playwright-core/index.js";
const browser = await pw.chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox"],
});
```
Verificar **siempre** en desktop (1280) y móvil (390) antes de subir. Para que las pantallas
tengan contenido, sembrar vía API: `POST /api/auth/login` → `PATCH /api/settings` (publica el
menú y abre el ciclo) → `POST /api/orders`.

> En capturas `fullPage` la barra fija del carrito aparece a mitad de página: es un artefacto
> de la captura, no un bug.

## Git y PRs
- **Una rama + PR por feature** (`claude/<slug>`), base `main`. El dueño mergea.
- **Los commits directos a `main` los bloquea el clasificador de seguridad** → siempre rama + PR.
- CI = solo deploys de Vercel (no hay test suite). Esperar verde antes de mergear.

## Convenciones de UI
- Ritmo vertical: escala 32/16 en encabezados, 40 entre secciones grandes.
- La lámina crema (`.sheet`) se monta sobre el hero con `margin-top` negativo para que las
  esquinas redondeadas caigan sobre el bordó oscuro (sin franja clara). No romper eso.
- Estilos públicos en `app/globals.css`; panel en `app/admin/admin.css`.

## Pendientes del dueño (no son código)
- Renumerar el pedido de Diego (tocar el N° en Pedidos → 222).
- **Configurar el store KV (Upstash) en producción**: sin eso los pedidos no persisten y el panel
  muestra el aviso "Base de datos no configurada".
