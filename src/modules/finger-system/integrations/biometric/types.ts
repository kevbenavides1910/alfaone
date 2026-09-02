export type BiometricDeviceStatus = "online" | "offline" | "error" | "unknown";

export type BiometricSetUserParams = {
  uid?: number;
  userId: string;
  name: string;
  privilege?: number;
  password?: string;
  card?: number;
};

export type BiometricFingerTemplate = {
  uid: number;
  fid: number;
  valid: number;
  /** Hex-encoded template bytes for JSON transport. */
  templateHex: string;
};

/** Contrato para adaptadores de dispositivos biométricos (ZKTeco y futuros). */
export interface BiometricDeviceAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): Promise<BiometricDeviceStatus>;
  getDeviceInfo(): Promise<Record<string, string | number | null>>;
  getUsers(): Promise<unknown[]>;
  getAttendance(from: Date, to: Date): Promise<unknown[]>;
  sync(): Promise<{ ok: boolean; message: string }>;
  setUser(params: BiometricSetUserParams): Promise<{ ok: boolean; uid: number; message: string }>;
  getUserTemplates(userId: string): Promise<BiometricFingerTemplate[]>;
  saveUserTemplates(
    userId: string,
    fingers: BiometricFingerTemplate[],
  ): Promise<{ ok: boolean; message: string }>;
  startFingerprintEnrollment(params: {
    userPin: string;
    fingerId: number;
  }): Promise<{ ok: boolean; message: string }>;
}
