import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Content-Security-Policy",
    value:
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com; font-src 'self' data:; connect-src 'self'; frame-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  },
];

/** PDFs inline del expediente: deben poder embeberse en iframe same-origin. */
const pdfEmbedHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Content-Security-Policy",
    value: "default-src 'none'; frame-ancestors 'self'",
  },
];

const nextConfig: NextConfig = {
  /** Requerido para Docker (multi-stage) — genera .next/standalone */
  output: "standalone",
  serverExternalPackages: [
    "@prisma/client",
    "pdf-parse",
    "mammoth",
    "pdfjs-dist",
    "@napi-rs/canvas",
    "oracledb",
    // Firma XAdES (createRequire nativo; deben resolverse fuera del bundle)
    "xadesjs",
    "xmldsigjs",
    "xpath",
    "@xmldom/xmldom",
    "xml-core",
    "tslib",
  ],
  async headers() {
    return [
      // Next fusiona TODAS las reglas que coinciden: hay que excluir el PDF del DENY global.
      { source: "/api/expediente-digital/:cedula/file", headers: pdfEmbedHeaders },
      { source: "/api/empleados/contratos/photorec/file", headers: pdfEmbedHeaders },
      {
        source:
          "/:path((?!api/expediente-digital/.+/file$)(?!api/empleados/contratos/photorec/file$).*)*",
        headers: securityHeaders,
      },
    ];
  },
  // Lint ya corre en CI (`npm run lint`); no duplicar ~60s en cada docker build.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Typecheck en `npm run build` local / CI. En imagen Docker (DOCKER_BUILD=1) se omite
  // (~60s) — el gate de tipos sigue en CI y en `npm run typecheck`.
  typescript: {
    ignoreDuringBuilds: process.env.DOCKER_BUILD === "1",
  },
  // VPS prod tiene ~48 CPUs / 62 GiB; paralelismo acelera compile + traces.
  experimental: {
    webpackBuildWorker: true,
    parallelServerCompiles: true,
    parallelServerBuildTraces: true,
    staticGenerationMaxConcurrency: 8,
  },
};

export default nextConfig;
