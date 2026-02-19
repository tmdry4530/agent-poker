import { cn } from "@/lib/utils";

const suitSymbols: Record<string, string> = {
  h: "\u2665", d: "\u2666", c: "\u2663", s: "\u2660",
};
const suitColors: Record<string, string> = {
  h: "text-red-500", d: "text-red-400", c: "text-zinc-100", s: "text-zinc-100",
};

interface PokerCardProps {
  rank: string;
  suit: string;
  faceDown?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: "h-7 w-5 text-[9px]",
  md: "h-10 w-7 text-xs",
  lg: "h-14 w-10 text-sm",
};

export function PokerCard({ rank, suit, faceDown, size = "md" }: PokerCardProps) {
  if (faceDown) {
    return (
      <div className={cn(
        "inline-flex items-center justify-center rounded-sm border border-zinc-600 shadow-md",
        sizes[size],
      )}
      style={{
        background: "repeating-linear-gradient(135deg, #1e3a5f, #1e3a5f 2px, #1a3355 2px, #1a3355 4px)",
      }}
      />
    );
  }
  return (
    <div className={cn(
      "inline-flex flex-col items-center justify-center rounded-sm border border-zinc-300 bg-white font-mono font-bold shadow-md",
      suitColors[suit] ?? "text-zinc-900",
      sizes[size],
    )}>
      <span className="leading-none">{rank}</span>
      <span className="leading-none" style={{ fontSize: "0.7em" }}>{suitSymbols[suit] ?? suit}</span>
    </div>
  );
}

export function CardHand({ cards, faceDown, size }: {
  cards: Array<{ rank: string; suit: string }>;
  faceDown?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div className="flex -space-x-1">
      {cards.map((c, i) => (
        <PokerCard key={i} rank={c.rank} suit={c.suit} faceDown={faceDown} size={size} />
      ))}
    </div>
  );
}
