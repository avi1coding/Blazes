import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Flame, Trophy, Home, Users, Crown, Medal, Shield, Skull, Heart, BarChart3, Zap } from 'lucide-react';
import { AvatarPreview, getNameColor, cacheTier } from './SkinsPage';

export default function TeacherGameResults() {
    const { gameCode } = useParams();
    const navigate = useNavigate();
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [playerSkins, setPlayerSkins] = useState({});

    const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

    useEffect(() => {
        const fetchResults = async () => {
            try {
                const res = await fetch(`${base}/api/games/${gameCode}/results`);
                if (!res.ok) throw new Error('Failed to fetch results');
                const data = await res.json();
                setResults(data);

                // Fetch skins for all participants
                (data.participants || []).forEach(p => {
                    fetch(`${base}/api/skins/${p.user_id}`)
                        .then(r => r.json())
                        .then(d => {
                            if (d.equipped?.avatar_skin) setPlayerSkins(prev => ({ ...prev, [p.user_id]: d.equipped.avatar_skin }));
                            if (d.tier) cacheTier(p.user_id, d.tier);
                        })
                        .catch(() => {});
                });
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchResults();
    }, [gameCode]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <Flame className="w-16 h-16 text-red-600 mx-auto mb-4 animate-pulse" />
                    <p className="text-gray-600 font-semibold">Loading results...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-red-600 font-bold">{error}</p>
            </div>
        );
    }

    const participants = results?.participants || [];
    const isSurvival = results?.gameMode === 'survival';
    const totalRounds = results?.totalRoundsPlayed || 0;

    // Sort: survival = non-eliminated first, then by rounds survived (desc), then by score; classic = by score
    const sorted = [...participants].sort((a, b) => {
        if (isSurvival) {
            if ((a.eliminated || 0) !== (b.eliminated || 0)) return (a.eliminated || 0) - (b.eliminated || 0);
            // Both eliminated: survived longer = better
            if (a.eliminated && b.eliminated) {
                const aRound = a.eliminated_at_round || 0;
                const bRound = b.eliminated_at_round || 0;
                if (aRound !== bRound) return bRound - aRound;
            }
        }
        return (b.score || 0) - (a.score || 0);
    });

    // Compute placements with ties (same score+status = same placement)
    const placements = [];
    sorted.forEach((p, i) => {
        if (i === 0) { placements.push(1); return; }
        const prev = sorted[i - 1];
        const sameScore = (p.score || 0) === (prev.score || 0);
        const sameElim = isSurvival
            ? (p.eliminated || 0) === (prev.eliminated || 0) && (p.eliminated_at_round || 0) === (prev.eliminated_at_round || 0)
            : true;
        placements.push(sameScore && sameElim ? placements[i - 1] : i + 1);
    });

    const topScore = sorted.length > 0 ? sorted[0].score || 0 : 0;
    const avgScore = sorted.length > 0
        ? Math.round(sorted.reduce((a, p) => a + (p.score || 0), 0) / sorted.length)
        : 0;
    const winner = sorted.length > 0 ? sorted[0] : null;

    const placementIcon = (place) => {
        if (place === 1) return <Crown className="w-7 h-7 text-yellow-500 drop-shadow" strokeWidth={2.5} />;
        if (place === 2) return <span className="w-7 h-7 flex items-center justify-center text-lg font-black text-gray-400">#2</span>;
        if (place === 3) return <span className="w-7 h-7 flex items-center justify-center text-lg font-black text-amber-600">#3</span>;
        return <span className="w-7 h-7 flex items-center justify-center text-sm font-black text-gray-400">#{place}</span>;
    };

    const placementBg = (place) => {
        if (place === 1) return 'bg-gradient-to-r from-yellow-100 via-amber-50 to-yellow-100 border-yellow-400';
        if (place === 2) return 'bg-gradient-to-r from-gray-100 via-slate-50 to-gray-100 border-gray-400';
        if (place === 3) return 'bg-gradient-to-r from-amber-100 via-orange-50 to-amber-100 border-amber-500';
        return 'bg-white border-gray-200';
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center">
                            <Flame className="w-6 h-6 text-white" strokeWidth={2.5} />
                        </div>
                        <span className="text-2xl font-black text-gray-900">Blazes</span>
                    </div>
                    <button
                        onClick={() => navigate('/home/teacher')}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold text-gray-700 transition-colors"
                    >
                        <Home className="w-5 h-5" />
                        Home
                    </button>
                </div>
            </nav>

            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
                {/* Title + Winner spotlight */}
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg">
                        <Trophy className="w-10 h-10 text-white" strokeWidth={2} />
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-1">Game Results</h1>
                    <div className="flex items-center justify-center gap-3 text-gray-500 font-semibold mt-2">
                        <span className="tracking-widest text-gray-700 bg-gray-100 px-3 py-1 rounded-lg text-sm">{gameCode}</span>
                        <span>&middot;</span>
                        <span>{isSurvival ? 'Survival' : 'Classic'}</span>
                        <span>&middot;</span>
                        <span>{participants.length} player{participants.length !== 1 ? 's' : ''}</span>
                    </div>
                </div>

                {/* Winner Card */}
                {winner && (
                    <div className="bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 rounded-3xl p-1 mb-6 shadow-lg">
                        <div className="bg-white rounded-[1.35rem] p-6 flex items-center gap-5">
                            <div className="relative">
                                <AvatarPreview skinId={playerSkins[winner.user_id] || 'default'} initial={(winner.player_name || winner.name || '?')[0].toUpperCase()} size={64} userId={winner.user_id} />
                                <Crown className="w-7 h-7 text-yellow-500 absolute -top-2 -right-2 drop-shadow" strokeWidth={2.5} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-yellow-600 uppercase tracking-wide mb-0.5">Winner</div>
                                <div className="text-2xl font-black truncate" style={{ color: getNameColor(playerSkins[winner.user_id] || 'default') }}>{winner.player_name || winner.name}</div>
                                {isSurvival && (
                                    <div className="flex items-center gap-1 mt-1 text-sm text-gray-500 font-semibold">
                                        <Shield className="w-3.5 h-3.5" />
                                        <span>Survived {totalRounds} round{totalRounds !== 1 ? 's' : ''}</span>
                                    </div>
                                )}
                            </div>
                            <div className="text-right">
                                <div className="text-4xl font-black text-gray-900">{winner.score || 0}</div>
                                <div className="text-sm font-bold text-gray-400">points</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="bg-white rounded-2xl p-5 text-center shadow-sm border border-gray-200">
                        <Zap className="w-6 h-6 text-yellow-500 mx-auto mb-2" strokeWidth={2.5} />
                        <div className="text-2xl font-black text-gray-900">{topScore}</div>
                        <div className="text-xs font-bold text-gray-500">Top Score</div>
                    </div>
                    <div className="bg-white rounded-2xl p-5 text-center shadow-sm border border-gray-200">
                        <BarChart3 className="w-6 h-6 text-blue-500 mx-auto mb-2" strokeWidth={2.5} />
                        <div className="text-2xl font-black text-gray-900">{avgScore}</div>
                        <div className="text-xs font-bold text-gray-500">Avg Score</div>
                    </div>
                    <div className="bg-white rounded-2xl p-5 text-center shadow-sm border border-gray-200">
                        <Users className="w-6 h-6 text-green-500 mx-auto mb-2" strokeWidth={2.5} />
                        <div className="text-2xl font-black text-gray-900">{participants.length}</div>
                        <div className="text-xs font-bold text-gray-500">Players</div>
                    </div>
                </div>

                {/* Full Leaderboard */}
                {sorted.length > 0 && (
                    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200">
                        <div className="flex items-center gap-2 mb-6">
                            <Trophy className="w-6 h-6 text-yellow-500" strokeWidth={2.5} />
                            <h2 className="text-xl font-black text-gray-900">Leaderboard</h2>
                        </div>
                        <div className="space-y-3">
                            {sorted.map((p, i) => {
                                const skinId = playerSkins[p.user_id] || 'default';
                                const initial = (p.player_name || p.name || '?')[0].toUpperCase();
                                const place = placements[i];
                                const roundsSurvived = isSurvival
                                    ? (p.eliminated ? p.eliminated_at_round || 1 : totalRounds)
                                    : null;

                                return (
                                    <div
                                        key={p.user_id}
                                        className={`flex items-center gap-3 p-3 sm:p-4 rounded-2xl border-2 transition-all ${placementBg(place)}`}
                                    >
                                        {/* Placement */}
                                        <div className="flex-shrink-0">{placementIcon(place)}</div>

                                        {/* Avatar */}
                                        <AvatarPreview skinId={skinId} initial={initial} size={44} userId={p.user_id} />

                                        {/* Name & details */}
                                        <div className="flex-1 min-w-0">
                                            <div className="font-black truncate text-base" style={{ color: getNameColor(skinId) }}>
                                                {p.player_name || p.name}
                                            </div>
                                            {isSurvival && (
                                                <div className="flex items-center gap-2 text-xs text-gray-500 font-semibold mt-0.5">
                                                    {p.eliminated ? (
                                                        <>
                                                            <Skull className="w-3 h-3 text-red-400" />
                                                            <span>Eliminated</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Shield className="w-3 h-3 text-green-500" />
                                                            <span>Survived</span>
                                                        </>
                                                    )}
                                                    {roundsSurvived !== null && (
                                                        <span>&middot; {roundsSurvived} round{roundsSurvived !== 1 ? 's' : ''}</span>
                                                    )}
                                                    {!p.eliminated && p.lives != null && (
                                                        <span className="flex items-center gap-0.5 ml-1">
                                                            &middot;
                                                            {Array.from({ length: p.lives }).map((_, j) => (
                                                                <Heart key={j} className="w-3 h-3 fill-red-500 text-red-500" />
                                                            ))}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Score */}
                                        <div className="text-right flex-shrink-0">
                                            <div className="text-xl font-black text-gray-900">{p.score || 0}</div>
                                            <div className="text-xs font-bold text-gray-400">pts</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {participants.length === 0 && (
                    <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-gray-200">
                        <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-600 font-semibold text-lg">No students completed the game yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
