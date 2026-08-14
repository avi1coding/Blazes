import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Play, Infinity as InfinityIcon } from 'lucide-react';
import HostPlaysToggle from '../components/HostPlaysToggle';
import { LIVE_MODE_META } from '../utils/liveModes';

/**
 * One setup page for all four endless live modes. They share every option
 * because they share an engine — there is no time limit to configure, since
 * none of them end.
 */
export default function LiveModeSetupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { mode } = useParams();
  const { kit, user } = location.state || {};
  const meta = LIVE_MODE_META[mode];

  const [gameName, setGameName] = useState(`${kit?.title || 'Blazes'} ${meta?.name || 'Game'}`);
  const [allowCustomPlayerNames, setAllowCustomPlayerNames] = useState(false);
  const [hostPlays, setHostPlays] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!kit || !user || !meta) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Missing game setup. Please select a kit first.</p>
          <button onClick={() => navigate('/home/teacher')}
            className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-red-700">Go Back</button>
        </div>
      </div>
    );
  }

  const Icon = meta.icon;

  const handleCreateGame = async () => {
    setLoading(true);
    setError('');
    const gameCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
      const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
      const res = await fetch(`${base}/api/games/create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostId: user.id, kitId: kit.id, gameCode, gameMode: mode,
          // endless: no timer, and the queue reshuffles forever.
          settings: { gameName, hostName: user.name, allowCustomPlayerNames, hostPlays, endless: true },
        }),
      });
      if (!res.ok) throw new Error('Failed to create game. Please try again.');
      const data = await res.json();
      navigate(`/game/waiting/${data.gameCode}`, { state: { user } });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 mb-2">Game Setup</h1>
          <p className="text-base sm:text-lg text-gray-600">Configure your {meta.name} game.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: meta.accent }}>
              <Icon className="w-6 h-6 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900">{meta.name}</h2>
              <p className="text-sm text-gray-500">{kit.title}</p>
            </div>
          </div>

          <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">{meta.blurb}</p>

          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <InfinityIcon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
            <div className="text-sm text-blue-900">
              <span className="font-black">This mode never ends.</span> There is no timer and no final
              scoreboard — students play for as long as you like and can join or leave at any point.
              Standings fade when someone stops answering, so they always reflect current effort.
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">Game name</label>
            <input type="text" value={gameName} onChange={(e) => setGameName(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-semibold focus:border-red-500 focus:outline-none" />
          </div>

          <label className="flex items-center gap-3 mb-4 cursor-pointer">
            <input type="checkbox" checked={allowCustomPlayerNames}
              onChange={(e) => setAllowCustomPlayerNames(e.target.checked)}
              className="w-5 h-5 rounded accent-red-600" />
            <span className="text-sm font-semibold text-gray-700">Let students choose their own display name</span>
          </label>

          <HostPlaysToggle value={hostPlays} onChange={setHostPlays} />

          {error && <p className="text-sm font-bold text-red-600 mt-4">{error}</p>}

          <button onClick={handleCreateGame} disabled={loading}
            className="w-full mt-6 py-4 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 disabled:opacity-60 flex items-center justify-center gap-2">
            <Play className="w-5 h-5" /> {loading ? 'Creating...' : 'Create Game'}
          </button>
        </div>
      </div>
    </div>
  );
}
