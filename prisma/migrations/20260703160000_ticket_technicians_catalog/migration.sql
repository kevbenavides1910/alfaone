-- Catálogo de técnicos (usuarios seleccionables al crear ticket)
CREATE TABLE "ticket_technicians" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_technicians_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ticket_technicians_userId_key" ON "ticket_technicians"("userId");

ALTER TABLE "ticket_technicians" ADD CONSTRAINT "ticket_technicians_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
