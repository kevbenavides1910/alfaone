from pathlib import Path
import sys

schema_path = Path(sys.argv[1] if len(sys.argv) > 1 else "/home/soporte-ti/presupuestos-alfa/prisma/schema.prisma")
text = schema_path.read_text(encoding="utf-8")

block = """
/// Entrada de bitácora digital (app o web).
model PatrolBitacoraEntry {
  id                String   @id @default(cuid())
  deviceId          String?
  imei              String
  employeeCode      String
  description       String   @db.Text
  routeCode         String?
  incidentAt        DateTime
  imageMimeType     String?
  imageFileName     String?
  imagePath         String?
  source            String   @default("APP")
  linkedOmissionKey String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  justification PatrolOmissionJustification?

  @@index([imei])
  @@index([incidentAt])
  @@index([linkedOmissionKey])
  @@map("patrol_bitacora_entries")
}

/// Justificación de una omisión de marca NFC.
model PatrolOmissionJustification {
  id              String   @id @default(cuid())
  omissionKey     String   @unique
  fecha           String
  deviceId        String
  routeId         String
  routePointId    String
  routeCode       String
  pointLabel      String
  nfcTagCode      String
  description     String   @db.Text
  imageMimeType   String?
  imageFileName   String?
  imagePath       String?
  source          String   @default("WEB")
  bitacoraEntryId String?  @unique
  bitacoraEntry   PatrolBitacoraEntry? @relation(fields: [bitacoraEntryId], references: [id], onDelete: SetNull)
  createdById     String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([fecha])
  @@index([deviceId])
  @@map("patrol_omission_justifications")
}

"""

if "model PatrolBitacoraEntry" not in text:
    marker = "/// Marca NFC o reloj desde app SYNTRA."
    if marker in text:
        text = text.replace(marker, block + marker)
        print("Inserted bitacora + justification models")
    else:
        print("Marker not found")
        sys.exit(1)
else:
    print("Models already present")

schema_path.write_text(text, encoding="utf-8")
print("schema OK")
