import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Flame, Users, Copy, Zap, CheckCircle, Eye } from 'lucide-react';
import Toast from '../components/Toast';
import { AvatarPreview, getNameColor, cacheTier } from './SkinsPage';

export default function TeacherLobby() {
    const { gameCode } = useParams();
    const navigate = useNavigate();
    const [game, setGame] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [copied, setCopied] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [user] = useState(() => JSON.parse(localStorage.getItem('user')));
    const [playerSkins, setPlayerSkins] = useState({});
    const fetchedSkinIds = useRef(new Set());
    const [toast, setToast] = useState({ show: false, message: '', type: 'error' });

    useEffect(() => {
        const currentUser = JSON.parse(localStorage.getItem('user'));
        if (!currentUser) {
            navigate('/login');
            return;
        }

        const fetchGame = async () => {
            try {
                const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
                const response = await fetch(`${baseUrl}/api/games/${gameCode}`);
                const data = await response.json();

                // Guard: if this user is not the host, redirect them
                if (data.host_id && data.host_id !== currentUser.id) {
                    console.warn(`User ${currentUser.id} is not the host (${data.host_id}) — redirecting to student lobby`);
                    navigate(`/game/lobby/${gameCode}`);
                    return;
                }

                setGame(data);
                setParticipants(data.participants || []);
            } catch (error) {
                console.error('Error fetching game:', error);
            }
        };

        fetchGame();
        const interval = setInterval(fetchGame, 2000); // Poll every 2 seconds
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

    const copyGameCode = () => {
        navigator.clipboard.writeText(gameCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const startGame = async () => {
        // Always read fresh from localStorage to avoid stale state
        const currentUser = JSON.parse(localStorage.getItem('user'));
        console.log('startGame called — user from localStorage:', currentUser, 'gameCode:', gameCode);

        if (!currentUser) {
            setToast({ show: true, message: 'Not logged in. Please log in again.', type: 'error' });
            setTimeout(() => navigate('/login'), 1500);
            return;
        }

        setIsStarting(true);
        try {
            const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
            const response = await fetch(`${baseUrl}/api/games/${gameCode}/start`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUser.id })
            });

            const data = await response.json();
            console.log('start response:', response.status, data);

            if (response.ok) {
                if (currentUser.role === 'student' || game.settings?.teacherPlaying) {
                    navigate(`/game/play/${gameCode}`, { state: { game, user: currentUser } });
                } else {
                    navigate(`/game/monitor/${gameCode}/all`, { state: { game, user: currentUser } });
                }
            } else {
                setToast({ show: true, message: `Error starting game: ${data?.error || response.status}`, type: 'error' });
            }
        } catch (error) {
            console.error('Error starting game:', error);
            setToast({ show: true, message: `Failed to start game: ${error.message}`, type: 'error' });
        }
        setIsStarting(false);
    };

    if (!game) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <p className="text-gray-600">Loading game...</p>
                </div>
            </div>
        );
    }

    const isTeacher = user?.role === 'teacher';
    const isSurvival = game.game_mode === 'survival';
    const canStart = !isSurvival || participants.length >= 2;

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 py-8 px-4">
            <Toast show={toast.show} message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-5 sm:p-8 text-white mb-6 sm:mb-8">
                    <div className="flex items-center gap-3 mb-2 sm:mb-4">
                        <Flame className="w-6 h-6 sm:w-8 sm:h-8" strokeWidth={2.5} />
                        <h1 className="text-2xl sm:text-4xl font-black">Teacher Lobby</h1>
                    </div>
                    <p className="text-white/90 text-sm sm:text-base">Game Code: <span className="font-black text-base sm:text-lg">{gameCode}</span></p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
                    {/* Game Info */}
                    <div className="lg:col-span-2 bg-white rounded-2xl p-5 sm:p-8 shadow-sm border border-gray-200">
                        <h2 className="text-2xl font-black text-gray-900 mb-6">Game Information</h2>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                <span className="text-gray-600 font-semibold">Kit</span>
                                <span className="font-black text-gray-900">{game.kit_id}</span>
                            </div>

                            {game.settings && typeof game.settings === 'object' && (
                                <>
                                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                        <span className="text-gray-600 font-semibold">Time Limit</span>
                                        <span className="font-black text-gray-900">
                                            {(game.settings.timeLimit || game.settings.gameplayTime)
                                                ? `${Math.floor((game.settings.timeLimit || game.settings.gameplayTime) / 60)}:${((game.settings.timeLimit || game.settings.gameplayTime) % 60).toString().padStart(2, '0')}`
                                                : '—'}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                        <span className="text-gray-600 font-semibold">Late Joining</span>
                                        <span className="font-black text-gray-900">{game.settings.allowLateJoin ? 'Allowed' : 'Not Allowed'}</span>
                                    </div>
                                </>
                            )}

                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                <span className="text-gray-600 font-semibold">Status</span>
                                <span className="font-black text-blue-600 uppercase">{game.status}</span>
                            </div>
                        </div>
                    </div>

                    {/* Copy Code */}
                    <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200">
                        <h3 className="font-black text-gray-900 mb-4">Share Game Code</h3>

                        <div className="bg-gradient-to-br from-orange-100 to-red-100 rounded-xl p-4 sm:p-6 mb-4 border-2 border-orange-200">
                            <p className="text-center text-3xl sm:text-4xl font-black text-orange-600 tracking-widest">{gameCode}</p>
                        </div>

                        <button
                            onClick={copyGameCode}
                            className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-900 py-3 rounded-lg font-bold transition-colors mb-4"
                        >
                            <Copy className="w-4 h-4" />
                            {copied ? 'Copied!' : 'Copy Code'}
                        </button>

                        <p className="text-sm text-gray-600 text-center">
                            Share this code with students to let them join
                        </p>
                    </div>
                </div>

                {/* Participants */}
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200 mb-8">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                            <Users className="w-6 h-6" />
                            Players ({participants.length})
                        </h2>
                    </div>

                    {participants.length === 0 ? (
                        <div className="text-center py-12">
                            <Zap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500">Waiting for students to join...</p>
                            <p className="text-sm text-gray-400 mt-2">Share the game code with your class</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                            {participants.map((participant) => (
                                <div key={participant.id} className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle className="w-4 h-4 text-green-600" />
                                            <span className="font-bold text-green-900 text-sm">Ready</span>
                                        </div>
                                        {game.status === 'started' && isTeacher && (
                                            <button
                                                onClick={() => navigate(`/game/monitor/${gameCode}/${participant.user_id}`)}
                                                className="p-1 hover:bg-green-200 rounded transition-colors"
                                                title="Monitor player"
                                            >
                                                <Eye className="w-4 h-4 text-green-600" />
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <AvatarPreview skinId={playerSkins[participant.user_id] || 'default'} initial={participant.player_name?.[0]?.toUpperCase() || 'P'} size={32} userId={participant.user_id} />
                                        <p className="font-black truncate" style={{ color: getNameColor(playerSkins[participant.user_id]) }}>{participant.player_name || 'Player'}</p>
                                    </div>
                                    <p className="text-xs text-gray-600">Score: {participant.score || 0}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={async () => {
                            try {
                                const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
                                await fetch(`${baseUrl}/api/games/${gameCode}/cancel`, { method: 'PUT' });
                            } catch (_) { }
                            navigate('/home/teacher');
                        }}
                        className="flex-1 bg-gray-200 text-gray-700 py-4 rounded-xl font-bold hover:bg-gray-300 transition-colors"
                    >
                        Cancel
                    </button>
                    <div className="flex-1 flex flex-col gap-2">
                        {isSurvival && participants.length < 2 && (
                            <p className="text-center text-sm font-bold text-red-600">
                                Survival mode needs at least 2 players to start.
                            </p>
                        )}
                        <button
                            onClick={startGame}
                            disabled={isStarting || !canStart}
                            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-4 rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isStarting ? 'Starting...' : `Start Game${participants.length > 0 ? ` (${participants.length} Players)` : ''}`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
