import type { Session } from "next-auth";
import type { PermissionLevelId } from "@/lib/permissions/registry";

export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type SyntraTool = {
  definition: ToolDefinition;
  permission: { key: string; level: Exclude<PermissionLevelId, "none"> };
  describeCall?: (args?: Record<string, unknown>) => string;
  handler: (session: Session, args: Record<string, unknown>) => Promise<unknown>;
};

export function toolDef(
  name: string,
  description: string,
  parameters: Record<string, unknown>,
): ToolDefinition {
  return {
    type: "function",
    function: { name, description, parameters },
  };
}
