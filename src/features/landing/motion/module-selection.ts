/**
 * Cross-island channel for "show this module": the hero's orbit nodes select a module and the platform tour (which
 * may hydrate later, see deferred-hydration.tsx) shows it. A tiny external store, read with useSyncExternalStore; the
 * last requested module persists, so a section that hydrates after the click still opens on it.
 */

export const MODULE_IDS = ['hire', 'onboard', 'manage', 'pay', 'perform', 'grow', 'engage', 'support'] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

export interface ModuleSelection {
  readonly id: ModuleId;
  /** Increments on every request, so selecting the same module twice still notifies. */
  readonly serial: number;
}

let current: ModuleSelection | null = null;
const listeners = new Set<() => void>();

export function selectModule(id: ModuleId): void {
  current = { id, serial: (current?.serial ?? 0) + 1 };
  for (const listener of listeners) listener();
}

export function subscribeModuleSelection(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getModuleSelection(): ModuleSelection | null {
  return current;
}

/** Server snapshot: nothing selected. */
export function getServerModuleSelection(): ModuleSelection | null {
  return null;
}
