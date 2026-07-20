"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { BrandingProvider } from "@/components/branding/BrandingProvider";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { ImpersonationProvider } from "@/lib/impersonation/context";
import { ImpersonationBanner } from "@/components/layout/ImpersonationBanner";
import { ImpersonationGate } from "@/lib/impersonation/ImpersonationGate";
import { ThemeProvider } from "@/lib/theme/theme-context";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60 * 1000, retry: 1 },
        },
      })
  );

  return (
    <SessionProvider refetchOnWindowFocus>
      <QueryClientProvider client={queryClient}>
        <BrandingProvider>
          <ThemeProvider>
            <ImpersonationProvider>
              <ImpersonationBanner />
              <ImpersonationGate>
                {children}
                <CommandPalette />
              </ImpersonationGate>
            </ImpersonationProvider>
          </ThemeProvider>
        </BrandingProvider>
        <Toaster />
      </QueryClientProvider>
    </SessionProvider>
  );
}
