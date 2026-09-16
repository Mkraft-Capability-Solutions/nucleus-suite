/**
 * Browser-side Gemini Live transport for Nucleus AI.
 * Ported from helper/src/lib/ai/nucleus-live.ts with no modifications.
 */

export const INPUT_SAMPLE_RATE = 16_000;
export const OUTPUT_SAMPLE_RATE = 24_000;

export type LiveFunctionCall = { id?: string; name: string; args?: Record<string, unknown> };
export type LiveFunctionResponse = { id?: string; name: string; response: Record<string, unknown> };

export type NucleusLiveHandlers = {
  onReady?: () => void;
  onUserText?: (text: string) => void;
  onModelText?: (text: string) => void;
  onAudio?: (pcm: ArrayBuffer) => void;
  onTurnComplete?: () => void;
  onInterrupted?: () => void;
  onToolCall?: (calls: LiveFunctionCall[]) => Promise<LiveFunctionResponse[]>;
  onNotice?: (message: string) => void;
  onError?: (message: string) => void;
  onClose?: (reason: string) => void;
};

export function encodeBase64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = '';
  for (let index = 0; index < view.length; index += 0x8000) {
    binary += String.fromCharCode(...view.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

export function decodeBase64(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

type ServerFrame = {
  setupComplete?: unknown;
  serverContent?: {
    modelTurn?: { parts?: Array<{ text?: string; inlineData?: { mimeType?: string; data?: string } }> };
    inputTranscription?: { text?: string };
    outputTranscription?: { text?: string };
    turnComplete?: boolean;
    interrupted?: boolean;
  };
  toolCall?: { functionCalls?: LiveFunctionCall[] };
  goAway?: { timeLeft?: string };
  error?: { message?: string };
};

export class NucleusLiveSession {
  private socket: WebSocket | null = null;
  private ready = false;
  private closedByUs = false;

  constructor(
    private readonly socketUrl: string,
    private readonly setup: Record<string, unknown>,
    private readonly handlers: NucleusLiveHandlers,
  ) {}

  get isReady(): boolean { return this.ready; }

  connect(): void {
    const socket = new WebSocket(this.socketUrl);
    socket.binaryType = 'arraybuffer';
    this.socket = socket;

    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({ setup: this.setup }));
    });
    socket.addEventListener('message', (event) => { void this.handleFrame(event.data); });
    socket.addEventListener('error', () => { this.handlers.onError?.('The connection to Nucleus AI failed.'); });
    socket.addEventListener('close', (event) => {
      this.ready = false;
      if (this.closedByUs) return;
      this.handlers.onClose?.(event.reason || `The session ended (code ${event.code}).`);
    });
  }

  private async handleFrame(data: unknown): Promise<void> {
    let text: string;
    if (typeof data === 'string') text = data;
    else if (data instanceof Blob) text = await data.text();
    else if (data instanceof ArrayBuffer) text = new TextDecoder().decode(data);
    else return;

    let frame: ServerFrame;
    try { frame = JSON.parse(text) as ServerFrame; }
    catch { this.handlers.onError?.('Nucleus AI sent a frame that could not be read.'); return; }

    if (frame.error?.message) { this.handlers.onError?.(frame.error.message); return; }
    if (frame.setupComplete !== undefined) { this.ready = true; this.handlers.onReady?.(); return; }
    if (frame.goAway) {
      this.handlers.onNotice?.(frame.goAway.timeLeft
        ? `Nucleus AI will close this session in ${frame.goAway.timeLeft}.`
        : 'Nucleus AI is about to close this session.');
    }

    const content = frame.serverContent;
    if (content) {
      if (content.interrupted) this.handlers.onInterrupted?.();
      if (content.inputTranscription?.text) this.handlers.onUserText?.(content.inputTranscription.text);
      if (content.outputTranscription?.text) this.handlers.onModelText?.(content.outputTranscription.text);
      for (const part of content.modelTurn?.parts ?? []) {
        if (part.text) this.handlers.onModelText?.(part.text);
        const inline = part.inlineData;
        if (inline?.data && (inline.mimeType ?? '').startsWith('audio/')) {
          this.handlers.onAudio?.(decodeBase64(inline.data));
        }
      }
      if (content.turnComplete) this.handlers.onTurnComplete?.();
    }

    const calls = frame.toolCall?.functionCalls;
    if (calls && calls.length > 0 && this.handlers.onToolCall) {
      let responses: LiveFunctionResponse[];
      try { responses = await this.handlers.onToolCall(calls); }
      catch (caught) {
        responses = calls.map((call) => ({
          id: call.id, name: call.name,
          response: { error: caught instanceof Error ? caught.message : 'The tool failed.' },
        }));
      }
      this.send({ toolResponse: { functionResponses: responses } });
    }
  }

  private send(payload: Record<string, unknown>): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(payload));
  }

  sendAudio(pcm: ArrayBuffer): void {
    if (!this.ready) return;
    this.send({ realtimeInput: { audio: { data: encodeBase64(pcm), mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}` } } });
  }

  sendText(text: string): void {
    if (!this.ready) return;
    this.send({ clientContent: { turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true } });
  }

  close(): void {
    this.closedByUs = true;
    this.ready = false;
    this.socket?.close();
    this.socket = null;
  }
}
