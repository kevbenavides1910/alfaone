"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { ContractsPageHeader } from "@/components/contracts/ContractsPageHeader";
import { ContractForm } from "@/components/contracts/ContractForm";

export default function EditContractPage() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ["contract", id],
    queryFn: () => fetch(`/api/contracts/${id}`).then((r) => r.json()),
  });

  const contract = data?.data;

  return (
    <>
      <Topbar title="Editar contrato" />
      <ContractsPageHeader
        title={contract ? `Editar ${contract.licitacionNo}` : "Editar contrato"}
        description="Actualice la información general y parámetros de presupuesto."
        breadcrumbs={[
          { label: "Contratos", href: "/contracts" },
          ...(contract
            ? [{ label: contract.licitacionNo, href: `/contracts/${id}` }]
            : []),
          { label: "Editar" },
        ]}
      />
      <div className="carbon-form-panel">
        {!isLoading && contract && (
          <ContractForm
            mode="edit"
            defaultValues={{
              ...contract,
              monthlyBilling: contract.baseMonthlyBilling ?? contract.monthlyBilling,
              id,
            }}
          />
        )}
        {isLoading && <p className="text-sm text-[#525252]">Cargando contrato…</p>}
      </div>
    </>
  );
}
