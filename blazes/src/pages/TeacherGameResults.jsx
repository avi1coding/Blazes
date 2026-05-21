import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Flame, Trophy, Home, Users, Crown, Medal, Shield, Skull, Heart, BarChart3, Zap, X as XIcon, Clock, Target } from 'lucide-react';
import { AvatarPreview, getNameColor, cacheTier } from './SkinsPage';
import { rankParticipants } from '../utils/ranking';

export default function TeacherGameResults() {
    const { gameCode } = useParams();
    const navigate = useNavigate();
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [playerSkins, setPlayerSkins] = useState({});
    const [showStats, setShowStats] = useState(false);
    const [stats, setStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(false);

    const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

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
    const totalRounds = results?.totalRoundsPlayed || 0;
    const gameMode = results?.gameMode;
    const isSurvival = gameMode === 'survival';
    const isMarkets = gameMode === 'elemental_markets';
    // For markets, the participant `score` column holds the final portfolio
    // value in dollars (set by settleMarketsScores on game end). Render it as
    // money instead of plain points.
    const fmtScore = (n) => isMarkets
        ? `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : String(n || 0);

    const sorted = rankParticipants(participants);

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
                        <span>{isSurvival ? 'Survival' : isMarkets ? 'Markets' : 'Classic'}</span>
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
                                <div className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900">{fmtScore(winner.score)}</div>
                                <div className="text-sm font-bold text-gray-400">{isMarkets ? 'score' : 'points'}</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* View Stats — opens detailed-stats modal (replaces the
                    three-card summary block). Lazy-fetches /details on click
                    so we don't spend a request unless the teacher wants it. */}
                <div className="mb-6">
                    <button
                        onClick={async () => {
                            setShowStats(true);
                            if (stats) return;
                            setStatsLoading(true);
                            try {
                                const r = await fetch(`${base}/api/games/${gameCode}/details`);
                                if (r.ok) setStats(await r.json());
                            } catch (_) {}
                            setStatsLoading(false);
                        }}
                        className="w-full flex items-center justify-center gap-2 py-3.5 bg-white border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 rounded-2xl font-black text-gray-800 transition-colors"
                    >
                        <BarChart3 className="w-5 h-5 text-blue-600" />
                        View Stats
                    </button>
                </div>

                {/* Host abandoned the session — show notice instead of leaderboard */}
                {results?.abandoned && (
                    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border-2 border-orange-200 text-center">
                        <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <XIcon className="w-8 h-8 text-orange-600" strokeWidth={2.5} />
                        </div>
                        <h2 className="text-xl font-black text-gray-900 mb-2">Session ended early</h2>
                        <p className="text-gray-600 max-w-md mx-auto text-sm">
                            You left this game before it finished, so no final leaderboard is shown.
                            Students' answers are still recorded in your stats.
                        </p>
                    </div>
                )}

                {/* Full Leaderboard — only when the game ended normally */}
                {!results?.abandoned && sorted.length > 0 && (
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
                                            <div className="text-xl font-black text-gray-900">{fmtScore(p.score)}</div>
                                            <div className="text-xs font-bold text-gray-400">{isMarkets ? 'score' : 'pts'}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {participants.length === 0 && (
                    <div className="bg-white rounded-3xl p-6 sm:p-8 md:p-12 text-center shadow-sm border border-gray-200">
                        <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-600 font-semibold text-lg">No students completed the game yet.</p>
                    </div>
                )}
            </div>

            {/* Stats modal — detailed per-player breakdown pulled from /details */}
            {showStats && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowStats(false)}>
                    <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="px-5 sm:px-7 py-4 border-b border-gray-200 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                                    <BarChart3 className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <div className="text-lg font-black text-gray-900">Game Stats</div>
                                    <div className="text-xs font-bold text-gray-500">{gameCode}{stats?.kit_title ? ` · ${stats.kit_title}` : ''}</div>
                                </div>
                            </div>
                            <button onClick={() => setShowStats(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                                <XIcon className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        {statsLoading ? (
                            <div className="flex-1 flex items-center justify-center py-16">
                                <Flame className="w-10 h-10 text-red-500 animate-pulse" />
                            </div>
                        ) : !stats ? (
                            <div className="flex-1 flex items-center justify-center py-16 text-gray-500 font-semibold text-sm">
                                Couldn't load stats.
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto">
                                {/* Top summary */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 border-b border-gray-100">
                                    <StatBox icon={Users} color="text-green-600" label="Players" value={stats.players} />
                                    <StatBox icon={Zap} color="text-yellow-500" label="Top Score" value={fmtScore(topScore)} />
                                    <StatBox icon={BarChart3} color="text-blue-600" label="Avg Score" value={fmtScore(stats.avg_score)} />
                                    <StatBox icon={Clock} color="text-purple-600" label="Avg Time" value={stats.avg_time ? `${Number(stats.avg_time).toFixed(1)}s` : '—'} />
                                </div>

                                {/* Per-player breakdown */}
                                <div className="p-5">
                                    <div className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2 flex items-center gap-2">
                                        <Target className="w-3.5 h-3.5" /> Per-player breakdown
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-left text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-200">
                                                    <th className="py-2 pr-3">Player</th>
                                                    <th className="py-2 px-3 text-right">Score</th>
                                                    <th className="py-2 px-3 text-right">Correct</th>
                                                    <th className="py-2 pl-3 text-right">Accuracy</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(stats.participants || []).map(p => (
                                                    <tr key={p.user_id} className="border-b border-gray-100 last:border-b-0">
                                                        <td className="py-2.5 pr-3 font-bold text-gray-900 truncate">{p.player_name || p.user_name || 'Player'}</td>
                                                        <td className="py-2.5 px-3 text-right font-black tabular-nums text-gray-900">{fmtScore(p.score)}</td>
                                                        <td className="py-2.5 px-3 text-right font-bold text-gray-700 tabular-nums">{p.correct_answers}/{p.total_answered}</td>
                                                        <td className="py-2.5 pl-3 text-right font-black tabular-nums" style={{ color: p.accuracy >= 80 ? '#059669' : p.accuracy >= 50 ? '#d97706' : '#dc2626' }}>
                                                            {p.accuracy}%
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function StatBox({ icon: Icon, color, label, value }) {
    return (
        <div className="bg-gray-50 rounded-xl p-3 text-center">
            <Icon className={`w-5 h-5 mx-auto mb-1 ${color}`} strokeWidth={2.5} />
            <div className="text-lg font-black text-gray-900">{value}</div>
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">{label}</div>
        </div>
    );
}
