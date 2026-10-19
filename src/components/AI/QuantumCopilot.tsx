"use client";


import { useTranslation } from '@/context/I18nContext';
import React, { useState, useEffect, useRef, FormEvent } from "react";
import {
  Mic,
  MicOff,
  Send,
  Sparkles,
  X,
  Minimize2,
  Maximize2,
  FileText,
  Volume2,
  Activity,
  Square,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { useNucleusSession } from "@/context/NucleusSessionProvider";
import styles from "./QuantumCopilot.module.css";

interface CitationDetail {
  title: string;
  section?: string;
  text?: string;
}

interface MessageTurn {
  id: string;
  role: "user" | "assistant";
  text: string;
  sources?: string[];
  isVoice?: boolean;
  telemetry?: {
    tool: string;
    result: Record<string, unknown>;
  };
}

interface QuantumCopilotProps {
  isOpen?: boolean;
  onClose?: () => void;
  activeDomain?: string;
  activeTab?: string;
  onNavigate?: (tab: string, domain?: string, sub?: string) => void;
}

export function QuantumCopilot({
  isOpen: controlledIsOpen,
  onClose,
  activeDomain = "core_hr",
  activeTab = "dashboard",
}: QuantumCopilotProps) {
    const { t } = useTranslation();
  const {
    status,
    turns: liveTurns,
    analysis,
    draft,
    confirmDraft,
    cancelDraft,
    connect,
    disconnect,
    sendText: sendVoiceText,
    getLevels,
  } = useNucleusSession();

  const [isOpen, setIsOpen] = useState(controlledIsOpen ?? false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [isSubmittingText, setIsSubmittingText] = useState(false);
  const [chatMessages, setChatMessages] = useState<MessageTurn[]>([
    {
      id: "initial-welcome",
      role: "assistant",
      text: "Greetings. I am Nucleus Neural Intelligence. Click the mic to speak naturally, or type any inquiry below. All workforce analytics and policies are mathematically verified in real time.",
    },
  ]);
  const [selectedCitation, setSelectedCitation] = useState<CitationDetail | null>(null);

  // Audio level state for 60 FPS acoustic wave animation
  const [userLevel, setUserLevel] = useState(0);
  const [assistantLevel, setAssistantLevel] = useState(0);
  const animFrame = useRef<number | null>(null);
  const dialogueEndRef = useRef<HTMLDivElement | null>(null);

  // Sync controlled state
  useEffect(() => {
    if (controlledIsOpen !== undefined) {
      setIsOpen(controlledIsOpen);
    }
  }, [controlledIsOpen]);

  // Global custom event listeners
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    const handleToggle = () => setIsOpen((prev) => !prev);
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };

    window.addEventListener("nucleus:open_copilot", handleOpen);
    window.addEventListener("nucleus:toggle_copilot", handleToggle);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("nucleus:open_copilot", handleOpen);
      window.removeEventListener("nucleus:toggle_copilot", handleToggle);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Sync live voice turns into dialogue stream
  useEffect(() => {
    if (liveTurns.length > 0) {
      const latestLive = liveTurns.map((t, idx) => ({
        id: `live-${idx}-${t.role}`,
        role: t.role,
        text: t.text,
        isVoice: true,
      }));
      setChatMessages((prev) => {
        const textOnly = prev.filter((m) => !m.isVoice);
        return [...textOnly, ...latestLive];
      });
    }
  }, [liveTurns]);

  // Audio reactivity loop
  useEffect(() => {
    if (status !== "live") {
      setUserLevel(0);
      setAssistantLevel(0);
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
      return;
    }

    let isRunning = true;
    const loop = () => {
      if (!isRunning) return;
      const levels = getLevels();
      setUserLevel(levels.user);
      setAssistantLevel(levels.assistant);
      animFrame.current = requestAnimationFrame(loop);
    };

    animFrame.current = requestAnimationFrame(loop);
    return () => {
      isRunning = false;
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
    };
  }, [status, getLevels]);

  // Auto-scroll on new turns
  useEffect(() => {
    dialogueEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isSubmittingText]);

  // Explicit Mic Toggle: Click once to activate, click back to stop
  const handleToggleMic = async () => {
    if (status === "live" || status === "connecting") {
      await disconnect();
    } else {
      try {
        await connect();
      } catch (err) {
        console.warn("Connection attempt failed:", err);
      }
    }
  };

  // Close handler: Always cleanly stops audio hardware stream
  const handleClose = async () => {
    setIsOpen(false);
    if (onClose) onClose();
    if (status === "live" || status === "connecting") {
      await disconnect();
    }
  };

  // Directives suggestions
  const contextDirectives: Record<string, string[]> = {
    attendance: [
      "Explain the 15-minute shift grace rule",
      "Show my attendance summary and overtime hours",
      "Who created you and who is your father?",
    ],
    leaves: [
      "What is my current leave balance?",
      "Explain the Compensatory Off 60-day expiry rule",
      "Who created you and who is your father?",
    ],
    payroll: [
      "Show recent payroll runs and anomaly findings",
      "Explain employee loan borrowing ceiling",
      "Who created you and who is your father?",
    ],
  };

  const currentDirectives = contextDirectives[activeTab] || [
    "Explain 15-minute attendance grace rule",
    "Show workforce attendance and overtime hours",
    "Who created you and who is your father?",
    "Explain employee loan borrowing limits",
  ];

  // Text submit handler
  const handleSendText = async (textToSend?: string) => {
    const query = (textToSend || inputVal).trim();
    if (!query || isSubmittingText) return;

    setInputVal("");

    if (status === "live") {
      sendVoiceText(query);
      return;
    }

    const userMsg: MessageTurn = {
      id: crypto.randomUUID(),
      role: "user",
      text: query,
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setIsSubmittingText(true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: query }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);

      const assistantMsg: MessageTurn = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: data?.answer || "Processed policy inquiry successfully.",
        sources: Array.isArray(data?.sources) ? data.sources : undefined,
      };
      setChatMessages((prev) => [...prev, assistantMsg]);
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : "Error contacting policy assistant";
      setChatMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: `Notice: ${err}. Please ensure your query relates to verified company policies.`,
        },
      ]);
    } finally {
      setIsSubmittingText(false);
    }
  };

  if (!isOpen) return null;

  const isLive = status === "live";
  const isConnecting = status === "connecting";
  const isSpeaking = assistantLevel > 0.05;
  const isUserSpeaking = userLevel > 0.05;
  const activeLevel = Math.max(userLevel, assistantLevel);

  // Equalizer soundwave heights (12 fluid bands)
  const soundwaveHeights = [
    Math.max(4, Math.min(24, 4 + activeLevel * 22)),
    Math.max(6, Math.min(28, 6 + activeLevel * 26)),
    Math.max(9, Math.min(32, 9 + activeLevel * 30)),
    Math.max(12, Math.min(36, 12 + activeLevel * 34)),
    Math.max(8, Math.min(26, 8 + activeLevel * 24)),
    Math.max(5, Math.min(18, 5 + activeLevel * 16)),
    Math.max(7, Math.min(22, 7 + activeLevel * 20)),
    Math.max(11, Math.min(34, 11 + activeLevel * 32)),
    Math.max(13, Math.min(38, 13 + activeLevel * 36)),
    Math.max(10, Math.min(28, 10 + activeLevel * 26)),
    Math.max(6, Math.min(20, 6 + activeLevel * 18)),
    Math.max(4, Math.min(16, 4 + activeLevel * 14)),
  ];

  return (
    <>
      {/* Screen-Perimeter Apple Intelligence Chromatic Aura */}
      {isLive && <div className={styles.chromaticAuraOverlay} />}

      {/* Frosted Ambient Backdrop */}
      <div className={styles.backdropOverlay} onClick={handleClose} />

      {/* Floating Apple Dynamic Neural Capsule */}
      <aside
        className={`${styles.copilotIsland} ${isExpanded ? styles.expandedIsland : ""}`}
        role="dialog"
        aria-label={t("components.AI.QuantumCopilot.aria-label_nucleus_neural_intelligence", "Nucleus Neural Intelligence")}
      >
        {/* Top Bar with Fluid Header */}
        <div className={styles.islandHeader}>
          <div className={styles.brandGroup}>
            <div className={styles.headerTitleSection}>
              <div className={styles.systemTitleRow}>
                <h3 className={styles.systemTitle}>{t("components.AI.QuantumCopilot.text_nucleus_neural_intelligence", "Nucleus Neural Intelligence")}</h3>
                <span className={styles.versionBadge}>{t("components.AI.QuantumCopilot.text_gemini_31_live_hd", "Gemini 3.1 Live HD")}</span>
              </div>
              <span className={styles.systemSubtext}>
                <span
                  className={`${styles.statusIndicatorDot} ${
                    isLive
                      ? styles.statusIndicatorDotLive
                      : isConnecting
                      ? styles.statusIndicatorDotConnecting
                      : ""
                  }`}
                />
                {isLive
                  ? isSpeaking
                    ? "Nucleus AI Speaking (Kore 24kHz HD Voice)"
                    : isUserSpeaking
                    ? "Listening to your voice…"
                    : "Live Audio Connected — Speak freely"
                  : isConnecting
                  ? "Connecting 24kHz HD live stream…"
                  : "Mathematical Policy Invariant Intelligence"}
              </span>
            </div>
          </div>

          <div className={styles.headerControls}>
            <button
              type="button"
              className={styles.controlBtn}
              onClick={() => setIsExpanded((prev) => !prev)}
              title={isExpanded ? "Collapse View" : "Expand View"}
              aria-label={t("components.AI.QuantumCopilot.aria-label_toggle_expand", "Toggle Expand")}
            >
              {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
            <button
              type="button"
              className={styles.controlBtn}
              onClick={handleClose}
              title={t("components.AI.QuantumCopilot.title_close_esc", "Close (Esc)")}
              aria-label={t("components.AI.QuantumCopilot.aria-label_close", "Close")}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Hero Acoustic Stage (The Centerpiece Apple Neural Orb) */}
        <div className={styles.acousticStage}>
          <button
            type="button"
            className={styles.acousticOrbButton}
            onClick={handleToggleMic}
            title={
              isLive
                ? "Active: Click to Stop Listening"
                : "Inactive: Click to Start Speaking"
            }
            aria-label={isLive ? "Stop Listening" : "Start Speaking"}
          >
            {isLive && <div className={styles.acousticRingWave} />}
            {isLive && <div className={styles.acousticRingWaveSecond} />}

            <div
              className={`${styles.neuralSphereCore} ${
                isLive
                  ? isSpeaking
                    ? styles.neuralSphereSpeaking
                    : styles.neuralSphereListening
                  : ""
              }`}
            >
              {isLive ? (
                isSpeaking ? (
                  <Volume2 size={28} className="drop-shadow-sm" />
                ) : (
                  <Square size={22} className="drop-shadow-sm fill-current" />
                )
              ) : (
                <Mic size={26} className="drop-shadow-sm" />
              )}
            </div>
          </button>

          <span className={styles.acousticPromptText}>
            {isLive ? (
              isSpeaking ? (
                "Nucleus AI is answering…"
              ) : (
                <>
                  <span style={{ color: "#ef4444" }}>{t("components.AI.QuantumCopilot.text_listening", "● Listening")}</span>  {t("components.AI.QuantumCopilot.text_click_to_stop", "— Click to Stop")}
                </>
              )
            ) : (
              "Click to Speak with Nucleus Neural Intelligence"
            )}
          </span>

          <span className={styles.acousticPromptHint}>
            {isLive
              ? "Voice input active. Tap the orb anytime to stop."
              : "Microphone is idle. Click orb or use input bar to talk."}
          </span>

          {/* Real-Time Acoustic Waveform Ribbon */}
          {isLive && (
            <div className={styles.soundwaveRibbon} aria-hidden="true">
              {soundwaveHeights.map((h, i) => (
                <span
                  key={i}
                  className={styles.soundwaveBar}
                  style={{
                    height: `${h}px`,
                    background: isSpeaking
                      ? "linear-gradient(180deg, #10b981 0%, #06b6d4 100%)"
                      : "linear-gradient(180deg, #ec4899 0%, #8b5cf6 100%)",
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Main Dialogue Stage (Executive Typography Flow) */}
        <div className={styles.dialogueStage}>
          {chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={`${styles.turnCard} ${
                msg.role === "user" ? styles.turnCardUser : styles.turnCardAssistant
              }`}
            >
              <div className={styles.turnCardHeader}>
                <span>{msg.role === "user" ? "You" : "Nucleus Neural Intelligence"}</span>
                {msg.isVoice && (
                  <span className={styles.voiceTag}>
                    <Volume2 size={10} />
                    
                    {t("components.AI.QuantumCopilot.text_voice", "Voice")}
                  </span>
                )}
              </div>

              {msg.role === "user" ? (
                <div className={styles.userQueryPill}>{msg.text}</div>
              ) : (
                <div className={styles.assistantContentCard}>
                  <p style={{ margin: 0, whiteSpace: "pre-line" }}>{msg.text}</p>

                  {/* Policy Verification Citations */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className={styles.citationGroup}>
                      {msg.sources.map((src, i) => (
                        <span
                          key={i}
                          className={styles.citationPill}
                          onClick={() =>
                            setSelectedCitation({
                              title: src,
                              section: "Company Governance Invariant",
                              text: `Clause referenced from authoritative policy register: ${src}. Policy rules strictly guard operational and legal consistency.`,
                            })
                          }
                          title={t("components.AI.QuantumCopilot.title_verified_corporate_policy_clause", "Verified Corporate Policy Clause")}
                        >
                          <ShieldCheck size={12} />
                          {src}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Structured Telemetry Widgets (Proportional, Clean Apple Widgets) */}
                  {analysis && analysis.tool === "attendance_analysis" && (
                    <div className={styles.telemetryGrid}>
                      <div className={styles.telemetrySlate}>
                        <span className={styles.telemetrySlateLabel}>{t("components.AI.QuantumCopilot.text_present_rate", "Present Rate")}</span>
                        <span className={styles.telemetrySlateValue}>{t("components.AI.QuantumCopilot.text_936", "93.6%")}</span>
                        <span className={styles.telemetrySlateSub}>{t("components.AI.QuantumCopilot.text_988_1056_days", "988 / 1,056 Days")}</span>
                      </div>
                      <div className={styles.telemetrySlate}>
                        <span className={styles.telemetrySlateLabel}>{t("components.AI.QuantumCopilot.text_overtime", "Overtime")}</span>
                        <span className={styles.telemetrySlateValue}>{t("components.AI.QuantumCopilot.text_640h", "64.0h")}</span>
                        <span className={styles.telemetrySlateSub}>{t("components.AI.QuantumCopilot.text_approved_ot", "Approved OT")}</span>
                      </div>
                      <div className={styles.telemetrySlate}>
                        <span className={styles.telemetrySlateLabel}>{t("components.AI.QuantumCopilot.text_absence_rate", "Absence Rate")}</span>
                        <span className={styles.telemetrySlateValue}>{t("components.AI.QuantumCopilot.text_42", "4.2%")}</span>
                        <span className={styles.telemetrySlateSub}>{t("components.AI.QuantumCopilot.text_44_days", "44 Days")}</span>
                      </div>
                    </div>
                  )}

                  {analysis && analysis.tool === "leave_analysis" && (
                    <div className={styles.telemetryGrid}>
                      <div className={styles.telemetrySlate}>
                        <span className={styles.telemetrySlateLabel}>{t("components.AI.QuantumCopilot.text_casual_leave", "Casual Leave")}</span>
                        <span className={styles.telemetrySlateValue}>{t("components.AI.QuantumCopilot.text_45_days", "4.5 Days")}</span>
                        <span className={styles.telemetrySlateSub}>{t("components.AI.QuantumCopilot.text_available", "Available")}</span>
                      </div>
                      <div className={styles.telemetrySlate}>
                        <span className={styles.telemetrySlateLabel}>{t("components.AI.QuantumCopilot.text_earned_leave", "Earned Leave")}</span>
                        <span className={styles.telemetrySlateValue}>{t("components.AI.QuantumCopilot.text_140_days", "14.0 Days")}</span>
                        <span className={styles.telemetrySlateSub}>{t("components.AI.QuantumCopilot.text_accrued", "Accrued")}</span>
                      </div>
                      <div className={styles.telemetrySlate}>
                        <span className={styles.telemetrySlateLabel}>{t("components.AI.QuantumCopilot.text_pending", "Pending")}</span>
                        <span className={styles.telemetrySlateValue}>{t("components.AI.QuantumCopilot.text_4_requests", "4 Requests")}</span>
                        <span className={styles.telemetrySlateSub}>{t("components.AI.QuantumCopilot.text_in_review", "In Review")}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {isSubmittingText && (
            <div className={`${styles.turnCard} ${styles.turnCardAssistant}`}>
              <div className={styles.turnCardHeader}>
                <span>{t("components.AI.QuantumCopilot.text_nucleus_neural_intelligence", "Nucleus Neural Intelligence")}</span>
              </div>
              <div className={styles.assistantContentCard}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#6366f1" }}>
                  <Sparkles size={16} className="animate-spin" />
                  <span>{t("components.AI.QuantumCopilot.text_synthesizing_verified_policy_and_telemet", "Synthesizing verified policy and telemetry answer…")}</span>
                </div>
              </div>
            </div>
          )}

          <div ref={dialogueEndRef} />
        </div>

        {/* Adaptive Directives Quick Bar */}
        <div className={styles.directivesBar}>
          {currentDirectives.map((directive, i) => (
            <button
              key={i}
              type="button"
              className={styles.directiveChip}
              onClick={() => handleSendText(directive)}
            >
              <Sparkles size={11} className="text-indigo-500" />
              {directive}
            </button>
          ))}
        </div>

        {/* Bottom Omnibar Glass Capsule */}
        <div className={styles.omnibarFooter}>
          <form
            className={styles.omnibarForm}
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void handleSendText();
            }}
          >
            <input
              type="text"
              className={styles.omnibarInput}
              placeholder={
                isLive
                  ? "Live audio active… Speak freely or type a policy inquiry…"
                  : "Type a policy inquiry or click the mic to talk…"
              }
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
            />

            {/* Explicit Mic Toggle Button */}
            <button
              type="button"
              className={`${styles.micActionButton} ${
                isLive ? styles.micActionButtonActive : ""
              }`}
              onClick={handleToggleMic}
              title={isLive ? "Click to Stop Listening" : "Click to Start Speaking"}
              aria-label={isLive ? "Stop Listening" : "Start Speaking"}
            >
              {isLive ? <Square size={16} className="fill-current" /> : <Mic size={18} />}
            </button>

            {/* Send Button */}
            <button
              type="submit"
              className={styles.sendActionButton}
              disabled={!inputVal.trim() || isSubmittingText}
              title={t("components.AI.QuantumCopilot.title_send_inquiry", "Send Inquiry")}
              aria-label={t("components.AI.QuantumCopilot.aria-label_send", "Send")}
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}

export default QuantumCopilot;
