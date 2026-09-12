import { redirect } from "next/navigation";

/** Alias histórico / bookmark: SIGology → biblioteca SIG. */
export default function SigologyAliasPage() {
  redirect("/sig");
}
