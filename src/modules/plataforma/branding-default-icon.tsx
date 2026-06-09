import { ImageResponse } from "next/og";
import { APP_NAME } from "@/modules/plataforma/branding-constants";

export function buildDefaultBrandingIcon(primaryHex: string, size: number) {
  const letter = APP_NAME.trim().charAt(0).toUpperCase() || "A";
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: primaryHex,
          color: "#ffffff",
          fontSize: Math.round(size * 0.55),
          fontWeight: 700,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {letter}
      </div>
    ),
    { width: size, height: size }
  );
}
