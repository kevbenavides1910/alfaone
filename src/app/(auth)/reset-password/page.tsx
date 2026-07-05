"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Shield, Loader2, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
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

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [showPwd, setShowPwd]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [success, setSuccess]     = useState(false);
  const [error, setError]         = useState("");

  const { data: brand } = useQuery({
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

  const primary = brand?.primaryHex ?? DEFAULT_PRIMARY_HEX;
  const logoSrc =
    brand?.hasLogo && brand.updatedAt ? `/api/branding/logo?${encodeURIComponent(brand.updatedAt)}` : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("La contraseña debe tener al menos 8 caracteres."); return; }
    if (password !== confirm) { setError("Las contraseñas no coinciden."); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const json = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) { setError(json.error?.message ?? "Error al restablecer la contraseña."); return; }
      setSuccess(true);
    } catch {
      setError("Error de red. Intente de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
        <p className="text-white/80 text-sm">Enlace inválido. Solicita un nuevo enlace de recuperación.</p>
        <Link href="/login?mode=forgot" className="text-red-400 hover:text-red-300 text-sm underline">
          Solicitar enlace
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0a0a0a]">
      {/* Glow */}
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
          <h2 className="text-base font-semibold text-white mb-6">Nueva contraseña</h2>

          {success ? (
            <div className="text-center space-y-4">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
              <p className="text-white/80 text-sm">¡Contraseña actualizada correctamente!</p>
              <Link
                href="/login"
                className="inline-block mt-2 text-sm font-semibold text-white px-5 py-2.5 rounded-lg transition-colors"
                style={{ backgroundColor: primary }}
              >
                Iniciar sesión
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="pwd" className="text-gray-400 text-xs font-medium uppercase tracking-wide">
                  Nueva contraseña
                </Label>
                <div className="relative">
                  <Input
                    id="pwd" type={showPwd ? "text" : "password"}
                    placeholder="Mínimo 8 caracteres"
                    value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
                    className="bg-[#0a0a0a] border-gray-700 text-white placeholder:text-gray-600 focus:border-red-600 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    tabIndex={-1}
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm" className="text-gray-400 text-xs font-medium uppercase tracking-wide">
                  Confirmar contraseña
                </Label>
                <Input
                  id="confirm" type={showPwd ? "text" : "password"}
                  placeholder="Repite la contraseña"
                  value={confirm} onChange={e => setConfirm(e.target.value)} required
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
                className="w-full font-semibold text-white shadow-lg hover:opacity-90"
                style={{ backgroundColor: primary }}
              >
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</> : "Establecer contraseña"}
              </Button>

              <p className="text-center">
                <Link href="/login" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                  Volver al inicio de sesión
                </Link>
              </p>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-gray-600">
          {APP_NAME} · Grupo Corporativo Alfa
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-red-600 animate-spin" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
