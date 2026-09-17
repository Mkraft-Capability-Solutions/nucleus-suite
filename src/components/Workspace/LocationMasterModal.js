"use client";
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
                            <MapPin size={20} color="var(--signal)" /> Location / Work Site Master (FRM-PLT-02)
                        </h3>
                        <p>Configure worksite, shift group, holiday calendar &amp; geofencing</p>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose} type="button"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className={styles.body} noValidate>
                    <div className={styles.sectionTitle}>Identity &amp; Legal Entity</div>
                    <div className={styles.formGrid}>
                        {/* Location Code — Read Only, Auto-Generated */}
                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>
                                Location Code
                                <span className={styles.autoTag}><Lock size={11} /> Auto-generated</span>
                            </span>
                            <div className={styles.readOnlyId}>
                                <Lock size={13} />
                                <span>{formData.locationCode || '—'}</span>
                            </div>
                        </label>

                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>Location Name <span className={styles.required}>*</span></span>
                            <input
                                className={ic('locationName')}
                                value={formData.locationName}
                                onChange={e => handleChange('locationName', e.target.value)}
                                onBlur={() => handleBlur('locationName')}
                                placeholder="e.g. Bangalore Electronic City Plant 1"
                                required
                            />
                            <FieldError fieldKey="locationName" />
                        </label>

                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>Legal Entity <span className={styles.required}>*</span></span>
                            <select
                                className={sc('entityCode')}
                                value={formData.entityCode}
                                onChange={e => handleChange('entityCode', e.target.value)}
                                onBlur={() => handleBlur('entityCode')}
                            >
                                <option value="">— Select Entity —</option>
                                <option value="ENT-NUC">ENT-NUC (Nucleus HR Solutions India Pvt Ltd)</option>
                                <option value="ENT-GLB">ENT-GLB (Nucleus Global Holdings Inc)</option>
                            </select>
                            <FieldError fieldKey="entityCode" />
                        </label>

                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>Location Type <span className={styles.required}>*</span></span>
                            <select
                                className={sc('locationType')}
                                value={formData.locationType}
                                onChange={e => handleChange('locationType', e.target.value)}
                                onBlur={() => handleBlur('locationType')}
                            >
                                <option value="">— Select —</option>
                                <option>Plant</option><option>Corporate Office</option>
                                <option>Branch Office</option><option>Warehouse</option><option>R&amp;D Centre</option>
                            </select>
                            <FieldError fieldKey="locationType" />
                        </label>
                    </div>

                    <div className={styles.sectionTitle}>Address &amp; Geofence Config</div>
                    <div className={styles.formGrid}>
                        <label className={styles.field} style={{ gridColumn: 'span 2' }}>
                            <span className={styles.fieldLabel}>Address <span className={styles.required}>*</span></span>
                            <input
                                className={ic('address')}
                                value={formData.address}
                                onChange={e => handleChange('address', e.target.value)}
                                onBlur={() => handleBlur('address')}
                                placeholder="Full address of the work site"
                                required
                            />
                            <FieldError fieldKey="address" />
                        </label>

                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>State <span className={styles.required}>*</span></span>
                            <select
                                className={sc('stateCode')}
                                value={formData.stateCode}
                                onChange={e => handleChange('stateCode', e.target.value)}
                                onBlur={() => handleBlur('stateCode')}
                            >
                                <option value="">— Select State —</option>
                                <option value="KA">Karnataka</option><option value="MH">Maharashtra</option>
                                <option value="DL">Delhi</option><option value="TN">Tamil Nadu</option>
                                <option value="GJ">Gujarat</option><option value="UP">Uttar Pradesh</option>
                                <option value="RJ">Rajasthan</option><option value="AP">Andhra Pradesh</option>
                                <option value="TS">Telangana</option><option value="WB">West Bengal</option>
                            </select>
                            <FieldError fieldKey="stateCode" />
                        </label>

                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>District <span className={styles.required}>*</span></span>
                            <input
                                className={ic('district')}
                                value={formData.district}
                                onChange={e => handleChange('district', e.target.value)}
                                onBlur={() => handleBlur('district')}
                                placeholder="e.g. Bangalore Urban"
                                required
                            />
                            <FieldError fieldKey="district" />
                        </label>

                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>Geofence Centre (Lat, Long) <span className={styles.optional}>(optional)</span></span>
                            <input
                                className={styles.input}
                                placeholder="12.8452, 77.6602"
                                value={formData.geofencePoint}
                                onChange={e => handleChange('geofencePoint', e.target.value)}
                            />
                        </label>

                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>Geofence Radius (metres)</span>
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

                    <div className={styles.sectionTitle}>Time &amp; Statutory Pack Config</div>
                    <div className={styles.formGrid}>
                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>Time Zone <span className={styles.required}>*</span></span>
                            <select className={styles.select} value={formData.timeZone} onChange={e => handleChange('timeZone', e.target.value)}>
                                <option>Asia/Kolkata</option><option>UTC</option>
                            </select>
                        </label>

                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>Week Start Day <span className={styles.required}>*</span></span>
                            <select className={styles.select} value={formData.weekStartDay} onChange={e => handleChange('weekStartDay', e.target.value)}>
                                <option>Monday</option><option>Sunday</option>
                            </select>
                        </label>

                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>Factory Licence No <span className={styles.optional}>(optional)</span></span>
                            <input className={styles.input} value={formData.factoryLicenceNo} onChange={e => handleChange('factoryLicenceNo', e.target.value)} />
                        </label>
                    </div>

                    <div className={styles.footer}>
                        <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancel</button>
                        <button type="submit" className={styles.btnPrimary}>
                            <CheckCircle2 size={16} style={{ display: 'inline', marginRight: '4px' }} /> Save Location Master
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
