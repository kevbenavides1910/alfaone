"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  feTarifasIvaParaFactura,
  feTarifasIvaParaNotas,
} from "@/modules/facturacion-electronica/utils/fe-tarifa-iva";

type FeTarifaIvaSelectProps = {
  value: string;
  onValueChange: (codigo: string) => void;
  includeNotas?: boolean;
  disabled?: boolean;
};

export function FeTarifaIvaSelect({
  value,
  onValueChange,
  includeNotas = false,
  disabled,
}: FeTarifaIvaSelectProps) {
  const options = includeNotas ? feTarifasIvaParaNotas() : feTarifasIvaParaFactura();

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder="Seleccione tarifa IVA" />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.codigo} value={opt.codigo}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
