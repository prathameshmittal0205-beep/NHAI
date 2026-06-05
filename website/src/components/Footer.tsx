import React from 'react';
import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-slate-800/50 py-12 text-center text-slate-500 text-sm relative z-10 bg-slate-950 mt-auto">
      <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-slate-600 w-5 h-5" />
          <span className="font-bold text-slate-400 tracking-tight">NHAI Datalake 3.0</span>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
          <p>Built for NHAI Hackathon 2025</p>
          <div className="hidden md:block w-px h-4 bg-slate-800" />
          <p>Team: Prathamesh, Vidhi, Sharu, AG</p>
          <div className="hidden md:block w-px h-4 bg-slate-800" />
          <a href="https://github.com/prathameshmittal0205-beep/NHAI" target="_blank" rel="noreferrer" className="hover:text-blue-400 transition-colors">
            GitHub Repository
          </a>
        </div>
      </div>
    </footer>
  );
}
