"use client";

import React from "react";
import { motion } from "framer-motion";

interface SiriPurpleNProps {
  isListening: boolean;
  onClick?: () => void;
  className?: string;
}

export default function SiriPurpleN({ isListening, onClick, className = "" }: SiriPurpleNProps) {
  // SVG Path definition for a stylized capital "N"
  const nPath = "M 30,75 L 30,25 L 70,75 L 70,25";
  
  // SVG Path definition for a perfect resting circle
  const circlePath = "M 50,50 A 25,25 0 1,1 49.9,50 Z";

  // Configuration for 3 distinct glowing neon layers (all in varying shades of Purple/Violet)
  const purpleWaves = [
    { color: "rgba(147, 51, 234, 0.7)", delay: 0, scale: 1, width: 4.5 },    // Core Violet
    { color: "rgba(168, 85, 247, 0.5)", delay: 0.15, scale: 1.04, width: 3.5 }, // Mid Purple
    { color: "rgba(192, 132, 252, 0.3)", delay: 0.3, scale: 0.96, width: 2.5 },  // Outer Lavender
  ];

  return (
    // The main outer frame handles centering, dimensions, and theme-adaptive background
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '130px',
        height: '130px',
        margin: '0 auto 0.5rem',
        borderRadius: '24px',
        background: 'var(--card-2, rgba(255, 255, 255, 0.04))',
        border: '1px solid var(--line, rgba(255, 255, 255, 0.1))',
        boxShadow: 'var(--shadow-raise, 0 4px 20px rgba(0, 0, 0, 0.08))',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        userSelect: 'none',
      }}
      title={isListening ? "Listening... (Click to stop)" : "Click to speak"}
    >
      {/* Ambient background mesh glow that reacts to light/dark contexts */}
      <div
        style={{
          position: 'absolute',
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.3) 0%, rgba(147, 51, 234, 0) 70%)',
          filter: 'blur(16px)',
          pointerEvents: 'none',
        }}
      />

      {/* SVG Canvas for the main high-fidelity vector animation */}
      <svg
        viewBox="0 0 100 100"
        style={{
          width: '100%',
          height: '100%',
          overflow: 'visible',
          filter: 'drop-shadow(0 0 12px rgba(168, 85, 247, 0.45))',
        }}
      >
        <defs>
          {/* Neon Purple linear gradient across the 'N' path stroke */}
          <linearGradient id="purpleSiriGradient" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7c3aed" />   {/* Deep Violet */}
            <stop offset="50%" stopColor="#a855f7" />  {/* Vibrant Purple */}
            <stop offset="100%" stopColor="#c084fc" /> {/* Soft Lavender */}
          </linearGradient>
        </defs>

        {/* Dynamic Wave Layers */}
        {purpleWaves.map((wave, index) => (
          <motion.path
            key={index}
            fill="none"
            stroke={isListening ? "url(#purpleSiriGradient)" : wave.color}
            strokeWidth={isListening ? wave.width : 2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ d: circlePath }}
            animate={{
              // Flawlessly morphs between the circle shape and the capital "N"
              d: isListening ? nPath : circlePath,
              scale: wave.scale,
            }}
            transition={{
              type: "spring",
              stiffness: 65,
              damping: 11,
              delay: wave.delay,
            }}
          />
        ))}

        {/* Active Oscillating Siri Noise Layer (Only runs when listening) */}
        {isListening && (
          <motion.path
            d={nPath}
            fill="none"
            stroke="rgba(255, 255, 255, 0.6)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mix-blend-overlay"
            animate={{
              // Real-time micro vibrations traveling down the legs of the N
              transform: [
                "translate(0px, 0px) scale(1)",
                "translate(-1px, 1.5px) scale(1.01)",
                "translate(1.5px, -1.5px) scale(0.99)",
                "translate(-1.5px, -0.5px) scale(1.005)",
                "translate(0px, 0px) scale(1)",
              ],
            }}
            transition={{
              repeat: Infinity,
              duration: 0.45,
              ease: "linear",
            }}
          />
        )}
      </svg>
    </div>
  );
}
