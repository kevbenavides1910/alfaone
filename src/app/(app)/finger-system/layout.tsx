import { FingerSystemShell } from "@/components/finger-system/FingerSystemShell";
import { FingerCompanyProvider } from "@/components/finger-system/finger-company-context";

export default function FingerSystemLayout({ children }: { children: React.ReactNode }) {
  return (
    <FingerCompanyProvider>
      <FingerSystemShell>{children}</FingerSystemShell>
    </FingerCompanyProvider>
  );
}
