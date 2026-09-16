import { describe, expect, it } from "vitest";
import { spokenDraftIntent } from "./nucleus-session-provider";

/**
 * Saying "confirm" now submits a drafted action, which makes this matcher a
 * write control. The risk it has to survive is not the happy path — it is the
 * sentence that contains the word and means the opposite. A substring test
 * would write a leave request on "don't confirm that yet", so the rule is that
 * the whole utterance must be the confirmation and nothing else.
 */

describe("spoken draft intent", () => {
  it("accepts the word on its own, with the fillers people actually say", () => {
    for (const utterance of [
      "confirm",
      "Confirm.",
      "confirm it",
      "confirm that",
      "ok confirm",
      "okay, confirm",
      "yes confirm",
      "yeah, confirm it",
      "please confirm",
      "go ahead and confirm",
      "confirm please",
    ]) {
      expect(spokenDraftIntent(utterance), utterance).toBe("confirm");
    }
  });

  it("refuses a sentence that merely contains the word", () => {
    for (const utterance of [
      "don't confirm that yet",
      "do not confirm",
      "confirm it with HR first",
      "can you confirm the balance before we do this",
      "I need to confirm something with my manager",
      "why would I confirm a draft I cannot see",
      "confirm the number of days is right",
    ]) {
      expect(spokenDraftIntent(utterance), utterance).not.toBe("confirm");
    }
  });

  it("recognises a bare cancellation the same way", () => {
    expect(spokenDraftIntent("cancel")).toBe("cancel");
    expect(spokenDraftIntent("no, cancel it")).toBe("cancel");
    expect(spokenDraftIntent("cancel that please")).toBe("cancel");
    expect(spokenDraftIntent("cancel my leave for next Tuesday")).toBeNull();
  });

  it("ignores empty and long utterances", () => {
    expect(spokenDraftIntent("")).toBeNull();
    expect(spokenDraftIntent("   ")).toBeNull();
    expect(spokenDraftIntent(`confirm ${"a".repeat(60)}`)).toBeNull();
  });

  it("returns null for ordinary speech, so the model keeps handling it", () => {
    expect(spokenDraftIntent("apply leave for me next week")).toBeNull();
    expect(spokenDraftIntent("what is my leave balance")).toBeNull();
  });
});
