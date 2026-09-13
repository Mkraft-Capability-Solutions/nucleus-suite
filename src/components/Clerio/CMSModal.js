"use client";
import { readData } from '../../services/workspace-data.mjs';

import React, { useState } from 'react';
import {
    X, Megaphone, FileText, Pin, Trash2, Plus,
    CheckCircle2, UploadCloud, Download, Sparkles, Shield,
    FolderKanban, Eye
} from 'lucide-react';
import styles from './CMSModal.module.css';
import { useHRMS } from '@/context/HRMSContext';

const CMSModal = ({ isOpen, onClose }) => {
    const {
        announcements = [],
        addAnnouncement,
        togglePinAnnouncement,
        deleteAnnouncement,
        policyDocuments = [],
        addPolicyDocument,
        showToast
    } = useHRMS();

    const [activeTab, setActiveTab] = useState(readData("components.Clerio.CMSModal", "initialState_1")); // 'announcements' | 'policies'

    // Form state for Announcements
    const [annTitle, setAnnTitle] = useState('');
    const [annCategory, setAnnCategory] = useState(readData("components.Clerio.CMSModal", "initialState_2"));
    const [annAudience, setAnnAudience] = useState(readData("components.Clerio.CMSModal", "initialState_3"));
    const [annContent, setAnnContent] = useState('');
    const [annPinned, setAnnPinned] = useState(false);

    // Form state for Policies
    const [polTitle, setPolTitle] = useState('');
    const [polCategory, setPolCategory] = useState(readData("components.Clerio.CMSModal", "initialState_4"));
    const [polVersion, setPolVersion] = useState(readData("components.Clerio.CMSModal", "initialState_5"));
    const [polDept, setPolDept] = useState(readData("components.Clerio.CMSModal", "initialState_6"));
    const [uploadedFile, setUploadedFile] = useState(null);
    const uploadedFileName = uploadedFile?.name || '';

    if (!isOpen) return null;

    const handlePublishAnnouncement = (e) => {
        e.preventDefault();
        if (!annTitle.trim() || !annContent.trim()) {
            showToast('Missing Fields', 'Please enter a title and description for the notice.', 'warning');
            return;
        }

        addAnnouncement({
            title: annTitle.trim(),
            content: annContent.trim(),
            category: annCategory,
            audience: annAudience,
            pinned: annPinned,
            ...readData("components.Clerio.CMSModal", "handlePublishAnnouncement_fields_1")
        });

        // Reset form
        setAnnTitle('');
        setAnnContent('');
        setAnnPinned(false);
    };

    const handleUploadPolicy = (e) => {
        e.preventDefault();
        if (!polTitle.trim()) {
            showToast('Title Required', 'Please enter a name for the policy document.', 'warning');
            return;
        }

        if (!uploadedFile) {
            showToast('File Required', 'Select a PDF before adding the policy.', 'warning');
            return;
        }
        addPolicyDocument({
            title: polTitle.trim(),
            category: polCategory,
            version: polVersion || readData("components.Clerio.CMSModal", "fallback_1"),
            department: polDept,
            fileSize: `${(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB`,
            fileName: uploadedFile.name
        });

        // Reset form
        setPolTitle('');
        setUploadedFile(null);
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                {/* Modal Header */}
                <div className={styles.header}>
                    <div className={styles.headerTitle}>
                        <div className={styles.headerIcon}>
                            <Megaphone size={20} />
                        </div>
                        <div>
                            <h3>{readData("components.Clerio.CMSModal", "CMSModal_text_2")}</h3>
                            <p>{readData("components.Clerio.CMSModal", "CMSModal_text_3")}</p>
                        </div>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose} title={readData("components.Clerio.CMSModal", "CMSModal_title_4")}>
                        <X size={20} />
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className={styles.tabBar}>
                    <button
                        className={`${styles.tabBtn} ${activeTab === 'announcements' ? styles.active : ''}`}
                        onClick={() => setActiveTab('announcements')}
                    >
                        <Megaphone size={16} />{readData("components.Clerio.CMSModal", "CMSModal_text_5")}{announcements.length}{readData("components.Clerio.CMSModal", "CMSModal_text_6")}</button>
                    <button
                        className={`${styles.tabBtn} ${activeTab === 'policies' ? styles.active : ''}`}
                        onClick={() => setActiveTab('policies')}
                    >
                        <FileText size={16} />{readData("components.Clerio.CMSModal", "CMSModal_text_7")}{policyDocuments.length}{readData("components.Clerio.CMSModal", "CMSModal_text_8")}</button>
                </div>

                {/* Content Body */}
                <div className={styles.contentBody}>
                    {activeTab === 'announcements' ? (
                        <>
                            {/* Create New Announcement Form */}
                            <form onSubmit={handlePublishAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div className={styles.formGrid}>
                                    <div className={styles.formGroup}>
                                        <label className={styles.label}>{readData("components.Clerio.CMSModal", "CMSModal_text_9")}</label>
                                        <input
                                            className={styles.input}
                                            placeholder={readData("components.Clerio.CMSModal", "CMSModal_placeholder_10")}
                                            value={annTitle}
                                            onChange={(e) => setAnnTitle(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label className={styles.label}>{readData("components.Clerio.CMSModal", "CMSModal_text_11")}</label>
                                        <select
                                            className={styles.select}
                                            value={annCategory}
                                            onChange={(e) => setAnnCategory(e.target.value)}
                                        >
                                            <option value="Platform Update">{readData("components.Clerio.CMSModal", "CMSModal_text_12")}</option>
                                            <option value="Policy">{readData("components.Clerio.CMSModal", "CMSModal_text_13")}</option>
                                            <option value="Town Hall">{readData("components.Clerio.CMSModal", "CMSModal_text_14")}</option>
                                            <option value="Culture & Wellness">{readData("components.Clerio.CMSModal", "CMSModal_text_15")}</option>
                                            <option value="Emergency Alert">{readData("components.Clerio.CMSModal", "CMSModal_text_16")}</option>
                                        </select>
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label className={styles.label}>{readData("components.Clerio.CMSModal", "CMSModal_text_17")}</label>
                                        <select
                                            className={styles.select}
                                            value={annAudience}
                                            onChange={(e) => setAnnAudience(e.target.value)}
                                        >
                                            <option value="All Company">{readData("components.Clerio.CMSModal", "CMSModal_text_18")}</option>
                                            <option value="Engineering & Product">{readData("components.Clerio.CMSModal", "CMSModal_text_19")}</option>
                                            <option value="Sales & Operations">{readData("components.Clerio.CMSModal", "CMSModal_text_20")}</option>
                                            <option value="Managers & Leads">{readData("components.Clerio.CMSModal", "CMSModal_text_21")}</option>
                                            <option value="HR & Finance">{readData("components.Clerio.CMSModal", "CMSModal_text_22")}</option>
                                        </select>
                                    </div>
                                    <div className={styles.formGroup} style={{ justifyContent: 'center' }}>
                                        <label className={styles.checkboxRow}>
                                            <input
                                                type="checkbox"
                                                checked={annPinned}
                                                onChange={(e) => setAnnPinned(e.target.checked)}
                                            />
                                            <span>{readData("components.Clerio.CMSModal", "CMSModal_text_23")}</span>
                                        </label>
                                    </div>
                                    <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                                        <label className={styles.label}>{readData("components.Clerio.CMSModal", "CMSModal_text_24")}</label>
                                        <textarea
                                            className={styles.textarea}
                                            placeholder={readData("components.Clerio.CMSModal", "CMSModal_placeholder_25")}
                                            value={annContent}
                                            onChange={(e) => setAnnContent(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Live Preview Box */}
                                {annTitle && (
                                    <div className={styles.previewBox}>
                                        <div className={styles.previewHeader}>
                                            <span className={`${styles.previewBadge} ${annPinned ? styles.pinned : ''}`}>
                                                {annPinned ? readData("components.Clerio.CMSModal", "display_7") : annCategory}
                                            </span>
                                            <span className={styles.previewMeta}>{readData("components.Clerio.CMSModal", "CMSModal_text_26")}{annAudience}</span>
                                        </div>
                                        <h4 className={styles.previewTitle}>{annTitle}</h4>
                                        <p className={styles.previewContent}>{annContent || readData("components.Clerio.CMSModal", "fallback_2")}</p>
                                    </div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <button type="submit" className={styles.btnPrimary}>
                                        <Plus size={16} />{readData("components.Clerio.CMSModal", "CMSModal_text_27")}</button>
                                </div>
                            </form>

                            {/* Existing Announcements Feed */}
                            <div className={styles.sectionDivider}>
                                <h4 className={styles.existingTitle}>
                                    <Eye size={16} />{readData("components.Clerio.CMSModal", "CMSModal_text_28")}{announcements.length}{readData("components.Clerio.CMSModal", "CMSModal_text_29")}</h4>
                                <div className={styles.itemsList}>
                                    {announcements.map((item) => (
                                        <div key={item.id} className={styles.listItem}>
                                            <div className={styles.itemLeft}>
                                                <span style={{ fontSize: '1.2rem' }}>
                                                    {item.pinned ? readData("components.Clerio.CMSModal", "display_8") : readData("components.Clerio.CMSModal", "display_9")}
                                                </span>
                                                <div className={styles.itemInfo}>
                                                    <h4>{item.title}</h4>
                                                    <p>{item.category}{readData("components.Clerio.CMSModal", "CMSModal_text_30")}{item.audience}{readData("components.Clerio.CMSModal", "CMSModal_text_31")}{item.date}</p>
                                                </div>
                                            </div>
                                            <div className={styles.itemActions}>
                                                <button
                                                    className={styles.actionIconBtn}
                                                    onClick={() => togglePinAnnouncement(item.id)}
                                                    title={item.pinned ? readData("components.Clerio.CMSModal", "display_10") : readData("components.Clerio.CMSModal", "display_11")}
                                                >
                                                    <Pin size={16} color={item.pinned ? readData("components.Clerio.CMSModal", "display_12") : readData("components.Clerio.CMSModal", "display_13")} />
                                                </button>
                                                <button
                                                    className={`${styles.actionIconBtn} ${styles.delete}`}
                                                    onClick={() => deleteAnnouncement(item.id)}
                                                    title={readData("components.Clerio.CMSModal", "CMSModal_title_32")}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Upload Policy Document Form */}
                            <form onSubmit={handleUploadPolicy} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div className={styles.formGrid}>
                                    <div className={styles.formGroup}>
                                        <label className={styles.label}>{readData("components.Clerio.CMSModal", "CMSModal_text_33")}</label>
                                        <input
                                            className={styles.input}
                                            placeholder={readData("components.Clerio.CMSModal", "CMSModal_placeholder_34")}
                                            value={polTitle}
                                            onChange={(e) => setPolTitle(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label className={styles.label}>{readData("components.Clerio.CMSModal", "CMSModal_text_35")}</label>
                                        <select
                                            className={styles.select}
                                            value={polCategory}
                                            onChange={(e) => setPolCategory(e.target.value)}
                                        >
                                            <option value="Compliance & Legal">{readData("components.Clerio.CMSModal", "CMSModal_text_36")}</option>
                                            <option value="Leave & Attendance">{readData("components.Clerio.CMSModal", "CMSModal_text_37")}</option>
                                            <option value="Finance & Expenses">{readData("components.Clerio.CMSModal", "CMSModal_text_38")}</option>
                                            <option value="Legal & Safety">{readData("components.Clerio.CMSModal", "CMSModal_text_39")}</option>
                                            <option value="Benefits & Wellness">{readData("components.Clerio.CMSModal", "CMSModal_text_40")}</option>
                                        </select>
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label className={styles.label}>{readData("components.Clerio.CMSModal", "CMSModal_text_41")}</label>
                                        <input
                                            className={styles.input}
                                            placeholder={readData("components.Clerio.CMSModal", "CMSModal_placeholder_42")}
                                            value={polVersion}
                                            onChange={(e) => setPolVersion(e.target.value)}
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label className={styles.label}>{readData("components.Clerio.CMSModal", "CMSModal_text_43")}</label>
                                        <select
                                            className={styles.select}
                                            value={polDept}
                                            onChange={(e) => setPolDept(e.target.value)}
                                        >
                                            <option value="All Departments">{readData("components.Clerio.CMSModal", "CMSModal_text_44")}</option>
                                            <option value="Engineering">{readData("components.Clerio.CMSModal", "CMSModal_text_45")}</option>
                                            <option value="Sales">{readData("components.Clerio.CMSModal", "CMSModal_text_46")}</option>
                                            <option value="People Ops">{readData("components.Clerio.CMSModal", "CMSModal_text_47")}</option>
                                        </select>
                                    </div>
                                    <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                                        <label className={styles.uploadDropzone}>
                                            <input type="file" accept="application/pdf,.pdf" aria-label={readData("components.Clerio.CMSModal", "attribute_14")} onChange={(event) => {
                                                const file = event.target.files?.[0];
                                                if (!file) return;
                                                if (file.type !== 'application/pdf' || file.size > 10 * 1024 * 1024) {
                                                    showToast('Invalid File', 'Select a PDF smaller than 10 MB.', 'warning');
                                                    event.target.value = '';
                                                    return;
                                                }
                                                setUploadedFile(file);
                                            }} />
                                            <UploadCloud size={32} color="#2563eb" />
                                            <p>
                                                {uploadedFileName ? (
                                                    <strong style={{ color: '#16a34a' }}>{readData("components.Clerio.CMSModal", "CMSModal_text_48")}{uploadedFileName}</strong>
                                                ) : (
                                                    <>{readData("components.Clerio.CMSModal", "CMSModal_text_49")}</>
                                                )}
                                            </p>
                                            <span>{readData("components.Clerio.CMSModal", "CMSModal_text_50")}</span>
                                        </label>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <button type="submit" className={styles.btnPrimary}>
                                        <Plus size={16} />{readData("components.Clerio.CMSModal", "CMSModal_text_51")}</button>
                                </div>
                            </form>

                            {/* Existing Policy Documents */}
                            <div className={styles.sectionDivider}>
                                <h4 className={styles.existingTitle}>
                                    <FileText size={16} />{readData("components.Clerio.CMSModal", "CMSModal_text_52")}{policyDocuments.length}{readData("components.Clerio.CMSModal", "CMSModal_text_53")}</h4>
                                <div className={styles.itemsList}>
                                    {policyDocuments.map((doc) => (
                                        <div key={doc.id} className={styles.listItem}>
                                            <div className={styles.itemLeft}>
                                                <div style={{
                                                    width: '36px',
                                                    height: '36px',
                                                    borderRadius: '8px',
                                                    background: '#eff6ff',
                                                    color: '#2563eb',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontWeight: 700,
                                                    fontSize: '0.75rem'
                                                }}>{readData("components.Clerio.CMSModal", "CMSModal_text_54")}</div>
                                                <div className={styles.itemInfo}>
                                                    <h4>{doc.title} <span style={{ fontSize: '0.72rem', color: '#2563eb', background: '#eff6ff', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>{doc.version}</span></h4>
                                                    <p>{doc.category}{readData("components.Clerio.CMSModal", "CMSModal_text_55")}{doc.department}{readData("components.Clerio.CMSModal", "CMSModal_text_56")}{doc.effectiveDate}{readData("components.Clerio.CMSModal", "CMSModal_text_57")}{doc.fileSize}</p>
                                                </div>
                                            </div>
                                            <div className={styles.itemActions}>
                                                <button
                                                    className={styles.btnSecondary}
                                                    onClick={() => showToast('Downloading Handbook', `Downloading ${doc.title}...`, 'info')}
                                                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                                                >
                                                    <Download size={14} />{readData("components.Clerio.CMSModal", "CMSModal_text_58")}</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Modal Footer */}
                <div className={styles.footer}>
                    <button className={styles.btnSecondary} onClick={onClose}>{readData("components.Clerio.CMSModal", "CMSModal_text_59")}</button>
                </div>
            </div>
        </div>
    );
};

export default CMSModal;
