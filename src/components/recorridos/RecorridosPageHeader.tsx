import type { LucideIcon } from "lucide-react";

interface Props {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
}

export function RecorridosPageHeader({ title, description, icon: Icon, actions }: Props) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          {Icon ? <Icon className="h-5 w-5 text-red-600 shrink-0" /> : null}
          {title}
        </h2>
        {description ? <p className="text-sm text-slate-500 mt-1 max-w-3xl">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div> : null}
    </div>
  );
}
