"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";

export function SidebarPane() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("alfa-one:sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  return (
    <div className="h-full">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => {
          setCollapsed((c) => {
            const next = !c;
            localStorage.setItem("alfa-one:sidebar-collapsed", String(next));
            return next;
          });
        }}
      />
    </div>
  );
}
