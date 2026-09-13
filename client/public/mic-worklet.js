/**
 * AudioWorklet processor for microphone capture
 * Runs in the audio rendering thread — keeps the main thread free
 * 
 * This file is loaded as a URL via AudioContext.addModule()
 * It CANNOT import ES modules.
 */

// @ts-ignore — AudioWorkletProcessor is a global in the worklet scope
class MicrophoneProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.port.onmessage = () => {}; // keep port alive
  }

  // @ts-ignore
  process(inputs, _outputs, _parameters) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0]; // Float32Array, one channel
    // Send raw Float32 samples to main thread
    // Transfer the buffer for zero-copy performance
    const copy = new Float32Array(channelData);
    this.port.postMessage({ type: 'audio', samples: copy }, [copy.buffer]);

    return true; // keep processor alive
  }
}

// @ts-ignore
registerProcessor('microphone-processor', MicrophoneProcessor);
