import type { Session } from "next-auth";
import {
  getNafNominaByDateRange,
  listNafNominaEmpresas,
  listNafNominaPeriodos,
} from "@/modules/empleados-naf/services/list-nomina";
import { listNafEmployees } from "@/modules/empleados-naf/services/list-employees";
import { getRevisionPlanillaByDateRange } from "@/modules/empleados-naf/services/revision-planilla";
import type { SyntraTool } from "./types";
import { toolDef } from "./types";
import { MAX_LIST, isoDate, resolveNoCias, resolveRevisionNoCias, strArg, intArg } from "./shared";

export function empleadosNafTools(): SyntraTool[] {
  return [
    {
      permission: { key: "empleadosNaf.nomina", level: "view" },
      definition: toolDef(
        "list_payroll_companies",
        "Lista empresas NAF con datos de nómina sincronizados (noCia, código y nombre). Use antes de consultar planilla si no conoce el noCia.",
        { type: "object", properties: {}, additionalProperties: false },
      ),
      describeCall: () => "Listando empresas con nómina NAF…",
      handler: async (session) => {
        const empresas = await listNafNominaEmpresas();
        const company = session.user.company;
        const filtered = company ? empresas.filter((e) => e.companyCode === company) : empresas;
        return {
          empresas: filtered.slice(0, MAX_LIST).map((e) => ({
            noCia: e.noCia,
            companyCode: e.companyCode,
            label: e.companyLabel,
          })),
          nota: "NAF es la fuente de verdad para planilla. Use noCia en otras herramientas.",
        };
      },
    },
    {
      permission: { key: "empleadosNaf.nomina", level: "view" },
      definition: toolDef(
        "list_payroll_periods",
        "Lista quincenas/periodos de nómina NAF disponibles (más recientes primero). Devuelve fDesde, fHasta y etiqueta. Use para resolver «última quincena».",
        {
          type: "object",
          properties: {
            noCias: {
              type: "array",
              items: { type: "string" },
              description: "Códigos NAF de empresa (ej. 01). Vacío = empresas del usuario.",
            },
            limit: { type: "integer", description: "Máximo de periodos (default 6)." },
          },
          additionalProperties: false,
        },
      ),
      describeCall: () => "Buscando quincenas de planilla disponibles…",
      handler: async (session, args) => {
        const noCias = await resolveNoCias(session, Array.isArray(args.noCias) ? (args.noCias as string[]) : undefined);
        if (!noCias.length) return { error: "No hay empresas NAF con nómina sincronizada." };
        const limit = intArg(args, "limit", 6, 12);
        const periodos = await listNafNominaPeriodos(noCias);
        return {
          periodos: periodos.slice(0, limit).map((p) => ({
            label: p.label,
            fDesde: isoDate(p.fDesde),
            fHasta: isoDate(p.fHasta),
            ano: p.ano,
            descri: p.descri,
            empresas: p.empresas,
          })),
          noCias,
        };
      },
    },
    {
      permission: { key: "empleadosNaf.nomina", level: "view" },
      definition: toolDef(
        "query_payroll_totals",
        "Totales de planilla/nómina NAF (devengado, deducciones, neto, empleados) en un rango de fechas. NAF es la fuente de verdad para planilla.",
        {
          type: "object",
          properties: {
            fDesde: { type: "string", description: "Fecha inicio YYYY-MM-DD." },
            fHasta: { type: "string", description: "Fecha fin YYYY-MM-DD." },
            noCias: {
              type: "array",
              items: { type: "string" },
              description: "Empresas NAF. Vacío = empresas del usuario.",
            },
          },
          required: ["fDesde", "fHasta"],
          additionalProperties: false,
        },
      ),
      describeCall: (args) => {
        const desde = strArg(args ?? {}, "fDesde").slice(0, 10);
        const hasta = strArg(args ?? {}, "fHasta").slice(0, 10);
        if (desde && hasta) return `Calculando totales de planilla (${desde} – ${hasta})…`;
        return "Calculando totales de nómina NAF…";
      },
      handler: async (session, args) => {
        const fDesde = strArg(args, "fDesde");
        const fHasta = strArg(args, "fHasta");
        if (!fDesde || !fHasta) return { error: "Indique fDesde y fHasta (YYYY-MM-DD)." };
        const noCias = await resolveNoCias(session, Array.isArray(args.noCias) ? (args.noCias as string[]) : undefined);
        if (!noCias.length) return { error: "No hay empresas NAF disponibles." };
        const detalle = await getNafNominaByDateRange(fDesde, fHasta, noCias, undefined, {
          laborAllocationOnly: true,
        });
        return {
          periodo: { fDesde: isoDate(detalle.fDesde), fHasta: isoDate(detalle.fHasta), descri: detalle.meta.descri },
          totales: detalle.totales,
          porEmpresa: detalle.porEmpresa.slice(0, MAX_LIST).map((e) => ({
            noCia: e.noCia,
            empresa: e.companyLabel,
            empleados: e.empleados,
            devengado: e.devengado,
            deducciones: e.deducciones,
            neto: e.neto,
          })),
          moneda: "CRC",
          fuente: "NAF (nómina sincronizada)",
        };
      },
    },
    {
      permission: { key: "empleadosNaf.revisionPlanilla", level: "view" },
      definition: toolDef(
        "query_revision_planilla_formas_pago",
        "Desglose por forma de pago de Revisión de planilla: CK (cheque), DAV (Davivienda), BN (Banco Nacional) y OTRO. Montos y empleados por canal. CK NO es empresa ni contrato.",
        {
          type: "object",
          properties: {
            fDesde: { type: "string", description: "Fecha inicio YYYY-MM-DD." },
            fHasta: { type: "string", description: "Fecha fin YYYY-MM-DD." },
            noCias: {
              type: "array",
              items: { type: "string" },
              description: "Empresas NAF. Vacío = empresas del usuario.",
            },
          },
          required: ["fDesde", "fHasta"],
          additionalProperties: false,
        },
      ),
      describeCall: (args) => {
        const desde = strArg(args ?? {}, "fDesde").slice(0, 10);
        const hasta = strArg(args ?? {}, "fHasta").slice(0, 10);
        if (desde && hasta) return `Consultando formas de pago CK/DAV/BN (${desde} – ${hasta})…`;
        return "Consultando formas de pago de planilla…";
      },
      handler: async (session, args) => {
        const fDesde = strArg(args, "fDesde");
        const fHasta = strArg(args, "fHasta");
        if (!fDesde || !fHasta) return { error: "Indique fDesde y fHasta (YYYY-MM-DD)." };
        const noCias = await resolveRevisionNoCias(
          session,
          Array.isArray(args.noCias) ? (args.noCias as string[]) : undefined,
        );
        if (!noCias.length) return { error: "No hay empresas NAF disponibles." };
        const result = await getRevisionPlanillaByDateRange(fDesde, fHasta, noCias);
        const { totales } = result;
        const { empleadosPorCanal } = totales;
        return {
          periodo: { fDesde: isoDate(result.fDesde), fHasta: isoDate(result.fHasta), ano: result.ano },
          formasPago: {
            CK: { etiqueta: "Cheque", monto: totales.cheque, empleados: empleadosPorCanal.CK },
            DAV: { etiqueta: "Davivienda", monto: totales.davivienda, empleados: empleadosPorCanal.DAV },
            BN: { etiqueta: "Banco Nacional", monto: totales.bn, empleados: empleadosPorCanal.BN },
            OTRO: { etiqueta: "Otro", monto: totales.otro, empleados: empleadosPorCanal.OTRO },
          },
          totales: {
            empleados: totales.empleados,
            liquido: totales.liquido,
            sumaFormasPago: totales.sumaFormasPago,
            diferencia: totales.diferencia,
          },
          porPlanilla: result.porPlanilla.slice(0, MAX_LIST).map((row) => ({
            noCia: row.noCia,
            empresa: row.companyLabel,
            codPla: row.codPla,
            planilla: row.nominaNombre,
            empleados: row.empleados,
            liquido: row.liquido,
            CK: row.cheque,
            DAV: row.davivienda,
            BN: row.bn,
            OTRO: row.otro,
          })),
          moneda: "CRC",
          fuente: "Revisión de planilla Alfa One (nómina NAF + forma de pago)",
        };
      },
    },
    {
      permission: { key: "empleadosNaf.list", level: "view" },
      definition: toolDef(
        "search_naf_employees",
        "Busca empleados en el directorio NAF por nombre, cédula, código de empleado o correo.",
        {
          type: "object",
          properties: {
            q: { type: "string", description: "Texto a buscar." },
            noCia: { type: "string", description: "Filtrar por empresa NAF (opcional)." },
            limit: { type: "integer", description: "Máximo resultados (default 15)." },
          },
          required: ["q"],
          additionalProperties: false,
        },
      ),
      describeCall: (args) => {
        const q = strArg(args ?? {}, "q");
        return q ? `Buscando empleados NAF «${q.slice(0, 40)}»…` : "Buscando empleados NAF…";
      },
      handler: async (_session, args) => {
        const q = strArg(args, "q");
        if (!q) return { error: "Indique texto de búsqueda." };
        const limit = intArg(args, "limit", 15, MAX_LIST);
        const result = await listNafEmployees({
          q,
          noCia: strArg(args, "noCia") || undefined,
          pageSize: limit,
        });
        return {
          empleados: result.rows.slice(0, limit).map((e) => ({
            noCia: e.noCia,
            noEmple: e.noEmple,
            nombre: e.nombre,
            cedula: e.cedula,
            estado: e.estado,
            correo: e.correoElectronico,
          })),
          total: result.total,
          fuente: "Directorio NAF Alfa One",
        };
      },
    },
  ];
}
