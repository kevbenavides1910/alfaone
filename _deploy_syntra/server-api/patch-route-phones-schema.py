from pathlib import Path
import sys

schema_path = Path(sys.argv[1] if len(sys.argv) > 1 else "/home/soporte-ti/presupuestos-alfa/prisma/schema.prisma")
text = schema_path.read_text(encoding="utf-8")

model_block = """/// Celular autorizado para ejecutar una ruta (principal o adicional).
model PatrolRoutePhone {
  id        String      @id @default(cuid())
  routeId   String
  route     PatrolRoute @relation(fields: [routeId], references: [id], onDelete: Cascade)
  assetId   String
  isPrimary Boolean     @default(false)
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  @@unique([routeId, assetId])
  @@index([routeId])
  @@map("patrol_route_phones")
}

"""

if "model PatrolRoutePhone" not in text:
    marker = "/// Punto de marca dentro de una ruta (NFC, coords, ventana horaria)."
    if marker in text:
        text = text.replace(marker, model_block + marker)
        print("Inserted PatrolRoutePhone model")
    else:
        print("Marker not found")
        sys.exit(1)

old_rel = """  points      PatrolRoutePoint[]
  assignments PatrolAssignment[]"""
new_rel = """  points            PatrolRoutePoint[]
  assignments       PatrolAssignment[]
  authorizedPhones  PatrolRoutePhone[]"""

if "authorizedPhones" not in text and old_rel in text:
    text = text.replace(old_rel, new_rel)
    print("Added authorizedPhones relation")

schema_path.write_text(text, encoding="utf-8")
print("schema OK")
