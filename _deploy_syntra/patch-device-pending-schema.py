from pathlib import Path

p = Path("/home/soporte-ti/presupuestos-alfa/prisma/schema.prisma")
if not p.exists():
    p = Path(__file__).resolve().parent / "schema.prisma"

t = p.read_text(encoding="utf-8")
block = """
/// Snapshot de marcas pendientes reportadas por la app (auditoria IMEI).
model PatrolDevicePendingSnapshot {
  id           String   @id @default(cuid())
  deviceId     String?
  imei         String
  employeeCode String?
  pendingCount Int      @default(0)
  staleCount   Int      @default(0)
  appVersion   String?
  payload      Json
  createdAt    DateTime @default(now())

  @@index([imei, createdAt])
  @@map("patrol_device_pending_snapshots")
}
"""

if "PatrolDevicePendingSnapshot" in t:
    print("PatrolDevicePendingSnapshot already in schema")
else:
    anchor = "/// Punto GPS enviado desde app SYNTRA."
    if anchor not in t:
        raise SystemExit("anchor not found")
    t = t.replace(anchor, block + "\n" + anchor, 1)
    p.write_text(t, encoding="utf-8")
    print("PatrolDevicePendingSnapshot schema patched")

print("Run: npx prisma db push  (or migrate) on server")
