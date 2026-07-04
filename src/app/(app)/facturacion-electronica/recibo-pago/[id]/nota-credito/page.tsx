"use client";

import { useParams } from "next/navigation";
import { FeNotaForm } from "@/components/facturacion-electronica/FeNotaForm";

export default function NotaCreditoReciboPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <FeNotaForm
      documentoId={id}
      referenciaTipo="RECIBO_PAGO"
      backHref="/facturacion-electronica/recibo-pago"
      tipo="credito"
      titulo="Nota de crédito sobre REP"
    />
  );
}
