"use client";

import {
  PERMISSION_REGISTRY,
  allPermissionKeys,
  type PermissionKey,
  type PermissionLevelId,
} from "@/lib/permissions/registry";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LEVEL_OPTIONS: { value: PermissionLevelId; label: string }[] = [
  { value: "none", label: "Sin acceso" },
  { value: "view", label: "Ver" },
  { value: "edit", label: "Editar" },
  { value: "admin", label: "Admin" },
];

type Props = {
  value: Record<string, PermissionLevelId>;
  onChange: (key: PermissionKey, level: PermissionLevelId) => void;
  disabled?: boolean;
};

export function RolePermissionMatrix({ value, onChange, disabled }: Props) {
  return (
    <div className="space-y-6">
      {Object.entries(PERMISSION_REGISTRY).map(([moduleKey, mod]) => (
        <div key={moduleKey} className="border rounded-lg overflow-hidden">
          <div className="bg-slate-100 px-4 py-2 font-semibold text-sm text-slate-800">
            {mod.label}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs text-slate-500">
                <th className="px-4 py-2 font-medium">Pantalla</th>
                <th className="px-4 py-2 font-medium w-40">Nivel</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(mod.screens).map(([screenKey, screen]) => {
                const key = `${moduleKey}.${screenKey}` as PermissionKey;
                const level = value[key] ?? "none";
                return (
                  <tr key={key} className="border-b last:border-0 hover:bg-muted/50/50">
                    <td className="px-4 py-2">
                      <div className="font-medium text-slate-800">{screen.label}</div>
                      <div className="text-xs text-slate-400 font-mono">{key}</div>
                    </td>
                    <td className="px-4 py-2">
                      <Select
                        value={level}
                        onValueChange={(v) => onChange(key, v as PermissionLevelId)}
                        disabled={disabled}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LEVEL_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

export function emptyPermissionMap(): Record<string, PermissionLevelId> {
  return Object.fromEntries(
    allPermissionKeys().map((k) => [k, "none" as PermissionLevelId])
  ) as Record<string, PermissionLevelId>;
}
