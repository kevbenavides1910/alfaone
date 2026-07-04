"use client";

import { useParams } from "next/navigation";
import { FeNotaForm } from "@/components/facturacion-electronica/FeNotaForm";

export default function NotaDebitoPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <FeNotaForm
      documentoId={id}
      referenciaTipo="FACTURA_VENTA"
      backHref={`/facturacion-electronica/${id}`}
      tipo="debito"
      titulo="Nota de débito"
    />
  );
}
