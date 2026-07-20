import { redirect } from "next/navigation";

/** Compatibilidad: /bandeco/eventos → /monitoreo/eventos */
export default function BandecoCompatRedirect() {
  redirect("/monitoreo/eventos");
}
