"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/auth/client-session";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FieldHelp, LabelWithHelp, ValidationBanner } from "@/components/ui/field-help";
import { toast } from "@/components/ui/toaster";
import { hasPermission } from "@/lib/permissions/check";
import { codigoTarifaToPercent, isTarifaIvaSinMonto, tarifaPercentToCodigoTarifaIVA } from "@/modules/facturacion-electronica/utils/fe-tarifa-iva";
import { FeTarifaIvaSelect } from "@/components/facturacion-electronica/FeTarifaIvaSelect";
import {
  feApiUrl,
  useFeCompany,
  withFeCompanyBody,
} from "@/components/facturacion-electronica/fe-company-context";
import { FeCatalogSearchPicker } from "@/components/facturacion-electronica/FeCatalogSearchPicker";
import { FeUbicacionCrSelects } from "@/components/facturacion-electronica/FeUbicacionCrSelects";
import { FeCabysPicker } from "@/components/facturacion-electronica/FeCabysPicker";
import type { FeContribuyenteLookup } from "@/modules/facturacion-electronica/services/hacienda/contribuyente-lookup.service";
import {
  actividadDescripcion,
  mapContribuyenteToClienteForm,
  mapDbClienteToForm,
} from "@/modules/facturacion-electronica/utils/fe-contribuyente-cliente-map";
import { FeLineaDetalleRow } from "./FeLineaDetalleRow";
import { FeNuevoClienteSection } from "./FeNuevoClienteSection";
import {
  type FeConfigResponse,
  type FeCliente,
  type LineaForm,
  type MedioPagoRow,
  type OtroCargoRow,
  emptyLine,
  emptyMedioPago,
  emptyOtroCargo,
  lineTotals,
  nuevoClienteDefault,
  validateCliente,
  validateId,
} from "./fe-nueva-types";

export default function NuevaFacturaElectronicaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("editId")?.trim() ?? "";
  const isEditMode = Boolean(editId);
  const qc = useQueryClient();
  const { data: session } = useSession();
  const { companyCode, needsSelection } = useFeCompany();
  const canEdit = hasPermission(session, "facturacionElectronica.facturas", "edit");

  const [tipoDocumento, setTipoDocumento] = useState<
    "FACTURA_ELECTRONICA" | "TIQUETE_ELECTRONICO" | "FACTURA_ELECTRONICA_EXPORTACION"
  >("FACTURA_ELECTRONICA");
  const [puntoVentaId, setPuntoVentaId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [moneda, setMoneda] = useState<"CRC" | "USD" | "EUR">("CRC");
  const [condicionVenta, setCondicionVenta] = useState("CONTADO");
  const [medioPago, setMedioPago] = useState("TRANSFERENCIA_DEPOSITO");
  const [medioPagoOtro, setMedioPagoOtro] = useState("");
  const [condicionVentaOtro, setCondicionVentaOtro] = useState("");
  const [plazoCredito, setPlazoCredito] = useState("");
  const [totalOtrosCargos, setTotalOtrosCargos] = useState("0");
  const [totalIvaDevuelto, setTotalIvaDevuelto] = useState("0");
  const [desglosarMediosPago, setDesglosarMediosPago] = useState(false);
  const [mediosPagoRows, setMediosPagoRows] = useState<MedioPagoRow[]>([emptyMedioPago()]);
  const [detallarOtrosCargos, setDetallarOtrosCargos] = useState(false);
  const [otrosCargosRows, setOtrosCargosRows] = useState<OtroCargoRow[]>([emptyOtroCargo()]);
  const [observaciones, setObservaciones] = useState("");
  const [lineas, setLineas] = useState<LineaForm[]>([emptyLine()]);
  const [showNuevoCliente, setShowNuevoCliente] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState({ ...nuevoClienteDefault });
  const [clienteErrors, setClienteErrors] = useState<string[]>([]);
  const [clienteLookupLoading, setClienteLookupLoading] = useState(false);
  const [clienteLookupHint, setClienteLookupHint] = useState<string | null>(null);
  const [nuevoClienteActividadDesc, setNuevoClienteActividadDesc] = useState("");
  const [haciendaClienteInfo, setHaciendaClienteInfo] = useState<FeContribuyenteLookup | null>(null);

  const [editHydrated, setEditHydrated] = useState(false);

  const facturaEditQ = useQuery({
    queryKey: ["fe-factura-edit", editId, companyCode],
    enabled: Boolean(editId && companyCode),
    queryFn: async () => {
      const r = await fetch(feApiUrl(`/api/fe/facturas/${editId}`, companyCode));
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al cargar factura");
      return j.data as {
        id: string;
        estado: string;
        tipoDocumento: string;
        puntoVentaId: string;
        clienteId?: string | null;
        fecha: string;
        moneda: string;
        condicionVenta: string;
        condicionVentaOtro?: string | null;
        medioPago: string;
        medioPagoOtro?: string | null;
        plazoCredito?: number | null;
        observaciones?: string | null;
        totalOtrosCargos?: string | number;
        totalIvaDevuelto?: string | number;
        cliente?: FeCliente | null;
        detalles?: Array<{
          codigoCabys?: string | null;
          descripcion: string;
          cantidad: string | number;
          unidadMedida: string;
          precioUnitario: string | number;
          montoDescuento?: string | number;
          naturalezaDescuento?: string | null;
          codigoImpuesto?: string | null;
          tarifaImpuesto?: string | number;
          exonNumeroDocumento?: string | null;
          exonTipoDocumento?: string | null;
          exonNombreInstitucion?: string | null;
          exonFechaEmision?: string | null;
          exonPorcentaje?: string | number | null;
          exonMonto?: string | number | null;
          ivaCobradoFabrica?: string | null;
          impuestoAsumidoFabrica?: string | number | null;
          partidaArancelaria?: string | null;
          montoImpuestoExportacion?: string | number | null;
        }>;
      };
    },
  });

  const configQ = useQuery({
    queryKey: ["fe-config", companyCode],
    queryFn: async (): Promise<FeConfigResponse> => {
      const r = await fetch(feApiUrl("/api/fe/config", companyCode));
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al cargar configuración");
      return j.data;
    },
    enabled: canEdit && Boolean(companyCode),
  });

  const clientesQ = useQuery({
    queryKey: ["fe-clientes", companyCode],
    queryFn: async (): Promise<FeCliente[]> => {
      const r = await fetch(feApiUrl("/api/fe/clientes", companyCode));
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al cargar clientes");
      return j.data as FeCliente[];
    },
    enabled: canEdit && Boolean(companyCode),
  });

  useEffect(() => {
    if (!isEditMode || editHydrated || !facturaEditQ.data) return;
    const f = facturaEditQ.data;
    if (!["BORRADOR", "ERROR", "PENDIENTE_ENVIO"].includes(f.estado)) return;

    setTipoDocumento(f.tipoDocumento as typeof tipoDocumento);
    setPuntoVentaId(f.puntoVentaId);
    setClienteId(f.clienteId ?? "");
    setFecha(String(f.fecha).slice(0, 10));
    setMoneda(f.moneda as typeof moneda);
    setCondicionVenta(f.condicionVenta);
    setCondicionVentaOtro(f.condicionVentaOtro ?? "");
    setMedioPago(f.medioPago);
    setMedioPagoOtro(f.medioPagoOtro ?? "");
    setPlazoCredito(f.plazoCredito != null ? String(f.plazoCredito) : "");
    setObservaciones(f.observaciones ?? "");
    setTotalOtrosCargos(String(f.totalOtrosCargos ?? 0));
    setTotalIvaDevuelto(String(f.totalIvaDevuelto ?? 0));

    if (f.cliente) {
      setNuevoCliente(mapDbClienteToForm(f.cliente));
      setNuevoClienteActividadDesc(f.cliente.actividadEconomica ?? "");
      setShowNuevoCliente(true);
    }

    if (f.detalles?.length) {
      setLineas(
        f.detalles.map((d) => ({
          key: crypto.randomUUID(),
          codigoCabys: (d.codigoCabys ?? "").replace(/\D/g, ""),
          cabysDescripcion: "",
          descripcion: d.descripcion,
          cantidad: String(d.cantidad),
          unidadMedida: d.unidadMedida,
          precioUnitario: String(d.precioUnitario),
          montoDescuento: String(d.montoDescuento ?? 0),
          naturalezaDescuento: d.naturalezaDescuento ?? "",
          codigoTarifaIVA: d.codigoImpuesto ?? "08",
          tarifaImpuesto: String(d.tarifaImpuesto ?? 13),
          exonActiva: Boolean(d.exonNumeroDocumento?.trim()),
          exonTipoDocumento: d.exonTipoDocumento ?? "02",
          exonNumeroDocumento: d.exonNumeroDocumento ?? "",
          exonNombreInstitucion: d.exonNombreInstitucion ?? "",
          exonFechaEmision: d.exonFechaEmision ? String(d.exonFechaEmision).slice(0, 10) : "",
          exonPorcentaje: d.exonPorcentaje != null ? String(d.exonPorcentaje) : "",
          exonMonto: d.exonMonto != null ? String(d.exonMonto) : "",
          ivaCobradoFabrica: d.ivaCobradoFabrica ?? "",
          impuestoAsumidoFabrica: String(d.impuestoAsumidoFabrica ?? 0),
          partidaArancelaria: d.partidaArancelaria ?? "",
          montoImpuestoExportacion: d.montoImpuestoExportacion != null ? String(d.montoImpuestoExportacion) : "",
        }))
      );
    }

    setEditHydrated(true);
  }, [isEditMode, editHydrated, facturaEditQ.data]);

  useEffect(() => {
    if (!showNuevoCliente || !companyCode) return;

    const digits = nuevoCliente.identificacion.replace(/\D/g, "");
    const idErr = validateId(nuevoCliente.tipoIdentificacion, digits);
    if (!digits || idErr) {
      setClienteLookupHint(null);
      return;
    }

    const existing = clientesQ.data?.find((c) => c.identificacion === digits);
    if (existing) {
      setNuevoCliente(mapDbClienteToForm(existing));
      setNuevoClienteActividadDesc(existing.actividadEconomica ?? "");
      setHaciendaClienteInfo(null);
      setClienteLookupHint("Cliente ya registrado — datos cargados de su catálogo");
      return;
    }

    const timer = setTimeout(async () => {
      setClienteLookupLoading(true);
      try {
        const r = await fetch(
          feApiUrl(`/api/fe/contribuyentes?identificacion=${encodeURIComponent(digits)}`, companyCode)
        );
        const j = await r.json();
        if (r.ok && j.data?.nombre) {
          const data = j.data as FeContribuyenteLookup;
          setHaciendaClienteInfo(data);
          setNuevoCliente((prev) => mapContribuyenteToClienteForm(data, prev));
          setNuevoClienteActividadDesc(actividadDescripcion(data.actividades, data.actividadEconomica));
          const extras: string[] = ["Datos obtenidos de Hacienda"];
          if (data.actividades.length > 1) extras.push(`${data.actividades.length} actividades registradas`);
          if (!data.direccionProvincia) extras.push("correo/teléfono/dirección exacta: completar manualmente");
          setClienteLookupHint(extras.join(" · "));
        } else if (r.status === 404) {
          setHaciendaClienteInfo(null);
          setClienteLookupHint("No encontrado en Hacienda — complete los datos manualmente");
        } else {
          setHaciendaClienteInfo(null);
          setClienteLookupHint(null);
        }
      } catch {
        setHaciendaClienteInfo(null);
        setClienteLookupHint(null);
      } finally {
        setClienteLookupLoading(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [
    showNuevoCliente,
    companyCode,
    nuevoCliente.identificacion,
    nuevoCliente.tipoIdentificacion,
    clientesQ.data,
  ]);

  const puntosVenta = useMemo(
    () => configQ.data?.sucursales.flatMap((s) => s.puntosVenta.map((pv) => ({ ...pv, sucursal: s.nombre }))) ?? [],
    [configQ.data]
  );

  const totales = useMemo(() => {
    let subtotal = 0;
    let totalImpuestos = 0;
    let totalDescuentos = 0;
    const detalles = lineas.map((l) => {
      const { base, montoImpuestoBruto, montoImpuesto, exonMonto, totalLinea } = lineTotals(l);
      subtotal += base;
      totalImpuestos += montoImpuesto;
      totalDescuentos += Number(l.montoDescuento) || 0;
      const exoneracion =
        l.exonActiva && l.exonNumeroDocumento.trim()
          ? {
              exonTipoDocumento: l.exonTipoDocumento || "02",
              exonNumeroDocumento: l.exonNumeroDocumento.trim(),
              exonNombreInstitucion: l.exonNombreInstitucion.trim(),
              exonFechaEmision: l.exonFechaEmision ? new Date(l.exonFechaEmision).toISOString() : undefined,
              exonPorcentaje: l.exonPorcentaje ? Number(l.exonPorcentaje) : undefined,
              exonMonto: exonMonto > 0 ? exonMonto : undefined,
            }
          : undefined;
      return {
        codigoCabys: l.codigoCabys.replace(/\D/g, ""),
        descripcion: l.descripcion.trim(),
        cantidad: Number(l.cantidad) || 0,
        unidadMedida: l.unidadMedida.trim() || "Unid",
        precioUnitario: Number(l.precioUnitario) || 0,
        montoDescuento: Number(l.montoDescuento) || 0,
        naturalezaDescuento:
          Number(l.montoDescuento) > 0 ? l.naturalezaDescuento.trim() || "Descuento comercial" : undefined,
        codigoImpuesto: l.codigoTarifaIVA || "08",
        tarifaImpuesto:
          isTarifaIvaSinMonto(l.codigoTarifaIVA)
            ? 0
            : Number(l.tarifaImpuesto) || codigoTarifaToPercent(l.codigoTarifaIVA),
        montoImpuesto: montoImpuestoBruto,
        totalLinea,
        exoneracion,
        ivaCobradoFabrica: l.ivaCobradoFabrica === "01" || l.ivaCobradoFabrica === "02" ? l.ivaCobradoFabrica : undefined,
        impuestoAsumidoFabrica: Number(l.impuestoAsumidoFabrica) || 0,
        partidaArancelaria:
          tipoDocumento === "FACTURA_ELECTRONICA_EXPORTACION" ? l.partidaArancelaria.replace(/\D/g, "") : undefined,
        montoImpuestoExportacion:
          tipoDocumento === "FACTURA_ELECTRONICA_EXPORTACION" && l.montoImpuestoExportacion
            ? Number(l.montoImpuestoExportacion)
            : undefined,
      };
    });
    const otros = detallarOtrosCargos
      ? otrosCargosRows.reduce((s, r) => s + (Number(r.montoCargo) || 0), 0)
      : Number(totalOtrosCargos) || 0;
    const ivaDev = Number(totalIvaDevuelto) || 0;
    const total = Math.round((subtotal + totalImpuestos + otros - ivaDev) * 100) / 100;
    return { subtotal, totalImpuestos, totalDescuentos, totalOtrosCargos: otros, totalIvaDevuelto: ivaDev, total, detalles };
  }, [lineas, totalOtrosCargos, totalIvaDevuelto, tipoDocumento, detallarOtrosCargos, otrosCargosRows]);

  const exigirUbicacion = configQ.data?.empresa?.exigirUbicacionReceptor ?? true;

  const guardarClienteM = useMutation({
    mutationFn: async () => {
      const clienteErrs = validateCliente(nuevoCliente, {
        exigirUbicacion,
        esTiquete: tipoDocumento === "TIQUETE_ELECTRONICO",
      });
      if (clienteErrs.length) throw new Error(clienteErrs.join(". "));

      const payload = withFeCompanyBody(
        {
          tipoIdentificacion: nuevoCliente.tipoIdentificacion,
          identificacion: nuevoCliente.identificacion.trim(),
          nombre: nuevoCliente.nombre.trim(),
          nombreComercial: nuevoCliente.nombre.trim(),
          email: nuevoCliente.email.trim() || undefined,
          telefono: nuevoCliente.telefono.trim() || undefined,
          direccionProvincia: nuevoCliente.direccionProvincia.trim() || undefined,
          direccionCanton: nuevoCliente.direccionCanton.trim() || undefined,
          direccionDistrito: nuevoCliente.direccionDistrito.trim() || undefined,
          direccionBarrio: nuevoCliente.direccionBarrio.trim() || undefined,
          direccionOtras: nuevoCliente.direccionOtras.trim() || undefined,
          actividadEconomica: nuevoCliente.actividadEconomica.trim() || undefined,
        },
        companyCode
      );

      const isUpdate = Boolean(clienteId);
      const url = isUpdate
        ? feApiUrl(`/api/fe/clientes/${clienteId}`, companyCode)
        : feApiUrl("/api/fe/clientes", companyCode);
      const r = await fetch(url, {
        method: isUpdate ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) {
        throw new Error(j.error?.message ?? (isUpdate ? "Error al actualizar cliente" : "Error al crear cliente"));
      }
      return { cliente: j.data as FeCliente, isUpdate };
    },
    onSuccess: ({ cliente, isUpdate }) => {
      toast.success(isUpdate ? "Cliente actualizado" : "Cliente creado");
      setClienteId(cliente.id);
      if (!isUpdate) setShowNuevoCliente(false);
      void qc.invalidateQueries({ queryKey: ["fe-clientes", companyCode] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveM = useMutation({
    mutationFn: async () => {
      if (!puntoVentaId) throw new Error("Seleccione punto de venta");
      if (tipoDocumento !== "TIQUETE_ELECTRONICO" && !clienteId) {
        throw new Error("Seleccione cliente");
      }
      if (showNuevoCliente && clienteId) {
        const clienteErrs = validateCliente(nuevoCliente, {
          exigirUbicacion,
          esTiquete: tipoDocumento === "TIQUETE_ELECTRONICO",
        });
        if (clienteErrs.length) throw new Error(clienteErrs.join(". "));
        const cr = await fetch(feApiUrl(`/api/fe/clientes/${clienteId}`, companyCode), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            withFeCompanyBody(
              {
                nombre: nuevoCliente.nombre.trim(),
                nombreComercial: nuevoCliente.nombre.trim(),
                email: nuevoCliente.email.trim() || undefined,
                telefono: nuevoCliente.telefono.trim() || undefined,
                direccionProvincia: nuevoCliente.direccionProvincia.trim() || undefined,
                direccionCanton: nuevoCliente.direccionCanton.trim() || undefined,
                direccionDistrito: nuevoCliente.direccionDistrito.trim() || undefined,
                direccionBarrio: nuevoCliente.direccionBarrio.trim() || undefined,
                direccionOtras: nuevoCliente.direccionOtras.trim() || undefined,
                actividadEconomica: nuevoCliente.actividadEconomica.trim() || undefined,
              },
              companyCode
            )
          ),
        });
        const cj = await cr.json();
        if (!cr.ok) throw new Error(cj.error?.message ?? "Error al actualizar cliente");
      }
      if (totales.detalles.some((d) => !d.descripcion || d.cantidad <= 0 || d.codigoCabys.length !== 13)) {
        throw new Error("Complete las líneas: descripción, cantidad y CABYS (13 dígitos)");
      }
      const mediosPayload = desglosarMediosPago
        ? mediosPagoRows
            .filter((r) => Number(r.total) > 0)
            .map((r) => ({
              tipo: r.tipo,
              total: Number(r.total),
              otro: r.tipo === "OTROS" ? r.otro.trim() : undefined,
            }))
        : undefined;
      if (mediosPayload?.length) {
        const sum = mediosPayload.reduce((s, m) => s + m.total, 0);
        if (Math.abs(sum - totales.total) > 0.02) {
          throw new Error("La suma de medios de pago debe coincidir con el total");
        }
      }
      const otrosCargosPayload = detallarOtrosCargos
        ? otrosCargosRows
            .filter((r) => Number(r.montoCargo) > 0 && r.detalle.trim())
            .map((r) => ({
              tipoDocumento: r.tipoDocumento,
              detalle: r.detalle.trim(),
              montoCargo: Number(r.montoCargo),
            }))
        : undefined;
      const body = {
        tipoDocumento,
        puntoVentaId,
        clienteId: clienteId || undefined,
        fecha: new Date(fecha).toISOString(),
        moneda,
        tipoCambio: 1,
        condicionVenta,
        condicionVentaOtro: condicionVenta === "OTROS" ? condicionVentaOtro.trim() : undefined,
        medioPago,
        medioPagoOtro: medioPago === "OTROS" ? medioPagoOtro.trim() : undefined,
        mediosPago: mediosPayload?.length ? mediosPayload : undefined,
        plazoCredito: condicionVenta === "CREDITO" && plazoCredito ? Number(plazoCredito) : undefined,
        observaciones: observaciones.trim() || undefined,
        subtotal: totales.subtotal,
        totalDescuentos: totales.totalDescuentos,
        totalImpuestos: totales.totalImpuestos,
        totalOtrosCargos: totales.totalOtrosCargos,
        otrosCargos: otrosCargosPayload?.length ? otrosCargosPayload : undefined,
        totalIvaDevuelto: totales.totalIvaDevuelto,
        total: totales.total,
        detalles: totales.detalles,
      };
      const url = isEditMode ? feApiUrl(`/api/fe/facturas/${editId}`, companyCode) : "/api/fe/facturas";
      const r = await fetch(url, {
        method: isEditMode ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withFeCompanyBody(body, companyCode)),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? (isEditMode ? "Error al guardar cambios" : "Error al crear factura"));
      return j.data as { id: string };
    },
    onSuccess: (data) => {
      toast.success(isEditMode ? "Factura actualizada" : "Factura creada en borrador");
      void qc.invalidateQueries({ queryKey: ["fe-facturas", companyCode] });
      void qc.invalidateQueries({ queryKey: ["fe-factura", data.id, companyCode] });
      void qc.invalidateQueries({ queryKey: ["fe-clientes", companyCode] });
      router.push(`/facturacion-electronica/${data.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canEdit) {
    return <p className="text-sm text-muted-foreground">No tiene permiso para crear facturas.</p>;
  }

  if (needsSelection) {
    return (
      <p className="text-sm text-amber-700">
        Seleccione la empresa emisora en el menú superior (junto a las pestañas) para continuar.
      </p>
    );
  }

  if (configQ.isLoading || (isEditMode && facturaEditQ.isLoading)) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }

  if (isEditMode && facturaEditQ.isError) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-destructive">{(facturaEditQ.error as Error).message}</p>
          <Button variant="link" asChild className="px-0">
            <Link href="/facturacion-electronica">Volver al listado</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (
    isEditMode &&
    facturaEditQ.data &&
    !["BORRADOR", "ERROR", "PENDIENTE_ENVIO"].includes(facturaEditQ.data.estado)
  ) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-destructive">
            Esta factura ya no se puede editar (estado: {facturaEditQ.data.estado}).
          </p>
          <Button variant="link" asChild className="px-0">
            <Link href={`/facturacion-electronica/${editId}`}>Ver factura</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (configQ.isError) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-destructive">{(configQ.error as Error).message}</p>
        </CardContent>
      </Card>
    );
  }

  if (!configQ.data?.configured) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground">
            Configure el emisor antes de crear facturas.{" "}
            <Link href="/facturacion-electronica/configuracion" className="text-primary underline">
              Ir a configuración
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={isEditMode ? `/facturacion-electronica/${editId}` : "/facturacion-electronica"}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>
        <h2 className="text-lg font-semibold">
          {isEditMode ? "Editar comprobante (borrador)" : "Nuevo comprobante de venta"}
        </h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tipo de comprobante</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={tipoDocumento} onValueChange={(v) => setTipoDocumento(v as typeof tipoDocumento)}>
            <SelectTrigger className="max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FACTURA_ELECTRONICA">Factura electrónica (FE) — requiere cliente con ID</SelectItem>
              <SelectItem value="TIQUETE_ELECTRONICO">Tiquete electrónico (TE) — consumidor final, sin ID</SelectItem>
              <SelectItem value="FACTURA_ELECTRONICA_EXPORTACION">Factura exportación (FEE) — cliente extranjero</SelectItem>
            </SelectContent>
          </Select>
          <FieldHelp
            text={
              tipoDocumento === "FACTURA_ELECTRONICA" ? "FE: Requiere cliente identificado. Hacienda valida ID del receptor." :
              tipoDocumento === "TIQUETE_ELECTRONICO" ? "TE: No requiere identificación del cliente (consumidor final)." :
              "FEE: Para exportaciones. Requiere partida arancelaria en líneas de mercancía."
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos generales</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <LabelWithHelp required help="Punto de venta autorizado por Hacienda. Determina el consecutivo del comprobante (sucursal + punto de venta + consecutivo).">
              Punto de venta
            </LabelWithHelp>
            <Select value={puntoVentaId} onValueChange={setPuntoVentaId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccione…" />
              </SelectTrigger>
              <SelectContent>
                {puntosVenta.map((pv) => (
                  <SelectItem key={pv.id} value={pv.id}>
                    {pv.sucursal} — {pv.codigo} {pv.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <LabelWithHelp required={tipoDocumento !== "TIQUETE_ELECTRONICO"} help="Cliente receptor del comprobante. Obligatorio para facturas (FE) y exportación (FEE). Opcional para tiquetes (TE).">
              Cliente
            </LabelWithHelp>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccione…" />
              </SelectTrigger>
              <SelectContent>
                {(clientesQ.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre} ({c.identificacion})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!clientesQ.data?.length && (
              <p className="text-xs text-muted-foreground">No hay clientes registrados aún.</p>
            )}
            {clienteId && !showNuevoCliente && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const c = clientesQ.data?.find((x) => x.id === clienteId);
                  if (c) {
                    setNuevoCliente(mapDbClienteToForm(c));
                    setNuevoClienteActividadDesc(c.actividadEconomica ?? "");
                    setShowNuevoCliente(true);
                  }
                }}
              >
                Editar datos del cliente (ubicación, correo…)
              </Button>
            )}
            <Button
              type="button"
              variant="link"
              className="h-auto px-0 text-xs"
              onClick={() => setShowNuevoCliente((v) => !v)}
            >
              {showNuevoCliente ? "Ocultar formulario de cliente" : "+ Agregar cliente FE"}
            </Button>
            {showNuevoCliente && exigirUbicacion && tipoDocumento !== "TIQUETE_ELECTRONICO" && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Complete provincia, cantón y distrito del cliente. Hacienda los exige al enviar el comprobante.
            </p>
          )}
          {showNuevoCliente && (
            <FeNuevoClienteSection
              nuevoCliente={nuevoCliente}
              setNuevoCliente={setNuevoCliente}
              nuevoClienteActividadDesc={nuevoClienteActividadDesc}
              setNuevoClienteActividadDesc={setNuevoClienteActividadDesc}
              haciendaClienteInfo={haciendaClienteInfo}
              setHaciendaClienteInfo={setHaciendaClienteInfo}
              setClienteLookupHint={setClienteLookupHint}
              clienteLookupLoading={clienteLookupLoading}
              clienteLookupHint={clienteLookupHint}
              clienteErrors={clienteErrors}
              clienteId={clienteId}
              companyCode={companyCode}
              exigirUbicacion={exigirUbicacion}
              tipoDocumento={tipoDocumento}
              guardarClienteM={guardarClienteM}
            />
          )}
          </div>

          <div className="space-y-2">
            <LabelWithHelp help="Fecha del comprobante. Hacienda valida que no sea una fecha futura ni muy anterior. Use formato AAAA-MM-DD.">
              Fecha
            </LabelWithHelp>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>

          <div className="space-y-2">
            <LabelWithHelp help="Moneda del comprobante. CRC = colones (no requiere tipo de cambio). USD/EUR requieren tipo de cambio referencial del BCCR.">
              Moneda
            </LabelWithHelp>
            <Select value={moneda} onValueChange={(v) => setMoneda(v as typeof moneda)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CRC">CRC — Colones</SelectItem>
                <SelectItem value="USD">USD — Dólares</SelectItem>
                <SelectItem value="EUR">EUR — Euros</SelectItem>
              </SelectContent>
            </Select>
            {moneda !== "CRC" && (
              <FieldHelp text="⚠ Tipo de cambio: se usa 1 (configure en BD si necesita diferente)" />
            )}
          </div>

          <div className="space-y-2">
            <LabelWithHelp help="Condición de venta según Hacienda. Contado = pago inmediato. Crédito = requiere plazo en días. Otros = requiere detalle.">
              Condición de venta
            </LabelWithHelp>
            <Select value={condicionVenta} onValueChange={setCondicionVenta}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CONTADO">Contado</SelectItem>
                <SelectItem value="CREDITO">Crédito</SelectItem>
                <SelectItem value="CONSIGNACION">Consignación</SelectItem>
                <SelectItem value="APARTADO">Apartado</SelectItem>
                <SelectItem value="ARRENDAMIENTO_OPCION_COMPRA">Arrendamiento opción compra</SelectItem>
                <SelectItem value="ARRENDAMIENTO_FUNCION_FINANCIERA">Arrendamiento función financiera</SelectItem>
                <SelectItem value="VENTA_MERCANCIA_NO_NACIONALIZADA">Venta mercancía no nacionalizada</SelectItem>
                <SelectItem value="VENTA_BIENES_USADOS">Venta bienes usados</SelectItem>
                <SelectItem value="ARRENDAMIENTO_OPERATIVO">Arrendamiento operativo</SelectItem>
                <SelectItem value="ARRENDAMIENTO_FINANCIERO">Arrendamiento financiero</SelectItem>
                <SelectItem value="OTROS">Otros</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <LabelWithHelp help="Medio de pago principal. Hacienda permite hasta 4 medios desglosados. Si selecciona 'Otros', debe indicar el detalle (mín. 3 caracteres).">
              Medio de pago
            </LabelWithHelp>
            <Select value={medioPago} onValueChange={setMedioPago}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                <SelectItem value="TARJETA">Tarjeta</SelectItem>
                <SelectItem value="TRANSFERENCIA_DEPOSITO">Transferencia</SelectItem>
                <SelectItem value="SINPE_MOVIL">SINPE Móvil</SelectItem>
                <SelectItem value="OTROS">Otros</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {medioPago === "OTROS" && !desglosarMediosPago && (
            <div className="space-y-2 sm:col-span-2">
              <LabelWithHelp required help="Detalle obligatorio cuando el medio de pago es 'Otros'. Mínimo 3 caracteres. Hacienda rechaza si está vacío.">
                Detalle medio de pago «Otros»
              </LabelWithHelp>
              <Input value={medioPagoOtro} onChange={(e) => setMedioPagoOtro(e.target.value)} />
              <FieldHelp
                error={medioPagoOtro.trim().length > 0 && medioPagoOtro.trim().length < 3 ? "Mínimo 3 caracteres" : null}
                valid={medioPagoOtro.trim().length >= 3}
                text="Mínimo 3 caracteres — Hacienda rechaza si está vacío"
              />
            </div>
          )}

          <div className="space-y-2 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={desglosarMediosPago}
                onChange={(e) => {
                  setDesglosarMediosPago(e.target.checked);
                  if (e.target.checked && mediosPagoRows.length === 1 && !mediosPagoRows[0]?.total) {
                    setMediosPagoRows([{ ...mediosPagoRows[0]!, total: String(totales.total) }]);
                  }
                }}
              />
              Desglosar hasta 4 medios de pago
            </label>
            {desglosarMediosPago && (
              <div className="space-y-2 rounded-md border p-3">
                {mediosPagoRows.map((row, idx) => (
                  <div key={row.key} className="grid gap-2 sm:grid-cols-3">
                    <Select
                      value={row.tipo}
                      onValueChange={(v) =>
                        setMediosPagoRows((prev) =>
                          prev.map((r) => (r.key === row.key ? { ...r, tipo: v } : r))
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                        <SelectItem value="TARJETA">Tarjeta</SelectItem>
                        <SelectItem value="TRANSFERENCIA_DEPOSITO">Transferencia</SelectItem>
                        <SelectItem value="SINPE_MOVIL">SINPE Móvil</SelectItem>
                        <SelectItem value="OTROS">Otros</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      placeholder="Monto"
                      value={row.total}
                      onChange={(e) =>
                        setMediosPagoRows((prev) =>
                          prev.map((r) => (r.key === row.key ? { ...r, total: e.target.value } : r))
                        )
                      }
                    />
                    {row.tipo === "OTROS" && (
                      <Input
                        placeholder="Detalle otros"
                        value={row.otro}
                        onChange={(e) =>
                          setMediosPagoRows((prev) =>
                            prev.map((r) => (r.key === row.key ? { ...r, otro: e.target.value } : r))
                          )
                        }
                      />
                    )}
                    {mediosPagoRows.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="sm:col-span-3"
                        onClick={() => setMediosPagoRows((prev) => prev.filter((r) => r.key !== row.key))}
                      >
                        Quitar medio {idx + 1}
                      </Button>
                    )}
                  </div>
                ))}
                {mediosPagoRows.length < 4 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setMediosPagoRows((prev) => [...prev, emptyMedioPago()])}
                  >
                    Agregar medio de pago
                  </Button>
                )}
              </div>
            )}
          </div>

          {condicionVenta === "CREDITO" && (
            <div className="space-y-2">
              <LabelWithHelp required help="Plazo en días para el crédito. Hacienda requiere este campo cuando la condición es 'Crédito'. Ej. 30, 60, 90.">
                Plazo crédito (días)
              </LabelWithHelp>
              <Input
                type="number"
                min={1}
                value={plazoCredito}
                onChange={(e) => setPlazoCredito(e.target.value)}
              />
              <FieldHelp
                error={!plazoCredito || Number(plazoCredito) < 1 ? "Requerido para crédito" : null}
                valid={Number(plazoCredito) >= 1}
                text="Días del plazo (ej. 30, 60, 90)"
              />
            </div>
          )}

          {condicionVenta === "OTROS" && (
            <div className="space-y-2 sm:col-span-2">
              <LabelWithHelp required help="Detalle obligatorio cuando la condición de venta es 'Otros'. Hacienda rechaza si está vacío.">
                Detalle condición «Otros»
              </LabelWithHelp>
              <Input value={condicionVentaOtro} onChange={(e) => setCondicionVentaOtro(e.target.value)} />
            </div>
          )}

          <div className="space-y-2 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={detallarOtrosCargos}
                onChange={(e) => setDetallarOtrosCargos(e.target.checked)}
              />
              Detallar otros cargos (hasta 15)
            </label>
            {!detallarOtrosCargos ? (
              <div className="space-y-2">
                <Label>Otros cargos (total)</Label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={totalOtrosCargos}
                  onChange={(e) => setTotalOtrosCargos(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-2 rounded-md border p-3">
                {otrosCargosRows.map((row, idx) => (
                  <div key={row.key} className="grid gap-2 sm:grid-cols-3">
                    <Select
                      value={row.tipoDocumento}
                      onValueChange={(v) =>
                        setOtrosCargosRows((prev) =>
                          prev.map((r) => (r.key === row.key ? { ...r, tipoDocumento: v } : r))
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="04">04 — Cobro tercero</SelectItem>
                        <SelectItem value="06">06 — Imp. servicio 10%</SelectItem>
                        <SelectItem value="99">99 — Otros</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Detalle"
                      value={row.detalle}
                      onChange={(e) =>
                        setOtrosCargosRows((prev) =>
                          prev.map((r) => (r.key === row.key ? { ...r, detalle: e.target.value } : r))
                        )
                      }
                    />
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      placeholder="Monto"
                      value={row.montoCargo}
                      onChange={(e) =>
                        setOtrosCargosRows((prev) =>
                          prev.map((r) => (r.key === row.key ? { ...r, montoCargo: e.target.value } : r))
                        )
                      }
                    />
                    {otrosCargosRows.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="sm:col-span-3"
                        onClick={() => setOtrosCargosRows((prev) => prev.filter((r) => r.key !== row.key))}
                      >
                        Quitar cargo {idx + 1}
                      </Button>
                    )}
                  </div>
                ))}
                {otrosCargosRows.length < 15 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setOtrosCargosRows((prev) => [...prev, emptyOtroCargo()])}
                  >
                    Agregar otro cargo
                  </Button>
                )}
              </div>
            )}
          </div>

          {(desglosarMediosPago ? mediosPagoRows.some((m) => m.tipo === "TARJETA") : medioPago === "TARJETA") && (
            <div className="space-y-2">
              <Label>IVA devuelto (salud/tarjeta)</Label>
              <Input
                type="number"
                min={0}
                step="any"
                value={totalIvaDevuelto}
                onChange={(e) => setTotalIvaDevuelto(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2 sm:col-span-2">
            <Label>Observaciones</Label>
            <Textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Detalle</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLineas((prev) => [...prev, emptyLine()])}
          >
            <Plus className="mr-2 h-4 w-4" />
            Línea
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {lineas.map((line, idx) => (
            <FeLineaDetalleRow
              key={line.key}
              line={line}
              idx={idx}
              canRemove={lineas.length > 1}
              tipoDocumento={tipoDocumento}
              companyCode={companyCode}
              setLineas={setLineas}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="text-sm">
            <p>Subtotal: {totales.subtotal.toLocaleString("es-CR")}</p>
            <p>Impuestos: {totales.totalImpuestos.toLocaleString("es-CR")}</p>
            {totales.totalOtrosCargos > 0 && (
              <p>Otros cargos: {totales.totalOtrosCargos.toLocaleString("es-CR")}</p>
            )}
            {totales.totalIvaDevuelto > 0 && (
              <p>IVA devuelto: −{totales.totalIvaDevuelto.toLocaleString("es-CR")}</p>
            )}
            <p className="text-lg font-semibold">Total: {totales.total.toLocaleString("es-CR")}</p>
          </div>
          <Button onClick={() => saveM.mutate()} disabled={saveM.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {saveM.isPending ? "Guardando…" : isEditMode ? "Guardar cambios" : "Guardar borrador"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
