"use client";
import {useTranslation} from '@/context/I18nContext';

import NextImage from 'next/image';
import Dialog from '@mui/material/Dialog';

import { readData } from '../../services/workspace-data.mjs';

import React, { useMemo, useState, useEffect } from 'react';
import {
    Users, Network, FileText, History, Layers, ShieldCheck,
    Search, Plus, Filter, Download, ArrowUpRight, CheckCircle2, AlertCircle,
    Building2, MapPin, UploadCloud
} from 'lucide-react';
import styles from './PeopleCoreView.module.css';
import { useHRMS } from '@/context/HRMSContext';
import { launchAction } from '@/lib/action-launcher';
import { getWorkbookRowsForModule, recordCellValue } from '@/lib/demo-workbook-adapter.mjs';
import EmployeeCreationWizard from './EmployeeCreationWizard';
import BulkOnboardingModal from './BulkOnboardingModal';
import LegalEntityModal from './LegalEntityModal';
import LocationMasterModal from './LocationMasterModal';
import OrgChartView from './OrgChartView';
import { downloadCSV } from '@/utils/exportUtils';

const PeopleCoreView = ({ onNavigate, onSelectConsole, activeSubFeature }) => {
    const {t: translateText}=useTranslation();

    const {
        positions, documents, auditLogs, showToast, employees,
        recognitionAwards, grantRecognitionAward,
        sanctionedQuotas, calculateDepartmentCapacity,
    } = useHRMS();
    const [activeSection, setActiveSection] = useState(readData("components.Clerio.PeopleCoreView", "initialState_1"));

    useEffect(() => {
        if (!activeSubFeature) return;
        if (activeSubFeature === 'legal_entity' || activeSubFeature === 'entities') {
            setActiveSection('entities');
        } else if (activeSubFeature === 'location_master' || activeSubFeature === 'locations') {
            setActiveSection('locations');
        } else if (activeSubFeature === 'position_register' || activeSubFeature === 'positions' || activeSubFeature === 'sanctioned_strength') {
            setActiveSection('positions');
        } else if (activeSubFeature === 'document_vault' || activeSubFeature === 'documents') {
            setActiveSection('documents');
        } else if (activeSubFeature === 'orgchart' || activeSubFeature === 'org_chart') {
            setActiveSection('orgchart');
        } else if (activeSubFeature === 'person_record' || activeSubFeature === 'core_people' || activeSubFeature === 'directory' || activeSubFeature === 'assignment_admin') {
            setActiveSection('directory');
        } else if (activeSubFeature === 'star_employees') {
            setActiveSection('star_employees');
        }
    }, [activeSubFeature]);
    const [searchQuery, setSearchQuery] = useState('');
    const [reassignTarget, setReassignTarget] = useState(null);
    const [selectedNewManager, setSelectedNewManager] = useState('');
    const [managerOverrides, setManagerOverrides] = useState({});

    // Modal Visibility States
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
    const [isEntityModalOpen, setIsEntityModalOpen] = useState(false);
    const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

    // Dynamic UI Master Datasets (Client-side state)
    const [customEmployees, setCustomEmployees] = useState([]);
    const [entitiesList, setEntitiesList] = useState([
        { entityCode: 'ENT-NUC', registeredName: 'Nucleus HR Solutions India Pvt Ltd', entityType: 'Private Limited', cinLlpin: 'U72900KA2024PTC123456', entityPan: 'AAACN1234F', tan: 'BLRN12345E', status: 'Active', effectiveFrom: '2024-04-01' },
        { entityCode: 'ENT-GLB', registeredName: 'Nucleus Global Holdings Inc', entityType: 'Public Limited', cinLlpin: 'U72900DL2022PLC998877', entityPan: 'BBBCN9988G', tan: 'DELN99887F', status: 'Active', effectiveFrom: '2022-01-15' }
    ]);
    const [locationsList, setLocationsList] = useState([
        { locationCode: 'LOC-BLR-01', locationName: 'Bangalore Electronic City Plant 1', entityCode: 'ENT-NUC', locationType: 'Plant', stateCode: 'KA', timeZone: 'Asia/Kolkata', status: 'Active' },
        { locationCode: 'LOC-MUM-01', locationName: 'Mumbai BKC Corporate HQ', entityCode: 'ENT-NUC', locationType: 'Corporate Office', stateCode: 'MH', timeZone: 'Asia/Kolkata', status: 'Active' },
        { locationCode: 'LOC-DEL-01', locationName: 'Delhi Logistics & Warehouse Hub', entityCode: 'ENT-GLB', locationType: 'Warehouse', stateCode: 'DL', timeZone: 'Asia/Kolkata', status: 'Active' }
    ]);

    const workbookEmployees = useMemo(() => getWorkbookRowsForModule('person_record').map((record) => ({
        id: record.source['Employee code'],
        name: record.source['Full name'],
        role: recordCellValue(record, 'Position'),
        dept: recordCellValue(record, 'Department'),
        manager: record.source['Manager name'] || readData("components.Clerio.PeopleCoreView", "fallback_1"),
        location: recordCellValue(record, 'Location'),
        status: recordCellValue(record, 'Status'),
        band: record.source['Worker class'] || readData("components.Clerio.PeopleCoreView", "fallback_2"),
    })), []);

    const directoryEmployees = useMemo(() => [
        ...customEmployees,
        ...workbookEmployees.map((employee) => ({ ...employee, manager: managerOverrides[employee.id] || employee.manager }))
    ], [customEmployees, workbookEmployees, managerOverrides]);

    const filteredEmployees = directoryEmployees.filter(emp =>
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.dept.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.role.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Export Handlers
    const exportDirectoryCSV = () => {
        const headers = ['Employee Code', 'Full Name', 'Position / Role', 'Department', 'Reporting Manager', 'Location', 'Status', 'Worker Class'];
        const rows = directoryEmployees.map(emp => [emp.id, emp.name, emp.role, emp.dept, emp.manager, emp.location, emp.status, emp.band]);
        downloadCSV('nucleus_employee_directory.csv', headers, rows);
        showToast('Export Complete', 'Employee Directory CSV downloaded.', 'success');
    };

    const exportEntitiesCSV = () => {
        const headers = ['Entity Code', 'Registered Name', 'Entity Type', 'CIN / LLPIN', 'PAN', 'TAN', 'Status', 'Effective From'];
        const rows = entitiesList.map(e => [e.entityCode, e.registeredName, e.entityType, e.cinLlpin, e.entityPan, e.tan, e.status, e.effectiveFrom]);
        downloadCSV('nucleus_legal_entities.csv', headers, rows);
        showToast('Export Complete', 'Legal Entities CSV downloaded.', 'success');
    };

    const exportLocationsCSV = () => {
        const headers = ['Location Code', 'Location Name', 'Legal Entity', 'Location Type', 'State', 'Time Zone', 'Status'];
        const rows = locationsList.map(l => [l.locationCode, l.locationName, l.entityCode, l.locationType, l.stateCode, l.timeZone, l.status]);
        downloadCSV('nucleus_locations_master.csv', headers, rows);
        showToast('Export Complete', 'Locations Master CSV downloaded.', 'success');
    };

    const exportPositionsCSV = () => {
        const headers = ['Position Code', 'Position Title', 'Department', 'Open Slots', 'Filled', 'Budget', 'Status'];
        const rows = positions.map(p => [p.id, p.title, p.dept, p.openSlots, p.filled, p.budget, p.status]);
        downloadCSV('nucleus_positions_register.csv', headers, rows);
        showToast('Export Complete', 'Positions CSV downloaded.', 'success');
    };

    const exportDocumentsCSV = () => {
        const headers = ['Document Title', 'Category', 'Verification Status', 'Expiry Date', 'Access Scope'];
        const rows = documents.map(d => [d.title, d.type, d.ocrStatus, d.expiry, 'HR Only']);
        downloadCSV('nucleus_document_vault.csv', headers, rows);
        showToast('Export Complete', 'Document Vault CSV downloaded.', 'success');
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.headerRow}>
                <div className={styles.titleBlock}>
                    <h2>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_1")}</h2>
                    <p>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_2")}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {(onNavigate || onSelectConsole) && (
                        <button
                            className={styles.btnSecondary}
                            onClick={() => {
                                if (onSelectConsole) onSelectConsole('S2');
                                if (onNavigate) onNavigate('dashboard', 'dashboard', 's2');
                            }}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.45rem',
                                border: '1px solid rgba(79, 182, 245, 0.4)',
                                background: 'rgba(79, 182, 245, 0.12)',
                                color: '#4FB6F5',
                                fontWeight: 700
                            }}
                            title={readData("components.Clerio.PeopleCoreView", "PeopleCoreView_title_3")}
                        >
                            <ShieldCheck size={15} />{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_4")}</button>
                    )}
                    <button className={styles.btnSecondary} onClick={() => setIsBulkImportOpen(true)} title="Bulk employee import & template download">
                        <UploadCloud size={16} /> Bulk Onboarding
                    </button>
                    <button className={styles.btnSecondary} onClick={exportDirectoryCSV} title="Export directory to CSV">
                        <Download size={16} /> Export CSV
                    </button>
                    <button className={styles.btnPrimary} onClick={() => setIsWizardOpen(true)} title="Add employee wizard (117 fields)">
                        <Plus size={16} /> Add Employee
                    </button>
                </div>
            </div>

            {/* Sub-Navigation Tabs */}
            <div className={styles.tabNav}>
                <button
                    className={`${styles.tabBtn} ${activeSection === 'directory' ? styles.activeTab : ''}`}
                    onClick={() => setActiveSection('directory')}
                >
                    <Users size={16} /> Employee Directory
                </button>
                <button
                    className={`${styles.tabBtn} ${activeSection === 'entities' ? styles.activeTab : ''}`}
                    onClick={() => setActiveSection('entities')}
                >
                    <Building2 size={16} /> Legal Entities (SCR-001)
                </button>
                <button
                    className={`${styles.tabBtn} ${activeSection === 'locations' ? styles.activeTab : ''}`}
                    onClick={() => setActiveSection('locations')}
                >
                    <MapPin size={16} /> Locations (SCR-002)
                </button>
                <button
                    className={`${styles.tabBtn} ${activeSection === 'orgchart' ? styles.activeTab : ''}`}
                    onClick={() => setActiveSection('orgchart')}
                >
                    <Network size={16} /> Org Chart
                </button>
                <button
                    className={`${styles.tabBtn} ${activeSection === 'positions' ? styles.activeTab : ''}`}
                    onClick={() => setActiveSection('positions')}
                >
                    <Layers size={16} /> Positions (SCR-012)
                </button>
                <button
                    className={`${styles.tabBtn} ${activeSection === 'star_employees' ? styles.activeTab : ''}`}
                    onClick={() => setActiveSection('star_employees')}
                >
                    ⭐ Star Employees
                </button>
                <button
                    className={`${styles.tabBtn} ${activeSection === 'manpower' ? styles.activeTab : ''}`}
                    onClick={() => setActiveSection('manpower')}
                >
                    <Users size={16} /> Approved Manpower
                </button>
                <button
                    className={`${styles.tabBtn} ${activeSection === 'documents' ? styles.activeTab : ''}`}
                    onClick={() => setActiveSection('documents')}
                >
                    <FileText size={16} /> Document Vault (SCR-014)
                </button>
                <button
                    className={`${styles.tabBtn} ${activeSection === 'audit' ? styles.activeTab : ''}`}
                    onClick={() => setActiveSection('audit')}
                >
                    <History size={16} /> Audit Trail
                </button>
            </div>

            {/* Metrics Row */}
            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'var(--info-wash)', color: 'var(--info)' }}>
                        <Users size={24} />
                    </div>
                    <div>
                        <div className={styles.statValue}>{directoryEmployees.length}</div>
                        <div className={styles.statLabel}>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_12")}</div>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'var(--pending-wash)', color: 'var(--pending)' }}>
                        <Layers size={24} />
                    </div>
                    <div>
                        <div className={styles.statValue}>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_13")}</div>
                        <div className={styles.statLabel}>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_14")}</div>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'var(--signal-wash)', color: 'var(--signal)' }}>
                        <ShieldCheck size={24} />
                    </div>
                    <div>
                        <div className={styles.statValue}>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_15")}</div>
                        <div className={styles.statLabel}>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_16")}</div>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'var(--agent-wash)', color: 'var(--agent)' }}>
                        <History size={24} />
                    </div>
                    <div>
                        <div className={styles.statValue}>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_17")}</div>
                        <div className={styles.statLabel}>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_18")}</div>
                    </div>
                </div>
            </div>

            {/* Section 1: Employee Directory */}
            {activeSection === 'directory' && (
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h3><Users size={20} color="var(--info)" />{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_19")}</h3>
                        <div className={styles.searchBar}>
                            <Search size={16} color="var(--text-2)" />
                            <input
                                type="text"
                                placeholder={readData("components.Clerio.PeopleCoreView", "PeopleCoreView_placeholder_20")}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_21")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_22")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_23")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_24")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_25")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_26")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_27")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEmployees.map((emp) => (
                                    <tr key={emp.id}>
                                        <td>
                                            <div className={styles.empRow}>
                                                <NextImage unoptimized width={48} height={48}
                                                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&background=2563ea&color=fff`}
                                                    className={styles.avatar}
                                                    alt={emp.name}
                                                />
                                                <div>
                                                    <strong style={{ display: 'block', color: 'var(--text)' }}>{emp.name}</strong>
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>{emp.role}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div><strong>{emp.id}</strong></div>
                                            <span style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>{emp.band}</span>
                                        </td>
                                        <td>{emp.dept}</td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{emp.manager || readData("components.Clerio.PeopleCoreView", "fallback_3")}</span>
                                                <button
                                                    onClick={() => {
                                                        setReassignTarget(emp);
                                                        setSelectedNewManager(emp.manager || readData("components.Clerio.PeopleCoreView", "fallback_4"));
                                                    }}
                                                    style={{
                                                        background: 'rgba(45, 212, 168, 0.1)',
                                                        border: '1px solid rgba(45, 212, 168, 0.3)',
                                                        borderRadius: '4px',
                                                        padding: '0.15rem 0.45rem',
                                                        fontSize: '0.68rem',
                                                        color: '#2DD4A8',
                                                        fontWeight: 700,
                                                        cursor: 'pointer'
                                                    }}
                                                    title={readData("components.Clerio.PeopleCoreView", "PeopleCoreView_title_28")}
                                                >{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_29")}</button>
                                            </div>
                                        </td>
                                        <td>{emp.location}</td>
                                        <td><span className={`${styles.badge} ${styles.badgeActive}`}>{emp.status}</span></td>
                                        <td>
                                            <button
                                                className={styles.btnSecondary}
                                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                                                onClick={() => showToast(translateText("components.Clerio.PeopleCoreView","text_1614058fbf"),translateText("components.Clerio.PeopleCoreView","text_69fc081ae6", {value1: String(emp.name)}), 'info')}
                                            >{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_30")}</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Section 2: Dynamic Org Chart — Demo Point #22 */}
            {activeSection === 'orgchart' && (
                <OrgChartView />
            )}

            {/* Section: Star Employees — Demo Point #18 */}
            {activeSection === 'star_employees' && (
                <StarEmployeesPanel employees={employees} recognitionAwards={recognitionAwards} grantRecognitionAward={grantRecognitionAward} showToast={showToast} />
            )}

            {/* Section: Approved Manpower — Demo Point #25 */}
            {activeSection === 'manpower' && (
                <ApprovedManpowerPanel employees={employees} positions={positions} sanctionedQuotas={sanctionedQuotas} calculateDepartmentCapacity={calculateDepartmentCapacity} />
            )}

            {activeSection === 'positions' && (
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h3><Layers size={20} color="#2563eb" /> Position Register (SCR-012)</h3>
                        <div style={{ display: 'flex', gap: '0.65rem' }}>
                            <button className={styles.btnSecondary} onClick={exportPositionsCSV}>
                                <Download size={15} /> Export Positions CSV
                            </button>
                            <button className={styles.btnPrimary} onClick={() => launchAction('position')}>
                                <Plus size={16} /> New Position Slot
                            </button>
                        </div>
                    </div>

                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_52")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_53")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_54")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_55")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_56")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_57")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_58")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {positions.map((pos) => (
                                    <tr key={pos.id}>
                                        <td><strong>{pos.id}</strong></td>
                                        <td><strong>{pos.title}</strong></td>
                                        <td>{pos.dept}</td>
                                        <td>{pos.openSlots}</td>
                                        <td>{pos.filled}</td>
                                        <td style={{ color: 'var(--signal)', fontWeight: '600' }}>{pos.budget}</td>
                                        <td>
                                            <span className={`${styles.badge} ${pos.status.includes('Active') ? styles.badgeNotice : styles.badgeActive}`}>
                                                {pos.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Section 4: Document Vault */}
            {activeSection === 'documents' && (
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h3><FileText size={20} color="var(--info)" /> Document Vault (SCR-014)</h3>
                        <div style={{ display: 'flex', gap: '0.65rem' }}>
                            <button className={styles.btnSecondary} onClick={exportDocumentsCSV}>
                                <Download size={15} /> Export Vault CSV
                            </button>
                            <button className={styles.btnPrimary} onClick={() => launchAction('document')}>
                                <Plus size={16} /> Upload Document
                            </button>
                        </div>
                    </div>

                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_61")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_62")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_63")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_64")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_65")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_66")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {documents.map((doc) => (
                                    <tr key={doc.id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <FileText size={18} color="var(--info)" />
                                                <strong>{doc.title}</strong>
                                            </div>
                                        </td>
                                        <td>{doc.type}</td>
                                        <td>
                                            <span className={`${styles.badge} ${styles.badgeVerified}`}>
                                                <CheckCircle2 size={12} style={{ display: 'inline', marginRight: '4px' }} />
                                                {doc.ocrStatus}
                                            </span>
                                        </td>
                                        <td>{doc.expiry}</td>
                                        <td><span className={`${styles.badge} ${styles.badgeActive}`}>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_67")}</span></td>
                                        <td>
                                            <button className={styles.btnSecondary} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={() => showToast(translateText("components.Clerio.PeopleCoreView","text_1ee270b569"),translateText("components.Clerio.PeopleCoreView","text_e15db7c501"), 'success')}>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_68")}</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Section 5: Audit Trail */}
            {activeSection === 'audit' && (
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h3><History size={20} color="var(--info)" />{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_69")}</h3>
                        <span style={{ fontSize: '0.85rem', color: 'var(--signal)', fontWeight: '600' }}>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_70")}</span>
                    </div>

                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_71")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_72")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_73")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_74")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_75")}</th>
                                    <th>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_76")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {auditLogs.map((log) => (
                                    <tr key={log.id}>
                                        <td><code>{log.id}</code></td>
                                        <td><strong>{log.field}</strong></td>
                                        <td style={{ color: 'var(--flag)' }}>{log.oldValue}</td>
                                        <td style={{ color: 'var(--signal)', fontWeight: '600' }}>{log.newValue}</td>
                                        <td>{log.changedBy}</td>
                                        <td style={{ color: 'var(--text-2)' }}>{log.timestamp}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Section: Legal Entities Master (SCR-001) */}
            {activeSection === 'entities' && (
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h3><Building2 size={20} color="#38bdf8" /> Legal Entity Master (SCR-001)</h3>
                        <div style={{ display: 'flex', gap: '0.65rem' }}>
                            <button className={styles.btnSecondary} onClick={exportEntitiesCSV}>
                                <Download size={15} /> Export Entities CSV
                            </button>
                            <button className={styles.btnPrimary} onClick={() => setIsEntityModalOpen(true)}>
                                <Plus size={16} /> Add Legal Entity
                            </button>
                        </div>
                    </div>

                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Entity Code</th>
                                    <th>Registered Name</th>
                                    <th>Entity Type</th>
                                    <th>CIN / LLPIN</th>
                                    <th>PAN</th>
                                    <th>TAN</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entitiesList.map((ent) => (
                                    <tr key={ent.entityCode}>
                                        <td><strong>{ent.entityCode}</strong></td>
                                        <td><strong>{ent.registeredName}</strong></td>
                                        <td>{ent.entityType}</td>
                                        <td><code>{ent.cinLlpin}</code></td>
                                        <td><code>{ent.entityPan}</code></td>
                                        <td><code>{ent.tan}</code></td>
                                        <td><span className={`${styles.badge} ${styles.badgeActive}`}>{ent.status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Section: Location / Work Site Master (SCR-002) */}
            {activeSection === 'locations' && (
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h3><MapPin size={20} color="#38bdf8" /> Location / Work Site Master (SCR-002)</h3>
                        <div style={{ display: 'flex', gap: '0.65rem' }}>
                            <button className={styles.btnSecondary} onClick={exportLocationsCSV}>
                                <Download size={15} /> Export Locations CSV
                            </button>
                            <button className={styles.btnPrimary} onClick={() => setIsLocationModalOpen(true)}>
                                <Plus size={16} /> Add Location Master
                            </button>
                        </div>
                    </div>

                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Location Code</th>
                                    <th>Location Name</th>
                                    <th>Legal Entity</th>
                                    <th>Type</th>
                                    <th>State</th>
                                    <th>Time Zone</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {locationsList.map((loc) => (
                                    <tr key={loc.locationCode}>
                                        <td><strong>{loc.locationCode}</strong></td>
                                        <td><strong>{loc.locationName}</strong></td>
                                        <td>{loc.entityCode}</td>
                                        <td>{loc.locationType}</td>
                                        <td>{loc.stateCode}</td>
                                        <td>{loc.timeZone}</td>
                                        <td><span className={`${styles.badge} ${styles.badgeActive}`}>{loc.status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Reassign Reporting Manager Modal */}
            {reassignTarget && (
                <Dialog open onClose={() => setReassignTarget(null)} aria-labelledby="reassign-manager-title" fullWidth maxWidth="sm">
                    <div
                        style={{
                            background: 'var(--card)',
                            border: '1px solid rgba(45, 212, 168, 0.3)',
                            borderRadius: '14px',
                            width: '100%',
                            maxWidth: '100%',
                            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.7)',
                            padding: '1.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1.25rem'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div>
                            <h3 id="reassign-manager-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)' }}>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_77")}</h3>
                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-2)' }}>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_78")}<strong>{reassignTarget.name}</strong>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_79")}{reassignTarget.role}{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_80")}</p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_81")}</label>
                            <select
                                aria-label={readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_81")}
                                value={selectedNewManager}
                                onChange={e => setSelectedNewManager(e.target.value)}
                                style={{
                                    background: 'var(--card-2)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    borderRadius: 8,
                                    padding: '0.65rem 0.85rem',
                                    color: 'var(--text)',
                                    fontSize: '0.84rem',
                                    outline: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="Executive Leadership">{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_82")}</option>
                                {directoryEmployees.map((employee) => <option key={employee.id} value={employee.name}>{employee.name}{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_83")}{employee.role}</option>)}
                            </select>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
                            <button
                                className={styles.btnSecondary}
                                onClick={() => setReassignTarget(null)}
                            >{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_84")}</button>
                            <button
                                className={styles.btnPrimary}
                                onClick={() => {
                                    setManagerOverrides((current) => ({ ...current, [reassignTarget.id]: selectedNewManager }));
                                    showToast(translateText("components.Clerio.PeopleCoreView","text_353f98aa9a"),translateText("components.Clerio.PeopleCoreView","text_2703bfa588", {value1: String(reassignTarget.name), value2: String(selectedNewManager)}), 'success');
                                    setReassignTarget(null);
                                }}
                            >{readData("components.Clerio.PeopleCoreView", "PeopleCoreView_text_85")}</button>
                        </div>
                    </div>
                </Dialog>
            )}

            {/* Modal Wizards & Dialogs */}
            <EmployeeCreationWizard
                isOpen={isWizardOpen}
                onClose={() => setIsWizardOpen(false)}
                onSave={async (newEmp) => {
                    setCustomEmployees(prev => [newEmp, ...prev]);
                    try {
                        const details = newEmp.details || {};
                        await fetch('/api/v1/people', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Idempotency-Key': crypto.randomUUID(),
                            },
                            body: JSON.stringify({
                                employeeCode: newEmp.id,
                                firstName: details.firstName || newEmp.name.split(' ')[0] || 'Employee',
                                lastName: details.lastName || newEmp.name.split(' ').slice(1).join(' ') || '-',
                                workEmail: details.officialEmail || details.personalEmail || `${newEmp.id.toLowerCase()}@nucleus.com`,
                                designation: newEmp.role || 'Associate',
                                department: newEmp.dept || 'General',
                                location: newEmp.location || 'Head Office',
                                joiningDate: details.joiningDate || new Date().toISOString().split('T')[0],
                                workerCategory: details.workerCategory || 'PERM',
                                hasRestDays: details.hasRestDays ?? true,
                                otEligibility: details.otEligibility || 'ALL_DAYS',
                                salaryLocationScope: details.salaryLocationScope || 'PLANT',
                                isTrainee: Boolean(details.isTrainee),
                                traineeType: details.traineeType || undefined,
                                assignedShift: details.assignedShift || 'GENERAL',
                                panNumber: details.panNumber || undefined,
                                aadhaarLast4: details.aadhaarNumber ? details.aadhaarNumber.slice(-4) : undefined,
                                uan: details.uan || undefined,
                                esicNumber: details.esicNumber || undefined,
                                bankAccountNo: details.accountToken || undefined,
                                bankIfsc: details.ifsc || undefined,
                                bankName: details.bankName || undefined,
                                emergencyContactName: details.emergencyName || undefined,
                                emergencyContactPhone: details.emergencyPhone || undefined,
                                emergencyContactRelation: details.emergencyRelation || undefined,
                                biometricEnrolId: details.biometricEnrolId || undefined,
                                accessCardNo: details.accessCardNo || undefined,
                                lockerNo: details.lockerNo || undefined,
                            }),
                        });
                        showToast('Database Synchronized', `Employee record persisted to Neon PostgreSQL.`, 'success');
                    } catch (e) {
                        console.warn('Individual employee database sync:', e);
                    }
                }}
                existingEmployees={directoryEmployees}
            />

            <BulkOnboardingModal
                isOpen={isBulkImportOpen}
                onClose={() => setIsBulkImportOpen(false)}
                onIngest={(batch) => setCustomEmployees(prev => [...batch, ...prev])}
            />

            <LegalEntityModal
                isOpen={isEntityModalOpen}
                onClose={() => setIsEntityModalOpen(false)}
                onSave={(ent) => setEntitiesList(prev => [ent, ...prev])}
                existingEntities={entitiesList}
            />

            <LocationMasterModal
                isOpen={isLocationModalOpen}
                onClose={() => setIsLocationModalOpen(false)}
                onSave={(loc) => setLocationsList(prev => [loc, ...prev])}
                existingLocations={locationsList}
            />
        </div>
    );
};

// ── Star Employees Panel (Demo Point #18) ──────────────────────────────────
function StarEmployeesPanel({ employees, recognitionAwards = [], grantRecognitionAward, showToast }) {
    const [nominee, setNominee] = React.useState('');
    const [category, setCategory] = React.useState('Star Employee of the Month');
    const [note, setNote] = React.useState('');
    const [month] = React.useState(new Date().toLocaleString('default', { month: 'long', year: 'numeric' }));

    const handleGrant = () => {
        if (!nominee) { showToast('Select Employee', 'Please select an employee to nominate.', 'error'); return; }
        const emp = employees.find(e => e.name === nominee || e.id === nominee);
        grantRecognitionAward && grantRecognitionAward({ employeeId: emp?.id, employeeName: emp?.name || nominee, award: category, period: month, note });
        showToast('🌟 Award Granted', `${emp?.name || nominee} recognized as ${category} for ${month}!`, 'success');
        setNominee(''); setNote('');
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Nomination Form */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: '1.25rem', borderTop: '3px solid #f59e0b' }}>
                <h3 style={{ margin: '0 0 1rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, fontSize: '1rem' }}>
                    ⭐ Nominate Star Employee — {month}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ color: 'var(--text-2)', fontSize: '0.8rem', fontWeight: 600 }}>Employee</span>
                        <select value={nominee} onChange={e => setNominee(e.target.value)}
                            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.83rem' }}>
                            <option value="">Select employee…</option>
                            {employees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.dept}</option>)}
                        </select>
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ color: 'var(--text-2)', fontSize: '0.8rem', fontWeight: 600 }}>Award Category</span>
                        <select value={category} onChange={e => setCategory(e.target.value)}
                            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.83rem' }}>
                            <option>Star Employee of the Month</option>
                            <option>Best Team Player</option>
                            <option>Innovation Award</option>
                            <option>Customer Champion</option>
                            <option>Leadership Excellence</option>
                            <option>Safety Champion</option>
                        </select>
                    </label>
                    <label style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ color: 'var(--text-2)', fontSize: '0.8rem', fontWeight: 600 }}>Citation / Note</span>
                        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                            placeholder="Brief description of achievement…"
                            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.83rem', resize: 'vertical' }} />
                    </label>
                </div>
                <button onClick={handleGrant}
                    style={{ marginTop: '0.75rem', padding: '8px 20px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
                    ⭐ Grant Award
                </button>
            </div>

            {/* Awards History */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: '1.25rem' }}>
                <h3 style={{ margin: '0 0 1rem', color: 'var(--text)', fontSize: '1rem' }}>Recognition History</h3>
                {(recognitionAwards || []).length === 0 ? (
                    <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: '2rem' }}>No awards granted yet.</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {[...(recognitionAwards || [])].reverse().map((award, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--line-soft)' }}>
                                <span style={{ fontSize: '1.4rem' }}>⭐</span>
                                <div>
                                    <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.87rem' }}>{award.employeeName || award.employee_name}</div>
                                    <div style={{ color: 'var(--text-2)', fontSize: '0.75rem' }}>{award.award} · {award.period || award.date}</div>
                                    {award.note && <div style={{ color: 'var(--text-3)', fontSize: '0.73rem', marginTop: 2 }}>{award.note}</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Approved Manpower Panel (Demo Point #25) ────────────────────────────────
function ApprovedManpowerPanel({ employees, positions, sanctionedQuotas, calculateDepartmentCapacity }) {
    const depts = [...new Set([
        ...(employees || []).map(e => e.dept),
        ...Object.keys(sanctionedQuotas || {}),
    ])].filter(Boolean);

    return (
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: '1.25rem' }}>
            <h3 style={{ margin: '0 0 1rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, fontSize: '1rem' }}>
                <span>👥</span> Approved Manpower vs Actual Headcount
            </h3>
            <p style={{ color: 'var(--text-2)', fontSize: '0.8rem', margin: '0 0 1rem' }}>
                Sanctioned quotas define approved headcount per department. Variance shows open/excess positions.
            </p>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                    <thead>
                        <tr style={{ background: 'var(--surface)' }}>
                            {['Department', 'Sanctioned', 'Actual', 'Open Positions', 'Variance', 'Status'].map(h => (
                                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-2)', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {depts.map(dept => {
                            const sanctioned = (sanctionedQuotas && sanctionedQuotas[dept]) ? sanctionedQuotas[dept] : 10;
                            const actual = (employees || []).filter(e => e.dept === dept && e.status !== 'Inactive').length;
                            const openPositions = (positions || []).filter(p => p.dept === dept && p.status === 'Open').length;
                            const variance = actual - sanctioned;
                            const capacity = calculateDepartmentCapacity ? calculateDepartmentCapacity(dept, actual, sanctioned) : {};
                            const isOver = variance > 0;
                            const isUnder = actual < sanctioned * 0.8;
                            return (
                                <tr key={dept} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                                    <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text)' }}>{dept}</td>
                                    <td style={{ padding: '10px 12px', color: 'var(--text)' }}>{sanctioned}</td>
                                    <td style={{ padding: '10px 12px', color: 'var(--text)' }}>{actual}</td>
                                    <td style={{ padding: '10px 12px', color: '#6366f1' }}>{openPositions}</td>
                                    <td style={{ padding: '10px 12px', color: isOver ? '#dc2626' : isUnder ? '#d97706' : '#059669', fontWeight: 700 }}>
                                        {variance > 0 ? `+${variance}` : variance}
                                    </td>
                                    <td style={{ padding: '10px 12px' }}>
                                        <span style={{
                                            background: isOver ? 'rgba(220,38,38,0.12)' : isUnder ? 'rgba(217,119,6,0.12)' : 'rgba(5,150,105,0.12)',
                                            color: isOver ? '#dc2626' : isUnder ? '#d97706' : '#059669',
                                            borderRadius: 99, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700
                                        }}>
                                            {isOver ? 'Over-strength' : isUnder ? 'Under-staffed' : 'On Target'}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default PeopleCoreView;
