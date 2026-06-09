from pathlib import Path
import sys

schema_path = Path(sys.argv[1] if len(sys.argv) > 1 else "/home/soporte-ti/presupuestos-alfa/prisma/schema.prisma")
text = schema_path.read_text(encoding="utf-8")

schedule_model = """/// Franja horaria de una ruta por día de la semana (0=domingo … 6=sábado).
model PatrolRouteSchedule {
  id        String      @id @default(cuid())
  routeId   String
  route     PatrolRoute @relation(fields: [routeId], references: [id], onDelete: Cascade)
  dayOfWeek Int
  startTime String
  endTime   String
  sortOrder Int         @default(0)
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  @@index([routeId])
  @@index([routeId, dayOfWeek])
  @@map("patrol_route_schedules")
}

"""

if "model PatrolRouteSchedule" not in text:
    marker = "/// Punto de marca dentro de una ruta"
    if marker in text:
        text = text.replace(marker, schedule_model + marker)
        print("Inserted PatrolRouteSchedule model")

if "openSchedule" not in text.split("model PatrolRoute")[1].split("///")[0]:
    text = text.replace(
        "  isActive    Boolean   @default(true)\n  createdAt   DateTime  @default(now())",
        "  isActive      Boolean   @default(true)\n  openSchedule  Boolean   @default(false)\n  createdAt     DateTime  @default(now())",
        1,
    )
    print("Added openSchedule to PatrolRoute")

if "schedules" not in text.split("model PatrolRoute")[1].split("///")[0]:
    text = text.replace(
        "  authorizedPhones  PatrolRoutePhone[]",
        "  authorizedPhones  PatrolRoutePhone[]\n  schedules         PatrolRouteSchedule[]",
    )
    print("Added schedules relation to PatrolRoute")

schema_path.write_text(text, encoding="utf-8")
print("schema OK")
