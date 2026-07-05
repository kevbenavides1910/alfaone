from pathlib import Path
import sys

schema_path = Path(sys.argv[1] if len(sys.argv) > 1 else "/home/soporte-ti/presupuestos-alfa/prisma/schema.prisma")
text = schema_path.read_text(encoding="utf-8")

welfare_model = """/// Registro de alerta de hombre vivo (programada o manual).
model PatrolWelfareCheck {
  id              String      @id @default(cuid())
  routeId         String
  route           PatrolRoute @relation(fields: [routeId], references: [id], onDelete: Cascade)
  deviceId        String?
  imei            String
  source          String      @default("MANUAL")
  status          String      @default("PENDING")
  scheduledAt     DateTime    @default(now())
  triggeredAt     DateTime?
  acknowledgedAt  DateTime?
  ackLatitude     Decimal?    @db.Decimal(10, 7)
  ackLongitude    Decimal?    @db.Decimal(10, 7)
  createdAt       DateTime    @default(now())

  @@index([routeId])
  @@index([imei, status])
  @@map("patrol_welfare_checks")
}

"""

if "model PatrolWelfareCheck" not in text:
    marker = "/// Punto de marca dentro de una ruta"
    if marker in text:
        text = text.replace(marker, welfare_model + marker)
        print("Inserted PatrolWelfareCheck model")

route_block = text.split("model PatrolRoute")[1].split("///")[0] if "model PatrolRoute" in text else ""

if "welfareEnabled" not in route_block:
    welfare_fields = (
        "  welfareEnabled          Boolean   @default(false)\n"
        "  welfareIntervalMinutes  Int       @default(60)\n"
    )
    replaced = False
    for anchor in [
        "  samePointsEveryDay  Boolean   @default(true)\n  createdAt     DateTime  @default(now())",
        "  openSchedule  Boolean   @default(false)\n  createdAt     DateTime  @default(now())",
        "  isActive    Boolean   @default(true)\n  createdAt   DateTime  @default(now())",
    ]:
        if anchor in text:
            text = text.replace(anchor, anchor.split("\n")[0] + "\n" + welfare_fields + anchor.split("\n", 1)[1], 1)
            replaced = True
            break
    if not replaced:
        text = text.replace(
            "  openSchedule        Boolean   @default(false)\n  samePointsEveryDay  Boolean   @default(true)\n  createdAt     DateTime  @default(now())",
            "  openSchedule            Boolean   @default(false)\n  samePointsEveryDay        Boolean   @default(true)\n"
            + welfare_fields
            + "  createdAt               DateTime  @default(now())",
            1,
        )
    print("Added welfare fields to PatrolRoute")

if "welfareChecks" not in route_block:
    if "schedules         PatrolRouteSchedule[]" in text:
        text = text.replace(
            "  schedules         PatrolRouteSchedule[]",
            "  schedules         PatrolRouteSchedule[]\n  welfareChecks       PatrolWelfareCheck[]",
            1,
        )
    else:
        text = text.replace(
            "  assignments PatrolAssignment[]",
            "  assignments   PatrolAssignment[]\n  welfareChecks   PatrolWelfareCheck[]",
            1,
        )
    print("Added welfareChecks relation to PatrolRoute")

schema_path.write_text(text, encoding="utf-8")
print("schema OK")
