import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ sqlClient: () => ({}) }));
vi.mock("@/server/platform/access", () => ({ enforce: vi.fn(), tenantTx: vi.fn() }));

const { createLegalEntitySchema, createLocationSchema } = await import("@/server/organization/establishment-master");

const entity = { entityCode: "ent-in", registeredName: "Example Industries Pvt Ltd", registeredAddress: "12 Main Road, Pune", currencyCode: "inr" };

describe("legal entity master", () => {
  it("normalises codes and currency to upper case", () => {
    expect(createLegalEntitySchema.parse(entity)).toMatchObject({ entityCode: "ENT-IN", currencyCode: "INR", status: "active" });
  });

  it("rejects malformed statutory identifiers", () => {
    expect(createLegalEntitySchema.safeParse({ ...entity, entityPan: "12345" }).success).toBe(false);
    expect(createLegalEntitySchema.safeParse({ ...entity, gstin: "XX" }).success).toBe(false);
    expect(createLegalEntitySchema.safeParse({ ...entity, entityPan: "abcde1234f" }).success).toBe(true);
  });

  it("requires the registered address and a three-letter currency", () => {
    expect(createLegalEntitySchema.safeParse({ ...entity, registeredAddress: "" }).success).toBe(false);
    expect(createLegalEntitySchema.safeParse({ ...entity, currencyCode: "RUPEE" }).success).toBe(false);
  });
});

describe("location master", () => {
  const location = { locationCode: "pune-1", locationName: "Pune Plant" };

  it("accepts a minimal location with a valid time zone", () => {
    expect(createLocationSchema.parse(location)).toMatchObject({ locationCode: "PUNE-1", timeZone: "Asia/Kolkata" });
  });

  it("rejects an unknown time zone and a malformed geofence", () => {
    expect(createLocationSchema.safeParse({ ...location, timeZone: "Mars/Olympus" }).success).toBe(false);
    expect(createLocationSchema.safeParse({ ...location, geofencePoint: "north" }).success).toBe(false);
  });
});
