"use client";
import React, { useState } from 'react';
import { X, MapPin, CheckCircle2 } from 'lucide-react';
import styles from './LocationMasterModal.module.css';
import { useHRMS } from '@/context/HRMSContext';

export default function LocationMasterModal({ isOpen, onClose, onSave }) {
    const { showToast } = useHRMS();
    const [formData, setFormData] = useState({
        locationCode: 'LOC-BLR-01',
        locationName: 'Bangalore Electronic City Plant 1',
        entityCode: 'ENT-NUC',
        locationType: 'Plant',
        parentLocation: '',
        address: 'Plot 42, Electronic City Phase 1, Bangalore',
        stateCode: 'KA',
        district: 'Bangalore Urban',
        calendarId: 'CAL-KA-2026',
        shiftGroup: 'SG-PLANT-MAIN',
        weekStartDay: 'Monday',
        geofencePoint: '12.8452, 77.6602',
        geofenceRadiusM: 200,
        timeZone: 'Asia/Kolkata',
        ptState: 'KA',
        lwfApplicable: true,
        esiCovered: true,
        factoryLicenceNo: 'FACT-KA-88120',
        status: 'Active',
        effectiveFrom: new Date().toISOString().split('T')[0]
    });

    if (!isOpen) return null;

    const handleChange = (f, v) => setFormData(p => ({ ...p, [f]: v }));

    const handleSubmit = (e) => {
        e.preventDefault();
        if (onSave) onSave(formData);
        showToast('Location Master Saved', `Location ${formData.locationName} (${formData.locationCode}) saved.`, 'success');
        onClose();
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <div className={styles.titleGroup}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <MapPin size={20} color="#38bdf8" /> Location / Work Site Master (FRM-PLT-02)
                        </h3>
                        <p>Configure worksite, shift group, holiday calendar & geofencing</p>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose} type="button"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className={styles.body}>
                    <div className={styles.sectionTitle}>Identity & Legal Entity</div>
                    <div className={styles.formGrid}>
                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>Location Code <span className={styles.required}>*</span></span>
                            <input className={styles.input} value={formData.locationCode} onChange={e => handleChange('locationCode', e.target.value.toUpperCase())} required />
                        </label>
                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>Location Name <span className={styles.required}>*</span></span>
                            <input className={styles.input} value={formData.locationName} onChange={e => handleChange('locationName', e.target.value)} required />
                        </label>
                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>Legal Entity <span className={styles.required}>*</span></span>
                            <select className={styles.select} value={formData.entityCode} onChange={e => handleChange('entityCode', e.target.value)}>
                                <option value="ENT-NUC">ENT-NUC (Nucleus HR Solutions India Pvt Ltd)</option>
                            </select>
                        </label>
                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>Location Type <span className={styles.required}>*</span></span>
                            <select className={styles.select} value={formData.locationType} onChange={e => handleChange('locationType', e.target.value)}>
                                <option>Plant</option><option>Corporate Office</option><option>Branch Office</option><option>Warehouse</option><option>R&D Centre</option>
                            </select>
                        </label>
                    </div>

                    <div className={styles.sectionTitle}>Address & Geofence Config</div>
                    <div className={styles.formGrid}>
                        <label className={styles.field} style={{ gridColumn: 'span 2' }}>
                            <span className={styles.fieldLabel}>Address <span className={styles.required}>*</span></span>
                            <input className={styles.input} value={formData.address} onChange={e => handleChange('address', e.target.value)} required />
                        </label>
                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>State <span className={styles.required}>*</span></span>
                            <select className={styles.select} value={formData.stateCode} onChange={e => handleChange('stateCode', e.target.value)}>
                                <option value="KA">Karnataka</option><option value="MH">Maharashtra</option><option value="DL">Delhi</option><option value="TN">Tamil Nadu</option>
                            </select>
                        </label>
                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>District <span className={styles.required}>*</span></span>
                            <input className={styles.input} value={formData.district} onChange={e => handleChange('district', e.target.value)} required />
                        </label>
                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>Geofence Centre (Lat, Long)</span>
                            <input className={styles.input} placeholder="12.8452, 77.6602" value={formData.geofencePoint} onChange={e => handleChange('geofencePoint', e.target.value)} />
                        </label>
                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>Geofence Radius (metres)</span>
                            <input type="number" className={styles.input} value={formData.geofenceRadiusM} onChange={e => handleChange('geofenceRadiusM', parseInt(e.target.value))} />
                        </label>
                    </div>

                    <div className={styles.sectionTitle}>Time & Statutory Pack Config</div>
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
                            <span className={styles.fieldLabel}>Factory Licence No</span>
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
