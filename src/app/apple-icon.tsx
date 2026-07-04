import { buildBrandingIconResponse } from "@/modules/plataforma/services/app-branding";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const size = { width: 180, height: 180 };

export default async function AppleIcon() {
  return buildBrandingIconResponse(180);
}
