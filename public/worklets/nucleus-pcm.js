/**
 * Nucleus PCM capture worklet.
 * Runs in the AudioWorklet thread at INPUT_SAMPLE_RATE (16 kHz).
 * Every 320-sample frame (20 ms) is converted to 16-bit PCM and
 * posted to the main thread as an ArrayBuffer.
 */
class NucleusPcmProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel || channel.length === 0) return true;
    const pcm = new Int16Array(channel.length);
    for (let i = 0; i < channel.length; i++) {
      // Float32 → Int16: clamp then scale
      pcm[i] = Math.max(-0x8000, Math.min(0x7fff, Math.round(channel[i] * 0x7fff)));
    }
    this.port.postMessage(pcm.buffer, [pcm.buffer]);
    return true;
  }
}

registerProcessor('nucleus-pcm', NucleusPcmProcessor);
