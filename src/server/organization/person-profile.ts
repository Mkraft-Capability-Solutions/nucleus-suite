import "server-only";

import { z } from "zod";
import { picklistValues } from "@/lib/picklists";

/**
 * FRM-PPL-01 — the identity, family, medical, site and control fields of the employee
 * record. They are stored on `employees.metadata`, the row's jsonb envelope, so no
 * migration is needed for any of them.
 *
 * Deliberately absent, because another store already holds them:
 * - mobile, alternate mobile, personal and official email, and both addresses are the
 *   `contacts` dossier resource;
 * - the emergency contact block is the `emergency` resource;
 * - dependants and nominees are the `dependants` resource;
 * - bank details are the `bank` resource;
 * - Aadhaar, PAN, UAN, PF, ESI, passport, NPS and the international-worker block are the
 *   `tax` resource, which is encrypted at rest and separately permissioned;
 * - the record's status is the `employees.status` column.
 *
 * Duplicating any of them here would be a second field for the same fact.
 */

const documentRef = () => z.string().uuid();

const educationSchema = z.object({
  level: z.string().trim().optional(),
  degree: z.string().trim().max(100).optional(),
  specialisation: z.string().trim().max(100).optional(),
  institute: z.string().trim().max(150).optional(),
  university: z.string().trim().max(150).optional(),
  yearOfPassing: z.union([z.number().int(), z.string().trim()]).optional(),
  passingYear: z.union([z.number().int(), z.string().trim()]).optional(),
  score: z.string().trim().max(50).optional(),
  certificateDocumentId: documentRef().optional(),
  /** The workbook requires the highest qualification to be flagged. */
  isHighest: z.boolean().default(false),
}).passthrough();

const experienceSchema = z.object({
  employer: z.string().trim().max(150).optional(),
  designation: z.string().trim().max(100).optional(),
  fromDate: z.string().trim().optional(),
  toDate: z.string().trim().optional(),
  lastCtc: z.string().trim().optional(),
  lastCtcMinor: z.number().int().min(0).optional(),
  reasonForLeaving: z.string().trim().max(200).optional(),
  previousUan: z.string().trim().optional(),
  prevUan: z.string().trim().optional(),
  pfTransferRequired: z.boolean().default(false).optional(),
  previousFyIncomeMinor: z.number().int().min(0).optional(),
  previousFyTdsMinor: z.number().int().min(0).optional(),
  relievingLetterDocumentId: documentRef().optional(),
}).passthrough().refine((row) => {
  if (row.fromDate && row.toDate && row.fromDate.trim() !== "" && row.toDate.trim() !== "") {
    return row.fromDate <= row.toDate;
  }
  return true;
}, { path: ["toDate"], message: "The from date must precede the to date." });

/**
 * Every field is optional in the shape; the workbook's conditional rules (marriage,
 * disability, highest qualification) are applied by `applyPersonProfileRules` wherever
 * the shape is used, so create and edit cannot drift apart.
 */
export const personProfileShape = {
  salutation: z.string().trim().max(30).optional(),
  middleName: z.string().trim().min(1).max(60).optional(),
  /** Kept for PF and background-check continuity. */
  formerName: z.string().trim().min(1).max(180).optional(),
  nameAsPerBank: z.string().trim().min(2).max(180).optional(),
  gender: z.string().trim().max(40).optional(),
  dateOfBirth: z.iso.date().optional(),
  bloodGroup: z.string().trim().max(30).optional(),
  maritalStatus: z.string().trim().max(40).optional(),
  marriageDate: z.iso.date().optional(),
  nationality: z.string().trim().max(60).optional(),
  placeOfBirth: z.string().trim().min(1).max(60).optional(),
  motherTongue: z.string().trim().max(60).optional(),
  socialCategory: z.string().trim().max(60).optional(),
  religion: z.string().trim().max(60).optional(),
  isDifferentlyAbled: z.boolean().optional(),
  disabilityType: z.string().trim().max(60).optional().or(z.literal("")),
  disabilityPercent: z.union([z.number().int().min(0).max(100), z.string().trim()]).optional().or(z.literal("")),
  disabilityCertificateDocumentId: documentRef().optional(),
  isExServiceman: z.boolean().optional(),
  photoDocumentId: documentRef().optional(),
  signatureDocumentId: documentRef().optional(),
  identificationMark: z.string().trim().min(1).max(120).optional(),

  fatherName: z.string().trim().min(1).max(120).optional(),
  motherName: z.string().trim().min(1).max(120).optional(),
  spouseName: z.string().trim().min(1).max(120).optional(),

  medicalExamDate: z.iso.date().optional(),
  fitnessStatus: z.string().trim().max(50).optional(),
  fitnessCertificateDocumentId: documentRef().optional(),
  safetyInductionDate: z.iso.date().optional(),

  biometricEnrolmentId: z.string().trim().min(1).max(40).optional(),
  accessCardNumber: z.string().trim().min(1).max(40).optional(),
  transportRoute: z.string().trim().min(1).max(60).optional(),
  canteenEligible: z.boolean().optional(),
  uniformSize: z.string().trim().min(1).max(20).optional(),
  shoeSize: z.string().trim().min(1).max(20).optional(),
  lockerNumber: z.string().trim().min(1).max(20).optional(),

  education: z.array(educationSchema).max(20).optional(),
  experience: z.array(experienceSchema).max(20).optional(),

  effectiveFrom: z.iso.date().optional(),
};

/** Eighteen years, the minimum gap the workbook puts between birth and marriage. */
const MARRIAGE_MIN_AGE_YEARS = 18;

/** The cross-field rules the workbook states, applied wherever the profile is written. */
export function applyPersonProfileRules(
  value: {
    dateOfBirth?: string; maritalStatus?: string; marriageDate?: string; spouseName?: string;
    isDifferentlyAbled?: boolean; disabilityType?: string; disabilityPercent?: number | string;
    education?: Array<{ isHighest: boolean }>;
  },
  ctx: z.RefinementCtx,
): void {
  if (value.maritalStatus === "married") {
    if (!value.marriageDate) ctx.addIssue({ code: "custom", path: ["marriageDate"], message: "A marriage date is required once marital status is married." });
    if (!value.spouseName) ctx.addIssue({ code: "custom", path: ["spouseName"], message: "A spouse name is required once marital status is married." });
  }
  if (value.dateOfBirth && value.marriageDate) {
    const earliest = new Date(`${value.dateOfBirth}T00:00:00Z`);
    earliest.setUTCFullYear(earliest.getUTCFullYear() + MARRIAGE_MIN_AGE_YEARS);
    if (value.marriageDate < earliest.toISOString().slice(0, 10)) {
      ctx.addIssue({ code: "custom", path: ["marriageDate"], message: `A marriage date cannot precede the date of birth plus ${MARRIAGE_MIN_AGE_YEARS} years.` });
    }
  }
  if (value.isDifferentlyAbled === true) {
    if (!value.disabilityType || (typeof value.disabilityType === "string" && value.disabilityType.trim() === "")) {
      ctx.addIssue({ code: "custom", path: ["disabilityType"], message: "Record the disability type." });
    }
    if (value.disabilityPercent === undefined || value.disabilityPercent === "") {
      ctx.addIssue({ code: "custom", path: ["disabilityPercent"], message: "Record the disability percentage; 40% and above drives the higher 80U deduction." });
    }
  }
  // If education entries exist, ensure highest qualification flag is assigned
  if (value.education && value.education.length > 0) {
    const highestCount = value.education.filter((row) => row.isHighest).length;
    if (highestCount === 0) {
      value.education[0].isHighest = true;
    } else if (highestCount > 1) {
      ctx.addIssue({ code: "custom", path: ["education"], message: "Flag exactly one qualification as the highest." });
    }
  }
}

/** The full name the record is known by; derived, never typed. */
export function derivedFullName(parts: { firstName: string; middleName?: string; lastName: string }): string {
  return [parts.firstName, parts.middleName, parts.lastName].filter((part) => part && part.trim() !== "").join(" ").trim();
}

/**
 * The profile keys, used to split a payload into the employee columns and the metadata
 * envelope without listing the keys twice.
 */
export const PERSON_PROFILE_KEYS = Object.keys(personProfileShape) as Array<keyof typeof personProfileShape>;

/** The profile slice of a parsed payload, plus the values the workbook derives. */
export function personProfileMetadata(
  input: Record<string, unknown>,
  identity: { firstName: string; lastName: string },
): Record<string, unknown> {
  const details = (input.details && typeof input.details === "object") ? (input.details as Record<string, unknown>) : {};
  
  // Merge details and direct inputs so all 117 wizard fields are retained
  const merged: Record<string, unknown> = {
    ...details,
    ...input,
  };
  delete merged.details;

  const profile: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(merged)) {
    if (v !== undefined && v !== null) {
      profile[k] = v;
    }
  }

  // Normalize key aliases between wizard field names and schema field names
  if (profile.panToken && !profile.panNumber) profile.panNumber = profile.panToken;
  if (profile.panNumber && !profile.panToken) profile.panToken = profile.panNumber;
  if (profile.pan && !profile.panToken) profile.panToken = profile.pan;
  if (profile.pan && !profile.panNumber) profile.panNumber = profile.pan;

  if (profile.aadhaarToken && !profile.aadhaarNumber) profile.aadhaarNumber = profile.aadhaarToken;
  if (profile.aadhaarNumber && !profile.aadhaarToken) profile.aadhaarToken = profile.aadhaarNumber;
  if (profile.aadhaar && !profile.aadhaarToken) profile.aadhaarToken = profile.aadhaar;
  if (profile.aadhaarToken && typeof profile.aadhaarToken === "string" && !profile.aadhaarLast4) {
    profile.aadhaarLast4 = profile.aadhaarToken.slice(-4);
  }

  if (profile.accountToken && !profile.bankAccountNo) profile.bankAccountNo = profile.accountToken;
  if (profile.bankAccountNo && !profile.accountToken) profile.accountToken = profile.bankAccountNo;

  if (profile.ifsc && !profile.bankIfsc) profile.bankIfsc = profile.ifsc;
  if (profile.bankIfsc && !profile.ifsc) profile.ifsc = profile.bankIfsc;

  if (profile.esiIp && !profile.esicNumber) profile.esicNumber = profile.esiIp;
  if (profile.esicNumber && !profile.esiIp) profile.esiIp = profile.esicNumber;

  if (profile.emergencyName && !profile.emergencyContactName) profile.emergencyContactName = profile.emergencyName;
  if (profile.emergencyPhone && !profile.emergencyContactPhone) profile.emergencyContactPhone = profile.emergencyPhone;
  if (profile.emergencyRelation && !profile.emergencyContactRelation) profile.emergencyContactRelation = profile.emergencyRelation;

  if (profile.biometricEnrolId && !profile.biometricEnrolmentId) profile.biometricEnrolmentId = profile.biometricEnrolId;
  if (profile.biometricEnrolmentId && !profile.biometricEnrolId) profile.biometricEnrolId = profile.biometricEnrolmentId;

  if (profile.accessCardNo && !profile.accessCardNumber) profile.accessCardNumber = profile.accessCardNo;
  if (profile.accessCardNumber && !profile.accessCardNo) profile.accessCardNo = profile.accessCardNumber;

  if (profile.lockerNo && !profile.lockerNumber) profile.lockerNumber = profile.lockerNo;
  if (profile.lockerNumber && !profile.lockerNo) profile.lockerNo = profile.lockerNumber;

  // Filter out empty experience rows if employer is not filled
  if (Array.isArray(profile.experience)) {
    profile.experience = profile.experience.filter((exp: unknown) => {
      if (!exp || typeof exp !== "object") return false;
      const rec = exp as Record<string, unknown>;
      return Boolean(rec.employer && String(rec.employer).trim() !== "");
    });
  }

  // Sanitize education rows
  if (Array.isArray(profile.education)) {
    profile.education = profile.education.map((edu: unknown, idx: number) => {
      if (!edu || typeof edu !== "object") return edu;
      const rec = { ...(edu as Record<string, unknown>) };
      if (!rec.yearOfPassing && rec.passingYear) {
        rec.yearOfPassing = Number(rec.passingYear) || 2020;
      }
      if (rec.isHighest === undefined) {
        rec.isHighest = idx === 0;
      }
      return rec;
    });
  }

  const middleName = typeof profile.middleName === "string" ? profile.middleName : undefined;
  const fullName = derivedFullName({ ...identity, middleName });
  profile.fullName = fullName;
  profile.nameAsPerBank = typeof profile.nameAsPerBank === "string" && profile.nameAsPerBank ? profile.nameAsPerBank : fullName;
  return profile;
}
