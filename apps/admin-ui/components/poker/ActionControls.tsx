import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";

interface ActionControlsProps {
  potAmount: number;
  minBet: number;
  playerChips: number;
  onAction: (action: "fold" | "check" | "call" | "bet" | "raise", amount?: number) => void;
  canCheck: boolean;
  callAmount: number;
}

export function ActionControls({
  potAmount,
  minBet,
  playerChips,
  onAction,
  canCheck,
  callAmount,
}: ActionControlsProps) {
  const [betSize, setBetSize] = useState<number>(minBet);

  // Common bet sizing shortcuts
  const betShortcuts = [
    { label: "1/2 Pot", value: Math.max(minBet, Math.min(playerChips, Math.floor(potAmount / 2))) },
    { label: "3/4 Pot", value: Math.max(minBet, Math.min(playerChips, Math.floor(potAmount * 0.75))) },
    { label: "Pot", value: Math.max(minBet, Math.min(playerChips, potAmount)) },
    { label: "All-In", value: playerChips },
  ];

  const handleShortcut = (val: number) => {
    setBetSize(val);
  };

  const handleAction = (action: "fold" | "check" | "call" | "bet" | "raise") => {
    if (action === "bet" || action === "raise") {
      onAction(action, betSize);
    } else {
      onAction(action);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value.replace(/,/g, ''));
    if (!isNaN(val)) {
      setBetSize(val);
    } else if (e.target.value === '') {
      setBetSize(minBet);
    }
  };

  const handleInputBlur = () => {
    setBetSize(Math.min(playerChips, Math.max(minBet, betSize)));
  };

  return (
    <div className="w-full z-50 relative group">
      <div className="bg-black/80 border border-white/10 backdrop-blur-xl rounded-2xl p-4 shadow-2xl flex flex-col gap-5 overflow-visible">
        
        {/* Top Row: Slider & Shortcuts */}
        <div className="w-full flex gap-4 items-center">
          {/* Slider Core Info */}
          <div className="flex flex-col gap-1 w-[130px] shrink-0">
            <div className="flex justify-between items-center w-full">
              <span className="text-zinc-400 font-mono text-xs font-bold">Min: ${minBet}</span>
              <span className="text-zinc-400 font-mono text-xs font-bold pr-1">Max: ${playerChips}</span>
            </div>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-emerald-400 font-mono font-bold z-10">$</span>
              <Input 
                type="text"
                value={betSize === 0 ? '' : betSize}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                className="pl-7 pr-3 h-12 w-full bg-black border-emerald-900/50 text-emerald-400 font-mono font-black text-xl focus-visible:ring-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)] rounded-xl"
              />
            </div>
          </div>
          
          {/* Slider & Presets Column */}
          <div className="flex-1 flex flex-col gap-3 pt-2">
            <div className="relative group/slider w-full cursor-pointer mt-1">
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover/slider:opacity-100 transition-opacity whitespace-nowrap bg-emerald-900 text-emerald-100 text-sm font-bold px-3 py-1 rounded-md pointer-events-none font-mono z-50 shadow-lg">
                ${betSize.toLocaleString()}
              </div>
              <Slider
                value={[betSize]}
                min={minBet}
                max={playerChips}
                step={1}
                onValueChange={(vals) => setBetSize(vals[0])}
                className="w-full h-4"
              />
            </div>
            {/* Presets */}
            <div className="flex justify-between gap-2 mt-2">
              {betShortcuts.map((sc, i) => (
                <Button
                  key={i}
                  variant="outline"
                  className="flex-1 h-7 rounded-full text-[10px] font-bold text-zinc-400 bg-black/50 border-zinc-700/50 hover:bg-emerald-900/40 hover:text-emerald-300 hover:border-emerald-700/50 transition-colors"
                  onClick={() => handleShortcut(sc.value)}
                  aria-label={`Bet shortcut: ${sc.label}`}
                >
                  {sc.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Row: Actions */}
        <div className="flex gap-4 w-full border-t border-white/10 pt-4">
          <Button
            variant="destructive"
            className="flex-1 h-16 text-xl font-black uppercase tracking-wider rounded-xl bg-red-900/80 hover:bg-red-800 border-2 border-red-900 shadow-[0_0_15px_rgba(220,38,38,0.2)]"
            onClick={() => handleAction("fold")}
          >
            Fold
          </Button>
          
          <Button
            variant="secondary"
            className="flex-1 h-16 text-xl font-black uppercase tracking-wider rounded-xl bg-blue-600 hover:bg-blue-500 border-2 border-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-transform hover:scale-[1.02]"
            onClick={() => handleAction(canCheck ? "check" : "call")}
            aria-label={canCheck ? "Check" : `Call $${callAmount}`}
          >
            {canCheck ? "Check" : `Call $${callAmount}`}
          </Button>

          <Button
            className="flex-[1.5] h-16 text-xl font-black uppercase tracking-wider rounded-xl bg-emerald-600 hover:bg-emerald-500 border-2 border-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-transform hover:scale-[1.02]"
            onClick={() => handleAction(callAmount > 0 ? "raise" : "bet")}
          >
            {callAmount > 0 ? `Raise To $${betSize.toLocaleString()}` : `Bet $${betSize.toLocaleString()}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
