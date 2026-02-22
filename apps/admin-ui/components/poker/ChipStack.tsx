import { cn } from "@/lib/utils";

interface ChipStackProps {
  amount: number;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const getChipColor = (amt: number) => {
  if (amt >= 5000) return "from-orange-400 to-orange-600 border-orange-300 shadow-orange-500/40";
  if (amt >= 1000) return "from-yellow-400 to-yellow-600 border-yellow-300 shadow-yellow-500/40";
  if (amt >= 500) return "from-purple-400 to-purple-600 border-purple-300 shadow-purple-500/40";
  if (amt >= 100) return "from-zinc-300 to-zinc-500 border-zinc-200 shadow-zinc-400/40";
  if (amt >= 25) return "from-blue-400 to-blue-600 border-blue-300 shadow-blue-500/40";
  return "from-red-400 to-red-600 border-red-300 shadow-red-500/40";
};

export function ChipStack({ amount, className, size = "md" }: ChipStackProps) {
  if (amount <= 0) return null;

  const chipColor = getChipColor(amount);
  const chipSize = size === "sm" ? "w-4 h-4" : size === "lg" ? "w-7 h-7" : "w-5 h-5";
  const innerSize = size === "sm" ? "w-2 h-2" : size === "lg" ? "w-4 h-4" : "w-3 h-3";

  return (
    <div className={cn("flex items-center gap-1.5 group", className)} title={`$${amount.toLocaleString()}`}>
      {/* Stacked chip effect */}
      <div className="relative">
        {amount >= 100 && (
          <div className={cn(
            "absolute -top-0.5 left-0 rounded-full bg-gradient-to-br border opacity-60",
            chipColor, chipSize,
          )} />
        )}
        <div className={cn(
          "relative rounded-full bg-gradient-to-br border shadow-md flex items-center justify-center",
          chipColor, chipSize,
        )}>
          <div className={cn("rounded-full border border-white/30", innerSize)} />
        </div>
      </div>
      <span className="text-[11px] font-mono font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
        ${amount.toLocaleString()}
      </span>
    </div>
  );
}
