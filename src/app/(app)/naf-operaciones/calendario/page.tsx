import { Suspense } from "react";
import { CalendarioOperativoClient } from "@/components/naf-operaciones/calendario/CalendarioOperativoClient";

export default function CalendarioOperativoPage() {
  return (
    <Suspense fallback={null}>
      <CalendarioOperativoClient />
    </Suspense>
  );
}
