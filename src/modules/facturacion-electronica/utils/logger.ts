type FeLogLevel = "debug" | "info" | "warn" | "error";

type FeLogPayload = Record<string, unknown>;

function emit(level: FeLogLevel, message: string, payload?: FeLogPayload) {
  const entry = {
    ts: new Date().toISOString(),
    module: "facturacion-electronica",
    level,
    message,
    ...payload,
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const feLogger = {
  debug: (message: string, payload?: FeLogPayload) => emit("debug", message, payload),
  info: (message: string, payload?: FeLogPayload) => emit("info", message, payload),
  warn: (message: string, payload?: FeLogPayload) => emit("warn", message, payload),
  error: (message: string, payload?: FeLogPayload) => emit("error", message, payload),
};
