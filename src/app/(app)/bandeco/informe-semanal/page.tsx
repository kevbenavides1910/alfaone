import { redirect } from "next/navigation";

/** Compatibilidad: /bandeco/informe-semanal → /monitoreo/informe-semanal */
export default function BandecoCompatRedirect() {
  redirect("/monitoreo/informe-semanal");
}
