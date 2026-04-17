import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Flame, Play, Clock } from 'lucide-react';

export default function InfernoTowerSetupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { kit, user } = location.state || {};

  const [gameName, setGameName] = useState(`${kit?.title || 'Inferno'} — Inferno Tower`);
  const [fireSpeed, setFireSpeed] = useState('medium');
  const [allowCustomPlayerNames, setAllowCustomPlayerNames] = useState(false);
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

  const speedPresets = {
    slow: { initialFireInterval: 8, fireAccelerationInterval: 45, fireAccelerationAmount: 0.3, minFireInterval: 2.5, label: 'Slow', desc: 'Fire rises slowly — more time to think' },
    medium: { initialFireInterval: 5, fireAccelerationInterval: 30, fireAccelerationAmount: 0.5, minFireInterval: 1.5, label: 'Medium', desc: 'Balanced pace — fire speeds up steadily' },
    fast: { initialFireInterval: 3, fireAccelerationInterval: 20, fireAccelerationAmount: 0.5, minFireInterval: 1, label: 'Fast', desc: 'Fire rises fast — think quick or burn' },
    insane: { initialFireInterval: 2, fireAccelerationInterval: 15, fireAccelerationAmount: 0.3, minFireInterval: 0.8, label: 'Insane', desc: 'Near-instant fire — only the fastest survive' },
  };

  const generateGameCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const handleCreateGame = async () => {
    setLoading(true);
    setError('');
    const gameCode = generateGameCode();
    const preset = speedPresets[fireSpeed];
    const settings = {
      gameName,
      ...preset,
      wrongAnswerFreezeSeconds: 3,
      ghostFreezeSeconds: 2,
      hostName: user.name,
      allowCustomPlayerNames,
    };
    try {
      const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
      const response = await fetch(`${base}/api/games/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostId: user.id, kitId: kit.id, gameCode, gameMode: 'inferno_tower', settings }),
      });
      if (!response.ok) throw new Error('Failed to create game.');
      const gameData = await response.json();
      navigate(`/game/waiting/${gameData.gameCode}`, { state: { user } });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-12 px-6">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 px-4 py-2 rounded-full font-bold mb-4">
            <Flame className="w-5 h-5" />
            Inferno Tower
          </div>
          <h1 className="text-4xl font-black text-gray-900 mb-2">Game Setup</h1>
          <p className="text-lg text-gray-600">Climb the tower before the fire catches you!</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="space-y-6">
            {/* Game Name */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Game Name</label>
              <input type="text" value={gameName} onChange={(e) => setGameName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500" />
            </div>

            {/* Student Names */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Student Display Names</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setAllowCustomPlayerNames(false)}
                  className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-all border-2 ${!allowCustomPlayerNames ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                  Use Account Names
                </button>
                <button type="button" onClick={() => setAllowCustomPlayerNames(true)}
                  className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-all border-2 ${allowCustomPlayerNames ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                  Let Students Choose
                </button>
              </div>
            </div>

            {/* Fire Speed */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                <Flame className="w-4 h-4 inline mr-1 text-orange-500" />
                Fire Speed
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(speedPresets).map(([key, preset]) => (
                  <button key={key} type="button" onClick={() => setFireSpeed(key)}
                    className={`p-3 rounded-xl text-center border-2 transition-all ${fireSpeed === key ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-700 border-gray-200 hover:border-orange-300'}`}>
                    <div className="font-black text-lg">{preset.label}</div>
                    <div className={`text-xs mt-1 ${fireSpeed === key ? 'text-orange-100' : 'text-gray-500'}`}>{preset.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* How it works */}
            <div className="bg-orange-50 border-2 border-orange-100 rounded-xl p-4">
              <h4 className="font-black text-orange-900 mb-2 flex items-center gap-2">
                <Flame className="w-4 h-4" /> How It Works
              </h4>
              <ul className="text-sm text-orange-800 space-y-1">
                <li>Correct answer = climb 1 floor</li>
                <li>Wrong answer = frozen for 3 seconds (fire keeps rising!)</li>
                <li>Fire rises from below and speeds up over time</li>
                <li>If the fire catches you, you become a ghost</li>
                <li>Ghosts can answer questions to send fireballs that freeze alive players</li>
                <li>Last player standing wins!</li>
              </ul>
            </div>
          </div>

          {error && <p className="mt-6 text-center text-red-600">{error}</p>}

          <div className="mt-10 flex justify-end gap-4">
            <button onClick={() => navigate(-1)} className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 transition-colors">Back</button>
            <button onClick={handleCreateGame} disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-600 to-red-500 text-white rounded-lg font-bold hover:shadow-lg transition-all disabled:opacity-50">
              <Play className="w-5 h-5" />
              {loading ? 'Creating...' : 'Create Game & Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
