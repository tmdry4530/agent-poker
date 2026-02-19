import { cn } from "@/lib/utils";
import type { HandEvent } from "@/lib/types";

const eventColors: Record<string, string> = {
  deal: "bg-blue-500",
  bet: "bg-primary",
  fold: "bg-destructive",
  call: "bg-yellow-500",
  raise: "bg-orange-500",
  check: "bg-muted-foreground",
  showdown: "bg-purple-500",
  win: "bg-primary",
};

interface EventTimelineProps {
  events: HandEvent[];
}

export function EventTimeline({ events }: EventTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm">No events available</p>
        <p className="text-xs mt-1">Event data will appear here when the hand API is extended</p>
      </div>
    );
  }

  return (
    <div className="relative space-y-4 pl-6">
      <div className="absolute left-2.5 top-2 h-[calc(100%-1rem)] w-px bg-border" />
      {events.map((event, i) => (
        <div key={i} className="relative flex gap-3">
          <div
            className={cn(
              "absolute left-[-18px] top-1.5 h-2 w-2 rounded-full",
              eventColors[event.type] ?? "bg-muted-foreground",
            )}
          />
          <div className="flex-1">
            <p className="text-sm font-medium capitalize">{event.type}</p>
            <p className="text-xs text-muted-foreground font-mono">
              {new Date(event.timestamp).toLocaleTimeString()}
            </p>
            {Object.keys(event.data).length > 0 && (
              <pre className="mt-1 text-xs text-muted-foreground font-mono bg-muted/50 rounded p-2 overflow-x-auto">
                {JSON.stringify(event.data, null, 2)}
              </pre>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
