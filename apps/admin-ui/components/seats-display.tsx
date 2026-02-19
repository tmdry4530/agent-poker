import { Card, CardContent } from "@/components/ui/card";
import { cn, formatChips } from "@/lib/utils";
import type { SeatInfo } from "@/lib/types";
import { User, CircleDot } from "lucide-react";

interface SeatsDisplayProps {
  seats: SeatInfo[];
}

export function SeatsDisplay({ seats }: SeatsDisplayProps) {
  const allSeats: SeatInfo[] = seats.length > 0 ? seats : [];
  const gridCols = allSeats.length <= 2 ? "grid-cols-2" : allSeats.length <= 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-4";

  return (
    <div className={cn("grid gap-4", gridCols)}>
      {allSeats.map((seat) => {
        const isEmpty = !seat.agentId || seat.status === "left";
        return (
          <Card
            key={seat.seatIndex}
            className={cn(
              "transition-colors",
              seat.status === "seated" && "border-primary/50",
              isEmpty && "opacity-60",
            )}
          >
            <CardContent className="flex items-center gap-3 p-4">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full",
                  seat.agentId ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                {seat.agentId ? <User className="h-5 w-5" /> : <CircleDot className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {seat.agentId ? (
                    <span className="font-mono text-xs">{seat.agentId}</span>
                  ) : (
                    <span className="text-muted-foreground">Empty Seat</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  Seat {seat.seatIndex + 1}
                  {seat.agentId && (
                    <span className="ml-2 font-mono">{formatChips(seat.chips)} chips</span>
                  )}
                </p>
              </div>
              {seat.status === "seated" && seat.agentId && (
                <span className="h-2 w-2 rounded-full bg-primary" />
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
