"use client";

import { redirect } from "next/navigation";

// /forgot-password redirige a /login?mode=forgot para mantener un solo componente
export default function ForgotPasswordPage() {
  redirect("/login?mode=forgot");
}
