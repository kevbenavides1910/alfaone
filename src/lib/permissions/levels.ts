import type { PermissionLevel } from "@prisma/client";
import type { PermissionLevelId } from "./registry";

const TO_ID: Record<PermissionLevel, PermissionLevelId> = {
  NONE: "none",
  VIEW: "view",
  EDIT: "edit",
  ADMIN: "admin",
};

const TO_DB: Record<PermissionLevelId, PermissionLevel> = {
  none: "NONE",
  view: "VIEW",
  edit: "EDIT",
  admin: "ADMIN",
};

export function permissionLevelFromDb(level: PermissionLevel): PermissionLevelId {
  return TO_ID[level] ?? "none";
}

export function permissionLevelToDb(level: PermissionLevelId): PermissionLevel {
  return TO_DB[level];
}
