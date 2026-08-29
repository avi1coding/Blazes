import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Flame, Users, TrendingUp, Eye, LogOut, StopCircle, X, Maximize2 } from 'lucide-react';
import { AvatarPreview, cacheTier } from './SkinsPage';
import VolumeControl from '../components/VolumeControl';
import { createSeamlessLoop } from '../utils/seamlessAudio';

export default function TeacherMonitoringDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { gameCode } = useParams();
  const [game, setGame] = useState(location.state?.game || null);
  const [participants, setParticipants] = useState([]);
  const [gameStatus, setGameStatus] = useState('waiting');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [playerSkins, setPlayerSkins] = useState({});
  const fetchedSkinIds = useRef(new Set());
  const navigatedRef = useRef(false);
  const [endGameConfirm, setEndGameConfirm] = useState(false);
  const gameAudioRef = useRef(null);

  // Gameplay music. Seamless loop, plays only on host's device
  useEffect(() => {
    const s = JSON.parse(localStorage.getItem('blazes_settings') || '{}');
    const vol = (s.music_volume ?? 30) / 100;
    const muted = s.sound_enabled === false || s.sound_enabled === 0;
    const audio = createSeamlessLoop('/audio/GameMusic.mp3', muted ? 0 : vol);
    gameAudioRef.current = audio;
    audio.play();
    return () => audio.stop();
  }, []);

  // Teacher closing the monitoring tab abandons the game so students aren't
  // left waiting on a host that's no longer watching. Skip when the game has
  // already ended through the normal flow. fetch + keepalive (instead of
  // sendBeacon) lets us hit the existing PUT endpoint without changing it.
  useEffect(() => {
    if (!gameCode) return;
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
    const handleUnload = () => {
      if (gameStatus === 'ended') return;
      try {
        fetch(`${baseUrl}/api/games/${gameCode}/abandon`, {
          method: 'PUT',
          keepalive: true,
        }).catch(() => {});
      } catch (_) {}
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [gameCode, gameStatus]);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user) {
      navigate('/login');
      return;
    }

    if (user.role !== 'teacher') {
      navigate('/home/student');
      return;
    }

    const fetchGame = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
        const response = await fetch(`${baseUrl}/api/games/${gameCode}`);
        const data = await response.json();

        if (response.ok) {
          setGame(data);
          setParticipants(data.participants || []);
          setGameStatus(data.status);
          setError('');
          // Auto-navigate to results when game ends
          if (data.status === 'ended' && !navigatedRef.current) {
            navigatedRef.current = true;
            if (gameAudioRef.current) gameAudioRef.current.stop();
            navigate(`/game/teacher-results/${gameCode}`);
          }
        } else {
          setError(data.error || 'Failed to fetch game details');
        }
      } catch (err) {
        console.error('Error fetching game for monitoring:', err); // (already correct)
        setError(`Error connecting to server: ${err.message}. Please check if the backend is running.`);
      } finally {
        setLoading(false);
      }
    };

    fetchGame();
    const interval = setInterval(fetchGame, 2000);
    return () => clearInterval(interval);
  }, [gameCode, navigate]);

  // Fetch equipped skin for any participants we haven't fetched yet
  useEffect(() => {
    const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
    participants.forEach(p => {
      if (!p.user_id || fetchedSkinIds.current.has(p.user_id)) return;
      fetchedSkinIds.current.add(p.user_id);
      fetch(`${base}/api/skins/${p.user_id}`)
        .then(r => r.json())
        .then(d => {
          if (d.equipped?.avatar_skin) setPlayerSkins(prev => ({ ...prev, [p.user_id]: d.equipped.avatar_skin }));
          if (d.tier) cacheTier(p.user_id, d.tier);
        })
        .catch(() => {});
    });
  }, [participants]);

  const handleViewStudent = (userId) => {
    navigate(`/game/monitor/${gameCode}/${userId}`, { state: { game, user: JSON.parse(localStorage.getItem('user')) } }); // Pass user for context
  };

  const handleEndGame = () => {
    setEndGameConfirm(true);
  };

  const confirmEndGame = async () => {
    setEndGameConfirm(false);
    if (gameAudioRef.current) gameAudioRef.current.stop();
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
      await fetch(`${baseUrl}/api/games/${gameCode}/end`, { method: 'PUT' });
      navigate(`/game/teacher-results/${gameCode}`);
    } catch (err) {
      console.error('Error ending game:', err);
    }
  };

  const [leaveConfirm, setLeaveConfirm] = useState(false);

  const handleLeave = () => {
    // If the game is still running, leaving the dashboard ends it for everyone
    //. Confirm first so the host doesn't accidentally torch a live session.
    if (gameStatus === 'started') {
      setLeaveConfirm(true);
      return;
    }
    if (gameAudioRef.current) gameAudioRef.current.stop();
    navigate('/home/teacher');
  };

  const confirmLeave = async () => {
    setLeaveConfirm(false);
    if (gameAudioRef.current) gameAudioRef.current.stop();
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
      await fetch(`${baseUrl}/api/games/${gameCode}/abandon`, { method: 'PUT' });
    } catch (err) {
      console.error('Error abandoning game:', err);
    }
    navigate('/home/teacher');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Flame className="w-16 h-16 text-red-600 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600 font-semibold">Loading game...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* End Game Confirmation Modal */}
      {endGameConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border-2 border-red-200 p-5 sm:p-8 max-w-md w-full shadow-xl">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <StopCircle className="w-6 h-6 text-red-600" />
              </div>
              <h2 className="text-xl font-black text-gray-900">End Game?</h2>
            </div>
            <p className="text-gray-700 mb-6">End the game for all students? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setEndGameConfirm(false)}
                className="flex-1 py-2.5 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmEndGame}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors"
              >
                End Game
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave-while-running confirmation. Abandons the game */}
      {leaveConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border-2 border-orange-200 p-5 sm:p-8 max-w-md w-full shadow-xl">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                <LogOut className="w-6 h-6 text-orange-600" />
              </div>
              <h2 className="text-xl font-black text-gray-900">Leave Game?</h2>
            </div>
            <p className="text-gray-700 mb-6">
              The game is still running. Leaving will end it for everyone, and the
              students won't see a final leaderboard. If you want a normal end with
              placements, click <span className="font-bold">End Game</span> instead.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setLeaveConfirm(false)}
                className="flex-1 py-2.5 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 transition-colors"
              >
                Stay
              </button>
              <button
                onClick={confirmLeave}
                className="flex-1 py-2.5 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 transition-colors"
              >
                Leave Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center">
              <Flame className="w-6 h-6 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-2xl font-black text-gray-900">Blazes</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-gray-600">
              <VolumeControl audioRef={gameAudioRef} />
            </div>
            <button
              onClick={() => window.open(`/game/present/${gameCode}`, '_blank', 'noopener')}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-colors font-bold"
              title="Open a themed leaderboard screen for the projector"
            >
              <Maximize2 className="w-5 h-5" />
              Present
            </button>
            <button
              onClick={handleEndGame}
              className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg transition-colors font-bold"
            >
              <StopCircle className="w-5 h-5" />
              End Game
            </button>
            <button
              onClick={handleLeave}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors font-bold"
            >
              <LogOut className="w-5 h-5" />
              Leave
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-4xl font-black text-gray-900 mb-2">Game Monitoring Dashboard</h1>
          <p className="text-gray-600 text-sm sm:text-base">Watch your students' progress in real-time</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-red-700 font-semibold text-sm mb-8">
            {error}
          </div>
        )}

        {/* Game Status */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Game Code</p>
              <p className="text-3xl font-black text-gray-900 tracking-widest">{gameCode}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 mb-1">Status</p>
              <p className="text-2xl font-black capitalize">
                <span className={
                  gameStatus === 'started'
                    ? 'text-green-600'
                    : gameStatus === 'ended'
                      ? 'text-red-600'
                      : 'text-blue-600'
                }>
                  {gameStatus}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Students. The teacher needs to be able to click a student and see
            what questions they answered. */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-black text-gray-900">Students ({participants.length})</h2>
              <p className="text-sm text-gray-600">Click on a student to view detailed progress</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-600 font-semibold">Live</span>
            </div>
          </div>

          {participants.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No students have joined yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {participants.map((player, index) => {
                const hasLeft = !!player.left_at;
                return (
                  <button
                    key={player.id}
                    onClick={() => handleViewStudent(player.user_id)}
                    className={`p-4 sm:p-6 rounded-xl transition-all border-2 text-left relative ${
                      hasLeft
                        ? 'bg-red-50 border-red-200 opacity-70 cursor-default'
                        : 'bg-gradient-to-br from-blue-50 to-purple-50 hover:shadow-lg border-gray-200 hover:border-blue-500'
                    }`}
                  >
                    {hasLeft && (
                      <div className="absolute top-3 right-3 bg-red-600 text-white text-xs font-black px-2 py-1 rounded-full flex items-center gap-1">
                        <X className="w-3 h-3" /> LEFT
                      </div>
                    )}
                    <div className="flex items-start justify-between mb-4">
                      <AvatarPreview skinId={player.avatar_skin || playerSkins[player.user_id] || 'default'} initial={player.player_name?.[0]?.toUpperCase() || 'S'} size={56} userId={player.user_id} />
                      <Eye className="w-5 h-5 text-blue-600" />
                    </div>
                    <h3 className="font-bold text-gray-900 text-lg mb-1">
                      {player.player_name || `Student ${index + 1}`}
                    </h3>

                    <div className="flex items-center gap-2 pt-3 border-t border-gray-300">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-semibold text-gray-700">
                        Score: <span className="text-green-600">{player.score || 0}</span>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
