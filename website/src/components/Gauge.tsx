import React from 'react';

interface GaugeProps {
  value: number; // 0 to 100
  label: string;
  color?: string;
  suffix?: string;
}

export default function Gauge({ value, label, color = "#38bdf8", suffix = "%" }: GaugeProps) {
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-slate-900/50 rounded-xl border border-slate-800">
      <div className="relative w-24 h-24 flex items-center justify-center">
        {/* Background Circle */}
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="48"
            cy="48"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            className="text-slate-800"
          />
          {/* Foreground Circle */}
          <circle
            cx="48"
            cy="48"
            r={radius}
            stroke={color}
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-300 ease-out drop-shadow-[0_0_8px_currentColor]"
            style={{ color }}
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-white tracking-tighter shadow-black drop-shadow-md">
            {Math.round(value)}<span className="text-xs text-slate-400 font-normal">{suffix}</span>
          </span>
        </div>
      </div>
      <span className="mt-3 text-xs font-semibold text-slate-400 tracking-wider uppercase text-center">{label}</span>
    </div>
  );
}
