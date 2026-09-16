import { afterEach, describe, expect, it, vi } from "vitest";
import { apiErrorMessage, getJson, invalidateGetRequest, invalidateGetRequests } from "./client-api";

afterEach(() => {
  invalidateGetRequests();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("getJson", () => {
  it("coalesces identical requests while the first request is in flight", async () => {
    let resolveResponse!: (response: Response) => void;
    const response = new Promise<Response>((resolve) => { resolveResponse = resolve; });
    const fetchMock = vi.fn(() => response);
    vi.stubGlobal("fetch", fetchMock);

    const first = getJson("/api/test/coalesced");
    const second = getJson("/api/test/coalesced");
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveResponse(Response.json({ data: { ok: true } }));
    await expect(first).resolves.toEqual({ data: { ok: true } });
  });

  it("retries one transient server failure", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ error: { message: "Busy" } }, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ data: { ok: true } }));
    vi.stubGlobal("fetch", fetchMock);

    const request = getJson("/api/test/retry");
    await vi.advanceTimersByTimeAsync(200);

    await expect(request).resolves.toEqual({ data: { ok: true } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a permanent client error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ error: { message: "Invalid request" } }, { status: 400 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getJson("/api/test/permanent")).rejects.toThrow("Invalid request");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not reuse an in-flight request after tenant context changes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ data: { ok: true } }));
    vi.stubGlobal("fetch", fetchMock);

    const beforeSwitch = getJson("/api/test/tenant-scoped");
    invalidateGetRequests();
    const afterSwitch = getJson("/api/test/tenant-scoped");

    await Promise.all([beforeSwitch, afterSwitch]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not reuse an in-flight request when a written resource is refreshed", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ data: { ok: true } }));
    vi.stubGlobal("fetch", fetchMock);

    const beforeWrite = getJson("/api/test/organization");
    invalidateGetRequest("/api/test/organization");
    const afterWrite = getJson("/api/test/organization");

    await Promise.all([beforeWrite, afterWrite]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("apiErrorMessage", () => {
  it("appends the field-level detail a validation failure carries", () => {
    const payload = {
      error: {
        code: "BAD_REQUEST",
        message: "The requisition payload is invalid.",
        details: [{ field: "justification", issue: "String must contain at least 30 character(s)" }],
      },
    };
    expect(apiErrorMessage(payload, 400, "fallback")).toBe(
      "The requisition payload is invalid. justification: String must contain at least 30 character(s)",
    );
  });

  it("keeps the message alone when the server sends no details", () => {
    expect(apiErrorMessage({ error: { message: "Approval was refused." } }, 422, "fallback")).toBe("Approval was refused.");
  });

  it("falls back when the body is not an error envelope", () => {
    expect(apiErrorMessage(null, 500, "The request failed.")).toBe("The request failed.");
  });

  it("names the fields even when the server omits a message", () => {
    const payload = { error: { details: [{ field: "to", issue: "Required" }] } };
    expect(apiErrorMessage(payload, 400, "The stage could not be advanced.")).toBe("The stage could not be advanced. to: Required");
  });
});
