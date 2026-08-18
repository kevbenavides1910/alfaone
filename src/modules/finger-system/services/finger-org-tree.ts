import { prisma } from "@/modules/core/db/prisma";
import { fetchAtt2016Departments } from "@/modules/finger-system/services/att2016-departments-import";
import { fetchAtt2016UserInfo } from "@/modules/finger-system/services/att2016-employees-import";

export type FingerOrgTreeNode = {
  id: string;
  label: string;
  type: "root" | "company" | "department";
  companyCode?: string;
  deptId?: number;
  employeeCount?: number;
  children: FingerOrgTreeNode[];
};

export async function buildFingerOrgTree(): Promise<FingerOrgTreeNode> {
  const [companies, departments, attUsers] = await Promise.all([
    prisma.company.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { code: true, name: true },
    }),
    fetchAtt2016Departments().catch(() => []),
    fetchAtt2016UserInfo().catch(() => []),
  ]);

  const deptNodes = buildDepartmentTree(departments);

  const companyNodes: FingerOrgTreeNode[] = companies.map((c) => ({
    id: `company:${c.code}`,
    label: c.name.toUpperCase(),
    type: "company",
    companyCode: c.code,
    children: deptNodes.length > 1 ? deptNodes : [],
  }));

  return {
    id: "root",
    label: "GRUPO ALFA",
    type: "root",
    employeeCount: attUsers.length,
    children: companyNodes.length > 0 ? companyNodes : deptNodes,
  };
}

function buildDepartmentTree(
  departments: Awaited<ReturnType<typeof fetchAtt2016Departments>>,
): FingerOrgTreeNode[] {
  if (departments.length === 0) {
    return [
      {
        id: "dept:1",
        label: "Esta Compañía",
        type: "department",
        deptId: 1,
        children: [],
      },
    ];
  }

  const byParent = new Map<number, typeof departments>();
  for (const d of departments) {
    const list = byParent.get(d.parentDeptId) ?? [];
    list.push(d);
    byParent.set(d.parentDeptId, list);
  }

  const walk = (parentId: number): FingerOrgTreeNode[] => {
    const nodes = byParent.get(parentId) ?? [];
    return nodes.map((d) => ({
      id: `dept:${d.deptId}`,
      label: d.deptName,
      type: "department" as const,
      deptId: d.deptId,
      children: walk(d.deptId),
    }));
  };

  return walk(0);
}
