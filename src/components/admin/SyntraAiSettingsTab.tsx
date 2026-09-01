"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { OPENCODE_GO_MODELS, SYNTra_AI_PROVIDERS } from "@/modules/syntra-ai/business/syntra-ai-models";

type SettingsForm = {
  enabled: boolean;
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  modelVision: string;
  routeVisionAuto: boolean;
  modelDocuments: string;
  agentEnabled: boolean;
  agentMaxRounds: number;
  hasApiKey: boolean;
  apiKeyHint: string | null;
};

const emptyForm: SettingsForm = {
  enabled: false,
  provider: "opencode_go",
  baseUrl: "https://opencode.ai/zen/go/v1",
  apiKey: "",
  model: "kimi-k2.7-code",
  modelVision: "mimo-v2.5",
  routeVisionAuto: true,
  modelDocuments: "",
  agentEnabled: true,
  agentMaxRounds: 6,
  hasApiKey: false,
  apiKeyHint: null,
};

export function SyntraAiSettingsTab({ readOnly }: { readOnly: boolean }) {
  const [form, setForm] = useState<SettingsForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/syntra-ai/settings");
      const json = (await res.json()) as { data?: SettingsForm; error?: { message?: string } };
      if (!res.ok) throw new Error(json.error?.message || "No se pudo cargar");
      setForm({ ...emptyForm, ...json.data, apiKey: "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const payload = {
        enabled: form.enabled,
        provider: form.provider,
        baseUrl: form.baseUrl || null,
        model: form.model,
        modelVision: form.modelVision,
        routeVisionAuto: form.routeVisionAuto,
        modelDocuments: form.modelDocuments.trim() || null,
        agentEnabled: form.agentEnabled,
        agentMaxRounds: form.agentMaxRounds,
        ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
      };
      const res = await fetch("/api/admin/syntra-ai/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { data?: SettingsForm; error?: { message?: string } };
      if (!res.ok) throw new Error(json.error?.message || "Error al guardar");
      setForm((f) => ({ ...f, ...json.data, apiKey: "" }));
      setMessage("Configuración guardada.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/syntra-ai/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: form.provider,
          baseUrl: form.baseUrl || null,
          model: form.model,
          modelVision: form.modelVision,
          routeVisionAuto: form.routeVisionAuto,
          modelDocuments: form.modelDocuments.trim() || null,
          ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
        }),
      });
      const json = (await res.json()) as { data?: { message?: string }; error?: { message?: string } };
      if (!res.ok) throw new Error(json.error?.message || "Prueba fallida");
      setMessage(json.data?.message || "Conexión OK");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Prueba fallida");
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <p className="text-sm text-slate-500">Cargando configuración Syntra IA…</p>;

  return (
    <div className="space-y-4 max-w-2xl">
      <p className="text-sm text-slate-600">
        Proveedor, modelos y API key del chat flotante. La memoria de equipo y los skills colectivos son
        compartidos entre todos los usuarios.
      </p>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.enabled}
          disabled={readOnly}
          onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
        />
        Habilitar asistente IA
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Proveedor</Label>
          <select
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            disabled={readOnly}
            value={form.provider}
            onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
          >
            {SYNTra_AI_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>URL base API</Label>
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            disabled={readOnly}
            value={form.baseUrl}
            onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
            placeholder="https://opencode.ai/zen/go/v1"
          />
        </div>
      </div>

      <div>
        <Label>API Key {form.apiKeyHint ? `(actual: ${form.apiKeyHint})` : ""}</Label>
        <input
          type="password"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          disabled={readOnly}
          value={form.apiKey}
          onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
          placeholder={form.hasApiKey ? "Dejar vacío para no cambiar" : "Pegue la API key"}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Modelo general</Label>
          {form.provider === "opencode_go" ? (
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              disabled={readOnly}
              value={form.model}
              onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
            >
              {OPENCODE_GO_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              disabled={readOnly}
              value={form.model}
              onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
            />
          )}
        </div>
        <div>
          <Label>Modelo visión (imágenes)</Label>
          {form.provider === "opencode_go" ? (
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              disabled={readOnly}
              value={form.modelVision}
              onChange={(e) => setForm((f) => ({ ...f, modelVision: e.target.value }))}
            >
              {OPENCODE_GO_MODELS.filter((m) =>
                ["mimo-v2.5", "mimo-v2-omni", "kimi-k2.7-code", "kimi-k2.6", "kimi-k2.5", "kimi-k3"].includes(
                  m.id,
                ),
              ).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              disabled={readOnly}
              value={form.modelVision}
              onChange={(e) => setForm((f) => ({ ...f, modelVision: e.target.value }))}
            />
          )}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.routeVisionAuto}
          disabled={readOnly}
          onChange={(e) => setForm((f) => ({ ...f, routeVisionAuto: e.target.checked }))}
        />
        Cambiar automáticamente a modelo visión cuando hay imágenes
      </label>

      <div>
        <Label>Modelo documentos (opcional)</Label>
        <input
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          disabled={readOnly}
          value={form.modelDocuments}
          onChange={(e) => setForm((f) => ({ ...f, modelDocuments: e.target.value }))}
          placeholder="Vacío = usar modelo general"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.agentEnabled}
          disabled={readOnly}
          onChange={(e) => setForm((f) => ({ ...f, agentEnabled: e.target.checked }))}
        />
        Agente con consulta de datos (nómina NAF, gastos, contratos)
      </label>

      <div>
        <Label>Pasos máximos del agente (1–10)</Label>
        <input
          type="number"
          min={1}
          max={10}
          className="mt-1 w-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
          disabled={readOnly || !form.agentEnabled}
          value={form.agentMaxRounds}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              agentMaxRounds: Math.min(10, Math.max(1, Number(e.target.value) || 6)),
            }))
          }
        />
      </div>

      {!readOnly ? (
        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
          <Button type="button" variant="outline" onClick={() => void testConnection()} disabled={testing}>
            {testing ? "Probando…" : "Probar conexión"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
