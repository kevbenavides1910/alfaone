import { redirect } from "next/navigation";

/** Compatibilidad: /bandeco/activaciones → /monitoreo/activaciones */
export default function BandecoCompatRedirect() {
  redirect("/monitoreo/activaciones");
}
