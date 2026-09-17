"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useHRMS } from '@/context/HRMSContext';
import { useAuth } from '@/context/AuthContext';
import MisReportingHub from './MisReportingHub';
import styles from './AnalyticsView.module.css';
import { downloadCSV, downloadXLSX, downloadPrintableDocument } from '@/utils/exportUtils';

// Material Icons
import PeopleAltOutlined from '@mui/icons-material/PeopleAltOutlined';
import TrendingUpOutlined from '@mui/icons-material/TrendingUpOutlined';
import AccessTimeOutlined from '@mui/icons-material/AccessTimeOutlined';
import AccountBalanceWalletOutlined from '@mui/icons-material/AccountBalanceWalletOutlined';
import HowToRegOutlined from '@mui/icons-material/HowToRegOutlined';
import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined';
import AssessmentOutlined from '@mui/icons-material/AssessmentOutlined';
import SummarizeOutlined from '@mui/icons-material/SummarizeOutlined';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import FilterAltOutlined from '@mui/icons-material/FilterAltOutlined';
import SpeedOutlined from '@mui/icons-material/SpeedOutlined';
import SecurityOutlined from '@mui/icons-material/SecurityOutlined';
import SendOutlined from '@mui/icons-material/SendOutlined';
import PlayArrowOutlined from '@mui/icons-material/PlayArrowOutlined';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import SmartToyOutlined from '@mui/icons-material/SmartToyOutlined';

export default function AnalyticsView({ onNavigate, onSelectConsole, activeSubFeature = 'analytics_people' }) {
    const { misMasterData = [], setMisMasterData, showToast } = useHRMS();
    const { user } = useAuth();

    // Map subfeature IDs to active internal tabs
    const initialTab = useMemo(() => {
        if (activeSubFeature === 'analytics_people') return 'people';
        if (activeSubFeature === 'analytics_workforce') return 'workforce';
        if (activeSubFeature === 'analytics_payroll') return 'payroll';
        if (activeSubFeature === 'analytics_talent') return 'talent';
        if (activeSubFeature === 'analytics_copilot') return 'copilot';
        if (activeSubFeature === 'analytics_custom') return 'custom';
        if (activeSubFeature === 'operational_reports') return 'operational';
        return 'people';
    }, [activeSubFeature]);

    const [activeTab, setActiveTab] = useState(initialTab);

    useEffect(() => {
        if (activeSubFeature) {
            if (activeSubFeature === 'analytics_people') setActiveTab('people');
            else if (activeSubFeature === 'analytics_workforce') setActiveTab('workforce');
            else if (activeSubFeature === 'analytics_payroll') setActiveTab('payroll');
            else if (activeSubFeature === 'analytics_talent') setActiveTab('talent');
            else if (activeSubFeature === 'analytics_copilot') setActiveTab('copilot');
            else if (activeSubFeature === 'analytics_custom') setActiveTab('custom');
            else if (activeSubFeature === 'operational_reports') setActiveTab('operational');
        }
    }, [activeSubFeature]);

    // --- State for Interactive MCI Capability Index Simulation ---
    const [mciInputs, setMciInputs] = useState({
        performance: 88,
        skills: 82,
        learning: 75,
        engagement: 90,
        tenure: 80
    });

    const mciScore = useMemo(() => {
        const weights = { performance: 0.25, skills: 0.25, learning: 0.20, engagement: 0.15, tenure: 0.15 };
        const score = (
            mciInputs.performance * weights.performance +
            mciInputs.skills * weights.skills +
            mciInputs.learning * weights.learning +
            mciInputs.engagement * weights.engagement +
            mciInputs.tenure * weights.tenure
        );
        return Math.round(score * 10) / 10;
    }, [mciInputs]);

    // --- State for AI Reasoning Agent Playground ---
    const [aiQuery, setAiQuery] = useState('');
    const [aiResponses, setAiResponses] = useState([
        {
            query: 'Analyze engineering attrition risk for Q3',
            response: 'Engineering attrition flight risk is currently 3.8% (Normal benchmark <5%). Key factor: 2 Lead Engineers show high market demand score. Recommended intervention: Fast-track Q3 ESOP refresh & mentorship allocation.',
            citations: ['Nucleus Attrition Model v4', 'HR Policy Section 9.2 (Retention Grids)'],
            confidence: '98.4%',
            time: 'Just now'
        }
    ]);
    const [isAiProcessing, setIsAiProcessing] = useState(false);

    const handleAskAi = (e) => {
        e.preventDefault();
        if (!aiQuery.trim()) return;
        const q = aiQuery.trim();
        setIsAiProcessing(true);
        setTimeout(() => {
            let reply = `Based on current telemetry across ${misMasterData.length || 64} organizational records, metrics are stable within policy thresholds. No regulatory anomalies detected.`;
            if (q.toLowerCase().includes('salary') || q.toLowerCase().includes('wage') || q.toLowerCase().includes('payroll')) {
                reply = 'Current wage bill projection for next month is ₹84.2L (+3.1% MoM). 2026 Labour Code 50% Basic wage floor compliance stands at 98.6%. All PF/ESI statutory accruals are fully funded.';
            } else if (q.toLowerCase().includes('attrition') || q.toLowerCase().includes('leave') || q.toLowerCase().includes('flight')) {
                reply = 'Cross-functional flight risk is 4.2% across Product & Engineering. Top correlation factors: Consecutive OT hours >12h/week and leave utilization <40%.';
            }
            setAiResponses(prev => [
                {
                    query: q,
                    response: reply,
                    citations: ['Labour Codes 2026 Engine', 'Employee Ledger v2'],
                    confidence: '99.1%',
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                },
                ...prev
            ]);
            setAiQuery('');
            setIsAiProcessing(false);
            showToast('AI Reasoning Complete', 'Telemetry analysis updated with grounded citations.', 'success');
        }, 600);
    };

    // --- State for Custom Report Builder ---
    const [customDepartment, setCustomDepartment] = useState('All');
    const [customMetricType, setCustomMetricType] = useState('headcount');
    const [customDateRange, setCustomDateRange] = useState('current_quarter');

    const handleExportCustomReport = (format) => {
        const filename = `Nucleus_${customDepartment.replace(/\s+/g, '_')}_${customMetricType}_${customDateRange}`;
        const headers = ['Metric', 'Dimension / Department', 'Period', 'Value', 'Benchmark Target', 'Status'];
        const rows = [
            [customMetricType.toUpperCase(), customDepartment, customDateRange.replace(/_/g, ' '), '98.4%', '95.0%', 'Optimal'],
            ['Active Headcount', customDepartment, customDateRange.replace(/_/g, ' '), '1,248', '1,200', 'On Track'],
            ['Wage Bill Compliance', customDepartment, customDateRange.replace(/_/g, ' '), '99.2%', '100.0%', 'Compliant'],
            ['Attrition Risk Index', customDepartment, customDateRange.replace(/_/g, ' '), '3.8%', '< 5.0%', 'Safe'],
            ['MCI Capability Index', customDepartment, customDateRange.replace(/_/g, ' '), `${mciScore} / 100`, '> 80.0', 'High Performer']
        ];

        if (format === 'csv') {
            downloadCSV(`${filename}.csv`, headers, rows);
        } else if (format === 'xlsx') {
            downloadXLSX(`${filename}.xlsx`, headers, rows, 'Workforce Analytics');
        } else if (format === 'pdf') {
            downloadPrintableDocument(`Workforce Intelligence Report: ${customDepartment} - ${customMetricType.toUpperCase()}`, {
                'Department': customDepartment,
                'Metric Focus': customMetricType.toUpperCase(),
                'Date Range': customDateRange.replace(/_/g, ' '),
                'Generated Date': new Date().toLocaleDateString('en-IN'),
                'Authorized Signature': 'Nucleus Executive Intelligence'
            }, headers, rows);
        }
        showToast('Report Downloaded', `${filename}.${format}`, 'success');
    };

    return (
        <div className={styles.container}>
            {/* Header Zone */}
            <div className={styles.headerRow}>
                <div className={styles.titleBlock}>
                    <h2>People Intelligence & Predictive AI Studio</h2>
                    <p>Enterprise workforce telemetry, wage bill analytics, talent funnel velocity, and autonomous agent reasoning.</p>
                </div>

                <div className={styles.tabNav}>
                    <button
                        type="button"
                        className={`${styles.tabBtn} ${activeTab === 'people' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('people')}
                    >
                        <PeopleAltOutlined sx={{ fontSize: 16 }} />
                        People Intelligence
                    </button>
                    <button
                        type="button"
                        className={`${styles.tabBtn} ${activeTab === 'workforce' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('workforce')}
                    >
                        <AccessTimeOutlined sx={{ fontSize: 16 }} />
                        Workforce & Ops
                    </button>
                    <button
                        type="button"
                        className={`${styles.tabBtn} ${activeTab === 'payroll' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('payroll')}
                    >
                        <AccountBalanceWalletOutlined sx={{ fontSize: 16 }} />
                        Payroll Analytics
                    </button>
                    <button
                        type="button"
                        className={`${styles.tabBtn} ${activeTab === 'talent' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('talent')}
                    >
                        <HowToRegOutlined sx={{ fontSize: 16 }} />
                        Talent Funnel
                    </button>
                    <button
                        type="button"
                        className={`${styles.tabBtn} ${activeTab === 'copilot' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('copilot')}
                    >
                        <AutoAwesomeOutlined sx={{ fontSize: 16 }} />
                        AI Copilot Studio
                    </button>
                    <button
                        type="button"
                        className={`${styles.tabBtn} ${activeTab === 'custom' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('custom')}
                    >
                        <AssessmentOutlined sx={{ fontSize: 16 }} />
                        Custom Reports
                    </button>
                    <button
                        type="button"
                        className={`${styles.tabBtn} ${activeTab === 'mis' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('mis')}
                    >
                        <SummarizeOutlined sx={{ fontSize: 16 }} />
                        MIS Master Hub
                    </button>
                    <button
                        type="button"
                        className={`${styles.tabBtn} ${activeTab === 'operational' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('operational')}
                    >
                        <SpeedOutlined sx={{ fontSize: 16 }} />
                        MCI Engine
                    </button>
                </div>
            </div>

            {/* TAB 1: PEOPLE INTELLIGENCE */}
            {activeTab === 'people' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className={styles.statsGrid}>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: 'var(--signal-wash)', color: 'var(--signal)' }}>
                                <PeopleAltOutlined />
                            </div>
                            <div>
                                <div className={styles.statValue}>1,420</div>
                                <div className={styles.statLabel}>Active Global Headcount (+14.2% YoY)</div>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: 'var(--status-ok-wash)', color: 'var(--status-ok)' }}>
                                <TrendingUpOutlined />
                            </div>
                            <div>
                                <div className={styles.statValue}>88.4 / 100</div>
                                <div className={styles.statLabel}>Diversity & Inclusion Index</div>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: 'var(--pending-wash)', color: 'var(--pending)' }}>
                                <SpeedOutlined />
                            </div>
                            <div>
                                <div className={styles.statValue}>4.2%</div>
                                <div className={styles.statLabel}>Annualized Attrition (Industry: 12.8%)</div>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: 'var(--info-wash)', color: 'var(--info)' }}>
                                <SecurityOutlined />
                            </div>
                            <div>
                                <div className={styles.statValue}>96.4%</div>
                                <div className={styles.statLabel}>Retention Rate (High Performers)</div>
                            </div>
                        </div>
                    </div>

                    <div className={styles.grid2}>
                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <h3><PeopleAltOutlined sx={{ fontSize: 18 }} /> Gender & Demographic Diversity</h3>
                                <span className={styles.badge} style={{ background: 'var(--status-ok-wash)', color: 'var(--status-ok)' }}>
                                    ESG Compliant
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                                        <span>Female Representation</span>
                                        <strong>42.8% (608 Employees)</strong>
                                    </div>
                                    <div style={{ height: '8px', background: 'var(--card-2)', borderRadius: '999px', overflow: 'hidden' }}>
                                        <div style={{ width: '42.8%', height: '100%', background: 'var(--signal)' }}></div>
                                    </div>
                                </div>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                                        <span>Male Representation</span>
                                        <strong>53.6% (761 Employees)</strong>
                                    </div>
                                    <div style={{ height: '8px', background: 'var(--card-2)', borderRadius: '999px', overflow: 'hidden' }}>
                                        <div style={{ width: '53.6%', height: '100%', background: '#38bdf8' }}></div>
                                    </div>
                                </div>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                                        <span>Non-Binary / Self-Identified</span>
                                        <strong>3.6% (51 Employees)</strong>
                                    </div>
                                    <div style={{ height: '8px', background: 'var(--card-2)', borderRadius: '999px', overflow: 'hidden' }}>
                                        <div style={{ width: '3.6%', height: '100%', background: '#10b981' }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <h3><SpeedOutlined sx={{ fontSize: 18 }} /> Flight Risk & Attrition Breakdown</h3>
                                <span className={styles.badge} style={{ background: 'var(--signal-wash)', color: 'var(--signal)' }}>
                                    Predictive AI
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--card-2)', borderRadius: '8px' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Low Risk (Stable)</div>
                                        <div style={{ fontSize: '0.76rem', color: 'var(--text-2)' }}>High engagement & market parity</div>
                                    </div>
                                    <div style={{ fontWeight: 700, color: 'var(--status-ok)', fontSize: '1.1rem' }}>78.4%</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--card-2)', borderRadius: '8px' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Medium Risk (Watchlist)</div>
                                        <div style={{ fontSize: '0.76rem', color: 'var(--text-2)' }}>Overtime spikes or stagnant band</div>
                                    </div>
                                    <div style={{ fontWeight: 700, color: 'var(--pending)', fontSize: '1.1rem' }}>17.4%</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--card-2)', borderRadius: '8px' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>High Flight Risk (Urgent)</div>
                                        <div style={{ fontSize: '0.76rem', color: 'var(--text-2)' }}>Under-compensated vs peer quartile</div>
                                    </div>
                                    <div style={{ fontWeight: 700, color: 'var(--flag)', fontSize: '1.1rem' }}>4.2%</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: WORKFORCE & OPS ANALYTICS */}
            {activeTab === 'workforce' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className={styles.statsGrid}>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: 'var(--signal-wash)', color: 'var(--signal)' }}>
                                <AccessTimeOutlined />
                            </div>
                            <div>
                                <div className={styles.statValue}>91.8%</div>
                                <div className={styles.statLabel}>Shift Capacity Utilization</div>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: 'var(--pending-wash)', color: 'var(--pending)' }}>
                                <TrendingUpOutlined />
                            </div>
                            <div>
                                <div className={styles.statValue}>3.4 hrs</div>
                                <div className={styles.statLabel}>Avg Overtime per Employee / Mo</div>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: 'var(--status-ok-wash)', color: 'var(--status-ok)' }}>
                                <CheckCircleOutline />
                            </div>
                            <div>
                                <div className={styles.statValue}>1.8%</div>
                                <div className={styles.statLabel}>Unplanned Absenteeism Rate</div>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: 'var(--info-wash)', color: 'var(--info)' }}>
                                <SpeedOutlined />
                            </div>
                            <div>
                                <div className={styles.statValue}>94.2 pts</div>
                                <div className={styles.statLabel}>Project Pod Delivery Velocity</div>
                            </div>
                        </div>
                    </div>

                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h3><AccessTimeOutlined sx={{ fontSize: 18 }} /> Shift & Site Overtime Heatmap</h3>
                            <button className={styles.btnSecondary} onClick={() => onNavigate && onNavigate('attendance', 'workforce_ops')}>
                                View Live Rosters
                            </button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                            {[
                                { site: 'Bengaluru Tech HQ', shift: 'General (09:00 - 18:00)', load: '94%', ot: '184 hrs', status: 'Optimal' },
                                { site: 'Plant A - Hosur Site', shift: 'Morning Shift A', load: '98%', ot: '412 hrs', status: 'High Load' },
                                { site: 'Plant B - Manesar Plant', shift: 'Night Shift C', load: '86%', ot: '290 hrs', status: 'Balanced' },
                                { site: 'London Tech Hub', shift: 'European Shift', load: '89%', ot: '98 hrs', status: 'Optimal' }
                            ].map((item, idx) => (
                                <div key={idx} style={{ padding: '1rem', background: 'var(--card-2)', borderRadius: '10px', border: '1px solid var(--line-soft)' }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.2rem' }}>{item.site}</div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-2)', marginBottom: '0.6rem' }}>{item.shift}</div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.2rem' }}>
                                        <span>Capacity: <strong>{item.load}</strong></span>
                                        <span>OT: <strong>{item.ot}</strong></span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: PAYROLL & WAGE ANALYTICS */}
            {activeTab === 'payroll' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className={styles.statsGrid}>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: 'var(--signal-wash)', color: 'var(--signal)' }}>
                                <AccountBalanceWalletOutlined />
                            </div>
                            <div>
                                <div className={styles.statValue}>₹1.48 Cr</div>
                                <div className={styles.statLabel}>Monthly Gross Wage Bill</div>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: 'var(--status-ok-wash)', color: 'var(--status-ok)' }}>
                                <SecurityOutlined />
                            </div>
                            <div>
                                <div className={styles.statValue}>98.6%</div>
                                <div className={styles.statLabel}>50% Basic Wage Compliance (2026 Code)</div>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: 'var(--info-wash)', color: 'var(--info)' }}>
                                <TrendingUpOutlined />
                            </div>
                            <div>
                                <div className={styles.statValue}>₹17.8 L</div>
                                <div className={styles.statLabel}>Statutory PF / ESI Liability</div>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: 'var(--pending-wash)', color: 'var(--pending)' }}>
                                <SpeedOutlined />
                            </div>
                            <div>
                                <div className={styles.statValue}>8.4%</div>
                                <div className={styles.statLabel}>Earned Wage Access (EWA) Drawdown</div>
                            </div>
                        </div>
                    </div>

                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h3><AccountBalanceWalletOutlined sx={{ fontSize: 18 }} /> Monthly Wage Bill Bridge (MoM Variance)</h3>
                            <button className={styles.btnSecondary} onClick={() => onNavigate && onNavigate('payroll', 'payroll_finance')}>
                                Open Payroll Room
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem 1rem', background: 'var(--card-2)', borderRadius: '8px' }}>
                                <span>Previous Month Base Bill</span>
                                <strong>₹1,44,20,000</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem 1rem', background: 'var(--status-ok-wash)', borderRadius: '8px', color: 'var(--status-ok)' }}>
                                <span>+ New Hires Joined (8 Employees)</span>
                                <strong>+ ₹6,80,000</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem 1rem', background: 'var(--status-ok-wash)', borderRadius: '8px', color: 'var(--status-ok)' }}>
                                <span>+ Promotion & CTC Increments</span>
                                <strong>+ ₹1,90,000</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem 1rem', background: 'var(--flag-wash)', borderRadius: '8px', color: 'var(--flag)' }}>
                                <span>- Offboarding Exits & Settled F&F</span>
                                <strong>- ₹4,90,000</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.85rem 1rem', background: 'var(--signal-wash)', borderRadius: '8px', color: 'var(--signal)', fontWeight: 700 }}>
                                <span>Current Net Disbursable Wage Bill</span>
                                <span>₹1,48,00,000</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: TALENT ACQUISITION FUNNEL */}
            {activeTab === 'talent' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className={styles.statsGrid}>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: 'var(--signal-wash)', color: 'var(--signal)' }}>
                                <HowToRegOutlined />
                            </div>
                            <div>
                                <div className={styles.statValue}>24 Days</div>
                                <div className={styles.statLabel}>Average Time-to-Hire</div>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: 'var(--status-ok-wash)', color: 'var(--status-ok)' }}>
                                <TrendingUpOutlined />
                            </div>
                            <div>
                                <div className={styles.statValue}>91.2%</div>
                                <div className={styles.statLabel}>Offer Acceptance Rate</div>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: 'var(--info-wash)', color: 'var(--info)' }}>
                                <PeopleAltOutlined />
                            </div>
                            <div>
                                <div className={styles.statValue}>44.6%</div>
                                <div className={styles.statLabel}>Referral Hire Sourcing Share</div>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: 'var(--pending-wash)', color: 'var(--pending)' }}>
                                <SpeedOutlined />
                            </div>
                            <div>
                                <div className={styles.statValue}>18 Req</div>
                                <div className={styles.statLabel}>Open Approved Positions</div>
                            </div>
                        </div>
                    </div>

                    <div className={styles.grid2}>
                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <h3><HowToRegOutlined sx={{ fontSize: 18 }} /> Candidate Conversion Funnel</h3>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                {[
                                    { stage: '1. Applications Received', count: 1420, pct: '100%', color: 'var(--signal)' },
                                    { stage: '2. Resume Screening Passed', count: 380, pct: '26.7%', color: '#38bdf8' },
                                    { stage: '3. Technical & Culture Rounds', count: 142, pct: '10.0%', color: '#6366f1' },
                                    { stage: '4. Offer Extended', count: 34, pct: '2.4%', color: '#f59e0b' },
                                    { stage: '5. Joined & Onboarded', count: 31, pct: '2.2%', color: '#10b981' }
                                ].map((step, idx) => (
                                    <div key={idx}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: '0.25rem' }}>
                                            <span>{step.stage}</span>
                                            <strong>{step.count} ({step.pct})</strong>
                                        </div>
                                        <div style={{ height: '7px', background: 'var(--card-2)', borderRadius: '999px', overflow: 'hidden' }}>
                                            <div style={{ width: step.pct, height: '100%', background: step.color }}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <h3><AssessmentOutlined sx={{ fontSize: 18 }} /> Sourcing Channel Effectiveness</h3>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {[
                                    { channel: 'Employee Internal Referrals', share: '44%', quality: 'High (4.8/5)' },
                                    { channel: 'LinkedIn Talent Insights', share: '28%', quality: 'High (4.4/5)' },
                                    { channel: 'Direct Inbound Career Site', share: '18%', quality: 'Medium (3.9/5)' },
                                    { channel: 'Campus Recruitment Drives', share: '10%', quality: 'High (4.6/5)' }
                                ].map((item, idx) => (
                                    <div key={idx} style={{ padding: '0.75rem', background: 'var(--card-2)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>{item.channel}</div>
                                            <div style={{ fontSize: '0.74rem', color: 'var(--text-2)' }}>Quality Score: {item.quality}</div>
                                        </div>
                                        <div style={{ fontWeight: 700, color: 'var(--signal)', fontSize: '1rem' }}>{item.share}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 5: AI COPILOT STUDIO */}
            {activeTab === 'copilot' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h3><AutoAwesomeOutlined sx={{ fontSize: 18, color: 'var(--signal)' }} /> Autonomous Reasoning HR Agent & Policy Grounding</h3>
                            <span className={styles.badge} style={{ background: 'var(--signal-wash)', color: 'var(--signal)' }}>
                                Zero Hallucination Mode
                            </span>
                        </div>

                        <form onSubmit={handleAskAi} style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem' }}>
                            <input
                                type="text"
                                value={aiQuery}
                                onChange={(e) => setAiQuery(e.target.value)}
                                placeholder="Ask any enterprise question (e.g. 'Summarize engineering retention risks', 'Check 2026 wage bill impact')..."
                                style={{
                                    flex: 1,
                                    padding: '0.75rem 1rem',
                                    borderRadius: '10px',
                                    border: '1px solid var(--line)',
                                    background: 'var(--card-2)',
                                    color: 'var(--text)',
                                    fontSize: '0.88rem',
                                    outline: 'none'
                                }}
                            />
                            <button
                                type="submit"
                                disabled={isAiProcessing || !aiQuery.trim()}
                                className={styles.btnPrimary}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            >
                                <SendOutlined sx={{ fontSize: 16 }} />
                                {isAiProcessing ? 'Reasoning...' : 'Ask AI'}
                            </button>
                        </form>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {aiResponses.map((item, idx) => (
                                <div key={idx} style={{ padding: '1.25rem', background: 'var(--card-2)', borderRadius: '12px', border: '1px solid var(--line-soft)' }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--signal)', marginBottom: '0.4rem' }}>
                                        Q: {item.query}
                                    </div>
                                    <div style={{ fontSize: '0.86rem', color: 'var(--text)', lineHeight: 1.55, marginBottom: '0.75rem' }}>
                                        {item.response}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.76rem', color: 'var(--text-2)' }}>
                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                            {item.citations.map((cite, cIdx) => (
                                                <span key={cIdx} style={{ background: 'var(--card)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--line)' }}>
                                                    📜 {cite}
                                                </span>
                                            ))}
                                        </div>
                                        <span>Confidence: <strong>{item.confidence}</strong> • {item.time}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 6: CUSTOM REPORTS BUILDER */}
            {activeTab === 'custom' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h3><AssessmentOutlined sx={{ fontSize: 18 }} /> Dynamic Enterprise Report Generator</h3>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-2)', marginBottom: '0.3rem', fontWeight: 600 }}>
                                    Department Scope
                                </label>
                                <select
                                    value={customDepartment}
                                    onChange={(e) => setCustomDepartment(e.target.value)}
                                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--card-2)', color: 'var(--text)' }}
                                >
                                    <option value="All">All Departments</option>
                                    <option value="Engineering">Engineering</option>
                                    <option value="Product">Product & Design</option>
                                    <option value="Sales">Sales & Marketing</option>
                                    <option value="Finance">Finance & Payroll</option>
                                    <option value="Operations">Operations & Plant</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-2)', marginBottom: '0.3rem', fontWeight: 600 }}>
                                    Primary Metric
                                </label>
                                <select
                                    value={customMetricType}
                                    onChange={(e) => setCustomMetricType(e.target.value)}
                                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--card-2)', color: 'var(--text)' }}
                                >
                                    <option value="headcount">Headcount & Attrition</option>
                                    <option value="compensation">Gross CTC & Wage Distribution</option>
                                    <option value="attendance">Attendance & Shift Overtime</option>
                                    <option value="leaves">Leave Accruals & Balance</option>
                                    <option value="mci_capability">Multiplier Capability Index (MCI)</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-2)', marginBottom: '0.3rem', fontWeight: 600 }}>
                                    Date Range
                                </label>
                                <select
                                    value={customDateRange}
                                    onChange={(e) => setCustomDateRange(e.target.value)}
                                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--card-2)', color: 'var(--text)' }}
                                >
                                    <option value="current_month">Current Month (MTD)</option>
                                    <option value="current_quarter">Current Quarter (QTD)</option>
                                    <option value="ytd">Year to Date (YTD)</option>
                                    <option value="last_12_months">Last 12 Rolling Months</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                className={styles.btnPrimary}
                                onClick={() => handleExportCustomReport('csv')}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            >
                                <DownloadOutlined sx={{ fontSize: 16 }} />
                                Export CSV
                            </button>
                            <button
                                type="button"
                                className={styles.btnSecondary}
                                onClick={() => handleExportCustomReport('xlsx')}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            >
                                <DownloadOutlined sx={{ fontSize: 16 }} />
                                Export Excel (XLSX)
                            </button>
                            <button
                                type="button"
                                className={styles.btnSecondary}
                                onClick={() => handleExportCustomReport('pdf')}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            >
                                <DownloadOutlined sx={{ fontSize: 16 }} />
                                Export PDF Summary
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 7: MIS MASTER HUB */}
            {activeTab === 'mis' && (
                <MisReportingHub
                    misMasterData={misMasterData}
                    setMisMasterData={setMisMasterData}
                    showToast={showToast}
                    onNavigate={onNavigate}
                />
            )}

            {/* TAB 8: MCI CAPABILITY INDEX & OPERATIONAL SNAPSHOTS */}
            {activeTab === 'operational' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className={styles.grid2}>
                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <h3><SpeedOutlined sx={{ fontSize: 18 }} /> MCI v2 Interactive Capability Index Formula</h3>
                                <span className={styles.badge} style={{ background: 'var(--signal-wash)', color: 'var(--signal)' }}>
                                    Live Score: {mciScore} / 100
                                </span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                                {[
                                    { key: 'performance', label: 'Performance & 9-Box Weight (25%)', min: 0, max: 100 },
                                    { key: 'skills', label: 'Skills & Competency Rating (25%)', min: 0, max: 100 },
                                    { key: 'learning', label: 'L&D / Course Completion (20%)', min: 0, max: 100 },
                                    { key: 'engagement', label: 'Engagement & Pulse Score (15%)', min: 0, max: 100 },
                                    { key: 'tenure', label: 'Tenure & Organizational Loyalty (15%)', min: 0, max: 100 }
                                ].map((item) => (
                                    <div key={item.key}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.2rem' }}>
                                            <span>{item.label}</span>
                                            <strong>{mciInputs[item.key]}%</strong>
                                        </div>
                                        <input
                                            type="range"
                                            min={item.min}
                                            max={item.max}
                                            value={mciInputs[item.key]}
                                            onChange={(e) => setMciInputs({ ...mciInputs, [item.key]: Number(e.target.value) })}
                                            style={{ width: '100%', accentColor: 'var(--signal)' }}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <h3><SecurityOutlined sx={{ fontSize: 18 }} /> Metric Snapshot Privacy & Suppression</h3>
                                <span className={styles.badge} style={{ background: 'var(--status-ok-wash)', color: 'var(--status-ok)' }}>
                                    Threshold: N ≥ 5
                                </span>
                            </div>
                            <div style={{ fontSize: '0.84rem', color: 'var(--text-2)', lineHeight: 1.5, marginBottom: '1rem' }}>
                                To preserve employee confidentiality, metrics with cohort size smaller than 5 are automatically suppressed in exports and public radar charts.
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                                {[
                                    { code: 'METRIC_HEADCOUNT_V1', name: 'Global Headcount Snapshot', cohort: 1420, suppressed: false },
                                    { code: 'METRIC_ATTRITION_V2', name: 'Flight Risk Predictive Score', cohort: 64, suppressed: false },
                                    { code: 'METRIC_EXECUTIVE_SALARY', name: 'CXO Quartile Wage Bridge', cohort: 4, suppressed: true }
                                ].map((m, idx) => (
                                    <div key={idx} style={{ padding: '0.75rem', background: 'var(--card-2)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>{m.name}</div>
                                            <div style={{ fontSize: '0.74rem', color: 'var(--text-2)' }}><code>{m.code}</code> • Cohort: {m.cohort}</div>
                                        </div>
                                        <span className={styles.badge} style={{
                                            background: m.suppressed ? 'var(--flag-wash)' : 'var(--status-ok-wash)',
                                            color: m.suppressed ? 'var(--flag)' : 'var(--status-ok)'
                                        }}>
                                            {m.suppressed ? 'Suppressed (<5)' : 'Published'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
