import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Play, Clock, Coins } from 'lucide-react';
import HostPlaysToggle from '../components/HostPlaysToggle';

/**
 * Jackpot runs until the teacher ends it or the clock they set here runs
 * out, same shape as Territory: a plain number of minutes, with the option
 * to extend or pull back time mid-game from the lobby/gameplay screen.
 */
export default function JackpotSetupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { kit, user } = location.state || {};

  const [gameName, setGameName] = useState(`${kit?.title || 'Blazes'} Jackpot`);
  const [allowCustomPlayerNames, setAllowCustomPlayerNames] = useState(false);
  const [hostPlays, setHostPlays] = useState(true);
  const [minutes, setMinutes] = useState('15');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!kit || !user) {
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

  const minutesNum = Number(minutes);
  const minutesValid = Number.isFinite(minutesNum) && minutesNum >= 1 && minutesNum <= 300;

  const handleCreateGame = async () => {
    setLoading(true);
    setError('');
    const gameCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
      const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
      const res = await fetch(`${base}/api/games/create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostId: user.id, kitId: kit.id, gameCode, gameMode: 'jackpot',
          settings: {
            gameName, hostName: user.name, allowCustomPlayerNames, hostPlays,
            endless: true, allowLateJoin: true,
            timeLimit: Math.round(Number(minutes) * 60),
          },
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
          <p className="text-base sm:text-lg text-gray-600">Configure your Jackpot game.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-500">
              <Coins className="w-6 h-6 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900">Jackpot</h2>
              <p className="text-sm text-gray-500">{kit.title}</p>
            </div>
          </div>

          <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
            Correct answers earn chips, wrong ones cost a few. Chips buy upgrades that always cut both
            ways, or can be spent to steal straight from another player. Every 5 questions, spin the
            wheel — it takes a random cut from whoever's currently in the lead. Most chips when the
            clock runs out wins.
          </p>

          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">Game name</label>
            <input type="text" value={gameName} onChange={(e) => setGameName(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-semibold focus:border-red-500 focus:outline-none" />
          </div>

          <div className="mb-6">
            <label className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" /> Game length
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number" min="1" max="300" step="1" inputMode="numeric"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className="w-32 px-4 py-3 border-2 border-gray-200 rounded-xl font-semibold text-center focus:border-red-500 focus:outline-none"
              />
              <span className="text-sm font-bold text-gray-600">minutes</span>
            </div>
            {!minutesValid && (
              <p className="text-xs text-red-600 font-bold mt-2">Enter a length between 1 and 300 minutes.</p>
            )}
            <p className="text-xs text-gray-500 font-semibold mt-2">
              You can add or take away time, or end the game, at any point while it is running.
            </p>
          </div>

          <label className="flex items-center gap-3 mb-4 cursor-pointer">
            <input type="checkbox" checked={allowCustomPlayerNames}
              onChange={(e) => setAllowCustomPlayerNames(e.target.checked)}
              className="w-5 h-5 rounded accent-red-600" />
            <span className="text-sm font-semibold text-gray-700">Let students choose their own display name</span>
          </label>

          <HostPlaysToggle value={hostPlays} onChange={setHostPlays} />

          {error && <p className="text-sm font-bold text-red-600 mt-4">{error}</p>}

          <button onClick={handleCreateGame} disabled={loading || !minutesValid}
            className="w-full mt-6 py-4 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 disabled:opacity-60 flex items-center justify-center gap-2">
            <Play className="w-5 h-5" /> {loading ? 'Creating...' : 'Create Game'}
          </button>
        </div>
      </div>
    </div>
  );
}
