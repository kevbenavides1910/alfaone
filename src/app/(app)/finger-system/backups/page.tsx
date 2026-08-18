"use client";

import { FingerBackupsPanel } from "@/components/finger-system/FingerBackupsPanel";

export default function FingerBackupsPage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Backups</h1>
        <p className="mt-1 text-sm text-slate-600">
          Respaldos manuales de ATT2016.MDB antes de cambios en producción.
        </p>
      </div>
      <FingerBackupsPanel />
    </div>
  );
}
