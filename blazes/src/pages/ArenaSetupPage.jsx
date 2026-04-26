import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Settings, Clock, Play, Swords, Sparkles, Coins } from 'lucide-react';
import HostPlaysToggle from '../components/HostPlaysToggle';

export default function ArenaSetupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { kit, user } = location.state || {};

  const [gameName, setGameName] = useState(`${kit?.title || 'Arena'} Battle`);
  const [timeLimit, setTimeLimit] = useState(600); // 10 min default
  const [startingCoins, setStartingCoins] = useState(100);
  const [eventInterval, setEventInterval] = useState(60); // seconds between world events
  const [hostPlays, setHostPlays] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!kit || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Missing setup info. Pick a kit first.</p>
          <button onClick={() => navigate('/home/teacher')} className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-red-700">Go Back</button>
        </div>
      </div>
    );
  }

  if (user.role !== 'teacher') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Arena Mode is only available to teachers.</p>
          <button onClick={() => navigate(-1)} className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-red-700">Go Back</button>
        </div>
      </div>
    );
  }

  const generateGameCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const handleCreateGame = async () => {
    setLoading(true);
    setError('');
    const gameCode = generateGameCode();
    const settings = { gameName, timeLimit, startingCoins, eventInterval, hostName: user.name, hostPlays };
    try {
      const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
      const res = await fetch(`${base}/api/games/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostId: user.id, kitId: kit.id, gameCode, gameMode: 'arena', settings }),
      });
      if (!res.ok) throw new Error('Failed to create game');
      const data = await res.json();
      navigate(`/game/waiting/${data.gameCode}`, { state: { user } });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-purple-900 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-6 text-white">
          <div className="inline-flex items-center gap-2 bg-purple-600/20 border border-purple-400/30 rounded-full px-4 py-1.5 mb-4">
            <Sparkles className="w-4 h-4 text-purple-300" />
            <span className="text-xs font-bold uppercase tracking-wider text-purple-200">Teacher Exclusive</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black mb-2">Arena Mode</h1>
          <p className="text-purple-200 text-sm sm:text-base">Strategic battle quiz with shop, attacks, combos & world events.</p>
        </div>

        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 sm:p-6 md:p-8 text-white">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center">
              <Swords className="w-6 h-6" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black">Game Setup</h2>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold mb-1">Game Name</label>
              <input type="text" value={gameName} onChange={(e) => setGameName(e.target.value)}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:border-purple-400 focus:outline-none" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-1 flex items-center gap-1.5"><Clock className="w-4 h-4" /> Time Limit</label>
                <select value={timeLimit} onChange={(e) => setTimeLimit(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:border-purple-400 focus:outline-none">
                  <option value={300} className="bg-gray-900">5 min</option>
                  <option value={600} className="bg-gray-900">10 min</option>
                  <option value={900} className="bg-gray-900">15 min</option>
                  <option value={1200} className="bg-gray-900">20 min</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold mb-1 flex items-center gap-1.5"><Coins className="w-4 h-4" /> Starting Coins</label>
                <select value={startingCoins} onChange={(e) => setStartingCoins(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:border-purple-400 focus:outline-none">
                  <option value={0} className="bg-gray-900">0 (hard)</option>
                  <option value={100} className="bg-gray-900">100 (normal)</option>
                  <option value={250} className="bg-gray-900">250 (easy)</option>
                  <option value={500} className="bg-gray-900">500 (chaotic)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold mb-1 flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> World Event Frequency</label>
              <select value={eventInterval} onChange={(e) => setEventInterval(Number(e.target.value))}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:border-purple-400 focus:outline-none">
                <option value={30} className="bg-gray-900">Every 30s (chaos)</option>
                <option value={60} className="bg-gray-900">Every 60s (normal)</option>
                <option value={120} className="bg-gray-900">Every 2 min (calm)</option>
                <option value={0} className="bg-gray-900">Off</option>
              </select>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h3 className="text-sm font-black mb-2">How Arena Works</h3>
              <ul className="text-xs text-purple-200 space-y-1.5">
                <li>• Answer questions to earn score + coins (faster = more)</li>
                <li>• Spend coins on attacks, shields, and power-ups</li>
                <li>• Build streaks for combo bonuses (5 = free item, 10 = ultimate)</li>
                <li>• Random world events shake things up</li>
                <li>• No deaths — everyone plays the whole game</li>
              </ul>
            </div>

            <HostPlaysToggle value={hostPlays} onChange={setHostPlays} />
          </div>

          {error && <p className="mt-4 text-center text-red-300">{error}</p>}

          <div className="mt-8 flex gap-3">
            <button onClick={() => navigate(-1)} className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg font-bold transition-colors">Back</button>
            <button onClick={handleCreateGame} disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-lg font-bold transition-all disabled:opacity-50">
              <Play className="w-5 h-5" />
              {loading ? 'Creating...' : 'Create Game'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
