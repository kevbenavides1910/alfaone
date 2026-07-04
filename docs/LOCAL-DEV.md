# Desarrollo local — Syntra Dynamics

Guía operativa para el día a día. Arquitectura: [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Arranque en un paso (primera vez)

```bash
npm install
npm run setup:local
npm run dev
```

Abrir http://localhost:3000

| Flag | Uso |
|------|-----|
| `npm run setup:local -- --skip-docker` | Postgres ya corre (puerto 5433) |
| `npm run setup:local -- --skip-seed` | Sin datos de muestra |
| `npm run setup:local -- --no-migrate` | Usa `db:push` en lugar de migraciones |

---

## Variables de entorno

| Archivo | Quién lo lee |
|---------|----------------|
| `.env.local` | Next.js (app) |
| `.env` | Prisma CLI (`migrate`, `seed`, `studio`) |

`setup:local` crea **ambos** con el mismo contenido si no existen.

### Postgres con Docker (recomendado)

`docker-compose.yml` publica el puerto **5433** en el host:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/security_contracts?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="dev-secret-change-in-production-min32chars!!"
```

Si usa Postgres instalado en el PC (sin Docker), cambie el puerto a `5432` y credenciales según su instalación.

Plantilla: [`.env.example`](../.env.example)

---

## Flujo diario

```bash
# Solo la base (si apagó Docker)
docker compose up postgres -d

# App
npm run dev
# o, si cambió schema.prisma:
npm run dev:gen
```

### Antes de commit

```bash
npm run ci:modules    # qué módulos tocaste
npm run lint
# opcional, igual que CI:
npm run ci:local
```

---

## Trabajar por módulo

| Módulo | Carpetas principales |
|--------|----------------------|
| Core | `src/modules/core`, `src/lib/api` |
| Presupuestos | `src/modules/presupuestos`, `src/app/(app)/contracts`, `expenses` |
| Disciplinario | `src/modules/disciplinario`, `src/app/(app)/disciplinario` |
| Inventario | `src/modules/inventario`, `src/app/(app)/inventory` |
| Plataforma | `src/modules/plataforma`, `src/app/(app)/admin` |
| Reportes | `src/app/(app)/reports` |

Mapa completo: [`src/lib/modules/registry.ts`](../src/lib/modules/registry.ts)

### Cambio de esquema Prisma

```bash
# Crear migración (desarrollo)
npm run db:migrate

# Regenerar cliente
npm run db:generate
```

En producción solo se usa `migrate deploy` (ver [`DEPLOYMENT.md`](./DEPLOYMENT.md)).

---

## Credenciales de prueba

| Rol | Email | Contraseña |
|-----|-------|------------|
| Admin | admin@seguridadgrupocr.com | admin123 |
| Supervisor | supervisor@seguridadgrupocr.com | supervisor123 |
| Compras | contabilidad@seguridadgrupocr.com | contab123 |

Reset manual: `npm run db:reset-admin-passwords`

---

## Archivos subidos (logo, firma)

- Carpeta por defecto: `uploads/branding/` (en `.gitignore`)
- Opcional: `BRANDING_UPLOAD_DIR` en `.env`
- En la app: **Mantenimientos → Apariencia** o **Disciplinario → Ajustes → Documento**

---

## Scripts útiles

| Comando | Descripción |
|---------|-------------|
| `npm run setup:local` | Env + Docker Postgres + migrate + seed |
| `npm run dev` | Next.js dev server |
| `npm run dev:gen` | Prisma generate + dev |
| `npm run db:studio` | UI de base de datos |
| `npm run db:clear-business` | Limpia datos de contratos/gastos (dev) |
| `npm run db:clear-disciplinary` | Limpia solo disciplinario |
| `npm run ci:modules` | Módulos afectados (git) |
| `npm run ci:local` | modules + lint + build |

---

## Docker: app completa vs solo BD

| Modo | Comando | Cuándo |
|------|---------|--------|
| **Desarrollo** (rápido) | `docker compose up postgres -d` + `npm run dev` | Día a día |
| **Producción local** | `docker compose up --build -d` | Probar imagen final |

---

## Problemas frecuentes

### No inicia sesión / cookies

- `NEXTAUTH_URL` debe coincidir con la URL del navegador (puerto incluido).
- Tras cambiar secret o URL: cerrar sesión y borrar cookies del sitio.

### Error de conexión a Postgres

```bash
docker compose ps
docker compose logs postgres
```

Verifique `DATABASE_URL` con puerto **5433** si usa el compose del repo.

### `prisma migrate` pide nombre interactivo

Use `npx prisma migrate deploy` (como `setup:local`) o `npm run db:migrate` cuando agregue una migración nueva.

### Puerto 3000 ocupado

```bash
npm run dev:3000
# y NEXTAUTH_URL=http://127.0.0.1:3000
```

---

## facturacion_cr (Frappe)

Carpeta aparte para facturación CR / CRLibre. No forma parte del monolito Next.js; ver scripts en `facturacion_cr/scripts/`.
