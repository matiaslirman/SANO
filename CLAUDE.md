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
- `components/Ordering.tsx` — **todo el flujo de pedido del cliente** (hero, menú, Sano Market,
  "Tu retiro" con el día, checkout → WhatsApp). Tiene un **"modo evento"** (prop `event`) que reusa el
  mismo componente sin día de retiro, sin Market, sin tarjetas de Viaje Sano y sin countdown.
- **Hero** (centrado, compacto): título grande en mayúsculas (Oswald, acento crema en "Y CENAS.") y **dos tarjetas tocables**
  (`.tiles` en `Ordering.tsx`): **"Esta semana"** (plazo real con `tileDeadline` en `lib/hero.ts`, días de retiro y precio reales del ciclo;
  scroll al menú) y **"Viaje Sano"**. La de Viaje Sano depende de `ViajeSettings.estado` (ver sección Viaje Sano): *abierto* → enlace a
  `/viaje-sano`; *pronto* → tarjeta atenuada "Disponible pronto" que abre WhatsApp ("Avisame cuando abra", cuenta `viaje_alert`);
  *oculto* → no hay tarjeta. `destacar` ("semana" | "viaje") decide cuál de las dos va rellena en crema (temporada de viajes). Con pedidos
  cerrados la tarjeta de la semana pasa a "Cerrado · Avisarme ↓". Debajo: chips de datos (**"Retiro en 22 Bistro · Ciudad Colón"** y, si hay
  precio configurado, **"💪 Proteína Extra disponible · desde +₡X"**), una línea de marca (@sanoby22bistro · 4,8★ en Google · atención 1 a 1)
  y la **vitrina de platos en bucle** (`components/HeroStrip.tsx`, a todo el ancho). En **modo evento** no va la vitrina: el hero es el de
  siempre, texto a la izquierda y **sello** (`lib/brand · Seal`) a la derecha.
- **Contador del hero** ("Cierra en…" + cupos): lo gobierna `Settings.heroPillMode` (`auto` | `siempre` |
  `nunca`) y `heroPillHours`, editables en **Contenido → Contador del hero**. Por defecto `auto`: solo aparece
  cuando faltan **2 h o menos** para el cierre (y se esconde al cerrar); la pill flotante sigue la misma regla.
  Mientras está escondido, el plazo se ve en la tarjeta "Esta semana". Lógica y tests en `lib/hero.ts` / `scripts/test-hero.mts`.
- **Tarjeta de cliente frecuente**: ya no está en el hero; es un **pop-up** (`components/LoyaltyPopup.tsx`) que
  aparece al **volver de WhatsApp** tras crear un pedido (o a los ~3 s si la persona se queda en la página).
  "Ya la tengo" / descargar lo apagan en ese dispositivo (`lib/loyalty.ts`, localStorage). No aparece en el
  evento. El pie de página conserva su bloque "Ganá cortesías" con el enlace.
- **Proteína Extra visible**: si un plato del menú tiene el extra activo (precio en Contenido), su fila lleva la etiqueta
  "💪 Proteína Extra disponible" (y hay un chip en el hero) y, al agregarlo, aparece el selector del extra. Sin precio configurado no aparece nada.
- **Pedidos cerrados**: la tarjeta de pausa (y "Avisarme ↓" en el hero) ofrecen "Avisame cuando salga el menú" (abre WhatsApp al negocio,
  mensaje escrito; cuenta como evento `menu_alert`). La tarjeta muestra chips tocables: **"Esta semana tuvimos"** (el menú
  que acaba de cerrar, que sigue siendo `settings.menu` hasta publicar otro) y **"Los favoritos"** (top 10 de platos más
  pedidos de siempre, **solo el nombre**, sin cifras; `lib/favorites.ts` → `topDishes`, datos reales, sin eventos, unidos
  con `groupDishes` y sin repetir los del menú). Lo que la persona toca se agrega al mensaje de WhatsApp (`menuAlertMessage`).
  Llega en `PublicStatus.closed` solo cuando el sitio está pausado.
- **Contadores de uso** (`lib/track.ts`, `POST /api/track`, `store.trackEvent/getTrack`, hash `sano:track`): pop-up de la
  tarjeta (visto / descargar / "Ya la tengo" / "Ahora no") y `menu_alert`. Sin datos personales; se ven en Analítica.
- **Menú semanal (portada)**: encabezado "Menú de la semana" + una línea de precio real (`menuPriceLine`); **una fila por plato**
  (número, nombre, etiqueta "Más pedido" si está en `status.popular` —`popularInMenu` en `lib/favorites.ts`, datos reales— y el botón
  **"+ Agregar"** sin relleno, `components/AddStepper.tsx`, 44 px). Sin fotos de platos. **Sano Market** es una tira deslizable con
  categorías y contadores (`components/MarketStrip.tsx`; "Sugeridos" usa la misma regla de siempre). El **día de retiro** se elige
  en **"Tu retiro"** (pills con cupos reales, por defecto el primero con cupos; `shortDeliveryLabel`). La comanda se edita ahí mismo
  (sumar/quitar). La **barra fija** muestra total + lo que falta para el próximo combo con una barra de progreso con marcas
  (`comboProgress` en `lib/pricing.ts`). iPhone primero: campos a 16 px (sin zoom), áreas táctiles de 44 px.

### Viaje Sano (`/viaje-sano`) — bandejas para llevar de viaje
Producto aparte del menú semanal, con su propia página, pedidos y panel. **1 bandeja = 4 porciones** (1 almuerzo o cena para 4); los
packs son solo platos fuertes (lasañas, pechugas rellenas, arroz chaufa); proteínas/acompañamientos/salsas son extras sueltos.
- **Flujo**: calculadora (personas, almuerzos, cenas → bandejas) → **recomendación de pack** (`recommendPack`, tolerancia ±1 bandeja)
  → packs o armado a gusto → "Tu retiro": **el cliente elige la fecha** (anticipación mínima `leadDays`, 7 por defecto, en hora CR) →
  confirma por **WhatsApp** (sin pasarela, sin cupos). El dueño confirma fecha y hora por WhatsApp. Las bandejas van **refrigeradas**
  (aviso de cadena de frío, `chainText`). Premios por monto (`rewards`, p. ej. "1 salsa de regalo").
- **Estado** (`ViajeSettings.estado`, Contenido → Viaje Sano): `oculto` (404 para el público), `pronto` (por defecto: tarjeta atenuada
  + página "Disponible pronto") o `abierto`. El dueño logueado ve y prueba la página real aunque no esté abierta. Con estado distinto de
  `abierto`, `POST /api/viaje/orders` responde 409.
- **Lógica pura** en `lib/viaje.ts` (calculadora, packs, fechas en hora CR, `checkViajeOrder`, mensajes de WhatsApp, `normalizeViaje`).
  El **servidor es la autoridad de precios**: el cliente solo manda ids y cantidades.
- **Pedidos**: mismo contador `SANO-<n>`, pero con `kind: "viaje"`, `pickupDate`, `pickupConfirmed`, `viaje` (líneas con precio del
  momento), `viajePack`, `viajeGift`, `windowId: "viaje"`. **Aislamiento**: `store.listOrders()` **excluye** los pedidos de viaje, así que
  cupos, Pedidos, Resumen cocina, Etiquetas, insights, ranking y clientes nunca los ven. `store.listViajeOrders()` / `listAllOrders()` son
  opt-in explícito. Lo único que los mezcla es el **ingreso por mes** de Analítica (y su tarjeta propia "Viaje Sano").
- **Panel**: pestaña **Viaje Sano** (`/admin/viaje`, `components/admin/ViajeOrdersView.tsx`): pedidos por fecha de retiro, **"Qué cocinar"**
  (bandejas/porciones por plato y extras por unidad), mover fecha (queda "Por confirmar"), "Confirmar fecha" por WhatsApp, pagado/entregado.
  El editor vive en **Contenido → Viaje Sano** (`components/admin/ViajeEditor.tsx`): estado, textos, anticipación, catálogo con precios y
  "Activo", packs y premios. API: `/api/viaje/orders` (POST público si está abierto; GET admin), `/api/viaje/settings` (admin).
- **Pendientes del dueño** (no inventar): vida útil refrigerada de las bandejas, alérgenos/ingredientes, horario de retiro de Viaje Sano
  (hoy se asume 8 a. m.–12 md).
### Bistro Social Club (`/bistro-social-club`) — evento temporal con carta, promo y comanda
Noche **fuera de horario** en 22Bistro (jueves 19 de nov de 2026, desde las 7:30 p. m.). Es una sección aparte con **su propio look** (solo
esa pestaña): azul `#003BFF` + papel `#ECEBE6` + tinta `#1A1A1A`, **IBM Plex Mono autoalojada** (`public/bsc/fonts`, sin pedir nada a Google),
grano de papel, cruces de corte, encabezados `[ENTRE CORCHETES]`, tarjetas con foto y etiqueta superpuesta, sin degradados ni emojis, ticket de
confirmación con muescas ("ADMITE 1"). Estilos en `app/bistro-social-club/bsc.css` (todo bajo `.bsc`). **El logo son solo los archivos del
cliente** (`public/bsc/logos`): nunca escribir "Bistro Social Club" como texto con otra tipografía para hacer de logo. El resto del sitio no cambia.
- **Ventana** (`BscSettings.availableFrom/availableUntil`, hora CR, editable en el panel): se ve y recibe pedidos desde el **jueves 19/11 00:00**
  hasta el **viernes 20/11 08:00**. Antes de abrir → **404** (y no hay enlace); después → "ya terminó"; el enlace "Bistro Social Club" del encabezado
  de la portada **solo aparece dentro de la ventana** (`PublicStatus.bsc`). **El servidor es la autoridad**: `POST /api/bsc/orders` responde 409
  fuera de la ventana o con el interruptor apagado (`bscOpen`). El dueño con sesión ve la página siempre (vista previa) y puede probar pedidos.
- **Carta** (`DEFAULT_BSC` en `lib/defaults.ts`; guardada como `sano:bsc`): tragos ₡5.000 (Gin Tonic y Paloma con variante **obligatoria**), cerveza ₡2.000,
  vino (2 variantes: ₡3.500 / ₡4.000, **nombres pendientes**: hoy "Opción ₡3.500/₡4.000"), 5 platos para picar ₡3.000. Precios y variantes salen
  de la carta, nunca del cliente.
- **Promo** (`applyPromo` en `lib/bsc.ts`): "primer plato para picar incluido con tu primer trago" — **por persona, una sola vez**: con ≥1 trago
  de la casa (`promoTrigger`) en la cuenta, el **primer** plato para picar (`promoEligible`) que pidió esa persona sale a ₡0, sin importar el
  orden ni cuántos pedidos use. **Cerveza y vino no la activan.** Es de la **cuenta**, no del pedido.
- **Cuenta por persona** (`accountKey`/`buildAccounts`): mismo teléfono (últimos 8 dígitos) = misma persona; sin teléfono, mismo nombre exacto
  (sin tildes ni mayúsculas). El celular recuerda nombre/teléfono/mesa (`sano:bsc:contact`) para que sus pedidos caigan en la misma cuenta.
  Cuenta pagada = todos sus pedidos pagados; un pedido nuevo la reabre sola.
- **Pedidos**: `kind: "bsc"`, `bsc` (líneas con precio del momento), `bscTable`, `bscPrep` (`recibido → preparando → entregado`), `bscEdition`, `bscBy` (`cliente` | `staff`;
  `staff` solo lo puede marcar quien tiene sesión del panel), `bscPay` (`efectivo` | `sinpe` | `tarjeta`) y `bscPaidAt`, `windowId: "bsc"`;
  comparten la numeración `SANO-<n>`. **Aislamiento**: `store.listOrders()` los **excluye** (no tocan cupos, Pedidos, cocina, etiquetas, insights ni
  ranking); `store.listBscOrders()` es opt-in. **No suman al ingreso mensual de Analítica** (decisión pendiente del dueño).
- **Ediciones** (`BscSettings.editionId` = fecha CR del evento, p. ej. `2026-11-26`): cada jueves tiene su comanda y sus totales. Los pedidos llevan
  `bscEdition`; **los de la primera edición (19/11) no lo traen y cuentan como `2026-11-19`** (`LEGACY_EDITION`, `orderEdition`). El `editionId` solo
  cambia con el botón **"Empezar la próxima edición (+7 días)"** (mueve evento y ventana una semana, mismas horas; `nextEditionPatch`), no al editar
  fechas. La edición anterior queda consultable en el selector "Edición" y en la tabla de ediciones de Ventas.
- **Plataforma del staff** (`/admin/bsc`, pestaña "Bistro Social Club" mientras el interruptor esté encendido; `BscView.tsx` con tres vistas):
  - **Comanda** (`BscComanda.tsx`): **Disponibilidad** (un toque marca un ítem *agotado*; desaparece al instante de la página de los clientes),
    **Nueva comanda** (`BscCaptura.tsx`: el equipo carga lo que pide cada persona; mismo servidor, mismos precios y misma promo, calculada sobre la
    cuenta completa; "+ Pedido" en una cuenta la precarga), **Qué preparar ahora**, cuentas por persona con estado de cada pedido (un toque avanza),
    **Cobrar cuenta** (pide el método: efectivo, SINPE o tarjeta; guarda método y hora) / Reabrir, filtros, CSV e imprimir.
  - **Ventas** (`BscVentas.tsx`): **Facturado** (= suma de totales de las cuentas, ya con promos), Cobrado, Por cobrar, ticket promedio, **cobrado por método**
    (para cuadrar la caja), tabla **"Lo vendido y lo que salió"** por ítem (pedidos / salió = entregado / falta / ingreso) que **cuadra siempre**:
    bruto − promos = facturado, y los métodos suman lo cobrado; ventas por hora (hora CR, cruza la medianoche); resumen por edición; CSV.
  - **Carta y edición** (`BscEditor.tsx`): **agregar, quitar y ordenar platos y bebidas** (categorías fijas: tragos, cerveza y vino, para picar), precios,
    variantes (con precio propio o el base), foto (de `public/bsc/fotos`), qué ítems activan o reciben la promo; fechas y ventana; nueva edición.
    Los ítems nuevos estrenan un id legible a partir del nombre; un ítem quitado no afecta los pedidos ya hechos (guardan su propia copia de la línea).
  Protegida por la sesión del panel; botones de 44 px; se actualiza sola cada 8 s. La comanda sigue accesible después de la ventana.
- API: `/api/bsc/orders` (POST público en ventana, o del staff con `staff: true`; GET staff), `/api/bsc/settings` (staff), `/api/bsc/accounts` (staff: cobrar con método / reabrir).
- **Pendientes del dueño** (confirmar, no inventar): qué distingue los dos vinos, si cerveza/vino deben activar la promo, derechos de uso públicos de
  las fotos (algunas las aportó el cliente), cómo se cobra la cuenta (la página no dice nada al respecto), y los logos en SVG (los PNG son de baja resolución).
- `app/evento/page.tsx` — ventana privada protegida por código (`components/EventGate.tsx`).
- `app/admin/*` — panel: **Pedidos · Viaje Sano · Bistro Social Club (temporal) · Resumen cocina · Etiquetas · Analítica · Contenido**
  (pestañas en `components/admin/AdminShell.tsx`).
- `lib/store.ts` — **toda la persistencia**. Upstash Redis KV si hay credenciales (`kvEnv()`);
  si no, fallback a `.data/db.json` (efímero en Vercel).
- `lib/windows.ts` — ventanas de entrega. `lib/pricing.ts` — precios y combos.
- `lib/types.ts` / `lib/defaults.ts` — modelo y semillas.

### Ventanas de entrega (clave del negocio)
Dos cierres por semana: **jueves 12 md → entrega viernes** y **sábado 7:30 p. m. → entrega lunes**
(tabla `CUTOFFS` en `lib/windows.ts`, en hora CR = UTC-6). El sábado 7:30 p. m. CR ya es domingo 01:30 UTC, por eso
el `id` de la ventana es la **fecha CR** del cierre (el sábado) y no la fecha UTC: así los pedidos viejos
(id de sábado) siguen en su ventana. Para mover una hora, tocá solo `CUTOFFS`. El ciclo está **atado al menú**: al guardar el menú en
Contenido se fija `Settings.menuPublishedAt` y eso congela las dos ventanas de esa semana.
Un pedido que entra tarde cae en el **ciclo actual**, no en el siguiente.
Cuando el ciclo cierra y no se publicó menú nuevo, **los pedidos se pausan**
(`OrdersPausedError` en `lib/store.ts`); publicar un menú reabre.

### Pedidos
IDs `SANO-<n>` con piso 222 (`ORDER_SEQ_FLOOR`). Estados: `pendiente` / `pagado`, más
`completed` (entregado). Los de evento llevan `eventId`. El teléfono (`whatsapp`) es opcional.
El **correo** (`email`, opcional, minúsculas; `lib/contact.ts`) vincula al cliente con su tarjeta de sellos: se pide en
"Tus datos" (no en eventos), se valida en cliente y servidor (400 si viene mal escrito) y **se recuerda en el celular**
(localStorage `sano:contact`: nombre, WhatsApp y correo) para escribirlo una sola vez.

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
  producción por plato, platos y Market más vendidos, y el **ingreso por mes** (filtro por mes + histórico del negocio; incluye los pedidos pagados de Viaje Sano, que además tienen su tarjeta propia).
- **Contenido** — menú semanal (guardar = abrir la semana), cupos, precios y combos,
  Proteína Extra, Sano Market, Evento privado, **Viaje Sano** (estado, catálogo, packs) e **Ingreso histórico**.
  - **Historial de platos** en el editor del menú: chips "Volver a incluir" con los platos de semanas
    anteriores (pedidos reales, sin eventos, agrupados con `groupDishes` y ordenados por más pedidos; se calcula
    en `app/admin/contenido/page.tsx` y se pasa como `dishHistory`). Tocar un chip agrega el plato al menú en
    vivo; los que ya están en el menú no se ofrecen (match con `sameDish`). No inventa nada.
  - **Artes del menú (Instagram)**: genera 2 imágenes del menú para postear —**feed** 1080×1350 y **story**
    1080×1920— con la plantilla de marca (`components/MenuArt.tsx` + `MenuArt.module.css`): header bordó,
    sello (`lib/brand · Seal`), lámina crema con la lista numerada y el **tenedor** (`public/brand/icon-tenedor.svg`,
    incrustado como mask en `lib/menuArtFork.ts`) entrando desde el margen izquierdo. Usa los platos **en vivo** del
    editor; el rango de fechas se prefija del ciclo (`getCycleWindows`) y es editable. La descarga a PNG es
    client-side con **html-to-image** (`toPng`, `pixelRatio:2`). Para cambiar el tenedor, pisá el `.webp`/svg y
    regenerá `lib/menuArtFork.ts` (`base64 -w0 public/brand/icon-tenedor.svg`).
  - **Copys para Instagram**: debajo de los artes, dos textos listos para **copiar y pegar** (feed y story),
    generados del menú + rango de fechas (botón "Copiar", `navigator.clipboard`). Se actualizan solos al editar.

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
- **Clientes** (`lib/customers.ts`, sección en Analítica): pedidos por cliente real. El **correo** manda (mismo correo =
  mismo cliente; correos distintos nunca se unen); luego el teléfono (mismos últimos
  8 dígitos = mismo cliente; teléfonos distintos nunca se unen); sin teléfono solo se unen nombres casi idénticos
  (tildes, mayúsculas, ~2 letras en nombres largos; "Ana" ≠ "Ana María"). Eventos no cuentan. Alimenta el insight de
  clientes que repiten.
- Tests: `node --experimental-strip-types --import ./scripts/ts-extensionless.mjs scripts/test-<x>.mts`
  (`windows`, `months`, `dishes`, `insights`, `hero`, `customers`, `favorites`, `viaje`, `weekly`, `bsc`).

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

## Backlog (acordado, sin construir todavía)
Orden: primero cerrar lo de "Avisame cuando salga el menú" con platos del historial; después lo de abajo.

### Fidelización: tarjeta de 5 sellos (próximo tema)
Hoy la tarjeta es un wallet-pass de **add2wallet** (`LOYALTY_URL` en `lib/loyalty.ts`) y los sellos los pone el dueño **a
mano**; desde que los pedidos entran por la plataforma se le olvida sellar. Plan por fases:
1. **Contador + recordatorio manual (sin API)**: sellos por cliente (reusar `lib/customers.ts`: teléfono manda, nombres
   casi idénticos se unen), "Falta sellar" en Pedidos al marcar pagado/entregado, marca "sello puesto" por pedido y
   columna de sellos (x/5) en Analítica → Clientes. Eventos no cuentan.
2. **Botón "Sellar" que llama a la API de add2wallet** (la plataforma es Basetime a2w; su SDK expone `updatePass` y
   `redeem`). Server-side (ruta API), con la llave en variable de entorno de Vercel (`ADD2WALLET_API_KEY`, **nunca** en el
   código ni en el chat). Bloqueo conocido: el link de descarga es genérico, así que hay que poder **vincular cada pase con
   un cliente** (teléfono/correo/ID de pase) antes de automatizar.
3. **Automático al marcar pagado**, solo cuando 2 esté probado.
Reglas por confirmar con el dueño: cuándo suma un sello (¿pagado o entregado? ¿monto mínimo?), qué se gana al completar 5
y si la tarjeta se reinicia. Necesito: documentación/permisos de la API y cómo identifica la plataforma a cada cliente.

### Otras ideas pendientes de decisión
- **Combos clickeables** en el menú (meta con barra de progreso "llevás 3 de 10", sin pre-llenar el carrito).
- **Placeholder de platos** en "Avisame cuando salga el menú": chips con los platos más pedidos del historial real
  (`groupDishes` sobre pedidos; nunca inventar), que arman el mensaje de WhatsApp.

## Pendientes del dueño (no son código)
- Renumerar el pedido de Diego (tocar el N° en Pedidos → 222).
- **Configurar el store KV (Upstash) en producción**: sin eso los pedidos no persisten y el panel
  muestra el aviso "Base de datos no configurada".
