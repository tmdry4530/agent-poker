import { cn } from "@/lib/utils";

// Map suits to standard Unicode characters and their corresponding text color classes
const suitDetails: Record<string, { symbol: string; color: string }> = {
  c: { symbol: "\u2663\uFE0E", color: "text-zinc-900" }, // Clubs ♣
  d: { symbol: "\u2666\uFE0E", color: "text-red-600" },  // Diamonds ♦
  h: { symbol: "\u2665\uFE0E", color: "text-red-600" },  // Hearts ♥
  s: { symbol: "\u2660\uFE0E", color: "text-zinc-900" }, // Spades ♠
};

interface PokerCardProps {
  rank: string | null;
  suit: string | null;
  faceDown?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  dimmed?: boolean;
}

const sizes = {
  sm: { className: "h-12 w-9 border", text: "text-[10px]", corner: "text-[8px] leading-tight", icon: "text-[20px]" },
  md: { className: "h-16 w-12 border", text: "text-sm", corner: "text-[10px] leading-tight", icon: "text-[28px]" },
  lg: { className: "h-20 w-[60px] border-[1.5px]", text: "text-base", corner: "text-xs leading-none", icon: "text-[38px]" },
  xl: { className: "h-24 w-[72px] border-2", text: "text-lg", corner: "text-sm leading-none", icon: "text-[46px]" },
};

export function PokerCard({ rank, suit, faceDown, size = "md", dimmed }: PokerCardProps) {
  const s = sizes[size];
  
  if (faceDown) {
    return (
      <div
        className={cn(
          "relative inline-flex items-center justify-center rounded-md bg-slate-800 border-[1.5px] border-slate-900 shadow-[0_4px_10px_rgba(0,0,0,0.5)] overflow-hidden shrink-0",
          s.className,
          dimmed && "opacity-40 saturate-50"
        )}
      >
        <div className="absolute inset-1 rounded-sm border border-slate-600/50 bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(255,255,255,0.05)_2px,rgba(255,255,255,0.05)_4px)]" />
        <div className="w-5 h-5 rounded-full border border-slate-600 flex items-center justify-center bg-slate-900 shadow-inner">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
        </div>
      </div>
    );
  }

  // If rank/suit is null and not faceDown, it's an empty placeholder
  if (!rank || !suit) {
     return (
       <div
         className={cn(
           "relative inline-block rounded-md border border-white/5 bg-black/20 shrink-0",
           s.className
         )}
       />
     );
  }

  const normalizedSuit = suit.toLowerCase();
  const details = suitDetails[normalizedSuit] || suitDetails["s"]; // Fallback to spades
  const displayRank = rank === "T" ? "10" : rank;

  return (
    <div
      className={cn(
        "relative inline-flex flex-col bg-white border-zinc-200 rounded-md shadow-[0_4px_10px_rgba(0,0,0,0.5)] overflow-hidden shrink-0 select-none",
        s.className,
        details.color,
        dimmed && "opacity-40 saturate-50"
      )}
    >
      {/* Top Left Corner */}
      <div className={cn("absolute top-0.5 left-1 flex flex-col items-center justify-center font-bold font-mono tracking-tighter", s.corner)}>
        <span className="-mb-0.5">{displayRank}</span>
        <span>{details.symbol}</span>
      </div>

      {/* Center Large Suit */}
      <div className={cn("absolute inset-0 flex items-center justify-center -mt-0.5 drop-shadow-sm", s.icon)}>
        {details.symbol}
      </div>

      {/* Bottom Right Corner (Inverted) */}
      <div className={cn("absolute bottom-0.5 right-1 flex flex-col items-center justify-center font-bold font-mono tracking-tighter rotate-180", s.corner)}>
        <span className="-mb-0.5">{displayRank}</span>
        <span>{details.symbol}</span>
      </div>
    </div>
  );
}

export function CardHand({ cards, faceDown, size = "md", dimmed }: {
  cards: Array<{ rank: string; suit: string }>;
  faceDown?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  dimmed?: boolean;
}) {
  return (
    <div className="flex gap-1 drop-shadow-xl z-20">
      {cards.map((c, i) => (
        <div
          key={i}
          className={cn(
            "transition-transform hover:-translate-y-2",
            i > 0 && "rotate-[6deg] origin-bottom-left"
          )}
          style={{ zIndex: i }}
        >
          <PokerCard rank={c.rank} suit={c.suit} faceDown={faceDown} size={size} dimmed={dimmed} />
        </div>
      ))}
    </div>
  );
}
