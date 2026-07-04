"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
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
import { isUbicacionSelectionValid } from "@/modules/facturacion-electronica/catalogos/cr-ubicacion";
import { FeCabysPicker } from "@/components/facturacion-electronica/FeCabysPicker";
import type { FeContribuyenteLookup } from "@/modules/facturacion-electronica/services/hacienda/contribuyente-lookup.service";
import {
  actividadDescripcion,
  mapContribuyenteToClienteForm,
  mapDbClienteToForm,
} from "@/modules/facturacion-electronica/utils/fe-contribuyente-cliente-map";
import { isActividadEnCatalogo, toTribuCodigo } from "@/modules/facturacion-electronica/utils/hacienda-actividad";

type FeConfigResponse = {
  configured: boolean;
  empresa?: { exigirUbicacionReceptor?: boolean } | null;
  sucursales: Array<{
    id: string;
    codigo: string;
    nombre: string;
    puntosVenta: Array<{ id: string; codigo: string; nombre: string }>;
  }>;
};

type FeCliente = {
  id: string;
  nombre: string;
  identificacion: string;
  tipoIdentificacion: string;
  email?: string | null;
  telefono?: string | null;
  actividadEconomica?: string | null;
  direccionProvincia?: string | null;
  direccionCanton?: string | null;
  direccionDistrito?: string | null;
  direccionBarrio?: string | null;
  direccionOtras?: string | null;
};

type LineaForm = {
  key: string;
  codigoCabys: string;
  descripcion: string;
  cantidad: string;
  unidadMedida: string;
  precioUnitario: string;
  montoDescuento: string;
  naturalezaDescuento: string;
  codigoTarifaIVA: string;
  tarifaImpuesto: string;
  exonActiva: boolean;
  exonTipoDocumento: string;
  exonNumeroDocumento: string;
  exonNombreInstitucion: string;
  exonFechaEmision: string;
  exonPorcentaje: string;
  exonMonto: string;
  ivaCobradoFabrica: string;
  impuestoAsumidoFabrica: string;
  partidaArancelaria: string;
  montoImpuestoExportacion: string;
  cabysDescripcion: string;
};

type MedioPagoRow = {
  key: string;
  tipo: string;
  total: string;
  otro: string;
};

type OtroCargoRow = {
  key: string;
  tipoDocumento: string;
  detalle: string;
  montoCargo: string;
};

const emptyMedioPago = (): MedioPagoRow => ({
  key: crypto.randomUUID(),
  tipo: "TRANSFERENCIA_DEPOSITO",
  total: "",
  otro: "",
});

const emptyOtroCargo = (): OtroCargoRow => ({
  key: crypto.randomUUID(),
  tipoDocumento: "99",
  detalle: "",
  montoCargo: "",
});

const emptyLine = (): LineaForm => ({
  key: crypto.randomUUID(),
  codigoCabys: "",
  descripcion: "",
  cantidad: "1",
  unidadMedida: "Unid",
  precioUnitario: "0",
  montoDescuento: "0",
  naturalezaDescuento: "",
  codigoTarifaIVA: "08",
  tarifaImpuesto: "13",
  exonActiva: false,
  exonTipoDocumento: "02",
  exonNumeroDocumento: "",
  exonNombreInstitucion: "",
  exonFechaEmision: "",
  exonPorcentaje: "",
  exonMonto: "",
  ivaCobradoFabrica: "",
  impuestoAsumidoFabrica: "0",
  partidaArancelaria: "",
  montoImpuestoExportacion: "",
  cabysDescripcion: "",
});

// === Validaciones según reglas de Hacienda (Resolución 48-2016, v4.4) ===

const ID_RANGES: Record<string, { min: number; max: number; label: string }> = {
  FISICA: { min: 9, max: 9, label: "Cédula física — 9 dígitos (ej. 001120580)" },
  JURIDICA: { min: 10, max: 10, label: "Cédula jurídica — 10 dígitos (ej. 3101598499)" },
  DIMEX: { min: 11, max: 12, label: "DIMEX — 11 o 12 dígitos" },
  NITE: { min: 10, max: 10, label: "NITE — 10 dígitos" },
  EXTRANJERO: { min: 9, max: 20, label: "Identificación extranjera — 9 a 20 dígitos" },
};

function validateId(tipo: string, value: string): string | null {
  const digits = (value || "").replace(/\D/g, "");
  const range = ID_RANGES[tipo];
  if (!range) return null;
  if (!digits) return "Identificación requerida";
  if (digits.length < range.min || digits.length > range.max) {
    return `Debe tener ${range.min === range.max ? range.min : `${range.min}-${range.max}`} dígitos (actual: ${digits.length})`;
  }
  return null;
}

function validateCABYS(value: string): string | null {
  const digits = (value || "").replace(/\D/g, "");
  if (!digits) return "CABYS requerido";
  if (digits.length !== 13) return `Debe tener 13 dígitos (actual: ${digits.length})`;
  return null;
}

function validateEmail(value: string): string | null {
  if (!value?.trim()) return null; // opcional
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return "Formato de correo inválido";
  return null;
}

function validateActividadEconomica(value: string): string | null {
  if (!value?.trim()) return null;
  const tribu = toTribuCodigo(value);
  if (!tribu || !isActividadEnCatalogo(tribu)) {
    return "Seleccione una actividad del catálogo TRIBU (ej. 8010.0). Prefiera las registradas en Hacienda.";
  }
  return null;
}

function validateCliente(
  cliente: typeof nuevoClienteDefault,
  opts?: { exigirUbicacion?: boolean; esTiquete?: boolean }
): string[] {
  const errs: string[] = [];
  const idErr = validateId(cliente.tipoIdentificacion, cliente.identificacion);
  if (idErr) errs.push(`Identificación: ${idErr}`);
  if (!cliente.nombre.trim()) errs.push("Nombre del cliente es obligatorio");
  if (cliente.nombre.length > 80) errs.push("Nombre: máximo 80 caracteres");
  const emailErr = validateEmail(cliente.email);
  if (emailErr) errs.push(emailErr);
  const actErr = validateActividadEconomica(cliente.actividadEconomica);
  if (actErr) errs.push(`Actividad económica: ${actErr}`);
  if (
    opts?.exigirUbicacion &&
    !opts.esTiquete &&
    cliente.tipoIdentificacion !== "EXTRANJERO"
  ) {
    if (!cliente.direccionProvincia.trim()) errs.push("Provincia del cliente requerida");
    if (!cliente.direccionCanton.trim()) errs.push("Cantón del cliente requerido");
    if (!cliente.direccionDistrito.trim()) errs.push("Distrito del cliente requerido");
    else if (
      !isUbicacionSelectionValid(
        cliente.direccionProvincia,
        cliente.direccionCanton,
        cliente.direccionDistrito
      )
    ) {
      errs.push("Ubicación del cliente inválida (provincia, cantón o distrito no coinciden)");
    }
  }
  return errs;
}

const nuevoClienteDefault = {
  tipoIdentificacion: "JURIDICA",
  identificacion: "",
  nombre: "",
  email: "",
  telefono: "",
  direccionProvincia: "",
  direccionCanton: "",
  direccionDistrito: "",
  direccionBarrio: "",
  direccionOtras: "",
  actividadEconomica: "",
};

function lineTotals(line: LineaForm) {
  const cantidad = Number(line.cantidad) || 0;
  const precio = Number(line.precioUnitario) || 0;
  const descuento = Number(line.montoDescuento) || 0;
  const codigoTarifa = line.codigoTarifaIVA || "08";
  const tarifa = isTarifaIvaSinMonto(codigoTarifa)
    ? 0
    : Number(line.tarifaImpuesto) || codigoTarifaToPercent(codigoTarifa);
  const base = Math.max(0, cantidad * precio - descuento);
  const montoImpuestoBruto = isTarifaIvaSinMonto(codigoTarifa)
    ? 0
    : Math.round(base * (tarifa / 100) * 100000) / 100000;
  let exonMonto = Number(line.exonMonto) || 0;
  if (line.exonActiva && exonMonto <= 0) {
    const pct = Number(line.exonPorcentaje) || 0;
    if (pct > 0) exonMonto = Math.round(base * (pct / 100) * 100000) / 100000;
  }
  const impuestoAsumido = Number(line.impuestoAsumidoFabrica) || 0;
  const montoImpuesto = Math.max(0, montoImpuestoBruto - exonMonto - impuestoAsumido);
  const totalLinea = Math.round((base + montoImpuesto) * 100000) / 100000;
  return { base, montoImpuestoBruto, montoImpuesto, exonMonto, totalLinea };
}

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
              <div className="mt-2 grid gap-2 rounded-md border p-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <LabelWithHelp className="text-xs" required help="Tipo de identificación del receptor según Hacienda. Física: 9 dígitos, Jurídica: 10, DIMEX: 11-12, NITE: 10, Extranjero: 9-20.">
                    Tipo ID
                  </LabelWithHelp>
                  <Select
                    value={nuevoCliente.tipoIdentificacion}
                    onValueChange={(v) => setNuevoCliente((c) => ({ ...c, tipoIdentificacion: v }))}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FISICA">Física — 9 dígitos</SelectItem>
                      <SelectItem value="JURIDICA">Jurídica — 10 dígitos</SelectItem>
                      <SelectItem value="DIMEX">DIMEX — 11-12 dígitos</SelectItem>
                      <SelectItem value="NITE">NITE — 10 dígitos</SelectItem>
                      <SelectItem value="EXTRANJERO">Extranjero — 9-20 dígitos</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldHelp text={ID_RANGES[nuevoCliente.tipoIdentificacion]?.label ?? ""} />
                </div>
                <div className="space-y-1">
                  <LabelWithHelp className="text-xs" required help="Número de cédula o identificación sin guiones. Al completar la longitud correcta se consulta Hacienda para autocompletar el nombre.">
                    {nuevoCliente.tipoIdentificacion === "JURIDICA"
                      ? "Cédula jurídica"
                      : nuevoCliente.tipoIdentificacion === "FISICA"
                        ? "Cédula física"
                        : "Identificación"}
                  </LabelWithHelp>
                  <Input
                    className="h-8"
                    value={nuevoCliente.identificacion}
                    onChange={(e) => {
                      setClienteLookupHint(null);
                      setHaciendaClienteInfo(null);
                      setNuevoCliente((c) => ({ ...c, identificacion: e.target.value.replace(/\D/g, "") }));
                    }}
                    placeholder={nuevoCliente.tipoIdentificacion === "FISICA" ? "001120580" : nuevoCliente.tipoIdentificacion === "JURIDICA" ? "3101598499" : ""}
                  />
                  <FieldHelp
                    error={validateId(nuevoCliente.tipoIdentificacion, nuevoCliente.identificacion)}
                    valid={!validateId(nuevoCliente.tipoIdentificacion, nuevoCliente.identificacion) && nuevoCliente.identificacion.length > 0}
                    text={
                      clienteLookupLoading
                        ? "Consultando Hacienda…"
                        : clienteLookupHint ??
                          `${nuevoCliente.identificacion.replace(/\D/g, "").length} dígitos`
                    }
                  />
                </div>
                {haciendaClienteInfo ? (
                  <div className="sm:col-span-2 rounded-md border border-emerald-200 bg-emerald-50/80 p-2 text-xs dark:border-emerald-900 dark:bg-emerald-950/30">
                    <p className="font-medium text-emerald-800 dark:text-emerald-200">Información tributaria (Hacienda)</p>
                    <ul className="mt-1 space-y-0.5 text-muted-foreground">
                      {haciendaClienteInfo.regimen?.descripcion ? (
                        <li>Régimen: {haciendaClienteInfo.regimen.descripcion}</li>
                      ) : null}
                      {haciendaClienteInfo.situacion?.estado ? (
                        <li>Situación: {haciendaClienteInfo.situacion.estado}</li>
                      ) : null}
                      {haciendaClienteInfo.situacion?.administracionTributaria ? (
                        <li>Administración: {haciendaClienteInfo.situacion.administracionTributaria}</li>
                      ) : null}
                      {(haciendaClienteInfo.situacion?.moroso || haciendaClienteInfo.situacion?.omiso) ? (
                        <li>
                          Moroso: {haciendaClienteInfo.situacion?.moroso ?? "—"} · Omiso:{" "}
                          {haciendaClienteInfo.situacion?.omiso ?? "—"}
                        </li>
                      ) : null}
                    </ul>
                  </div>
                ) : null}
                <div className="space-y-1 sm:col-span-2">
                  <LabelWithHelp className="text-xs" required help="Nombre o razón social del receptor. Se autocompleta al ingresar la cédula. Máximo 80 caracteres.">
                    Nombre / Razón social
                  </LabelWithHelp>
                  <Input
                    className="h-8"
                    value={nuevoCliente.nombre}
                    onChange={(e) => setNuevoCliente((c) => ({ ...c, nombre: e.target.value }))}
                    maxLength={80}
                  />
                  <FieldHelp
                    text="Como aparece registrado en Hacienda"
                    valid={nuevoCliente.nombre.trim().length > 0}
                    error={!nuevoCliente.nombre.trim() ? "Nombre obligatorio" : null}
                    maxLength={80}
                    currentLength={nuevoCliente.nombre.length}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <LabelWithHelp className="text-xs" help="Correo del cliente donde se enviará automáticamente el XML y PDF del comprobante cuando Hacienda lo acepte. Requerido para envío automático.">
                    Correo (para envío de comprobante)
                  </LabelWithHelp>
                  <Input
                    className="h-8"
                    type="email"
                    value={nuevoCliente.email}
                    onChange={(e) => setNuevoCliente((c) => ({ ...c, email: e.target.value }))}
                    placeholder="cliente@empresa.com"
                  />
                  <FieldHelp
                    error={validateEmail(nuevoCliente.email)}
                    valid={nuevoCliente.email.trim().length > 0 && !validateEmail(nuevoCliente.email)}
                    text="Se envía el comprobante automático al aceptar Hacienda"
                  />
                </div>
                <div className="space-y-1">
                  <LabelWithHelp className="text-xs" help="Teléfono del receptor (8-20 dígitos). Hacienda no lo publica; ingréselo manualmente si lo tiene.">
                    Teléfono
                  </LabelWithHelp>
                  <Input
                    className="h-8"
                    value={nuevoCliente.telefono}
                    onChange={(e) => setNuevoCliente((c) => ({ ...c, telefono: e.target.value.replace(/\D/g, "").slice(0, 20) }))}
                    placeholder="22223333"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <LabelWithHelp className="text-xs" help="Código de actividad económica del receptor según catálogo TRIBU de Hacienda. Puede ingresarse como 6 dígitos (702000) o formato TRIBU (7020.0). Opcional pero recomendado.">
                    Actividad económica (TRIBU)
                  </LabelWithHelp>
                  {companyCode ? (
                    <FeCatalogSearchPicker
                      companyCode={companyCode}
                      kind="actividad"
                      value={nuevoCliente.actividadEconomica}
                      selectedDescription={nuevoClienteActividadDesc}
                      identificacion={nuevoCliente.identificacion}
                      onSelect={(item) => {
                        setNuevoCliente((c) => ({ ...c, actividadEconomica: item.codigo }));
                        setNuevoClienteActividadDesc(item.descripcion);
                      }}
                    />
                  ) : null}
                  <Input
                    className="h-8"
                    value={nuevoCliente.actividadEconomica}
                    placeholder="7020.0 o 702000"
                    onChange={(e) => {
                      setNuevoClienteActividadDesc("");
                      setNuevoCliente((c) => ({ ...c, actividadEconomica: e.target.value }));
                    }}
                  />
                  <FieldHelp
                    error={validateActividadEconomica(nuevoCliente.actividadEconomica)}
                    valid={nuevoCliente.actividadEconomica.trim().length > 0 && !validateActividadEconomica(nuevoCliente.actividadEconomica)}
                    text="Ej. 7020.0 (vigilancia privada) — 6 dígitos o formato TRIBU"
                  />
                  {haciendaClienteInfo && haciendaClienteInfo.actividades.length > 1 ? (
                    <div className="space-y-1 pt-1">
                      <LabelWithHelp className="text-xs" help="Seleccione cuál actividad registrada en Hacienda aplicar al comprobante.">
                        Actividad registrada en Hacienda
                      </LabelWithHelp>
                      <Select
                        value={nuevoCliente.actividadEconomica || undefined}
                        onValueChange={(v) => {
                          const act = haciendaClienteInfo.actividades.find((a) => a.codigo === v);
                          setNuevoCliente((c) => ({ ...c, actividadEconomica: v }));
                          setNuevoClienteActividadDesc(act?.descripcion ?? "");
                        }}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Seleccione actividad…" />
                        </SelectTrigger>
                        <SelectContent>
                          {haciendaClienteInfo.actividades.map((a) => (
                            <SelectItem key={a.codigo} value={a.codigo}>
                              {a.codigo} — {a.descripcion}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </div>
                <FeUbicacionCrSelects
                  compact
                  required={exigirUbicacion && tipoDocumento !== "TIQUETE_ELECTRONICO"}
                  value={{
                    provincia: nuevoCliente.direccionProvincia,
                    canton: nuevoCliente.direccionCanton,
                    distrito: nuevoCliente.direccionDistrito,
                  }}
                  onChange={(next) =>
                    setNuevoCliente((c) => ({
                      ...c,
                      direccionProvincia: next.provincia,
                      direccionCanton: next.canton,
                      direccionDistrito: next.distrito,
                    }))
                  }
                />
                <div className="space-y-1">
                  <LabelWithHelp className="text-xs" help="Nombre del barrio. Opcional. Máximo 50 caracteres.">
                    Barrio
                  </LabelWithHelp>
                  <Input
                    className="h-8"
                    value={nuevoCliente.direccionBarrio}
                    maxLength={50}
                    onChange={(e) => setNuevoCliente((c) => ({ ...c, direccionBarrio: e.target.value }))}
                  />
                  <FieldHelp text="Opcional — máximo 50 caracteres" maxLength={50} currentLength={nuevoCliente.direccionBarrio.length} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <LabelWithHelp className="text-xs" help="Otras señas o referencia de ubicación. Se autocompleta con resumen tributario de Hacienda si no hay dirección exacta.">
                    Otras señas / notas
                  </LabelWithHelp>
                  <Textarea
                    className="min-h-[56px] text-sm"
                    value={nuevoCliente.direccionOtras}
                    maxLength={500}
                    onChange={(e) => setNuevoCliente((c) => ({ ...c, direccionOtras: e.target.value }))}
                  />
                </div>
                {(() => {
                  const errs = validateCliente(nuevoCliente, {
                    exigirUbicacion,
                    esTiquete: tipoDocumento === "TIQUETE_ELECTRONICO",
                  });
                  return errs.length > 0 ? (
                    <div className="sm:col-span-2 rounded-md border border-red-200 bg-red-50 p-2 dark:border-red-900 dark:bg-red-950/40">
                      <p className="text-xs font-medium text-red-600 mb-1">Corrija antes de guardar:</p>
                      <ul className="list-disc list-inside text-xs text-red-600 space-y-0.5">
                        {errs.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </div>
                  ) : null;
                })()}
                <Button
                  type="button"
                  size="sm"
                  className="sm:col-span-2"
                  disabled={
                    guardarClienteM.isPending ||
                    validateCliente(nuevoCliente, {
                      exigirUbicacion,
                      esTiquete: tipoDocumento === "TIQUETE_ELECTRONICO",
                    }).length > 0
                  }
                  onClick={() => guardarClienteM.mutate()}
                >
                  {guardarClienteM.isPending
                    ? "Guardando…"
                    : clienteId
                      ? "Actualizar cliente"
                      : "Guardar cliente"}
                </Button>
              </div>
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
            <div key={line.key} className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Línea {idx + 1}</span>
                {lineas.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setLineas((prev) => prev.filter((l) => l.key !== line.key))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <LabelWithHelp required help="Código CABYS del producto/servicio (13 dígitos). Use «Explorar catálogo» para navegar por categorías o busque por palabra clave. Ej. 8525000000000 (servicios de seguridad física).">
                    Código CABYS (13 dígitos)
                  </LabelWithHelp>
                  {companyCode ? (
                    <FeCabysPicker
                      companyCode={companyCode}
                      value={line.codigoCabys}
                      selectedDescription={line.cabysDescripcion}
                      onSelect={(item) => {
                        const tarifaFromCabys =
                          item.impuesto != null ? tarifaPercentToCodigoTarifaIVA(item.impuesto) : null;
                        setLineas((prev) =>
                          prev.map((l) =>
                            l.key === line.key
                              ? {
                                  ...l,
                                  codigoCabys: item.codigo.replace(/\D/g, "").slice(0, 13),
                                  cabysDescripcion: item.descripcion,
                                  descripcion: l.descripcion.trim() ? l.descripcion : item.descripcion.slice(0, 160),
                                  ...(tarifaFromCabys
                                    ? {
                                        codigoTarifaIVA: tarifaFromCabys,
                                        tarifaImpuesto: String(item.impuesto),
                                      }
                                    : {}),
                                }
                              : l
                          )
                        );
                      }}
                    />
                  ) : null}
                  <Input
                    value={line.codigoCabys}
                    placeholder="8525000000000"
                    maxLength={13}
                    onChange={(e) =>
                      setLineas((prev) =>
                        prev.map((l) =>
                          l.key === line.key
                            ? { ...l, codigoCabys: e.target.value.replace(/\D/g, ""), cabysDescripcion: "" }
                            : l
                        )
                      )
                    }
                  />
                  <FieldHelp
                    error={line.codigoCabys.length > 0 && line.codigoCabys.length !== 13 ? `Faltan ${13 - line.codigoCabys.length} dígitos` : null}
                    valid={line.codigoCabys.length === 13}
                    text="Catálogo de Hacienda — exactamente 13 dígitos"
                    maxLength={13}
                    currentLength={line.codigoCabys.length}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <LabelWithHelp required help="Descripción del bien o servicio. Obligatorio. Máximo 160 caracteres. Sea específico (ej. 'Servicio de vigilancia privada mensual').">
                    Descripción
                  </LabelWithHelp>
                  <Input
                    value={line.descripcion}
                    maxLength={160}
                    onChange={(e) =>
                      setLineas((prev) =>
                        prev.map((l) => (l.key === line.key ? { ...l, descripcion: e.target.value } : l))
                      )
                    }
                  />
                  <FieldHelp
                    error={!line.descripcion.trim() && line.codigoCabys.length === 13 ? "Descripción obligatoria" : null}
                    valid={line.descripcion.trim().length > 0}
                    text="Máximo 160 caracteres — sea específico"
                    maxLength={160}
                    currentLength={line.descripcion.length}
                  />
                </div>
                <div className="space-y-2">
                  <LabelWithHelp required help="Cantidad del bien o servicio. Debe ser mayor a 0. Decimales permitidos (ej. 1.5).">
                    Cantidad
                  </LabelWithHelp>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={line.cantidad}
                    onChange={(e) =>
                      setLineas((prev) =>
                        prev.map((l) => (l.key === line.key ? { ...l, cantidad: e.target.value } : l))
                      )
                    }
                  />
                  <FieldHelp
                    error={Number(line.cantidad) <= 0 ? "Debe ser mayor a 0" : null}
                    valid={Number(line.cantidad) > 0}
                    text="Mayor a 0 (decimales OK)"
                  />
                </div>
                <div className="space-y-2">
                  <LabelWithHelp help="Unidad de medida según catálogo de Hacienda. Códigos válidos: Unid, Sp, kg, g, m, km, l, ml, h, seg, etc. Por defecto: Unid (unidades).">
                    Unidad de medida
                  </LabelWithHelp>
                  <Select
                    value={line.unidadMedida}
                    onValueChange={(v) =>
                      setLineas((prev) =>
                        prev.map((l) => (l.key === line.key ? { ...l, unidadMedida: v } : l))
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Unid">Unid — Unidades</SelectItem>
                      <SelectItem value="Sp">Sp — Servicios profesionales</SelectItem>
                      <SelectItem value="kg">kg — Kilogramos</SelectItem>
                      <SelectItem value="g">g — Gramos</SelectItem>
                      <SelectItem value="m">m — Metros</SelectItem>
                      <SelectItem value="km">km — Kilómetros</SelectItem>
                      <SelectItem value="l">l — Litros</SelectItem>
                      <SelectItem value="ml">ml — Mililitros</SelectItem>
                      <SelectItem value="h">h — Horas</SelectItem>
                      <SelectItem value="seg">seg — Segundos</SelectItem>
                      <SelectItem value="m2">m² — Metros cuadrados</SelectItem>
                      <SelectItem value="m3">m³ — Metros cúbicos</SelectItem>
                      <SelectItem value="Otros">Otros — Especificar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <LabelWithHelp required help="Precio por unidad sin IVA. Debe ser mayor a 0. El IVA se calcula automáticamente según la tarifa seleccionada.">
                    Precio unitario (sin IVA)
                  </LabelWithHelp>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={line.precioUnitario}
                    onChange={(e) =>
                      setLineas((prev) =>
                        prev.map((l) =>
                          l.key === line.key ? { ...l, precioUnitario: e.target.value } : l
                        )
                      )
                    }
                  />
                  <FieldHelp
                    error={Number(line.precioUnitario) <= 0 ? "Debe ser mayor a 0" : null}
                    valid={Number(line.precioUnitario) > 0}
                    text="Precio neto sin IVA — el IVA se calcula automático"
                  />
                </div>
                <div className="space-y-2">
                  <LabelWithHelp help="Monto de descuento (opcional). Si es mayor a 0, debe indicar la naturaleza del descuento (ej. 'Descuento comercial').">
                    Descuento
                  </LabelWithHelp>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={line.montoDescuento}
                    onChange={(e) =>
                      setLineas((prev) =>
                        prev.map((l) =>
                          l.key === line.key ? { ...l, montoDescuento: e.target.value } : l
                        )
                      )
                    }
                  />
                  <FieldHelp
                    text="Si > 0, requiere naturaleza del descuento"
                    valid={Number(line.montoDescuento) === 0}
                    error={Number(line.montoDescuento) > 0 && (!line.naturalezaDescuento || line.naturalezaDescuento.trim().length < 3) ? "Naturaleza requerida (mín. 3 caracteres)" : null}
                  />
                </div>
                {Number(line.montoDescuento) > 0 && (
                  <div className="space-y-2 sm:col-span-2">
                    <LabelWithHelp required help="Descripción del motivo del descuento. Mínimo 3 caracteres, máximo 80. Hacienda rechaza si el descuento > 0 y este campo está vacío.">
                      Naturaleza del descuento
                    </LabelWithHelp>
                    <Input
                      value={line.naturalezaDescuento}
                      placeholder="Descuento comercial"
                      maxLength={80}
                      onChange={(e) =>
                        setLineas((prev) =>
                          prev.map((l) =>
                            l.key === line.key ? { ...l, naturalezaDescuento: e.target.value } : l
                          )
                        )
                      }
                    />
                    <FieldHelp
                      error={line.naturalezaDescuento.trim().length > 0 && line.naturalezaDescuento.trim().length < 3 ? "Mínimo 3 caracteres" : null}
                      valid={line.naturalezaDescuento.trim().length >= 3}
                      text="Hacienda requiere este campo cuando hay descuento"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <LabelWithHelp required help="Tarifa de IVA según catálogo Hacienda v4.4 (nota 8.1). Al elegir CABYS se sugiere la tarifa del catálogo.">
                    Tarifa IVA
                  </LabelWithHelp>
                  <FeTarifaIvaSelect
                    value={line.codigoTarifaIVA}
                    onValueChange={(v) =>
                      setLineas((prev) =>
                        prev.map((l) =>
                          l.key === line.key
                            ? {
                                ...l,
                                codigoTarifaIVA: v,
                                tarifaImpuesto: String(codigoTarifaToPercent(v)),
                              }
                            : l
                        )
                      )
                    }
                  />
                </div>
                {!isTarifaIvaSinMonto(line.codigoTarifaIVA) && (
                  <div className="space-y-2">
                    <Label>IVA %</Label>
                    <Input
                      type="number"
                      min={0}
                      value={line.tarifaImpuesto}
                      onChange={(e) =>
                        setLineas((prev) =>
                          prev.map((l) =>
                            l.key === line.key ? { ...l, tarifaImpuesto: e.target.value } : l
                          )
                        )
                      }
                    />
                  </div>
                )}
                <div className="space-y-2 sm:col-span-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={line.exonActiva}
                      onChange={(e) =>
                        setLineas((prev) =>
                          prev.map((l) =>
                            l.key === line.key ? { ...l, exonActiva: e.target.checked } : l
                          )
                        )
                      }
                    />
                    Línea con exoneración de IVA
                  </label>
                </div>
                {line.exonActiva && (
                  <>
                    <div className="space-y-2">
                      <Label>Tipo doc. exoneración</Label>
                      <Select
                        value={line.exonTipoDocumento}
                        onValueChange={(v) =>
                          setLineas((prev) =>
                            prev.map((l) => (l.key === line.key ? { ...l, exonTipoDocumento: v } : l))
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="01">01 — Compras autorizadas</SelectItem>
                          <SelectItem value="02">02 — Ventas exentas diplomáticos</SelectItem>
                          <SelectItem value="03">03 — Ley especial</SelectItem>
                          <SelectItem value="04">04 — Exenciones DGH</SelectItem>
                          <SelectItem value="99">99 — Otros</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Número documento</Label>
                      <Input
                        value={line.exonNumeroDocumento}
                        onChange={(e) =>
                          setLineas((prev) =>
                            prev.map((l) =>
                              l.key === line.key ? { ...l, exonNumeroDocumento: e.target.value } : l
                            )
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Institución</Label>
                      <Input
                        value={line.exonNombreInstitucion}
                        onChange={(e) =>
                          setLineas((prev) =>
                            prev.map((l) =>
                              l.key === line.key ? { ...l, exonNombreInstitucion: e.target.value } : l
                            )
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Fecha documento</Label>
                      <Input
                        type="date"
                        value={line.exonFechaEmision}
                        onChange={(e) =>
                          setLineas((prev) =>
                            prev.map((l) =>
                              l.key === line.key ? { ...l, exonFechaEmision: e.target.value } : l
                            )
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>% exonerado</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={line.exonPorcentaje}
                        onChange={(e) =>
                          setLineas((prev) =>
                            prev.map((l) =>
                              l.key === line.key ? { ...l, exonPorcentaje: e.target.value } : l
                            )
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Monto exoneración (opcional)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={line.exonMonto}
                        onChange={(e) =>
                          setLineas((prev) =>
                            prev.map((l) => (l.key === line.key ? { ...l, exonMonto: e.target.value } : l))
                          )
                        }
                      />
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <Label>IVA cobrado fábrica</Label>
                  <Select
                    value={line.ivaCobradoFabrica || "none"}
                    onValueChange={(v) =>
                      setLineas((prev) =>
                        prev.map((l) =>
                          l.key === line.key
                            ? { ...l, ivaCobradoFabrica: v === "none" ? "" : v }
                            : l
                        )
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No aplica" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No aplica</SelectItem>
                      <SelectItem value="01">01 — Gravado</SelectItem>
                      <SelectItem value="02">02 — Exento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Impuesto asumido fábrica</Label>
                  <Input
                    type="number"
                    min={0}
                    value={line.impuestoAsumidoFabrica}
                    onChange={(e) =>
                      setLineas((prev) =>
                        prev.map((l) =>
                          l.key === line.key ? { ...l, impuestoAsumidoFabrica: e.target.value } : l
                        )
                      )
                    }
                  />
                </div>
                {tipoDocumento === "FACTURA_ELECTRONICA_EXPORTACION" && (
                  <>
                    <div className="space-y-2">
                      <Label>Partida arancelaria</Label>
                      <Input
                        value={line.partidaArancelaria}
                        onChange={(e) =>
                          setLineas((prev) =>
                            prev.map((l) =>
                              l.key === line.key ? { ...l, partidaArancelaria: e.target.value } : l
                            )
                          )
                        }
                        placeholder="12 dígitos"
                        maxLength={12}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Monto impuesto exportación</Label>
                      <Input
                        type="number"
                        min={0}
                        value={line.montoImpuestoExportacion}
                        onChange={(e) =>
                          setLineas((prev) =>
                            prev.map((l) =>
                              l.key === line.key ? { ...l, montoImpuestoExportacion: e.target.value } : l
                            )
                          )
                        }
                      />
                    </div>
                  </>
                )}
                <div className="flex items-end sm:col-span-2">
                  <p className="text-sm text-muted-foreground">
                    Total línea:{" "}
                    <span className="font-medium text-foreground">
                      {lineTotals(line).totalLinea.toLocaleString("es-CR")}
                    </span>
                  </p>
                </div>
              </div>
            </div>
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
