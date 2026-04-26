import { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

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

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg hover:bg-black/10 transition-colors"
      >
        {muted || volume === 0
          ? <VolumeX className="w-5 h-5 opacity-70" />
          : <Volume2 className="w-5 h-5 opacity-70" />
        }
      </button>

      {open && (
        <div className="absolute bottom-12 right-0 bg-gray-900 border border-white/10 rounded-xl p-3 shadow-xl w-48 z-50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white text-xs font-bold">Music</span>
            <button onClick={toggleMute} className="text-white/50 hover:text-white text-xs font-bold">
              {muted ? 'Unmute' : 'Mute'}
            </button>
          </div>
          <input
            type="range" min="0" max="100" value={muted ? 0 : volume}
            onChange={(e) => handleChange(parseInt(e.target.value, 10))}
            className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-red-500"
          />
          <div className="text-white/40 text-[10px] text-right mt-1">{muted ? 'Muted' : `${volume}%`}</div>
        </div>
      )}
    </div>
  );
}
