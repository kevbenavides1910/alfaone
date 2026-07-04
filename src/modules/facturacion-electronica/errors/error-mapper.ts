import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { FeDomainError } from "./fe-errors";
import { feLogger } from "../utils/logger";

export function mapFeErrorToResponse(error: unknown) {
  if (error instanceof FeDomainError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.statusCode }
    );
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return NextResponse.json(
      {
        error: {
          code: "FE_DUPLICATE",
          message: "Ya existe un registro con esos datos (identificación duplicada).",
        },
      },
      { status: 409 }
    );
  }
  feLogger.error("Error no controlado en FE", {
    error: error instanceof Error ? error.message : String(error),
  });
  return NextResponse.json(
    { error: { code: "SERVER_ERROR", message: "Error interno del módulo de facturación electrónica" } },
    { status: 500 }
  );
}
