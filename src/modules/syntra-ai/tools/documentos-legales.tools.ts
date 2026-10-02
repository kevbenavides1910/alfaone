import {
  getLegalCalendarMonth,
  listLegalDocumentReminders,
  searchLegalDocuments,
} from "@/modules/documentos-legales/services/documents";
import { todayCostaRica } from "@/modules/documentos-legales/business/dates";
import { formatReminderOffset } from "@/modules/documentos-legales/business/reminders";
import type { SyntraTool } from "./types";
import { toolDef } from "./types";
import { currentYearMonth, strArg } from "./shared";

const MAX_LIST = 40;

function companyArg(args: Record<string, unknown>): string[] | undefined {
  const company = strArg(args, "company");
  return company ? [company] : undefined;
}

export function documentosLegalesTools(): SyntraTool[] {
  return [
    {
      permission: { key: "documentosLegales.calendario", level: "view" },
      definition: toolDef(
        "query_legal_document_calendar",
        "Calendario de Control de Documentos Legales del mes: garantías, personerías, certificaciones, licencias, permisos, frecuencias, cédulas, patentes, constancias y pólizas, con totales pagado y pendiente.",
        {
          type: "object",
          properties: {
            month: { type: "string", description: "Mes YYYY-MM (default: mes actual)." },
            company: { type: "string", description: "Código de empresa (opcional)." },
          },
          additionalProperties: false,
        },
      ),
      describeCall: (args) => {
        const month = strArg(args ?? {}, "month") || currentYearMonth().month;
        return `Consultando documentos legales de ${month}…`;
      },
      handler: async (_session, args) => {
        const month = strArg(args, "month") || currentYearMonth().month;
        if (!/^\d{4}-\d{2}$/.test(month)) return { error: "El mes debe tener formato YYYY-MM." };
        const calendar = await getLegalCalendarMonth(month, companyArg(args));
        const withDocs = calendar.days.filter((day) => day.documents.length > 0);
        return {
          month,
          resumen: {
            diasConDocumentos: withDocs.length,
            documentos: calendar.documents.length,
            ...calendar.totals,
          },
          dias: withDocs.slice(0, 31).map((day) => ({
            fecha: day.date,
            documentos: day.documents.length,
            total: day.total,
            pagado: day.totalPaid,
          })),
          moneda: "CRC",
          fuente: "Control de Documentos Legales Alfa One",
        };
      },
    },
    {
      permission: { key: "documentosLegales.calendario", level: "view" },
      definition: toolDef(
        "search_legal_documents",
        "Busca obligaciones de documentos legales por descripción, referencia, empresa o notas. Puede filtrar por mes, tipo y si está pagado.",
        {
          type: "object",
          properties: {
            q: { type: "string", description: "Texto a buscar (opcional, mín. 2 caracteres si se envía)." },
            month: { type: "string", description: "Mes YYYY-MM (opcional)." },
            company: { type: "string", description: "Código de empresa (opcional)." },
            type: {
              type: "string",
              description: "GARANTIA, PERSONERIA, CERTIFICACION, LICENCIA, PERMISO, FRECUENCIA, CEDULA, PATENTE, CONSTANCIA o POLIZA.",
            },
            paid: { type: "boolean", description: "true solo pagados, false solo pendientes." },
          },
          additionalProperties: false,
        },
      ),
      describeCall: (args) => {
        const q = strArg(args ?? {}, "q");
        return q ? `Buscando documentos legales «${q}»…` : "Buscando documentos legales…";
      },
      handler: async (_session, args) => {
        const q = strArg(args, "q");
        if (q && q.length < 2) return { error: "Indicá al menos 2 caracteres para buscar." };
        const month = strArg(args, "month") || undefined;
        if (month && !/^\d{4}-\d{2}$/.test(month)) return { error: "El mes debe tener formato YYYY-MM." };
        const type = strArg(args, "type") || undefined;
        const paid = typeof args.paid === "boolean" ? args.paid : undefined;
        const rows = await searchLegalDocuments({
          q: q || undefined,
          month,
          company: companyArg(args),
          type,
          paid,
          take: MAX_LIST,
        });
        return {
          total: rows.length,
          documentos: rows.map((doc) => ({
            id: doc.id,
            tipo: doc.typeLabel,
            descripcion: doc.description,
            fecha: doc.dueDate,
            monto: doc.amount,
            empresa: doc.company,
            responsable: doc.responsibleName,
            pagado: doc.paid,
            recordatorios: doc.reminders.length,
          })),
          moneda: "CRC",
          fuente: "Control de Documentos Legales Alfa One",
        };
      },
    },
    {
      permission: { key: "documentosLegales.calendario", level: "view" },
      definition: toolDef(
        "list_legal_document_reminders",
        "Lista recordatorios pendientes de documentos legales no pagados, con fecha de envío y responsable.",
        {
          type: "object",
          properties: {
            company: { type: "string", description: "Código de empresa (opcional)." },
            hastaHoy: {
              type: "boolean",
              description: "Si es true, solo avisos cuya fecha de envío ya llegó.",
            },
          },
          additionalProperties: false,
        },
      ),
      describeCall: () => "Listando recordatorios de documentos legales…",
      handler: async (_session, args) => {
        const rows = await listLegalDocumentReminders({
          company: companyArg(args),
          dueThrough: args.hastaHoy === true ? todayCostaRica() : undefined,
          take: MAX_LIST,
        });
        return {
          total: rows.length,
          recordatorios: rows.map((row) => ({
            envio: row.sendOn,
            anticipacion: formatReminderOffset(row),
            documento: row.document.description,
            tipo: row.document.typeLabel,
            vencimiento: row.document.dueDate,
            responsable: row.document.responsibleName,
            correo: row.document.responsibleEmail,
            ultimoError: row.lastError,
          })),
          fuente: "Control de Documentos Legales Alfa One",
        };
      },
    },
  ];
}
