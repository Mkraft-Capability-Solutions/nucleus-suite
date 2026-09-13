"use client";
import { readData } from '../../services/workspace-data.mjs';

import React, { useState } from 'react';
import {
    Users, Building2, CheckCircle2, AlertTriangle, FileText,
    Clock, DollarSign, Download, ArrowRight, ShieldCheck,
    Search, Filter, ExternalLink, ShieldAlert, Plus, Layers
} from 'lucide-react';
import styles from './ContractWorkforceView.module.css';
import { launchAction } from '@/lib/action-launcher';

const ContractWorkforceView = () => {
    const [activeTab, setActiveTab] = useState(readData("components.Clerio.ContractWorkforceView", "initialState_1")); // 'reconciliation' | 'workers' | 'vendors'
    const [selectedRecon, setSelectedRecon] = useState(null);

    const reconciliationList = readData("components.Clerio.ContractWorkforceView", "reconciliationList_1");

    const workers = readData("components.Clerio.ContractWorkforceView", "workers_2");

    const vendors = readData("components.Clerio.ContractWorkforceView", "vendors_3");

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div>
                    <div className={styles.badgeRow}>
                        <span className={styles.livePill}><Users size={13} />{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_4")}</span>
                        <span className={styles.mfgPill}><Building2 size={13} />{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_5")}</span>
                    </div>
                    <h2>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_6")}</h2>
                    <p>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_7")}</p>
                </div>

                <div className={styles.headerActions}>
                    <button className={styles.btnSecondary} disabled title={readData("components.Clerio.ContractWorkforceView", "unavailableAction")}>
                        <Download size={16} />{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_8")}</button>
                    <button className={styles.btnPrimary} onClick={() => launchAction('contractor')}>
                        <Plus size={16} />{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_9")}</button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className={styles.tabsRow}>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'reconciliation' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('reconciliation')}
                >
                    <Clock size={16} />{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_10")}</button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'workers' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('workers')}
                >
                    <Users size={16} />{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_11")}{workers.length}{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_12")}</button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'vendors' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('vendors')}
                >
                    <Building2 size={16} />{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_13")}{vendors.length}{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_14")}</button>
            </div>

            {/* TAB 1: RECONCILIATION */}
            {activeTab === 'reconciliation' && (
                <div className={styles.reconSection}>
                    <div className={styles.reconBanner}>
                        <ShieldAlert size={20} color="#b91c1c" />
                        <div>
                            <strong>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_15")}</strong>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_16")}<strong>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_17")}</strong>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_18")}<strong>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_19")}</strong>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_20")}</div>
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
                                        <span>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_21")}</span>
                                        <strong>{rec.billedHours.toLocaleString()}{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_22")}</strong>
                                        <div className={styles.metricCost}>{rec.billedAmount}</div>
                                    </div>
                                    <div className={styles.arrowBlock}>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_23")}</div>
                                    <div className={styles.metricBlock}>
                                        <span>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_24")}</span>
                                        <strong>{rec.gateHours.toLocaleString()}{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_25")}</strong>
                                        <div className={styles.metricCostVerified}>{rec.reconciledAmount}</div>
                                    </div>
                                </div>

                                {rec.discrepancyHours > 0 && (
                                    <div className={styles.discrepancyBox}>
                                        <AlertTriangle size={15} color="#dc2626" />
                                        <span>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_26")}<strong>{rec.discrepancyHours}{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_27")}</strong>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_28")}{rec.variancePercent}{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_29")}<strong>{rec.discrepancyAmount}</strong>
                                        </span>
                                    </div>
                                )}

                                <div className={styles.reconActions}>
                                    {rec.status === 'Action Required' ? (
                                        <>
                                            <button
                                                className={styles.btnDebitNote}
                                                onClick={() => launchAction('debitNote', { vendor: rec.vendor, amount: rec.discrepancyAmount })}
                                            >{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_30")}{rec.discrepancyAmount}{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_31")}</button>
                                            <button
                                                className={styles.btnInspect}
                                                onClick={() => setSelectedRecon(rec)}
                                            >{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_32")}</button>
                                        </>
                                    ) : (
                                        <button className={styles.btnSecondary} onClick={() => setSelectedRecon(rec)}>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_33")}</button>
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
                                        <h3>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_34")}{selectedRecon.vendor}</h3>
                                        <span>{selectedRecon.site}{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_35")}{selectedRecon.period}</span>
                                    </div>
                                    <button className={styles.closeBtn} onClick={() => setSelectedRecon(null)}>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_36")}</button>
                                </div>
                                <div className={styles.modalBody}>
                                    <table className={styles.dataTable}>
                                        <thead>
                                            <tr>
                                                <th>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_37")}</th>
                                                <th>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_38")}</th>
                                                <th>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_39")}</th>
                                                <th>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_40")}</th>
                                                <th>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_41")}</th>
                                                <th>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_42")}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedRecon.workersDiscrepancy.length > 0 ? (
                                                selectedRecon.workersDiscrepancy.map((w, idx) => (
                                                    <tr key={idx}>
                                                        <td><code>{w.badge}</code></td>
                                                        <td><strong>{w.name}</strong></td>
                                                        <td>{w.billed}{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_43")}</td>
                                                        <td className={styles.boldCell}>{w.gate}{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_44")}</td>
                                                        <td className={styles.textRed}>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_45")}{w.diff}{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_46")}</td>
                                                        <td><span className={styles.tagRed}>{w.status}</span></td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-3)' }}>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_47")}</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                    <div className={styles.modalFooter}>
                                        <button className={styles.btnSecondary} onClick={() => setSelectedRecon(null)}>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_48")}</button>
                                        <button className={styles.btnPrimary} disabled title={readData("components.Clerio.ContractWorkforceView", "unavailableAction")}>
                                            <Download size={14} />{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_49")}</button>
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
                            <h3>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_50")}</h3>
                            <input
                                type="text"
                                placeholder={readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_placeholder_51")}
                                className={styles.searchInput}
                            />
                        </div>

                        <table className={styles.dataTable}>
                            <thead>
                                <tr>
                                    <th>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_52")}</th>
                                    <th>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_53")}</th>
                                    <th>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_54")}</th>
                                    <th>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_55")}</th>
                                    <th>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_56")}</th>
                                    <th>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_57")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {workers.map((w) => (
                                    <tr key={w.id}>
                                        <td>
                                            <code>{w.id}</code>
                                            <div style={{ fontWeight: '700', color: '#0f172a' }}>{w.name}</div>
                                        </td>
                                        <td>{w.vendor}</td>
                                        <td>
                                            <div className={styles.uanText}>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_58")}{w.uan}</div>
                                            <div className={styles.uanText}>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_59")}{w.esic}</div>
                                        </td>
                                        <td>{w.site}</td>
                                        <td>
                                            <div>{w.role}</div>
                                            <div className={styles.bandPill}>{w.wageBand}</div>
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
                                    <Building2 size={24} color="#2563eb" />
                                    <div>
                                        <h4>{v.name}</h4>
                                        <span className={styles.siteText}>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_60")}{v.id}{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_61")}{v.licenseNo}</span>
                                    </div>
                                </div>
                                <div className={styles.vendorDetails}>
                                    <div><strong>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_62")}</strong> {v.workers}{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_63")}</div>
                                    <div><strong>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_64")}</strong> <span className={styles.tagGreen}>{v.pfStatus}</span></div>
                                    <div><strong>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_65")}</strong> <span className={styles.tagBlue}>{v.esicStatus}</span></div>
                                    <div><strong>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_66")}</strong> {v.rating}</div>
                                </div>
                                <div className={styles.vendorBottom}>
                                    <button className={styles.btnSecondary} disabled title={readData("components.Clerio.ContractWorkforceView", "unavailableAction")}>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_67")}</button>
                                    <button className={styles.btnPrimary} onClick={() => launchAction('filing', { entity: v.name })}>{readData("components.Clerio.ContractWorkforceView", "ContractWorkforceView_text_68")}</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ContractWorkforceView;
