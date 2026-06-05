"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldCheck, PlayCircle, Menu, X } from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const links = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Live Preview', href: '/demo' },
    { name: 'About', href: '/about' },
  ];

  return (
    <>
      <header className={clsx(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        isScrolled ? "bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50 shadow-lg" : "bg-transparent"
      )}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 group">
            <ShieldCheck className="text-blue-500 w-7 h-7 group-hover:text-blue-400 transition-colors" />
            <span className="font-bold text-xl tracking-tight text-white group-hover:text-slate-200 transition-colors">NHAI Datalake 3.0</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8 bg-slate-900/50 px-6 py-2 rounded-full border border-slate-800/50 backdrop-blur-md">
            {links.map(link => (
              <Link 
                key={link.name} 
                href={link.href}
                className={clsx(
                  "text-sm font-medium transition-colors hover:text-blue-400",
                  pathname === link.href ? "text-blue-400 font-semibold" : "text-slate-300"
                )}
              >
                {link.name}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <Link href="/demo" className="bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 text-blue-400 px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 hover:shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:border-blue-500/50">
              <PlayCircle className="w-4 h-4" /> Try Live Preview
            </Link>
          </div>

          {/* Mobile Toggle */}
          <button 
            className="md:hidden text-slate-300 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className="fixed inset-0 z-40 bg-slate-950/95 backdrop-blur-xl flex flex-col pt-24 px-6 md:hidden"
          >
            <nav className="flex flex-col gap-6 text-xl font-medium">
              {links.map(link => (
                <Link 
                  key={link.name} 
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={clsx(
                    "transition-colors",
                    pathname === link.href ? "text-blue-400" : "text-slate-300"
                  )}
                >
                  {link.name}
                </Link>
              ))}
              <div className="h-px bg-slate-800 w-full my-4" />
              <Link 
                href="/demo" 
                onClick={() => setMobileMenuOpen(false)}
                className="w-full mt-4 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 text-blue-400 px-5 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
              >
                <PlayCircle className="w-5 h-5" /> Try Live Preview
              </Link>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
