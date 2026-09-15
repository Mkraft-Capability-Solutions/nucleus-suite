"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
    Users, ChevronDown, ChevronRight, Search, Building2,
    Eye, MapPin, Briefcase, Plus, Minus, Layers, Maximize2, Minimize2
} from 'lucide-react';
import styles from './OrgChartView.module.css';
import { useHRMS } from '@/context/HRMSContext';
import EmployeeDossierModal from './EmployeeDossierModal';

// Build manager -> reports tree from flat employee list
function buildOrgTree(employees) {
    if (!employees || employees.length === 0) return [];

    const byId = {};
    const byCode = {};
    const byName = {};

    employees.forEach(emp => {
        const id = emp.id || emp.employeeCode || `emp-${Math.random()}`;
        const node = {
            ...emp,
            id,
            reports: [],
            name: emp.name || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Employee',
            designation: emp.designation || emp.role || 'Staff Member',
            dept: emp.department || emp.dept || 'Operations',
            location: emp.location || 'Bangalore HQ',
            employeeCode: emp.employeeCode || emp.code || id.slice(0, 8),
        };
        byId[id] = node;
        if (emp.employeeCode) byCode[emp.employeeCode] = node;
        if (node.name) byName[node.name.toLowerCase()] = node;
    });

    const roots = [];
    const assignedIds = new Set();

    // Pass 1: Explicit manager links (managerId or manager name)
    Object.values(byId).forEach(node => {
        const mgrRef = node.managerId || node.manager;
        if (mgrRef) {
            const parent = byId[mgrRef] || byCode[mgrRef] || byName[String(mgrRef).toLowerCase()];
            if (parent && parent.id !== node.id) {
                parent.reports.push(node);
                assignedIds.add(node.id);
            }
        }
    });

    // Pass 2: Role-based hierarchy for remaining unassigned nodes
    // Find leadership or top-level roles to act as roots
    const unassigned = Object.values(byId).filter(node => !assignedIds.has(node.id));

    // Determine leadership root (e.g. CEO, Director, Founder, Head, or first unassigned)
    const isLeader = (node) => {
        const r = (node.designation || '').toLowerCase();
        return r.includes('ceo') || r.includes('director') || r.includes('chief') || r.includes('managing') || r.includes('head') || r.includes('president');
    };

    const leaders = unassigned.filter(isLeader);
    const nonLeaders = unassigned.filter(node => !isLeader(node));

    if (leaders.length > 0) {
        roots.push(...leaders);
        // Distribute remaining non-leaders among department leads or primary leader
        const leaderByDept = {};
        leaders.forEach(l => { leaderByDept[l.dept] = l; });
        const primaryLeader = leaders[0];

        nonLeaders.forEach(emp => {
            const deptMgr = leaderByDept[emp.dept] || primaryLeader;
            deptMgr.reports.push(emp);
        });
    } else if (unassigned.length > 0) {
        // Elect the first as root, or return top level nodes
        roots.push(unassigned[0]);
        for (let i = 1; i < unassigned.length; i++) {
            unassigned[0].reports.push(unassigned[i]);
        }
    }

    return roots;
}

// Department summary
function getDeptSummary(employees) {
    const depts = {};
    (employees || []).forEach(emp => {
        const dept = emp.department || emp.dept || 'Operations';
        if (!depts[dept]) depts[dept] = { name: dept, count: 0, employees: [] };
        depts[dept].count++;
        depts[dept].employees.push(emp);
    });
    return Object.values(depts).sort((a, b) => b.count - a.count);
}

// Hierarchical Node Component
function TreeNode({ node, searchQuery, activeDept, onOpenDossier, forceExpanded }) {
    const [expanded, setExpanded] = useState(true);

    useEffect(() => {
        if (forceExpanded !== null) {
            setExpanded(forceExpanded);
        }
    }, [forceExpanded]);

    const hasReports = node.reports && node.reports.length > 0;
    const isMatched = searchQuery
        ? node.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          node.designation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          node.dept?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          node.employeeCode?.toLowerCase().includes(searchQuery.toLowerCase())
        : false;

    const isDeptMatched = !activeDept || activeDept === 'ALL' || node.dept === activeDept;

    if (searchQuery && !isMatched && !hasReports) {
        return null;
    }

    const initials = (node.name || 'EM')
        .split(' ')
        .filter(Boolean)
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

    return (
        <div className={styles.nodeWrapper}>
            <div className={`${styles.nodeCard} ${isMatched ? styles.nodeCardMatched : ''}`}>
                <div className={styles.nodeTop}>
                    <div className={styles.nodeAvatar}>
                        {initials}
                    </div>
                    <div className={styles.nodeMeta}>
                        <div className={styles.nodeName} title={node.name}>{node.name}</div>
                        <div className={styles.nodeRole} title={node.designation}>{node.designation}</div>
                        <div className={styles.nodeCode}>{node.employeeCode}</div>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className={styles.nodeDeptBadge}>
                        <Building2 size={11} /> {node.dept}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <MapPin size={11} /> {node.location}
                    </span>
                </div>

                <div className={styles.nodeBottom}>
                    <div className={styles.reportsCount}>
                        {hasReports ? (
                            <span>{node.reports.length} direct report{node.reports.length !== 1 ? 's' : ''}</span>
                        ) : (
                            <span style={{ color: 'var(--text-3)' }}>Individual Contributor</span>
                        )}
                    </div>

                    <div className={styles.nodeActions}>
                        <button
                            type="button"
                            className={styles.actionBtn}
                            onClick={() => onOpenDossier(node)}
                            title="View Employee 360 Dossier"
                        >
                            <Eye size={12} /> Dossier
                        </button>
                        {hasReports && (
                            <button
                                type="button"
                                className={styles.expandBtn}
                                onClick={() => setExpanded(prev => !prev)}
                                title={expanded ? "Collapse team" : "Expand team"}
                            >
                                {expanded ? <Minus size={13} /> : <Plus size={13} />}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {hasReports && expanded && (
                <>
                    <div className={styles.connectorDown} />
                    <div className={styles.childrenContainer}>
                        {node.reports.map(child => (
                            <div key={child.id} style={{ position: 'relative' }}>
                                <div className={styles.connectorUp} />
                                <TreeNode
                                    node={child}
                                    searchQuery={searchQuery}
                                    activeDept={activeDept}
                                    onOpenDossier={onOpenDossier}
                                    forceExpanded={forceExpanded}
                                />
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

export default function OrgChartView() {
    const { employees: contextEmployees } = useHRMS();
    const [employees, setEmployees] = useState(contextEmployees || []);
    const [view, setView] = useState('tree'); // 'tree' | 'dept'
    const [searchQuery, setSearchQuery] = useState('');
    const [activeDept, setActiveDept] = useState('ALL');
    const [forceExpanded, setForceExpanded] = useState(null);
    const [dossierEmployee, setDossierEmployee] = useState(null);

    // Fetch live database people for genuine tenant org structure
    useEffect(() => {
        let active = true;
        fetch('/api/v1/people?pageSize=100')
            .then(res => res.ok ? res.json() : null)
            .then(json => {
                if (!active) return;
                if (json?.data && Array.isArray(json.data) && json.data.length > 0) {
                    const mapped = json.data.map(p => ({
                        id: p.id,
                        employeeCode: p.employeeCode || p.code || p.id.slice(0, 8),
                        firstName: p.firstName,
                        lastName: p.lastName,
                        name: [p.firstName, p.lastName].filter(Boolean).join(' ') || p.name || 'Employee',
                        designation: p.designation || p.jobTitle || 'Executive Staff',
                        department: p.department || 'Operations',
                        dept: p.department || 'Operations',
                        location: p.location || 'Bangalore HQ',
                        manager: p.manager || p.reportingManager || '',
                        managerId: p.managerId || p.reportsToId || null,
                        email: p.email || p.workEmail,
                        phone: p.phone || p.mobileNumber,
                    }));
                    setEmployees(mapped);
                } else if (contextEmployees?.length) {
                    setEmployees(contextEmployees);
                }
            })
            .catch(() => {
                if (active && contextEmployees?.length) {
                    setEmployees(contextEmployees);
                }
            });
        return () => { active = false; };
    }, [contextEmployees]);

    const tree = useMemo(() => buildOrgTree(employees), [employees]);
    const deptSummary = useMemo(() => getDeptSummary(employees), [employees]);

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.headerRow}>
                <div className={styles.titleBlock}>
                    <h2>
                        <Users size={24} style={{ color: 'var(--signal)' }} />
                        Organization Chart & Hierarchy
                    </h2>
                    <p>
                        {employees.length} enterprise employees · {deptSummary.length} departments · Interactive Reporting Structure
                    </p>
                </div>

                <div className={styles.toolbar}>
                    {/* Search */}
                    <div className={styles.searchBox}>
                        <Search size={15} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search employee, title..."
                            className={styles.searchInput}
                        />
                    </div>

                    {/* Department Dropdown Filter */}
                    <select
                        className={styles.selectFilter}
                        value={activeDept}
                        onChange={e => setActiveDept(e.target.value)}
                    >
                        <option value="ALL">All Departments ({employees.length})</option>
                        {deptSummary.map(d => (
                            <option key={d.name} value={d.name}>
                                {d.name} ({d.count})
                            </option>
                        ))}
                    </select>

                    {/* Expand/Collapse All */}
                    <button
                        type="button"
                        className={styles.actionBtn}
                        style={{ height: '38px', padding: '0 0.85rem' }}
                        onClick={() => setForceExpanded(prev => (prev === true ? false : true))}
                    >
                        {forceExpanded === true ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                        {forceExpanded === true ? 'Collapse All' : 'Expand All'}
                    </button>

                    {/* View Switcher */}
                    <div className={styles.viewToggle}>
                        <button
                            type="button"
                            className={`${styles.toggleBtn} ${view === 'tree' ? styles.toggleBtnActive : ''}`}
                            onClick={() => setView('tree')}
                        >
                            Hierarchy Tree
                        </button>
                        <button
                            type="button"
                            className={`${styles.toggleBtn} ${view === 'dept' ? styles.toggleBtnActive : ''}`}
                            onClick={() => setView('dept')}
                        >
                            By Department
                        </button>
                    </div>
                </div>
            </div>

            {/* Department Summary Ribbon */}
            <div className={styles.deptRibbon}>
                <div
                    className={`${styles.deptCard} ${activeDept === 'ALL' ? styles.deptCardActive : ''}`}
                    onClick={() => setActiveDept('ALL')}
                >
                    <div className={styles.deptCount}>{employees.length}</div>
                    <div className={styles.deptLabel}>Total Roster</div>
                </div>
                {deptSummary.slice(0, 6).map(dept => (
                    <div
                        key={dept.name}
                        className={`${styles.deptCard} ${activeDept === dept.name ? styles.deptCardActive : ''}`}
                        onClick={() => setActiveDept(dept.name)}
                    >
                        <div className={styles.deptCount}>{dept.count}</div>
                        <div className={styles.deptLabel}>{dept.name}</div>
                    </div>
                ))}
            </div>

            {/* Interactive Visual Hierarchy Tree */}
            {view === 'tree' && (
                <div className={styles.treeCanvas}>
                    <div className={styles.treeCanvasInner}>
                        {tree.length === 0 ? (
                            <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: '3rem' }}>
                                No employees found matching filter criteria.
                            </div>
                        ) : (
                            tree.map(root => (
                                <TreeNode
                                    key={root.id}
                                    node={root}
                                    searchQuery={searchQuery}
                                    activeDept={activeDept}
                                    onOpenDossier={setDossierEmployee}
                                    forceExpanded={forceExpanded}
                                />
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Department Grouping Grid */}
            {view === 'dept' && (
                <div className={styles.deptViewGrid}>
                    {deptSummary
                        .filter(d => activeDept === 'ALL' || d.name === activeDept)
                        .filter(d => !searchQuery || d.name.toLowerCase().includes(searchQuery.toLowerCase()) || d.employees.some(e => (e.name || '').toLowerCase().includes(searchQuery.toLowerCase())))
                        .map(dept => (
                            <div key={dept.name} className={styles.deptSection}>
                                <div className={styles.deptHeader}>
                                    <div className={styles.deptHeaderTitle}>
                                        <Building2 size={16} style={{ color: 'var(--signal)' }} />
                                        <span>{dept.name}</span>
                                    </div>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--signal-ink)', background: 'var(--signal-wash)', padding: '0.2rem 0.65rem', borderRadius: 'var(--r-pill)' }}>
                                        {dept.count} Members
                                    </span>
                                </div>
                                <div className={styles.deptCardsGrid}>
                                    {dept.employees
                                        .filter(e => !searchQuery || (e.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (e.designation || '').toLowerCase().includes(searchQuery.toLowerCase()))
                                        .map(emp => (
                                            <div key={emp.id} className={styles.deptEmpCard}>
                                                <div className={styles.nodeAvatar} style={{ width: '36px', height: '36px', fontSize: '0.82rem' }}>
                                                    {(emp.name || 'E').charAt(0)}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {emp.name}
                                                    </div>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {emp.designation}
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    className={styles.actionBtn}
                                                    onClick={() => setDossierEmployee(emp)}
                                                    title="View Employee Dossier"
                                                >
                                                    <Eye size={12} />
                                                </button>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        ))}
                </div>
            )}

            {/* Employee 360 Dossier Modal Integration */}
            {dossierEmployee && (
                <EmployeeDossierModal
                    isOpen={Boolean(dossierEmployee)}
                    employee={dossierEmployee}
                    onClose={() => setDossierEmployee(null)}
                />
            )}
        </div>
    );
}
