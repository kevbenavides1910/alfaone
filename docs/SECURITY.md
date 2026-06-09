# Seguridad — Alfa One

## Despliegue en producción

1. Copie `.env.production.example` → `.env.production` con valores únicos.
2. Genere secrets: `openssl rand -base64 32` → `NEXTAUTH_SECRET` y otro distinto → `SYNTRA_DEVICE_SECRET` (app móvil Alfa One).
3. Use `docker compose -f docker-compose.prod.yml up -d --build` (PostgreSQL **no** expuesto al host).
4. Coloque **HTTPS** delante (ver `deploy/nginx-security.example.conf`).
5. No ejecute `npm run db:reset-admin-passwords` en producción (bloqueado sin `ALLOW_DEMO_RESET=1`).

## Checklist antes de cada release

- [ ] Rutas API nuevas usan `hasPermission(session, key, level)` o `withPermission`, **nunca** `session.user.role` solo.
- [ ] Pantalla nueva registrada en `src/lib/permissions/registry.ts`.
- [ ] Subidas con límite de tamaño y validación (`readBoundedUpload`, magic bytes en adjuntos).
- [ ] `npm audit --audit-level=high` sin hallazgos críticos pendientes.
- [ ] Secretos y contraseñas de demo no están en el servidor.

## Autenticación

- NextAuth JWT, sesión máx. **8 horas** (`auth-options.ts`).
- Cookies seguras solo con `NEXTAUTH_URL` en **https://**.
- Rate limit en `/api/auth/*` (middleware + opcional nginx).

## Autorización (RBAC)

- Fuente de verdad: matriz en Mantenimiento → Roles.
- Permisos en JWT; tras cambiar rol propio, la UI llama `session.update()`.
- Otros usuarios afectados deben **cerrar sesión y volver a entrar**.

## Contraseñas

- Mínimo **8 caracteres**: mayúscula, minúscula, número y carácter especial (`password-policy.ts`).
- El administrador puede **restablecer** contraseña (`POST /api/users/:id/reset-password`); temporal por defecto: `alfa1234`, con cambio obligatorio al ingresar.

## Reporte de incidentes

Registrar intentos sospechosos (401/403 masivos, fuerza bruta en login) y rotar `NEXTAUTH_SECRET` si hay compromiso de sesión.
