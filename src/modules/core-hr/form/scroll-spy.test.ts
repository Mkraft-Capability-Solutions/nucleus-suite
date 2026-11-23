import { describe, expect, it } from "vitest";
import { currentSection } from "./scroll-spy";

const sections = [{ id: "identity", top: 0 }, { id: "job", top: 600 }, { id: "contact", top: 1300 }, { id: "bank", top: 1900 }];
const view = (scrollTop: number) => ({ scrollTop, clientHeight: 700, scrollHeight: 2300 });

describe("employee form scroll spy", () => {
  it("starts on the first section", () => {
    expect(currentSection(sections, view(0))).toBe("identity");
  });

  it("moves on once a section's top passes the reading line", () => {
    expect(currentSection(sections, view(470))).toBe("identity");
    expect(currentSection(sections, view(490))).toBe("job");
    expect(currentSection(sections, view(1250))).toBe("contact");
  });

  it("marks the last section at the bottom, even when it is short", () => {
    expect(currentSection(sections, view(1600))).toBe("bank");
  });

  it("handles a form without sections", () => {
    expect(currentSection([], view(0))).toBeNull();
  });
});
