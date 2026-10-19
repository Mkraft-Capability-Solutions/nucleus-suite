"use client";

import { useTranslation } from '@/context/I18nContext';
import React, { useState, useEffect } from 'react';
import { X, MapPin, CheckCircle2, Lock, AlertCircle } from 'lucide-react';
import styles from './LocationMasterModal.module.css';
import { useHRMS } from '@/context/HRMSContext';
import { useFormValidation } from '@/hooks/useFormValidation';
import { useDuplicateCheck, generateLocationCode } from '@/hooks/useDuplicateCheck';

const LOCATION_RULES = [
    { key: 'locationName', label: 'Location Name', required: true, minLength: 3 },
    { key: 'entityCode',   label: 'Legal Entity',  required: true },
    { key: 'locationType', label: 'Location Type', required: true },
    { key: 'address',      label: 'Address',       required: true, minLength: 10 },
    { key: 'stateCode',    label: 'State',         required: true },
    { key: 'district',     label: 'District',      required: true, minLength: 2 },
    { key: 'timeZone',     label: 'Time Zone',     required: true },
    { key: 'weekStartDay', label: 'Week Start Day', required: true },
];

export default function LocationMasterModal({ isOpen, onClose, onSave, existingLocations = [] }) {
    const { t } = useTranslation();
    const { showToast } = useHRMS();
    const { isDuplicate } = useDuplicateCheck(existingLocations);
    const { getFieldError, setFieldTouched, handleSubmitGuard, resetValidation } = useFormValidation(LOCATION_RULES);

    const [formData, setFormData] = useState({
        locationCode: '',
        locationName: '',
        entityCode: 'ENT-NUC',
        locationType: 'Plant',
        parentLocation: '',
        address: '',
        stateCode: 'KA',
        district: '',
        calendarId: 'CAL-KA-2026',
        shiftGroup: 'SG-PLANT-MAIN',
        weekStartDay: 'Monday',
        geofencePoint: '',
        geofenceRadiusM: 200,
        timeZone: 'Asia/Kolkata',
        ptState: 'KA',
        lwfApplicable: true,
        esiCovered: true,
        factoryLicenceNo: '',
        status: 'Active',
        effectiveFrom: new Date().toISOString().split('T')[0]
    });

    // Auto-generate location code from stateCode
    useEffect(() => {
        const existingCodes = existingLocations.map(l => l.locationCode);
        const code = generateLocationCode(formData.stateCode, existingCodes);
        setFormData(prev => ({ ...prev, locationCode: code }));
    }, [formData.stateCode, existingLocations]);

    if (!isOpen) return null;

    const handleChange = (f, v) => setFormData(p => ({ ...p, [f]: v }));
    const handleBlur = (key) => setFieldTouched(key);

    const handleSubmit = (e) => {
        e.preventDefault();
        handleSubmitGuard(formData, () => {
            if (isDuplicate('locationCode', formData.locationCode)) {
                showToast('Duplicate Entry', `Location code "${formData.locationCode}" already exists.`, 'error');
                return;
            }
            if (isDuplicate('locationName', formData.locationName)) {
                showToast('Duplicate Entry', `A location named "${formData.locationName}" already exists.`, 'error');
                return;
            }
            // Live persistence to Neon DB via Next.js API
            try {
                fetch('/api/v1/operations/locations', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Idempotency-Key': crypto.randomUUID()
                    },
                    body: JSON.stringify(formData)
                }).catch(() => null);
            } catch {}

            if (onSave) onSave(formData);
            showToast('Location Master Saved', `Location ${formData.locationName} (${formData.locationCode}) saved.`, 'success');
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

    const ic = (key) => `${styles.input} ${getFieldError(key) ? styles.inputError : ''}`;
    const sc = (key) => `${styles.select} ${getFieldError(key) ? styles.inputError : ''}`;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <div className={styles.titleGroup}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <MapPin size={20} color="var(--signal)" />  {t("components.Workspace.LocationMasterModal.text_location_work_site_master_frm-plt-02", "Location / Work Site Master (FRM-PLT-02)")}
                        </h3>
                        <p>{t("components.Workspace.LocationMasterModal.text_configure_worksite_shift_group_holiday_c", "Configure worksite, shift group, holiday calendar &amp; geofencing")}</p>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose} type="button"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className={styles.body} noValidate>
                    <div className={styles.sectionTitle}>{t("components.Workspace.LocationMasterModal.text_identity_amp_legal_entity", "Identity &amp; Legal Entity")}</div>
                    <div className={styles.formGrid}>
                        {/* Location Code — Read Only, Auto-Generated */}
                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>
                                
                                {t("components.Workspace.LocationMasterModal.text_location_code", "Location Code")}
                                <span className={styles.autoTag}><Lock size={11} />  {t("components.Workspace.LocationMasterModal.text_auto-generated", "Auto-generated")}</span>
                            </span>
                            <div className={styles.readOnlyId}>
                                <Lock size={13} />
                                <span>{formData.locationCode || '—'}</span>
                            </div>
                        </label>

                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>{t("components.Workspace.LocationMasterModal.text_location_name", "Location Name")} <span className={styles.required}>*</span></span>
                            <input
                                className={ic('locationName')}
                                value={formData.locationName}
                                onChange={e => handleChange('locationName', e.target.value)}
                                onBlur={() => handleBlur('locationName')}
                                placeholder={t("components.Workspace.LocationMasterModal.placeholder_eg_bangalore_electronic_city_plant_1", "e.g. Bangalore Electronic City Plant 1")}
                                required
                            />
                            <FieldError fieldKey="locationName" />
                        </label>

                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>{t("components.Workspace.LocationMasterModal.text_legal_entity", "Legal Entity")} <span className={styles.required}>*</span></span>
                            <select
                                className={sc('entityCode')}
                                value={formData.entityCode}
                                onChange={e => handleChange('entityCode', e.target.value)}
                                onBlur={() => handleBlur('entityCode')}
                            >
                                <option value="">{t("components.Workspace.LocationMasterModal.text_select_entity", "— Select Entity —")}</option>
                                <option value="ENT-NUC">{t("components.Workspace.LocationMasterModal.text_ent-nuc_nucleus_hr_solutions_india_pvt_l", "ENT-NUC (Nucleus HR Solutions India Pvt Ltd)")}</option>
                                <option value="ENT-GLB">{t("components.Workspace.LocationMasterModal.text_ent-glb_nucleus_global_holdings_inc", "ENT-GLB (Nucleus Global Holdings Inc)")}</option>
                            </select>
                            <FieldError fieldKey="entityCode" />
                        </label>

                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>{t("components.Workspace.LocationMasterModal.text_location_type", "Location Type")} <span className={styles.required}>*</span></span>
                            <select
                                className={sc('locationType')}
                                value={formData.locationType}
                                onChange={e => handleChange('locationType', e.target.value)}
                                onBlur={() => handleBlur('locationType')}
                            >
                                <option value="">{t("components.Workspace.LocationMasterModal.text_select", "— Select —")}</option>
                                <option>{t("components.Workspace.LocationMasterModal.text_plant", "Plant")}</option><option>{t("components.Workspace.LocationMasterModal.text_corporate_office", "Corporate Office")}</option>
                                <option>{t("components.Workspace.LocationMasterModal.text_branch_office", "Branch Office")}</option><option>{t("components.Workspace.LocationMasterModal.text_warehouse", "Warehouse")}</option><option>{t("components.Workspace.LocationMasterModal.text_rampd_centre", "R&amp;D Centre")}</option>
                            </select>
                            <FieldError fieldKey="locationType" />
                        </label>
                    </div>

                    <div className={styles.sectionTitle}>{t("components.Workspace.LocationMasterModal.text_address_amp_geofence_config", "Address &amp; Geofence Config")}</div>
                    <div className={styles.formGrid}>
                        <label className={styles.field} style={{ gridColumn: 'span 2' }}>
                            <span className={styles.fieldLabel}>{t("components.Workspace.LocationMasterModal.text_address", "Address")} <span className={styles.required}>*</span></span>
                            <input
                                className={ic('address')}
                                value={formData.address}
                                onChange={e => handleChange('address', e.target.value)}
                                onBlur={() => handleBlur('address')}
                                placeholder={t("components.Workspace.LocationMasterModal.placeholder_full_address_of_the_work_site", "Full address of the work site")}
                                required
                            />
                            <FieldError fieldKey="address" />
                        </label>

                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>{t("components.Workspace.LocationMasterModal.text_state", "State")} <span className={styles.required}>*</span></span>
                            <select
                                className={sc('stateCode')}
                                value={formData.stateCode}
                                onChange={e => handleChange('stateCode', e.target.value)}
                                onBlur={() => handleBlur('stateCode')}
                            >
                                <option value="">{t("components.Workspace.LocationMasterModal.text_select_state", "— Select State —")}</option>
                                <option value="KA">{t("components.Workspace.LocationMasterModal.text_karnataka", "Karnataka")}</option><option value="MH">{t("components.Workspace.LocationMasterModal.text_maharashtra", "Maharashtra")}</option>
                                <option value="DL">{t("components.Workspace.LocationMasterModal.text_delhi", "Delhi")}</option><option value="TN">{t("components.Workspace.LocationMasterModal.text_tamil_nadu", "Tamil Nadu")}</option>
                                <option value="GJ">{t("components.Workspace.LocationMasterModal.text_gujarat", "Gujarat")}</option><option value="UP">{t("components.Workspace.LocationMasterModal.text_uttar_pradesh", "Uttar Pradesh")}</option>
                                <option value="RJ">{t("components.Workspace.LocationMasterModal.text_rajasthan", "Rajasthan")}</option><option value="AP">{t("components.Workspace.LocationMasterModal.text_andhra_pradesh", "Andhra Pradesh")}</option>
                                <option value="TS">{t("components.Workspace.LocationMasterModal.text_telangana", "Telangana")}</option><option value="WB">{t("components.Workspace.LocationMasterModal.text_west_bengal", "West Bengal")}</option>
                            </select>
                            <FieldError fieldKey="stateCode" />
                        </label>

                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>{t("components.Workspace.LocationMasterModal.text_district", "District")} <span className={styles.required}>*</span></span>
                            <input
                                className={ic('district')}
                                value={formData.district}
                                onChange={e => handleChange('district', e.target.value)}
                                onBlur={() => handleBlur('district')}
                                placeholder={t("components.Workspace.LocationMasterModal.placeholder_eg_bangalore_urban", "e.g. Bangalore Urban")}
                                required
                            />
                            <FieldError fieldKey="district" />
                        </label>

                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>{t("components.Workspace.LocationMasterModal.text_geofence_centre_lat_long", "Geofence Centre (Lat, Long)")} <span className={styles.optional}>{t("components.Workspace.LocationMasterModal.text_optional", "(optional)")}</span></span>
                            <input
                                className={styles.input}
                                placeholder={t("components.Workspace.LocationMasterModal.placeholder_128452_776602", "12.8452, 77.6602")}
                                value={formData.geofencePoint}
                                onChange={e => handleChange('geofencePoint', e.target.value)}
                            />
                        </label>

                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>{t("components.Workspace.LocationMasterModal.text_geofence_radius_metres", "Geofence Radius (metres)")}</span>
                            <input
                                type="number"
                                className={styles.input}
                                value={formData.geofenceRadiusM}
                                min={50}
                                max={5000}
                                onChange={e => handleChange('geofenceRadiusM', parseInt(e.target.value))}
                            />
                        </label>
                    </div>

                    <div className={styles.sectionTitle}>{t("components.Workspace.LocationMasterModal.text_time_amp_statutory_pack_config", "Time &amp; Statutory Pack Config")}</div>
                    <div className={styles.formGrid}>
                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>{t("components.Workspace.LocationMasterModal.text_time_zone", "Time Zone")} <span className={styles.required}>*</span></span>
                            <select className={styles.select} value={formData.timeZone} onChange={e => handleChange('timeZone', e.target.value)}>
                                <option>{t("components.Workspace.LocationMasterModal.text_asiakolkata", "Asia/Kolkata")}</option><option>{t("components.Workspace.LocationMasterModal.text_utc", "UTC")}</option>
                            </select>
                        </label>

                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>{t("components.Workspace.LocationMasterModal.text_week_start_day", "Week Start Day")} <span className={styles.required}>*</span></span>
                            <select className={styles.select} value={formData.weekStartDay} onChange={e => handleChange('weekStartDay', e.target.value)}>
                                <option>{t("components.Workspace.LocationMasterModal.text_monday", "Monday")}</option><option>{t("components.Workspace.LocationMasterModal.text_sunday", "Sunday")}</option>
                            </select>
                        </label>

                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>{t("components.Workspace.LocationMasterModal.text_factory_licence_no", "Factory Licence No")} <span className={styles.optional}>{t("components.Workspace.LocationMasterModal.text_optional", "(optional)")}</span></span>
                            <input className={styles.input} value={formData.factoryLicenceNo} onChange={e => handleChange('factoryLicenceNo', e.target.value)} />
                        </label>
                    </div>

                    <div className={styles.footer}>
                        <button type="button" className={styles.btnSecondary} onClick={onClose}>{t("components.Workspace.LocationMasterModal.text_cancel", "Cancel")}</button>
                        <button type="submit" className={styles.btnPrimary}>
                            <CheckCircle2 size={16} style={{ display: 'inline', marginRight: '4px' }} />  {t("components.Workspace.LocationMasterModal.text_save_location_master", "Save Location Master")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
