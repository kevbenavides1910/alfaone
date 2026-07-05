"use client";

import { useState, Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Shield, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
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
    case "CredentialsSignin":   return "Email o contraseña incorrectos";
    case "Configuration":       return "Error de configuración del servidor.";
    case "AccessDenied":        return "Acceso denegado.";
    default:                    return `No se pudo iniciar sesión (${code}).`;
  }
}

/* ── Branding hook ── */
function useBranding() {
  return useQuery({
    queryKey: APP_BRANDING_QUERY_KEY,
    queryFn: async () => {
      const r = await fetch("/api/branding");
      const j = (await r.json()) as {
        data?: { hasLogo: boolean; updatedAt: string; primaryHex: string; sidebarHex: string };
      };
      if (!r.ok || !j.data)
        return { hasLogo: false, updatedAt: "", primaryHex: DEFAULT_PRIMARY_HEX, sidebarHex: DEFAULT_SIDEBAR_HEX };
      return j.data;
    },
    staleTime: 30_000,
  });
}

/* ── Login form ── */
function LoginForm({ primary, logoSrc }: { primary: string; logoSrc: string | null }) {
  const searchParams = useSearchParams();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const urlError = searchParams.get("error");
  useEffect(() => {
    const msg = messageForNextAuthError(urlError);
    if (msg) setError(msg);
  }, [urlError]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await signIn("credentials", {
        email, password, callbackUrl: "/home", redirect: false,
      });
      if (result?.error) { setError(messageForNextAuthError(result.error) ?? "No se pudo iniciar sesión"); return; }
      if (result === undefined) { setError("No hubo respuesta del servidor."); return; }

      function sameOriginPath(url: string | null | undefined): string {
        if (!url) return "/home";
        try {
          const u = new URL(url, window.location.origin);
          if (u.origin === window.location.origin) return `${u.pathname}${u.search}${u.hash}` || "/home";
        } catch { /* ignore */ }
        return url.startsWith("/") ? url : "/home";
      }

      const sessionRes = await fetch("/api/auth/session", { credentials: "same-origin" });
      const sessionJson = (await sessionRes.json()) as { user?: { mustChangePassword?: boolean } };
      const target = sessionJson.user?.mustChangePassword ? "/change-password" : sameOriginPath(result.url);
      window.location.assign(target);
    } catch {
      setError("Error de red o del servidor. Intente de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-gray-400 text-xs font-medium uppercase tracking-wide">
          Correo Electrónico
        </Label>
        <Input
          id="email" type="email" placeholder="usuario@empresa.com"
          value={email} onChange={e => setEmail(e.target.value)} required
          className="bg-[#0a0a0a] border-gray-700 text-white placeholder:text-gray-600 focus:border-red-600"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password" className="text-gray-400 text-xs font-medium uppercase tracking-wide">
            Contraseña
          </Label>
          <Link
            href="/forgot-password"
            className="text-xs text-gray-500 hover:text-red-400 transition-colors"
          >
            ¿Olvidó su contraseña?
          </Link>
        </div>
        <Input
          id="password" type="password"
          value={password} onChange={e => setPassword(e.target.value)} required
          className="bg-[#0a0a0a] border-gray-700 text-white placeholder:text-gray-600 focus:border-red-600"
        />
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg p-3">
          {error}
        </div>
      )}

      <Button
        type="submit" disabled={loading}
        className="w-full font-semibold text-white shadow-lg transition-all duration-200 hover:opacity-90"
        style={{ backgroundColor: primary }}
      >
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Ingresando...</> : "Iniciar Sesión"}
      </Button>
    </form>
  );
}

/* ── Forgot password form ── */
function ForgotPasswordForm({ primary }: { primary: string }) {
  const [email, setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent]     = useState(false);
  const [error, setError]   = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) { setError(json.error?.message ?? "Error al procesar la solicitud"); return; }
      setSent(true);
    } catch {
      setError("Error de red. Intente de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center space-y-4">
        <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
        <p className="text-white/80 text-sm leading-relaxed">
          Si el correo está registrado, recibirás un enlace para restablecer tu contraseña en los próximos minutos.
        </p>
        <p className="text-gray-500 text-xs">Revisa también tu carpeta de spam.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-gray-400 text-sm leading-relaxed">
        Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
      </p>
      <div className="space-y-2">
        <Label htmlFor="fp-email" className="text-gray-400 text-xs font-medium uppercase tracking-wide">
          Correo Electrónico
        </Label>
        <Input
          id="fp-email" type="email" placeholder="usuario@empresa.com"
          value={email} onChange={e => setEmail(e.target.value)} required
          className="bg-[#0a0a0a] border-gray-700 text-white placeholder:text-gray-600 focus:border-red-600"
        />
      </div>
      {error && (
        <div className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg p-3">
          {error}
        </div>
      )}
      <Button
        type="submit" disabled={loading}
        className="w-full font-semibold text-white shadow-lg transition-all duration-200 hover:opacity-90"
        style={{ backgroundColor: primary }}
      >
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</> : "Enviar enlace"}
      </Button>
    </form>
  );
}

/* ── Page shell ── */
function LoginPageContent() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode"); // "forgot"
  const isForgot = mode === "forgot";

  const { data: brand } = useBranding();
  const primary = brand?.primaryHex ?? DEFAULT_PRIMARY_HEX;
  const logoSrc =
    brand?.hasLogo && brand.updatedAt ? `/api/branding/logo?${encodeURIComponent(brand.updatedAt)}` : null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0a0a0a]">
      {/* Glow rojo sutil */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse 600px 400px at 50% 45%, ${primary}15, transparent 70%)` }}
      />

      <div className="w-full max-w-sm relative">
        {/* Logo */}
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

        {/* Card */}
        <div className="bg-[#161616]/95 border border-gray-800/80 rounded-2xl p-8 shadow-2xl shadow-black/40 backdrop-blur-sm ring-1 ring-white/5">
          {isForgot ? (
            <>
              <div className="flex items-center gap-2 mb-6">
                <Link href="/login" className="text-gray-500 hover:text-white transition-colors">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
                <h2 className="text-base font-semibold text-white">Recuperar contraseña</h2>
              </div>
              <ForgotPasswordForm primary={primary} />
            </>
          ) : (
            <LoginForm primary={primary} logoSrc={logoSrc} />
          )}
        </div>

        <p className="mt-6 text-center text-xs text-gray-600">
          {APP_NAME} · Grupo Corporativo Alfa
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-red-600 animate-spin" />
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
