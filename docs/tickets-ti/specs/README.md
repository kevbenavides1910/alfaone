# Especificaciones originales — Tickets TI

Las especificaciones maestras del proyecto se entregaron en el repositorio de diseño. En Alfa One fueron adaptadas a Next.js/Prisma:

| Documento original | Adaptación Alfa One |
|--------------------|---------------------|
| Especificación General (visión, principios) | `../00-DISCOVERY.md` + specs del usuario |
| Domain Model | Modelos Prisma en `prisma/schema.prisma` (sección Tickets TI) |
| Business Rules | `src/modules/tickets-ti/business/status-transitions.ts` |
| Integration Protocol | `../01-PLATFORM-ADAPTATION.md` |
| Database Design | Migración `prisma/migrations/20260623180000_tickets_ti/` |
| UI/UX Specification | Centro de Operaciones en `/tickets-ti` (implementación progresiva) |

**Nota:** La spec original referencia Laravel + Blade + Bootstrap. Alfa One usa Next.js + Tailwind; la funcionalidad y reglas de negocio se conservan.
