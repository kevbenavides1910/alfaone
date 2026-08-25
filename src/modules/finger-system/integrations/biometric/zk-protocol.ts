import net from "node:net";

const CMD_CONNECT = 1000;
const CMD_EXIT = 1001;
const CMD_ACK_OK = 2000;
const CMD_PREPARE_DATA = 1500;
const CMD_DATA = 1501;
const CMD_ATTLOG_RRQ = 13;
const CMD_USERTEMP_RRQ = 9;
const CMD_STARTENROLL = 61;

export type ZkAttendanceRecord = {
  userId: number;
  timestamp: Date;
  status: number;
  punch: number;
};

export type ZkUserRecord = {
  uid: number;
  userId: string;
  name: string;
};

export type ZkClientOptions = {
  ipAddress: string;
  port?: number;
  timeoutMs?: number;
  commKey?: number;
};

function checksum(buf: Buffer): number {
  let sum = 0;
  for (let i = 0; i < buf.length; i += 2) {
    if (i === 2) continue;
    sum += buf.readUInt16LE(i);
  }
  return sum % 65535;
}

function createHeader(command: number, sessionId: number, replyId: number, data?: Buffer): Buffer {
  const size = 8 + (data?.length ?? 0);
  const buf = Buffer.alloc(size);
  buf.writeUInt16LE(command, 0);
  buf.writeUInt16LE(0, 2);
  buf.writeUInt16LE(sessionId, 4);
  buf.writeUInt16LE(replyId, 6);
  if (data) data.copy(buf, 8);
  buf.writeUInt16LE(checksum(buf), 2);
  return buf;
}

function decodeTime(data: Buffer, offset: number): Date {
  const second = data.readUInt8(offset);
  const minute = data.readUInt8(offset + 1);
  const hour = data.readUInt8(offset + 2);
  const day = data.readUInt8(offset + 3);
  const month = data.readUInt8(offset + 4);
  const year = data.readUInt8(offset + 5) + 2000;
  return new Date(year, month - 1, day, hour, minute, second);
}

function parseAttendanceChunk(data: Buffer): ZkAttendanceRecord[] {
  const records: ZkAttendanceRecord[] = [];
  const size = 40;
  for (let i = 0; i + size <= data.length; i += size) {
    const slice = data.subarray(i, i + size);
    records.push({
      userId: slice.readUInt16LE(0),
      status: slice.readUInt8(4),
      punch: slice.readUInt8(5),
      timestamp: decodeTime(slice, 8),
    });
  }
  return records;
}

function parseUserChunk(data: Buffer): ZkUserRecord[] {
  const records: ZkUserRecord[] = [];
  const size = 72;
  for (let i = 0; i + size <= data.length; i += size) {
    const slice = data.subarray(i, i + size);
    const uid = slice.readUInt16LE(0);
    const name = slice.subarray(11, 35).toString("utf8").replace(/\0/g, "").trim();
    const userId = slice.subarray(48, 57).toString("utf8").replace(/\0/g, "").trim();
    if (uid > 0) records.push({ uid, name, userId });
  }
  return records;
}

export class ZkProtocolClient {
  private socket: net.Socket | null = null;
  private sessionId = 0;
  private replyId = 0;
  private readonly ipAddress: string;
  private readonly port: number;
  private readonly timeoutMs: number;

  constructor(options: ZkClientOptions) {
    this.ipAddress = options.ipAddress;
    this.port = options.port ?? 4370;
    this.timeoutMs = options.timeoutMs ?? 8000;
    void options.commKey;
  }

  private nextReplyId(): number {
    this.replyId = (this.replyId + 1) % 65535;
    return this.replyId;
  }

  private async sendReceive(command: number, data?: Buffer): Promise<Buffer> {
    if (!this.socket) throw new Error("Dispositivo no conectado.");
    const packet = createHeader(command, this.sessionId, this.nextReplyId(), data);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timeout en protocolo ZK.")), this.timeoutMs);
      const chunks: Buffer[] = [];
      const onData = (chunk: Buffer) => {
        chunks.push(chunk);
        const buf = Buffer.concat(chunks);
        if (buf.length >= 8) {
          const cmd = buf.readUInt16LE(0);
          if (cmd === CMD_PREPARE_DATA) {
            const dataSize = buf.readUInt32LE(8);
            if (buf.length >= 16 + dataSize) cleanup(resolve, buf);
            return;
          }
          if (cmd === CMD_DATA || cmd === CMD_ACK_OK || cmd >= 2000) {
            cleanup(resolve, buf);
          }
        }
      };
      const onError = (err: Error) => cleanup(reject, err);
      const cleanup = (fn: (v: Buffer | Error) => void, value: Buffer | Error) => {
        clearTimeout(timer);
        this.socket?.off("data", onData);
        this.socket?.off("error", onError);
        fn(value);
      };
      this.socket!.on("data", onData);
      this.socket!.on("error", onError);
      this.socket!.write(packet);
    });
  }

  async connect(): Promise<void> {
    if (this.socket) return;
    await new Promise<void>((resolve, reject) => {
      const socket = net.createConnection({ host: this.ipAddress, port: this.port }, () => {
        this.socket = socket;
        resolve();
      });
      socket.setTimeout(this.timeoutMs);
      socket.once("error", reject);
      socket.once("timeout", () => reject(new Error("Timeout al conectar con dispositivo ZK.")));
    });

    const reply = await this.sendReceive(CMD_CONNECT);
    this.sessionId = reply.readUInt16LE(4);
    if (reply.readUInt16LE(0) !== CMD_ACK_OK) {
      throw new Error("Handshake ZK rechazado por el dispositivo.");
    }
  }

  async disconnect(): Promise<void> {
    if (!this.socket) return;
    try {
      await this.sendReceive(CMD_EXIT);
    } catch {
      // ignore on close
    }
    this.socket.destroy();
    this.socket = null;
    this.sessionId = 0;
  }

  private async readDataPayload(requestCommand: number): Promise<Buffer> {
    const reply = await this.sendReceive(requestCommand);
    const cmd = reply.readUInt16LE(0);
    if (cmd !== CMD_PREPARE_DATA) {
      if (cmd === CMD_ACK_OK && reply.length <= 16) return Buffer.alloc(0);
      throw new Error(`Respuesta inesperada del dispositivo (cmd ${cmd}).`);
    }
    const totalSize = reply.readUInt32LE(8);
    const chunks: Buffer[] = [];
    let received = 0;
    while (received < totalSize) {
      const dataReply = await this.sendReceive(CMD_ACK_OK);
      const dataCmd = dataReply.readUInt16LE(0);
      if (dataCmd !== CMD_DATA) break;
      const payload = dataReply.subarray(8);
      chunks.push(payload);
      received += payload.length;
    }
    return Buffer.concat(chunks);
  }

  async getAttendance(from: Date, to: Date): Promise<ZkAttendanceRecord[]> {
    await this.connect();
    const payload = await this.readDataPayload(CMD_ATTLOG_RRQ);
    const all = parseAttendanceChunk(payload);
    return all.filter((r) => r.timestamp >= from && r.timestamp <= to);
  }

  async getUsers(): Promise<ZkUserRecord[]> {
    await this.connect();
    const payload = await this.readDataPayload(CMD_USERTEMP_RRQ);
    return parseUserChunk(payload);
  }

  /** Coloca el dispositivo en modo enrolamiento para un usuario/dedo. */
  async startEnrollment(userPin: string, fingerId: number): Promise<{ ok: boolean; message: string }> {
    await this.connect();
    const pin = userPin.trim().slice(0, 9);
    if (!pin) throw new Error("Número de empleado (badge) requerido para enrolar.");

    const data = Buffer.alloc(3);
    data.writeUInt8(fingerId & 0xff, 0);
    data.write(pin, 1, 1, "ascii");

    try {
      const reply = await this.sendReceive(CMD_STARTENROLL, data);
      const cmd = reply.readUInt16LE(0);
      if (cmd === CMD_ACK_OK) {
        return {
          ok: true,
          message: `Dispositivo listo. Coloque el dedo indicado (${fingerId}) para ${pin}.`,
        };
      }
      return {
        ok: false,
        message: "El dispositivo no aceptó el modo enrolamiento. Verifique modelo y firmware ZK.",
      };
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : "Error al iniciar enrolamiento.",
      };
    }
  }
}

export function createZkProtocolClient(options: ZkClientOptions): ZkProtocolClient {
  return new ZkProtocolClient(options);
}
