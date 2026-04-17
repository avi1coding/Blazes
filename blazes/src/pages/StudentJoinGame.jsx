import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Flame, LogOut, UserX } from 'lucide-react';
import { AvatarPreview, isBlazesPlusCached } from './SkinsPage';

export default function StudentJoinGame() {
  const navigate = useNavigate();
  const location = useLocation();
  const gameCode = location.state?.gameCode || '';
  const user = JSON.parse(localStorage.getItem('user'));

  const [playerName, setPlayerName] = useState('');
  const [allowCustomNames, setAllowCustomNames] = useState(null); // null = loading
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [equippedSkinId, setEquippedSkinId] = useState('default');

  // Fetch equipped skin
  useEffect(() => {
    if (!user) return;
    const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
    fetch(`${base}/api/skins/${user.id}`)
      .then(r => r.json())
      .then(d => { if (d.equipped?.avatar_skin) setEquippedSkinId(d.equipped.avatar_skin); })
      .catch(() => {});
  }, [user?.id]);

  // Fetch game settings to know if custom names are allowed
  useEffect(() => {
    if (!gameCode) return;
    const fetchSettings = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
        const res = await fetch(`${baseUrl}/api/games/${gameCode.toUpperCase()}`);
        const data = await res.json();
        const allowed = data?.settings?.allowCustomPlayerNames === true;
        setAllowCustomNames(allowed);
        setPlayerName(user?.name || '');
      } catch {
        setAllowCustomNames(false);
        setPlayerName(user?.name || '');
      }
    };
    fetchSettings();
  }, [gameCode]);

  const handleJoinGame = async (e) => {
    e.preventDefault();
    setError('');

    const nameToUse = allowCustomNames ? playerName.trim() : (user?.name || '');

    if (!nameToUse) {
      setError('Please enter your name');
      return;
    }
    if (!gameCode) {
      setError('No game code provided');
      return;
    }
    if (!user) {
      setError('You need an account to join this game.');
      return;
    }

    setIsLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
      const response = await fetch(`${baseUrl}/api/games/${gameCode.toUpperCase()}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, playerName: nameToUse })
      });

      const data = await response.json();
      if (response.ok) {
        navigate(`/game/lobby/${gameCode.toUpperCase()}`);
      } else {
        setError(data.error || 'Failed to join game');
      }
    } catch (err) {
      setError(`Error connecting to server: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    navigate('/login');
  };

  // Account required wall — show before any form
  const needsAccount = allowCustomNames === false && !user;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center">
              <Flame className="w-6 h-6 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-2xl font-black text-gray-900">Blazes</span>
          </div>
          {user && (
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors font-bold"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          )}
        </div>
      </nav>

      {/* Account required wall */}
      {needsAccount && (
        <div className="max-w-md mx-auto px-6 py-20">
          <div className="bg-white rounded-3xl p-8 shadow-lg border-2 border-red-100 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <UserX className="w-8 h-8 text-red-600" strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl font-black text-gray-900 mb-2">Account Required</h1>
            <p className="text-gray-600 mb-2">
              This game uses account names — you need to be logged in to join.
            </p>
            <div className="mb-6 p-3 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Game Code</p>
              <p className="text-2xl font-black text-gray-900 tracking-widest">{gameCode}</p>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                to="/signup"
                state={{ redirect: `/game/join`, gameCode }}
                className="w-full bg-red-600 text-white font-black py-3 rounded-xl hover:bg-red-700 transition-colors"
              >
                Create an Account
              </Link>
              <Link
                to="/login"
                state={{ redirect: `/game/join`, gameCode }}
                className="w-full bg-white border-2 border-gray-200 text-gray-700 font-bold py-3 rounded-xl hover:border-gray-300 transition-colors"
              >
                Log In
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!needsAccount && <div className="max-w-md mx-auto px-6 py-20">
        <div className="bg-white rounded-3xl p-8 shadow-lg border-2 border-gray-200">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Flame className="w-8 h-8 text-white" strokeWidth={2.5} />
            </div>
            <h1 className="text-3xl font-black text-gray-900 mb-2">Join Game</h1>
            <p className="text-gray-600">
              {allowCustomNames ? 'Enter a display name to join' : 'Joining as your account name'}
            </p>
          </div>

          <div className="mb-6 p-4 bg-gray-50 rounded-xl text-center border-2 border-gray-200">
            <p className="text-sm text-gray-600 mb-2">Game Code</p>
            <p className="text-3xl font-black text-gray-900 tracking-widest">{gameCode}</p>
          </div>

          <form onSubmit={handleJoinGame} className="space-y-4">
            {/* Name section */}
            {allowCustomNames === null ? (
              <div className="h-14 bg-gray-100 rounded-xl animate-pulse" />
            ) : allowCustomNames ? (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Your Display Name
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name"
                  autoFocus
                  maxLength={30}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-red-600 focus:outline-none transition-colors"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Joining as
                </label>
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl border-2 border-gray-200">
                  <AvatarPreview skinId={equippedSkinId} initial={user?.name?.charAt(0).toUpperCase()} size={36} isPlus={isBlazesPlusCached()} />
                  <span className="font-semibold text-gray-900">{user?.name}</span>
                  <span className="text-xs text-gray-400 ml-auto">account name</span>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-red-700 font-semibold text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || allowCustomNames === null}
              className="w-full bg-gradient-to-r from-red-600 to-orange-500 text-white font-black py-3 rounded-xl hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Joining...' : 'Join Game'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/home/student')}
              className="w-full text-gray-600 font-bold py-2 rounded-xl hover:bg-gray-100 transition-colors"
            >
              Back to Home
            </button>
          </form>
        </div>

        <div className="mt-8 bg-blue-50 border-2 border-blue-200 rounded-2xl p-6 text-center">
          <h3 className="font-black text-blue-900 mb-2">How it works</h3>
          <p className="text-blue-700 text-sm">
            Ask your teacher for the game code, enter it here, and join the waiting room. The game will start once the teacher clicks "Start Game"!
          </p>
        </div>
      </div>}
    </div>
  );
}
