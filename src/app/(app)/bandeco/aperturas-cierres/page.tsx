import { redirect } from "next/navigation";

/** Compatibilidad: /bandeco/aperturas-cierres → /monitoreo/aperturas-cierres */
export default function BandecoCompatRedirect() {
  redirect("/monitoreo/aperturas-cierres");
}
