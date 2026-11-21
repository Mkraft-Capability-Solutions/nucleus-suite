'use client';

import { Lock } from 'lucide-react';
import styles from './Entitlements.module.css';

/**
 * Shown in place of a workspace view whose module, sub-module or feature is not part of the
 * organisation's plan. The API refuses the same requests with 403 FEATURE_DISABLED.
 */
export default function ModuleNotEnabled({ label, tenantName, onBack }) {
    return (
        <section className={styles.notEnabled} aria-labelledby="module-not-enabled-title">
            <Lock size={20} aria-hidden="true" />
            <h1 id="module-not-enabled-title" className={styles.notEnabledTitle}>
                {label ? `${label} is not enabled` : 'This area is not enabled'}
            </h1>
            <p className={styles.notEnabledText}>
                {tenantName ? `${tenantName} does not have this module or feature in its plan.` : 'Your organisation does not have this module or feature in its plan.'}
                {' '}An organisation administrator can ask the platform administrator to add it.
            </p>
            {onBack && (
                <button type="button" className={styles.buttonSecondary} onClick={onBack}>
                    Back to dashboard
                </button>
            )}
        </section>
    );
}
