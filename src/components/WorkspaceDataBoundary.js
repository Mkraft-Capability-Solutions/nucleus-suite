'use client';

import { useEffect, useState } from 'react';
import { loadWorkspaceData } from '@/services/workspace-data.mjs';

export default function WorkspaceDataBoundary({ children }) {
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
            {state === 'disabled' ? <p role="alert">This workspace is not enabled. Contact the application administrator.</p> : state === 'error' ? <>
                <p role="alert">Workspace data could not be loaded. Check your connection and try again.</p>
                <button onClick={() => { setState('loading'); setAttempt((value) => value + 1); }}>Retry</button>
            </> : <p role="status" aria-live="polite">Loading workspace data…</p>}
        </main>
    );
}
