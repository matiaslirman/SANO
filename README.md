# Sano — sitio de pedidos + panel del dueño

Sitio web de **Sano** (comida lista y sana, por 22 Bistro): menú semanal con
precios por combo, contador de cupos y cuenta regresiva, checkout que genera un
mensaje de WhatsApp, y un panel privado para el dueño (pedidos, resumen de
cocina en vivo y editor de contenido).

Hecho con **Next.js 15** (App Router) + React 19. Datos en **Upstash Redis /
Vercel KV** (con un fallback local en archivo para desarrollo).

---

## 1. Desarrollo local

```bash
npm install
npm run dev          # http://localhost:3000
```

Sin base de datos configurada, los datos se guardan en `.data/db.json` (solo
local). El panel del dueño está en `/admin` (contraseña por defecto:
`sano-2bistro`).

---

## 2. Desplegar en Vercel (plan gratuito)

1. Subí este proyecto a un repositorio de GitHub (o pedíselo a Claude).
2. En [vercel.com](https://vercel.com) → **Add New… → Project** → importá el repo.
   Vercel detecta Next.js automáticamente. Deploy.
3. **Base de datos (para que el panel guarde pedidos):**
   En el proyecto → pestaña **Storage** → **Create Database** → elegí
   **Upstash for Redis** (o **KV**) → conectalo al proyecto. Vercel inyecta solas
   las variables `KV_REST_API_URL` y `KV_REST_API_TOKEN`.
4. **Variables de entorno** (Settings → Environment Variables):
   - `ADMIN_PASSWORD` → la contraseña del panel del dueño.
   - `SESSION_SECRET` → un texto largo y aleatorio (para firmar la sesión).
5. **Redeploy** (Deployments → … → Redeploy) para que tome la base y las variables.

> Sin el paso 3/4 el sitio igual funciona para el cliente (arma el pedido y lo
> manda por WhatsApp), pero el panel no guarda los pedidos y usa la contraseña
> por defecto. Con la base conectada, el panel guarda todo y los cupos se
> descuentan solos.

---

## 3. Variables de entorno

Ver `.env.example`. Resumen:

| Variable | Para qué |
|---|---|
| `ADMIN_PASSWORD` | Contraseña del panel `/admin` |
| `SESSION_SECRET` | Firma la cookie de sesión del panel |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Base de datos (las pone Vercel al conectar el store) |
| `NEXT_PUBLIC_WHATSAPP` | Número de WhatsApp (default `50683193498`) |

---

## 4. Uso del panel del dueño (`/admin`)

- **Pedidos:** lista de pedidos entrantes. Botón **Marcar pagado** descuenta 1
  cupo automáticamente del contador que ven los clientes.
- **Resumen cocina:** todo lo pedido agrupado por plato/producto, en vivo.
- **Contenido:** editar los platos de la semana, los cupos, precios/combos y el
  catálogo de Sano Market — sin tocar código.

---

## 5. Marca / logo

Los logos vectoriales están en `public/brand/`. El componente `lib/brand.tsx`
tiene el wordmark y el sello embebidos (regenerables con
`node scripts/gen-brand-component.mjs` a partir de `public/brand/logo-wordmark-cream.svg`).

Colores: bordó `#921A1B`, crema `#FFF1B4`, negro `#171012`.

---

## 6. Lógica de precios (combos)

Definida en `lib/pricing.ts` y configurable desde el panel. Con los valores
actuales: 1–5 platos a ₡5.500 c/u; 6 → ₡31.000; 10 → ₡51.000; 15 → ₡75.500.
Para cantidades intermedias se aplica el combo más alto alcanzado + el excedente
a precio base.
