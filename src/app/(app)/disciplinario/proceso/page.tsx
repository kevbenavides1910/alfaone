import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Upload, Users, ArrowRight } from "lucide-react";

export default function DisciplinarioProcesoPage() {
  return (
    <>
      <div className="p-4 sm:p-6 space-y-6 max-w-4xl">
        <p className="text-sm text-slate-600">
          Flujo equivalente al proceso principal de la app Python: cargar
          el reporte de marcas / inspecciones, validar el lote y registrar apercibimientos en el
          sistema central (aquí en la web, con base PostgreSQL en lugar de Excel local).
        </p>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Datos de empleados (módulo Empleados)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 space-y-3">
            <p>
              Asegúrese de que el directorio de <strong>Empleados</strong> esté actualizado con{" "}
              <strong>nombres, correos, cédulas y zonas</strong>. Disciplinario los consulta
              automáticamente al importar marcas y generar PDFs.
            </p>
            <Button asChild variant="outline" className="gap-2">
              <Link href="/empleados">
                <Users className="h-4 w-4" /> Ir al módulo Empleados
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Carga masiva de marcas / inspecciones</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 space-y-3">
            <p>
              Suba el libro Excel del área de sanciones (incluye hoja de detalle con{" "}
              <span className="font-mono text-xs">Usr Marca</span>,{" "}
              <span className="font-mono text-xs">Estado</span>,{" "}
              <span className="font-mono text-xs">Fecha</span> y{" "}
              <span className="font-mono text-xs">Hora</span>). El sistema detecta la hoja
              correcta, toma las filas <strong>No Realizada</strong> y genera un apercibimiento por
              empleado. Opcional: envío de correo con PDF si SMTP está configurado.
            </p>
            <Button asChild className="gap-2">
              <Link href="/disciplinario/importar">
                <Upload className="h-4 w-4" /> Abrir importación (marcas y Excel escritorio)
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Excel de la app de escritorio (Historial / Estadísticas)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 space-y-3">
            <p>
              Si aún usa la exportación clásica con hojas <strong>Historial</strong> y{" "}
              <strong>Estadísticas</strong>, el mismo formulario de importación la acepta y fusiona
              con el control web.
            </p>
            <Button asChild variant="outline" className="gap-2">
              <Link href="/disciplinario/importar">
                <FileSpreadsheet className="h-4 w-4" /> Importar
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">4. Seguimiento</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 space-y-2">
            <p>
              Use <Link href="/disciplinario" className="text-blue-600 hover:underline">Historial</Link>{" "}
              para estados y vigencia,{" "}
              <Link href="/disciplinario/empleados" className="text-blue-600 hover:underline">Tratamiento</Link>{" "}
              para ciclos y convocatorias, y{" "}
              <Link href="/disciplinario/dashboard" className="text-blue-600 hover:underline">Dashboard</Link>{" "}
              para métricas por administrador.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
