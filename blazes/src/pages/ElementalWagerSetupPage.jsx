import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Flame, Play, Clock, Mountain, Droplets } from 'lucide-react';
import HostPlaysToggle from '../components/HostPlaysToggle';

export default function ElementalWagerSetupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { kit, user } = location.state || {};
  const [gameName, setGameName] = useState(`${kit?.title || 'Wager'}, Risk & Reward`);
  const [timeLimit, setTimeLimit] = useState(180);
  const [allowCustomPlayerNames, setAllowCustomPlayerNames] = useState(false);
  const [hostPlays, setHostPlays] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!kit || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600 mb-4">Missing game setup.</p>
        <button onClick={() => navigate('/home/teacher')} className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold">Go Back</button>
      </div>
    );
  }

  const handleCreateGame = async () => {
    setLoading(true); setError('');
    const gameCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
      const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
      const res = await fetch(`${base}/api/games/create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostId: user.id, kitId: kit.id, gameCode, gameMode: 'elemental_wager', settings: { gameName, timeLimit, allowCustomPlayerNames, hostName: user.name, hostPlays } })
      });
      if (!res.ok) throw new Error('Failed to create game.');
      const data = await res.json();
      navigate(`/game/waiting/${data.gameCode}`, { state: { user } });
    } catch (err) { setError(err.message); setLoading(false); }
  };

  const durations = [
    { label: '1 min', value: 60 }, { label: '2 min', value: 120 }, { label: '3 min', value: 180 },
    { label: '5 min', value: 300 }, { label: '7 min', value: 420 }, { label: '10 min', value: 600 },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6">
        <div className="text-center mb-8 sm:mb-10 md:mb-12">
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-700 px-4 py-2 rounded-full font-bold mb-4">
            <Flame className="w-5 h-5" /> Risk & Reward
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 mb-2">Game Setup</h1>
          <p className="text-base sm:text-lg text-gray-600">Bet on your knowledge with elemental wagers!</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 md:p-8">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Game Name</label>
              <input type="text" value={gameName} onChange={(e) => setGameName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500" />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Student Display Names</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setAllowCustomPlayerNames(false)}
                  className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm border-2 transition-all ${!allowCustomPlayerNames ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                  Use Account Names
                </button>
                <button type="button" onClick={() => setAllowCustomPlayerNames(true)}
                  className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm border-2 transition-all ${allowCustomPlayerNames ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                  Let Students Choose
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                <Clock className="w-4 h-4 inline mr-1 text-amber-500" /> Game Duration (minutes)
              </label>
              <input
                type="number"
                value={Math.round(timeLimit / 60)}
                onChange={(e) => {
                  const v = Math.min(60, Math.max(1, Number(e.target.value) || 1));
                  setTimeLimit(v * 60);
                }}
                min={1}
                max={60}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
              />
              <p className="mt-1 text-xs text-gray-400">Between 1 and 60 minutes</p>
            </div>

            <div className="bg-amber-50 border-2 border-amber-100 rounded-xl p-4">
              <h4 className="font-black text-amber-900 mb-3 flex items-center gap-2"><Flame className="w-4 h-4" /> How It Works</h4>
              <div className="grid sm:grid-cols-3 gap-3 text-sm">
                <div className="bg-white rounded-lg p-3 border border-amber-200">
                  <div className="flex items-center gap-2 mb-1"><Mountain className="w-4 h-4 text-gray-600" /><span className="font-black text-gray-700">Rock (Safe)</span></div>
                  <p className="text-gray-600">+5 right, 0 wrong</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-amber-200">
                  <div className="flex items-center gap-2 mb-1"><Droplets className="w-4 h-4 text-blue-500" /><span className="font-black text-blue-700">Raindrop (Normal)</span></div>
                  <p className="text-gray-600">+10 right, -5 wrong</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-amber-200">
                  <div className="flex items-center gap-2 mb-1"><Flame className="w-4 h-4 text-orange-500" /><span className="font-black text-orange-700">Torch (Risky)</span></div>
                  <p className="text-gray-600">+25 right, -10 wrong</p>
                </div>
              </div>
              <p className="text-xs text-amber-700 mt-3">10 correct in a row upgrades all bets. Wrong answer resets your streak!</p>
            </div>

            <HostPlaysToggle value={hostPlays} onChange={setHostPlays} />
          </div>

          {error && <p className="mt-6 text-center text-red-600">{error}</p>}

          <div className="mt-10 flex justify-end gap-4">
            <button onClick={() => navigate(-1)} className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300">Back</button>
            <button onClick={handleCreateGame} disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-bold hover:shadow-lg disabled:opacity-50">
              <Play className="w-5 h-5" /> {loading ? 'Creating...' : 'Create Game & Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
