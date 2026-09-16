"use client";
import { readData } from '../../services/workspace-data.mjs';

import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, X, Bot, ArrowUpRight, Volume2 } from 'lucide-react';
import styles from './AIPanel.module.css';
import { askAssistant } from '@/app/actions/assistantActions';
import { launchAction } from '@/lib/action-launcher';
import { parseVoiceCommand, speakAloud } from '@/utils/voiceCommandEngine';

const PRELOADED_COMMANDS = [
    'Apply for Leave',
    'Punch In',
    'Punch Out',
    'Go to Attendance',
    'Open Payroll Control Room',
    'Show People Directory',
    'Switch to S1 Console',
    'Open Talent ATS',
    'Show 9-Box Performance Grid',
    'Launch Bulk Data Upload',
    'CTC Exception Approval',
    'Open AI Copilot',
    'Open Statutory Compliance',
    'Go to Platform Settings'
];

const AIPanel = ({ onClose, onNavigate, onSelectConsole, onOpenModal }) => {
    const [messages, setMessages] = useState(() => [
        {
            id: 'welcome-1',
            text: "Hello! I am your Nucleus Assistant. You can click any preloaded workflow below or type any command to execute actions instantly across the enterprise.",
            sender: 'bot',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    const handleSendText = async (textToSend) => {
        const query = (textToSend || inputValue).trim();
        if (!query) return;

        const userMsg = {
            id: crypto.randomUUID(),
            text: query,
            sender: 'user',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsTyping(true);

        // 1. Process with Voice Command Engine for Instant Action Execution
        const voiceRes = parseVoiceCommand(query);

        // 2. Execute corresponding UI/System Action
        if (voiceRes.type === 'ACTION') {
            if (voiceRes.action === 'PUNCH_IN') {
                window.dispatchEvent(new CustomEvent('nucleus:trigger_punch', { detail: { type: 'IN' } }));
            } else if (voiceRes.action === 'PUNCH_OUT') {
                window.dispatchEvent(new CustomEvent('nucleus:trigger_punch', { detail: { type: 'OUT' } }));
            } else if (voiceRes.action === 'APPLY_LEAVE') {
                if (onNavigate) onNavigate('leaves', 'core_hr');
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('nucleus:open_leave_apply'));
                }, 350);
            }
        } else if (voiceRes.type === 'CONSOLE') {
            if (onSelectConsole) onSelectConsole(voiceRes.target);
            else if (onNavigate) onNavigate('dashboard', 'dashboard', voiceRes.target);
        } else if (voiceRes.type === 'TAB' && onNavigate) {
            onNavigate(voiceRes.target, voiceRes.domain, voiceRes.sub);
        } else if (voiceRes.type === 'MODAL') {
            if (onOpenModal) onOpenModal(voiceRes.target);
            if (voiceRes.target === 'bulk_upload') window.dispatchEvent(new CustomEvent('nucleus:open_bulk_upload'));
            if (voiceRes.target === 'ctc_exception') window.dispatchEvent(new CustomEvent('nucleus:open_ctc_exception'));
        }

        // Announce speech narration confirmation
        if (voiceRes.speechText) {
            speakAloud(voiceRes.speechText);
        }

        try {
            const data = await askAssistant(query);
            setIsTyping(false);

            const botMsg = {
                id: crypto.randomUUID(),
                text: data.reply || `Executing: ${voiceRes.speechText}`,
                sender: 'bot',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setMessages(prev => [...prev, botMsg]);

            if (data.action && data.action.type === 'NAVIGATE' && onNavigate) {
                onNavigate(data.action.payload);
            }
        } catch {
            setIsTyping(false);
            setMessages(prev => [...prev, {
                id: crypto.randomUUID(),
                text: `✅ ${voiceRes.speechText || 'Action executed successfully.'}`,
                sender: 'bot',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendText();
        }
    };

    const [activeView, setActiveView] = useState('chat'); // 'chat' | 'ledger'
    const [ledgerActions, setLedgerActions] = useState(readData("components.Workspace.AIPanel", "ledgerActions_20"));

    const handleRevertAction = (actionId) => launchAction('actionReversal', { actionId });

    useEffect(() => {
        const applyReversal = (event) => {
            if (event.detail?.action !== 'actionReversal') return;
            const actionId = event.detail.values.actionId;
            setLedgerActions(current => current.map(action => action.id === actionId
                ? { ...action, ...readData("components.Workspace.AIPanel", "applyReversal_fields_21") }
                : action));
        };
        window.addEventListener('nucleus:action-completed', applyReversal);
        return () => window.removeEventListener('nucleus:action-completed', applyReversal);
    }, []);

    return (
        <div
            className={styles.floatingChatContainer}
            style={{
                position: 'fixed',
                bottom: '7.25rem',
                right: '2rem',
                width: '430px',
                maxHeight: 'calc(100vh - 9rem)',
                zIndex: 9999,
                pointerEvents: 'auto'
            }}
            role="dialog"
            aria-label="Nucleus Assistant Chat"
            aria-modal="true"
        >
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.aiIconBadge}>
                        <Sparkles size={20} />
                    </div>
                    <div className={styles.titleBlock}>
                        <strong>Nucleus Assistant</strong>
                        <span>Online • Governed Enterprise Copilot</span>
                    </div>
                </div>

                <div className={styles.headerActions}>
                    <button
                        type="button"
                        className={styles.closeBtn}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (onClose) onClose();
                        }}
                        title="Close Assistant"
                        aria-label="Close Assistant"
                    >
                        <X size={18} strokeWidth={2.5} />
                    </button>
                </div>
            </div>

            {/* Mode Switcher Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--line, #D8DEDA)', background: 'var(--card-2, #F6F8F6)' }}>
                <button
                    style={{
                        flex: 1,
                        padding: '0.6rem',
                        border: 'none',
                        background: activeView === 'chat' ? 'var(--card, #FFFFFF)' : 'transparent',
                        fontWeight: activeView === 'chat' ? '700' : '500',
                        color: activeView === 'chat' ? 'var(--signal-ink, #0A5546)' : 'var(--text-2, #5A6B78)',
                        borderBottom: activeView === 'chat' ? '2px solid var(--signal, #0F6E5C)' : '2px solid transparent',
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        fontFamily: 'inherit'
                    }}
                    onClick={() => setActiveView('chat')}
                >💬 Assistant Copilot</button>
                <button
                    style={{
                        flex: 1,
                        padding: '0.6rem',
                        border: 'none',
                        background: activeView === 'ledger' ? 'var(--card, #FFFFFF)' : 'transparent',
                        fontWeight: activeView === 'ledger' ? '700' : '500',
                        color: activeView === 'ledger' ? 'var(--signal-ink, #0A5546)' : 'var(--text-2, #5A6B78)',
                        borderBottom: activeView === 'ledger' ? '2px solid var(--signal, #0F6E5C)' : '2px solid transparent',
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        fontFamily: 'inherit'
                    }}
                    onClick={() => setActiveView('ledger')}
                >📜 Action Ledger</button>
            </div>

            {/* VIEW 1: COPILOT CHAT */}
            {activeView === 'chat' ? (
                <>
                    {/* Chat History */}
                    <div className={styles.chatHistory}>
                        {messages.map(msg => (
                            <div key={msg.id} className={`${styles.messageGroup} ${msg.sender === 'user' ? styles.user : ''}`}>
                                <div className={styles.messageContent}>
                                    {msg.text}
                                </div>
                                <span className={styles.messageTime}>{msg.time}</span>
                            </div>
                        ))}
                        {isTyping && (
                            <div className={styles.typingIndicator}>
                                <span></span><span></span><span></span>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Preloaded Action Commands */}
                    <div className={styles.suggestionsWrapper} style={{ maxHeight: '160px', overflowY: 'auto' }}>
                        <div className={styles.suggestionsTitle}>Preloaded Actions (Click to Execute)</div>
                        <div className={styles.suggestionsList}>
                            {PRELOADED_COMMANDS.map((cmd, i) => (
                                <button key={i} className={styles.suggestionPill} onClick={() => handleSendText(cmd)}>
                                    <Volume2 size={12} style={{ color: 'var(--signal, #0F6E5C)', marginRight: '2px' }} />
                                    {cmd} <ArrowUpRight size={12} />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Footer Input */}
                    <div className={styles.inputArea}>
                        <input
                            type="text"
                            placeholder="Type any command or ask Nucleus Assistant..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className={styles.chatInput}
                        />
                        <button className={styles.sendBtn} onClick={() => handleSendText()} disabled={!inputValue.trim()}>
                            <Send size={16} />
                        </button>
                    </div>
                </>
            ) : (
                /* VIEW 2: ACTION LEDGER */
                <div style={{ flex: 1, padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.85rem', background: 'var(--paper, #EDF0EE)' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-2, #5A6B78)', background: 'var(--card, #FFFFFF)', padding: '0.75rem', borderRadius: 'var(--r-control, 5px)', border: '1px solid var(--line, #D8DEDA)' }}>
                        <strong style={{ color: 'var(--text, #10222F)' }}>🛡️ Section 6.2 Action Ledger: </strong>
                        Append-only, queryable ledger recording autonomous agent actions with pre-execution diffs and human authorization handles.
                    </div>

                    {ledgerActions.map((act) => (
                        <div key={act.id} style={{ background: 'var(--card, #FFFFFF)', border: '1px solid var(--line, #D8DEDA)', borderRadius: 'var(--r-card, 7px)', padding: '0.85rem', boxShadow: 'var(--shadow-raise, 0 1px 2px rgba(16,34,47,.06))' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                <span style={{ fontFamily: 'var(--f-num, monospace)', fontSize: '0.72rem', background: 'var(--card-2, #F6F8F6)', padding: '0.15rem 0.45rem', borderRadius: 'var(--r-data, 3px)', border: '1px solid var(--line, #D8DEDA)', fontWeight: '700', color: 'var(--text-2, #5A6B78)' }}>
                                    {act.id}
                                </span>
                                <span style={{
                                    fontSize: '0.72rem',
                                    fontWeight: '700',
                                    color: act.status.includes('Reversed') ? 'var(--flag, #A8341F)' : 'var(--signal-ink, #0A5546)',
                                    background: act.status.includes('Reversed') ? 'var(--flag-wash, #F8E9E5)' : 'var(--signal-wash, #E4F0EC)',
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: 'var(--r-pill, 100px)'
                                }}>
                                    {act.status}
                                </span>
                            </div>

                            <div style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text, #10222F)', marginBottom: '0.2rem' }}>
                                {act.action}
                            </div>
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-2, #5A6B78)', marginBottom: '0.5rem' }}>
                                Agent: <strong>{act.agent}</strong> · Auth: {act.principal}
                            </div>

                            <div style={{ background: 'var(--card-2, #F6F8F6)', border: '1px solid var(--line, #D8DEDA)', borderRadius: 'var(--r-control, 5px)', padding: '0.5rem 0.75rem', fontSize: '0.76rem', fontFamily: 'var(--f-num, monospace)', color: 'var(--text, #10222F)', marginBottom: '0.65rem' }}>
                                {act.diff}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.72rem', color: 'var(--slate-2, #8395A1)', fontFamily: 'var(--f-num, monospace)' }}>{act.time}</span>
                                {act.reversible && (
                                    <button
                                        style={{
                                            padding: '0.25rem 0.65rem',
                                            background: 'var(--flag-wash, #F8E9E5)',
                                            color: 'var(--flag, #A8341F)',
                                            border: '1px solid rgba(168, 52, 31, 0.25)',
                                            borderRadius: 'var(--r-control, 5px)',
                                            fontSize: '0.72rem',
                                            fontWeight: '700',
                                            cursor: 'pointer'
                                        }}
                                        onClick={() => handleRevertAction(act.id)}
                                    >↺ 1-Click Revert</button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AIPanel;
