export function launchAction(action, context = {}) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('nucleus:open-action', { detail: { action, context } }));
}
