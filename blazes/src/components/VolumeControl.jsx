import { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Volume1 } from 'lucide-react';

export default function VolumeControl({ audioRef }) {
  const [open, setOpen] = useState(false);
  const [volume, setVolume] = useState(() => {
    const s = JSON.parse(localStorage.getItem('blazes_settings') || '{}');
    return s.music_volume ?? 30;
  });
  const [muted, setMuted] = useState(() => {
    const s = JSON.parse(localStorage.getItem('blazes_settings') || '{}');
    return s.sound_enabled === false || s.sound_enabled === 0;
  });
  const ref = useRef(null);

  useEffect(() => {
    if (audioRef?.current) {
      audioRef.current.volume = muted ? 0 : volume / 100;
    }
  }, [volume, muted, audioRef]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleChange = (v) => {
    setVolume(v);
    const s = JSON.parse(localStorage.getItem('blazes_settings') || '{}');
    s.music_volume = v;
    localStorage.setItem('blazes_settings', JSON.stringify(s));
  };

  const toggleMute = () => {
    setMuted(!muted);
    const s = JSON.parse(localStorage.getItem('blazes_settings') || '{}');
    s.sound_enabled = muted ? 1 : 0;
    localStorage.setItem('blazes_settings', JSON.stringify(s));
  };

  const Icon = muted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        aria-label="Volume"
        className="p-2 rounded-lg hover:bg-black/10 transition-colors flex items-center justify-center"
      >
        <Icon className="w-5 h-5 opacity-80" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl p-4 w-64 max-w-[calc(100vw-1rem)] z-50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-900 text-sm font-bold">Music Volume</span>
            <button
              onClick={toggleMute}
              className={`text-xs font-bold px-2.5 py-1 rounded-md transition-colors ${
                muted ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {muted ? 'Unmute' : 'Mute'}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <input
              type="range" min="0" max="100" value={muted ? 0 : volume}
              onChange={(e) => handleChange(parseInt(e.target.value, 10))}
              disabled={muted}
              className="flex-1 h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <span className="text-gray-500 text-xs font-bold w-8 text-right">{muted ? '—' : `${volume}`}</span>
          </div>
        </div>
      )}
    </div>
  );
}
