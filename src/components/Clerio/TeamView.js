"use client";
import {useTranslation} from '@/context/I18nContext';

import NextImage from 'next/image';

import { readData } from '../../services/workspace-data.mjs';

import React, { useState } from 'react';
import {
    Users, Search, Plus, MessageSquare, Mail, Calendar,
    Phone, MapPin, Clock, Briefcase, Sparkles, Filter,
    CheckCircle2, Shield, Laptop
} from 'lucide-react';
import styles from './TeamView.module.css';
import { useHRMS } from '@/context/HRMSContext';
import { launchAction } from '@/lib/action-launcher';

const TeamView = ({ onNavigate, onSelectConsole }) => {
    const {t: translateText}=useTranslation();

    const { teamMembers = [], showToast } = useHRMS();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPod, setSelectedPod] = useState(readData("components.Clerio.TeamView", "initialState_1"));

    const pods = readData("components.Clerio.TeamView", "pods_1");

    const filteredMembers = teamMembers.filter((m) => {
        const matchesSearch =
            !searchQuery ||
            m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            m.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
            m.dept.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (m.skills && m.skills.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase())));

        const matchesPod = selectedPod === 'all' || m.dept === selectedPod || m.pod.includes(selectedPod);
        return matchesSearch && matchesPod;
    });

    const onlineCount = teamMembers.filter((m) => m.status === 'online').length;
    const busyCount = teamMembers.filter((m) => m.status === 'busy').length;
    const awayCount = teamMembers.filter((m) => m.status === 'away').length;

    const handleAction = (type, memberName) => {
        if (type === 'chat') {
            showToast(translateText("components.Clerio.TeamView","text_836ed69b38"),translateText("components.Clerio.TeamView","text_1d0b1b8233", {value1: String(memberName)}), 'info');
        } else if (type === 'mail') {
            showToast(translateText("components.Clerio.TeamView","text_a756b7b111"),translateText("components.Clerio.TeamView","text_b5d07b5c53", {value1: String(memberName)}), 'info');
        } else if (type === 'sync') {
            launchAction('oneOnOne', { participant: memberName });
        }
    };

    return (
        <div className={styles.teamContainer}>
            {/* Header Row */}
            <div className={styles.headerRow}>
                <div className={styles.titleBlock}>
                    <h2>{readData("components.Clerio.TeamView", "TeamView_text_2")}</h2>
                    <p>{readData("components.Clerio.TeamView", "TeamView_text_3")}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {(onNavigate || onSelectConsole) && (
                        <button
                            className={styles.btnPrimary}
                            onClick={() => {
                                if (onSelectConsole) onSelectConsole('S7');
                                if (onNavigate) onNavigate('dashboard', 'dashboard', 's7');
                            }}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.45rem',
                                border: '1px solid rgba(45, 212, 168, 0.4)',
                                background: 'rgba(45, 212, 168, 0.12)',
                                color: '#2DD4A8',
                                fontWeight: 700
                            }}
                            title={readData("components.Clerio.TeamView", "TeamView_title_4")}
                        >
                            <Sparkles size={15} />{readData("components.Clerio.TeamView", "TeamView_text_5")}</button>
                    )}
                    <button
                        className={styles.btnPrimary}
                        onClick={() => launchAction('invite')}
                    >
                        <Plus size={18} />{readData("components.Clerio.TeamView", "TeamView_text_6")}</button>
                </div>
            </div>

            {/* Top Stats Cards */}
            <div className={styles.statsRow}>
                <div className={styles.statCard}>
                    <div className={styles.statIconWrap} style={{ background: '#eff6ff', color: '#2563eb' }}>
                        <Users size={22} />
                    </div>
                    <div className={styles.statMeta}>
                        <span className={styles.statValue}>{teamMembers.length}</span>
                        <span className={styles.statLabel}>{readData("components.Clerio.TeamView", "TeamView_text_7")}</span>
                    </div>
                </div>

                <div className={styles.statCard}>
                    <div className={styles.statIconWrap} style={{ background: '#f0fdf4', color: '#16a34a' }}>
                        <CheckCircle2 size={22} />
                    </div>
                    <div className={styles.statMeta}>
                        <span className={styles.statValue}>{onlineCount}</span>
                        <span className={styles.statLabel}>{readData("components.Clerio.TeamView", "TeamView_text_8")}</span>
                    </div>
                </div>

                <div className={styles.statCard}>
                    <div className={styles.statIconWrap} style={{ background: '#fef2f2', color: '#ef4444' }}>
                        <Clock size={22} />
                    </div>
                    <div className={styles.statMeta}>
                        <span className={styles.statValue}>{busyCount}</span>
                        <span className={styles.statLabel}>{readData("components.Clerio.TeamView", "TeamView_text_9")}</span>
                    </div>
                </div>

                <div className={styles.statCard}>
                    <div className={styles.statIconWrap} style={{ background: '#fffbeb', color: '#d97706' }}>
                        <Laptop size={22} />
                    </div>
                    <div className={styles.statMeta}>
                        <span className={styles.statValue}>{awayCount}</span>
                        <span className={styles.statLabel}>{readData("components.Clerio.TeamView", "TeamView_text_10")}</span>
                    </div>
                </div>
            </div>

            {/* Search & Pod Filter Bar */}
            <div className={styles.filterBar}>
                <div className={styles.searchBox}>
                    <Search size={16} color="#64748b" />
                    <input
                        type="text"
                        placeholder={readData("components.Clerio.TeamView", "TeamView_placeholder_11")}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className={styles.podPills}>
                    {pods.map((p) => (
                        <button
                            key={p.id}
                            className={`${styles.podPill} ${selectedPod === p.id ? styles.activePod : ''}`}
                            onClick={() => setSelectedPod(p.id)}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Team Grid */}
            <div className={styles.teamGrid}>
                {filteredMembers.map((member) => (
                    <div key={member.id} className={styles.teamCard}>
                        <div className={styles.cardTop}>
                            <div className={styles.avatarWrapper}>
                                <NextImage unoptimized width={48} height={48}
                                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=${member.bg || readData("components.Clerio.TeamView", "fallback_1")}&color=fff`}
                                    className={styles.avatar}
                                    alt={member.name}
                                />
                                <div
                                    className={`${styles.statusDot} ${
                                        member.status === 'online'
                                            ? styles.statusOnline
                                            : member.status === 'busy'
                                            ? styles.statusBusy
                                            : styles.statusAway
                                    }`}
                                    title={translateText("components.Clerio.TeamView","text_f112abedd7", {value1: String(member.status)})}
                                />
                            </div>
                            <div className={styles.memberHeaderInfo}>
                                <h3 className={styles.memberName}>{member.name}</h3>
                                <div className={styles.memberRole}>{member.role}</div>
                                <span className={styles.podBadge}>{member.pod || member.dept}</span>
                            </div>
                        </div>

                        {/* Location, Shift & Reporting */}
                        <div className={styles.memberDetails}>
                            <div className={styles.detailRow}>
                                <MapPin size={14} color="#64748b" />
                                <span>{member.location}</span>
                            </div>
                            <div className={styles.detailRow}>
                                <Clock size={14} color="#64748b" />
                                <span>{member.shift || readData("components.Clerio.TeamView", "fallback_2")}</span>
                            </div>
                            <div className={styles.detailRow}>
                                <Mail size={14} color="#64748b" />
                                <span>{member.email}</span>
                            </div>
                        </div>

                        {/* Skills */}
                        {member.skills && member.skills.length > 0 && (
                            <div className={styles.skillsRow}>
                                {member.skills.map((skill, idx) => (
                                    <span key={idx} className={styles.skillPill}>
                                        {skill}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Contact Action Buttons */}
                        <div className={styles.contactRow}>
                            <button
                                className={`${styles.contactBtn} ${styles.contactBtnPrimary}`}
                                onClick={() => handleAction('chat', member.name)}
                                title={readData("components.Clerio.TeamView", "TeamView_title_12")}
                            >
                                <MessageSquare size={14} />{readData("components.Clerio.TeamView", "TeamView_text_13")}</button>
                            <button
                                className={styles.contactBtn}
                                onClick={() => handleAction('mail', member.name)}
                                title={readData("components.Clerio.TeamView", "TeamView_title_14")}
                            >
                                <Mail size={14} />{readData("components.Clerio.TeamView", "TeamView_text_15")}</button>
                            <button
                                className={styles.contactBtn}
                                onClick={() => handleAction('sync', member.name)}
                                title={readData("components.Clerio.TeamView", "TeamView_title_16")}
                            >
                                <Calendar size={14} />{readData("components.Clerio.TeamView", "TeamView_text_17")}</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TeamView;
