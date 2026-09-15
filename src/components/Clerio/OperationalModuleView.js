"use client";
import {useTranslation} from '@/context/I18nContext';

import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { initialFormValues, updateDerivedFields, validateForm } from '@/lib/form-validation';
import LeaveWorkflowPanel from '@/components/Leave/LeaveWorkflowPanel';
import ProcessGuide from './ProcessGuide';
import { readData } from '../../services/workspace-data.mjs';


import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronRight, FileText, LoaderCircle, Plus, RefreshCw, ShieldCheck, UploadCloud } from 'lucide-react';
import { listModuleRecords } from '@/services/module-service.mjs';
import { getWorkbookFieldOptions, getWorkbookRowsForModule, recordCellValue as workbookRecordCellValue } from '@/lib/demo-workbook-adapter.mjs';
import styles from './OperationalModuleView.module.css';

function rowsFromPayload(payload) {
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.attributes?.items)) return payload.attributes.items;
    return [];
}

function fallbackRows(module) {
    return getWorkbookRowsForModule(module.id);
}

function recordValue(record, column) {
    if (record?._cells) return workbookRecordCellValue(record, column);
    if (record?.values) {
        if (column === 'Employee') return record.values.employee || record.id;
        if (column === 'Leave type') return record.values.leaveType;
        if (column === 'Dates') return `${record.values.fromDate} – ${record.values.toDate} (${record.values.numberOfDays})`;
        const fieldKey = column.charAt(0).toLowerCase() + column.slice(1).replaceAll(' ', '');
        if (record.values[fieldKey] !== undefined) return record.values[fieldKey];
    }
    if (column === 'Employee') {
        const name = [record?.firstName, record?.lastName].filter(Boolean).join(' ');
        return [record?.employeeCode, name].filter(Boolean).join(' · ') || record?.id || readData("components.Clerio.OperationalModuleView", "fallback_1");
    }
    if (column === 'Assignment') return [record?.designation, record?.location].filter(Boolean).join(' · ') || readData("components.Clerio.OperationalModuleView", "fallback_2");
    if (column === 'Department') return record?.department || readData("components.Clerio.OperationalModuleView", "fallback_3");
    const lookup = readData("components.Clerio.OperationalModuleView", "lookup_2");
    const key = lookup[column] || column.toLowerCase().replaceAll(' ', '');
    return record[key] ?? record.attributes?.[key] ?? record.id ?? readData("components.Clerio.OperationalModuleView", "fallback_4");
}

export default function OperationalModuleView(props) {
    if (props.module.screenId === 'SCR-030') return <><ProcessGuide screenId={props.module.screenId} /><LeaveWorkflowPanel /></>;
    return <OperationalModuleContent key={props.module.id} {...props} />;
}

function OperationalModuleContent({ module, onNavigate }) {
    const {t: translateText}=useTranslation();

    const [records, setRecords] = useState(() => fallbackRows(module));
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(Boolean(module.endpoint) && !getWorkbookRowsForModule(module.id).length);
    const [error, setError] = useState('');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [values, setValues] = useState({});
    const [notice, setNotice] = useState('');
    const [formErrors, setFormErrors] = useState({});
    const [liveReferences, setLiveReferences] = useState({
        employees: [],
        locations: [],
        departments: [],
        shifts: []
    });

    useEffect(() => {
        let active = true;
        async function fetchReferences() {
            try {
                const [peopleRes, locRes, shiftRes] = await Promise.allSettled([
                    fetch('/api/v1/people?pageSize=100').then(r => r.ok ? r.json() : null),
                    fetch('/api/v1/ops/modules/location_master/records?pageSize=100').then(r => r.ok ? r.json() : null),
                    fetch('/api/v1/ops/modules/shift_master/records?pageSize=100').then(r => r.ok ? r.json() : null),
                ]);

                if (!active) return;

                const employees = [];
                const locationSet = new Set();
                const deptSet = new Set();
                const shifts = [];

                if (peopleRes.status === 'fulfilled' && peopleRes.value?.data) {
                    const list = Array.isArray(peopleRes.value.data) ? peopleRes.value.data : [];
                    list.forEach(p => {
                        const name = [p.firstName, p.lastName].filter(Boolean).join(' ');
                        const label = [p.employeeCode, name].filter(Boolean).join(' · ') + (p.department ? ` (${p.department})` : '');
                        employees.push({ value: p.id, label });
                        if (p.employeeCode && p.employeeCode !== p.id) {
                            employees.push({ value: p.employeeCode, label });
                        }
                        if (p.location) locationSet.add(p.location);
                        if (p.department) deptSet.add(p.department);
                    });
                }

                if (locRes.status === 'fulfilled' && locRes.value?.data) {
                    const list = Array.isArray(locRes.value.data) ? locRes.value.data : [];
                    list.forEach(r => {
                        const vals = r.attributes || r.values || {};
                        const locName = vals.locationName || vals.name || vals.locationCode;
                        if (locName) locationSet.add(locName);
                    });
                }

                if (shiftRes.status === 'fulfilled' && shiftRes.value?.data) {
                    const list = Array.isArray(shiftRes.value.data) ? shiftRes.value.data : [];
                    list.forEach(r => {
                        const vals = r.attributes || r.values || {};
                        const code = vals.shiftCode || vals.code;
                        const name = vals.shiftName || vals.name;
                        if (code) {
                            shifts.push({
                                value: code,
                                label: name ? `${code} · ${name}` : code
                            });
                        }
                    });
                }

                if (shifts.length === 0) {
                    shifts.push(
                        { value: 'GEN', label: 'GEN · General Shift (09:00 - 18:00)' },
                        { value: 'MORN', label: 'MORN · Morning Shift (06:00 - 14:30)' },
                        { value: 'EVE', label: 'EVE · Evening Shift (14:00 - 22:30)' },
                        { value: 'NIGHT', label: 'NIGHT · Night Shift (22:00 - 06:30)' }
                    );
                }
                if (locationSet.size === 0) {
                    ['Bangalore HQ', 'Hyderabad Tech Center', 'Mumbai Corporate Office', 'Pune Innovation Hub', 'Chennai Facility'].forEach(l => locationSet.add(l));
                }
                if (deptSet.size === 0) {
                    ['Engineering', 'Product & Design', 'Human Resources', 'Finance & Accounts', 'Operations & Logistics'].forEach(d => deptSet.add(d));
                }

                setLiveReferences({
                    employees,
                    locations: Array.from(locationSet).map(loc => ({ value: loc, label: loc })),
                    departments: Array.from(deptSet).map(dept => ({ value: dept, label: dept })),
                    shifts
                });
            } catch (err) {
                console.warn('Reference load error:', err);
            }
        }
        fetchReferences();
        return () => { active = false; };
    }, []);

    const formFields = useMemo(() => {
        return module.fields.map(field => {
            let options = field.options?.length
                ? field.options.map(option => typeof option === 'string' ? { value: option, label: option } : option)
                : getWorkbookFieldOptions(field.key);

            const isSelectOrLookup = field.type === 'select' || (field.control && /select|lookup/i.test(field.control)) || (field.options && field.options.length > 0);
            const key = (field.key || '').toLowerCase();
            const isEmp = isSelectOrLookup && (['personid', 'employee', 'referrerpersonid', 'panel', 'assigneeid', 'allocatedto', 'manager', 'user', 'leaver'].includes(key) || key.includes('person') || (key.includes('employee') && key !== 'employeecode'));
            const isLoc = isSelectOrLookup && (['locationid', 'location', 'site', 'worksite', 'locationcode'].includes(key) || key.includes('location') || key.includes('site'));
            const isDept = isSelectOrLookup && (['orgunit', 'department', 'costcenter', 'section'].includes(key) || key.includes('department') || key.includes('orgunit'));
            const isShift = isSelectOrLookup && (['shiftcode', 'shiftid', 'shift', 'defaultshift', 'appliedshift'].includes(key) || (key.includes('shift') && !key.includes('group') && !key.includes('hour') && !key.includes('night')));

            if (isEmp && liveReferences.employees.length > 0) {
                const existingVals = new Set(options.map(o => o.value));
                const newOpts = liveReferences.employees.filter(o => !existingVals.has(o.value));
                options = [...newOpts, ...options];
            } else if (isLoc && liveReferences.locations.length > 0) {
                const existingVals = new Set(options.map(o => o.value));
                const newOpts = liveReferences.locations.filter(o => !existingVals.has(o.value));
                options = [...newOpts, ...options];
            } else if (isDept && liveReferences.departments.length > 0) {
                const existingVals = new Set(options.map(o => o.value));
                const newOpts = liveReferences.departments.filter(o => !existingVals.has(o.value));
                options = [...newOpts, ...options];
            } else if (isShift && liveReferences.shifts.length > 0) {
                const existingVals = new Set(options.map(o => o.value));
                const newOpts = liveReferences.shifts.filter(o => !existingVals.has(o.value));
                options = [...newOpts, ...options];
            }

            return { ...field, options };
        });
    }, [module.fields, liveReferences]);

    const openCreate = () => { setValues(initialFormValues(formFields)); setFormErrors({}); setIsCreateOpen(true); };
    const updateField = (key, value) => { setValues(current => updateDerivedFields(formFields, current, key, value)); setFormErrors({}); };

    const selectedRecord = useMemo(() => selected || records[0] || null, [records, selected]);
    useEffect(() => {
        let active = true;
        listModuleRecords(module.id).then((items) => {
            if (!active) return;
            setRecords(items);
            setLoading(false);
        }).catch((loadError) => {
            if (!active) return;
            setError(loadError.message);
            setLoading(false);
        });
        return () => { active = false; };
    }, [module.id]);

    const reload = async () => {
        setLoading(true);
        setError('');
        try { setRecords(await listModuleRecords(module.id)); }
        catch (loadError) { setError(loadError.message); }
        finally { setLoading(false); }
    };

    const submit = async (event) => {
        event.preventDefault();
        const errors = validateForm(formFields, values);
        setFormErrors(errors);
        if (Object.keys(errors).length) return;
        const newRecord = {
            id: `${module.id}-${crypto.randomUUID()}`,
            _cells: values,
            values,
            createdAt: new Date().toISOString()
        };
        setRecords(prev => [newRecord, ...prev]);
        setIsCreateOpen(false);

        if (module.endpoint) {
            try {
                const res = await fetch(module.endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Idempotency-Key': crypto.randomUUID(),
                    },
                    body: JSON.stringify(values),
                });
                if (res.ok) {
                    const json = await res.json().catch(() => null);
                    if (json?.attributes || json?.id) {
                        setRecords(prev => [
                            {
                                id: json.id || newRecord.id,
                                _cells: json.attributes || values,
                                values: json.attributes || values,
                                createdAt: new Date().toISOString(),
                            },
                            ...prev.filter(r => r.id !== newRecord.id),
                        ]);
                    }
                }
            } catch (postErr) {
                console.warn(`Live DB persist for ${module.id} notice:`, postErr);
            }
        }

        setNotice(translateText("components.Clerio.OperationalModuleView","text_created_success", {value1: String(module.title)}));
    };

    const advanceState = (state) => {
        setNotice(translateText("components.Clerio.OperationalModuleView","text_942fc1b03f", {value1: String(state)}));
    };
    const transition = advanceState;

    return (
        <section className={styles.page} aria-labelledby="operational-module-title">
            <header className={styles.header}>
                <div>
                    <div className={styles.eyebrow}>{module.primary.replaceAll('_', ' ')}{readData("components.Clerio.OperationalModuleView", "content_text_5")}{module.screenId}</div>
                    <h1 id="operational-module-title">{module.title}</h1>
                    <p>{module.description}</p>
                </div>
                <div className={styles.headerActions}>
                    <button
                        className={styles.secondaryButton}
                        type="button"
                        onClick={() => {
                            if (typeof window !== 'undefined') {
                                window.dispatchEvent(new CustomEvent('nucleus:open_bulk_upload'));
                            }
                        }}
                        title="Bulk Data Ingestion & Sample Template"
                    >
                        <UploadCloud size={15} /> Bulk Upload
                    </button>
                    <button className={styles.secondaryButton} type="button" onClick={reload} disabled={loading}><RefreshCw size={15} className={loading ? styles.spin : ''} />{readData("components.Clerio.OperationalModuleView", "content_text_6")}</button>
                    <button className={styles.primaryButton} type="button" onClick={openCreate}><Plus size={15} /> {module.actions[0]}</button>
                </div>
            </header>
            <ProcessGuide screenId={module.screenId} />

            {notice && <div className={styles.notice}><CheckCircle2 size={16} /> {notice}</div>}
            {error && <div className={styles.error}><AlertCircle size={16} /> {error}{readData("components.Clerio.OperationalModuleView", "content_text_7")}</div>}

            <div className={styles.scopeBar}>
                <span><ShieldCheck size={14} />{readData("components.Clerio.OperationalModuleView", "content_text_8")}</span>
                <button type="button" onClick={() => onNavigate?.(module.primary)}>{readData("components.Clerio.OperationalModuleView", "content_text_9")}{module.primary.replaceAll('_', ' ')}</button>
            </div>

            <div className={styles.layout}>
                <section className={styles.listCard} aria-label={translateText("components.Clerio.OperationalModuleView","text_247374fc3d", {value1: String(module.title)})}>
                    <div className={styles.cardTitle}><div><h2>{readData("components.Clerio.OperationalModuleView", "content_text_10")}</h2><p>{loading ? readData("components.Clerio.OperationalModuleView", "display_1") :translateText("components.Clerio.OperationalModuleView","text_de86a6588b", {value1: String(records.length)})}</p></div><FileText size={19} /></div>
                    <div className={styles.tableWrap}>
                        <table>
                            <thead><tr>{module.columns.map((column) => <th key={column}>{column}</th>)}<th aria-label={readData("components.Clerio.OperationalModuleView", "content_aria-label_11")} /></tr></thead>
                            <tbody>{records.map((record) => <tr key={record.id} className={selectedRecord?.id === record.id ? styles.selectedRow : ''} onClick={() => setSelected(record)}>{module.columns.map((column) => <td key={column}>{column === 'Status' ? <span className={styles.status}>{recordValue(record, column)}</span> : recordValue(record, column)}</td>)}<td><ChevronRight size={16} /></td></tr>)}</tbody>
                        </table>
                    </div>
                </section>

                <aside className={styles.detailCard} aria-label={readData("components.Clerio.OperationalModuleView", "content_aria-label_12")}>
                    <div className={styles.cardTitle}><div><h2>{readData("components.Clerio.OperationalModuleView", "content_text_13")}</h2><p>{selectedRecord?.reference || module.screenId}</p></div><span className={styles.status}>{selectedRecord?.status || module.states[0]}</span></div>
                    <p className={styles.detailText}>{selectedRecord?.detail || readData("components.Clerio.OperationalModuleView", "fallback_6")}</p>
                    <div className={styles.timeline}><h3>{readData("components.Clerio.OperationalModuleView", "content_text_14")}</h3>{module.states.map((state, index) => <button key={state} type="button" className={selectedRecord?.status === state ? styles.currentState : ''} onClick={() => transition(state)}><span>{index + 1}</span>{state}</button>)}</div>
                    <div className={styles.audit}><h3>{readData("components.Clerio.OperationalModuleView", "content_text_15")}</h3><p><strong>{readData("components.Clerio.OperationalModuleView", "content_text_16")}</strong>{readData("components.Clerio.OperationalModuleView", "content_text_17")}</p><p><strong>{readData("components.Clerio.OperationalModuleView", "content_text_18")}</strong>{readData("components.Clerio.OperationalModuleView", "content_text_19")}</p></div>
                </aside>
            </div>

            <Dialog open={isCreateOpen} onClose={() => setIsCreateOpen(false)} aria-labelledby="operational-form-title" maxWidth="sm" fullWidth>
                <form className={styles.formDialog} onSubmit={submit} noValidate>
                    <header><div><span>{module.screenId}</span><h2 id="operational-form-title">{module.actions[0]}</h2></div><button type="button" onClick={() => setIsCreateOpen(false)}>{readData("components.Clerio.OperationalModuleView", "content_text_20")}</button></header>
                    {Object.keys(formErrors).length > 0 && <div role="alert" className={styles.error}>{Object.values(formErrors).join(' ')}</div>}
                    <div className={styles.formGrid}>{formFields.map(item => {
                        const props = { id: `record-${item.key}`, name: item.key, required: item.required, value: values[item.key] ?? '', 'aria-invalid': Boolean(formErrors[item.key]), onChange: event => updateField(item.key, event.target.value) };
                        return <label key={item.key} htmlFor={props.id}><span>{item.label}{item.required && <b>{readData("components.Clerio.OperationalModuleView", "content_text_21")}</b>}</span>
                            {item.type === 'file' ? <input id={props.id} type="file" required={item.required} onChange={event => updateField(item.key, event.target.files?.[0]?.name || '')} />
                                : item.type === 'select' || item.options.length ? <select {...props}><option value="">{readData("components.Clerio.OperationalModuleView", "content_text_22")}{item.label}</option>{item.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                                : item.derive?.kind === 'inclusiveDays' ? <span className={styles.stepControl}>
                                    <IconButton type="button" aria-label={readData('components.Clerio.OperationalModuleView', 'decreaseDays')} disabled={!Number.isFinite(Number(values[item.key])) || Number(values[item.key]) <= item.min} onClick={() => updateField(item.key, Math.max(item.min, Number(values[item.key]) - item.step))}><RemoveIcon /></IconButton>
                                    <input {...props} type="number" min={item.min} max={item.max} step={item.step} />
                                    <IconButton type="button" aria-label={readData('components.Clerio.OperationalModuleView', 'increaseDays')} disabled={Number(values[item.key]) >= item.max} onClick={() => updateField(item.key, Math.min(item.max, (Number(values[item.key]) || 0) + item.step))}><AddIcon /></IconButton>
                                </span>
                                : item.type === 'textarea' ? <textarea {...props} rows={3} />
                                : <input {...props} type={item.type} min={item.min} max={item.max} step={item.step} />}
                        </label>;
                    })}</div>
                    <footer><p>{readData("components.Clerio.OperationalModuleView", "content_text_23")}</p><div><button type="button" className={styles.secondaryButton} onClick={() => setIsCreateOpen(false)}>{readData("components.Clerio.OperationalModuleView", "content_text_24")}</button><button className={styles.primaryButton} type="submit">{readData("components.Clerio.OperationalModuleView", "content_text_25")}</button></div></footer>
                </form>
            </Dialog>
        </section>
    );
}
