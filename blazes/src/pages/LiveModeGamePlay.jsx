import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, ArrowLeft, TrendingUp, TrendingDown, Clock, Plus, Square } from 'lucide-react';
import QuestionView from '../components/QuestionView';
import { AvatarPreview, getSkinColor, isBlazesPlusCached } from './SkinsPage';
import { LIVE_MODE_META } from '../utils/liveModes';
import { authHeaders, handleUnauthorized } from '../utils/auth';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';


/**
 * Shared shell for the four live modes.
 *
 * The teacher owns the clock: the game runs until they end it or the length they
 * set runs out, and they can extend it from here without interrupting play.
 *
 * It owns the question queue, the answer round-trip and the standings poll.
 * Everything mode-specific is one panel plus a flash message, because the
 * server does all the scoring, the client only reports correct + milliseconds.
 */
export default function LiveModeGamePlay({ gameCode, user, equippedSkinId, initialGame }) {
  const navigate = useNavigate();
  const mode = initialGame?.game_mode;
  const meta = LIVE_MODE_META[mode] || LIVE_MODE_META.vault;

  const [questions] = useState(() => initialGame?.questions || []);
  const [queue, setQueue] = useState(() =>
    [...Array((initialGame?.questions || []).length).keys()].sort(() => Math.random() - 0.5));
  const [qIdx, setQIdx] = useState(0);
  const [qNum, setQNum] = useState(1);
  const [state, setState] = useState(null);
  const [flash, setFlash] = useState(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [extending, setExtending] = useState(false);
  const flashTimer = useRef(null);
  // Session tallies for the reward post on leave. Refs, because the unmount
  // cleanup would otherwise close over the counts as they were on first render.
  const answeredRef = useRef(0);
  const correctRef = useRef(0);
  const scoreRef = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/games/${gameCode}/live/state?userId=${user.id}`);
      if (r.ok) {
        const d = await r.json();
        setState(d);
        // Re-sync from the server; the local tick below keeps it moving between polls.
        if (d.secondsLeft !== null && d.secondsLeft !== undefined) setSecondsLeft(d.secondsLeft);
      }
    } catch { /* transient poll failure is fine, the next tick retries */ }
  }, [gameCode, user.id]);

  useEffect(() => {
    // Deferred rather than called inline: a synchronous setState inside an
    // effect triggers a second render pass before paint.
    const first = setTimeout(refresh, 0);
    const t = setInterval(refresh, 2000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [refresh]);

  useEffect(() => () => clearTimeout(flashTimer.current), []);

  // Tick the clock locally so it counts down smoothly rather than jumping
  // every poll. The server remains the authority on when the game ends.
  useEffect(() => {
    if (secondsLeft === null) return;
    const t = setInterval(() => setSecondsLeft(s => (s === null ? null : Math.max(0, s - 1))), 1000);
    return () => clearInterval(t);
  }, [secondsLeft === null]);

  const extend = useCallback(async (mins) => {
    setExtending(true);
    try {
      const r = await fetch(`${BASE}/api/games/${gameCode}/live/extend`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ minutes: mins }),
      });
      if (handleUnauthorized(r)) return;
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setSecondsLeft(d.secondsLeft ?? null); refresh(); }
      else setProblem(d.error || 'Could not extend the game.');
    } catch { setProblem('Could not extend the game.'); }
    setExtending(false);
  }, [gameCode, refresh]);

  const endGame = useCallback(async () => {
    try {
      await fetch(`${BASE}/api/games/${gameCode}/end`, {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify({}),
      });
      refresh();
    } catch { setProblem('Could not end the game.'); }
  }, [gameCode, refresh]);

  // Tell the server when we go, otherwise a player who closes the tab shows in
  // the standings as still playing indefinitely.
  useEffect(() => {
    const leave = () => {
      try {
        const body = JSON.stringify({ userId: user.id });
        navigator.sendBeacon?.(`${BASE}/api/games/${gameCode}/leave`, new Blob([body], { type: 'application/json' }));
        // Credit the session. /live/answer writes game_answers, which feeds the
        // accuracy stats, so without this live play only ever counted against a
        // student: no BlazesBucks, no XP, no day-streak row, no achievements.
        if (answeredRef.current > 0) {
          const summary = JSON.stringify({
            userId: user.id,
            finalScore: Math.round(scoreRef.current),
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
      const r = await fetch(`${BASE}/api/games/${gameCode}/live/answer`, {
        method: 'POST', headers: authHeaders(),
        // `answer` lets the server re-grade rather than trust `correct`.
        // A signed-in player is identified by their token and this userId is
        // ignored. It is read only for a guest, who has no token, and only
        // when it matches a seat already held in this game.
        body: JSON.stringify({ userId: user.id, questionId: q?.id ?? null, answer, correct, ms }),
      });
      // A guest has no session to expire, so bouncing them to the login page
      // would just eject them from a game they legitimately joined.
      if (user.role !== 'guest' && handleUnauthorized(r)) return;
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        answeredRef.current += 1;
        // The server re-grades and reports its own verdict. Inferring it from
        // `delta > 0` under-counted every mode whose delta can be 0 on a
        // correct answer, which cost the student their BlazesBucks.
        if (d.isCorrect ?? ((d.delta ?? 0) > 0)) correctRef.current += 1;
        scoreRef.current = d.score ?? scoreRef.current;
        setFlash({ ...d, correct });
        clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setFlash(null), 3200);
        refresh();
      } else {
        // Silently dropping this meant a non-participant could play a whole
        // session while nothing was ever recorded.
        setProblem(d.error === 'Not a participant'
          ? 'You are not in this game. Ask your teacher for the code and join again.'
          : d.error === 'duplicate'
            ? null   // harmless double-submit; nothing to tell the player
            : (d.message || d.error || 'That answer did not save. Check your connection.'));
      }
    } catch {
      setProblem('That answer did not save. Check your connection.');
    }
    setBusy(false);
  }, [gameCode, user.id, questions, queue, qIdx, refresh]);

  // Endless: reshuffle and keep going rather than ever running out.
  const next = useCallback(() => {
    setQNum(n => n + 1);
    setQIdx(prev => {
      const n = prev + 1;
      if (n < queue.length) return n;
      setQueue([...Array(questions.length).keys()].sort(() => Math.random() - 0.5));
      return 0;
    });
  }, [queue.length, questions.length]);

  const me = state?.me;
  const players = state?.players || [];
  const gameOver = state?.status === 'ended' || state?.status === 'abandoned';
  const myColor = getSkinColor(equippedSkinId) || meta.accent;
  const homePath = user?.role === 'teacher' ? '/home/teacher' : '/home/student';
  const isHost = state?.isHost || initialGame?.host_id === user?.id;

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
            {me ? `You finished with ${Math.round(me.score)} at rank #${me.rank}.` : 'Thanks for playing.'}
          </p>
          {/* Final scores are settled when the game ends, but nothing used to
              take anyone to them, so the class never saw where they placed. */}
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

  const q = questions[queue[qIdx]];
  const Icon = meta.icon;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate(homePath)} className="p-2 rounded-lg hover:bg-gray-200" aria-label="Leave">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <AvatarPreview skinId={equippedSkinId} initial={user?.name?.[0] || '?'} size={38} isPlus={isBlazesPlusCached()} />
            <div className="min-w-0">
              <div className="font-black text-gray-900 leading-tight truncate">{user?.name || 'Player'}</div>
              <div className="text-[11px] font-bold flex items-center gap-1" style={{ color: meta.accent }}>
                <Icon className="w-3 h-3" /> {meta.name}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {secondsLeft !== null && (
              <div className={`px-3 py-2 rounded-xl border-2 text-center flex items-center gap-1.5 ${
                secondsLeft <= 60 ? 'bg-red-50 border-red-300 text-red-700' : 'bg-white border-gray-200 text-gray-700'}`}>
                <Clock className="w-4 h-4" />
                <span className="font-black tabular-nums">
                  {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
                </span>
              </div>
            )}
            {isHost && (
              <>
                <button onClick={() => extend(5)} disabled={extending}
                  title="Add 5 minutes"
                  className="px-3 py-2 rounded-xl bg-white border-2 border-gray-200 hover:border-green-400 hover:bg-green-50 font-black text-sm text-gray-700 disabled:opacity-60 flex items-center gap-1">
                  <Plus className="w-4 h-4" />5m
                </button>
                <button onClick={endGame}
                  title="End the game for everyone"
                  className="px-3 py-2 rounded-xl bg-gray-900 hover:bg-red-700 text-white font-black text-sm flex items-center gap-1.5">
                  <Square className="w-3.5 h-3.5 fill-current" /> End
                </button>
              </>
            )}
            <div className="px-4 py-2 rounded-xl bg-white border-2 shadow-sm text-right" style={{ borderColor: myColor }}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Standing</div>
              <div className="text-xl font-black tabular-nums" style={{ color: myColor }}>
                {me ? Math.round(me.score) : 0}
              </div>
            </div>
            {me?.rank && (
              <div className="px-3 py-2 rounded-xl bg-gray-900 text-white text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider opacity-60">Rank</div>
                <div className="text-xl font-black tabular-nums">#{me.rank}</div>
              </div>
            )}
          </div>
        </div>

        <ModePanel mode={mode} state={state} me={me} user={user} myColor={myColor} />

        {problem && (
          <div className="mb-4 px-4 py-2.5 rounded-xl font-bold text-sm bg-red-50 text-red-800 border-2 border-red-200 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 flex-shrink-0" />
            <span>{problem}</span>
            <button onClick={() => setProblem(null)} className="ml-auto text-red-500 hover:text-red-700 font-black">&times;</button>
          </div>
        )}
        {flash && <FlashLine flash={flash} mode={mode} />}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-5 items-start">
          <div>
            <QuestionView
              key={`${qNum}-${q?.id ?? qIdx}`}
              question={q}
              questionNumber={qNum}
              onAnswer={handleAnswer}
              onNext={next}
              nextLabel={busy ? 'Saving...' : 'Next question'}
            />
          </div>

          {/* Live standings. Everyone is playing at once, so this is the game. */}
          <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 shadow-sm">
            <div className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Live standings</div>
            <div className="space-y-2">
              {players.map(p => {
                const c = getSkinColor(p.skin) || '#94a3b8';
                const isMe = p.userId === user.id;
                return (
                  <div key={p.userId}
                    className={`flex items-center gap-2 p-2 rounded-xl ${isMe ? 'bg-gray-100' : ''}`}>
                    <span className="w-5 text-xs font-black text-gray-400 tabular-nums">{p.rank}</span>
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c }} />
                    <span className={`flex-1 text-sm truncate ${isMe ? 'font-black text-gray-900' : 'font-semibold text-gray-600'}`}>
                      {p.name}
                    </span>
                    <span className="text-sm font-black tabular-nums text-gray-900">{Math.round(p.score)}</span>
                  </div>
                );
              })}
              {!players.length && <div className="text-sm text-gray-400 font-semibold">Waiting for players...</div>}
            </div>
            <p className="text-[11px] text-gray-400 font-semibold mt-3 leading-snug">
              Scores decrease when you stop answering. The game ends when your teacher ends it.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FlashLine({ flash, mode }) {
  const up = (flash.delta ?? 0) >= 0;
  const bits = [];
  if (mode === 'vault' && flash.flash?.cracked) bits.push(`Took ${flash.flash.cracked} from the pot`);
  if (mode === 'undertow') bits.push(flash.flash?.withCurrent ? 'With the current' : 'Against the current');
  if (mode === 'fracture' && flash.flash?.repaired) bits.push(`Repaired ${flash.flash.repaired} crack${flash.flash.repaired === 1 ? '' : 's'}`);
  if (mode === 'fracture' && flash.flash?.crackedNear) bits.push('Your wrong answer added a crack');
  if (mode === 'eclipse' && flash.flash?.radius !== undefined) bits.push(`Area radius ${flash.flash.radius}`);
  return (
    <div className={`mb-4 px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 ${up ? 'bg-green-50 text-green-800 border-2 border-green-200' : 'bg-red-50 text-red-800 border-2 border-red-200'}`}>
      {up ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
      <span className="tabular-nums">{up ? '+' : ''}{Math.round(flash.delta)}</span>
      {bits.length > 0 && <span className="opacity-70">· {bits.join(' · ')}</span>}
      {flash.streak > 1 && <span className="ml-auto opacity-70">streak {flash.streak}</span>}
    </div>
  );
}

function ModePanel({ mode, state, me, user, myColor }) {
  const shared = state?.shared || {};
  const players = state?.players || [];

  if (mode === 'vault') {
    const pot = shared.pot || 0;
    const pct = Math.min(100, (pot / 600) * 100);
    return (
      <Panel>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-black text-gray-700">Vault</span>
          <span className="text-2xl font-black tabular-nums text-amber-600">{Math.round(pot)}</span>
        </div>
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-gray-500 font-semibold mt-2">
          {shared.lastCrack
            ? `${shared.lastCrack.name} took ${shared.lastCrack.amount}`
            : 'Growing. The next correct answer takes part of it.'}
        </p>
      </Panel>
    );
  }

  if (mode === 'undertow') {
    const holder = players.find(p => p.userId === shared.current?.userId);
    const riding = shared.current?.userId === user.id;
    return (
      <Panel>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-black text-gray-700 mb-0.5">Current</div>
            <div className="text-xs font-semibold text-gray-500">
              {holder ? `Moving toward ${holder.name}` : 'Even. Answer fast to take it'}
            </div>
          </div>
          <div className={`px-3 py-1.5 rounded-xl text-xs font-black ${riding ? 'bg-cyan-100 text-cyan-800' : 'bg-gray-100 text-gray-500'}`}>
            {riding ? 'YOU HAVE IT' : 'BEHIND'}
          </div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-gradient-to-r from-cyan-200 via-cyan-500 to-cyan-200 opacity-70" />
      </Panel>
    );
  }

  if (mode === 'fracture') {
    // The drawn pane holds the most recent cracks only, so counting what is
    // drawn understated how many are actually scoring against you. The server
    // sends the real count and the multiplier it works out to.
    const mine = shared.myCracks ?? (shared.cracks || []).filter(c => c.near === user.id).length;
    const dim = shared.dim ?? Math.max(0.3, 1 - mine * 0.08);
    return (
      <Panel>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-black text-gray-700">Cracks near you</span>
          <span className={`text-2xl font-black tabular-nums ${mine ? 'text-purple-600' : 'text-gray-400'}`}>{mine}</span>
        </div>
        <div className="flex items-center justify-between mb-2 text-xs font-bold">
          <span className="text-gray-500">Your points multiplier</span>
          <span className={dim < 1 ? 'text-purple-600' : 'text-gray-400'}>{dim.toFixed(2)}x</span>
        </div>
        <div className="relative h-16 rounded-xl bg-gray-900 overflow-hidden">
          {(shared.cracks || []).map((c, i) => (
            <span key={i}
              className="absolute w-px h-6 bg-white/50"
              style={{ left: `${(c.x || 0) * 100}%`, top: `${(c.y || 0) * 60}%`, transform: `rotate(${(c.x || 0) * 90 - 45}deg)`, opacity: c.near === user.id ? 0.9 : 0.25 }} />
          ))}
          {!(shared.cracks || []).length && (
            <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-gray-500">Glass intact</div>
          )}
        </div>
        <p className="text-xs text-gray-500 font-semibold mt-2">Correct answers repair the cracks closest to you.</p>
      </Panel>
    );
  }

  // eclipse
  const maxR = Math.max(1, ...players.map(p => p.radius || 0));
  return (
    <Panel>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-black text-gray-700">Territory</span>
        <span className="text-xs font-semibold text-gray-500">Your area shrinks over time. Keep answering to keep it</span>
      </div>
      <div className="relative h-28 rounded-xl bg-gray-900 overflow-hidden flex items-center justify-center gap-6">
        {players.map((p, i) => {
          const c = getSkinColor(p.skin) || '#94a3b8';
          const size = 12 + ((p.radius || 0) / maxR) * 70;
          return (
            <div key={p.userId} className="relative flex flex-col items-center" style={{ zIndex: players.length - i }}>
              <div className="rounded-full transition-all duration-700"
                style={{ width: size, height: size, background: c, boxShadow: `0 0 ${size / 2}px ${c}`, opacity: 0.85 }} />
              <span className="text-[10px] font-bold text-white/70 mt-1 truncate max-w-[70px]">{p.name}</span>
            </div>
          );
        })}
        {!players.length && <span className="text-[11px] font-bold text-gray-500">Dark</span>}
      </div>
      {me && (
        <p className="text-xs font-semibold mt-2" style={{ color: myColor }}>
          Your radius: {me.radius ?? 0}
        </p>
      )}
    </Panel>
  );
}

function Panel({ children }) {
  return <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 shadow-sm mb-4">{children}</div>;
}
