"use client";
import {useTranslation} from '@/context/I18nContext';

import { readData } from '../../services/workspace-data.mjs';

import React, { useState } from 'react';
import {
    X, UploadCloud, ArrowRight, ArrowLeft, CheckCircle2,
    AlertTriangle, RefreshCw, FileSpreadsheet, Check, Sparkles,
    Database, Table
} from 'lucide-react';
import styles from './DataImportModal.module.css';
import { useHRMS } from '@/context/HRMSContext';

const SYSTEM_FIELDS = readData("components.Clerio.DataImportModal", "SYSTEM_FIELDS_1");

const PRESET_DATASETS = readData("components.Clerio.DataImportModal", "PRESET_DATASETS_2");

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

const DataImportModal = ({ isOpen, onClose }) => {
    const {t: translateText}=useTranslation();

    const { ingestMappedData, showToast } = useHRMS();

    const [step, setStep] = useState(readData("components.Clerio.DataImportModal", "initialState_1")); // 1: Upload, 2: Mapping, 3: Validation, 4: Complete
    const [selectedPreset, setSelectedPreset] = useState(readData("components.Clerio.DataImportModal", "initialState_2"));
    const [currentFile, setCurrentFile] = useState(PRESET_DATASETS.biometric);
    const [mappings, setMappings] = useState(() => inferMappings(PRESET_DATASETS.biometric));

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
        if (!mappedRows.some(r => r.empId)) {
            showToast(translateText("components.Clerio.DataImportModal","text_7742f74fef"),translateText("components.Clerio.DataImportModal","text_30bad5d803"), 'warning');
            return;
        }

        ingestMappedData(selectedPreset, mappedRows, currentFile.fileName);
        setStep(4);
    };

    const resetAndClose = () => {
        setStep(1);
        onClose();
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
                            <h3>{readData("components.Clerio.DataImportModal", "DataImportModal_text_3")}</h3>
                            <p>{readData("components.Clerio.DataImportModal", "DataImportModal_text_4")}</p>
                        </div>
                    </div>
                    <button className={styles.closeBtn} onClick={resetAndClose} title={readData("components.Clerio.DataImportModal", "DataImportModal_title_5")}>
                        <X size={20} />
                    </button>
                </div>

                {/* Stepper Progress */}
                <div className={styles.stepper}>
                    <div className={`${styles.stepItem} ${step >= 1 ? (step > 1 ? styles.completed : styles.active) : ''}`}>
                        <div className={styles.stepNumber}>{step > 1 ? readData("components.Clerio.DataImportModal", "display_3") : readData("components.Clerio.DataImportModal", "display_4")}</div>
                        <span>{readData("components.Clerio.DataImportModal", "DataImportModal_text_6")}</span>
                    </div>
                    <div className={styles.stepDivider} />
                    <div className={`${styles.stepItem} ${step >= 2 ? (step > 2 ? styles.completed : styles.active) : ''}`}>
                        <div className={styles.stepNumber}>{step > 2 ? readData("components.Clerio.DataImportModal", "display_5") : readData("components.Clerio.DataImportModal", "display_6")}</div>
                        <span>{readData("components.Clerio.DataImportModal", "DataImportModal_text_7")}</span>
                    </div>
                    <div className={styles.stepDivider} />
                    <div className={`${styles.stepItem} ${step >= 3 ? (step > 3 ? styles.completed : styles.active) : ''}`}>
                        <div className={styles.stepNumber}>{step > 3 ? readData("components.Clerio.DataImportModal", "display_7") : readData("components.Clerio.DataImportModal", "display_8")}</div>
                        <span>{readData("components.Clerio.DataImportModal", "DataImportModal_text_8")}</span>
                    </div>
                    <div className={styles.stepDivider} />
                    <div className={`${styles.stepItem} ${step === 4 ? styles.completed : ''}`}>
                        <div className={styles.stepNumber}>{step === 4 ? readData("components.Clerio.DataImportModal", "display_9") : readData("components.Clerio.DataImportModal", "display_10")}</div>
                        <span>{readData("components.Clerio.DataImportModal", "DataImportModal_text_9")}</span>
                    </div>
                </div>

                {/* Step Body */}
                <div className={styles.contentBody}>
                    {/* STEP 1: UPLOAD OR SELECT DATASET */}
                    {step === 1 && (
                        <>
                            <div
                                className={styles.uploadArea}
                                onClick={() => showToast(translateText("components.Clerio.DataImportModal","text_f3fac34f42"),translateText("components.Clerio.DataImportModal","text_8160746ae1", {value1: String(currentFile.fileName), value2: String(currentFile.sampleRows.length)}), 'info')}
                            >
                                <UploadCloud size={40} color="#2563eb" />
                                <div>
                                    <h4>{readData("components.Clerio.DataImportModal", "DataImportModal_text_10")}</h4>
                                    <p>{readData("components.Clerio.DataImportModal", "DataImportModal_text_11")}<strong style={{ color: '#2563eb' }}>{currentFile.fileName}</strong>{readData("components.Clerio.DataImportModal", "DataImportModal_text_12")}{currentFile.sampleRows.length}{readData("components.Clerio.DataImportModal", "DataImportModal_text_13")}{currentFile.columns.length}{readData("components.Clerio.DataImportModal", "DataImportModal_text_14")}</p>
                                </div>
                            </div>

                            <div className={styles.presetSection}>
                                <div className={styles.presetTitle}>{readData("components.Clerio.DataImportModal", "DataImportModal_text_15")}</div>
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
                                    <strong>{readData("components.Clerio.DataImportModal", "DataImportModal_text_16")}</strong>{readData("components.Clerio.DataImportModal", "DataImportModal_text_17")}</div>
                            </div>

                            <table className={styles.mappingTable}>
                                <thead>
                                    <tr>
                                        <th style={{ width: '38%' }}>{readData("components.Clerio.DataImportModal", "DataImportModal_text_18")}</th>
                                        <th style={{ width: '42%' }}>{readData("components.Clerio.DataImportModal", "DataImportModal_text_19")}</th>
                                        <th style={{ width: '20%' }}>{readData("components.Clerio.DataImportModal", "DataImportModal_text_20")}</th>
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
                                                    <div className={styles.sourcePreview}>{readData("components.Clerio.DataImportModal", "DataImportModal_text_21")}{String(sampleVal)}{readData("components.Clerio.DataImportModal", "DataImportModal_text_22")}</div>
                                                </td>
                                                <td>
                                                    <select
                                                        className={styles.targetSelect}
                                                        value={mappedKey || readData("components.Clerio.DataImportModal", "fallback_1")}
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
                                                        <span className={`${styles.matchBadge} ${styles.ignored}`}>{readData("components.Clerio.DataImportModal", "DataImportModal_text_23")}</span>
                                                    ) : (
                                                        <span className={styles.matchBadge}>
                                                            <Check size={12} />{readData("components.Clerio.DataImportModal", "DataImportModal_text_24")}</span>
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
                                        <strong>{currentFile.sampleRows.length}{readData("components.Clerio.DataImportModal", "DataImportModal_text_25")}</strong>
                                        <span>{readData("components.Clerio.DataImportModal", "DataImportModal_text_26")}</span>
                                    </div>
                                </div>
                                <div className={styles.valCard}>
                                    <Sparkles size={24} color="#2563eb" />
                                    <div>
                                        <strong>{readData("components.Clerio.DataImportModal", "DataImportModal_text_27")}</strong>
                                        <span>{readData("components.Clerio.DataImportModal", "DataImportModal_text_28")}</span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ margin: '1rem 0 0.5rem 0', fontSize: '0.84rem', fontWeight: 600, color: '#334155' }}>{readData("components.Clerio.DataImportModal", "DataImportModal_text_29")}</div>

                            <div className={styles.previewTableWrap}>
                                <table className={styles.previewTable}>
                                    <thead>
                                        <tr>
                                            <th>{readData("components.Clerio.DataImportModal", "DataImportModal_text_30")}</th>
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
                                                    <span style={{ color: '#16a34a', fontWeight: 700, fontSize: '0.75rem', background: 'var(--status-ok-wash)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>{readData("components.Clerio.DataImportModal", "DataImportModal_text_31")}</span>
                                                </td>
                                                {Object.entries(mappings)
                                                    .filter(([_, key]) => key && key !== '__ignore__')
                                                    .map(([col, key]) => (
                                                        <td key={col}>{String(row[key] ?? readData("components.Clerio.DataImportModal", "fallback_2"))}</td>
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
                                <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1.25rem', color: '#0f172a' }}>{readData("components.Clerio.DataImportModal", "DataImportModal_text_32")}</h3>
                                <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-3)', maxWidth: '500px' }}>
                                    <strong>{currentFile.sampleRows.length}{readData("components.Clerio.DataImportModal", "DataImportModal_text_33")}</strong>{readData("components.Clerio.DataImportModal", "DataImportModal_text_34")}<code>{currentFile.fileName}</code>{readData("components.Clerio.DataImportModal", "DataImportModal_text_35")}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className={styles.footer}>
                    {step === 1 && (
                        <>
                            <button className={styles.btnSecondary} onClick={resetAndClose}>{readData("components.Clerio.DataImportModal", "DataImportModal_text_36")}</button>
                            <button className={styles.btnPrimary} onClick={() => setStep(2)}>{readData("components.Clerio.DataImportModal", "DataImportModal_text_37")}<ArrowRight size={16} />
                            </button>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <button className={styles.btnSecondary} onClick={() => setStep(1)}>
                                <ArrowLeft size={16} />{readData("components.Clerio.DataImportModal", "DataImportModal_text_38")}</button>
                            <button className={styles.btnPrimary} onClick={() => setStep(3)}>{readData("components.Clerio.DataImportModal", "DataImportModal_text_39")}<ArrowRight size={16} />
                            </button>
                        </>
                    )}

                    {step === 3 && (
                        <>
                            <button className={styles.btnSecondary} onClick={() => setStep(2)}>
                                <ArrowLeft size={16} />{readData("components.Clerio.DataImportModal", "DataImportModal_text_40")}</button>
                            <button className={styles.btnPrimary} onClick={handleIngestCommit}>
                                <Database size={16} />{readData("components.Clerio.DataImportModal", "DataImportModal_text_41")}</button>
                        </>
                    )}

                    {step === 4 && (
                        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                            <button className={styles.btnPrimary} onClick={resetAndClose}>
                                <Table size={16} />{readData("components.Clerio.DataImportModal", "DataImportModal_text_42")}</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DataImportModal;
