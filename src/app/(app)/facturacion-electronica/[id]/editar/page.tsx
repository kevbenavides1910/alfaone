"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function EditarFacturaRedirectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    if (id) router.replace(`/facturacion-electronica/nueva?editId=${encodeURIComponent(id)}`);
  }, [id, router]);

  return <p className="text-sm text-muted-foreground">Abriendo editor de factura…</p>;
}
