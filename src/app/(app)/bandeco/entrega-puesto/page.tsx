import { redirect } from "next/navigation";

/** Compatibilidad: /bandeco/entrega-puesto → /monitoreo/entrega-puesto */
export default function BandecoCompatRedirect() {
  redirect("/monitoreo/entrega-puesto");
}
