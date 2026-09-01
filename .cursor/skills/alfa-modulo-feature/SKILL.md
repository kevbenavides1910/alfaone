---
name: alfa-modulo-feature
description: Agrega o extiende features en Alfa One (Next.js 15 + Prisma). Usar en módulo nuevo, ruta API, servicio de dominio, permisos, o preguntas de arquitectura src/modules vs src/app.
---

# Alfa One — feature en módulo existente

App: `code/presupuestos-alfa` (Next.js 15, Prisma, PostgreSQL prod).

## Capas (obligatorio)

```
src/app/api/<ruta>/route.ts   → auth, Zod, respuesta HTTP
src/modules/<mod>/services/   → lógica + Prisma/Oracle
src/modules/<mod>/business/   → reglas puras (sin I/O)
src/components/<dominio>/     → UI
```

La ruta **no** debe tener queries Prisma inline ni lógica de negocio larga.

## Pasos

1. Servicio en `services/<nombre>.ts` (reutilizable desde API y Syntra IA).
2. Ruta API: `withPermission` / sesión + validación Zod → servicio.
3. Permiso en `src/lib/permissions/registry.ts` si pantalla nueva.
4. UI en `src/app/(app)/<modulo>/` + componentes.
5. Actualizar `src/lib/modules/registry.ts` (`codePaths`) si aplica CI.
6. **Syntra IA:** seguir skill `syntra-ai-tool` si hay datos consultables.
7. Migración Prisma **aditiva** si hay esquema nuevo (`prisma/migrations/`).

## Convenciones

- Máx. ~500 líneas por archivo; extraer sub-servicios.
- RBAC igual que el resto: `withPermission`, no endpoints abiertos.
- Archivos binarios/uploads: `/mnt/storage` (regla `storage-files.mdc`).
- Mapa de módulos: `src/modules/README.md`

## API pattern

```typescript
// route.ts — solo orquestación
export const GET = withPermission("modulo.pantalla", "view", async (req, session) => {
  const parsed = schema.safeParse(/* ... */);
  if (!parsed.success) return NextResponse.json({ error: "..." }, { status: 400 });
  const data = await listSomething(session, parsed.data);
  return NextResponse.json(data);
});
```

Detalle: `docs/ARCHITECTURE.md`, `docs/PERMISSIONS.md`, `AGENTS.md`.
