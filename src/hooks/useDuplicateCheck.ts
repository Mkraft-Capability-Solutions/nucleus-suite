/**
 * useDuplicateCheck — detects duplicate entries in a list before saving
 *
 * Usage:
 *   const { isDuplicate, getDuplicateMessage } = useDuplicateCheck(existingList, idKey);
 *   const dup = isDuplicate('ENT-NUC');  // checks if any item has idKey === 'ENT-NUC'
 */

import { useCallback } from 'react';

export type DuplicateCheckField = { key: string; label: string };

export function useDuplicateCheck<T extends Record<string, unknown>>(
  existingList: T[],
) {
  /**
   * Check if any item in existingList has item[field] === value (case-insensitive trim)
   * @param field - key to check in existing list items
   * @param value - new value to test
   * @param excludeValue - optionally exclude the current record's own value (for edit mode)
   */
  const isDuplicate = useCallback(
    (field: keyof T, value: string, excludeValue?: string): boolean => {
      const normalised = String(value).trim().toUpperCase();
      if (!normalised) return false;
      return existingList.some(item => {
        const existing = String(item[field] ?? '').trim().toUpperCase();
        if (excludeValue && existing === String(excludeValue).trim().toUpperCase()) return false;
        return existing === normalised;
      });
    },
    [existingList],
  );

  /**
   * Check multiple fields at once — returns the first duplicate field found, or null
   */
  const findDuplicate = useCallback(
    (
      checks: Array<{ field: keyof T; value: string; label: string }>,
      excludeValue?: string,
    ): { field: keyof T; label: string } | null => {
      for (const check of checks) {
        if (isDuplicate(check.field, check.value, excludeValue)) {
          return { field: check.field, label: check.label };
        }
      }
      return null;
    },
    [isDuplicate],
  );

  return { isDuplicate, findDuplicate };
}

/**
 * useAutoId — generates the next unique sequential ID given a prefix and existing list
 *
 * Usage:
 *   const nextId = generateId('EMP', employees, 'id', 5);
 *   // → 'EMP-10008' (5 = padStart width)
 */
export function useAutoId<T extends Record<string, unknown>>(
  existingList: T[],
  idKey: keyof T,
) {
  const generateId = useCallback(
    (prefix: string, startFrom = 10001, padWidth = 5): string => {
      const existing = existingList.map(item => {
        const raw = String(item[idKey] ?? '');
        // Extract trailing number
        const match = raw.match(/(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      });
      const maxExisting = existing.length > 0 ? Math.max(...existing) : startFrom - 1;
      const next = Math.max(maxExisting + 1, startFrom);
      return `${prefix}-${String(next).padStart(padWidth, '0')}`;
    },
    [existingList, idKey],
  );

  return { generateId };
}

/**
 * generateEntityCode — derives entity code from registered name
 * e.g. "Nucleus HR Solutions" → "ENT-NHS"
 */
export function generateEntityCode(registeredName: string, existingCodes: string[]): string {
  const words = registeredName.trim().split(/\s+/).filter(Boolean);
  let initials = words
    .slice(0, 3)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
  if (initials.length < 2) initials = registeredName.substring(0, 3).toUpperCase();

  let code = `ENT-${initials}`;
  let suffix = 1;
  const normalised = existingCodes.map(c => c.toUpperCase());
  while (normalised.includes(code.toUpperCase())) {
    code = `ENT-${initials}${suffix}`;
    suffix++;
  }
  return code;
}

/**
 * generateLocationCode — LOC-{stateCode}-{2-digit seq}
 */
export function generateLocationCode(stateCode: string, existingCodes: string[]): string {
  const prefix = `LOC-${stateCode.toUpperCase()}-`;
  const sameState = existingCodes
    .filter(c => c.toUpperCase().startsWith(prefix.toUpperCase()))
    .map(c => {
      const match = c.match(/(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    });
  const next = sameState.length > 0 ? Math.max(...sameState) + 1 : 1;
  return `${prefix}${String(next).padStart(2, '0')}`;
}

/**
 * generateRequisitionId — REQ-{dept abbrev}-{seq}
 */
export function generateRequisitionId(dept: string, existingIds: string[]): string {
  const deptCode = dept
    .trim()
    .split(/\s+/)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
    .substring(0, 4);
  const prefix = `REQ-${deptCode}-`;
  const samePrefix = existingIds
    .filter(id => id.toUpperCase().startsWith(prefix.toUpperCase()))
    .map(id => {
      const match = id.match(/(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    });
  const next = samePrefix.length > 0 ? Math.max(...samePrefix) + 1 : 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
}
