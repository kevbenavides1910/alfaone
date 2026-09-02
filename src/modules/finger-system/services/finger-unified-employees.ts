import { fetchAtt2016UserInfo } from "@/modules/finger-system/services/att2016-employees-import";
import { fetchAtt2016TemplateMeta } from "@/modules/finger-system/services/att2016-templates-sync";
import { fetchAtt2016Departments } from "@/modules/finger-system/services/att2016-departments-import";
import { listFingerEmployeeLinks } from "@/modules/finger-system/services/finger-employees-list";
import { getFingerSettingsPublic } from "@/modules/finger-system/services/finger-settings";

export type UnifiedEmployeeRow = {
  id: string;
  /** Employee.id cuando hay vínculo RRHH; null en modo solo ATT2016. */
  employeeId: string | null;
  attUserId: number;
  badgeNumber: string;
  name: string | null;
  cedula: string | null;
  gender: string | null;
  title: string | null;
  companyCode: string | null;
  deptId: number | null;
  deptName: string | null;
  attEnabled: boolean;
  fingerprintCount: number;
  fingerIds: number[];
  linkId: string | null;
  source: "att2016" | "link" | "odoo";
};

export type UnifiedEmployeeFilters = {
  q?: string;
  company?: string;
  deptId?: number;
  includeSubDepts?: boolean;
  page?: number;
  pageSize?: number;
};

function matchesQuery(row: UnifiedEmployeeRow, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return (
    row.badgeNumber.toLowerCase().includes(needle) ||
    (row.name?.toLowerCase().includes(needle) ?? false) ||
    (row.cedula?.toLowerCase().includes(needle) ?? false)
  );
}

export async function listUnifiedEmployees(filters: UnifiedEmployeeFilters) {
  const settings = await getFingerSettingsPublic();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(200, Math.max(25, filters.pageSize ?? 100));

  if (settings.linkRrhhEmployees) {
    const linked = await listFingerEmployeeLinks({
      q: filters.q,
      company: filters.company,
      page: 1,
      pageSize: 500,
    });

    const fingerMap = await fetchAtt2016TemplateMeta()
      .then((rows) => {
        const map = new Map<number, number[]>();
        for (const r of rows) {
          const list = map.get(r.attUserId) ?? [];
          list.push(r.fingerId);
          map.set(r.attUserId, list);
        }
        return map;
      })
      .catch(() => new Map<number, number[]>());

    let items: UnifiedEmployeeRow[] = linked.items.map((r) => {
      const fingerIds = r.attUserId != null ? (fingerMap.get(r.attUserId) ?? []) : [];
      return {
        id: r.id,
        employeeId: r.employeeId,
        attUserId: r.attUserId ?? 0,
        badgeNumber: r.badgeNumber ?? r.employee.codigoEmpleado,
        name: r.employee.nombre,
        cedula: r.employee.cedula,
        gender: null,
        title: null,
        companyCode: r.company ?? r.employee.company,
        deptId: null,
        deptName: null,
        attEnabled: true,
        fingerprintCount: r.fingerprintCount || fingerIds.length,
        fingerIds,
        linkId: r.id,
        source: "link" as const,
      };
    });

    if (filters.deptId != null) {
      items = items.filter((i) => i.deptId === filters.deptId || filters.includeSubDepts);
    }

    const total = items.length;
    const start = (page - 1) * pageSize;
    items = items.slice(start, start + pageSize);
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 };
  }

  const [users, templates, departments] = await Promise.all([
    fetchAtt2016UserInfo(),
    fetchAtt2016TemplateMeta().catch(() => []),
    fetchAtt2016Departments().catch(() => []),
  ]);

  const deptNameById = new Map(departments.map((d) => [d.deptId, d.deptName]));
  const fingerMap = new Map<number, number[]>();
  for (const t of templates) {
    const list = fingerMap.get(t.attUserId) ?? [];
    list.push(t.fingerId);
    fingerMap.set(t.attUserId, list);
  }

  let items: UnifiedEmployeeRow[] = users.map((u) => {
    const fingerIds = fingerMap.get(u.attUserId) ?? [];
    return {
      id: `att:${u.attUserId}`,
      employeeId: null,
      attUserId: u.attUserId,
      badgeNumber: u.badgeNumber,
      name: u.name ?? u.badgeNumber,
      cedula: u.badgeNumber,
      gender: null,
      title: null,
      companyCode: filters.company ?? null,
      deptId: u.defaultDeptId,
      deptName: u.defaultDeptId != null ? (deptNameById.get(u.defaultDeptId) ?? null) : null,
      attEnabled: u.attEnabled,
      fingerprintCount: fingerIds.length,
      fingerIds,
      linkId: null,
      source: "att2016" as const,
    };
  });

  if (filters.deptId != null) {
    items = items.filter((i) => i.deptId === filters.deptId);
  }

  if (filters.q?.trim()) {
    items = items.filter((i) => matchesQuery(i, filters.q!));
  }

  const total = items.length;
  const start = (page - 1) * pageSize;
  items = items.slice(start, start + pageSize);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 };
}
