import { describe, expect, it } from "vitest";
import { stripConsoleCode } from "./display-codes";

describe("stripConsoleCode", () => {
  it("removes a leading console code", () => expect(stripConsoleCode("S1: People Command Centre")).toBe("People Command Centre"));
  it("removes S10 and parenthesised codes", () => {
    expect(stripConsoleCode("S10: Workspace Governance")).toBe("Workspace Governance");
    expect(stripConsoleCode("Attendance (S3)")).toBe("Attendance");
  });
  it("keeps bare identifiers and ordinary text", () => {
    expect(stripConsoleCode("S1")).toBe("S1");
    expect(stripConsoleCode("Sales")).toBe("Sales");
  });
});
