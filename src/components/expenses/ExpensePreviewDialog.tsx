"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { formatCurrency, formatMonthYear, formatDate } from "@/lib/utils/format";
import { companyDisplayName } from "@/lib/utils/constants";
import { DeferredContractSelector, type DeferredContractDraft, type DeferredSelectorContract } from "@/components/expenses/DeferredContractSelector";
import type { UseMutationResult } from "@tanstack/react-query";
import {
  type Expense, type Distribution, type ExpenseDetailDto, type PreviewableAttachment,
  type Contract,
  isPreviewable, formatSequentialNo,
} from "@/app/(app)/(gastos)/expenses/expenses-types";

interface Company { code: string; name: string; isActive: boolean }
interface ExpensePreviewDialogProps {
  previewExpense: Expense | null;
  setPreviewExpense: (v: Expense | null) => void;
  previewData: { data: Distribution[] } | undefined;
  previewDetail: ExpenseDetailDto | undefined;
  previewLoading: boolean;
  distributionDraft: DeferredContractDraft;
  setDistributionDraft: (v: DeferredContractDraft) => void;
  saveDeferredTargetsMutation: UseMutationResult<any, Error, { id: string; contractIds: string[] }, unknown>;
  setPreviewAttachment: (v: PreviewableAttachment | null) => void;
  refetchPreviewDetail: () => void;
  canEdit: boolean;
  companyRows: Company[];
  deferredAssignableContracts: DeferredSelectorContract[];
  deferredAssignableIds: string[];
  approvalBadge: (e: Expense) => React.ReactNode;
  qc: any;
}

export function ExpensePreviewDialog({
  previewExpense,
  setPreviewExpense,
  previewData,
  previewDetail,
  previewLoading,
  distributionDraft,
  setDistributionDraft,
  saveDeferredTargetsMutation,
  setPreviewAttachment,
  refetchPreviewDetail,
  canEdit,
  companyRows,
  deferredAssignableContracts,
  deferredAssignableIds,
  approvalBadge,
  qc,
}: ExpensePreviewDialogProps) {
  return (
      <Dialog open={!!previewExpense} onOpenChange={v => { if (!v) setPreviewExpense(null); }}>
        <DialogContent className="max-w-2xl max-h-[min(90vh,900px)] flex flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <div className="px-6 pt-6 pb-4 shrink-0">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span>
                  {previewExpense?.isDeferred ? "Gasto diferido — reparto y detalle" : "Detalle del gasto"}
                </span>
                {previewExpense?.sequentialNo != null && (
                  <span className="text-xs font-mono text-slate-500 font-normal">
                    {formatSequentialNo(previewExpense.sequentialNo)}
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>
          </div>

          {previewExpense && (
            <div className="flex-1 min-h-0 overflow-y-auto px-6 space-y-4 pb-4">
              <div className="bg-muted/50 rounded-lg p-4 grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-slate-500">Descripción:</span> <span className="font-medium ml-1">{previewExpense.description}</span></div>
                <div><span className="text-slate-500">Monto:</span> <span className="font-semibold ml-1">{formatCurrency(previewExpense.amount)}</span></div>
                <div><span className="text-slate-500">Empresa:</span> <span className="font-medium ml-1">{previewExpense.company ? companyDisplayName(previewExpense.company, companyRows) : "—"}</span></div>
                <div><span className="text-slate-500">Período:</span> <span className="font-medium ml-1">{formatMonthYear(previewExpense.periodMonth)}</span></div>
                <div><span className="text-slate-500">Fecha de pago:</span> <span className="font-medium ml-1">{formatDate(previewExpense.paymentDate ?? previewExpense.createdAt)}</span></div>
                <div className="col-span-2">{approvalBadge(previewExpense)}</div>
              </div>

              {previewExpense.isDeferred &&
                (previewExpense.approvalStatus ?? "APPROVED") !== "APPROVED" &&
                (previewExpense.approvalStatus ?? "APPROVED") !== "REJECTED" && (
                  <div className="rounded-md border border-slate-200 bg-slate-50 text-slate-900 text-sm p-3">
                    Este gasto ya impacta el presupuesto según el reparto indicado. Los aprobadores pueden ver el efecto antes de confirmar. Si alguien rechaza el gasto, el impacto se revierte.
                  </div>
                )}

              {previewDetail?.registroCxp || previewDetail?.registroTr ? (
                <div className="rounded-lg border p-3 text-sm space-y-1 bg-card">
                  <p className="font-medium text-slate-800">Registros</p>
                  {previewDetail.registroCxp && (
                    <div>
                      <span className="text-slate-500">Registro 1 CXP:</span> {previewDetail.registroCxp}
                    </div>
                  )}
                  {previewDetail.registroTr && (
                    <div>
                      <span className="text-slate-500">Registro 2 TR:</span> {previewDetail.registroTr}
                    </div>
                  )}
                </div>
              ) : null}

              {previewDetail && previewDetail.approvals.length > 0 && (
                <div className="rounded-lg border p-3 text-sm bg-card">
                  <p className="font-medium text-slate-800 mb-2">Aprobaciones</p>
                  <ul className="space-y-1 text-xs text-slate-700">
                    {previewDetail.approvals.map((a) => (
                      <li key={a.id}>
                        Paso {a.stepOrder} · {a.approver.name} · {a.decision === "APPROVED" ? "Aprobado" : "Rechazado"}
                        {a.comment ? ` — ${a.comment}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-lg border p-3 text-sm space-y-2 bg-card">
                <p className="font-medium text-slate-800">Documentación</p>
                {previewDetail?.attachments?.length ? (
                  <ul className="text-xs space-y-1">
                    {previewDetail.attachments.map((att) => {
                      const canPreview = isPreviewable(att.mimeType, att.fileName);
                      return (
                        <li key={att.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          {canPreview ? (
                            <button
                              type="button"
                              className="text-red-600 hover:underline text-left"
                              onClick={() =>
                                setPreviewAttachment({
                                  id: att.id,
                                  fileName: att.fileName,
                                  mimeType: att.mimeType,
                                  downloadUrl: att.downloadUrl,
                                })
                              }
                              title="Previsualizar"
                            >
                              {att.fileName}
                            </button>
                          ) : (
                            <a
                              href={att.downloadUrl}
                              className="text-red-600 hover:underline"
                              target="_blank"
                              rel="noreferrer"
                            >
                              {att.fileName}
                            </a>
                          )}
                          {canPreview && (
                            <a
                              href={att.downloadUrl}
                              className="text-[11px] text-slate-500 hover:text-slate-700 hover:underline"
                              target="_blank"
                              rel="noreferrer"
                              title="Descargar"
                            >
                              descargar
                            </a>
                          )}
                          <span className="text-slate-400">· {att.uploadedBy.name}</span>
                          {att.note ? <span className="text-slate-500">— {att.note}</span> : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500">Sin archivos adjuntos.</p>
                )}
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.xlsx,.xls,.csv"
                  className="text-xs w-full"
                  onChange={async (ev) => {
                    const f = ev.target.files?.[0];
                    if (!f) return;
                    const fd = new FormData();
                    fd.set("file", f);
                    const r = await fetch(`/api/expenses/${previewExpense.id}/attachments`, {
                      method: "POST",
                      body: fd,
                      credentials: "same-origin",
                    });
                    const j = (await r.json()) as { error?: { message?: string } };
                    if (!r.ok) {
                      toast.error(j.error?.message ?? "Error al subir");
                    } else {
                      toast.success("Archivo adjuntado");
                      refetchPreviewDetail();
                      qc.invalidateQueries({ queryKey: ["expenses"] });
                    }
                    ev.target.value = "";
                  }}
                />
              </div>

              {previewExpense.isDeferred && (previewExpense.approvalStatus ?? "APPROVED") !== "REJECTED" && (
                <>
                  {!previewExpense.deferredManualDistribution ? (
                    <div className="rounded-lg border bg-card p-3 text-sm space-y-2">
                      <p className="font-medium text-slate-800">Contratos incluidos en el reparto</p>
                      <p className="text-xs text-slate-500">
                        Solo los marcados reciben el gasto. Los porcentajes suman 100 % entre los seleccionados (peso = presupuesto de insumos de cada contrato).
                      </p>
                      <DeferredContractSelector
                        contracts={deferredAssignableContracts}
                        allIds={deferredAssignableIds}
                        draft={distributionDraft}
                        onChange={setDistributionDraft}
                        companyRows={companyRows}
                        listClassName="max-h-40 overflow-y-auto space-y-2 rounded-md border p-2 bg-muted/50/80"
                      />
                    </div>
                  ) : (
                    <div className="rounded-lg border border-violet-200 bg-violet-50/90 p-3 text-sm text-violet-950">
                      <p className="font-medium">Reparto manual (montos fijos)</p>
                      <p className="text-xs mt-1 opacity-90">
                        Este gasto se distribuyó con montos definidos manualmente por contrato. Para modificar el reparto hay que actualizar el gasto con permisos completos (no desde esta vista).
                      </p>
                    </div>
                  )}
                  {previewLoading ? (
                    <div className="text-center py-6 text-slate-400">Calculando distribución...</div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <p className="text-xs text-slate-500 px-3 py-2 bg-muted/50 border-b">
                        {previewExpense.deferredManualDistribution
                          ? "Montos asignados por contrato (reparto manual)."
                          : "Vista del reparto (según selección arriba; guarde para aplicar cambios al presupuesto)"}
                      </p>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50 border-b">
                            <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Contrato</th>
                            <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Empresa</th>
                            <th className="text-right px-4 py-2.5 font-semibold text-slate-600">Equiv. %</th>
                            <th className="text-right px-4 py-2.5 font-semibold text-slate-600">Monto asignado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {(previewData?.data ?? []).map((d) => (
                            <tr key={d.contractId} className="hover:bg-muted/50">
                              <td className="px-4 py-2.5">
                                <div className="font-medium">{d.client}</div>
                                <div className="text-xs text-slate-400">{d.licitacionNo}</div>
                              </td>
                              <td className="px-4 py-2.5 text-slate-500 text-sm">
                                {companyDisplayName(d.company, companyRows)}
                              </td>
                              <td className="px-4 py-2.5 text-right text-slate-600">
                                {(d.equivalencePct * 100).toFixed(2)}%
                              </td>
                              <td className="px-4 py-2.5 text-right font-semibold">
                                {formatCurrency(d.allocatedAmount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t bg-muted/50">
                            <td colSpan={2} className="px-4 py-2.5 font-semibold text-slate-700">Total</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-slate-600">
                              {((previewData?.data ?? []).reduce((s, d) => s + d.equivalencePct, 0) * 100).toFixed(2)}%
                            </td>
                            <td className="px-4 py-2.5 text-right font-bold text-slate-900">
                              {formatCurrency((previewData?.data ?? []).reduce((s, d) => s + d.allocatedAmount, 0))}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="shrink-0 border-t bg-background px-6 py-4">
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setPreviewExpense(null)}>Cerrar</Button>
              {canEdit &&
                previewExpense &&
                previewExpense.isDeferred &&
                !previewExpense.deferredManualDistribution &&
                (previewExpense.approvalStatus ?? "APPROVED") !== "REJECTED" && (
                  <Button
                    onClick={() => {
                      if (distributionDraft !== "all" && distributionDraft.length === 0) {
                        toast.error("Seleccione al menos un contrato para el reparto");
                        return;
                      }
                      const ids = distributionDraft === "all" ? [] : distributionDraft;
                      saveDeferredTargetsMutation.mutate({
                        id: previewExpense.id,
                        contractIds: ids,
                      });
                    }}
                    disabled={
                      saveDeferredTargetsMutation.isPending ||
                      previewLoading ||
                      (distributionDraft !== "all" && distributionDraft.length === 0)
                    }
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {saveDeferredTargetsMutation.isPending ? "Guardando…" : "Guardar reparto"}
                  </Button>
                )}
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
  );
}
