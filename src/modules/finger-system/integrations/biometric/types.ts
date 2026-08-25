export type BiometricDeviceStatus = "online" | "offline" | "error" | "unknown";

/** Contrato para adaptadores de dispositivos biométricos (ZKTeco y futuros). */
export interface BiometricDeviceAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): Promise<BiometricDeviceStatus>;
  getDeviceInfo(): Promise<Record<string, string | number | null>>;
  getUsers(): Promise<unknown[]>;
  getAttendance(from: Date, to: Date): Promise<unknown[]>;
  sync(): Promise<{ ok: boolean; message: string }>;
  startFingerprintEnrollment(params: {
    userPin: string;
    fingerId: number;
  }): Promise<{ ok: boolean; message: string }>;
}
