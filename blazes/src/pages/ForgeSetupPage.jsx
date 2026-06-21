import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Hammer, Clock, Play, Flame } from 'lucide-react';
import HostPlaysToggle from '../components/HostPlaysToggle';

export default function ForgeSetupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { kit, user } = location.state || {};

  const [gameName, setGameName] = useState(`${kit?.title || 'Forge'} — The Forge`);
  const [timeLimit, setTimeLimit] = useState(600);
  const [allowCustomPlayerNames, setAllowCustomPlayerNames] = useState(false);
  const [hostPlays, setHostPlays] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!kit || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Missing game setup. Please select a kit first.</p>
          <button
            onClick={() => navigate('/home/teacher')}
            className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-red-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const generateGameCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const handleCreateGame = async () => {
    setLoading(true);
    setError('');

    const gameCode = generateGameCode();
    const settings = {
      gameName,
      timeLimit,
      hostName: user.name,
      allowCustomPlayerNames,
      hostPlays,
    };

    try {
      const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
      const response = await fetch(`${base}/api/games/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostId: user.id,
          kitId: kit.id,
          gameCode,
          gameMode: 'forge',
          settings,
        }),
      });

      if (!response.ok) throw new Error('Failed to create game. Please try again.');
      const gameData = await response.json();
      navigate(`/game/waiting/${gameData.gameCode}`, { state: { user } });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{
      background: 'radial-gradient(ellipse at top, #1a0a0a 0%, #0a0505 60%, #050202 100%)',
    }}>
      {/* Subtle ember-glow halo */}
      <div className="fixed inset-0 pointer-events-none -z-10"
           style={{ background: 'radial-gradient(circle at 50% 100%, rgba(239,68,68,0.18), transparent 55%)' }} />

      <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
               style={{ background: 'linear-gradient(135deg, #ef4444, #f97316)', boxShadow: '0 0 40px rgba(239,68,68,0.55)' }}>
            <Hammer className="w-9 h-9 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-2 tracking-tight">The Forge</h1>
          <p className="text-base text-red-200/70 font-semibold">Strike the anvil. Forge your weapon. Battle the class.</p>
        </div>

        <div
          className="rounded-2xl p-6 sm:p-8 border"
          style={{
            backgroundColor: 'rgba(20,8,8,0.85)',
            borderColor: 'rgba(239,68,68,0.2)',
            boxShadow: '0 30px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                 style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <Flame className="w-5 h-5 text-orange-400" />
            </div>
            <h2 className="text-xl font-black text-white">Game Settings</h2>
          </div>

          <div className="space-y-6">
            {/* Game Name */}
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-red-200/60 mb-2">Game Name</label>
              <input
                type="text"
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg text-white font-semibold focus:outline-none transition-colors"
                style={{
                  background: 'rgba(0,0,0,0.5)',
                  border: '1px solid rgba(239,68,68,0.25)',
                }}
              />
            </div>

            {/* Display Names */}
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-red-200/60 mb-2">Student Display Names</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAllowCustomPlayerNames(false)}
                  className={`flex-1 py-2.5 px-4 rounded-lg font-bold text-sm transition-all ${
                    !allowCustomPlayerNames
                      ? 'bg-red-600 text-white shadow-lg shadow-red-500/30'
                      : 'bg-white/5 text-red-200/70 hover:bg-white/10 border border-white/10'
                  }`}
                >
                  Use Account Names
                </button>
                <button
                  type="button"
                  onClick={() => setAllowCustomPlayerNames(true)}
                  className={`flex-1 py-2.5 px-4 rounded-lg font-bold text-sm transition-all ${
                    allowCustomPlayerNames
                      ? 'bg-red-600 text-white shadow-lg shadow-red-500/30'
                      : 'bg-white/5 text-red-200/70 hover:bg-white/10 border border-white/10'
                  }`}
                >
                  Let Students Choose
                </button>
              </div>
            </div>

            <HostPlaysToggle value={hostPlays} onChange={setHostPlays} />

            {/* Time Limit */}
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-red-200/60 mb-2">
                Forge Time (minutes)
              </label>
              <div className="relative">
                <Clock className="w-5 h-5 text-orange-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  value={timeLimit / 60}
                  onChange={(e) => {
                    const v = Math.min(60, Math.max(1, Number(e.target.value) || 1));
                    setTimeLimit(v * 60);
                  }}
                  min={1}
                  max={60}
                  className="w-full pl-11 pr-4 py-2.5 rounded-lg text-white font-bold focus:outline-none"
                  style={{
                    background: 'rgba(0,0,0,0.5)',
                    border: '1px solid rgba(239,68,68,0.25)',
                  }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-red-200/45">Each correct answer strikes the anvil and levels up your weapon.</p>
            </div>
          </div>

          {error && (
            <p className="mt-6 text-center text-red-400 font-semibold">{error}</p>
          )}

          <div className="mt-8 flex justify-end gap-3">
            <button
              onClick={() => navigate(-1)}
              className="px-5 py-2.5 rounded-lg font-bold text-red-200/70 hover:bg-white/5 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleCreateGame}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-black text-white transition-all disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #ef4444, #f97316)',
                boxShadow: '0 8px 30px rgba(239,68,68,0.45)',
              }}
            >
              <Play className="w-5 h-5" />
              {loading ? 'Lighting the forge…' : 'Light the Forge'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
