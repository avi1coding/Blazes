import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Settings, Clock, Coins, Sparkles, Play, Swords } from 'lucide-react';
import HostPlaysToggle from '../components/HostPlaysToggle';

export default function ArenaSetupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { kit, user } = location.state || {};

  const [gameName, setGameName] = useState(`${kit?.title || 'Arena'} Battle`);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(10);
  const [startingCoins, setStartingCoins] = useState(100);
  const [eventInterval, setEventInterval] = useState(60);
  const [hostPlays, setHostPlays] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!kit || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Missing game setup. Please select a kit first.</p>
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
    const settings = { gameName, timeLimit: timeLimitMinutes * 60, startingCoins, eventInterval, hostName: user.name, hostPlays };
    try {
      const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
      const res = await fetch(`${base}/api/games/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostId: user.id, kitId: kit.id, gameCode, gameMode: 'arena', settings }),
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
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6">
        <div className="text-center mb-8 sm:mb-10 md:mb-12">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 mb-2">Game Setup</h1>
          <p className="text-base sm:text-lg text-gray-600">Configure your 'Arena' game.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 md:p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-fuchsia-500 rounded-lg flex items-center justify-center">
              <Swords className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Game Settings</h2>
          </div>

          <div className="space-y-6">
            <div>
              <label htmlFor="gameName" className="block text-sm font-medium text-gray-700 mb-1">
                Game Name
              </label>
              <input
                type="text"
                id="gameName"
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="timeLimit" className="block text-sm font-medium text-gray-700 mb-1">
                  Time Limit (minutes)
                </label>
                <div className="relative">
                  <Clock className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    id="timeLimit"
                    value={timeLimitMinutes}
                    onChange={(e) => setTimeLimitMinutes(Math.min(60, Math.max(1, Number(e.target.value) || 1)))}
                    min={1}
                    max={60}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-400">Between 1 and 60 minutes</p>
              </div>

              <div>
                <label htmlFor="startingCoins" className="block text-sm font-medium text-gray-700 mb-1">
                  Starting Coins
                </label>
                <div className="relative">
                  <Coins className="w-5 h-5 text-yellow-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    id="startingCoins"
                    value={startingCoins}
                    onChange={(e) => setStartingCoins(Math.max(0, Number(e.target.value) || 0))}
                    min={0}
                    step={25}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="eventInterval" className="block text-sm font-medium text-gray-700 mb-1">
                World Event Frequency (seconds)
              </label>
              <div className="relative">
                <Sparkles className="w-5 h-5 text-purple-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  id="eventInterval"
                  value={eventInterval}
                  onChange={(e) => setEventInterval(Math.max(0, Number(e.target.value) || 0))}
                  min={0}
                  step={15}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">Set to 0 to disable world events</p>
            </div>

            <HostPlaysToggle value={hostPlays} onChange={setHostPlays} />
          </div>

          {error && <p className="mt-6 text-center text-red-600">{error}</p>}

          <div className="mt-10 flex justify-end gap-4">
            <button onClick={() => navigate(-1)}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 transition-colors">
              Back
            </button>
            <button onClick={handleCreateGame} disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white rounded-lg font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-wait">
              <Play className="w-5 h-5" />
              {loading ? 'Creating Game...' : 'Create Game & Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
