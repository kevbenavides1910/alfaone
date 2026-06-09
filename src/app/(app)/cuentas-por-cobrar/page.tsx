import { redirect } from "next/navigation";

export default function LegacyCuentasPorCobrarRedirect() {
  redirect("/facturacion/cuentas-por-cobrar");
}
