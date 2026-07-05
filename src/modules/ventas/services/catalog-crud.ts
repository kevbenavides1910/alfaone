import { Prisma, VentasEquipamiento, VentasSalarioTipo } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import type { CatalogSection } from "../validations/parametros.schema";
import type { CatalogItemCreateInput } from "../validations/parametros.schema";
import {
  generateCatalogCodigo,
  parseCatalogOverrides,
  type CatalogOverrides,
} from "../business/catalog-overrides";

function n(v: number): Prisma.Decimal {
  return new Prisma.Decimal(v);
}

function nextSortOrder(section: CatalogSection): Promise<number> {
  if (section === "indices") {
    return prisma.ventasIndiceActualizacion.count().then((c) => c + 1);
  }
  const q = {
    salarios: () => prisma.ventasSalarioCategoria.aggregate({ _max: { sortOrder: true } }),
    jornadas: () => prisma.ventasJornadaTipo.aggregate({ _max: { sortOrder: true } }),
    cargasSociales: () => prisma.ventasCargaSocial.aggregate({ _max: { sortOrder: true } }),
    pagosExtras: () => prisma.ventasPagoExtra.aggregate({ _max: { sortOrder: true } }),
    insumos: () => prisma.ventasInsumoItem.aggregate({ _max: { sortOrder: true } }),
    gastosAdmin: () => prisma.ventasGastoAdmin.aggregate({ _max: { sortOrder: true } }),
  };
  return q[section]().then((r) => (r._max.sortOrder ?? 0) + 1);
}

export async function createGlobalCatalogItem(input: CatalogItemCreateInput) {
  const { section, item } = input;
  const codigo = (item.codigo as string)?.trim() || generateCatalogCodigo(section);
  const sortOrder = await nextSortOrder(section);

  switch (section) {
    case "salarios":
      await prisma.ventasSalarioCategoria.create({
        data: {
          codigo,
          descripcion: String(item.descripcion ?? item.nombre ?? "Nuevo salario"),
          tipo: (item.tipo as VentasSalarioTipo) ?? VentasSalarioTipo.MENSUAL,
          valoresPorAnio: (item.valoresPorAnio as Record<string, number>) ?? {
            "2026": Number(item.valor ?? 0),
          },
          sortOrder,
        },
      });
      break;
    case "cargasSociales":
      await prisma.ventasCargaSocial.create({
        data: {
          codigo,
          nombre: String(item.nombre ?? "Nueva carga"),
          porcentaje: n(Number(item.porcentaje ?? 0)),
          grupo: String(item.grupo ?? "OTROS"),
          sortOrder,
        },
      });
      break;
    case "pagosExtras":
      await prisma.ventasPagoExtra.create({
        data: {
          codigo,
          nombre: String(item.nombre ?? "Nuevo pago extra"),
          tipo: String(item.tipo ?? "MONTO"),
          valor: n(Number(item.valor ?? 0)),
          sortOrder,
        },
      });
      break;
    case "insumos":
      await prisma.ventasInsumoItem.create({
        data: {
          codigo,
          nombre: String(item.nombre ?? "Nuevo insumo"),
          categoria: String(item.categoria ?? "GENERAL"),
          costoUnitario: n(Number(item.costoUnitario ?? 0)),
          equipamientos: (item.equipamientos as VentasEquipamiento[]) ?? [VentasEquipamiento.SA],
          sortOrder,
        },
      });
      break;
    case "gastosAdmin":
      await prisma.ventasGastoAdmin.create({
        data: {
          codigo,
          nombre: String(item.nombre ?? "Nuevo gasto admin."),
          montoMensual: n(Number(item.montoMensual ?? 0)),
          sortOrder,
        },
      });
      break;
    case "indices":
      await prisma.ventasIndiceActualizacion.create({
        data: {
          codigo,
          nombre: String(item.nombre ?? "Nuevo índice"),
          valor: item.valor != null ? n(Number(item.valor)) : null,
        },
      });
      break;
    case "jornadas": {
      const code = String(item.codigo ?? codigo)
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "");
      if (!code) throw new Error("Código de jornada requerido");
      await prisma.ventasJornadaTipo.create({
        data: {
          codigo: code,
          nombre: String(item.nombre ?? code),
          horasConfig: (item.horasConfig as object) ?? {},
          salarioBaseMensual:
            item.salarioBaseMensual != null ? n(Number(item.salarioBaseMensual)) : null,
          costoMoReferencia:
            item.costoMoReferencia != null ? n(Number(item.costoMoReferencia)) : null,
          costoHoraOrdinaria:
            item.costoHoraOrdinaria != null ? n(Number(item.costoHoraOrdinaria)) : null,
          sortOrder,
        },
      });
      break;
    }
    default:
      return null;
  }

  return codigo;
}

export async function deleteGlobalCatalogItem(section: CatalogSection, codigo: string) {
  const deactivate = { isActive: false };
  switch (section) {
    case "salarios":
      await prisma.ventasSalarioCategoria.update({ where: { codigo }, data: deactivate });
      break;
    case "cargasSociales":
      await prisma.ventasCargaSocial.update({ where: { codigo }, data: deactivate });
      break;
    case "pagosExtras":
      await prisma.ventasPagoExtra.update({ where: { codigo }, data: deactivate });
      break;
    case "insumos":
      await prisma.ventasInsumoItem.update({ where: { codigo }, data: deactivate });
      break;
    case "gastosAdmin":
      await prisma.ventasGastoAdmin.update({ where: { codigo }, data: deactivate });
      break;
    case "indices":
      await prisma.ventasIndiceActualizacion.delete({ where: { codigo } });
      break;
    case "jornadas":
      await prisma.ventasJornadaTipo.update({ where: { codigo }, data: deactivate });
      break;
    default:
      return false;
  }
  return true;
}

function readCustomization(raw: unknown): CatalogOverrides {
  return parseCatalogOverrides(raw);
}

export async function addPresupuestoCatalogLine(
  presupuestoId: string,
  input: CatalogItemCreateInput
): Promise<CatalogOverrides | null> {
  const presupuesto = await prisma.ventasPresupuesto.findUnique({ where: { id: presupuestoId } });
  if (!presupuesto) return null;

  const { section, item } = input;

  const current = readCustomization(presupuesto.catalogOverrides);
  const codigo = (item.codigo as string)?.trim() || generateCatalogCodigo(section);
  const row = { ...item, codigo };

  const added = { ...(current._added ?? {}) };
  const list = [...(added[section] ?? []), row];
  added[section] = list;

  const next: CatalogOverrides = { ...current, _added: added };
  await prisma.ventasPresupuesto.update({
    where: { id: presupuestoId },
    data: { catalogOverrides: next as Prisma.InputJsonValue },
  });
  return next;
}

export async function removePresupuestoCatalogLine(
  presupuestoId: string,
  section: CatalogSection,
  codigo: string
): Promise<CatalogOverrides | null> {
  const presupuesto = await prisma.ventasPresupuesto.findUnique({ where: { id: presupuestoId } });
  if (!presupuesto) return null;

  const current = readCustomization(presupuesto.catalogOverrides);
  const addedList = current._added?.[section] ?? [];
  const isAdded = addedList.some((x) => String(x.codigo) === codigo);

  let next: CatalogOverrides = { ...current };

  if (isAdded) {
    const filtered = addedList.filter((x) => String(x.codigo) !== codigo);
    const added = { ...(next._added ?? {}) };
    if (filtered.length === 0) delete added[section];
    else added[section] = filtered;
    next._added = Object.keys(added).length ? added : undefined;
  } else {
    const excluded = { ...(next._excluded ?? {}) };
    const set = new Set([...(excluded[section] ?? []), codigo]);
    excluded[section] = [...set];
    next._excluded = excluded;

    const fields = { ...next };
    delete fields._excluded;
    delete fields._added;
    const sectionMap = fields[section as keyof typeof fields];
    if (sectionMap && typeof sectionMap === "object" && codigo in (sectionMap as object)) {
      const copy = { ...(sectionMap as Record<string, unknown>) };
      delete copy[codigo];
      if (Object.keys(copy).length === 0) delete fields[section as keyof typeof fields];
      else (fields as Record<string, unknown>)[section] = copy;
      next = { ...next, ...fields };
    }
  }

  await prisma.ventasPresupuesto.update({
    where: { id: presupuestoId },
    data: { catalogOverrides: next as Prisma.InputJsonValue },
  });
  return next;
}
