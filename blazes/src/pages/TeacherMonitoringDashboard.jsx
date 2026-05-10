import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Flame, Users, TrendingUp, Eye, LogOut, StopCircle, Heart, Zap, Swords, Clock, Mountain, Droplets, Wind, Ghost, Crosshair, X, Briefcase } from 'lucide-react';
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
  const [clashData, setClashData] = useState(null);
  const [marketsLeaderboard, setMarketsLeaderboard] = useState([]); // [{user_id, portfolio}]
  const [clashTab, setClashTab] = useState('battlefield'); // 'battlefield' | 'dashboard'
  const [displayTimeLeft, setDisplayTimeLeft] = useState(null);
  const [battleEvents, setBattleEvents] = useState([]); // accumulated attack log for battlefield
  const seenAttackIdsRef = useRef(new Set());
  const fetchedSkinIds = useRef(new Set());
  const navigatedRef = useRef(false);
  const [endGameConfirm, setEndGameConfirm] = useState(false);
  const gameAudioRef = useRef(null);

  // Gameplay music — seamless loop, plays only on host's device
  useEffect(() => {
    const s = JSON.parse(localStorage.getItem('blazes_settings') || '{}');
    const vol = (s.music_volume ?? 30) / 100;
    const muted = s.sound_enabled === false || s.sound_enabled === 0;
    const audio = createSeamlessLoop('/audio/GameMusic.mp3', muted ? 0 : vol);
    gameAudioRef.current = audio;
    audio.play();
    return () => audio.stop();
  }, []);

  // Arena: trigger random world events between 50-70 seconds (host-only)
  useEffect(() => {
    if (!game || game.game_mode !== 'arena' || gameStatus !== 'started') return;
    let cancelled = false;
    const fireEvent = () => {
      if (cancelled) return;
      const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
      fetch(`${baseUrl}/api/games/${gameCode}/arena/event`, { method: 'POST' }).catch(() => {});
      // Schedule next: random 50-70s
      const nextDelay = (50 + Math.random() * 20) * 1000;
      setTimeout(fireEvent, nextDelay);
    };
    // Initial trigger after 50-70s
    const firstDelay = (50 + Math.random() * 20) * 1000;
    const id = setTimeout(fireEvent, firstDelay);
    return () => { cancelled = true; clearTimeout(id); };
  }, [game, gameStatus, gameCode]);

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
          // Fetch elemental clash data if needed
          if (data.game_mode === 'elemental_clash' && data.status === 'started') {
            try {
              const clashRes = await fetch(`${baseUrl}/api/games/${gameCode}/elemental-state`);
              if (clashRes.ok) setClashData(await clashRes.json());
            } catch (_) { }
          }
          // Fetch inferno tower data if needed
          if (data.game_mode === 'inferno_tower' && data.status === 'started') {
            try {
              const infernoRes = await fetch(`${baseUrl}/api/games/${gameCode}/inferno-state`);
              if (infernoRes.ok) setClashData(await infernoRes.json()); // reuse clashData state
            } catch (_) { }
          }
          // Fetch markets state — leaderboard portfolio values are the live "score"
          if (data.game_mode === 'elemental_markets' && data.status === 'started') {
            try {
              const mRes = await fetch(`${baseUrl}/api/games/${gameCode}/markets/state`);
              if (mRes.ok) {
                const mData = await mRes.json();
                setMarketsLeaderboard(mData.leaderboard || []);
              }
            } catch (_) { }
          }
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

  // Sync timer from server, tick locally
  useEffect(() => {
    if (!clashData?.timeLeft) return;
    setDisplayTimeLeft(prev => {
      if (prev == null || Math.abs(prev - clashData.timeLeft) > 2) return Math.round(clashData.timeLeft);
      return prev;
    });
  }, [clashData?.timeLeft]);

  useEffect(() => {
    if (displayTimeLeft == null || displayTimeLeft <= 0) return;
    const t = setTimeout(() => setDisplayTimeLeft(p => Math.max(0, (p ?? 0) - 1)), 1000);
    return () => clearTimeout(t);
  }, [displayTimeLeft]);

  // Accumulate battle events from polls
  useEffect(() => {
    if (!clashData?.recentAttacks) return;
    for (const atk of clashData.recentAttacks) {
      if (!seenAttackIdsRef.current.has(atk.id)) {
        seenAttackIdsRef.current.add(atk.id);
        const attacker = (clashData.participants || []).find(p => p.user_id === atk.attacker_user_id);
        setBattleEvents(prev => [{
          ...atk,
          attackerName: attacker?.player_name || 'Player',
          time: new Date(),
        }, ...prev].slice(0, 50)); // keep last 50
      }
    }
  }, [clashData?.recentAttacks]);

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
    // — confirm first so the host doesn't accidentally torch a live session.
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

      {/* Leave-while-running confirmation — abandons the game */}
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

        {/* Inferno Tower */}
        {game?.game_mode === 'inferno_tower' && clashData && (() => {
          const players = (clashData.participants || []).sort((a, b) => (b.tower_floor || 0) - (a.tower_floor || 0));
          const maxFloor = Math.max(clashData.fireLevel || 0, ...players.map(p => p.tower_floor || 0), 10);
          const alive = players.filter(p => !p.is_ghost);
          const ghosts = players.filter(p => p.is_ghost);
          return (
            <div className="mb-8">
              {/* Fullscreen button */}
              <button
                onClick={() => window.open(`/game/inferno-tower-view/${gameCode}`, '_blank')}
                className="w-full mb-4 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-orange-600 to-red-500 text-white font-black rounded-xl hover:shadow-lg transition-all"
              >
                <Flame className="w-5 h-5" />
                Open Fullscreen Tower View
              </button>

              {/* Side by side: Data left, Tower right */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* Left: Stats + Player List */}
                <div className="lg:col-span-3 space-y-4">
                  {/* Sudden Death / Tiebreaker banner */}
                  {clashData.suddenDeath === 1 && (
                    <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-2xl p-4 text-center shadow-lg">
                      <div className="flex items-center justify-center gap-2">
                        <Flame className="w-6 h-6 text-red-200 animate-pulse" />
                        <span className="text-xl font-black text-white tracking-wide">SUDDEN DEATH</span>
                        <Flame className="w-6 h-6 text-red-200 animate-pulse" />
                      </div>
                      <p className="text-red-200 text-sm font-semibold mt-1">Fire is rising faster — next player down loses!</p>
                    </div>
                  )}
                  {clashData.suddenDeath === 2 && (
                    <div className="bg-gradient-to-r from-yellow-600 to-amber-600 rounded-2xl p-4 text-center shadow-lg">
                      <div className="flex items-center justify-center gap-2">
                        <Crosshair className="w-6 h-6 text-yellow-200" />
                        <span className="text-xl font-black text-white tracking-wide">TIEBREAKER</span>
                        <Crosshair className="w-6 h-6 text-yellow-200" />
                      </div>
                      <p className="text-yellow-200 text-sm font-semibold mt-1">First correct answer wins!</p>
                    </div>
                  )}

                  {/* Stats cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="bg-white rounded-2xl p-4 text-center border border-gray-200">
                      <Users className="w-5 h-5 text-green-500 mx-auto mb-1" />
                      <div className="text-2xl font-black text-green-600">{alive.length}</div>
                      <div className="text-xs font-bold text-gray-500">Alive</div>
                    </div>
                    <div className="bg-white rounded-2xl p-4 text-center border border-gray-200">
                      <Ghost className="w-5 h-5 text-purple-500 mx-auto mb-1" />
                      <div className="text-2xl font-black text-purple-600">{ghosts.length}</div>
                      <div className="text-xs font-bold text-gray-500">Ghosts</div>
                    </div>
                    <div className="bg-white rounded-2xl p-4 text-center border border-gray-200">
                      <Flame className="w-5 h-5 text-orange-500 mx-auto mb-1" />
                      <div className="text-2xl font-black text-orange-600">F{clashData.fireLevel}</div>
                      <div className="text-xs font-bold text-gray-500">Fire Level</div>
                    </div>
                  </div>

                  {/* Player List */}
                  <div className="bg-white rounded-2xl p-5 border border-gray-200">
                    <h3 className="font-black text-gray-900 mb-3">Leaderboard</h3>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {players.map((p, i) => {
                        const place = i === 0 ? 1 : (
                          (p.tower_floor || 0) === (players[i - 1].tower_floor || 0) && (p.is_ghost || 0) === (players[i - 1].is_ghost || 0)
                            ? (() => { let j = i - 1; while (j > 0 && (players[j].tower_floor || 0) === (players[j - 1].tower_floor || 0) && (players[j].is_ghost || 0) === (players[j - 1].is_ghost || 0)) j--; return j + 1; })()
                            : i + 1
                        );
                        return (
                          <div key={p.user_id} className={`flex items-center gap-3 p-3 rounded-xl ${p.is_ghost ? 'bg-gray-100 opacity-50' : place === 1 ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'}`}>
                            <span className={`font-black w-6 text-center text-sm ${place === 1 ? 'text-yellow-500' : 'text-gray-400'}`}>#{place}</span>
                            <AvatarPreview skinId={p.avatar_skin || playerSkins[p.user_id] || 'default'} initial={(p.player_name || '?')[0].toUpperCase()} size={32} />
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-gray-900 text-sm truncate">{p.player_name}</div>
                              {p.is_ghost && <div className="text-xs text-purple-500 font-semibold">Ghost</div>}
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                              <span className="font-black text-orange-600">{clashData.suddenDeath === 2 ? 'TB' : `F${p.tower_floor || 0}`}</span>
                              <span className="font-bold text-gray-400">{p.score || 0}pts</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right: Tower Visualization */}
                <div className="lg:col-span-2">
                  <div className="bg-gray-900 rounded-2xl p-4 h-full min-h-[500px] relative overflow-hidden">
                    {/* Tower walls */}
                    <div className="absolute inset-x-6 top-4 bottom-4 border-l-2 border-r-2 border-gray-700/60" />
                    {/* Fire */}
                    <div className="absolute bottom-0 inset-x-6 bg-gradient-to-t from-red-700 via-orange-600 to-yellow-500/20 transition-all duration-500 rounded-t-lg"
                      style={{ height: `${Math.min(95, ((clashData.fireLevel || 0) / maxFloor) * 100)}%` }}>
                      {/* Flame tips */}
                      <div className="absolute -top-3 left-0 right-0 flex justify-around">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="w-2 h-4 bg-gradient-to-t from-orange-500 to-yellow-400 rounded-full animate-pulse"
                            style={{ animationDelay: `${i * 0.2}s` }} />
                        ))}
                      </div>
                    </div>
                    {/* Floor markers */}
                    {Array.from({ length: 6 }).map((_, i) => {
                      const f = Math.round((maxFloor / 5) * i);
                      const y = (f / maxFloor) * 90;
                      return (
                        <div key={i} className="absolute left-2 text-[10px] font-bold text-gray-600" style={{ bottom: `${y + 4}%` }}>
                          F{f}
                        </div>
                      );
                    })}
                    {/* Players */}
                    {players.map((p, idx) => {
                      const yPercent = ((p.tower_floor || 0) / maxFloor) * 88;
                      const xOffset = players.length <= 4 ? 20 + (idx * 20) : 10 + ((idx % 5) * 18);
                      return (
                        <div key={p.user_id} className={`absolute transition-all duration-700 flex flex-col items-center ${p.is_ghost ? 'opacity-30' : ''}`}
                          style={{ bottom: `${Math.min(90, yPercent + 4)}%`, left: `${xOffset}%` }}>
                          <AvatarPreview skinId={p.avatar_skin || playerSkins[p.user_id] || 'default'} initial={(p.player_name || '?')[0].toUpperCase()} size={28} />
                          <span className="text-[9px] font-bold text-white bg-black/70 px-1 rounded mt-0.5">{p.player_name?.split(' ')[0]}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}


        {/* Elemental Clash */}
        {game?.game_mode === 'elemental_clash' && clashData && (() => {
          const t1Players = (clashData.participants || []).filter(p => p.team === 1);
          const t2Players = (clashData.participants || []).filter(p => p.team === 2);
          const t1Energy = t1Players.reduce((s, p) => s + (p.energy_points || 0), 0);
          const t2Energy = t2Players.reduce((s, p) => s + (p.energy_points || 0), 0);
          const mins = Math.floor((displayTimeLeft || 0) / 60);
          const secs = (displayTimeLeft || 0) % 60;
          const attackIcons = { earthquake: Mountain, tsunami: Droplets, hurricane: Wind, wildfire: Flame };
          const attackColors = { earthquake: 'text-amber-400', tsunami: 'text-blue-400', hurricane: 'text-teal-400', wildfire: 'text-red-400' };
          const total = clashData.team1Score + clashData.team2Score || 1;

          return (
          <div className="mb-8">
            {/* Tabs */}
            <div className="flex gap-2 mb-6">
              <button onClick={() => setClashTab('battlefield')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all ${clashTab === 'battlefield' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
                <Swords className="w-4 h-4" /> Battlefield
              </button>
              <button onClick={() => setClashTab('dashboard')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all ${clashTab === 'dashboard' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
                <Users className="w-4 h-4" /> Dashboard
              </button>
            </div>

            {/* Shared: Timer + Scores */}
            <div className="bg-gray-900 rounded-2xl p-4 sm:p-6 mb-6">
              {/* Timer */}
              <div className="text-center mb-4">
                <span className={`font-black text-2xl sm:text-3xl tabular-nums ${(displayTimeLeft || 0) < 30 ? 'text-red-400' : 'text-white'}`}>
                  {mins}:{secs.toString().padStart(2, '0')}
                </span>
              </div>
              {/* Score bar */}
              <div className="flex items-center gap-4 mb-2">
                <div className="text-right flex-1">
                  <div className="text-xs font-bold text-blue-400">TEAM 1</div>
                  <div className="text-2xl sm:text-3xl md:text-4xl font-black text-white">{clashData.team1Score}</div>
                </div>
                <div className="w-32 sm:w-48 md:w-64 h-6 bg-gray-700 rounded-full overflow-hidden flex">
                  <div className="bg-blue-500 h-full transition-all duration-500" style={{ width: `${(clashData.team1Score / total) * 100}%` }} />
                  <div className="bg-red-500 h-full transition-all duration-500" style={{ width: `${(clashData.team2Score / total) * 100}%` }} />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-bold text-red-400">TEAM 2</div>
                  <div className="text-2xl sm:text-3xl md:text-4xl font-black text-white">{clashData.team2Score}</div>
                </div>
              </div>
            </div>

            {clashTab === 'battlefield' ? (
              /* ─── Battlefield View ─── */
              <div>
                {/* Team Energy Bars */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <Zap className="w-5 h-5 text-yellow-500" />
                      <span className="font-black text-blue-700 text-2xl">{t1Energy}</span>
                    </div>
                    <div className="text-xs font-bold text-blue-500">Team 1 Total Energy</div>
                  </div>
                  <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <Zap className="w-5 h-5 text-yellow-500" />
                      <span className="font-black text-red-700 text-2xl">{t2Energy}</span>
                    </div>
                    <div className="text-xs font-bold text-red-500">Team 2 Total Energy</div>
                  </div>
                </div>

                {/* Battle Log */}
                <div className="bg-gray-900 rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-gray-400 mb-4 flex items-center gap-2">
                    <Swords className="w-4 h-4" /> LIVE BATTLE LOG
                  </h3>
                  {battleEvents.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Swords className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="font-semibold">No attacks yet... the calm before the storm</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {battleEvents.map((evt, i) => {
                        const Icon = attackIcons[evt.attack_type] || Flame;
                        const color = attackColors[evt.attack_type] || 'text-gray-400';
                        const targetColor = evt.target_team === 1 ? 'text-blue-400' : 'text-red-400';
                        return (
                          <div key={evt.id} className={`flex items-center gap-3 p-3 rounded-xl ${i === 0 ? 'bg-gray-800 border border-gray-700' : 'bg-gray-800/50'}`}>
                            <Icon className={`w-5 h-5 ${color} flex-shrink-0`} />
                            <div className="flex-1 min-w-0">
                              <span className="text-white font-bold">{evt.attackerName}</span>
                              <span className="text-gray-400"> used </span>
                              <span className={`font-black capitalize ${color}`}>{evt.attack_type}</span>
                              <span className="text-gray-400"> on </span>
                              <span className={`font-bold ${targetColor}`}>Team {evt.target_team}</span>
                            </div>
                            <span className="text-red-400 font-black text-lg flex-shrink-0">-{evt.damage}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* ─── Dashboard View (teams + players) ─── */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2].map(teamNum => {
                  const teamPlayers = (clashData.participants || []).filter(p => p.team === teamNum);
                  return (
                    <div key={teamNum} className={`bg-white rounded-2xl p-4 border-2 ${teamNum === 1 ? 'border-blue-200' : 'border-red-200'}`}>
                      <h3 className={`font-black ${teamNum === 1 ? 'text-blue-600' : 'text-red-600'} mb-3`}>Team {teamNum}</h3>
                      <div className="space-y-2">
                        {teamPlayers.map(p => (
                          <div key={p.user_id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                            <AvatarPreview skinId={p.avatar_skin || playerSkins[p.user_id] || 'default'} initial={(p.player_name || '?')[0].toUpperCase()} size={32} />
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-gray-900 text-sm truncate">{p.player_name}</div>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="flex items-center gap-1 bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-bold">
                                <Zap className="w-3 h-3" />{p.energy_points || 0}
                              </span>
                              <span className="font-black text-gray-700">{p.score || 0}pts</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          );
        })()}

        {/* Students */}
        {game?.game_mode !== 'elemental_clash' && (
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

          {/* Survival: alive count */}
          {game?.game_mode === 'survival' && participants.length > 0 && (
            <div className="flex items-center gap-3 mb-4 p-3 bg-red-50 border border-red-100 rounded-xl">
              <Heart className="w-5 h-5 fill-red-500 text-red-500" />
              <span className="font-bold text-red-700">
                {participants.filter(p => !p.eliminated).length} alive
              </span>
              <span className="text-gray-400">·</span>
              <span className="text-gray-500 text-sm">{participants.filter(p => p.eliminated).length} eliminated</span>
            </div>
          )}

          {participants.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No students have joined yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {participants.map((player, index) => {
                const isSurvival = game?.game_mode === 'survival';
                const isMarkets = game?.game_mode === 'elemental_markets';
                const isEliminated = isSurvival && player.eliminated;
                const hasLeft = !!player.left_at;
                const livesTotal = game?.settings?.livesPerPlayer || 3;
                const livesLeft = player.lives ?? livesTotal;
                const portfolio = isMarkets
                  ? marketsLeaderboard.find(l => l.user_id === player.user_id)?.portfolio
                  : null;
                return (
                  <button
                    key={player.id}
                    onClick={() => handleViewStudent(player.user_id)}
                    className={`p-4 sm:p-6 rounded-xl transition-all border-2 text-left relative ${
                      hasLeft
                        ? 'bg-red-50 border-red-200 opacity-70 cursor-default'
                        : isEliminated
                        ? 'bg-gray-100 border-gray-200 opacity-60 cursor-default'
                        : 'bg-gradient-to-br from-blue-50 to-purple-50 hover:shadow-lg border-gray-200 hover:border-blue-500'
                    }`}
                  >
                    {hasLeft && (
                      <div className="absolute top-3 right-3 bg-red-600 text-white text-xs font-black px-2 py-1 rounded-full flex items-center gap-1">
                        <X className="w-3 h-3" /> LEFT
                      </div>
                    )}
                    {!hasLeft && isEliminated && (
                      <div className="absolute top-3 right-3 bg-gray-600 text-white text-xs font-black px-2 py-1 rounded-full">
                        ELIMINATED
                      </div>
                    )}
                    <div className="flex items-start justify-between mb-4">
                      <AvatarPreview skinId={player.avatar_skin || playerSkins[player.user_id] || 'default'} initial={player.player_name?.[0]?.toUpperCase() || 'S'} size={56} />
                      {!isEliminated && <Eye className="w-5 h-5 text-blue-600" />}
                    </div>
                    <h3 className="font-bold text-gray-900 text-lg mb-1">
                      {player.player_name || `Student ${index + 1}`}
                    </h3>

                    {isSurvival && (
                      <div className="flex gap-1 mb-2">
                        {Array.from({ length: livesTotal }).map((_, i) => (
                          <Heart key={i} className={`w-4 h-4 ${i < livesLeft ? 'fill-red-500 text-red-500' : 'text-gray-300'}`} />
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-3 border-t border-gray-300">
                      {isMarkets ? (
                        <>
                          <Briefcase className="w-4 h-4 text-emerald-600" />
                          <span className="text-sm font-semibold text-gray-700">
                            Portfolio: <span className="text-emerald-600">
                              ${portfolio != null ? portfolio.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                            </span>
                          </span>
                        </>
                      ) : (
                        <>
                          <TrendingUp className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-semibold text-gray-700">
                            Score: <span className="text-green-600">{player.score || 0}</span>
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
