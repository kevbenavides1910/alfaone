"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldHelp, LabelWithHelp } from "@/components/ui/field-help";
import { FeCabysPicker } from "@/components/facturacion-electronica/FeCabysPicker";
import { FeTarifaIvaSelect } from "@/components/facturacion-electronica/FeTarifaIvaSelect";
import { tarifaPercentToCodigoTarifaIVA, isTarifaIvaSinMonto, codigoTarifaToPercent } from "@/modules/facturacion-electronica/utils/fe-tarifa-iva";
import { type LineaForm, lineTotals } from "./fe-nueva-types";

interface FeLineaDetalleRowProps {
  line: LineaForm;
  idx: number;
  canRemove: boolean;
  tipoDocumento: string;
  companyCode: string | null;
  setLineas: React.Dispatch<React.SetStateAction<LineaForm[]>>;
}

export function FeLineaDetalleRow({ line, idx, canRemove, tipoDocumento, companyCode, setLineas }: FeLineaDetalleRowProps) {
  return (
            <div key={line.key} className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Línea {idx + 1}</span>
                {canRemove && (
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
  );
}
