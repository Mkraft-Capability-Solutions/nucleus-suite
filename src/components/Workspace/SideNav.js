"use client";
import { readData } from '../../services/workspace-data.mjs';

import React from 'react';
import { operationalIcon } from '@/lib/workspace-navigation';
import LayoutGrid from '@mui/icons-material/DashboardOutlined';
import Users from '@mui/icons-material/GroupsOutlined';
import Briefcase from '@mui/icons-material/WorkOutline';
import Clock from '@mui/icons-material/AccessTime';
import Calendar from '@mui/icons-material/CalendarMonthOutlined';
import CreditCard from '@mui/icons-material/PaymentsOutlined';
import TrendingUp from '@mui/icons-material/TrendingUp';
import UserPlus from '@mui/icons-material/PersonAddAltOutlined';
import Workflow from '@mui/icons-material/AccountTreeOutlined';
import LineChart from '@mui/icons-material/ShowChart';
import GraduationCap from '@mui/icons-material/SchoolOutlined';
import Coins from '@mui/icons-material/SavingsOutlined';
import Sparkles from '@mui/icons-material/AutoAwesomeOutlined';
import Puzzle from '@mui/icons-material/ExtensionOutlined';
import Settings from '@mui/icons-material/SettingsOutlined';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import Fingerprint from '@mui/icons-material/Fingerprint';
import CheckCircle2 from '@mui/icons-material/CheckCircleOutline';
import XCircle from '@mui/icons-material/CancelOutlined';
import HelpCircle from '@mui/icons-material/HelpOutline';
import ShieldCheck from '@mui/icons-material/VerifiedUserOutlined';
import Building2 from '@mui/icons-material/BusinessOutlined';
import styles from './SideNav.module.css';
import { useHRMS } from '@/context/HRMSContext';
import { getOperationalModule, getOperationalNavigationGroups } from '@/lib/operational-module-registry';

const PRIMARY_PILLARS = readData("components.Workspace.SideNav", "PRIMARY_PILLARS_1");

const SideNav = ({ activeTab, onTabChange, isCollapsed, onToggleCollapse, selectedPillar }) => {
    const { attendance, punchIn, punchOut } = useHRMS();

    const navSections = [
        {
            ...readData("components.Workspace.SideNav", "navSections_fields_2"),
            items: [
                { ...readData("components.Workspace.SideNav", "items_fields_3"), icon: LayoutGrid },
                { ...readData("components.Workspace.SideNav", "items_fields_4"), icon: Briefcase, ...readData("components.Workspace.SideNav", "items_fields_5") },
                { ...readData("components.Workspace.SideNav", "items_fields_6"), icon: Users },
                { ...readData("components.Workspace.SideNav", "items_fields_7"), icon: HelpCircle, ...readData("components.Workspace.SideNav", "items_fields_8") }
            ]
        },
        {
            ...readData("components.Workspace.SideNav", "navSections_fields_9"),
            items: [
                { ...readData("components.Workspace.SideNav", "items_fields_10"), icon: Users, ...readData("components.Workspace.SideNav", "items_fields_11") },
                { ...readData("components.Workspace.SideNav", "items_fields_12"), icon: Clock, ...readData("components.Workspace.SideNav", "items_fields_13") },
                { ...readData("components.Workspace.SideNav", "items_fields_14"), icon: Calendar },
                { ...readData("components.Workspace.SideNav", "items_fields_15"), icon: Workflow, ...readData("components.Workspace.SideNav", "items_fields_16") },
                { ...readData("components.Workspace.SideNav", "items_fields_17"), icon: ShieldCheck, ...readData("components.Workspace.SideNav", "items_fields_18") },
                { ...readData("components.Workspace.SideNav", "items_fields_19"), icon: Building2, ...readData("components.Workspace.SideNav", "items_fields_20") }
            ]
        },
        {
            ...readData("components.Workspace.SideNav", "navSections_fields_21"),
            items: [
                { ...readData("components.Workspace.SideNav", "items_fields_22"), icon: UserPlus, ...readData("components.Workspace.SideNav", "items_fields_23") },
                { ...readData("components.Workspace.SideNav", "items_fields_24"), icon: TrendingUp, ...readData("components.Workspace.SideNav", "items_fields_25") },
                { ...readData("components.Workspace.SideNav", "items_fields_26"), icon: GraduationCap, ...readData("components.Workspace.SideNav", "items_fields_27") }
            ]
        },
        {
            ...readData("components.Workspace.SideNav", "navSections_fields_28"),
            items: [
                { ...readData("components.Workspace.SideNav", "items_fields_29"), icon: CreditCard, ...readData("components.Workspace.SideNav", "items_fields_30") },
                { ...readData("components.Workspace.SideNav", "items_fields_31"), icon: Coins, ...readData("components.Workspace.SideNav", "items_fields_32") }
            ]
        },
        {
            ...readData("components.Workspace.SideNav", "navSections_fields_33"),
            items: [
                { ...readData("components.Workspace.SideNav", "items_fields_34"), icon: LineChart, ...readData("components.Workspace.SideNav", "items_fields_35") },
                { ...readData("components.Workspace.SideNav", "items_fields_36"), icon: Sparkles, ...readData("components.Workspace.SideNav", "items_fields_37") },
                { ...readData("components.Workspace.SideNav", "items_fields_38"), icon: Puzzle, ...readData("components.Workspace.SideNav", "items_fields_39") },
                { ...readData("components.Workspace.SideNav", "items_fields_40"), icon: Settings }
            ]
        },
        ...getOperationalNavigationGroups().map((group) => ({
            id: `operations_${group.primary}`,
            title: group.title,
            pillar: PRIMARY_PILLARS[group.primary] || readData("components.Workspace.SideNav", "fallback_1"),
            items: group.ids.map((id) => {
                const navigationModule = getOperationalModule(id);
                return { id, label: navigationModule.title, icon: operationalIcon(id), badge: navigationModule.screenId, ...readData("components.Workspace.SideNav", "items_fields_41") };
            })
        }))
    ];

    // Filter sections if a specific pillar is chosen in the header
    const displayedSections = (!selectedPillar || selectedPillar === 'all')
        ? navSections
        : navSections.filter(sec => sec.pillar === 'all' || sec.pillar === selectedPillar);

    return (
        <aside
            className={`${styles.sideNav} ${isCollapsed ? styles.collapsed : ''}`}
            role="navigation"
            aria-label={readData("components.Workspace.SideNav", "SideNav_aria-label_42")}
        >
            <div className={styles.scrollArea}>
                {displayedSections.map((sec) => (
                    <div key={sec.id} className={styles.group}>
                        <div className={styles.groupTitle}>{sec.title}</div>
                        {sec.items.map((item) => {
                            const Icon = item.icon;
                            const isActive = activeTab === item.id;
                            return (
                                <button
                                    key={item.id}
                                    className={`${styles.navItem} ${item.isSubmodule ? styles.submoduleItem : ''} ${isActive ? styles.active : ''}`}
                                    onClick={() => onTabChange(item.id)}
                                    aria-current={isActive ? readData("components.Workspace.SideNav", "display_1") : undefined}
                                    title={item.label}
                                >
                                    <div className={styles.iconWrapper}>
                                        <Icon sx={{ fontSize: 18 }} strokeWidth={isActive ? readData("components.Workspace.SideNav", "display_2") : readData("components.Workspace.SideNav", "display_3")} />
                                    </div>
                                    <span className={styles.label}>{item.label}</span>
                                    {item.badge && (
                                        <span className={`${styles.badge} ${item.badge.includes('AI') ? styles.badgeAI : ''}`}>
                                            {item.badge}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                ))}
            </div>

            {/* Sidebar Footer: Quick Attendance Punch & Collapse Toggle */}
            <div className={styles.footerArea}>
                <div className={styles.quickPunchCard}>
                    {!isCollapsed ? (
                        <>
                            <div className={styles.punchRow}>
                                <span style={{ fontWeight: '700', color: '#0f172a' }}>{readData("components.Workspace.SideNav", "SideNav_text_43")}</span>
                                <span style={{ color: attendance.status === 'present' ? '#16a34a' : '#64748b', fontWeight: '700' }}>
                                    {attendance.status === 'present' ? readData("components.Workspace.SideNav", "display_4") : readData("components.Workspace.SideNav", "display_5")}
                                </span>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{readData("components.Workspace.SideNav", "SideNav_text_44")}<strong>{attendance.totalHours}</strong>
                            </div>
                            {attendance.status === 'present' ? (
                                <button
                                    className={`${styles.punchBtn} ${styles.punchOut}`}
                                    onClick={punchOut}
                                    title={readData("components.Workspace.SideNav", "SideNav_title_45")}
                                >
                                    <XCircle sx={{ fontSize: 14 }} />{readData("components.Workspace.SideNav", "SideNav_text_46")}</button>
                            ) : (
                                <button
                                    className={styles.punchBtn}
                                    onClick={punchIn}
                                    title={readData("components.Workspace.SideNav", "SideNav_title_47")}
                                >
                                    <CheckCircle2 sx={{ fontSize: 14 }} />{readData("components.Workspace.SideNav", "SideNav_text_48")}</button>
                            )}
                        </>
                    ) : (
                        <button
                            className={styles.punchBtn}
                            style={{ padding: '0.5rem', background: attendance.status === 'present' ? '#16a34a' : '#2563eb' }}
                            onClick={attendance.status === 'present' ? punchOut : punchIn}
                            title={attendance.status === 'present' ? readData("components.Workspace.SideNav", "display_6") : readData("components.Workspace.SideNav", "display_7")}
                        >
                            <Fingerprint sx={{ fontSize: 18 }} />
                        </button>
                    )}
                </div>

                {/* Collapse / Expand Toggle Button */}
                <button
                    className={styles.toggleCollapseBtn}
                    onClick={onToggleCollapse}
                    title={isCollapsed ? readData("components.Workspace.SideNav", "display_8") : readData("components.Workspace.SideNav", "display_9")}
                    aria-label={isCollapsed ? readData("components.Workspace.SideNav", "display_10") : readData("components.Workspace.SideNav", "display_11")}
                >
                    {isCollapsed ? <ChevronRight sx={{ fontSize: 16 }} /> : <><ChevronLeft sx={{ fontSize: 16 }} />{readData("components.Workspace.SideNav", "SideNav_text_49")}</>}
                </button>
            </div>
        </aside>
    );
};

export default SideNav;
