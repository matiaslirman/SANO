# Sano — Contexto del proyecto (handoff)

> Documento para retomar el proyecto en una conversación nueva. Resume qué es,
> cómo está montado, cómo se hacen cambios y qué quedó pendiente.
> Última actualización: 2026-09-16.

## 1. Qué es
**Sano** es el servicio de comidas preparadas de **22 Bistro** (Ciudad Colón,
Costa Rica). Este proyecto es su **sitio web de pedidos + panel del dueño**:
- El cliente ve el menú de la semana, arma su pedido (con precios por combo),
  y confirma enviando un mensaje de **WhatsApp** pre-armado al **8319-3498**.
- El dueño entra a `/admin` (login) y ve pedidos, resumen de cocina en vivo, y
  edita el contenido (menú, cupos, precios, Sano Market) sin tocar código.

## 2. Estado actual (EN VIVO ✅)
- **Sitio (producción):** https://sano-pied.vercel.app
- **Panel del dueño:** https://sano-pied.vercel.app/admin
- **Repo GitHub:** https://github.com/matiaslirman/SANO (rama `main`)
- **Vercel:** proyecto `sano` (cuenta/scope `sano16`). **Auto-deploy activo:**
  cada push a `main` publica solo a producción.
- **Base de datos:** Upstash Redis (store `upstash-kv-citron-umbrella`) conectada
  por la integración de Vercel → los pedidos se guardan de verdad.
- El proyecto vive en la **raíz** del repo (no anidado).

## 3. Stack técnico
- **Next.js 15** (App Router) + **React 19** + **TypeScript**.
- **CSS plano**: `app/globals.css` (cliente) y `app/admin/admin.css` (panel).
- **Fuentes** (next/font): Oswald (display) + Archivo (texto).
- **Datos**: `lib/store.ts` — Upstash Redis con **detección robusta de
  credenciales** (toma `KV_REST_API_*`, `UPSTASH_REDIS_REST_*` o cualquier
  variable `*REST_API_URL`/`*REST_API_TOKEN`, con o sin prefijo). Fallback a
  archivo local (`.data/db.json`) solo en desarrollo.
- **Auth admin**: cookie firmada con HMAC (`lib/auth.ts`); `middleware.ts`
  protege `/admin`.

## 4. Estructura de archivos (lo importante)
```
app/page.tsx              Landing (server): arma PublicStatus + <Ordering/>
components/Ordering.tsx   TODO el flujo del cliente (hero, contador, menú,
                         combos, Sano Market, checkout, comanda, barra sticky,
                         y el mensaje de WhatsApp -> función buildWaMessage)
components/SiteHeader.tsx / SiteFooter.tsx
app/admin/login|pedidos|cocina|contenido/page.tsx
components/admin/OrdersView.tsx   Pedidos: marcar pagado / completar / eliminar
components/admin/KitchenView.tsx  Resumen de cocina agrupado por plato (live)
components/admin/ContentEditor.tsx  Editar menú, cupos, precios, Sano Market
app/api/status            GET público (menú, cupos, ventana, precios)
app/api/orders            POST crea pedido · GET lista (admin)
app/api/orders/[id]       PATCH (status/completed) · DELETE (admin)
app/api/settings          GET/PATCH (admin) contenido/cupos/precios
app/api/market            GET público · PATCH (admin)
app/api/auth/login|logout
lib/pricing.ts            Lógica de combos
lib/windows.ts            Ventanas de entrega / cuenta regresiva
lib/defaults.ts           Menú y catálogo Sano Market por defecto
lib/brand.tsx             Logo (wordmark + sello) inline en SVG
public/brand/             Logos reales de la marca (SVG) + favicon (logo-seal.svg)
```

## 5. Lógica de negocio
- **Precios (combos por volumen sobre el TOTAL de platos)** — `lib/pricing.ts`:
  base ₡5.500/plato; 6→₡31.000, 10→₡51.000, 15→₡75.500. Cantidades intermedias:
  el combo más alto alcanzado + el excedente a precio base. Editable desde
  `/admin → Contenido` (y por defecto en `lib/defaults.ts`).
- **Ventanas de entrega** — `lib/windows.ts` (hora CR, UTC-6):
  cierre **Jueves 12:00 md → entrega Viernes**; cierre **Sábado 12:00 md →
  entrega Lunes**. El contador apunta al próximo cierre.
- **Cupos**: `cuposTotales − pedidos pagados de la ventana activa` (derivado).
  Marcar un pedido **Pagado** descuenta 1 cupo automáticamente.
- **Estados de pedido**: `pendiente` → `pagado` (descuenta cupo) · `completado`
  (se tacha) · eliminar (borra). Cancelación del cliente = eliminar.
- **WhatsApp**: número `50683193498`. El mensaje lo arma `buildWaMessage()` en
  `components/Ordering.tsx`, con formato tipo comanda (Orden, entrega, PLATOS
  LISTOS, SANO MARKET, TOTAL con desglose de combo).

## 6. Variables de entorno (Vercel → Settings → Environment Variables)
| Variable | Para qué |
|---|---|
| `ADMIN_PASSWORD` | Contraseña del panel `/admin` (si falta, usa `sano-2bistro`) |
| `SESSION_SECRET` | Firma la cookie de sesión (ya configurada en Vercel) |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Base de datos (las puso la integración Upstash) |
| `NEXT_PUBLIC_WHATSAPP` | Número de WhatsApp (default `50683193498`) |

## 7. Cómo hacer cambios (workflow)
- **Contenido** (menú, etiqueta de semana, cupos, precios/combos, catálogo de
  Sano Market): el dueño lo edita solo desde **`/admin → Contenido`**, sin
  código ni deploy.
- **Código/diseño**: editar → `git commit` → `git push origin main` →
  **Vercel auto-deploya a producción**. (Claude tiene acceso de escritura al
  repo en esta cuenta.)
  - En una **sesión nueva**, Claude debe re-adjuntar el repo con `add_repo`
    (`matiaslirman/SANO`, access push) antes de pushear.
  - **No usar force-push** (bloqueado). Usar merges/fast-forward.
  - Las **lecturas del MCP de Vercel dan 403** (scope) → para ver estado de
    deploys/logs, el dueño mira el panel de Vercel (pestaña Deployments).

## 8. Marca
- Colores: bordó **#921A1B**, crema **#FFF1B4**, negro **#171012**.
- Tipografía condensada en mayúsculas (Oswald + Archivo).
- Logos reales del dueño en `public/brand/` (wordmark crema/bordó + sello).

## 9. Pendientes / ideas
- Quedó una rama de prueba **`claude-probe`** en el repo (inofensiva; borrar
  desde GitHub → Branches si molesta; no se pudo borrar por permisos de API).
- Posibles próximos: sección de **Programa de fidelidad** (hoy hay botón a la
  tarjeta 2Wallet en el footer), **dominio propio** en Vercel, fotos de platos.

## 10. Cómo empezó (resumen de la sesión)
Prototipo interactivo (artifact) aprobado por el dueño → app Next.js completa →
deploy en Vercel por CLI → conexión de Upstash KV (arreglo de detección de
credenciales) → 5 mejoras (favicon de marca, completar/eliminar pedidos, barra
que confirma por WhatsApp, quitar campo de número, mensaje de WhatsApp detallado)
→ auto-deploy por GitHub (`main`).
