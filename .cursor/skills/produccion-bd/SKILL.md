---
name: produccion-bd
description: Protege PostgreSQL de producción Alfa One (VPS). Usar antes de migraciones, seeds, DELETE masivo, db:reset, scripts import, prisma db push, o cualquier escritura SQL/Prisma en prod.
---

# Producción — base de datos

Entorno **real**: PostgreSQL en VPS, volumen `presupuestos-alfa_postgres_data`, BD `security_contracts`.

## Prohibido sin confirmación explícita del usuario

- `prisma migrate reset`, `npm run db:reset`, `db push --force-reset`
- `DROP`, `TRUNCATE`, `DELETE` sin `WHERE` acotado
- `npm run db:seed`, `db:seed-roles` en prod
- Imports masivos XLSX / `prisma/import-*.ts`
- `$queryRawUnsafe` / `$executeRawUnsafe` con input de usuario

## Migraciones

- Prod: **`npx prisma migrate deploy`** (en CMD del contenedor al arrancar).
- Migraciones **aditivas** (columnas nullable, defaults). Evitar DROP/rename destructivo en un paso.
- Antes de esquema: mencionar backup (`scripts/postgres-backup.sh`).

## Escritura segura

```typescript
// ❌
await prisma.expenseTypeConfig.deleteMany();

// ✅
await prisma.expenseTypeConfig.deleteMany({ where: { type: expenseType } });
```

- `deleteMany` / `updateMany` siempre con `where` restrictivo.
- Endpoints nuevos: sesión + RBAC (`withPermission`).
- Seeds roles: solo rellenar `roleId` null — **nunca** reasignar perfiles personalizados masivamente.

## Deploy vs datos

- Recrear contenedor **app** OK; **no** `docker compose down -v` ni `docker volume rm`.
- Uploads en `/mnt/storage` — no confundir con operaciones SQL.

## Flujo del agente

1. Tarea puede borrar/resetear → **detener**, explicar riesgo, pedir OK explícito.
2. Diagnóstico: preferir lecturas acotadas (`findUnique`, `findMany` + `take`).
3. Fix de datos: script reversible o `UPDATE … WHERE id = …` documentado.

Regla: `code/presupuestos-alfa/.cursor/rules/produccion-proteger-bd.mdc`
