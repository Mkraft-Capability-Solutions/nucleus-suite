"use client";
import {useTranslation} from '@/context/I18nContext';

import { readData } from '../../services/workspace-data.mjs';


import { redactMisExport } from '@/lib/mis-reporting.mjs';
import React, { useMemo, useRef, useState } from 'react';
import {
    AlertTriangle, CheckCircle2, ChevronRight, Clock3, Database, Download,
    Eye, FileSpreadsheet, Filter, Search, ShieldCheck, UploadCloud,
    UserRound, X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
    MIS_COLUMN_LABELS,
    parseDelimitedCsv,
    prepareMisImport,
    summarizeMisRecords,
    toReportCsv,
} from '@/lib/mis-reporting.mjs';
import styles from './MisReportingHub.module.css';

const REPORT_COLUMNS = Object.keys(MIS_COLUMN_LABELS);
const DEFAULT_CONTEXT = readData("components.Clerio.MisReportingHub", "DEFAULT_CONTEXT_1");

const RISK_STATES = readData("components.Clerio.MisReportingHub", "RISK_STATES_2");

function sourceRows(records) {
    return records.map((record) => ({
        'Emp ID': record.empId,
        'Employee Name': record.name,
        Department: record.dept,
        Designation: record.role,
        'Attendance %': record.attendancePct,
        'Overtime (Hrs)': record.overtimeHrs,
        'Gross CTC': record.grossCtc,
        'Performance Rating': record.performanceRating,
        'Flight Risk': record.attritionRisk || record.flightRisk,
    }));
}

function riskTone(band) {
    return band === 'High' ? styles.highRisk : band === 'Medium' ? styles.mediumRisk : styles.lowRisk;
}

function displayCtc(record, canViewCompensation) {
    if (!canViewCompensation) return 'Restricted';
    return record.grossCtc || `${record.grossCtcCurrency || ''} ${record.grossCtcAmount?.toLocaleString() || ''}`.trim();
}

function auditEntry(type, detail) {
    return { id: `${type}-${Date.now()}`, at: new Date().toLocaleString(), type, detail };
}

export default function MisReportingHub({ misMasterData = [], setMisMasterData, showToast, onNavigate }) {
    const {t: translateText}=useTranslation();

    const { user } = useAuth();
    const fileInput = useRef(null);
    const [activeSection, setActiveSection] = useState(readData("components.Clerio.MisReportingHub", "initialState_1"));
    const [draftContext, setDraftContext] = useState(DEFAULT_CONTEXT);
    const [pendingImport, setPendingImport] = useState(null);
    const [importName, setImportName] = useState('');
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [deptFilter, setDeptFilter] = useState(readData("components.Clerio.MisReportingHub", "initialState_2"));
    const [riskFilter, setRiskFilter] = useState(readData("components.Clerio.MisReportingHub", "initialState_3"));
    const [searchQuery, setSearchQuery] = useState('');
    const [auditEvents, setAuditEvents] = useState(() => [auditEntry('report.opened', 'MTD executive report opened in the permitted scope.')]);
    const [riskCases, setRiskCases] = useState({});
    const [sourceRuns, setSourceRuns] = useState(() => [{
        ...readData("components.Clerio.MisReportingHub", "sourceRuns_fields_3"), rows: misMasterData.length,
        accepted: misMasterData.length, ...readData("components.Clerio.MisReportingHub", "sourceRuns_fields_4"), context: DEFAULT_CONTEXT, ...readData("components.Clerio.MisReportingHub", "sourceRuns_fields_5"),
    }]);

    const managedRecords = useMemo(() => prepareMisImport({ rows: sourceRows(misMasterData) }, DEFAULT_CONTEXT).accepted, [misMasterData]);
    const departments = useMemo(() => [...new Set(managedRecords.map((record) => record.dept))].sort(), [managedRecords]);
    const filteredRecords = useMemo(() => managedRecords.filter((record) => {
        const query = searchQuery.trim().toLowerCase();
        return (deptFilter === 'all' || record.dept === deptFilter)
            && (riskFilter === 'all' || record.flightRiskBand === riskFilter)
            && (!query || [record.empId, record.name, record.role, record.dept].some((value) => String(value).toLowerCase().includes(query)));
    }), [managedRecords, deptFilter, riskFilter, searchQuery]);
    const summary = useMemo(() => summarizeMisRecords(filteredRecords), [filteredRecords]);
    const role = user?.role || readData("components.Clerio.MisReportingHub", "fallback_1");
    const canViewCompensation = readData("components.Clerio.MisReportingHub", "canViewCompensation_6").includes(role);
    const canViewRisk = readData("components.Clerio.MisReportingHub", "canViewRisk_7").includes(role);

    const appendAudit = (type, detail) => setAuditEvents((items) => [auditEntry(type, detail), ...items]);

    const readFile = async (file) => {
        if (!file) return;
        try {
            if (file.size > 5 * 1024 * 1024) throw new Error(readData("components.Clerio.MisReportingHub", "importSizeError"));
            if (!/\.(csv|xlsx|xls)$/i.test(file.name)) throw new Error(readData("components.Clerio.MisReportingHub", "importTypeError"));
            let parsed;
            if (/\.xlsx?$/i.test(file.name)) {
                const XLSX = await import('xlsx');
                const workbook = XLSX.read(await file.arrayBuffer(), readData("components.Clerio.MisReportingHub", "workbook_8"));
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                parsed = { rows: XLSX.utils.sheet_to_json(firstSheet, readData("components.Clerio.MisReportingHub", "rows_9")) };
            } else {
                parsed = parseDelimitedCsv(await file.text());
            }
            if (parsed.rows.length > 10000) throw new Error(readData("components.Clerio.MisReportingHub", "importRowsError"));
            const prepared = prepareMisImport(parsed, draftContext);
            setPendingImport(prepared);
            setImportName(file.name);
            setActiveSection('quality');
            appendAudit('dataset.previewed', `${file.name} checked: ${prepared.accepted.length} accepted, ${prepared.rejected.length} rejected.`);
            showToast?.(translateText("components.Clerio.MisReportingHub","text_18fd32e12f"),translateText("components.Clerio.MisReportingHub","text_1bbe48e4fd", {value1: String(prepared.accepted.length), value2: String(prepared.rejected.length)}), prepared.rejected.length ? 'warning' : 'success');
        } catch (error) {
            showToast?.(translateText("components.Clerio.MisReportingHub","text_25c5b213ae"), error?.message || readData("components.Clerio.MisReportingHub", "fallback_2"), 'error');
        }
    };

    const publishImport = () => {
        if (!pendingImport?.accepted.length) {
            showToast?.(translateText("components.Clerio.MisReportingHub","text_0d3b5e069b"),translateText("components.Clerio.MisReportingHub","text_51619e8da0"), 'warning');
            return;
        }
        const nextRecords = pendingImport.accepted.map((record) => ({
            empId: record.empId, name: record.name, dept: record.dept, role: record.role,
            attendancePct: record.attendancePct, overtimeHrs: record.overtimeHrs, grossCtc: record.grossCtc,
            performanceRating: record.performanceRating, attritionRisk: record.flightRisk,
        }));
        setMisMasterData?.((current) => {
            const byId = new Map(current.map((record) => [record.empId, record]));
            nextRecords.forEach((record) => byId.set(record.empId, { ...byId.get(record.empId), ...record }));
            return [...byId.values()];
        });
        const run = {
            id: `run-${Date.now()}`, fileName: importName, ...readData("components.Clerio.MisReportingHub", "run_fields_10"), rows: pendingImport.total,
            accepted: pendingImport.accepted.length, rejected: pendingImport.rejected.length,
            context: pendingImport.context, completedAt: new Date().toLocaleString(),
        };
        setSourceRuns((runs) => [run, ...runs]);
        appendAudit('dataset.published', `${run.fileName} published with ${run.accepted} records for ${run.context.periodStart} to ${run.context.periodEnd}.`);
        setPendingImport(null);
        setActiveSection('report');
        showToast?.(translateText("components.Clerio.MisReportingHub","text_94251d5730"),translateText("components.Clerio.MisReportingHub","text_64677b989b", {value1: String(run.accepted)}), 'success');
    };

    const exportReport = async (format) => {
        try {
        const records = redactMisExport(filteredRecords, { canViewCompensation, canViewRisk }, readData("components.Clerio.MisReportingHub", "display_7"));
        const filename = `Nucleus_MIS_Report_${draftContext.periodStart}_${draftContext.periodEnd}`;
        if (format === 'xlsx') {
            const XLSX = await import('xlsx');
            const workbook = XLSX.utils.book_new();
            const reportRows = records.map((record) => Object.fromEntries(REPORT_COLUMNS.map((column) => [MIS_COLUMN_LABELS[column], column === 'grossCtc' ? displayCtc(record, canViewCompensation) : record[column]])));
            XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(reportRows), 'MTD report');
            XLSX.writeFileXLSX(workbook, `${filename}.xlsx`);
        } else {
            const content = toReportCsv(records.map((record) => ({ ...record, grossCtc: displayCtc(record, canViewCompensation) })), REPORT_COLUMNS);
            const link = document.createElement('a');
            link.href = URL.createObjectURL(new Blob([content], readData("components.Clerio.MisReportingHub", "exportReport_11")));
            link.download = `${filename}.csv`;
            link.click();
            URL.revokeObjectURL(link.href);
        }
        appendAudit('report.exported', `${format.toUpperCase()} export generated for ${filteredRecords.length} permitted records.`);
        showToast?.(translateText("components.Clerio.MisReportingHub","text_b65cb957e6"),translateText("components.Clerio.MisReportingHub","text_6a25232639", {value1: String(format.toUpperCase()), value2: String(filteredRecords.length)}), 'success');
        } catch { showToast?.(readData("components.Clerio.MisReportingHub", "exportError"), readData("components.Clerio.MisReportingHub", "exportRetry"), 'error'); }
    };

    const updateRiskCase = (record, state) => {
        setRiskCases((cases) => ({ ...cases, [record.empId]: { state, owner: cases[record.empId]?.owner || readData("components.Clerio.MisReportingHub", "fallback_3"), note: cases[record.empId]?.note || '' } }));
        appendAudit('risk.reviewed', `${record.empId} risk case moved to ${state}.`);
    };

    return (
        <section className={styles.page} aria-labelledby="mis-title">
            <header className={styles.header}>
                <div>
                    <span className={styles.eyebrow}>{readData("components.Clerio.MisReportingHub", "content_text_12")}</span>
                    <h1 id="mis-title">{readData("components.Clerio.MisReportingHub", "content_text_13")}</h1>
                    <p>{draftContext.periodStart}{readData("components.Clerio.MisReportingHub", "content_text_14")}{draftContext.periodEnd}{readData("components.Clerio.MisReportingHub", "content_text_15")}{draftContext.legalEntity}{readData("components.Clerio.MisReportingHub", "content_text_16")}{draftContext.location}</p>
                </div>
                <div className={styles.headerActions}>
                    <button className={styles.secondaryButton} type="button" onClick={() => fileInput.current?.click()}><UploadCloud size={15} />{readData("components.Clerio.MisReportingHub", "content_text_17")}</button>
                    <button className={styles.primaryButton} type="button" onClick={() => exportReport('xlsx')}><FileSpreadsheet size={15} />{readData("components.Clerio.MisReportingHub", "content_text_18")}</button>
                    <input ref={fileInput} className={styles.hiddenInput} type="file" accept=".csv,.xlsx,.xls" onChange={(event) => readFile(event.target.files?.[0])} />
                </div>
            </header>

            <nav className={styles.tabs} aria-label={readData("components.Clerio.MisReportingHub", "content_aria-label_19")}>
                {readData("components.Clerio.MisReportingHub", "content_20").map(([id, label]) => (
                    <button key={id} type="button" onClick={() => setActiveSection(id)} className={activeSection === id ? styles.activeTab : ''}>{label}</button>
                ))}
            </nav>

            {activeSection === 'report' && <>
                <section className={styles.scopeBar}><ShieldCheck size={16} /><div><strong>{readData("components.Clerio.MisReportingHub", "content_text_21")}</strong><span>{draftContext.legalEntity}{readData("components.Clerio.MisReportingHub", "content_text_22")}{draftContext.location}{readData("components.Clerio.MisReportingHub", "content_text_23")}{role.replace('_', ' ')}</span></div><div><strong>{readData("components.Clerio.MisReportingHub", "content_text_24")}</strong><span>{sourceRuns[0]?.completedAt || readData("components.Clerio.MisReportingHub", "fallback_4")}{readData("components.Clerio.MisReportingHub", "content_text_25")}{sourceRuns[0]?.status || readData("components.Clerio.MisReportingHub", "fallback_5")}</span></div><button type="button" onClick={() => setActiveSection('sources')}>{readData("components.Clerio.MisReportingHub", "content_text_26")}<ChevronRight size={15} /></button></section>
                <div className={styles.kpis}>
                    <article><span>{readData("components.Clerio.MisReportingHub", "content_text_27")}</span><strong>{summary.total}</strong><small>{readData("components.Clerio.MisReportingHub", "content_text_28")}</small></article>
                    <article><span>{readData("components.Clerio.MisReportingHub", "content_text_29")}</span><strong>{summary.averageAttendance}{readData("components.Clerio.MisReportingHub", "content_text_30")}</strong><small>{readData("components.Clerio.MisReportingHub", "content_text_31")}</small></article>
                    <article><span>{readData("components.Clerio.MisReportingHub", "content_text_32")}</span><strong>{summary.totalOvertime}{readData("components.Clerio.MisReportingHub", "content_text_33")}</strong><small>{readData("components.Clerio.MisReportingHub", "content_text_34")}</small></article>
                    <article><span>{readData("components.Clerio.MisReportingHub", "content_text_35")}</span><strong>{canViewRisk ? summary.highRiskCount : readData("components.Clerio.MisReportingHub", "display_4")}</strong><small>{canViewRisk ? readData("components.Clerio.MisReportingHub", "display_5") : readData("components.Clerio.MisReportingHub", "display_6")}</small></article>
                </div>
                <section className={styles.filters}>
                    <label><Filter size={15} />{readData("components.Clerio.MisReportingHub", "content_text_36")}<select value={deptFilter} onChange={(event) => setDeptFilter(event.target.value)}><option value="all">{readData("components.Clerio.MisReportingHub", "content_text_37")}</option>{departments.map((department) => <option key={department}>{department}</option>)}</select></label>
                    <label>{readData("components.Clerio.MisReportingHub", "content_text_38")}<select disabled={!canViewRisk} value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}><option value="all">{readData("components.Clerio.MisReportingHub", "content_text_39")}</option><option>{readData("components.Clerio.MisReportingHub", "content_text_40")}</option><option>{readData("components.Clerio.MisReportingHub", "content_text_41")}</option><option>{readData("components.Clerio.MisReportingHub", "content_text_42")}</option></select></label>
                    <label className={styles.search}><Search size={15} /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={readData("components.Clerio.MisReportingHub", "content_placeholder_43")} /></label>
                    <button className={styles.secondaryButton} type="button" onClick={() => exportReport('csv')}><Download size={15} />{readData("components.Clerio.MisReportingHub", "content_text_44")}</button>
                </section>
                <section className={styles.tableCard}><div className={styles.cardTitle}><div><h2>{readData("components.Clerio.MisReportingHub", "content_text_45")}</h2><p>{readData("components.Clerio.MisReportingHub", "content_text_46")}</p></div><span>{filteredRecords.length}{readData("components.Clerio.MisReportingHub", "content_text_47")}</span></div><div className={styles.tableWrap}><table><thead><tr>{REPORT_COLUMNS.map((column) => <th key={column}>{MIS_COLUMN_LABELS[column]}</th>)}<th /></tr></thead><tbody>{filteredRecords.map((record) => <tr key={record.empId}><td>{record.empId}</td><td><strong>{record.name}</strong></td><td>{record.dept}</td><td>{record.role}</td><td>{record.attendancePct}{readData("components.Clerio.MisReportingHub", "content_text_48")}</td><td>{record.overtimeHrs}{readData("components.Clerio.MisReportingHub", "content_text_49")}</td><td>{displayCtc(record, canViewCompensation)}</td><td>{record.performanceRating}</td><td>{canViewRisk ? <span className={`${styles.riskBadge} ${riskTone(record.flightRiskBand)}`}>{record.flightRisk}</span> : readData("components.Clerio.MisReportingHub", "display_7")}</td><td><button type="button" aria-label={translateText("components.Clerio.MisReportingHub","text_4040b7c06c", {value1: String(readData("components.Clerio.MisReportingHub", "viewRecord")), value2: String(record.name)})} onClick={() => setSelectedRecord(record)}><Eye size={16} /></button></td></tr>)}</tbody></table></div></section>
            </>}

            {activeSection === 'catalogue' && <section className={styles.cardsGrid}>{readData("components.Clerio.MisReportingHub", "content_50").map(([title, status, description]) => <article key={title} className={styles.catalogueCard}><Database size={18} /><div><h2>{title}</h2><p>{description}</p><span className={styles.status}>{status}</span></div><button type="button" onClick={() => setActiveSection('report')}>{readData("components.Clerio.MisReportingHub", "content_text_51")}<ChevronRight size={15} /></button></article>)}</section>}

            {activeSection === 'sources' && <section className={styles.tableCard}><div className={styles.cardTitle}><div><h2>{readData("components.Clerio.MisReportingHub", "content_text_52")}</h2><p>{readData("components.Clerio.MisReportingHub", "content_text_53")}</p></div><button className={styles.secondaryButton} type="button" onClick={() => fileInput.current?.click()}><UploadCloud size={15} />{readData("components.Clerio.MisReportingHub", "content_text_54")}</button></div><div className={styles.runList}>{sourceRuns.map((run) => <article key={run.id} className={styles.runItem}><div><strong>{run.fileName}</strong><span>{run.context.sourceSystem}{readData("components.Clerio.MisReportingHub", "content_text_55")}{run.context.periodStart}{readData("components.Clerio.MisReportingHub", "content_text_56")}{run.context.periodEnd}</span></div><div><span>{run.accepted}{readData("components.Clerio.MisReportingHub", "content_text_57")}{run.rejected}{readData("components.Clerio.MisReportingHub", "content_text_58")}</span><span className={styles.status}>{run.status}</span></div><time>{run.completedAt}</time></article>)}</div><div className={styles.contextGrid}>{Object.entries(draftContext).filter(([key]) => key !== 'asOfAt').map(([key, value]) => <label key={key}><span>{key.replace(/([A-Z])/g, ' $1')}</span><input value={value} onChange={(event) => setDraftContext((context) => ({ ...context, [key]: event.target.value }))} /></label>)}</div></section>}

            {activeSection === 'quality' && <section className={styles.qualityLayout}><article className={styles.qualitySummary}><CheckCircle2 size={20} /><div><h2>{pendingImport ? readData("components.Clerio.MisReportingHub", "display_8") : readData("components.Clerio.MisReportingHub", "display_9")}</h2><p>{pendingImport ?translateText("components.Clerio.MisReportingHub","text_5f4daa5c37", {value1: String(pendingImport.total)}) : readData("components.Clerio.MisReportingHub", "display_10")}</p></div>{pendingImport && <button className={styles.primaryButton} type="button" onClick={publishImport} disabled={!pendingImport.accepted.length}>{readData("components.Clerio.MisReportingHub", "content_text_59")}{pendingImport.accepted.length}{readData("components.Clerio.MisReportingHub", "content_text_60")}</button>}</article>{pendingImport && <><div className={styles.qualityMetrics}><span><strong>{pendingImport.accepted.length}</strong>{readData("components.Clerio.MisReportingHub", "content_text_61")}</span><span><strong>{pendingImport.rejected.length}</strong>{readData("components.Clerio.MisReportingHub", "content_text_62")}</span><span><strong>{pendingImport.context.periodStart || readData("components.Clerio.MisReportingHub", "fallback_6")}</strong>{readData("components.Clerio.MisReportingHub", "content_text_63")}</span><span><strong>{pendingImport.context.legalEntity || readData("components.Clerio.MisReportingHub", "fallback_7")}</strong>{readData("components.Clerio.MisReportingHub", "content_text_64")}</span></div><section className={styles.tableCard}><div className={styles.cardTitle}><div><h2>{readData("components.Clerio.MisReportingHub", "content_text_65")}</h2><p>{readData("components.Clerio.MisReportingHub", "content_text_66")}</p></div></div>{pendingImport.rejected.length ? <div className={styles.issueList}>{pendingImport.rejected.map((row) => <article key={`${row.empId}-${row.sourceRowNumber}`}><AlertTriangle size={16} /><div><strong>{readData("components.Clerio.MisReportingHub", "content_text_67")}{row.sourceRowNumber}{readData("components.Clerio.MisReportingHub", "content_text_68")}{row.empId || readData("components.Clerio.MisReportingHub", "fallback_8")}</strong><p>{row.issues.join(' ')}</p></div></article>)}</div> : <p className={styles.empty}>{readData("components.Clerio.MisReportingHub", "content_text_69")}</p>}</section></>}</section>}

            {activeSection === 'risk' && <section className={styles.tableCard}><div className={styles.cardTitle}><div><h2>{readData("components.Clerio.MisReportingHub", "content_text_70")}</h2><p>{readData("components.Clerio.MisReportingHub", "content_text_71")}</p></div><span className={styles.status}>{canViewRisk ? readData("components.Clerio.MisReportingHub", "display_11") : readData("components.Clerio.MisReportingHub", "display_12")}</span></div>{canViewRisk ? <div className={styles.riskList}>{managedRecords.filter((record) => record.flightRiskBand !== 'Low').map((record) => { const riskCase = riskCases[record.empId] || readData("components.Clerio.MisReportingHub", "riskCase_72"); return <article key={record.empId} className={styles.riskCase}><div><span className={`${styles.riskBadge} ${riskTone(record.flightRiskBand)}`}>{record.flightRisk}</span><h2>{record.name}</h2><p>{record.role}{readData("components.Clerio.MisReportingHub", "content_text_73")}{record.dept}{readData("components.Clerio.MisReportingHub", "content_text_74")}{record.flightRiskScore ?? readData("components.Clerio.MisReportingHub", "fallback_9")}{readData("components.Clerio.MisReportingHub", "content_text_75")}</p></div><label>{readData("components.Clerio.MisReportingHub", "content_text_76")}<select value={riskCase.state} onChange={(event) => updateRiskCase(record, event.target.value)}>{RISK_STATES.map((state) => <option key={state}>{state}</option>)}</select></label><label>{readData("components.Clerio.MisReportingHub", "content_text_77")}<input value={riskCase.owner} onChange={(event) => setRiskCases((cases) => ({ ...cases, [record.empId]: { ...riskCase, owner: event.target.value } }))} /></label><button type="button" className={styles.secondaryButton} onClick={() => setSelectedRecord(record)}>{readData("components.Clerio.MisReportingHub", "content_text_78")}<ChevronRight size={15} /></button></article>; })}</div> : <p className={styles.empty}>{readData("components.Clerio.MisReportingHub", "content_text_79")}</p>}</section>}

            {selectedRecord && <div className={styles.drawerOverlay} onMouseDown={() => setSelectedRecord(null)}><aside className={styles.drawer} onMouseDown={(event) => event.stopPropagation()} aria-label={readData("components.Clerio.MisReportingHub", "content_aria-label_80")}><header><div><span>{selectedRecord.empId}</span><h2>{selectedRecord.name}</h2><p>{selectedRecord.role}{readData("components.Clerio.MisReportingHub", "content_text_81")}{selectedRecord.dept}</p></div><button type="button" onClick={() => setSelectedRecord(null)}><X size={18} /></button></header><section className={styles.detailGrid}><article><Clock3 size={16} /><span>{readData("components.Clerio.MisReportingHub", "content_text_82")}</span><strong>{selectedRecord.attendancePct}{readData("components.Clerio.MisReportingHub", "content_text_83")}</strong><button type="button" onClick={() => onNavigate?.('attendance_detail')}>{readData("components.Clerio.MisReportingHub", "content_text_84")}</button></article><article><Clock3 size={16} /><span>{readData("components.Clerio.MisReportingHub", "content_text_85")}</span><strong>{selectedRecord.overtimeHrs}{readData("components.Clerio.MisReportingHub", "content_text_86")}</strong><button type="button" onClick={() => onNavigate?.('overtime_register')}>{readData("components.Clerio.MisReportingHub", "content_text_87")}</button></article><article><UserRound size={16} /><span>{readData("components.Clerio.MisReportingHub", "content_text_88")}</span><strong>{selectedRecord.performanceRating}</strong><button type="button" onClick={() => onNavigate?.('performance')}>{readData("components.Clerio.MisReportingHub", "content_text_89")}</button></article><article><ShieldCheck size={16} /><span>{readData("components.Clerio.MisReportingHub", "content_text_90")}</span><strong>{displayCtc(selectedRecord, canViewCompensation)}</strong><button type="button" onClick={() => onNavigate?.('salary_simulator')}>{readData("components.Clerio.MisReportingHub", "content_text_91")}</button></article></section><section className={styles.auditPanel}><h3>{readData("components.Clerio.MisReportingHub", "content_text_92")}</h3><p>{readData("components.Clerio.MisReportingHub", "content_text_93")}{selectedRecord.reportContext.sourceSystem}{readData("components.Clerio.MisReportingHub", "content_text_94")}{selectedRecord.sourceRowNumber}</p><p>{readData("components.Clerio.MisReportingHub", "content_text_95")}{selectedRecord.reportContext.periodStart || readData("components.Clerio.MisReportingHub", "fallback_10")}{readData("components.Clerio.MisReportingHub", "content_text_96")}{selectedRecord.reportContext.periodEnd || readData("components.Clerio.MisReportingHub", "fallback_11")}{readData("components.Clerio.MisReportingHub", "content_text_97")}{selectedRecord.reportContext.timezone}</p><p>{readData("components.Clerio.MisReportingHub", "content_text_98")}{canViewRisk ?translateText("components.Clerio.MisReportingHub","text_9eab8d21e8", {value1: String(selectedRecord.flightRisk)}) : readData("components.Clerio.MisReportingHub", "display_13")}</p></section></aside></div>}

            <section className={styles.auditStrip}><strong>{readData("components.Clerio.MisReportingHub", "content_text_99")}</strong>{auditEvents.slice(0, 3).map((event) => <span key={event.id}>{event.at}{readData("components.Clerio.MisReportingHub", "content_text_100")}{event.detail}</span>)}</section>
        </section>
    );
}
