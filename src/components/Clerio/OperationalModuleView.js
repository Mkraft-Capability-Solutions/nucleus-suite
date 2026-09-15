"use client";
import { useTranslation } from '@/context/I18nContext';

import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { initialFormValues, updateDerivedFields, validateForm } from '@/lib/form-validation';
import LeaveWorkflowPanel from '@/components/Leave/LeaveWorkflowPanel';
import ProcessGuide from './ProcessGuide';
import { readData } from '../../services/workspace-data.mjs';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronRight, Edit2, Eye, FileText, LoaderCircle, Plus, RefreshCw, Search, ShieldCheck, UploadCloud, X } from 'lucide-react';
import { listModuleRecords } from '@/services/module-service.mjs';
import { getWorkbookFieldOptions, getWorkbookRowsForModule, recordCellValue as workbookRecordCellValue } from '@/lib/demo-workbook-adapter.mjs';
import TablePagination from '../Common/TablePagination';
import styles from './OperationalModuleView.module.css';

function rowsFromPayload(payload) {
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.attributes?.items)) return payload.attributes.items;
    return [];
}

export function dedupeOptions(options) {
    if (!Array.isArray(options)) return [];
    const seenValues = new Set();
    const seenLabels = new Set();
    const result = [];

    for (const opt of options) {
        if (!opt) continue;
        const rawValue = typeof opt === 'string' ? opt : (opt.value ?? opt.label ?? opt.id ?? '');
        const rawLabel = typeof opt === 'string' ? opt : (opt.label ?? opt.value ?? opt.name ?? '');

        const valStr = String(rawValue).trim();
        const labelStr = String(rawLabel).trim();

        if (!valStr && !labelStr) continue;
        const finalVal = valStr || labelStr;
        const finalLabel = labelStr || valStr;

        const valKey = finalVal.toLowerCase();
        const labelKey = finalLabel.toLowerCase();

        if (!seenValues.has(valKey) && !seenLabels.has(labelKey)) {
            seenValues.add(valKey);
            seenLabels.add(labelKey);
            result.push({ value: finalVal, label: finalLabel });
        }
    }
    return result;
}

function fallbackRows(module) {
    return getWorkbookRowsForModule(module.id);
}

function recordValue(record, column, module, liveReferences) {
    if (!record) return '—';
    const cells = record._cells || {};
    const values = record.values || {};
    const attrs = record.attributes || {};
    const all = { ...attrs, ...cells, ...values, ...record };

    // 1. Direct key/cell match
    let val = cells[column] ?? values[column] ?? all[column];

    // 2. Field mapping by field label or key from module.fields
    if (val === undefined && module?.fields) {
        const normCol = column.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const field of module.fields) {
            const normLabel = (field.label || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const normKey = (field.key || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            if (normCol === normLabel || normCol === normKey) {
                val = cells[field.key] ?? values[field.key] ?? attrs[field.key] ?? all[field.key];
                break;
            }
        }
    }

    // 3. Fallback standard alias matching
    if (val === undefined) {
        const norm = column.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (norm === 'location' || norm === 'worksite') {
            val = all.locationId || all.location || all.worksite || all.locationCode;
        } else if (norm === 'orgunitsection' || norm === 'orgunit' || norm === 'department' || norm === 'section') {
            val = all.orgUnit || all.department || all.section || all.costCenter;
        } else if (norm === 'employee' || norm === 'person' || norm === 'worker') {
            val = all.personId || all.employee || all.employeeCode || all.employeeId;
        } else if (norm === 'date' || norm === 'rosterdate') {
            val = all.rosterDate || all.date || all.effectiveDate || all.fromDate;
        } else if (norm === 'status' || norm === 'publishstatus') {
            val = all.publishStatus || all.status || all.recordStatus;
        } else if (norm === 'periodfromto' || norm === 'period') {
            val = all.periodFromPeriodTo || all.period;
        } else if (norm === 'shift' || norm === 'shiftcode') {
            val = all.shiftCode || all.shift || all.shiftId;
        } else if (norm === 'assignment') {
            val = [all.designation, all.location].filter(Boolean).join(' · ');
        }
    }

    // Fallback to demo workbook cell value if available
    if (val === undefined && record?._cells) {
        const wbVal = workbookRecordCellValue(record, column);
        if (wbVal && wbVal !== '—') val = wbVal;
    }

    if (val === undefined || val === null || val === '') {
        return record.reference || '—';
    }

    // 4. Reference resolving (converting IDs / codes to readable labels)
    if (liveReferences) {
        const norm = column.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (norm === 'employee' || norm === 'person' || norm === 'worker') {
            const emp = liveReferences.employees?.find(e => String(e.value) === String(val) || e.label.includes(String(val)));
            if (emp) return emp.label;
        }
        if (norm === 'location') {
            const loc = liveReferences.locations?.find(l => String(l.value) === String(val));
            if (loc) return loc.label;
        }
        if (norm === 'shift' || norm === 'shiftcode') {
            const sh = liveReferences.shifts?.find(s => String(s.value) === String(val));
            if (sh) return sh.label;
        }
        if (norm === 'orgunitsection' || norm === 'department' || norm === 'orgunit') {
            const dept = liveReferences.departments?.find(d => String(d.value) === String(val));
            if (dept) return dept.label;
        }
    }

    if (column === 'Status' || column === 'Publish status') {
        const str = String(val);
        return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
    }

    return String(val);
}

export default function OperationalModuleView(props) {
    if (props.module.screenId === 'SCR-030') return <><ProcessGuide screenId={props.module.screenId} /><LeaveWorkflowPanel /></>;
    return <OperationalModuleContent key={props.module.id} {...props} />;
}

function OperationalModuleContent({ module, onNavigate }) {
    const { t: translateText } = useTranslation();

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

    // View Details Modal
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [viewingRecord, setViewingRecord] = useState(null);

    // Edit Modal
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);
    const [editValues, setEditValues] = useState({});
    const [editErrors, setEditErrors] = useState({});
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    const [sortColumn, setSortColumn] = useState(null);
    const [sortAsc, setSortAsc] = useState(true);

    const filteredRecords = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return records;
        return records.filter(r => {
            const matchesCol = module.columns?.some(col => {
                const formatted = recordValue(r, col, module, liveReferences);
                return formatted && String(formatted).toLowerCase().includes(q);
            });
            if (matchesCol) return true;
            const vals = { ...(r.attributes || {}), ...(r.values || {}), ...(r._cells || {}) };
            return Object.values(vals).some(val =>
                val && String(val).toLowerCase().includes(q)
            );
        });
    }, [records, searchQuery, module, liveReferences]);

    const sortedRecords = useMemo(() => {
        if (!sortColumn) return filteredRecords;
        return [...filteredRecords].sort((a, b) => {
            const valA = String(recordValue(a, sortColumn, module, liveReferences) || '').toLowerCase();
            const valB = String(recordValue(b, sortColumn, module, liveReferences) || '').toLowerCase();
            return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        });
    }, [filteredRecords, sortColumn, sortAsc, module, liveReferences]);

    const paginatedRecords = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return sortedRecords.slice(start, start + pageSize);
    }, [sortedRecords, currentPage, pageSize]);

    useEffect(() => {
        let active = true;
        async function fetchReferences() {
            try {
                const [peopleRes, locRes, shiftRes, treeRes] = await Promise.allSettled([
                    fetch('/api/v1/people?pageSize=100').then(r => r.ok ? r.json() : null),
                    fetch('/api/v1/ops/modules/location_master/records?pageSize=100').then(r => r.ok ? r.json() : null),
                    fetch('/api/v1/ops/modules/shift_master/records?pageSize=100').then(r => r.ok ? r.json() : null),
                    fetch('/api/v1/organization/tree').then(r => r.ok ? r.json() : null),
                ]);

                if (!active) return;

                const employees = [];
                const seenEmp = new Set();
                const locationSet = new Set(['Bengaluru Corporate Office', 'Mumbai Delivery Center', 'Gurugram Tech Park', 'Hyderabad Facility']);
                const deptSet = new Set(['Engineering', 'Product & Design', 'Finance & Accounts', 'Human Resources', 'Environment, Health & Safety', 'Operations']);
                const shifts = [
                    { value: 'SH-GEN', label: 'SH-GEN · General Shift (09:00 - 18:00)' },
                    { value: 'SH-A', label: 'SH-A · Morning Shift (06:00 - 14:30)' },
                    { value: 'SH-B', label: 'SH-B · Afternoon Shift (14:00 - 22:30)' },
                    { value: 'SH-C', label: 'SH-C · Night Shift (22:00 - 06:30)' },
                    { value: 'SH-ROT', label: 'SH-ROT · Rotational Shift' },
                ];

                if (peopleRes.status === 'fulfilled' && peopleRes.value?.data) {
                    const list = Array.isArray(peopleRes.value.data) ? peopleRes.value.data : [];
                    list.forEach(p => {
                        const name = [p.firstName, p.lastName].filter(Boolean).join(' ') || p.name || 'Staff';
                        const code = p.employeeCode || p.id;
                        const label = [code, name].filter(Boolean).join(' · ') + (p.department ? ` (${p.department})` : '');
                        const val = p.id || code;
                        const valKey = String(val).toLowerCase().trim();
                        const labelKey = String(label).toLowerCase().trim();
                        if (val && !seenEmp.has(valKey) && !seenEmp.has(labelKey)) {
                            seenEmp.add(valKey);
                            seenEmp.add(labelKey);
                            employees.push({ value: val, label });
                        }
                        if (p.location) locationSet.add(String(p.location).trim());
                        if (p.department) deptSet.add(String(p.department).trim());
                    });
                }

                if (treeRes.status === 'fulfilled' && treeRes.value?.data) {
                    const tree = treeRes.value.data;
                    if (Array.isArray(tree.locations)) {
                        tree.locations.forEach(l => {
                            const name = l.attributes?.name || l.attributes?.locationName || l.attributes?.code;
                            if (name) locationSet.add(String(name).trim());
                        });
                    }
                    if (Array.isArray(tree.departments)) {
                        tree.departments.forEach(d => {
                            const name = d.attributes?.name || d.attributes?.departmentName || d.attributes?.code;
                            if (name) deptSet.add(String(name).trim());
                        });
                    }
                    if (Array.isArray(tree.headcount)) {
                        tree.headcount.forEach(h => {
                            if (h.name) deptSet.add(String(h.name).trim());
                        });
                    }
                }

                if (locRes.status === 'fulfilled' && locRes.value?.data) {
                    const list = Array.isArray(locRes.value.data) ? locRes.value.data : [];
                    list.forEach(r => {
                        const vals = r.attributes || r.values || {};
                        const locName = vals.locationName || vals.name || vals.locationCode;
                        if (locName) locationSet.add(String(locName).trim());
                    });
                }

                if (shiftRes.status === 'fulfilled' && shiftRes.value?.data) {
                    const list = Array.isArray(shiftRes.value.data) ? shiftRes.value.data : [];
                    list.forEach(r => {
                        const vals = r.attributes || r.values || {};
                        const code = vals.shiftCode || vals.code;
                        const name = vals.shiftName || vals.name;
                        if (code) {
                            const trimmedCode = String(code).trim();
                            const codeKey = trimmedCode.toLowerCase();
                            if (!shifts.some(s => s.value.toLowerCase() === codeKey)) {
                                shifts.push({
                                    value: trimmedCode,
                                    label: name ? `${trimmedCode} · ${String(name).trim()}` : trimmedCode
                                });
                            }
                        }
                    });
                }

                setLiveReferences({
                    employees: dedupeOptions(employees),
                    locations: dedupeOptions(Array.from(locationSet).map(loc => ({ value: loc, label: loc }))),
                    departments: dedupeOptions(Array.from(deptSet).map(dept => ({ value: dept, label: dept }))),
                    shifts: dedupeOptions(shifts)
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
                options = [...liveReferences.employees, ...options];
            } else if (isLoc && liveReferences.locations.length > 0) {
                options = [...liveReferences.locations, ...options];
            } else if (isDept && liveReferences.departments.length > 0) {
                options = [...liveReferences.departments, ...options];
            } else if (isShift && liveReferences.shifts.length > 0) {
                options = [...liveReferences.shifts, ...options];
            }

            options = dedupeOptions(options);

            return { ...field, options };
        });
    }, [module.fields, liveReferences]);

    const openCreate = () => {
        setValues(initialFormValues(formFields));
        setFormErrors({});
        setIsCreateOpen(true);
    };

    const updateField = (key, value) => {
        setValues(current => updateDerivedFields(formFields, current, key, value));
        setFormErrors({});
    };

    const openView = (record) => {
        setViewingRecord(record);
        setSelected(record);
        setIsViewOpen(true);
    };

    const openEdit = (recordToEdit) => {
        const target = recordToEdit || selectedRecord;
        if (!target) return;
        setEditingRecord(target);
        setSelected(target);
        const existing = { ...(target.attributes || {}), ...(target.values || {}), ...(target._cells || {}) };
        const initial = {};
        formFields.forEach(f => {
            initial[f.key] = existing[f.key] !== undefined 
                ? existing[f.key] 
                : (existing[f.label] !== undefined ? existing[f.label] : (f.default ?? ''));
        });
        setEditValues(initial);
        setEditErrors({});
        setIsEditOpen(true);
    };

    const updateEditField = (key, value) => {
        setEditValues(current => updateDerivedFields(formFields, current, key, value));
        setEditErrors({});
    };

    const selectedRecord = useMemo(() => selected || records[0] || null, [records, selected]);

    useEffect(() => {
        let active = true;
        listModuleRecords(module.id).then((items) => {
            if (!active) return;
            setRecords(items);
            if (items.length > 0 && !selected) {
                setSelected(items[0]);
            }
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
        try {
            const items = await listModuleRecords(module.id);
            setRecords(items);
            if (items.length > 0) setSelected(items[0]);
        } catch (loadError) {
            setError(loadError.message);
        } finally {
            setLoading(false);
        }
    };

    const submit = async (event) => {
        event.preventDefault();
        const errors = validateForm(formFields, values);
        setFormErrors(errors);
        if (Object.keys(errors).length) return;

        const tempId = `${module.id}-${crypto.randomUUID()}`;
        const newRecord = {
            id: tempId,
            _cells: values,
            values,
            attributes: values,
            createdAt: new Date().toISOString()
        };
        setRecords(prev => [newRecord, ...prev]);
        setSelected(newRecord);
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
                    const recData = json?.data || json;
                    const finalId = recData?.id || json?.id || tempId;
                    const finalAttrs = recData?.attributes || json?.attributes || values;
                    const finalCreatedAt = recData?.createdAt || json?.createdAt || new Date().toISOString();
                    setRecords(prev => [
                        {
                            id: finalId,
                            _cells: finalAttrs,
                            values: finalAttrs,
                            attributes: finalAttrs,
                            createdAt: finalCreatedAt,
                        },
                        ...prev.filter(r => r.id !== tempId),
                    ]);
                    setSelected({
                        id: finalId,
                        _cells: finalAttrs,
                        values: finalAttrs,
                        attributes: finalAttrs,
                        createdAt: finalCreatedAt,
                    });
                }
            } catch (postErr) {
                console.warn(`Live DB persist for ${module.id} notice:`, postErr);
            }
        }

        setNotice(translateText("components.Clerio.OperationalModuleView", "text_created_success", { value1: String(module.title) }));
    };

    const submitEdit = async (event) => {
        event.preventDefault();
        const errors = validateForm(formFields, editValues);
        setEditErrors(errors);
        if (Object.keys(errors).length) return;
        setIsSavingEdit(true);

        const updatedAttrs = {
            ...editValues,
            updatedAt: new Date().toISOString(),
        };

        // Optimistic UI update
        setRecords(prev => prev.map(r => r.id === editingRecord.id ? {
            ...r,
            _cells: { ...r._cells, ...updatedAttrs },
            values: { ...r.values, ...updatedAttrs },
            attributes: { ...r.attributes, ...updatedAttrs },
        } : r));

        if (selectedRecord?.id === editingRecord.id) {
            setSelected(prev => ({
                ...prev,
                _cells: { ...prev._cells, ...updatedAttrs },
                values: { ...prev.values, ...updatedAttrs },
                attributes: { ...prev.attributes, ...updatedAttrs },
            }));
        }

        setIsEditOpen(false);
        setIsSavingEdit(false);

        // Persist to backend database
        try {
            const res = await fetch(`/api/v1/ops/modules/${module.id}/records/${editingRecord.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editValues),
            });
            if (res.ok) {
                const json = await res.json().catch(() => null);
                const recData = json?.data || json;
                const finalAttrs = recData?.attributes || json?.attributes || updatedAttrs;
                setRecords(prev => prev.map(r => r.id === editingRecord.id ? {
                    ...r,
                    _cells: { ...r._cells, ...finalAttrs },
                    values: { ...r.values, ...finalAttrs },
                    attributes: { ...r.attributes, ...finalAttrs },
                } : r));
            }
        } catch (err) {
            console.warn('Update persistence error:', err);
        }

        const editSuccessMsg = translateText("components.Clerio.OperationalModuleView", "text_updated_success", { value1: String(module.title) });
        setNotice(editSuccessMsg && !editSuccessMsg.includes('text_updated_success') ? editSuccessMsg : `${module.title} updated successfully in database.`);
    };

    const advanceState = (state) => {
        setNotice(translateText("components.Clerio.OperationalModuleView", "text_942fc1b03f", { value1: String(state) }));
    };
    const transition = advanceState;

    const handleModuleAction = (action, index) => {
        if (index === 0) {
            openCreate();
            return;
        }
        const actionLower = String(action || '').toLowerCase();
        if (actionLower.includes('edit') || actionLower.includes('update') || actionLower.includes('modify') || actionLower.includes('roster') || actionLower.includes('schedule')) {
            const target = selected || records[0];
            if (target) {
                openEdit(target);
            } else {
                const msg = translateText("components.Clerio.OperationalModuleView", "text_no_records_to_edit");
                setNotice(msg && !msg.includes('text_no_records_to_edit') ? msg : 'No records available to edit. Please create a record first.');
            }
            return;
        }

        let msg = translateText("components.Clerio.OperationalModuleView", "text_ready_action", { value1: String(action) });
        if (!msg || msg.includes("components.Clerio.OperationalModuleView")) {
            msg = `${action} action is ready.`;
        }
        setNotice(msg);
    };

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
                        onClick={reload}
                        disabled={loading}
                        aria-label="Refresh records"
                    >
                        <RefreshCw size={16} className={loading ? styles.spin : ''} />
                        {readData("components.Clerio.OperationalModuleView", "content_text_6")}
                    </button>
                    {module.actions?.map((action, index) => {
                        const isEdit = String(action || '').toLowerCase().includes('edit') || String(action || '').toLowerCase().includes('roster');
                        return (
                            <button
                                key={action}
                                className={index === 0 ? styles.primaryButton : styles.secondaryButton}
                                type="button"
                                onClick={() => handleModuleAction(action, index)}
                            >
                                {index === 0 ? <Plus size={16} /> : (isEdit ? <Edit2 size={16} /> : <UploadCloud size={16} />)}
                                {action}
                            </button>
                        );
                    })}
                </div>
            </header>

            {notice && <div role="status" className={styles.notice}><CheckCircle2 size={16} />{notice}</div>}
            {error && <div role="alert" className={styles.error}><AlertCircle size={16} />{error}</div>}

            <ProcessGuide screenId={module.screenId} />

            <div className={styles.scopeBar}>
                <span>
                    <ShieldCheck size={16} />
                    {readData("components.Clerio.OperationalModuleView", "content_text_8")}
                    <strong>{module.states.join(' → ')}</strong>
                </span>
                <span>{readData("components.Clerio.OperationalModuleView", "content_text_9")}{records.length}{readData("components.Clerio.OperationalModuleView", "content_text_10")}</span>
            </div>

            <div className={styles.layout}>
                <section className={styles.listCard} aria-label={module.title}>
                    <div className={styles.cardTitle}>
                        <div>
                            <h2>{module.title}</h2>
                            <p>{sortedRecords.length} records available</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <Search size={14} style={{ position: 'absolute', left: '0.6rem', color: 'var(--text-3)', pointerEvents: 'none' }} />
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    style={{
                                        padding: '0.32rem 0.6rem 0.32rem 1.85rem',
                                        fontSize: '0.78rem',
                                        borderRadius: 'var(--r-control)',
                                        border: '1px solid var(--line)',
                                        background: 'var(--bg)',
                                        color: 'var(--text)',
                                        outline: 'none',
                                        width: '160px'
                                    }}
                                />
                            </div>
                            <FileText size={19} />
                        </div>
                    </div>
                    <div className={styles.tableWrap}>
                        <table>
                            <thead>
                                <tr>
                                    {module.columns.map((column) => (
                                        <th
                                            key={column}
                                            onClick={() => {
                                                if (sortColumn === column) {
                                                    setSortAsc(!sortAsc);
                                                } else {
                                                    setSortColumn(column);
                                                    setSortAsc(true);
                                                }
                                            }}
                                            style={{ cursor: 'pointer', userSelect: 'none' }}
                                            title={`Sort by ${column}`}
                                        >
                                            {column} {sortColumn === column ? (sortAsc ? '▲' : '▼') : '↕'}
                                        </th>
                                    ))}
                                    <th style={{ width: '85px', textAlign: 'center' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedRecords.map((record) => (
                                    <tr
                                        key={record.id}
                                        className={selectedRecord?.id === record.id ? styles.selectedRow : ''}
                                        onClick={() => setSelected(record)}
                                    >
                                        {module.columns.map((column) => {
                                            const cellVal = recordValue(record, column, module, liveReferences);
                                            return (
                                                <td key={column}>
                                                    {column === 'Status' || column === 'Publish status' ? (
                                                        <span className={styles.status}>{cellVal}</span>
                                                    ) : (
                                                        cellVal
                                                    )}
                                                </td>
                                            );
                                        })}
                                        <td style={{ textAlign: 'center' }}>
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <button
                                                    type="button"
                                                    className={styles.rowActionBtn}
                                                    title="View Details"
                                                    onClick={(e) => { e.stopPropagation(); openView(record); }}
                                                    aria-label="View Details"
                                                >
                                                    <Eye size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    className={styles.rowActionBtn}
                                                    title="Edit / Update"
                                                    onClick={(e) => { e.stopPropagation(); openEdit(record); }}
                                                    aria-label="Edit Record"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <TablePagination
                            currentPage={currentPage}
                            totalItems={sortedRecords.length}
                            pageSize={pageSize}
                            onPageChange={setCurrentPage}
                            onPageSizeChange={setPageSize}
                        />
                    </div>
                </section>

                <aside className={styles.detailCard} aria-label={readData("components.Clerio.OperationalModuleView", "content_aria-label_12")}>
                    <div className={styles.cardTitle}>
                        <div>
                            <h2>{readData("components.Clerio.OperationalModuleView", "content_text_13")}</h2>
                            <p>{selectedRecord?.reference || selectedRecord?.id || module.screenId}</p>
                        </div>
                        <span className={styles.status}>
                            {selectedRecord ? recordValue(selectedRecord, 'Status', module, liveReferences) : module.states[0]}
                        </span>
                    </div>

                    {/* Quick Selected Attributes */}
                    {selectedRecord && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginBottom: '1rem', background: 'var(--card-2)', padding: '0.75rem', borderRadius: 'var(--r-control, 8px)', border: '1px solid var(--line)' }}>
                            {module.columns.slice(0, 4).map(col => (
                                <div key={col} style={{ overflow: 'hidden' }}>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>{col}</div>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={String(recordValue(selectedRecord, col, module, liveReferences))}>
                                        {recordValue(selectedRecord, col, module, liveReferences)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                        <button
                            type="button"
                            className={styles.primaryButton}
                            onClick={() => openEdit(selectedRecord)}
                            disabled={!selectedRecord}
                            style={{ flex: 1, justifyContent: 'center' }}
                        >
                            <Edit2 size={14} /> Edit Record
                        </button>
                        <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() => openView(selectedRecord)}
                            disabled={!selectedRecord}
                            style={{ flex: 1, justifyContent: 'center' }}
                        >
                            <Eye size={14} /> Full Details
                        </button>
                    </div>

                    <div className={styles.timeline}>
                        <h3>{readData("components.Clerio.OperationalModuleView", "content_text_14")}</h3>
                        {module.states.map((state, index) => (
                            <button
                                key={state}
                                type="button"
                                className={selectedRecord?.status === state || (selectedRecord && recordValue(selectedRecord, 'Status', module, liveReferences).toLowerCase() === state.toLowerCase()) ? styles.currentState : ''}
                                onClick={() => transition(state)}
                            >
                                <span>{index + 1}</span>{state}
                            </button>
                        ))}
                    </div>
                    <div className={styles.audit}>
                        <h3>{readData("components.Clerio.OperationalModuleView", "content_text_15")}</h3>
                        <p><strong>{readData("components.Clerio.OperationalModuleView", "content_text_16")}</strong>{selectedRecord?.createdAt ? new Date(selectedRecord.createdAt).toLocaleString() : readData("components.Clerio.OperationalModuleView", "content_text_17")}</p>
                        <p><strong>{readData("components.Clerio.OperationalModuleView", "content_text_18")}</strong>{selectedRecord?.id || readData("components.Clerio.OperationalModuleView", "content_text_19")}</p>
                    </div>
                </aside>
            </div>

            {/* CREATE MODAL */}
            <Dialog open={isCreateOpen} onClose={() => setIsCreateOpen(false)} aria-labelledby="operational-create-title" maxWidth="sm" fullWidth>
                <form className={styles.formDialog} onSubmit={submit} noValidate>
                    <header>
                        <div>
                            <span>{module.screenId}</span>
                            <h2 id="operational-create-title">{module.actions[0]}</h2>
                        </div>
                        <button type="button" onClick={() => setIsCreateOpen(false)}>
                            <X size={18} />
                        </button>
                    </header>
                    {Object.keys(formErrors).length > 0 && <div role="alert" className={styles.error}>{Object.values(formErrors).join(' ')}</div>}
                    <div className={styles.formGrid}>
                        {formFields.map(item => {
                            const props = {
                                id: `record-${item.key}`,
                                name: item.key,
                                required: item.required,
                                value: values[item.key] ?? '',
                                'aria-invalid': Boolean(formErrors[item.key]),
                                onChange: event => updateField(item.key, event.target.value)
                            };
                            return (
                                <label key={item.key} htmlFor={props.id}>
                                    <span>{item.label}{item.required && <b>{readData("components.Clerio.OperationalModuleView", "content_text_21")}</b>}</span>
                                    {item.type === 'file' ? (
                                        <input id={props.id} type="file" required={item.required} onChange={event => updateField(item.key, event.target.files?.[0]?.name || '')} />
                                    ) : item.type === 'select' || item.options.length ? (
                                        <select {...props}>
                                            <option value="">{readData("components.Clerio.OperationalModuleView", "content_text_22")}{item.label}</option>
                                            {dedupeOptions(item.options).map(option => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                    ) : item.derive?.kind === 'inclusiveDays' ? (
                                        <span className={styles.stepControl}>
                                            <IconButton type="button" aria-label={readData('components.Clerio.OperationalModuleView', 'decreaseDays')} disabled={!Number.isFinite(Number(values[item.key])) || Number(values[item.key]) <= item.min} onClick={() => updateField(item.key, Math.max(item.min, Number(values[item.key]) - item.step))}><RemoveIcon /></IconButton>
                                            <input {...props} type="number" min={item.min} max={item.max} step={item.step} />
                                            <IconButton type="button" aria-label={readData('components.Clerio.OperationalModuleView', 'increaseDays')} disabled={Number(values[item.key]) >= item.max} onClick={() => updateField(item.key, Math.min(item.max, (Number(values[item.key]) || 0) + item.step))}><AddIcon /></IconButton>
                                        </span>
                                    ) : item.type === 'textarea' ? (
                                        <textarea {...props} rows={3} />
                                    ) : (
                                        <input {...props} type={item.type} min={item.min} max={item.max} step={item.step} />
                                    )}
                                </label>
                            );
                        })}
                    </div>
                    <footer>
                        <p>{readData("components.Clerio.OperationalModuleView", "content_text_23")}</p>
                        <div>
                            <button type="button" className={styles.secondaryButton} onClick={() => setIsCreateOpen(false)}>
                                {readData("components.Clerio.OperationalModuleView", "content_text_24")}
                            </button>
                            <button className={styles.primaryButton} type="submit">
                                {readData("components.Clerio.OperationalModuleView", "content_text_25")}
                            </button>
                        </div>
                    </footer>
                </form>
            </Dialog>

            {/* EDIT / UPDATE MODAL */}
            <Dialog open={isEditOpen} onClose={() => setIsEditOpen(false)} aria-labelledby="operational-edit-title" maxWidth="sm" fullWidth>
                <form className={styles.formDialog} onSubmit={submitEdit} noValidate>
                    <header>
                        <div>
                            <span>{module.screenId} · Edit Record</span>
                            <h2 id="operational-edit-title">Edit {module.title}</h2>
                        </div>
                        <button type="button" onClick={() => setIsEditOpen(false)}>
                            <X size={18} />
                        </button>
                    </header>
                    {Object.keys(editErrors).length > 0 && <div role="alert" className={styles.error}>{Object.values(editErrors).join(' ')}</div>}
                    <div className={styles.formGrid}>
                        {formFields.map(item => {
                            const props = {
                                id: `edit-record-${item.key}`,
                                name: item.key,
                                required: item.required,
                                value: editValues[item.key] ?? '',
                                'aria-invalid': Boolean(editErrors[item.key]),
                                onChange: event => updateEditField(item.key, event.target.value)
                            };
                            return (
                                <label key={item.key} htmlFor={props.id}>
                                    <span>{item.label}{item.required && <b>{readData("components.Clerio.OperationalModuleView", "content_text_21")}</b>}</span>
                                    {item.type === 'file' ? (
                                        <input id={props.id} type="file" required={item.required} onChange={event => updateEditField(item.key, event.target.files?.[0]?.name || '')} />
                                    ) : item.type === 'select' || item.options.length ? (
                                        <select {...props}>
                                            <option value="">Select {item.label}</option>
                                            {dedupeOptions(item.options).map(option => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                    ) : item.derive?.kind === 'inclusiveDays' ? (
                                        <span className={styles.stepControl}>
                                            <IconButton type="button" aria-label="Decrease days" disabled={!Number.isFinite(Number(editValues[item.key])) || Number(editValues[item.key]) <= item.min} onClick={() => updateEditField(item.key, Math.max(item.min, Number(editValues[item.key]) - item.step))}><RemoveIcon /></IconButton>
                                            <input {...props} type="number" min={item.min} max={item.max} step={item.step} />
                                            <IconButton type="button" aria-label="Increase days" disabled={Number(editValues[item.key]) >= item.max} onClick={() => updateEditField(item.key, Math.min(item.max, (Number(editValues[item.key]) || 0) + item.step))}><AddIcon /></IconButton>
                                        </span>
                                    ) : item.type === 'textarea' ? (
                                        <textarea {...props} rows={3} />
                                    ) : (
                                        <input {...props} type={item.type} min={item.min} max={item.max} step={item.step} />
                                    )}
                                </label>
                            );
                        })}
                    </div>
                    <footer>
                        <p>Changes will be saved directly to the database.</p>
                        <div>
                            <button type="button" className={styles.secondaryButton} onClick={() => setIsEditOpen(false)}>
                                Cancel
                            </button>
                            <button className={styles.primaryButton} type="submit" disabled={isSavingEdit}>
                                {isSavingEdit ? 'Saving...' : 'Save & Update'}
                            </button>
                        </div>
                    </footer>
                </form>
            </Dialog>

            {/* VIEW DETAILS MODAL */}
            <Dialog open={isViewOpen} onClose={() => setIsViewOpen(false)} maxWidth="sm" fullWidth>
                <div className={styles.formDialog} style={{ padding: '1.25rem' }}>
                    <header style={{ borderBottom: '1px solid var(--line)', paddingBottom: '0.75rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--signal)', fontWeight: 800 }}>{module.screenId} · Record Details</span>
                            <h2 style={{ fontSize: '1.2rem', margin: '0.2rem 0 0 0' }}>{module.title}</h2>
                        </div>
                        <button type="button" onClick={() => setIsViewOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer' }}>
                            <X size={18} />
                        </button>
                    </header>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
                        {formFields.map(f => {
                            const rawVal = viewingRecord ? recordValue(viewingRecord, f.label, module, liveReferences) : '—';
                            return (
                                <div key={f.key} style={{ background: 'var(--card-2)', padding: '0.65rem 0.85rem', borderRadius: 'var(--r-control, 7px)', border: '1px solid var(--line)' }}>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginBottom: '0.2rem' }}>{f.label}</div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>
                                        {f.key.toLowerCase().includes('status') ? (
                                            <span className={styles.status}>{rawVal}</span>
                                        ) : rawVal}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', borderTop: '1px solid var(--line)', paddingTop: '0.75rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <span>Record ID: <code style={{ color: 'var(--text-2)' }}>{viewingRecord?.id}</code></span>
                        <span>Created: {viewingRecord?.createdAt ? new Date(viewingRecord.createdAt).toLocaleString() : '—'}</span>
                    </div>

                    <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', borderTop: '1px solid var(--line)', paddingTop: '0.9rem' }}>
                        <button type="button" className={styles.secondaryButton} onClick={() => setIsViewOpen(false)}>
                            Close
                        </button>
                        <button
                            type="button"
                            className={styles.primaryButton}
                            onClick={() => {
                                setIsViewOpen(false);
                                openEdit(viewingRecord);
                            }}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                        >
                            <Edit2 size={14} /> Edit This Record
                        </button>
                    </footer>
                </div>
            </Dialog>
        </section>
    );
}
