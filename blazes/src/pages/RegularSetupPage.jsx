import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, Settings, Play } from 'lucide-react';

export default function RegularSetupPage() {
  const navigate = useNavigate();
  const [gameName, setGameName] = useState('My Blazes Quiz');
  const [timeLimit, setTimeLimit] = useState(600); // 10 minutes
  const [kitId, setKitId] = useState(''); // You'll need a way to select a question kit
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // TODO: You should fetch available question kits and let the user select one.
  // For now, we'll assume a default or require manual input.

  const handleCreateGame = async (e) => {
    e.preventDefault();
    if (!kitId) {
      setError('Please provide a question kit ID.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:5000/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameMode: 'regular',
          userId: JSON.parse(localStorage.getItem('user'))?.id,
          kitId: parseInt(kitId, 10),
          settings: {
            gameName,
            gameplayTime: timeLimit,
            repeatQuestions: true, // Or make this a form option
          },
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to create game.');
      }

      const newGame = await response.json();
      // After creating a regular game, teachers go to the teacher waiting screen
      navigate(`/game/waiting/${newGame.game_code}`, { state: { game: newGame } });

    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Flame className="w-16 h-16 mx-auto text-red-600" />
          <h1 className="text-4xl font-black text-gray-800 mt-2">Setup Regular Game</h1>
          <p className="text-gray-600">Configure your quiz and get ready to play.</p>
        </div>

        <form onSubmit={handleCreateGame} className="bg-white p-8 rounded-2xl shadow-lg space-y-6">
          <div className="space-y-2">
            <label htmlFor="gameName" className="text-sm font-bold text-gray-600">Game Name</label>
            <input
              id="gameName"
              type="text"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="kitId" className="text-sm font-bold text-gray-600">Question Kit ID</label>
            <input
              id="kitId"
              type="number"
              placeholder="Enter Kit ID (e.g., 1)"
              value={kitId}
              onChange={(e) => setKitId(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              required
            />
            {/* A dropdown to select a kit would be better here */}
          </div>

          <div className="space-y-2">
            <label htmlFor="timeLimit" className="text-sm font-bold text-gray-600">Time Limit (seconds)</label>
            <input
              id="timeLimit"
              type="number"
              value={timeLimit}
              onChange={(e) => setTimeLimit(parseInt(e.target.value, 10))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              required
            />
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-red-600 to-orange-500 text-white font-bold py-4 px-4 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <Settings className="w-6 h-6 animate-spin" />
            ) : (
              <Play className="w-6 h-6" />
            )}
            <span>{loading ? 'Creating Game...' : 'Create Game & Go to Lobby'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}