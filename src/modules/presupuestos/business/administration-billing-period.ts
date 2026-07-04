/** Periodo de facturación efectivo de una administración (null en admin → hereda del contrato). */
export function resolveAdministrationBillingPeriod(
  admin: { billingPeriodFromDay: number | null; billingPeriodToDay: number | null },
  contract: { billingPeriodFromDay: number; billingPeriodToDay: number }
): { fromDay: number; toDay: number } {
  return {
    fromDay: admin.billingPeriodFromDay ?? contract.billingPeriodFromDay,
    toDay: admin.billingPeriodToDay ?? contract.billingPeriodToDay,
  };
}

export function administrationUsesContractBillingPeriod(admin: {
  billingPeriodFromDay: number | null;
  billingPeriodToDay: number | null;
}): boolean {
  return admin.billingPeriodFromDay == null && admin.billingPeriodToDay == null;
}
