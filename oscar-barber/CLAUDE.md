# Oscar Barber — Guía del proyecto

Web para **Oscar**, barbero amigo del usuario que trabaja **a domicilio** (sin local físico) en **Sevilla**.
Funcionalidad principal: gestión de citas online con calendario y panel admin para el barbero.

## Stack y filosofía

- **HTML + CSS + JavaScript vanilla**. Sin frameworks, sin bundlers, sin build step.
- **Sin backend**. Las citas se guardan en `localStorage` del navegador del cliente.
- **Arquitectura SPA single-page**: todo el sitio vive en `index.html`. La reserva y el admin son **modales/overlays**, no páginas separadas.
- Idioma: **español** en todos los textos, formularios y mensajes.
- Tipografía servida desde Google Fonts (Bebas Neue + Manrope + JetBrains Mono).

## Estructura del proyecto

Forma parte del monorepo **OwnApps** (https://github.com/Pabloguti01/OwnApps), como subdirectorio `oscar-barber/`.

```
OwnApps/
├── README.md                  Índice del monorepo
└── oscar-barber/
    ├── index.html             Single-page con todas las secciones + modales
    ├── assets/
    │   └── logo.jpg           Logo del cliente (negro sobre blanco)
    ├── css/
    │   └── styles.css         Estilos completos (tema oscuro, ámbar, Bebas Neue)
    ├── js/
    │   ├── config.js          CONFIG DEL NEGOCIO (editar aquí)
    │   ├── storage.js         Wrapper sobre localStorage (clave: ob_appointments_v1)
    │   └── app.js             Todo el JS de UI (bindings, wizard, admin, export CSV, atajos)
    ├── README.md              Documentación de despliegue
    └── CLAUDE.md              Este archivo
```

Solo **9 archivos** en el proyecto (incluyendo logo y docs). Estructura plana e intencionadamente simple.

## Secciones del sitio (`index.html`)

Orden visual de arriba a abajo:

1. **Nav sticky** con blur, logo, menú ancla, teléfono y CTA "Reservar cita".
2. **Hero** con tipografía gigante "Yo voy a tu casa", visual del logo invertido y meta (precio, duración, horario).
3. **Ticker** animado horizontal en ámbar.
4. **Servicios** — 2 cards (Corte 10€, Corte + Barba 12€).
5. **Proceso** — 4 pasos numerados (reservas → confirmamos → llegamos → pagas).
6. **Galería** — 7 placeholders con rayas (a sustituir por fotos reales cuando Oscar las tenga).
7. **Sobre Oscar** — texto + quote + tags. Hay placeholder `[ Retrato Oscar ]` para foto futura.
8. **CTA banner** ámbar con "Reserva en un minuto".
9. **Contacto** — 3 cards (teléfono, Instagram, horario).
10. **Footer** con copyright + `[ ADMIN ]` link (disparador del modal de login).

## Configuración (todo en `js/config.js`)

- `business`: `name`, `tagline`, `city` (Sevilla), `phone`, `email`, `instagram`, `serviceArea`. Estos valores se inyectan en el HTML mediante `data-bind` (ver más abajo).
- `schedule`: horario semanal por día (0=Dom, 1=Lun, ...). Permite múltiples turnos por día. `null` = cerrado. **Actual: L–V de 10:00 a 14:00. Sábado y domingo cerrados.**
- `closedDates`: array de fechas `"YYYY-MM-DD"` cerradas (vacaciones, festivos).
- `booking`:
  - `slotIntervalMin` (15) — granularidad de slots.
  - `maxDaysAhead` (60) — días vista hacia adelante.
  - `minLeadTimeMin` (30) — antelación mínima para "hoy".
  - **`travelBufferMin` (30) — minutos de traslado entre citas a domicilio**. Crítico: dos citas no pueden encadenarse sin este buffer porque Oscar tiene que desplazarse.
- `services`: catálogo. Actualmente Corte (10€/30 min) y Corte + Barba (12€/30 min). Los `id` no deben cambiarse cuando ya hay reservas guardadas.
- `notifications`: `emailTo` y `enabled`. Al confirmar una reserva se hace POST a FormSubmit.
- `admin`: `password` para acceder al panel. ⚠ Seguridad client-side.
- `weekdays`, `weekdaysShort`, `weekdaysOneLetter`, `months`, `monthsShort`: localización ES, lunes-primero.

## Bindings dinámicos (`data-bind`)

Para que `config.js` sea la fuente única de verdad, los textos críticos del HTML llevan `data-bind="..."` y `app.js` los rellena al cargar. Soporta:

- `data-bind="phone"` → texto del teléfono
- `data-bind="phone-tel"` → atributo `href` con `tel:...`
- `data-bind="email"` → texto del email
- `data-bind="email-mailto"` → `href="mailto:..."`
- `data-bind="city"` → texto de la ciudad
- `data-bind="instagram"` → texto y `href` al perfil
- `data-bind="hours"` → texto del horario del lunes (ej. "10:00h–14:00h")
- `data-bind="year"` → año actual

## Esquema de citas en `localStorage`

Clave: `ob_appointments_v1`. Cada cita:

```js
{
  id, createdAt,
  serviceId, serviceName, durationMin, price,
  date,          // 'YYYY-MM-DD'
  startMin,      // minutos desde medianoche (ej. 600 para 10:00)
  endMin,        // startMin + durationMin
  customer: { name, phone, email, notes },
  address,       // dirección completa del servicio a domicilio
  addressNotes,  // referencias para llegar (portero, código, ...)
  status         // 'confirmed' (las canceladas se borran físicamente)
}
```

Hay un migrador automático en `storage.js` que convierte el esquema antiguo (con `time: "HH:MM"` y sin `address`) al nuevo al leer. Compat con reservas guardadas antes del rediseño.

## Flujo de reserva (modal `#booking-modal`)

**5 pasos**, todos dentro del modal. Cierre con ESC, botón ✕ o clic en el backdrop.

1. **Servicio** — elegir uno del catálogo.
2. **Dirección** — campo obligatorio (calle + nº + piso) + notas para llegar (opcional). Crítico para domicilio.
3. **Fecha** — calendario mensual. Solo se habilitan los días con al menos 1 slot libre. Cada día reservable muestra "N libres".
4. **Hora** — slots de 15 min. Se computa que entre dos citas haya **`travelBufferMin` (30 min) de margen** además del tiempo de servicio. Slot ocupado → tachado.
5. **Datos** — nombre (obligatorio), teléfono (obligatorio, mín. 6 dígitos), email (opcional pero validado si se rellena), notas.
6. **Confirmación** — tarjeta de resumen con la referencia generada. Botón "Listo, cerrar".

Antes de guardar (`confirmBooking`), se revalida que el slot siga libre por si otro cliente lo ha cogido entre tanto.

## Notificaciones por email

Al confirmar una reserva, `app.js → sendNotification(record)` hace un POST `https://formsubmit.co/ajax/<email>` con todos los datos incluida la **dirección** del cliente y las notas. Incluye `_replyto` con el email del cliente si lo proporcionó (responder al email contesta directo al cliente).

**Activación inicial obligatoria**: la primera vez que se manda un email a una dirección concreta, FormSubmit envía a esa dirección un correo de **activación** ("Confirm your email"). Hasta que se pulsa ese enlace, los emails posteriores no llegan.

1. Hacer una reserva de prueba desde el sitio.
2. Abrir el email "Activate Your Form" en la bandeja de `notifications.emailTo`.
3. Pulsar "Activate Form".
4. A partir de ahí, todas las reservas llegan automáticamente.

**Email actual**: `pabloguti1006@gmail.com` (provisional del usuario para pruebas).

El envío es **no bloqueante**: si FormSubmit cae o hay rate limit, la cita igualmente queda guardada y el cliente ve la pantalla de confirmación. El fallo solo se loguea en consola.

## Panel admin (modal overlay `#admin-shell`)

**Doble acceso**:
1. **`[ ADMIN ]`** en el footer (visible pero discreto).
2. **Long-press de 1.5 s sobre el logo/`.brand`** del nav → abre el modal de login.

**Modal de login** (`#admin-login-modal`): contraseña en `CFG.admin.password`. Sesión en `sessionStorage` (se borra al cerrar la pestaña). Si la contraseña es correcta, abre el panel.

**Panel** (full-screen overlay):
- **Barra superior**: badge ADMIN, título, reloj live, botón "Exportar CSV", botón "Salir" (cierra sesión).
- **Tabs**: Día / Semana.
- **KPIs**: Citas hoy (con € facturados), Citas esta semana (con € totales), Próxima cita, Total reservas.
- **Vista Día**: timeline por horas/medias horas con la cita en cada slot. Empty states cuando no hay nada o es fin de semana.
- **Vista Semana**: grid L–V con las citas como bloques. Hoy resaltado en ámbar.
- **Detail drawer** (panel lateral derecho): clic en una cita → muestra todos los datos (nombre, tel, email, dirección, notas), botones **Llamar** y **WhatsApp** (genera `https://wa.me/34<digits>`), botón **Cancelar cita** (con confirm, hace hard delete).
- **Export CSV**: descarga todas las citas con BOM (Excel-friendly).

**Sincronización entre pestañas**: si en otra pestaña se guarda/elimina una cita, el admin se refresca automáticamente vía evento `storage`.

⚠ **Limitación crítica del admin sin backend**: el admin **solo muestra las citas guardadas en el navegador donde está abierto**. Las reservas las hace el cliente desde SU navegador, no llegan al de Oscar. La notificación por email es la vía real. El admin sirve como vista local + para registrar manualmente citas que Oscar reciba por otros canales.

⚠ **Seguridad**: la contraseña vive en el JS del cliente; cualquiera con DevTools la ve. Sirve solo para evitar accesos casuales.

## Diseño visual

- **Paleta**: fondo casi negro `#0a0a0a`, surfaces `#161616`/`#1d1d1d`, **acento ámbar dorado `#ffb02e`** (un dorado más vibrante que el anterior), rojo `#ef4444` para badge admin y errores, verde para el "pulse" de disponibilidad.
- **Tipografía**:
  - **Bebas Neue** para titulares y precios (display, mayúsculas).
  - **Manrope** para cuerpo de texto.
  - **JetBrains Mono** para detalles, eyebrows, etiquetas y números.
- **Efectos**: backdrop blur en nav y modales, gradientes radiales detrás del hero, ticker animado, hover lifts, pop-in del check de confirmación.
- **Logo del cliente** (`assets/logo.jpg`, negro sobre fondo blanco) se renderiza con `filter: invert(1)` + `mix-blend-mode: screen` para que se vea blanco sobre fondo oscuro y el fondo blanco se funda.
- **Responsive**: breakpoints en 960 px (tablet) y 560 px (móvil). Nav hamburguesa no implementado todavía (las anclas siguen funcionando, solo se oculta el menú en móvil — pendiente de un toggle si se ve necesario).

## Cómo verlo en local

```powershell
cd "C:\Users\pablo\OneDrive\Desktop\Claude Projects\OwnApps\oscar-barber"
python -m http.server 8765
# luego abrir http://localhost:8765/
```

Para parar el servidor:
```powershell
Get-NetTCPConnection -LocalPort 8765 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

`file://` también funciona pero `localStorage` puede dar problemas en algunos navegadores. Mejor servidor local.

## Repositorio GitHub

- **Repo público**: https://github.com/Pabloguti01/OwnApps
- **Estructura**: monorepo. Este proyecto es la subcarpeta `oscar-barber/`.
- **Cuenta GitHub**: `Pabloguti01` (autenticada localmente vía `gh` CLI 2.92).
- **Branch principal**: `main`.
- **Remote**: HTTPS con `http.sslBackend=schannel` global (necesario en este Windows).
- **Decisión de visibilidad pública asumida**: el usuario conoce que `config.js` expone email del barbero y contraseña del admin.

Comando para clonar en otra máquina:
```bash
git clone https://github.com/Pabloguti01/OwnApps.git
cd OwnApps/oscar-barber
python -m http.server 8000
```

## Limitaciones conocidas

- **Las citas solo viven en el navegador del cliente** que las creó. Oscar **no las recibe** automáticamente en el admin local — la notificación por email es la vía real. Pendiente: sincronización vía backend (pospuesta por decisión del usuario el 2026-05-23 — quiere abordarlo "de otra manera" más adelante).
- Dos clientes en dispositivos distintos pueden reservar el mismo hueco (no se sincronizan hasta tener backend).
- **Galería con placeholders**: 7 huecos con rayas en lugar de fotos reales. Pendiente de que Oscar proporcione fotos de sus cortes.
- **Retrato de Oscar**: placeholder en la sección "Sobre Oscar". Pendiente foto.
- **Teléfono y email del negocio son placeholder** (`666 666 666` y `hola@oscarbarber.es`). Hay que cambiarlos por los reales antes de publicar.
- **Datos expuestos en el repo público** (`js/config.js`): email de notificaciones (`pabloguti1006@gmail.com`) y contraseña del admin (`oscar1234`). Riesgos asumidos por el usuario:
  - El email recibirá spam con el tiempo (scrapers de GitHub).
  - La contraseña del admin es trivial y descubrible — la "protección" del panel es solo cosmética.
  - **Recomendaciones para producción real**: crear un email dedicado (`oscarbarber.citas@gmail.com` o similar), cambiar la contraseña a algo único y largo, o mover la auth a backend.
- **Hamburguesa móvil no implementada**: en mobile (<960 px) el menú principal se oculta. Funciona porque solo eran anclas internas, pero idealmente debería haber un toggle.

## Próximos pasos sugeridos

- **Sustituir placeholders por contenido real**: fotos de la galería, foto de Oscar, teléfono real, email real.
- **Backend para sincronizar citas** entre el navegador del cliente y el del barbero (pospuesto por el usuario el 2026-05-23 — quiere abordarlo "de otra manera"; opciones discutidas y archivadas: Google Apps Script + Sheets, Firebase Firestore, Supabase).
- Antes de pasar a producción real: rotar contraseña admin y mover el `emailTo` a un buzón dedicado, no al personal.
- Activar el envío vía FormSubmit confirmando el primer email de activación.
- Confirmación por SMS/WhatsApp con la dirección donde se hará el servicio.
- Implementar nav hamburguesa para móvil.
- Considerar GitHub Pages para hospedar el sitio (`Settings → Pages → main branch / oscar-barber folder`) — gratis y se actualiza con cada push.

## Historial de decisiones tomadas

- **Sin dirección** ni mapa: Oscar trabaja a domicilio.
- **Catálogo reducido** a Corte (10 €) y Corte + Barba (12 €). Ambos 30 min.
- **Persistencia local** elegida (no backend) por la naturaleza del encargo.
- **Notificaciones por email** vía FormSubmit (sin registro ni API key).
- **Panel admin** con contraseña ligera y `sessionStorage`.
- **Doble acceso al admin** (link en footer + long-press en logo).
- **Estructura monorepo en `OwnApps/`** con `oscar-barber/` como subcarpeta.
- **Visibilidad del repo pública** (con email y contraseña visibles — riesgo asumido por el usuario).
- **`gh` CLI 2.92** instalado vía winget + `http.sslBackend=schannel` para resolver problema de certificados en Windows.
- **Rediseño completo del frontend el 2026-05-23**: el usuario aportó un proyecto generado con Claude Design (`Oscar Barber.zip`) y pidió mezclar lo mejor de ambos. **Mantenido del nuevo frontend**: arquitectura single-page con modales, diseño oscuro/ámbar, Bebas Neue, tipografía gigante en hero, ticker animado, wizard de 5 pasos con paso de dirección, buffer de 30 min de traslado entre citas, admin con tabs día/semana y detail drawer, export CSV, link WhatsApp directo desde detail. **Mantenido del backend antiguo**: persistencia en localStorage, config centralizada en `config.js`, notificación por email (FormSubmit), login con contraseña, sesión en `sessionStorage`, long-press en logo, sincronización entre pestañas vía evento `storage`, bindings `data-bind` para que `config.js` siga siendo la fuente de verdad.
- **Single-page elegido sobre multi-página**: el nuevo frontend ya venía estructurado así. El usuario aprobó eliminar los 4 HTMLs antiguos.
- **Horario L–V 10:00–14:00** (movido desde 09–14 para coincidir con el frontend nuevo).
- **Sevilla** confirmado como ciudad de servicio.
- **Galería y retrato como placeholders** hasta tener material real (decisión explícita del usuario).
- **Buffer de 30 min entre citas a domicilio** (`booking.travelBufferMin`): el algoritmo de slots descarta cualquier hora que no deje ese margen antes/después de una cita existente. Esencial porque Oscar tiene que desplazarse entre clientes.
- **Hard delete al cancelar citas en admin** (vs soft-delete con status=cancelled): más simple, menos campos a filtrar. Si en el futuro hace falta histórico de canceladas, hay que cambiar `OBStorage.remove` por `OBStorage.markCancelled`.

## Convenciones para futuros cambios

- Cualquier ajuste de datos del negocio, horario, servicios o precios va **únicamente** en `js/config.js`. Para textos que aparecen en el HTML, usar `data-bind` y dejar que `applyBindings()` los inyecte.
- Los IDs de servicio (`id` en `OB_CONFIG.services`) **no se renombran** una vez hay reservas guardadas.
- Mantener el español en todos los textos visibles al usuario.
- Si se modifica el esquema de citas en `localStorage`, añadir lógica de migración en `storage.js` → `migrate()` para no romper reservas existentes.
- Single-page: cualquier sección nueva va dentro de `index.html` con su `id` correspondiente y entrada en el menú del nav. CSS al final de `styles.css`, JS al final de `app.js`.
- Si se separan archivos JS en el futuro, mantener el orden de carga: `config.js` → `storage.js` → cualquier módulo nuevo → `app.js`.
