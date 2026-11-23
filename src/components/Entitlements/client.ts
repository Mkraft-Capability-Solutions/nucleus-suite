import type { EntitlementChange, SaveResult } from "./EntitlementsEditor";

/** PATCH a list of entitlement changes and normalise the API's success/error envelopes. */
export async function patchEntitlements(url: string, changes: EntitlementChange[]): Promise<SaveResult> {
  try {
    const response = await fetch(url, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changes }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        error: {
          message: body?.error?.message ?? body?.detail ?? body?.title ?? "The change could not be saved.",
          details: body?.error?.details ?? body?.errors ?? [],
        },
      };
    }
    return { tree: body?.data?.tree };
  } catch {
    return { error: { message: "The server could not be reached. Try again." } };
  }
}
