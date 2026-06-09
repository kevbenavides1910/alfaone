import { buildBrandingIconResponse } from "@/modules/plataforma/services/app-branding";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const size = { width: 32, height: 32 };

export default async function Icon() {
  return buildBrandingIconResponse(32);
}
