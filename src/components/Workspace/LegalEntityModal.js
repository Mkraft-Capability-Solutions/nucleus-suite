"use client";

import { useTranslation } from '@/context/I18nContext';
import React, { useState, useEffect, useCallback } from 'react';
import { X, Building2, CheckCircle2, Lock, AlertCircle } from 'lucide-react';
import styles from './LegalEntityModal.module.css';
import { useHRMS } from '@/context/HRMSContext';
import { useFormValidation } from '@/hooks/useFormValidation';
import { useDuplicateCheck, generateEntityCode } from '@/hooks/useDuplicateCheck';

/** Validation rules for Legal Entity form */
const ENTITY_RULES = [
    { key: 'registeredName', label: 'Registered Name', required: true, minLength: 3 },
    { key: 'entityType',     label: 'Entity Type',     required: true },
    { key: 'cinLlpin',       label: 'CIN / LLPIN',     required: true, type: 'cin' },
    { key: 'entityPan',      label: 'Company PAN',     required: true, type: 'pan' },
    { key: 'tan',            label: 'Company TAN',     required: true, type: 'tan' },
    { key: 'gstin',          label: 'GSTIN',           required: false, type: 'gstin' },
    { key: 'establishmentType', label: 'Establishment Type', required: true },
    { key: 'registeredAddress', label: 'Registered Address', required: true, minLength: 10 },
    { key: 'fyStartMonth',   label: 'FY Start Month',  required: true },
    { key: 'currencyCode',   label: 'Base Currency',   required: true },
    { key: 'signatoryName',  label: 'Signing Authority', required: true, minLength: 2 },
    { key: 'signatoryDesignation', label: 'Signatory Designation', required: true, minLength: 2 },
];


export default function LegalEntityModal({ isOpen, onClose, onSave, existingEntities = [] }) {
    const { t } = useTranslation();
    const { showToast } = useHRMS();
    const { isDuplicate } = useDuplicateCheck(existingEntities);
    const { getFieldError, setFieldTouched, handleSubmitGuard, resetValidation, getTabErrorCount } = useFormValidation(ENTITY_RULES);

    const [formData, setFormData] = useState({
        entityCode: '',
        registeredName: '',
        tradeName: '',
        entityType: 'Private Limited',
        cinLlpin: '',
        entityPan: '',
        tan: '',
        gstin: '',
        pfCode: '',
        esiCode: '',
        ptRegNo: '',
        lwfRegNo: '',
        establishmentLicence: '',
        establishmentType: 'Factory',
        registeredAddress: '',
        commAddress: '',
        fyStartMonth: 'April',
        currencyCode: 'INR',
        signatoryName: '',
        signatoryDesignation: '',
        status: 'Active',
        effectiveFrom: new Date().toISOString().split('T')[0]
    });

    // Auto-generate entity code from name
    useEffect(() => {
        if (formData.registeredName.trim().length >= 3) {
            const existingCodes = existingEntities.map(e => e.entityCode);
            const code = generateEntityCode(formData.registeredName, existingCodes);
            setFormData(prev => ({ ...prev, entityCode: code }));
        }
    }, [formData.registeredName, existingEntities]);

    if (!isOpen) return null;

    const handleChange = (f, v) => setFormData(p => ({ ...p, [f]: v }));

    const handleBlur = (key) => setFieldTouched(key);

    const handleSubmit = (e) => {
        e.preventDefault();
        handleSubmitGuard(formData, (values) => {
            // Duplicate checks
            if (isDuplicate('cinLlpin', formData.cinLlpin)) {
                showToast('Duplicate Entry', `A legal entity with CIN/LLPIN "${formData.cinLlpin}" already exists.`, 'error');
                return;
            }
            if (isDuplicate('entityPan', formData.entityPan)) {
                showToast('Duplicate Entry', `A legal entity with PAN "${formData.entityPan}" already exists.`, 'error');
                return;
            }
            if (isDuplicate('entityCode', formData.entityCode)) {
                showToast('Duplicate Entry', `Entity code "${formData.entityCode}" already exists.`, 'error');
                return;
            }
            // Live persistence to Neon DB via Next.js API
            try {
                fetch('/api/v1/operations/legal-entities', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Idempotency-Key': crypto.randomUUID()
                    },
                    body: JSON.stringify(formData)
                }).catch(() => null);
            } catch {}

            if (onSave) onSave(formData);
            showToast('Legal Entity Saved', `Legal entity ${formData.registeredName} (${formData.entityCode}) saved.`, 'success');
            resetValidation();
            onClose();
        });
    };

    const FieldError = ({ fieldKey }) => {
        const err = getFieldError(fieldKey);
        if (!err) return null;
        return (
            <span className={styles.fieldError} role="alert">
                <AlertCircle size={12} /> {err}
            </span>
        );
    };

    const inputClass = (key) =>
        `${styles.input} ${getFieldError(key) ? styles.inputError : ''}`;
    const selectClass = (key) =>
        `${styles.select} ${getFieldError(key) ? styles.inputError : ''}`;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <div className={styles.titleGroup}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Building2 size={20} color="var(--signal)" />  {t("components.Workspace.LegalEntityModal.text_legal_entity_master_frm-plt-01", "Legal Entity Master (FRM-PLT-01)")}
                        </h3>
                        <p>{t("components.Workspace.LegalEntityModal.text_corporate_legal_entity_incorporation_and", "Corporate legal entity incorporation and statutory tax registrations")}</p>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose} type="button"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className={styles.body} noValidate>
                    <div className={styles.sectionTitle}>{t("components.Workspace.LegalEntityModal.text_entity_identity_amp_statutory_registrati", "Entity Identity &amp; Statutory Registrations")}</div>
                    <div className={styles.formGrid}>

                        {/* Entity Code — Read Only, Auto-Generated */}
                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>
                                
                                {t("components.Workspace.LegalEntityModal.text_entity_code", "Entity Code")}
                                <span className={styles.autoTag}><Lock size={11} />  {t("components.Workspace.LegalEntityModal.text_auto-generated", "Auto-generated")}</span>
                            </span>
                            <div className={styles.readOnlyId}>
                                <Lock size={13} />
                                <span>{formData.entityCode || '— enter name first'}</span>
                            </div>
                        </label>

                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>{t("components.Workspace.LegalEntityModal.text_registered_name", "Registered Name")} <span className={styles.required}>*</span></span>
                            <input
                                className={inputClass('registeredName')}
                                value={formData.registeredName}
                                onChange={e => handleChange('registeredName', e.target.value)}
                                onBlur={() => handleBlur('registeredName')}
                                placeholder={t("components.Workspace.LegalEntityModal.placeholder_eg_nucleus_hr_solutions_india_pvt_ltd", "e.g. Nucleus HR Solutions India Pvt Ltd")}
                                required
                            />
                            <FieldError fieldKey="registeredName" />
                        </label>

                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>{t("components.Workspace.LegalEntityModal.text_trade_brand_name", "Trade / Brand Name")}</span>
                            <input className={styles.input} value={formData.tradeName} onChange={e => handleChange('tradeName', e.target.value)} />
                        </label>

                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>{t("components.Workspace.LegalEntityModal.text_entity_type", "Entity Type")} <span className={styles.required}>*</span></span>
                            <select
                                className={selectClass('entityType')}
                                value={formData.entityType}
                                onChange={e => handleChange('entityType', e.target.value)}
                                onBlur={() => handleBlur('entityType')}
                            >
                                <option value="">{t("components.Workspace.LegalEntityModal.text_select", "— Select —")}</option>
                                <option>{t("components.Workspace.LegalEntityModal.text_private_limited", "Private Limited")}</option><option>{t("components.Workspace.LegalEntityModal.text_public_limited", "Public Limited")}</option>
                                <option>{t("components.Workspace.LegalEntityModal.text_llp", "LLP")}</option><option>{t("components.Workspace.LegalEntityModal.text_partnership", "Partnership")}</option><option>{t("components.Workspace.LegalEntityModal.text_proprietorship", "Proprietorship")}</option>
                            </select>
                            <FieldError fieldKey="entityType" />
                        </label>

                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>{t("components.Workspace.LegalEntityModal.text_cin_llpin", "CIN / LLPIN")} <span className={styles.required}>*</span></span>
                            <input
                                className={inputClass('cinLlpin')}
                                value={formData.cinLlpin}
                                onChange={e => handleChange('cinLlpin', e.target.value.toUpperCase())}
                                onBlur={() => handleBlur('cinLlpin')}
                                placeholder={t("components.Workspace.LegalEntityModal.placeholder_u72900ka2024ptc123456", "U72900KA2024PTC123456")}
                                maxLength={21}
                                required
                            />
                            <FieldError fieldKey="cinLlpin" />
                        </label>

                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>{t("components.Workspace.LegalEntityModal.text_company_pan", "Company PAN")} <span className={styles.required}>*</span></span>
                            <input
                                className={inputClass('entityPan')}
                                value={formData.entityPan}
                                onChange={e => handleChange('entityPan', e.target.value.toUpperCase())}
                                onBlur={() => handleBlur('entityPan')}
                                placeholder={t("components.Workspace.LegalEntityModal.placeholder_aaacn1234f", "AAACN1234F")}
                                maxLength={10}
                                required
                            />
                            <FieldError fieldKey="entityPan" />
                        </label>

                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>{t("components.Workspace.LegalEntityModal.text_company_tan", "Company TAN")} <span className={styles.required}>*</span></span>
                            <input
                                className={inputClass('tan')}
                                value={formData.tan}
                                onChange={e => handleChange('tan', e.target.value.toUpperCase())}
                                onBlur={() => handleBlur('tan')}
                                placeholder={t("components.Workspace.LegalEntityModal.placeholder_blrn12345e", "BLRN12345E")}
                                maxLength={10}
                                required
                            />
                            <FieldError fieldKey="tan" />
                        </label>

                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>{t("components.Workspace.LegalEntityModal.text_gstin", "GSTIN")} <span className={styles.optional}>{t("components.Workspace.LegalEntityModal.text_optional", "(optional)")}</span></span>
                            <input
                                className={inputClass('gstin')}
                                value={formData.gstin}
                                onChange={e => handleChange('gstin', e.target.value.toUpperCase())}
                                onBlur={() => handleBlur('gstin')}
                                placeholder={t("components.Workspace.LegalEntityModal.placeholder_29aaacn1234f1z5", "29AAACN1234F1Z5")}
                                maxLength={15}
                            />
                            <FieldError fieldKey="gstin" />
                        </label>

                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>{t("components.Workspace.LegalEntityModal.text_pf_establishment_code", "PF Establishment Code")}</span>
                            <input className={styles.input} value={formData.pfCode} onChange={e => handleChange('pfCode', e.target.value)} />
                        </label>

                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>{t("components.Workspace.LegalEntityModal.text_esi_employer_code", "ESI Employer Code")}</span>
                            <input className={styles.input} value={formData.esiCode} onChange={e => handleChange('esiCode', e.target.value)} />
                        </label>

                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>{t("components.Workspace.LegalEntityModal.text_pt_registration_no", "PT Registration No")}</span>
                            <input className={styles.input} value={formData.ptRegNo} onChange={e => handleChange('ptRegNo', e.target.value)} />
                        </label>

                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>{t("components.Workspace.LegalEntityModal.text_establishment_type", "Establishment Type")} <span className={styles.required}>*</span></span>
                            <select
                                className={selectClass('establishmentType')}
                                value={formData.establishmentType}
                                onChange={e => handleChange('establishmentType', e.target.value)}
                                onBlur={() => handleBlur('establishmentType')}
                            >
                                <option value="">{t("components.Workspace.LegalEntityModal.text_select", "— Select —")}</option>
                                <option>{t("components.Workspace.LegalEntityModal.text_factory", "Factory")}</option><option>{t("components.Workspace.LegalEntityModal.text_shop_amp_establishment", "Shop &amp; Establishment")}</option><option>{t("components.Workspace.LegalEntityModal.text_it_park", "IT Park")}</option>
                            </select>
                            <FieldError fieldKey="establishmentType" />
                        </label>
                    </div>

                    <div className={styles.sectionTitle}>{t("components.Workspace.LegalEntityModal.text_address_amp_fiscal_controls", "Address &amp; Fiscal Controls")}</div>
                    <div className={styles.formGrid}>
                        <label className={styles.field} style={{ gridColumn: 'span 2' }}>
                            <span className={styles.fieldLabel}>{t("components.Workspace.LegalEntityModal.text_registered_address", "Registered Address")} <span className={styles.required}>*</span></span>
                            <input
                                className={inputClass('registeredAddress')}
                                value={formData.registeredAddress}
                                onChange={e => handleChange('registeredAddress', e.target.value)}
                                onBlur={() => handleBlur('registeredAddress')}
                                placeholder={t("components.Workspace.LegalEntityModal.placeholder_full_registered_office_address", "Full registered office address")}
                                required
                            />
                            <FieldError fieldKey="registeredAddress" />
                        </label>

                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>{t("components.Workspace.LegalEntityModal.text_fy_start_month", "FY Start Month")} <span className={styles.required}>*</span></span>
                            <select className={styles.select} value={formData.fyStartMonth} onChange={e => handleChange('fyStartMonth', e.target.value)}>
                                <option>{t("components.Workspace.LegalEntityModal.text_april", "April")}</option><option>{t("components.Workspace.LegalEntityModal.text_january", "January")}</option>
                            </select>
                        </label>

                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>{t("components.Workspace.LegalEntityModal.text_base_currency", "Base Currency")} <span className={styles.required}>*</span></span>
                            <select className={styles.select} value={formData.currencyCode} onChange={e => handleChange('currencyCode', e.target.value)}>
                                <option>{t("components.Workspace.LegalEntityModal.text_inr", "INR")}</option><option>{t("components.Workspace.LegalEntityModal.text_usd", "USD")}</option><option>{t("components.Workspace.LegalEntityModal.text_eur", "EUR")}</option><option>{t("components.Workspace.LegalEntityModal.text_gbp", "GBP")}</option>
                            </select>
                        </label>

                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>{t("components.Workspace.LegalEntityModal.text_signing_authority", "Signing Authority")} <span className={styles.required}>*</span></span>
                            <input
                                className={inputClass('signatoryName')}
                                value={formData.signatoryName}
                                onChange={e => handleChange('signatoryName', e.target.value)}
                                onBlur={() => handleBlur('signatoryName')}
                                placeholder={t("components.Workspace.LegalEntityModal.placeholder_authorised_signatory_full_name", "Authorised signatory full name")}
                                required
                            />
                            <FieldError fieldKey="signatoryName" />
                        </label>

                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>{t("components.Workspace.LegalEntityModal.text_signatory_designation", "Signatory Designation")} <span className={styles.required}>*</span></span>
                            <input
                                className={inputClass('signatoryDesignation')}
                                value={formData.signatoryDesignation}
                                onChange={e => handleChange('signatoryDesignation', e.target.value)}
                                onBlur={() => handleBlur('signatoryDesignation')}
                                placeholder={t("components.Workspace.LegalEntityModal.placeholder_eg_director_chief_people_officer", "e.g. Director & Chief People Officer")}
                                required
                            />
                            <FieldError fieldKey="signatoryDesignation" />
                        </label>
                    </div>

                    <div className={styles.footer}>
                        <button type="button" className={styles.btnSecondary} onClick={onClose}>{t("components.Workspace.LegalEntityModal.text_cancel", "Cancel")}</button>
                        <button type="submit" className={styles.btnPrimary}>
                            <CheckCircle2 size={16} style={{ display: 'inline', marginRight: '4px' }} />  {t("components.Workspace.LegalEntityModal.text_save_legal_entity", "Save Legal Entity")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
