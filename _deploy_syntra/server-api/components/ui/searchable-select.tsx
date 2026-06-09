"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export type SearchableSelectOption = {
  value: string;
  label: string;
};

function joinClasses(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function matchesQuery(label: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = label.toLowerCase();
  return q.split(/\s+/).filter(Boolean).every((word) => haystack.includes(word));
}

type SearchableSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchHint?: string;
  emptyMessage?: string;
  disabled?: boolean;
  id?: string;
};

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Buscar…",
  searchHint = "Escriba palabras clave para filtrar",
  emptyMessage = "Sin resultados",
  disabled = false,
  id,
}: SearchableSelectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  const filtered = useMemo(
    () => options.filter((option) => matchesQuery(option.label, query)),
    [options, query],
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setQuery("");
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayValue = open ? query : selected?.label ?? "";

  return (
    <div ref={containerRef} className="relative mt-1">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          id={id}
          value={displayValue}
          placeholder={open ? searchHint : placeholder}
          disabled={disabled}
          autoComplete="off"
          className="pl-9"
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              setQuery("");
              inputRef.current?.blur();
            }
          }}
        />
      </div>
      {open && !disabled && (
        <ul
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md"
          role="listbox"
        >
          <li
            role="option"
            aria-selected={value === ""}
            className={joinClasses(
              "cursor-pointer px-3 py-2 text-sm text-muted-foreground hover:bg-accent",
              value === "" && "bg-accent",
            )}
            onMouseDown={(event) => {
              event.preventDefault();
              onChange("");
              setOpen(false);
              setQuery("");
            }}
          >
            {placeholder}
          </li>
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">{emptyMessage}</li>
          ) : (
            filtered.map((option) => (
              <li
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                className={joinClasses(
                  "cursor-pointer px-3 py-2 text-sm hover:bg-accent",
                  option.value === value && "bg-accent font-medium",
                )}
                onMouseDown={(event) => {
                  event.preventDefault();
                  onChange(option.value);
                  setOpen(false);
                  setQuery("");
                }}
              >
                {option.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
