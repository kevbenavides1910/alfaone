"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Shield, Loader2 } from "lucide-react";
import {
  APP_BRANDING_QUERY_KEY,
  APP_NAME,
  APP_TAGLINE,
  DEFAULT_PRIMARY_HEX,
  DEFAULT_SIDEBAR_HEX,
} from "@/modules/plataforma/branding-constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function messageForNextAuthError(code: string | null): string | null {
  if (!code) return null;
  switch (code) {
    case "CredentialsSignin":
      return "Email o contraseña incorrectos";
    case "Configuration":
      return "Error de configuración del servidor.";
    case "AccessDenied":
      return "Acceso denegado.";
    default:
      return `No se pudo iniciar sesión (${code}).`;
  }
}

type Props = {
  initialError?: string | null;
};

export function LoginClient({ initialError = null }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(messageForNextAuthError(initialError) ?? "");

  const { data: brand } = useQuery({
    queryKey: APP_BRANDING_QUERY_KEY,
    queryFn: async () => {
      const r = await fetch("/api/branding");
      const j = (await r.json()) as {
        data?: { hasLogo: boolean; updatedAt: string; primaryHex: string; sidebarHex: string };
      };
      if (!r.ok || !j.data) {
        return { hasLogo: false, updatedAt: "", primaryHex: DEFAULT_PRIMARY_HEX, sidebarHex: DEFAULT_SIDEBAR_HEX };
      }
      return j.data;
    },
    staleTime: 30_000,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        callbackUrl: "/home",
        redirect: false,
      });

      if (result?.error) {
        setError(messageForNextAuthError(result.error) ?? "No se pudo iniciar sesión");
        return;
      }

      if (result === undefined) {
        setError("No hubo respuesta del servidor de autenticación.");
        return;
      }

      function sameOriginPath(url: string | null | undefined): string {
        if (!url) return "/home";
        try {
          const u = new URL(url, window.location.origin);
          if (u.origin === window.location.origin) return `${u.pathname}${u.search}${u.hash}` || "/home";
        } catch {
          /* ignore */
        }
        return url.startsWith("/") ? url : "/home";
      }

      const sessionRes = await fetch("/api/auth/session", { credentials: "same-origin" });
      const sessionJson = (await sessionRes.json()) as {
        user?: { mustChangePassword?: boolean };
      };
      const target = sessionJson.user?.mustChangePassword
        ? "/change-password"
        : sameOriginPath(result.url);

      window.location.assign(target);
    } catch {
      setError("Error de red o del servidor. Intente de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  const primary = brand?.primaryHex ?? DEFAULT_PRIMARY_HEX;
  const logoSrc =
    brand?.hasLogo && brand.updatedAt ? `/api/branding/logo?${encodeURIComponent(brand.updatedAt)}` : null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0a0a0a]">
      {/* Glow sutil rojo detrás del card */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 600px 400px at 50% 45%, ${primary}15, transparent 70%)`,
        }}
      />

      <div className="w-full max-w-sm relative">
        {/* Logo + nombre */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 overflow-hidden shadow-lg shadow-red-900/20"
            style={{ backgroundColor: primary }}
          >
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoSrc} alt="Logo" className="max-h-14 max-w-14 object-contain" />
            ) : (
              <Shield className="h-8 w-8 text-white" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{APP_NAME}</h1>
          <p className="text-gray-500 mt-1 text-sm">{APP_TAGLINE}</p>
        </div>

        {/* Card oscuro */}
        <div className="bg-[#161616]/95 border border-gray-800/80 rounded-2xl p-8 shadow-2xl shadow-black/40 backdrop-blur-sm ring-1 ring-white/5">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-400 text-xs font-medium uppercase tracking-wide">
                Correo Electrónico
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="usuario@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-[#0a0a0a] border-gray-700 text-white placeholder:text-gray-600 focus:border-red-600 transition-colors"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-400 text-xs font-medium uppercase tracking-wide">
                Contraseña
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-[#0a0a0a] border-gray-700 text-white placeholder:text-gray-600 focus:border-red-600 transition-colors"
              />
            </div>
            {error && (
              <div className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg p-3">
                {error}
              </div>
            )}
            <Button
              type="submit"
              className="w-full font-semibold text-white shadow-lg transition-all duration-200 hover:opacity-90 hover:shadow-xl"
              style={{ backgroundColor: primary }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Ingresando...
                </>
              ) : (
                "Iniciar Sesión"
              )}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-gray-600">
          {APP_NAME} · Grupo Corporativo Alfa
        </p>
      </div>
    </div>
  );
}
