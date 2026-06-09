import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/** Restablece contraseñas de usuarios seed y crea admin local si hace falta. Solo desarrollo. */
async function main() {
  const password = "admin123";
  const hash = await bcrypt.hash(password, 12);

  const users: { email: string; name: string; role: UserRole }[] = [
    { email: "admin@seguridadgrupocr.com", name: "Administrador Sistema", role: UserRole.ADMIN },
    { email: "supervisor@seguridadgrupocr.com", name: "Supervisor Contratos", role: UserRole.SUPERVISOR },
    { email: "compras@seguridadgrupocr.com", name: "Compras", role: UserRole.COMPRAS },
    { email: "comercial@seguridadgrupocr.com", name: "Comercial", role: UserRole.COMMERCIAL },
  ];

  const adminRole = await prisma.role.findUnique({ where: { code: "ADMIN" } });

  for (const u of users) {
    const roleEntity = await prisma.role.findUnique({ where: { code: u.role } });
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        passwordHash: hash,
        isActive: true,
        mustChangePassword: false,
        roleId: roleEntity?.id ?? null,
      },
      create: {
        name: u.name,
        email: u.email,
        passwordHash: hash,
        role: u.role,
        roleId: roleEntity?.id ?? adminRole?.id ?? null,
        isActive: true,
        mustChangePassword: false,
      },
    });
    console.log(`OK ${u.email} / ${password}`);
  }
}

main().finally(() => prisma.$disconnect());
