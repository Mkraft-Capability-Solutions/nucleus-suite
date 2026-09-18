"use client";
import {useTranslation} from '@/context/I18nContext';

import { readData } from '../../services/workspace-data.mjs';

import React, { useState, useRef, useEffect } from 'react';
import {
    X, UploadCloud, ArrowRight, ArrowLeft, CheckCircle2,
    AlertTriangle, RefreshCw, FileSpreadsheet, Check, Sparkles,
    Database, Table
} from 'lucide-react';
import styles from './DataImportModal.module.css';
import { useHRMS } from '@/context/HRMSContext';

const SYSTEM_FIELDS = readData("components.Workspace.DataImportModal", "SYSTEM_FIELDS_1");

const PRESET_DATASETS = readData("components.Workspace.DataImportModal", "PRESET_DATASETS_2");

function inferMappings(currentFile) {
        const autoMap = {};

        currentFile.columns.forEach(col => {
            const lower = col.toLowerCase().replace(/[^a-z0-9]/g, '');

            if (lower.includes('staffcode') || lower.includes('empid') || lower.includes('staffnumber') || lower.includes('id')) {
                autoMap[col] = 'empId';
            } else if (lower.includes('name')) {
                autoMap[col] = 'name';
            } else if (lower.includes('presentdays') || lower.includes('indays')) {
                autoMap[col] = 'presentDays';
            } else if (lower.includes('attendance') || lower.includes('ratio')) {
                autoMap[col] = 'attendancePct';
            } else if (lower.includes('overtime') || lower.includes('ot')) {
                autoMap[col] = 'overtimeHrs';
            } else if (lower.includes('bonus') || lower.includes('incentive')) {
                autoMap[col] = 'variableBonus';
            } else if (lower.includes('ctc') || lower.includes('salary')) {
                autoMap[col] = 'grossCtc';
            } else if (lower.includes('rating') || lower.includes('score')) {
                autoMap[col] = 'performanceRating';
            } else if (lower.includes('risk')) {
                autoMap[col] = 'attritionRisk';
            } else {
                autoMap[col] = '__ignore__';
            }
        });

    return autoMap;
}

const DataImportModal = ({ isOpen, onClose, initialPreset }) => {
    const {t: translateText}=useTranslation();

    const { ingestMappedData, showToast } = useHRMS();

    const [step, setStep] = useState(readData("components.Workspace.DataImportModal", "initialState_1")); // 1: Upload, 2: Mapping, 3: Validation, 4: Complete
    const [selectedPreset, setSelectedPreset] = useState(() => initialPreset || readData("components.Workspace.DataImportModal", "initialState_2"));
    const [currentFile, setCurrentFile] = useState(() => (initialPreset && PRESET_DATASETS[initialPreset]) ? PRESET_DATASETS[initialPreset] : PRESET_DATASETS.biometric);
    const [mappings, setMappings] = useState(() => inferMappings((initialPreset && PRESET_DATASETS[initialPreset]) ? PRESET_DATASETS[initialPreset] : PRESET_DATASETS.biometric));
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (isOpen && initialPreset && PRESET_DATASETS[initialPreset]) {
            setSelectedPreset(initialPreset);
            setCurrentFile(PRESET_DATASETS[initialPreset]);
            setMappings(inferMappings(PRESET_DATASETS[initialPreset]));
        }
    }, [isOpen, initialPreset]);

    if (!isOpen) return null;

    const handleSelectPreset = (presetKey) => {
        setSelectedPreset(presetKey);
        setCurrentFile(PRESET_DATASETS[presetKey]);
        setMappings(inferMappings(PRESET_DATASETS[presetKey]));
    };

    const handleMappingChange = (sourceCol, targetKey) => {
        setMappings(prev => ({ ...prev, [sourceCol]: targetKey }));
    };

    // Transform raw rows into system format based on mappings
    const getMappedRows = () => {
        if (!currentFile) return [];
        return currentFile.sampleRows.map(row => {
            const mapped = {};
            Object.entries(mappings).forEach(([sourceCol, targetKey]) => {
                if (targetKey && targetKey !== '__ignore__') {
                    mapped[targetKey] = row[sourceCol];
                }
            });
            return mapped;
        });
    };

    const handleIngestCommit = () => {
        const mappedRows = getMappedRows();
        const isCandidateImport = selectedPreset === 'candidates' || selectedPreset === 'ats';
        const hasValidRows = isCandidateImport
            ? mappedRows.some(r => r.name || r.candidateName || r.email || r.empId)
            : mappedRows.some(r => r.empId);

        if (!hasValidRows) {
            showToast(
                translateText("components.Workspace.DataImportModal","text_7742f74fef"),
                isCandidateImport ? 'Candidate rows must include candidate name, role, or email.' : translateText("components.Workspace.DataImportModal","text_30bad5d803"),
                'warning'
            );
            return;
        }

        try {
            fetch('/api/v1/bulk-import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    importType: selectedPreset,
                    records: mappedRows,
                    fileName: currentFile?.fileName || 'dataset.csv'
                })
            }).catch(e => console.warn('Bulk import server sync notice:', e));
        } catch {}

        ingestMappedData(selectedPreset, mappedRows, currentFile.fileName);
        setStep(4);
    };

    const resetAndClose = () => {
        setStep(1);
        onClose();
    };

    const downloadSampleTemplate = (typeKey) => {
        const templates = {
            employee: {
                filename: 'Employee_Master_Sample.csv',
                content: 'StaffCode,FirstName,LastName,Department,Role,DateOfJoining,GrossCTC,WorkEmail,Location,Phone,PAN,Aadhaar,UAN,BankName,AccountNumber,IFSC\nMK-101,Aarav,Sharma,Engineering,Senior Architect,2026-01-15,2400000,aarav.s@nucleus.com,Bengaluru Corporate Office,9876543210,ABCDE1234F,123456789012,100904567890,HDFC Bank,501002345678,HDFC0000123\nMK-102,Diya,Patel,Product & Design,Senior PM,2026-02-01,2100000,diya.p@nucleus.com,Mumbai Delivery Center,9876543211,BCDEF2345G,234567890123,100904567891,ICICI Bank,000401567890,ICIC0000456\nMK-103,Rohan,Verma,Operations,Lead Specialist,2026-03-01,1600000,rohan.v@nucleus.com,Gurugram Tech Park,9876543212,CDEFG3456H,345678901234,100904567892,State Bank of India,201987654321,SBIN0000789'
            },
            biometric: {
                filename: 'Attendance_Punches_Sample.csv',
                content: 'EmpId,StaffName,PunchDate,InTime,OutTime,TerminalID,Location,Status,VerificationMethod\nMK-101,Aarav Sharma,2026-09-14,09:02,18:15,TERM-01,Main Gate,Present,Fingerprint\nMK-102,Diya Patel,2026-09-14,08:55,18:05,TERM-02,Floor 3,Present,Facial Recognition\nMK-103,Rohan Verma,2026-09-14,09:30,18:30,TERM-01,Main Gate,Present,RFID Badge'
            },
            leave: {
                filename: 'Leave_Balances_Sample.csv',
                content: 'EmpId,StaffName,LeaveType,OpeningBalance,AccruedDays,UsedDays,PendingDays,AvailableBalance,Year\nMK-101,Aarav Sharma,CL,12,6,2,0,16,2026\nMK-101,Aarav Sharma,SL,10,5,1,0,14,2026\nMK-102,Diya Patel,EL,18,9,3,1,23,2026'
            },
            payroll: {
                filename: 'Salary_Structure_Sample.csv',
                content: 'EmpId,StaffName,BasicSalary,HRA,SpecialAllowance,PFEmployer,ProfessionalTax,IncomeTaxTDS,StatutoryBonus,GrossMonthly,NetPay\nMK-101,Aarav Sharma,100000,50000,40000,12000,200,8500,8000,200000,179300\nMK-102,Diya Patel,87500,43750,35000,10500,200,6800,7000,175000,157500'
            },
            candidates: {
                filename: 'Candidates_ATS_Sample.csv',
                content: 'JobReqCode,CandidateName,Email,Phone,CurrentCTC,ExpectedCTC,NoticePeriodDays,ExperienceYears,KeySkills,CurrentLocation\nREQ-TECH-01,Siddharth Mehta,sid.m@test.com,9876500001,1800000,2200000,30,6.5,React TypeScript Next.js,Bengaluru\nREQ-TECH-02,Ananya Roy,ananya.r@test.com,9876500002,1400000,1750000,15,4.0,Node.js PostgreSQL Cloud,Mumbai'
            }
        };

        const t = templates[typeKey] || templates.employee;
        const blob = new Blob(['\uFEFF' + t.content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', t.filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast('Sample Template Downloaded', `Generated ${t.filename}`, 'info');
    };

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const text = evt.target.result;
            if (typeof text !== 'string') return;

            // Simple CSV Parser
            const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
            if (lines.length < 2) {
                showToast('Invalid File', 'CSV file must have a header and at least 1 data row.', 'warning');
                return;
            }

            const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
            const rows = lines.slice(1).map(line => {
                const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                const obj = {};
                headers.forEach((h, idx) => {
                    obj[h] = vals[idx] || '';
                });
                return obj;
            });

            const customDataset = {
                id: 'custom_upload',
                title: file.name,
                fileName: file.name,
                desc: `User uploaded dataset (${rows.length} rows, ${headers.length} columns)`,
                columns: headers,
                sampleRows: rows
            };

            setCurrentFile(customDataset);
            setMappings(inferMappings(customDataset));
            showToast('File Parsed Successfully', `Loaded ${rows.length} records from ${file.name}`, 'info');
        };
        reader.readAsText(file);
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className={styles.header}>
                    <div className={styles.headerTitle}>
                        <div className={styles.headerIcon}>
                            <FileSpreadsheet size={22} />
                        </div>
                        <div>
                            <h3>{readData("components.Workspace.DataImportModal", "DataImportModal_text_3")}</h3>
                            <p>{readData("components.Workspace.DataImportModal", "DataImportModal_text_4")}</p>
                        </div>
                    </div>
                    <button className={styles.closeBtn} onClick={resetAndClose} title={readData("components.Workspace.DataImportModal", "DataImportModal_title_5")}>
                        <X size={20} />
                    </button>
                </div>

                {/* Stepper Progress */}
                <div className={styles.stepper}>
                    <div className={`${styles.stepItem} ${step >= 1 ? (step > 1 ? styles.completed : styles.active) : ''}`}>
                        <div className={styles.stepNumber}>{step > 1 ? readData("components.Workspace.DataImportModal", "display_3") : readData("components.Workspace.DataImportModal", "display_4")}</div>
                        <span>{readData("components.Workspace.DataImportModal", "DataImportModal_text_6")}</span>
                    </div>
                    <div className={styles.stepDivider} />
                    <div className={`${styles.stepItem} ${step >= 2 ? (step > 2 ? styles.completed : styles.active) : ''}`}>
                        <div className={styles.stepNumber}>{step > 2 ? readData("components.Workspace.DataImportModal", "display_5") : readData("components.Workspace.DataImportModal", "display_6")}</div>
                        <span>{readData("components.Workspace.DataImportModal", "DataImportModal_text_7")}</span>
                    </div>
                    <div className={styles.stepDivider} />
                    <div className={`${styles.stepItem} ${step >= 3 ? (step > 3 ? styles.completed : styles.active) : ''}`}>
                        <div className={styles.stepNumber}>{step > 3 ? readData("components.Workspace.DataImportModal", "display_7") : readData("components.Workspace.DataImportModal", "display_8")}</div>
                        <span>{readData("components.Workspace.DataImportModal", "DataImportModal_text_8")}</span>
                    </div>
                    <div className={styles.stepDivider} />
                    <div className={`${styles.stepItem} ${step === 4 ? styles.completed : ''}`}>
                        <div className={styles.stepNumber}>{step === 4 ? readData("components.Workspace.DataImportModal", "display_9") : readData("components.Workspace.DataImportModal", "display_10")}</div>
                        <span>{readData("components.Workspace.DataImportModal", "DataImportModal_text_9")}</span>
                    </div>
                </div>

                {/* Step Body */}
                <div className={styles.contentBody}>
                    {/* STEP 1: UPLOAD OR SELECT DATASET */}
                    {step === 1 && (
                        <>
                            {/* Download Sample Template Bar */}
                            <div style={{
                                background: 'var(--card-2, #f8fafc)',
                                border: '1px solid var(--line, #e2e8f0)',
                                borderRadius: '12px',
                                padding: '0.85rem 1rem',
                                marginBottom: '1.25rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '0.75rem'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--text, #0f172a)' }}>
                                        📥 Need a starting format? Download Excel/CSV Sample Template
                                    </div>
                                    <div style={{ fontSize: '0.74rem', color: 'var(--text-2, #64748b)' }}>
                                        Pre-formatted with validated column structures for instant ingestion.
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                    <button
                                        type="button"
                                        style={{ background: 'var(--signal)', color: 'var(--on-signal, #ffffff)', border: 'none', padding: '0.35rem 0.65rem', borderRadius: 'var(--r-control, 6px)', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' }}
                                        onClick={() => downloadSampleTemplate('employee')}
                                    >
                                        👥 Employee Master (.CSV)
                                    </button>
                                    <button
                                        type="button"
                                        style={{ background: 'var(--card-2)', color: 'var(--text)', border: '1px solid var(--line)', padding: '0.35rem 0.65rem', borderRadius: 'var(--r-control, 6px)', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' }}
                                        onClick={() => downloadSampleTemplate('biometric')}
                                    >
                                        ⏱️ Attendance Punches (.CSV)
                                    </button>
                                    <button
                                        type="button"
                                        style={{ background: 'var(--card-2)', color: 'var(--text)', border: '1px solid var(--line)', padding: '0.35rem 0.65rem', borderRadius: 'var(--r-control, 6px)', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' }}
                                        onClick={() => downloadSampleTemplate('leave')}
                                    >
                                        🏖️ Leave Balances (.CSV)
                                    </button>
                                    <button
                                        type="button"
                                        style={{ background: 'var(--card-2)', color: 'var(--text)', border: '1px solid var(--line)', padding: '0.35rem 0.65rem', borderRadius: 'var(--r-control, 6px)', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' }}
                                        onClick={() => downloadSampleTemplate('payroll')}
                                    >
                                        💰 Salary Structure (.CSV)
                                    </button>
                                </div>
                            </div>

                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                accept=".csv,.xlsx,.xls,.tsv,.txt"
                                style={{ display: 'none' }}
                            />

                            <div
                                className={styles.uploadArea}
                                onClick={() => fileInputRef.current?.click()}
                                style={{ cursor: 'pointer' }}
                            >
                                <UploadCloud size={40} color="#2563eb" />
                                <div>
                                    <h4>{readData("components.Workspace.DataImportModal", "DataImportModal_text_10")}</h4>
                                    <p>Click to browse CSV / Excel file or drag & drop. Currently loaded: <strong style={{ color: '#2563eb' }}>{currentFile.fileName}</strong> ({currentFile.sampleRows.length} rows, {currentFile.columns.length} cols)</p>
                                </div>
                            </div>

                            <div className={styles.presetSection}>
                                <div className={styles.presetTitle}>{readData("components.Workspace.DataImportModal", "DataImportModal_text_15")}</div>
                                <div className={styles.presetGrid}>
                                    {Object.values(PRESET_DATASETS).map(p => (
                                        <div
                                            key={p.id}
                                            className={`${styles.presetCard} ${selectedPreset === p.id ? styles.selected : ''}`}
                                            onClick={() => handleSelectPreset(p.id)}
                                        >
                                            <h5>{p.title}</h5>
                                            <p>{p.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {/* STEP 2: FIELD MAPPING MATRIX */}
                    {step === 2 && (
                        <div>
                            <div style={{ marginBottom: '1rem', background: 'var(--info-wash)', padding: '0.85rem 1rem', borderRadius: '10px', fontSize: '0.84rem', color: 'var(--info)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <Sparkles size={18} />
                                <div>
                                    <strong>{readData("components.Workspace.DataImportModal", "DataImportModal_text_16")}</strong>{readData("components.Workspace.DataImportModal", "DataImportModal_text_17")}</div>
                            </div>

                            <table className={styles.mappingTable}>
                                <thead>
                                    <tr>
                                        <th style={{ width: '38%' }}>{readData("components.Workspace.DataImportModal", "DataImportModal_text_18")}</th>
                                        <th style={{ width: '42%' }}>{readData("components.Workspace.DataImportModal", "DataImportModal_text_19")}</th>
                                        <th style={{ width: '20%' }}>{readData("components.Workspace.DataImportModal", "DataImportModal_text_20")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentFile.columns.map(col => {
                                        const mappedKey = mappings[col];
                                        const isIgnored = mappedKey === '__ignore__';
                                        const sampleVal = currentFile.sampleRows[0][col];

                                        return (
                                            <tr key={col}>
                                                <td>
                                                    <div className={styles.sourceColName}>{col}</div>
                                                    <div className={styles.sourcePreview}>{readData("components.Workspace.DataImportModal", "DataImportModal_text_21")}{String(sampleVal)}{readData("components.Workspace.DataImportModal", "DataImportModal_text_22")}</div>
                                                </td>
                                                <td>
                                                    <select
                                                        className={styles.targetSelect}
                                                        value={mappedKey || readData("components.Workspace.DataImportModal", "fallback_1")}
                                                        onChange={(e) => handleMappingChange(col, e.target.value)}
                                                    >
                                                        {SYSTEM_FIELDS.map(f => (
                                                            <option key={f.key} value={f.key}>
                                                                {f.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td>
                                                    {isIgnored ? (
                                                        <span className={`${styles.matchBadge} ${styles.ignored}`}>{readData("components.Workspace.DataImportModal", "DataImportModal_text_23")}</span>
                                                    ) : (
                                                        <span className={styles.matchBadge}>
                                                            <Check size={12} />{readData("components.Workspace.DataImportModal", "DataImportModal_text_24")}</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* STEP 3: VALIDATION PREVIEW */}
                    {step === 3 && (
                        <div>
                            <div className={styles.validationSummary}>
                                <div className={styles.valCard}>
                                    <CheckCircle2 size={24} color="#16a34a" />
                                    <div>
                                        <strong>{currentFile.sampleRows.length}{readData("components.Workspace.DataImportModal", "DataImportModal_text_25")}</strong>
                                        <span>{readData("components.Workspace.DataImportModal", "DataImportModal_text_26")}</span>
                                    </div>
                                </div>
                                <div className={styles.valCard}>
                                    <Sparkles size={24} color="#2563eb" />
                                    <div>
                                        <strong>{readData("components.Workspace.DataImportModal", "DataImportModal_text_27")}</strong>
                                        <span>{readData("components.Workspace.DataImportModal", "DataImportModal_text_28")}</span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ margin: '1rem 0 0.5rem 0', fontSize: '0.84rem', fontWeight: 600, color: '#334155' }}>{readData("components.Workspace.DataImportModal", "DataImportModal_text_29")}</div>

                            <div className={styles.previewTableWrap}>
                                <table className={styles.previewTable}>
                                    <thead>
                                        <tr>
                                            <th>{readData("components.Workspace.DataImportModal", "DataImportModal_text_30")}</th>
                                            {Object.entries(mappings)
                                                .filter(([_, key]) => key && key !== '__ignore__')
                                                .map(([col, key]) => {
                                                    const field = SYSTEM_FIELDS.find(f => f.key === key);
                                                    return <th key={col}>{field?.label || key}</th>;
                                                })}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {getMappedRows().slice(0, 5).map((row, idx) => (
                                            <tr key={idx}>
                                                <td>
                                                    <span style={{ color: '#16a34a', fontWeight: 700, fontSize: '0.75rem', background: 'var(--status-ok-wash)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>{readData("components.Workspace.DataImportModal", "DataImportModal_text_31")}</span>
                                                </td>
                                                {Object.entries(mappings)
                                                    .filter(([_, key]) => key && key !== '__ignore__')
                                                    .map(([col, key]) => (
                                                        <td key={col}>{String(row[key] ?? readData("components.Workspace.DataImportModal", "fallback_2"))}</td>
                                                    ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* STEP 4: COMPLETED */}
                    {step === 4 && (
                        <div style={{ textAlign: 'center', padding: '2rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--status-ok-wash)', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Check size={36} />
                            </div>
                            <div>
                                <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1.25rem', color: '#0f172a' }}>{readData("components.Workspace.DataImportModal", "DataImportModal_text_32")}</h3>
                                <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-3)', maxWidth: '500px' }}>
                                    <strong>{currentFile.sampleRows.length}{readData("components.Workspace.DataImportModal", "DataImportModal_text_33")}</strong>{readData("components.Workspace.DataImportModal", "DataImportModal_text_34")}<code>{currentFile.fileName}</code>{readData("components.Workspace.DataImportModal", "DataImportModal_text_35")}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className={styles.footer}>
                    {step === 1 && (
                        <>
                            <button className={styles.btnSecondary} onClick={resetAndClose}>{readData("components.Workspace.DataImportModal", "DataImportModal_text_36")}</button>
                            <button className={styles.btnPrimary} onClick={() => setStep(2)}>{readData("components.Workspace.DataImportModal", "DataImportModal_text_37")}<ArrowRight size={16} />
                            </button>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <button className={styles.btnSecondary} onClick={() => setStep(1)}>
                                <ArrowLeft size={16} />{readData("components.Workspace.DataImportModal", "DataImportModal_text_38")}</button>
                            <button className={styles.btnPrimary} onClick={() => setStep(3)}>{readData("components.Workspace.DataImportModal", "DataImportModal_text_39")}<ArrowRight size={16} />
                            </button>
                        </>
                    )}

                    {step === 3 && (
                        <>
                            <button className={styles.btnSecondary} onClick={() => setStep(2)}>
                                <ArrowLeft size={16} />{readData("components.Workspace.DataImportModal", "DataImportModal_text_40")}</button>
                            <button className={styles.btnPrimary} onClick={handleIngestCommit}>
                                <Database size={16} />{readData("components.Workspace.DataImportModal", "DataImportModal_text_41")}</button>
                        </>
                    )}

                    {step === 4 && (
                        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                            <button className={styles.btnPrimary} onClick={resetAndClose}>
                                <Table size={16} />{readData("components.Workspace.DataImportModal", "DataImportModal_text_42")}</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DataImportModal;
