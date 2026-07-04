"use client";

import { useParams } from "next/navigation";
import { FeNotaForm } from "@/components/facturacion-electronica/FeNotaForm";

export default function NotaCreditoPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <FeNotaForm
      documentoId={id}
      referenciaTipo="FACTURA_VENTA"
      backHref={`/facturacion-electronica/${id}`}
      tipo="credito"
      titulo="Nota de crédito"
    />
  );
}
