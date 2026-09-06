// Complete utility strings keep every dynamic variant visible to Tailwind.
export const badgeVariants: Record<string, string> = {
  "green": "bg-[#eaf8f0] text-[#1b8f5a]",
  "yellow": "bg-[#fef5e4] text-[#c87d12]",
  "red": "bg-[#fdf0f0] text-[#c03030]",
  "blue": "bg-[#e8f2ff] text-[#1864ab]",
  "purple": "bg-[#f5f0ff] text-[#7c3aed]",
  "gray": "bg-[#f0f2ee] text-[#7a9185]",
  "brand": "bg-[rgba(168,213,72,0.18)] text-[#1a5c45]",
  "info": "bg-[#e8f2ff] text-[#1864ab]"
};

export const iconVariants: Record<string, string> = {
  "green": "bg-[#eaf8f0] text-[#1b8f5a]",
  "yellow": "bg-[#fef5e4] text-[#c87d12]",
  "red": "bg-[#fdf0f0] text-[#c03030]",
  "blue": "bg-[#e8f2ff] text-[#1864ab]",
  "purple": "bg-[#f5f0ff] text-[#7c3aed]",
  "brand": "bg-[rgba(168,213,72,0.18)] text-[#1a5c45]"
};

export const buttonVariants: Record<string, string> = {
  "primary": "bg-[#0d3b2e] text-[#fff] [&:hover]:bg-[#1a5c45] [&:hover]:shadow-[0_4px_12px_rgba(13,59,46,0.25)] [&:hover]:[transform:translateY(-1px)]",
  "secondary": "bg-[#f8faf7] text-[#445e50] [border:1px_solid_#e0e5dd] [&:hover]:bg-[#f3f5f2] [&:hover]:[border-color:#c5cec1]",
  "ghost": "[background:none] text-[#445e50] [&:hover]:bg-[#f3f5f2]",
  "danger": "bg-[#fdf0f0] text-[#c03030] [border:1px_solid_#f5c0c0] [&:hover]:bg-[#fbdfdf]",
  "accent": "bg-[#a8d548] text-[#0d3b2e] font-bold [&:hover]:bg-[#c8e87a] [&:hover]:shadow-[0_4px_12px_rgba(168,213,72,0.35)] [&:hover]:[transform:translateY(-1px)]",
  "sm": "p-[6px_10px] text-[12px]"
};

export const noticeVariants: Record<string, string> = {
  "info": "bg-[#f0f7ff] text-[#1e40af] [border:1px_solid_#c7d2fe]",
  "warn": "bg-[#fffbe6] text-[#854d0e] [border:1px_solid_#fef08a]",
  "error": "bg-[#fef2f2] text-[#991b1b] [border:1px_solid_#fecaca]",
  "success": "bg-[#f0fdf4] text-[#166534] [border:1px_solid_#bbf7d0]"
};

export const tooltipPositions: Record<string, string> = {
  "top": "bottom-full left-[50%] [transform:translateX(-50%)_translateY(-8px)]",
  "bottom": "top-full left-[50%] [transform:translateX(-50%)_translateY(8px)]",
  "left": "right-full top-[50%] [transform:translateY(-50%)_translateX(-8px)]",
  "right": "left-full top-[50%] [transform:translateY(-50%)_translateX(8px)]"
};
