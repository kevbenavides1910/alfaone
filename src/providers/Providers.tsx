"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { BrandingProvider } from "@/components/branding/BrandingProvider";

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
    <SessionProvider refetchOnWindowFocus refetchInterval={5 * 60}>
      <QueryClientProvider client={queryClient}>
        <BrandingProvider>{children}</BrandingProvider>
        <Toaster />
      </QueryClientProvider>
    </SessionProvider>
  );
}
