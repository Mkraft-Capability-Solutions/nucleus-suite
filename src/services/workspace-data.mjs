import { workspaceContract } from '../server/workspace/contract.mjs';

/**
 * UI data boundary. The transport is asynchronous; components read the loaded
 * snapshot only after WorkspaceDataBoundary completes. No fixtures are bundled
 * into the client. Replace the transport/repository, not individual screens.
 */
export function validateWorkspaceData(payload, contract = {}) {
    if (!payload || payload.version !== 1 || !payload.resources || typeof payload.resources !== 'object' || Array.isArray(payload.resources)) {
        throw new Error('The workspace service returned an unsupported data format.');
    }
    for (const [resource, fields] of Object.entries(contract)) {
        const record = payload.resources[resource];
        if (!record || typeof record !== 'object' || Array.isArray(record) || fields.some((key) => !Object.hasOwn(record, key))) {
            throw new Error(`The workspace service returned an incomplete resource: ${resource}`);
        }
    }
    return payload;
}

export function createWorkspaceDataService(transport) {
    let snapshot;
    let pending;
    return {
        async load() {
            if (snapshot) return snapshot;
            if (!pending) {
                pending = Promise.resolve().then(transport).then(validateWorkspaceData).then((payload) => {
                    snapshot = payload;
                    return snapshot;
                }).finally(() => { pending = undefined; });
            }
            return pending;
        },
        read(resource, key) {
            if (!snapshot) {
                const getActual = () => {
                    if (!snapshot) return null;
                    const record = snapshot.resources[resource];
                    if (!record) return null;
                    return key === undefined ? record : record[key];
                };
                return new Proxy([], {
                    get(target, prop) {
                        const actual = getActual();
                        if (actual !== null) {
                            const val = actual[prop];
                            return typeof val === 'function' ? val.bind(actual) : val;
                        }
                        if (prop === 'length') return 0;
                        if (prop === Symbol.iterator) return function* () {};
                        if (prop === 'toString') return () => '';
                        if (prop === 'valueOf') return () => [];
                        return Reflect.get(target, prop);
                    },
                    has(target, prop) {
                        const actual = getActual();
                        return actual !== null ? Reflect.has(actual, prop) : Reflect.has(target, prop);
                    },
                    ownKeys(target) {
                        const actual = getActual();
                        return actual !== null ? Reflect.ownKeys(actual) : Reflect.ownKeys(target);
                    },
                    getOwnPropertyDescriptor(target, prop) {
                        const actual = getActual();
                        return actual !== null ? Reflect.getOwnPropertyDescriptor(actual, prop) : Reflect.getOwnPropertyDescriptor(target, prop);
                    }
                });
            }
            if (!Object.hasOwn(snapshot.resources, resource)) throw new Error(`Missing workspace resource: ${resource}`);
            const record = snapshot.resources[resource];
            if (key !== undefined && (!record || !Object.hasOwn(record, key))) throw new Error(`Missing workspace field: ${resource}.${key}`);
            return structuredClone(key === undefined ? record : record[key]);
        },
    };
}

async function httpTransport() {
    if (typeof window !== 'undefined' && window.sessionStorage) {
        try {
            const cached = window.sessionStorage.getItem('nucleus:workspace_data');
            if (cached) {
                const { payload, expiresAt } = JSON.parse(cached);
                if (Date.now() < expiresAt) {
                    return validateWorkspaceData(payload, workspaceContract);
                }
            }
        } catch {}
    }

    let response;
    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            response = await fetch('/api/workspace-data', {
                cache: 'no-store',
                credentials: 'same-origin',
                signal: AbortSignal.timeout(15_000),
            });
            if (response.ok) break;
            if (response.status >= 500) {
                await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
            } else {
                break;
            }
        } catch (err) {
            lastError = err;
            await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        }
    }
    if (!response || !response.ok) {
        const payload = await response?.json().catch(() => null);
        const error = new Error(`Workspace data could not be loaded (${response?.status || lastError?.message || 'unknown'}).`);
        error.code = payload?.error?.code;
        throw error;
    }
    const rawData = await response.json();
    const validated = validateWorkspaceData(rawData, workspaceContract);
    if (typeof window !== 'undefined' && window.sessionStorage) {
        try {
            window.sessionStorage.setItem('nucleus:workspace_data', JSON.stringify({
                payload: validated,
                expiresAt: Date.now() + 60_000,
            }));
        } catch {}
    }
    return validated;
}

let service = createWorkspaceDataService(httpTransport);
export const loadWorkspaceData = () => service.load();
export const readData = (resource, key) => service.read(resource, key);

/** Dependency injection for integration tests or a future service transport. */
export async function configureWorkspaceTransport(transport) {
    const next = createWorkspaceDataService(transport);
    await next.load();
    service = next;
}
