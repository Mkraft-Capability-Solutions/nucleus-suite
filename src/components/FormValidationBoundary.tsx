'use client';
import { t } from '@/lib/i18n';
import { useEffect, type ReactNode } from 'react';

/** Client preflight only; command services must independently validate input. */
export default function FormValidationBoundary({children}: {children: ReactNode}) {
    useEffect(() => {
        const owned = new WeakSet<HTMLInputElement | HTMLTextAreaElement>();
        const clearOwnedError = (control: EventTarget | null) => {
            if ((control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) && owned.has(control)) {
                control.setCustomValidity('');
                owned.delete(control);
            }
        };
        const clear = (event: Event) => clearOwnedError(event.target);
        const validate = (event: Event) => {
            const form = event.target;
            if (!(form instanceof HTMLFormElement)) return;
            for (const control of Array.from(form.elements)) {
                // Re-evaluate after controlled values or programmatic prefill changes.
                clearOwnedError(control);
                if ((control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement)
                    && control.required && !control.disabled
                    && !['checkbox', 'radio', 'file'].includes(control.type) && !control.value.trim()) {
                    control.setCustomValidity(t('validation','requiredGeneric'));
                    owned.add(control);
                }
            }
            if (!form.checkValidity()) {
                event.preventDefault();
                event.stopImmediatePropagation();
                form.reportValidity();
            }
        };
        document.addEventListener('submit', validate, true);
        document.addEventListener('input', clear, true);
        return () => {
            document.removeEventListener('submit', validate, true);
            document.removeEventListener('input', clear, true);
        };
    }, []);
    return children;
}
