/**
 * Shared validation patterns and helper functions for Nucleus Suite.
 */

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/i;
export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i;
export const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/i;
export const PIN_PATTERN = /^\d{6}$/;
export const CIN_LLPIN_PATTERN = /^([UL][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}|[A-Z]{3}-\d{4}|[A-Z0-9-]{7,21})$/i;
export const TIME_24H_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
export const DATE_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates a mobile or phone number.
 * Accepts:
 * - 10-digit Indian mobile number: 9876543210, 09876543210, +919876543210, +91 9876543210, +91-9876543210
 * - International standard E.164 or formatted numbers with 7 to 15 digits
 * - General landline/phone digits with 7-12 digits
 */
export function isValidPhoneNumber(val: string): boolean {
  if (typeof val !== 'string') return false;
  const clean = val.replace(/[\s\-().]/g, '');
  if (/^(?:\+?91|0)?[6-9]\d{9}$/.test(clean)) return true;
  if (/^\+[1-9]\d{6,14}$/.test(clean)) return true;
  if (/^\d{7,12}$/.test(clean)) return true;
  return false;
}

/**
 * Composite validator for fields like 'mobileEmail' (Candidate application).
 */
export function isValidMobileOrEmail(val: string): boolean {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  return EMAIL_PATTERN.test(trimmed) || isValidPhoneNumber(trimmed);
}

/**
 * Detects the semantic type of an operational field from its metadata.
 */
export function detectSemanticType(field: { key?: string; label?: string; type?: string }): string | null {
  const key = (field.key || '').toLowerCase();
  const label = (field.label || '').toLowerCase();
  const type = (field.type || '').toLowerCase();

  if (key === 'mobileemail') return 'mobileEmail';
  if (type === 'email' || key.includes('email') || label.includes('email')) return 'email';
  if (
    type === 'tel' ||
    key === 'mobile' ||
    key === 'phone' ||
    key.includes('mobile') ||
    key.includes('phone') ||
    label.includes('mobile') ||
    label.includes('phone') ||
    (type === 'tel' && key === 'contact')
  ) return 'phone';
  if (
    key === 'entitypan' ||
    key === 'pan' ||
    key === 'pancard' ||
    (key.includes('pan') && !key.includes('panel') && !key.includes('company') && !label.includes('panel'))
  ) return 'pan';
  if (
    key === 'vendorgstin' ||
    key === 'gstin' ||
    (key.includes('gst') && !key.includes('amount') && !label.includes('amount'))
  ) return 'gstin';
  if (key === 'ifsc' || key.includes('ifsc') || label.includes('ifsc')) return 'ifsc';
  if (key === 'cinllpin' || key === 'cin' || label.includes('cin') || label.includes('llpin')) return 'cinLlpin';
  if (
    key === 'pincode' ||
    key === 'postalcode' ||
    label.includes('pin code') ||
    label.includes('postal code')
  ) return 'pinCode';
  if (key === 'dateofbirth' || key === 'dob' || label.includes('birth')) return 'dateOfBirth';

  return null;
}
