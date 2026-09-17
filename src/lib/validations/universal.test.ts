import { describe, it, expect } from 'vitest';
import {
  buildZodSchemaForModule,
  isValidPhoneNumber,
  isValidMobileOrEmail,
  EMAIL_PATTERN,
  PAN_PATTERN,
  GSTIN_PATTERN,
  IFSC_PATTERN,
  PIN_PATTERN,
  CIN_LLPIN_PATTERN,
} from './universal';
import { validateForm, type FormField } from '../form-validation';

describe('Validation Patterns & Semantic Functions', () => {
  describe('Mobile / Phone validation', () => {
    it('accepts valid 10-digit Indian mobile numbers and international numbers', () => {
      expect(isValidPhoneNumber('9876543210')).toBe(true);
      expect(isValidPhoneNumber('+919876543210')).toBe(true);
      expect(isValidPhoneNumber('+91 9876543210')).toBe(true);
      expect(isValidPhoneNumber('+91-9876543210')).toBe(true);
      expect(isValidPhoneNumber('09876543210')).toBe(true);
      expect(isValidPhoneNumber('+1-202-555-0123')).toBe(true);
      expect(isValidPhoneNumber('+44 7911 123456')).toBe(true);
    });

    it('rejects invalid phone numbers', () => {
      expect(isValidPhoneNumber('123')).toBe(false);
      expect(isValidPhoneNumber('abcdefghij')).toBe(false);
      expect(isValidPhoneNumber('1234567890123456789')).toBe(false);
      expect(isValidPhoneNumber('')).toBe(false);
    });
  });

  describe('Email validation', () => {
    it('accepts valid email addresses', () => {
      expect(EMAIL_PATTERN.test('user@example.com')).toBe(true);
      expect(EMAIL_PATTERN.test('first.last@domain.co.in')).toBe(true);
      expect(EMAIL_PATTERN.test('admin+tag@sub.company.org')).toBe(true);
    });

    it('rejects invalid email addresses', () => {
      expect(EMAIL_PATTERN.test('not-an-email')).toBe(false);
      expect(EMAIL_PATTERN.test('@example.com')).toBe(false);
      expect(EMAIL_PATTERN.test('user@')).toBe(false);
      expect(EMAIL_PATTERN.test('user@domain')).toBe(false);
    });
  });

  describe('Composite mobileEmail validation', () => {
    it('accepts either valid mobile or valid email', () => {
      expect(isValidMobileOrEmail('applicant@career.com')).toBe(true);
      expect(isValidMobileOrEmail('9876543210')).toBe(true);
      expect(isValidMobileOrEmail('+91 9876543210')).toBe(true);
    });

    it('rejects values that are neither mobile nor email', () => {
      expect(isValidMobileOrEmail('some_random_string')).toBe(false);
      expect(isValidMobileOrEmail('12345')).toBe(false);
    });
  });

  describe('PAN validation', () => {
    it('accepts valid 10-char PAN numbers (case-insensitive)', () => {
      expect(PAN_PATTERN.test('ABCDE1234F')).toBe(true);
      expect(PAN_PATTERN.test('abcde1234f')).toBe(true);
      expect(PAN_PATTERN.test('AAAPL1234C')).toBe(true);
    });

    it('rejects invalid PAN numbers', () => {
      expect(PAN_PATTERN.test('ABC123')).toBe(false);
      expect(PAN_PATTERN.test('ABCDE12345')).toBe(false);
      expect(PAN_PATTERN.test('12345ABCDE')).toBe(false);
    });
  });

  describe('GSTIN validation', () => {
    it('accepts valid 15-character GSTIN', () => {
      expect(GSTIN_PATTERN.test('29ABCDE1234F1Z5')).toBe(true);
      expect(GSTIN_PATTERN.test('07AAAAA0000A1Z5')).toBe(true);
    });

    it('rejects invalid GSTIN format', () => {
      expect(GSTIN_PATTERN.test('29ABCDE1234F125')).toBe(false); // missing Z
      expect(GSTIN_PATTERN.test('29ABCDE1234F')).toBe(false); // too short
    });
  });

  describe('IFSC validation', () => {
    it('accepts valid 11-character IFSC', () => {
      expect(IFSC_PATTERN.test('HDFC0001234')).toBe(true);
      expect(IFSC_PATTERN.test('SBIN0000123')).toBe(true);
      expect(IFSC_PATTERN.test('ICIC0005678')).toBe(true);
    });

    it('rejects invalid IFSC format', () => {
      expect(IFSC_PATTERN.test('HDFC1001234')).toBe(false); // 5th char must be 0
      expect(IFSC_PATTERN.test('HDFC00123')).toBe(false); // too short
    });
  });

  describe('PIN code validation', () => {
    it('accepts 6-digit PIN code', () => {
      expect(PIN_PATTERN.test('560001')).toBe(true);
      expect(PIN_PATTERN.test('110001')).toBe(true);
    });

    it('rejects non-6-digit PIN codes', () => {
      expect(PIN_PATTERN.test('56001')).toBe(false);
      expect(PIN_PATTERN.test('5600001')).toBe(false);
      expect(PIN_PATTERN.test('56000A')).toBe(false);
    });
  });

  describe('CIN / LLPIN validation', () => {
    it('accepts valid 21-char CIN or 8-char LLPIN', () => {
      expect(CIN_LLPIN_PATTERN.test('U72900KA2024PTC123456')).toBe(true);
      expect(CIN_LLPIN_PATTERN.test('L01631KA2010PTC096843')).toBe(true);
      expect(CIN_LLPIN_PATTERN.test('AAA-1234')).toBe(true);
    });

    it('rejects invalid CIN/LLPIN', () => {
      expect(CIN_LLPIN_PATTERN.test('1234')).toBe(false);
    });
  });
});

describe('Dynamic Module Zod Schemas (Universal)', () => {
  it('validates person_record module with full payload and PATCH partial', () => {
    const schema = buildZodSchemaForModule('person_record');

    // Complete valid POST payload
    const valid = schema.safeParse({
      employeeCode: 'EMP-001',
      fullName: 'Jane Doe',
      gender: 'Female',
      dateOfBirth: '1990-05-15',
      mobile: '+91 9876543210',
      personalEmail: 'jane.doe@example.com',
      address: '123 Main Street',
      emergencyContact: '+91 9876543211',
      ifsc: 'HDFC0001234',
    });
    expect(valid.success).toBe(true);

    // PATCH partial validation (updates single field)
    const patchSchema = (schema as any).partial();

    // Valid mobile update
    expect(patchSchema.safeParse({ mobile: '+91 9876543210' }).success).toBe(true);

    // Invalid mobile update
    const invalidMobile = patchSchema.safeParse({ mobile: '123' });
    expect(invalidMobile.success).toBe(false);
    expect(invalidMobile.error?.issues.some((i: any) => i.message.includes('mobile'))).toBe(true);

    // Invalid email update
    const invalidEmail = patchSchema.safeParse({ personalEmail: 'not-an-email' });
    expect(invalidEmail.success).toBe(false);
    expect(invalidEmail.error?.issues.some((i: any) => i.message.includes('email'))).toBe(true);

    // Invalid IFSC update
    const invalidIfsc = patchSchema.safeParse({ ifsc: 'HDFC1001234' });
    expect(invalidIfsc.success).toBe(false);
    expect(invalidIfsc.error?.issues.some((i: any) => i.message.includes('IFSC'))).toBe(true);

    // Future date of birth update
    const futureDob = patchSchema.safeParse({ dateOfBirth: '2099-01-01' });
    expect(futureDob.success).toBe(false);
    expect(futureDob.error?.issues.some((i: any) => i.message.includes('past'))).toBe(true);
  });

  it('validates legal_entity module with PAN and CIN/LLPIN', () => {
    const schema = buildZodSchemaForModule('legal_entity');
    const patchSchema = (schema as any).partial();

    // Valid partial
    const valid = patchSchema.safeParse({
      cinLlpin: 'U72900KA2024PTC123456',
      entityPan: 'AAACP1234C',
    });
    expect(valid.success).toBe(true);

    // Invalid PAN
    const invalidPan = patchSchema.safeParse({
      entityPan: 'INVALID_PAN',
    });
    expect(invalidPan.success).toBe(false);
    expect(invalidPan.error?.issues.some((i: any) => i.message.includes('PAN'))).toBe(true);

    // Empty required PAN should fail
    const emptyPan = patchSchema.safeParse({
      entityPan: '',
    });
    expect(emptyPan.success).toBe(false);
    expect(emptyPan.error?.issues.some((i: any) => i.message.includes('PAN is required'))).toBe(true);
  });

  it('validates reimbursement_claim module with vendor GSTIN', () => {
    const schema = buildZodSchemaForModule('reimbursement_claim');
    const patchSchema = (schema as any).partial();

    // Valid GSTIN
    const valid = patchSchema.safeParse({
      vendorGstin: '29ABCDE1234F1Z5',
    });
    expect(valid.success).toBe(true);

    // Invalid GSTIN
    const invalid = patchSchema.safeParse({
      vendorGstin: '29ABCDE1234F',
    });
    expect(invalid.success).toBe(false);
    expect(invalid.error?.issues.some((i: any) => i.message.includes('GSTIN'))).toBe(true);

    // Empty string allowed
    const emptyGstin = patchSchema.safeParse({
      vendorGstin: '',
    });
    expect(emptyGstin.success).toBe(true);
  });

  it('validates candidate_application module with composite mobileEmail', () => {
    const schema = buildZodSchemaForModule('candidate_application');
    const patchSchema = (schema as any).partial();

    // With email
    expect(patchSchema.safeParse({ mobileEmail: 'applicant@example.com' }).success).toBe(true);

    // With phone
    expect(patchSchema.safeParse({ mobileEmail: '9876543210' }).success).toBe(true);

    // With invalid
    const invalid = patchSchema.safeParse({ mobileEmail: 'not-valid' });
    expect(invalid.success).toBe(false);
    expect(invalid.error?.issues.some((i: any) => i.message.includes('mobile number or email'))).toBe(true);
  });

  it('handles roster_schedule regression payload cleanly', () => {
    const schema = buildZodSchemaForModule('roster_schedule');
    const payload = {
      locationId: 'Gurugram Tech Park',
      orgUnit: 'Human Resources',
      startTime: '09:00',
      endTime: '18:00',
      personId: '9e2d5878-e075-4232-9c67-3a58c4b27e16',
      rosterDate: '2026-09-15',
      shiftCode: 'SH-GEN',
      dayTypeOverride: 'working_day',
      restDaysInWeek: '1',
      consecutiveDays: '5',
      publishStatus: 'draft',
      notifyOnPublish: true,
      publishReason: '',
    };

    const res = schema.safeParse(payload);
    expect(res.success).toBe(true);
  });
});

describe('Client Form Validation (validateForm)', () => {
  it('validates phone, email, pan, gstin, ifsc, pin, and dob in validateForm', () => {
    const fields: FormField[] = [
      { key: 'mobile', label: 'Mobile', type: 'tel' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'entityPan', label: 'PAN', type: 'text' },
      { key: 'vendorGstin', label: 'Vendor GSTIN', type: 'text' },
      { key: 'ifsc', label: 'IFSC', type: 'text' },
      { key: 'pinCode', label: 'PIN', type: 'text' },
      { key: 'dateOfBirth', label: 'Date of birth', type: 'date' },
    ];

    // All valid
    const validErrors = validateForm(fields, {
      mobile: '+91 9876543210',
      email: 'test@example.com',
      entityPan: 'ABCDE1234F',
      vendorGstin: '29ABCDE1234F1Z5',
      ifsc: 'HDFC0001234',
      pinCode: '560001',
      dateOfBirth: '1995-01-01',
    });
    expect(Object.keys(validErrors)).toHaveLength(0);

    // All invalid
    const invalidErrors = validateForm(fields, {
      mobile: 'abc',
      email: 'not-an-email',
      entityPan: 'invalid_pan',
      vendorGstin: 'invalid_gstin',
      ifsc: 'invalid_ifsc',
      pinCode: '123',
      dateOfBirth: '2099-01-01',
    });
    expect(invalidErrors.mobile).toBeTruthy();
    expect(invalidErrors.email).toBeTruthy();
    expect(invalidErrors.entityPan).toBeTruthy();
    expect(invalidErrors.vendorGstin).toBeTruthy();
    expect(invalidErrors.ifsc).toBeTruthy();
    expect(invalidErrors.pinCode).toBeTruthy();
    expect(invalidErrors.dateOfBirth).toBeTruthy();
  });
});
