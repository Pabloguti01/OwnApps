# OwnApps

Colección de aplicaciones web personales de **Pablo Gutiérrez** (`@Pabloguti01`).
Cada subdirectorio es un proyecto independiente.

## Proyectos

### [oscar-barber/](./oscar-barber/)

Web completa para **Oscar Barber**, peluquería a domicilio. Incluye landing, catálogo de servicios, sistema de reservas con calendario y panel de administración.

- **Stack**: HTML + CSS + JavaScript vanilla (sin frameworks, sin build step)
- **Persistencia**: PocketBase (SQLite) — frontend 8766, PocketBase 8090
- **Notificaciones**: email al barbero vía FormSubmit
- **Panel admin**: modal sobre `index.html`

Más detalles en [`oscar-barber/CLAUDE.md`](./oscar-barber/CLAUDE.md).

### [espinita-clava/](./espinita-clava/)

Web completa para **Espinita Clavá**, restaurante de cocina andaluza moderna. Incluye landing, carta, galería, formulario de petición de reserva y panel admin.

- **Stack**: HTML + CSS + JavaScript vanilla, multi-página
- **Persistencia**: PocketBase (SQLite) con migración auto-aplicada — frontend 8767, PocketBase 8091
- **Notificaciones**: email al restaurante vía FormSubmit
- **Panel admin**: inyectado dinámicamente desde cualquier página (long-press en logo o `[ADMIN]` en footer)

Más detalles en [`espinita-clava/CLAUDE.md`](./espinita-clava/CLAUDE.md).

## Cómo ejecutar cualquiera de los proyectos

```bash
cd <subdirectorio>
docker compose up -d --build
# o, sin Docker:
python -m http.server 8000
```

## Licencia

Proyectos personales. Sin licencia abierta por defecto — pregúntame antes de reutilizar el código en producción.
