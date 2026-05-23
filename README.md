# OwnApps

Colección de aplicaciones web personales de **Pablo Gutiérrez** (`@Pabloguti01`).
Cada subdirectorio es un proyecto independiente.

## Proyectos

### [oscar-barber/](./oscar-barber/)

Web completa para **Oscar Barber**, peluquería a domicilio. Incluye landing, catálogo de servicios, sistema de reservas con calendario y panel de administración.

- **Stack**: HTML + CSS + JavaScript vanilla (sin frameworks, sin build step)
- **Persistencia**: `localStorage` (sin backend por ahora)
- **Notificaciones**: email al barbero vía FormSubmit
- **Panel admin**: en `/oscar-barber/admin.html`

Más detalles en [`oscar-barber/README.md`](./oscar-barber/README.md) y [`oscar-barber/CLAUDE.md`](./oscar-barber/CLAUDE.md).

## Cómo ejecutar cualquiera de los proyectos

```bash
cd <subdirectorio>
python -m http.server 8000
# luego abrir http://localhost:8000/
```

## Licencia

Proyectos personales. Sin licencia abierta por defecto — pregúntame antes de reutilizar el código en producción.
