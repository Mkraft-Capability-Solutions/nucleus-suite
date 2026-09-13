"use client";
import { readData } from '../../../services/workspace-data.mjs';

import React, { useState } from 'react';
import {
    CheckCircle2, XCircle, CornerUpRight, X, AlertCircle, User, Clock, ArrowRight
} from 'lucide-react';
import styles from './ApprovalActionModal.module.css';

const REROUTE_TARGETS = readData("components.Dashboard.Modals.ApprovalActionModal", "REROUTE_TARGETS_1");

function ApprovalActionForm({
    isOpen,
    onClose,
    item,
    initialAction = readData("components.Dashboard.Modals.ApprovalActionModal", "defaultValue_1"),
    onSubmit
}) {
    const [actionType, setActionType] = useState(initialAction);
    const [remarks, setRemarks] = useState('');
    const [rerouteTarget, setRerouteTarget] = useState('');
    const [error, setError] = useState('');

    if (!isOpen || !item) return null;

    const handleTabSwitch = (type) => {
        setActionType(type);
        setError('');
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        // 1. APPROVE: Remarks is OPTIONAL
        if (actionType === 'approve') {
            onSubmit({
                id: item.id,
                ...readData("components.Dashboard.Modals.ApprovalActionModal", "handleSubmit_fields_2"),
                remarks: remarks.trim(),
                item
            });
            onClose();
            return;
        }

        // 2. REJECT: Remarks is COMPULSORY
        if (actionType === 'reject') {
            if (!remarks.trim()) {
                setError('Rejection remark is compulsory. Please enter a valid reason for declining this request.');
                return;
            }
            onSubmit({
                id: item.id,
                ...readData("components.Dashboard.Modals.ApprovalActionModal", "handleSubmit_fields_3"),
                remarks: remarks.trim(),
                item
            });
            onClose();
            return;
        }

        // 3. RE-ROUTE: Both Target and Remarks are COMPULSORY
        if (actionType === 'reroute') {
            if (!rerouteTarget) {
                setError('Re-route target is compulsory. Please select a designated approver from the list.');
                return;
            }
            if (!remarks.trim()) {
                setError('Re-route handover remark is compulsory. Please provide context for the new approver.');
                return;
            }

            const targetObj = REROUTE_TARGETS.find(t => t.id === rerouteTarget);
            onSubmit({
                id: item.id,
                ...readData("components.Dashboard.Modals.ApprovalActionModal", "handleSubmit_fields_4"),
                remarks: remarks.trim(),
                rerouteTarget,
                rerouteTargetName: targetObj ? `${targetObj.name} (${targetObj.role})` : rerouteTarget,
                item
            });
            onClose();
            return;
        }
    };

    const getHeaderConfig = () => {
        switch (actionType) {
            case 'reject':
                return {
                    icon: <XCircle size={20} />,
                    iconClass: styles.iconReject,
                    ...readData("components.Dashboard.Modals.ApprovalActionModal", "getHeaderConfig_fields_5")
                };
            case 'reroute':
                return {
                    icon: <CornerUpRight size={20} />,
                    iconClass: styles.iconReroute,
                    ...readData("components.Dashboard.Modals.ApprovalActionModal", "getHeaderConfig_fields_6")
                };
            case 'approve':
            default:
                return {
                    icon: <CheckCircle2 size={20} />,
                    iconClass: styles.iconApprove,
                    ...readData("components.Dashboard.Modals.ApprovalActionModal", "getHeaderConfig_fields_7")
                };
        }
    };

    const header = getHeaderConfig();

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className={styles.header}>
                    <div className={styles.headerLeft}>
                        <div className={`${styles.headerIconSquircle} ${header.iconClass}`}>
                            {header.icon}
                        </div>
                        <div>
                            <h3 className={styles.headerTitle}>{header.title}</h3>
                            <div className={styles.headerSubtitle}>{header.subtitle}</div>
                        </div>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose} title={readData("components.Dashboard.Modals.ApprovalActionModal", "content_title_8")}>
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className={styles.body}>
                    {/* Action Segmented Switcher */}
                    <div className={styles.actionTabs}>
                        <button
                            type="button"
                            className={`${styles.actionTabBtn} ${actionType === 'approve' ? styles.tabActiveApprove : ''}`}
                            onClick={() => handleTabSwitch('approve')}
                        >
                            <CheckCircle2 size={14} />{readData("components.Dashboard.Modals.ApprovalActionModal", "content_text_9")}</button>
                        <button
                            type="button"
                            className={`${styles.actionTabBtn} ${actionType === 'reject' ? styles.tabActiveReject : ''}`}
                            onClick={() => handleTabSwitch('reject')}
                        >
                            <XCircle size={14} />{readData("components.Dashboard.Modals.ApprovalActionModal", "content_text_10")}</button>
                        <button
                            type="button"
                            className={`${styles.actionTabBtn} ${actionType === 'reroute' ? styles.tabActiveReroute : ''}`}
                            onClick={() => handleTabSwitch('reroute')}
                        >
                            <CornerUpRight size={14} />{readData("components.Dashboard.Modals.ApprovalActionModal", "content_text_11")}</button>
                    </div>

                    {/* Request Summary Card */}
                    <div className={styles.summaryCard}>
                        <div className={styles.summaryLeft}>
                            <span className={styles.summaryName}>{item.name}</span>
                            <span className={styles.summaryType}>{item.type}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <span style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                padding: '0.2rem 0.55rem',
                                borderRadius: '4px',
                                background: item.isBreach || item.isSLA ? 'rgba(244, 63, 94, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                                color: item.isBreach || item.isSLA ? '#F43F5E' : '#94A3B8',
                                border: item.isBreach || item.isSLA ? '1px solid rgba(244, 63, 94, 0.3)' : '1px solid rgba(148, 163, 184, 0.25)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem'
                            }}>
                                <Clock size={11} /> {item.age} {item.isBreach || item.isSLA ? readData("components.Dashboard.Modals.ApprovalActionModal", "display_2") : ''}
                            </span>
                        </div>
                    </div>

                    {/* If Re-route: Compulsory Destination Selector */}
                    {actionType === 'reroute' && (
                        <div className={styles.formGroup}>
                            <div className={styles.formLabelRow}>
                                <label className={styles.formLabel}>{readData("components.Dashboard.Modals.ApprovalActionModal", "content_text_12")}</label>
                                <span className={styles.badgeCompulsoryReroute}>{readData("components.Dashboard.Modals.ApprovalActionModal", "content_text_13")}</span>
                            </div>
                            <select
                                className={`${styles.selectInput} ${error && !rerouteTarget ? styles.inputError : ''}`}
                                value={rerouteTarget}
                                onChange={(e) => {
                                    setRerouteTarget(e.target.value);
                                    if (error) setError('');
                                }}
                            >
                                <option value="">{readData("components.Dashboard.Modals.ApprovalActionModal", "content_text_14")}</option>
                                {REROUTE_TARGETS.map(t => (
                                    <option key={t.id} value={t.id}>
                                        {t.name}{readData("components.Dashboard.Modals.ApprovalActionModal", "content_text_15")}{t.role}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Remarks Input */}
                    <div className={styles.formGroup}>
                        <div className={styles.formLabelRow}>
                            <label className={styles.formLabel}>
                                {actionType === 'approve' && readData("components.Dashboard.Modals.ApprovalActionModal", "fallback_1")}
                                {actionType === 'reject' && readData("components.Dashboard.Modals.ApprovalActionModal", "fallback_2")}
                                {actionType === 'reroute' && readData("components.Dashboard.Modals.ApprovalActionModal", "fallback_3")}
                            </label>
                            {actionType === 'approve' && (
                                <span className={styles.badgeOptional}>{readData("components.Dashboard.Modals.ApprovalActionModal", "content_text_16")}</span>
                            )}
                            {actionType === 'reject' && (
                                <span className={styles.badgeCompulsory}>{readData("components.Dashboard.Modals.ApprovalActionModal", "content_text_17")}</span>
                            )}
                            {actionType === 'reroute' && (
                                <span className={styles.badgeCompulsoryReroute}>{readData("components.Dashboard.Modals.ApprovalActionModal", "content_text_18")}</span>
                            )}
                        </div>
                        <textarea
                            className={`${styles.textareaInput} ${error && !remarks.trim() && actionType !== 'approve' ? styles.inputError : ''}`}
                            rows={3}
                            placeholder={
                                actionType === 'approve'
                                    ? readData("components.Dashboard.Modals.ApprovalActionModal", "display_3")
                                    : actionType === 'reject'
                                        ? readData("components.Dashboard.Modals.ApprovalActionModal", "display_4")
                                        : readData("components.Dashboard.Modals.ApprovalActionModal", "display_5")
                            }
                            value={remarks}
                            onChange={(e) => {
                                setRemarks(e.target.value);
                                if (error) setError('');
                            }}
                        />
                    </div>

                    {/* Error Banner if validation fails */}
                    {error && (
                        <div className={styles.errorBanner}>
                            <AlertCircle size={15} style={{ flexShrink: 0 }} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Footer */}
                    <div className={styles.footer} style={{ margin: '0 -1.5rem -1.35rem', padding: '1rem 1.5rem' }}>
                        <button type="button" className={styles.cancelBtn} onClick={onClose}>{readData("components.Dashboard.Modals.ApprovalActionModal", "content_text_19")}</button>
                        {actionType === 'approve' && (
                            <button type="submit" className={styles.submitBtnApprove}>
                                <CheckCircle2 size={14} />{readData("components.Dashboard.Modals.ApprovalActionModal", "content_text_20")}</button>
                        )}
                        {actionType === 'reject' && (
                            <button type="submit" className={styles.submitBtnReject}>
                                <XCircle size={14} />{readData("components.Dashboard.Modals.ApprovalActionModal", "content_text_21")}</button>
                        )}
                        {actionType === 'reroute' && (
                            <button type="submit" className={styles.submitBtnReroute}>
                                <CornerUpRight size={14} />{readData("components.Dashboard.Modals.ApprovalActionModal", "content_text_22")}</button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function ApprovalActionModal(props) {
    if (!props.isOpen || !props.item) return null;
    return <ApprovalActionForm key={`${props.item.id}:${props.initialAction || readData("components.Dashboard.Modals.ApprovalActionModal", "fallback_4")}`} {...props} />;
}
