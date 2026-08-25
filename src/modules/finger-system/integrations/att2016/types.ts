export type Att2016ProbeResult = {
  configured: boolean;
  reachable: boolean;
  readOnly: boolean;
  connectionType: "smb" | "mdb" | "mssql" | "unknown";
  sharePath: string;
  databaseName: string;
  message: string;
  canReadDatabase?: boolean;
  canWriteShare?: boolean;
};

export type Att2016SchemaSnapshot = {
  probedAt: string;
  tables: { name: string; rowCount?: number }[];
  message: string;
};

export type Att2016UserInfo = {
  attUserId: number;
  badgeNumber: string;
  name: string | null;
  defaultDeptId: number | null;
  attEnabled: boolean;
};

export type Att2016Machine = {
  id: number;
  alias: string;
  ip: string | null;
  port: number | null;
  serialNumber: string | null;
  enabled: boolean;
};

export type Att2016CheckInOut = {
  attUserId: number;
  checkTime: Date;
  checkType: string | null;
  verifyCode: number | null;
  sensorId: string | null;
  workCode: number | null;
  deviceSn: string | null;
};

export type AttEmployeePreviewRow = {
  attUserId: number;
  badgeNumber: string;
  name: string | null;
  matchStatus: "linked" | "matchable" | "already_linked_other" | "no_alfa_match";
  employeeId: string | null;
  employeeName: string | null;
  employeeCodigo: string | null;
  existingLinkId: string | null;
};

export type AttEmployeeImportPreview = {
  attTotal: number;
  matchable: number;
  alreadyLinked: number;
  noAlfaMatch: number;
  conflict: number;
  rows: AttEmployeePreviewRow[];
};

export type AttPunchImportPreview = {
  from: string;
  to: string;
  rowsInRange: number;
  alreadyImported: number;
  newRows: number;
  unlinkedPunches: number;
  sample: {
    checkTime: string;
    badgeNumber: string | null;
    employeeName: string | null;
    checkType: string | null;
    deviceSn: string | null;
  }[];
};

export type AttImportApplyResult = {
  batchId: string;
  rowsProcessed: number;
  rowsInserted: number;
  rowsUpdated: number;
  rowsSkipped: number;
};

export type Att2016TemplateFinger = {
  attUserId: number;
  fingerId: number;
};

export type AttTemplateSyncPreview = {
  attTemplateRows: number;
  linkedEmployees: number;
  withFingerprints: number;
  withoutFingerprints: number;
  unlinkedAttUsers: number;
  rows: {
    linkId: string | null;
    attUserId: number | null;
    badgeNumber: string | null;
    employeeName: string | null;
    employeeCodigo: string | null;
    fingerprintCount: number;
    fingerIds: number[];
    syncStatus: "synced" | "no_templates" | "unlinked" | "no_att_user";
  }[];
};
