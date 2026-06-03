# OwnApps — Contexto general

Monorepo de aplicaciones web personales de **Pablo Gutiérrez** (`@Pabloguti01`).
Repo público: https://github.com/Pabloguti01/OwnApps

## Estructura y convenciones

Cada subdirectorio de `OwnApps/` es una aplicación independiente. Cada app tiene su propio `CLAUDE.md` con el contexto completo, historial de decisiones y estado del proyecto.

```
OwnApps/
├── CLAUDE.md               ← Este archivo (visión global)
├── README.md               ← Índice del monorepo (cara pública)
└── <nombre-app>/
    ├── CLAUDE.md           ← Contexto detallado de esa app
    └── ...                 ← Archivos del proyecto
```

**Regla importante**: cualquier modificación en una app debe reflejarse en el `CLAUDE.md` de esa app (historial de decisiones, cambios relevantes, estado actual). Este archivo global sirve para tener la foto de conjunto.

## Repositorio

- **GitHub**: https://github.com/Pabloguti01/OwnApps
- **Branch principal**: `main`
- **Visibilidad**: público
- **Cuenta**: `Pabloguti01`, autenticada con `gh` CLI

## Proyectos activos

### `oscar-barber/` — Web de barbero a domicilio

- **Estado**: funcional, pendiente de contenido real (fotos, teléfono, email del negocio)
- **Stack**: HTML + CSS + JS vanilla. Sin frameworks ni build step.
- **Persistencia**: PocketBase (SQLite) integrado el 2026-05-23. Frontend en puerto 8766, PocketBase en 8090.
- **Descripción**: landing + sistema de reservas con calendario + panel admin para Oscar, barbero amigo del usuario que trabaja a domicilio en Sevilla
- **Detalles**: ver [`oscar-barber/CLAUDE.md`](./oscar-barber/CLAUDE.md)

### `espinita-clava/` — Web de restaurante andaluz

- **Estado**: funcional, pendiente de contenido real (fotos, carta real, datos de contacto del local)
- **Stack**: HTML + CSS + JS vanilla, multi-página (no SPA). Sin frameworks ni build step.
- **Persistencia**: PocketBase (SQLite) con migración auto-aplicada al arrancar. Frontend en puerto 8767, PocketBase en 8091.
- **Descripción**: landing + carta + galería + formulario de petición de reserva + panel admin para el restaurante. Modelo "petición a confirmar": el restaurante valida manualmente cada reserva.
- **Detalles**: ver [`espinita-clava/CLAUDE.md`](./espinita-clava/CLAUDE.md)

## Cómo arrancar cualquier proyecto

```bash
# oscar-barber (con Docker Compose — recomendado)
cd oscar-barber
docker compose up -d
# Frontend:         http://localhost:8766
# PocketBase admin: http://localhost:8090/_/

# espinita-clava
cd espinita-clava
docker compose up -d --build
# Frontend:         http://localhost:8767
# PocketBase admin: http://localhost:8091/_/
# Admin panel:      http://localhost:8767/#admin  (pwd: espinita1234)

# Alternativa sin Docker
cd <nombre-app>
python -m http.server 8000
```

## Tabla de puertos

| App            | Frontend | PocketBase |
|----------------|----------|------------|
| oscar-barber   | 8766     | 8090       |
| espinita-clava | 8767     | 8091       |

Patrón: cada nueva app suma +1 a ambos puertos.

## Registro de cambios globales

| Fecha      | App          | Cambio                                                                 |
|------------|--------------|------------------------------------------------------------------------|
| 2026-05-23 | oscar-barber | Creación del proyecto e integración en el monorepo OwnApps             |
| 2026-05-23 | oscar-barber | Rediseño completo del frontend (SPA single-page, tema oscuro/ámbar)    |
| 2026-05-23 | oscar-barber | Fix bug admin: sesión sin pedir contraseña tras rediseño               |
| 2026-05-23 | OwnApps      | Creación de este CLAUDE.md general                                     |
| 2026-05-23 | oscar-barber | Dockerfile nginx:alpine + contenedor levantado en puerto 8765          |
| 2026-05-23 | oscar-barber | Integración PocketBase: docker-compose, storage.js reescrito, puerto 8766 |
| 2026-05-25 | oscar-barber | Drawer hamburguesa móvil + responsividad completa (incluido panel admin)  |
| 2026-06-01 | espinita-clava | Creación del proyecto: backend PocketBase + Docker (8767/8091) + panel admin |
