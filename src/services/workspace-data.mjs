import { workspaceContract } from '../data/workspace-contract.mjs';

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
            if (!snapshot) throw new Error('Workspace data must be loaded before rendering the application.');
            if (!Object.hasOwn(snapshot.resources, resource)) throw new Error(`Missing workspace resource: ${resource}`);
            const record = snapshot.resources[resource];
            if (key !== undefined && (!record || !Object.hasOwn(record, key))) throw new Error(`Missing workspace field: ${resource}.${key}`);
            // Consumers can edit form/state copies without corrupting the source snapshot.
            return structuredClone(key === undefined ? record : record[key]);
        },
    };
}

async function httpTransport() {
    const response = await fetch('/api/workspace-data', {
        cache: 'no-store',
        credentials: 'same-origin',
        signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const error = new Error(`Workspace data could not be loaded (${response.status}).`);
        error.code = payload?.error?.code;
        throw error;
    }
    return validateWorkspaceData(await response.json(), workspaceContract);
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
