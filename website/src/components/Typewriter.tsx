"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const words = [
  "Facial Recognition",
  "Liveness Detection",
  "Anti-Spoofing",
  "Offline-First AI"
];

export default function Typewriter() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % words.length);
    }, 3000); // Change word every 3 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="inline-block min-w-[300px] text-left">
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300 drop-shadow-[0_0_15px_rgba(56,189,248,0.4)]"
        >
          {words[index]}
        </motion.span>
      </AnimatePresence>
      <motion.span 
        animate={{ opacity: [1, 0] }} 
        transition={{ repeat: Infinity, duration: 0.8 }}
        className="text-cyan-400 font-normal ml-1"
      >
        |
      </motion.span>
    </span>
  );
}
