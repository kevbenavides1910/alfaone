import { redirect } from "next/navigation";

/** Compatibilidad: /bandeco/mantenimientos → /monitoreo/mantenimientos */
export default function BandecoCompatRedirect() {
  redirect("/monitoreo/mantenimientos");
}
