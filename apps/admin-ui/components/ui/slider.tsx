import * as React from "react";
import { cn } from "@/lib/utils";

interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value?: number[];
  min?: number;
  max?: number;
  step?: number;
  onValueChange?: (value: number[]) => void;
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value = [0], min = 0, max = 100, step = 1, onValueChange, ...props }, ref) => {
    return (
      <input
        type="range"
        ref={ref}
        value={value[0] ?? 0}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onValueChange?.([Number(e.target.value)])}
        className={cn(
          "w-full h-3 rounded-lg appearance-none cursor-pointer bg-black/50 border border-white/10 accent-emerald-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-emerald-400 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(16,185,129,0.5)]",
          className,
        )}
        {...props}
      />
    );
  },
);
Slider.displayName = "Slider";

export { Slider };
