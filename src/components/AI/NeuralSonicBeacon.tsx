"use client";


import { useTranslation } from '@/context/I18nContext';
import React, { useEffect, useState, useRef } from "react";
import { Mic, Loader2, Radio, Sparkles } from "lucide-react";
import { useNucleusSession } from "@/context/NucleusSessionProvider";
import styles from "./NeuralSonicBeacon.module.css";

interface NeuralSonicBeaconProps {
  onOpenCopilot?: () => void;
  className?: string;
}

export function NeuralSonicBeacon({ onOpenCopilot, className }: NeuralSonicBeaconProps) {
    const { t } = useTranslation();
  const { status, getLevels } = useNucleusSession();
  const [userLevel, setUserLevel] = useState(0);
  const [assistantLevel, setAssistantLevel] = useState(0);
  const animFrame = useRef<number | null>(null);

  // Audio reactive loop
  useEffect(() => {
    if (status !== "live") {
      setUserLevel(0);
      setAssistantLevel(0);
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
      return;
    }

    let isSubscribed = true;
    const updateLevels = () => {
      if (!isSubscribed) return;
      const levels = getLevels();
      setUserLevel(levels.user);
      setAssistantLevel(levels.assistant);
      animFrame.current = requestAnimationFrame(updateLevels);
    };

    animFrame.current = requestAnimationFrame(updateLevels);
    return () => {
      isSubscribed = false;
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
    };
  }, [status, getLevels]);

  // Click only opens the assistant — microphone is activated explicitly inside by user
  const handleClick = () => {
    if (onOpenCopilot) {
      onOpenCopilot();
    } else {
      window.dispatchEvent(new CustomEvent("nucleus:open_copilot"));
    }
  };

  const isLive = status === "live";
  const isConnecting = status === "connecting";

  // Dynamic 7-ribbon spectrum heights
  const activeLevel = Math.max(userLevel, assistantLevel);
  const barHeights = [
    Math.max(4, Math.min(16, 4 + activeLevel * 14)),
    Math.max(6, Math.min(20, 6 + activeLevel * 22)),
    Math.max(8, Math.min(24, 8 + activeLevel * 28)),
    Math.max(10, Math.min(26, 10 + activeLevel * 32)),
    Math.max(8, Math.min(24, 8 + activeLevel * 28)),
    Math.max(6, Math.min(20, 6 + activeLevel * 22)),
    Math.max(4, Math.min(16, 4 + activeLevel * 14)),
  ];

  return (
    <div className={`${styles.beaconWrapper} ${className || ""}`}>
      {isLive && <div className={styles.auroraAtmosphere} />}
      <button
        type="button"
        onClick={handleClick}
        className={`${styles.beaconBtn} ${
          isLive
            ? styles.beaconBtnLive
            : isConnecting
            ? styles.beaconBtnConnecting
            : ""
        }`}
        title={t("components.AI.NeuralSonicBeacon.title_open_nucleus_neural_intelligence_voice_p", "Open Nucleus Neural Intelligence (Voice & Policy Intelligence) — Shortcut: ⌘K")}
        aria-label={t("components.AI.NeuralSonicBeacon.aria-label_nucleus_assistance", "Nucleus Assistance")}
      >
        {isConnecting ? (
          <Loader2 className="animate-spin text-amber-500" size={15} />
        ) : isLive ? (
          <div className={styles.spectrumBarGroup} aria-hidden="true">
            {barHeights.map((h, i) => (
              <span
                key={i}
                className={styles.spectrumBar}
                style={{
                  height: `${h}px`,
                  background:
                    assistantLevel > userLevel
                      ? "linear-gradient(180deg, #10b981 0%, #059669 100%)"
                      : "linear-gradient(180deg, #6366f1 0%, #4f46e5 100%)",
                }}
              />
            ))}
          </div>
        ) : (
          <div className={styles.staticPillIcon}>
            <Sparkles size={15} />
            <span className={styles.subtlePulseDot} />
          </div>
        )}

        <div className={styles.labelSection}>
          <span className={styles.beaconPrimaryText}>
            {isLive ? (
              <span className={styles.badgeLiveContainer}>
                <Radio size={12} className={styles.liveRadioIcon} />
                
                {t("components.AI.NeuralSonicBeacon.text_live", "Live")}
              </span>
            ) : isConnecting ? (
              "Connecting…"
            ) : (
              "Nucleus Assistance"
            )}
          </span>
          <span className={styles.shortcutKey}>{t("components.AI.NeuralSonicBeacon.text_k", "⌘K")}</span>
        </div>
      </button>
    </div>
  );
}

export default NeuralSonicBeacon;
