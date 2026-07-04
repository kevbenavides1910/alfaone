"use client";

import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldHelp, LabelWithHelp } from "@/components/ui/field-help";
import {
  PROVINCIAS_CR,
  findCantonName,
  findDistritoName,
  listCantones,
  listDistritos,
  padUbicacionCode,
} from "@/modules/facturacion-electronica/catalogos/cr-ubicacion";

export type FeUbicacionCrValue = {
  provincia: string;
  canton: string;
  distrito: string;
};

type FeUbicacionCrSelectsProps = {
  value: FeUbicacionCrValue;
  onChange: (next: FeUbicacionCrValue) => void;
  required?: boolean;
  disabled?: boolean;
  compact?: boolean;
};

export function FeUbicacionCrSelects({
  value,
  onChange,
  required = false,
  disabled = false,
  compact = false,
}: FeUbicacionCrSelectsProps) {
  const cantonCode = padUbicacionCode(value.canton);
  const distritoCode = padUbicacionCode(value.distrito);

  const cantones = useMemo(() => listCantones(value.provincia), [value.provincia]);
  const distritos = useMemo(
    () => listDistritos(value.provincia, cantonCode),
    [value.provincia, cantonCode]
  );

  const cantonValid = !value.provincia || Boolean(findCantonName(value.provincia, cantonCode));
  const distritoValid =
    !value.provincia || !cantonCode || Boolean(findDistritoName(value.provincia, cantonCode, distritoCode));

  const triggerClass = compact ? "h-8" : undefined;

  return (
    <>
      <div className="space-y-1">
        <LabelWithHelp
          className="text-xs"
          required={required}
          help="Provincia del receptor según catálogo de Hacienda (1=San José … 7=Limón)."
        >
          Provincia
        </LabelWithHelp>
        <Select
          value={value.provincia || undefined}
          disabled={disabled}
          onValueChange={(provincia) => onChange({ provincia, canton: "", distrito: "" })}
        >
          <SelectTrigger className={triggerClass}>
            <SelectValue placeholder="Seleccione provincia…" />
          </SelectTrigger>
          <SelectContent>
            {PROVINCIAS_CR.map((p) => (
              <SelectItem key={p.code} value={p.code}>
                {p.code} — {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldHelp
          error={required && !value.provincia ? "Provincia requerida" : null}
          valid={Boolean(value.provincia)}
        />
      </div>

      <div className="space-y-1">
        <LabelWithHelp
          className="text-xs"
          required={required}
          help="Cantón según la provincia seleccionada. Lista filtrada del catálogo oficial."
        >
          Cantón
        </LabelWithHelp>
        <Select
          value={cantonCode || undefined}
          disabled={disabled || !value.provincia}
          onValueChange={(canton) => onChange({ ...value, canton, distrito: "" })}
        >
          <SelectTrigger className={triggerClass}>
            <SelectValue placeholder={value.provincia ? "Seleccione cantón…" : "Primero seleccione provincia"} />
          </SelectTrigger>
          <SelectContent>
            {cantones.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.code} — {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldHelp
          error={
            required && value.provincia && !cantonCode
              ? "Cantón requerido"
              : cantonCode && !cantonValid
                ? "Cantón no válido para la provincia"
                : null
          }
          valid={Boolean(cantonCode && cantonValid)}
        />
      </div>

      <div className="space-y-1">
        <LabelWithHelp
          className="text-xs"
          required={required}
          help="Distrito según el cantón seleccionado. Lista filtrada del catálogo oficial."
        >
          Distrito
        </LabelWithHelp>
        <Select
          value={distritoCode || undefined}
          disabled={disabled || !value.provincia || !cantonCode}
          onValueChange={(distrito) => onChange({ ...value, distrito })}
        >
          <SelectTrigger className={triggerClass}>
            <SelectValue
              placeholder={
                !value.provincia
                  ? "Primero seleccione provincia"
                  : !cantonCode
                    ? "Primero seleccione cantón"
                    : "Seleccione distrito…"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {distritos.map((d) => (
              <SelectItem key={d.code} value={d.code}>
                {d.code} — {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldHelp
          error={
            required && cantonCode && !distritoCode
              ? "Distrito requerido"
              : distritoCode && !distritoValid
                ? "Distrito no válido para el cantón"
                : null
          }
          valid={Boolean(distritoCode && distritoValid)}
        />
      </div>
    </>
  );
}
