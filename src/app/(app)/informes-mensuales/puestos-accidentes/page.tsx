import { redirect } from "next/navigation";

/** El reporte de Puestos y Accidentes ahora vive dentro de la pantalla Incidencias. */
export default function PuestosAccidentesRedirectPage() {
  redirect("/informes-mensuales");
}
