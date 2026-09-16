import { INPUT_SAMPLE_RATE, OUTPUT_SAMPLE_RATE } from './nucleus-live';

/**
 * Microphone capture and speech playback for Nucleus AI.
 * Ported from helper/src/lib/ai/nucleus-audio.ts
 *
 * Two separate AudioContexts: capture at 16 kHz (Gemini Live input),
 * playback at 24 kHz (Gemini Live output). Playback is gapless via a
 * scheduled queue. Barge-in drops the entire queue instantly.
 */

export const CAPTURE_WORKLET_URL = '/worklets/nucleus-pcm.js';

/** Root-mean-square level of a PCM chunk, 0..1, for the on-screen orb meter. */
export function chunkLevel(pcm: ArrayBuffer): number {
  const samples = new Int16Array(pcm);
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const value = samples[index] / 0x8000;
    sum += value * value;
  }
  return Math.min(1, Math.sqrt(sum / samples.length) * 4);
}

export class MicrophoneCapture {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;

  constructor(private readonly onChunk: (pcm: ArrayBuffer, level: number) => void) {}

  async start(): Promise<void> {
    if (this.context) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('This browser does not expose a microphone to the page.');
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const context = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
    this.context = context;
    await context.audioWorklet.addModule(CAPTURE_WORKLET_URL);
    const source = context.createMediaStreamSource(this.stream);
    const node = new AudioWorkletNode(context, 'nucleus-pcm', { numberOfInputs: 1, numberOfOutputs: 0 });
    node.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      this.onChunk(event.data, chunkLevel(event.data));
    };
    source.connect(node);
    this.node = node;
    if (context.state === 'suspended') await context.resume();
  }

  async stop(): Promise<void> {
    this.node?.port.close();
    this.node?.disconnect();
    this.node = null;
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
    await this.context?.close();
    this.context = null;
  }
}

export class SpeechPlayer {
  private context: AudioContext | null = null;
  private playHead = 0;
  private active: AudioBufferSourceNode[] = [];

  private ensureContext(): AudioContext {
    if (!this.context) this.context = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
    return this.context;
  }

  async enqueue(pcm: ArrayBuffer): Promise<void> {
    const context = this.ensureContext();
    if (context.state === 'suspended') await context.resume();
    const samples = new Int16Array(pcm);
    if (samples.length === 0) return;
    const buffer = context.createBuffer(1, samples.length, OUTPUT_SAMPLE_RATE);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) channel[index] = samples[index] / 0x8000;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    const startAt = Math.max(context.currentTime, this.playHead);
    source.start(startAt);
    this.playHead = startAt + buffer.duration;
    this.active.push(source);
    source.onended = () => { this.active = this.active.filter((candidate) => candidate !== source); };
  }

  /** Barge-in: stop everything queued and reset the play head to now. */
  flush(): void {
    for (const source of this.active) { try { source.stop(); } catch { /* already ended */ } }
    this.active = [];
    this.playHead = this.context?.currentTime ?? 0;
  }

  async close(): Promise<void> {
    this.flush();
    await this.context?.close();
    this.context = null;
    this.playHead = 0;
  }
}
