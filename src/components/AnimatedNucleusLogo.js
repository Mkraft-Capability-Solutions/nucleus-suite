"use client";
import React from 'react';
import styles from './AnimatedNucleusLogo.module.css';

export default function AnimatedNucleusLogo({ size = 96, isListening = false, isSpeaking = false }) {
  return (
    <div 
      className={`${styles.logoContainer} ${isListening ? styles.listening : ''} ${isSpeaking ? styles.speaking : ''}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label="Nucleus Animated Wave Logo"
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={styles.svgLogo}
        style={{ width: '100%', height: '100%' }}
      >
        <defs>
          <linearGradient id="nucleusNStemLeft" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
          <linearGradient id="nucleusNDiagonal" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
          <linearGradient id="nucleusNStemRight" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
          <radialGradient id="nucleusSphereGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="35%" stopColor="#38bdf8" />
            <stop offset="70%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#7c3aed" />
          </radialGradient>
          <filter id="nucleusGlowFilter" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer Orbit Rings */}
        <circle cx="50" cy="50" r="44" className={styles.orbitTrack1} />
        <circle cx="50" cy="50" r="44" className={styles.orbitPulse1} />

        {/* Futuristic Stylized "N" Path */}
        {/* Left vertical pillar */}
        <path
          d="M 28 78 L 28 22 C 28 17 33 17 33 22 L 33 78 C 33 83 28 83 28 78 Z"
          fill="url(#nucleusNStemLeft)"
          className={styles.leftPillar}
        />

        {/* Dynamic Diagonal Stroke */}
        <path
          d="M 28 24 L 67 76 C 70 80 74 78 74 74 L 74 22 C 74 17 69 17 69 22 L 69 64 L 33 18 C 30 14 28 17 28 24 Z"
          fill="url(#nucleusNDiagonal)"
          className={styles.diagonalStroke}
        />

        {/* Right vertical pillar */}
        <path
          d="M 69 22 L 69 78 C 69 83 74 83 74 78 L 74 22 C 74 17 69 17 69 22 Z"
          fill="url(#nucleusNStemRight)"
          className={styles.rightPillar}
        />

        {/* Animated Siri-like Center Nucleus Dot (Moving with fluid wave keyframes) */}
        <circle
          cx="50"
          cy="50"
          r="10"
          fill="url(#nucleusSphereGlow)"
          filter="url(#nucleusGlowFilter)"
          className={styles.animatedCenterDot}
        />
        <circle
          cx="50"
          cy="50"
          r="4"
          fill="#ffffff"
          className={styles.centerDotCore}
        />
      </svg>
    </div>
  );
}
