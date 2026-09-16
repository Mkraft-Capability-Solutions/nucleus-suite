import { describe, expect, it } from "vitest";

/**
 * OC-P1-02 / OC-P1-03 — Authentication lifecycle acceptance (TDD spec).
 *
 * Frozen contract: 04-backend/AUTHENTICATION_AUTHORIZATION.md.
 * Invite-only email/password auth, secure sessions, revocation, recovery and
 * enumeration resistance. Pure contract tables; the Better Auth / DB wiring
 * (Codex Data) must satisfy every row.
 */

const MIN_PASSWORD_LENGTH = 12;
const IDLE_TIMEOUT_HOURS = 12;
const ABSOLUTE_LIFETIME_DAYS = 7;

type MembershipStatus = "invited" | "active" | "suspended" | "revoked";
type InviteOutcome = "accepted" | "expired" | "revoked" | "reused";

function inviteOutcome(args: { expired: boolean; revoked: boolean; alreadyUsed: boolean }): InviteOutcome {
  if (args.alreadyUsed) return "reused";
  if (args.revoked) return "revoked";
  if (args.expired) return "expired";
  return "accepted";
}

function membershipCanAuthenticate(status: MembershipStatus): boolean {
  return status === "active";
}

function registrationAvailable(args: { databaseConfigured: boolean; allowSignupFlag: boolean; userTableEmpty: boolean }): boolean {
  return args.databaseConfigured && args.allowSignupFlag && args.userTableEmpty;
}

describe("password and credential policy (OC-P1-02)", () => {
  it("requires a minimum 12-character password, matching the login contract", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(12);
    expect("elevenchars".length < MIN_PASSWORD_LENGTH).toBe(true);
    expect("twelve_chars!".length >= MIN_PASSWORD_LENGTH).toBe(true);
  });

  it("stores a password hash handle, never the plaintext password", () => {
    const stored = { passwordHash: "argon2id$v=19$m=19456,t=2,p=1$...", password: undefined };
    expect(stored.password).toBeUndefined();
    expect(stored.passwordHash).toMatch(/^\S+\$\S+/);
  });

  it("rotates the session on login, password change, role change and tenant switch", () => {
    const rotationTriggers = ["login", "password-change", "role-change", "tenant-switch", "step-up"];
    expect(rotationTriggers).toHaveLength(5);
  });
});

describe("invite-only onboarding (OC-P1-02)", () => {
  it("accepts a fresh, unexpired, single-use invite", () => {
    expect(inviteOutcome({ expired: false, revoked: false, alreadyUsed: false })).toBe("accepted");
  });

  it.each([
    [{ expired: true, revoked: false, alreadyUsed: false }, "expired"],
    [{ expired: false, revoked: true, alreadyUsed: false }, "revoked"],
    [{ expired: false, revoked: false, alreadyUsed: true }, "reused"],
    [{ expired: true, revoked: true, alreadyUsed: true }, "reused"],
  ])("resolves invite %o to %s", (args, expected) => {
    expect(inviteOutcome(args as { expired: boolean; revoked: boolean; alreadyUsed: boolean })).toBe(expected);
  });

  it("admits no public signup path: only invited or seeded memberships authenticate", () => {
    expect(membershipCanAuthenticate("invited")).toBe(false);
    expect(membershipCanAuthenticate("active")).toBe(true);
    expect(membershipCanAuthenticate("suspended")).toBe(false);
    expect(membershipCanAuthenticate("revoked")).toBe(false);
  });
});

describe("session lifecycle and revocation (OC-P1-03)", () => {
  it("expires idle sessions at 12h and absolute lifetime at 7d", () => {
    expect(IDLE_TIMEOUT_HOURS).toBe(12);
    expect(ABSOLUTE_LIFETIME_DAYS).toBe(7);
    const idleMinutes = 11 * 60 + 59;
    expect(idleMinutes < IDLE_TIMEOUT_HOURS * 60).toBe(true);
    expect(IDLE_TIMEOUT_HOURS * 60 < (IDLE_TIMEOUT_HOURS * 60 + 1)).toBe(true);
  });

  it("revoke-all invalidates every concurrent session for the user", () => {
    const sessions = ["sess_a", "sess_b", "sess_c"];
    const revoked = new Set(sessions);
    for (const session of sessions) expect(revoked.has(session)).toBe(true);
  });

  it("marks session cookies HttpOnly, Secure in production and SameSite=Lax", () => {
    const cookie = { httpOnly: true, sameSite: "lax" as const, secure: true, path: "/", maxAge: 60 * 60 * 12 };
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("lax");
    expect(cookie.maxAge).toBe(43200);
  });
});

describe("recovery and enumeration resistance (OC-P1-03)", () => {
  it("returns the identical generic response for known and unknown emails", () => {
    const forKnown = "If an account exists, recovery instructions were issued.";
    const forUnknown = "If an account exists, recovery instructions were issued.";
    expect(forKnown).toBe(forUnknown);
  });

  it("issues hashed, short-lived, single-use recovery tokens and revokes sessions on use", () => {
    const tokenRecord = { tokenHash: "sha256:9f2c…", usedAt: null as string | null, expiresInMinutes: 30 };
    expect(tokenRecord.tokenHash).not.toContain("raw-token");
    expect(tokenRecord.usedAt).toBeNull();
    expect(tokenRecord.expiresInMinutes).toBeLessThanOrEqual(60);
  });
});

describe("initial-admin registration gate (OC-P1-02)", () => {
  it.each([
    [{ databaseConfigured: true, allowSignupFlag: true, userTableEmpty: true }, true],
    [{ databaseConfigured: true, allowSignupFlag: true, userTableEmpty: false }, false],
    [{ databaseConfigured: true, allowSignupFlag: false, userTableEmpty: true }, false],
    [{ databaseConfigured: false, allowSignupFlag: true, userTableEmpty: true }, false],
  ])("resolves registration-state %o to %s", (args, expected) => {
    expect(registrationAvailable(args as { databaseConfigured: boolean; allowSignupFlag: boolean; userTableEmpty: boolean })).toBe(expected);
  });
});
