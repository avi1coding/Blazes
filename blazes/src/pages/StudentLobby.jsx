import React, { useState, useEffect, useRef } from 'react';
import { Flame, Users, Crown, LogOut, X, Shirt } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { AvatarPreview, getNameColor, isBlazesPlusCached, cacheTier } from './SkinsPage';
import SkinsPage from './SkinsPage';

export default function StudentLobby() {
    const navigate = useNavigate();
    const { gameCode } = useParams();


    const [user] = useState(() => {
        try { return JSON.parse(localStorage.getItem('user') || 'null'); }
        catch { return null; }
    });
    const [game, setGame] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [equippedSkinId, setEquippedSkinId] = useState('default');
    const [playerSkins, setPlayerSkins] = useState({});
    const [blazesBucks, setBlazesBucks] = useState(0);
    const [showSkinsModal, setShowSkinsModal] = useState(false);
    const [countdown, setCountdown] = useState(null); // server-synced countdown
    const roundStartTimeRef = useRef(null); // absolute ms when round starts
    const navigatedRef = useRef(false);
    const fetchedSkinIds = useRef(new Set());

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }

        const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

        // Load equipped skin
        fetch(`${base}/api/skins/${user.id}`)
            .then(r => r.json())
            .then(d => { if (d.equipped?.avatar_skin) setEquippedSkinId(d.equipped.avatar_skin); })
            .catch(() => {});

        // Load BlazesBucks
        fetch(`${base}/api/blazesbucks/${user.id}`)
            .then(r => r.json())
            .then(d => setBlazesBucks(d.balance || 0))
            .catch(() => {});

        const fetchGame = async () => {
            try {
                const response = await fetch(`${base}/api/games/${gameCode}`);
                const data = await response.json();

                if (!response.ok) {
                    setError(data.error || 'Game not found');
                    setLoading(false);
                    return;
                }

                setGame(data);
                setParticipants(data.participants || []);

                if (data.status === 'cancelled' && !navigatedRef.current) {
                    navigatedRef.current = true;
                    navigate('/home/student', { state: { notice: 'The game was cancelled by the teacher.' } });
                    return;
                }

                if (data.status === 'started' && !navigatedRef.current) {
                    // For survival mode: parse round_started_at to show countdown before navigating
                    if (data.game_mode === 'survival' && data.round_started_at) {
                        const s = data.round_started_at;
                        const target = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z').getTime();
                        roundStartTimeRef.current = target;
                        // Don't navigate yet. Countdown effect will handle it
                    } else {
                        navigatedRef.current = true;
                        navigate(`/game/play/${gameCode}`, { state: { game: data, user } });
                    }
                }

                setLoading(false);
            } catch (err) {
                console.error('Error fetching game:', err);
                setError(`Error connecting to server: ${err.message}`);
                setLoading(false);
            }
        };

        fetchGame();
        const interval = setInterval(fetchGame, 2000);
        return () => clearInterval(interval);
    }, [gameCode, navigate, user]);

    // Server-synced countdown: tick from absolute round_started_at, navigate at 0
    useEffect(() => {
        if (!roundStartTimeRef.current || navigatedRef.current) return;
        const tick = () => {
            const msLeft = roundStartTimeRef.current - Date.now();
            const secs = msLeft > 0 ? Math.ceil(msLeft / 1000) : 0;
            setCountdown(secs);
            if (secs <= 0 && !navigatedRef.current) {
                navigatedRef.current = true;
                navigate(`/game/play/${gameCode}`, { state: { game, user } });
            }
        };
        tick();
        const t = setInterval(tick, 100);
        return () => clearInterval(t);
    }, [roundStartTimeRef.current, gameCode, navigate, game, user]);

    // Refresh skins for all participants + host every poll, so changes propagate
    // to other players' screens without manual reload. fetchedSkinIds is kept
    // for the very-first paint dedup (within the same render tick) only, the
    // staleness timer below clears it every few seconds to force re-fetch.
    useEffect(() => {
        const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
        const idsToFetch = new Set(participants.map(p => p.user_id).filter(Boolean));
        if (game?.host_id) idsToFetch.add(game.host_id);
        idsToFetch.forEach(uid => {
            if (fetchedSkinIds.current.has(uid)) return;
            fetchedSkinIds.current.add(uid);
            fetch(`${base}/api/skins/${uid}`)
                .then(r => r.json())
                .then(d => {
                    if (d.equipped?.avatar_skin) {
                        setPlayerSkins(prev => ({ ...prev, [uid]: d.equipped.avatar_skin }));
                    }
                    // AvatarPreview auto-detects the premium ring from this
                    // cache when given a userId. Without it, the teacher's
                    // avatar (and every classmate's) could never show a ring
                    // regardless of their plan.
                    if (d.tier) cacheTier(uid, d.tier);
                })
                .catch(() => {});
        });
    }, [participants, game?.host_id]);

    // Invalidate the skin cache periodically so a player who equips a new skin
    // is seen with the new one by everyone else within ~5s.
    useEffect(() => {
        const t = setInterval(() => { fetchedSkinIds.current.clear(); }, 5000);
        return () => clearInterval(t);
    }, []);

    const handleLeaveGame = () => {
        navigate('/home/student');
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

    // Countdown overlay. Shown to ALL clients at the same time using absolute server timestamp
    if (countdown !== null && countdown > 0) {
        return (
            <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center">
                <div className="mb-8">
                    <div
                        className="w-36 h-36 rounded-full border-4 border-orange-500 flex items-center justify-center animate-pulse"
                        key={countdown}
                    >
                        <span className="text-8xl font-black text-white">{countdown}</span>
                    </div>
                </div>
                <p className="text-white font-black text-2xl mb-2">Game Starting!</p>
                <p className="text-gray-400 font-semibold">Get ready...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-600 font-semibold mb-4">{error}</p>
                    <button
                        onClick={() => navigate('/home/student')}
                        className="px-6 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    if (!game || !user) {
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
            {/* Header */}
            <nav className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center">
                            <Flame className="w-6 h-6 text-white" strokeWidth={2.5} />
                        </div>
                        <span className="text-2xl font-black text-gray-900">Blazes</span>
                    </div>
                    <button
                        onClick={handleLeaveGame}
                        className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors font-bold"
                    >
                        <LogOut className="w-5 h-5" />
                        Leave
                    </button>
                </div>
            </nav>

            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
                {/* Waiting message with player avatar */}
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-6">
                        <AvatarPreview skinId={equippedSkinId} initial={user.name?.[0]?.toUpperCase() || '?'} size={96} isPlus={isBlazesPlusCached()} />
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-2">Waiting for Teacher</h1>
                    <p className="text-base sm:text-xl text-gray-600">The game will start when your teacher is ready.</p>
                </div>

                {/* Change Skin button */}
                <button
                    onClick={() => setShowSkinsModal(true)}
                    className="w-full flex items-center justify-center gap-2 py-3 mb-6 bg-white border-2 border-gray-200 hover:border-red-400 hover:bg-red-50 rounded-2xl font-bold text-gray-700 hover:text-red-600 transition-all shadow-sm"
                >
                    <Shirt className="w-5 h-5" strokeWidth={2.5} />
                    Change Skin / Buy More
                </button>

                {/* Game Details */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-6">
                    <h3 className="text-lg font-black text-gray-900 mb-4">Game Details</h3>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                            <span className="text-gray-600 font-semibold">Game Code</span>
                            <span className="font-black text-gray-900 tracking-widest">{gameCode}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                            <span className="text-gray-600 font-semibold">Mode</span>
                            <span className="font-bold text-gray-900 capitalize">
                                {game.game_mode ? game.game_mode.replace('_', ' ') : 'Default'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                            <span className="text-gray-600 font-semibold">Time Limit</span>
                            <span className="font-bold text-gray-900">
                                {game.settings?.timeLimit
                                    ? `${Math.floor(game.settings.timeLimit / 60)} min`
                                    : game.settings?.gameplayTime
                                        ? `${Math.floor(game.settings.gameplayTime / 60)} min`
                                        : '-'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Fellow Players */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                    {(() => {
                      const settingsObj = (() => {
                        try { return typeof game.settings === 'string' ? JSON.parse(game.settings) : (game.settings || {}); }
                        catch { return {}; }
                      })();
                      const hostPlaysAndNotInList = !!settingsObj.hostPlays && !participants.some(p => p.user_id === game.host_id);
                      const totalPlayers = participants.length + (hostPlaysAndNotInList ? 1 : 0);
                      return (
                        <>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-black text-gray-900">Players ({totalPlayers})</h3>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-sm text-gray-600 font-semibold">Live</span>
                        </div>
                    </div>

                    {participants.length === 0 && !hostPlaysAndNotInList ? (
                        <div className="text-center py-8">
                            <Users className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                            <p className="text-gray-500">Waiting for players to join...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {hostPlaysAndNotInList && (
                                <div className="flex items-center gap-3 p-3 bg-purple-50 border border-purple-200 rounded-xl">
                                    <AvatarPreview skinId={game?.host_avatar_skin || playerSkins[game?.host_id] || 'default'} initial={(settingsObj.hostName || 'T')[0].toUpperCase()} size={48} userId={game?.host_id} />
                                    <div className="flex-1">
                                        <div className="font-bold text-purple-900 flex items-center gap-1.5">
                                            {settingsObj.hostName || 'Teacher'}
                                            <Crown className="w-4 h-4 text-yellow-500" strokeWidth={2.5} />
                                        </div>
                                        <div className="text-xs text-purple-600 font-bold">Teacher (Playing)</div>
                                    </div>
                                </div>
                            )}
                            {participants.map((player, index) => (
                                <div
                                    key={player.id}
                                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
                                >
                                    <AvatarPreview
                                        skinId={player.user_id === user.id ? equippedSkinId : (player.avatar_skin || playerSkins[player.user_id] || 'default')}
                                        initial={player.player_name?.[0]?.toUpperCase() || 'P'}
                                        size={48}
                                        userId={player.user_id}
                                        isPlus={player.user_id === user.id ? isBlazesPlusCached() : undefined}
                                    />
                                    <div className="flex-1">
                                        <div className="font-bold" style={{ color: getNameColor(player.user_id === user.id ? equippedSkinId : (player.avatar_skin || playerSkins[player.user_id] || 'default')) }}>
                                            {player.player_name || `Player ${index + 1}`}
                                            {player.user_id === game.host_id && (
                                                <span className="ml-2">
                                                    <Crown className="w-4 h-4 inline text-yellow-500" strokeWidth={2.5} />
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {player.user_id === game.host_id ? 'Teacher' : 'Student'}
                                        </div>
                                    </div>
                                    {player.user_id === user.id && (
                                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">You</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                        </>
                      );
                    })()}
                </div>
            </div>

            {/* Skins Modal */}
            {showSkinsModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
                        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
                            <h2 className="text-2xl font-black text-gray-900">Skins</h2>
                            <button
                                onClick={() => setShowSkinsModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                            >
                                <X className="w-6 h-6 text-gray-600" />
                            </button>
                        </div>
                        <div className="overflow-y-auto p-6">
                            <SkinsPage
                                userId={user.id}
                                blazesBucks={blazesBucks}
                                onBBChange={(newBal) => setBlazesBucks(newBal)}
                                onSkinEquip={(skinId) => setEquippedSkinId(skinId)}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
