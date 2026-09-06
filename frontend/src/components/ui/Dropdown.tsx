import { ChevronDown } from "lucide-react";
import { twMerge } from "tailwind-merge";
import type { SelectHTMLAttributes } from "react";

interface DropdownProps extends SelectHTMLAttributes<HTMLSelectElement> {
  variant?: "default" | "sidebar";
}

export function Dropdown({ className, children, disabled, variant = "default", ...props }: DropdownProps) {
  const sidebar = variant === "sidebar";

  return (
    <div className={twMerge("group relative", sidebar ? "min-w-0 flex-1" : "w-full", className)}>
      <select
        {...props}
        disabled={disabled}
        className={twMerge(
          "peer w-full cursor-pointer appearance-none outline-none transition-[border-color,box-shadow,background-color] disabled:cursor-not-allowed disabled:opacity-55",
          sidebar
            ? "h-8 border-0 bg-transparent py-1 pr-7 text-[12.5px] font-semibold text-white [&_option]:bg-white [&_option]:text-[#0d3b2e]"
            : "h-11 rounded-xl border border-[#d9e2d8] bg-white px-3.5 pr-11 text-sm font-medium text-[#19362a] shadow-[0_1px_2px_rgba(15,28,22,0.03)] hover:border-[#a9b9ad] focus:border-[#1a5c45] focus:ring-4 focus:ring-[#1a5c45]/10 disabled:bg-[#f3f5f2]",
        )}
      >
        {children}
      </select>
      <span className={twMerge(
        "pointer-events-none absolute top-1/2 grid -translate-y-1/2 place-items-center transition-transform group-focus-within:rotate-180",
        sidebar ? "right-0 text-white/60" : "right-3 size-7 rounded-lg bg-[#f3f7f1] text-[#587064] peer-focus:bg-[#e8f2df] peer-focus:text-[#1a5c45]",
      )}>
        <ChevronDown size={sidebar ? 15 : 16} strokeWidth={2.25} />
      </span>
    </div>
  );
}
