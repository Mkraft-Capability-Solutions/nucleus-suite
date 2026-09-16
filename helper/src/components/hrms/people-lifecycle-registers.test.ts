import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("People + Lifecycle registers (Slice 1)", () => {
  const registers = readFileSync(resolve(process.cwd(), "src/components/hrms/people-lifecycle-registers.tsx"), "utf8");
  const moduleView = readFileSync(resolve(process.cwd(), "src/components/hrms/module-view.tsx"), "utf8");
  const guides = readFileSync(resolve(process.cwd(), "src/lib/workflow-catalog.ts"), "utf8");
  const dossierService = readFileSync(resolve(process.cwd(), "src/server/workflows/dossier-service.ts"), "utf8");

  it("promotes People & Lifecycle granular routes to bespoke pages", () => {
    for (const page of [
      "EmployeeRecordPage",
      "DocumentVaultPage",
      "JoiningChainConsolePage",
      "ClearanceBoardPage",
      "AssetRegisterPage",
      "LettersIssueRegisterPage",
      "PolicyAcknowledgementsPage",
      "EmployeeHomeActionsPage",
    ]) {
      expect(registers).toContain(`export function ${page}`);
      expect(moduleView).toContain(page);
    }
    for (const route of [
      '"employee-record": EmployeeRecordPage',
      '"document-vault": DocumentVaultPage',
      '"joining-chain-console": JoiningChainConsolePage',
      '"clearance-board": ClearanceBoardPage',
      '"asset-register": AssetRegisterPage',
      '"letters-issue-register": LettersIssueRegisterPage',
      '"policy-acknowledgements": PolicyAcknowledgementsPage',
      '"employee-home-actions": EmployeeHomeActionsPage',
    ]) {
      expect(moduleView).toContain(route);
    }
  });

  it("reads only governed endpoints without inventing numbers", () => {
    for (const path of [
      "/api/v1/people",
      "/timeline",
      "/api/v1/documents/vault",
      "/api/v1/onboarding/joining-chain",
      "/api/v1/onboarding/tasks/",
      "/api/v1/offboarding/clearance-board",
      "/api/v1/offboarding/items/",
      "/api/v1/assets/register",
      "/api/v1/letters/register",
      "/api/v1/policy-acknowledgements",
      "/api/v1/home/actions",
    ]) {
      expect(registers).toContain(path);
    }
    expect(registers).not.toMatch(/Math\.random|sample|demo/i);
  });

  it("covers loading, error, empty and restricted states", () => {
    // SCR-010 keeps its own StateBlock; the SCR-014..SCR-042 registers share the
    // RegisterStates scaffold, which carries the same status and alert roles.
    const scaffold = readFileSync(resolve(process.cwd(), "src/components/hrms/register-primitives.tsx"), "utf8");
    expect(registers).toContain('role="status"');
    expect(registers).toContain('role="alert"');
    expect(scaffold).toContain('role="status"');
    expect(scaffold).toContain('role="alert"');
    expect(registers).toContain("No employees yet");
    expect(registers).toContain("leave visibility restricted");
  });

  it("adds dossier totals without DB changes", () => {
    expect(dossierService).toContain("count(*)::int as total");
    expect(dossierService).toContain("total");
  });

  it("documents guides for the new registers", () => {
    for (const id of [
      '"employee-record"',
      '"document-vault"',
      '"joining-chain-console"',
      '"clearance-board"',
      '"asset-register"',
      '"letters-issue-register"',
      '"policy-acknowledgements"',
      '"employee-home-actions"',
    ]) {
      expect(guides).toContain(id);
    }
  });
});
