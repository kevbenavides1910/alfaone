import { redirect } from "next/navigation";

/** Compatibilidad: /bandeco/registro → /monitoreo/registro */
export default function BandecoCompatRedirect() {
  redirect("/monitoreo/registro");
}
