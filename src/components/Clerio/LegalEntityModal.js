"use client";
import React, { useState } from 'react';
import { X, Building2, CheckCircle2 } from 'lucide-react';
import styles from './LegalEntityModal.module.css';
import { useHRMS } from '@/context/HRMSContext';

export default function LegalEntityModal({ isOpen, onClose, onSave }) {
    const { showToast } = useHRMS();
    const [formData, setFormData] = useState({
        entityCode: 'ENT-NUC',
        registeredName: 'Nucleus HR Solutions India Pvt Ltd',
        tradeName: 'Nucleus Suite',
        entityType: 'Private Limited',
        cinLlpin: 'U72900KA2024PTC123456',
        entityPan: 'AAACN1234F',
        tan: 'BLRN12345E',
        gstin: '29AAACN1234F1Z5',
        pfCode: 'PY/BLR/0012345/000',
        esiCode: '53000123450000101',
        ptRegNo: 'PT-290012345',
        lwfRegNo: 'LWF-KA-9912',
        establishmentLicence: 'SE-BLR-2024-8891',
        establishmentType: 'Factory',
        registeredAddress: 'Building 4, Tech Park, Outer Ring Road, Bangalore - 560103',
        commAddress: 'Same as registered',
        fyStartMonth: 'April',
        currencyCode: 'INR',
        signatoryName: 'Ananya Roy',
        signatoryDesignation: 'Director & Chief People Officer',
        status: 'Active',
        effectiveFrom: new Date().toISOString().split('T')[0]
    });

    if (!isOpen) return null;

    const handleChange = (f, v) => setFormData(p => ({ ...p, [f]: v }));

    const handleSubmit = (e) => {
        e.preventDefault();
        if (onSave) onSave(formData);
        showToast('Legal Entity Saved', `Legal entity ${formData.registeredName} (${formData.entityCode}) saved.`, 'success');
        onClose();
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <div className={styles.titleGroup}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Building2 size={20} color="#38bdf8" /> Legal Entity Master (FRM-PLT-01)
                        </h3>
                        <p>Corporate legal entity incorporation and statutory tax registrations</p>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose} type="button"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className={styles.body}>
                    <div className={styles.sectionTitle}>Entity Identity & Statutory Registrations</div>
                    <div className={styles.formGrid}>
                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>Entity Code <span className={styles.required}>*</span></span>
                            <input className={styles.input} value={formData.entityCode} onChange={e => handleChange('entityCode', e.target.value.toUpperCase())} required />
                        </label>
                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>Registered Name <span className={styles.required}>*</span></span>
                            <input className={styles.input} value={formData.registeredName} onChange={e => handleChange('registeredName', e.target.value)} required />
                        </label>
                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>Trade / Brand Name</span>
                            <input className={styles.input} value={formData.tradeName} onChange={e => handleChange('tradeName', e.target.value)} />
                        </label>
                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>Entity Type <span className={styles.required}>*</span></span>
                            <select className={styles.select} value={formData.entityType} onChange={e => handleChange('entityType', e.target.value)}>
                                <option>Private Limited</option><option>Public Limited</option><option>LLP</option><option>Partnership</option><option>Proprietorship</option>
                            </select>
                        </label>
                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>CIN / LLPIN <span className={styles.required}>*</span></span>
                            <input className={styles.input} value={formData.cinLlpin} onChange={e => handleChange('cinLlpin', e.target.value)} required />
                        </label>
                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>Company PAN <span className={styles.required}>*</span></span>
                            <input className={styles.input} value={formData.entityPan} onChange={e => handleChange('entityPan', e.target.value.toUpperCase())} required />
                        </label>
                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>Company TAN <span className={styles.required}>*</span></span>
                            <input className={styles.input} value={formData.tan} onChange={e => handleChange('tan', e.target.value.toUpperCase())} required />
                        </label>
                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>GSTIN</span>
                            <input className={styles.input} value={formData.gstin} onChange={e => handleChange('gstin', e.target.value.toUpperCase())} />
                        </label>
                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>PF Establishment Code</span>
                            <input className={styles.input} value={formData.pfCode} onChange={e => handleChange('pfCode', e.target.value)} />
                        </label>
                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>ESI Employer Code</span>
                            <input className={styles.input} value={formData.esiCode} onChange={e => handleChange('esiCode', e.target.value)} />
                        </label>
                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>PT Registration No</span>
                            <input className={styles.input} value={formData.ptRegNo} onChange={e => handleChange('ptRegNo', e.target.value)} />
                        </label>
                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>Establishment Type <span className={styles.required}>*</span></span>
                            <select className={styles.select} value={formData.establishmentType} onChange={e => handleChange('establishmentType', e.target.value)}>
                                <option>Factory</option><option>Shop & Establishment</option><option>IT Park</option>
                            </select>
                        </label>
                    </div>

                    <div className={styles.sectionTitle}>Address & Fiscal Controls</div>
                    <div className={styles.formGrid}>
                        <label className={styles.field} style={{ gridColumn: 'span 2' }}>
                            <span className={styles.fieldLabel}>Registered Address <span className={styles.required}>*</span></span>
                            <input className={styles.input} value={formData.registeredAddress} onChange={e => handleChange('registeredAddress', e.target.value)} required />
                        </label>
                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>FY Start Month <span className={styles.required}>*</span></span>
                            <select className={styles.select} value={formData.fyStartMonth} onChange={e => handleChange('fyStartMonth', e.target.value)}>
                                <option>April</option><option>January</option>
                            </select>
                        </label>
                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>Base Currency <span className={styles.required}>*</span></span>
                            <select className={styles.select} value={formData.currencyCode} onChange={e => handleChange('currencyCode', e.target.value)}>
                                <option>INR</option><option>USD</option><option>EUR</option><option>GBP</option>
                            </select>
                        </label>
                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>Signing Authority <span className={styles.required}>*</span></span>
                            <input className={styles.input} value={formData.signatoryName} onChange={e => handleChange('signatoryName', e.target.value)} required />
                        </label>
                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>Signatory Designation <span className={styles.required}>*</span></span>
                            <input className={styles.input} value={formData.signatoryDesignation} onChange={e => handleChange('signatoryDesignation', e.target.value)} required />
                        </label>
                    </div>

                    <div className={styles.footer}>
                        <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancel</button>
                        <button type="submit" className={styles.btnPrimary}>
                            <CheckCircle2 size={16} style={{ display: 'inline', marginRight: '4px' }} /> Save Legal Entity
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
