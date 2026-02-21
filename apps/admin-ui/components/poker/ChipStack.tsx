import { cn } from "@/lib/utils";
import { formatChips } from "@/lib/utils";

interface ChipStackProps {
  amount: number;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function ChipStack({ amount, className, size = "md" }: ChipStackProps) {
  if (amount <= 0) return null;

  // Determine standard casino chip color roughly by amount tier
  const getChipStyle = (amt: number) => {
    if (amt >= 5000) return "bg-orange-500 border-white text-black ring-orange-700";
    if (amt >= 1000) return "bg-yellow-500 border-white text-black ring-yellow-600";
    if (amt >= 500) return "bg-purple-600 border-white text-white ring-purple-900";
    if (amt >= 100) return "bg-zinc-900 border-white text-white ring-zinc-950";
    if (amt >= 25) return "bg-blue-600 border-white text-white ring-blue-900";
    return "bg-red-600 border-white text-white ring-red-900";
  };

  const styleClass = getChipStyle(amount);

  return (
    <div className={cn("flex flex-col items-center justify-center relative drop-shadow-lg group", className)} title={`$${amount.toLocaleString()}`}>
      {/* Decorative Chip Icon */}
      <div className={cn(
        "relative rounded-full flex items-center justify-center shadow-[0_4px_10px_rgba(0,0,0,0.5)] border-[3px] border-dashed ring-2 ring-black/80 transition-transform group-hover:scale-110",
        styleClass,
        "w-8 h-8 md:w-10 md:h-10" // Base decorative size
      )}>
        <div className="absolute inset-1 rounded-full bg-black/20" />
      </div>

      {/* Detached Value Badge (Method A) */}
      <div className="absolute -bottom-5 w-auto whitespace-nowrap px-2.5 py-0.5 bg-black/80 border border-white/20 rounded-full text-[11px] font-mono font-bold text-white shadow-lg z-20 group-hover:scale-105 transition-transform origin-top">
        ${amount.toLocaleString()}
      </div>
    </div>
  );
}
