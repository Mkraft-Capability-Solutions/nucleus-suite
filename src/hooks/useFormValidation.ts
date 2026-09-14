/**
 * useFormValidation — shared hook for all Nucleus HRMS forms
 *
 * Provides:
 * - Per-field error tracking with blur-based "touched" state
 * - validate(values, rules) — returns error map
 * - handleSubmitGuard(values, rules, onValid) — validates all, marks all touched, calls onValid only if clean
 * - setFieldTouched(key) — marks a field as touched on blur
 * - getFieldError(key) — returns error string if field is touched, else ''
 * - isFormValid — boolean derived from errors
 */

import { useState, useCallback } from 'react';

export type FieldRule = {
  key: string;
  label: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  type?: 'email' | 'phone' | 'pan' | 'ifsc' | 'cin' | 'tan' | 'gstin' | 'date' | 'number' | 'text';
  min?: number;
  max?: number;
  pattern?: { regex: RegExp; message: string };
  matchKey?: string; // for "confirm" fields — must equal values[matchKey]
  matchLabel?: string;
};

export type ValidationErrors = Record<string, string>;

const FORMAT_PATTERNS: Record<string, { regex: RegExp; message: string }> = {
  email:  { regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address' },
  phone:  { regex: /^[6-9]\d{9}$/, message: 'Enter a valid 10-digit Indian mobile number' },
  pan:    { regex: /^[A-Z]{5}\d{4}[A-Z]$/, message: 'PAN must be in format AAAAA9999A' },
  ifsc:   { regex: /^[A-Z]{4}0[A-Z0-9]{6}$/, message: 'IFSC must be in format AAAA0XXXXXX' },
  cin:    { regex: /^[UL]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/, message: 'CIN/LLPIN format invalid (e.g. U72900KA2024PTC123456)' },
  tan:    { regex: /^[A-Z]{4}\d{5}[A-Z]$/, message: 'TAN must be in format AAAA99999A' },
  gstin:  { regex: /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/, message: 'GSTIN format invalid (e.g. 29AAACN1234F1Z5)' },
};

export function validateFormFields(
  values: Record<string, unknown>,
  rules: FieldRule[],
): ValidationErrors {
  const errors: ValidationErrors = {};

  for (const rule of rules) {
    const raw = values[rule.key];
    const str = raw === undefined || raw === null ? '' : String(raw).trim();
    const empty = str === '';

    if (rule.required && empty) {
      errors[rule.key] = `${rule.label} is required`;
      continue;
    }
    if (empty) continue; // optional — skip further checks

    if (rule.minLength !== undefined && str.length < rule.minLength) {
      errors[rule.key] = `${rule.label} must be at least ${rule.minLength} characters`;
      continue;
    }
    if (rule.maxLength !== undefined && str.length > rule.maxLength) {
      errors[rule.key] = `${rule.label} must not exceed ${rule.maxLength} characters`;
      continue;
    }

    // Built-in format check
    if (rule.type && FORMAT_PATTERNS[rule.type]) {
      const { regex, message } = FORMAT_PATTERNS[rule.type];
      if (!regex.test(str)) {
        errors[rule.key] = message;
        continue;
      }
    }

    // Custom pattern override
    if (rule.pattern && !rule.pattern.regex.test(str)) {
      errors[rule.key] = rule.pattern.message;
      continue;
    }

    // Number range
    if (rule.type === 'number') {
      const num = Number(raw);
      if (!Number.isFinite(num)) {
        errors[rule.key] = `${rule.label} must be a number`;
        continue;
      }
      if (rule.min !== undefined && num < rule.min) {
        errors[rule.key] = `${rule.label} must be at least ${rule.min}`;
        continue;
      }
      if (rule.max !== undefined && num > rule.max) {
        errors[rule.key] = `${rule.label} must not exceed ${rule.max}`;
        continue;
      }
    }

    // Match check (e.g. confirm account number)
    if (rule.matchKey !== undefined) {
      const matchVal = values[rule.matchKey];
      if (raw !== matchVal) {
        errors[rule.key] = `${rule.label} does not match ${rule.matchLabel ?? 'the original value'}`;
      }
    }
  }

  return errors;
}

export function useFormValidation(rules: FieldRule[]) {
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const setFieldTouched = useCallback((key: string) => {
    setTouched(prev => ({ ...prev, [key]: true }));
  }, []);

  const validate = useCallback(
    (values: Record<string, unknown>): ValidationErrors => {
      const errs = validateFormFields(values, rules);
      setErrors(errs);
      return errs;
    },
    [rules],
  );

  // Returns visible error only for touched fields
  const getFieldError = useCallback(
    (key: string): string => (touched[key] ? errors[key] ?? '' : ''),
    [errors, touched],
  );

  // Returns all errors regardless of touched state (for submit check)
  const getAllErrors = useCallback(
    (values: Record<string, unknown>): ValidationErrors => validateFormFields(values, rules),
    [rules],
  );

  // Mark all fields as touched and validate — used on submit
  const touchAll = useCallback(() => {
    const all: Record<string, boolean> = {};
    for (const r of rules) all[r.key] = true;
    setTouched(all);
  }, [rules]);

  const handleSubmitGuard = useCallback(
    (
      values: Record<string, unknown>,
      onValid: (values: Record<string, unknown>) => void,
    ) => {
      touchAll();
      const errs = validateFormFields(values, rules);
      setErrors(errs);
      if (Object.keys(errs).length === 0) {
        onValid(values);
      }
    },
    [rules, touchAll],
  );

  const resetValidation = useCallback(() => {
    setErrors({});
    setTouched({});
  }, []);

  const hasErrors = Object.keys(errors).length > 0;

  // Count errors per tab (for EmployeeCreationWizard multi-tab)
  const getTabErrorCount = useCallback(
    (keys: string[]): number => keys.filter(k => !!errors[k]).length,
    [errors],
  );

  return {
    errors,
    touched,
    hasErrors,
    setFieldTouched,
    validate,
    getFieldError,
    getAllErrors,
    touchAll,
    handleSubmitGuard,
    resetValidation,
    getTabErrorCount,
  };
}
