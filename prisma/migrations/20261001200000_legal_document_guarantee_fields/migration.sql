-- Campos de garantía (texto libre). Aditivo.

ALTER TABLE "legal_documents" ADD COLUMN "tenderNumber" TEXT;
ALTER TABLE "legal_documents" ADD COLUMN "guaranteeEntity" TEXT;
ALTER TABLE "legal_documents" ADD COLUMN "guaranteeNumber" TEXT;
