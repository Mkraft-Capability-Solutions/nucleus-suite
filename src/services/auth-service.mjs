/** Demo identity transport. Replace with session-backed sign-in at integration. */
export async function signIn(email, password) {
    const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'same-origin',
        signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload?.user ?? null;
}
