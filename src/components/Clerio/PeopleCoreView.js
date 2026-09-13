"use client";
import {useTranslation} from '@/context/I18nContext';

import NextImage from 'next/image';

import { readData } from '../../services/workspace-data.mjs';

import React, { useMemo, useState } from 'react';
import {
    Users, Network, FileText, History, Layers, ShieldCheck,
    Search, Plus, Filter, Download, ArrowUpRight, CheckCircle2, AlertCircle
} from 'lucide-react';
import styles from './PeopleCoreView.module.css';
import { useHRMS } from '@/context/HRMSContext';
import { launchAction } from '@/lib/action-launcher';
import { getWorkbookRowsForModule, recordCellValue } from '@/lib/demo-workbook-adapter.mjs';

const PeopleCoreView = ({ onNavigate, onSelectConsole }) => {
    const {t: translateText}=useTranslation();

    const { positions, documents, auditLogs, showToast } = useHRMS();
    const [activeSection, setActiveSection] = useState(readData("components.Clerio.PeopleCoreView", "initialState_1"));
    const [searchQuery, setSearchQuery] = useState('');
    const [reassignTarget, setReassignTarget] = useState(null);
    const [selectedNewManager, setSelectedNewManager] = useState('');
    const [managerOverrides, setManagerOverrides] = useState({});

    const workbookEmployees = useMemo(() => getWorkbookRowsForModule('person_record').map((record) => ({
        id: record.source['Employee code'],
        name: record.source['Full name'],
        role: recordCellValue(record, 'Position'),
        dept: recordCellValue(record, 'Department'),
        manager: record.source['Manager name'] || readData("components.Clerio.PeopleCoreView", "fallback_1"),
        location: recordCellValue(record, 'Location'),
        status: recordCellValue(record, 'Status'),
        band: record.source['Worker class'] || readData("components.Clerio.PeopleCoreView", "fallback_2"),
    })), []);
    const directoryEmployees = workbookEmployees.map((employee) => ({ ...employee, manager: managerOverrides[employee.id] || employee.manager }));
    const filteredEmployees = directoryEmployees.filter(emp =>
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.dept.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.role.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.headerRow}>
                <div className={styles.titleBlock}>
                    <h2>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_1")}</h2>
                    <p>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_2")}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {(onNavigate || onSelectConsole) && (
                        <button
                            className={styles.btnSecondary}
                            onClick={() => {
                                if (onSelectConsole) onSelectConsole('S2');
                                if (onNavigate) onNavigate('dashboard', 'dashboard', 's2');
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
                            title={readData("components.Clerio.PeopleCoreView", "PeopleCoreView_title_3")}
                        >
                            <ShieldCheck size={15} />{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_4")}</button>
                    )}
                    <button className={styles.btnSecondary} onClick={() => showToast(translateText("components.Clerio.PeopleCoreView","text_dfc8f0d02f"),translateText("components.Clerio.PeopleCoreView","text_b64285281e"), 'info')}>
                        <Download size={16} />{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_5")}</button>
                    <button className={styles.btnPrimary} onClick={() => launchAction('employee')}>
                        <Plus size={16} />{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_6")}</button>
                </div>
            </div>

            {/* Sub-Navigation Tabs */}
            <div className={styles.tabNav}>
                <button
                    className={`${styles.tabBtn} ${activeSection === 'directory' ? styles.activeTab : ''}`}
                    onClick={() => setActiveSection('directory')}
                >
                    <Users size={16} />{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_7")}</button>
                <button
                    className={`${styles.tabBtn} ${activeSection === 'orgchart' ? styles.activeTab : ''}`}
                    onClick={() => setActiveSection('orgchart')}
                >
                    <Network size={16} />{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_8")}</button>
                <button
                    className={`${styles.tabBtn} ${activeSection === 'positions' ? styles.activeTab : ''}`}
                    onClick={() => setActiveSection('positions')}
                >
                    <Layers size={16} />{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_9")}</button>
                <button
                    className={`${styles.tabBtn} ${activeSection === 'documents' ? styles.activeTab : ''}`}
                    onClick={() => setActiveSection('documents')}
                >
                    <FileText size={16} />{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_10")}</button>
                <button
                    className={`${styles.tabBtn} ${activeSection === 'audit' ? styles.activeTab : ''}`}
                    onClick={() => setActiveSection('audit')}
                >
                    <History size={16} />{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_11")}</button>
            </div>

            {/* Metrics Row */}
            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'var(--info-wash)', color: 'var(--info)' }}>
                        <Users size={24} />
                    </div>
                    <div>
                        <div className={styles.statValue}>{directoryEmployees.length}</div>
                        <div className={styles.statLabel}>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_12")}</div>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'var(--pending-wash)', color: 'var(--pending)' }}>
                        <Layers size={24} />
                    </div>
                    <div>
                        <div className={styles.statValue}>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_13")}</div>
                        <div className={styles.statLabel}>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_14")}</div>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'var(--signal-wash)', color: 'var(--signal)' }}>
                        <ShieldCheck size={24} />
                    </div>
                    <div>
                        <div className={styles.statValue}>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_15")}</div>
                        <div className={styles.statLabel}>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_16")}</div>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'var(--agent-wash)', color: 'var(--agent)' }}>
                        <History size={24} />
                    </div>
                    <div>
                        <div className={styles.statValue}>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_17")}</div>
                        <div className={styles.statLabel}>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_18")}</div>
                    </div>
                </div>
            </div>

            {/* Section 1: Employee Directory */}
            {activeSection === 'directory' && (
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h3><Users size={20} color="var(--info)" />{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_19")}</h3>
                        <div className={styles.searchBar}>
                            <Search size={16} color="var(--text-2)" />
                            <input
                                type="text"
                                placeholder={readData("components.Clerio.PeopleCoreView", "PeopleCoreView_placeholder_20")}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_21")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_22")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_23")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_24")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_25")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_26")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_27")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEmployees.map((emp) => (
                                    <tr key={emp.id}>
                                        <td>
                                            <div className={styles.empRow}>
                                                <NextImage unoptimized width={48} height={48}
                                                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&background=2563ea&color=fff`}
                                                    className={styles.avatar}
                                                    alt={emp.name}
                                                />
                                                <div>
                                                    <strong style={{ display: 'block', color: 'var(--text)' }}>{emp.name}</strong>
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>{emp.role}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div><strong>{emp.id}</strong></div>
                                            <span style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>{emp.band}</span>
                                        </td>
                                        <td>{emp.dept}</td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{emp.manager || readData("components.Clerio.PeopleCoreView", "fallback_3")}</span>
                                                <button
                                                    onClick={() => {
                                                        setReassignTarget(emp);
                                                        setSelectedNewManager(emp.manager || readData("components.Clerio.PeopleCoreView", "fallback_4"));
                                                    }}
                                                    style={{
                                                        background: 'rgba(45, 212, 168, 0.1)',
                                                        border: '1px solid rgba(45, 212, 168, 0.3)',
                                                        borderRadius: '4px',
                                                        padding: '0.15rem 0.45rem',
                                                        fontSize: '0.68rem',
                                                        color: '#2DD4A8',
                                                        fontWeight: 700,
                                                        cursor: 'pointer'
                                                    }}
                                                    title={readData("components.Clerio.PeopleCoreView", "PeopleCoreView_title_28")}
                                                >{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_29")}</button>
                                            </div>
                                        </td>
                                        <td>{emp.location}</td>
                                        <td><span className={`${styles.badge} ${styles.badgeActive}`}>{emp.status}</span></td>
                                        <td>
                                            <button
                                                className={styles.btnSecondary}
                                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                                                onClick={() => showToast(translateText("components.Clerio.PeopleCoreView","text_1614058fbf"),translateText("components.Clerio.PeopleCoreView","text_69fc081ae6", {value1: String(emp.name)}), 'info')}
                                            >{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_30")}</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Section 2: Dynamic Org Graph */}
            {activeSection === 'orgchart' && (
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h3><Network size={20} color="var(--info)" />{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_31")}</h3>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-2)' }}>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_32")}</span>
                    </div>

                    <div className={styles.orgTree}>
                        <div className={styles.orgNode} style={{ border: '2px solid var(--info)', background: 'var(--info-wash)' }}>
                            <strong style={{ color: 'var(--info)', fontSize: '1.05rem' }}>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_33")}</strong>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-2)', margin: '0.2rem 0 0' }}>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_34")}</p>
                        </div>

                        <div className={styles.orgChildren}>
                            <div className={styles.orgNode}>
                                <strong>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_35")}</strong>
                                <div style={{ fontSize: '0.8rem', color: 'var(--info)' }}>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_36")}</div>
                                <span className={`${styles.badge} ${styles.badgeVerified}`} style={{ marginTop: '0.5rem' }}>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_37")}</span>
                                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <div style={{ background: 'var(--card-2)', border: '1px solid var(--line)', padding: '0.5rem', borderRadius: 'var(--r-control, 6px)', fontSize: '0.82rem', color: 'var(--text)' }}>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_38")}<strong>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_39")}</strong>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_40")}</div>
                                    <div style={{ background: 'var(--card-2)', border: '1px solid var(--line)', padding: '0.5rem', borderRadius: 'var(--r-control, 6px)', fontSize: '0.82rem', color: 'var(--text)' }}>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_41")}<strong>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_42")}</strong>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_43")}</div>
                                </div>
                            </div>

                            <div className={styles.orgNode}>
                                <strong>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_44")}</strong>
                                <div style={{ fontSize: '0.8rem', color: 'var(--agent)' }}>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_45")}</div>
                                <span className={`${styles.badge} ${styles.badgeVerified}`} style={{ marginTop: '0.5rem' }}>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_46")}</span>
                                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <div style={{ background: 'var(--card-2)', border: '1px solid var(--line)', padding: '0.5rem', borderRadius: 'var(--r-control, 6px)', fontSize: '0.82rem', color: 'var(--text)' }}>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_47")}<strong>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_48")}</strong>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_49")}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Section 3: Position Management */}
            {activeSection === 'positions' && (
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h3><Layers size={20} color="#2563eb" />{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_50")}</h3>
                        <button className={styles.btnPrimary} onClick={() => launchAction('position')}>
                            <Plus size={16} />{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_51")}</button>
                    </div>

                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_52")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_53")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_54")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_55")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_56")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_57")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_58")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {positions.map((pos) => (
                                    <tr key={pos.id}>
                                        <td><strong>{pos.id}</strong></td>
                                        <td><strong>{pos.title}</strong></td>
                                        <td>{pos.dept}</td>
                                        <td>{pos.openSlots}</td>
                                        <td>{pos.filled}</td>
                                        <td style={{ color: 'var(--signal)', fontWeight: '600' }}>{pos.budget}</td>
                                        <td>
                                            <span className={`${styles.badge} ${pos.status.includes('Active') ? styles.badgeNotice : styles.badgeActive}`}>
                                                {pos.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Section 4: Document Vault */}
            {activeSection === 'documents' && (
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h3><FileText size={20} color="var(--info)" />{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_59")}</h3>
                        <button className={styles.btnPrimary} onClick={() => launchAction('document')}>
                            <Plus size={16} />{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_60")}</button>
                    </div>

                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_61")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_62")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_63")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_64")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_65")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_66")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {documents.map((doc) => (
                                    <tr key={doc.id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <FileText size={18} color="var(--info)" />
                                                <strong>{doc.title}</strong>
                                            </div>
                                        </td>
                                        <td>{doc.type}</td>
                                        <td>
                                            <span className={`${styles.badge} ${styles.badgeVerified}`}>
                                                <CheckCircle2 size={12} style={{ display: 'inline', marginRight: '4px' }} />
                                                {doc.ocrStatus}
                                            </span>
                                        </td>
                                        <td>{doc.expiry}</td>
                                        <td><span className={`${styles.badge} ${styles.badgeActive}`}>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_67")}</span></td>
                                        <td>
                                            <button className={styles.btnSecondary} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={() => showToast(translateText("components.Clerio.PeopleCoreView","text_1ee270b569"),translateText("components.Clerio.PeopleCoreView","text_e15db7c501"), 'success')}>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_68")}</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Section 5: Audit Trail */}
            {activeSection === 'audit' && (
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h3><History size={20} color="var(--info)" />{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_69")}</h3>
                        <span style={{ fontSize: '0.85rem', color: 'var(--signal)', fontWeight: '600' }}>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_70")}</span>
                    </div>

                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_71")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_72")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_73")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_74")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_75")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_76")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {auditLogs.map((log) => (
                                    <tr key={log.id}>
                                        <td><code>{log.id}</code></td>
                                        <td><strong>{log.field}</strong></td>
                                        <td style={{ color: 'var(--flag)' }}>{log.oldValue}</td>
                                        <td style={{ color: 'var(--signal)', fontWeight: '600' }}>{log.newValue}</td>
                                        <td>{log.changedBy}</td>
                                        <td style={{ color: 'var(--text-2)' }}>{log.timestamp}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Reassign Reporting Manager Modal */}
            {reassignTarget && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(6, 13, 24, 0.8)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    padding: '1.25rem'
                }} onClick={() => setReassignTarget(null)}>
                    <div
                        style={{
                            background: 'linear-gradient(145deg, rgba(14, 23, 38, 0.98) 0%, rgba(10, 16, 28, 0.99) 100%)',
                            border: '1px solid rgba(45, 212, 168, 0.3)',
                            borderRadius: '14px',
                            width: '100%',
                            maxWidth: '460px',
                            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.7)',
                            padding: '1.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1.25rem'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#F1F5F9' }}>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_77")}</h3>
                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#94A3B8' }}>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_78")}<strong>{reassignTarget.name}</strong>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_79")}{reassignTarget.role}{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_80")}</p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_81")}</label>
                            <select
                                value={selectedNewManager}
                                onChange={e => setSelectedNewManager(e.target.value)}
                                style={{
                                    background: 'rgba(6, 13, 24, 0.8)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    borderRadius: 8,
                                    padding: '0.65rem 0.85rem',
                                    color: '#F1F5F9',
                                    fontSize: '0.84rem',
                                    outline: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="Executive Leadership">{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_82")}</option>
                                {directoryEmployees.map((employee) => <option key={employee.id} value={employee.name}>{employee.name}{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_83")}{employee.role}</option>)}
                            </select>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
                            <button
                                className={styles.btnSecondary}
                                onClick={() => setReassignTarget(null)}
                            >{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_84")}</button>
                            <button
                                className={styles.btnPrimary}
                                onClick={() => {
                                    setManagerOverrides((current) => ({ ...current, [reassignTarget.id]: selectedNewManager }));
                                    showToast(translateText("components.Clerio.PeopleCoreView","text_353f98aa9a"),translateText("components.Clerio.PeopleCoreView","text_2703bfa588", {value1: String(reassignTarget.name), value2: String(selectedNewManager)}), 'success');
                                    setReassignTarget(null);
                                }}
                            >{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_85")}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PeopleCoreView;
