'use client';
import { useState, type FormEvent } from 'react';
import { useTranslation } from '@/context/I18nContext';
import styles from './Website.module.css';

type Copy = { name: string; email: string; topic: string; message: string; topics: string[]; submit: string; success: string; notice: string };
export default function ContactForm({ copy }: { copy: Copy }) {
    const { t } = useTranslation();
    const [ready, setReady] = useState(false);
    function download(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const body = ['Nucleus enquiry draft — not sent', ...['name', 'email', 'topic', 'message'].map(key => `${key}: ${String(data.get(key) || '').trim()}`)].join('\n\n');
        const url = URL.createObjectURL(new Blob([body], { type: 'text/plain;charset=utf-8' }));
        const link = document.createElement('a'); link.href = url; link.download = 'nucleus-enquiry-draft.txt'; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setReady(true);
    }
    return <div className={styles.contact}>
        <form onSubmit={download} onChange={() => setReady(false)}>
            <label>{t(copy.name)}<input name="name" autoComplete="name" required maxLength={100} pattern=".*\S.*" /></label>
            <label>{t(copy.email)}<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
            <label>{t(copy.topic)}<select name="topic">{copy.topics.map(topic => <option key={topic}>{t(topic)}</option>)}</select></label>
            <label>{t(copy.message)}<textarea name="message" rows={5} required maxLength={3000} /></label>
            <p>{t(copy.notice)}</p>
            <button className={styles.primary} type="submit">{t(copy.submit)}</button>
            {ready && <p role="status">{t(copy.success)}</p>}
        </form>
    </div>;
}
