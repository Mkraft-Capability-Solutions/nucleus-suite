'use client';
import {useTranslation} from '@/context/I18nContext';


import { useEffect, useState } from 'react';
import { loadWorkspaceData } from '@/services/workspace-data.mjs';

export default function WorkspaceDataBoundary({ children }) {
    const {t: translateText}=useTranslation();

    const [state, setState] = useState('loading');
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        let active = true;
        loadWorkspaceData().then(() => {
            if (active) setState('ready');
        }).catch((error) => {
            if (active) setState(error.code === 'WORKSPACE_DISABLED' ? 'disabled' : 'error');
        });
        return () => { active = false; };
    }, [attempt]);

    if (state === 'ready') return children;
    return (
        <main style={{ minHeight: '100vh', display: 'grid', placeContent: 'center', gap: 16, padding: 24 }}>
            {state === 'disabled' ? <p role="alert">{translateText("components.WorkspaceDataBoundary","text_805f423488")}</p> : state === 'error' ? <>
                <p role="alert">{translateText("components.WorkspaceDataBoundary","text_c04500f833")}</p>
                <button onClick={() => { setState('loading'); setAttempt((value) => value + 1); }}>{translateText("components.WorkspaceDataBoundary","text_942087cc2d")}</button>
            </> : <p role="status" aria-live="polite">{translateText("components.WorkspaceDataBoundary","text_e177bbb93e")}</p>}
        </main>
    );
}
