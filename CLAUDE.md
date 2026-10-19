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
- **Hero**: título grande en mayúsculas (Oswald, acento crema en "Y CENAS."), una línea de **precio real**
  (`heroPriceLine`) y el plazo (`closingLine`: "Pedidos abiertos hasta el sábado 12 md · Retiro lunes 19…").
  A la derecha, un **carrusel de platos** (`components/DishCarousel.tsx`): vitrina fija de fotos con el nombre
  incluido en la imagen, en `public/platos/*.webp` (fondo transparente; el orden y los tamaños están en el
  array `DISHES`). **Rota solo de forma continua** (animación CSS en bucle, tira duplicada); se pausa con el
  mouse o al mantener el dedo; con "reducir movimiento" queda una tira que se desliza a mano.
  Para cambiar una foto, pisá el `.webp` (idealmente exportado @2x/@3x desde Figma). En modo evento va el sello
  y el hero no cambia.
- **Contador del hero** ("Cierra en…" + cupos): lo gobierna `Settings.heroPillMode` (`auto` | `siempre` |
  `nunca`) y `heroPillHours`, editables en **Contenido → Contador del hero**. Por defecto `auto`: solo aparece
  cuando faltan **2 h o menos** para el cierre (y se esconde al cerrar); la pill flotante sigue la misma regla.
  Mientras está escondido, se ve la línea del plazo. Lógica y tests en `lib/hero.ts` / `scripts/test-hero.mts`.
- **Tarjeta de cliente frecuente**: ya no está en el hero; es un **pop-up** (`components/LoyaltyPopup.tsx`) que
  aparece al **volver de WhatsApp** tras crear un pedido (o a los ~3 s si la persona se queda en la página).
  "Ya la tengo" / descargar lo apagan en ese dispositivo (`lib/loyalty.ts`, localStorage). No aparece en el
  evento. El pie de página conserva su bloque "Ganá cortesías" con el enlace.
- **Proteína Extra visible**: si algún plato del menú tiene el extra activo (precio en Contenido), el hero muestra el chip
  "💪 Proteína Extra disponible · desde +₡X" y cada plato lleva su etiqueta. Sin precio configurado no aparece nada.
- **Pedidos cerrados**: el hero y la tarjeta de pausa ofrecen "Avisame cuando salga el menú" (abre WhatsApp al negocio,
  mensaje escrito; cuenta como evento `menu_alert`). La tarjeta muestra chips tocables: **"Esta semana tuvimos"** (el menú
  que acaba de cerrar, que sigue siendo `settings.menu` hasta publicar otro) y **"Los favoritos"** (top 10 de platos más
  pedidos de siempre, **solo el nombre**, sin cifras; `lib/favorites.ts` → `topDishes`, datos reales, sin eventos, unidos
  con `groupDishes` y sin repetir los del menú). Lo que la persona toca se agrega al mensaje de WhatsApp (`menuAlertMessage`).
  Llega en `PublicStatus.closed` solo cuando el sitio está pausado.
- **Contadores de uso** (`lib/track.ts`, `POST /api/track`, `store.trackEvent/getTrack`, hash `sano:track`): pop-up de la
  tarjeta (visto / descargar / "Ya la tengo" / "Ahora no") y `menu_alert`. Sin datos personales; se ven en Analítica.
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
- **Etiquetas** — resumen grande por cliente para escribir las etiquetas a mano, y pliego imprimible (una etiqueta por
  envase, `components/admin/LabelPrint.tsx`). En la etiqueta **manda el plato** (negrita) y el cliente va debajo, más
  chico; a la derecha va el **QR "volvé a pedir"** (`public/brand/qr-pedidos.svg` oficial → `https://sano-pied.vercel.app/`;
  `qr-pedidos-bn.svg` es el mismo en negro para la térmica de un solo color) con el wordmark debajo. Si el pedido tiene
  **nota/restricción**, esa nunca se corta: el QR baja 1,5 mm, se omite el wordmark y el plato se limita a 2 líneas.
  Verificado que el QR se lee en todos los formatos (también simulando 203 dpi).
- **Analítica** — ingreso proyectado / confirmado / por cobrar, tasa de pago, ticket promedio,
  producción por plato, platos y Market más vendidos, y el **ingreso por mes** (filtro por mes + histórico del negocio).
- **Contenido** — menú semanal (guardar = abrir la semana), cupos, precios y combos,
  Proteína Extra, Sano Market, Evento privado e **Ingreso histórico**.

### Ingreso por mes (`lib/months.ts` + `Settings.history`)
En **Analítica** el ingreso de cada mes son los pedidos **pagados** agrupados por la **fecha del pedido
(`createdAt`) en hora de Costa Rica** (UTC-6; el cambio de mes es a las 06:00 UTC), así que el mes en curso se
actualiza solo y se corre solo al cambiar de mes. `Settings.history` es el consolidado manual del dueño
(meses anteriores a la plataforma o ventas fuera del sitio, seed en `lib/defaults.ts`). `reconcileMonths`
toma, **por mes, el mayor** entre lo que registra la plataforma y lo cargado a mano: no se duplica ni se
pierde nada. El **Total global** es la suma de esos ingresos mensuales. Hay un filtro por mes (mes actual,
todo el tiempo o un mes con pedidos) que escopa todas las métricas. Tests: `scripts/test-months.mts`.

### Ranking de platos e insights (`lib/dishes.ts`, `lib/insights.ts`)
- **Ranking "Platos más vendidos"**: cuenta **todos los pedidos** (pagados y pendientes) con un dropdown de
  tiempo propio (`inRange` en `lib/months.ts`). `groupDishes` une platos casi idénticos (tildes, mayúsculas,
  typos de ~2 letras); es **conservador**: no une palabras distintas ni partes de más ("Pasta Corta
  Carbonara" ≠ "Pasta Carbonara"). Manda el nombre del menú actual.
- **Insights del negocio**: reglas deterministas sobre pedidos reales (combo más vendido, tamaño sin combo,
  pedidos a 1 plato de un combo, plato más/menos pedido, paquetes, Market, Proteína Extra, viernes vs lunes,
  clientes que repiten). Mínimo `MIN_ORDERS` pedidos; los de evento no cuentan. **No inventar insights**:
  cada uno muestra el dato que lo respalda.
- **Clientes** (`lib/customers.ts`, sección en Analítica): pedidos por cliente real. El teléfono manda (mismos últimos
  8 dígitos = mismo cliente; teléfonos distintos nunca se unen); sin teléfono solo se unen nombres casi idénticos
  (tildes, mayúsculas, ~2 letras en nombres largos; "Ana" ≠ "Ana María"). Eventos no cuentan. Alimenta el insight de
  clientes que repiten.
- Tests: `node --experimental-strip-types --import ./scripts/ts-extensionless.mjs scripts/test-<x>.mts`
  (`windows`, `months`, `dishes`, `insights`, `hero`, `customers`).

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
