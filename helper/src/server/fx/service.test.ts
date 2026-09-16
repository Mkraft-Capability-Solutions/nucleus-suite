import { describe, expect, it } from "vitest";
import { convertMinor, quoteFxSchema } from "@/server/fx/service";

describe("FX quote and conversion contracts", () => {
  it("validates ISO codes, positive rates and named sources", () => {
    const valid = { baseCode: "USD", quoteCode: "INR", rate: "84.00", source: "RBI_REFERENCE" };
    expect(quoteFxSchema.safeParse(valid).success).toBe(true);
    expect(quoteFxSchema.safeParse({ ...valid, baseCode: "usd" }).success).toBe(false);
    expect(quoteFxSchema.safeParse({ ...valid, rate: "0" }).success).toBe(false);
    expect(quoteFxSchema.safeParse({ ...valid, rate: "abc" }).success).toBe(false);
  });

  it("converts minor units through decimal-string rates without float drift", () => {
    expect(convertMinor(240_000, "84.00")).toBe(20_160_000);
    expect(convertMinor(1, "84.005")).toBe(84);
    expect(convertMinor(0, "84.00")).toBe(0);
  });
});
