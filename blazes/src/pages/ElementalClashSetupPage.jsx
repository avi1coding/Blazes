import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Zap, Clock, Play, Swords } from 'lucide-react';

export default function ElementalClashSetupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { kit, user } = location.state || {};

  const [gameName, setGameName] = useState(`${kit?.title || 'Clash'} — Elemental Clash`);
  const [timeLimit, setTimeLimit] = useState(300); // seconds
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

  const generateGameCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const handleCreateGame = async () => {
    setLoading(true);
    setError('');
    const gameCode = generateGameCode();
    const settings = {
      gameName,
      timeLimit,
      pointsPerCorrectAnswer: 10,
      hostName: user.name,
      allowCustomPlayerNames,
    };
    try {
      const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
      const response = await fetch(`${base}/api/games/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostId: user.id, kitId: kit.id, gameCode, gameMode: 'elemental_clash', settings }),
      });
      if (!response.ok) throw new Error('Failed to create game.');
      const gameData = await response.json();
      navigate(`/game/waiting/${gameData.gameCode}`, { state: { user } });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const timeLimitOptions = [
    { label: '3 min', value: 180 },
    { label: '5 min', value: 300 },
    { label: '8 min', value: 480 },
    { label: '10 min', value: 600 },
    { label: '15 min', value: 900 },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-12 px-6">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-700 px-4 py-2 rounded-full font-bold mb-4">
            <Swords className="w-5 h-5" />
            Elemental Clash
          </div>
          <h1 className="text-4xl font-black text-gray-900 mb-2">Game Setup</h1>
          <p className="text-lg text-gray-600">Two teams battle with elemental attacks. Answer questions to earn energy and points!</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="space-y-6">
            {/* Game Name */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Game Name</label>
              <input type="text" value={gameName} onChange={(e) => setGameName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500" />
            </div>

            {/* Student Names */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Student Display Names</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setAllowCustomPlayerNames(false)}
                  className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-all border-2 ${!allowCustomPlayerNames ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                  Use Account Names
                </button>
                <button type="button" onClick={() => setAllowCustomPlayerNames(true)}
                  className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-all border-2 ${allowCustomPlayerNames ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                  Let Students Choose
                </button>
              </div>
            </div>

            {/* Game Duration */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                <Clock className="w-4 h-4 inline mr-1 text-purple-500" />
                Game Duration
              </label>
              <div className="flex flex-wrap gap-2">
                {timeLimitOptions.map(opt => (
                  <button key={opt.value} type="button" onClick={() => setTimeLimit(opt.value)}
                    className={`px-4 py-2 rounded-lg font-bold text-sm border-2 transition-all ${timeLimit === opt.value ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* How it works */}
            <div className="bg-purple-50 border-2 border-purple-100 rounded-xl p-4">
              <h4 className="font-black text-purple-900 mb-2 flex items-center gap-2">
                <Zap className="w-4 h-4" /> How It Works
              </h4>
              <ul className="text-sm text-purple-800 space-y-1">
                <li>Class splits into 2 teams automatically</li>
                <li>Correct answer = choose: <strong>+1 Energy</strong> (personal) or <strong>+10 Points</strong> (team)</li>
                <li>Spend Energy in the shop to launch elemental attacks on the other team</li>
                <li>Attacks remove points: Earthquake (-30), Tsunami (-50), Hurricane (-65), Wildfire (-100)</li>
                <li>Team with the most points when time runs out wins!</li>
              </ul>
            </div>
          </div>

          {error && <p className="mt-6 text-center text-red-600">{error}</p>}

          <div className="mt-10 flex justify-end gap-4">
            <button onClick={() => navigate(-1)} className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 transition-colors">Back</button>
            <button onClick={handleCreateGame} disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-500 text-white rounded-lg font-bold hover:shadow-lg transition-all disabled:opacity-50">
              <Play className="w-5 h-5" />
              {loading ? 'Creating...' : 'Create Game & Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
