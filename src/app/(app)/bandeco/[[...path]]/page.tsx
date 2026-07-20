import { redirect } from "next/navigation";

type Props = { params: Promise<{ path?: string[] }> };

/** Compatibilidad: /bandeco/* → /monitoreo/* */
export default async function BandecoCatchAllRedirect({ params }: Props) {
  const { path } = await params;
  const suffix = path?.length ? `/${path.join("/")}` : "";
  redirect(`/monitoreo${suffix}`);
}
