import { ExpensesSectionNav } from "@/components/expenses/ExpensesSectionNav";

export default function GastosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-0 flex flex-col">
      <ExpensesSectionNav />
      {children}
    </div>
  );
}
