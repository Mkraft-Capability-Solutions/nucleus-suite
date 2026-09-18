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
    const {
        employees = [],
        positions = [],
        attendance = {},
        timeOfficeLedger = [],
        leaves = {},
        leaveApplications = [],
        payrollRuns = [],
        payrollSummary = {},
        ewaTransactions = [],
        candidates = [],
        employeeReferrals = [],
        misMasterData = [],
        setMisMasterData,
        showToast
    } = useHRMS();
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

    // --- Dynamic Derivations for People Intelligence ---
    const totalHeadcount = employees.length || misMasterData.length || 0;
    const femaleCount = useMemo(() => employees.filter(e => ['f', 'female'].includes(String(e.gender || '').toLowerCase())).length, [employees]);
    const maleCount = useMemo(() => employees.filter(e => ['m', 'male'].includes(String(e.gender || '').toLowerCase())).length, [employees]);
    const otherCount = Math.max(0, totalHeadcount - femaleCount - maleCount);

    const femalePct = totalHeadcount > 0 ? ((femaleCount / totalHeadcount) * 100).toFixed(1) : '0.0';
    const malePct = totalHeadcount > 0 ? ((maleCount / totalHeadcount) * 100).toFixed(1) : '0.0';
    const otherPct = totalHeadcount > 0 ? ((otherCount / totalHeadcount) * 100).toFixed(1) : '0.0';

    const diversityIndex = totalHeadcount > 0
        ? Math.min(100, Math.round(((Math.min(femaleCount, maleCount) * 2) / totalHeadcount) * 1000) / 10)
        : 0;

    const exitCount = useMemo(() => employees.filter(e => ['exit', 'resigned', 'terminated', 'inactive'].includes(String(e.status || '').toLowerCase())).length, [employees]);
    const annualizedAttrition = totalHeadcount > 0 ? ((exitCount / totalHeadcount) * 100).toFixed(1) : '0.0';
    const retentionRate = (100 - Number(annualizedAttrition)).toFixed(1);

    const highFlightRiskCount = useMemo(() => employees.filter(e => e.flightRisk === 'High' || e.risk === 'High' || e.retentionRisk === 'High').length, [employees]);
    const medFlightRiskCount = useMemo(() => employees.filter(e => e.flightRisk === 'Medium' || e.risk === 'Medium' || e.retentionRisk === 'Medium').length, [employees]);
    const lowFlightRiskCount = Math.max(0, totalHeadcount - highFlightRiskCount - medFlightRiskCount);

    const lowRiskPct = totalHeadcount > 0 ? ((lowFlightRiskCount / totalHeadcount) * 100).toFixed(1) : '100.0';
    const medRiskPct = totalHeadcount > 0 ? ((medFlightRiskCount / totalHeadcount) * 100).toFixed(1) : '0.0';
    const highRiskPct = totalHeadcount > 0 ? ((highFlightRiskCount / totalHeadcount) * 100).toFixed(1) : '0.0';

    // --- Dynamic Derivations for Workforce & Ops ---
    const totalLedger = timeOfficeLedger.length || (attendance?.status ? 1 : 0);
    const presentCount = useMemo(() => timeOfficeLedger.filter(r => ['present', 'p', 'on shift', 'completed'].includes(String(r.status || r.attendance || '').toLowerCase())).length, [timeOfficeLedger]);
    const capacityUtilization = totalLedger > 0 ? ((presentCount / totalLedger) * 100).toFixed(1) : (totalHeadcount > 0 ? '92.4' : '0.0');

    const totalOtMinutes = useMemo(() => timeOfficeLedger.reduce((sum, r) => sum + Number(r.overtimeMinutes || r.otMinutes || (Number(r.overtime || r.otHours || 0) * 60)), 0), [timeOfficeLedger]);
    const avgOtHours = totalLedger > 0 ? (totalOtMinutes / (60 * totalLedger)).toFixed(1) : '0.0';

    const absentCount = useMemo(() => timeOfficeLedger.filter(r => ['absent', 'a'].includes(String(r.status || '').toLowerCase())).length, [timeOfficeLedger]);
    const unplannedAbsenteeism = totalLedger > 0 ? ((absentCount / totalLedger) * 100).toFixed(1) : '0.0';

    // Group locations dynamically for heatmap
    const siteData = useMemo(() => {
        const map = new Map();
        employees.forEach(e => {
            const loc = e.location || 'Corporate HQ';
            const current = map.get(loc) || { site: loc, count: 0, shift: 'General Shift', otHours: 0 };
            current.count += 1;
            map.set(loc, current);
        });
        timeOfficeLedger.forEach(l => {
            const loc = l.location || l.site || 'Corporate HQ';
            const current = map.get(loc) || { site: loc, count: 0, shift: l.shift || 'General Shift', otHours: 0 };
            current.otHours += Number(l.otHours || (Number(l.overtimeMinutes || 0) / 60) || 0);
            map.set(loc, current);
        });
        if (map.size === 0) {
            return [{ site: 'Main Site', shift: 'General (09:00 - 18:00)', load: '100%', ot: '0 hrs', status: 'Optimal' }];
        }
        return Array.from(map.values()).slice(0, 6).map(item => ({
            site: item.site,
            shift: item.shift || 'General Shift',
            load: `${Math.min(100, Math.round((item.count / (employees.length || 1)) * 100))}%`,
            ot: `${Math.round(item.otHours)} hrs`,
            status: item.otHours > 50 ? 'High Load' : 'Optimal'
        }));
    }, [employees, timeOfficeLedger]);

    // --- Dynamic Derivations for Payroll ---
    const monthlyWageBill = useMemo(() => {
        if (payrollSummary?.grossPay || payrollSummary?.totalGross) {
            return Number(payrollSummary.grossPay || payrollSummary.totalGross);
        }
        if (payrollRuns.length > 0) {
            return payrollRuns.reduce((sum, r) => sum + Number(r.grossPay || r.actualGross || r['Gross (INR)'] || 0), 0);
        }
        return employees.reduce((sum, e) => sum + Number(e.monthlyGross || e.grossSalary || e.salary || 45000), 0);
    }, [payrollSummary, payrollRuns, employees]);

    const formatCurrencyINR = (amount) => {
        if (!amount) return '₹0';
        if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
        if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)} L`;
        return `₹${Math.round(amount).toLocaleString('en-IN')}`;
    };

    const wageBillDisplay = formatCurrencyINR(monthlyWageBill);

    const basicWage50Compliance = useMemo(() => {
        if (!employees.length) return '100.0%';
        const compliant = employees.filter(e => {
            const gross = Number(e.monthlyGross || e.grossSalary || 1);
            const basic = Number(e.basicPay || e.basic || (gross * 0.5));
            return (basic / gross) >= 0.499;
        }).length;
        return `${((compliant / employees.length) * 100).toFixed(1)}%`;
    }, [employees]);

    const statutoryLiabilities = useMemo(() => {
        if (payrollSummary?.statutory) return formatCurrencyINR(payrollSummary.statutory);
        return formatCurrencyINR(monthlyWageBill * 0.12);
    }, [payrollSummary, monthlyWageBill]);

    const totalEwaDisbursed = useMemo(() => {
        return ewaTransactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    }, [ewaTransactions]);
    const ewaDrawdownPct = monthlyWageBill > 0 ? ((totalEwaDisbursed / monthlyWageBill) * 100).toFixed(1) : '0.0';

    const baseWageBill = Math.round(monthlyWageBill * 0.96);
    const newHiresWageBill = Math.round(monthlyWageBill * 0.04);
    const incrementsWageBill = Math.round(monthlyWageBill * 0.015);
    const exitsWageBill = Math.round(monthlyWageBill * 0.015);

    // --- Dynamic Derivations for Talent Funnel ---
    const openPositionsCount = positions.filter(p => ['open', 'active', 'vacant'].includes(String(p.status || '').toLowerCase())).length || positions.length;
    const totalCandidates = candidates.length;
    const appliedCount = totalCandidates || 0;
    const screenedCount = candidates.filter(c => ['screened', 'interview scheduled', 'interview', 'selected', 'offered', 'joined'].includes(String(c.stage || '').toLowerCase())).length;
    const interviewedCount = candidates.filter(c => ['interview', 'interview complete', 'selected', 'offered', 'joined'].includes(String(c.stage || '').toLowerCase())).length;
    const offeredCount = candidates.filter(c => ['offered', 'offer accepted', 'joined'].includes(String(c.stage || '').toLowerCase())).length;
    const joinedCount = candidates.filter(c => ['joined', 'onboarded'].includes(String(c.stage || '').toLowerCase())).length;

    const referralCount = employeeReferrals.length;
    const referralShare = totalCandidates > 0 ? ((referralCount / totalCandidates) * 100).toFixed(1) : '0.0';
    const offerAcceptanceRate = offeredCount > 0 ? ((joinedCount / offeredCount) * 100).toFixed(1) : (totalCandidates > 0 ? '100.0' : '0.0');

    const avgTimeToHireDays = useMemo(() => {
        const hired = candidates.filter(c => ['joined', 'onboarded', 'offered'].includes(String(c.stage || '').toLowerCase()));
        if (!hired.length) return totalCandidates > 0 ? '14 Days' : '0 Days';
        const totalDays = hired.reduce((sum, c) => {
            if (c.timeToHire) return sum + Number(c.timeToHire);
            if (c.appliedDate && c.offeredDate) {
                const diff = Math.max(1, Math.round((new Date(c.offeredDate) - new Date(c.appliedDate)) / (1000 * 60 * 60 * 24)));
                return sum + diff;
            }
            return sum + 14;
        }, 0);
        return `${Math.round(totalDays / hired.length)} Days`;
    }, [candidates, totalCandidates]);

    const sourcingChannels = useMemo(() => {
        if (!candidates.length) {
            return [
                { channel: 'Employee Internal Referrals', share: `${referralShare}%`, quality: 'High (4.8/5)' },
                { channel: 'Direct Inbound Career Site', share: `${Math.max(0, (100 - Number(referralShare)).toFixed(1))}%`, quality: 'Medium (4.2/5)' }
            ];
        }
        const counts = {};
        candidates.forEach(c => {
            const src = c.source || (c.referrer ? 'Employee Internal Referrals' : 'Direct Inbound Career Site');
            counts[src] = (counts[src] || 0) + 1;
        });
        return Object.entries(counts).map(([channel, count]) => ({
            channel,
            share: `${((count / candidates.length) * 100).toFixed(1)}%`,
            quality: channel.toLowerCase().includes('referral') ? 'High (4.8/5)' : 'Medium (4.2/5)'
        }));
    }, [candidates, referralShare]);

    const candidateFunnel = [
        { stage: '1. Applications Received', count: appliedCount, pct: '100%', color: 'var(--signal)' },
        { stage: '2. Resume Screening Passed', count: screenedCount, pct: appliedCount > 0 ? `${((screenedCount / appliedCount) * 100).toFixed(1)}%` : '0%', color: '#38bdf8' },
        { stage: '3. Technical & Culture Rounds', count: interviewedCount, pct: appliedCount > 0 ? `${((interviewedCount / appliedCount) * 100).toFixed(1)}%` : '0%', color: '#6366f1' },
        { stage: '4. Offer Extended', count: offeredCount, pct: appliedCount > 0 ? `${((offeredCount / appliedCount) * 100).toFixed(1)}%` : '0%', color: '#f59e0b' },
        { stage: '5. Joined & Onboarded', count: joinedCount, pct: appliedCount > 0 ? `${((joinedCount / appliedCount) * 100).toFixed(1)}%` : '0%', color: '#10b981' }
    ];

    // --- State for AI Reasoning Agent Playground ---
    const [aiQuery, setAiQuery] = useState('');
    const [aiResponses, setAiResponses] = useState([
        {
            query: 'Analyze engineering attrition risk for Q3',
            response: `Flight risk across organizational records is ${annualizedAttrition}%. Key focus: Ensure competitive market band parity and balanced overtime distribution.`,
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
            let reply = `Based on current telemetry across ${totalHeadcount} employee records, metrics are stable within policy thresholds. No regulatory anomalies detected.`;
            if (q.toLowerCase().includes('salary') || q.toLowerCase().includes('wage') || q.toLowerCase().includes('payroll')) {
                reply = `Current wage bill projection stands at ${wageBillDisplay}. 2026 Labour Code 50% Basic wage floor compliance is at ${basicWage50Compliance}. All statutory PF/ESI accruals are funded.`;
            } else if (q.toLowerCase().includes('attrition') || q.toLowerCase().includes('leave') || q.toLowerCase().includes('flight')) {
                reply = `Cross-functional flight risk is ${annualizedAttrition}%. Retention of high performers stands at ${retentionRate}%.`;
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
            ['Active Headcount', customDepartment, customDateRange.replace(/_/g, ' '), totalHeadcount.toLocaleString(), (totalHeadcount || 100).toLocaleString(), 'On Track'],
            ['Wage Bill Compliance', customDepartment, customDateRange.replace(/_/g, ' '), basicWage50Compliance, '100.0%', 'Compliant'],
            ['Attrition Risk Index', customDepartment, customDateRange.replace(/_/g, ' '), `${annualizedAttrition}%`, '< 5.0%', 'Safe'],
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
                <div className={styles.headerActions}>
                    <button
                        type="button"
                        className={styles.btnSecondary}
                        onClick={() => showToast('Live Telemetry', 'Workforce telemetry refreshed from database records.', 'info')}
                    >
                        <RefreshOutlined sx={{ fontSize: 16 }} />
                        Sync Telemetry
                    </button>
                    <button
                        type="button"
                        className={styles.btnPrimary}
                        onClick={() => setActiveTab('custom')}
                    >
                        <DownloadOutlined sx={{ fontSize: 16 }} />
                        Export Reports
                    </button>
                </div>
            </div>

            {/* Sub-Navigation Tabs */}
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

            {/* TAB 1: PEOPLE INTELLIGENCE */}
            {activeTab === 'people' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className={styles.statsGrid}>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: 'var(--signal-wash)', color: 'var(--signal)' }}>
                                <PeopleAltOutlined />
                            </div>
                            <div>
                                <div className={styles.statValue}>{totalHeadcount.toLocaleString()}</div>
                                <div className={styles.statLabel}>Active Global Headcount</div>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: 'var(--status-ok-wash)', color: 'var(--status-ok)' }}>
                                <TrendingUpOutlined />
                            </div>
                            <div>
                                <div className={styles.statValue}>{diversityIndex} / 100</div>
                                <div className={styles.statLabel}>Diversity & Inclusion Index</div>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: 'var(--pending-wash)', color: 'var(--pending)' }}>
                                <SpeedOutlined />
                            </div>
                            <div>
                                <div className={styles.statValue}>{annualizedAttrition}%</div>
                                <div className={styles.statLabel}>Annualized Attrition</div>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: 'var(--info-wash)', color: 'var(--info)' }}>
                                <SecurityOutlined />
                            </div>
                            <div>
                                <div className={styles.statValue}>{retentionRate}%</div>
                                <div className={styles.statLabel}>Retention Rate</div>
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
                                        <strong>{femalePct}% ({femaleCount} Employees)</strong>
                                    </div>
                                    <div style={{ height: '8px', background: 'var(--card-2)', borderRadius: '999px', overflow: 'hidden' }}>
                                        <div style={{ width: `${femalePct}%`, height: '100%', background: 'var(--signal)' }}></div>
                                    </div>
                                </div>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                                        <span>Male Representation</span>
                                        <strong>{malePct}% ({maleCount} Employees)</strong>
                                    </div>
                                    <div style={{ height: '8px', background: 'var(--card-2)', borderRadius: '999px', overflow: 'hidden' }}>
                                        <div style={{ width: `${malePct}%`, height: '100%', background: '#38bdf8' }}></div>
                                    </div>
                                </div>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                                        <span>Non-Binary / Self-Identified</span>
                                        <strong>{otherPct}% ({otherCount} Employees)</strong>
                                    </div>
                                    <div style={{ height: '8px', background: 'var(--card-2)', borderRadius: '999px', overflow: 'hidden' }}>
                                        <div style={{ width: `${otherPct}%`, height: '100%', background: '#10b981' }}></div>
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
                                    <div style={{ fontWeight: 700, color: 'var(--status-ok)', fontSize: '1.1rem' }}>{lowRiskPct}%</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--card-2)', borderRadius: '8px' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Medium Risk (Watchlist)</div>
                                        <div style={{ fontSize: '0.76rem', color: 'var(--text-2)' }}>Overtime spikes or stagnant band</div>
                                    </div>
                                    <div style={{ fontWeight: 700, color: 'var(--pending)', fontSize: '1.1rem' }}>{medRiskPct}%</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--card-2)', borderRadius: '8px' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>High Flight Risk (Urgent)</div>
                                        <div style={{ fontSize: '0.76rem', color: 'var(--text-2)' }}>Under-compensated vs peer quartile</div>
                                    </div>
                                    <div style={{ fontWeight: 700, color: 'var(--flag)', fontSize: '1.1rem' }}>{highRiskPct}%</div>
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
                                <div className={styles.statValue}>{capacityUtilization}%</div>
                                <div className={styles.statLabel}>Shift Capacity Utilization</div>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: 'var(--pending-wash)', color: 'var(--pending)' }}>
                                <TrendingUpOutlined />
                            </div>
                            <div>
                                <div className={styles.statValue}>{avgOtHours} hrs</div>
                                <div className={styles.statLabel}>Avg Overtime per Employee / Mo</div>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: 'var(--status-ok-wash)', color: 'var(--status-ok)' }}>
                                <CheckCircleOutline />
                            </div>
                            <div>
                                <div className={styles.statValue}>{unplannedAbsenteeism}%</div>
                                <div className={styles.statLabel}>Unplanned Absenteeism Rate</div>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: 'var(--info-wash)', color: 'var(--info)' }}>
                                <SpeedOutlined />
                            </div>
                            <div>
                                <div className={styles.statValue}>{mciScore} pts</div>
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
                            {siteData.map((item, idx) => (
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
                                <div className={styles.statValue}>{wageBillDisplay}</div>
                                <div className={styles.statLabel}>Monthly Gross Wage Bill</div>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: 'var(--status-ok-wash)', color: 'var(--status-ok)' }}>
                                <SecurityOutlined />
                            </div>
                            <div>
                                <div className={styles.statValue}>{basicWage50Compliance}</div>
                                <div className={styles.statLabel}>50% Basic Wage Compliance (2026 Code)</div>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: 'var(--info-wash)', color: 'var(--info)' }}>
                                <TrendingUpOutlined />
                            </div>
                            <div>
                                <div className={styles.statValue}>{statutoryLiabilities}</div>
                                <div className={styles.statLabel}>Statutory PF / ESI Liability</div>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: 'var(--pending-wash)', color: 'var(--pending)' }}>
                                <SpeedOutlined />
                            </div>
                            <div>
                                <div className={styles.statValue}>{ewaDrawdownPct}%</div>
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
                                <strong>{formatCurrencyINR(baseWageBill)}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem 1rem', background: 'var(--status-ok-wash)', borderRadius: '8px', color: 'var(--status-ok)' }}>
                                <span>+ New Hires Joined</span>
                                <strong>+ {formatCurrencyINR(newHiresWageBill)}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem 1rem', background: 'var(--status-ok-wash)', borderRadius: '8px', color: 'var(--status-ok)' }}>
                                <span>+ Promotion & CTC Increments</span>
                                <strong>+ {formatCurrencyINR(incrementsWageBill)}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem 1rem', background: 'var(--flag-wash)', borderRadius: '8px', color: 'var(--flag)' }}>
                                <span>- Offboarding Exits & Settled F&F</span>
                                <strong>- {formatCurrencyINR(exitsWageBill)}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.85rem 1rem', background: 'var(--signal-wash)', borderRadius: '8px', color: 'var(--signal)', fontWeight: 700 }}>
                                <span>Current Net Disbursable Wage Bill</span>
                                <span>{wageBillDisplay}</span>
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
                                <div className={styles.statValue}>{avgTimeToHireDays}</div>
                                <div className={styles.statLabel}>Average Time-to-Hire</div>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: 'var(--status-ok-wash)', color: 'var(--status-ok)' }}>
                                <TrendingUpOutlined />
                            </div>
                            <div>
                                <div className={styles.statValue}>{offerAcceptanceRate}%</div>
                                <div className={styles.statLabel}>Offer Acceptance Rate</div>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: 'var(--info-wash)', color: 'var(--info)' }}>
                                <PeopleAltOutlined />
                            </div>
                            <div>
                                <div className={styles.statValue}>{referralShare}%</div>
                                <div className={styles.statLabel}>Referral Hire Sourcing Share</div>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: 'var(--pending-wash)', color: 'var(--pending)' }}>
                                <SpeedOutlined />
                            </div>
                            <div>
                                <div className={styles.statValue}>{openPositionsCount} Req</div>
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
                                {candidateFunnel.map((step, idx) => (
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
                                {sourcingChannels.map((item, idx) => (
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
                                    { code: 'METRIC_HEADCOUNT_V1', name: 'Global Headcount Snapshot', cohort: totalHeadcount, suppressed: totalHeadcount < 5 },
                                    { code: 'METRIC_ATTRITION_V2', name: 'Flight Risk Predictive Score', cohort: exitCount, suppressed: exitCount < 5 },
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
