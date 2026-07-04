"use client";

import { useParams } from "next/navigation";
import { FeNotaForm } from "@/components/facturacion-electronica/FeNotaForm";

export default function NotaDebitoCompraPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <FeNotaForm
      documentoId={id}
      referenciaTipo="FACTURA_COMPRA"
      backHref="/facturacion-electronica/compra"
      tipo="debito"
      titulo="Nota de débito sobre FEC"
    />
  );
}
