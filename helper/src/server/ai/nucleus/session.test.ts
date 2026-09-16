import { describe, expect, it, vi } from "vitest";
import {
  buildLiveSetup,
  buildSystemInstruction,
  liveSocketUrl,
  mintEphemeralToken,
  tokenRequestBody,
} from "@/server/ai/nucleus/session";
import type { Access } from "@/server/platform/access";

/**
 * The security argument for letting the browser hold the socket rests entirely
 * on the token being bound to a setup at mint time. These tests assert that
 * binding, and that the tool list inside it is the caller's own.
 */

function accessWith(permissions: string[], roles: string[] = ["hr-manager"]): Access {
  return {
    tenantId: "tenant-1",
    context: {
      actorUserId: "user-1",
      membershipId: "membership-1",
      tenantId: "tenant-1",
      employeeId: "employee-1",
      permissions,
      roles,
    },
  };
}

const FACTS = { today: "2026-09-15", tenantId: "tenant-1", roles: ["hr-manager"], employeeId: "employee-1" };

describe("system instruction", () => {
  it("states the date, so a relative date can be resolved", () => {
    expect(buildSystemInstruction({ ...FACTS, actionNames: [] })).toContain("2026-09-15");
  });

  it("forbids substituting zero for an unavailable figure", () => {
    const instruction = buildSystemInstruction({ ...FACTS, actionNames: [] });
    expect(instruction).toContain("Never say zero");
    expect(instruction).toContain("available");
  });

  it("forbids inventing an identifier and requires the directory lookup", () => {
    expect(buildSystemInstruction({ ...FACTS, actionNames: ["apply_leave"] })).toContain("find_employee");
  });

  it("says a tool call only prepares a draft", () => {
    expect(buildSystemInstruction({ ...FACTS, actionNames: ["apply_leave"] })).toContain("Nothing is written until the person confirms");
  });

  it("tells a caller with no actions that it cannot act, rather than listing nothing", () => {
    expect(buildSystemInstruction({ ...FACTS, actionNames: [] })).toContain("may not draft any action");
  });

  it("does not offer self-service wording to a caller with no employee record", () => {
    const instruction = buildSystemInstruction({ ...FACTS, employeeId: null, actionNames: [] });
    expect(instruction).toContain("must always name the person");
  });
});

describe("live setup", () => {
  it("declares only the tools the caller may use", () => {
    const setup = buildLiveSetup(accessWith(["employee.read"]), FACTS) as {
      tools: Array<{ functionDeclarations: Array<{ name: string }> }>;
    };
    const names = setup.tools[0].functionDeclarations.map((declaration) => declaration.name);
    expect(names).toContain("workforce_analysis");
    expect(names).not.toContain("apply_leave");
    expect(names).not.toContain("record_attendance_punches");
  });

  it("adds an action once the caller holds its permission", () => {
    const setup = buildLiveSetup(accessWith(["employee.read", "leave.read"]), FACTS) as {
      tools: Array<{ functionDeclarations: Array<{ name: string }> }>;
    };
    expect(setup.tools[0].functionDeclarations.map((declaration) => declaration.name)).toContain("apply_leave");
  });

  it("asks for audio out and a transcript of both directions", () => {
    const setup = buildLiveSetup(accessWith(["employee.read"]), FACTS) as Record<string, unknown>;
    expect(setup.generationConfig).toMatchObject({ responseModalities: ["AUDIO"] });
    expect(setup.inputAudioTranscription).toBeDefined();
    expect(setup.outputAudioTranscription).toBeDefined();
  });
});

describe("token minting", () => {
  const setup = { model: "models/test", tools: [] };

  it("binds the token to the setup, to one use and to a short window", () => {
    const body = tokenRequestBody(setup, new Date("2026-09-15T10:00:00.000Z"));
    expect(body.uses).toBe(1);
    expect(body.bidiGenerateContentSetup).toBe(setup);
    expect(body.newSessionExpireTime).toBe("2026-09-15T10:02:00.000Z");
    expect(body.expireTime).toBe("2026-09-15T10:30:00.000Z");
  });

  it("refuses to open a session when no key is configured, and names the variable", async () => {
    // An absent `apiKey` option falls through to `googleApiKey()`, which reads
    // process.env — and the test setup loads .env.local, so a developer who has
    // the key configured would otherwise reach the fetch instead of the guard.
    // Unset it for this assertion so the test describes the code, not the box.
    const configured = process.env.GOOGLE_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    try {
      await expect(mintEphemeralToken(setup, { apiKey: undefined, fetchImpl: vi.fn() })).rejects.toThrow("GOOGLE_API_KEY");
    } finally {
      if (configured !== undefined) process.env.GOOGLE_API_KEY = configured;
    }
  });

  it("sends the key as a header and never in the URL", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ name: "auth_tokens/abc" }), { status: 200 }));
    await mintEphemeralToken(setup, { apiKey: "secret-key", fetchImpl: fetchImpl as unknown as typeof fetch });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain("secret-key");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("secret-key");
  });

  it("returns the token name the socket needs", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ name: "auth_tokens/abc" }), { status: 200 }));
    const minted = await mintEphemeralToken(setup, { apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(minted.token).toBe("auth_tokens/abc");
  });

  it("tries the other API version when one does not exist", async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url.includes("v1alpha")
        ? new Response("no such version", { status: 404 })
        : new Response(JSON.stringify({ name: "auth_tokens/xyz" }), { status: 200 }),
    );
    const minted = await mintEphemeralToken(setup, { apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(minted.token).toBe("auth_tokens/xyz");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("surfaces the provider's own rejection rather than a generic failure", async () => {
    const fetchImpl = vi.fn(async () => new Response("Cannot find field: bidiGenerateContentSetup", { status: 400 }));
    await expect(mintEphemeralToken(setup, { apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch }))
      .rejects.toThrow("Cannot find field");
    // A rejection is a rejection: retrying the identical body would only repeat it.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("socket url", () => {
  it("uses the constrained endpoint, which is the one ephemeral tokens may open", () => {
    expect(liveSocketUrl("auth_tokens/abc")).toContain("BidiGenerateContentConstrained");
  });

  it("escapes the token into the query string", () => {
    expect(liveSocketUrl("auth_tokens/abc")).toContain("access_token=auth_tokens%2Fabc");
  });
});
