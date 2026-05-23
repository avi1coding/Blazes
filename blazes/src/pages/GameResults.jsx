import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Flame, Trophy, Target, Home, Share2, X, Crown, Medal, Shield, Sparkles, Lock, Check } from 'lucide-react';
import Toast from '../components/Toast';
import { AvatarPreview, getNameColor, isBlazesPlusCached, cacheTier } from './SkinsPage';
import { rankParticipants } from '../utils/ranking';

export default function GameResults() {
  const navigate = useNavigate();
  const location = useLocation();
  const { gameCode } = useParams();
  const [score, setScore] = useState(0);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [hasWon, setHasWon] = useState(false);
  const [bbEarned, setBbEarned] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [gameMode, setGameMode] = useState(null);
  const [totalRounds, setTotalRounds] = useState(0);
  const [playerSkins, setPlayerSkins] = useState({});
  const [clipboardToast, setClipboardToast] = useState(false);
  const [aiOverview, setAiOverview] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showOverview, setShowOverview] = useState(false);
  const [userTier, setUserTier] = useState('free');
  const [abandoned, setAbandoned] = useState(false);

  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

  const hasMembership = ['blazes_plus', 'teacher_pro', 'school'].includes(userTier);

  useEffect(() => {
    if (user?.id) {
      fetch(`${base}/api/subscription/${user.id}`).then(r => r.json()).then(d => setUserTier(d.tier || 'free')).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const state = location.state;
    if (state) {
      setScore(state.score || 0);
      setQuestionsAnswered(state.correctCount || 0);
      setTotalQuestions(state.questionsAnswered || 0);
      const attempted = state.questionsAnswered || 0;
      const acc = attempted > 0
        ? Math.round(((state.correctCount || 0) / attempted) * 100)
        : 0;
      setAccuracy(acc);
      setHasWon(state.hasWon || false);
      const earned = state.bbEarned || 0;
      setBbEarned(earned);
      setXpEarned(state.xpEarned || 0);
      if (earned > 0 || state.xpEarned > 0) {
        setTimeout(() => setShowToast(true), 400);
        setTimeout(() => setShowToast(false), 4000);
      }
    }
  }, [location.state]);

  // Fetch leaderboard data
  useEffect(() => {
    if (!gameCode) return;
    fetch(`${base}/api/games/${gameCode}/results`)
      .then(r => r.json())
      .then(data => {
        setGameMode(data.gameMode);
        setTotalRounds(data.totalRoundsPlayed || 0);
        setAbandoned(!!data.abandoned);
        const sorted = rankParticipants(data.participants || []);
        setLeaderboard(sorted);
        if (sorted.length > 0 && sorted[0].user_id === user?.id) {
          setHasWon(true);
        }
        // Sync the "Your Score" stat to the server's tally — the value passed
        // in via location.state is the client's local tally (off by a lot,
        // since the client doesn't replicate the server's speed-curve scoring).
        const me = (data.participants || []).find(p => p.user_id === user?.id);
        if (me && typeof me.score === 'number') setScore(me.score);
        // Fetch skins for all participants
        sorted.forEach(p => {
          fetch(`${base}/api/skins/${p.user_id}`)
            .then(r => r.json())
            .then(d => {
              if (d.equipped?.avatar_skin) {
                setPlayerSkins(prev => ({ ...prev, [p.user_id]: d.equipped.avatar_skin }));
              }
              if (d.tier) cacheTier(p.user_id, d.tier);
            })
            .catch(() => {});
        });
      })
      .catch(() => {});
  }, [gameCode]);

  // Compute placements with ties.
  // Using forEach + a separate accumulator: `.map` referencing `placements` from
  // inside its own callback hits the TDZ (the binding isn't initialised until
  // the right-hand side returns) and throws a ReferenceError as soon as two
  // players tie, which is what was triggering the boundary on /game/results.
  const placements = [];
  leaderboard.forEach((p, i) => {
    if (i === 0) { placements.push(1); return; }
    const prev = leaderboard[i - 1];
    const sameScore = (p.score || 0) === (prev.score || 0);
    const sameElim = gameMode === 'survival'
      ? (p.eliminated || 0) === (prev.eliminated || 0) && (p.eliminated_at_round || 0) === (prev.eliminated_at_round || 0)
      : true;
    placements.push(sameScore && sameElim ? placements[i - 1] : i + 1);
  });

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Toast show={clipboardToast} message="Copied to clipboard!" type="success" onClose={() => setClipboardToast(false)} />
      {/* BlazesBucks Toast */}
      <div
        className="fixed top-6 left-1/2 z-50 transition-all duration-500 ease-out"
        style={{
          transform: showToast ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(-120%)',
          opacity: showToast ? 1 : 0,
          pointerEvents: 'none',
        }}
      >
        <div className="flex items-center gap-4 bg-white text-gray-900 font-black px-6 py-4 rounded-2xl shadow-2xl border-2 border-gray-200">
          {xpEarned > 0 && (
            <div className="text-center">
              <div className="text-xl text-red-600">+{xpEarned}</div>
              <div className="text-[10px] font-semibold text-gray-500">XP</div>
            </div>
          )}
          {xpEarned > 0 && bbEarned > 0 && <div className="w-px h-8 bg-gray-200" />}
          {bbEarned > 0 && (
            <div className="flex items-center gap-2">
              <img src="/blazes-coin.png" className="w-8 h-8" alt="coin" style={{ mixBlendMode: 'multiply' }} />
              <div>
                <div className="text-xl text-yellow-600">+{bbEarned}</div>
                <div className="text-[10px] font-semibold text-gray-500">BlazesBucks</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Header */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center">
              <Flame className="w-6 h-6 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-2xl font-black text-gray-900">Blazes</span>
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Hero — winner gets a celebratory gradient card with the trophy, a
            soft halo, and a placement chip. Losers get a quieter neutral
            treatment so the page doesn't feel like it's mocking them. */}
        <div className="relative mb-8">
          {hasWon ? (
            <div
              className="relative overflow-hidden rounded-3xl p-7 sm:p-10 text-center shadow-xl border-2 border-yellow-200"
              style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 60%, #fbbf24 100%)' }}
            >
              <div className="absolute -top-12 -right-12 w-44 h-44 bg-white/30 rounded-full blur-3xl" />
              <div className="absolute -bottom-16 -left-12 w-52 h-52 bg-orange-300/30 rounded-full blur-3xl" />
              <div className="relative">
                <div className="inline-flex w-20 h-20 sm:w-24 sm:h-24 bg-white rounded-full items-center justify-center mb-5 shadow-lg ring-4 ring-yellow-300">
                  <Trophy className="w-10 h-10 sm:w-12 sm:h-12 text-yellow-500" strokeWidth={2.5} />
                </div>
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-amber-900 mb-2 tracking-tight">Victory!</h1>
                <p className="text-base sm:text-lg font-bold text-amber-800/80">
                  {gameMode === 'survival' ? 'Survival Mode' : gameMode === 'elemental_markets' ? 'Markets Mode' : 'Classic Mode'} &middot; <span className="font-mono">{gameCode}</span>
                </p>
              </div>
            </div>
          ) : (
            <div className="relative rounded-3xl p-7 sm:p-10 text-center shadow-sm bg-white border border-gray-200">
              <div className="inline-flex w-20 h-20 sm:w-24 sm:h-24 bg-gray-100 rounded-full items-center justify-center mb-5">
                <Flame className="w-10 h-10 sm:w-12 sm:h-12 text-red-500" strokeWidth={2.5} />
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 mb-2 tracking-tight">Good game</h1>
              <p className="text-base text-gray-500 font-semibold">
                {gameMode === 'survival' ? 'Survival Mode' : gameMode === 'elemental_markets' ? 'Markets Mode' : 'Classic Mode'} &middot; <span className="font-mono">{gameCode}</span>
              </p>
            </div>
          )}
        </div>

        {/* Stat trio — refined with icon chips and consistent typography */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatCard
            icon={Trophy}
            iconBg="bg-red-100"
            iconColor="text-red-600"
            value={gameMode === 'elemental_markets'
              ? `$${Number(score || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
              : score}
            label="Score"
          />
          <StatCard
            icon={Target}
            iconBg="bg-blue-100"
            iconColor="text-blue-600"
            value={`${accuracy}%`}
            label="Accuracy"
          />
          <StatCard
            icon={Check}
            iconBg="bg-green-100"
            iconColor="text-green-600"
            value={`${questionsAnswered}/${totalQuestions}`}
            label="Correct"
          />
        </div>

        {/* Host-abandoned notice — replaces the leaderboard when the host left
            before a normal end. Players don't see placements because the game
            didn't actually finish. */}
        {abandoned && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-orange-200 mb-6 text-center">
            <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8 text-orange-600" strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">Session ended early</h2>
            <p className="text-gray-600 max-w-sm mx-auto">
              Your teacher left this game before it finished, so there's no final
              leaderboard. Your answers and BB are still saved — try a different
              game when one's running.
            </p>
          </div>
        )}

        {/* Leaderboard — only shown for normally-ended games */}
        {!abandoned && leaderboard.length > 0 && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-gray-200 mb-6">
            <div className="flex items-center gap-2 mb-6">
              <Trophy className="w-6 h-6 text-yellow-500" strokeWidth={2.5} />
              <h2 className="text-2xl font-black text-gray-900">Leaderboard</h2>
            </div>
            <div className="space-y-3">
              {leaderboard.map((p, i) => {
                const isMe = p.user_id === user?.id;
                const skinId = playerSkins[p.user_id] || 'default';
                const initial = (p.player_name || p.name || '?')[0].toUpperCase();
                const place = placements[i];
                const roundsSurvived = gameMode === 'survival'
                  ? (p.eliminated ? p.eliminated_at_round || 1 : totalRounds)
                  : null;

                return (
                  <div
                    key={p.user_id}
                    className={`flex items-center gap-3 p-3 sm:p-4 rounded-2xl border-2 transition-all ${placementBg(place)} ${isMe ? 'ring-2 ring-orange-400 ring-offset-1' : ''}`}
                  >
                    {/* Placement */}
                    <div className="flex-shrink-0">{placementIcon(place)}</div>

                    {/* Avatar */}
                    <AvatarPreview skinId={skinId} initial={initial} size={40} userId={p.user_id} isPlus={isMe && isBlazesPlusCached()} />

                    {/* Name & details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-black truncate" style={{ color: getNameColor(skinId) }}>
                          {p.player_name || p.name}
                        </span>
                        {isMe && (
                          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold flex-shrink-0">
                            YOU
                          </span>
                        )}
                      </div>
                      {gameMode === 'survival' && (
                        <div className="flex items-center gap-2 text-xs text-gray-500 font-semibold mt-0.5">
                          <Shield className="w-3 h-3" />
                          <span>
                            {p.eliminated
                              ? `Eliminated`
                              : `Survived`}
                            {roundsSurvived !== null && ` \u00b7 ${roundsSurvived} round${roundsSurvived !== 1 ? 's' : ''}`}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Score */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-xl font-black text-gray-900">
                        {gameMode === 'elemental_markets'
                          ? `$${Number(p.score || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                          : (p.score || 0)}
                      </div>
                      <div className="text-xs font-bold text-gray-400">{gameMode === 'elemental_markets' ? 'score' : 'pts'}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Rewards Banner */}
        {(bbEarned > 0 || xpEarned > 0) && (
          <div className="bg-white rounded-2xl p-5 mb-6 border border-gray-200 flex items-center justify-center gap-6">
            {xpEarned > 0 && (
              <div className="text-center">
                <div className="text-2xl font-black text-red-600">+{xpEarned}</div>
                <div className="text-xs font-bold text-gray-500">XP earned</div>
              </div>
            )}
            {xpEarned > 0 && bbEarned > 0 && <div className="w-px h-10 bg-gray-200" />}
            {bbEarned > 0 && (
              <div className="flex items-center gap-2">
                <img src="/blazes-coin.png" className="w-8 h-8" alt="BB" style={{ mixBlendMode: 'multiply' }} />
                <div>
                  <div className="text-2xl font-black text-yellow-600">+{bbEarned}</div>
                  <div className="text-xs font-bold text-gray-500">BlazesBucks</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* AI Overview */}
        <div className="mb-6">
          {!showOverview ? (
            hasMembership ? (
              <button
                onClick={async () => {
                  setShowOverview(true);
                  setAiLoading(true);
                  try {
                    const resp = await fetch(`${base}/api/games/${gameCode}/ai-overview/${user?.id}`);
                    const data = await resp.json();
                    setAiOverview(data.overview || 'Could not generate overview.');
                  } catch {
                    setAiOverview('Could not generate overview right now.');
                  }
                  setAiLoading(false);
                }}
                className="w-full flex items-center justify-center gap-3 py-4 bg-white border-2 border-gray-200 rounded-2xl hover:border-red-300 hover:bg-red-50 transition-all shadow-sm group"
              >
                <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center group-hover:bg-red-200 transition-colors">
                  <Sparkles className="w-4 h-4 text-red-500" />
                </div>
                <span className="font-black text-gray-900">Get AI Study Overview</span>
              </button>
            ) : (
              <button
                onClick={() => setShowOverview(true)}
                className="w-full relative overflow-hidden flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-2xl hover:from-red-100 hover:to-orange-100 transition-all shadow-sm group"
              >
                <div className="absolute inset-0 locked-shimmer" />
                <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center relative z-10">
                  <Sparkles className="w-4 h-4 text-red-500" />
                </div>
                <span className="font-black text-gray-900 relative z-10">AI Study Overview</span>
                <Lock className="w-3.5 h-3.5 text-red-400 relative z-10" />
              </button>
            )
          ) : hasMembership ? (
            <div className="bg-white rounded-3xl shadow-xl border-2 border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-red-500 to-orange-500 px-6 py-4 flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-white" />
                <h2 className="text-base font-black text-white">AI Study Overview</h2>
              </div>
              <div className="p-6">
                {aiLoading ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-10">
                    <div className="w-10 h-10 border-3 border-red-200 border-t-red-500 rounded-full animate-spin" style={{ borderWidth: 3 }} />
                    <span className="text-sm font-bold text-gray-400">Analyzing your performance...</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {aiOverview.split('\n').filter(l => l.trim()).map((line, i) => {
                      const trimmed = line.trim();
                      if (trimmed.startsWith('Strengths:')) {
                        return <div key={i} className="flex items-center gap-2 mt-2"><div className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0"><Target className="w-3.5 h-3.5 text-green-600" /></div><span className="text-sm font-black text-green-700">Strengths</span></div>;
                      }
                      if (trimmed.startsWith('To Improve:')) {
                        return <div key={i} className="flex items-center gap-2 mt-2"><div className="w-6 h-6 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0"><Target className="w-3.5 h-3.5 text-orange-600" /></div><span className="text-sm font-black text-orange-700">To Improve</span></div>;
                      }
                      if (trimmed.startsWith('Quick Tip:')) {
                        return (
                          <div key={i} className="mt-3 bg-blue-50 rounded-xl p-4 border border-blue-200">
                            <div className="text-xs font-black text-blue-600 uppercase mb-1">Quick Tip</div>
                            <div className="text-sm font-semibold text-blue-800">{trimmed.replace('Quick Tip:', '').trim()}</div>
                          </div>
                        );
                      }
                      if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
                        return <div key={i} className="flex items-start gap-2 ml-8"><span className="text-gray-400 mt-0.5">•</span><span className="text-sm text-gray-700 font-medium">{trimmed.replace(/^[-•]\s*/, '')}</span></div>;
                      }
                      if (i === 0) {
                        return <div key={i} className="text-base font-bold text-gray-900 leading-relaxed">{trimmed}</div>;
                      }
                      return <div key={i} className="text-sm text-gray-700 font-medium leading-relaxed">{trimmed}</div>;
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl shadow-xl border-2 border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-red-500 to-orange-500 px-6 py-4 flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-white" />
                <h2 className="text-base font-black text-white">AI Study Overview</h2>
              </div>
              <div className="p-6 relative">
                {/* Blurred fake preview */}
                <div className="select-none" style={{ filter: 'blur(5px)' }} aria-hidden="true">
                  <div className="text-base font-bold text-gray-900 mb-3">Great effort! You showed solid understanding of the core concepts.</div>
                  <div className="flex items-center gap-2 mb-2"><div className="w-6 h-6 bg-green-100 rounded-lg" /><span className="text-sm font-black text-green-700">Strengths</span></div>
                  <div className="ml-8 text-sm text-gray-600 mb-1">- Quick response time on multiple choice</div>
                  <div className="ml-8 text-sm text-gray-600 mb-3">- Strong grasp of key definitions</div>
                  <div className="flex items-center gap-2 mb-2"><div className="w-6 h-6 bg-orange-100 rounded-lg" /><span className="text-sm font-black text-orange-700">To Improve</span></div>
                  <div className="ml-8 text-sm text-gray-600 mb-1">- Review the relationship between concepts</div>
                  <div className="bg-blue-50 rounded-xl p-3 mt-3"><div className="text-xs font-black text-blue-600">Quick Tip</div><div className="text-sm text-blue-800">Try flashcards to reinforce weak areas</div></div>
                </div>
                {/* Overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-[2px] rounded-b-3xl">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-2xl flex items-center justify-center mb-3">
                    <Sparkles className="w-6 h-6 text-purple-500" />
                  </div>
                  <h3 className="text-lg font-black text-gray-900 mb-1">AI-Powered Insights</h3>
                  <p className="text-sm text-gray-500 mb-4 text-center px-6">See what you did well, what to study more, and get personalized tips</p>
                  <button onClick={() => navigate('/upgrade')}
                    className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all text-sm">
                    Unlock with Blazes Plus
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => {
              navigate(user?.role === 'teacher' ? '/home/teacher' : '/home/student');
            }}
            className="flex items-center justify-center gap-2 py-4 bg-gray-200 text-gray-900 font-black rounded-xl hover:bg-gray-300 transition-colors"
          >
            <Home className="w-5 h-5" />
            Back to Home
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(`Check out my score on Blazes! I got ${score} points with ${accuracy}% accuracy!`);
              setClipboardToast(true);
            }}
            className="flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white font-black rounded-xl hover:shadow-lg transition-shadow"
          >
            <Share2 className="w-5 h-5" />
            Share Score
          </button>
        </div>
      </div>
    </div>
  );
}

// Compact icon-chip + big-number stat card used in the post-game hero row.
function StatCard({ icon: Icon, iconBg, iconColor, value, label }) {
  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 shadow-sm flex flex-col items-center text-center">
      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${iconBg} flex items-center justify-center mb-2`}>
        <Icon className={`w-5 h-5 ${iconColor}`} strokeWidth={2.5} />
      </div>
      <div className="text-2xl sm:text-3xl font-black text-gray-900 leading-none tabular-nums">{value}</div>
      <div className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-gray-400 mt-1.5">{label}</div>
    </div>
  );
}
