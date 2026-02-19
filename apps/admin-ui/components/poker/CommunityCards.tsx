import { CardHand } from "./PokerCard";

interface CommunityCardsProps {
  cards: Array<{ rank: string; suit: string }>;
}

export function CommunityCards({ cards }: CommunityCardsProps) {
  if (cards.length === 0) return null;

  // Pad to 5 positions for consistent layout
  const display = [...cards];

  return (
    <div className="flex items-center gap-1">
      <CardHand cards={display} size="lg" />
    </div>
  );
}
