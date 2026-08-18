import { connect } from "node:net";

export type TcpProbeResult = {
  reachable: boolean;
  latencyMs: number | null;
  error: string | null;
};

/** Verifica si un host responde en el puerto TCP (timeout configurable). */
export function probeTcpPort(
  host: string,
  port: number,
  timeoutMs = 4000,
): Promise<TcpProbeResult> {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = connect({ host, port, timeout: timeoutMs });

    const finish = (reachable: boolean, error: string | null) => {
      socket.destroy();
      resolve({
        reachable,
        latencyMs: reachable ? Date.now() - started : null,
        error,
      });
    };

    socket.once("connect", () => finish(true, null));
    socket.once("timeout", () => finish(false, "Timeout de conexión"));
    socket.once("error", (err) => finish(false, err.message));
  });
}
