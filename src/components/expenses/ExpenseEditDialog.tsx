"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ExpenseOcPicker } from "@/components/expenses/ExpenseOcPicker";
import { companyDisplayName, EXPENSE_BUDGET_LINES, EXPENSE_BUDGET_LINE_LABELS } from "@/lib/utils/constants";
import type { UseMutationResult } from "@tanstack/react-query";
import type { ExpenseBudgetLine, ExpenseType } from "@prisma/client";
import { EXPENSE_TYPES, type Expense, type ExpenseOrigin } from "@/app/(app)/(gastos)/expenses/expenses-types";

interface Company { code: string; name: string; isActive: boolean }

interface ExpenseEditDialogProps {
  editExpense: Expense | null;
  editForm: {
    type: ExpenseType;
    budgetLine: ExpenseBudgetLine;
    periodMonth: string;
    paymentDate: string;
    company: string;
    description: string;
    originId: string;
    referenceNumber: string;
    nafOcNoCia: string;
    nafOcNoOrden: string;
    nafOcNoDocu: string;
    notes: string;
    registroCxp: string;
    registroTr: string;
  };
  setEditForm: React.Dispatch<React.SetStateAction<ExpenseEditDialogProps["editForm"]>>;
  setEditExpense: (v: Expense | null) => void;
  handleSaveEdit: () => void;
  updateMutation: UseMutationResult<any, Error, any, unknown>;
  activeCompanies: Company[];
  originsData: { data: ExpenseOrigin[] } | undefined;
}

export function ExpenseEditDialog({
  editExpense,
  editForm,
  setEditForm,
  setEditExpense,
  handleSaveEdit,
  updateMutation,
  activeCompanies,
  originsData,
}: ExpenseEditDialogProps) {
  return (
      <Dialog open={!!editExpense} onOpenChange={(v) => { if (!v) setEditExpense(null); }}>
        <DialogContent className="max-w-lg max-h-[min(92vh,880px)] flex flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <div className="shrink-0 px-6 pt-6 pb-2 pr-12">
            <DialogHeader>
              <DialogTitle>Editar gasto</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-slate-500 mt-2">
              Corrija el tipo, la partida, la empresa, la descripción, el origen o la referencia si se registraron mal.
              {editExpense?.isDistributed ? " Este gasto ya está distribuido; solo se actualizan estos datos de clasificación." : ""}
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-2">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Partida</label>
                <Select
                  value={editForm.budgetLine}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, budgetLine: v as ExpenseBudgetLine }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_BUDGET_LINES.map((bl) => (
                      <SelectItem key={bl} value={bl}>{EXPENSE_BUDGET_LINE_LABELS[bl]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Empresa</label>
                <Select
                  value={editForm.company || "none"}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, company: v === "none" ? "" : v }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sin especificar —</SelectItem>
                    {activeCompanies.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Período</label>
              <Input
                type="month"
                value={editForm.periodMonth}
                onChange={(e) => setEditForm((f) => ({ ...f, periodMonth: e.target.value }))}
              />
              <p className="text-xs text-slate-400">Mes contable al que se imputa este gasto.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Fecha de pago (opcional)</label>
              <Input
                type="date"
                value={editForm.paymentDate}
                onChange={(e) => setEditForm((f) => ({ ...f, paymentDate: e.target.value }))}
              />
              <p className="text-xs text-slate-400">
                La programación en calendario se hace en Pagos → Pago proveedores.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Tipo de gasto</label>
              <Select value={editForm.type} onValueChange={(v) => setEditForm((f) => ({ ...f, type: v as ExpenseType }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mr-2 ${t.color}`}>{t.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Origen</label>
                <Select value={editForm.originId || "none"} onValueChange={(v) => setEditForm((f) => ({ ...f, originId: v === "none" ? "" : v }))}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Origen..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sin especificar —</SelectItem>
                    {(originsData?.data ?? []).filter((o) => o.isActive).map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">N° OC (Codisa)</label>
                <ExpenseOcPicker
                  value={editForm.referenceNumber}
                  company={editForm.company || undefined}
                  linkedNoCia={editForm.nafOcNoCia || undefined}
                  onChange={(noOrden, row) => {
                    setEditForm((f) => {
                      if (!row) {
                        return {
                          ...f,
                          referenceNumber: noOrden,
                          nafOcNoCia: "",
                          nafOcNoOrden: "",
                          nafOcNoDocu: "",
                        };
                      }
                      return {
                        ...f,
                        referenceNumber: noOrden,
                        nafOcNoCia: row.noCia,
                        nafOcNoOrden: row.noOrden,
                        nafOcNoDocu: row.noDocu ?? "",
                        company: row.companyCode || f.company,
                        description:
                          row.observaciones && !f.description.trim()
                            ? row.observaciones.slice(0, 200)
                            : f.description,
                      };
                    });
                  }}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Descripción</label>
              <Input
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Registro 1 CXP</label>
                <Input
                  value={editForm.registroCxp}
                  onChange={(e) => setEditForm((f) => ({ ...f, registroCxp: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Registro 2 TR</label>
                <Input
                  value={editForm.registroTr}
                  onChange={(e) => setEditForm((f) => ({ ...f, registroTr: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Notas (opcional)</label>
              <Input
                placeholder="Detalles adicionales..."
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          </div>
          <div className="shrink-0 border-t border-slate-200 bg-background px-6 py-4">
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setEditExpense(null)}>Cancelar</Button>
              <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Guardando..." : "Guardar cambios"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
  );
}
