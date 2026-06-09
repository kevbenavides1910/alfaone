"use client";

export function ContractsShell({ children }: { children: React.ReactNode }) {
  return <div className="contracts-canvas min-h-[calc(100dvh-4rem)]">{children}</div>;
}
