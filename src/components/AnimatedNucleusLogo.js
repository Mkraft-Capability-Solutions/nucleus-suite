"use client";
import React from 'react';
import styles from './AnimatedNucleusLogo.module.css';

export default function AnimatedNucleusLogo({ size = 96, isListening = false, isSpeaking = false, onClick }) {
  return (
    <div 
      className={`${styles.circleLogoWrapper} ${isListening ? styles.listening : ''} ${isSpeaking ? styles.speaking : ''}`}
      style={{ width: size, height: size }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label="Nucleus Animated Logo"
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={styles.svgLogo}
      >
        <defs>
          {/* Left Ribbon Gradient */}
          <linearGradient id="nucLeftGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="50%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>

          {/* Right Ribbon Gradient */}
          <linearGradient id="nucRightGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>

          {/* Center Diagonal / Loop Gradient */}
          <linearGradient id="nucDiagonalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="40%" stopColor="#6366f1" />
            <stop offset="80%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>

          {/* Center Nucleus Dot Radial Gradient */}
          <radialGradient id="nucSphereGrad" cx="38%" cy="36%" r="65%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="25%" stopColor="#c084fc" />
            <stop offset="65%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#4338ca" />
          </radialGradient>

          {/* Glow filter */}
          <filter id="nucDotGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 1. Left Vertical Pillar */}
        <path
          d="M 22 74 C 22 78.5, 25.5 82, 30 82 C 34.5 82, 38 78.5, 38 74 L 38 36 C 38 27, 30 20, 21 20 C 16.5 20, 13 23.5, 13 28 L 13 74 C 13 78.5, 16.5 82, 21 82"
          fill="url(#nucLeftGrad)"
          className={styles.leftStem}
        />

        {/* 2. Inner Curved Ribbon & Diagonal Stroke */}
        <path
          d="M 22 30 C 26 24, 38 22, 46 30 C 53 37, 51 52, 43 56 C 37 59, 30 55, 27 49 L 68 79 C 72 82, 77 79, 77 74 L 77 28 C 77 23.5, 73.5 20, 69 20 C 64.5 20, 61 23.5, 61 28 L 61 62 L 32 38 C 29 35, 24 33, 22 30 Z"
          fill="url(#nucDiagonalGrad)"
          className={styles.centerRibbon}
        />

        {/* 3. Right Vertical Pillar */}
        <path
          d="M 68 28 L 68 74 C 68 78.5, 71.5 82, 76 82 C 80.5 82, 84 78.5, 84 74 L 84 28 C 84 23.5, 80.5 20, 76 20 C 71.5 20, 68 23.5, 68 28 Z"
          fill="url(#nucRightGrad)"
          className={styles.rightStem}
        />

        {/* 4. The Center Nucleus Sphere (Iconic animated dot) */}
        <circle
          cx="48"
          cy="44"
          r="12"
          fill="url(#nucSphereGrad)"
          filter="url(#nucDotGlow)"
          className={styles.nucleusCenterDot}
        />
        <circle
          cx="45"
          cy="41"
          r="3.5"
          fill="#ffffff"
          opacity="0.8"
          className={styles.nucleusCenterHighlight}
        />
      </svg>
    </div>
  );
}
