"use client";
import { readData } from '../../services/workspace-data.mjs';

import React, { useState } from 'react';
import {
    HelpCircle, MessageSquare, Search, BookOpen, AlertCircle,
    Clock, CheckCircle2, ChevronRight, User, Plus, Filter,
    Send, Sparkles, ExternalLink, ShieldAlert, Tag, FileText
} from 'lucide-react';
import styles from './HelpdeskView.module.css';
import { launchAction } from '@/lib/action-launcher';

const HelpdeskView = () => {
    const [activeTab, setActiveTab] = useState(readData("components.Workspace.HelpdeskView", "initialState_1")); // 'tickets' | 'policies'
    const [selectedCategory, setSelectedCategory] = useState(readData("components.Workspace.HelpdeskView", "initialState_2"));
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [isRaiseModalOpen, setIsRaiseModalOpen] = useState(false);

    // Grounded Search Query state
    const [policyQuery, setPolicyQuery] = useState(readData("components.Workspace.HelpdeskView", "initialState_3"));
    const [groundedResult, setGroundedResult] = useState(readData("components.Workspace.HelpdeskView", "groundedResult_1"));

    const initialTickets = readData("components.Workspace.HelpdeskView", "tickets_2") || [];
    const [ticketList, setTicketList] = useState(initialTickets);
    const tickets = ticketList;
    const [replyText, setReplyText] = useState('');

    // Modal Form State
    const [modalCategory, setModalCategory] = useState('Payroll & Tax');
    const [modalPriority, setModalPriority] = useState('Medium');
    const [modalSubject, setModalSubject] = useState('');
    const [modalDescription, setModalDescription] = useState('');

    const sampleQueries = readData("components.Workspace.HelpdeskView", "sampleQueries_3");

    const handleRunQuery = (q) => {
        setPolicyQuery(q);
        if (q.includes('per-diem') || q.includes('Mumbai')) {
            setGroundedResult({
                question: q,
                ...readData("components.Workspace.HelpdeskView", "handleRunQuery_fields_4")
            });
        } else if (q.includes('notice') || q.includes('probation')) {
            setGroundedResult({
                question: q,
                ...readData("components.Workspace.HelpdeskView", "handleRunQuery_fields_6")
            });
        } else {
            setGroundedResult({
                question: q,
                ...readData("components.Workspace.HelpdeskView", "handleRunQuery_fields_8")
            });
        }
    };

    const filteredTickets = selectedCategory === 'all'
        ? ticketList
        : ticketList.filter(t => (t.category || '').toLowerCase().includes(selectedCategory.toLowerCase()));

    const isSubmittingTicket = React.useRef(false);
    const handleCreateTicket = async (e) => {
        e?.preventDefault?.();
        if (!modalSubject.trim() || !modalDescription.trim() || isSubmittingTicket.current) {
            return;
        }
        isSubmittingTicket.current = true;

        const newT = {
            id: `TCK-${Date.now().toString().slice(-4)}`,
            category: modalCategory,
            priority: modalPriority.toUpperCase(),
            subject: modalSubject.trim(),
            description: modalDescription.trim(),
            status: 'OPEN',
            slaHours: 24,
            messages: [
                {
                    sender: 'You',
                    role: 'Requester',
                    time: 'Just now',
                    text: modalDescription.trim()
                }
            ]
        };

        setTicketList(prev => [newT, ...prev]);

        try {
            await fetch('/api/v1/helpdesk/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
                body: JSON.stringify({
                    category: modalCategory,
                    priority: modalPriority,
                    subject: modalSubject.trim(),
                    description: modalDescription.trim()
                })
            });
        } catch (err) {
            console.warn('Ticket creation sync warning:', err);
        } finally {
            setTimeout(() => { isSubmittingTicket.current = false; }, 500);
        }

        setIsRaiseModalOpen(false);
        setModalSubject('');
        setModalDescription('');
    };

    const isSubmittingReply = React.useRef(false);
    const handleSendReply = async () => {
        if (!replyText.trim() || !selectedTicket || isSubmittingReply.current) return;
        isSubmittingReply.current = true;

        const newMsg = {
            sender: 'You',
            role: 'Requester',
            time: 'Just now',
            text: replyText.trim()
        };

        const updatedSelected = {
            ...selectedTicket,
            messages: [...(selectedTicket.messages || []), newMsg]
        };
        setSelectedTicket(updatedSelected);

        setTicketList(prev => prev.map(t => t.id === selectedTicket.id ? updatedSelected : t));

        try {
            await fetch(`/api/v1/helpdesk/tickets/${selectedTicket.id}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
                body: JSON.stringify({ text: replyText.trim() })
            });
        } catch (err) {
            console.warn('Reply message sync warning:', err);
        } finally {
            setTimeout(() => { isSubmittingReply.current = false; }, 500);
        }

        setReplyText('');
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div>
                    <div className={styles.badgeRow}>
                        <span className={styles.livePill}><HelpCircle size={13} />{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_10")}</span>
                        <span className={styles.groundedPill}><Sparkles size={13} />{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_11")}</span>
                    </div>
                    <h2>{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_12")}</h2>
                    <p>{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_13")}</p>
                </div>

                <div className={styles.headerActions}>
                    <button className={styles.btnPrimary} onClick={() => launchAction('ticket')}>
                        <Plus size={16} />{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_14")}</button>
                </div>
            </div>

            {/* View Tabs */}
            <div className={styles.tabsRow}>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'tickets' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('tickets')}
                >
                    <MessageSquare size={16} />{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_15")}{tickets.length}{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_16")}</button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'policies' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('policies')}
                >
                    <BookOpen size={16} />{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_17")}</button>
            </div>

            {/* TAB 1: SUPPORT TICKETS */}
            {activeTab === 'tickets' && (
                <div className={styles.ticketsSection}>
                    {/* Category Filter Pills */}
                    <div className={styles.filterPillsRow}>
                        {readData("components.Workspace.HelpdeskView", "HelpdeskView_18").map((cat) => (
                            <button
                                key={cat}
                                className={`${styles.filterPill} ${selectedCategory === cat ? styles.filterPillActive : ''}`}
                                onClick={() => setSelectedCategory(cat)}
                            >
                                {cat.toUpperCase()}
                            </button>
                        ))}
                    </div>

                    {/* Tickets Grid */}
                    <div className={styles.ticketsGrid}>
                        {filteredTickets.map((tkt) => (
                            <div
                                key={tkt.id}
                                className={styles.ticketCard}
                                onClick={() => setSelectedTicket(tkt)}
                            >
                                <div className={styles.tktTop}>
                                    <span className={styles.tktId}>{tkt.id}</span>
                                    <span className={`
                                        ${styles.priorityBadge}
                                        ${tkt.priority === 'Critical' ? styles.priCritical : ''}
                                        ${tkt.priority === 'High' ? styles.priHigh : ''}
                                        ${tkt.priority === 'Medium' ? styles.priMed : ''}
                                        ${tkt.priority === 'Low' ? styles.priLow : ''}
                                    `}>
                                        {tkt.priority}
                                    </span>
                                </div>

                                <h4 className={styles.tktTitle}>{tkt.subject}</h4>
                                <div className={styles.tktCategoryTag}>{tkt.category}</div>

                                <div className={styles.tktMeta}>
                                    <div><strong>{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_19")}</strong> {tkt.raisedBy}</div>
                                    <div><strong>{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_20")}</strong> {tkt.assignee}</div>
                                </div>

                                <div className={styles.tktBottom}>
                                    <div className={styles.slaText}>
                                        <Clock size={13} /> {tkt.slaRemaining}
                                    </div>
                                    <span className={`
                                        ${styles.statusBadge}
                                        ${tkt.status === 'Open' ? styles.stOpen : ''}
                                        ${tkt.status === 'In Progress' ? styles.stProg : ''}
                                        ${tkt.status === 'Resolved' ? styles.stResolved : ''}
                                    `}>
                                        {tkt.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Ticket Detail Drawer / Modal */}
                    {selectedTicket && (
                        <div className={styles.modalOverlay} onClick={() => setSelectedTicket(null)}>
                            <div className={styles.drawerContent} onClick={(e) => e.stopPropagation()}>
                                <div className={styles.modalHeader}>
                                    <div>
                                        <span className={styles.tktId}>{selectedTicket.id}</span>
                                        <h3>{selectedTicket.subject}</h3>
                                    </div>
                                    <button className={styles.closeBtn} onClick={() => setSelectedTicket(null)}>{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_21")}</button>
                                </div>

                                <div className={styles.drawerBody}>
                                    <div className={styles.drawerInfoGrid}>
                                        <div><strong>{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_22")}</strong> {selectedTicket.raisedBy}</div>
                                        <div><strong>{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_23")}</strong> {selectedTicket.dept}</div>
                                        <div><strong>{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_24")}</strong> {selectedTicket.category}</div>
                                        <div><strong>{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_25")}</strong> {selectedTicket.assignee}</div>
                                        <div><strong>{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_26")}</strong> {selectedTicket.slaRemaining}</div>
                                        <div><strong>{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_27")}</strong> {selectedTicket.status}</div>
                                    </div>

                                    <h4 className={styles.threadTitle}>{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_28")}</h4>
                                    <div className={styles.messagesList}>
                                        {selectedTicket.messages.map((m, idx) => (
                                            <div key={idx} className={styles.messageBubble}>
                                                <div className={styles.msgHeader}>
                                                    <strong>{m.sender}</strong>
                                                    <span>{m.time}</span>
                                                </div>
                                                <p>{m.text}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Action Reply */}
                                    <div className={styles.replyBox}>
                                        <input
                                            type="text"
                                            placeholder={readData("components.Workspace.HelpdeskView", "HelpdeskView_placeholder_29")}
                                            className={styles.replyInput}
                                            value={replyText}
                                            onChange={(e) => setReplyText(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
                                        />
                                        <button className={styles.btnPrimary} onClick={handleSendReply}>
                                            <Send size={14} />{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_30")}</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Raise Ticket Modal */}
                    {isRaiseModalOpen && (
                        <div className={styles.modalOverlay} onClick={() => setIsRaiseModalOpen(false)}>
                            <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
                                <div className={styles.modalHeader}>
                                    <h3>{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_31")}</h3>
                                    <button className={styles.closeBtn} onClick={() => setIsRaiseModalOpen(false)}>{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_32")}</button>
                                </div>
                                <form onSubmit={handleCreateTicket} className={styles.modalBody}>
                                    <div className={styles.formGroup}>
                                        <label>{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_33")}</label>
                                        <select
                                            className={styles.formSelect}
                                            value={modalCategory}
                                            onChange={(e) => setModalCategory(e.target.value)}
                                        >
                                            <option value="Payroll & Tax">{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_34")}</option>
                                            <option value="Leave & Attendance">{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_35")}</option>
                                            <option value="Hardware / IT Assets">{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_36")}</option>
                                            <option value="Benefits & Claims">{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_37")}</option>
                                            <option value="General Query">{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_38")}</option>
                                        </select>
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_39")}</label>
                                        <select
                                            className={styles.formSelect}
                                            value={modalPriority}
                                            onChange={(e) => setModalPriority(e.target.value)}
                                        >
                                            <option value="Low">{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_40")}</option>
                                            <option value="Medium">{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_41")}</option>
                                            <option value="High">{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_42")}</option>
                                            <option value="Urgent">{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_43")}</option>
                                        </select>
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_44")}</label>
                                        <input
                                            type="text"
                                            placeholder={readData("components.Workspace.HelpdeskView", "HelpdeskView_placeholder_45")}
                                            className={styles.formInput}
                                            value={modalSubject}
                                            onChange={(e) => setModalSubject(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_46")}</label>
                                        <textarea
                                            rows={4}
                                            placeholder={readData("components.Workspace.HelpdeskView", "HelpdeskView_placeholder_47")}
                                            className={styles.formTextarea}
                                            value={modalDescription}
                                            onChange={(e) => setModalDescription(e.target.value)}
                                            required
                                        ></textarea>
                                    </div>
                                    <div className={styles.modalFooter}>
                                        <button type="button" className={styles.btnSecondary} onClick={() => setIsRaiseModalOpen(false)}>{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_48")}</button>
                                        <button type="submit" className={styles.btnPrimary}>{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_49")}</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: GROUNDED POLICY ASSISTANT */}
            {activeTab === 'policies' && (
                <div className={styles.policySection}>
                    <div className={styles.searchBarWrapper}>
                        <Search size={20} color="#64748b" />
                        <input
                            type="text"
                            value={policyQuery}
                            onChange={(e) => setPolicyQuery(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleRunQuery(policyQuery); }}
                            placeholder={readData("components.Workspace.HelpdeskView", "HelpdeskView_placeholder_50")}
                            className={styles.policySearchInput}
                        />
                        <button className={styles.btnPrimary} onClick={() => handleRunQuery(policyQuery)}>
                            <Sparkles size={16} />{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_51")}</button>
                    </div>

                    {/* Quick prompts */}
                    <div className={styles.promptsRow}>
                        <span className={styles.promptLabel}>{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_52")}</span>
                        {sampleQueries.map((sq, i) => (
                            <button key={i} className={styles.promptBtn} onClick={() => handleRunQuery(sq)}>
                                {sq}
                            </button>
                        ))}
                    </div>

                    {/* Result Card */}
                    {groundedResult && (
                        <div className={styles.groundedCard}>
                            <div className={styles.groundedHeader}>
                                <div className={styles.groundedBadge}>
                                    <CheckCircle2 size={16} color="#16a34a" /> {groundedResult.confidence}
                                </div>
                                <span className={styles.strictTag}>{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_53")}</span>
                            </div>

                            <div className={styles.answerText}>
                                {groundedResult.answer}
                            </div>

                            {/* Source Citations */}
                            <div className={styles.citationsSection}>
                                <h4>{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_54")}</h4>
                                <div className={styles.citationList}>
                                    {groundedResult.citations.map((c, idx) => (
                                        <div key={idx} className={styles.citationBox}>
                                            <div className={styles.citationHead}>
                                                <strong><BookOpen size={14} /> {c.doc}</strong>
                                                <span>{c.clause}{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_55")}{c.page}</span>
                                            </div>
                                            <p className={styles.quoteText}>{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_56")}{c.text}{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_57")}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className={styles.groundedFooter}>
                                <span className={styles.feedbackText}>{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_58")}</span>
                                <div className={styles.feedbackBtns}>
                                    <button className={styles.btnThumb} disabled title={readData("components.Workspace.HelpdeskView", "unavailableAction")}>{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_59")}</button>
                                    <button className={styles.btnThumb} disabled title={readData("components.Workspace.HelpdeskView", "unavailableAction")}>{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_60")}</button>
                                    <button className={styles.btnEscalate} onClick={() => { setActiveTab('tickets'); setIsRaiseModalOpen(true); }}>{readData("components.Workspace.HelpdeskView", "HelpdeskView_text_61")}</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default HelpdeskView;
