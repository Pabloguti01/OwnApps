# Oscar Barber — Guía del proyecto

Web para **Oscar**, barbero amigo del usuario que trabaja **a domicilio** (sin local físico).
Funcionalidad principal: gestión de citas online con calendario.

## Stack y filosofía

- **HTML + CSS + JavaScript vanilla**. Sin frameworks, sin bundlers, sin build step.
- **Sin backend**. Las citas se guardan en `localStorage` del navegador del cliente.
- Páginas multiarchivo (no SPA): cada sección es su propio `.html`.
- Idioma: **español** en todos los textos, formularios y mensajes.

## Estructura del proyecto

Forma parte del monorepo **OwnApps** (https://github.com/Pabloguti01/OwnApps), como subdirectorio `oscar-barber/`.

```
OwnApps/
├── README.md                  Índice del monorepo
└── oscar-barber/
    ├── index.html             Landing principal
    ├── citas.html             Sistema de reserva (flujo de 5 pasos)
    ├── servicios.html         Catálogo completo
    ├── contacto.html          Info + formulario
    ├── admin.html             Panel privado del barbero (login + calendario de citas)
    ├── assets/
    │   └── logo.jpg           Logo del cliente (negro sobre blanco)
    ├── css/
    │   ├── styles.css         Estilos globales (variables, header, footer, botones, forms, grid)
    │   ├── calendar.css       Calendario, stepper, time slots, summary card
    │   └── admin.css          Login, KPIs, calendario admin con badges, ficha de cita
    ├── js/
    │   ├── config.js          CONFIG DEL NEGOCIO (editar aquí)
    │   ├── storage.js         Wrapper sobre localStorage (clave: ob_appointments_v1)
    │   ├── calendar.js        Render del calendario + cálculo de slots libres
    │   ├── appointments.js    Controlador del flujo de reserva + notificación por email
    │   ├── admin.js           Lógica del panel admin (login, KPIs, calendario, lista, export CSV)
    │   └── main.js            Init común (nav móvil, footer, cards de servicios, form contacto)
    ├── README.md              Documentación de despliegue
    └── CLAUDE.md              Este archivo
```

## Configuración (todo en `js/config.js`)

- `business`: nombre, teléfono, email, instagram. **No tiene `address`** porque Oscar va a domicilio. En su lugar usa `serviceArea: "Servicio a domicilio"`.
- `schedule`: horario semanal por día (0=Dom, 1=Lun, ...). Permite múltiples turnos por día (mañana/tarde). `null` = cerrado. **Actual: L–V de 09:00 a 14:00. Sábado y domingo cerrados.**
- `closedDates`: array de fechas `"YYYY-MM-DD"` cerradas (vacaciones, festivos).
- `booking`: `slotIntervalMin` (15), `maxDaysAhead` (60), `minLeadTimeMin` (30).
- `services`: catálogo. **Solo dos servicios activos**: Corte de pelo (10 €, 30 min) y Corte + Barba (12 €, 45 min). Los `id` no deben cambiarse cuando ya hay reservas guardadas.
- `notifications`: `emailTo` (destino de las notificaciones) y `enabled` (true/false). Al confirmar una cita se envía un email vía FormSubmit. **Ver sección "Notificaciones por email" más abajo.**
- `admin`: `password` para acceder al panel `admin.html`. ⚠ Seguridad client-side, no protección real.

## Flujo de reserva (citas.html)

5 pasos secuenciales gestionados por `js/appointments.js`:

1. **Servicio** — el usuario elige uno de los servicios del catálogo. Botón "Continuar" se habilita al seleccionar.
2. **Fecha** — calendario mensual navegable (`js/calendar.js`). Solo deja seleccionar días con al menos un hueco libre para el servicio elegido. Días pasados, festivos y días fuera de `maxDaysAhead` están deshabilitados.
3. **Hora** — slots de 15 min. Solo se muestran los huecos que no se solapan con citas existentes (`OBStorage.getForDate`) y que dejan tiempo suficiente para la duración del servicio. Para "hoy", aplica `minLeadTimeMin` de antelación.
4. **Datos** — nombre (obligatorio), teléfono (obligatorio, regex permisivo), email (opcional), notas.
5. **Confirmación** — resumen + guardar en `localStorage`. Antes de guardar revalida que el slot sigue libre.

Atajo: `citas.html?servicio=<id>` preselecciona un servicio (lo usan los botones "Reservar" del catálogo).

## Notificaciones por email

Al confirmar una reserva, `js/appointments.js` hace un POST `https://formsubmit.co/ajax/<email>` con los datos de la cita (FormSubmit es un servicio gratuito que reenvía el JSON como email, sin requerir registro).

**Activación inicial obligatoria**: la primera vez que se manda un email a una dirección concreta, FormSubmit envía a esa dirección un correo de **activación** ("Confirm your email"). Hasta que se pulsa ese enlace, los emails posteriores no llegan. Por tanto, antes de poner la web en producción:
1. Hacer una reserva de prueba desde el sitio.
2. Abrir el email "Activate Your Form" en la bandeja de `notifications.emailTo`.
3. Pulsar "Activate Form".
4. A partir de ahí, todas las reservas llegan automáticamente.

**Email actual**: `pabloguti1006@gmail.com` (provisional del usuario para pruebas — cambiar al email de Oscar antes de producción).

El envío es **no bloqueante**: si FormSubmit cae o hay rate limit, la cita igualmente queda guardada en `localStorage` y el cliente ve la pantalla de confirmación. El fallo solo se loguea en consola.

## Panel admin (`admin.html`)

Pantalla privada para que el barbero vea las citas guardadas en el navegador que esté usando.

**Doble acceso (decidido el 2026-05-23)**:
1. **Link discreto en footer-bottom** ("🔒 Acceso barbero") presente en las 4 páginas públicas. Estilo deliberadamente discreto (opacidad reducida, fuente pequeña).
2. **Long-press de 1.5 s sobre el logo** (header de cualquier página) → redirige a `admin.html`. Implementado en `js/main.js` → `initLogoSecret()`. Útil para que Oscar entre desde móvil sin tener que buscar el enlace.

- **Login**: contraseña en `CFG.admin.password`. Sesión guardada en `sessionStorage` (se borra al cerrar la pestaña).
- **KPIs**: total de citas, próximas (≥ hoy), hoy, ingresos próximos.
- **Calendario mensual** con badge dorado por día indicando el número de citas. Navegable a cualquier mes (pasado o futuro).
- **Lista de citas del día seleccionado** con hora, cliente, servicio, precio, teléfono (con `tel:`), email (con `mailto:`), notas, y botón "Cancelar cita".
- **Export CSV** de todas las citas guardadas.
- **Sincronización entre pestañas**: si se guarda/elimina una cita en otra pestaña, el admin se refresca automáticamente vía el evento `storage`.

⚠ **Limitación crítica del admin sin backend**: el admin **solo muestra las citas guardadas en el navegador donde está abierto**. Como las reservas las hace el cliente desde su propio navegador, esas citas no aparecerán automáticamente en el admin del barbero. La notificación por email es la vía real para que Oscar reciba las reservas. El admin sirve como vista local + para registrar manualmente citas que Oscar reciba por otros canales.

⚠ **Seguridad**: la contraseña vive en el JS del cliente; cualquiera con DevTools la ve. Sirve solo para evitar accesos casuales. Si en el futuro hay backend, mover la auth allí.

## Diseño visual

- **Paleta**: crema `#f9f6f1` + blanco para el cuerpo; **negro `#1a1a1a`** en header/footer; **dorado `#b08a4a`** como acento.
- **Tipografía**: `Playfair Display` para títulos (display serif) + system sans para texto.
- **Logo del cliente** (`assets/logo.jpg`) es negro sobre fondo blanco. Para mostrarlo sobre el header/footer oscuros se aplica:
  ```css
  filter: invert(1);
  mix-blend-mode: screen;
  ```
  Esto convierte los trazos negros en blancos y hace que el fondo blanco (ahora negro tras la inversión) se funda con el fondo oscuro del header/footer.
- **Tamaños actuales del logo**: 100 px en header, 120 px en footer.
- **`--header-height: 120px`** para que el logo de 100 px respire dentro del header.

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

`file://` directo también funciona para revisar, pero `localStorage` puede dar problemas en algunos navegadores. Mejor usar el servidor local.

## Repositorio GitHub

- **Repo público**: https://github.com/Pabloguti01/OwnApps
- **Estructura**: monorepo. Este proyecto es la subcarpeta `oscar-barber/`. El nombre `OwnApps` se eligió como paraguas para futuras apps personales del usuario.
- **Cuenta GitHub**: `Pabloguti01` (autenticada localmente vía `gh` CLI 2.92).
- **Branch principal**: `main`.
- **Remote**: HTTPS con `http.sslBackend=schannel` global (necesario en este Windows para evitar `unable to get local issuer certificate`).
- **Decisión de visibilidad pública asumida**: el usuario conoce que `config.js` expone email del barbero y contraseña del admin. Ver "Limitaciones conocidas".

Comando para clonar en otra máquina:
```bash
git clone https://github.com/Pabloguti01/OwnApps.git
cd OwnApps/oscar-barber
python -m http.server 8000
```

## Limitaciones conocidas

- **Las citas solo viven en el navegador del cliente** que las creó. Oscar **no las recibe** automáticamente en el admin local — la notificación por email es la vía real. Pendiente: sincronización vía backend (pospuesta por decisión del usuario el 2026-05-23, quiere abordarla de otra manera más adelante).
- Dos clientes en dispositivos distintos pueden reservar el mismo hueco (no se sincronizan hasta tener backend).
- **Datos expuestos en el repo público** (`oscar-barber/js/config.js`): email del barbero (`pabloguti1006@gmail.com`) y contraseña del admin (`oscar1234`). Riesgos asumidos por el usuario:
  - El email recibirá spam con el tiempo (scrapers de GitHub).
  - La contraseña del admin es trivial y descubrible — la "protección" del panel es solo cosmética.
  - **Recomendaciones para producción real**: crear un email dedicado (`oscarbarber.citas@gmail.com` o similar), cambiar la contraseña a algo único y largo, o mover la auth a backend.

## Próximos pasos sugeridos

- **Backend para sincronizar todas las citas** entre el navegador del cliente y el del barbero (pospuesto por el usuario el 2026-05-23 — quiere abordarlo "de otra manera"; opciones discutidas y archivadas: Google Apps Script + Sheets, Firebase Firestore, Supabase).
- Antes de pasar a producción real: rotar contraseña admin y mover el `emailTo` a un buzón dedicado, no al personal.
- Activar el envío vía FormSubmit confirmando el primer email de activación.
- Confirmación por SMS/WhatsApp con la dirección donde se hará el servicio (relevante porque es a domicilio).
- Considerar GitHub Pages para hospedar el sitio (`Settings → Pages → main branch / oscar-barber folder`) — gratis y se actualiza con cada push.

## Historial de decisiones tomadas

- **Sin dirección** ni mapa: Oscar trabaja a domicilio. En el footer y en contacto.html aparece "🏠 Servicio a domicilio" en lugar de un bloque de dirección.
- **Catálogo reducido** a los dos servicios reales que ofrece Oscar (Corte 10 €, Corte + Barba 12 €). Otros servicios (afeitado, tintes, infantil, tratamiento, completo) se eliminaron del config.
- **Logo integrado** en header y footer en las 4 páginas usando inversión + blend mode.
- **Persistencia local** elegida (no backend) por la naturaleza del encargo (rápido, sin coste de hosting, fácil de desplegar en cualquier estático).
- **Horario L–V 09:00–14:00** (un único turno de mañana, sin partir el día). Sábado y domingo cerrados. Se simplificó respecto a la configuración inicial con doble turno.
- **Card de "Profesionales expertos"** renombrada a "Profesional con experiencia" (singular), porque Oscar trabaja solo. La descripción se reescribió para mencionarle por nombre y enfatizar el trato a domicilio.
- **Notificaciones por email** vía FormSubmit elegidas frente a EmailJS / Formspree / mailto: porque (a) no requieren registro previo ni API key visible, (b) son gratuitas, (c) funcionan con un fetch sencillo, (d) el envío es silencioso para el cliente. Tradeoff: hay que confirmar la activación la primera vez por dirección.
- **Panel admin separado** en `admin.html` con contraseña ligera y `sessionStorage`. No se enlaza desde el menú público para no exponer la existencia del panel a visitantes casuales.
- **Doble acceso al admin** (footer link + long-press en logo) decidido tras pregunta explícita al usuario. El long-press se eligió frente a triple clic porque triple clic forzaba un delay de 400 ms en la navegación normal del logo, mientras que long-press deja el clic normal intacto.
- **Estructura monorepo en `OwnApps/`**: el usuario quiso un repo paraguas para varias apps personales en lugar de un repo dedicado a Oscar Barber. El proyecto vive en la subcarpeta `oscar-barber/`. Local: `Claude Projects/OwnApps/oscar-barber/`. La carpeta local antigua `Oscar Barber/` quedó vacía y bloqueada por OneDrive — limpieza pendiente cuando OneDrive libere el handle.
- **Visibilidad del repo pública** (asumiendo el riesgo de exponer email y contraseña del admin). Esta decisión es explícita del usuario para poder mostrar el proyecto.
- **`gh` CLI 2.92 instalado vía winget** (`--source winget` explícito por error de cert en msstore). Configuración global de git ajustada con `http.sslBackend=schannel` para resolver "unable to get local issuer certificate".

## Convenciones para futuros cambios

- Cualquier ajuste de datos del negocio, horario, servicios o precios va **únicamente** en `js/config.js`. No hardcodear en HTML o CSS.
- Los IDs de servicio (`id` en `OB_CONFIG.services`) **no se renombran** una vez hay reservas guardadas en clientes (rompería el histórico).
- Mantener el español en todos los textos visibles al usuario.
- Si se añade una página nueva, replicar la estructura del header/footer del resto y cargar `config.js` + `storage.js` + `main.js` (en ese orden).
