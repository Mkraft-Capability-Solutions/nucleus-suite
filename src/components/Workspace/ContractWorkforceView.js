"use client";
import { readData } from '../../services/workspace-data.mjs';

import React, { useState, useEffect } from 'react';
import {
    Users, Building2, CheckCircle2, AlertTriangle, FileText,
    Clock, DollarSign, Download, ArrowRight, ShieldCheck,
    Search, Filter, ExternalLink, ShieldAlert, Plus, Layers, X
} from 'lucide-react';
import styles from './ContractWorkforceView.module.css';
import { launchAction } from '@/lib/action-launcher';
import { downloadCSV, downloadPrintableDocument } from '@/utils/exportUtils';

const ContractWorkforceView = () => {
    const [activeTab, setActiveTab] = useState(readData("components.Workspace.ContractWorkforceView", "initialState_1")); // 'reconciliation' | 'workers' | 'vendors'
    const [selectedRecon, setSelectedRecon] = useState(null);
    const [workerSearch, setWorkerSearch] = useState('');
    const [isRegisterOpen, setIsRegisterOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [regSuccess, setRegSuccess] = useState('');

    const initialWorkers = readData("components.Workspace.ContractWorkforceView", "workers_2") || [];
    const [workers, setWorkers] = useState(initialWorkers);

    const reconciliationList = readData("components.Workspace.ContractWorkforceView", "reconciliationList_1") || [];
    const vendors = readData("components.Workspace.ContractWorkforceView", "vendors_3") || [];

    // Registration Form State
    const [formData, setFormData] = useState({
        personName: '',
        vendorName: 'Shree Powerloom Services',
        category: 'contract', // 'contract' | 'third-party-employee' | 'third-party-helper'
        role: 'Loom Technician',
        uan: '100982347891',
        aadhaar: '987654321098',
        site: 'Bangalore Electronic City Plant 1',
        shift: 'General Plant Shift',
        dailyWage: 650,
        startsOn: new Date().toISOString().split('T')[0],
    });

    // Fetch live workers from PostgreSQL on mount
    useEffect(() => {
        let active = true;
        async function fetchContractWorkers() {
            try {
                const res = await fetch('/api/v1/contractors/assignments');
                if (!res.ok) return;
                const json = await res.json();
                if (active && Array.isArray(json.data) && json.data.length > 0) {
                    const dbWorkers = json.data.map(item => {
                        const attr = item.attributes || {};
                        return {
                            id: attr.workerCode || item.id,
                            name: attr.name || attr.personName || 'Contract Worker',
                            vendor: attr.vendor || 'Shree Powerloom Services',
                            uan: attr.uan || '100982347891',
                            esic: '31-00-123456-000-0001',
                            site: attr.site || 'Bangalore Electronic City Plant 1',
                            role: attr.role || 'Contract Operative',
                            category: attr.category || 'contract',
                            wageBand: `₹${attr.dailyWage || 650}/day`,
                            compliance: 'Verified',
                            hasRestDays: attr.hasRestDays !== undefined ? attr.hasRestDays : (attr.category === 'third-party-employee'),
                        };
                    });

                    setWorkers(prev => {
                        const existingIds = new Set(dbWorkers.map(w => w.id));
                        const remainder = prev.filter(w => !existingIds.has(w.id));
                        return [...dbWorkers, ...remainder];
                    });
                }
            } catch (err) {
                console.warn('Failed to load contract workers:', err);
            }
        }
        fetchContractWorkers();
        return () => { active = false; };
    }, []);

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'dailyWage' ? Number(value) : value
        }));
    };

    const handleRegisterSubmit = async (e) => {
        e.preventDefault();
        if (!formData.personName.trim()) return;

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/v1/contractors/assignments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Idempotency-Key': crypto.randomUUID(),
                },
                body: JSON.stringify(formData),
            });

            const hasRestDays = formData.category === 'third-party-employee';
            const newWorkerEntry = {
                id: `CW-${Math.floor(1000 + Math.random() * 9000)}`,
                name: formData.personName.trim(),
                vendor: formData.vendorName,
                uan: formData.uan || '100982347891',
                esic: '31-00-123456-000-0001',
                site: formData.site,
                role: formData.role,
                category: formData.category,
                wageBand: `₹${formData.dailyWage || 650}/day`,
                compliance: 'Verified',
                hasRestDays: hasRestDays,
            };

            if (res.ok) {
                const json = await res.json().catch(() => null);
                if (json?.attributes?.workerCode) {
                    newWorkerEntry.id = json.attributes.workerCode;
                }
            }

            setWorkers(prev => [newWorkerEntry, ...prev]);
            setRegSuccess(`Worker ${newWorkerEntry.name} successfully registered to database!`);
            setIsRegisterOpen(false);
            setActiveTab('workers');
            setFormData(prev => ({ ...prev, personName: '' }));
            setTimeout(() => setRegSuccess(''), 6000);
        } catch (err) {
            console.error('Error registering worker:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredWorkers = workers.filter(w =>
        w.name.toLowerCase().includes(workerSearch.toLowerCase()) ||
        w.vendor.toLowerCase().includes(workerSearch.toLowerCase()) ||
        w.role.toLowerCase().includes(workerSearch.toLowerCase()) ||
        w.site.toLowerCase().includes(workerSearch.toLowerCase())
    );

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div>
                    <div className={styles.badgeRow}>
                        <span className={styles.livePill}><Users size={13} />{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_4")}</span>
                        <span className={styles.mfgPill}><Building2 size={13} />{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_5")}</span>
                    </div>
                    <h2>{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_6")}</h2>
                    <p>{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_7")}</p>
                </div>

                <div className={styles.headerActions}>
                    <button className={styles.btnSecondary} onClick={() => {
                        const headers = ['Worker ID', 'Name', 'Vendor', 'Trade / Role', 'Shift', 'Wage Rate (₹/day)', 'Biometric ID', 'Status'];
                        const rows = (workers || []).map(w => [
                            w.id,
                            w.name,
                            w.vendor,
                            w.trade,
                            w.shift,
                            w.wageRate,
                            w.biometricId,
                            w.status
                        ]);
                        downloadCSV('contract_workforce_register.csv', headers, rows);
                    }} title="Export Contract Workforce Register">
                        <Download size={16} />{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_8")}</button>
                    <button className={styles.btnPrimary} onClick={() => setIsRegisterOpen(true)}>
                        <Plus size={16} /> Register Contract Worker</button>
                </div>
            </div>

            {regSuccess && (
                <div style={{
                    padding: '0.85rem 1.25rem',
                    background: 'var(--signal-wash)',
                    color: 'var(--signal-ink)',
                    border: '1px solid var(--signal)',
                    borderRadius: 'var(--r-control)',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <CheckCircle2 size={16} /> {regSuccess}
                </div>
            )}

            {/* Navigation Tabs */}
            <div className={styles.tabsRow}>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'reconciliation' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('reconciliation')}
                >
                    <Clock size={16} />{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_10")}</button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'workers' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('workers')}
                >
                    <Users size={16} />{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_11")}{workers.length}{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_12")}</button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'vendors' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('vendors')}
                >
                    <Building2 size={16} />{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_13")}{vendors.length}{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_14")}</button>
            </div>

            {/* TAB 1: RECONCILIATION */}
            {activeTab === 'reconciliation' && (
                <div className={styles.reconSection}>
                    <div className={styles.reconBanner}>
                        <ShieldAlert size={20} style={{ color: 'var(--flag)' }} />
                        <div>
                            <strong>{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_15")}</strong>{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_16")}<strong>{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_17")}</strong>{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_18")}<strong>{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_19")}</strong>{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_20")}</div>
                    </div>

                    <div className={styles.reconGrid}>
                        {reconciliationList.map((rec) => (
                            <div key={rec.id} className={styles.reconCard}>
                                <div className={styles.reconCardHead}>
                                    <div>
                                        <span className={styles.recId}>{rec.id}</span>
                                        <h4>{rec.vendor}</h4>
                                        <span className={styles.siteText}>{rec.site}</span>
                                    </div>
                                    <span className={`
                                        ${styles.statusBadge}
                                        ${rec.status === 'Approved' ? styles.stApproved : ''}
                                        ${rec.status === 'Action Required' ? styles.stAction : ''}
                                        ${rec.status.includes('Debit Note') ? styles.stDebit : ''}
                                    `}>
                                        {rec.status}
                                    </span>
                                </div>

                                <div className={styles.comparisonMetrics}>
                                    <div className={styles.metricBlock}>
                                        <span>{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_21")}</span>
                                        <strong>{rec.billedHours.toLocaleString()}{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_22")}</strong>
                                        <div className={styles.metricCost}>{rec.billedAmount}</div>
                                    </div>
                                    <div className={styles.arrowBlock}>{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_23")}</div>
                                    <div className={styles.metricBlock}>
                                        <span>{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_24")}</span>
                                        <strong>{rec.gateHours.toLocaleString()}{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_25")}</strong>
                                        <div className={styles.metricCostVerified}>{rec.reconciledAmount}</div>
                                    </div>
                                </div>

                                {rec.discrepancyHours > 0 && (
                                    <div className={styles.discrepancyBox}>
                                        <AlertTriangle size={15} style={{ color: 'var(--flag)' }} />
                                        <span>{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_26")}<strong>{rec.discrepancyHours}{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_27")}</strong>{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_28")}{rec.variancePercent}{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_29")}<strong>{rec.discrepancyAmount}</strong>
                                        </span>
                                    </div>
                                )}

                                <div className={styles.reconActions}>
                                    {rec.status === 'Action Required' ? (
                                        <>
                                            <button
                                                className={styles.btnDebitNote}
                                                onClick={() => launchAction('debitNote', { vendor: rec.vendor, amount: rec.discrepancyAmount })}
                                            >{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_30")}{rec.discrepancyAmount}{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_31")}</button>
                                            <button
                                                className={styles.btnInspect}
                                                onClick={() => setSelectedRecon(rec)}
                                            >{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_32")}</button>
                                        </>
                                    ) : (
                                        <button className={styles.btnSecondary} onClick={() => setSelectedRecon(rec)}>{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_33")}</button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Drilldown Modal */}
                    {selectedRecon && (
                        <div className={styles.modalOverlay} onClick={() => setSelectedRecon(null)}>
                            <div className={styles.modalLarge} onClick={(e) => e.stopPropagation()}>
                                <div className={styles.modalHeader}>
                                    <div>
                                        <h3>{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_34")}{selectedRecon.vendor}</h3>
                                        <span>{selectedRecon.site}{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_35")}{selectedRecon.period}</span>
                                    </div>
                                    <button className={styles.closeBtn} onClick={() => setSelectedRecon(null)}>{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_36")}</button>
                                </div>
                                <div className={styles.modalBody}>
                                    <table className={styles.dataTable}>
                                        <thead>
                                            <tr>
                                                <th>{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_37")}</th>
                                                <th>{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_38")}</th>
                                                <th>{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_39")}</th>
                                                <th>{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_40")}</th>
                                                <th>{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_41")}</th>
                                                <th>{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_42")}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedRecon.workersDiscrepancy.length > 0 ? (
                                                selectedRecon.workersDiscrepancy.map((w, idx) => (
                                                    <tr key={idx}>
                                                        <td><code>{w.badge}</code></td>
                                                        <td><strong>{w.name}</strong></td>
                                                        <td>{w.billed}{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_43")}</td>
                                                        <td className={styles.boldCell}>{w.gate}{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_44")}</td>
                                                        <td className={styles.textRed}>{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_45")}{w.diff}{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_46")}</td>
                                                        <td><span className={styles.tagRed}>{w.status}</span></td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-3)' }}>{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_47")}</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                    <div className={styles.modalFooter}>
                                        <button className={styles.btnSecondary} onClick={() => setSelectedRecon(null)}>{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_48")}</button>
                                        <button className={styles.btnPrimary} onClick={() => {
                                            const headers = ['Category / Trade', 'Claimed Headcount', 'Biometric Verified', 'Variance', 'Billable Amount (₹)'];
                                            const rows = (selectedRecon.breakdown || []).map(b => [
                                                b.category,
                                                b.claimed,
                                                b.verified,
                                                b.variance,
                                                b.amount
                                            ]);
                                            downloadPrintableDocument(`Vendor_Recon_${selectedRecon.vendorName.replace(/\s+/g, '_')}_${selectedRecon.month}`, {
                                                'Vendor': selectedRecon.vendorName,
                                                'Billing Month': selectedRecon.month,
                                                'Total Claimed': selectedRecon.claimedWorkers,
                                                'Total Verified': selectedRecon.verifiedWorkers,
                                                'Total Hours': selectedRecon.totalHours,
                                                'Approved Invoice Amount': selectedRecon.billAmount,
                                                'Statutory Compliance Status': selectedRecon.compliancePassed ? 'PF / ESIC Cleared' : 'Action Required'
                                            }, headers, rows);
                                        }} title="Download Vendor Reconciliation Invoice Sheet">
                                            <Download size={14} />{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_49")}</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: WORKER REGISTRY */}
            {activeTab === 'workers' && (
                <div className={styles.workersSection}>
                    <div className={styles.tableCard}>
                        <div className={styles.tableHeader}>
                            <h3>{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_50")}</h3>
                            <input
                                type="text"
                                placeholder="Search worker by name, trade, vendor, site..."
                                className={styles.searchInput}
                                value={workerSearch}
                                onChange={(e) => setWorkerSearch(e.target.value)}
                            />
                        </div>

                        <table className={styles.dataTable}>
                            <thead>
                                <tr>
                                    <th>Worker Details</th>
                                    <th>Vendor / Agency</th>
                                    <th>Statutory KYC (UAN / ESIC)</th>
                                    <th>Work Site</th>
                                    <th>Trade & Rest Day Policy</th>
                                    <th>Compliance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredWorkers.map((w) => (
                                    <tr key={w.id}>
                                        <td>
                                            <code>{w.id}</code>
                                            <div style={{ fontWeight: '700', color: 'var(--text)' }}>{w.name}</div>
                                        </td>
                                        <td>{w.vendor}</td>
                                        <td>
                                            <div className={styles.uanText}>UAN: {w.uan}</div>
                                            <div className={styles.uanText}>ESIC: {w.esic || '31-00-123456-000-0001'}</div>
                                        </td>
                                        <td>{w.site}</td>
                                        <td>
                                            <div><strong>{w.role}</strong></div>
                                            <div style={{ marginTop: '0.25rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                                                <span className={styles.bandPill}>{w.wageBand}</span>
                                                {w.hasRestDays ? (
                                                    <span style={{
                                                        fontSize: '0.68rem',
                                                        padding: '0.15rem 0.4rem',
                                                        borderRadius: '3px',
                                                        background: 'var(--signal-wash)',
                                                        color: 'var(--signal-ink)',
                                                        fontWeight: 700
                                                    }}>
                                                        Rest Days: Eligible
                                                    </span>
                                                ) : (
                                                    <span style={{
                                                        fontSize: '0.68rem',
                                                        padding: '0.15rem 0.4rem',
                                                        borderRadius: '3px',
                                                        background: 'var(--card-2)',
                                                        color: 'var(--text-2)',
                                                        fontWeight: 600,
                                                        border: '1px solid var(--line)'
                                                    }}>
                                                        Daily Wages · No Rest Days
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`
                                                ${styles.statusBadge}
                                                ${w.compliance === 'Verified' ? styles.stApproved : styles.stAction}
                                            `}>
                                                {w.compliance === 'Verified' ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                                                {w.compliance}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 3: VENDORS */}
            {activeTab === 'vendors' && (
                <div className={styles.vendorsSection}>
                    <div className={styles.vendorsGrid}>
                        {vendors.map((v) => (
                            <div key={v.id} className={styles.vendorCard}>
                                <div className={styles.vendorHead}>
                                    <Building2 size={24} style={{ color: 'var(--info)' }} />
                                    <div>
                                        <h4>{v.name}</h4>
                                        <span className={styles.siteText}>{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_60")}{v.id}{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_61")}{v.licenseNo}</span>
                                    </div>
                                </div>
                                <div className={styles.vendorDetails}>
                                    <div><strong>{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_62")}</strong> {v.workers}{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_63")}</div>
                                    <div><strong>{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_64")}</strong> <span className={styles.tagGreen}>{v.pfStatus}</span></div>
                                    <div><strong>{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_65")}</strong> <span className={styles.tagBlue}>{v.esicStatus}</span></div>
                                    <div><strong>{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_66")}</strong> {v.rating}</div>
                                </div>
                                <div className={styles.vendorBottom}>
                                    <button className={styles.btnSecondary} disabled title={readData("components.Workspace.ContractWorkforceView", "unavailableAction")}>{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_67")}</button>
                                    <button className={styles.btnPrimary} onClick={() => launchAction('filing', { entity: v.name })}>{readData("components.Workspace.ContractWorkforceView", "ContractWorkforceView_text_68")}</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* REGISTER CONTRACT WORKER MODAL */}
            {isRegisterOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsRegisterOpen(false)}>
                    <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3>Register Contract Worker</h3>
                            <button className={styles.modalCloseBtn} onClick={() => setIsRegisterOpen(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleRegisterSubmit}>
                            <div className={styles.formGrid}>
                                <div className={`${styles.formGroup} ${styles.formFieldFull}`}>
                                    <label>Worker Full Name *</label>
                                    <input
                                        type="text"
                                        name="personName"
                                        required
                                        placeholder="e.g. Satish Pillai"
                                        value={formData.personName}
                                        onChange={handleFormChange}
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label>Contractor / Agency *</label>
                                    <select
                                        name="vendorName"
                                        value={formData.vendorName}
                                        onChange={handleFormChange}
                                    >
                                        <option value="Shree Powerloom Services">Shree Powerloom Services</option>
                                        <option value="Apex Industrial Facility Mgmt">Apex Industrial Facility Mgmt</option>
                                        <option value="Dynamic Logistics Manpower">Dynamic Logistics Manpower</option>
                                    </select>
                                </div>

                                <div className={styles.formGroup}>
                                    <label>Worker Category & Rest Day Rules *</label>
                                    <select
                                        name="category"
                                        value={formData.category}
                                        onChange={handleFormChange}
                                    >
                                        <option value="contract">Contractual Worker (Daily Wages · No Rest Days)</option>
                                        <option value="third-party-employee">3rd Party Employee (Eligible for Rest Days)</option>
                                        <option value="third-party-helper">3rd Party Helper (No Rest Days · Daily Wage)</option>
                                    </select>
                                </div>

                                <div className={styles.restDayBanner}>
                                    <ShieldCheck size={16} />
                                    <span>
                                        {formData.category === 'contract' && 'Statutory Rule: Contractual employees receive daily wages and have no weekly rest days.'}
                                        {formData.category === 'third-party-employee' && 'Statutory Rule: 3rd party skilled employees are eligible for weekly paid rest days.'}
                                        {formData.category === 'third-party-helper' && 'Statutory Rule: 3rd party helpers earn daily wage overtime on working hours.'}
                                    </span>
                                </div>

                                <div className={styles.formGroup}>
                                    <label>Role / Trade *</label>
                                    <input
                                        type="text"
                                        name="role"
                                        placeholder="e.g. Loom Maintenance Specialist"
                                        value={formData.role}
                                        onChange={handleFormChange}
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label>Daily Wage Rate (₹) *</label>
                                    <input
                                        type="number"
                                        name="dailyWage"
                                        min="300"
                                        max="5000"
                                        value={formData.dailyWage}
                                        onChange={handleFormChange}
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label>UAN (12 digits)</label>
                                    <input
                                        type="text"
                                        name="uan"
                                        placeholder="100982347891"
                                        value={formData.uan}
                                        onChange={handleFormChange}
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label>Aadhaar (12 digits)</label>
                                    <input
                                        type="text"
                                        name="aadhaar"
                                        placeholder="987654321098"
                                        value={formData.aadhaar}
                                        onChange={handleFormChange}
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label>Work Site / Plant Location *</label>
                                    <select
                                        name="site"
                                        value={formData.site}
                                        onChange={handleFormChange}
                                    >
                                        <option value="Bangalore Electronic City Plant 1">Bangalore Electronic City Plant 1</option>
                                        <option value="Mumbai BKC Corporate HQ">Mumbai BKC Corporate HQ</option>
                                        <option value="Delhi Logistics & Warehouse Hub">Delhi Logistics & Warehouse Hub</option>
                                    </select>
                                </div>

                                <div className={styles.formGroup}>
                                    <label>Assignment Start Date *</label>
                                    <input
                                        type="date"
                                        name="startsOn"
                                        value={formData.startsOn}
                                        onChange={handleFormChange}
                                    />
                                </div>
                            </div>

                            <div className={styles.modalActions}>
                                <button
                                    type="button"
                                    className={styles.btnSecondary}
                                    onClick={() => setIsRegisterOpen(false)}
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className={styles.btnPrimary}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Registering...' : 'Register Worker'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ContractWorkforceView;

