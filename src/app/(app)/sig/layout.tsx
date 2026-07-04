import { SigSectionNav } from "@/components/sig/SigSectionNav";

export default function SigLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      <SigSectionNav />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
