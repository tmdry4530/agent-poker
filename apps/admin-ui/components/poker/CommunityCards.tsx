import { PokerCard } from "./PokerCard";

interface CommunityCardsProps {
  cards: Array<{ rank: string; suit: string }>;
}

export function CommunityCards({ cards }: CommunityCardsProps) {
  // Always render 5 slots. If a card exists at index i, render it. Otherwise, render a placeholder.
  return (
    <div className="flex items-center gap-2 drop-shadow-xl relative z-10">
      {[0, 1, 2, 3, 4].map((index) => {
        const card = cards[index];
        return card ? (
          <div key={index} className="transition-all duration-500 animate-in fade-in zoom-in slide-in-from-bottom-5">
            <PokerCard 
              rank={card.rank} 
              suit={card.suit} 
              size="xl" 
              faceDown={false} 
            />
          </div>
        ) : (
          <div 
            key={index} 
            className="w-[72px] h-[100px] rounded-xl border-2 border-dashed border-white/10 bg-black/20 flex items-center justify-center backdrop-blur-sm"
          >
            <div className="w-8 h-8 rounded-full bg-white/5" />
          </div>
        );
      })}
    </div>
  );
}
