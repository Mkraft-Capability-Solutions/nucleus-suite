import { describe, expect, it } from "vitest";
import { HttpError } from "@/server/platform/http";

import { picklists } from "@/lib/picklists";

import {
  BANK_FILE_FORMATS,
  prepareBatchSchema,
  releaseBatchSchema,
  EXCLUSION_REASON_LABELS,
  assertBatchMutable,
  assertDualControl,
  assertExclusionsReconcile,
  assertOutOfBandVerified,
  assertRunReleasable,
  assertTotalMatchesNetPay,
  bankDetailChangeWarnings,
  bankFileName,
  batchTimeline,
  buildBankFile,
  checksum,
  classifyAccount,
  formatAmount,
  maskAccount,
  pickPayableAccount,
  releaseBlockedReason,
  resolveBatchAction,
  type BankFileRow,
  type BatchState,
} from "./disbursement";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MAKER = "11111111-1111-4111-8111-111111111111";
const CHECKER = "22222222-2222-4222-8222-222222222222";

function row(overrides: Partial<BankFileRow> & Pick<BankFileRow, "employeeId" | "amountMinor">): BankFileRow {
  return {
    employeeCode: `E-${overrides.employeeId.slice(0, 3)}`,
    employeeName: "Asha Menon",
    accountHolder: "Asha Menon",
    accountNumber: "50100123456789",
    routingCode: "HDFC0001234",
    bankName: "HDFC Bank",
    accountType: "salary",
    reference: "2026-09-E001",
    ...overrides,
  };
}

const rowA = row({ employeeId: "emp-a", amountMinor: 5_000_00, employeeCode: "E001", reference: "2026-09-E001" });
const rowB = row({
  employeeId: "emp-b",
  amountMinor: 3_250_50,
  employeeCode: "E002",
  employeeName: "Rahul Iyer",
  accountHolder: "Rahul Iyer",
  accountNumber: "00112233445566",
  routingCode: "ICIC0000456",
  bankName: "ICICI Bank",
  reference: "2026-09-E002",
});

const context = { valueDate: "2026-09-30", currency: "INR", debitAccountLabel: "Payroll operating account", batchReference: "BD-2026-09" };

// ---------------------------------------------------------------------------

describe("account masking (SCR-055)", () => {
  it("shows only the last four characters", () => {
    expect(maskAccount("50100123456789")).toBe("••••6789");
    expect(maskAccount("1234")).toBe("••••1234");
    expect(maskAccount("")).toBe("—");
  });

  it("never leaks any leading digit of a long account number", () => {
    const masked = maskAccount("50100123456789");
    expect(masked).not.toContain("5010012345");
    expect(masked.replace(/[^0-9]/g, "")).toHaveLength(4);
  });
});

describe("money rendering (SCR-055)", () => {
  it("renders integer minor units exactly", () => {
    expect(formatAmount(5_000_00)).toBe("5000.00");
    expect(formatAmount(3_250_50)).toBe("3250.50");
    expect(formatAmount(-1_00)).toBe("-1.00");
  });

  it("refuses fractional minor units rather than rounding them away", () => {
    expect(() => formatAmount(10.5)).toThrowError(HttpError);
  });
});

describe("total must equal the sum of net pay (SCR-055 / FRM-PAY-07)", () => {
  it("accepts a total that equals the sum of net pay", () => {
    expect(assertTotalMatchesNetPay(8_250_50, [rowA, rowB])).toBe(8_250_50);
  });

  it("names both figures and the difference on a mismatch", () => {
    let thrown: HttpError | null = null;
    try {
      assertTotalMatchesNetPay(8_000_00, [rowA, rowB]);
    } catch (error) {
      thrown = error as HttpError;
    }
    expect(thrown).toBeInstanceOf(HttpError);
    expect(thrown?.status).toBe(422);
    expect(thrown?.code).toBe("DISBURSEMENT_TOTAL_MISMATCH");
    // The declared total, the summed net pay and the difference are all stated.
    expect(thrown?.message).toContain("8000.00");
    expect(thrown?.message).toContain("8250.50");
    expect(thrown?.message).toContain("-250.50");
    expect(thrown?.details).toEqual([
      { field: "declaredTotalMinor", issue: "800000" },
      { field: "sumOfNetPayMinor", issue: "825050" },
    ]);
  });
});

describe("exclusions reconcile with count and total (SCR-055)", () => {
  const excluded = [{ amountMinor: 1_749_50 }];

  it("reconciles when the file plus the exclusions account for the whole run", () => {
    expect(
      assertExclusionsReconcile({ runPopulation: 3, runNetMinor: 10_000_00, includedRows: [rowA, rowB], excluded }),
    ).toEqual({ accountCount: 2, totalAmountMinor: 8_250_50, excludedCount: 1, excludedAmountMinor: 1_749_50 });
  });

  it("refuses when the headcount does not add up", () => {
    let thrown: HttpError | null = null;
    try {
      assertExclusionsReconcile({ runPopulation: 5, runNetMinor: 10_000_00, includedRows: [rowA, rowB], excluded });
    } catch (error) {
      thrown = error as HttpError;
    }
    expect(thrown?.code).toBe("DISBURSEMENT_RECONCILIATION_FAILED");
    expect(thrown?.message).toContain("2 paid");
    expect(thrown?.message).toContain("1 excluded");
    expect(thrown?.message).toContain("run population of 5");
  });

  it("refuses when the money does not add back up to the run's net pay", () => {
    let thrown: HttpError | null = null;
    try {
      assertExclusionsReconcile({ runPopulation: 3, runNetMinor: 12_000_00, includedRows: [rowA, rowB], excluded });
    } catch (error) {
      thrown = error as HttpError;
    }
    expect(thrown?.code).toBe("DISBURSEMENT_RECONCILIATION_FAILED");
    expect(thrown?.message).toContain("8250.50");
    expect(thrown?.message).toContain("1749.50");
    expect(thrown?.message).toContain("12000.00");
  });
});

describe("exclusion reasons (SCR-055)", () => {
  const usable = { status: "active", accountNumber: "50100123456789", routingCode: "HDFC0001234" };

  it("includes an employee with an active, complete account and positive net pay", () => {
    expect(classifyAccount({ amountMinor: 5_000_00, account: usable })).toBeNull();
  });

  it("states a reason for every unusable account", () => {
    expect(classifyAccount({ amountMinor: 5_000_00, account: null })).toBe("no_bank_account");
    expect(classifyAccount({ amountMinor: 5_000_00, account: { ...usable, status: "archived" } })).toBe("account_inactive");
    expect(classifyAccount({ amountMinor: 5_000_00, account: { ...usable, routingCode: "  " } })).toBe("account_incomplete");
    expect(classifyAccount({ amountMinor: 0, account: usable })).toBe("zero_or_negative_net");
  });

  it("carries a human-readable reason for each code", () => {
    for (const label of Object.values(EXCLUSION_REASON_LABELS)) expect(label.length).toBeGreaterThan(10);
  });

  it("pays the current active account when an employee has several", () => {
    const accounts = [
      { id: "old", status: "archived", effectiveFrom: "2024-01-01", effectiveTo: null },
      { id: "current", status: "active", effectiveFrom: "2026-01-01", effectiveTo: null },
    ];
    expect(pickPayableAccount(accounts, "2026-09-30")?.id).toBe("current");
  });
});

describe("checksum (SCR-055)", () => {
  it("is deterministic for the same rows", () => {
    expect(checksum([rowA, rowB])).toBe(checksum([rowA, rowB]));
  });

  it("ignores the order rows happen to be read in", () => {
    expect(checksum([rowA, rowB])).toBe(checksum([rowB, rowA]));
  });

  it("changes when an amount changes", () => {
    expect(checksum([rowA, rowB])).not.toBe(checksum([rowA, { ...rowB, amountMinor: rowB.amountMinor + 1 }]));
  });

  it("changes when a destination account changes", () => {
    expect(checksum([rowA, rowB])).not.toBe(checksum([rowA, { ...rowB, accountNumber: "00112233445567" }]));
  });

  it("changes when a routing code changes", () => {
    expect(checksum([rowA, rowB])).not.toBe(checksum([rowA, { ...rowB, routingCode: "ICIC0000999" }]));
  });

  it("changes when a row is dropped", () => {
    expect(checksum([rowA, rowB])).not.toBe(checksum([rowA]));
  });
});

describe("bank file formats (SCR-055 / PL_BANK_FORMAT)", () => {
  it("offers exactly the eight formats the vocabulary names", () => {
    expect([...BANK_FILE_FORMATS]).toEqual([
      "hdfc_enet",
      "icici_cib",
      "sbi_cinb",
      "axis_corporate",
      "kotak_fyn",
      "yes_bank",
      "npci_nach",
      "generic_csv",
    ]);
  });

  it("HDFC ENet writes detail records only, comma separated, with no header", () => {
    const lines = buildBankFile("hdfc_enet", [rowA, rowB], context).split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("NEFT,Asha Menon,50100123456789,5000.00,HDFC0001234,2026-09-E001,2026-09-30");
  });

  it("ICICI CIB writes a header row followed by one detail row per payment", () => {
    const lines = buildBankFile("icici_cib", [rowA, rowB], context).split("\n");
    expect(lines[0]).toBe("PYMT_MODE,BENE_NAME,BENE_ACCT_NO,BENE_IFSC,AMOUNT,CURRENCY,VALUE_DATE,REMARKS");
    expect(lines).toHaveLength(3);
    expect(lines[2]).toBe("NEFT,Rahul Iyer,00112233445566,ICIC0000456,3250.50,INR,2026-09-30,2026-09-E002");
  });

  it("SBI CINB writes pipe-delimited details and a trailer carrying the control totals", () => {
    const lines = buildBankFile("sbi_cinb", [rowA, rowB], context).split("\n");
    expect(lines[0].startsWith("D|")).toBe(true);
    expect(lines[2]).toBe("T|2|8250.50");
  });

  it("Axis Corporate writes a header, details and a trailer", () => {
    const lines = buildBankFile("axis_corporate", [rowA, rowB], context).split("\n");
    expect(lines[0]).toBe("H,BD-2026-09,Payroll operating account,2026-09-30,INR");
    expect(lines[1].startsWith("D,")).toBe(true);
    expect(lines[3]).toBe("T,2,8250.50");
  });

  it("Kotak FYN leads every row with the client code", () => {
    const lines = buildBankFile("kotak_fyn", [rowA], context).split("\n");
    expect(lines[0]).toBe("Client Code,Payment Type,Beneficiary Name,Beneficiary Account,IFSC,Amount,Payment Date,Narration");
    expect(lines[1].startsWith("BD-2026-09,NEFT,")).toBe(true);
  });

  it("Yes Bank names the debit account on every row", () => {
    const lines = buildBankFile("yes_bank", [rowA], context).split("\n");
    expect(lines[1]).toContain("Payroll operating account");
  });

  it("NPCI NACH writes fixed-width 106-character credit records", () => {
    const lines = buildBankFile("npci_nach", [rowA, rowB], context).split("\n");
    expect(lines).toHaveLength(2);
    for (const line of lines) expect(line).toHaveLength(106);
    expect(lines[0].slice(0, 2)).toBe("67");
    expect(lines[0].slice(2, 37).trim()).toBe("50100123456789");
    // Amount is carried in paise, right justified and zero filled.
    expect(lines[0].slice(37, 50)).toBe("0000000500000");
    expect(lines[0].slice(50, 61)).toBe("HDFC0001234");
  });

  it("Generic CSV carries the full payment detail under a named header", () => {
    const lines = buildBankFile("generic_csv", [rowA], context).split("\n");
    expect(lines[0]).toBe("employee_code,employee_name,account_holder,account_number,routing_code,bank_name,account_type,amount,currency,value_date,reference");
    expect(lines[1]).toBe("E001,Asha Menon,Asha Menon,50100123456789,HDFC0001234,HDFC Bank,salary,5000.00,INR,2026-09-30,2026-09-E001");
  });

  it("produces a distinct file for every format from the same rows", () => {
    const produced = BANK_FILE_FORMATS.map((format) => buildBankFile(format, [rowA, rowB], context));
    expect(new Set(produced).size).toBe(BANK_FILE_FORMATS.length);
  });

  it("is pure: the same rows and context always produce the same bytes", () => {
    for (const format of BANK_FILE_FORMATS) {
      expect(buildBankFile(format, [rowA, rowB], context)).toBe(buildBankFile(format, [rowA, rowB], context));
    }
  });

  it("neutralises a delimiter smuggled into a beneficiary name", () => {
    const hostile = row({ employeeId: "emp-c", amountMinor: 100_00, accountHolder: "Eve,9999999999", employeeCode: "E003" });
    const line = buildBankFile("generic_csv", [hostile], context).split("\n")[1];
    expect(line.split(",")).toHaveLength(11);
  });

  it("names the file after the format and period", () => {
    expect(bankFileName("hdfc_enet", "2026-09", "abcdef12-3456-4789-8abc-def012345678")).toBe("hdfc-enet-2026-09-ABCDEF.csv");
    expect(bankFileName("npci_nach", "2026-09", "abcdef12-3456-4789-8abc-def012345678")).toBe("npci-nach-2026-09-ABCDEF.txt");
  });
});

describe("dual control (SCR-055 / PAY-09.4)", () => {
  it("allows a releaser distinct from the preparer", () => {
    expect(() => assertDualControl(MAKER, CHECKER)).not.toThrow();
  });

  it("refuses the same maker and checker with 403", () => {
    let thrown: HttpError | null = null;
    try {
      assertDualControl(MAKER, MAKER);
    } catch (error) {
      thrown = error as HttpError;
    }
    expect(thrown?.status).toBe(403);
    expect(thrown?.code).toBe("FORBIDDEN");
    expect(thrown?.message).toContain("maker/checker");
  });

  it("refuses release when no preparer was recorded, so dual control cannot be evidenced", () => {
    expect(() => assertDualControl(null, CHECKER)).toThrowError(HttpError);
  });
});

describe("release preconditions (SCR-055)", () => {
  const verified = { state: "verified" as BatchState, outOfBandVerified: true, preparedBy: MAKER };

  it("permits release once verification and dual control are both satisfied", () => {
    expect(releaseBlockedReason(verified, CHECKER)).toBeNull();
  });

  it("refuses release without out-of-band verification", () => {
    expect(releaseBlockedReason({ ...verified, state: "prepared", outOfBandVerified: false }, CHECKER)).toContain("Out-of-band verification");
    let thrown: HttpError | null = null;
    try {
      assertOutOfBandVerified({ outOfBandVerified: false });
    } catch (error) {
      thrown = error as HttpError;
    }
    expect(thrown?.status).toBe(422);
    expect(thrown?.code).toBe("DISBURSEMENT_VERIFICATION_MISSING");
  });

  it("states dual control as the reason when the preparer tries to release", () => {
    expect(releaseBlockedReason(verified, MAKER)).toContain("a different person must release it");
  });

  it("refuses a verified batch that is somehow still only prepared", () => {
    expect(releaseBlockedReason({ ...verified, state: "prepared" }, CHECKER)).toContain("must be verified");
  });

  it("refuses an already released, superseded or failed batch", () => {
    expect(releaseBlockedReason({ ...verified, state: "released" }, CHECKER)).toContain("already been released");
    expect(releaseBlockedReason({ ...verified, state: "superseded" }, CHECKER)).toContain("superseded");
    expect(releaseBlockedReason({ ...verified, state: "failed" }, CHECKER)).toContain("returned credits");
  });

  it("only generates a bank file for an approved or finalized run", () => {
    expect(() => assertRunReleasable({ id: "run-1", status: "approved" })).not.toThrow();
    expect(() => assertRunReleasable({ id: "run-1", status: "finalized" })).not.toThrow();
    for (const status of ["draft", "calculated"]) {
      let thrown: HttpError | null = null;
      try {
        assertRunReleasable({ id: "run-1", status });
      } catch (error) {
        thrown = error as HttpError;
      }
      expect(thrown?.status).toBe(409);
      expect(thrown?.message).toContain(status);
    }
  });
});

describe("a released batch cannot be mutated (SCR-055 / RL-323)", () => {
  it("allows a prepared or verified batch to be changed", () => {
    expect(() => assertBatchMutable("prepared")).not.toThrow();
    expect(() => assertBatchMutable("verified")).not.toThrow();
  });

  it("refuses to edit a released batch and points at arrears", () => {
    let thrown: HttpError | null = null;
    try {
      assertBatchMutable("released");
    } catch (error) {
      thrown = error as HttpError;
    }
    expect(thrown?.status).toBe(409);
    expect(thrown?.code).toBe("DISBURSEMENT_RELEASED");
    expect(thrown?.message).toContain("arrears");
  });

  it("refuses to regenerate over a released batch", () => {
    expect(() => resolveBatchAction({ id: "batch-1", state: "released", fingerprint: "abc" }, "different")).toThrowError(HttpError);
    // Even an identical regeneration is refused: a released batch is a payment record.
    expect(() => resolveBatchAction({ id: "batch-1", state: "released", fingerprint: "abc" }, "abc")).toThrowError(HttpError);
  });

  it("creates the first batch, replays an unchanged one and supersedes a changed one", () => {
    expect(resolveBatchAction(null, "abc")).toEqual({ action: "create" });
    expect(resolveBatchAction({ id: "batch-1", state: "prepared", fingerprint: "abc" }, "abc")).toEqual({ action: "unchanged", batchId: "batch-1" });
    expect(resolveBatchAction({ id: "batch-1", state: "verified", fingerprint: "abc" }, "xyz")).toEqual({ action: "supersede", batchId: "batch-1" });
  });

  it("starts a fresh batch after the previous one was superseded, keeping the old record", () => {
    expect(resolveBatchAction({ id: "batch-1", state: "superseded", fingerprint: "abc" }, "xyz")).toEqual({ action: "create" });
  });
});

describe("bank-detail change alerts inside the payroll window (SCR-055 / RL-322)", () => {
  const accounts = [
    { bankAccountId: "acct-a", employeeId: "emp-a", employeeCode: "E001", employeeName: "Asha Menon", updatedAt: "2026-09-28T10:00:00.000Z" },
    { bankAccountId: "acct-b", employeeId: "emp-b", employeeCode: "E002", employeeName: "Rahul Iyer", updatedAt: "2026-09-10T10:00:00.000Z" },
  ];

  it("flags only accounts changed after the run was calculated", () => {
    const warnings = bankDetailChangeWarnings(accounts, "2026-09-20T00:00:00.000Z");
    expect(warnings.map((warning) => warning.employeeCode)).toEqual(["E001"]);
    expect(warnings[0].message).toContain("2026-09-28");
    expect(warnings[0].message).toContain("2026-09-20");
  });

  it("flags nothing when no account moved inside the window", () => {
    expect(bankDetailChangeWarnings(accounts, "2026-09-30T00:00:00.000Z")).toEqual([]);
  });

  it("cannot judge the window when the run has no recorded calculation", () => {
    expect(bankDetailChangeWarnings(accounts, null)).toEqual([]);
  });
});

describe("state timeline (SCR-055)", () => {
  it("walks Prepared → Verified → Released", () => {
    expect(batchTimeline("prepared").map((step) => step.state)).toEqual(["current", "todo", "todo"]);
    expect(batchTimeline("verified").map((step) => step.state)).toEqual(["done", "current", "todo"]);
    expect(batchTimeline("released").map((step) => step.state)).toEqual(["done", "done", "current"]);
  });

  it("shows Failed as a fourth state after release", () => {
    const steps = batchTimeline("failed");
    expect(steps.map((step) => step.key)).toEqual(["prepared", "verified", "released", "failed"]);
    expect(steps[3].state).toBe("current");
  });
});

describe("bank file header schema (FRM-PAY-07)", () => {
  const today = new Date().toISOString().slice(0, 10);
  const base = {
    payrollRunId: "123e4567-e89b-12d3-a456-426614174000",
    format: "hdfc_enet",
    disbursingAccountLabel: "Payroll operating account",
    disbursingAccountNumber: "000111222333",
    valueDate: today,
    currency: "INR",
  };

  it("takes its bank formats from PL_BANK_FORMAT, not a hand-typed list", () => {
    expect([...BANK_FILE_FORMATS]).toEqual(picklists.PL_BANK_FORMAT.values.map((option) => option.value));
    expect(prepareBatchSchema.safeParse(base).success).toBe(true);
    // The bank's own display name is no longer the stored value.
    expect(prepareBatchSchema.safeParse({ ...base, format: "HDFC ENet" }).success).toBe(false);
  });

  it("refuses a value date before today", () => {
    expect(prepareBatchSchema.safeParse({ ...base, valueDate: "2020-01-01" }).success).toBe(false);
    expect(prepareBatchSchema.safeParse({ ...base, valueDate: "2099-12-31" }).success).toBe(true);
    expect(prepareBatchSchema.safeParse({ ...base, valueDate: "31-12-2099" }).success).toBe(false);
  });

  it("treats release remarks as optional Char(200), because dual control is the real guard", () => {
    expect(releaseBatchSchema.safeParse({}).success).toBe(true);
    expect(releaseBatchSchema.safeParse({ releaseRemarks: "Confirmed by treasury on call" }).success).toBe(true);
    expect(releaseBatchSchema.safeParse({ releaseRemarks: "x".repeat(201) }).success).toBe(false);
  });
});
