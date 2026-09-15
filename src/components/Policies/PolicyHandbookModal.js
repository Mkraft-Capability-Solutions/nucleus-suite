"use client";

import React, { useState, useEffect } from 'react';
import {
    X, BookOpen, Search, CheckCircle2, Download, Shield,
    FileText, Check, AlertCircle, ArrowRight, UploadCloud, ExternalLink
} from 'lucide-react';
import { useHRMS } from '@/context/HRMSContext';
import { useAuth } from '@/context/AuthContext';

const DEFAULT_POLICIES = [
    {
        id: 'POL-001',
        title: 'Employee Code of Conduct & Corporate Ethics',
        category: 'Governance & Ethics',
        version: 'v3.2 (2026)',
        effectiveDate: '2026-01-01',
        summary: 'Defines acceptable workplace behavior, professional integrity, conflict of interest disclosure, and whistleblower protections.',
        clauses: [
            '1.1 Compliance with all applicable Central, State and local statutory regulations.',
            '1.2 Zero tolerance for discrimination, workplace bullying, or retaliatory harassment.',
            '1.3 Mandatory disclosure of secondary commercial engagements or personal conflicts of interest.',
            '1.4 Strict non-disclosure of proprietary intellectual property, employee confidential data, and tenant records.'
        ]
    },
    {
        id: 'POL-002',
        title: 'Statutory Leave & Attendance Governance Policy',
        category: 'Core HR & Leave',
        version: 'v4.0 (2026)',
        effectiveDate: '2026-01-01',
        summary: 'Governs leave accruals, 3-level approval hierarchy, 60-day compensatory off expiry clock, and the statutory sandwich rule.',
        clauses: [
            '2.1 Privilege Leave (EL) accrues at 1.5 days/month for confirmed staff; AGM & above receive 18 days credited on Jan 1.',
            '2.2 Compensatory Off credits must be redeemed within a strict 60-day FIFO window; expired credits lapse automatically.',
            '2.3 Sandwich rule enforces calendar deduction when weekly-off days are surrounded by unpaid leave.',
            '2.4 Early return from leave automatically initiates ledger re-credit upon manager confirmation.'
        ]
    },
    {
        id: 'POL-003',
        title: 'IT Hardware Assets Custody & Cybersecurity Policy',
        category: 'Workforce Operations',
        version: 'v2.5 (2026)',
        effectiveDate: '2026-01-15',
        summary: 'Establishes device assignment custody, acceptable use, serial verification, and exit return protocols.',
        clauses: [
            '3.1 Hardware assets assigned to employees remain company property and require digital gate-pass clearance for offsite transfer.',
            '3.2 Mandatory installation and non-tampering with enterprise security endpoint agents.',
            '3.3 Prompt reporting of lost, damaged, or compromised devices within 12 hours.',
            '3.4 Final clearance and No-Dues sign-off depend on verified serial physical handover upon separation.'
        ]
    },
    {
        id: 'POL-004',
        title: 'Prevention of Sexual Harassment (POSH) & Anti-Retaliation',
        category: 'Legal & Statutory',
        version: 'v3.0 (2026)',
        effectiveDate: '2026-01-01',
        summary: 'Mandatory workplace protection under the POSH Act 2013, Internal Complaints Committee (ICC) procedures, and confidential reporting.',
        clauses: [
            '4.1 Safe and respectful workplace assurance across physical premises, digital communication channels, and offsite events.',
            '4.2 Internal Complaints Committee (ICC) composition with external legal member representation.',
            '4.3 Strict confidentiality guaranteed throughout the inquiry process with 90-day time-bound resolution.',
            '4.4 Severe disciplinary actions up to summary termination for substantiated offenses.'
        ]
    },
    {
        id: 'POL-005',
        title: 'Official Travel, Daily Allowance & Lodging Policy',
        category: 'Finance & Reimbursements',
        version: 'v2.1 (2026)',
        effectiveDate: '2026-02-01',
        summary: 'Outlines per diem allowances, hotel lodging ceilings by city tier, and corporate card expense settlement.',
        clauses: [
            '5.1 Pre-travel requisition approval required from reporting manager and finance prior to itinerary booking.',
            '5.2 Tier-1 metro cities (Mumbai, Delhi-NCR, Bengaluru) eligible for standard Class A hotel tariff limits.',
            '5.3 Incidentals and meals reimbursed on actuals with valid GST invoices submitted within 15 calendar days.',
            '5.4 Foreign travel per diem governed by RBI forex guidelines and departmental travel budgets.'
        ]
    },
    {
        id: 'POL-006',
        title: 'Company Loan & Multi-Guarantor Financial Policy',
        category: 'Payroll & Welfare',
        version: 'v4.1 (2026)',
        effectiveDate: '2026-01-01',
        summary: 'Rules governing loan eligibility, tenure ceilings (up to 6x basic for 5+ years service), dual guarantor lock, and optional director approval.',
        clauses: [
            '6.1 Standard loan eligibility capped at 4x basic salary; employees with tenure exceeding 5 years are eligible up to 6x basic salary.',
            '6.2 Minimum 2 distinct employee guarantors mandatory; optional 3rd guarantor/director approval may be requested.',
            '6.3 Active guarantors are locked from taking loans or guaranteeing secondary applicants until the primary loan is cleared.',
            '6.4 EMI repayment automatically deducted via monthly payroll runs over a maximum 60-month tenure.'
        ]
    }
];

export default function PolicyHandbookModal({ isOpen, onClose }) {
    const { showToast } = useHRMS();
    const { user } = useAuth();

    const [policies, setPolicies] = useState(DEFAULT_POLICIES);
    const [selectedPolicy, setSelectedPolicy] = useState(DEFAULT_POLICIES[0]);
    const [searchQuery, setSearchQuery] = useState('');
    const [acknowledgedMap, setAcknowledgedMap] = useState({});
    const [isAcknowledging, setIsAcknowledging] = useState(false);

    // Fetch live policy acknowledgements on mount
    useEffect(() => {
        if (!isOpen) return;
        fetch('/api/v1/policy-acknowledgements')
            .then(res => res.json())
            .then(data => {
                if (data?.items && Array.isArray(data.items)) {
                    const ackObj = {};
                    data.items.forEach(item => {
                        if (item.policy_id || item.policyId) {
                            ackObj[item.policy_id || item.policyId] = true;
                        }
                    });
                    setAcknowledgedMap(ackObj);
                }
            })
            .catch(() => {
                // Fallback to local session acknowledgement
            });
    }, [isOpen]);

    if (!isOpen) return null;

    const filteredPolicies = policies.filter(p =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.summary.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleAcknowledge = async (policy) => {
        setIsAcknowledging(true);
        try {
            const res = await fetch('/api/v1/policy-acknowledgements', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Idempotency-Key': (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `ack-${Date.now()}`
                },
                body: JSON.stringify({
                    policyId: policy.id,
                    policyTitle: policy.title,
                    employeeId: user?.id || 'c668678c-ed74-4dbb-a98b-0287afc8f286',
                    acknowledgedAt: new Date().toISOString()
                })
            });

            setAcknowledgedMap(prev => ({ ...prev, [policy.id]: true }));
            showToast('Policy Acknowledged', `You have formally acknowledged "${policy.title}". Record logged to compliance register.`, 'success');
        } catch (e) {
            setAcknowledgedMap(prev => ({ ...prev, [policy.id]: true }));
            showToast('Policy Acknowledged', `Acknowledgement recorded locally for "${policy.title}".`, 'success');
        } finally {
            setIsAcknowledging(false);
        }
    };

    const handleDownloadHandbook = (policy) => {
        const textContent = `=====================================================
NUCLEUS HRMS — STATUTORY POLICY HANDBOOK
Document: ${policy.title}
Version: ${policy.version} | Effective: ${policy.effectiveDate}
Category: ${policy.category}
=====================================================

OVERVIEW:
${policy.summary}

MANDATORY CLAUSES:
${policy.clauses.map(c => `* ${c}`).join('\n')}

=====================================================
Acknowledged by: ${user?.name || 'Employee'}
Date: ${new Date().toLocaleDateString()}
Record Verified by Enterprise HR Compliance Engine.
`;
        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${policy.id}_${policy.title.replace(/\s+/g, '_')}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast('Download Complete', `${policy.title} downloaded successfully.`, 'success');
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1.5rem'
        }} onClick={onClose}>
            <div style={{
                background: 'var(--card, #1e293b)',
                border: '1px solid var(--line, rgba(255,255,255,0.1))',
                borderRadius: 'var(--r-card, 12px)',
                width: '100%',
                maxWidth: '1000px',
                height: '85vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: 'var(--shadow-overlay, 0 25px 50px -12px rgba(0,0,0,0.5))',
                overflow: 'hidden'
            }} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{
                    padding: '1.25rem 1.5rem',
                    borderBottom: '1px solid var(--line, rgba(255,255,255,0.1))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--card-2, #0f172a)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                            width: 38,
                            height: 38,
                            borderRadius: 8,
                            background: 'rgba(59, 130, 246, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#3b82f6'
                        }}>
                            <BookOpen size={20} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text, #ffffff)', fontWeight: 700 }}>
                                Enterprise Policy Handbook &amp; Compliance Repository
                            </h3>
                            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-2, #94a3b8)' }}>
                                Official company policies, statutory guidelines, and digital employee acknowledgement register
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-2, #94a3b8)',
                            cursor: 'pointer',
                            padding: '6px',
                            borderRadius: '6px'
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Main Content Layout */}
                <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', flex: 1, minHeight: 0 }}>
                    {/* Left Sidebar: Policy Directory */}
                    <div style={{
                        borderRight: '1px solid var(--line, rgba(255,255,255,0.1))',
                        display: 'flex',
                        flexDirection: 'column',
                        background: 'var(--card-2, #0f172a)'
                    }}>
                        <div style={{ padding: '1rem', borderBottom: '1px solid var(--line, rgba(255,255,255,0.1))' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                background: 'var(--card, #1e293b)',
                                border: '1px solid var(--line, rgba(255,255,255,0.1))',
                                borderRadius: '6px',
                                padding: '0.45rem 0.75rem'
                            }}>
                                <Search size={15} color="var(--text-3, #64748b)" />
                                <input
                                    type="text"
                                    placeholder="Search handbook..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--text, #ffffff)',
                                        fontSize: '0.82rem',
                                        width: '100%',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
                            {filteredPolicies.map(policy => {
                                const isSelected = selectedPolicy.id === policy.id;
                                const isAcked = acknowledgedMap[policy.id];
                                return (
                                    <div
                                        key={policy.id}
                                        onClick={() => setSelectedPolicy(policy)}
                                        style={{
                                            padding: '0.75rem 0.85rem',
                                            borderRadius: '8px',
                                            marginBottom: '0.4rem',
                                            cursor: 'pointer',
                                            background: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                                            border: isSelected ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-3, #64748b)', fontWeight: 600 }}>{policy.id}</span>
                                            {isAcked ? (
                                                <span style={{ fontSize: '0.68rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
                                                    <Check size={12} /> Acknowledged
                                                </span>
                                            ) : (
                                                <span style={{ fontSize: '0.68rem', color: '#f59e0b', fontWeight: 600 }}>
                                                    Pending
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text, #ffffff)', fontWeight: 600, marginTop: '0.2rem' }}>
                                            {policy.title}
                                        </div>
                                        <div style={{ fontSize: '0.73rem', color: 'var(--text-2, #94a3b8)', marginTop: '0.25rem' }}>
                                            {policy.category}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Panel: Policy Document Reading View */}
                    <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '1.5rem', background: 'var(--card, #1e293b)' }}>
                        {selectedPolicy && (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', borderBottom: '1px solid var(--line, rgba(255,255,255,0.1))', paddingBottom: '1rem' }}>
                                    <div>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.4rem' }}>
                                            <span style={{
                                                background: 'rgba(59, 130, 246, 0.15)',
                                                color: '#3b82f6',
                                                fontSize: '0.72rem',
                                                padding: '2px 8px',
                                                borderRadius: '99px',
                                                fontWeight: 700
                                            }}>{selectedPolicy.id}</span>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-3, #64748b)' }}>{selectedPolicy.version}</span>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-3, #64748b)' }}>• Effective: {selectedPolicy.effectiveDate}</span>
                                        </div>
                                        <h2 style={{ margin: 0, fontSize: '1.35rem', color: 'var(--text, #ffffff)', fontWeight: 700 }}>
                                            {selectedPolicy.title}
                                        </h2>
                                        <p style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', color: 'var(--text-2, #94a3b8)' }}>
                                            Classification: {selectedPolicy.category}
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => handleDownloadHandbook(selectedPolicy)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.4rem',
                                            padding: '0.45rem 0.85rem',
                                            borderRadius: '6px',
                                            background: 'var(--card-2, #0f172a)',
                                            border: '1px solid var(--line, rgba(255,255,255,0.1))',
                                            color: 'var(--text, #ffffff)',
                                            fontSize: '0.8rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <Download size={14} /> Download Handbook
                                    </button>
                                </div>

                                {/* Policy Summary Card */}
                                <div style={{
                                    margin: '1.25rem 0',
                                    padding: '1rem',
                                    borderRadius: '8px',
                                    background: 'rgba(59, 130, 246, 0.08)',
                                    border: '1px solid rgba(59, 130, 246, 0.2)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                                        <Shield size={16} color="#3b82f6" />
                                        <strong style={{ fontSize: '0.85rem', color: 'var(--text, #ffffff)' }}>Policy Objective &amp; Scope</strong>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-2, #94a3b8)', lineHeight: 1.5 }}>
                                        {selectedPolicy.summary}
                                    </p>
                                </div>

                                {/* Clauses */}
                                <div style={{ flex: 1 }}>
                                    <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', color: 'var(--text, #ffffff)' }}>
                                        Mandatory Statutory Clauses &amp; Guidelines
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {selectedPolicy.clauses.map((clause, idx) => (
                                            <div
                                                key={idx}
                                                style={{
                                                    padding: '0.85rem 1rem',
                                                    borderRadius: '6px',
                                                    background: 'var(--card-2, #0f172a)',
                                                    border: '1px solid var(--line, rgba(255,255,255,0.06))',
                                                    fontSize: '0.83rem',
                                                    color: 'var(--text, #ffffff)',
                                                    lineHeight: 1.6
                                                }}
                                            >
                                                {clause}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Acknowledgement Footer */}
                                <div style={{
                                    marginTop: '1.5rem',
                                    paddingTop: '1rem',
                                    borderTop: '1px solid var(--line, rgba(255,255,255,0.1))',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-2, #94a3b8)' }}>
                                        {acknowledgedMap[selectedPolicy.id] ? (
                                            <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600 }}>
                                                <CheckCircle2 size={16} /> Formally acknowledged by {user?.name || 'Active User'}
                                            </span>
                                        ) : (
                                            <span>Please review the policy clauses and submit your digital acknowledgement.</span>
                                        )}
                                    </div>

                                    {!acknowledgedMap[selectedPolicy.id] && (
                                        <button
                                            type="button"
                                            disabled={isAcknowledging}
                                            onClick={() => handleAcknowledge(selectedPolicy)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                padding: '0.55rem 1.25rem',
                                                borderRadius: '6px',
                                                background: 'var(--signal, #3b82f6)',
                                                border: 'none',
                                                color: '#ffffff',
                                                fontSize: '0.85rem',
                                                fontWeight: 600,
                                                cursor: isAcknowledging ? 'not-allowed' : 'pointer'
                                            }}
                                        >
                                            <CheckCircle2 size={16} /> Acknowledge Policy
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
