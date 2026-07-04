# Roadmap — Módulo Tickets TI

---

## Fase 0 — Descubrimiento ✅

- Informe técnico (`00-DISCOVERY.md`)
- Adaptación de plataforma (`01-PLATFORM-ADAPTATION.md`)
- Specs originales en `docs/tickets-ti/specs/`

---

## Fase 1 — Fundación (en curso)

- [x] Modelos Prisma + migración
- [x] Seed catálogos (estados, prioridades, tipos)
- [x] Registro módulo + permisos + navegación
- [x] Shell + página Centro de Operaciones (placeholder)
- [x] Reglas de transición de estado (dominio)
- [ ] Ejecutar migración en producción
- [ ] Ejecutar seed catálogos

---

## Fase 2 — Core operativo

- CRUD tickets (crear, listar, detalle)
- Numeración `TI-AAAA-000001`
- Comentarios públicos / internos
- Historial y auditoría por acción
- Asignación de técnico
- Máquina de estados en servidor

---

## Fase 3 — SLA y notificaciones

- Cálculo SLA (activo / pausado / vencido)
- Tabla notificaciones + campana Topbar
- Email en eventos clave (reutilizar patrón disciplinario)

---

## Fase 4 — Experiencia avanzada

- Centro de Operaciones (tarjetas accionables, no solo KPIs)
- Timeline visual por ticket
- Panel lateral (info, historial, adjuntos, SLA, auditoría)
- Búsqueda global
- Adjuntos con validación MIME

---

## Fase 5 — Reportes y administración

- Dashboard métricas
- Catálogos administrables (UI)
- Configuración SLA por prioridad
- Exportaciones

---

## Checklist pre-merge (cada fase)

- [ ] No se modificó autenticación
- [ ] No se duplicaron tablas de usuarios
- [ ] Permisos registrados y sembrados
- [ ] Rutas UI en `PERMISSION_REGISTRY`
- [ ] Migración probada en local
- [ ] Documentación actualizada
