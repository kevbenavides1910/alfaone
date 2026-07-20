"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";

interface TokenPayload {
  sub: string;
  impersonatedRoleId: string;
  impersonatedRoleCode: string;
  exp: number;
}

function decodeJwtPayload(token: string): TokenPayload {
  const segment = token.split(".")[1];
  if (!segment) throw new Error("Token inválido");

  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");

  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json) as TokenPayload;
}

export default function ImpersonateRolePage() {
  const params = useParams<{ roleId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = search.get("t");
    const roleId = params.roleId;

    if (!token || !roleId) {
      router.replace("/admin/roles");
      return;
    }

    try {
      const payload = decodeJwtPayload(token);

      if (payload.impersonatedRoleId !== roleId) {
        throw new Error("Token no corresponde al rol solicitado");
      }
      if (payload.exp * 1000 < Date.now()) {
        throw new Error("Token expirado");
      }

      sessionStorage.setItem("impersonationToken", token);
      sessionStorage.setItem("impersonationRoleId", payload.impersonatedRoleId);
      sessionStorage.setItem("impersonationRoleCode", payload.impersonatedRoleCode);

      // Solo sessionStorage (por pestaña); no mutar el JWT compartido del admin.
      window.location.replace("/home");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Token inválido");
    }
  }, [params.roleId, search, router]);

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Card className="w-full max-w-md border-red-200">
          <CardContent className="p-8 text-center text-red-600">{error}</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center text-slate-600">
          Conectando como rol…
        </CardContent>
      </Card>
    </div>
  );
}
