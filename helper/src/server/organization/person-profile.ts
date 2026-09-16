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
  level: z.enum(picklistValues("PL_EDUCATION_LEVEL")),
  degree: z.string().trim().min(1).max(100),
  specialisation: z.string().trim().min(1).max(100).optional(),
  institute: z.string().trim().min(1).max(150),
  university: z.string().trim().min(1).max(150).optional(),
  yearOfPassing: z.number().int().min(1950).max(new Date().getUTCFullYear()),
  score: z.string().trim().min(1).max(10).optional(),
  certificateDocumentId: documentRef().optional(),
  /** The workbook requires the highest qualification to be flagged. */
  isHighest: z.boolean().default(false),
});

const experienceSchema = z.object({
  employer: z.string().trim().min(1).max(150),
  designation: z.string().trim().min(1).max(100),
  fromDate: z.iso.date(),
  toDate: z.iso.date(),
  lastCtcMinor: z.number().int().min(0).optional(),
  reasonForLeaving: z.string().trim().min(1).max(200).optional(),
  previousUan: z.string().trim().regex(/^\d{12}$/, "A UAN is 12 digits.").optional(),
  pfTransferRequired: z.boolean().default(false),
  previousFyIncomeMinor: z.number().int().min(0).optional(),
  previousFyTdsMinor: z.number().int().min(0).optional(),
  relievingLetterDocumentId: documentRef().optional(),
}).refine((row) => row.fromDate < row.toDate, { path: ["toDate"], message: "The from date must precede the to date." });

/**
 * Every field is optional in the shape; the workbook's conditional rules (marriage,
 * disability, highest qualification) are applied by `applyPersonProfileRules` wherever
 * the shape is used, so create and edit cannot drift apart.
 */
export const personProfileShape = {
  salutation: z.enum(picklistValues("PL_SALUTATION")).optional(),
  middleName: z.string().trim().min(1).max(60).optional(),
  /** Kept for PF and background-check continuity. */
  formerName: z.string().trim().min(1).max(180).optional(),
  nameAsPerBank: z.string().trim().min(2).max(180).optional(),
  gender: z.enum(picklistValues("PL_GENDER")).optional(),
  dateOfBirth: z.iso.date().optional(),
  bloodGroup: z.enum(picklistValues("PL_BLOOD_GROUP")).optional(),
  maritalStatus: z.enum(picklistValues("PL_MARITAL_STATUS")).optional(),
  marriageDate: z.iso.date().optional(),
  nationality: z.enum(picklistValues("PL_NATIONALITY")).optional(),
  placeOfBirth: z.string().trim().min(1).max(60).optional(),
  motherTongue: z.enum(picklistValues("PL_LANGUAGE")).optional(),
  socialCategory: z.enum(picklistValues("PL_SOCIAL_CATEGORY")).optional(),
  religion: z.enum(picklistValues("PL_RELIGION")).optional(),
  isDifferentlyAbled: z.boolean().optional(),
  disabilityType: z.enum(picklistValues("PL_DISABILITY_TYPE")).optional(),
  disabilityPercent: z.number().int().min(1).max(100).optional(),
  disabilityCertificateDocumentId: documentRef().optional(),
  isExServiceman: z.boolean().optional(),
  photoDocumentId: documentRef().optional(),
  signatureDocumentId: documentRef().optional(),
  identificationMark: z.string().trim().min(1).max(120).optional(),

  fatherName: z.string().trim().min(1).max(120).optional(),
  motherName: z.string().trim().min(1).max(120).optional(),
  spouseName: z.string().trim().min(1).max(120).optional(),

  medicalExamDate: z.iso.date().optional(),
  fitnessStatus: z.enum(picklistValues("PL_FITNESS_STATUS")).optional(),
  fitnessCertificateDocumentId: documentRef().optional(),
  safetyInductionDate: z.iso.date().optional(),

  biometricEnrolmentId: z.string().trim().min(1).max(20).optional(),
  accessCardNumber: z.string().trim().min(1).max(20).optional(),
  transportRoute: z.string().trim().min(1).max(60).optional(),
  canteenEligible: z.boolean().optional(),
  uniformSize: z.string().trim().min(1).max(10).optional(),
  shoeSize: z.string().trim().min(1).max(10).optional(),
  lockerNumber: z.string().trim().min(1).max(10).optional(),

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
    isDifferentlyAbled?: boolean; disabilityType?: string; disabilityPercent?: number;
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
    if (!value.disabilityType) ctx.addIssue({ code: "custom", path: ["disabilityType"], message: "Record the disability type." });
    if (value.disabilityPercent === undefined) ctx.addIssue({ code: "custom", path: ["disabilityPercent"], message: "Record the disability percentage; 40% and above drives the higher 80U deduction." });
  }
  // Exactly one highest qualification, because downstream eligibility reads that one row.
  if (value.education && value.education.length > 0 && value.education.filter((row) => row.isHighest).length !== 1) {
    ctx.addIssue({ code: "custom", path: ["education"], message: "Flag exactly one qualification as the highest." });
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
  const profile: Record<string, unknown> = {};
  for (const key of PERSON_PROFILE_KEYS) {
    if (input[key] !== undefined) profile[key] = input[key];
  }
  const middleName = typeof profile.middleName === "string" ? profile.middleName : undefined;
  const fullName = derivedFullName({ ...identity, middleName });
  profile.fullName = fullName;
  // The workbook defaults the bank name to a copy of the full name; a mismatch is the
  // top cause of bank rejections, so the copy is explicit rather than assumed downstream.
  profile.nameAsPerBank = typeof profile.nameAsPerBank === "string" ? profile.nameAsPerBank : fullName;
  return profile;
}
