import { redirect } from "next/navigation";

/** Compatibilidad: /bandeco/pilas → /monitoreo/pilas */
export default function BandecoCompatRedirect() {
  redirect("/monitoreo/pilas");
}
