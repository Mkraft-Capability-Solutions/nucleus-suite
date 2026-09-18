"use client";
import {useTranslation} from '@/context/I18nContext';

import { readData } from '../../services/workspace-data.mjs';

import React, { useState, useEffect, useMemo } from 'react';
import {
    UserCheck, Clock, CheckCircle2, AlertCircle, ArrowRight,
    Sparkles, FileText, Send, User, ChevronRight, Layers, Workflow,
    Play, Settings2, SlidersHorizontal, Laptop, ShieldCheck, Plus,
    Award, Download, Printer, Calendar, Gift, Heart, Share2, Tag
} from 'lucide-react';
import styles from './OnboardingView.module.css';
import { useHRMS } from '@/context/HRMSContext';
import WorkflowBuilderModal from './WorkflowBuilderModal';
import { launchAction } from '@/lib/action-launcher';
import { downloadPrintableDocument } from '@/utils/exportUtils';

const OnboardingView = ({ onNavigate, onSelectConsole, activeSubFeature }) => {
    const {t: translateText}=useTranslation();

    const {
        onboardingTasks: initialTasks = [], workflows = [], showToast,
        hardwareAssets = [], allocateHardwareAsset, markAssetReturned,
        recognitionAwards: initialAwards = [],
        generateHRLetter, letterTemplates = [], employees = [],
        assetTypes = [], recognitionAwardTypes = [], establishmentRulesetVersion
    } = useHRMS() || {};

    const [taskList, setTaskList] = useState(initialTasks);
    const onboardingTasks = taskList.length > 0 ? taskList : initialTasks;
    const [awardsList, setAwardsList] = useState(initialAwards);
    const [activeTab, setActiveTab] = useState(readData("components.Workspace.OnboardingView", "initialState_1")); // default to 'assets' to showcase Sprint 4!

    useEffect(() => {
        if (!activeSubFeature) return;
        if (activeSubFeature === 'asset_register' || activeSubFeature === 'assets' || activeSubFeature === 'ops_assets') {
            setActiveTab('assets');
        } else if (activeSubFeature === 'letters_register' || activeSubFeature === 'letters') {
            setActiveTab('letters');
        } else if (activeSubFeature === 'recognition' || activeSubFeature === 'talent_recognition') {
            setActiveTab('recognition');
        } else if (activeSubFeature === 'studio' || activeSubFeature === 'platform_workflows') {
            setActiveTab('studio');
        } else if (activeSubFeature === 'milestones' || activeSubFeature === 'induction_tasks') {
            setActiveTab('milestones');
        } else if (activeSubFeature === 'joining_chain' || activeSubFeature === 'clearance_board' || activeSubFeature === 'chains') {
            setActiveTab('chains');
        }
    }, [activeSubFeature]);

    const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);

    // Asset Allocation Modal State
    const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
    const [assetType, setAssetType] = useState(readData("components.Workspace.OnboardingView", "initialState_2"));
    const [assetBrand, setAssetBrand] = useState(readData("components.Workspace.OnboardingView", "initialState_3"));
    const [assetModel, setAssetModel] = useState(readData("components.Workspace.OnboardingView", "initialState_4"));
    const [assetSerial, setAssetSerial] = useState('');
    const [assetEmpId, setAssetEmpId] = useState(readData("components.Workspace.OnboardingView", "initialState_5"));
    const [assetValue, setAssetValue] = useState(readData("components.Workspace.OnboardingView", "initialState_6"));

    // HR Letter Studio State
    const [selectedTemplateId, setSelectedTemplateId] = useState(readData("components.Workspace.OnboardingView", "initialState_7"));
    const [selectedEmpId, setSelectedEmpId] = useState(readData("components.Workspace.OnboardingView", "initialState_8"));
    const [letterCustomFields, setLetterCustomFields] = useState(readData("components.Workspace.OnboardingView", "letterCustomFields_1"));

    // Recognition Modal State
    const [isAwardModalOpen, setIsAwardModalOpen] = useState(false);
    const [awardEmpId, setAwardEmpId] = useState(readData("components.Workspace.OnboardingView", "initialState_9"));
    const [awardType, setAwardType] = useState(readData("components.Workspace.OnboardingView", "initialState_10"));
    const [awardCitation, setAwardCitation] = useState('');
    const [awardPrize, setAwardPrize] = useState(readData("components.Workspace.OnboardingView", "initialState_11"));

    const triggerChains = readData("components.Workspace.OnboardingView", "triggerChains_2");

    // Handle Asset Submit
    const handleAssetSubmit = (e) => {
        e.preventDefault();
        if (!assetSerial || !assetModel) return;
        allocateHardwareAsset({
            assetType,
            brand: assetBrand,
            model: assetModel,
            serialNumber: assetSerial,
            assignedToEmployeeId: assetEmpId,
            replacementValue: assetValue
        });
        try {
            fetch('/api/v1/assets/allocate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
                body: JSON.stringify({
                    assetType,
                    brand: assetBrand,
                    model: assetModel,
                    serialNumber: assetSerial,
                    assignedToEmployeeId: assetEmpId,
                    replacementValue: assetValue
                })
            }).catch(e => console.warn('Asset DB sync notice:', e));
        } catch {}
        setIsAssetModalOpen(false);
        setAssetSerial('');
    };

    // Handle Award Submit
    const handleAwardSubmit = async (e) => {
        e.preventDefault();
        if (!awardCitation) return;

        const newAward = {
            id: Date.now(),
            employeeId: awardEmpId,
            awardType,
            citation: awardCitation,
            rewardAmount: awardPrize,
            grantedAt: new Date().toISOString()
        };
        setAwardsList(prev => [newAward, ...prev]);

        try {
            await fetch('/api/v1/recognition-events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
                body: JSON.stringify({
                    recipientEmployeeId: awardEmpId || '00000000-0000-0000-0000-000000000001',
                    message: `${awardType}: ${awardCitation}`,
                    points: Number(awardPrize) || 100
                })
            });
            showToast?.('Award Granted', `Granted ${awardType} to employee`, 'success');
        } catch (err) {
            console.warn('Award sync warning:', err);
        }

        setIsAwardModalOpen(false);
        setAwardCitation('');
    };

    const handleCompleteTask = async (taskId) => {
        setTaskList(prev => prev.map(t => t.id === taskId ? { ...t, status: 'Completed' } : t));
        try {
            await fetch(`/api/v1/onboarding/tasks/${taskId}/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
                body: JSON.stringify({ note: 'Task marked completed from Onboarding workspace' })
            });
            showToast?.('Task Completed', 'Onboarding milestone saved to DB.', 'success');
        } catch (err) {
            console.warn('Onboarding task complete warning:', err);
        }
    };

    // Rendered letter preview
    const selectedEmployeeObj = (employees && employees.length > 0) ? (employees.find(e => e.id === selectedEmpId) || employees[0]) : null;
    const renderedLetter = useMemo(() => {
        if (!generateHRLetter || !selectedEmployeeObj) return null;
        return generateHRLetter(selectedTemplateId, selectedEmpId, letterCustomFields);
    }, [generateHRLetter, selectedTemplateId, selectedEmpId, selectedEmployeeObj, letterCustomFields]);

    // Dedicated Print & PDF Export Handler for Formatted Letterhead
    const handlePrintOrExportLetter = (isExportPdf = false) => {
        const letterTitle = renderedLetter?.title || 'HR Letter';
        const letterEmployee = selectedEmployeeObj?.name || 'Employee';
        const docTitle = `${letterTitle} - ${letterEmployee}`;
        const rawContent = renderedLetter?.renderedText || '';

        // Open print/export window with isolated letterhead formatting
        const printWin = typeof window !== 'undefined' ? window.open('', '_blank', 'width=850,height=950') : null;

        const letterheadHtml = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="utf-8" />
                <title>${docTitle}</title>
                <style>
                    @page {
                        size: A4 portrait;
                        margin: 18mm 16mm;
                    }
                    * {
                        box-sizing: border-box;
                    }
                    body {
                        font-family: 'Times New Roman', Times, Georgia, serif;
                        color: #1a202c;
                        background: #ffffff;
                        margin: 0;
                        padding: ${isExportPdf ? '20px 24px' : '0'};
                        font-size: 11pt;
                        line-height: 1.65;
                        position: relative;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .top-bar {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                        padding: 12px 18px;
                        border-radius: 8px;
                        margin-bottom: 24px;
                        font-family: system-ui, -apple-system, sans-serif;
                    }
                    .top-bar strong {
                        color: #0F6E5C;
                        font-size: 14px;
                    }
                    .top-bar span {
                        color: #64748b;
                        font-size: 12px;
                    }
                    .top-bar button {
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                        background: #0F6E5C;
                        color: #ffffff;
                        border: none;
                        padding: 8px 18px;
                        border-radius: 6px;
                        font-weight: 600;
                        font-size: 13px;
                        cursor: pointer;
                        box-shadow: 0 2px 4px rgba(15,110,92,0.2);
                    }
                    .top-bar button:hover {
                        background: #0b5346;
                    }
                    @media print {
                        .top-bar {
                            display: none !important;
                        }
                        body {
                            padding: 0 !important;
                        }
                    }
                    .sheet {
                        position: relative;
                        max-width: 800px;
                        margin: 0 auto;
                        background: #ffffff;
                    }
                    .watermark-layer {
                        position: fixed;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%) rotate(-32deg);
                        font-size: 40pt;
                        font-family: system-ui, sans-serif;
                        color: rgba(15, 110, 92, 0.05);
                        font-weight: 900;
                        letter-spacing: 0.12em;
                        pointer-events: none;
                        white-space: nowrap;
                        z-index: 0;
                        user-select: none;
                    }
                    .header-box {
                        border-bottom: 2.5px solid #10222f;
                        padding-bottom: 12px;
                        margin-bottom: 24px;
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                    }
                    .brand-title {
                        font-size: 24pt;
                        font-weight: 800;
                        color: #0F6E5C;
                        letter-spacing: 0.08em;
                        font-family: 'Times New Roman', Times, serif;
                        line-height: 1.1;
                    }
                    .brand-subtitle {
                        font-size: 8.5pt;
                        color: #5A6B78;
                        margin-top: 4px;
                        font-family: system-ui, sans-serif;
                    }
                    .brand-office {
                        text-align: right;
                        font-size: 8.5pt;
                        color: #5A6B78;
                        line-height: 1.4;
                        font-family: system-ui, sans-serif;
                    }
                    .letter-text {
                        position: relative;
                        z-index: 1;
                        white-space: pre-wrap;
                        font-size: 11pt;
                        line-height: 1.7;
                        text-align: justify;
                    }
                    .footer-box {
                        margin-top: 40px;
                        padding-top: 12px;
                        border-top: 1px solid #e2e8f0;
                        display: flex;
                        justify-content: space-between;
                        font-size: 8pt;
                        color: #94a3b8;
                        font-family: system-ui, sans-serif;
                    }
                </style>
            </head>
            <body>
                <div class="top-bar">
                    <div>
                        <strong>${letterTitle}</strong>
                        <br />
                        <span>${isExportPdf ? 'Select "Save as PDF" in the destination dropdown to export this document' : 'Letterhead document preview ready for printing'}</span>
                    </div>
                    <button onclick="window.print()">
                        ${isExportPdf ? '💾 Save as PDF' : '🖨️ Print Document'}
                    </button>
                </div>
                <div class="sheet">
                    <div class="watermark-layer">NUCLEUS OFFICIAL DOCUMENT</div>
                    <div class="header-box">
                        <div>
                            <div class="brand-title">N U C L E U S</div>
                            <div class="brand-subtitle">Nucleus Technologies India Pvt Ltd • Corporate Human Resources</div>
                        </div>
                        <div class="brand-office">
                            Registered Office: Manyata Tech Park,<br />
                            Bengaluru<br />
                            CIN: U72200KA2021PTC148892
                        </div>
                    </div>
                    <div class="letter-text">${rawContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                    <div class="footer-box">
                        <span>Nucleus Enterprise Solutions • System Generated Authentic Document</span>
                        <span>Verification Ref: NUC-${selectedTemplateId}-${selectedEmpId}</span>
                    </div>
                </div>
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 300);
                    };
                </script>
            </body>
            </html>
        `;

        if (printWin) {
            printWin.document.open();
            printWin.document.write(letterheadHtml);
            printWin.document.close();
        } else {
            // Fallback to invisible iframe if popups blocked
            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = 'none';
            document.body.appendChild(iframe);
            const iframeDoc = iframe.contentWindow.document;
            iframeDoc.open();
            iframeDoc.write(letterheadHtml);
            iframeDoc.close();
            setTimeout(() => {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
                setTimeout(() => {
                    document.body.removeChild(iframe);
                }, 1000);
            }, 500);
        }

        showToast(
            isExportPdf ? 'PDF Export Ready' : 'Print Document',
            `${letterTitle} for ${letterEmployee} formatted on corporate letterhead.`,
            'success'
        );
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.headerRow}>
                <div className={styles.titleBlock}>
                    <h2>{readData("components.Workspace.OnboardingView", "OnboardingView_text_3")}</h2>
                    <p>{readData("components.Workspace.OnboardingView", "OnboardingView_text_4")}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <button
                        className={styles.btnSecondary}
                        onClick={() => setIsAssetModalOpen(true)}
                    >
                        <Laptop size={15} />{readData("components.Workspace.OnboardingView", "OnboardingView_text_5")}</button>
                    <button
                        className={styles.btnSecondary}
                        onClick={() => setIsAwardModalOpen(true)}
                    >
                        <Award size={15} />{readData("components.Workspace.OnboardingView", "OnboardingView_text_6")}</button>
                    <button
                        className={styles.btnPrimary}
                        onClick={() => setIsWorkflowModalOpen(true)}
                        title={readData("components.Workspace.OnboardingView", "OnboardingView_title_7")}
                    >
                        <Workflow size={16} />{readData("components.Workspace.OnboardingView", "OnboardingView_text_8")}</button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className={styles.tabNav}>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'assets' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('assets')}
                >
                    <Laptop size={16} />{readData("components.Workspace.OnboardingView", "OnboardingView_text_9")}<span className={`${styles.badge} ${styles.badgeInfo}`}>{hardwareAssets?.length || readData("components.Workspace.OnboardingView", "fallback_1")}</span>
                </button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'letters' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('letters')}
                >
                    <FileText size={16} />{readData("components.Workspace.OnboardingView", "OnboardingView_text_10")}<span className={`${styles.badge} ${styles.badgeSuccess}`}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_11")}</span>
                </button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'recognition' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('recognition')}
                >
                    <Award size={16} />{readData("components.Workspace.OnboardingView", "OnboardingView_text_12")}<span className={`${styles.badge} ${styles.badgePurple}`}>{(awardsList?.length || initialAwards?.length || readData("components.Workspace.OnboardingView", "fallback_2"))}{readData("components.Workspace.OnboardingView", "OnboardingView_text_13")}</span>
                </button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'studio' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('studio')}
                >
                    <Workflow size={16} />{readData("components.Workspace.OnboardingView", "OnboardingView_text_14")}{workflows.length}{readData("components.Workspace.OnboardingView", "OnboardingView_text_15")}</button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'milestones' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('milestones')}
                >
                    <Clock size={16} />{readData("components.Workspace.OnboardingView", "OnboardingView_text_16")}</button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'chains' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('chains')}
                >
                    <Layers size={16} />{readData("components.Workspace.OnboardingView", "OnboardingView_text_17")}</button>
            </div>

            {/* ========================================================================= */}
            {/* TAB 1: HARDWARE ASSET REGISTER                                            */}
            {/* ========================================================================= */}
            {activeTab === 'assets' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className={styles.card} style={{ borderLeft: '4px solid #3b82f6' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Laptop size={20} color="#3b82f6" />{readData("components.Workspace.OnboardingView", "OnboardingView_text_18")}</h3>
                                <p style={{ margin: '0.35rem 0 0', fontSize: '0.86rem', color: 'var(--text-2)', maxWidth: '750px' }}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_19")}<strong>{readData("components.Workspace.OnboardingView", "OnboardingView_text_20")}</strong>{readData("components.Workspace.OnboardingView", "OnboardingView_text_21")}</p>
                            </div>
                            <button className={styles.btnPrimary} onClick={() => setIsAssetModalOpen(true)}>
                                <Plus size={15} />{readData("components.Workspace.OnboardingView", "OnboardingView_text_22")}</button>
                        </div>
                    </div>

                    <div className={styles.card}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text)' }}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_23")}</h3>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_24")}{hardwareAssets.length}</span>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                                <thead>
                                    <tr style={{ background: 'var(--card-2, #fafafa)', textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
                                        <th style={{ padding: '0.65rem 0.85rem', color: 'var(--text-2)' }}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_25")}</th>
                                        <th style={{ padding: '0.65rem 0.85rem', color: 'var(--text-2)' }}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_26")}</th>
                                        <th style={{ padding: '0.65rem 0.85rem', color: 'var(--text-2)' }}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_27")}</th>
                                        <th style={{ padding: '0.65rem 0.85rem', color: 'var(--text-2)' }}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_28")}</th>
                                        <th style={{ padding: '0.65rem 0.85rem', color: 'var(--text-2)' }}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_29")}</th>
                                        <th style={{ padding: '0.65rem 0.85rem', color: 'var(--text-2)' }}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_30")}</th>
                                        <th style={{ padding: '0.65rem 0.85rem', color: 'var(--text-2)' }}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_31")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {hardwareAssets.map(asset => (
                                        <tr key={asset.id} style={{ borderBottom: '1px solid var(--line-soft, #eee)' }}>
                                            <td style={{ padding: '0.65rem 0.85rem', fontFamily: 'var(--f-num, monospace)', fontWeight: 700 }}>
                                                {asset.assetTag}
                                            </td>
                                            <td style={{ padding: '0.65rem 0.85rem' }}>
                                                <div style={{ fontWeight: 600, color: 'var(--text)' }}>{asset.model}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{asset.brand}{readData("components.Workspace.OnboardingView", "OnboardingView_text_32")}{asset.assetType}</div>
                                            </td>
                                            <td style={{ padding: '0.65rem 0.85rem' }}>
                                                <code style={{ background: 'var(--card-2)', padding: '0.2rem 0.45rem', borderRadius: 4, border: '1px solid var(--line)', fontFamily: 'var(--f-num, monospace)', fontWeight: 700, color: '#2563eb' }}>
                                                    {asset.serialNumber}
                                                </code>
                                            </td>
                                            <td style={{ padding: '0.65rem 0.85rem' }}>
                                                <strong style={{ color: 'var(--text)' }}>{asset.assignedToName}</strong>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{asset.assignedToEmployeeId}</div>
                                            </td>
                                            <td style={{ padding: '0.65rem 0.85rem', fontSize: '0.8rem', color: 'var(--text-2)' }}>
                                                {asset.assignedDate}
                                            </td>
                                            <td style={{ padding: '0.65rem 0.85rem' }}>
                                                <span className={`${styles.badge} ${asset.status === 'ASSIGNED' ? styles.badgeSuccess : styles.badgeInfo}`}>
                                                    {asset.status === 'ASSIGNED' ? readData("components.Workspace.OnboardingView", "display_12") : readData("components.Workspace.OnboardingView", "display_13")}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.65rem 0.85rem' }}>
                                                {asset.status === 'ASSIGNED' ? (
                                                    <button
                                                        className={styles.btnSecondary}
                                                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                                                        onClick={() => launchAction('assetReturn', { asset: `${asset.brand} ${asset.model}` })}
                                                    >{readData("components.Workspace.OnboardingView", "OnboardingView_text_33")}</button>
                                                ) : (
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--signal)', fontWeight: 600 }}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_34")}</span>
                                                )}
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
            {/* TAB 2: HR LETTER GENERATION STUDIO                                        */}
            {/* ========================================================================= */}
            {activeTab === 'letters' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className={styles.card} style={{ borderLeft: '4px solid #05CD99' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <FileText size={20} color="#05CD99" />{readData("components.Workspace.OnboardingView", "OnboardingView_text_35")}</h3>
                                <p style={{ margin: '0.35rem 0 0', fontSize: '0.86rem', color: 'var(--text-2)', maxWidth: '750px' }}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_36")}<strong>{readData("components.Workspace.OnboardingView", "OnboardingView_text_37")}</strong>{readData("components.Workspace.OnboardingView", "OnboardingView_text_38")}<strong>{readData("components.Workspace.OnboardingView", "OnboardingView_text_39")}</strong>{readData("components.Workspace.OnboardingView", "OnboardingView_text_40")}<strong>{readData("components.Workspace.OnboardingView", "OnboardingView_text_41")}</strong>{readData("components.Workspace.OnboardingView", "OnboardingView_text_42")}<strong>{readData("components.Workspace.OnboardingView", "OnboardingView_text_43")}</strong>{readData("components.Workspace.OnboardingView", "OnboardingView_text_44")}</p>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    className={styles.btnSecondary}
                                    onClick={() => handlePrintOrExportLetter(false)}
                                >
                                    <Printer size={14} />{readData("components.Workspace.OnboardingView", "OnboardingView_text_45")}</button>
                                <button
                                    className={styles.btnPrimary}
                                    onClick={() => handlePrintOrExportLetter(true)}
                                >
                                    <Download size={14} />{readData("components.Workspace.OnboardingView", "OnboardingView_text_46")}</button>
                            </div>
                        </div>
                    </div>

                    {/* Studio Split Grid: Form on Left, Live Document Preview on Right */}
                    <div className={styles.letterStudioGrid}>
                        {/* Configuration Controls */}
                        <div className={styles.card}>
                            <h4 style={{ margin: '0 0 1rem', fontSize: '0.95rem', color: 'var(--text)' }}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_47")}</h4>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div className={styles.formGroup}>
                                    <label>{readData("components.Workspace.OnboardingView", "OnboardingView_text_48")}</label>
                                    <select
                                        value={selectedTemplateId}
                                        onChange={(e) => setSelectedTemplateId(e.target.value)}
                                        className={styles.formInput}
                                    >
                                        <option value="APPOINTMENT">{readData("components.Workspace.OnboardingView", "OnboardingView_text_49")}</option>
                                        <option value="INCREMENT">{readData("components.Workspace.OnboardingView", "OnboardingView_text_50")}</option>
                                        <option value="PROMOTION">{readData("components.Workspace.OnboardingView", "OnboardingView_text_51")}</option>
                                        <option value="RELIEVING">{readData("components.Workspace.OnboardingView", "OnboardingView_text_52")}</option>
                                    </select>
                                </div>

                                <div className={styles.formGroup}>
                                    <label>{readData("components.Workspace.OnboardingView", "OnboardingView_text_53")}</label>
                                    <select
                                        value={selectedEmpId}
                                        onChange={(e) => setSelectedEmpId(e.target.value)}
                                        className={styles.formInput}
                                    >
                                        {employees.map(e => (
                                            <option key={e.id} value={e.id}>
                                                {e.name}{readData("components.Workspace.OnboardingView", "OnboardingView_text_54")}{e.id}{readData("components.Workspace.OnboardingView", "OnboardingView_text_55")}{e.role}{readData("components.Workspace.OnboardingView", "OnboardingView_text_56")}{e.dept}{readData("components.Workspace.OnboardingView", "OnboardingView_text_57")}</option>
                                        ))}
                                    </select>
                                </div>

                                {selectedTemplateId === 'INCREMENT' && (
                                    <>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                            <div className={styles.formGroup}>
                                                <label>{readData("components.Workspace.OnboardingView", "OnboardingView_text_58")}</label>
                                                <input
                                                    type="text"
                                                    value={letterCustomFields.hike_percentage}
                                                    onChange={(e) => setLetterCustomFields({ ...letterCustomFields, hike_percentage: e.target.value })}
                                                    className={styles.formInput}
                                                />
                                            </div>
                                            <div className={styles.formGroup}>
                                                <label>{readData("components.Workspace.OnboardingView", "OnboardingView_text_59")}</label>
                                                <input
                                                    type="text"
                                                    value={letterCustomFields.performance_band}
                                                    onChange={(e) => setLetterCustomFields({ ...letterCustomFields, performance_band: e.target.value })}
                                                    className={styles.formInput}
                                                />
                                            </div>
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>{readData("components.Workspace.OnboardingView", "OnboardingView_text_60")}</label>
                                            <input
                                                type="text"
                                                value={letterCustomFields.revised_ctc}
                                                onChange={(e) => setLetterCustomFields({ ...letterCustomFields, revised_ctc: e.target.value })}
                                                className={styles.formInput}
                                            />
                                        </div>
                                    </>
                                )}

                                {selectedTemplateId === 'PROMOTION' && (
                                    <>
                                        <div className={styles.formGroup}>
                                            <label>{readData("components.Workspace.OnboardingView", "OnboardingView_text_61")}</label>
                                            <input
                                                type="text"
                                                value={letterCustomFields.promoted_designation}
                                                onChange={(e) => setLetterCustomFields({ ...letterCustomFields, promoted_designation: e.target.value })}
                                                className={styles.formInput}
                                            />
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>{readData("components.Workspace.OnboardingView", "OnboardingView_text_62")}</label>
                                            <input
                                                type="text"
                                                value={letterCustomFields.new_band}
                                                onChange={(e) => setLetterCustomFields({ ...letterCustomFields, new_band: e.target.value })}
                                                className={styles.formInput}
                                            />
                                        </div>
                                    </>
                                )}

                                {selectedTemplateId === 'RELIEVING' && (
                                    <div className={styles.formGroup}>
                                        <label>{readData("components.Workspace.OnboardingView", "OnboardingView_text_63")}</label>
                                        <input
                                            type="text"
                                            value={letterCustomFields.relieving_date}
                                            onChange={(e) => setLetterCustomFields({ ...letterCustomFields, relieving_date: e.target.value })}
                                            className={styles.formInput}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Live Document Preview */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <strong style={{ fontSize: '0.9rem', color: 'var(--text)' }}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_64")}</strong>
                                <span className={`${styles.badge} ${styles.badgeSuccess}`}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_65")}</span>
                            </div>

                            <div className={styles.letterPreviewCard} id="formatted-letterhead-preview">
                                <div style={{ borderBottom: '2px solid #10222f', paddingBottom: '0.75rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F6E5C', letterSpacing: '0.05em' }}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_66")}</div>
                                        <div style={{ fontSize: '0.72rem', color: '#5A6B78' }}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_67")}</div>
                                    </div>
                                    <div style={{ fontSize: '0.72rem', textAlign: 'right', color: '#5A6B78' }}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_68")}<br />{readData("components.Workspace.OnboardingView", "OnboardingView_text_69")}</div>
                                </div>

                                {renderedLetter?.renderedText}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 3: EMPLOYEE RECOGNITION & EVENTS                                      */}
            {/* ========================================================================= */}
            {activeTab === 'recognition' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className={styles.card} style={{ borderLeft: '4px solid #f59e0b' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Award size={20} color="#f59e0b" />{readData("components.Workspace.OnboardingView", "OnboardingView_text_70")}</h3>
                                <p style={{ margin: '0.35rem 0 0', fontSize: '0.86rem', color: 'var(--text-2)', maxWidth: '750px' }}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_71")}</p>
                            </div>
                            <button className={styles.btnPrimary} onClick={() => setIsAwardModalOpen(true)}>
                                <Award size={15} />{readData("components.Workspace.OnboardingView", "OnboardingView_text_72")}</button>
                        </div>
                    </div>

                    {/* Automated Milestone Cards (Point 20) */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                        <div style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(245, 158, 11, 0.04))', padding: '1.25rem', borderRadius: 'var(--r-card)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#b45309', fontWeight: 700, fontSize: '0.88rem' }}>
                                <Gift size={18} />{readData("components.Workspace.OnboardingView", "OnboardingView_text_73")}</div>
                            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
                                    <span><strong>{readData("components.Workspace.OnboardingView", "OnboardingView_text_74")}</strong>{readData("components.Workspace.OnboardingView", "OnboardingView_text_75")}</span>
                                    <span style={{ color: '#b45309', fontWeight: 600 }}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_76")}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
                                    <span><strong>{readData("components.Workspace.OnboardingView", "OnboardingView_text_77")}</strong>{readData("components.Workspace.OnboardingView", "OnboardingView_text_78")}</span>
                                    <span style={{ color: '#b45309', fontWeight: 600 }}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_79")}</span>
                                </div>
                            </div>
                        </div>

                        <div style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(16, 185, 129, 0.04))', padding: '1.25rem', borderRadius: 'var(--r-card)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--signal-ink)', fontWeight: 700, fontSize: '0.88rem' }}>
                                <Calendar size={18} />{readData("components.Workspace.OnboardingView", "OnboardingView_text_80")}</div>
                            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
                                    <span><strong>{readData("components.Workspace.OnboardingView", "OnboardingView_text_81")}</strong>{readData("components.Workspace.OnboardingView", "OnboardingView_text_82")}</span>
                                    <span style={{ color: 'var(--signal)', fontWeight: 700 }}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_83")}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
                                    <span><strong>{readData("components.Workspace.OnboardingView", "OnboardingView_text_84")}</strong>{readData("components.Workspace.OnboardingView", "OnboardingView_text_85")}</span>
                                    <span style={{ color: 'var(--signal)', fontWeight: 700 }}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_86")}</span>
                                </div>
                            </div>
                        </div>

                        <div style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(59, 130, 246, 0.04))', padding: '1.25rem', borderRadius: 'var(--r-card)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#2563eb', fontWeight: 700, fontSize: '0.88rem' }}>
                                <UserCheck size={18} />{readData("components.Workspace.OnboardingView", "OnboardingView_text_87")}</div>
                            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
                                    <span><strong>{readData("components.Workspace.OnboardingView", "OnboardingView_text_88")}</strong>{readData("components.Workspace.OnboardingView", "OnboardingView_text_89")}</span>
                                    <span style={{ color: '#2563eb', fontWeight: 600 }}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_90")}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
                                    <span><strong>{readData("components.Workspace.OnboardingView", "OnboardingView_text_91")}</strong>{readData("components.Workspace.OnboardingView", "OnboardingView_text_92")}</span>
                                    <span style={{ color: '#2563eb', fontWeight: 600 }}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_93")}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recognition Awards Wall (Point 18) */}
                    <div className={styles.card}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text)' }}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_94")}</h3>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>{(awardsList?.length || initialAwards?.length || 0)}{readData("components.Workspace.OnboardingView", "OnboardingView_text_95")}</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
                            {(awardsList.length > 0 ? awardsList : initialAwards).map(award => (
                                <div key={award.id} style={{ background: 'var(--card-2, #fafafa)', padding: '1.25rem', borderRadius: 'var(--r-card)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <strong style={{ fontSize: '1rem', color: 'var(--text)' }}>{award.employeeName}</strong>
                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>{award.dept}</div>
                                        </div>
                                        <span className={`${styles.badge} ${styles.badgeWarning}`}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_96")}{award.awardType}
                                        </span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text)', fontStyle: 'italic', lineHeight: 1.5 }}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_97")}{award.citation}{readData("components.Workspace.OnboardingView", "OnboardingView_text_98")}</p>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid var(--line-soft, #eee)', fontSize: '0.78rem' }}>
                                        <span style={{ color: 'var(--text-2)' }}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_99")}{award.awardedBy}</span>
                                        <strong style={{ color: 'var(--signal)', fontFamily: 'var(--f-num, monospace)' }}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_100")}{award.rewardAmount.toLocaleString()}</strong>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 4: ACTIVE WORKFLOW PIPELINES (ORIGINAL TAB)                           */}
            {/* ========================================================================= */}
            {activeTab === 'studio' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{
                        background: 'var(--card)',
                        border: '1px solid var(--line)',
                        borderRadius: 'var(--r-card)',
                        padding: '1.25rem 1.75rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '1rem',
                        boxShadow: 'var(--shadow-raise)'
                    }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Workflow size={18} color="var(--info)" />{readData("components.Workspace.OnboardingView", "OnboardingView_text_101")}{workflows.length}{readData("components.Workspace.OnboardingView", "OnboardingView_text_102")}</h3>
                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.84rem', color: 'var(--text-2)' }}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_103")}</p>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
                        {workflows.map(wf => (
                            <div key={wf.id} className={styles.card} style={{ borderLeft: `4px solid ${wf.status === 'Active' ? '#05CD99' : '#f59e0b'}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                    <div>
                                        <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text)' }}>{wf.title}</h4>
                                        <span style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_104")}{wf.category}</span>
                                    </div>
                                    <span className={`${styles.badge} ${wf.status === 'Active' ? styles.badgeSuccess : styles.badgeWarning}`}>
                                        {wf.status}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.82rem', color: 'var(--text-2)', marginBottom: '1rem' }}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_105")}<strong>{wf.trigger}</strong>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button className={styles.btnSecondary} style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }} onClick={() => setIsWorkflowModalOpen(true)}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_106")}</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 5: 30-60-90 MILESTONES (ORIGINAL TAB)                                 */}
            {/* ========================================================================= */}
            {activeTab === 'milestones' && (
                <div className={styles.timelineGrid}>
                    {onboardingTasks.map((t) => (
                        <div key={t.id} className={styles.taskRow}>
                            <div>
                                <strong style={{ color: 'var(--text)', display: 'block' }}>{t.title}</strong>
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_107")}{t.phase}{readData("components.Workspace.OnboardingView", "OnboardingView_text_108")}{t.days}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <span className={t.status === 'Completed' ? styles.badgeCompleted : styles.badgePending}>
                                    {t.status}
                                </span>
                                {t.status !== 'Completed' && (
                                    <button
                                        className={styles.btnSecondary}
                                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                                        onClick={() => handleCompleteTask(t.id)}
                                    >{readData("components.Workspace.OnboardingView", "OnboardingView_text_109")}</button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 6: TRIGGER CHAINS (ORIGINAL TAB)                                      */}
            {/* ========================================================================= */}
            {activeTab === 'chains' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {triggerChains.map((chain, i) => (
                        <div key={i} className={styles.chainCard}>
                            <strong style={{ color: 'var(--text)' }}>{chain.event}</strong>
                            <div className={styles.chainSteps}>
                                {chain.steps.map((step, si) => (
                                    <React.Fragment key={si}>
                                        <span className={styles.chainStep}>{step}</span>
                                        {si < chain.steps.length - 1 && <ArrowRight size={14} color="var(--text-3)" />}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ========================================================================= */}
            {/* ALLOCATE HARDWARE ASSET MODAL (POINT 23)                                  */}
            {/* ========================================================================= */}
            {isAssetModalOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsAssetModalOpen(false)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text)' }}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_110")}</h3>
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_111")}</span>
                            </div>
                            <button
                                style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-2)' }}
                                onClick={() => setIsAssetModalOpen(false)}
                            >{readData("components.Workspace.OnboardingView", "OnboardingView_text_112")}</button>
                        </div>

                        <form onSubmit={handleAssetSubmit} className={styles.modalBody}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className={styles.formGroup}>
                                    <label>{readData("components.Workspace.OnboardingView", "OnboardingView_text_113")}</label>
                                    <select
                                        value={assetType}
                                        onChange={(e) => setAssetType(e.target.value)}
                                        className={styles.formInput}
                                    >
                                        <option value="LAPTOP">{readData("components.Workspace.OnboardingView", "OnboardingView_text_114")}</option>
                                        <option value="MONITOR">{readData("components.Workspace.OnboardingView", "OnboardingView_text_115")}</option>
                                        <option value="SMARTPHONE">{readData("components.Workspace.OnboardingView", "OnboardingView_text_116")}</option>
                                        <option value="SECURITY_KEY">{readData("components.Workspace.OnboardingView", "OnboardingView_text_117")}</option>
                                        <option value="ACCESS_KEYFOB">{readData("components.Workspace.OnboardingView", "OnboardingView_text_118")}</option>
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>{readData("components.Workspace.OnboardingView", "OnboardingView_text_119")}</label>
                                    <input
                                        type="text"
                                        value={assetBrand}
                                        onChange={(e) => setAssetBrand(e.target.value)}
                                        className={styles.formInput}
                                        required
                                    />
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label>{readData("components.Workspace.OnboardingView", "OnboardingView_text_120")}</label>
                                <input
                                    type="text"
                                    value={assetModel}
                                    onChange={(e) => setAssetModel(e.target.value)}
                                    placeholder={readData("components.Workspace.OnboardingView", "OnboardingView_placeholder_121")}
                                    className={styles.formInput}
                                    required
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>{readData("components.Workspace.OnboardingView", "OnboardingView_text_122")}</label>
                                <input
                                    type="text"
                                    value={assetSerial}
                                    onChange={(e) => setAssetSerial(e.target.value)}
                                    placeholder={readData("components.Workspace.OnboardingView", "OnboardingView_placeholder_123")}
                                    className={styles.formInput}
                                    required
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className={styles.formGroup}>
                                    <label>{readData("components.Workspace.OnboardingView", "OnboardingView_text_124")}</label>
                                    <select
                                        value={assetEmpId}
                                        onChange={(e) => setAssetEmpId(e.target.value)}
                                        className={styles.formInput}
                                    >
                                        {employees.map(e => (
                                            <option key={e.id} value={e.id}>{e.name}{readData("components.Workspace.OnboardingView", "OnboardingView_text_125")}{e.id}{readData("components.Workspace.OnboardingView", "OnboardingView_text_126")}{e.dept}{readData("components.Workspace.OnboardingView", "OnboardingView_text_127")}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>{readData("components.Workspace.OnboardingView", "OnboardingView_text_128")}</label>
                                    <input
                                        type="number"
                                        min="0" max="999999999.99" step="0.01"
                                        value={assetValue}
                                        onChange={(e) => setAssetValue(e.target.value)}
                                        className={styles.formInput}
                                        required
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                                <button
                                    type="button"
                                    className={styles.btnSecondary}
                                    onClick={() => setIsAssetModalOpen(false)}
                                >{readData("components.Workspace.OnboardingView", "OnboardingView_text_129")}</button>
                                <button
                                    type="submit"
                                    className={styles.btnPrimary}
                                >{readData("components.Workspace.OnboardingView", "OnboardingView_text_130")}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* GRANT RECOGNITION AWARD MODAL (POINT 18)                                  */}
            {/* ========================================================================= */}
            {isAwardModalOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsAwardModalOpen(false)}>
                    <div className={styles.modalContent} style={{ width: '560px' }} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text)' }}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_131")}</h3>
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>{readData("components.Workspace.OnboardingView", "OnboardingView_text_132")}</span>
                            </div>
                            <button
                                style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-2)' }}
                                onClick={() => setIsAwardModalOpen(false)}
                            >{readData("components.Workspace.OnboardingView", "OnboardingView_text_133")}</button>
                        </div>

                        <form onSubmit={handleAwardSubmit} className={styles.modalBody}>
                            <div className={styles.formGroup}>
                                <label>{readData("components.Workspace.OnboardingView", "OnboardingView_text_134")}</label>
                                <select
                                    value={awardEmpId}
                                    onChange={(e) => setAwardEmpId(e.target.value)}
                                    className={styles.formInput}
                                >
                                    {employees.map(e => (
                                        <option key={e.id} value={e.id}>{e.name}{readData("components.Workspace.OnboardingView", "OnboardingView_text_135")}{e.id}{readData("components.Workspace.OnboardingView", "OnboardingView_text_136")}{e.dept}{readData("components.Workspace.OnboardingView", "OnboardingView_text_137")}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem' }}>
                                <div className={styles.formGroup}>
                                    <label>{readData("components.Workspace.OnboardingView", "OnboardingView_text_138")}</label>
                                    <select
                                        value={awardType}
                                        onChange={(e) => setAwardType(e.target.value)}
                                        className={styles.formInput}
                                    >
                                        <option value="STAR_OF_MONTH">{readData("components.Workspace.OnboardingView", "OnboardingView_text_139")}</option>
                                        <option value="SPOT_AWARD">{readData("components.Workspace.OnboardingView", "OnboardingView_text_140")}</option>
                                        <option value="INNOVATION_HERO">{readData("components.Workspace.OnboardingView", "OnboardingView_text_141")}</option>
                                        <option value="CUSTOMER_CHAMPION">{readData("components.Workspace.OnboardingView", "OnboardingView_text_142")}</option>
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>{readData("components.Workspace.OnboardingView", "OnboardingView_text_143")}</label>
                                    <input
                                        type="number"
                                        min="0" max="999999999.99" step="0.01"
                                        value={awardPrize}
                                        onChange={(e) => setAwardPrize(e.target.value)}
                                        className={styles.formInput}
                                        required
                                    />
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label>{readData("components.Workspace.OnboardingView", "OnboardingView_text_144")}</label>
                                <textarea
                                    value={awardCitation}
                                    onChange={(e) => setAwardCitation(e.target.value)}
                                    rows="3"
                                    placeholder={readData("components.Workspace.OnboardingView", "OnboardingView_placeholder_145")}
                                    className={styles.formInput}
                                    style={{ resize: 'vertical' }}
                                    required
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                                <button
                                    type="button"
                                    className={styles.btnSecondary}
                                    onClick={() => setIsAwardModalOpen(false)}
                                >{readData("components.Workspace.OnboardingView", "OnboardingView_text_146")}</button>
                                <button
                                    type="submit"
                                    className={styles.btnPrimary}
                                >{readData("components.Workspace.OnboardingView", "OnboardingView_text_147")}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Workflow Designer Studio Modal */}
            <WorkflowBuilderModal isOpen={isWorkflowModalOpen} onClose={() => setIsWorkflowModalOpen(false)} />
        </div>
    );
};

export default OnboardingView;
