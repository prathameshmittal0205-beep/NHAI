import React from 'react';

interface HudCardProps {
  title: string;
  desc: string;
  icon: React.ElementType;
}

export default function HudCard({ title, desc, icon: Icon }: HudCardProps) {
  return (
    <div className="relative group overflow-hidden rounded-2xl bg-slate-900 p-[1px] shadow-xl">
      {/* Animated spinning gradient border on hover */}
      <div className="absolute inset-[-100%] z-0 animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#00000000_50%,#38bdf8_100%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* Card Content */}
      <div className="relative z-10 flex h-full flex-col bg-slate-950 p-6 rounded-2xl border border-slate-800 group-hover:border-transparent transition-colors">
        <div className="w-12 h-12 bg-blue-500/10 text-cyan-400 rounded-xl flex items-center justify-center mb-4 border border-blue-500/20 group-hover:text-cyan-300 transition-colors">
          <Icon className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-lg mb-2 text-white group-hover:text-cyan-300 transition-colors tracking-wide uppercase">{title}</h3>
        <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
