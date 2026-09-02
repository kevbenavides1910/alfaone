/**
 * Tipos, constantes y utilidades puras del módulo de Gastos.
 * Sin dependencias React ni JSX — importable desde server y client components.
 */
import type { ExpenseApprovalStatus, ExpenseBudgetLine, ExpenseType } from "@prisma/client";
import { EXPENSE_BUDGET_LINE_LABELS } from "@/lib/utils/constants";

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface Contract {
  id: string; licitacionNo: string; client: string; company: string;
  status: string; endDate: string;
}

export interface Distribution {
  contractId: string; licitacionNo: string; client: string; company: string;
  equivalencePct: number; allocatedAmount: number;
  suppliesBudget?: number;
}

export interface ExpenseOrigin { id: string; name: string; isActive: boolean; sortOrder: number; }

export type ExpenseDetailDto = {
  id: string;
  deferredManualDistribution?: boolean;
  deferredIncludeContractIds?: string[];
  registroCxp?: string | null;
  registroTr?: string | null;
  approvals: Array<{
    id: string; stepOrder: number; decision: string; comment: string | null;
    decidedAt: string; approver: { name: string };
  }>;
  attachments: Array<{
    id: string; fileName: string; mimeType: string; downloadUrl: string;
    createdAt: string; uploadedBy: { name: string }; note: string | null;
  }>;
};

export type PreviewableAttachment = {
  id: string; fileName: string; mimeType: string; downloadUrl: string;
};

export type ExpenseDistributionFilter = "all" | "single_contract" | "multi_month" | "deferred";

export interface Expense {
  id: string; sequentialNo?: number | null; type: ExpenseType; budgetLine?: ExpenseBudgetLine | null;
  description: string; amount: number;
  periodMonth: string; paymentDate?: string | null; isDeferred: boolean; isDistributed: boolean;
  deferredManualDistribution?: boolean;
  deferredIncludeContractIds?: string[];
  contractId?: string; positionId?: string; originId?: string;   referenceNumber?: string;
  nafOcNoCia?: string | null;
  nafOcNoOrden?: string | null;
  nafOcNoDocu?: string | null;
  nafOcLinkedAt?: string | null;
  company?: string; notes?: string; createdAt: string;
  approvalStatus?: ExpenseApprovalStatus;
  currentApprovalStep?: number | null;
  requiredApprovalSteps?: number;
  registroCxp?: string | null; registroTr?: string | null;
  contract?: { id: string; licitacionNo: string; client: string; company: string } | null;
  position?: { id: string; name: string; location?: { name: string } | null } | null;
  origin?: { id: string; name: string } | null;
  createdBy?: { name: string };
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const EXPENSE_TYPES: { value: ExpenseType; label: string; color: string }[] = [
  { value: "APERTURA",  label: "Apertura",       color: "bg-slate-100 text-slate-700" },
  { value: "UNIFORMS",  label: "Uniformes",       color: "bg-purple-100 text-purple-800" },
  { value: "AUDIT",     label: "Auditoría",       color: "bg-orange-100 text-orange-800" },
  { value: "ADMIN",     label: "Administrativo",  color: "bg-slate-100 text-slate-700" },
  { value: "TRANSPORT", label: "Transporte",      color: "bg-cyan-100 text-cyan-800" },
  { value: "FUEL",      label: "Combustible",     color: "bg-yellow-100 text-yellow-800" },
  { value: "PHONES",    label: "Teléfonos",       color: "bg-green-100 text-green-800" },
  { value: "PLANILLA",  label: "Planilla",        color: "bg-emerald-100 text-emerald-800" },
  { value: "OTHER",     label: "Otros",           color: "bg-gray-100 text-gray-700" },
];

export const PRORRATEO_DESC_RE = /\(\s*mes\s+\d+\s*\/\s*\d+\s*\)\s*$/i;
export const DEFAULT_EXPENSE_LIST_URL = "/api/expenses?pageSize=200";
export const ATTACH_ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.gif,.xlsx,.xls,.csv";
export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

// ── Pure helpers ──────────────────────────────────────────────────────────────

export function isAssignableContractForExpense(c: Contract): boolean {
  if (c.status === "ACTIVE" || c.status === "PROLONGATION" || c.status === "SUSPENDED") return true;
  if (c.status === "FINISHED" && c.endDate) {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 6);
    return new Date(c.endDate) >= cutoff;
  }
  return false;
}

export function filterAssignableContractsByQuery(contracts: Contract[], query: string, limit = 20): Contract[] {
  const q = query.trim().toLowerCase();
  if (!q) return contracts.slice(0, limit);
  return contracts
    .filter(c => c.licitacionNo.toLowerCase().includes(q) || c.client.toLowerCase().includes(q) || c.company.toLowerCase().includes(q))
    .slice(0, limit);
}

export function isPdf(mime: string | undefined, fileName: string) {
  if (mime && mime.toLowerCase() === "application/pdf") return true;
  return fileName.toLowerCase().endsWith(".pdf");
}

export function isImage(mime: string | undefined, fileName: string) {
  if (mime && mime.toLowerCase().startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(fileName);
}

export function isPreviewable(mime: string | undefined, fileName: string) {
  return isPdf(mime, fileName) || isImage(mime, fileName);
}

export function expenseDistributionKind(e: Expense): Exclude<ExpenseDistributionFilter, "all"> {
  if (e.isDeferred) return "deferred";
  if (PRORRATEO_DESC_RE.test((e.description ?? "").trim())) return "multi_month";
  return "single_contract";
}

export function typeInfo(t: ExpenseType) {
  return EXPENSE_TYPES.find(e => e.value === t) ?? EXPENSE_TYPES[EXPENSE_TYPES.length - 1];
}

export function budgetLineLabel(b: ExpenseBudgetLine | null | undefined) {
  if (!b) return "—";
  return EXPENSE_BUDGET_LINE_LABELS[b];
}

export function formatSequentialNo(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `#${String(n).padStart(5, "0")}`;
}

export function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function uploadExpenseAttachments(expenseIds: string[], files: File[]): Promise<void> {
  if (files.length === 0 || expenseIds.length === 0) return;
  const targets = expenseIds.length > 1 ? [expenseIds[0]!] : expenseIds;
  for (const expenseId of targets) {
    for (const file of files) {
      if (file.size > MAX_ATTACHMENT_BYTES)
        throw new Error(`«${file.name}» supera el máximo de 15 MB`);
      const fd = new FormData();
      fd.set("file", file);
      const r = await fetch(`/api/expenses/${expenseId}/attachments`, { method: "POST", body: fd, credentials: "same-origin" });
      const j = (await r.json()) as { error?: { message?: string } };
      if (!r.ok) throw new Error(j.error?.message ?? `No se pudo subir «${file.name}»`);
    }
  }
}
