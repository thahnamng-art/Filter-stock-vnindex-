import React, { useRef, useCallback } from 'react';

export interface RangePreset {
  label: string;
  value: [number, number];
}

interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  unit?: string;
  formatValue?: (val: number) => string;
  onChange: (val: [number, number]) => void;
  presets?: RangePreset[];
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
  presets,
  disabled = false
}) => {
  const [minVal, maxVal] = value;
  const trackRef = useRef<HTMLDivElement>(null);

  const getPercent = useCallback(
    (val: number) => {
      if (max <= min) return 0;
      return Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
    },
    [min, max]
  );

  const minPercent = getPercent(minVal);
  const maxPercent = getPercent(maxVal);

  const snapToStep = (raw: number) => {
    const stepped = Math.round((raw - min) / step) * step + min;
    const decimals = (step.toString().split('.')[1] || '').length;
    return Number(Math.max(min, Math.min(max, stepped)).toFixed(decimals));
  };

  // Allow clicking directly on the track to jump the nearest thumb
  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const clickedVal = snapToStep(min + ratio * (max - min));

    const distToMin = Math.abs(clickedVal - minVal);
    const distToMax = Math.abs(clickedVal - maxVal);

    if (distToMin <= distToMax) {
      onChange([Math.min(clickedVal, maxVal), maxVal]);
    } else {
      onChange([minVal, Math.max(clickedVal, minVal)]);
    }
  };

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.min(Number(e.target.value), maxVal);
    onChange([val, maxVal]);
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.max(Number(e.target.value), minVal);
    onChange([minVal, val]);
  };

  const displayMin = formatValue ? formatValue(minVal) : `${minVal}${unit ? ` ${unit}` : ''}`;
  const displayMax = formatValue ? formatValue(maxVal) : `${maxVal}${unit ? ` ${unit}` : ''}`;

  // Prevent thumb overlap lock when minVal is near the upper end
  const minThumbZIndex = minVal > min + (max - min) * 0.75 ? 'z-30' : 'z-20';
  const maxThumbZIndex = minVal > min + (max - min) * 0.75 ? 'z-20' : 'z-30';

  return (
    <div className={`w-full py-1.5 select-none ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      {/* Values Display Header */}
      <div className="flex justify-between items-center text-xs tabular-nums text-purple-300 font-semibold mb-2">
        <span className="bg-[#1b1530] px-2.5 py-1 rounded-lg border border-purple-800/50 text-purple-200">
          Min: {displayMin}
        </span>
        <span className="text-[11px] text-slate-400 font-sans">đến</span>
        <span className="bg-[#1b1530] px-2.5 py-1 rounded-lg border border-purple-800/50 text-purple-200">
          Max: {displayMax}
        </span>
      </div>

      {/* Draggable Slider Track Container */}
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        className="relative h-8 flex items-center cursor-pointer"
      >
        {/* Background Track */}
        <div className="absolute w-full h-2 bg-[#1c2434] rounded-full border border-[#28334a]" />

        {/* Active Range Highlight */}
        <div
          className="absolute h-2 bg-gradient-to-r from-purple-600 to-violet-400 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.45)] pointer-events-none"
          style={{
            left: `${minPercent}%`,
            width: `${Math.max(0, maxPercent - minPercent)}%`
          }}
        />

        {/* Input Thumb 1 (Min) */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={minVal}
          onChange={handleMinChange}
          className={`absolute w-full h-2 appearance-none bg-transparent pointer-events-none cursor-grab active:cursor-grabbing ${minThumbZIndex}
            [&::-webkit-slider-thumb]:pointer-events-auto
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-5
            [&::-webkit-slider-thumb]:h-5
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-purple-600
            [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(147,51,234,0.8)]
            [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:hover:scale-110
            [&::-webkit-slider-thumb]:active:scale-125
            [&::-moz-range-thumb]:pointer-events-auto
            [&::-moz-range-thumb]:w-5
            [&::-moz-range-thumb]:h-5
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-white
            [&::-moz-range-thumb]:border-2
            [&::-moz-range-thumb]:border-purple-600`}
        />

        {/* Input Thumb 2 (Max) */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={maxVal}
          onChange={handleMaxChange}
          className={`absolute w-full h-2 appearance-none bg-transparent pointer-events-none cursor-grab active:cursor-grabbing ${maxThumbZIndex}
            [&::-webkit-slider-thumb]:pointer-events-auto
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-5
            [&::-webkit-slider-thumb]:h-5
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-purple-600
            [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(147,51,234,0.8)]
            [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:hover:scale-110
            [&::-webkit-slider-thumb]:active:scale-125
            [&::-moz-range-thumb]:pointer-events-auto
            [&::-moz-range-thumb]:w-5
            [&::-moz-range-thumb]:h-5
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-white
            [&::-moz-range-thumb]:border-2
            [&::-moz-range-thumb]:border-purple-600`}
        />
      </div>

      {/* Axis Min/Max labels */}
      <div className="flex justify-between items-center text-[10px] text-slate-400 tabular-nums mt-0.5">
        <span>{formatValue ? formatValue(min) : `${min}${unit ? ` ${unit}` : ''}`}</span>
        <span>{formatValue ? formatValue(max) : `${max}${unit ? ` ${unit}` : ''}`}</span>
      </div>

      {/* Quick-Select Preset Milestones */}
      {presets && presets.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-[#1e2738]">
          <span className="text-[11px] text-slate-400 block mb-1.5">Mốc chọn nhanh:</span>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => {
              const isSelected =
                Math.abs(minVal - p.value[0]) < 0.01 && Math.abs(maxVal - p.value[1]) < 0.01;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => onChange(p.value)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold tabular-nums transition-colors ${
                    isSelected
                      ? 'bg-purple-600 text-white border border-purple-400 shadow-sm'
                      : 'bg-[#182030] text-slate-300 hover:text-white hover:bg-[#202b40] border border-[#263349]'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export interface SinglePreset {
  label: string;
  value: number;
}

interface SingleSliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  unit?: string;
  label?: string;
  formatValue?: (val: number) => string;
  onChange: (val: number) => void;
  presets?: SinglePreset[];
  disabled?: boolean;
}

export const SingleSlider: React.FC<SingleSliderProps> = ({
  min,
  max,
  step = 1,
  value,
  unit = '',
  label = 'Giá trị đang chọn',
  formatValue,
  onChange,
  presets,
  disabled = false
}) => {
  const percent = max > min ? Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100)) : 0;
  const displayVal = formatValue ? formatValue(value) : `${value}${unit}`;

  return (
    <div className={`w-full py-1.5 select-none ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      {/* Current Value Header */}
      <div className="flex justify-between items-center text-xs mb-2">
        <span className="text-slate-400 text-[11px]">{label}</span>
        <span className="bg-[#1b1530] px-2.5 py-1 rounded-lg border border-purple-800/50 text-purple-200 font-bold tabular-nums">
          {displayVal}
        </span>
      </div>

      {/* Draggable Single Track */}
      <div className="relative h-8 flex items-center">
        <div className="absolute w-full h-2 bg-[#1c2434] rounded-full border border-[#28334a]" />
        <div
          className="absolute h-2 bg-gradient-to-r from-purple-600 to-violet-400 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.45)] pointer-events-none"
          style={{ width: `${percent}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="relative w-full h-2 appearance-none bg-transparent cursor-grab active:cursor-grabbing z-20
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-5
            [&::-webkit-slider-thumb]:h-5
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-purple-600
            [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(147,51,234,0.8)]
            [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:hover:scale-110
            [&::-webkit-slider-thumb]:active:scale-125
            [&::-moz-range-thumb]:w-5
            [&::-moz-range-thumb]:h-5
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-white
            [&::-moz-range-thumb]:border-2
            [&::-moz-range-thumb]:border-purple-600"
        />
      </div>

      {/* Axis labels */}
      <div className="flex justify-between items-center text-[10px] text-slate-400 tabular-nums mt-0.5">
        <span>{formatValue ? formatValue(min) : `${min}${unit}`}</span>
        <span>{formatValue ? formatValue(max) : `${max}${unit}`}</span>
      </div>

      {/* Quick-Select Preset Milestones (e.g., 0%, 25%, 50%, 75%, 100%) */}
      {presets && presets.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-[#1e2738]">
          <span className="text-[11px] text-slate-400 block mb-1.5">Mốc chọn nhanh:</span>
          <div className="grid grid-cols-5 gap-1.5">
            {presets.map((p) => {
              const isSelected = Math.abs(value - p.value) < 0.01;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => onChange(p.value)}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold tabular-nums text-center transition-colors ${
                    isSelected
                      ? 'bg-purple-600 text-white border border-purple-400 shadow-sm'
                      : 'bg-[#182030] text-slate-300 hover:text-white hover:bg-[#202b40] border border-[#263349]'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
