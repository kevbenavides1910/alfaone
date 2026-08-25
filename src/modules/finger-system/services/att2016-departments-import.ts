import { mdbExportTable } from "@/modules/finger-system/integrations/att2016/mdb-reader";
import { withAtt2016MdbRead } from "@/modules/finger-system/integrations/att2016/read-session";

export type Att2016Department = {
  deptId: number;
  deptName: string;
  parentDeptId: number;
};

function parseDepartmentRow(row: Record<string, string>): Att2016Department | null {
  const deptId = Number.parseInt(row.DEPTID ?? row.DeptId ?? "", 10);
  const deptName = row.DEPTNAME?.trim() || row.DeptName?.trim() || "";
  if (!Number.isFinite(deptId) || !deptName) return null;
  const parentRaw = row.SUPDEPTID ?? row.SupDeptId ?? "0";
  const parentDeptId = Number.parseInt(parentRaw, 10);
  return {
    deptId,
    deptName,
    parentDeptId: Number.isFinite(parentDeptId) ? parentDeptId : 0,
  };
}

export async function fetchAtt2016Departments(): Promise<Att2016Department[]> {
  return withAtt2016MdbRead(async (mdb) => {
    const rows = await mdbExportTable(mdb, "DEPARTMENTS");
    return rows.map(parseDepartmentRow).filter((r): r is Att2016Department => r != null);
  });
}
