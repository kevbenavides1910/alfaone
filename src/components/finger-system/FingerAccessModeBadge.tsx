"use client";

import { Badge } from "@/components/ui/badge";
import { Shield, UserRound } from "lucide-react";
import { useFingerPermissions } from "@/components/finger-system/use-finger-permissions";

export function FingerAccessModeBadge() {
  const { isBiometricAdmin, isOperativeUser, loading } = useFingerPermissions();

  if (loading) return null;

  if (isBiometricAdmin) {
    return (
      <Badge className="gap-1 bg-violet-100 text-violet-800 hover:bg-violet-100">
        <Shield className="h-3 w-3" />
        Administrador biométrico
      </Badge>
    );
  }

  if (isOperativeUser) {
    return (
      <Badge variant="secondary" className="gap-1">
        <UserRound className="h-3 w-3" />
        Usuario operativo
      </Badge>
    );
  }

  return null;
}
