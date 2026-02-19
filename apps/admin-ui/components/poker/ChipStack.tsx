import { cn } from "@/lib/utils";
import { formatChips } from "@/lib/utils";

interface ChipStackProps {
  amount: number;
  className?: string;
  size?: "sm" | "md";
}

export function ChipStack({ amount, className, size = "md" }: ChipStackProps) {
  if (amount <= 0) return null;

  const chipColors = ["bg-red-600", "bg-blue-600", "bg-green-600", "bg-yellow-500"];
  const chipCount = Math.min(Math.ceil(amount / 50), 4);

  return (
    <div className={cn("flex flex-col items-center gap-0.5", className)}>
      <div className="flex flex-col-reverse items-center">
        {Array.from({ length: chipCount }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "rounded-full border border-white/30 shadow-sm",
              chipColors[i % chipColors.length],
              size === "sm" ? "h-1.5 w-4 -mt-0.5" : "h-2 w-6 -mt-1",
              i === 0 && "mt-0",
            )}
          />
        ))}
      </div>
      <span className={cn("font-mono font-bold text-white drop-shadow-md", size === "sm" ? "text-[10px]" : "text-xs")}>
        {formatChips(amount)}
      </span>
    </div>
  );
}
