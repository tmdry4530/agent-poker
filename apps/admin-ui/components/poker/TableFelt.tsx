import { cn } from "@/lib/utils";

interface TableFeltProps {
  children: React.ReactNode;
  className?: string;
}

export function TableFelt({ children, className }: TableFeltProps) {
  return (
    <div className={cn("relative w-full max-w-[1300px] mx-auto", className)} style={{ paddingBottom: "50%" }}>
      {/* Outer rail (leather-like) */}
      <div 
        className="absolute inset-0 rounded-[120px]" 
        style={{
          background: "linear-gradient(180deg, #111 0%, #0a0a0a 100%)",
          boxShadow: "0 20px 50px -10px rgba(0,0,0,0.8), inset 0 2px 10px rgba(255,255,255,0.05)",
          border: "2px solid #222"
        }}
      />
      
      {/* Wooden trim inner layer */}
      <div 
        className="absolute inset-[10px] rounded-[110px]"
        style={{
          background: "linear-gradient(145deg, #1a1a1a 0%, #050505 100%)",
          boxShadow: "inset 0 0 15px rgba(0,0,0,0.9)",
          border: "1px solid #111"
        }}
      />

      {/* Inner felt */}
      <div
        className="absolute inset-[16px] rounded-[105px]"
        style={{
          background: "radial-gradient(ellipse at 50% 50%, #0c331a 0%, #062210 60%, #021207 100%)",
          boxShadow: "inset 0 0 80px rgba(0,0,0,0.9), inset 0 4px 30px rgba(0,0,0,0.6)",
        }}
      >
        {/* Felt texture overlay */}
        <div
          className="absolute inset-0 opacity-15 mix-blend-overlay rounded-[105px]"
          style={{
            backgroundImage: "url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMSIvPgo8cGF0aCBkPSJNMCAwTDggOFpNOCAwTDAgOFoiIHN0cm9rZT0iIzExMSIgc3Ryb2tlLXdpZHRoPSIwLjUiIG9wYWNpdHk9IjAuNyIvPjwvc3ZnPg==')",
            backgroundSize: "8px 8px"
          }}
        />
        
        {/* Table line */}
        <div 
          className="absolute inset-[40px] rounded-[70px] border border-white/10"
          style={{
            boxShadow: "0 0 10px rgba(255,255,255,0.02), inset 0 0 10px rgba(255,255,255,0.02)"
          }}
        />
        
        {/* Logo/Center piece placeholder */}
        <div className="absolute top-[18%] left-1/2 -translate-x-1/2 opacity-[0.03] pointer-events-none flex flex-col items-center select-none">
            <div className="text-4xl font-black tracking-[0.3em] uppercase">NEXUS</div>
            <div className="text-xs tracking-[0.5em] mt-1">HOLD'EM</div>
        </div>
      </div>
      
      {/* Content layer */}
      <div className="absolute inset-0 z-10">{children}</div>
    </div>
  );
}
