// Seamless looping audio using Web Audio API.
//
// MP3s have encoder padding (~50ms head, ~26ms tail) and the waveform amplitude
// at file start/end almost never matches. Native source.loop = true splices the
// two endpoints directly, which produces an audible click on every iteration.
//
// Strategy:
//   1. Trim encoder silence at both ends (real silence, not low music).
//   2. Snap the trimmed loop points to nearby zero crossings to minimise discontinuity.
//   3. Schedule iterations manually with a short equal-loudness crossfade so the
//      tail of one iteration overlaps the head of the next — clicks become inaudible.

const SILENCE_THRESHOLD = 0.005; // ~ -46 dBFS, cuts encoder padding without eating quiet intros
const ZERO_CROSSING_SEARCH = 2048; // samples to search for the closest zero crossing
const CROSSFADE_SEC = 0.06; // 60 ms — short enough to be inaudible on most music

function findFirstNonSilent(buffer, threshold = SILENCE_THRESHOLD) {
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < channels; c++) {
      if (Math.abs(buffer.getChannelData(c)[i]) > threshold) return i;
    }
  }
  return 0;
}

function findLastNonSilent(buffer, threshold = SILENCE_THRESHOLD) {
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  for (let i = length - 1; i >= 0; i--) {
    for (let c = 0; c < channels; c++) {
      if (Math.abs(buffer.getChannelData(c)[i]) > threshold) return i;
    }
  }
  return length - 1;
}

// Snap a sample index to the nearest sample with the smallest absolute amplitude
// across all channels — minimises the pop at the splice point.
function snapToZeroCrossing(buffer, sampleIdx) {
  const length = buffer.length;
  const channels = buffer.numberOfChannels;
  const start = Math.max(0, sampleIdx - ZERO_CROSSING_SEARCH);
  const end = Math.min(length - 1, sampleIdx + ZERO_CROSSING_SEARCH);
  let best = sampleIdx;
  let bestEnergy = Infinity;
  for (let i = start; i <= end; i++) {
    let energy = 0;
    for (let c = 0; c < channels; c++) energy += Math.abs(buffer.getChannelData(c)[i]);
    if (energy < bestEnergy) { bestEnergy = energy; best = i; }
  }
  return best;
}

export function createSeamlessLoop(src, initialVolume = 0.3) {
  let audioCtx = null;
  let masterGain = null;
  let buffer = null;
  let loopStart = 0;
  let loopEnd = 0;
  let loaded = false;
  let pendingPlay = false;
  let isPlaying = false;
  let active = []; // [{ source, fade }]
  let nextScheduleTimeout = null;

  const init = async () => {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = initialVolume;
    masterGain.connect(audioCtx.destination);

    try {
      const response = await fetch(src);
      const arrayBuffer = await response.arrayBuffer();
      // destroy() nulls audioCtx, and StrictMode mounts/unmounts twice in dev, so
      // the fetch above can resolve after this loop was torn down.
      if (!audioCtx) return;
      buffer = await audioCtx.decodeAudioData(arrayBuffer);
      if (!audioCtx) return;

      const sampleRate = buffer.sampleRate;
      const startSample = snapToZeroCrossing(buffer, findFirstNonSilent(buffer));
      const endSample = snapToZeroCrossing(buffer, findLastNonSilent(buffer));
      loopStart = startSample / sampleRate;
      loopEnd = (endSample + 1) / sampleRate;

      loaded = true;
      if (pendingPlay) play();
    } catch (e) {
      console.error('[Audio] Failed to load:', src, e);
    }
  };

  // Schedule a single iteration that begins fading in at startAt and lasts (loopEnd - loopStart)
  // seconds. Recursively schedules the next iteration so its fade-in overlaps this one's fade-out.
  const scheduleIteration = (startAt) => {
    if (!isPlaying || !audioCtx || !buffer) return;
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    const fade = audioCtx.createGain();
    source.connect(fade).connect(masterGain);

    const loopDuration = loopEnd - loopStart;
    const xf = Math.min(CROSSFADE_SEC, loopDuration / 4);

    // Equal-loudness-ish linear ramps: when two adjacent iterations sum during overlap,
    // their gains add to ~1 throughout the crossfade window.
    fade.gain.setValueAtTime(0, startAt);
    fade.gain.linearRampToValueAtTime(1, startAt + xf);
    fade.gain.setValueAtTime(1, startAt + loopDuration - xf);
    fade.gain.linearRampToValueAtTime(0, startAt + loopDuration);

    // Play exactly the trimmed region; stop slightly after to flush the fade-out tail.
    source.start(startAt, loopStart, loopDuration);
    source.stop(startAt + loopDuration + 0.02);

    const entry = { source, fade };
    active.push(entry);
    source.onended = () => {
      try { source.disconnect(); fade.disconnect(); } catch (_) {}
      active = active.filter(a => a !== entry);
    };

    // Schedule the next iteration so its fade-in begins xf seconds before this one fades out.
    const nextStart = startAt + loopDuration - xf;
    const delayMs = (nextStart - audioCtx.currentTime) * 1000 - 250; // queue 250 ms in advance
    nextScheduleTimeout = setTimeout(() => scheduleIteration(nextStart), Math.max(0, delayMs));
  };

  const play = () => {
    if (!loaded) { pendingPlay = true; return; }
    if (isPlaying) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    isPlaying = true;
    // Small lead-in so the first iteration's fade-in starts at audible time.
    scheduleIteration(audioCtx.currentTime + 0.05);
  };

  const stop = () => {
    pendingPlay = false;
    isPlaying = false;
    if (nextScheduleTimeout) { clearTimeout(nextScheduleTimeout); nextScheduleTimeout = null; }

    // Fade out master to avoid a tail click, then tear everything down.
    const ctx = audioCtx;
    const master = masterGain;
    const sources = active;
    active = [];
    masterGain = null;
    buffer = null;
    loaded = false;
    audioCtx = null;

    if (master && ctx) {
      try {
        const t = ctx.currentTime;
        master.gain.cancelScheduledValues(t);
        master.gain.setValueAtTime(master.gain.value, t);
        master.gain.linearRampToValueAtTime(0, t + 0.08);
      } catch (_) {}
    }

    setTimeout(() => {
      for (const a of sources) {
        try { a.source.stop(0); } catch (_) {}
        try { a.source.disconnect(); a.fade.disconnect(); } catch (_) {}
      }
      if (ctx) { try { ctx.close(); } catch (_) {} }
    }, 120);
  };

  const setVolume = (v) => {
    const clamped = Math.max(0, Math.min(1, v));
    if (masterGain && audioCtx) {
      try {
        const t = audioCtx.currentTime;
        masterGain.gain.cancelScheduledValues(t);
        masterGain.gain.setValueAtTime(masterGain.gain.value, t);
        masterGain.gain.linearRampToValueAtTime(clamped, t + 0.05);
      } catch (_) {
        masterGain.gain.value = clamped;
      }
    } else if (masterGain) {
      masterGain.gain.value = clamped;
    }
  };

  init();

  return {
    play,
    stop,
    get volume() { return masterGain ? masterGain.gain.value : initialVolume; },
    set volume(v) { setVolume(v); },
  };
}
