"use client";
import {useTranslation} from '@/context/I18nContext';

import { readData } from '../../services/workspace-data.mjs';

import React, { useState } from 'react';
import {
    ShieldCheck, Calendar, Calculator, CheckCircle2, AlertTriangle,
    Clock, ArrowUpRight, ArrowDownRight, FileText, Download,
    RefreshCw, Filter, Layers, ExternalLink, HelpCircle, ChevronRight,
    MapPin, Building2, Scale, Info, HardHat, FileSpreadsheet, Send,
    CheckCircle, XCircle, Printer, Eye, FileCheck, AlertCircle, Database,
    UploadCloud, Server, ArrowRight, Shield
} from 'lucide-react';
import { useHRMS } from '@/context/HRMSContext';
import {
    validateFormFNominees, generateFormFDeclaration,
    SAMPLE_FORM_F_TEMPLATES, generateSapIdocXml,
    generateNetSuiteCsv, generateTallyPrimeXml, validateGLBatchBalance
} from '@/services/erpAndComplianceService';
import styles from './ComplianceView.module.css';
import { launchAction } from '@/lib/action-launcher';

const ComplianceView = () => {
    const {t: translateText}=useTranslation();

    const [activeTab, setActiveTab] = useState(readData("components.Clerio.ComplianceView", "initialState_1")); // 'simulator' | 'calendar' | 'factory_registers' | 'form_f_gratuity' | 'erp_integration' | 'matrix' | 'packs'

    const {
        employees = [], user,
        erpSyncLogs = [], erpPostingQueue = [], triggerErpSync, dispatchGLPostingBatch, reconcileGLBatch,
        statutoryAccidents = [], reportFactoryAccidentForm18,
        factoryInspections = [], recordFactoryInspectionForm36,
        statutoryMusterRoll, generateFormFGratuity,
        erpFieldOwnershipPolicy, complianceRulesetVersion
    } = useHRMS();

    // SPRINT 5 STATES
    const [factorySubTab, setFactorySubTab] = useState(readData("components.Clerio.ComplianceView", "initialState_2")); // 'form28' | 'form18' | 'form36'
    const [selectedEmployeeId, setSelectedEmployeeId] = useState(readData("components.Clerio.ComplianceView", "initialState_3"));
    const [formFNominees, setFormFNominees] = useState(SAMPLE_FORM_F_TEMPLATES[0].nominees);
    const [formFDoc, setFormFDoc] = useState(null);
    const [showFormFModal, setShowFormFModal] = useState(false);

    // Form 18 Accident reporting modal
    const [showAccidentModal, setShowAccidentModal] = useState(false);
    const [accidentForm, setAccidentForm] = useState(readData("components.Clerio.ComplianceView", "accidentForm_1"));

    // GL Journal Inspection Modal
    const [selectedGLBatch, setSelectedGLBatch] = useState(null);
    const [exportCodeModal, setExportCodeModal] = useState(null);

    // --- 1. LABOUR CODES SIMULATOR STATE ---
    const [monthlyGross, setMonthlyGross] = useState(readData("components.Clerio.ComplianceView", "initialState_4"));
    const [basicPercent, setBasicPercent] = useState(readData("components.Clerio.ComplianceView", "initialState_5")); // 35% of gross = ₹35,000
    const [daPercent, setDaPercent] = useState(readData("components.Clerio.ComplianceView", "initialState_6")); // 5% = ₹5,000
    const [hraPercent, setHraPercent] = useState(readData("components.Clerio.ComplianceView", "initialState_7")); // 30% = ₹30,000
    const [specialPercent, setSpecialPercent] = useState(readData("components.Clerio.ComplianceView", "initialState_8")); // 30% = ₹30,000

    // Calculations
    const basic = (monthlyGross * basicPercent) / 100;
    const da = (monthlyGross * daPercent) / 100;
    const hra = (monthlyGross * hraPercent) / 100;
    const special = (monthlyGross * specialPercent) / 100;

    const currentWageBase = basic + da; // ₹40,000
    const excludedComponents = hra + special; // ₹60,000
    const statutoryFloor = monthlyGross * 0.50; // 50% = ₹50,000

    // Under Code on Wages: Excluded > 50% total remuneration -> excess added back
    const excessExcluded = Math.max(0, excludedComponents - statutoryFloor); // ₹10,000
    const newWageBase = currentWageBase + excessExcluded; // ₹50,000

    // PF Calculation (12% of wage base, capped at 15k ceiling or uncapped enterprise rate)
    const oldPFEmployee = Math.round(currentWageBase * 0.12);
    const oldPFEmployer = Math.round(currentWageBase * 0.12);
    const newPFEmployee = Math.round(newWageBase * 0.12);
    const newPFEmployer = Math.round(newWageBase * 0.12);
    const pfVariance = newPFEmployer - oldPFEmployer;

    // Gratuity Liability (15 days per year = (Wage Base / 26) * 15 / 12 per month)
    const oldGratuityMonthly = Math.round((currentWageBase / 26) * (15 / 12));
    const newGratuityMonthly = Math.round((newWageBase / 26) * (15 / 12));
    const gratuityVariance = newGratuityMonthly - oldGratuityMonthly;

    // Estimated Net Take-Home (approx TDS ~10%)
    const oldTakeHome = monthlyGross - oldPFEmployee - (monthlyGross * 0.10);
    const newTakeHome = monthlyGross - newPFEmployee - (monthlyGross * 0.10);

    // --- 2. OBLIGATION CALENDAR STATE ---
    const [filterPeriod, setFilterPeriod] = useState(readData("components.Clerio.ComplianceView", "initialState_9"));
    const [selectedChallan, setSelectedChallan] = useState(null);

    const obligations = readData("components.Clerio.ComplianceView", "obligations_2");

    // --- 3. STATE RULE MATRIX STATE ---
    const stateMatrix = readData("components.Clerio.ComplianceView", "stateMatrix_3");

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div>
                    <div className={styles.badgeRow}>
                        <span className={styles.livePill}><ShieldCheck size={13} />{readData("components.Clerio.ComplianceView", "ComplianceView_text_4")}</span>
                        <span className={styles.versionPill}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_5")}</span>
                    </div>
                    <h2>{readData("components.Clerio.ComplianceView", "ComplianceView_text_6")}</h2>
                    <p>{readData("components.Clerio.ComplianceView", "ComplianceView_text_7")}</p>
                </div>

                <div className={styles.headerActions}>
                    <button className={styles.btnSecondary} disabled title={readData("components.Clerio.ComplianceView", "unavailableAction")}>
                        <Download size={16} />{readData("components.Clerio.ComplianceView", "ComplianceView_text_8")}</button>
                    <button className={styles.btnPrimary} onClick={() => setActiveTab('simulator')}>
                        <Calculator size={16} />{readData("components.Clerio.ComplianceView", "ComplianceView_text_9")}</button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className={styles.tabsRow}>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'simulator' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('simulator')}
                >
                    <Calculator size={16} />{readData("components.Clerio.ComplianceView", "ComplianceView_text_10")}</button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'calendar' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('calendar')}
                >
                    <Calendar size={16} />{readData("components.Clerio.ComplianceView", "ComplianceView_text_11")}{obligations.length}{readData("components.Clerio.ComplianceView", "ComplianceView_text_12")}</button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'factory_registers' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('factory_registers')}
                >
                    <HardHat size={16} />{readData("components.Clerio.ComplianceView", "ComplianceView_text_13")}</button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'form_f_gratuity' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('form_f_gratuity')}
                >
                    <FileCheck size={16} />{readData("components.Clerio.ComplianceView", "ComplianceView_text_14")}</button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'erp_integration' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('erp_integration')}
                >
                    <Server size={16} />{readData("components.Clerio.ComplianceView", "ComplianceView_text_15")}</button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'matrix' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('matrix')}
                >
                    <MapPin size={16} />{readData("components.Clerio.ComplianceView", "ComplianceView_text_16")}</button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'packs' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('packs')}
                >
                    <Layers size={16} />{readData("components.Clerio.ComplianceView", "ComplianceView_text_17")}</button>
            </div>

            {/* TAB 1: 50% WAGE FLOOR SIMULATOR */}
            {activeTab === 'simulator' && (
                <div className={styles.simulatorSection}>
                    <div className={styles.simNotice}>
                        <Info size={18} color="#2563eb" />
                        <div>
                            <strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_18")}</strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_19")}<strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_20")}</strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_21")}</div>
                    </div>

                    <div className={styles.simGrid}>
                        {/* Interactive Sliders */}
                        <div className={styles.inputCard}>
                            <h3>{readData("components.Clerio.ComplianceView", "ComplianceView_text_22")}</h3>
                            
                            <div className={styles.inputGroup}>
                                <div className={styles.inputLabelRow}>
                                    <span>{readData("components.Clerio.ComplianceView", "ComplianceView_text_23")}</span>
                                    <strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_24")}{monthlyGross.toLocaleString()}</strong>
                                </div>
                                <input
                                    type="range"
                                    min="20000"
                                    max="300000"
                                    step="5000"
                                    value={monthlyGross}
                                    onChange={(e) => setMonthlyGross(Number(e.target.value))}
                                    className={styles.rangeInput}
                                />
                            </div>

                            <div className={styles.inputGroup}>
                                <div className={styles.inputLabelRow}>
                                    <span>{readData("components.Clerio.ComplianceView", "ComplianceView_text_25")}{basicPercent}{readData("components.Clerio.ComplianceView", "ComplianceView_text_26")}</span>
                                    <strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_27")}{basic.toLocaleString()}</strong>
                                </div>
                                <input
                                    type="range"
                                    min="20"
                                    max="60"
                                    step="1"
                                    value={basicPercent}
                                    onChange={(e) => setBasicPercent(Number(e.target.value))}
                                    className={styles.rangeInput}
                                />
                            </div>

                            <div className={styles.inputGroup}>
                                <div className={styles.inputLabelRow}>
                                    <span>{readData("components.Clerio.ComplianceView", "ComplianceView_text_28")}{daPercent}{readData("components.Clerio.ComplianceView", "ComplianceView_text_29")}</span>
                                    <strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_30")}{da.toLocaleString()}</strong>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="20"
                                    step="1"
                                    value={daPercent}
                                    onChange={(e) => setDaPercent(Number(e.target.value))}
                                    className={styles.rangeInput}
                                />
                            </div>

                            <div className={styles.inputGroup}>
                                <div className={styles.inputLabelRow}>
                                    <span>{readData("components.Clerio.ComplianceView", "ComplianceView_text_31")}{hraPercent}{readData("components.Clerio.ComplianceView", "ComplianceView_text_32")}</span>
                                    <strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_33")}{hra.toLocaleString()}</strong>
                                </div>
                                <input
                                    type="range"
                                    min="10"
                                    max="50"
                                    step="1"
                                    value={hraPercent}
                                    onChange={(e) => setHraPercent(Number(e.target.value))}
                                    className={styles.rangeInput}
                                />
                            </div>

                            <div className={styles.inputGroup}>
                                <div className={styles.inputLabelRow}>
                                    <span>{readData("components.Clerio.ComplianceView", "ComplianceView_text_34")}{specialPercent}{readData("components.Clerio.ComplianceView", "ComplianceView_text_35")}</span>
                                    <strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_36")}{special.toLocaleString()}</strong>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="50"
                                    step="1"
                                    value={specialPercent}
                                    onChange={(e) => setSpecialPercent(Number(e.target.value))}
                                    className={styles.rangeInput}
                                />
                            </div>

                            <div className={styles.splitBreakdown}>
                                <div className={styles.splitPill} style={{ background: 'var(--info-wash)', color: 'var(--info)' }}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_37")}{basicPercent + daPercent}{readData("components.Clerio.ComplianceView", "ComplianceView_text_38")}</div>
                                <div className={styles.splitPill} style={{ background: excessExcluded > 0 ? '#fee2e2' : '#dcfce7', color: excessExcluded > 0 ? '#991b1b' : '#166534' }}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_39")}{hraPercent + specialPercent}{readData("components.Clerio.ComplianceView", "ComplianceView_text_40")}{excessExcluded > 0 ? readData("components.Clerio.ComplianceView", "display_10") : readData("components.Clerio.ComplianceView", "display_11")}
                                </div>
                            </div>
                        </div>

                        {/* Wage Floor Calculation Engine Result */}
                        <div className={styles.resultCard}>
                            <h3>{readData("components.Clerio.ComplianceView", "ComplianceView_text_41")}</h3>
                            
                            <div className={styles.metricComparison}>
                                <div className={styles.compBlock}>
                                    <span className={styles.compLabel}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_42")}</span>
                                    <div className={styles.compVal}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_43")}{currentWageBase.toLocaleString()}</div>
                                    <span className={styles.compSub}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_44")}{basicPercent + daPercent}{readData("components.Clerio.ComplianceView", "ComplianceView_text_45")}</span>
                                </div>

                                <div className={styles.arrowIcon}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_46")}</div>

                                <div className={`${styles.compBlock} ${excessExcluded > 0 ? styles.compBlockAlert : styles.compBlockSuccess}`}>
                                    <span className={styles.compLabel}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_47")}</span>
                                    <div className={styles.compVal}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_48")}{newWageBase.toLocaleString()}</div>
                                    <span className={styles.compSub}>
                                        {excessExcluded > 0
                                            ?translateText("components.Clerio.ComplianceView","text_bab9d39e28", {value1: String(excessExcluded.toLocaleString())})
                                            : readData("components.Clerio.ComplianceView", "display_12")
                                        }
                                    </span>
                                </div>
                            </div>

                            {/* Cascading Impact Table */}
                            <div className={styles.cascadeTableWrapper}>
                                <table className={styles.cascadeTable}>
                                    <thead>
                                        <tr>
                                            <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_49")}</th>
                                            <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_50")}</th>
                                            <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_51")}</th>
                                            <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_52")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td>
                                                <strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_53")}</strong>
                                                <div className={styles.tableHint}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_54")}</div>
                                            </td>
                                            <td>{readData("components.Clerio.ComplianceView", "ComplianceView_text_55")}{oldPFEmployer.toLocaleString()}</td>
                                            <td className={styles.boldCell}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_56")}{newPFEmployer.toLocaleString()}</td>
                                            <td className={pfVariance > 0 ? styles.textRed : styles.textGreen}>
                                                {pfVariance > 0 ?translateText("components.Clerio.ComplianceView","text_70966a5717", {value1: String(pfVariance.toLocaleString())}) : readData("components.Clerio.ComplianceView", "display_13")}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>
                                                <strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_57")}</strong>
                                                <div className={styles.tableHint}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_58")}</div>
                                            </td>
                                            <td>{readData("components.Clerio.ComplianceView", "ComplianceView_text_59")}{oldGratuityMonthly.toLocaleString()}</td>
                                            <td className={styles.boldCell}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_60")}{newGratuityMonthly.toLocaleString()}</td>
                                            <td className={gratuityVariance > 0 ? styles.textRed : styles.textGreen}>
                                                {gratuityVariance > 0 ?translateText("components.Clerio.ComplianceView","text_70966a5717", {value1: String(gratuityVariance.toLocaleString())}) : readData("components.Clerio.ComplianceView", "display_14")}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>
                                                <strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_61")}</strong>
                                                <div className={styles.tableHint}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_62")}</div>
                                            </td>
                                            <td>{readData("components.Clerio.ComplianceView", "ComplianceView_text_63")}{oldPFEmployee.toLocaleString()}</td>
                                            <td className={styles.boldCell}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_64")}{newPFEmployee.toLocaleString()}</td>
                                            <td className={pfVariance > 0 ? styles.textAmber : styles.textGreen}>
                                                {pfVariance > 0 ?translateText("components.Clerio.ComplianceView","text_dc58967752", {value1: String(pfVariance.toLocaleString())}) : readData("components.Clerio.ComplianceView", "display_15")}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>
                                                <strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_65")}</strong>
                                                <div className={styles.tableHint}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_66")}</div>
                                            </td>
                                            <td>{readData("components.Clerio.ComplianceView", "ComplianceView_text_67")}{oldTakeHome.toLocaleString()}</td>
                                            <td className={styles.boldCell}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_68")}{newTakeHome.toLocaleString()}</td>
                                            <td className={pfVariance > 0 ? styles.textAmber : styles.textGreen}>
                                                {pfVariance > 0 ?translateText("components.Clerio.ComplianceView","text_ea4562ebf8", {value1: String(pfVariance.toLocaleString())}) : readData("components.Clerio.ComplianceView", "display_16")}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Strategic Advisory */}
                            <div className={styles.advisorBox}>
                                <strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_69")}</strong>
                                <p>{readData("components.Clerio.ComplianceView", "ComplianceView_text_70")}{pfVariance.toLocaleString()}{readData("components.Clerio.ComplianceView", "ComplianceView_text_71")}{statutoryFloor.toLocaleString()}{readData("components.Clerio.ComplianceView", "ComplianceView_text_72")}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: STATUTORY OBLIGATION CALENDAR */}
            {activeTab === 'calendar' && (
                <div className={styles.calendarSection}>
                    <div className={styles.calendarStats}>
                        <div className={styles.statCard}>
                            <span className={styles.statTitle}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_73")}</span>
                            <div className={styles.statNumber}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_74")}</div>
                            <span className={styles.statSub}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_75")}</span>
                        </div>
                        <div className={styles.statCard}>
                            <span className={styles.statTitle}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_76")}</span>
                            <div className={styles.statNumber}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_77")}</div>
                            <span className={styles.statSub}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_78")}</span>
                        </div>
                        <div className={styles.statCard}>
                            <span className={styles.statTitle}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_79")}</span>
                            <div className={styles.statNumber} style={{ color: '#16a34a' }}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_80")}</div>
                            <span className={styles.statSub}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_81")}</span>
                        </div>
                    </div>

                    {/* Obligations Table */}
                    <div className={styles.tableCard}>
                        <div className={styles.tableHeader}>
                            <h3>{readData("components.Clerio.ComplianceView", "ComplianceView_text_82")}</h3>
                            <div className={styles.filterBtns}>
                                <button className={styles.filterBtnActive}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_83")}</button>
                                <button className={styles.filterBtn}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_84")}</button>
                                <button className={styles.filterBtn}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_85")}</button>
                            </div>
                        </div>

                        <table className={styles.dataTable}>
                            <thead>
                                <tr>
                                    <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_86")}</th>
                                    <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_87")}</th>
                                    <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_88")}</th>
                                    <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_89")}</th>
                                    <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_90")}</th>
                                    <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_91")}</th>
                                    <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_92")}</th>
                                    <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_93")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {obligations.map((item) => (
                                    <tr key={item.id}>
                                        <td>
                                            <strong>{item.type}</strong>
                                            <div className={styles.tableHint}>{item.act}</div>
                                        </td>
                                        <td>{item.jurisdiction}</td>
                                        <td><span className={styles.periodBadge}>{item.period}</span></td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <Clock size={13} color="#64748b" />
                                                <strong>{item.dueDate}</strong>
                                            </div>
                                        </td>
                                        <td className={styles.boldCell}>{item.amount}</td>
                                        <td>{item.owner}</td>
                                        <td>
                                            <span className={`
                                                ${styles.statusBadge}
                                                ${item.status === 'Filed' ? styles.badgeGreen : ''}
                                                ${item.status === 'Pending Review' ? styles.badgeAmber : ''}
                                                ${item.status === 'Upcoming' ? styles.badgeGray : ''}
                                                ${item.status === 'In Prep' ? styles.badgeBlue : ''}
                                            `}>
                                                {item.status === 'Filed' && <CheckCircle2 size={12} />}
                                                {item.status === 'Pending Review' && <AlertTriangle size={12} />}
                                                {item.status}
                                            </span>
                                        </td>
                                        <td>
                                            {item.status === 'Filed' ? (
                                                <button className={styles.btnTableAction} onClick={() => setSelectedChallan(item)}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_94")}</button>
                                            ) : (
                                                <button className={styles.btnTableActionPrimary} onClick={() => launchAction('filing', { obligation: item.type, period: item.period || '' })}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_95")}</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Challan View Modal */}
                    {selectedChallan && (
                        <div className={styles.modalOverlay} onClick={() => setSelectedChallan(null)}>
                            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                                <div className={styles.modalHeader}>
                                    <h3>{readData("components.Clerio.ComplianceView", "ComplianceView_text_96")}</h3>
                                    <button className={styles.closeBtn} onClick={() => setSelectedChallan(null)}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_97")}</button>
                                </div>
                                <div className={styles.modalBody}>
                                    <div className={styles.receiptProof}>
                                        <div className={styles.receiptHeader}>
                                            <ShieldCheck size={32} color="#16a34a" />
                                            <div>
                                                <h4>{readData("components.Clerio.ComplianceView", "ComplianceView_text_98")}</h4>
                                                <span>{readData("components.Clerio.ComplianceView", "ComplianceView_text_99")}{selectedChallan.challanId}</span>
                                            </div>
                                        </div>
                                        <div className={styles.receiptGrid}>
                                            <div><strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_100")}</strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_101")}</div>
                                            <div><strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_102")}</strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_103")}</div>
                                            <div><strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_104")}</strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_105")}</div>
                                            <div><strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_106")}</strong> {selectedChallan.employees}</div>
                                            <div><strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_107")}</strong> {selectedChallan.amount}</div>
                                            <div><strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_108")}</strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_109")}</div>
                                            <div><strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_110")}</strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_111")}</div>
                                            <div><strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_112")}</strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_113")}</div>
                                        </div>
                                    </div>
                                    <div className={styles.modalFooter}>
                                        <button className={styles.btnSecondary} onClick={() => setSelectedChallan(null)}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_114")}</button>
                                        <button className={styles.btnPrimary} disabled title={readData("components.Clerio.ComplianceView", "unavailableAction")}>
                                            <Download size={14} />{readData("components.Clerio.ComplianceView", "ComplianceView_text_115")}</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB: FACTORY ACT STATUTORY REGISTERS (DEMO POINT 17) */}
            {activeTab === 'factory_registers' && (
                <div className={styles.simulatorSection}>
                    <div className={styles.simNotice}>
                        <HardHat size={18} color="#ea580c" />
                        <div>
                            <strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_116")}</strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_117")}</div>
                    </div>

                    {/* Sub-toggle for Form 28 / Form 18 / Form 36 */}
                    <div className={styles.subTabsNav}>
                        <button
                            className={`${styles.subTabBtn} ${factorySubTab === 'form28' ? styles.activeSubTab : ''}`}
                            onClick={() => setFactorySubTab('form28')}
                        >
                            <FileSpreadsheet size={15} />{readData("components.Clerio.ComplianceView", "ComplianceView_text_118")}</button>
                        <button
                            className={`${styles.subTabBtn} ${factorySubTab === 'form18' ? styles.activeSubTab : ''}`}
                            onClick={() => setFactorySubTab('form18')}
                        >
                            <AlertTriangle size={15} />{readData("components.Clerio.ComplianceView", "ComplianceView_text_119")}{statutoryAccidents.length}{readData("components.Clerio.ComplianceView", "ComplianceView_text_120")}</button>
                        <button
                            className={`${styles.subTabBtn} ${factorySubTab === 'form36' ? styles.activeSubTab : ''}`}
                            onClick={() => setFactorySubTab('form36')}
                        >
                            <FileText size={15} />{readData("components.Clerio.ComplianceView", "ComplianceView_text_121")}{factoryInspections.length}{readData("components.Clerio.ComplianceView", "ComplianceView_text_122")}</button>
                    </div>

                    {/* FORM 28 MUSTER ROLL */}
                    {factorySubTab === 'form28' && (
                        <div>
                            <div className={styles.statGrid4}>
                                <div className={styles.statCard}>
                                    <span className={styles.statCardTitle}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_123")}</span>
                                    <span className={styles.statCardValue}>{statutoryMusterRoll.totalAdultWorkers}{readData("components.Clerio.ComplianceView", "ComplianceView_text_124")}</span>
                                    <span className={styles.statCardSub}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_125")}{statutoryMusterRoll.factoryRegistrationNo}</span>
                                </div>
                                <div className={styles.statCard}>
                                    <span className={styles.statCardTitle}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_126")}</span>
                                    <span className={styles.statCardValue}>{statutoryMusterRoll.totalNormalHoursWorked}{readData("components.Clerio.ComplianceView", "ComplianceView_text_127")}</span>
                                    <span className={styles.statCardSub}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_128")}</span>
                                </div>
                                <div className={styles.statCard}>
                                    <span className={styles.statCardTitle}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_129")}</span>
                                    <span className={styles.statCardValue} style={{ color: '#ea580c' }}>{statutoryMusterRoll.totalOvertimeHoursWorked}{readData("components.Clerio.ComplianceView", "ComplianceView_text_130")}</span>
                                    <span className={styles.statCardSub}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_131")}</span>
                                </div>
                                <div className={styles.statCard}>
                                    <span className={styles.statCardTitle}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_132")}</span>
                                    <span className={styles.statCardValue} style={{ color: '#16a34a' }}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_133")}</span>
                                    <span className={styles.statCardSub}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_134")}</span>
                                </div>
                            </div>

                            <div className={styles.cardPanel}>
                                <div className={styles.panelHeader}>
                                    <div>
                                        <h3><FileSpreadsheet size={18} color="#2563eb" /> {statutoryMusterRoll.formName}</h3>
                                        <p>{statutoryMusterRoll.statutoryAuthority}{readData("components.Clerio.ComplianceView", "ComplianceView_text_135")}{statutoryMusterRoll.factoryLocation}</p>
                                    </div>
                                    <button className={styles.btnSecondary} disabled title={readData("components.Clerio.ComplianceView", "unavailableAction")}>
                                        <Download size={14} />{readData("components.Clerio.ComplianceView", "ComplianceView_text_136")}</button>
                                </div>

                                <div className={styles.musterTableWrap}>
                                    <table className={styles.musterTable}>
                                        <thead>
                                            <tr>
                                                <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_137")}</th>
                                                <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_138")}</th>
                                                <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_139")}</th>
                                                <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_140")}</th>
                                                <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_141")}</th>
                                                <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_142")}</th>
                                                <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_143")}</th>
                                                <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_144")}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {statutoryMusterRoll.workers.map((worker, wIdx) => (
                                                <tr key={wIdx}>
                                                    <td>
                                                        <strong>{worker.name}</strong>
                                                        <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{worker.tokenNo}{readData("components.Clerio.ComplianceView", "ComplianceView_text_145")}{worker.sex}{readData("components.Clerio.ComplianceView", "ComplianceView_text_146")}</div>
                                                    </td>
                                                    <td>
                                                        <span className={styles.tagBlue}>{worker.relay}</span>
                                                    </td>
                                                    <td>{worker.natureOfWork}</td>
                                                    <td>
                                                        <div className={styles.dayPillsScroll}>
                                                            {worker.attendanceDays.map((d, dIdx) => (
                                                                <span
                                                                    key={dIdx}
                                                                    className={`${styles.dayPill} ${
                                                                        d.mark === 'P' ? styles.pillPresent :
                                                                        d.mark === 'WO' ? styles.pillOff :
                                                                        d.mark === 'CL' ? styles.pillLeave : styles.pillEL
                                                                    }`}
                                                                    title={translateText("components.Clerio.ComplianceView","text_70b427bc30", {value1: String(d.day), value2: String(d.mark), value3: String(d.hours), value4: String(d.ot)})}
                                                                >
                                                                    {d.mark === 'P' ? (d.ot > 0 ? readData("components.Clerio.ComplianceView", "display_17") : readData("components.Clerio.ComplianceView", "display_18")) : d.mark}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td style={{ fontWeight: 600 }}>{worker.totalDays}</td>
                                                    <td>{worker.normalHours}{readData("components.Clerio.ComplianceView", "ComplianceView_text_147")}</td>
                                                    <td style={{ fontWeight: 600, color: worker.otHours > 10 ? '#ea580c' : 'inherit' }}>
                                                        {worker.otHours}{readData("components.Clerio.ComplianceView", "ComplianceView_text_148")}</td>
                                                    <td>
                                                        <span className={styles.tagGreen}>{worker.grossTokens}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* FORM 18 ACCIDENTS */}
                    {factorySubTab === 'form18' && (
                        <div>
                            <div className={styles.cardPanel}>
                                <div className={styles.panelHeader}>
                                    <div>
                                        <h3><AlertTriangle size={18} color="#ea580c" />{readData("components.Clerio.ComplianceView", "ComplianceView_text_149")}</h3>
                                        <p>{readData("components.Clerio.ComplianceView", "ComplianceView_text_150")}</p>
                                    </div>
                                    <button className={styles.btnPrimary} onClick={() => setShowAccidentModal(true)}>
                                        <AlertTriangle size={14} />{readData("components.Clerio.ComplianceView", "ComplianceView_text_151")}</button>
                                </div>

                                {statutoryAccidents.map((acc, idx) => (
                                    <div key={idx} className={styles.incidentCard}>
                                        <div className={styles.incidentHeader}>
                                            <div className={styles.incidentTitle}>
                                                <AlertCircle size={18} color="#ea580c" />
                                                <span>{acc.noticeId}{readData("components.Clerio.ComplianceView", "ComplianceView_text_152")}{acc.injuredPerson.name}{readData("components.Clerio.ComplianceView", "ComplianceView_text_153")}{acc.injuredPerson.tokenNo}{readData("components.Clerio.ComplianceView", "ComplianceView_text_154")}</span>
                                            </div>
                                            <span className={styles.tagGreen}>
                                                <CheckCircle2 size={12} />{readData("components.Clerio.ComplianceView", "ComplianceView_text_155")}{acc.inspectorateFilingDate}
                                            </span>
                                        </div>

                                        <div className={styles.incidentMeta}>
                                            <div className={styles.incidentMetaItem}>
                                                <span>{readData("components.Clerio.ComplianceView", "ComplianceView_text_156")}</span>
                                                <strong>{acc.dateOfOccurrence}{readData("components.Clerio.ComplianceView", "ComplianceView_text_157")}{acc.exactTime}</strong>
                                            </div>
                                            <div className={styles.incidentMetaItem}>
                                                <span>{readData("components.Clerio.ComplianceView", "ComplianceView_text_158")}</span>
                                                <strong>{acc.exactPlace}</strong>
                                            </div>
                                            <div className={styles.incidentMetaItem}>
                                                <span>{readData("components.Clerio.ComplianceView", "ComplianceView_text_159")}</span>
                                                <strong>{acc.injuredPerson.occupation}{readData("components.Clerio.ComplianceView", "ComplianceView_text_160")}{acc.injuredPerson.age}{readData("components.Clerio.ComplianceView", "ComplianceView_text_161")}{acc.injuredPerson.sex}{readData("components.Clerio.ComplianceView", "ComplianceView_text_162")}</strong>
                                            </div>
                                            <div className={styles.incidentMetaItem}>
                                                <span>{readData("components.Clerio.ComplianceView", "ComplianceView_text_163")}</span>
                                                <strong style={{ color: '#ea580c' }}>{acc.lostWorkdays}{readData("components.Clerio.ComplianceView", "ComplianceView_text_164")}</strong>
                                            </div>
                                        </div>

                                        <div style={{ fontSize: '13px', lineHeight: 1.6 }}>
                                            <div><strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_165")}</strong> {acc.natureOfInjury}</div>
                                            <div><strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_166")}</strong> {acc.causeOfAccident}</div>
                                            <div><strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_167")}</strong> {acc.remedialActions}</div>
                                            <div style={{ color: 'var(--text-3)', fontSize: '11px', marginTop: '0.25rem' }}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_168")}{acc.investigatingOfficer}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* FORM 36 INSPECTIONS */}
                    {factorySubTab === 'form36' && (
                        <div>
                            <div className={styles.cardPanel}>
                                <div className={styles.panelHeader}>
                                    <div>
                                        <h3><FileText size={18} color="#0284c7" />{readData("components.Clerio.ComplianceView", "ComplianceView_text_169")}</h3>
                                        <p>{readData("components.Clerio.ComplianceView", "ComplianceView_text_170")}</p>
                                    </div>
                                    <button className={styles.btnSecondary} onClick={() => launchAction('inspector')}>
                                        <FileCheck size={14} />{readData("components.Clerio.ComplianceView", "ComplianceView_text_171")}</button>
                                </div>

                                {factoryInspections.map((insp, idx) => (
                                    <div key={idx} className={styles.inspectionCard}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <strong style={{ color: '#0284c7', fontSize: '1.05rem' }}>{insp.inspectionId}{readData("components.Clerio.ComplianceView", "ComplianceView_text_172")}{insp.inspectionDate}</strong>
                                            <span className={insp.complianceStatus === 'CLOSED' ? styles.tagGreen : styles.tagBlue}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_173")}{insp.complianceStatus}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '0.5rem' }}>
                                            <strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_174")}</strong> {insp.inspectorName}{readData("components.Clerio.ComplianceView", "ComplianceView_text_175")}{insp.inspectorOffice}{readData("components.Clerio.ComplianceView", "ComplianceView_text_176")}</div>
                                        <div style={{ background: 'var(--card-2)', padding: '0.85rem', borderRadius: 'var(--r-control)', fontSize: '13px', lineHeight: 1.6, marginBottom: '0.5rem' }}>
                                            <div><strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_177")}</strong> {insp.statutoryObservations}</div>
                                            <div style={{ marginTop: '0.25rem' }}><strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_178")}</strong> {insp.remedialDirections}</div>
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-3)', display: 'flex', justifyContent: 'space-between' }}>
                                            <span>{readData("components.Clerio.ComplianceView", "ComplianceView_text_179")}{insp.certifyingManager}</span>
                                            <span>{readData("components.Clerio.ComplianceView", "ComplianceView_text_180")}{insp.closureDate}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB: FORM F GRATUITY STUDIO (DEMO POINT 26) */}
            {activeTab === 'form_f_gratuity' && (
                <div className={styles.simulatorSection}>
                    <div className={styles.simNotice}>
                        <FileCheck size={18} color="#16a34a" />
                        <div>
                            <strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_181")}</strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_182")}</div>
                    </div>

                    <div className={styles.simGrid}>
                        {/* Nomination Setup Column */}
                        <div className={styles.inputCard}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 0 }}>
                                <FileText size={18} color="#2563eb" />{readData("components.Clerio.ComplianceView", "ComplianceView_text_183")}</h3>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '0.35rem' }}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_184")}</label>
                                <select
                                    style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--r-control)', border: '1px solid var(--line)', background: 'var(--card)' }}
                                    value={selectedEmployeeId}
                                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                                >
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.name}{readData("components.Clerio.ComplianceView", "ComplianceView_text_185")}{emp.id}{readData("components.Clerio.ComplianceView", "ComplianceView_text_186")}{emp.department}{readData("components.Clerio.ComplianceView", "ComplianceView_text_187")}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '0.35rem' }}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_188")}</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    {SAMPLE_FORM_F_TEMPLATES.map((tmpl, idx) => (
                                        <button
                                            key={idx}
                                            className={styles.btnSecondary}
                                            style={{ justifyContent: 'flex-start', fontSize: '12px', padding: '0.45rem 0.75rem' }}
                                            onClick={() => setFormFNominees(tmpl.nominees)}
                                        >
                                            <ArrowRight size={13} /> {tmpl.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Nominees Table Builder */}
                            <div style={{ marginBottom: '1.25rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-2)' }}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_189")}{formFNominees.length}{readData("components.Clerio.ComplianceView", "ComplianceView_text_190")}</label>
                                    {(() => {
                                        const validation = validateFormFNominees(formFNominees);
                                        return validation.isValid ? (
                                            <span className={styles.allocationValidBadge}>
                                                <CheckCircle size={12} />{readData("components.Clerio.ComplianceView", "ComplianceView_text_191")}</span>
                                        ) : (
                                            <span className={styles.allocationInvalidBadge}>
                                                <AlertTriangle size={12} />{readData("components.Clerio.ComplianceView", "ComplianceView_text_192")}{validation.totalPercentage}{readData("components.Clerio.ComplianceView", "ComplianceView_text_193")}</span>
                                        );
                                    })()}
                                </div>

                                {formFNominees.map((nom, idx) => (
                                    <div key={idx} style={{ background: 'var(--card-2)', padding: '0.75rem', borderRadius: 'var(--r-control)', border: '1px solid var(--line)', marginBottom: '0.5rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                                            <strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_194")}{idx + 1}{readData("components.Clerio.ComplianceView", "ComplianceView_text_195")}{nom.name}</strong>
                                            <span style={{ fontWeight: 700, color: '#2563eb' }}>{nom.sharePercent}{readData("components.Clerio.ComplianceView", "ComplianceView_text_196")}</span>
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-2)', lineHeight: 1.5 }}>
                                            <div>{readData("components.Clerio.ComplianceView", "ComplianceView_text_197")}{nom.relationship}{readData("components.Clerio.ComplianceView", "ComplianceView_text_198")}{nom.age}{readData("components.Clerio.ComplianceView", "ComplianceView_text_199")}</div>
                                            <div>{readData("components.Clerio.ComplianceView", "ComplianceView_text_200")}{nom.address}</div>
                                            <div>{readData("components.Clerio.ComplianceView", "ComplianceView_text_201")}{nom.contingency}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button
                                className={styles.btnPrimary}
                                style={{ width: '100%', justifyContent: 'center' }}
                                disabled={!validateFormFNominees(formFNominees).isValid}
                                onClick={() => {
                                    const targetEmp = employees.find(e => e.id === selectedEmployeeId) || {
                                        id: selectedEmployeeId,
                                        ...readData("components.Clerio.ComplianceView", "targetEmp_fields_202")
                                    };
                                    const doc = generateFormFDeclaration(targetEmp, formFNominees);
                                    setFormFDoc(doc);
                                    setShowFormFModal(true);
                                }}
                            >
                                <Printer size={16} />{readData("components.Clerio.ComplianceView", "ComplianceView_text_203")}</button>
                        </div>

                        {/* Live Form F Document Preview */}
                        <div className={styles.resultCard}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 0 }}>
                                <Eye size={18} color="#059669" />{readData("components.Clerio.ComplianceView", "ComplianceView_text_204")}</h3>

                            {(() => {
                                const targetEmp = employees.find(e => e.id === selectedEmployeeId) || {
                                    id: selectedEmployeeId,
                                    ...readData("components.Clerio.ComplianceView", "targetEmp_fields_205")
                                };
                                const sampleDoc = generateFormFDeclaration(targetEmp, formFNominees);

                                return (
                                    <div className={styles.formFCertificate}>
                                        <div className={styles.formFHeader}>
                                            <h2>{readData("components.Clerio.ComplianceView", "ComplianceView_text_206")}</h2>
                                            <h4>{readData("components.Clerio.ComplianceView", "ComplianceView_text_207")}</h4>
                                            <p><strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_208")}</strong></p>
                                            <p style={{ marginTop: '0.5rem', fontSize: '11px' }}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_209")}{sampleDoc.establishment.name}<br />
                                                {sampleDoc.establishment.registeredAddress}
                                            </p>
                                        </div>

                                        <div className={styles.formFBody}>
                                            <p>{readData("components.Clerio.ComplianceView", "ComplianceView_text_210")}<strong>{sampleDoc.employee.name}</strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_211")}</p>

                                            <div style={{ background: '#f8fafc', padding: '0.75rem', border: '1px solid #cbd5e1', marginBottom: '1rem', fontSize: '12px' }}>
                                                <strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_212")}</strong><br />{readData("components.Clerio.ComplianceView", "ComplianceView_text_213")}{sampleDoc.employee.name}{readData("components.Clerio.ComplianceView", "ComplianceView_text_214")}{sampleDoc.employee.sex}{readData("components.Clerio.ComplianceView", "ComplianceView_text_215")}{sampleDoc.employee.maritalStatus}<br />{readData("components.Clerio.ComplianceView", "ComplianceView_text_216")}{sampleDoc.employee.department}{readData("components.Clerio.ComplianceView", "ComplianceView_text_217")}{sampleDoc.employee.ticketOrTokenNo}<br />{readData("components.Clerio.ComplianceView", "ComplianceView_text_218")}{sampleDoc.employee.dateOfAppointment}{readData("components.Clerio.ComplianceView", "ComplianceView_text_219")}{sampleDoc.employee.fatherOrSpouseName}
                                            </div>

                                            <table className={styles.formFTable}>
                                                <thead>
                                                    <tr>
                                                        <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_220")}</th>
                                                        <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_221")}</th>
                                                        <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_222")}</th>
                                                        <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_223")}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {sampleDoc.nominees.map((n, i) => (
                                                        <tr key={i}>
                                                            <td>
                                                                <strong>{n.name}</strong><br />
                                                                <span style={{ fontSize: '10px' }}>{n.address}</span>
                                                            </td>
                                                            <td>{n.relationship}</td>
                                                            <td>{n.age}{readData("components.Clerio.ComplianceView", "ComplianceView_text_224")}</td>
                                                            <td><strong>{n.sharePercent}{readData("components.Clerio.ComplianceView", "ComplianceView_text_225")}</strong></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>

                                            <div className={styles.formFSignatures}>
                                                <div className={styles.sigBlock}>
                                                    <div className={styles.sigLine}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_226")}</div>
                                                </div>
                                                <div className={styles.sigBlock}>
                                                    <div className={styles.sigLine}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_227")}{sampleDoc.witnesses[0].name}{readData("components.Clerio.ComplianceView", "ComplianceView_text_228")}</div>
                                                </div>
                                                <div className={styles.sigBlock}>
                                                    <div className={styles.sigLine}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_229")}{sampleDoc.witnesses[1].name}{readData("components.Clerio.ComplianceView", "ComplianceView_text_230")}</div>
                                                </div>
                                            </div>

                                            <div className={styles.formFEmployerSeal}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_231")}</strong><br />
                                                        <span style={{ fontSize: '11px', color: '#475569' }}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_232")}{sampleDoc.employerAcknowledgement.registrationBookSerial}{readData("components.Clerio.ComplianceView", "ComplianceView_text_233")}{sampleDoc.employerAcknowledgement.dateReceived}
                                                        </span>
                                                    </div>
                                                    <div className={styles.tagGreen}>
                                                        {sampleDoc.employerAcknowledgement.seal}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: ERP MASTER SYNC & GL POSTING QUEUE (DEMO POINTS 14 & 15) */}
            {activeTab === 'erp_integration' && (
                <div className={styles.simulatorSection}>
                    <div className={styles.simNotice}>
                        <Server size={18} color="#2563eb" />
                        <div>
                            <strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_234")}</strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_235")}</div>
                    </div>

                    {/* ERP Connector Cards */}
                    <div className={styles.connectorGrid}>
                        <div className={styles.connectorCard}>
                            <div className={styles.connectorInfo}>
                                <h4>{readData("components.Clerio.ComplianceView", "ComplianceView_text_236")}</h4>
                                <p>{readData("components.Clerio.ComplianceView", "ComplianceView_text_237")}</p>
                            </div>
                            <span className={styles.connectedStatus}><CheckCircle2 size={13} />{readData("components.Clerio.ComplianceView", "ComplianceView_text_238")}</span>
                        </div>
                        <div className={styles.connectorCard}>
                            <div className={styles.connectorInfo}>
                                <h4>{readData("components.Clerio.ComplianceView", "ComplianceView_text_239")}</h4>
                                <p>{readData("components.Clerio.ComplianceView", "ComplianceView_text_240")}</p>
                            </div>
                            <span className={styles.connectedStatus}><CheckCircle2 size={13} />{readData("components.Clerio.ComplianceView", "ComplianceView_text_241")}</span>
                        </div>
                    </div>

                    {/* 1. DEMO POINT 14: FIELD OWNERSHIP POLICY & INBOUND SYNC LOG */}
                    <div className={styles.cardPanel}>
                        <div className={styles.panelHeader}>
                            <div>
                                <h3><Database size={18} color="#2563eb" />{readData("components.Clerio.ComplianceView", "ComplianceView_text_242")}</h3>
                                <p>{readData("components.Clerio.ComplianceView", "ComplianceView_text_243")}</p>
                            </div>
                            <button
                                className={styles.btnPrimary}
                                onClick={() => triggerErpSync('SAP S/4HANA (BAPI_EMPLOYEE_GETDATA)')}
                            >
                                <RefreshCw size={14} />{readData("components.Clerio.ComplianceView", "ComplianceView_text_244")}</button>
                        </div>

                        {/* Ownership Matrix Table */}
                        <div style={{ marginBottom: '1.25rem' }}>
                            <table className={styles.musterTable}>
                                <thead>
                                    <tr>
                                        <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_245")}</th>
                                        <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_246")}</th>
                                        <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_247")}</th>
                                        <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_248")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td><strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_249")}</strong></td>
                                        <td><span className={styles.tagBlue}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_250")}</span></td>
                                        <td>{readData("components.Clerio.ComplianceView", "ComplianceView_text_251")}</td>
                                        <td><span style={{ fontSize: '12px', color: 'var(--text-2)' }}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_252")}</span></td>
                                    </tr>
                                    <tr>
                                        <td><strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_253")}</strong></td>
                                        <td><span className={styles.tagGreen}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_254")}</span></td>
                                        <td>{readData("components.Clerio.ComplianceView", "ComplianceView_text_255")}</td>
                                        <td><span style={{ fontSize: '12px', color: '#ea580c', fontWeight: 600 }}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_256")}</span></td>
                                    </tr>
                                    <tr>
                                        <td><strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_257")}</strong></td>
                                        <td><span className={styles.tagAmber}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_258")}</span></td>
                                        <td>{readData("components.Clerio.ComplianceView", "ComplianceView_text_259")}</td>
                                        <td><span style={{ fontSize: '12px', color: 'var(--text-2)' }}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_260")}</span></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Inbound Sync Logs */}
                        <h4 style={{ margin: '1rem 0 0.5rem 0', fontSize: '0.95rem' }}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_261")}{erpSyncLogs.length}{readData("components.Clerio.ComplianceView", "ComplianceView_text_262")}</h4>
                        <div className={styles.musterTableWrap}>
                            <table className={styles.musterTable}>
                                <thead>
                                    <tr>
                                        <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_263")}</th>
                                        <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_264")}</th>
                                        <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_265")}</th>
                                        <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_266")}</th>
                                        <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_267")}</th>
                                        <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_268")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {erpSyncLogs.map((log, lIdx) => (
                                        <tr key={lIdx}>
                                            <td>
                                                <strong>{log.batchId}</strong>
                                                <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{log.timestamp}</div>
                                            </td>
                                            <td>{log.connector}</td>
                                            <td>{log.recordsReceived}</td>
                                            <td style={{ fontWeight: 600, color: '#16a34a' }}>{log.recordsUpdated}</td>
                                            <td style={{ fontWeight: 600, color: log.conflictsBlocked > 0 ? '#ea580c' : 'inherit' }}>
                                                {log.conflictsBlocked}{readData("components.Clerio.ComplianceView", "ComplianceView_text_269")}</td>
                                            <td>
                                                <span className={log.status === 'SUCCESS' ? styles.tagGreen : styles.tagAmber}>
                                                    {log.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 2. DEMO POINT 15: FINANCE-GRADE GL ACCOUNT POSTING QUEUE */}
                    <div className={styles.cardPanel}>
                        <div className={styles.panelHeader}>
                            <div>
                                <h3><Scale size={18} color="#16a34a" />{readData("components.Clerio.ComplianceView", "ComplianceView_text_270")}</h3>
                                <p>{readData("components.Clerio.ComplianceView", "ComplianceView_text_271")}</p>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <span className={styles.allocationValidBadge}>
                                    <CheckCircle2 size={13} />{readData("components.Clerio.ComplianceView", "ComplianceView_text_272")}</span>
                            </div>
                        </div>

                        <div className={styles.musterTableWrap}>
                            <table className={styles.musterTable}>
                                <thead>
                                    <tr>
                                        <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_273")}</th>
                                        <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_274")}</th>
                                        <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_275")}</th>
                                        <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_276")}</th>
                                        <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_277")}</th>
                                        <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_278")}</th>
                                        <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_279")}</th>
                                        <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_280")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {erpPostingQueue.map((batch, bIdx) => {
                                        const validation = validateGLBatchBalance(batch);
                                        return (
                                            <tr key={bIdx}>
                                                <td>
                                                    <strong>{batch.batchId}</strong>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{batch.postingDate}</div>
                                                </td>
                                                <td>
                                                    <strong>{batch.period}</strong>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>{batch.targetErp}</div>
                                                </td>
                                                <td>
                                                    <div style={{ fontSize: '11px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                        {Object.entries(batch.costCenterSummary).map(([cc, data]) => (
                                                            <span key={cc} className={styles.tagBlue}>{cc}</span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ fontFamily: 'var(--f-num)', fontSize: '12px' }}>
                                                        <div>{readData("components.Clerio.ComplianceView", "ComplianceView_text_281")}{batch.totalDebits.toLocaleString('en-IN', readData("components.Clerio.ComplianceView", "ComplianceView_282"))}</div>
                                                        <div>{readData("components.Clerio.ComplianceView", "ComplianceView_text_283")}{batch.totalCredits.toLocaleString('en-IN', readData("components.Clerio.ComplianceView", "ComplianceView_284"))}</div>
                                                    </div>
                                                </td>
                                                <td>
                                                    {validation.isValid ? (
                                                        <span className={styles.tagGreen}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_285")}</span>
                                                    ) : (
                                                        <span className={styles.tagAmber}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_286")}{validation.variance}</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <span className={
                                                        batch.status === 'RECONCILED' ? styles.tagGreen :
                                                        batch.status === 'ACKNOWLEDGED' ? styles.tagBlue : styles.tagAmber
                                                    }>
                                                        {batch.status}
                                                    </span>
                                                </td>
                                                <td>
                                                    {batch.ackReceiptId ? (
                                                        <span style={{ fontSize: '11px', fontFamily: 'var(--f-num)', color: 'var(--text-2)' }}>
                                                            {batch.ackReceiptId}
                                                        </span>
                                                    ) : (
                                                        <span style={{ fontSize: '11px', color: 'var(--text-3)', fontStyle: 'italic' }}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_287")}</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                                                        {batch.status === 'QUEUED' && (
                                                            <button
                                                                className={styles.btnPrimary}
                                                                style={{ padding: '0.3rem 0.6rem', fontSize: '11px' }}
                                                                onClick={() => dispatchGLPostingBatch(batch.batchId)}
                                                            >
                                                                <Send size={11} />{readData("components.Clerio.ComplianceView", "ComplianceView_text_288")}</button>
                                                        )}
                                                        {batch.status === 'ACKNOWLEDGED' && (
                                                            <button
                                                                className={styles.btnSecondary}
                                                                style={{ padding: '0.3rem 0.6rem', fontSize: '11px', color: '#16a34a' }}
                                                                onClick={() => reconcileGLBatch(batch.batchId)}
                                                            >
                                                                <CheckCircle size={11} />{readData("components.Clerio.ComplianceView", "ComplianceView_text_289")}</button>
                                                        )}
                                                        <button
                                                            className={styles.btnSecondary}
                                                            style={{ padding: '0.3rem 0.6rem', fontSize: '11px' }}
                                                            onClick={() => setSelectedGLBatch(batch)}
                                                            title={readData("components.Clerio.ComplianceView", "ComplianceView_title_290")}
                                                        >
                                                            <Eye size={11} />{readData("components.Clerio.ComplianceView", "ComplianceView_text_291")}</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: STATE RULE MATRIX */}
            {activeTab === 'matrix' && (
                <div className={styles.matrixSection}>
                    <div className={styles.matrixNotice}>
                        <Scale size={18} color="#059669" />
                        <div>
                            <strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_292")}</strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_293")}</div>
                    </div>

                    <div className={styles.tableCard}>
                        <table className={styles.dataTable}>
                            <thead>
                                <tr>
                                    <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_294")}</th>
                                    <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_295")}</th>
                                    <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_296")}</th>
                                    <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_297")}</th>
                                    <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_298")}</th>
                                    <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_299")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stateMatrix.map((st, idx) => (
                                    <tr key={idx}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <Building2 size={16} color="#64748b" />
                                                <strong>{st.state}</strong>
                                            </div>
                                        </td>
                                        <td><span className={styles.tagGreen}>{st.codeWage}</span></td>
                                        <td><span className={styles.tagBlue}>{st.codeSS}</span></td>
                                        <td className={styles.boldCell}>{st.minWageFloor}</td>
                                        <td>{st.otMultiplier}</td>
                                        <td><span className={styles.textMuted}>{st.nightShiftFemale}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 4: RULE PACKS INSPECTOR */}
            {activeTab === 'packs' && (
                <div className={styles.packsSection}>
                    <div className={styles.packCard}>
                        <div className={styles.packHeader}>
                            <div>
                                <span className={styles.packTag}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_300")}</span>
                                <h3>{readData("components.Clerio.ComplianceView", "ComplianceView_text_301")}</h3>
                                <p>{readData("components.Clerio.ComplianceView", "ComplianceView_text_302")}</p>
                            </div>
                            <div className={styles.testBadge}>
                                <CheckCircle2 size={18} color="#16a34a" />{readData("components.Clerio.ComplianceView", "ComplianceView_text_303")}</div>
                        </div>

                        <div className={styles.codePreview}>
                            <pre>{translateText("components.Clerio.ComplianceView","text_74ca1223f9")}</pre>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 1: FORM 18 INCIDENT FILING */}
            {showAccidentModal && (
                <div className={styles.modalOverlay} onClick={() => setShowAccidentModal(false)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalTitle}>
                            <h3><AlertTriangle size={18} color="#ea580c" />{readData("components.Clerio.ComplianceView", "ComplianceView_text_304")}</h3>
                            <button className={styles.btnSecondary} onClick={() => setShowAccidentModal(false)}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_305")}</button>
                        </div>

                        <form onSubmit={(e) => {
                            e.preventDefault();
                            reportFactoryAccidentForm18(accidentForm);
                            setShowAccidentModal(false);
                        }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 600 }}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_306")}</label>
                                    <input
                                        type="text"
                                        style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--card)' }}
                                        value={accidentForm.injuredPersonName}
                                        onChange={(e) => setAccidentForm({ ...accidentForm, injuredPersonName: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 600 }}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_307")}</label>
                                    <input
                                        type="text"
                                        style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--card)' }}
                                        value={accidentForm.tokenNo}
                                        onChange={(e) => setAccidentForm({ ...accidentForm, tokenNo: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 600 }}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_308")}</label>
                                    <input
                                        type="text"
                                        style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--card)' }}
                                        value={accidentForm.occupation}
                                        onChange={(e) => setAccidentForm({ ...accidentForm, occupation: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 600 }}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_309")}</label>
                                    <input
                                        type="text"
                                        style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--card)' }}
                                        value={accidentForm.exactPlace}
                                        onChange={(e) => setAccidentForm({ ...accidentForm, exactPlace: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 600 }}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_310")}</label>
                                    <input
                                        type="date"
                                        style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--card)' }}
                                        value={accidentForm.dateOfOccurrence}
                                        onChange={(e) => setAccidentForm({ ...accidentForm, dateOfOccurrence: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 600 }}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_311")}</label>
                                    <input
                                        type="number"
                                        min="1"
                                        style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--card)' }}
                                        step="0.5" max="1000000"
                                        value={accidentForm.lostWorkdays}
                                        onChange={(e) => setAccidentForm({ ...accidentForm, lostWorkdays: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ fontSize: '12px', fontWeight: 600 }}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_312")}</label>
                                <input
                                    type="text"
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--card)' }}
                                    value={accidentForm.natureOfInjury}
                                    onChange={(e) => setAccidentForm({ ...accidentForm, natureOfInjury: e.target.value })}
                                    required
                                />
                            </div>

                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ fontSize: '12px', fontWeight: 600 }}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_313")}</label>
                                <textarea
                                    rows={3}
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--card)' }}
                                    value={accidentForm.remedialActions}
                                    onChange={(e) => setAccidentForm({ ...accidentForm, remedialActions: e.target.value })}
                                    required
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                <button type="button" className={styles.btnSecondary} onClick={() => setShowAccidentModal(false)}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_314")}</button>
                                <button type="submit" className={styles.btnPrimary}>
                                    <Send size={14} />{readData("components.Clerio.ComplianceView", "ComplianceView_text_315")}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: FORM F STATUTORY CERTIFICATE MODAL */}
            {showFormFModal && formFDoc && (
                <div className={styles.modalOverlay} onClick={() => setShowFormFModal(false)}>
                    <div className={styles.modalContent} style={{ maxWidth: '840px' }} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalTitle}>
                            <h3><Printer size={18} color="#16a34a" />{readData("components.Clerio.ComplianceView", "ComplianceView_text_316")}</h3>
                            <button className={styles.btnSecondary} onClick={() => setShowFormFModal(false)}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_317")}</button>
                        </div>

                        <div className={styles.formFCertificate} style={{ margin: 0 }}>
                            <div className={styles.formFHeader}>
                                <h2>{readData("components.Clerio.ComplianceView", "ComplianceView_text_318")}</h2>
                                <h4>{readData("components.Clerio.ComplianceView", "ComplianceView_text_319")}</h4>
                                <p><strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_320")}</strong></p>
                                <p style={{ marginTop: '0.5rem', fontSize: '11px' }}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_321")}{formFDoc.establishment.name}<br />{readData("components.Clerio.ComplianceView", "ComplianceView_text_322")}{formFDoc.establishment.registeredAddress}<br />{readData("components.Clerio.ComplianceView", "ComplianceView_text_323")}{formFDoc.establishment.registrationNumber}
                                </p>
                            </div>

                            <div className={styles.formFBody}>
                                <p>{readData("components.Clerio.ComplianceView", "ComplianceView_text_324")}<strong>{formFDoc.employee.name}</strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_325")}</p>

                                <div style={{ background: '#f8fafc', padding: '0.75rem', border: '1px solid #cbd5e1', marginBottom: '1rem', fontSize: '12px' }}>
                                    <strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_326")}</strong><br />{readData("components.Clerio.ComplianceView", "ComplianceView_text_327")}{formFDoc.employee.name}{readData("components.Clerio.ComplianceView", "ComplianceView_text_328")}{formFDoc.employee.ticketOrTokenNo}{readData("components.Clerio.ComplianceView", "ComplianceView_text_329")}{formFDoc.employee.department}<br />{readData("components.Clerio.ComplianceView", "ComplianceView_text_330")}{formFDoc.employee.fatherOrSpouseName}{readData("components.Clerio.ComplianceView", "ComplianceView_text_331")}{formFDoc.employee.dateOfAppointment}<br />{readData("components.Clerio.ComplianceView", "ComplianceView_text_332")}{formFDoc.employee.permanentAddress}
                                </div>

                                <table className={styles.formFTable}>
                                    <thead>
                                        <tr>
                                            <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_333")}</th>
                                            <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_334")}</th>
                                            <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_335")}</th>
                                            <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_336")}</th>
                                            <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_337")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {formFDoc.nominees.map((n, i) => (
                                            <tr key={i}>
                                                <td>
                                                    <strong>{n.name}</strong><br />
                                                    <span style={{ fontSize: '10px' }}>{n.address}</span>
                                                </td>
                                                <td>{n.relationship}</td>
                                                <td>{n.age}{readData("components.Clerio.ComplianceView", "ComplianceView_text_338")}</td>
                                                <td><strong>{n.sharePercent}{readData("components.Clerio.ComplianceView", "ComplianceView_text_339")}</strong></td>
                                                <td style={{ fontSize: '10px' }}>{n.contingencyInvalidation}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                <div className={styles.formFSignatures}>
                                    <div className={styles.sigBlock}>
                                        <div className={styles.sigLine}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_340")}</div>
                                    </div>
                                    <div className={styles.sigBlock}>
                                        <div className={styles.sigLine}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_341")}{formFDoc.witnesses[0].name}{readData("components.Clerio.ComplianceView", "ComplianceView_text_342")}</div>
                                    </div>
                                    <div className={styles.sigBlock}>
                                        <div className={styles.sigLine}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_343")}{formFDoc.witnesses[1].name}{readData("components.Clerio.ComplianceView", "ComplianceView_text_344")}</div>
                                    </div>
                                </div>

                                <div className={styles.formFEmployerSeal}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_345")}</strong><br />
                                            <span style={{ fontSize: '11px', color: '#475569' }}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_346")}{formFDoc.employerAcknowledgement.registrationBookSerial}{readData("components.Clerio.ComplianceView", "ComplianceView_text_347")}{formFDoc.employerAcknowledgement.dateReceived}
                                            </span>
                                        </div>
                                        <div className={styles.tagGreen}>
                                            {formFDoc.employerAcknowledgement.seal}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                            <button className={styles.btnSecondary} onClick={() => setShowFormFModal(false)}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_348")}</button>
                            <button className={styles.btnPrimary} disabled title={readData("components.Clerio.ComplianceView", "unavailableAction")}>
                                <Printer size={14} />{readData("components.Clerio.ComplianceView", "ComplianceView_text_349")}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 3: GL BATCH BALANCED JOURNAL INSPECTOR & EXPORTER */}
            {selectedGLBatch && (
                <div className={styles.modalOverlay} onClick={() => { setSelectedGLBatch(null); setExportCodeModal(null); }}>
                    <div className={styles.modalContent} style={{ maxWidth: '840px' }} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalTitle}>
                            <div>
                                <h3>{readData("components.Clerio.ComplianceView", "ComplianceView_text_350")}{selectedGLBatch.batchId}</h3>
                                <p style={{ margin: '0.25rem 0 0 0', fontSize: '12px', color: 'var(--text-2)' }}>
                                    {selectedGLBatch.period}{readData("components.Clerio.ComplianceView", "ComplianceView_text_351")}{selectedGLBatch.targetErp}
                                </p>
                            </div>
                            <button className={styles.btnSecondary} onClick={() => { setSelectedGLBatch(null); setExportCodeModal(null); }}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_352")}</button>
                        </div>

                        {/* Format export buttons */}
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                            <button
                                className={styles.btnSecondary}
                                style={{ fontSize: '12px' }}
                                onClick={() => setExportCodeModal({ ...readData("components.Clerio.ComplianceView", "ComplianceView_fields_353"), code: generateSapIdocXml(selectedGLBatch) })}
                            >
                                <FileText size={13} />{readData("components.Clerio.ComplianceView", "ComplianceView_text_354")}</button>
                            <button
                                className={styles.btnSecondary}
                                style={{ fontSize: '12px' }}
                                onClick={() => setExportCodeModal({ ...readData("components.Clerio.ComplianceView", "ComplianceView_fields_355"), code: generateNetSuiteCsv(selectedGLBatch) })}
                            >
                                <FileSpreadsheet size={13} />{readData("components.Clerio.ComplianceView", "ComplianceView_text_356")}</button>
                            <button
                                className={styles.btnSecondary}
                                style={{ fontSize: '12px' }}
                                onClick={() => setExportCodeModal({ ...readData("components.Clerio.ComplianceView", "ComplianceView_fields_357"), code: generateTallyPrimeXml(selectedGLBatch) })}
                            >
                                <Database size={13} />{readData("components.Clerio.ComplianceView", "ComplianceView_text_358")}</button>
                        </div>

                        {exportCodeModal ? (
                            <div>
                                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '13px' }}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_359")}{exportCodeModal.format}{readData("components.Clerio.ComplianceView", "ComplianceView_text_360")}</h4>
                                <div style={{ background: 'var(--card-2)', padding: '1rem', borderRadius: '6px', maxHeight: '280px', overflowY: 'auto' }}>
                                    <pre style={{ margin: 0, color: '#38bdf8', fontSize: '11px', fontFamily: 'var(--f-num)', whiteSpace: 'pre-wrap' }}>
                                        {exportCodeModal.code}
                                    </pre>
                                </div>
                            </div>
                        ) : (
                            <div className={styles.musterTableWrap} style={{ maxHeight: '360px', overflowY: 'auto' }}>
                                <table className={styles.musterTable}>
                                    <thead>
                                        <tr>
                                            <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_361")}</th>
                                            <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_362")}</th>
                                            <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_363")}</th>
                                            <th>{readData("components.Clerio.ComplianceView", "ComplianceView_text_364")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedGLBatch.lineItems.map((item, idx) => (
                                            <tr key={idx}>
                                                <td>
                                                    <strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_365")}{item.accountCode}</strong>{readData("components.Clerio.ComplianceView", "ComplianceView_text_366")}{item.accountName}
                                                </td>
                                                <td><span className={styles.tagBlue}>{item.costCenter}</span></td>
                                                <td>
                                                    <span className={item.type === 'DEBIT' ? styles.tagAmber : styles.tagGreen}>
                                                        {item.type}
                                                    </span>
                                                </td>
                                                <td style={{ fontFamily: 'var(--f-num)', fontWeight: 600 }}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_367")}{item.amount.toLocaleString('en-IN', readData("components.Clerio.ComplianceView", "ComplianceView_368"))}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid var(--line)' }}>
                            <div className={styles.allocationValidBadge}>
                                <CheckCircle2 size={13} />{readData("components.Clerio.ComplianceView", "ComplianceView_text_369")}{selectedGLBatch.totalDebits.toLocaleString('en-IN')}{readData("components.Clerio.ComplianceView", "ComplianceView_text_370")}{selectedGLBatch.totalCredits.toLocaleString('en-IN')}{readData("components.Clerio.ComplianceView", "ComplianceView_text_371")}</div>
                            <button className={styles.btnSecondary} onClick={() => { setSelectedGLBatch(null); setExportCodeModal(null); }}>{readData("components.Clerio.ComplianceView", "ComplianceView_text_372")}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ComplianceView;
