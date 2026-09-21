import { NextRequest } from "next/server";
import NextAuth from "next-auth";
import { authOptionsForRequest } from "@/modules/core/auth/auth-options";

async function handler(req: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) {
  const options = authOptionsForRequest(req.headers.get("host"), req.headers.get("x-forwarded-proto"));
  return NextAuth(options)(req, context);
}

export { handler as GET, handler as POST };
