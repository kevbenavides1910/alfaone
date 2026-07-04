"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

type SearchHit = {
  id: string;
  ticketNumber: string;
  title: string;
  category: string;
  status: string;
  href: string;
};

export function TicketSearchBar() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data } = useQuery<{ data: SearchHit[] }>({
    queryKey: ["tickets-ti-search", debounced],
    enabled: debounced.length >= 2,
    queryFn: async () => {
      const r = await fetch(`/api/tickets-ti/search?q=${encodeURIComponent(debounced)}`);
      const json = await r.json();
      if (json.error) throw new Error(json.error.message);
      return json;
    },
  });

  const hits = data?.data ?? [];

  return (
    <div className="relative max-w-xl w-full">
      <Search className="absolute left-3 top-1/2 -h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar ticket, solicitante, categoría…"
        className="w-full rounded-md border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm"
      />
      {debounced.length >= 2 && hits.length > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg max-h-72 overflow-y-auto">
          {hits.map((hit) => (
            <Link
              key={hit.id}
              href={hit.href}
              className="block px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0"
              onClick={() => setQ("")}
            >
              <div className="font-mono text-xs text-indigo-700">{hit.ticketNumber}</div>
              <div className="text-sm font-medium text-slate-800 truncate">{hit.title}</div>
              <div className="text-xs text-slate-500">
                {hit.category} · {hit.status}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
