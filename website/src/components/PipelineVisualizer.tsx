import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { CheckCircle2, CircleDashed } from 'lucide-react';

const STAGES = [
  "Capture",
  "Detection",
  "Landmarks",
  "Liveness",
  "Embedding",
  "Match",
  "Result"
];

export default function PipelineVisualizer({ currentStage }: { currentStage: number }) {
  return (
    <div className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl p-4 md:p-6 overflow-x-auto custom-scrollbar shadow-lg">
      <div className="flex min-w-[600px] justify-between relative">
        {/* Background Line */}
        <div className="absolute left-5 right-5 top-[20px] -translate-y-1/2 h-1 bg-slate-800 z-0 rounded-full" />
        
        {/* Active Line Fill */}
        <motion.div 
          className="absolute left-5 top-[20px] -translate-y-1/2 h-1 bg-cyan-500 z-0 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, (currentStage / (STAGES.length - 1)) * 100)}%` }}
          transition={{ duration: 0.5 }}
        />

        {STAGES.map((stage, idx) => {
          const isCompleted = idx < currentStage;
          const isActive = idx === currentStage;
          const isPending = idx > currentStage;

          return (
            <div key={stage} className="relative z-10 flex flex-col items-center gap-2">
              <div 
                className={clsx(
                  "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 relative z-20",
                  isCompleted ? "bg-[#020617] border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)]" :
                  isActive ? "bg-[#020617] border-cyan-500 text-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.6)] animate-pulse" :
                  "bg-[#020617] border-slate-700 text-slate-600"
                )}
              >
                {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : isActive ? <CircleDashed className="w-5 h-5 animate-spin-slow" /> : <span className="text-xs font-bold">{idx + 1}</span>}
              </div>
              <span className={clsx(
                "text-[10px] sm:text-xs font-bold uppercase tracking-wider whitespace-nowrap",
                isCompleted ? "text-emerald-400" :
                isActive ? "text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]" :
                "text-slate-600"
              )}>
                {stage}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
