"use client";
import React, { useState, useMemo } from 'react';
import { Users, ChevronDown, ChevronRight, Search, Building2, User, Briefcase, Phone, Mail } from 'lucide-react';
import styles from './OrgChartView.module.css';
import { useHRMS } from '@/context/HRMSContext';

// Build manager -> reports tree from flat employee list
function buildOrgTree(employees) {
    const byId = {};
    const roots = [];
    employees.forEach(emp => { byId[emp.id] = { ...emp, reports: [] }; });
    employees.forEach(emp => {
        const managerName = emp.manager || '';
        const managerNode = employees.find(e => e.name === managerName && e.id !== emp.id);
        if (managerNode && byId[managerNode.id]) {
            byId[managerNode.id].reports.push(byId[emp.id]);
        } else {
            roots.push(byId[emp.id]);
        }
    });
    return roots;
}

// Department summary
function getDeptSummary(employees) {
    const depts = {};
    employees.forEach(emp => {
        const dept = emp.dept || 'Unassigned';
        if (!depts[dept]) depts[dept] = { name: dept, count: 0, employees: [] };
        depts[dept].count++;
        depts[dept].employees.push(emp);
    });
    return Object.values(depts).sort((a, b) => b.count - a.count);
}

function OrgNode({ node, depth = 0, searchQuery }) {
    const [expanded, setExpanded] = useState(depth < 2);
    const hasReports = node.reports && node.reports.length > 0;
    const isMatch = searchQuery
        ? node.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          node.role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          node.dept?.toLowerCase().includes(searchQuery.toLowerCase())
        : true;

    if (!isMatch && !hasReports) return null;

    const avatarColors = ['#6366f1','#0891b2','#059669','#d97706','#dc2626','#7c3aed','#0284c7','#15803d'];
    const colorIdx = (node.name || '').charCodeAt(0) % avatarColors.length;

    return (
        <div style={{ marginLeft: depth * 24 + 'px', marginTop: '8px' }}>
            <div
                style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    background: isMatch && searchQuery ? 'rgba(99,102,241,0.12)' : 'rgba(30,41,59,0.6)',
                    border: isMatch && searchQuery ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '10px', padding: '10px 14px', cursor: hasReports ? 'pointer' : 'default',
                    transition: 'all 0.2s', minWidth: 280, maxWidth: 420,
                }}
                onClick={() => hasReports && setExpanded(p => !p)}
            >
                {/* Avatar */}
                <div style={{
                    width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                    background: avatarColors[colorIdx],
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 700, fontSize: '0.9rem'
                }}>
                    {(node.name || '?').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '0.87rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {node.name}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                        {node.role || node.designation} · {node.dept}
                    </div>
                </div>
                {hasReports && (
                    <span style={{ color: '#64748b', fontSize: '0.72rem', marginRight: 4 }}>
                        {node.reports.length} report{node.reports.length !== 1 ? 's' : ''}
                    </span>
                )}
                {hasReports && (
                    expanded ? <ChevronDown size={15} color="#64748b" /> : <ChevronRight size={15} color="#64748b" />
                )}
            </div>
            {expanded && hasReports && (
                <div style={{ borderLeft: '2px solid rgba(99,102,241,0.25)', marginLeft: 18, paddingLeft: 0 }}>
                    {node.reports.map(child => (
                        <OrgNode key={child.id} node={child} depth={0} searchQuery={searchQuery} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function OrgChartView() {
    const { employees } = useHRMS();
    const [view, setView] = useState('tree'); // 'tree' | 'dept'
    const [searchQuery, setSearchQuery] = useState('');

    const tree = useMemo(() => buildOrgTree(employees), [employees]);
    const deptSummary = useMemo(() => getDeptSummary(employees), [employees]);

    const deptColors = {
        Engineering: '#6366f1', 'Human Resources': '#0891b2', Finance: '#059669',
        Operations: '#d97706', Product: '#7c3aed', Quality: '#dc2626',
        Production: '#0284c7', Maintenance: '#15803d', Safety: '#be185d', Purchase: '#9333ea'
    };

    return (
        <div style={{ padding: '1.5rem', minHeight: '100vh', background: 'var(--bg)' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ margin: 0, color: 'var(--text)', fontSize: '1.3rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Users size={20} style={{ color: '#6366f1' }} /> Organization Chart
                    </h2>
                    <p style={{ margin: '4px 0 0', color: 'var(--text-2)', fontSize: '0.82rem' }}>
                        {employees.length} employees · {deptSummary.length} departments · Department-wise hierarchy
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {/* Search */}
                    <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                        <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search employee, role..."
                            style={{
                                paddingLeft: 30, paddingRight: 10, height: 36, background: 'var(--surface)',
                                border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)',
                                fontSize: '0.82rem', outline: 'none', width: 220
                            }}
                        />
                    </div>
                    {/* Toggle */}
                    <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
                        {[['tree', 'Hierarchy'], ['dept', 'By Department']].map(([v, label]) => (
                            <button key={v} onClick={() => setView(v)} style={{
                                padding: '6px 14px', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                                background: view === v ? '#6366f1' : 'transparent',
                                color: view === v ? '#fff' : 'var(--text-2)', transition: 'all 0.15s'
                            }}>{label}</button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Department Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {deptSummary.map(dept => (
                    <div key={dept.name} style={{
                        background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10,
                        padding: '12px 14px', borderTop: `3px solid ${deptColors[dept.name] || '#6366f1'}`
                    }}>
                        <div style={{ color: deptColors[dept.name] || '#6366f1', fontWeight: 700, fontSize: '1.4rem' }}>{dept.count}</div>
                        <div style={{ color: 'var(--text-2)', fontSize: '0.75rem', marginTop: 2 }}>{dept.name}</div>
                    </div>
                ))}
            </div>

            {/* Tree View */}
            {view === 'tree' && (
                <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: '1.25rem', overflowX: 'auto' }}>
                    <div style={{ minWidth: 360 }}>
                        {tree.length === 0 ? (
                            <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: '2rem' }}>No employees found.</div>
                        ) : (
                            tree.map(root => <OrgNode key={root.id} node={root} depth={0} searchQuery={searchQuery} />)
                        )}
                    </div>
                </div>
            )}

            {/* Department View */}
            {view === 'dept' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {deptSummary.filter(d => !searchQuery || d.name.toLowerCase().includes(searchQuery.toLowerCase()) || d.employees.some(e => e.name?.toLowerCase().includes(searchQuery.toLowerCase()))).map(dept => (
                        <div key={dept.name} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
                            <div style={{ padding: '12px 16px', background: 'rgba(30,41,59,0.8)', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Building2 size={16} style={{ color: deptColors[dept.name] || '#6366f1' }} />
                                <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.9rem' }}>{dept.name}</span>
                                <span style={{ marginLeft: 'auto', background: deptColors[dept.name] || '#6366f1', color: '#fff', borderRadius: 99, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700 }}>
                                    {dept.count}
                                </span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '0.75rem', padding: '0.75rem' }}>
                                {dept.employees.filter(e => !searchQuery || e.name?.toLowerCase().includes(searchQuery.toLowerCase()) || e.role?.toLowerCase().includes(searchQuery.toLowerCase())).map(emp => (
                                    <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--line-soft)' }}>
                                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: deptColors[dept.name] || '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>
                                            {(emp.name || '?').charAt(0)}
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ color: 'var(--text)', fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.name}</div>
                                            <div style={{ color: 'var(--text-3)', fontSize: '0.72rem' }}>{emp.role || emp.designation}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
