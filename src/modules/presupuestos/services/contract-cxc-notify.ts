import { prisma } from "@/modules/core/db/prisma";
import { sendPlatformMail } from "@/lib/email/platform-mailer";
import { dispatchNotificationEvent } from "@/modules/notifications/services/notification-dispatch";
import { seedNotificationCatalog } from "@/modules/notifications/services/notification-preferences";

const CXC_EMAIL = "cxc@seguridadalfa.com";
const TYPE_CODE = "facturacion.contract_changed";

const APP_BASE =
  process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
  process.env.APP_URL?.replace(/\/$/, "") ||
  "https://alfa.alfaone.local";

export type ContractCxcNotice = {
  contractId: string;
  action: string;
  summary: string;
  actorUserId?: string | null;
  actorName?: string | null;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[char] ?? char;
  });
}

/** Avisa a CxC por correo y en la campana. No debe tumbar el guardado del contrato. */
export function queueCxcContractNotice(input: ContractCxcNotice): void {
  void notifyCxcContractChange(input).catch((error) => {
    console.error("[contract-cxc-notify]", error);
  });
}

export async function notifyCxcContractChange(input: ContractCxcNotice): Promise<void> {
  const contract = await prisma.contract.findUnique({
    where: { id: input.contractId },
    select: { id: true, client: true, licitacionNo: true, company: true },
  });
  if (!contract) return;

  await seedNotificationCatalog();

  const recipients = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        { roleEntity: { code: "FACTURACION" } },
        { email: { equals: CXC_EMAIL, mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });

  const who = input.actorName?.trim();
  const title = `${input.action}: ${contract.client}`;
  const body = [contract.licitacionNo, input.summary].filter(Boolean).join(" · ");
  const href = `/contracts/${contract.id}`;

  await dispatchNotificationEvent({
    typeCode: TYPE_CODE,
    title,
    body,
    moduleKey: "facturacion",
    entityType: "contract",
    entityId: contract.id,
    href,
    recipientUserIds: recipients.map((user) => user.id),
    actorUserId: input.actorUserId,
  }).catch((error) => {
    console.error("[contract-cxc-notify] campana", error);
  });

  const url = `${APP_BASE}${href}`;
  const actorLine = who ? `<p>Cambio hecho por ${escapeHtml(who)}.</p>` : "";
  const html = `<p>Hay un cambio en el contrato <strong>${escapeHtml(contract.client)}</strong>${
    contract.licitacionNo ? ` (${escapeHtml(contract.licitacionNo)})` : ""
  }.</p>
<p><strong>${escapeHtml(input.action)}</strong></p>
<p>${escapeHtml(input.summary)}</p>
${actorLine}
<p>Compañía: ${escapeHtml(contract.company)}</p>
<p><a href="${escapeHtml(url)}">Abrir el contrato en Alfa One</a></p>`;

  await sendPlatformMail({
    to: CXC_EMAIL,
    subject: title,
    html,
    text: `${title}. ${input.summary}. ${url}`,
  }).catch((error) => {
    console.error("[contract-cxc-notify] correo", error);
  });
}
