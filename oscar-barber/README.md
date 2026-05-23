# Oscar Barber — Web de la peluquería

Sitio estático en HTML + CSS + JavaScript vanilla para la peluquería **Oscar Barber**.
Sin dependencias, sin build step, sin backend: se puede abrir directamente en el navegador o subir a cualquier hosting estático (Netlify, Vercel, GitHub Pages, Hostinger, etc.).

## Funcionalidades

- Página principal con presentación y CTA a reservar.
- Catálogo de **servicios** con precios y duración.
- Sistema de **reserva de citas** con:
  - Selección de servicio
  - Calendario navegable mes a mes
  - Cálculo automático de **horarios disponibles** según horario del negocio, duración del servicio y citas ya reservadas
  - Formulario de datos del cliente con validación
  - Pantalla de confirmación
- Persistencia de las citas en `localStorage` del navegador (sin backend).
- Página de **contacto** con formulario y datos del negocio.
- Diseño **responsive** (móvil, tablet, escritorio) con menú hamburguesa.

## Estructura del proyecto

```
Oscar Barber/
├── index.html              Página principal
├── citas.html              Sistema de reserva (calendario + flujo)
├── servicios.html          Listado completo de servicios
├── contacto.html           Información y formulario de contacto
├── css/
│   ├── styles.css          Estilos globales
│   └── calendar.css        Estilos del calendario y flujo de reservas
├── js/
│   ├── config.js           Configuración del negocio (EDITA AQUÍ)
│   ├── storage.js          Persistencia en localStorage
│   ├── calendar.js         Lógica del calendario y slots
│   ├── appointments.js     Controlador del flujo de reserva
│   └── main.js             Inicialización común
└── README.md
```

## Cómo personalizarlo

Todo lo configurable está en **`js/config.js`**:

- **Datos del negocio** (`business`): nombre, dirección, teléfono, email, Instagram.
- **Horario semanal** (`schedule`): turnos por día de la semana. Admite varios tramos por día (mañana/tarde). `null` = cerrado.
- **Días cerrados** (`closedDates`): vacaciones y festivos puntuales (`"YYYY-MM-DD"`).
- **Reserva** (`booking`):
  - `slotIntervalMin`: separación entre horas reservables (15 min por defecto).
  - `maxDaysAhead`: cuántos días vista hacia adelante se pueden reservar.
  - `minLeadTimeMin`: antelación mínima para reservar hoy mismo.
- **Servicios** (`services`): lista con id, nombre, descripción, duración y precio. **Importante**: una vez tengas reservas guardadas, no cambies los `id` de servicios existentes.

## Cómo verlo en local

Basta con abrir `index.html` en cualquier navegador. Para evitar limitaciones con `localStorage` en `file://`, puedes servirlo con un servidor estático:

```powershell
# Con Python 3
python -m http.server 8080
# Luego abre http://localhost:8080
```

## Cómo subirlo a producción

Cualquier hosting estático sirve. Algunas opciones gratuitas:

- **Netlify Drop**: arrastra la carpeta a https://app.netlify.com/drop.
- **GitHub Pages**: sube el contenido a un repo y activa Pages.
- **Vercel**: importa el proyecto, sin configuración extra.

## Limitaciones a tener en cuenta

Como no hay backend:

- Las **citas se guardan únicamente en el navegador del cliente** (su `localStorage`). El barbero no las ve automáticamente.
- Si se borra el caché o se usa otro dispositivo, esas citas no aparecerán.

**Recomendado a corto plazo**: en `confirmBooking()` (`js/appointments.js`) se puede añadir un envío por email (servicios como Formspree, EmailJS o Web3Forms) o un POST a Google Sheets para que el negocio reciba la cita.

**A medio plazo**, si la peluquería gana volumen, conviene mover las reservas a un backend (Firebase, Supabase o un pequeño servidor) para evitar conflictos entre clientes.

## Próximos pasos sugeridos

- Envío de la cita por email al barbero (Formspree / EmailJS).
- Pantalla de administración protegida para que el barbero vea/edite citas.
- Soporte multi-profesional (varios barberos en paralelo).
- Galería de trabajos / Instagram embebido.
- WhatsApp directo desde la cita.
