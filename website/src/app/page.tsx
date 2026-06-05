"use client";

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Zap, Database, Server, Cpu, Lock, Smartphone, PlayCircle, Eye, ArrowRight, Activity, CheckCircle, Network, Wifi } from 'lucide-react';
import { motion, useInView, Variants, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import NeuralNetBackground from '@/components/NeuralNetBackground';
import Typewriter from '@/components/Typewriter';
import HudCard from '@/components/HudCard';

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

function Counter({ end, label, suffix = "" }: { end: number, label: string, suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });

  useEffect(() => {
    if (isInView) {
      let start = 0;
      const duration = 2000;
      const increment = end / (duration / 16);
      
      const timer = setInterval(() => {
        start += increment;
        if (start >= end) {
          setCount(end);
          clearInterval(timer);
        } else {
          setCount(Math.ceil(start));
        }
      }, 16);
      return () => clearInterval(timer);
    }
  }, [isInView, end]);

  return (
    <div ref={ref} className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 shadow-xl backdrop-blur-sm hover:border-blue-500/30 hover:bg-blue-900/10 transition-all duration-300">
      <div className="text-4xl md:text-5xl font-bold text-white mb-2 tracking-tight">
        {suffix === "%" ? `>` : suffix === "ms" ? `~` : suffix === "MB" || suffix === "GB" ? `<` : ""}{count}{suffix}
      </div>
      <div className="text-sm text-slate-400 font-medium uppercase tracking-wider">{label}</div>
    </div>
  );
}

const ARCH_STEPS = [
  { title: "Camera", icon: Eye, color: "text-slate-300", bg: "bg-slate-800/50", desc: "Captures high-res video stream locally on the device." },
  { title: "Liveness", icon: Activity, color: "text-amber-400", bg: "bg-amber-500/10", desc: "3-challenge active anti-spoofing: Blink, Smile, Head Turn using MediaPipe FaceMesh." },
  { title: "Embedding", icon: Cpu, color: "text-blue-400", bg: "bg-blue-500/10", desc: "Extracts a 128-dimensional mathematical representation of the face via MobileFaceNet." },
  { title: "Similarity", icon: Network, color: "text-indigo-400", bg: "bg-indigo-500/10", desc: "Calculates cosine distance against encrypted local SQLite embeddings." },
  { title: "Result", icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10", desc: "Logs the attendance result locally with timestamp and confidence score." },
  { title: "AWS Sync", icon: Server, color: "text-cyan-400", bg: "bg-cyan-500/10", desc: "Pushes AES-256 encrypted payload to AWS DynamoDB when internet is restored." },
];

export default function Home() {
  const [activeNode, setActiveNode] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-blue-500/30 overflow-hidden relative">
      
      {/* Background Particles/Gradients */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <NeuralNetBackground />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjIiIGZpbGw9IiMzMzQxNTUiIGZpbGwtb3BhY2l0eT0iMC40IiAvPjwvc3ZnPg==')] opacity-20" />
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-cyan-600/10 blur-[120px]" />
      </div>

      <main className="max-w-6xl mx-auto px-6 py-12 space-y-32 relative z-10">
        
        {/* Hero Section */}
        <section className="text-center pt-20 pb-12 space-y-8 flex flex-col items-center">
          <motion.div initial="hidden" animate="visible" variants={fadeInUp} className="relative w-full flex justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 text-blue-400 text-sm font-semibold border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.2)] hover:shadow-[0_0_30px_rgba(59,130,246,0.4)] transition-all cursor-default">
              <ShieldCheck className="w-4 h-4" /> Built for NHAI Datalake 3.0
            </div>
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1, duration: 0.5 }}
              className="absolute right-0 top-0 flex items-center gap-2 bg-green-500/10 border border-green-500/30 px-3 py-1.5 rounded-full text-green-400 text-xs font-bold uppercase tracking-wider"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              System Ready
            </motion.div>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
            className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight max-w-5xl leading-tight text-white"
          >
            <div className="mb-2">Advanced</div>
            <Typewriter />
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-lg md:text-xl text-slate-400 max-w-2xl leading-relaxed"
          >
            Offline-first facial recognition and attendance system built for NHAI field operations. Sub-second inference. Zero connectivity required.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.5, delay: 0.5 }}
            className="flex flex-wrap justify-center gap-4 pt-4"
          >
            <Link href="/demo" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_30px_rgba(37,99,235,0.4)] px-8 py-4 rounded-xl font-bold transition-all hover:scale-105 active:scale-95 border border-blue-400/30">
              <PlayCircle className="w-5 h-5" />
              Try Live Preview
            </Link>
            <Link href="/dashboard" className="inline-flex items-center gap-2 bg-slate-800/80 backdrop-blur text-white px-8 py-4 rounded-xl font-bold border border-slate-700 hover:bg-slate-700 transition-all hover:scale-105 active:scale-95 shadow-xl">
              <Database className="w-5 h-5" />
              View Dashboard
            </Link>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.7 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-20 max-w-5xl mx-auto w-full"
          >
            <Counter end={95} label="Accuracy" suffix="%" />
            <Counter end={150} label="Inference" suffix="ms" />
            <Counter end={20} label="Model Size" suffix="MB" />
            <Counter end={3} label="RAM Usage" suffix="GB" />
          </motion.div>
        </section>

        {/* Live System Stats Ticker */}
        <section className="relative w-full overflow-hidden border-y border-slate-800/50 bg-slate-900/30 py-3 mt-8">
          <div className="flex whitespace-nowrap animate-[scroll_20s_linear_infinite] group hover:[animation-play-state:paused]">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex items-center gap-8 px-4 text-sm font-medium text-slate-400">
                <span className="flex items-center gap-2"><Cpu className="w-4 h-4 text-blue-400"/> Model Size: &lt;20MB</span>
                <span className="text-slate-700">•</span>
                <span className="flex items-center gap-2"><Zap className="w-4 h-4 text-amber-400"/> Inference: ~150ms</span>
                <span className="text-slate-700">•</span>
                <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-400"/> Accuracy: &gt;95%</span>
                <span className="text-slate-700">•</span>
                <span className="flex items-center gap-2"><Server className="w-4 h-4 text-purple-400"/> RAM: &lt;3GB</span>
                <span className="text-slate-700">•</span>
                <span className="flex items-center gap-2"><Database className="w-4 h-4 text-cyan-400"/> Embeddings: 128-dim</span>
                <span className="text-slate-700">•</span>
                <span className="flex items-center gap-2"><Wifi className="w-4 h-4 text-red-400"/> Offline: 100%</span>
                <span className="text-slate-700 mr-4">•</span>
              </div>
            ))}
          </div>
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes scroll {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
          `}} />
        </section>

        {/* Architecture Flow Diagram */}
        <section className="space-y-16">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} variants={fadeInUp} className="text-center">
            <h2 className="text-4xl font-bold mb-6 text-white tracking-tight">Architecture Flow</h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-lg">From lens to cloud, an uninterrupted and highly secure data pipeline.</p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} variants={staggerContainer} className="relative max-w-5xl mx-auto">
            <div className="hidden lg:block absolute top-1/2 left-0 w-full h-1 bg-gradient-to-r from-blue-900/50 via-cyan-500/50 to-emerald-900/50 -translate-y-1/2 z-0 rounded-full" />
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 relative z-10">
              {ARCH_STEPS.map((step, i) => (
                <motion.div key={i} variants={fadeInUp} className="flex flex-col items-center relative">
                  <button 
                    onClick={() => setActiveNode(activeNode === i ? null : i)}
                    onBlur={() => setActiveNode(null)}
                    className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center ${step.bg} border ${activeNode === i ? 'border-blue-400' : 'border-slate-700/50'} backdrop-blur-xl shadow-xl mb-4 relative group hover:border-slate-500 transition-colors cursor-pointer`}
                  >
                    <step.icon className={`w-8 h-8 sm:w-10 sm:h-10 ${step.color} group-hover:scale-110 transition-transform`} />
                    {i !== 5 && (
                      <ArrowRight className="absolute -right-5 sm:-right-7 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-6 sm:h-6 text-slate-600 hidden lg:block pointer-events-none" />
                    )}
                  </button>
                  <h3 className="font-bold text-slate-200 text-center text-sm sm:text-base">{step.title}</h3>
                  
                  <AnimatePresence>
                    {activeNode === i && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute top-24 left-1/2 -translate-x-1/2 w-48 bg-slate-800 border border-slate-700 p-3 rounded-xl shadow-2xl z-50 text-xs text-slate-300 text-center pointer-events-none"
                      >
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-800 border-t border-l border-slate-700 rotate-45" />
                        <span className="relative z-10">{step.desc}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* Features */}
        <section className="space-y-16">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} variants={fadeInUp} className="text-center">
            <h2 className="text-4xl font-bold mb-6 text-white tracking-tight">Core Features</h2>
          </motion.div>
          
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} variants={staggerContainer} className="grid md:grid-cols-3 gap-8">
            {[
              { title: "Face Recognition", desc: "Military-grade identity verification matching against edge databases instantly.", icon: Eye },
              { title: "Anti-Spoofing", desc: "Defends against hi-res photos, 3D masks, and video playback attacks.", icon: ShieldCheck },
              { title: "Liveness Detection", desc: "Active challenges including blinking, smiling, and head movements.", icon: Activity },
              { title: "Offline Processing", desc: "No internet required. 100% of the ML pipeline executes locally on-device.", icon: Zap },
              { title: "Encrypted Sync", desc: "AES-256 payload encryption pushes data to AWS automatically when online.", icon: Lock },
              { title: "Edge Deployment", desc: "Optimized TFLite INT8 models ensuring smooth performance on standard field phones.", icon: Smartphone },
            ].map((feat, i) => (
              <motion.div key={i} variants={fadeInUp}>
                <HudCard title={feat.title} desc={feat.desc} icon={feat.icon} />
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Tech Stack */}
        <section className="space-y-16">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="text-center">
            <h2 className="text-4xl font-bold mb-6 text-white tracking-tight">Technology Stack</h2>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer} className="flex flex-wrap justify-center gap-4 max-w-4xl mx-auto">
            {[
              "MobileFaceNet", "TFLite INT8", "MediaPipe", "React Native", "AES-256", "AWS Lambda", "DynamoDB", "Next.js", "Framer Motion", "Tailwind CSS", "SQLite"
            ].map((tech, i) => (
              <motion.div key={i} variants={fadeInUp} className="px-6 py-3 rounded-full bg-slate-900/80 border border-slate-700/80 font-bold text-slate-300 hover:border-cyan-400/60 hover:text-cyan-300 hover:bg-cyan-900/20 hover:shadow-[0_0_15px_rgba(34,211,238,0.3)] transition-all duration-300 cursor-default shadow-lg">
                {tech}
              </motion.div>
            ))}
          </motion.div>
        </section>

      </main>
    </div>
  );
}
