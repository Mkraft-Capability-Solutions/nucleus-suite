import { describe, expect, it } from "vitest";
import { avatarDataUri, avatarInitials } from "./avatar";

describe("avatarInitials", () => {
  it("uses first and last initials", () => {
    expect(avatarInitials("Asha Verma")).toBe("AV");
  });
  it("uses one letter for single names and ? for empty input", () => {
    expect(avatarInitials("Asha")).toBe("A");
    expect(avatarInitials("")).toBe("?");
    expect(avatarInitials(undefined)).toBe("?");
  });
});

describe("avatarDataUri", () => {
  it("returns an offline SVG data URI, never an external URL", () => {
    const uri = avatarDataUri("Asha Verma");
    expect(uri.startsWith("data:image/svg+xml")).toBe(true);
    expect(uri).not.toContain("ui-avatars");
  });
});
