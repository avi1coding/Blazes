import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Heart, Clock, Play } from 'lucide-react';

export default function SurvivalSetupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { kit, user } = location.state || {};

  const [gameName, setGameName] = useState(`${kit?.title || 'Survival'} — Survival`);
  const [livesPerPlayer, setLivesPerPlayer] = useState(3);
  const [questionTimeLimit, setQuestionTimeLimit] = useState(15);
  const [allowCustomPlayerNames, setAllowCustomPlayerNames] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!kit || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Missing game setup. Please select a kit first.</p>
          <button onClick={() => navigate('/home/teacher')} className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-red-700">
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
      pointsPerCorrectAnswer: 10,
      livesPerPlayer,
      questionTimeLimit,
      hostName: user.name,
      allowCustomPlayerNames,
      endless: true,
    };

    try {
      const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
      const response = await fetch(`${base}/api/games/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostId: user.id, kitId: kit.id, gameCode, gameMode: 'survival', settings }),
      });
      if (!response.ok) throw new Error('Failed to create game. Please try again.');
      const gameData = await response.json();
      navigate(`/game/waiting/${gameData.gameCode}`, { state: { user } });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const timeLimitOptions = [5, 10, 15, 20, 30, 45, 60];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-12 px-6">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-red-100 text-red-700 px-4 py-2 rounded-full font-bold mb-4">
            <Heart className="w-5 h-5 fill-red-500 text-red-500" />
            Survival Mode
          </div>
          <h1 className="text-4xl font-black text-gray-900 mb-2">Game Setup</h1>
          <p className="text-lg text-gray-600">Wrong answer or no answer in time = lose a life. Last one standing wins!</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="space-y-6">
            {/* Game Name */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Game Name</label>
              <input
                type="text"
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500"
              />
            </div>

            {/* Student Names */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Student Display Names</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAllowCustomPlayerNames(false)}
                  className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-all border-2 ${!allowCustomPlayerNames ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                >
                  Use Account Names
                </button>
                <button
                  type="button"
                  onClick={() => setAllowCustomPlayerNames(true)}
                  className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-all border-2 ${allowCustomPlayerNames ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                >
                  Let Students Choose
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Lives Per Player */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Lives Per Player</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setLivesPerPlayer(n)}
                      className={`w-11 h-11 rounded-xl font-black text-lg border-2 transition-all ${livesPerPlayer === n ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-700 border-gray-200 hover:border-red-300'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1 mt-2">
                  {Array.from({ length: livesPerPlayer }).map((_, i) => (
                    <Heart key={i} className="w-5 h-5 fill-red-500 text-red-500" />
                  ))}
                </div>
              </div>

              {/* Time per question */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  <Clock className="w-4 h-4 inline mr-1 text-orange-500" />
                  Time Per Question
                </label>
                <div className="flex flex-wrap gap-2">
                  {timeLimitOptions.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setQuestionTimeLimit(s)}
                      className={`px-3 py-2 rounded-lg font-bold text-sm border-2 transition-all ${questionTimeLimit === s ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-700 border-gray-200 hover:border-orange-300'}`}
                    >
                      {s}s
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Info box */}
            <div className="bg-red-50 border-2 border-red-100 rounded-xl p-4 flex gap-3">
              <Heart className="w-5 h-5 fill-red-400 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">
                Each question has <strong>{questionTimeLimit} seconds</strong>. Wrong answer or no answer before time runs out = lose a life.
                Lose all <strong>{livesPerPlayer}</strong> {livesPerPlayer === 1 ? 'life' : 'lives'} and you're eliminated.
                Last player standing wins.
              </p>
            </div>
          </div>

          {error && <p className="mt-6 text-center text-red-600">{error}</p>}

          <div className="mt-10 flex justify-end gap-4">
            <button onClick={() => navigate(-1)} className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 transition-colors">
              Back
            </button>
            <button
              onClick={handleCreateGame}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-lg font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-wait"
            >
              <Play className="w-5 h-5" />
              {loading ? 'Creating Game...' : 'Create Game & Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
