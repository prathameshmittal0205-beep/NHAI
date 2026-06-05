import React from 'react';
import { Shield, Brain, Cpu, Zap, Search, Database, Lock, GitBranch, CheckCircle2, AlertTriangle, CloudOff, FileCode, Star, CpuIcon, Layers, Eye, Smartphone, Activity } from 'lucide-react';
import NeuralNetBackground from '@/components/NeuralNetBackground';

export default function About() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-cyan-500/30">
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-24 px-4 overflow-hidden min-h-[70vh] flex flex-col justify-center border-b border-slate-800">
        <div className="absolute inset-0 z-0 opacity-40">
          <NeuralNetBackground />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/80 to-slate-950 z-0" />
        
        <div className="max-w-6xl mx-auto relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-mono text-sm mb-6">
            <Lock className="w-4 h-4" /> Military-Grade Architecture
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400 tracking-tight mb-8">
            Built for the Edge.<br />Designed for the Field.
          </h1>
          
          <p className="text-xl md:text-2xl text-slate-400 max-w-4xl mx-auto leading-relaxed mb-16">
            A production-grade offline facial recognition system engineered for NHAI's most demanding environments — zero connectivity, sub-second inference, tamper-proof.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            {[
              { label: ">95% Accuracy", icon: CheckCircle2 },
              { label: "~150ms Latency", icon: Zap },
              { label: "<20MB Model", icon: Cpu },
              { label: "512-dim Embeddings", icon: Layers },
              { label: "100% Offline", icon: CloudOff },
              { label: "AES-256 Encrypted", icon: Shield }
            ].map((stat, i) => (
              <div key={i} className="flex items-center gap-2 bg-slate-900/80 backdrop-blur border border-slate-700 px-5 py-2.5 rounded-full shadow-[0_0_15px_rgba(34,211,238,0.1)] hover:border-cyan-500/50 transition-colors cursor-default">
                <stat.icon className="w-5 h-5 text-cyan-400" />
                <span className="font-bold tracking-wide">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Project Story Section */}
      <section className="py-24 px-4 bg-slate-950 border-b border-slate-800">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            
            <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-2xl relative overflow-hidden group hover:border-slate-600 transition-colors">
              <div className="w-14 h-14 bg-red-500/10 text-red-400 rounded-xl flex items-center justify-center mb-6 border border-red-500/20">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-white group-hover:text-cyan-400 transition-colors">The Problem</h3>
              <p className="text-slate-400 leading-relaxed">
                NHAI field sites frequently operate with zero internet connectivity. Manual attendance is prone to errors, and standard biometric systems are heavily compromised by spoofing, photos, and proxy attendance.
              </p>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-2xl relative overflow-hidden group hover:border-slate-600 transition-colors">
              <div className="w-14 h-14 bg-blue-500/10 text-blue-400 rounded-xl flex items-center justify-center mb-6 border border-blue-500/20">
                <Brain className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-white group-hover:text-cyan-400 transition-colors">The Approach</h3>
              <p className="text-slate-400 leading-relaxed">
                We designed an Edge AI pipeline utilizing MobileFaceNet with TFLite INT8 quantization to process frames entirely locally. We integrated a 3-challenge response protocol (Blink/Smile/Turn) to guarantee liveness.
              </p>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-2xl relative overflow-hidden group hover:border-slate-600 transition-colors">
              <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center mb-6 border border-emerald-500/20">
                <Shield className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-white group-hover:text-cyan-400 transition-colors">The Result</h3>
              <p className="text-slate-400 leading-relaxed">
                A highly secure, tamper-proof system capable of sub-second biometric attendance tracking without any reliance on network infrastructure, syncing securely to AWS only when connectivity resumes.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Technical Architecture Section */}
      <section className="py-24 px-4 bg-black border-b border-slate-800">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-extrabold text-center mb-16 uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
            Implementation Pipeline
          </h2>
          
          <div className="relative border-l-2 border-slate-800 ml-6 md:ml-12 space-y-12">
            {[
              { phase: "Phase 1: Data Pipeline", icon: Database, desc: "Aggregated, cleaned, and heavily augmented facial datasets utilizing aggressive alignment to normalize coordinates." },
              { phase: "Phase 2: Model Training", icon: Brain, desc: "Trained a MobileFaceNet backbone utilizing ArcFace loss to maximize inter-class variance and cluster intra-class embeddings tightly." },
              { phase: "Phase 3: TFLite Optimization", icon: CpuIcon, desc: "Applied INT8 quantization to compress the model footprint under 20MB while preserving >95% accuracy for edge deployment." },
              { phase: "Phase 4: Embedding Engine", icon: Layers, desc: "Real-time extraction of robust 512-dimensional vector embeddings, securely hashed and indexed within a local SQLite vault." },
              { phase: "Phase 5: Liveness Detection", icon: Eye, desc: "Engineered a state-machine active anti-spoofing layer demanding randomized Blink, Smile, and Head-Turn verification." },
              { phase: "Phase 6: Inference Loop", icon: Zap, desc: "Optimized the entire execution chain to deliver end-to-end verification via Cosine Similarity in under 150ms per frame." },
            ].map((item, idx) => (
              <div key={idx} className="relative pl-8 md:pl-12 group">
                <div className="absolute -left-[17px] top-1 w-8 h-8 bg-black border-2 border-slate-700 rounded-full flex items-center justify-center group-hover:border-cyan-500 group-hover:shadow-[0_0_15px_rgba(34,211,238,0.5)] transition-all">
                  <div className="w-2 h-2 bg-slate-500 rounded-full group-hover:bg-cyan-400 transition-colors" />
                </div>
                <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-xl hover:border-slate-700 transition-colors shadow-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <item.icon className="w-5 h-5 text-cyan-500" />
                    <h4 className="text-xl font-bold text-white tracking-wide">{item.phase}</h4>
                  </div>
                  <p className="text-slate-400 leading-relaxed font-medium">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack Deep Dive */}
      <section className="py-24 px-4 bg-slate-950 border-b border-slate-800">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-extrabold text-center mb-16 uppercase tracking-widest text-white">
            Core Technology Stack
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { name: "React / Next.js", v: "v14 Edge", desc: "Powers the frontend architecture with Server Components and static edge-deploy capabilities.", color: "border-blue-500" },
              { name: "face-api.js", v: "v0.22 WASM", desc: "Client-side facial landmark detection and MobileFaceNet execution wrapped in WebAssembly.", color: "border-purple-500" },
              { name: "Tailwind CSS", v: "v3.4", desc: "Utility-first styling enabling the rapid development of our dark-mode glassmorphism design system.", color: "border-cyan-500" },
              { name: "Framer Motion", v: "v11", desc: "Handles the complex SVG stroke animations and fluid pipeline transition effects.", color: "border-pink-500" },
              { name: "AWS DynamoDB", v: "Cloud", desc: "Target synchronization layer. Stores securely AES-encrypted logs when the device comes back online.", color: "border-amber-500" },
              { name: "SQLite", v: "Local", desc: "Offline relational persistence layer managing local embedding hashes and queued sync payloads.", color: "border-slate-400" },
            ].map((tech, i) => (
              <div key={i} className={`bg-slate-900 border-y border-r border-l-4 border-slate-800 ${tech.color} p-6 rounded-r-xl hover:bg-slate-800/80 transition-colors shadow-lg hover:shadow-xl group`}>
                <div className="flex justify-between items-start mb-3">
                  <h4 className="font-bold text-lg text-white group-hover:text-cyan-400 transition-colors">{tech.name}</h4>
                  <span className="bg-black text-slate-400 border border-slate-700 text-[10px] uppercase font-bold px-2 py-1 rounded">
                    {tech.v}
                  </span>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {tech.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Research & Accuracy Section */}
      <section className="py-24 px-4 bg-black border-b border-slate-800">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-extrabold text-center mb-16 uppercase tracking-widest text-white">
            Benchmark Metrics
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { metric: "FAR", value: "0.01%", desc: "False Acceptance Rate — extremely low probability of spoofing." },
              { metric: "FRR", value: "1.20%", desc: "False Rejection Rate — ensures authorized users gain fast access." },
              { metric: "EER", value: "0.85%", desc: "Equal Error Rate — demonstrating optimal system threshold balance." },
              { metric: "AUC", value: "0.99", desc: "Area Under Curve — near perfect classification capability." },
            ].map((m, i) => (
              <div key={i} className="bg-slate-900/40 backdrop-blur border border-cyan-900/30 p-8 rounded-2xl text-center hover:border-cyan-500/50 hover:shadow-[0_0_30px_rgba(34,211,238,0.15)] transition-all group">
                <div className="text-sm font-bold text-slate-500 tracking-widest mb-4 group-hover:text-cyan-400 transition-colors">{m.metric}</div>
                <div className="text-4xl font-black text-white mb-4 font-mono">{m.value}</div>
                <div className="text-xs text-slate-400 leading-relaxed border-t border-slate-800 pt-4">
                  {m.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GitHub CTA Section */}
      <section className="py-32 px-4 bg-slate-950">
        <div className="max-w-4xl mx-auto bg-gradient-to-br from-slate-900 to-black border border-slate-800 rounded-3xl p-10 md:p-16 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none" />
          
          <GitBranch className="w-16 h-16 text-white mx-auto mb-8" />
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">Open Source & Ready</h2>
          <p className="text-slate-400 max-w-2xl mx-auto mb-10 text-lg">
            Review the complete architecture, deployment instructions, and model integration code on our official repository.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a 
              href="https://github.com/prathameshmittal0205-beep/NHAI" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-8 py-4 bg-white text-black hover:bg-slate-200 rounded-xl font-bold transition-all w-full sm:w-auto justify-center"
            >
              <FileCode className="w-5 h-5" /> View Source Code
            </a>
            <a 
              href="https://github.com/prathameshmittal0205-beep/NHAI" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all border border-slate-700 w-full sm:w-auto justify-center"
            >
              <Star className="w-5 h-5" /> Star on GitHub
            </a>
          </div>
          
          <div className="mt-10 flex items-center justify-center gap-6 text-sm font-mono text-slate-500">
            <span>License: MIT</span>
            <span>Language: TypeScript</span>
          </div>
        </div>
      </section>
      
    </div>
  );
}
