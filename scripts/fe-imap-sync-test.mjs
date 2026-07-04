import { PrismaClient } from "@prisma/client";
import { ImapFlow } from "imapflow";

const companyCode = process.argv[2] || "KBA";
const prisma = new PrismaClient();

try {
  const empresa = await prisma.feEmpresa.findFirst({ where: { companyCode } });
  if (!empresa?.imapEnabled) {
    console.error("IMAP not enabled");
    process.exit(1);
  }
  const client = new ImapFlow({
    host: empresa.imapHost,
    port: empresa.imapPort ?? 993,
    secure: empresa.imapSecure ?? true,
    auth: { user: empresa.imapUser, pass: empresa.imapPass },
    logger: false,
  });
  await client.connect();
  const lock = await client.getMailboxLock(empresa.imapFolder || "INBOX");
  try {
    const status = await client.status(empresa.imapFolder || "INBOX", { messages: true, unseen: true });
    console.log("OK", JSON.stringify(status));
  } finally {
    lock.release();
  }
  await client.logout();
} catch (e) {
  console.error("ERR", e?.message || e);
  if (e?.responseText) console.error("response", e.responseText);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
