import { redirect } from "next/navigation";

/** La bandeja unificada sustituye la pantalla de solo aprobaciones. */
export default function SigAprobacionesRedirectPage() {
  redirect("/sig/bandeja");
}
