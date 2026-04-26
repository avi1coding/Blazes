// Seamless looping audio using Web Audio API.
// Trims silence at start/end of buffer so loops don't have a gap
// (MP3 files often have encoder padding ~50ms at start and ~26ms at end).

function findFirstNonSilent(buffer, threshold = 0.001) {
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < channels; c++) {
      if (Math.abs(buffer.getChannelData(c)[i]) > threshold) {
        return i;
      }
    }
  }
  return 0;
}

function findLastNonSilent(buffer, threshold = 0.001) {
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  for (let i = length - 1; i >= 0; i--) {
    for (let c = 0; c < channels; c++) {
      if (Math.abs(buffer.getChannelData(c)[i]) > threshold) {
        return i;
      }
    }
  }
  return length - 1;
}

export function createSeamlessLoop(src, initialVolume = 0.3) {
  let audioCtx = null;
  let source = null;
  let gainNode = null;
  let buffer = null;
  let loopStart = 0;
  let loopEnd = 0;
  let loaded = false;
  let pendingPlay = false;

  const init = async () => {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    gainNode = audioCtx.createGain();
    gainNode.gain.value = initialVolume;
    gainNode.connect(audioCtx.destination);

    try {
      const response = await fetch(src);
      const arrayBuffer = await response.arrayBuffer();
      buffer = await audioCtx.decodeAudioData(arrayBuffer);

      // Find actual audio start/end (skip encoder padding silence)
      const sampleRate = buffer.sampleRate;
      const startSample = findFirstNonSilent(buffer);
      const endSample = findLastNonSilent(buffer);
      loopStart = startSample / sampleRate;
      loopEnd = (endSample + 1) / sampleRate;

      loaded = true;
      if (pendingPlay) play();
    } catch (e) {
      console.error('[Audio] Failed to load:', src, e);
    }
  };

  const play = () => {
    if (!loaded) { pendingPlay = true; return; }
    if (source) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = loopStart;
    source.loopEnd = loopEnd;
    source.connect(gainNode);
    // Start at the trimmed start, not 0, so we don't play the silence the first time
    source.start(0, loopStart);
  };

  const stop = () => {
    if (source) {
      try { source.stop(); } catch (_) {}
      source.disconnect();
      source = null;
    }
    if (audioCtx) {
      audioCtx.close();
      audioCtx = null;
    }
    loaded = false;
    pendingPlay = false;
  };

  const setVolume = (v) => {
    if (gainNode) gainNode.gain.value = Math.max(0, Math.min(1, v));
  };

  init();

  return {
    play,
    stop,
    get volume() { return gainNode ? gainNode.gain.value : initialVolume; },
    set volume(v) { setVolume(v); },
  };
}
