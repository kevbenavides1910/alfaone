import { prisma } from "@/modules/core/db/prisma";
import { listSigRequirements } from "./requirements";
import { listSigControls } from "./controls";
import { listSigRevisionReminders } from "./revision-reminders";
import { getCapaEfficacyDashboard } from "./capa-dashboard";
import { listSigIndicators } from "./indicators";
import { listSigRisks } from "./risks";
import { listSigIncidents } from "./incidents";

/** Tablero de mando del SGC/SOMS — agregados para dirección y coordinador SIG. */
export async function getSigSgcDashboard() {
  const year = new Date().getFullYear();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [requirements, controls, revisions, capa, indicators, risks, incidents, upcomingAudits] =
    await Promise.all([
      listSigRequirements({ applicableOnly: true }),
      listSigControls({ status: "ACTIVE" }),
      listSigRevisionReminders(30),
      getCapaEfficacyDashboard({ year }),
      listSigIndicators({ status: "ACTIVE" }),
      listSigRisks({}),
      listSigIncidents({}),
      prisma.audit.findMany({
        where: {
          status: { in: ["PLANNED", "IN_PROGRESS"] },
          scheduledDate: { gte: today },
        },
        orderBy: { scheduledDate: "asc" },
        take: 8,
        select: {
          id: true,
          year: true,
          quarter: true,
          scheduledDate: true,
          status: true,
          procedure: { select: { id: true, code: true, title: true } },
        },
      }),
    ]);

  const compliant = requirements.filter((r) => r.complianceReason === "COMPLIANT");
  const noEvidence = requirements.filter((r) => r.complianceReason === "NO_EVIDENCE");
  const stale = requirements.filter((r) => r.complianceReason === "STALE");
  const openNc = requirements.filter((r) => r.complianceReason === "OPEN_NC");

  const controlsOverdue = controls.filter(
    (c) => c.freshness === "OVERDUE" || c.freshness === "NO_EVIDENCE"
  );
  const controlsDueSoon = controls.filter((c) => c.freshness === "DUE_SOON");

  const highRisks = risks.filter((r) => {
    const level = r.residualLevel ?? r.inherentLevel;
    return level === "HIGH" || level === "CRITICAL";
  });

  const openIncidents = incidents.filter(
    (i) => i.status !== "CLOSED" && i.status !== "DISMISSED"
  );

  const coveragePct =
    requirements.length === 0
      ? 0
      : Math.round((compliant.length / requirements.length) * 100);

  return {
    generatedAt: new Date().toISOString(),
    coverage: {
      applicable: requirements.length,
      compliant: compliant.length,
      noEvidence: noEvidence.length,
      stale: stale.length,
      openNc: openNc.length,
      coveragePct,
    },
    documents: {
      revisionDue: revisions.length,
      revisionOverdue: revisions.filter((r) => r.isOverdue).length,
    },
    controls: {
      active: controls.length,
      overdue: controlsOverdue.length,
      dueSoon: controlsDueSoon.length,
      rows: controlsOverdue.slice(0, 12).map((c) => ({
        id: c.id,
        code: c.code,
        title: c.title,
        freshness: c.freshness,
        ownerUserId: c.ownerUserId,
        process: c.process
          ? { id: c.process.id, code: c.process.code, name: c.process.name }
          : null,
      })),
    },
    capa: {
      openFindings: capa.findings.open,
      overdueActions: capa.actions.overdue,
      closurePct: capa.findings.closurePct,
      efficacyPending: capa.efficacy.pending,
    },
    indicators: {
      red: indicators.filter((i) => i.trafficLight === "RED").length,
      yellow: indicators.filter((i) => i.trafficLight === "YELLOW").length,
      overdue: indicators.filter((i) => i.measurementOverdue).length,
    },
    risks: {
      high: highRisks.length,
      total: risks.length,
    },
    incidents: {
      open: openIncidents.length,
      total: incidents.length,
    },
    upcomingAudits: upcomingAudits.map((a) => ({
      id: a.id,
      title: `${a.procedure.code} · Q${a.quarter}/${a.year}`,
      scheduledDate: a.scheduledDate.toISOString(),
      status: a.status,
      procedure: a.procedure,
    })),
    gapsPreview: [...openNc, ...stale, ...noEvidence].slice(0, 15).map((r) => ({
      id: r.id,
      code: r.code,
      title: r.title,
      complianceReason: r.complianceReason,
      complianceLabel: r.complianceLabel,
      standardCode: r.standard.code,
    })),
  };
}
