import { formatChips } from "@/lib/utils";

interface PotBadgeProps {
  amount: number;
  street?: string;
}

export function PotBadge({ amount, street }: PotBadgeProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      {street && (
        <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300/80">
          {street}
        </span>
      )}
      <div className="rounded-full bg-black/50 border border-yellow-500/30 px-4 py-1.5 backdrop-blur-sm">
        <span className="font-mono text-sm font-bold text-yellow-300">
          Pot: {formatChips(amount)}
        </span>
      </div>
    </div>
  );
}
