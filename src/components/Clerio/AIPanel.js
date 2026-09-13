"use client";
import { readData } from '../../services/workspace-data.mjs';

import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, X, Bot, ArrowUpRight } from 'lucide-react';
import styles from './AIPanel.module.css';
import { askAssistant } from '@/services/assistant-service.mjs';
import { launchAction } from '@/lib/action-launcher';

const AIPanel = ({ onClose, onNavigate }) => {
    const [messages, setMessages] = useState(() => [
        {
            ...readData("components.Clerio.AIPanel", "messages_fields_1"),
            time: new Date().toLocaleTimeString([], readData("components.Clerio.AIPanel", "time_2"))
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView(readData("components.Clerio.AIPanel", "scrollToBottom_3"));
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    const handleSendText = async (textToSend) => {
        const query = textToSend || inputValue;
        if (!query.trim()) return;

        const userMsg = {
            id: crypto.randomUUID(),
            text: query,
            ...readData("components.Clerio.AIPanel", "userMsg_fields_4"),
            time: new Date().toLocaleTimeString([], readData("components.Clerio.AIPanel", "time_5"))
        };

        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsTyping(true);

        try {
            const data = await askAssistant(userMsg.text);

            setIsTyping(false);

            const botMsg = {
                id: crypto.randomUUID(),
                text: data.reply || readData("components.Clerio.AIPanel", "fallback_1"),
                ...readData("components.Clerio.AIPanel", "botMsg_fields_15"),
                time: new Date().toLocaleTimeString([], readData("components.Clerio.AIPanel", "time_16"))
            };
            setMessages(prev => [...prev, botMsg]);

            if (data.action && data.action.type === 'NAVIGATE' && onNavigate) {
                onNavigate(data.action.payload);
            }

        } catch (error) {
            setIsTyping(false);
            setMessages(prev => [...prev, {
                id: crypto.randomUUID(),
                ...readData("components.Clerio.AIPanel", "handleSendText_fields_17"),
                time: new Date().toLocaleTimeString([], readData("components.Clerio.AIPanel", "time_18"))
            }]);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendText();
        }
    };

    const suggestions = readData("components.Clerio.AIPanel", "suggestions_19");

    const [activeView, setActiveView] = useState(readData("components.Clerio.AIPanel", "initialState_1")); // 'chat' | 'ledger'
    const [ledgerActions, setLedgerActions] = useState(readData("components.Clerio.AIPanel", "ledgerActions_20"));

    const handleRevertAction = (actionId) => launchAction('actionReversal', { actionId });

    useEffect(() => {
        const applyReversal = (event) => {
            if (event.detail?.action !== 'actionReversal') return;
            const actionId = event.detail.values.actionId;
            setLedgerActions(current => current.map(action => action.id === actionId
                ? { ...action, ...readData("components.Clerio.AIPanel", "applyReversal_fields_21") }
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
                width: '420px',
                maxHeight: 'calc(100vh - 9rem)',
                zIndex: 9999,
                pointerEvents: 'auto'
            }}
            role="dialog"
            aria-label={readData("components.Clerio.AIPanel", "AIPanel_aria-label_22")}
            aria-modal="true"
        >
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.aiIconBadge}>
                        <Sparkles size={20} />
                    </div>
                    <div className={styles.titleBlock}>
                        <strong>{readData("components.Clerio.AIPanel", "AIPanel_text_23")}</strong>
                        <span>{readData("components.Clerio.AIPanel", "AIPanel_text_24")}</span>
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
                        title={readData("components.Clerio.AIPanel", "AIPanel_title_25")}
                        aria-label={readData("components.Clerio.AIPanel", "AIPanel_aria-label_26")}
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
                >{readData("components.Clerio.AIPanel", "AIPanel_text_27")}</button>
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
                >{readData("components.Clerio.AIPanel", "AIPanel_text_28")}</button>
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

                    {/* Suggestions */}
                    <div className={styles.suggestionsWrapper}>
                        <div className={styles.suggestionsTitle}>{readData("components.Clerio.AIPanel", "AIPanel_text_29")}</div>
                        <div className={styles.suggestionsList}>
                            {suggestions.map((sug, i) => (
                                <button key={i} className={styles.suggestionPill} onClick={() => handleSendText(sug)}>
                                    {sug} <ArrowUpRight size={12} />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Footer Input */}
                    <div className={styles.inputArea}>
                        <input
                            type="text"
                            placeholder={readData("components.Clerio.AIPanel", "AIPanel_placeholder_30")}
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
                /* VIEW 2: ACTION LEDGER (Blueprint Section 6.2) */
                <div style={{ flex: 1, padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.85rem', background: 'var(--paper, #EDF0EE)' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-2, #5A6B78)', background: 'var(--card, #FFFFFF)', padding: '0.75rem', borderRadius: 'var(--r-control, 5px)', border: '1px solid var(--line, #D8DEDA)' }}>
                        <strong style={{ color: 'var(--text, #10222F)' }}>{readData("components.Clerio.AIPanel", "AIPanel_text_31")}</strong>{readData("components.Clerio.AIPanel", "AIPanel_text_32")}</div>

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
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-2, #5A6B78)', marginBottom: '0.5rem' }}>{readData("components.Clerio.AIPanel", "AIPanel_text_33")}<strong>{act.agent}</strong>{readData("components.Clerio.AIPanel", "AIPanel_text_34")}{act.principal}
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
                                    >{readData("components.Clerio.AIPanel", "AIPanel_text_35")}</button>
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
