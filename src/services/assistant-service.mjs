export async function askAssistant(message) {
    const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
        signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error('The assistant is unavailable.');
    const payload = await response.json();
    if (typeof payload?.reply !== 'string') throw new Error('Invalid assistant response.');
    return payload;
}
