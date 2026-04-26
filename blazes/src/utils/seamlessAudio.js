// Seamless looping audio using Web Audio API
// HTML5 Audio.loop has a small gap between loops — this doesn't.

export function createSeamlessLoop(src, initialVolume = 0.3) {
  let audioCtx = null;
  let source = null;
  let gainNode = null;
  let buffer = null;
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
      loaded = true;
      if (pendingPlay) play();
    } catch (e) {
      console.error('[Audio] Failed to load:', src, e);
    }
  };

  const play = () => {
    if (!loaded) { pendingPlay = true; return; }
    if (source) return; // already playing
    if (audioCtx.state === 'suspended') audioCtx.resume();
    source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gainNode);
    source.start(0);
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

  // Object compatible with HTMLAudioElement interface (has .volume property)
  // so VolumeControl can do `audioRef.current.volume = x`
  return {
    play,
    stop,
    get volume() { return gainNode ? gainNode.gain.value : initialVolume; },
    set volume(v) { setVolume(v); },
  };
}
