"use client";

import { useParams } from "next/navigation";
import { FeNotaForm } from "@/components/facturacion-electronica/FeNotaForm";

export default function NotaCreditoCompraPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <FeNotaForm
      documentoId={id}
      referenciaTipo="FACTURA_COMPRA"
      backHref="/facturacion-electronica/compra"
      tipo="credito"
      titulo="Nota de crédito sobre FEC"
    />
  );
}
