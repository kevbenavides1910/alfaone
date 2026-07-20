"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Download, FileText, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_NAME, APP_TAGLINE } from "@/modules/plataforma/branding-constants";

type Step = "cedula" | "tramite" | "otp" | "download";

type TramiteOpt = { id: string; label: string };

export default function SolicitudesRrhhPage() {
  const [step, setStep] = useState<Step>("cedula");
  const [cedula, setCedula] = useState("");
  const [nombre, setNombre] = useState("");
  const [tramites, setTramites] = useState<TramiteOpt[]>([]);
  const [tramite, setTramite] = useState("");
  const [email, setEmail] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [code, setCode] = useState("");
  const [downloadToken, setDownloadToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const primary = "#dc2626";
  const tramiteLabel = useMemo(
    () => tramites.find((t) => t.id === tramite)?.label ?? "",
    [tramites, tramite],
  );

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const digits = cedula.replace(/\D/g, "");
      setCedula(digits);
      const res = await fetch("/api/solicitudes-rrhh/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cedula: digits }),
      });
      const json = (await res.json()) as {
        data?: { nombreEnmascarado: string; tramites: TramiteOpt[] };
        error?: { message?: string };
      };
      if (!res.ok || !json.data) {
        setError(json.error?.message ?? "No se pudo consultar la cédula");
        return;
      }
      setNombre(json.data.nombreEnmascarado);
      setTramites(json.data.tramites);
      setTramite(json.data.tramites[0]?.id ?? "");
      setStep("tramite");
    } catch {
      setError("Error de red. Intente de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const res = await fetch("/api/solicitudes-rrhh/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cedula, tramite, email }),
      });
      const json = (await res.json()) as {
        data?: { sessionId: string; message: string; mailed: boolean };
        error?: { message?: string };
      };
      if (!res.ok || !json.data) {
        setError(json.error?.message ?? "No se pudo enviar el código");
        return;
      }
      setSessionId(json.data.sessionId);
      setInfo(json.data.message);
      setStep("otp");
    } catch {
      setError("Error de red. Intente de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const res = await fetch("/api/solicitudes-rrhh/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, code }),
      });
      const json = (await res.json()) as {
        data?: { downloadToken: string; message: string };
        error?: { message?: string };
      };
      if (!res.ok || !json.data) {
        setError(json.error?.message ?? "Código inválido");
        return;
      }
      setDownloadToken(json.data.downloadToken);
      setInfo(json.data.message);
      setStep("download");
    } catch {
      setError("Error de red. Intente de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  function resetFlow() {
    setStep("cedula");
    setCedula("");
    setNombre("");
    setTramites([]);
    setTramite("");
    setEmail("");
    setSessionId("");
    setCode("");
    setDownloadToken("");
    setError("");
    setInfo("");
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 600px 400px at 50% 45%, ${primary}15, transparent 70%)`,
        }}
      />

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 overflow-hidden shadow-lg shadow-red-900/20"
            style={{ backgroundColor: primary }}
          >
            <FileText className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Solicitudes RRHH</h1>
          <p className="text-gray-500 mt-1 text-sm">Constancias sin necesidad de iniciar sesión</p>
        </div>

        <div className="bg-[#161616]/95 border border-gray-800/80 rounded-2xl p-8 shadow-2xl shadow-black/40 backdrop-blur-sm ring-1 ring-white/5">
          <div className="flex items-center gap-2 mb-6">
            {step === "cedula" ? (
              <Link href="/login" className="text-gray-500 hover:text-white transition-colors">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (step === "tramite") setStep("cedula");
                  else if (step === "otp") setStep("tramite");
                  else resetFlow();
                }}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <h2 className="text-base font-semibold text-white">
              {step === "cedula" && "Identificación"}
              {step === "tramite" && "Trámite y correo"}
              {step === "otp" && "Código de verificación"}
              {step === "download" && "Descargar documento"}
            </h2>
          </div>

          {error && (
            <div className="mb-4 text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg p-3">
              {error}
            </div>
          )}
          {info && (
            <div className="mb-4 text-sm text-emerald-400 bg-emerald-950/30 border border-emerald-900/40 rounded-lg p-3">
              {info}
            </div>
          )}

          {step === "cedula" && (
            <form onSubmit={handleLookup} className="space-y-5">
              <p className="text-gray-400 text-sm leading-relaxed">
                Ingrese su número de cédula solo con dígitos, sin espacios ni guiones.
              </p>
              <div className="space-y-2">
                <Label htmlFor="cedula" className="text-gray-400 text-xs font-medium uppercase tracking-wide">
                  Cédula
                </Label>
                <Input
                  id="cedula"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="401234567"
                  value={cedula}
                  onChange={(e) => setCedula(e.target.value.replace(/\D/g, ""))}
                  required
                  className="bg-[#0a0a0a] border-gray-700 text-white placeholder:text-gray-600 focus:border-red-600"
                />
              </div>
              <Button
                type="submit"
                disabled={loading || cedula.length < 5}
                className="w-full font-semibold text-white"
                style={{ backgroundColor: primary }}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Consultando...
                  </>
                ) : (
                  "Continuar"
                )}
              </Button>
            </form>
          )}

          {step === "tramite" && (
            <form onSubmit={handleRequestOtp} className="space-y-5">
              <p className="text-gray-400 text-sm">
                Registro encontrado: <span className="text-white font-medium">{nombre}</span>
              </p>
              <div className="space-y-2">
                <Label htmlFor="tramite" className="text-gray-400 text-xs font-medium uppercase tracking-wide">
                  Trámite
                </Label>
                <select
                  id="tramite"
                  value={tramite}
                  onChange={(e) => setTramite(e.target.value)}
                  required
                  className="w-full rounded-md bg-[#0a0a0a] border border-gray-700 text-white px-3 py-2 text-sm focus:border-red-600 outline-none"
                >
                  {tramites.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-400 text-xs font-medium uppercase tracking-wide">
                  Correo para el código
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-[#0a0a0a] border-gray-700 text-white placeholder:text-gray-600 focus:border-red-600"
                />
                <p className="text-xs text-gray-500">
                  Puede usar el correo que prefiera; allí llegará el código de confirmación.
                </p>
              </div>
              <Button
                type="submit"
                disabled={loading || !tramite || !email}
                className="w-full font-semibold text-white"
                style={{ backgroundColor: primary }}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Enviando...
                  </>
                ) : (
                  "Enviar código"
                )}
              </Button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={handleVerify} className="space-y-5">
              <p className="text-gray-400 text-sm leading-relaxed">
                Ingrese el código de 6 dígitos enviado a <span className="text-white">{email}</span>
                {tramiteLabel ? (
                  <>
                    {" "}
                    para <span className="text-white">{tramiteLabel}</span>
                  </>
                ) : null}
                .
              </p>
              <div className="space-y-2">
                <Label htmlFor="code" className="text-gray-400 text-xs font-medium uppercase tracking-wide">
                  Código
                </Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  className="bg-[#0a0a0a] border-gray-700 text-white tracking-[0.35em] text-center text-lg placeholder:text-gray-600 focus:border-red-600"
                />
              </div>
              <Button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full font-semibold text-white"
                style={{ backgroundColor: primary }}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Verificando...
                  </>
                ) : (
                  "Verificar"
                )}
              </Button>
            </form>
          )}

          {step === "download" && (
            <div className="space-y-5 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
              <p className="text-white/80 text-sm leading-relaxed">
                Identidad verificada. Descargue su documento en PDF.
              </p>
              <a
                href={`/api/solicitudes-rrhh/download?token=${encodeURIComponent(downloadToken)}`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold text-white"
                style={{ backgroundColor: primary }}
              >
                <Download className="h-4 w-4" /> Descargar PDF
              </a>
              <Button
                type="button"
                variant="ghost"
                onClick={resetFlow}
                className="w-full text-gray-400 hover:text-white"
              >
                Nueva solicitud
              </Button>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-gray-600 flex items-center justify-center gap-1">
          <Shield className="h-3 w-3" /> {APP_NAME} · {APP_TAGLINE}
        </p>
      </div>
    </div>
  );
}
