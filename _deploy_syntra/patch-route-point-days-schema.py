from pathlib import Path
import re
import sys

schema_path = Path(sys.argv[1] if len(sys.argv) > 1 else "/home/soporte-ti/presupuestos-alfa/prisma/schema.prisma")
text = schema_path.read_text(encoding="utf-8")

point_day_model = """/// Días de la semana en que un punto de ruta está activo (si samePointsEveryDay = false).
model PatrolRoutePointDay {
  id        String             @id @default(cuid())
  routeId   String
  route     PatrolRoute        @relation(fields: [routeId], references: [id], onDelete: Cascade)
  pointId   String
  point     PatrolRoutePoint   @relation(fields: [pointId], references: [id], onDelete: Cascade)
  dayOfWeek Int
  createdAt DateTime           @default(now())

  @@unique([pointId, dayOfWeek])
  @@index([routeId, dayOfWeek])
  @@map("patrol_route_point_days")
}

"""

if "model PatrolRoutePointDay" not in text:
    marker = "/// Asignación dispositivo"
    if marker not in text:
        marker = "/// Marca NFC"
    if marker in text:
        text = text.replace(marker, point_day_model + marker)
        print("Inserted PatrolRoutePointDay model")

route_block = text.split("model PatrolRoute")[1].split("///")[0] if "model PatrolRoute" in text else ""

if "randomizePointOrder" not in route_block:
    updated, count = re.subn(
        r"(  samePointsEveryDay\s+Boolean\s+@default\(true\)\r?\n)",
        r"\1  randomizePointOrder       Boolean   @default(false)\n",
        text,
        count=1,
    )
    if count:
        text = updated
        print("Added randomizePointOrder to PatrolRoute")
    else:
        updated, count = re.subn(
            r"(  openSchedule\s+Boolean\s+@default\(false\)\r?\n)",
            r"\1  randomizePointOrder       Boolean   @default(false)\n",
            text,
            count=1,
        )
        if count:
            text = updated
            print("Added randomizePointOrder after openSchedule")

if "samePointsEveryDay" not in route_block:
    for anchor, insert in [
        (
            "  openSchedule            Boolean   @default(false)\n  welfareEnabled",
            "  openSchedule            Boolean   @default(false)\n  samePointsEveryDay        Boolean   @default(true)\n  welfareEnabled",
        ),
        (
            "  openSchedule  Boolean   @default(false)\n  createdAt",
            "  openSchedule            Boolean   @default(false)\n  samePointsEveryDay        Boolean   @default(true)\n  createdAt",
        ),
        (
            "  isActive    Boolean   @default(true)\n  createdAt",
            "  isActive              Boolean   @default(true)\n  samePointsEveryDay        Boolean   @default(true)\n  createdAt",
        ),
    ]:
        if anchor in text:
            text = text.replace(anchor, insert, 1)
            print("Added samePointsEveryDay to PatrolRoute")
            break

if "pointDays" not in route_block and "model PatrolRoutePoint" in text:
    if "  schedules         PatrolRouteSchedule[]" in text:
        text = text.replace(
            "  schedules         PatrolRouteSchedule[]",
            "  schedules         PatrolRouteSchedule[]\n  pointDays           PatrolRoutePointDay[]",
            1,
        )
    elif "  points      PatrolRoutePoint[]" in text:
        text = text.replace(
            "  points      PatrolRoutePoint[]",
            "  points      PatrolRoutePoint[]\n  pointDays     PatrolRoutePointDay[]",
            1,
        )
    print("Added pointDays relation to PatrolRoute")

if "pointDays" not in text.split("model PatrolRoutePoint")[1].split("///")[0]:
    text = text.replace(
        "  position    Position?   @relation(fields: [positionId], references: [id], onDelete: SetNull)\n  createdAt   DateTime",
        "  position    Position?   @relation(fields: [positionId], references: [id], onDelete: SetNull)\n  pointDays   PatrolRoutePointDay[]\n  createdAt   DateTime",
        1,
    )
    print("Added pointDays relation to PatrolRoutePoint")

schema_path.write_text(text, encoding="utf-8")
print("schema OK")
