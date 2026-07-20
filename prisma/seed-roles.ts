/**
 * Siembra roles del sistema y permisos según el registro.
 * Ejecutar: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-roles.ts
 */
import { PrismaClient, PermissionLevel, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

const ALL_KEYS = [
  "core.home",
  "core.dashboard_ejecutivo",
  "presupuestos.contracts",
  "facturacion.cobro",
  "facturacion.cxc",
  "gastos.expenses",
  "gastos.expenses_deferred",
  "gastos.expenses_admin",
  "gastos.expenses_approvals",
  "gastos.expenses_bitacora",
  "gastos.reports_monthly",
  "gastos.reports_annual",
  "disciplinario.import",
  "disciplinario.historial",
  "disciplinario.empleados",
  "disciplinario.convocatoria",
  "disciplinario.dashboard",
  "disciplinario.omisiones",
  "disciplinario.ajustes",
  "empleados.list",
  "empleados.import",
  "empleados.contratos",
  "expedienteDigital.list",
  "expedienteDigital.upload",
  "sig.biblioteca",
  "sig.documentos",
  "sig.aprobaciones",
  "sig.bitacora",
  "sig.procesos",
  "recorridos.dashboard",
  "recorridos.configuracion",
  "recorridos.dispositivos",
  "recorridos.rutas",
  "recorridos.asignaciones",
  "recorridos.reportes",
  "inventario.assets",
  "plataforma.users",
  "plataforma.roles",
  "plataforma.catalogs",
  "plataforma.approvals_config",
] as const;

type L = PermissionLevel;

function levelMap(
  entries: Partial<Record<(typeof ALL_KEYS)[number], L>>
): { permissionKey: string; level: L }[] {
  return ALL_KEYS.map((key) => ({
    permissionKey: key,
    level: entries[key] ?? PermissionLevel.NONE,
  }));
}

const SYSTEM_ROLES: {
  code: string;
  name: string;
  description: string;
  legacyRole: UserRole;
  permissions: Partial<Record<(typeof ALL_KEYS)[number], L>>;
}[] = [
  {
    code: "ADMIN",
    name: "Administrador",
    description: "Acceso total al sistema",
    legacyRole: UserRole.ADMIN,
    permissions: Object.fromEntries(
      ALL_KEYS.map((k) => [k, PermissionLevel.ADMIN])
    ) as Partial<Record<(typeof ALL_KEYS)[number], L>>,
  },
  {
    code: "SUPERVISOR",
    name: "Supervisor",
    description: "Contratos, gastos y disciplinario con edición",
    legacyRole: UserRole.SUPERVISOR,
    permissions: {
      "core.home": PermissionLevel.VIEW,
      "core.dashboard_ejecutivo": PermissionLevel.VIEW,
      "presupuestos.contracts": PermissionLevel.EDIT,
      "facturacion.cobro": PermissionLevel.EDIT,
      "facturacion.cxc": PermissionLevel.EDIT,
      "gastos.expenses": PermissionLevel.EDIT,
      "gastos.expenses_deferred": PermissionLevel.EDIT,
      "gastos.expenses_admin": PermissionLevel.EDIT,
      "gastos.expenses_approvals": PermissionLevel.EDIT,
      "gastos.expenses_bitacora": PermissionLevel.VIEW,
      "gastos.reports_monthly": PermissionLevel.VIEW,
      "gastos.reports_annual": PermissionLevel.VIEW,
      "disciplinario.import": PermissionLevel.VIEW,
      "disciplinario.historial": PermissionLevel.EDIT,
      "disciplinario.empleados": PermissionLevel.EDIT,
      "disciplinario.convocatoria": PermissionLevel.VIEW,
      "disciplinario.dashboard": PermissionLevel.VIEW,
      "disciplinario.omisiones": PermissionLevel.VIEW,
      "disciplinario.ajustes": PermissionLevel.VIEW,
      "empleados.list": PermissionLevel.EDIT,
      "empleados.import": PermissionLevel.EDIT,
      "empleados.contratos": PermissionLevel.EDIT,
      "recorridos.dashboard": PermissionLevel.VIEW,
      "recorridos.configuracion": PermissionLevel.EDIT,
      "recorridos.dispositivos": PermissionLevel.EDIT,
      "recorridos.rutas": PermissionLevel.EDIT,
      "recorridos.asignaciones": PermissionLevel.EDIT,
      "recorridos.reportes": PermissionLevel.VIEW,
      "inventario.assets": PermissionLevel.VIEW,
    },
  },
  {
    code: "COMPRAS",
    name: "Compras",
    description: "Gestión de gastos",
    legacyRole: UserRole.COMPRAS,
    permissions: {
      "core.home": PermissionLevel.VIEW,
      "core.dashboard_ejecutivo": PermissionLevel.VIEW,
      "presupuestos.contracts": PermissionLevel.VIEW,
      "facturacion.cobro": PermissionLevel.VIEW,
      "facturacion.cxc": PermissionLevel.VIEW,
      "gastos.expenses": PermissionLevel.EDIT,
      "gastos.expenses_deferred": PermissionLevel.EDIT,
      "gastos.expenses_admin": PermissionLevel.EDIT,
      "gastos.expenses_approvals": PermissionLevel.EDIT,
      "gastos.expenses_bitacora": PermissionLevel.VIEW,
      "gastos.reports_monthly": PermissionLevel.VIEW,
      "gastos.reports_annual": PermissionLevel.VIEW,
      "disciplinario.historial": PermissionLevel.VIEW,
      "disciplinario.dashboard": PermissionLevel.VIEW,
      "empleados.list": PermissionLevel.VIEW,
      "expedienteDigital.list": PermissionLevel.VIEW,
      "expedienteDigital.upload": PermissionLevel.EDIT,
      "empleados.contratos": PermissionLevel.VIEW,
      "inventario.assets": PermissionLevel.VIEW,
    },
  },
  {
    code: "COMMERCIAL",
    name: "Comercial",
    description: "Contratos y consulta de gastos",
    legacyRole: UserRole.COMMERCIAL,
    permissions: {
      "core.home": PermissionLevel.VIEW,
      "core.dashboard_ejecutivo": PermissionLevel.VIEW,
      "presupuestos.contracts": PermissionLevel.EDIT,
      "facturacion.cobro": PermissionLevel.EDIT,
      "facturacion.cxc": PermissionLevel.EDIT,
      "gastos.expenses": PermissionLevel.VIEW,
      "gastos.expenses_bitacora": PermissionLevel.VIEW,
      "gastos.reports_monthly": PermissionLevel.VIEW,
      "gastos.reports_annual": PermissionLevel.VIEW,
      "disciplinario.historial": PermissionLevel.VIEW,
      "disciplinario.dashboard": PermissionLevel.VIEW,
      "empleados.list": PermissionLevel.VIEW,
      "empleados.contratos": PermissionLevel.VIEW,
      "inventario.assets": PermissionLevel.VIEW,
    },
  },
  {
    code: "CONSULTA",
    name: "Consulta",
    description: "Solo lectura en módulos operativos",
    legacyRole: UserRole.CONSULTA,
    permissions: {
      "core.home": PermissionLevel.VIEW,
      "core.dashboard_ejecutivo": PermissionLevel.VIEW,
      "presupuestos.contracts": PermissionLevel.VIEW,
      "facturacion.cobro": PermissionLevel.VIEW,
      "facturacion.cxc": PermissionLevel.VIEW,
      "gastos.expenses": PermissionLevel.VIEW,
      "gastos.expenses_deferred": PermissionLevel.VIEW,
      "gastos.expenses_admin": PermissionLevel.VIEW,
      "gastos.expenses_approvals": PermissionLevel.VIEW,
      "gastos.expenses_bitacora": PermissionLevel.VIEW,
      "gastos.reports_monthly": PermissionLevel.VIEW,
      "gastos.reports_annual": PermissionLevel.VIEW,
      "disciplinario.import": PermissionLevel.VIEW,
      "disciplinario.historial": PermissionLevel.VIEW,
      "disciplinario.empleados": PermissionLevel.VIEW,
      "disciplinario.convocatoria": PermissionLevel.VIEW,
      "disciplinario.dashboard": PermissionLevel.VIEW,
      "disciplinario.omisiones": PermissionLevel.VIEW,
      "empleados.list": PermissionLevel.VIEW,
      "empleados.import": PermissionLevel.VIEW,
      "empleados.contratos": PermissionLevel.VIEW,
      "inventario.assets": PermissionLevel.VIEW,
    },
  },
];

async function main() {
  console.log("Seeding system roles and permissions…");

  for (const def of SYSTEM_ROLES) {
    const perms = levelMap(def.permissions);
    const role = await prisma.role.upsert({
      where: { code: def.code },
      create: {
        code: def.code,
        name: def.name,
        description: def.description,
        isSystem: true,
      },
      update: {
        name: def.name,
        description: def.description,
        isSystem: true,
      },
    });

    for (const { permissionKey, level } of perms) {
      if (level === PermissionLevel.NONE) {
        await prisma.rolePermission.deleteMany({
          where: { roleId: role.id, permissionKey },
        });
        continue;
      }
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionKey: { roleId: role.id, permissionKey },
        },
        create: { roleId: role.id, permissionKey, level },
        update: { level },
      });
    }

    const updated = await prisma.user.updateMany({
      where: { role: def.legacyRole },
      data: { roleId: role.id },
    });
    console.log(`  ${def.code}: ${updated.count} usuario(s) vinculados`);
  }

  const adminRole = await prisma.role.findUnique({ where: { code: "ADMIN" } });
  if (adminRole) {
    await prisma.user.updateMany({
      where: { roleId: null },
      data: { roleId: adminRole.id },
    });
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
