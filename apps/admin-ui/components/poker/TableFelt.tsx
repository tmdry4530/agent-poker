import { cn } from "@/lib/utils";

interface TableFeltProps {
  children: React.ReactNode;
  className?: string;
}

export function TableFelt({ children, className }: TableFeltProps) {
  return (
    <div className={cn("relative w-full", className)} style={{ paddingBottom: "56%" }}>
      {/* Outer rim */}
      <div className="absolute inset-0 rounded-[50%] bg-gradient-to-b from-amber-950 via-amber-900 to-amber-950 shadow-2xl" />
      {/* Inner felt */}
      <div
        className="absolute inset-3 rounded-[50%]"
        style={{
          background: "radial-gradient(ellipse at 50% 40%, #1a5c32 0%, #145228 40%, #0d3d1e 70%, #082a14 100%)",
          boxShadow: "inset 0 0 60px rgba(0,0,0,0.4), inset 0 4px 20px rgba(0,0,0,0.3)",
        }}
      />
      {/* Felt texture overlay */}
      <div
        className="absolute inset-3 rounded-[50%] opacity-10"
        style={{
          backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)",
        }}
      />
      {/* Content layer */}
      <div className="absolute inset-0">{children}</div>
    </div>
  );
}
