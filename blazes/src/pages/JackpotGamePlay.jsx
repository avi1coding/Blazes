import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, ArrowLeft, Clock, Coins, Shield, ShieldCheck, Sparkles, Star, Swords, Zap, Crown, Plus, Minus, Loader2 } from 'lucide-react';
import QuestionView from '../components/QuestionView';
import Toast from '../components/Toast';
import { AvatarPreview, assignUniqueSkinColors } from './SkinsPage';
import { authHeaders, handleUnauthorized } from '../utils/auth';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
const SPIN_MS = 2600;
const EXTRA_SPINS = 5;

const SEGMENT_COLORS = {
  0: '#94a3b8', 10: '#4ade80', 15: '#22c55e', 20: '#16a34a',
  25: '#f59e0b', 35: '#f97316', 50: '#ef4444', 75: '#eab308',
};

// Each upgrade gets its own icon + color so the shop reads like a real game
// shop (distinct items) instead of a uniform list of identical rows.
const UPGRADE_STYLE = {
  multiplier: { icon: Zap, bg: 'bg-violet-500' },
  shield: { icon: Shield, bg: 'bg-blue-500' },
  insurance: { icon: ShieldCheck, bg: 'bg-teal-500' },
  luckyCharm: { icon: Star, bg: 'bg-pink-500' },
  pickpocket: { icon: Swords, bg: 'bg-rose-500' },
};

function shuffledQueue(n) {
  const q = [...Array(n).keys()];
  for (let i = q.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [q[i], q[j]] = [q[j], q[i]];
  }
  return q;
}

// Turns the {pct, weight} table into angular slices (in degrees, clockwise
// from the top) sized proportionally to weight, so the wheel's face is
// visually honest about the real odds instead of showing 8 equal wedges.
function buildWheelSegments(wheel) {
  const total = wheel.reduce((s, w) => s + w.weight, 0);
  let angle = 0;
  return wheel.map(w => {
    const size = (w.weight / total) * 360;
    const seg = { pct: w.pct, start: angle, end: angle + size, mid: angle + size / 2 };
    angle += size;
    return seg;
  });
}

/**
 * Jackpot: answer to earn chips, buy double-edged upgrades, spend chips to
 * steal outright, and every 5 questions spin a wheel that takes a cut from
 * whoever's currently leading. Runs until the host ends it or the clock
 * they set runs out.
 */
export default function JackpotGamePlay({ gameCode, user, equippedSkinId, initialGame }) {
  const navigate = useNavigate();
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'warning' });

  const [spin, setSpin] = useState(null); // { pct, targetUserId, targetName, amount, blocked }
  const [spinRotation, setSpinRotation] = useState(0);
  const [spinRevealed, setSpinRevealed] = useState(false);
  const [spinFast, setSpinFast] = useState(false);

  const questions = useMemo(() => initialGame?.questions || [], [initialGame]);
  const [queue, setQueue] = useState(() => shuffledQueue(questions.length));
  const [qIdx, setQIdx] = useState(0);

  // Session tallies for the leave-beacon summary, refs so the unmount
  // handler always reads the latest value without re-subscribing.
  const answeredRef = useRef(0);
  const correctRef = useRef(0);
  const chipsRef = useRef(0);

  const refresh = useCallback(async () => {
    try {
      // userId is read from the token for a signed-in player; a guest has no
      // token, so it rides along here too and is only trusted for a seat it
      // already holds (see /jackpot/state).
      const qs = user?.id != null ? `?userId=${encodeURIComponent(user.id)}` : '';
      const r = await fetch(`${BASE}/api/games/${gameCode}/jackpot/state${qs}`, { headers: authHeaders() });
      if (handleUnauthorized(r)) return;
      const d = await r.json().catch(() => null);
      if (d && !d.error) setState(d);
    } catch { /* transient network hiccup, next poll retries */ }
  }, [gameCode, user]);

  useEffect(() => {
    const t = setTimeout(refresh, 0);
    const id = setInterval(refresh, 2000);
    return () => { clearTimeout(t); clearInterval(id); };
  }, [refresh]);

  useEffect(() => {
    if (state?.me) chipsRef.current = state.me.chips;
  }, [state?.me]);

  const standings = state?.standings || [];
  const colorMap = assignUniqueSkinColors(standings);
  const wheelSegments = useMemo(() => buildWheelSegments(state?.wheel || []), [state?.wheel]);

  // Only a real navigate-away/tab-close should count as leaving. pagehide
  // fires far more eagerly (e.g. just backgrounding the tab on some
  // browsers), and calling leave() from the cleanup fires it on every
  // ordinary unmount too (including React StrictMode's mount/cleanup/mount
  // in dev) — both would get a player briefly switching tabs shown as
  // having left.
  useEffect(() => {
    const leave = () => {
      try {
        const body = JSON.stringify({ userId: user.id });
        navigator.sendBeacon?.(`${BASE}/api/games/${gameCode}/leave`, new Blob([body], { type: 'application/json' }));
        if (answeredRef.current > 0) {
          const summary = JSON.stringify({
            userId: user.id,
            finalScore: chipsRef.current,
            questionsAnswered: answeredRef.current,
            correctCount: correctRef.current,
            totalQuestions: answeredRef.current,
          });
          navigator.sendBeacon?.(`${BASE}/api/games/${gameCode}/answers`, new Blob([summary], { type: 'application/json' }));
        }
      } catch { /* best effort */ }
    };
    window.addEventListener('beforeunload', leave);
    return () => window.removeEventListener('beforeunload', leave);
  }, [gameCode, user.id]);

  const startSpin = useCallback((result, segments) => {
    setSpin(result);
    setSpinRevealed(false);
    setSpinFast(false);
    const seg = segments.find(s => s.pct === result.pct) || segments[0];
    const rotation = EXTRA_SPINS * 360 + ((360 - seg.mid) % 360);
    // Force a reflow so the browser registers the 0deg starting point before
    // animating to the target, otherwise it can skip straight there.
    setSpinRotation(0);
    requestAnimationFrame(() => requestAnimationFrame(() => setSpinRotation(rotation)));
    setTimeout(() => setSpinRevealed(true), SPIN_MS);
  }, []);

  const skipSpin = () => {
    setSpinFast(true);
    setSpinRevealed(true);
  };

  const handleAnswer = useCallback(async ({ correct, ms, answer }) => {
    const q = questions[queue[qIdx]];
    setBusy(true);
    try {
      const r = await fetch(`${BASE}/api/games/${gameCode}/jackpot/answer`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ userId: user.id, questionId: q?.id ?? null, answer, correct, ms }),
      });
      if (user.role !== 'guest' && handleUnauthorized(r)) return;
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        answeredRef.current += 1;
        if (d.isCorrect) correctRef.current += 1;
        if (d.spin) startSpin(d.spin, buildWheelSegments(state?.wheel || []));
        refresh();
      } else if (d.error !== 'duplicate') {
        setError(d.message || d.error || 'That answer did not save. Check your connection.');
      }
    } catch {
      setError('Could not reach the server. Check your connection.');
    }
    setBusy(false);
  }, [gameCode, questions, queue, qIdx, user, refresh, startSpin, state]);

  const nextQuestion = useCallback(() => {
    setError('');
    if (qIdx + 1 < queue.length) {
      setQIdx(i => i + 1);
    } else {
      setQueue(shuffledQueue(questions.length));
      setQIdx(0);
    }
  }, [qIdx, queue.length, questions.length]);

  const buyUpgrade = async (upgradeId) => {
    try {
      const r = await fetch(`${BASE}/api/games/${gameCode}/jackpot/upgrade`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ userId: user.id, upgradeId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.message || 'Could not buy that upgrade.'); return; }
      refresh();
    } catch {
      setError('Could not reach the server. Check your connection.');
    }
  };

  const stealFrom = async (targetUserId) => {
    try {
      const r = await fetch(`${BASE}/api/games/${gameCode}/jackpot/steal`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ userId: user.id, targetUserId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.message || 'Could not steal right now.'); return; }
      refresh();
    } catch {
      setError('Could not reach the server. Check your connection.');
    }
  };

  const gameOver = state?.status === 'ended' || state?.status === 'abandoned';
  const isHost = state?.isHost || initialGame?.host_id === user?.id;
  const homePath = user?.role === 'teacher' ? '/home/teacher' : '/home/student';

  const endGame = async () => {
    await fetch(`${BASE}/api/games/${gameCode}/end`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({}) });
    setToast({ show: true, message: 'Game ended for everyone.', type: 'warning' });
    refresh();
  };
  const adjustTime = async (minutes) => {
    await fetch(`${BASE}/api/games/${gameCode}/jackpot/extend`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ minutes }) });
    refresh();
  };

  if (!questions.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 text-center border-2 border-gray-100 max-w-sm">
          <Flame className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="font-black text-gray-900 mb-1">No questions in this kit</p>
          <p className="text-sm text-gray-500 mb-4">Add some questions and start the game again.</p>
          <button onClick={() => navigate(-1)} className="px-5 py-2.5 bg-gray-900 text-white rounded-xl font-bold">Back</button>
        </div>
      </div>
    );
  }

  if (state?.status === 'waiting') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 text-center border-2 border-gray-100 max-w-sm">
          <Coins className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="font-black text-gray-900 mb-1">Waiting for the host to start</p>
          <p className="text-sm text-gray-500 mb-4">The game hasn't begun yet — hang tight.</p>
          <button onClick={() => navigate(homePath)} className="px-5 py-2.5 bg-gray-900 text-white rounded-xl font-bold">Back</button>
        </div>
      </div>
    );
  }

  if (gameOver) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Toast show={toast.show} message={toast.message} type={toast.type} onClose={() => setToast(t => ({ ...t, show: false }))} />
        <div className="bg-white rounded-2xl p-8 text-center border-2 border-gray-100 max-w-sm">
          <Flame className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="font-black text-gray-900 mb-1">This game has ended</p>
          <p className="text-sm text-gray-500 mb-4">
            {state?.me ? `You finished with ${state.me.chips} chips at rank #${state.me.rank}.` : 'Thanks for playing.'}
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => navigate(isHost ? `/game/teacher-results/${gameCode}` : `/game/results/${gameCode}`)}
              className="px-5 py-2.5 bg-gray-900 text-white rounded-xl font-bold"
            >
              See full results
            </button>
            <button onClick={() => navigate(homePath)} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold">
              Back to home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const question = questions[queue[qIdx]];
  const me = state?.me;
  const questionsPerSpin = state?.questionsPerSpin || 5;
  const progress = me ? me.questionsSinceSpin : 0;
  const upgradeCatalog = state?.upgrades || {};
  const cooldownLeft = me?.canStealAt && state?.serverNow
    ? Math.max(0, Math.round((me.canStealAt - state.serverNow) / 1000))
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <Toast show={toast.show} message={toast.message} type={toast.type} onClose={() => setToast(t => ({ ...t, show: false }))} />

      {spin && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onDoubleClick={skipSpin}>
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center">
            <p className="text-xs font-black uppercase tracking-widest text-amber-600 mb-3">Spin time!</p>
            <div className="relative w-56 h-56 mx-auto mb-6">
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 w-0 h-0
                border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[16px] border-t-gray-900" />
              <div
                className="w-full h-full rounded-full border-4 border-white shadow-xl"
                style={{
                  background: `conic-gradient(${wheelSegments.map(s => `${SEGMENT_COLORS[s.pct] || '#94a3b8'} ${s.start}deg ${s.end}deg`).join(', ')})`,
                  transform: `rotate(${spinRotation}deg)`,
                  transition: spinFast ? 'transform 100ms linear' : `transform ${SPIN_MS}ms cubic-bezier(0.15, 0.65, 0.25, 1)`,
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center">
                  <Coins className="w-5 h-5 text-amber-500" />
                </div>
              </div>
            </div>
            {!spinRevealed && (
              <p className="text-xs text-gray-400 font-semibold">Double-click the wheel to skip</p>
            )}
            {spinRevealed && (
              <div>
                {spin.targetUserId == null ? (
                  <p className="font-black text-gray-900">Nobody to steal from yet — spin wasted!</p>
                ) : spin.blocked ? (
                  <p className="font-black text-gray-900">
                    Landed on {spin.pct}% — but {spin.targetName} had a Shield up. Blocked!
                  </p>
                ) : (
                  <p className="font-black text-gray-900">
                    Landed on {spin.pct}%! You stole <span className="text-amber-600">{spin.amount} chips</span> from {spin.targetName}.
                  </p>
                )}
                <button
                  onClick={() => setSpin(null)}
                  className="w-full mt-5 py-3 bg-gray-900 text-white rounded-xl font-black"
                >
                  Continue
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate(homePath)} className="p-2 rounded-lg hover:bg-gray-200 flex-shrink-0" aria-label="Leave">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <AvatarPreview skinId={equippedSkinId} initial={user?.name?.[0] || '?'} size={38} userId={user?.id} />
            <div className="min-w-0">
              <div className="font-black text-gray-900 leading-tight truncate">{user?.name || 'Player'}</div>
              <div className="text-[11px] font-bold flex items-center gap-1 text-amber-600">
                <Coins className="w-3 h-3" /> Jackpot · {me?.chips ?? 0} chips
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {state?.secondsLeft != null && (
              <div className="flex items-center gap-1.5 bg-white border-2 border-gray-100 rounded-xl px-3 py-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="font-black text-gray-900 tabular-nums text-sm">
                  {Math.floor(state.secondsLeft / 60)}:{String(state.secondsLeft % 60).padStart(2, '0')}
                </span>
              </div>
            )}
            {isHost && (
              <>
                <button onClick={() => adjustTime(-1)} className="px-3 py-2 bg-white border-2 border-gray-100 rounded-xl font-bold text-sm hover:border-gray-200">
                  -1m
                </button>
                <button onClick={() => adjustTime(5)} className="px-3 py-2 bg-white border-2 border-gray-100 rounded-xl font-bold text-sm hover:border-gray-200">
                  +5m
                </button>
                <button onClick={() => adjustTime(10)} className="px-3 py-2 bg-white border-2 border-gray-100 rounded-xl font-bold text-sm hover:border-gray-200">
                  +10m
                </button>
                <button onClick={endGame} className="px-3 py-2 bg-red-50 text-red-600 border-2 border-red-100 rounded-xl font-bold text-sm hover:border-red-200">
                  End
                </button>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm font-semibold">{error}</div>
        )}

        {/* THE GAME — chips, spin countdown, and the live leaderboard. This is
            the main event; answering questions (below) is how you fuel it. */}
        <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 rounded-3xl p-4 sm:p-6 shadow-lg shadow-amber-500/20 mb-4">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
            <div>
              <div className="text-white/70 text-[11px] font-black uppercase tracking-widest mb-1">Your Chips</div>
              <div className="flex items-center gap-2">
                <Coins className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-200 flex-shrink-0" />
                <span className="text-4xl sm:text-5xl font-black text-white tabular-nums">{me?.chips ?? 0}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-white/70 text-[11px] font-black uppercase tracking-widest mb-1.5">
                {progress}/{questionsPerSpin} to next spin
              </div>
              <div className="flex gap-1.5 justify-end">
                {Array.from({ length: questionsPerSpin }).map((_, i) => (
                  <div key={i} className={`w-3.5 h-3.5 rounded-full transition-colors ${i < progress ? 'bg-yellow-200' : 'bg-white/25'}`} />
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white/95 backdrop-blur rounded-2xl p-2 sm:p-3">
            <div className="flex items-center justify-between px-2 pt-1 pb-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-gray-400">Leaderboard</span>
              {cooldownLeft > 0 && (
                <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Steal ready in {cooldownLeft}s
                </span>
              )}
            </div>
            <div className="space-y-1">
              {standings.map((p, i) => {
                const isMe = p.userId === user.id;
                const stealCost = me?.upgrades?.pickpocket ? 35 : (state?.stealCost || 20);
                const canSteal = !isMe && cooldownLeft === 0 && (me?.chips ?? 0) >= stealCost && p.chips > 0;
                return (
                  <div key={p.userId} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl ${isMe ? 'bg-amber-50 ring-2 ring-amber-300' : ''}`}>
                    {i === 0 ? (
                      <Crown className="w-5 h-5 text-amber-500 flex-shrink-0" />
                    ) : (
                      <span className={`w-5 text-center text-xs font-black tabular-nums flex-shrink-0 ${
                        i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-700' : 'text-gray-300'
                      }`}>{p.rank}</span>
                    )}
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colorMap[p.userId] || '#94a3b8' }} />
                    <span className={`flex-1 text-sm truncate ${isMe ? 'font-black text-gray-900' : 'font-semibold text-gray-600'}`}>
                      {p.name}{isMe && ' (you)'}
                    </span>
                    <span className="text-sm font-black tabular-nums text-gray-900">{p.chips}</span>
                    {!isMe && (
                      <button
                        onClick={() => stealFrom(p.userId)}
                        disabled={!canSteal}
                        title={`Steal ${stealCost} chips to take a cut`}
                        className={`p-1.5 rounded-lg flex-shrink-0 ${canSteal ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-gray-100 text-gray-300'}`}
                      >
                        <Swords className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
              {!standings.length && <div className="text-sm text-gray-400 font-semibold px-2.5 py-2">Waiting for players...</div>}
            </div>
          </div>
        </div>

        {/* Answering — the side part that fuels the game above. */}
        <div className="grid lg:grid-cols-[1fr_320px] gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Answer to earn chips</div>
            {question && (
              <QuestionView
                key={`${qIdx}-${question.id}`}
                question={question}
                questionNumber={qIdx + 1}
                onAnswer={handleAnswer}
                onNext={nextQuestion}
              />
            )}
            {busy && (
              <div className="flex items-center justify-center gap-2 text-sm font-semibold text-gray-400 mt-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Saving...
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 shadow-sm">
            <div className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Shop
            </div>
            <div className="space-y-2.5">
              {Object.entries(upgradeCatalog).map(([id, u]) => {
                const style = UPGRADE_STYLE[id] || { icon: Sparkles, bg: 'bg-gray-500' };
                const Icon = style.icon;
                const charges = id === 'shield' ? (me?.shieldCharges || 0) : 0;
                const owned = id === 'shield' ? charges > 0 : !!me?.upgrades?.[id];
                const canBuy = id === 'shield' || !me?.upgrades?.[id];
                const affordable = (me?.chips ?? 0) >= u.cost;
                return (
                  <div key={id} className={`rounded-2xl p-3 border-2 ${owned ? 'border-amber-200 bg-amber-50/50' : 'border-gray-100'}`}>
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${style.bg}`}>
                        <Icon className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-black text-gray-900 text-sm truncate">{u.name}</div>
                        {id === 'shield' && charges > 0 && (
                          <div className="text-[11px] font-bold text-amber-600">{charges} charge{charges > 1 ? 's' : ''} ready</div>
                        )}
                      </div>
                      <button
                        onClick={() => buyUpgrade(id)}
                        disabled={!canBuy || !affordable}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-black flex-shrink-0 ${
                          !canBuy ? 'bg-gray-100 text-gray-400'
                            : affordable ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {!canBuy ? 'Owned' : u.cost}
                      </button>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-start gap-1.5 text-[11px] font-bold text-green-700">
                        <Plus className="w-3 h-3 mt-0.5 flex-shrink-0" /> <span>{u.good}</span>
                      </div>
                      <div className="flex items-start gap-1.5 text-[11px] font-bold text-red-600">
                        <Minus className="w-3 h-3 mt-0.5 flex-shrink-0" /> <span>{u.bad}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
