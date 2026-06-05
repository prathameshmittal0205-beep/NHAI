"use client";

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Search, Filter, CheckCircle2, XCircle, Clock, Server, BarChart3, Users, LayoutDashboard, Database, Activity, Wifi, Download, PieChart, ActivityIcon, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MOCK_DATA = [
  { id: "NHAI-2024-4012", name: "Rahul Sharma", time: "09:05 AM", loc: "NH-48 Mumbai-Pune", score: 98.4, liveness: true, sync: "synced" },
  { id: "NHAI-2024-4089", name: "Priya Patel", time: "09:12 AM", loc: "NH-44 Delhi-Agra", score: 97.1, liveness: true, sync: "synced" },
  { id: "NHAI-2024-5102", name: "Amit Kumar", time: "09:15 AM", loc: "NH-19 Kolkata-Dhanbad", score: 85.2, liveness: false, sync: "failed" },
  { id: "NHAI-2024-3091", name: "Neha Gupta", time: "09:22 AM", loc: "NH-48 Mumbai-Pune", score: 99.1, liveness: true, sync: "synced" },
  { id: "NHAI-2024-6015", name: "Suresh Reddy", time: "09:28 AM", loc: "NH-16 Chennai-Vizag", score: 96.5, liveness: true, sync: "pending" },
  { id: "NHAI-2024-4056", name: "Anita Desai", time: "09:35 AM", loc: "NH-44 Delhi-Agra", score: 95.8, liveness: true, sync: "synced" },
  { id: "NHAI-2024-5092", name: "Vikram Singh", time: "09:41 AM", loc: "NH-19 Kolkata-Dhanbad", score: 82.0, liveness: false, sync: "failed" },
  { id: "NHAI-2024-3034", name: "Riya Verma", time: "09:45 AM", loc: "NH-48 Mumbai-Pune", score: 98.9, liveness: true, sync: "synced" },
  { id: "NHAI-2024-6112", name: "Kiran Joshi", time: "09:50 AM", loc: "NH-16 Chennai-Vizag", score: 94.2, liveness: true, sync: "pending" },
  { id: "NHAI-2024-4077", name: "Manish Tiwari", time: "09:58 AM", loc: "NH-44 Delhi-Agra", score: 97.6, liveness: true, sync: "synced" },
];

const INITIAL_PAYLOADS = [
  { id: "sync_901", time: "Just now", size: "1.2KB", payload: "{\"iv\":\"b6f8...\",\"data\":\"U2Fsd...\"}" },
  { id: "sync_900", time: "5m ago", size: "0.8KB", payload: "{\"iv\":\"c2a1...\",\"data\":\"R3Vyd...\"}" },
  { id: "sync_899", time: "15m ago", size: "2.1KB", payload: "{\"iv\":\"a9b2...\",\"data\":\"M1NjY...\"}" }
];

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const [payloads, setPayloads] = useState(INITIAL_PAYLOADS);
  
  const filtered = MOCK_DATA.filter(d => d.name.toLowerCase().includes(search.toLowerCase()) || d.id.toLowerCase().includes(search.toLowerCase()));

  // Live Activity Feed State
  const [liveLogs, setLiveLogs] = useState([
    { id: 1, name: "Priya Patel", time: "2 min ago", success: true },
    { id: 2, name: "Amit Kumar", time: "5 min ago", success: false },
    { id: 3, name: "Rahul Sharma", time: "8 min ago", success: true }
  ]);
  const [syncTime, setSyncTime] = useState(0);

  useEffect(() => {
    let count = 902;
    const interval = setInterval(() => {
      setPayloads(prev => {
        const newPayload = {
          id: `sync_${count++}`,
          time: "Just now",
          size: (Math.random() * 2 + 0.5).toFixed(1) + "KB",
          payload: `{"iv":"${Math.random().toString(36).substring(2,6)}...","data":"${btoa(Math.random().toString()).substring(0,5)}..."}`
        };
        return [newPayload, ...prev].slice(0, 5); // Keep last 5
      });
      setSyncTime(0);
    }, 4000);

    const timeInt = setInterval(() => setSyncTime(s => s + 1), 60000); // Minutes

    return () => {
      clearInterval(interval);
      clearInterval(timeInt);
    };
  }, []);

  useEffect(() => {
    let logId = 4;
    const names = ["Suresh Reddy", "Neha Gupta", "Kiran Joshi", "Manish Tiwari", "Riya Verma"];
    const logInterval = setInterval(() => {
      const isSuccess = Math.random() > 0.1;
      const randomName = names[Math.floor(Math.random() * names.length)];
      setLiveLogs(prev => [
        { id: logId++, name: randomName, time: "Just now", success: isSuccess },
        ...prev.map(l => ({ ...l, time: l.time === "Just now" ? "1 min ago" : l.time.replace(/\d+/, m => (parseInt(m) + 1).toString()) }))
      ].slice(0, 3));
    }, 5000);
    return () => clearInterval(logInterval);
  }, []);

  const handleExportCSV = () => {
    const headers = ["Employee ID,Name,Time,Location,Match Score,Liveness,Sync Status"];
    const rows = filtered.map(d => `${d.id},"${d.name}","${d.time}","${d.loc}",${d.score},${d.liveness ? 'Passed' : 'Failed'},${d.sync}`);
    const csvContent = "data:text/csv;charset=utf-8," + headers.concat(rows).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `attendance_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans flex flex-col md:flex-row pt-16">
      
      {/* Reimagined Admin Left Sidebar */}
      <aside className="w-full md:w-72 bg-slate-900/80 backdrop-blur-md border-r border-slate-800 p-6 flex-col hidden md:flex shrink-0 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto custom-scrollbar">
        
        {/* System Status Block */}
        <div className="bg-black/40 border border-slate-800 rounded-xl p-4 mb-8 shadow-inner relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-emerald-500" />
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">System Status</h2>
          
          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Edge Device</span>
              <span className="text-emerald-400 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Online</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">AWS Sync</span>
              <span className="text-amber-400 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Pending (2)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Last Sync</span>
              <span className="text-slate-300">{syncTime === 0 ? "Just now" : `${syncTime} min ago`}</span>
            </div>
            <div className="border-t border-slate-800 my-2 pt-2" />
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Model</span>
              <span className="text-cyan-400">TFLite INT8 ✓</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Encryption</span>
              <span className="text-cyan-400">AES-256 ✓</span>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="mb-8">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-2">Navigation</h2>
          <nav className="space-y-1">
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 bg-cyan-500/10 text-cyan-400 font-bold rounded-lg border border-cyan-500/20 shadow-[0_0_10px_rgba(34,211,238,0.1)] transition-all">
              <LayoutDashboard className="w-4 h-4" /> Overview
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors font-medium">
              <Users className="w-4 h-4" /> Attendance Logs
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors font-medium">
              <Server className="w-4 h-4" /> Sync Status
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors font-medium">
              <BarChart3 className="w-4 h-4" /> Analytics
            </a>
          </nav>
        </div>

        {/* Quick Stats Block */}
        <div className="mb-8">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-2">Quick Stats</h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-white">142</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Verifications</div>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-emerald-400">97%</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Success</div>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-cyan-400">98.5</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Avg Score</div>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-red-400">4</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Flagged</div>
            </div>
          </div>
        </div>

        {/* Live Activity Feed */}
        <div className="mt-auto">
          <div className="flex items-center gap-2 mb-3 px-2">
            <ActivityIcon className="w-4 h-4 text-emerald-400 animate-pulse" />
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Live Feed</h2>
          </div>
          <div className="space-y-2">
            <AnimatePresence>
              {liveLogs.map((log) => (
                <motion.div 
                  key={log.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg flex items-center gap-3"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${log.success ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                    {log.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-200 truncate">{log.name}</div>
                    <div className="text-[10px] text-slate-500">{log.time}</div>
                  </div>
                  {log.success ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 lg:p-8 space-y-8 overflow-y-auto">
        
        {/* Header & Date */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Dashboard Overview</h1>
            <p className="text-slate-400 text-sm mt-1">Real-time attendance & secure sync monitoring</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 px-5 py-2.5 rounded-xl text-sm font-bold text-slate-300 shadow-lg tracking-wide uppercase">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: "Total Scans Today", val: "142", icon: Activity, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
            { label: "Successfully Verified", val: "138", icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
            { label: "Rejected Scans", val: "4", icon: ShieldAlert, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
            { label: "Pending Cloud Sync", val: "12", icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" }
          ].map((card, i) => (
            <motion.div 
              key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.1 }}
              className={`bg-slate-900/80 backdrop-blur border ${card.border} p-6 rounded-2xl flex items-center gap-4 shadow-lg hover:bg-slate-800 transition-colors`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${card.bg} ${card.color}`}>
                <card.icon className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">{card.label}</div>
                <div className={`text-2xl font-black ${i > 0 ? card.color : 'text-white'}`}>{card.val}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Charts & Table Container */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          {/* Main Table Area (Span 2) */}
          <div className="xl:col-span-2 space-y-8">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* CSS Donut Chart */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col items-center justify-center">
                <div className="flex items-center gap-2 mb-6 w-full">
                  <PieChart className="w-5 h-5 text-purple-400" />
                  <h2 className="font-bold text-lg text-white">Verification Status</h2>
                </div>
                <div className="relative w-40 h-40 rounded-full flex items-center justify-center" style={{
                  background: `conic-gradient(
                    #10b981 0% 70%, 
                    #f59e0b 70% 85%, 
                    #ef4444 85% 100%
                  )`
                }}>
                  <div className="w-32 h-32 bg-slate-900 rounded-full flex flex-col items-center justify-center shadow-inner">
                    <span className="text-3xl font-black text-white">142</span>
                    <span className="text-xs font-bold tracking-widest uppercase text-slate-500">Scans</span>
                  </div>
                </div>
                <div className="flex gap-4 mt-8 text-xs font-bold tracking-wide text-slate-400 w-full justify-center">
                  <div className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-500 rounded-sm"/> Verified (70%)</div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 bg-amber-500 rounded-sm"/> Pending (15%)</div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-sm"/> Rejected (15%)</div>
                </div>
              </div>

              {/* Simple CSS Bar Chart */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center gap-2 mb-6">
                  <BarChart3 className="w-5 h-5 text-cyan-400" />
                  <h2 className="font-bold text-lg text-white">Attendance by Hour</h2>
                </div>
                <div className="h-40 flex items-end justify-between gap-2 md:gap-3 px-2">
                  {[40, 85, 30, 20, 15, 60, 45, 10].map((h, i) => (
                    <div key={i} className="flex flex-col items-center gap-2 flex-1 group">
                      <motion.div 
                        initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ duration: 1, delay: i * 0.1 }}
                        className="w-full bg-cyan-500/30 hover:bg-cyan-500/50 border border-cyan-500/50 rounded-t-sm relative transition-colors"
                      >
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-xs px-2 py-1 rounded font-bold text-white transition-opacity">
                          {h}
                        </div>
                      </motion.div>
                      <span className="text-[10px] font-mono text-slate-500">0{i+7}:00</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Attendance Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="font-bold text-lg text-white">Recent Attendance Logs</h2>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input 
                      type="text" 
                      placeholder="Search ID or Name..." 
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="bg-black border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors w-full sm:w-64 font-mono placeholder:text-slate-600 placeholder:font-sans"
                    />
                  </div>
                  <button className="p-2.5 border border-slate-700 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors">
                    <Filter className="w-4 h-4" />
                  </button>
                  <button onClick={handleExportCSV} className="p-2.5 border border-cyan-500/30 bg-cyan-500/10 rounded-lg hover:bg-cyan-500/20 text-cyan-400 transition-colors flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
                    <Download className="w-4 h-4" /> CSV
                  </button>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-black text-slate-500 uppercase text-xs font-bold tracking-widest">
                    <tr>
                      <th className="px-6 py-4">Employee</th>
                      <th className="px-6 py-4">Location</th>
                      <th className="px-6 py-4">Timestamp</th>
                      <th className="px-6 py-4">Confidence</th>
                      <th className="px-6 py-4">Liveness</th>
                      <th className="px-6 py-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {filtered.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-800/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="font-bold text-white group-hover:text-cyan-400 transition-colors">{row.name}</div>
                          <div className="text-xs font-mono text-slate-500">{row.id}</div>
                        </td>
                        <td className="px-6 py-4 text-slate-400 text-xs font-medium">{row.loc}</td>
                        <td className="px-6 py-4 text-slate-300 font-mono text-xs">{row.time}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded font-mono text-xs font-bold border ${row.score > 90 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                            {row.score}%
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {row.liveness ? (
                            <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                              <CheckCircle2 className="w-4 h-4" /> Pass
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-red-400 font-bold text-xs uppercase tracking-wider">
                              <XCircle className="w-4 h-4" /> Fail
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {row.sync === 'synced' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-black border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-widest"><Server className="w-3 h-3"/> Synced</span>}
                          {row.sync === 'pending' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-black border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-widest animate-pulse"><Clock className="w-3 h-3"/> Pending</span>}
                          {row.sync === 'failed' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-black border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-widest"><XCircle className="w-3 h-3"/> Failed</span>}
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-500 font-mono">
                          No matching records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Panel: Sync Status */}
          <aside className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl sticky top-24">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-cyan-400" />
                  <h2 className="font-bold text-lg text-white">Data Sync Node</h2>
                </div>
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,1)]" />
              </div>
              <p className="text-xs text-slate-500 mb-6 font-medium">Live monitor of AES-256 encrypted biometric payloads awaiting AWS DynamoDB push.</p>
              
              <div className="space-y-4">
                <AnimatePresence>
                  {payloads.map((payload) => (
                    <motion.div 
                      key={payload.id}
                      initial={{ opacity: 0, y: -20, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, scale: 0.9, height: 0 }}
                      transition={{ type: "spring", bounce: 0.3 }}
                      className="bg-black border border-slate-800 rounded-xl p-4 font-mono text-xs group hover:border-slate-700 transition-colors overflow-hidden shadow-inner"
                    >
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-cyan-400 font-bold">{payload.id}</span>
                        <span className="text-slate-500">{payload.time} ({payload.size})</span>
                      </div>
                      <div className="text-slate-400 break-all bg-slate-900 border border-slate-800 p-2.5 rounded-lg leading-relaxed">
                        {payload.payload}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              
              <button className="w-full mt-6 bg-cyan-600/10 hover:bg-cyan-600/20 text-cyan-400 font-bold uppercase tracking-widest py-3 rounded-xl border border-cyan-500/30 transition-all text-sm shadow-[0_0_15px_rgba(34,211,238,0.1)]">
                Force Sync Execute
              </button>
            </div>
          </aside>

        </div>
      </main>

    </div>
  );
}
