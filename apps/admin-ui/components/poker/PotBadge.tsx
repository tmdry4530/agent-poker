import { formatChips } from "@/lib/utils";

interface PotBadgeProps {
  amount: number;
  street?: string;
  sidePots?: Array<{ amount: number; eligiblePlayers?: string[] }>;
}

export function PotBadge({ amount, street, sidePots }: PotBadgeProps) {
  const hasSidePots = sidePots && sidePots.length > 0;

  return (
    <div className="flex flex-col items-center gap-1">
      {street && (
        <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300/80">
          {street}
        </span>
      )}
      <div className="flex flex-col items-center gap-1">
        <div className="rounded-full bg-black/50 border border-yellow-500/30 px-4 py-1.5 backdrop-blur-sm">
          <span className="font-mono text-sm font-bold text-yellow-300">
            {hasSidePots ? "Main" : "Pot"}: {formatChips(amount)}
          </span>
        </div>
        {hasSidePots && sidePots.map((sidePot, idx) => (
          <div key={idx} className="rounded-full bg-black/40 border border-yellow-500/20 px-3 py-1 backdrop-blur-sm">
            <span className="font-mono text-xs font-semibold text-yellow-300/80">
              Side #{idx + 1}: {formatChips(sidePot.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
