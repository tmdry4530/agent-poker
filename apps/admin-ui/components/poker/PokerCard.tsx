import { cn } from "@/lib/utils";

const suitSymbols: Record<string, string> = {
  h: "\u2665", d: "\u2666", c: "\u2663", s: "\u2660",
};
const suitColors: Record<string, string> = {
  h: "text-red-600", d: "text-blue-600", c: "text-emerald-700", s: "text-zinc-950",
};

interface PokerCardProps {
  rank: string;
  suit: string;
  faceDown?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizes = {
  sm: "h-10 w-7 text-[10px]",
  md: "h-14 w-10 text-xs",
  lg: "h-20 w-14 text-sm",
  xl: "h-24 w-[72px] text-lg rounded-md border-2",
};

export function PokerCard({ rank, suit, faceDown, size = "md" }: PokerCardProps) {
  if (faceDown) {
    return (
      <div className={cn(
        "relative inline-flex items-center justify-center rounded-sm shadow-xl overflow-hidden border border-white/20",
        sizes[size],
      )}
      style={{
        background: "linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)",
      }}>
        {/* Card Back Pattern */}
        <div 
          className="absolute inset-1 border border-white/10 rounded-[2px]"
          style={{
            backgroundImage: "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)",
            backgroundSize: "6px 6px"
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent mix-blend-overlay" />
      </div>
    );
  }
  
  return (
    <div className={cn(
      "relative inline-flex flex-col items-center justify-center rounded-sm bg-gradient-to-br from-white to-gray-200 font-mono font-bold shadow-lg border border-zinc-400 overflow-hidden",
      suitColors[suit] ?? "text-zinc-900",
      sizes[size],
    )}>
      {/* Top Left Rank */}
      <div className="absolute top-0.5 left-1 flex flex-col items-center leading-none">
        <span className="text-[0.9em]">{rank}</span>
        <span className="text-[0.6em] -mt-0.5">{suitSymbols[suit] ?? suit}</span>
      </div>
      
      {/* Center Large Suit (slight opacity for style) */}
      <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[2em] opacity-10 pointer-events-none">
        {suitSymbols[suit] ?? suit}
      </span>
      
      {/* Bottom Right Rank (inverted) */}
      <div className="absolute bottom-0.5 right-1 flex flex-col items-center leading-none rotate-180">
        <span className="text-[0.9em]">{rank}</span>
        <span className="text-[0.6em] -mt-0.5">{suitSymbols[suit] ?? suit}</span>
      </div>
      
      {/* Glossy overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent pointer-events-none mix-blend-overlay" />
    </div>
  );
}

export function CardHand({ cards, faceDown, size }: {
  cards: Array<{ rank: string; suit: string }>;
  faceDown?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  return (
    <div className="flex -space-x-2 drop-shadow-2xl">
      {cards.map((c, i) => (
        <div 
          key={i} 
          className={cn(
            "transition-transform hover:-translate-y-1",
            i > 0 && "rotate-[8deg] translate-y-1 origin-bottom-left"
          )}
          style={{ zIndex: i }}
        >
          <PokerCard rank={c.rank} suit={c.suit} faceDown={faceDown} size={size} />
        </div>
      ))}
    </div>
  );
}
