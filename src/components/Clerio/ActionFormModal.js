"use client";
import { readData } from '../../services/workspace-data.mjs';


import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import styles from './ActionFormModal.module.css';

const common = readData("components.Clerio.ActionFormModal", "common_1");

function fieldInitials(fields, context) {
    return Object.fromEntries(fields.map(([key]) => [key, context?.[key] ?? '']));
}

export default function ActionFormModal({ request, onClose, onComplete }) {
    const action = request?.action ? common[request.action] : null;
    const initialValues = useMemo(() => action ? fieldInitials(action.fields, request.context) : {}, [action, request]);
    const [values, setValues] = useState(initialValues);
    const modalRef = useRef(null);
    useEffect(() => {
        if (!action || !modalRef.current) return;
        const previous = document.activeElement;
        const modal = modalRef.current;
        const controls = () => [...modal.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')];
        controls()[0]?.focus();
        const onKey = (event) => {
            if (event.key === 'Escape') { event.preventDefault(); onClose(); }
            if (event.key !== 'Tab') return;
            const items = controls();
            const first = items[0]; const last = items[items.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        };
        modal.addEventListener('keydown', onKey);
        return () => { modal.removeEventListener('keydown', onKey); if (previous?.isConnected) previous.focus(); };
    }, [action, onClose]);

    useEffect(() => {
        setValues(initialValues);
    }, [initialValues]);

    if (!action) return null;

    const update = (key, value) => setValues(current => ({ ...current, [key]: value }));
    const submit = (event) => {
        event.preventDefault();
        onComplete({ action: request.action, title: action.title, values, context: request.context || {} });
        onClose();
    };

    return (
        <div className={styles.overlay} onMouseDown={onClose} role="presentation">
            <section ref={modalRef} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="action-form-title" onMouseDown={(event) => event.stopPropagation()}>
                <header className={styles.header}>
                    <div>
                        <span className={styles.kicker}>{readData("components.Clerio.ActionFormModal", "content_text_2")}</span>
                        <h2 id="action-form-title">{action.title}</h2>
                    </div>
                    <button className={styles.close} onClick={onClose} type="button" aria-label={readData("components.Clerio.ActionFormModal", "content_aria-label_3")}><X size={19} /></button>
                </header>
                <form onSubmit={submit} className={styles.form}>
                    {action.fields.map(([key, label, type, required, options]) => (
                        <label className={`${styles.field} ${type === 'textarea' ? styles.wide : ''}`} key={key}>
                            <span>{label}{required && <b>{readData("components.Clerio.ActionFormModal", "content_text_4")}</b>}</span>
                            {type === 'textarea' ? <textarea value={values[key]} required={required} onChange={(event) => update(key, event.target.value)} rows="3" />
                                : type === 'select' ? <select value={values[key]} required={required} onChange={(event) => update(key, event.target.value)}><option value="">{readData("components.Clerio.ActionFormModal", "content_text_5")}</option>{options.map(option => <option key={option}>{option}</option>)}</select>
                                    : type === 'file' ? <input type="file" required={required} onChange={(event) => update(key, event.target.files?.[0]?.name || '')} />
                                        : <input type={type} value={values[key]} required={required} onChange={(event) => update(key, event.target.value)} />}
                        </label>
                    ))}
                    <footer className={styles.footer}>
                        <p><CheckCircle2 size={15} />{readData("components.Clerio.ActionFormModal", "content_text_6")}</p>
                        <div><button type="button" className={styles.cancel} onClick={onClose}>{readData("components.Clerio.ActionFormModal", "content_text_7")}</button><button type="submit" className={styles.submit}>{action.submit}</button></div>
                    </footer>
                </form>
            </section>
        </div>
    );
}
