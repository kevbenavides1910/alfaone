"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { loginCallbackUrl } from "@/lib/auth/logout";
import { useRouter } from "next/navigation";
import { Loader2, Shield, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toaster";
import { PASSWORD_REQUIREMENTS_HINT } from "@/lib/security/password-policy";

export default function ChangePasswordPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.replace("/login");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    try {
      const r = await fetch("/api/auth/change-password", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const j = (await r.json()) as { error?: { message?: string }; data?: { message?: string } };
      if (!r.ok) {
        toast.error(j.error?.message ?? "No se pudo cambiar la contraseña");
        return;
      }
      await update();
      toast.success(j.data?.message ?? "Contraseña actualizada");
      router.replace("/home");
      router.refresh();
    } catch {
      toast.error("Error de red");
    } finally {
      setLoading(false);
    }
  }

  const forced = session?.user?.mustChangePassword ?? false;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-800 to-slate-900">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2 text-slate-800">
            <Shield className="h-5 w-5" />
            <CardTitle>{forced ? "Cambio de contraseña obligatorio" : "Cambiar contraseña"}</CardTitle>
          </div>
          <CardDescription>
            {forced
              ? "Su contraseña fue asignada o restablecida por un administrador. Debe elegir una contraseña nueva antes de continuar."
              : "Actualice su contraseña de acceso."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nueva contraseña</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              <p className="text-xs text-slate-500">{PASSWORD_REQUIREMENTS_HINT}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar contraseña</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Guardando…
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" /> Guardar y continuar
                </>
              )}
            </Button>
            {!forced && (
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => router.back()}
              >
                Cancelar
              </Button>
            )}
            {forced && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => signOut({ callbackUrl: loginCallbackUrl() })}
              >
                Cerrar sesión
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
