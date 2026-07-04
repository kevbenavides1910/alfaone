import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Accent = "blue" | "gray" | "green" | "red" | "purple";

const accentBorder: Record<Accent, string> = {
  blue: "border-l-[#0f62fe]",
  gray: "border-l-[#525252]",
  green: "border-l-[#198038]",
  red: "border-l-[#da1e28]",
  purple: "border-l-[#6929c4]",
};

type Props = {
  label: string;
  value: string;
  helper?: string;
  icon?: LucideIcon;
  accent?: Accent;
  className?: string;
};

export function CarbonStatTile({
  label,
  value,
  helper,
  icon: Icon,
  accent = "blue",
  className,
}: Props) {
  return (
    <div className={cn("carbon-tile border-l-4 p-4", accentBorder[accent], className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#525252]">
            {label}
          </p>
          <p className="mt-1 text-2xl font-normal tracking-tight text-[#161616] tabular-nums">
            {value}
          </p>
          {helper ? <p className="mt-1 text-xs text-[#525252] leading-snug">{helper}</p> : null}
        </div>
        {Icon ? (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-[#f4f4f4]">
            <Icon className="h-[1.125rem] w-[1.125rem] text-[#161616]" strokeWidth={1.5} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
