import { Topbar } from "@/components/layout/Topbar";
import { ContractsPageHeader } from "@/components/contracts/ContractsPageHeader";
import { ContractForm } from "@/components/contracts/ContractForm";

export default function NewContractPage() {
  return (
    <>
      <Topbar title="Nuevo contrato" />
      <ContractsPageHeader
        title="Registrar nuevo contrato"
        description="Complete los datos del contrato, presupuesto y distribución de partidas."
        breadcrumbs={[
          { label: "Contratos", href: "/contracts" },
          { label: "Nuevo" },
        ]}
      />
      <div className="carbon-form-panel">
        <ContractForm mode="create" />
      </div>
    </>
  );
}
