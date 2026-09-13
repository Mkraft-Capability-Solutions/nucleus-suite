import { afterEach, describe, expect, it, vi } from "vitest";
import { getJson, invalidateGetRequest, invalidateGetRequests } from "./client-api";

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
