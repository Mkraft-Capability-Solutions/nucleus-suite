"use client";

import { useEffect, useState, useRef, useCallback } from "react";

interface DecryptedTextProps {
  text: string;
  speed?: number;
  maxIterations?: number;
  characters?: string;
  className?: string;
  parentClassName?: string;
  animateOn?: "view" | "hover";
  revealDirection?: "start" | "end" | "center";
  useOriginalCharsOnly?: boolean;
}

export default function DecryptedText({
  text,
  speed = 40,
  maxIterations = 10,
  characters = "01#*~_><[]{}!@&%",
  className = "",
  parentClassName = "",
  animateOn = "view",
  revealDirection = "start",
  useOriginalCharsOnly = false,
}: DecryptedTextProps) {
  const [displayText, setDisplayText] = useState(text);
  const containerRef = useRef<HTMLSpanElement>(null);
  const isScramblingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const availableChars = useOriginalCharsOnly
    ? Array.from(new Set(text.split(""))).filter((c) => c !== " ")
    : characters.split("");

  const triggerAnimation = useCallback(() => {
    if (isScramblingRef.current) return;
    isScramblingRef.current = true;
    let iteration = 0;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      setDisplayText(() => {
        const textArr = text.split("");
        const progress = iteration / maxIterations;
        const revealedCount = Math.floor(progress * textArr.length);

        const next = textArr.map((char, index) => {
          if (char === " ") return " ";
          let isRevealed = false;
          if (revealDirection === "start") {
            isRevealed = index < revealedCount;
          } else if (revealDirection === "end") {
            isRevealed = index >= textArr.length - revealedCount;
          } else {
            const center = textArr.length / 2;
            const dist = Math.abs(index - center);
            isRevealed = dist < revealedCount / 2;
          }

          if (isRevealed || iteration >= maxIterations) {
            return char;
          }
          return availableChars[Math.floor(Math.random() * availableChars.length)] || char;
        });

        return next.join("");
      });

      iteration += 1;
      if (iteration > maxIterations) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setDisplayText(text);
        isScramblingRef.current = false;
      }
    }, speed);
  }, [text, maxIterations, revealDirection, availableChars, speed]);

  useEffect(() => {
    if (animateOn === "view") {
      const timer = setTimeout(() => {
        triggerAnimation();
      }, 0);
      return () => {
        clearTimeout(timer);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
  }, [animateOn, triggerAnimation]);

  const handleMouseEnter = () => {
    if (animateOn === "hover") {
      triggerAnimation();
    }
  };

  return (
    <span
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      className={`inline-block font-mono tracking-tight ${parentClassName}`}
      aria-label={text}
    >
      <span className={className}>{displayText}</span>
    </span>
  );
}
