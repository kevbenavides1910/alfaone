import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { verifyImpersonationToken } from "@/lib/auth/impersonation-token";
import { buildSessionUserPayload } from "@/lib/auth/build-session-user";
import { setUserSessionCookie } from "@/lib/auth/session-cookie";
import { prisma } from "@/modules/core/db/prisma";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type SearchParams = Promise<{ token?: string }>;

function ErrorView({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 to-blue-900">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            <CardTitle>{title}</CardTitle>
          </div>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button asChild>
            <Link href="/admin/users">Volver a usuarios</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/login">Ir al inicio de sesión</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default async function ImpersonatePage({ searchParams }: { searchParams: SearchParams }) {
  const { token } = await searchParams;

  if (!token?.trim()) {
    return (
      <ErrorView
        title="Enlace incompleto"
        message="Falta el token de acceso. Vuelva a Usuarios y use «Ingresar como» de nuevo."
      />
    );
  }

  const payload = verifyImpersonationToken(token.trim());
  if (!payload) {
    return (
      <ErrorView
        title="Token inválido o expirado"
        message="El enlace caducó (válido 2 minutos) o ya fue usado. Genere uno nuevo desde Mantenimiento → Usuarios."
      />
    );
  }

  const admin = await prisma.user.findUnique({
    where: { id: payload.adminId },
    select: { id: true, name: true, isActive: true },
  });
  if (!admin || !admin.isActive) {
    return (
      <ErrorView
        title="No se pudo continuar"
        message="El administrador que inició esta acción ya no está activo."
      />
    );
  }

  const sessionUser = await buildSessionUserPayload(payload.targetUserId, {
    impersonatorId: admin.id,
    impersonatorName: admin.name,
  });
  if (!sessionUser) {
    return (
      <ErrorView
        title="Usuario no disponible"
        message="El usuario destino no existe o está inactivo."
      />
    );
  }

  await setUserSessionCookie(sessionUser);
  redirect("/home");
}

export function generateMetadata() {
  return { title: "Ingresar como usuario" };
}
