import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/providers/Providers";
import { APP_NAME, APP_TAGLINE } from "@/modules/plataforma/branding-constants";

export const metadata: Metadata = {
  title: `${APP_TAGLINE} | ${APP_NAME}`,
  description: `Plataforma de gestión empresarial — ${APP_NAME}`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('alfa-one:theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
