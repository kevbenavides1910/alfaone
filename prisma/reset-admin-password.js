/**
 * SOLO desarrollo local. Requiere ALLOW_DEMO_RESET=1.
 * No usar en producción — expone contraseñas conocidas del seed.
 *
 * Local: ALLOW_DEMO_RESET=1 npm run db:reset-admin-passwords
 */
if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEMO_RESET !== "1") {
  console.error(
    "Bloqueado: este script solo corre con ALLOW_DEMO_RESET=1 y NODE_ENV distinto de production.",
  );
  process.exit(1);
}

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

async function main() {
  const prisma = new PrismaClient();
  const adminHash = await bcrypt.hash("admin123", 12);
  const supervisorHash = await bcrypt.hash("supervisor123", 12);

  const admin = await prisma.user.findUnique({
    where: { email: "admin@seguridadgrupocr.com" },
  });
  if (!admin) {
    throw new Error("No existe admin@seguridadgrupocr.com. Ejecuta: npx prisma db seed");
  }
  await prisma.user.update({
    where: { email: "admin@seguridadgrupocr.com" },
    data: { passwordHash: adminHash, isActive: true, updatedAt: new Date() },
  });

  const sup = await prisma.user.findUnique({
    where: { email: "supervisor@seguridadgrupocr.com" },
  });
  if (sup) {
    await prisma.user.update({
      where: { email: "supervisor@seguridadgrupocr.com" },
      data: { passwordHash: supervisorHash, isActive: true, updatedAt: new Date() },
    });
    console.log("OK: supervisor@seguridadgrupocr.com / supervisor123");
  }

  console.log("OK: admin@seguridadgrupocr.com / admin123");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
