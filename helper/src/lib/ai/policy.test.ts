import { afterEach, describe, expect, it } from "vitest";
import { askMira } from "./policy-graph";
import { approvedPolicyCorpus, retrievePolicyPassages } from "./policy-corpus";

afterEach(() => { delete process.env.OPENAI_API_KEY; });

describe("approved policy retrieval", () => {
  it("keeps unique traceable passage IDs", () => expect(new Set(approvedPolicyCorpus.map((item) => item.id)).size).toBe(approvedPolicyCorpus.length));
  it("ranks COFF policy for an expiry question", () => expect(retrievePolicyPassages("When does COFF expiry happen?")[0].id).toBe("LEV-RULES"));
  it("returns no invented context for an unrelated question", () => expect(retrievePolicyPassages("What is the cafeteria menu?")).toEqual([]));
  it("limits retrieved evidence", () => expect(retrievePolicyPassages("attendance salary leave loan overtime", 2)).toHaveLength(2));
});

describe("Mira policy graph", () => {
  it("returns a cited, grounded policy answer without a configured model", async () => {
    const result = await askMira("Who is exempt from late attendance deduction?");
    expect(result.answer).toContain("Assistant Manager");
    expect(result.sources[0]).toContain("Attendance Policy 2026");
  });
  it("refuses to execute consequential actions", async () => expect((await askMira("Approve this leave request now")).answer).toContain("cannot execute"));
  it("escalates when approved evidence is missing", async () => expect((await askMira("What is lunch today?")).answer).toContain("could not find"));
});
