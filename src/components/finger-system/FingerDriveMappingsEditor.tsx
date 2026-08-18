"use client";

import {
  DEFAULT_ATT_DRIVE_MAPPINGS,
  type AttDriveMapping,
} from "@/modules/finger-system/integrations/att2016/path-resolver";

const WIN = {
  field: "h-7 w-full border border-[#808080] bg-white px-2 text-[11px] font-mono",
  btn: "h-7 border border-[#808080] bg-[#ece9d8] text-[11px] hover:bg-[#f5f3ea] px-2",
  table: "w-full border-collapse text-[11px]",
  th: "border border-[#808080] bg-[#ece9d8] px-2 py-1 text-left font-semibold",
  td: "border border-[#808080] bg-white p-1 align-top",
};

type Props = {
  value: AttDriveMapping[];
  onChange: (next: AttDriveMapping[]) => void;
};

function nextFreeLetter(mappings: AttDriveMapping[]): string {
  const used = new Set(mappings.map((m) => m.letter.toUpperCase()));
  for (let code = 65; code <= 90; code++) {
    const letter = String.fromCharCode(code);
    if (!used.has(letter)) return letter;
  }
  return "Y";
}

export function FingerDriveMappingsEditor({ value, onChange }: Props) {
  const updateRow = (index: number, patch: Partial<AttDriveMapping>) => {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const removeRow = (index: number) => {
    if (value.length <= 1) return;
    onChange(value.filter((_, i) => i !== index));
  };

  const addRow = () => {
    const letter = nextFreeLetter(value);
    onChange([
      ...value,
      {
        letter,
        uncPath: "//10.1.1.3/NuevaCarpeta",
        label: `Nueva unidad (${letter}:)`,
      },
    ]);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold">Mapeos de unidades de red (Windows → SMB)</p>
        <div className="flex gap-1">
          <button type="button" className={WIN.btn} onClick={addRow}>
            + Agregar
          </button>
          <button
            type="button"
            className={WIN.btn}
            onClick={() =>
              onChange(
                DEFAULT_ATT_DRIVE_MAPPINGS.map((m) => ({
                  letter: m.letter,
                  uncPath: m.uncPath,
                  label: m.label,
                })),
              )
            }
          >
            Restaurar Alfa One
          </button>
        </div>
      </div>

      <p className="text-[10px] text-slate-600">
        Defina cómo se traduce cada letra de unidad (ej. X:) a la ruta SMB que usa el servidor.
        Debe coincidir con las unidades mapeadas en el equipo donde corre Attendance Management.
      </p>

      <div className="overflow-x-auto">
        <table className={WIN.table}>
          <thead>
            <tr>
              <th className={`${WIN.th} w-16`}>Unidad</th>
              <th className={WIN.th}>Ruta UNC / SMB</th>
              <th className={WIN.th}>Etiqueta (Explorador)</th>
              <th className={`${WIN.th} w-16`} />
            </tr>
          </thead>
          <tbody>
            {value.map((row, index) => (
              <tr key={`${row.letter}-${index}`}>
                <td className={WIN.td}>
                  <input
                    value={row.letter}
                    maxLength={1}
                    onChange={(e) =>
                      updateRow(index, { letter: e.target.value.toUpperCase().slice(0, 1) })
                    }
                    className={`${WIN.field} text-center uppercase`}
                    placeholder="X"
                  />
                </td>
                <td className={WIN.td}>
                  <input
                    value={row.uncPath}
                    onChange={(e) => updateRow(index, { uncPath: e.target.value })}
                    className={WIN.field}
                    placeholder="//10.1.1.3/DB-Biometrico"
                  />
                </td>
                <td className={WIN.td}>
                  <input
                    value={row.label}
                    onChange={(e) => updateRow(index, { label: e.target.value })}
                    className={WIN.field}
                    placeholder="DB-Biometrico (\\10.1.1.3) (X:)"
                  />
                </td>
                <td className={WIN.td}>
                  <button
                    type="button"
                    className={`${WIN.btn} w-full disabled:opacity-40`}
                    disabled={value.length <= 1}
                    onClick={() => removeRow(index)}
                    title="Eliminar mapeo"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
