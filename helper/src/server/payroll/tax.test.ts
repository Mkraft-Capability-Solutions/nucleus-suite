import { describe, expect, it } from "vitest";

import { rulePack } from "./rule-pack";
import type { StructureLine } from "./components";
import {
  declarationIssues,
  DEDUCTION_HEAD_CODES,
  DEDUCTION_SECTIONS,
  REGIME_ADMISSIBILITY_RULE,
  REGIME_FREEZE_DATE_SETTING,
  SALARY_STRUCTURE_INPUT,
  applyHeadDecisions,
  buildProjection,
  compareRegimes,
  evaluateRegimeSwitch,
  headDecisionsForStatus,
  parseFinancialYear,
  projectAnnualTax,
  projectGross,
  projectHra,
  projectMonthlyTds,
  projectTaxableIncome,
  remainingPeriods,
  ruleStatus,
  summariseSections,
  sumTaxDeducted,
  totalDeclaredDeductions,
  transitionAllowed,
  verifierRemarksIssue,
  type DeclarationData,
  type ProjectionInputs,
} from "./tax";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PACK = rulePack("in-pay/v1");

/** Reproduces STANDARD_STRUCTURE: basic 50,000.00, da 10% and hra 40% of basic. */
const STRUCTURE: StructureLine[] = [
  { componentCode: "basic", calculationMethod: "fixed_amount", amountMinor: 5_000_000, percentageOf: null, percentageValue: null },
  { componentCode: "da", calculationMethod: "percentage_of_component", amountMinor: null, percentageOf: "basic", percentageValue: 0.1 },
  { componentCode: "hra", calculationMethod: "percentage_of_component", amountMinor: null, percentageOf: "basic", percentageValue: 0.4 },
  { componentCode: "conveyance", calculationMethod: "fixed_amount", amountMinor: 160_000, percentageOf: null, percentageValue: null },
  { componentCode: "special", calculationMethod: "fixed_amount", amountMinor: 840_000, percentageOf: null, percentageValue: null },
];

const DECLARATION: DeclarationData = {
  employeeId: "11111111-1111-4111-8111-111111111111",
  financialYear: "2026-27",
  taxRegime: "old_regime",
  // 80C: 60,000 + 50,000 + 25,000 + 15,000 + 10,000 + 20,000 + 5,000 = 185,000.00
  employeePfMinor: 6_000_000,
  publicProvidentFundMinor: 5_000_000,
  lifeInsuranceMinor: 2_500_000,
  elssMinor: 1_500_000,
  tuitionFeesMinor: 1_000_000,
  housingPrincipalMinor: 2_000_000,
  otherSection80cMinor: 500_000,
  nps80ccd1bMinor: 5_000_000,
  healthInsuranceSelfMinor: 2_200_000,
  healthInsuranceParentsMinor: 3_000_000,
  educationLoanInterestMinor: 1_200_000,
  donations80gMinor: 500_000,
  savingsInterest80ttaMinor: 800_000,
  rentPaidMonthlyMinor: 2_500_000,
  landlordName: "R Iyer",
  landlordPan: "ABCDE1234F",
  rentedAddress: "12 Residency Road, Bengaluru",
  housingInterestSelfMinor: 15_000_000,
  otherSourcesIncomeMinor: 1_000_000,
  previousEmployerIncomeMinor: 30_000_000,
  previousEmployerTdsMinor: 2_000_000,
};

const EMPLOYEE = {
  id: "11111111-1111-4111-8111-111111111111",
  code: "MK-0007",
  name: "Asha Rao",
  department: "Finance",
  location: "Bengaluru",
};

function inputs(overrides: Partial<ProjectionInputs> = {}): ProjectionInputs {
  return {
    declarationId: "22222222-2222-4222-8222-222222222222",
    status: "submitted",
    version: 3,
    employee: EMPLOYEE,
    year: parseFinancialYear("2026-27"),
    data: DECLARATION,
    basicMinor: 5_000_000,
    structureLines: STRUCTURE,
    tdsRows: [],
    priorRegimeSwitchCount: 0,
    asOfPeriod: "2026-09",
    today: "2026-09-14",
    pack: PACK,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------

describe("financial year (SCR-054)", () => {
  it("spans April to March and lists the twelve payroll periods", () => {
    const year = parseFinancialYear("2026-27");
    expect(year.label).toBe("2026-27");
    expect(year.startDate).toBe("2026-04-01");
    expect(year.endDate).toBe("2027-03-31");
    expect(year.periods).toHaveLength(12);
    expect(year.periods[0]).toBe("2026-04");
    expect(year.periods[8]).toBe("2026-12");
    expect(year.periods[9]).toBe("2027-01");
    expect(year.periods[11]).toBe("2027-03");
  });

  it("accepts the spellings people actually type", () => {
    for (const value of ["2026-27", "2026-2027", "FY 2026-27", "2026", " fy2026/27 "]) {
      expect(parseFinancialYear(value).label).toBe("2026-27");
    }
  });

  it("rejects a year that does not span twelve months rather than guessing", () => {
    expect(() => parseFinancialYear("2026-28")).toThrowError(/must pair with 2027/);
    expect(() => parseFinancialYear("not a year")).toThrowError(/YYYY-YY/);
  });

  it("counts only the months still ahead", () => {
    const year = parseFinancialYear("2026-27");
    expect(remainingPeriods(year, "2026-09")).toEqual(["2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03"]);
    expect(remainingPeriods(year, "2027-03")).toEqual([]);
  });
});

describe("declared deduction totals (SCR-054)", () => {
  it("sums each head into its own section exactly", () => {
    const sections = summariseSections(DECLARATION, PACK);
    const by = (code: string) => sections.find((section) => section.code === code);
    expect(by("80C")?.declaredMinor).toBe(18_500_000);
    expect(by("80CCD(1B)")?.declaredMinor).toBe(5_000_000);
    expect(by("80D-self")?.declaredMinor).toBe(2_200_000);
    expect(by("80D-parents")?.declaredMinor).toBe(3_000_000);
    expect(by("80E")?.declaredMinor).toBe(1_200_000);
    expect(by("80G")?.declaredMinor).toBe(500_000);
    expect(by("80TTA")?.declaredMinor).toBe(800_000);
    expect(by("24(b)-self")?.declaredMinor).toBe(15_000_000);
    // Heads the employee did not declare contribute nothing; they are not errors.
    expect(by("80DD")?.declaredMinor).toBe(0);
    expect(by("24(b)-letout")?.declaredMinor).toBe(0);
  });

  it("totals every section into the declared total", () => {
    expect(totalDeclaredDeductions(summariseSections(DECLARATION, PACK))).toBe(46_200_000);
  });

  it("treats a blank, absent or non-numeric head as zero, never as NaN", () => {
    const sections = summariseSections({ employeePfMinor: "", lifeInsuranceMinor: "abc", elssMinor: null }, PACK);
    expect(sections.find((section) => section.code === "80C")?.declaredMinor).toBe(0);
  });
});

describe("missing statutory ceilings (SCR-054)", () => {
  it("marks every head indeterminate and names the missing rule instead of capping", () => {
    const sections = summariseSections(DECLARATION, PACK);
    for (const section of sections) {
      expect(section.capped).toBe(false);
      expect(section.allowableMinor).toBeNull();
      expect(section.blockedBy).toEqual([section.capRule]);
      for (const head of section.heads) {
        expect(head.capped).toBe(false);
        expect(head.missingRule).toBe(section.capRule);
      }
    }
  });

  it("separates a ceiling the pack leaves null from one it never declares", () => {
    // 80C is declared and unsupplied; 80G is not declared at all. Both are
    // unusable, and the difference is what the payroll owner has to act on.
    expect(ruleStatus("deductionCaps.section80c", PACK)).toEqual({
      rule: "deductionCaps.section80c",
      state: "not_supplied",
      valueMinor: null,
    });
    expect(ruleStatus("deductionCaps.section80g", PACK)).toEqual({
      rule: "deductionCaps.section80g",
      state: "not_declared",
      valueMinor: null,
    });
  });

  it("caps a head only once a ceiling is genuinely supplied", () => {
    const supplied = { ...PACK, deductionCaps: { ...PACK.deductionCaps, section80c: 15_000_000 } };
    const section = summariseSections(DECLARATION, supplied).find((entry) => entry.code === "80C");
    expect(section?.capped).toBe(true);
    expect(section?.declaredMinor).toBe(18_500_000);
    expect(section?.allowableMinor).toBe(15_000_000);
    expect(section?.blockedBy).toEqual([]);
  });
});

describe("projected gross (SCR-054)", () => {
  it("resolves the structure, annualises it and adds the declared other income", () => {
    const gross = projectGross({ basicMinor: 5_000_000, structureLines: STRUCTURE, data: DECLARATION });
    expect(gross.state).toBe("computed");
    // 50,000 + 5,000 da + 20,000 hra + 1,600 conveyance + 8,400 special = 85,000.00
    expect(gross.monthlyGrossMinor).toBe(8_500_000);
    expect(gross.annualSalaryGrossMinor).toBe(102_000_000);
    expect(gross.projectedAnnualGrossMinor).toBe(102_000_000 + 30_000_000 + 1_000_000);
  });

  it("reports gross as unavailable rather than zero when no structure is assigned", () => {
    const gross = projectGross({ basicMinor: 5_000_000, structureLines: [], data: DECLARATION });
    expect(gross.state).toBe("unavailable");
    expect(gross.projectedAnnualGrossMinor).toBeNull();
    expect(gross.reason).toMatch(/No salary structure/);
  });

  it("reports gross as unavailable when the employee has no basic salary", () => {
    const gross = projectGross({ basicMinor: null, structureLines: STRUCTURE, data: DECLARATION });
    expect(gross.state).toBe("unavailable");
    expect(gross.reason).toMatch(/no basic salary/);
  });
});

describe("HRA exemption (SCR-054)", () => {
  it("returns the inputs with a null exemption and names the missing constants", () => {
    const gross = projectGross({ basicMinor: 5_000_000, structureLines: STRUCTURE, data: DECLARATION });
    const hra = projectHra({ data: DECLARATION, monthlyComponentsMinor: gross.monthlyComponentsMinor, workLocation: "Bengaluru", pack: PACK });
    expect(hra.inputs.monthlyRentPaidMinor).toBe(2_500_000);
    expect(hra.inputs.annualRentPaidMinor).toBe(30_000_000);
    expect(hra.inputs.monthlyBasicDaMinor).toBe(5_500_000);
    expect(hra.inputs.annualBasicDaMinor).toBe(66_000_000);
    expect(hra.inputs.annualHraReceivedMinor).toBe(24_000_000);
    expect(hra.inputs.landlordPan).toBe("ABCDE1234F");
    expect(hra.exemptionMinor).toBeNull();
    expect(hra.blockedBy).toEqual(expect.arrayContaining([
      "hraExemption.metroPercent",
      "hraExemption.nonMetroPercent",
      "hraExemption.rentLessSalaryPercent",
      "hraExemption.metroCities",
      "hraExemption.landlordPanThresholdMinor",
    ]));
  });

  it("leaves metro status and the landlord PAN requirement undecided while their rules are unsupplied", () => {
    const gross = projectGross({ basicMinor: 5_000_000, structureLines: STRUCTURE, data: DECLARATION });
    const hra = projectHra({ data: DECLARATION, monthlyComponentsMinor: gross.monthlyComponentsMinor, workLocation: "Bengaluru", pack: PACK });
    expect(hra.inputs.metro).toBeNull();
    expect(hra.inputs.landlordPanRequired).toBeNull();
    expect(hra.inputs.workLocation).toBe("Bengaluru");
  });

  it("decides metro status and the PAN threshold once the rules are supplied", () => {
    const supplied = {
      ...PACK,
      hraExemption: { ...PACK.hraExemption, metroCities: ["Mumbai", "Delhi", "Kolkata", "Chennai"], landlordPanThresholdMinor: 10_000_000 },
    };
    const gross = projectGross({ basicMinor: 5_000_000, structureLines: STRUCTURE, data: DECLARATION });
    const metro = projectHra({ data: DECLARATION, monthlyComponentsMinor: gross.monthlyComponentsMinor, workLocation: "Mumbai", pack: supplied });
    expect(metro.inputs.metro).toBe(true);
    expect(metro.inputs.landlordPanRequired).toBe(true);
    const nonMetro = projectHra({ data: DECLARATION, monthlyComponentsMinor: gross.monthlyComponentsMinor, workLocation: "Bengaluru", pack: supplied });
    expect(nonMetro.inputs.metro).toBe(false);
    // The percentages are still missing, so there is still no exemption.
    expect(nonMetro.exemptionMinor).toBeNull();
  });
});

describe("projected taxable income (SCR-054)", () => {
  it("is indeterminate while any ceiling is missing, and lists what blocks it", () => {
    const gross = projectGross({ basicMinor: 5_000_000, structureLines: STRUCTURE, data: DECLARATION });
    const sections = summariseSections(DECLARATION, PACK);
    const hra = projectHra({ data: DECLARATION, monthlyComponentsMinor: gross.monthlyComponentsMinor, workLocation: "Bengaluru", pack: PACK });
    const taxable = projectTaxableIncome({ gross, sections, hra, pack: PACK });
    expect(taxable.state).toBe("indeterminate");
    expect(taxable.amountMinor).toBeNull();
    // The computable halves are still returned, because they are computable.
    expect(taxable.grossMinor).toBe(133_000_000);
    expect(taxable.declaredDeductionsMinor).toBe(46_200_000);
    expect(taxable.allowableDeductionsMinor).toBe(0);
    expect(taxable.blockedBy).toEqual(expect.arrayContaining([
      "deductionCaps.section80c",
      "deductionCaps.section80ccd1b",
      "tds.standardDeductionMinor",
      "hraExemption.metroPercent",
    ]));
  });

  it("names the salary structure, not a statutory rule, when gross is the thing missing", () => {
    const gross = projectGross({ basicMinor: null, structureLines: [], data: DECLARATION });
    const sections = summariseSections(DECLARATION, PACK);
    const hra = projectHra({ data: DECLARATION, monthlyComponentsMinor: {}, workLocation: null, pack: PACK });
    const taxable = projectTaxableIncome({ gross, sections, hra, pack: PACK });
    expect(taxable.blockedBy).toContain(SALARY_STRUCTURE_INPUT);
    expect(taxable.grossMinor).toBeNull();
  });
});

describe("projected tax (SCR-054)", () => {
  it("returns a null annual tax naming every unsupplied tds rule", () => {
    const gross = projectGross({ basicMinor: 5_000_000, structureLines: STRUCTURE, data: DECLARATION });
    const sections = summariseSections(DECLARATION, PACK);
    const hra = projectHra({ data: DECLARATION, monthlyComponentsMinor: gross.monthlyComponentsMinor, workLocation: "Bengaluru", pack: PACK });
    const annual = projectAnnualTax({ taxableIncome: projectTaxableIncome({ gross, sections, hra, pack: PACK }), packCode: PACK.code });
    expect(annual.state).toBe("blocked");
    expect(annual.amountMinor).toBeNull();
    expect(annual.blockedBy).toEqual(expect.arrayContaining([
      "tds.standardDeductionMinor",
      "tds.slabs",
      "tds.surcharge",
      "tds.cessRate",
      "tds.rebate87a",
      "tds.noPanRate",
    ]));
  });

  it("returns a null monthly TDS but keeps the two terms it can compute", () => {
    const year = parseFinancialYear("2026-27");
    const monthly = projectMonthlyTds({
      annualTax: { state: "blocked", amountMinor: null, blockedBy: ["tds.slabs"] },
      taxDeductedSoFarMinor: 4_500_000,
      year,
      asOfPeriod: "2026-09",
    });
    expect(monthly.amountMinor).toBeNull();
    expect(monthly.blockedBy).toEqual(["tds.slabs"]);
    expect(monthly.remainingMonths).toBe(6);
    expect(monthly.taxDeductedSoFarMinor).toBe(4_500_000);
  });
});

describe("tax deducted so far (SCR-054)", () => {
  it("sums the posted TDS lines and keeps provisional runs apart", () => {
    const summary = sumTaxDeducted(
      [
        { period: "2026-06", runStatus: "finalized", amountMinor: 1_500_000 },
        { period: "2026-04", runStatus: "paid", amountMinor: 1_200_000 },
        { period: "2026-05", runStatus: "closed", amountMinor: 1_300_000 },
        { period: "2026-09", runStatus: "calculated", amountMinor: 900_000 },
        { period: "2026-08", runStatus: "approved", amountMinor: 800_000 },
        { period: "2026-07", runStatus: "draft", amountMinor: 999_999 },
      ],
      DECLARATION,
    );
    expect(summary.state).toBe("computed");
    expect(summary.postedMinor).toBe(4_000_000);
    expect(summary.provisionalMinor).toBe(1_700_000);
    // A draft run has deducted nothing from anybody.
    expect(summary.postedMinor + summary.provisionalMinor).toBe(5_700_000);
    expect(summary.previousEmployerTdsMinor).toBe(2_000_000);
    expect(summary.periods.map((row) => row.period)).toEqual(["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
  });

  it("is zero, not null, when nothing has been deducted yet", () => {
    expect(sumTaxDeducted([]).postedMinor).toBe(0);
  });
});

describe("regime comparison (SCR-054)", () => {
  it("returns both sides, each with its own blocked list, and fabricates neither", () => {
    const gross = projectGross({ basicMinor: 5_000_000, structureLines: STRUCTURE, data: DECLARATION });
    const sections = summariseSections(DECLARATION, PACK);
    const hra = projectHra({ data: DECLARATION, monthlyComponentsMinor: gross.monthlyComponentsMinor, workLocation: "Bengaluru", pack: PACK });
    const regimes = compareRegimes({ selected: "old_regime", gross, sections, hra, pack: PACK });
    expect(regimes.map((regime) => regime.regime)).toEqual(["old_regime", "new_regime"]);
    expect(regimes.map((regime) => regime.selected)).toEqual([true, false]);
    for (const regime of regimes) {
      expect(regime.annualTax.amountMinor).toBeNull();
      expect(regime.taxableIncome.state).toBe("indeterminate");
      expect(regime.grossMinor).toBe(133_000_000);
      expect(regime.declaredDeductionsMinor).toBe(46_200_000);
      // Which heads each regime admits is itself an unsupplied rule, so the
      // comparison cannot silently disallow 80C on one side.
      expect(regime.admissibility.state).toBe("not_declared");
      expect(regime.blockedBy).toContain(REGIME_ADMISSIBILITY_RULE);
      expect(regime.blockedBy).toContain("tds.slabs");
    }
  });
});

describe("rejected heads (SCR-054)", () => {
  it("reverts a rejected head to zero and recomputes the section total", () => {
    const before = summariseSections(DECLARATION, PACK).find((section) => section.code === "80C");
    expect(before?.declaredMinor).toBe(18_500_000);
    const after = applyHeadDecisions(DECLARATION, { lifeInsuranceMinor: "rejected", elssMinor: "rejected" });
    const section = summariseSections(after, PACK).find((entry) => entry.code === "80C");
    expect(section?.declaredMinor).toBe(18_500_000 - 2_500_000 - 1_500_000);
    expect(section?.heads.find((head) => head.code === "lifeInsuranceMinor")?.declaredMinor).toBe(0);
    // A verified head is untouched, and the original record is not mutated.
    expect(applyHeadDecisions(DECLARATION, { elssMinor: "verified" }).elssMinor).toBe(1_500_000);
    expect(DECLARATION.lifeInsuranceMinor).toBe(2_500_000);
  });

  it("zeroes every head on a rejected declaration", () => {
    const outcome = headDecisionsForStatus("rejected");
    expect(outcome.rejectedHeadsUnidentified).toBe(false);
    const sections = summariseSections(applyHeadDecisions(DECLARATION, outcome.decisions), PACK);
    expect(totalDeclaredDeductions(sections)).toBe(0);
  });

  it("refuses to guess which heads a partial verification rejected", () => {
    const outcome = headDecisionsForStatus("partially_verified");
    expect(outcome.decisions).toEqual({});
    expect(outcome.rejectedHeadsUnidentified).toBe(true);
    expect(totalDeclaredDeductions(summariseSections(applyHeadDecisions(DECLARATION, outcome.decisions), PACK))).toBe(46_200_000);
  });

  it("only ever zeroes a known deduction head", () => {
    const after = applyHeadDecisions(DECLARATION, { previousEmployerIncomeMinor: "rejected" });
    expect(after.previousEmployerIncomeMinor).toBe(30_000_000);
    expect(DEDUCTION_HEAD_CODES).not.toContain("previousEmployerIncomeMinor");
  });
});

describe("regime switching (SCR-054)", () => {
  it("allows one switch and refuses the second", () => {
    const first = evaluateRegimeSwitch({ currentRegime: "old_regime", requestedRegime: "new_regime", priorSwitchCount: 0, freezeDate: "2026-12-31", today: "2026-09-14" });
    expect(first.allowed).toBe(true);
    const second = evaluateRegimeSwitch({ currentRegime: "new_regime", requestedRegime: "old_regime", priorSwitchCount: 1, freezeDate: "2026-12-31", today: "2026-09-14" });
    expect(second.allowed).toBe(false);
    expect(second.reason).toMatch(/already been switched once/);
  });

  it("refuses a switch after the freeze date", () => {
    const decision = evaluateRegimeSwitch({ currentRegime: "old_regime", requestedRegime: "new_regime", priorSwitchCount: 0, freezeDate: "2026-12-31", today: "2027-01-05" });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/frozen/);
  });

  it("says the freeze date is unconfigured rather than inventing one", () => {
    const decision = evaluateRegimeSwitch({ currentRegime: "old_regime", requestedRegime: "new_regime", priorSwitchCount: 0, freezeDate: null, today: "2026-09-14" });
    expect(decision.allowed).toBeNull();
    expect(decision.blockedBy).toEqual([REGIME_FREEZE_DATE_SETTING]);
  });

  it("treats re-electing the same regime as no switch at all", () => {
    expect(evaluateRegimeSwitch({ currentRegime: "old_regime", requestedRegime: "old_regime", priorSwitchCount: 1, freezeDate: null, today: "2026-09-14" }).allowed).toBe(true);
  });
});

describe("verifier remarks (SCR-054)", () => {
  it("demands substantive remarks on reject, partial verification and return", () => {
    for (const action of ["reject", "partiallyVerify", "return"]) {
      expect(verifierRemarksIssue(action, "no proof")).toMatch(/at least 10 characters/);
      expect(verifierRemarksIssue(action, "   ")).toMatch(/at least 10 characters/);
      expect(verifierRemarksIssue(action, "Rent receipts for Q2 are missing.")).toBeNull();
    }
  });

  it("still requires the audited reason the generic transition demands on other actions", () => {
    expect(verifierRemarksIssue("verify", "")).toMatch(/Enter a reason/);
    expect(verifierRemarksIssue("verify", "ok")).toMatch(/Enter a reason/);
    expect(verifierRemarksIssue("verify", "All proofs sighted")).toBeNull();
  });
});

describe("legal transitions (SCR-054)", () => {
  it("matches the states the operational catalog allows each action from", () => {
    expect(transitionAllowed("submit", "draft")).toBe(true);
    expect(transitionAllowed("submit", "returned")).toBe(true);
    expect(transitionAllowed("submit", "verified")).toBe(false);
    expect(transitionAllowed("verify", "proof_pending")).toBe(true);
    expect(transitionAllowed("verify", "draft")).toBe(false);
    expect(transitionAllowed("requestProof", "submitted")).toBe(true);
    expect(transitionAllowed("requestProof", "proof_pending")).toBe(false);
    expect(transitionAllowed("nonsense", "draft")).toBe(false);
  });
});

describe("assembled projection (SCR-054)", () => {
  it("computes what the data supports and blocks what the rule pack does not", () => {
    const projection = buildProjection(inputs({
      tdsRows: [
        { period: "2026-04", runStatus: "finalized", amountMinor: 1_000_000 },
        { period: "2026-05", runStatus: "finalized", amountMinor: 1_000_000 },
      ],
    }));
    expect(projection.gross.projectedAnnualGrossMinor).toBe(133_000_000);
    expect(projection.declaredDeductionsMinor).toBe(46_200_000);
    expect(projection.taxDeductedSoFar.postedMinor).toBe(2_000_000);
    expect(projection.taxableIncome.state).toBe("indeterminate");
    expect(projection.annualTax.amountMinor).toBeNull();
    expect(projection.monthlyTds.amountMinor).toBeNull();
    expect(projection.monthlyTds.remainingMonths).toBe(6);
    expect(projection.regime).toBe("old_regime");
    expect(projection.regimes).toHaveLength(2);
    expect(projection.blockedBy).toEqual(expect.arrayContaining(["tds.slabs", "hraExemption.metroPercent"]));
    expect(projection.rulePackCode).toBe("in-pay/v1");
  });

  it("recomputes from zero once the declaration is rejected", () => {
    const projection = buildProjection(inputs({ status: "rejected" }));
    expect(projection.declaredDeductionsMinor).toBe(0);
    // Gross is unaffected: a rejected proof does not change what the job pays.
    expect(projection.gross.projectedAnnualGrossMinor).toBe(133_000_000);
  });

  it("still projects the salary side when no declaration has been made", () => {
    const projection = buildProjection(inputs({ declarationId: null, status: "draft", version: null, data: {} }));
    expect(projection.gross.projectedAnnualGrossMinor).toBe(102_000_000);
    expect(projection.declaredDeductionsMinor).toBe(0);
    expect(projection.regime).toBeNull();
    expect(projection.sections).toHaveLength(DEDUCTION_SECTIONS.length);
  });
});

describe("declaration consistency (FRM-PAY-05)", () => {
  const withRent = {
    financialYear: "2026-27",
    rentPaidMonthlyMinor: 2_500_000,
    landlordName: "S. Rao",
    rentedAddress: "12 MG Road, Bengaluru",
    rentPeriodFrom: "2026-04-01",
    rentPeriodTo: "2027-03-31",
  };

  it("is silent on a declaration that carries nothing conditional", () => {
    expect(declarationIssues({ financialYear: "2026-27" })).toEqual([]);
  });

  it("requires the landlord, the address and the period once rent is declared", () => {
    const fields = declarationIssues({ financialYear: "2026-27", rentPaidMonthlyMinor: 2_500_000 }).map((issue) => issue.field);
    expect(fields).toContain("landlordName");
    expect(fields).toContain("rentedAddress");
    expect(fields).toContain("rentPeriodFrom");
    expect(declarationIssues(withRent)).toEqual([]);
  });

  it("keeps the rent period inside the financial year, and the right way round", () => {
    expect(declarationIssues({ ...withRent, rentPeriodFrom: "2026-03-31" }).map((issue) => issue.field)).toContain("rentPeriodFrom");
    expect(declarationIssues({ ...withRent, rentPeriodTo: "2027-04-01" }).map((issue) => issue.field)).toContain("rentPeriodTo");
    expect(declarationIssues({ ...withRent, rentPeriodFrom: "2026-09-01", rentPeriodTo: "2026-08-01" }).map((issue) => issue.field)).toContain("rentPeriodTo");
  });

  it("does not demand a landlord PAN while the threshold rule is unsupplied", () => {
    // `hraExemption.landlordPanThresholdMinor` is null in in-pay/v1: the test cannot be applied,
    // so a missing PAN is reported by `projectHra` as undecidable rather than refused here.
    expect(declarationIssues(withRent).map((issue) => issue.field)).not.toContain("landlordPan");
  });

  it("requires the lender's name and PAN once housing interest is declared", () => {
    const fields = declarationIssues({ financialYear: "2026-27", housingInterestSelfMinor: 20_000_000 }).map((issue) => issue.field);
    expect(fields).toEqual(["lenderName", "lenderPan"]);
    expect(declarationIssues({ financialYear: "2026-27", housingInterestLetOutMinor: 1, lenderName: "HDFC Ltd", lenderPan: "AAACH1234C" })).toEqual([]);
  });

  it("checks the shape of any PAN that is supplied, company PANs included", () => {
    expect(declarationIssues({ ...withRent, landlordPan: "ABCDE1234F" })).toEqual([]);
    // A lender is usually a company, so the fourth character is not restricted to "P".
    expect(declarationIssues({ financialYear: "2026-27", housingInterestSelfMinor: 1, lenderName: "HDFC Ltd", lenderPan: "AAACH1234C" })).toEqual([]);
    expect(declarationIssues({ ...withRent, landlordPan: "NOTAPAN" }).map((issue) => issue.field)).toEqual(["landlordPan"]);
  });

  it("reports a malformed financial year instead of throwing on it", () => {
    const issues = declarationIssues({ ...withRent, financialYear: "twenty twenty six" });
    expect(issues.map((issue) => issue.field)).toContain("financialYear");
  });
});
