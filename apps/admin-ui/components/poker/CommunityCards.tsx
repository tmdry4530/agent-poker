import { PokerCard } from "./PokerCard";

interface CommunityCardsProps {
  cards: Array<{ rank: string; suit: string }>;
}

export function CommunityCards({ cards }: CommunityCardsProps) {
  if (cards.length === 0) return null;

  return (
    <div className="flex items-center gap-2 drop-shadow-xl relative z-10">
      {cards.map((card, index) => (
        <div key={index} className="transition-all duration-500 animate-in fade-in zoom-in-95">
          <PokerCard
            rank={card.rank}
            suit={card.suit}
            size="xl"
            faceDown={false}
          />
        </div>
      ))}
    </div>
  );
}
