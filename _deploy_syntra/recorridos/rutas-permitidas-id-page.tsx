"use client";

import Link from "next/link";
import { use } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoutePhonesPanel } from "@/components/recorridos/RoutePhonesPanel";

export default function RutasPermitidasDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto w-full space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/recorridos/rutas-permitidas">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a rutas permitidas
        </Link>
      </Button>
      <RoutePhonesPanel routeId={id} />
    </div>
  );
}
