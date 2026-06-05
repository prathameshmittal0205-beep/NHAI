import React, { useEffect, useRef } from 'react';
import { Terminal, Trash2 } from 'lucide-react';

interface LogEntry {
  time: string;
  msg: string;
}

interface TerminalLogProps {
  logs: LogEntry[];
  onClear: () => void;
}

export default function TerminalLog({ logs, onClear }: TerminalLogProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="bg-black border border-slate-800 rounded-2xl shadow-2xl flex flex-col h-full min-h-[300px] overflow-hidden font-mono">
      {/* Terminal Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-slate-400 text-sm font-bold uppercase tracking-widest">
          <Terminal className="w-4 h-4 text-emerald-500" />
          Activity Log
        </div>
        <button 
          onClick={onClear}
          className="text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1 text-xs font-sans uppercase"
          title="Clear Log"
        >
          <Trash2 className="w-3 h-3" /> Clear
        </button>
      </div>

      {/* Terminal Body */}
      <div 
        ref={containerRef}
        className="flex-1 p-4 overflow-y-auto custom-scrollbar text-sm space-y-1.5"
      >
        {logs.length === 0 ? (
          <div className="text-slate-600 italic">Waiting for events...</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="flex gap-3">
              <span className="text-slate-500 shrink-0">{log.time}</span>
              <span className="text-emerald-500 shrink-0">›</span>
              <span className={log.msg.includes('Failed') || log.msg.includes('Error') || log.msg.includes('❌') ? "text-red-400" : log.msg.includes('✓') || log.msg.includes('Verified') || log.msg.includes('✅') ? "text-emerald-400 font-bold" : "text-emerald-500/80"}>
                {log.msg}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
