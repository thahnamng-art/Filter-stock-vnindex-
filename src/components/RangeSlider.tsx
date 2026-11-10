import React, { useRef, useCallback } from 'react';

interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  unit?: string;
  formatValue?: (val: number) => string;
  onChange: (val: [number, number]) => void;
  disabled?: boolean;
}

export const RangeSlider: React.FC<RangeSliderProps> = ({
  min,
  max,
  step = 1,
  value,
  unit = '',
  formatValue,
  onChange,
  disabled = false
}) => {
  const [minVal, maxVal] = value;
  const trackRef = useRef<HTMLDivElement>(null);

  const getPercent = useCallback(
    (val: number) => Math.round(((val - min) / (max - min)) * 100),
    [min, max]
  );

  const minPercent = Math.max(0, Math.min(100, getPercent(minVal)));
  const maxPercent = Math.max(0, Math.min(100, getPercent(maxVal)));

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.min(Number(e.target.value), maxVal - step);
    onChange([val, maxVal]);
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.max(Number(e.target.value), minVal + step);
    onChange([minVal, val]);
  };

  const displayMin = formatValue ? formatValue(minVal) : `${minVal} ${unit}`.trim();
  const displayMax = formatValue ? formatValue(maxVal) : `${maxVal} ${unit}`.trim();

  return (
    <div className={`w-full py-2 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      {/* Values Display Header */}
      <div className="flex justify-between items-center text-xs font-mono-numbers text-purple-300 font-semibold mb-2">
        <span className="bg-[#1e1735] px-2 py-0.5 rounded border border-purple-900/50 text-purple-200">
          {displayMin}
        </span>
        <span className="text-[10px] text-slate-500 font-sans">đến</span>
        <span className="bg-[#1e1735] px-2 py-0.5 rounded border border-purple-900/50 text-purple-200">
          {displayMax}
        </span>
      </div>

      {/* Slider Track Container */}
      <div className="relative h-6 flex items-center" ref={trackRef}>
        {/* Background Track */}
        <div className="absolute w-full h-1.5 bg-[#1b2230] rounded-full" />

        {/* Active Range Highlight (Purple) */}
        <div
          className="absolute h-1.5 bg-gradient-to-r from-purple-600 to-violet-500 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.4)]"
          style={{
            left: `${minPercent}%`,
            width: `${Math.max(0, maxPercent - minPercent)}%`
          }}
        />

        {/* Input Thumb 1 */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={minVal}
          onChange={handleMinChange}
          className="absolute w-full h-1.5 appearance-none bg-transparent pointer-events-none z-20 cursor-pointer
            [&::-webkit-slider-thumb]:pointer-events-auto
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-purple-600
            [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(147,51,234,0.6)]
            [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:hover:scale-110
            [&::-webkit-slider-thumb]:active:scale-125"
        />

        {/* Input Thumb 2 */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={maxVal}
          onChange={handleMaxChange}
          className="absolute w-full h-1.5 appearance-none bg-transparent pointer-events-none z-20 cursor-pointer
            [&::-webkit-slider-thumb]:pointer-events-auto
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-purple-600
            [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(147,51,234,0.6)]
            [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:hover:scale-110
            [&::-webkit-slider-thumb]:active:scale-125"
        />
      </div>

      {/* Axis Min/Max labels */}
      <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono-numbers mt-0.5">
        <span>{formatValue ? formatValue(min) : `${min} ${unit}`}</span>
        <span>{formatValue ? formatValue(max) : `${max} ${unit}`}</span>
      </div>
    </div>
  );
};
