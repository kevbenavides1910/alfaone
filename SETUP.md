# Alfa One — Plataforma de gestión empresarial

## Documentación

| Tema | Archivo |
|------|---------|
| **Empezar en local** | [`docs/LOCAL-DEV.md`](docs/LOCAL-DEV.md) |
| Arquitectura modular | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Despliegue | [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) |
| CI (GitHub) | [`docs/CI.md`](docs/CI.md) |
| Monorepo (futuro) | [`docs/MONOREPO-ROADMAP.md`](docs/MONOREPO-ROADMAP.md) |
| Código por módulo | [`src/modules/README.md`](src/modules/README.md) |

---

## Inicio rápido (local)

**Requisitos:** Node.js 20+, Docker (recomendado) o PostgreSQL 14+.

```bash
npm install
npm run setup:local
npm run dev
```

Abrir http://localhost:3000

Detalle, flags y problemas frecuentes: [`docs/LOCAL-DEV.md`](docs/LOCAL-DEV.md).

---

## Credenciales (desarrollo)

| Usuario | Email | Contraseña |
|---------|-------|------------|
| Admin | admin@seguridadgrupocr.com | admin123 |
| Supervisor | supervisor@seguridadgrupocr.com | supervisor123 |
| Compras | contabilidad@seguridadgrupocr.com | contab123 |

---

## Estructura del proyecto

```
src/
├── app/                      # Rutas Next.js (UI + API)
│   ├── (auth)/               # Login
│   └── (app)/                # Dashboard, contratos, gastos, disciplinario, inventario, admin
├── components/               # UI por dominio
├── lib/                      # Infra: api, modules/registry, utils, hooks
└── modules/                  # Lógica de negocio por módulo
    ├── core/                 # Auth, Prisma, permisos, empresas
    ├── plataforma/           # Branding, usuarios admin
    ├── presupuestos/         # Contratos, gastos, reportes de rentabilidad
    ├── disciplinario/
    └── inventario/

prisma/                       # Esquema y migraciones
scripts/
├── setup-local.mjs           # npm run setup:local
└── ci/                       # npm run ci:modules
```

---

## Comandos frecuentes

| Comando | Uso |
|---------|-----|
| `npm run dev` | Servidor de desarrollo |
| `npm run setup:local` | Primera vez / reset de entorno local |
| `npm run db:migrate` | Nueva migración en desarrollo |
| `npm run db:studio` | Explorar base de datos |
| `npm run ci:modules` | Ver módulos afectados por tus cambios |
| `npm run ci:local` | Lint + build (como CI) |

---

## Docker

```bash
# Solo base de datos (desarrollo diario)
docker compose up postgres -d

# App + BD (probar imagen de producción)
docker compose up --build -d
```

Postgres en el host: puerto **5433** (ver `docker-compose.yml`).

---

## Módulos de la aplicación

| Módulo | Rutas UI (ej.) |
|--------|----------------|
| Presupuestos | `/contracts`, `/expenses` |
| Disciplinario | `/disciplinario` |
| Inventario | `/inventory` |
| Reportes | `/reports` |
| Plataforma | `/admin` |

Reglas de negocio (semáforos, equivalencia, gastos diferidos): ver secciones históricas en commits anteriores o documentación interna del equipo.

---

## Reglas de negocio (resumen)

1. **Semáforo insumos:** verde < 70%, amarillo 70–90%, rojo > 90%.
2. **Equivalencia:** posiciones del contrato / total posiciones de la empresa.
3. **Gastos diferidos:** distribución proporcional por equivalencia.
4. **Hallazgos auditoría:** solo PENDIENTE impacta presupuesto.

---

## VS Code / Cursor

Al abrir el proyecto, instale las extensiones recomendadas (`.vscode/extensions.json`).
