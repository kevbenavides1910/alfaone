import { redirect } from "next/navigation";

/** Compatibilidad: /bandeco → /monitoreo */
export default function BandecoCompatRedirect() {
  redirect("/monitoreo");
}
