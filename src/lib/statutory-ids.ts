/**
 * Format rules for the Indian statutory identifiers the workbook validates
 * (FRM-PPL-01, Statutory IDs). Every rule here is one the workbook states; nothing is
 * inferred. The Aadhaar checksum is the published Verhoeff algorithm, so it is
 * implemented rather than approximated by a length check.
 */

/** 12 digits. The checksum is checked separately by `isAadhaarChecksumValid`. */
export const AADHAAR_PATTERN = /^\d{12}$/;
/** ABCDE1234F. The fourth character is the holder type; P is an individual. */
export const PAN_PATTERN = /^[A-Z]{5}\d{4}[A-Z]$/;
export const UAN_PATTERN = /^\d{12}$/;
export const ESI_IP_PATTERN = /^\d{17}$/;
export const NPS_PRAN_PATTERN = /^\d{12}$/;
export const PASSPORT_PATTERN = /^[A-Z0-9]{8,9}$/;

/** Verhoeff multiplication table (D5 dihedral group). */
const MULTIPLY = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
] as const;

/** Verhoeff permutation table. */
const PERMUTE = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
] as const;

/**
 * True when the digits carry a valid Verhoeff check digit, which is what UIDAI uses on
 * Aadhaar numbers. A wrong-length or non-numeric value is not valid.
 */
export function isAadhaarChecksumValid(value: string): boolean {
  if (!AADHAAR_PATTERN.test(value)) return false;
  let checksum = 0;
  const digits = value.split("").reverse();
  for (let position = 0; position < digits.length; position += 1) {
    checksum = MULTIPLY[checksum][PERMUTE[position % 8][Number(digits[position])]];
  }
  return checksum === 0;
}

/** True when the PAN is well formed and belongs to an individual (fourth character P). */
export function isIndividualPan(value: string): boolean {
  return PAN_PATTERN.test(value) && value[3] === "P";
}
