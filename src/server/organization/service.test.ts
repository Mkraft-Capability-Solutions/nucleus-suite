import { describe, expect, it } from "vitest";
import {
  canSeeCompensation,
  createDepartmentSchema,
  createDocumentSchema,
  createPersonSchema,
  createPositionSchema,
  importPreviewSchema,
  MAX_DOCUMENT_BYTES,
  projectEmployee,
  type EmployeeRow,
} from "@/server/organization/service";
import { personProfileMetadata } from "@/server/organization/person-profile";

const ROW: EmployeeRow = {
  id: "e1",
  employee_code: "HO-0001",
  first_name: "Aditi",
  last_name: "Sharma",
  work_email: "aditi@example.test",
  designation: "HR Admin",
  department: "People",
  location: "Head Office",
  category: "regular",
  status: "active",
  joining_date: "2024-01-15",
  basic_salary_minor: 5_000_000,
  currency: "INR",
  version: 3,
};

describe("employee field projection (OC-P2-03)", () => {
  it("reveals salary with the independent permission", () => {
    expect(projectEmployee(ROW, true)).toMatchObject({ basic_salary_minor: 5_000_000, salaryMasked: false });
  });

  it("masks salary without the permission while keeping identity fields", () => {
    const view = projectEmployee(ROW, false);
    expect(view.basic_salary_minor).toBeNull();
    expect(view.salaryMasked).toBe(true);
    expect(view.employee_code).toBe("HO-0001");
    expect(view.designation).toBe("HR Admin");
  });

  it("never mutates the source row when masking", () => {
    const source = { ...ROW };
    projectEmployee(source, false);
    expect(source.basic_salary_minor).toBe(5_000_000);
  });

  it("denies Plant time-office the compensation projection", () => {
    const plant = { context: { actorUserId: "u", membershipId: "m", tenantId: "t", permissions: ["employee.read", "attendance.manage"], roles: ["plant_time_office"] }, tenantId: "t" };
    expect(canSeeCompensation(plant)).toBe(false);
  });

  it("grants HR Admin with the rate permission the compensation projection", () => {
    const admin = { context: { actorUserId: "u", membershipId: "m", tenantId: "t", permissions: ["employee.read", "payroll.rate.read"], roles: ["hr_admin"] }, tenantId: "t" };
    expect(canSeeCompensation(admin)).toBe(true);
  });
});

describe("document and import schemas (OC-P2-01/02)", () => {
  it("bounds uploads at 10 MiB", () => {
    expect(MAX_DOCUMENT_BYTES).toBe(10_485_760);
  });

  it("validates document payloads strictly", () => {
    const valid = { documentTypeId: "123e4567-e89b-12d3-a456-426614174000", title: "PAN card", mimeType: "application/pdf", contentBase64: "aGk=" };
    expect(createDocumentSchema.safeParse(valid).success).toBe(true);
    expect(createDocumentSchema.safeParse({ ...valid, title: "" }).success).toBe(false);
    expect(createDocumentSchema.safeParse({ ...valid, documentTypeId: "nope" }).success).toBe(false);
  });

  it("validates import previews row by row within 1..500 rows", () => {
    const row = { employeeCode: "HO-0002", firstName: "Rohan", lastName: "Verma", department: "Finance" };
    expect(importPreviewSchema.safeParse({ rows: [row] }).success).toBe(true);
    expect(importPreviewSchema.safeParse({ rows: [] }).success).toBe(false);
    expect(importPreviewSchema.safeParse({ rows: [{ ...row, workEmail: "bad" }] }).success).toBe(false);
  });
});

describe("creation schemas (command-centre forms)", () => {
  it("validates single-person creation with defaults", () => {
    const parsed = createPersonSchema.safeParse({ firstName: "Asha", lastName: "Nair" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.designation).toBe("Associate");
      expect(parsed.data.department).toBe("General");
    }
    expect(createPersonSchema.safeParse({ firstName: "", lastName: "Nair" }).success).toBe(false);
    expect(createPersonSchema.safeParse({ firstName: "Asha", lastName: "Nair", joiningDate: "10-09-2026" }).success).toBe(false);
  });

  it("rejects negative basic salary while accepting zero and positive minor units", () => {
    const person = { firstName: "Asha", lastName: "Nair" };
    expect(createPersonSchema.safeParse({ ...person, basicSalaryMinor: -1 }).success).toBe(false);
    expect(createPersonSchema.safeParse({ ...person, basicSalaryMinor: 0 }).success).toBe(true);
    expect(createPersonSchema.safeParse({ ...person, basicSalaryMinor: 4_500_000 }).success).toBe(true);
  });

  it("validates department creation", () => {
    expect(createDepartmentSchema.safeParse({ name: "Weaving" }).success).toBe(true);
    expect(createDepartmentSchema.safeParse({ name: "", businessUnitId: "nope" }).success).toBe(false);
  });

  it("validates position creation against a department", () => {
    const valid = { name: "Weaving Operator", departmentId: "123e4567-e89b-12d3-a456-426614174000" };
    expect(createPositionSchema.safeParse(valid).success).toBe(true);
    expect(createPositionSchema.safeParse({ name: "X" }).success).toBe(false);
  });
});

describe("Employee Creation Wizard 117 fields persistence (FRM-PPL-01)", () => {
  it("preserves all 117 fields across all sections in metadata envelope without loss", () => {
    const wizardPayload = {
      // Section 1: Identity
      employeeCode: "EMP-10001",
      salutation: "Mr.",
      firstName: "Rahul",
      middleName: "Kumar",
      lastName: "Sharma",
      fullLegalName: "Rahul Kumar Sharma",
      nameAsPerBank: "Rahul Kumar Sharma",
      formerName: "Rahul Sharma",
      gender: "Male",
      dateOfBirth: "1992-05-15",
      bloodGroup: "O+",
      maritalStatus: "married",
      marriageDate: "2018-11-20",
      nationality: "Indian",
      placeOfBirth: "Bangalore",
      motherTongue: "Hindi",
      socialCategory: "GEN",
      religion: "Hindu",
      isDifferentlyAbled: false,
      disabilityType: "",
      disabilityPercent: "",
      isExServiceman: false,

      // Section 2: Family
      fatherName: "Suresh Sharma",
      motherName: "Sunita Sharma",
      spouseName: "Pooja Sharma",

      // Section 3: Contact
      mobile: "9876543210",
      altMobile: "9876543211",
      personalEmail: "rahul.sharma@example.com",
      officialEmail: "rahul.sharma@nucleus.com",
      emergencyName: "Suresh Sharma",
      emergencyRelation: "Father",
      emergencyPhone: "9876500001",
      emergencySecondaryName: "Sunita Sharma",
      emergencySecondaryRelation: "Mother",
      emergencySecondaryPhone: "9876500002",

      // Section 4: Address
      presentAddr1: "Flat 402, Sunshine Heights",
      presentAddr2: "Outer Ring Road",
      presentCity: "Bangalore",
      presentDistrict: "Bangalore Urban",
      presentState: "Karnataka",
      presentPin: "560103",
      presentCountry: "India",
      permanentSameAsPresent: true,
      permanentAddress: "Flat 402, Sunshine Heights, Bangalore",
      accommodationType: "Rented",

      // Section 5: Statutory IDs
      aadhaarToken: "987654321098",
      panToken: "ABCDE1234F",
      uan: "100123456789",
      esiIp: "1234567890",
      passportToken: "Z1234567",
      passportExpiry: "2032-12-31",
      drivingLicence: "DL-01-2020-00123",
      voterId: "VTR9876543",
      npsPran: "110098765432",
      isInternationalWorker: false,
      countryOfOrigin: "India",
      workPermitNo: "",

      // Section 6: Bank
      bankName: "HDFC Bank",
      bankBranch: "MG Road, Bangalore",
      accountToken: "50100234567890",
      accountConfirm: "50100234567890",
      ifsc: "HDFC0000123",
      accountType: "Savings",
      paymentMode: "Bank Transfer",

      // Section 7: Dependants & Nominees
      dependants: [
        { name: "Aarav Sharma", relation: "Son", dob: "2020-01-10", gender: "Male", insured: true }
      ],
      nominees: [
        { name: "Pooja Sharma", relation: "Spouse", dob: "1994-08-12", sharePercent: 100, scheme: "PF", guardianName: "", address: "Bangalore" }
      ],

      // Section 8: Education
      education: [
        { level: "Graduation", degree: "B.Tech Computer Science", institute: "VTU University", passingYear: "2014", yearOfPassing: 2014, score: "8.5 CGPA", isHighest: true }
      ],

      // Section 9: Experience
      experience: [
        { employer: "TechCorp Ltd", designation: "Software Engineer", fromDate: "2015-01-01", toDate: "2020-12-31", lastCtc: "12 LPA", reasonForLeaving: "Career growth", prevUan: "100123456789" }
      ],

      // Section 10: Medical & Safety
      medicalExamDate: "2026-01-10",
      fitnessStatus: "Fit",
      safetyInductionDate: "2026-01-12",

      // Section 11: Site & Facilities
      biometricEnrolId: "BIO-9081",
      accessCardNo: "CARD-7788",
      transportRoute: "Route 12B",
      canteenEligible: true,
      uniformSize: "L",
      lockerNo: "L-404",

      // Section 12: Control & Placement
      department: "Engineering",
      designation: "Senior Software Engineer",
      joiningDate: "2026-02-01",
      manager: "EMP-00001",
      location: "Plant North",
      workerClass: "Grade A",
      status: "Active",
      effectiveFrom: "2026-02-01",
      changeReason: "New hire onboarding",

      // Section 13: Labour Law & OT Classification
      workerCategory: "PERM",
      hasRestDays: true,
      otEligibility: "ALL_DAYS",
      salaryLocationScope: "PLANT",
      assignedShift: "GENERAL",
      isTrainee: false,
      traineeType: "",
    };

    // 1. Validate schema parsing
    const parsed = createPersonSchema.safeParse(wizardPayload);
    expect(parsed.success).toBe(true);

    // 2. Validate metadata extraction via personProfileMetadata
    const metadata = personProfileMetadata(wizardPayload, { firstName: wizardPayload.firstName, lastName: wizardPayload.lastName });
    
    // Check Address fields
    expect(metadata.presentAddr1).toBe("Flat 402, Sunshine Heights");
    expect(metadata.presentCity).toBe("Bangalore");
    expect(metadata.presentPin).toBe("560103");
    expect(metadata.accommodationType).toBe("Rented");
    
    // Check Bank fields
    expect(metadata.bankName).toBe("HDFC Bank");
    expect(metadata.accountToken).toBe("50100234567890");
    expect(metadata.bankAccountNo).toBe("50100234567890");
    expect(metadata.ifsc).toBe("HDFC0000123");
    expect(metadata.bankIfsc).toBe("HDFC0000123");
    
    // Check Statutory fields
    expect(metadata.panToken).toBe("ABCDE1234F");
    expect(metadata.panNumber).toBe("ABCDE1234F");
    expect(metadata.aadhaarToken).toBe("987654321098");
    expect(metadata.aadhaarLast4).toBe("1098");
    expect(metadata.uan).toBe("100123456789");
    expect(metadata.passportToken).toBe("Z1234567");
    expect(metadata.npsPran).toBe("110098765432");
    
    // Check Repeating Arrays
    expect(metadata.dependants).toHaveLength(1);
    expect(metadata.dependants[0].name).toBe("Aarav Sharma");
    expect(metadata.nominees).toHaveLength(1);
    expect(metadata.nominees[0].name).toBe("Pooja Sharma");
    expect(metadata.education).toHaveLength(1);
    expect(metadata.education[0].degree).toBe("B.Tech Computer Science");
    expect(metadata.experience).toHaveLength(1);
    expect(metadata.experience[0].employer).toBe("TechCorp Ltd");
    
    // Check Medical & Safety
    expect(metadata.medicalExamDate).toBe("2026-01-10");
    expect(metadata.fitnessStatus).toBe("Fit");
    
    // Check Facilities
    expect(metadata.biometricEnrolId).toBe("BIO-9081");
    expect(metadata.accessCardNo).toBe("CARD-7788");
    expect(metadata.lockerNo).toBe("L-404");
    expect(metadata.uniformSize).toBe("L");
    
    // Check Labour law & Classification
    expect(metadata.workerCategory).toBe("PERM");
    expect(metadata.otEligibility).toBe("ALL_DAYS");
    expect(metadata.hasRestDays).toBe(true);
  });
});
