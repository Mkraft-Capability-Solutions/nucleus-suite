"use client";
import { t } from '@/lib/i18n';
import Dialog from '@mui/material/Dialog';
import { validateForm, updateDerivedFields } from '@/lib/form-validation';
import { readData } from '../../services/workspace-data.mjs';


import React, { useMemo, useRef, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import styles from './ActionFormModal.module.css';

const common = readData("components.Workspace.ActionFormModal", "common_1");

function fieldInitials(fields, context) {
    return Object.fromEntries(fields.map(([key]) => [key, context?.[key] ?? '']));
}

export default function ActionFormModal(props) {
    if (!props.request || !common[props.request.action]) return null;
    return <ActionFormContent key={JSON.stringify(props.request)} {...props} />;
}

function ActionFormContent({ request, onClose, onComplete }) {
    const action = request?.action ? common[request.action] : null;
    const initialValues = useMemo(() => action ? fieldInitials(action.fields, request.context) : {}, [action, request]);
    const [values, setValues] = useState(initialValues);
    const submitting = useRef(false);
    const [busy,setBusy]=useState(false);
    const [submitError,setSubmitError]=useState('');
    const [errors, setErrors] = useState({});
    const fields = action?.fields.map(([key, label, type, required, options, constraints]) => ({key,label,type,required,options,...constraints})) || [];

    if (!action) return null;

    const update = (key, value) => { setValues(current => updateDerivedFields(fields, current, key, value)); setErrors({}); };
    const submit = async (event) => {
        event.preventDefault();
        if(submitting.current)return;
        const invalid = validateForm(fields, values);
        setErrors(invalid);
        if (Object.keys(invalid).length) return;
        submitting.current=true;setBusy(true);setSubmitError('');
        try {
            const result=await onComplete({ action: request.action, title: action.title, values, context: request.context || {} });
            if(result?.success===false){setSubmitError(result.reason||t('validation','submission'));return;}
            onClose();
        } catch {setSubmitError(t('validation','submission'));}
        finally {submitting.current=false;setBusy(false);}
    };

    return (
        <Dialog open onClose={()=>{if(!busy)onClose();}} aria-labelledby="action-form-title" maxWidth="sm" fullWidth>
            <section className={styles.modal}>
                <header className={styles.header}>
                    <div>
                        <span className={styles.kicker}>{readData("components.Workspace.ActionFormModal", "content_text_2")}</span>
                        <h2 id="action-form-title">{action.title}</h2>
                    </div>
                    <button className={styles.close} disabled={busy} onClick={onClose} type="button" aria-label={readData("components.Workspace.ActionFormModal", "content_aria-label_3")}><X size={19} /></button>
                </header>
                <form aria-busy={busy} onSubmit={submit} className={styles.form} noValidate>
                    {submitError&&<p role="alert">{submitError}</p>}
                    {Object.keys(errors).length > 0 && <p role="alert">{Object.values(errors).join(" ")}</p>}
                    {action.fields.map(([key, label, type, required, options, constraints]) => (
                        <label className={`${styles.field} ${type === 'textarea' ? styles.wide : ''}`} key={key}>
                            <span>{label}{required && <b>{readData("components.Workspace.ActionFormModal", "content_text_4")}</b>}</span>
                            {type === 'textarea' ? <textarea aria-invalid={Boolean(errors[key])} value={values[key]} required={required} onChange={(event) => update(key, event.target.value)} rows="3" />
                                : type === 'select' ? <select aria-invalid={Boolean(errors[key])} value={values[key]} required={required} onChange={(event) => update(key, event.target.value)}><option value="">{readData("components.Workspace.ActionFormModal", "content_text_5")}</option>{Array.from(new Set(options)).map(option => <option key={option}>{option}</option>)}</select>
                                    : type === 'file' ? <input type="file" accept={key === 'photo' ? 'image/*' : undefined} required={required} onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        if (!file) return update(key, '');
                                        update(key, file.name);
                                        if (key === 'photo' && file.type && file.type.startsWith('image/')) {
                                            const reader = new FileReader();
                                            reader.onload = (e) => {
                                                setValues(curr => ({ ...curr, [key]: file.name, photoDataUrl: e.target?.result, photoName: file.name }));
                                            };
                                            reader.readAsDataURL(file);
                                        }
                                    }} />
                                        : <input type={type} {...constraints} aria-invalid={Boolean(errors[key])} value={values[key]} required={required} onChange={(event) => update(key, event.target.value)} />}
                        </label>
                    ))}
                    <footer className={styles.footer}>
                        <p><CheckCircle2 size={15} />{readData("components.Workspace.ActionFormModal", "content_text_6")}</p>
                        <div><button type="button" disabled={busy} className={styles.cancel} onClick={onClose}>{readData("components.Workspace.ActionFormModal", "content_text_7")}</button><button type="submit" disabled={busy} className={styles.submit}>{busy?t('validation','saving'):action.submit}</button></div>
                    </footer>
                </form>
            </section>
        </Dialog>
    );
}
