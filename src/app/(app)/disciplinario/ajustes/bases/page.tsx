import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, MapPin } from "lucide-react";

export default function DisciplinarioAjustesBasesPage() {
  return (
    <>
      <div className="p-4 sm:p-6 space-y-6 max-w-3xl">
        <p className="text-sm text-slate-600">
          Equivalente a <strong>Ajustes → Bases de datos</strong> en la app Python: mantenimiento
          de la base de empleados y la tabla <strong>zona → administrador → correo</strong> (en web:
          pestaña <strong>Zonas</strong> en Mantenimientos).
        </p>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-600" />
              Base de empleados
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 space-y-3">
            <p>
              Los datos de empleados (código, nombre, correo, cédula, zona, teléfono…) se mantienen
              en el módulo <strong>Empleados</strong>. Disciplinario los consulta al importar marcas,
              generar PDFs y enviar correos.
            </p>
            <Button asChild className="gap-2">
              <Link href="/empleados">
                <Users className="h-4 w-4" /> Abrir módulo Empleados
              </Link>
            </Button>
            <p className="text-xs text-slate-500">
              Para importar o actualizar el directorio, use{" "}
              <Link href="/empleados/importar" className="text-blue-600 hover:underline">
                Empleados → Importar
              </Link>
              .
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-5 w-5 text-slate-500" />
              Zona — administrador — correo
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 space-y-3">
            <p>
              En escritorio se guarda en <code className="text-xs">zonas_admin.xlsx</code>. En la web,
              el mismo dato vive en el catálogo de zonas: nombre de zona, administrador disciplinario y
              correo. Los imports disciplinarios enriquecen el administrador y pueden poner en copia
              (CC) ese correo cuando aplica.
            </p>
            <p className="text-xs text-slate-500">
              El texto de <strong>Zona</strong> en el módulo Empleados o en el reporte de marcas debe
              coincidir con el <strong>nombre</strong> de la zona en Mantenimientos (tras normalizar
              mayúsculas y espacios).
            </p>
            <Button asChild variant="outline" className="gap-2">
              <Link href="/admin/catalogs">
                <MapPin className="h-4 w-4" /> Abrir Mantenimientos (pestaña Zonas)
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
