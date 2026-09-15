"use client";
import {useTranslation} from '@/context/I18nContext';

import { readData } from '../../services/workspace-data.mjs';

import React, { useState } from 'react';
import {
    Briefcase, Sparkles, UserPlus, FileCheck, CheckCircle2,
    Shield, Filter, Plus, MessageCircle, ExternalLink, ChevronRight, Search,
    Building2, Users, AlertTriangle, CheckSquare, Award, ArrowUpRight, Lock, DollarSign, UploadCloud
} from 'lucide-react';
import styles from './RecruitmentView.module.css';
import { useHRMS } from '@/context/HRMSContext';

const RecruitmentView = ({ onNavigate, onSelectConsole }) => {
    const {t: translateText}=useTranslation();

    const {
        candidates, moveCandidate, showToast,
        positions, createJobRequisition, sanctionedQuotas,
        employeeReferrals, submitEmployeeReferral, employees,
        calculateDepartmentCapacity, establishmentRulesetVersion
    } = useHRMS();

    const [activeTab, setActiveTab] = useState(readData("components.Clerio.RecruitmentView", "initialState_1")); // pipeline, establishment, referrals, interviews, bias

    // Requisition Modal State
    const [isReqModalOpen, setIsReqModalOpen] = useState(false);
    const [reqTitle, setReqTitle] = useState('');
    const [reqDept, setReqDept] = useState(readData("components.Clerio.RecruitmentView", "initialState_2"));
    const [reqType, setReqType] = useState(readData("components.Clerio.RecruitmentView", "initialState_3")); // NEW_ADDITION or REPLACEMENT
    const [vacatedCode, setVacatedCode] = useState(readData("components.Clerio.RecruitmentView", "initialState_4"));
    const [prevIncumbent, setPrevIncumbent] = useState(readData("components.Clerio.RecruitmentView", "initialState_5"));
    const [reqBudget, setReqBudget] = useState(readData("components.Clerio.RecruitmentView", "initialState_6"));
    const [isExecWaiver, setIsExecWaiver] = useState(false);
    const [waiverReason, setWaiverReason] = useState('');

    // Referral Modal State
    const [isRefModalOpen, setIsRefModalOpen] = useState(false);
    const [refCandidateName, setRefCandidateName] = useState('');
    const [refRole, setRefRole] = useState(readData("components.Clerio.RecruitmentView", "initialState_7"));
    const [refDept, setRefDept] = useState(readData("components.Clerio.RecruitmentView", "initialState_8"));

    const stages = readData("components.Clerio.RecruitmentView", "stages_1");

    const departmentsList = Object.keys(sanctionedQuotas || readData("components.Clerio.RecruitmentView", "departmentsList_2"));

    // Handle create requisition
    const handleRequisitionSubmit = async (e) => {
        e.preventDefault();
        const errors = [];
        if (!reqTitle.trim() || reqTitle.trim().length < 3)
            errors.push('Job Title is required (minimum 3 characters)');
        if (!reqDept)
            errors.push('Department is required');
        if (!reqType)
            errors.push('Requisition Type (New / Replacement) is required');
        if (reqType === 'REPLACEMENT' && !vacatedCode.trim())
            errors.push('Vacated Position Code is required for Replacement requisitions');
        if (reqType === 'REPLACEMENT' && !prevIncumbent.trim())
            errors.push('Previous Incumbent Employee ID is required for Replacement requisitions');
        if (isExecWaiver && (!waiverReason.trim() || waiverReason.trim().length < 10))
            errors.push('Waiver justification must be at least 10 characters');
        const budgetNum = Number(reqBudget);
        if (!reqBudget || !Number.isFinite(budgetNum) || budgetNum <= 0)
            errors.push('Annual CTC Budget must be a positive number');

        if (errors.length > 0) {
            showToast('Validation Error', errors[0], 'error');
            return;
        }

        // Duplicate check — same title + dept within existing positions
        if (positions && positions.some(p =>
            p.title?.toLowerCase() === reqTitle.trim().toLowerCase() &&
            p.dept?.toLowerCase() === reqDept.toLowerCase()
        )) {
            showToast('Duplicate Entry', `A requisition for "${reqTitle}" in ${reqDept} already exists.`, 'error');
            return;
        }

        const res = await createJobRequisition({
            title: reqTitle,
            dept: reqDept,
            requisitionType: reqType,
            vacatedPositionCode: reqType === 'REPLACEMENT' ? vacatedCode : null,
            previousIncumbentId: reqType === 'REPLACEMENT' ? prevIncumbent : null,
            budget: budgetNum,
            isExecutiveWaiver: isExecWaiver,
            waiverReason: isExecWaiver ? waiverReason : null
        });

        if (res.success) {
            setIsReqModalOpen(false);
            setReqTitle('');
            setIsExecWaiver(false);
            setWaiverReason('');
        }
    };

    // Handle referral submit
    const handleReferralSubmit = async (e) => {
        e.preventDefault();
        const errors = [];
        if (!refCandidateName.trim() || refCandidateName.trim().length < 2)
            errors.push('Candidate name is required (minimum 2 characters)');
        if (!refRole)
            errors.push('Role / Position is required');
        if (!refDept)
            errors.push('Department is required');

        if (errors.length > 0) {
            showToast('Validation Error', errors[0], 'error');
            return;
        }

        // Duplicate check — same candidate + role
        if (employeeReferrals && employeeReferrals.some(r =>
            r.candidateName?.toLowerCase() === refCandidateName.trim().toLowerCase() &&
            r.role?.toLowerCase() === refRole.toLowerCase()
        )) {
            showToast('Duplicate Entry', `${refCandidateName} has already been referred for the ${refRole} role.`, 'error');
            return;
        }

        await submitEmployeeReferral({
            candidateName: refCandidateName,
            role: refRole,
            dept: refDept
        });
        setIsRefModalOpen(false);
        setRefCandidateName('');
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.headerRow}>
                <div className={styles.titleBlock}>
                    <h2>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_3")}</h2>
                    <p>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_4")}{establishmentRulesetVersion}{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_5")}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {(onNavigate || onSelectConsole) && (
                        <button
                            className={styles.btnSecondary}
                            onClick={() => {
                                if (onSelectConsole) onSelectConsole('S4');
                                if (onNavigate) onNavigate('dashboard', 'dashboard', 's4');
                            }}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.45rem',
                                border: '1px solid rgba(79, 182, 245, 0.4)',
                                background: 'rgba(79, 182, 245, 0.12)',
                                color: '#4FB6F5',
                                fontWeight: 700
                            }}
                            title={readData("components.Clerio.RecruitmentView", "RecruitmentView_title_6")}
                        >
                            <Sparkles size={15} />{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_7")}</button>
                    )}
                    <button
                        className={styles.btnSecondary}
                        onClick={() => {
                            if (typeof window !== 'undefined') {
                                window.dispatchEvent(new CustomEvent('nucleus:open_bulk_upload'));
                            }
                        }}
                        title="Upload ATS Candidate Resumes & CSV Profiles in Bulk"
                    >
                        <UploadCloud size={15} /> Bulk ATS Import
                    </button>
                    <button
                        className={styles.btnSecondary}
                        onClick={() => {
                            if (typeof window !== 'undefined') {
                                window.dispatchEvent(new CustomEvent('nucleus:open_ctc_exception', {
                                    detail: {
                                        candidateName: 'Vikram Malhotra',
                                        jobRole: 'Lead Distributed Systems Architect',
                                        department: 'Engineering',
                                        budgetedCtc: 3800000,
                                        requestedCtc: 4600000,
                                        variancePercent: 21.05
                                    }
                                }));
                            }
                        }}
                        style={{ border: '1px solid rgba(245, 158, 11, 0.4)', color: '#d97706' }}
                        title="Raise or Review Talent CTC Exception for Out-of-Budget Candidates"
                    >
                        <DollarSign size={15} /> CTC Exception Workflow
                    </button>
                    <button className={styles.btnSecondary} onClick={() => setIsRefModalOpen(true)}>
                        <UserPlus size={16} />{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_8")}</button>
                    <button className={styles.btnPrimary} onClick={() => setIsReqModalOpen(true)}>
                        <Plus size={16} />{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_9")}</button>
                </div>
            </div>

            {/* Metrics */}
            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'var(--info-wash)', color: 'var(--info)' }}>
                        <Briefcase size={22} />
                    </div>
                    <div>
                        <div className={styles.statValue}>{positions ? positions.length : readData("components.Clerio.RecruitmentView", "display_9")}</div>
                        <div className={styles.statLabel}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_10")}</div>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'var(--signal-wash)', color: 'var(--signal)' }}>
                        <Building2 size={22} />
                    </div>
                    <div>
                        <div className={styles.statValue}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_11")}</div>
                        <div className={styles.statLabel}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_12")}</div>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'var(--pending-wash)', color: 'var(--pending)' }}>
                        <UserPlus size={22} />
                    </div>
                    <div>
                        <div className={styles.statValue}>{employeeReferrals ? employeeReferrals.length : readData("components.Clerio.RecruitmentView", "display_10")}{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_13")}</div>
                        <div className={styles.statLabel}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_14")}</div>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'var(--agent-wash)', color: 'var(--agent)' }}>
                        <Shield size={22} />
                    </div>
                    <div>
                        <div className={styles.statValue}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_15")}</div>
                        <div className={styles.statLabel}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_16")}</div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className={styles.tabNav}>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'pipeline' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('pipeline')}
                >
                    <Briefcase size={16} />{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_17")}{candidates.length}{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_18")}</button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'establishment' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('establishment')}
                >
                    <Building2 size={16} />{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_19")}<span className={`${styles.badge} ${styles.badgeSuccess}`}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_20")}</span>
                </button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'referrals' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('referrals')}
                >
                    <Award size={16} />{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_21")}<span className={`${styles.badge} ${styles.badgePurple}`}>{employeeReferrals.length}{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_22")}</span>
                </button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'interviews' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('interviews')}
                >
                    <FileCheck size={16} />{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_23")}</button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'bias' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('bias')}
                >
                    <Shield size={16} />{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_24")}</button>
            </div>

            {/* ========================================================================= */}
            {/* TAB 1: PIPELINE KANBAN                                                    */}
            {/* ========================================================================= */}
            {activeTab === 'pipeline' && (
                <div className={styles.pipelineGrid}>
                    {stages.map((stage) => {
                        const stageCandidates = candidates.filter(c => c.stage === stage.key);
                        return (
                            <div key={stage.key} className={styles.column}>
                                <div className={styles.colHeader}>
                                    <span className={styles.colTitle}>{stage.label}</span>
                                    <span className={styles.countBadge}>{stageCandidates.length}</span>
                                </div>

                                {stageCandidates.map((cand) => (
                                    <div key={cand.id} className={styles.candidateCard}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ color: 'var(--text)', fontSize: '0.95rem' }}>{cand.name}</strong>
                                            <span className={styles.matchScoreBadge}>
                                                <Sparkles size={12} /> {cand.matchScore}{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_25")}</span>
                                        </div>
                                        <div style={{ fontSize: '0.82rem', color: 'var(--info)', fontWeight: '600' }}>{cand.role}</div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_26")}{cand.exp}{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_27")}{cand.biasScore}</div>

                                        <div className={styles.skillTags}>
                                            {cand.skills.map((s, i) => (
                                                <span key={i} className={styles.skillTag}>{s}</span>
                                            ))}
                                        </div>

                                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                            {stage.key !== 'offer' && (
                                                <button
                                                    className={styles.btnPrimary}
                                                    style={{ width: '100%', padding: '0.4rem', fontSize: '0.78rem', justifyContent: 'center' }}
                                                    onClick={() => {
                                                        const nextIdx = stages.findIndex(s => s.key === stage.key) + 1;
                                                        if (nextIdx < stages.length) moveCandidate(cand.id, stages[nextIdx].key);
                                                    }}
                                                >{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_28")}</button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 2: APPROVED MANPOWER & ESTABLISHMENT CEILINGS (POINTS 24 & 25)        */}
            {/* ========================================================================= */}
            {activeTab === 'establishment' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Policy Banner */}
                    <div className={styles.card} style={{ borderLeft: '4px solid #05CD99' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Building2 size={20} color="#05CD99" />{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_29")}</h3>
                                <p style={{ margin: '0.35rem 0 0', fontSize: '0.86rem', color: 'var(--text-2)', maxWidth: '750px' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_30")}<strong>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_31")}</strong>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_32")}<strong>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_33")}</strong>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_34")}</p>
                            </div>
                            <button className={styles.btnPrimary} onClick={() => setIsReqModalOpen(true)}>
                                <Plus size={15} />{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_35")}</button>
                        </div>
                    </div>

                    {/* Department Quota Capacity Grid */}
                    <div className={styles.establishmentGrid}>
                        {departmentsList.map(dept => {
                            const cap = calculateDepartmentCapacity(dept, employees, positions, sanctionedQuotas);
                            const fillPercent = Math.min(100, cap.utilizationRate);
                            return (
                                <div key={dept} className={styles.deptCapacityCard}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <strong style={{ fontSize: '0.95rem', color: 'var(--text)', display: 'block' }}>{dept}</strong>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_36")}{cap.quotaInfo.budgetCode}</span>
                                        </div>
                                        <span className={`${styles.badge} ${cap.isAtCapacity ? styles.badgeDanger : fillPercent > 75 ? styles.badgeWarning : styles.badgeSuccess}`}>
                                            {cap.isAtCapacity ? readData("components.Clerio.RecruitmentView", "display_11") :translateText("components.Clerio.RecruitmentView","text_ac513560df", {value1: String(cap.availableVacancies)})}
                                        </span>
                                    </div>

                                    <div className={styles.capacityBarContainer}>
                                        <div
                                            className={styles.capacityBarFill}
                                            style={{
                                                width: `${fillPercent}%`,
                                                background: cap.isAtCapacity ? '#ef4444' : fillPercent > 75 ? '#f59e0b' : '#05CD99'
                                            }}
                                        />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', textAlign: 'center', fontSize: '0.78rem', paddingTop: '0.4rem', borderTop: '1px solid var(--line-soft, #eee)' }}>
                                        <div>
                                            <span style={{ color: 'var(--text-2)', display: 'block' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_37")}</span>
                                            <strong style={{ fontFamily: 'var(--f-num, monospace)', color: 'var(--text)' }}>{cap.sanctioned}</strong>
                                        </div>
                                        <div>
                                            <span style={{ color: 'var(--text-2)', display: 'block' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_38")}</span>
                                            <strong style={{ fontFamily: 'var(--f-num, monospace)', color: 'var(--signal)' }}>{cap.currentHeadcount}</strong>
                                        </div>
                                        <div>
                                            <span style={{ color: 'var(--text-2)', display: 'block' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_39")}</span>
                                            <strong style={{ fontFamily: 'var(--f-num, monospace)', color: '#3b82f6' }}>{cap.activeOpenReqs}</strong>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Positions Directory with Replacement Code Tracking */}
                    <div className={styles.card}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text)' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_40")}</h3>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_41")}{positions.length}</span>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                                <thead>
                                    <tr style={{ background: 'var(--card-2, #fafafa)', textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
                                        <th style={{ padding: '0.65rem 0.85rem', color: 'var(--text-2)' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_42")}</th>
                                        <th style={{ padding: '0.65rem 0.85rem', color: 'var(--text-2)' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_43")}</th>
                                        <th style={{ padding: '0.65rem 0.85rem', color: 'var(--text-2)' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_44")}</th>
                                        <th style={{ padding: '0.65rem 0.85rem', color: 'var(--text-2)' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_45")}</th>
                                        <th style={{ padding: '0.65rem 0.85rem', color: 'var(--text-2)' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_46")}</th>
                                        <th style={{ padding: '0.65rem 0.85rem', color: 'var(--text-2)' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_47")}</th>
                                        <th style={{ padding: '0.65rem 0.85rem', color: 'var(--text-2)' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_48")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {positions.map(pos => (
                                        <tr key={pos.id} style={{ borderBottom: '1px solid var(--line-soft, #eee)' }}>
                                            <td style={{ padding: '0.65rem 0.85rem', fontFamily: 'var(--f-num, monospace)', fontWeight: 700 }}>
                                                {pos.id}
                                            </td>
                                            <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: 'var(--text)' }}>
                                                {pos.title}
                                            </td>
                                            <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-2)' }}>
                                                {pos.dept}
                                            </td>
                                            <td style={{ padding: '0.65rem 0.85rem' }}>
                                                <span className={`${styles.badge} ${pos.requisitionType === 'REPLACEMENT' ? styles.badgePurple : styles.badgeInfo}`}>
                                                    {pos.requisitionType === 'REPLACEMENT' ? readData("components.Clerio.RecruitmentView", "display_12") : readData("components.Clerio.RecruitmentView", "display_13")}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.65rem 0.85rem' }}>
                                                {pos.vacatedPositionCode ? (
                                                    <div>
                                                        <strong style={{ fontFamily: 'var(--f-num, monospace)', fontSize: '0.78rem' }}>{pos.vacatedPositionCode}</strong>
                                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-2)' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_49")}{pos.previousIncumbentId || readData("components.Clerio.RecruitmentView", "fallback_1")}</div>
                                                    </div>
                                                ) : (
                                                    <span style={{ color: 'var(--text-3)', fontSize: '0.75rem' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_50")}</span>
                                                )}
                                            </td>
                                            <td style={{ padding: '0.65rem 0.85rem', fontFamily: 'var(--f-num, monospace)' }}>
                                                {pos.budget}
                                            </td>
                                            <td style={{ padding: '0.65rem 0.85rem' }}>
                                                <span className={`${styles.badge} ${pos.status === 'Filled' ? styles.badgeSuccess : styles.badgeWarning}`}>
                                                    {pos.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 3: EMPLOYEE REFERRAL PORTAL & BONUS LEDGER (POINT 19)                 */}
            {/* ========================================================================= */}
            {activeTab === 'referrals' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className={styles.card} style={{ borderLeft: '4px solid #8b5cf6' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Award size={20} color="#8b5cf6" />{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_51")}</h3>
                                <p style={{ margin: '0.35rem 0 0', fontSize: '0.86rem', color: 'var(--text-2)', maxWidth: '750px' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_52")}<strong>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_53")}</strong>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_54")}<strong>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_55")}</strong>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_56")}<strong>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_57")}</strong>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_58")}</p>
                            </div>
                            <button className={styles.btnPrimary} onClick={() => setIsRefModalOpen(true)}>
                                <UserPlus size={15} />{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_59")}</button>
                        </div>
                    </div>

                    <div className={styles.card}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text)' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_60")}</h3>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_61")}{employeeReferrals.length}</span>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                                <thead>
                                    <tr style={{ background: 'var(--card-2, #fafafa)', textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
                                        <th style={{ padding: '0.65rem 0.85rem', color: 'var(--text-2)' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_62")}</th>
                                        <th style={{ padding: '0.65rem 0.85rem', color: 'var(--text-2)' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_63")}</th>
                                        <th style={{ padding: '0.65rem 0.85rem', color: 'var(--text-2)' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_64")}</th>
                                        <th style={{ padding: '0.65rem 0.85rem', color: 'var(--text-2)' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_65")}</th>
                                        <th style={{ padding: '0.65rem 0.85rem', color: 'var(--text-2)' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_66")}</th>
                                        <th style={{ padding: '0.65rem 0.85rem', color: 'var(--text-2)' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_67")}</th>
                                        <th style={{ padding: '0.65rem 0.85rem', color: 'var(--text-2)' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_68")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {employeeReferrals.map(ref => (
                                        <tr key={ref.id} style={{ borderBottom: '1px solid var(--line-soft, #eee)' }}>
                                            <td style={{ padding: '0.65rem 0.85rem', fontFamily: 'var(--f-num, monospace)', fontWeight: 700 }}>
                                                {ref.id}
                                            </td>
                                            <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: 'var(--text)' }}>
                                                {ref.candidateName}
                                            </td>
                                            <td style={{ padding: '0.65rem 0.85rem' }}>
                                                <div style={{ fontWeight: 600, color: 'var(--info)' }}>{ref.role}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{ref.dept}</div>
                                            </td>
                                            <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text)' }}>
                                                {ref.referredByName}
                                            </td>
                                            <td style={{ padding: '0.65rem 0.85rem' }}>
                                                <span className={`${styles.badge} ${ref.status === 'JOINED' ? styles.badgeSuccess : ref.status === 'OFFERED' ? styles.badgeInfo : styles.badgeWarning}`}>
                                                    {ref.status}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.65rem 0.85rem', fontFamily: 'var(--f-num, monospace)', fontWeight: 700, color: 'var(--signal)' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_69")}{ref.disbursedAmount.toLocaleString()}{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_70")}{ref.totalBonusEligible.toLocaleString()}
                                            </td>
                                            <td style={{ padding: '0.65rem 0.85rem', fontSize: '0.78rem', color: 'var(--text-2)' }}>
                                                {ref.nextPayoutMilestone}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 4: STRUCTURED INTERVIEW ENGINE                                        */}
            {/* ========================================================================= */}
            {activeTab === 'interviews' && (
                <div className={styles.card}>
                    <h3 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text)' }}>
                        <FileCheck size={20} color="var(--info)" />{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_71")}</h3>
                    <p style={{ color: 'var(--text-2)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_72")}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ background: 'var(--card-2)', padding: '1.25rem', borderRadius: 'var(--r-card)', border: '1px solid var(--line)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <strong style={{ color: 'var(--text)' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_73")}</strong>
                                <span style={{ color: 'var(--info)', fontWeight: '600', fontSize: '0.85rem' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_74")}</span>
                            </div>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-2)', margin: '0 0 0.5rem' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_75")}</p>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className={styles.btnSecondary} style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_76")}</button>
                                <button className={styles.btnSecondary} style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_77")}</button>
                                <button className={styles.btnPrimary} style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_78")}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 5: BIAS DETECTION & DEI                                               */}
            {/* ========================================================================= */}
            {activeTab === 'bias' && (
                <div className={styles.card}>
                    <h3 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text)' }}>
                        <Shield size={20} color="var(--signal)" />{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_79")}</h3>
                    <p style={{ color: 'var(--text-2)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_80")}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                        <div style={{ padding: '1.25rem', background: 'var(--signal-wash)', borderRadius: 'var(--r-card)', border: '1px solid var(--signal)' }}>
                            <div style={{ fontSize: '0.82rem', color: 'var(--signal-ink)', fontWeight: '600' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_81")}</div>
                            <div style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--signal)', margin: '0.25rem 0', fontFamily: 'var(--f-num)' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_82")}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--signal-ink)' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_83")}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* CREATE JOB REQUISITION MODAL (POINTS 24 & 25)                              */}
            {/* ========================================================================= */}
            {isReqModalOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsReqModalOpen(false)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text)' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_84")}</h3>
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_85")}</span>
                            </div>
                            <button
                                style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-2)' }}
                                onClick={() => setIsReqModalOpen(false)}
                            >{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_86")}</button>
                        </div>

                        <form onSubmit={handleRequisitionSubmit} className={styles.modalBody}>
                            <div className={styles.formGroup}>
                                <label>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_87")}</label>
                                <input
                                    type="text"
                                    value={reqTitle}
                                    onChange={(e) => setReqTitle(e.target.value)}
                                    placeholder={readData("components.Clerio.RecruitmentView", "RecruitmentView_placeholder_88")}
                                    className={styles.formInput}
                                    required
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className={styles.formGroup}>
                                    <label>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_89")}</label>
                                    <select
                                        value={reqDept}
                                        onChange={(e) => setReqDept(e.target.value)}
                                        className={styles.formInput}
                                    >
                                        {departmentsList.map(d => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_90")}</label>
                                    <input
                                        type="text"
                                        value={reqBudget}
                                        onChange={(e) => setReqBudget(e.target.value)}
                                        className={styles.formInput}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Requisition Type (Point 24) */}
                            <div className={styles.formGroup}>
                                <label>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_91")}</label>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.84rem', cursor: 'pointer' }}>
                                        <input
                                            type="radio"
                                            name="reqType"
                                            value="NEW_ADDITION"
                                            checked={reqType === 'NEW_ADDITION'}
                                            onChange={() => setReqType('NEW_ADDITION')}
                                        />{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_92")}</label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.84rem', cursor: 'pointer' }}>
                                        <input
                                            type="radio"
                                            name="reqType"
                                            value="REPLACEMENT"
                                            checked={reqType === 'REPLACEMENT'}
                                            onChange={() => setReqType('REPLACEMENT')}
                                        />{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_93")}</label>
                                </div>
                            </div>

                            {/* Replacement Details */}
                            {reqType === 'REPLACEMENT' ? (
                                <div style={{ background: 'var(--card-2, #fafafa)', padding: '0.85rem', borderRadius: 6, border: '1px solid var(--line)' }}>
                                    <strong style={{ fontSize: '0.82rem', color: 'var(--text)', display: 'block', marginBottom: '0.5rem' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_94")}</strong>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                        <div className={styles.formGroup}>
                                            <label>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_95")}</label>
                                            <input
                                                type="text"
                                                value={vacatedCode}
                                                onChange={(e) => setVacatedCode(e.target.value)}
                                                className={styles.formInput}
                                                placeholder={readData("components.Clerio.RecruitmentView", "RecruitmentView_placeholder_96")}
                                                required={reqType === 'REPLACEMENT'}
                                            />
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_97")}</label>
                                            <select
                                                value={prevIncumbent}
                                                onChange={(e) => setPrevIncumbent(e.target.value)}
                                                className={styles.formInput}
                                            >
                                                {employees.map(e => (
                                                    <option key={e.id} value={e.id}>{e.name}{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_98")}{e.id}{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_99")}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-2)', marginTop: '0.4rem' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_100")}</div>
                                </div>
                            ) : (
                                /* Quota check feedback for New Addition */
                                <div>
                                    {(() => {
                                        const cap = calculateDepartmentCapacity(reqDept, employees, positions, sanctionedQuotas);
                                        return cap.isAtCapacity ? (
                                            <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.08)', borderRadius: 6, border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--flag)', fontWeight: 600, fontSize: '0.84rem' }}>
                                                    <AlertTriangle size={16} />{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_101")}{reqDept}{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_102")}{cap.totalCommitted}{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_103")}{cap.sanctioned}{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_104")}</div>
                                                <div style={{ fontSize: '0.78rem', color: 'var(--text-2)', marginTop: '0.3rem' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_105")}</div>
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: '0.78rem', color: 'var(--signal)', fontWeight: 600 }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_106")}{reqDept}{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_107")}{cap.availableVacancies}{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_108")}{cap.totalCommitted}{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_109")}{cap.sanctioned}{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_110")}</div>
                                        );
                                    })()}
                                </div>
                            )}

                            {/* Executive Waiver for Over-Capacity Additions */}
                            <div style={{ padding: '0.75rem', background: 'rgba(245, 158, 11, 0.08)', borderRadius: 6, border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text)' }}>
                                    <input
                                        type="checkbox"
                                        checked={isExecWaiver}
                                        onChange={(e) => setIsExecWaiver(e.target.checked)}
                                    />{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_111")}</label>
                                {isExecWaiver && (
                                    <div style={{ marginTop: '0.5rem' }}>
                                        <input
                                            type="text"
                                            value={waiverReason}
                                            onChange={(e) => setWaiverReason(e.target.value)}
                                            placeholder={readData("components.Clerio.RecruitmentView", "RecruitmentView_placeholder_112")}
                                            className={styles.formInput}
                                            required={isExecWaiver}
                                        />
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                                <button
                                    type="button"
                                    className={styles.btnSecondary}
                                    onClick={() => setIsReqModalOpen(false)}
                                >{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_113")}</button>
                                <button
                                    type="submit"
                                    className={styles.btnPrimary}
                                >{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_114")}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* REFER CANDIDATE MODAL (POINT 19)                                          */}
            {/* ========================================================================= */}
            {isRefModalOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsRefModalOpen(false)}>
                    <div className={styles.modalContent} style={{ width: '520px' }} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text)' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_115")}</h3>
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_116")}</span>
                            </div>
                            <button
                                style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-2)' }}
                                onClick={() => setIsRefModalOpen(false)}
                            >{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_117")}</button>
                        </div>

                        <form onSubmit={handleReferralSubmit} className={styles.modalBody}>
                            <div className={styles.formGroup}>
                                <label>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_118")}</label>
                                <input
                                    type="text"
                                    value={refCandidateName}
                                    onChange={(e) => setRefCandidateName(e.target.value)}
                                    placeholder={readData("components.Clerio.RecruitmentView", "RecruitmentView_placeholder_119")}
                                    className={styles.formInput}
                                    required
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_120")}</label>
                                <input
                                    type="text"
                                    value={refRole}
                                    onChange={(e) => setRefRole(e.target.value)}
                                    className={styles.formInput}
                                    required
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_121")}</label>
                                <select
                                    value={refDept}
                                    onChange={(e) => setRefDept(e.target.value)}
                                    className={styles.formInput}
                                >
                                    {departmentsList.map(d => (
                                        <option key={d} value={d}>{d}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ padding: '0.75rem', background: 'var(--card-2, #fafafa)', borderRadius: 6, border: '1px solid var(--line)', fontSize: '0.78rem', color: 'var(--text-2)' }}>
                                <strong>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_122")}</strong>{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_123")}</div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                                <button
                                    type="button"
                                    className={styles.btnSecondary}
                                    onClick={() => setIsRefModalOpen(false)}
                                >{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_124")}</button>
                                <button
                                    type="submit"
                                    className={styles.btnPrimary}
                                >{readData("components.Clerio.RecruitmentView", "RecruitmentView_text_125")}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RecruitmentView;
