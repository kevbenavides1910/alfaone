import {
  createZkProtocolClient,
  type ZkAttendanceRecord,
  type ZkUserRecord,
} from "./zk-protocol";
import type {
  BiometricDeviceAdapter,
  BiometricDeviceStatus,
  BiometricFingerTemplate,
  BiometricSetUserParams,
} from "./types";
import { probeTcpPort } from "./tcp-probe";

export type ZKTecoAdapterOptions = {
  ipAddress: string;
  port?: number;
  timeoutMs?: number;
  commKey?: number;
};

/** Adaptador ZKTeco vía TCP 4370 + protocolo ZK nativo. */
export class ZKTecoAdapter implements BiometricDeviceAdapter {
  private readonly ipAddress: string;
  private readonly port: number;
  private readonly timeoutMs: number;
  private readonly commKey?: number;
  private connected = false;

  constructor(options: ZKTecoAdapterOptions) {
    this.ipAddress = options.ipAddress;
    this.port = options.port ?? 4370;
    this.timeoutMs = options.timeoutMs ?? 8000;
    this.commKey = options.commKey;
  }

  private client() {
    return createZkProtocolClient({
      ipAddress: this.ipAddress,
      port: this.port,
      timeoutMs: this.timeoutMs,
      commKey: this.commKey,
    });
  }

  async connect(): Promise<void> {
    const probe = await probeTcpPort(this.ipAddress, this.port, this.timeoutMs);
    if (!probe.reachable) {
      throw new Error(probe.error ?? "Dispositivo no responde en el puerto biométrico.");
    }
    const zk = this.client();
    await zk.connect();
    await zk.disconnect();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async getStatus(): Promise<BiometricDeviceStatus> {
    const probe = await probeTcpPort(this.ipAddress, this.port, this.timeoutMs);
    if (probe.reachable) return "online";
    return probe.error?.includes("Timeout") ? "offline" : "error";
  }

  async getDeviceInfo(): Promise<Record<string, string | number | null>> {
    const probe = await probeTcpPort(this.ipAddress, this.port, this.timeoutMs);
    return {
      ipAddress: this.ipAddress,
      port: this.port,
      reachable: probe.reachable ? 1 : 0,
      latencyMs: probe.latencyMs,
      protocol: "ZK-TCP",
      connected: this.connected ? 1 : 0,
    };
  }

  async getUsers(): Promise<ZkUserRecord[]> {
    const zk = this.client();
    try {
      await zk.connect();
      return await zk.getUsers();
    } finally {
      await zk.disconnect().catch(() => undefined);
    }
  }

  async getAttendance(from: Date, to: Date): Promise<ZkAttendanceRecord[]> {
    const zk = this.client();
    try {
      await zk.connect();
      return await zk.getAttendance(from, to);
    } finally {
      await zk.disconnect().catch(() => undefined);
    }
  }

  async sync(): Promise<{ ok: boolean; message: string }> {
    const zk = this.client();
    try {
      await zk.connect();
      const users = await zk.getUsers().catch(() => []);
      return {
        ok: true,
        message: `Dispositivo ZK en línea (${users.length} usuarios en memoria).`,
      };
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : "Dispositivo sin respuesta en la red.",
      };
    } finally {
      await zk.disconnect().catch(() => undefined);
    }
  }

  async setUser(params: BiometricSetUserParams) {
    const zk = this.client();
    try {
      return await zk.setUser(params);
    } finally {
      await zk.disconnect().catch(() => undefined);
    }
  }

  async getUserTemplates(userId: string): Promise<BiometricFingerTemplate[]> {
    const zk = this.client();
    try {
      const fingers = await zk.getUserTemplates(userId);
      return fingers.map((f) => ({
        uid: f.uid,
        fid: f.fid,
        valid: f.valid,
        templateHex: f.template.toString("hex"),
      }));
    } finally {
      await zk.disconnect().catch(() => undefined);
    }
  }

  async saveUserTemplates(userId: string, fingers: BiometricFingerTemplate[]) {
    const zk = this.client();
    try {
      return await zk.saveUserTemplates(
        userId,
        fingers.map((f) => ({
          uid: f.uid,
          fid: f.fid,
          valid: f.valid,
          template: Buffer.from(f.templateHex, "hex"),
        })),
      );
    } finally {
      await zk.disconnect().catch(() => undefined);
    }
  }

  async startFingerprintEnrollment(params: {
    userPin: string;
    fingerId: number;
  }): Promise<{ ok: boolean; message: string }> {
    const zk = this.client();
    try {
      return await zk.startEnrollment(params.userPin, params.fingerId);
    } finally {
      await zk.disconnect().catch(() => undefined);
    }
  }
}

export function createZKTecoAdapter(options: ZKTecoAdapterOptions): ZKTecoAdapter {
  return new ZKTecoAdapter(options);
}
