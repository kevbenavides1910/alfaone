# Despliegue — Alfa One

Guía operativa alineada con [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Modelo actual: una aplicación

| Componente | Archivo / comando |
|------------|-------------------|
| Build producción | `npm run build` (incluye todos los módulos) |
| Imagen Docker | `Dockerfile` (multi-stage + `output: "standalone"`) |
| Base de datos | `docker-compose.yml` → servicio `postgres` |
| App + migraciones | `prisma migrate deploy` en el `CMD` del contenedor |
| Variables | `.env` / `.env.local`: `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET` |

No existe hoy un despliegue “solo disciplinario”: cualquier cambio requiere **rebuild + redeploy de la misma imagen**.

---

## Flujo recomendado

### Desarrollo local

```bash
docker compose up postgres -d
npm run db:generate
npm run db:migrate    # o db:push en entornos desechables
npm run dev
```

### Producción (Docker)

```bash
docker compose up --build -d
```

1. Postgres arranca y pasa healthcheck.
2. La app construye con `npm run build`.
3. Al iniciar el contenedor: `prisma migrate deploy` → `node server.js`.

### Cambio solo en un módulo (ej. disciplinario)

1. Desarrollar y probar rutas de ese módulo.
2. Si hay cambio de esquema: nueva carpeta en `prisma/migrations/`.
3. Commit y despliegue **igual que siempre** (misma imagen).
4. El riesgo se reduce porque el código del módulo está acotado en carpetas documentadas en el registry.

---

## Optimización sin separar apps

| Técnica | Beneficio |
|---------|-----------|
| Cache de `npm ci` en Docker | Builds más rápidos en el servidor |
| Migraciones pequeñas y nombradas | `migrate deploy` predecible |
| No editar migraciones ya aplicadas en prod | Evita drift |
| Path filters en CI | Ver [`docs/CI.md`](./CI.md) — resumen por módulo en cada PR |
| `db:clear-disciplinary` vs `db:clear-business` | Scripts de limpieza por dominio ya separados |

---

## Variables críticas

| Variable | Notas |
|----------|--------|
| `DATABASE_URL` | En Docker: host `postgres`, puerto `5432`, DB `security_contracts` |
| `NEXTAUTH_URL` | URL pública exacta (`http://IP:3000` o `https://...`) |
| `NEXTAUTH_SECRET` | Mín. 32 caracteres en producción |
| `SYNTRA_DEVICE_SECRET` | Mín. 32 caracteres, distinto al anterior |

Si la app va detrás de HTTPS, `NEXTAUTH_URL` debe ser `https://` para cookies de sesión (ver comentarios en `src/lib/auth-options.ts`).

---

## Evolución: despliegue por módulo

Cuando se necesite publicar apps por separado:

1. Fase 2 completada (`src/modules/*`).
2. Seguir [`docs/MONOREPO-ROADMAP.md`](./MONOREPO-ROADMAP.md) para extraer Turborepo.
3. Un pipeline por app; **migraciones Prisma** desde `packages/database` en orden fijo.

Hasta entonces, tratar cada release como **versión única de plataforma Alfa One**.
