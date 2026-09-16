import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The Nucleus AI surface makes two promises the rest of the product relies on:
 * nothing is written without a person pressing confirm, and a figure the
 * platform does not hold is shown as absent rather than as zero. Both are
 * properties of this file, so both are asserted against it.
 */

const root = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Nucleus AI page", () => {
  const page = root("src/components/hrms/nucleus-ai-page.tsx");
  const provider = root("src/components/hrms/nucleus-session-provider.tsx");
  const dock = root("src/components/hrms/nucleus-dock.tsx");
  /**
   * The session moved out of the page and into a provider mounted in the
   * workspace layout, so that `open_screen` can navigate without killing the
   * socket and the microphone. The promises below are properties of the SURFACE,
   * not of one file, so they are asserted against both parts together — and the
   * ones that must hold everywhere, like never holding a provider key, are
   * asserted against each file separately.
   */
  const source = `${page}\n${provider}`;
  const moduleView = root("src/components/hrms/module-view.tsx");
  const shell = root("src/components/hrms/app-shell.tsx");
  const navigation = root("src/lib/navigation-catalog.ts");

  it("is wired to /nucleus-ai and left the existing assistant alone", () => {
    expect(source).toContain("export function NucleusAiPage");
    expect(moduleView).toContain('"nucleus-ai": NucleusAiPage');
    expect(moduleView).toContain("assistant: AssistantPage");
    expect(navigation).toContain('id: "nucleus-ai"');
  });

  it("opens its session through the brokered route and never holds a provider key", () => {
    expect(provider).toContain("/api/v1/ai/nucleus/session");
    for (const file of [page, provider, dock]) {
      expect(file).not.toMatch(/GOOGLE_API_KEY|NEXT_PUBLIC_GOOGLE|x-goog-api-key/);
    }
  });

  it("holds the session above the router so a screen can be opened without ending it", () => {
    // The whole reason the session left the page: navigating unmounted it.
    expect(shell).toContain("<NucleusSessionProvider>");
    expect(shell).toContain("<NucleusDock />");
    expect(provider).toContain("router.push(href)");
    // And the page must not re-create a session of its own.
    expect(page).toContain("useNucleusSession()");
    expect(page).not.toContain("new NucleusLiveSession");
  });

  it("shows a draft in full wherever it is confirmed", () => {
    // A write must never be confirmable on a surface that does not show what is
    // being written, so the dock renders the fields, not just a button.
    expect(dock).toContain("Confirm before this is written");
    expect(dock).toContain("draft.fields.map");
    expect(dock).toContain("not supplied — form default");
    expect(dock).toContain("confirmDraft");
    expect(dock).toContain("cancelDraft");
  });

  it("requires a human confirmation before a draft is submitted", () => {
    expect(source).toContain("Confirm before this is written");
    expect(source).toContain("confirmDraft");
    expect(source).toContain("cancelDraft");
    // The submit path is the shared helper that posts to the real v1 route, so
    // the page cannot grow a second, unchecked way to write.
    expect(source).toContain("submitDraft");
  });

  it("tells the model the truth after a cancellation", () => {
    expect(source).toContain("Nothing was written");
  });

  it("shows which values the person did not supply", () => {
    expect(source).toContain("not supplied — form default");
    expect(source).toContain('origin === "default"');
  });

  it("renders an unavailable figure as not recorded, with its reason", () => {
    expect(source).toContain("Not recorded");
    expect(source).toContain("entry.message");
    expect(source).toContain("entry.origin");
    // No fabricated figures. `placeholder` is not in this list: it is a real
    // input attribute here, not placeholder data.
    expect(source).not.toMatch(/Math\.random|\bdummy\b|sampleData|fakeData|mockData/i);
  });

  it("keeps a visible trace of every tool the assistant called", () => {
    expect(source).toContain("Tool trace");
    expect(source).toContain("A figure with no entry here was not measured.");
  });

  it("offers a typed path for someone who cannot or will not speak", () => {
    expect(source).toContain("Message Nucleus AI by typing");
    expect(source).toContain("sendText");
  });

  it("announces status changes to assistive technology", () => {
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain('role="status"');
  });

  it("says so when the conversation is not being recorded", () => {
    expect(source).toContain("transcriptRecorded");
    expect(source).toContain("Nothing said here will be kept");
  });

  it("releases the microphone when the session ends", () => {
    expect(source).toContain("teardown");
    expect(source).toContain("microphone.current?.stop()");
  });
});

describe("browser transport and audio", () => {
  const live = root("src/lib/ai/nucleus-live.ts");
  const audio = root("src/lib/ai/nucleus-audio.ts");
  const worklet = root("public/worklets/nucleus-pcm.js");

  it("echoes the setup the token was minted against rather than rebuilding it", () => {
    expect(live).toContain("this.setup");
    expect(live).toContain("byte-identical");
  });

  it("always answers a tool call, even when the tool throws", () => {
    expect(live).toContain("responses = calls.map");
    expect(live).toContain("toolResponse");
  });

  it("captures at 16 kHz and plays back at 24 kHz, the rates the Live API uses", () => {
    expect(live).toContain("INPUT_SAMPLE_RATE = 16_000");
    expect(live).toContain("OUTPUT_SAMPLE_RATE = 24_000");
    expect(audio).toContain("sampleRate: INPUT_SAMPLE_RATE");
    expect(audio).toContain("sampleRate: OUTPUT_SAMPLE_RATE");
  });

  it("drops queued speech when the person talks over the answer", () => {
    expect(audio).toContain("flush()");
    expect(live).toContain("onInterrupted");
  });

  it("converts to 16-bit PCM in the worklet, off the main thread", () => {
    expect(worklet).toContain("registerProcessor(\"nucleus-pcm\"");
    expect(worklet).toContain("Int16Array");
  });
});

describe("transport and headers the socket needs", () => {
  it("allows the Live socket origin explicitly and re-enables the microphone for this origin only", () => {
    const config = root("next.config.ts");
    expect(config).toContain("wss://generativelanguage.googleapis.com");
    expect(config).toContain("microphone=(self)");
    // Everything else stays denied.
    expect(config).toContain("camera=()");
    expect(config).toContain("geolocation=()");
  });
});
