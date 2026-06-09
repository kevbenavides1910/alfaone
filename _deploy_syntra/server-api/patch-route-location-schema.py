from pathlib import Path
import sys

schema_path = Path(sys.argv[1] if len(sys.argv) > 1 else "/home/soporte-ti/presupuestos-alfa/prisma/schema.prisma")
text = schema_path.read_text(encoding="utf-8")

if "patrolRoutes" not in text.split("model ContractLocation")[1].split("model ")[0]:
    text = text.replace(
        "  positions   Position[]\n\n  @@index([contractId])",
        "  positions   Position[]\n  patrolRoutes PatrolRoute[]\n\n  @@index([contractId])",
    )
    print("Added patrolRoutes to ContractLocation")

if "patrolRoutes" not in text.split("model Position")[1].split("model ")[0]:
    text = text.replace(
        "  patrolRoutePoints  PatrolRoutePoint[]\n\n  @@index([locationId])",
        "  patrolRoutePoints  PatrolRoutePoint[]\n  patrolRoutes       PatrolRoute[]\n\n  @@index([locationId])",
    )
    print("Added patrolRoutes to Position")

old = """  contractId  String?
  contract    Contract? @relation(fields: [contractId], references: [id], onDelete: SetNull)
  isActive    Boolean   @default(true)"""

new = """  contractId  String?
  contract    Contract? @relation(fields: [contractId], references: [id], onDelete: SetNull)
  locationId  String?
  location    ContractLocation? @relation(fields: [locationId], references: [id], onDelete: SetNull)
  positionId  String?
  position    Position? @relation(fields: [positionId], references: [id], onDelete: SetNull)
  isActive    Boolean   @default(true)"""

if "locationId" not in text.split("model PatrolRoute")[1].split("///")[0]:
    if old in text:
        text = text.replace(old, new)
        print("Added locationId/positionId to PatrolRoute")
    else:
        print("PatrolRoute pattern not found")
        sys.exit(1)
else:
    print("PatrolRoute already has locationId")

schema_path.write_text(text, encoding="utf-8")
print("schema OK")
