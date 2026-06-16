import type { StatCardData } from "../types";
import { StatCard } from "./StatCard";

export function StatCardsRow({ cards }: { cards: StatCardData[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <StatCard key={card.title} data={card} />
      ))}
    </div>
  );
}
