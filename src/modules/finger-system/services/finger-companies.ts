import { prisma } from "@/modules/core/db/prisma";

export type FingerCompanySummary = {
  code: string;
  name: string;
  isActive: boolean;
  deviceCount: number;
  linkedEmployees: number;
  shiftCount: number;
  punchesToday: number;
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function listFingerCompanySummaries(): Promise<FingerCompanySummary[]> {
  const start = startOfDay(new Date());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const companies = await prisma.company.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { code: true, name: true, isActive: true },
  });

  const [devices, links, shifts, punches] = await Promise.all([
    prisma.fingerDevice.groupBy({
      by: ["company"],
      where: { isActive: true },
      _count: { _all: true },
    }),
    prisma.fingerEmployeeLink.groupBy({
      by: ["company"],
      _count: { _all: true },
    }),
    prisma.fingerShiftSchedule.groupBy({
      by: ["company"],
      where: { isActive: true },
      _count: { _all: true },
    }),
    prisma.fingerPunch.findMany({
      where: { checkTime: { gte: start, lt: end } },
      select: {
        employee: { select: { company: true } },
      },
    }),
  ]);

  const deviceByCompany = new Map(devices.map((d) => [d.company ?? "", d._count._all]));
  const linkByCompany = new Map(links.map((l) => [l.company ?? "", l._count._all]));
  const shiftByCompany = new Map(shifts.map((s) => [s.company ?? "", s._count._all]));

  const punchesByCompany = new Map<string, number>();
  for (const p of punches) {
    const code = p.employee?.company ?? "";
    punchesByCompany.set(code, (punchesByCompany.get(code) ?? 0) + 1);
  }

  return companies.map((c) => ({
    code: c.code,
    name: c.name,
    isActive: c.isActive,
    deviceCount: deviceByCompany.get(c.code) ?? 0,
    linkedEmployees: linkByCompany.get(c.code) ?? 0,
    shiftCount: shiftByCompany.get(c.code) ?? 0,
    punchesToday: punchesByCompany.get(c.code) ?? 0,
  }));
}
