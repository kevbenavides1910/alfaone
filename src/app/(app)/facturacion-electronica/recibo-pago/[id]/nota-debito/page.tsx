"use client";

import { useParams } from "next/navigation";
import { FeNotaForm } from "@/components/facturacion-electronica/FeNotaForm";

export default function NotaDebitoReciboPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <FeNotaForm
      documentoId={id}
      referenciaTipo="RECIBO_PAGO"
      backHref="/facturacion-electronica/recibo-pago"
      tipo="debito"
      titulo="Nota de débito sobre REP"
    />
  );
}
