import { BandecoShell } from "@/components/bandeco/BandecoShell";

export default function BandecoLayout({ children }: { children: React.ReactNode }) {
  return <BandecoShell>{children}</BandecoShell>;
}
