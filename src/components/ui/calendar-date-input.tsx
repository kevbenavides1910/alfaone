"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  formatCalendarDateForInput,
  parseCalendarDateFromDisplay,
} from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  /** Valor interno YYYY-MM-DD (vacío si no hay fecha). */
  value: string;
  onChange: (value: string) => void;
  /** Botón para abrir el calendario nativo del navegador. */
  showPicker?: boolean;
};

export function CalendarDateInput({
  value,
  onChange,
  className,
  onBlur,
  showPicker = false,
  ...props
}: Props) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => formatCalendarDateForInput(value));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setText(formatCalendarDateForInput(value));
    setInvalid(false);
  }, [value]);

  function applyIso(iso: string) {
    if (!iso) {
      setInvalid(false);
      setText("");
      onChange("");
      return;
    }

    setInvalid(false);
    setText(formatCalendarDateForInput(iso));
    onChange(iso);
  }

  function commit(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      applyIso("");
      return;
    }

    const iso = parseCalendarDateFromDisplay(trimmed);
    if (!iso) {
      setInvalid(true);
      setText(formatCalendarDateForInput(value));
      return;
    }

    applyIso(iso);
  }

  function openCalendarPicker() {
    const el = pickerRef.current;
    if (!el || props.disabled) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
      el.click();
    }
  }

  return (
    <div className="relative w-full">
      <Input
        {...props}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={props.placeholder ?? "dd/mm/aaaa"}
        spellCheck={false}
        value={text}
        className={cn(className, invalid && "border-red-500 focus-visible:ring-red-500", showPicker && "pr-9")}
        onChange={(e) => {
          setInvalid(false);
          setText(e.target.value);
        }}
        onBlur={(e) => {
          commit(e.target.value);
          onBlur?.(e);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
          props.onKeyDown?.(e);
        }}
      />
      {showPicker && (
        <>
          <input
            ref={pickerRef}
            type="date"
            value={value}
            onChange={(e) => applyIso(e.target.value)}
            disabled={props.disabled}
            tabIndex={-1}
            aria-hidden
            className="pointer-events-none absolute h-0 w-0 opacity-0"
          />
          <button
            type="button"
            className="absolute right-0 top-0 flex h-full w-9 items-center justify-center rounded-r-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:pointer-events-none disabled:opacity-50"
            onClick={openCalendarPicker}
            disabled={props.disabled}
            title="Seleccionar en calendario"
            aria-label="Seleccionar fecha en calendario"
          >
            <CalendarDays className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
}
