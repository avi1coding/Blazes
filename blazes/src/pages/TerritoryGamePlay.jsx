import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, ArrowLeft, Clock, Plus, Square, Loader2 } from 'lucide-react';
import QuestionView from '../components/QuestionView';
import { AvatarPreview, getSkinColor } from './SkinsPage';
import { authHeaders, handleUnauthorized } from '../utils/auth';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

function shuffledQueue(n) {
  const q = [...Array(n).keys()];
  for (let i = q.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [q[i], q[j]] = [q[j], q[i]];
  }
  return q;
}

/**
 * Territory: a shared grid, everyone answering at once, no picking. A
 * correct answer automatically claims the tile next to the player's last
 * one, so their color spreads outward on its own. Runs until the host ends
 * it or the clock they set runs out.
 */
export default function TerritoryGamePlay({ gameCode, user, equippedSkinId, initialGame }) {
  const navigate = useNavigate();
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [flashTile, setFlashTile] = useState(null);

  const questions = useMemo(() => initialGame?.questions || [], [initialGame]);
  const [queue, setQueue] = useState(() => shuffledQueue(questions.length));
  const [qIdx, setQIdx] = useState(0);

  // Session tallies for the leave-beacon summary, refs so the unmount
  // handler always reads the latest value without re-subscribing.
  const answeredRef = useRef(0);
  const correctRef = useRef(0);
  const scoreRef = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/games/${gameCode}/territory/state`, { headers: authHeaders() });
      if (handleUnauthorized(r)) return;
      const d = await r.json().catch(() => null);
      if (d && !d.error) setState(d);
    } catch { /* transient network hiccup, next poll retries */ }
  }, [gameCode]);

  useEffect(() => {
    // setTimeout, not a direct call: calling refresh() (it calls setState)
    // synchronously in the effect body triggers cascading renders. Deferring
    // to a macrotask fires effectively immediately without that.
    const t = setTimeout(refresh, 0);
    const id = setInterval(refresh, 2000);
    return () => { clearTimeout(t); clearInterval(id); };
  }, [refresh]);

  useEffect(() => {
    if (state?.me) scoreRef.current = state.me.tiles;
  }, [state?.me]);

  // Tell the server when a player leaves, same beacon pattern used
  // elsewhere so a closed tab doesn't just silently vanish from the roster.
  useEffect(() => {
    const leave = () => {
      try {
        const body = JSON.stringify({ userId: user.id });
        navigator.sendBeacon?.(`${BASE}/api/games/${gameCode}/leave`, new Blob([body], { type: 'application/json' }));
        if (answeredRef.current > 0) {
          const summary = JSON.stringify({
            userId: user.id,
            finalScore: scoreRef.current,
            questionsAnswered: answeredRef.current,
            correctCount: correctRef.current,
            totalQuestions: answeredRef.current,
          });
          navigator.sendBeacon?.(`${BASE}/api/games/${gameCode}/answers`, new Blob([summary], { type: 'application/json' }));
        }
      } catch { /* best effort */ }
    };
    window.addEventListener('pagehide', leave);
    return () => { window.removeEventListener('pagehide', leave); leave(); };
  }, [gameCode, user.id]);

  const handleAnswer = useCallback(async ({ correct, ms, answer }) => {
    const q = questions[queue[qIdx]];
    setBusy(true);
    try {
      const r = await fetch(`${BASE}/api/games/${gameCode}/territory/answer`, {
        method: 'POST', headers: authHeaders(),
        // userId is read from the token for a signed-in player; a guest has
        // no token, so it's sent here too and only trusted if that id
        // already holds a seat in this game.
        body: JSON.stringify({ userId: user.id, questionId: q?.id ?? null, answer, correct, ms }),
      });
      if (user.role !== 'guest' && handleUnauthorized(r)) return;
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        answeredRef.current += 1;
        if (d.isCorrect) correctRef.current += 1;
        if (d.claimedTile != null) {
          setFlashTile(d.claimedTile);
          setTimeout(() => setFlashTile(null), 500);
        }
        refresh();
      } else if (d.error !== 'duplicate') {
        setError(d.message || d.error || 'That answer did not save. Check your connection.');
      }
    } catch {
      setError('Could not reach the server. Check your connection.');
    }
    setBusy(false);
  }, [gameCode, questions, queue, qIdx, user, refresh]);

  const nextQuestion = useCallback(() => {
    setError('');
    if (qIdx + 1 < queue.length) {
      setQIdx(i => i + 1);
    } else {
      setQueue(shuffledQueue(questions.length));
      setQIdx(0);
    }
  }, [qIdx, queue.length, questions.length]);

  const gameOver = state?.status === 'ended' || state?.status === 'abandoned';
  const isHost = state?.isHost || initialGame?.host_id === user?.id;
  const homePath = user?.role === 'teacher' ? '/home/teacher' : '/home/student';

  const endGame = async () => {
    if (!confirm('End the game for everyone?')) return;
    await fetch(`${BASE}/api/games/${gameCode}/end`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({}) });
    refresh();
  };
  const extendGame = async () => {
    await fetch(`${BASE}/api/games/${gameCode}/territory/extend`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ minutes: 5 }) });
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

  if (gameOver) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 text-center border-2 border-gray-100 max-w-sm">
          <Flame className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="font-black text-gray-900 mb-1">This game has ended</p>
          <p className="text-sm text-gray-500 mb-4">
            {state?.me ? `You finished with ${state.me.tiles} tiles at rank #${state.me.rank}.` : 'Thanks for playing.'}
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
  const cols = state?.cols || 8;
  const tiles = state?.tiles || Array(cols * (state?.rows || 8)).fill(null);
  const colorFor = (userId) => {
    if (userId == null) return null;
    const p = state?.standings?.find(s => s.userId === userId);
    return (p && getSkinColor(p.skin)) || '#94a3b8';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate(homePath)} className="p-2 rounded-lg hover:bg-gray-200 flex-shrink-0" aria-label="Leave">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <AvatarPreview skinId={equippedSkinId} initial={user?.name?.[0] || '?'} size={38} userId={user?.id} />
            <div className="min-w-0">
              <div className="font-black text-gray-900 leading-tight truncate">{user?.name || 'Player'}</div>
              <div className="text-[11px] font-bold flex items-center gap-1 text-emerald-600">
                <Square className="w-3 h-3 fill-current" /> Territory · {state?.me?.tiles ?? 0} tiles
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
                <button onClick={extendGame} className="px-3 py-2 bg-white border-2 border-gray-100 rounded-xl font-bold text-sm hover:border-gray-200">
                  +5m
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

        <div className="grid lg:grid-cols-[1fr_260px] gap-4">
          {/* Question */}
          <div>
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

          {/* Board + standings */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 shadow-sm">
              <div className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">The Board</div>
              <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                {tiles.map((owner, i) => (
                  <div key={i}
                    className="aspect-square rounded-sm transition-all duration-300"
                    style={{
                      background: colorFor(owner) || '#e5e7eb',
                      opacity: owner == null ? 0.5 : 1,
                      transform: flashTile === i ? 'scale(1.25)' : 'scale(1)',
                      boxShadow: flashTile === i ? '0 0 0 2px white, 0 0 8px rgba(0,0,0,0.3)' : 'none',
                    }} />
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 shadow-sm">
              <div className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Standings</div>
              <div className="space-y-2">
                {(state?.standings || []).map(p => (
                  <div key={p.userId} className={`flex items-center gap-2 p-2 rounded-xl ${p.userId === user.id ? 'bg-gray-100' : ''}`}>
                    <span className="w-5 text-xs font-black text-gray-400 tabular-nums">{p.rank}</span>
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: getSkinColor(p.skin) || '#94a3b8' }} />
                    <span className={`flex-1 text-sm truncate ${p.userId === user.id ? 'font-black text-gray-900' : 'font-semibold text-gray-600'}`}>
                      {p.name}
                    </span>
                    <span className="text-sm font-black tabular-nums text-gray-900">{p.tiles}</span>
                  </div>
                ))}
                {!state?.standings?.length && <div className="text-sm text-gray-400 font-semibold">Waiting for players...</div>}
              </div>
              <p className="text-[11px] text-gray-400 font-semibold mt-3 leading-snug">
                Tiles fade if you stop answering. The game ends when your teacher ends it.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
