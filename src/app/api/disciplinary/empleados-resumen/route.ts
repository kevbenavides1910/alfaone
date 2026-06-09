import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { ok, unauthorized, forbidden } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { prisma } from "@/modules/core/db/prisma";
import {
  getTreatmentFilterKey,
  parseTreatmentFilterParam,
} from "@/modules/disciplinario/business/cycle-display";
import {
  canonicalZoneLabel,
  defaultsForZoneText,
  loadZoneCatalogNameByKey,
  loadZoneDisciplinaryDefaultsMap,
} from "@/modules/disciplinario/services/disciplinary-zone-defaults";

/**
 * Resumen por empleado para el seguimiento disciplinario:
 *
 * - `totalNoAnulados`: total histórico de apercibimientos no anulados.
 * - `vigentesEnCicloActual`: apercibimientos no anulados con `fechaEmision`
 *   posterior al último `cerradoEl` de los ciclos cerrados del empleado.
 *   Esto hace que el contador "se reinicie a cero" al cerrar un ciclo, tal
 *   como pidió el usuario.
 * - `tieneObligacion`: true si el ciclo vigente acumuló >= 3 apercibimientos.
 *
 * Filtros:
 *   - q: texto que matchea código (exacto) o nombre (contiene, case-insensitive).
 *   - zona: contiene.
 *   - administrador: contiene (administrador del último apercibimiento del empleado).
 *   - soloObligacion: "1" para devolver solo empleados con tieneObligacion=true.
 *   - tratamiento: COBRADO | DADO_DE_BAJA | PENDIENTE | OTRO | SIN_DEFINIR
 */

function parseLocalDate(s: string | null): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

interface EmpleadoResumen {
  codigoEmpleado: string;
  nombreEmpleado: string;
  zona: string | null;
  /** Ubicación operativa (último apercibimiento o asignación RRHH). */
  ubicacion: string | null;
  sucursal: string | null;
  administrador: string | null;
  totalApercibimientos: number;
  totalNoAnulados: number;
  vigentesEnCicloActual: number;
  ultimoCerradoEl: string | null;
  ultimaFechaEmision: string | null;
  tieneObligacion: boolean;
  treatment: {
    fechaConvocatoria: string | null;
    horaConvocatoria: string | null;
    accion: string | null;
    cobradoDate: string | null;
    convocatoriaEnviadaAt: string | null;
  } | null;
  /** Datos del último ciclo cerrado (acción de cierre y monto si aplica). */
  ultimoCierre: {
    accion: string;
    accionRaw: string | null;
    monto: number | null;
  } | null;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "disciplinario.empleados", "view")) return forbidden();

  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() || "";
  const zona = sp.get("zona")?.trim() || "";
  const administrador = sp.get("administrador")?.trim() || "";
  const soloObligacion = sp.get("soloObligacion") === "1";
  const convocatoriaDesde = parseLocalDate(sp.get("convocatoriaDesde"));
  const convocatoriaHasta = parseLocalDate(sp.get("convocatoriaHasta"));
  // "1" = solo empleados sin fecha de convocatoria definida.
  const sinConvocatoria = sp.get("sinConvocatoria") === "1";
  const tratamientoFilter = parseTreatmentFilterParam(sp.get("tratamiento"));

  const [zoneDisciplineDefaults, zoneCatalogNames] = await Promise.all([
    loadZoneDisciplinaryDefaultsMap(),
    loadZoneCatalogNameByKey(),
  ]);

  // 1) Cargamos TODOS los apercibimientos (campos mínimos) para agregar en memoria.
  //    Esto es razonable para un dataset disciplinario (cientos / pocos miles de filas).
  const all = await prisma.disciplinaryApercibimiento.findMany({
    select: {
      codigoEmpleado: true,
      nombreEmpleado: true,
      zona: true,
      sucursal: true,
      administrador: true,
      fechaEmision: true,
      estado: true,
    },
    orderBy: [{ codigoEmpleado: "asc" }, { fechaEmision: "asc" }],
  });

  // 2) Último ciclo cerrado por código (fecha, acción y monto).
  const ciclos = await prisma.disciplinaryClosedCycle.findMany({
    where: { cerradoEl: { not: null } },
    select: {
      cerradoEl: true,
      accion: true,
      accionRaw: true,
      monto: true,
      treatment: { select: { codigoEmpleado: true } },
    },
  });
  const ultimoCerradoPorCodigo = new Map<string, Date>();
  const ultimoCierrePorCodigo = new Map<
    string,
    EmpleadoResumen["ultimoCierre"] & { cerradoEl: Date }
  >();
  for (const c of ciclos) {
    if (!c.cerradoEl) continue;
    const code = c.treatment.codigoEmpleado;
    const prev = ultimoCerradoPorCodigo.get(code);
    if (!prev || c.cerradoEl > prev) {
      ultimoCerradoPorCodigo.set(code, c.cerradoEl);
      ultimoCierrePorCodigo.set(code, {
        cerradoEl: c.cerradoEl,
        accion: c.accion,
        accionRaw: c.accionRaw,
        monto: c.monto !== null ? Number(c.monto) : null,
      });
    }
  }

  // 3) Cargamos tratamientos vigentes por código.
  const tratamientos = await prisma.disciplinaryTreatment.findMany({
    select: {
      codigoEmpleado: true,
      fechaConvocatoria: true,
      horaConvocatoria: true,
      accion: true,
      cobradoDate: true,
      convocatoriaEnviadaAt: true,
    },
  });
  const tratamientoPorCodigo = new Map<
    string,
    {
      fechaConvocatoria: Date | null;
      horaConvocatoria: string | null;
      accion: string | null;
      cobradoDate: Date | null;
      convocatoriaEnviadaAt: Date | null;
    }
  >();
  for (const t of tratamientos) {
    tratamientoPorCodigo.set(t.codigoEmpleado, {
      fechaConvocatoria: t.fechaConvocatoria,
      horaConvocatoria: t.horaConvocatoria,
      accion: t.accion,
      cobradoDate: t.cobradoDate,
      convocatoriaEnviadaAt: t.convocatoriaEnviadaAt,
    });
  }

  function mapTreatment(
    t: {
      fechaConvocatoria: Date | null;
      horaConvocatoria: string | null;
      accion: string | null;
      cobradoDate: Date | null;
      convocatoriaEnviadaAt: Date | null;
    } | undefined,
  ): EmpleadoResumen["treatment"] {
    if (!t) return null;
    return {
      fechaConvocatoria: t.fechaConvocatoria?.toISOString() ?? null,
      horaConvocatoria: t.horaConvocatoria ?? null,
      accion: t.accion ?? null,
      cobradoDate: t.cobradoDate?.toISOString() ?? null,
      convocatoriaEnviadaAt: t.convocatoriaEnviadaAt?.toISOString() ?? null,
    };
  }

  // 4) Agregamos por código.
  const acc = new Map<string, EmpleadoResumen>();
  for (const a of all) {
    let row = acc.get(a.codigoEmpleado);
    if (!row) {
      row = {
        codigoEmpleado: a.codigoEmpleado,
        nombreEmpleado: a.nombreEmpleado,
        zona: a.zona,
        ubicacion: a.zona,
        sucursal: a.sucursal,
        administrador: a.administrador,
        totalApercibimientos: 0,
        totalNoAnulados: 0,
        vigentesEnCicloActual: 0,
        ultimoCerradoEl: null,
        ultimaFechaEmision: null,
        tieneObligacion: false,
        treatment: mapTreatment(tratamientoPorCodigo.get(a.codigoEmpleado)),
        ultimoCierre: null,
      };
      const ultimoCerrado = ultimoCerradoPorCodigo.get(a.codigoEmpleado);
      if (ultimoCerrado) row.ultimoCerradoEl = ultimoCerrado.toISOString();
      const cierre = ultimoCierrePorCodigo.get(a.codigoEmpleado);
      if (cierre) {
        row.ultimoCierre = {
          accion: cierre.accion,
          accionRaw: cierre.accionRaw,
          monto: cierre.monto,
        };
      }
      acc.set(a.codigoEmpleado, row);
    }

    row.totalApercibimientos++;
    // Como ordenamos por fechaEmision asc, el último que pisa ultimaFechaEmision/admin es el más reciente.
    row.ultimaFechaEmision = a.fechaEmision.toISOString();
    if (a.administrador) row.administrador = a.administrador;
    if (a.nombreEmpleado) row.nombreEmpleado = a.nombreEmpleado;
    if (a.zona) {
      row.zona = a.zona;
      row.ubicacion = a.zona;
    }
    if (a.sucursal) row.sucursal = a.sucursal;

    if (a.estado === "ANULADO") continue;
    row.totalNoAnulados++;

    const ultimoCerrado = ultimoCerradoPorCodigo.get(a.codigoEmpleado);
    if (!ultimoCerrado || a.fechaEmision > ultimoCerrado) {
      row.vigentesEnCicloActual++;
    }
  }

  // Empleados sin apercibimientos pero con tratamiento (caso raro; los incluimos también).
  for (const [code, t] of tratamientoPorCodigo) {
    if (acc.has(code)) continue;
    acc.set(code, {
      codigoEmpleado: code,
      nombreEmpleado: "",
      zona: null,
      ubicacion: null,
      sucursal: null,
      administrador: null,
      totalApercibimientos: 0,
      totalNoAnulados: 0,
      vigentesEnCicloActual: 0,
      ultimoCerradoEl: ultimoCerradoPorCodigo.get(code)?.toISOString() ?? null,
      ultimaFechaEmision: null,
      tieneObligacion: false,
      treatment: mapTreatment(t),
      ultimoCierre: (() => {
        const c = ultimoCierrePorCodigo.get(code);
        if (!c) return null;
        return {
          accion: c.accion,
          accionRaw: c.accionRaw,
          monto: c.monto,
        };
      })(),
    });
  }

  // 4b) Completar ubicación desde asignaciones RRHH si no vino en apercibimientos.
  const sinUbicacion = [...acc.keys()].filter((code) => {
    const r = acc.get(code)!;
    return !r.ubicacion?.trim();
  });
  if (sinUbicacion.length > 0) {
    const placements = await prisma.employeePlacement.findMany({
      where: { employee: { codigoEmpleado: { in: sinUbicacion } } },
      select: {
        ubicacionNombre: true,
        zona: true,
        updatedAt: true,
        employee: { select: { codigoEmpleado: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    const ubicacionPorCodigo = new Map<string, string>();
    for (const p of placements) {
      const code = p.employee.codigoEmpleado;
      if (ubicacionPorCodigo.has(code)) continue;
      const u = p.ubicacionNombre?.trim() || p.zona?.trim();
      if (u) ubicacionPorCodigo.set(code, u);
    }
    for (const [code, u] of ubicacionPorCodigo) {
      const row = acc.get(code);
      if (row && !row.ubicacion) row.ubicacion = u;
    }
  }

  // 5) Marcar obligación y aplicar filtros.
  const qLower = q.toLowerCase();
  const zonaLower = zona.toLowerCase();
  const admLower = administrador.toLowerCase();

  let rows = Array.from(acc.values()).map((r) => {
    const zona = canonicalZoneLabel(zoneCatalogNames, r.zona);
    let administrador = r.administrador;
    if (!administrador?.trim() && zona) {
      const zd = defaultsForZoneText(zoneDisciplineDefaults, zona);
      if (zd?.administrator) administrador = zd.administrator;
    }
    return {
      ...r,
      zona,
      ubicacion: zona ?? r.ubicacion,
      administrador,
      tieneObligacion: r.vigentesEnCicloActual >= 3,
    };
  });

  if (q) {
    rows = rows.filter((r) =>
      r.codigoEmpleado === q ||
      r.nombreEmpleado.toLowerCase().includes(qLower),
    );
  }
  if (zona) {
    rows = rows.filter((r) => (r.zona ?? "").toLowerCase().includes(zonaLower));
  }
  if (administrador) {
    rows = rows.filter((r) => (r.administrador ?? "").toLowerCase().includes(admLower));
  }
  if (soloObligacion) {
    rows = rows.filter((r) => r.tieneObligacion);
  }

  if (sinConvocatoria) {
    rows = rows.filter((r) => !r.treatment?.fechaConvocatoria);
  }

  if (convocatoriaDesde || convocatoriaHasta) {
    const desdeMs = convocatoriaDesde?.getTime() ?? null;
    const hastaEnd = convocatoriaHasta ? new Date(convocatoriaHasta) : null;
    if (hastaEnd) hastaEnd.setHours(23, 59, 59, 999);
    const hastaMs = hastaEnd?.getTime() ?? null;

    rows = rows.filter((r) => {
      const f = r.treatment?.fechaConvocatoria;
      if (!f) return false;
      const ts = new Date(f).getTime();
      if (desdeMs !== null && ts < desdeMs) return false;
      if (hastaMs !== null && ts > hastaMs) return false;
      return true;
    });
  }

  if (tratamientoFilter) {
    rows = rows.filter((r) => {
      const key = getTreatmentFilterKey(
        r.treatment
          ? {
              fechaConvocatoria: r.treatment.fechaConvocatoria,
              accion: r.treatment.accion,
              cobradoDate: r.treatment.cobradoDate,
            }
          : null,
        r.ultimoCierre,
      );
      return key === tratamientoFilter;
    });
  }

  // Ordenar: con obligación arriba, luego más apercibimientos vigentes, luego más recientes.
  rows.sort((a, b) => {
    if (a.tieneObligacion !== b.tieneObligacion) return a.tieneObligacion ? -1 : 1;
    if (a.vigentesEnCicloActual !== b.vigentesEnCicloActual) {
      return b.vigentesEnCicloActual - a.vigentesEnCicloActual;
    }
    const da = a.ultimaFechaEmision ?? "";
    const db = b.ultimaFechaEmision ?? "";
    return db.localeCompare(da);
  });

  return ok(rows, { total: rows.length });
}
