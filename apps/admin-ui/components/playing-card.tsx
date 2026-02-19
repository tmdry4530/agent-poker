import { cn } from "@/lib/utils";

const suitSymbols: Record<string, string> = {
  h: "\u2665", d: "\u2666", c: "\u2663", s: "\u2660",
};
const suitColors: Record<string, string> = {
  h: "text-red-500", d: "text-red-400", c: "text-foreground", s: "text-foreground",
};

interface PlayingCardProps {
  rank: string;
  suit: string;
  faceDown?: boolean;
  size?: "sm" | "md";
}

export function PlayingCard({ rank, suit, faceDown, size = "md" }: PlayingCardProps) {
  if (faceDown) {
    return (
      <div className={cn(
        "inline-flex items-center justify-center rounded border border-border bg-primary/20",
        size === "sm" ? "h-8 w-6 text-xs" : "h-12 w-9 text-sm",
      )}>
        <span className="text-primary">?</span>
      </div>
    );
  }
  return (
    <div className={cn(
      "inline-flex flex-col items-center justify-center rounded border border-border bg-card font-mono font-bold",
      suitColors[suit] ?? "text-foreground",
      size === "sm" ? "h-8 w-6 text-xs" : "h-12 w-9 text-sm",
    )}>
      <span className="leading-none">{rank}</span>
      <span className={cn("leading-none", size === "sm" ? "text-[8px]" : "text-xs")}>{suitSymbols[suit] ?? suit}</span>
    </div>
  );
}

export function CardGroup({ cards, faceDown, size }: { cards: Array<{ rank: string; suit: string }>; faceDown?: boolean; size?: "sm" | "md" }) {
  return (
    <div className="flex gap-1">
      {cards.map((c, i) => (
        <PlayingCard key={i} rank={c.rank} suit={c.suit} faceDown={faceDown} size={size} />
      ))}
    </div>
  );
}
