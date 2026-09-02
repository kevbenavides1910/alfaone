import net from "node:net";

const CMD_CONNECT = 1000;
const CMD_EXIT = 1001;
const CMD_ACK_OK = 2000;
const CMD_PREPARE_DATA = 1500;
const CMD_DATA = 1501;
const CMD_FREE_DATA = 1502;
const CMD_ATTLOG_RRQ = 13;
const CMD_USERTEMP_RRQ = 9;
const CMD_USER_WRQ = 8;
const CMD_DELETE_USER = 18;
const CMD_STARTENROLL = 61;
const CMD_CANCELCAPTURE = 62;
const CMD_REFRESHDATA = 1013;
const CMD_GET_USER_TEMPLATE = 88;
const CMD_SAVE_USER_TEMPS = 110;

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
  privilege?: number;
};

export type ZkFingerTemplate = {
  uid: number;
  fid: number;
  valid: number;
  template: Buffer;
};

export type ZkSetUserInput = {
  uid?: number;
  userId: string;
  name: string;
  privilege?: number;
  password?: string;
  card?: number;
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
    const privilege = slice.readUInt8(2);
    const name = slice.subarray(11, 35).toString("utf8").replace(/\0/g, "").trim();
    const userId = slice.subarray(48, 57).toString("utf8").replace(/\0/g, "").trim();
    if (uid > 0) records.push({ uid, name, userId, privilege });
  }
  return records;
}

function packSetUser72(input: ZkSetUserInput & { uid: number }): Buffer {
  const buf = Buffer.alloc(72);
  buf.writeUInt16LE(input.uid & 0xffff, 0);
  buf.writeUInt8((input.privilege ?? 0) & 0xff, 2);
  Buffer.from((input.password ?? "").slice(0, 8), "utf8").copy(buf, 3);
  Buffer.from((input.name ?? "").slice(0, 24), "utf8").copy(buf, 11);
  buf.writeUInt32LE((input.card ?? 0) >>> 0, 35);
  // group_id placeholder (7 bytes) at 40
  Buffer.from(String(input.userId).slice(0, 24), "utf8").copy(buf, 48);
  return buf;
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

  private async sendReceive(command: number, data?: Buffer, timeoutMs?: number): Promise<Buffer> {
    if (!this.socket) throw new Error("Dispositivo no conectado.");
    const packet = createHeader(command, this.sessionId, this.nextReplyId(), data);
    const wait = timeoutMs ?? this.timeoutMs;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timeout en protocolo ZK.")), wait);
      const chunks: Buffer[] = [];
      const onData = (chunk: Buffer) => {
        chunks.push(chunk);
        const buf = Buffer.concat(chunks);
        if (buf.length >= 8) {
          const cmd = buf.readUInt16LE(0);
          if (cmd === CMD_PREPARE_DATA) {
            const dataSize = buf.readUInt32LE(8);
            if (buf.length >= 16 + dataSize) finish(buf);
            return;
          }
          if (cmd === CMD_DATA || cmd === CMD_ACK_OK || cmd >= 2000) {
            finish(buf);
          }
        }
      };
      const onError = (err: Error) => fail(err);
      const cleanup = () => {
        clearTimeout(timer);
        this.socket?.off("data", onData);
        this.socket?.off("error", onError);
      };
      const finish = (buf: Buffer) => {
        cleanup();
        resolve(buf);
      };
      const fail = (err: Error) => {
        cleanup();
        reject(err);
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

  private async refreshData(): Promise<void> {
    try {
      await this.sendReceive(CMD_REFRESHDATA);
    } catch {
      // algunos firmwares no soportan refresh
    }
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

  /** Crea o actualiza un usuario en el reloj (CMD_USER_WRQ, paquete ZK8 72 bytes). */
  async setUser(input: ZkSetUserInput): Promise<{ ok: boolean; uid: number; message: string }> {
    await this.connect();
    const users = await this.getUsers();
    const badge = String(input.userId).trim();
    const existing = users.find((u) => u.userId === badge);
    const uid =
      input.uid ??
      existing?.uid ??
      (users.reduce((max, u) => Math.max(max, u.uid), 0) + 1 || 1);

    const packet = packSetUser72({
      uid,
      userId: badge,
      name: (input.name || badge).slice(0, 24),
      privilege: input.privilege ?? 0,
      password: input.password ?? "",
      card: input.card ?? 0,
    });

    const reply = await this.sendReceive(CMD_USER_WRQ, packet);
    const cmd = reply.readUInt16LE(0);
    if (cmd !== CMD_ACK_OK) {
      return { ok: false, uid, message: `El reloj rechazó set_user (cmd ${cmd}).` };
    }
    await this.refreshData();
    return { ok: true, uid, message: `Usuario ${badge} guardado en el reloj (uid ${uid}).` };
  }

  async deleteUser(userId: string): Promise<boolean> {
    await this.connect();
    const users = await this.getUsers();
    const existing = users.find((u) => u.userId === String(userId).trim());
    if (!existing) return false;
    const data = Buffer.alloc(2);
    data.writeUInt16LE(existing.uid & 0xffff, 0);
    const reply = await this.sendReceive(CMD_DELETE_USER, data);
    await this.refreshData();
    return reply.readUInt16LE(0) === CMD_ACK_OK;
  }

  /** Lee plantillas de huella de un usuario (dedos 0–9). */
  async getUserTemplates(userId: string): Promise<ZkFingerTemplate[]> {
    await this.connect();
    const users = await this.getUsers();
    const existing = users.find((u) => u.userId === String(userId).trim());
    if (!existing) return [];

    const out: ZkFingerTemplate[] = [];
    for (let fid = 0; fid < 10; fid += 1) {
      const req = Buffer.alloc(3);
      req.writeUInt16LE(existing.uid & 0xffff, 0);
      req.writeUInt8(fid & 0xff, 2);
      try {
        const reply = await this.sendReceive(CMD_GET_USER_TEMPLATE, req, 5000);
        const cmd = reply.readUInt16LE(0);
        if (cmd === CMD_PREPARE_DATA) {
          const size = reply.readUInt32LE(8);
          const payload = reply.subarray(16, 16 + size);
          if (payload.length > 32) {
            out.push({ uid: existing.uid, fid, valid: 1, template: Buffer.from(payload) });
          }
        } else if (cmd === CMD_DATA || (cmd === CMD_ACK_OK && reply.length > 16)) {
          const payload = reply.subarray(8);
          if (payload.length > 32) {
            out.push({ uid: existing.uid, fid, valid: 1, template: Buffer.from(payload) });
          }
        }
      } catch {
        // dedo vacío
      }
    }
    return out;
  }

  /** Guarda plantillas en el reloj (buffer + CMD 110, semántica pyzk). */
  async saveUserTemplates(userId: string, fingers: ZkFingerTemplate[]): Promise<{ ok: boolean; message: string }> {
    await this.connect();
    const users = await this.getUsers();
    const existing = users.find((u) => u.userId === String(userId).trim());
    if (!existing) {
      return { ok: false, message: `Usuario ${userId} no está en el reloj.` };
    }
    if (!fingers.length) {
      return { ok: true, message: "Sin plantillas que copiar." };
    }

    const upack = packSetUser72({
      uid: existing.uid,
      userId: existing.userId,
      name: existing.name || existing.userId,
      privilege: existing.privilege ?? 0,
    });
    // Prefijo 0x02 estilo pyzk repack73
    const upackWithFlag = Buffer.alloc(73);
    upackWithFlag.writeUInt8(2, 0);
    upack.copy(upackWithFlag, 1);

    let table = Buffer.alloc(0);
    let fpack = Buffer.alloc(0);
    let tstart = 0;
    const fnum = 0x10;
    for (const finger of fingers) {
      if (!finger.template?.length) continue;
      const tfp = Buffer.alloc(2 + finger.template.length);
      tfp.writeUInt16LE(finger.template.length & 0xffff, 0);
      finger.template.copy(tfp, 2);
      const row = Buffer.alloc(8);
      row.writeUInt8(2, 0);
      row.writeUInt16LE(existing.uid & 0xffff, 1);
      row.writeUInt8((fnum + finger.fid) & 0xff, 3);
      row.writeUInt32LE(tstart >>> 0, 4);
      table = Buffer.concat([table, row]);
      fpack = Buffer.concat([fpack, tfp]);
      tstart += tfp.length;
    }

    const head = Buffer.alloc(12);
    head.writeUInt32LE(upackWithFlag.length, 0);
    head.writeUInt32LE(table.length, 4);
    head.writeUInt32LE(fpack.length, 8);
    const packet = Buffer.concat([head, upackWithFlag, table, fpack]);

    try {
      await this.sendReceive(CMD_FREE_DATA).catch(() => undefined);
      const prep = Buffer.alloc(4);
      prep.writeUInt32LE(packet.length, 0);
      const prepReply = await this.sendReceive(CMD_PREPARE_DATA, prep);
      if (prepReply.readUInt16LE(0) !== CMD_ACK_OK) {
        return { ok: false, message: "No se pudo preparar buffer de plantillas." };
      }
      const CHUNK = 1024;
      for (let i = 0; i < packet.length; i += CHUNK) {
        const chunk = packet.subarray(i, Math.min(i + CHUNK, packet.length));
        const r = await this.sendReceive(CMD_DATA, chunk);
        if (r.readUInt16LE(0) !== CMD_ACK_OK) {
          return { ok: false, message: "Error enviando chunk de plantillas." };
        }
      }
      const saveCmd = Buffer.alloc(8);
      saveCmd.writeUInt32LE(12, 0);
      saveCmd.writeUInt16LE(0, 4);
      saveCmd.writeUInt16LE(8, 6);
      const saveReply = await this.sendReceive(CMD_SAVE_USER_TEMPS, saveCmd);
      if (saveReply.readUInt16LE(0) !== CMD_ACK_OK) {
        return { ok: false, message: "El reloj no guardó las plantillas." };
      }
      await this.refreshData();
      return { ok: true, message: `${fingers.length} plantilla(s) copiada(s) para ${userId}.` };
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : "Error al guardar plantillas.",
      };
    }
  }

  /**
   * Inicia enrolamiento (CMD_STARTENROLL).
   * Paquete TCP pyzk: user_id(24) + finger + flag.
   * No bloquea esperando el dedo; el operador coloca la huella en el reloj.
   */
  async startEnrollment(userPin: string, fingerId: number): Promise<{ ok: boolean; message: string }> {
    await this.connect();
    const pin = userPin.trim().slice(0, 24);
    if (!pin) throw new Error("Número de empleado (badge) requerido para enrolar.");

    try {
      await this.sendReceive(CMD_CANCELCAPTURE).catch(() => undefined);
    } catch {
      // ignore
    }

    const data = Buffer.alloc(26);
    Buffer.from(pin, "utf8").copy(data, 0);
    data.writeUInt8(fingerId & 0xff, 24);
    data.writeUInt8(1, 25);

    try {
      const reply = await this.sendReceive(CMD_STARTENROLL, data, 15000);
      const cmd = reply.readUInt16LE(0);
      if (cmd === CMD_ACK_OK) {
        return {
          ok: true,
          message: `Dispositivo listo. Coloque el dedo ${fingerId} frente al reloj para el código ${pin}.`,
        };
      }
      return {
        ok: false,
        message: "El dispositivo no aceptó el modo enrolamiento. Verifique que el usuario exista en el reloj.",
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
