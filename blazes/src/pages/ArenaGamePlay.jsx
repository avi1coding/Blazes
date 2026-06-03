import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Shield, Zap, Flame, ShoppingBag, Sparkles, Clock, Trophy, X, Crown, Target, BarChart3, Backpack, HelpCircle } from 'lucide-react';
import { AvatarPreview, isBlazesPlusCached } from './SkinsPage';
import { rankParticipants } from '../utils/ranking';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

const ITEMS = [
  { key: 'lightning',  name: 'Lightning Strike', cost: 15, desc: '-25 to one player',          icon: Zap,      color: 'yellow' },
  { key: 'fireball',   name: 'Fireball',         cost: 30, desc: '-15 to 3 random players',    icon: Flame,    color: 'red' },
  { key: 'shield',     name: 'Shield',           cost: 15, desc: 'Block next attack',          icon: Shield,   color: 'blue' },
  { key: 'mirror',     name: 'Mirror',           cost: 30, desc: 'Reflect next attack fully',  icon: Shield,   color: 'cyan' },
  { key: 'doubleDown', name: 'Double Down',      cost: 20, desc: 'Next correct = 20 score',    icon: Sparkles, color: 'purple' },
];

// Ultimate is only awarded by combo 10, not buyable. Special rendering.
const ULTIMATE_ITEM = { key: 'ultimate', name: 'Ultimate Strike', desc: '-30 to one player (pierces shields!)', icon: Sparkles };

export default function ArenaGamePlay({ gameCode: propCode, user: propUser }) {
  const params = useParams();
  const gameCode = propCode || params.gameCode;
  const navigate = useNavigate();
  const [user] = useState(() => propUser || JSON.parse(localStorage.getItem('user') || 'null'));
  const [equippedSkinId, setEquippedSkinId] = useState('default');

  useEffect(() => {
    if (!user?.id) return;
    fetch(`${BASE}/api/skins/${user.id}`)
      .then(r => r.json())
      .then(d => { if (d.equipped?.avatar_skin) setEquippedSkinId(d.equipped.avatar_skin); })
      .catch(() => {});
  }, [user?.id]);

  const [game, setGame] = useState(null);
  const [questions, setQuestions] = useState([]);
  // Use a separate counter so re-renders happen even if we loop back to question 0
  const [questionTick, setQuestionTick] = useState(0);
  const currentQ = questions.length > 0 ? questionTick % questions.length : 0;

  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [gameTimeLeft, setGameTimeLeft] = useState(null);

  const [combo, setCombo] = useState(0);
  const [score, setScore] = useState(0);
  const [shields, setShields] = useState(0);
  const [doubleDown, setDoubleDown] = useState(0);
  const [permBonus, setPermBonus] = useState(0);
  const [inventory, setInventory] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [activeEvents, setActiveEvents] = useState([]);
  const [eventToast, setEventToast] = useState(null);
  const [hitEffect, setHitEffect] = useState(null); // { itemKey, blocked }
  const [scorePop, setScorePop] = useState(null); // { delta, isCorrect }
  const [comboBreakFlash, setComboBreakFlash] = useState(null); // { lostStreak }
  const [rankChange, setRankChange] = useState(null); // { type: 'gained' | 'lost', from, to }
  const seenAttackIdsRef = useRef(new Set());
  const prevRankRef = useRef(null);
  const prevScoreRef = useRef(null);

  const [showShop, setShowShop] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [attackTarget, setAttackTarget] = useState(null);

  const startTimeRef = useRef(Date.now());
  const gameStartedRef = useRef(null);
  const advanceTimeoutRef = useRef(null);

  const isShopClosed = activeEvents.some(e => e.key === 'shopClosed');
  const fogOfWar = activeEvents.some(e => e.key === 'fogOfWar');
  const stockCrash = activeEvents.some(e => e.key === 'stockCrash');
  const inflation = activeEvents.some(e => e.key === 'inflation');

  // Notify server when player leaves
  useEffect(() => {
    if (!user?.id) return;
    const sendLeave = () => {
      try {
        navigator.sendBeacon(`${BASE}/api/games/${gameCode}/leave`,
          new Blob([JSON.stringify({ userId: user.id })], { type: 'application/json' }));
      } catch (_) {}
    };
    window.addEventListener('beforeunload', sendLeave);
    return () => window.removeEventListener('beforeunload', sendLeave);
  }, [gameCode, user]);

  // Load game
  useEffect(() => {
    fetch(`${BASE}/api/games/${gameCode}`).then(r => r.json()).then(setGame).catch(() => {});
  }, [gameCode]);

  // Load questions when game is loaded
  useEffect(() => {
    if (!game) return;
    fetch(`${BASE}/api/kits/${game.kit_id}`).then(r => r.json()).then(data => {
      setQuestions(Array.isArray(data?.questions) ? data.questions : []);
    }).catch(() => {});
    // SQLite stores datetime as 'YYYY-MM-DD HH:MM:SS' (UTC) but JS parses it as
    // local time. Normalize to ISO-with-Z so it's parsed as UTC correctly.
    if (game.started_at) {
      const s = game.started_at;
      const iso = s.includes('T') ? s : s.replace(' ', 'T') + (s.endsWith('Z') ? '' : 'Z');
      gameStartedRef.current = new Date(iso).getTime();
    }
  }, [game]);

  // Game-time countdown — tick at 4Hz so the seconds change crisply on the boundary
  useEffect(() => {
    if (!game?.settings) return;
    const settings = typeof game.settings === 'string' ? JSON.parse(game.settings) : game.settings;
    const totalSec = settings.timeLimit || 600;
    const tick = () => {
      if (!gameStartedRef.current) { setGameTimeLeft(totalSec); return; }
      const elapsed = (Date.now() - gameStartedRef.current) / 1000;
      const left = Math.max(0, Math.ceil(totalSec - elapsed));
      setGameTimeLeft(prev => prev !== left ? left : prev);
      if (left === 0) handleGameOver();
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  // Reset answer state when question changes (no per-question timer in Arena)
  useEffect(() => {
    if (!questions.length) return;
    setSelected(null);
    setAnswered(false);
    setFeedback(null);
    setTimeLeft(null);
    startTimeRef.current = Date.now();
  }, [questionTick, questions]);

  const fetchState = useCallback(async () => {
    if (!user) return;
    try {
      const [stateRes, invRes, resultsRes] = await Promise.all([
        fetch(`${BASE}/api/games/${gameCode}/arena/state/${user.id}`).then(r => r.json()),
        fetch(`${BASE}/api/games/${gameCode}/arena/inventory/${user.id}`).then(r => r.json()),
        fetch(`${BASE}/api/games/${gameCode}/results`).then(r => r.json()).catch(() => null),
      ]);
      const partRes = resultsRes?.participants || [];
      if (stateRes) {
        setCombo(stateRes.combo || 0);
        setShields(stateRes.shields || 0);
        setDoubleDown(stateRes.doubleDown || 0);
        setPermBonus(stateRes.permBonus || 0);
        setScore(stateRes.score || 0);
        const newEvents = stateRes.activeEvents || [];
        if (newEvents.length > activeEvents.length && newEvents[0]) {
          setEventToast(newEvents[0]);
          setTimeout(() => setEventToast(null), 4000);
        }
        setActiveEvents(newEvents);

        // Detect new incoming attacks → trigger hit effect
        const incoming = stateRes.incomingAttacks || [];
        for (const atk of incoming) {
          if (!seenAttackIdsRef.current.has(atk.id)) {
            seenAttackIdsRef.current.add(atk.id);
            // Skip the very first poll (we don't want stale attacks to trigger)
            if (seenAttackIdsRef.current.size > incoming.length) {
              setHitEffect({ itemKey: atk.itemKey, blocked: atk.blocked });
              setTimeout(() => setHitEffect(null), 1200);
            }
          }
        }
      }
      if (invRes?.items) setInventory(invRes.items);
      if (Array.isArray(partRes)) setParticipants(partRes);
    } catch (_) {}
  }, [gameCode, user, activeEvents.length]);

  useEffect(() => {
    fetchState();
    const id = setInterval(fetchState, 2000);
    return () => clearInterval(id);
  }, [fetchState]);

  const advanceQuestion = useCallback(() => {
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
    setQuestionTick(t => t + 1);
  }, []);


  const submitAnswer = (answer) => {
    if (answered) return;
    setAnswered(true);
    const q = questions[currentQ];
    const timeTaken = (Date.now() - startTimeRef.current) / 1000;
    const correctAnswer = q.correct_answer;
    const isCorrect = answer && answer.toString().trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();

    setFeedback({ isCorrect, correct: correctAnswer });

    // Combo break screen flash for psychological sting
    if (!isCorrect && combo >= 3) {
      setComboBreakFlash({ lostStreak: combo });
      setTimeout(() => setComboBreakFlash(null), 1500);
    }

    // Floating score popup (instant, not waiting for server)
    if (isCorrect) {
      setScorePop({ delta: '+10', isCorrect: true, ts: Date.now() });
      setTimeout(() => setScorePop(null), 1100);
    } else {
      setScorePop({ delta: 'MISS', isCorrect: false, ts: Date.now() });
      setTimeout(() => setScorePop(null), 1100);
    }

    // Schedule advance IMMEDIATELY — don't wait for the server roundtrip
    advanceTimeoutRef.current = setTimeout(advanceQuestion, 800);

    // Fire the answer submission in the background
    fetch(`${BASE}/api/games/${gameCode}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, questionId: q.id, selectedAnswer: answer || '', isCorrect, timeTaken }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.arenaInfo) setCombo(data.arenaInfo.combo || 0);
        fetchState();
      })
      .catch(() => {});
  };

  const handleBuy = async (itemKey) => {
    if (isShopClosed) return;
    try {
      const res = await fetch(`${BASE}/api/games/${gameCode}/arena/buy`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, itemKey }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Purchase failed'); return; }
      fetchState();
    } catch (_) {}
  };

  const handleAttack = async (itemKey, targetUserId) => {
    try {
      await fetch(`${BASE}/api/games/${gameCode}/arena/attack`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, itemKey, targetUserId }),
      });
      setAttackTarget(null);
      setShowInventory(false);
      fetchState();
    } catch (_) {}
  };

  const handleGameOver = useCallback(() => {
    navigate(`/game/results/${gameCode}`, { state: { game, user, score } });
  }, [gameCode, navigate, game, user, score]);

  const rawArenaQ = questions[currentQ];
  // Default options for T/F questions whose options array is empty so the
  // render can't crash and bounce the host back to the home screen.
  const q = (rawArenaQ && rawArenaQ.answerType === 'true_false' && (!Array.isArray(rawArenaQ.options) || rawArenaQ.options.length === 0))
    ? { ...rawArenaQ, options: ['True', 'False'] }
    : rawArenaQ;
  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const adjustCost = (c) => {
    let v = c;
    if (stockCrash) v = Math.floor(v / 2);
    if (inflation) v = v * 3;
    return v;
  };

  const sortedPlayers = rankParticipants(participants);
  const myRank = sortedPlayers.find(p => p.user_id === user?.id)?.rank;
  const inventoryCount = inventory.reduce((sum, i) => sum + i.qty, 0);

  // Detect rank changes (psychology: loss aversion + smug victory)
  useEffect(() => {
    if (!myRank || !user?.id) return;
    if (prevRankRef.current !== null && prevRankRef.current !== myRank && participants.length > 1) {
      if (myRank < prevRankRef.current) {
        setRankChange({ type: 'gained', from: prevRankRef.current, to: myRank });
      } else {
        setRankChange({ type: 'lost', from: prevRankRef.current, to: myRank });
      }
      setTimeout(() => setRankChange(null), 2500);
    }
    prevRankRef.current = myRank;
  }, [myRank, participants.length, user?.id]);

  // Detect score-decreasing changes (got attacked by something other than direct hit)
  useEffect(() => {
    if (prevScoreRef.current !== null && score < prevScoreRef.current) {
      const lost = prevScoreRef.current - score;
      if (lost >= 5) {
        // Pop a "-X" briefly (only if not already showing a hit overlay)
        if (!hitEffect) {
          setScorePop({ delta: `-${lost}`, isCorrect: false, ts: Date.now() });
          setTimeout(() => setScorePop(null), 1100);
        }
      }
    }
    prevScoreRef.current = score;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-indigo-950 to-fuchsia-950 text-white flex flex-col relative">
      {/* Critical-time red vignette */}
      {gameTimeLeft !== null && gameTimeLeft <= 10 && gameTimeLeft > 0 && (
        <div className="fixed inset-0 pointer-events-none z-[20] animate-pulse"
          style={{ boxShadow: 'inset 0 0 200px rgba(239, 68, 68, 0.6), inset 0 0 80px rgba(239, 68, 68, 0.3)' }} />
      )}
      {/* Hit effect — flash + label */}
      {hitEffect && (() => {
        const HitIcon = hitEffect.blocked ? Shield :
          hitEffect.itemKey === 'lightning' ? Zap :
          hitEffect.itemKey === 'fireball' ? Flame :
          hitEffect.itemKey === 'ultimate' ? Sparkles :
          hitEffect.itemKey === 'mirror' ? Shield : Zap;
        return (
          <>
            <div className={`fixed inset-0 z-[60] pointer-events-none animate-pulse ${
              hitEffect.blocked ? 'bg-blue-500/30' :
              hitEffect.itemKey === 'lightning' ? 'bg-yellow-500/40' :
              hitEffect.itemKey === 'fireball' ? 'bg-red-600/40' :
              hitEffect.itemKey === 'ultimate' ? 'bg-orange-500/50' :
              hitEffect.itemKey === 'mirror' ? 'bg-cyan-500/40' :
              'bg-red-500/30'
            }`} />
            <div className="fixed inset-0 z-[61] pointer-events-none flex items-center justify-center">
              <div className="bg-black/80 backdrop-blur-sm border-2 border-white/30 rounded-2xl px-6 py-4 text-center animate-bounce flex flex-col items-center gap-2">
                <HitIcon className="w-12 h-12 text-white" strokeWidth={2.5} />
                <div className="text-white font-black text-lg">
                  {hitEffect.blocked ? 'BLOCKED!' :
                   hitEffect.itemKey === 'lightning' ? 'STRUCK!' :
                   hitEffect.itemKey === 'fireball' ? 'BURNED!' :
                   hitEffect.itemKey === 'ultimate' ? 'ULTIMATE HIT!' :
                   'HIT!'}
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* Floating score pop — appears near the score badge */}
      {scorePop && (
        <div key={scorePop.ts} className="fixed top-16 left-1/2 -translate-x-1/2 z-[55] pointer-events-none">
          <div className={`text-3xl sm:text-4xl font-black animate-bounce ${
            scorePop.isCorrect ? 'text-green-300 drop-shadow-[0_0_12px_rgba(34,197,94,0.8)]' :
            scorePop.delta === 'MISS' ? 'text-red-400 drop-shadow-[0_0_12px_rgba(239,68,68,0.8)]' :
            'text-red-400 drop-shadow-[0_0_12px_rgba(239,68,68,0.8)]'
          }`}>
            {scorePop.delta}
          </div>
        </div>
      )}

      {/* Combo break — angry red flash */}
      {comboBreakFlash && (
        <>
          <div className="fixed inset-0 z-[60] pointer-events-none bg-red-600/40 animate-pulse" />
          <div className="fixed inset-0 z-[61] pointer-events-none flex items-center justify-center">
            <div className="bg-red-600 border-4 border-red-300 rounded-2xl px-8 py-5 text-center animate-bounce shadow-2xl shadow-red-900">
              <Flame className="w-12 h-12 text-yellow-300 mx-auto mb-1" strokeWidth={2.5} />
              <div className="text-white font-black text-2xl">COMBO BROKEN</div>
              <div className="text-red-100 font-bold text-sm mt-1">Lost {comboBreakFlash.lostStreak} streak</div>
            </div>
          </div>
        </>
      )}

      {/* Rank change banner */}
      {rankChange && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[58] pointer-events-none px-5 py-2.5 rounded-2xl shadow-2xl border-2 font-black animate-bounce ${
          rankChange.type === 'gained'
            ? 'bg-gradient-to-r from-green-600 to-emerald-600 border-green-300 text-white'
            : 'bg-gradient-to-r from-red-600 to-rose-600 border-red-300 text-white'
        }`}>
          {rankChange.type === 'gained'
            ? `MOVED UP TO #${rankChange.to}`
            : `DROPPED TO #${rankChange.to}`}
        </div>
      )}

      {/* Event toast */}
      {eventToast && (
        <div className={`fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 z-50 px-4 sm:px-6 py-3 rounded-2xl shadow-2xl border-2 font-black text-center max-w-md mx-4 ${
          eventToast.info?.type === 'good' ? 'bg-green-600 border-green-400' :
          eventToast.info?.type === 'bad' ? 'bg-red-600 border-red-400' :
          'bg-yellow-600 border-yellow-400'
        }`}>
          <div className="text-sm sm:text-base">{eventToast.info?.name}</div>
          <div className="text-xs sm:text-sm font-normal opacity-90 mt-0.5">{eventToast.info?.desc}</div>
        </div>
      )}

      {/* Header / Nav */}
      <header className="sticky top-0 z-30 bg-gradient-to-r from-purple-950/95 via-indigo-950/95 to-fuchsia-950/95 backdrop-blur-xl border-b border-white/5 shadow-lg shadow-purple-950/50 px-3 sm:px-4 py-3 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Left: avatar + name + rank */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative flex-shrink-0">
              <AvatarPreview skinId={equippedSkinId} initial={user?.name?.[0] || '?'} size={36} isPlus={isBlazesPlusCached()} />
              {myRank && myRank <= 3 && (
                <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-purple-950 ${
                  myRank === 1 ? 'bg-yellow-400 text-yellow-950' :
                  myRank === 2 ? 'bg-gray-300 text-gray-800' :
                  'bg-orange-400 text-orange-950'
                }`}>{myRank}</div>
              )}
            </div>
            <div className="hidden sm:flex flex-col min-w-0">
              <span className="font-black text-sm truncate leading-tight">{user?.name}</span>
              <span className="text-[10px] font-bold text-purple-300/80 leading-tight">{myRank ? `Rank #${myRank}` : 'Arena'}</span>
            </div>
          </div>

          {/* Center: score + timer */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-gradient-to-br from-yellow-500/25 to-orange-500/15 border border-yellow-400/30 rounded-xl px-3 sm:px-4 py-2 shadow-inner shadow-yellow-500/10">
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-300" strokeWidth={2.5} />
              <span className="font-black text-base sm:text-lg tabular-nums leading-none">{fogOfWar ? '???' : score}</span>
            </div>
            {gameTimeLeft !== null && (
              <div className={`flex items-center gap-2 border rounded-xl px-3 sm:px-4 py-2 transition-all ${
                gameTimeLeft <= 10 ? 'bg-red-500/30 border-red-400/60 animate-pulse shadow-lg shadow-red-500/30' :
                gameTimeLeft < 60 ? 'bg-orange-500/20 border-orange-400/40' :
                'bg-white/5 border-white/15'
              }`}>
                <Clock className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2.5} />
                <span className="font-black text-base sm:text-lg tabular-nums leading-none">{formatTime(gameTimeLeft)}</span>
              </div>
            )}
          </div>

          {/* Right: nav buttons */}
          <div className="flex items-center gap-1">
            <button onClick={() => setShowHelp(true)}
              className="p-2.5 bg-white/5 hover:bg-white/15 rounded-xl transition-colors border border-white/5"
              title="How to play">
              <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button onClick={() => setShowLeaderboard(true)}
              className="p-2.5 bg-white/5 hover:bg-white/15 rounded-xl transition-colors border border-white/5"
              title="Leaderboard">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button onClick={() => setShowInventory(true)}
              className="relative p-2.5 bg-white/5 hover:bg-white/15 rounded-xl transition-colors border border-white/5"
              title="Inventory">
              <Backpack className="w-4 h-4 sm:w-5 sm:h-5" />
              {inventoryCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-purple-950">{inventoryCount}</span>
              )}
            </button>
            <button onClick={() => setShowShop(true)} disabled={isShopClosed}
              className={`p-2.5 rounded-xl transition-all border ${
                isShopClosed ? 'bg-gray-800/50 text-gray-500 cursor-not-allowed border-white/5' : 'bg-gradient-to-br from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white border-purple-400/40 shadow-lg shadow-purple-500/30'
              }`} title="Shop">
              <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Combo banner */}
        {combo >= 2 && (
          <div className="max-w-7xl mx-auto mt-2 text-center">
            <span className="inline-flex items-center gap-1.5 bg-orange-500/20 border border-orange-400/40 rounded-full px-3 py-1 text-xs font-black text-orange-200">
              <Flame className="w-3.5 h-3.5" /> {combo} streak
              {combo >= 10 ? ' — ULTIMATE STRIKE earned!' : combo >= 7 ? ' — +5 score per answer (perm)' : combo >= 5 ? ' — Free attack earned!' : combo >= 3 ? ' — +5 bonus score' : ''}
            </span>
          </div>
        )}

        {/* Status badges */}
        {(shields > 0 || doubleDown > 0 || permBonus > 0) && (
          <div className="max-w-7xl mx-auto mt-2 flex flex-wrap items-center justify-center gap-1.5">
            {shields > 0 && <span className="inline-flex items-center gap-1 text-[10px] font-black bg-blue-500/30 border border-blue-400/40 rounded-full px-2 py-0.5"><Shield className="w-3 h-3" /> {shields} shield</span>}
            {doubleDown > 0 && <span className="text-[10px] font-black bg-purple-500/30 border border-purple-400/40 rounded-full px-2 py-0.5">2x next answer</span>}
            {permBonus > 0 && <span className="text-[10px] font-black bg-green-500/30 border border-green-400/40 rounded-full px-2 py-0.5">+{permBonus} bonus</span>}
          </div>
        )}
      </header>

      {/* Question — takes the full remaining space */}
      <main className="flex-1 flex flex-col px-3 sm:px-6 py-4 sm:py-6">
        {!q ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-white/50">Loading questions...</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col max-w-5xl w-full mx-auto">
            {/* Question number badge */}
            <div className="flex items-center justify-center mb-4 sm:mb-6">
              <span className="inline-flex items-center gap-1.5 bg-purple-500/20 border border-purple-400/30 text-purple-200 text-xs font-black uppercase tracking-wider rounded-full px-3 py-1">
                Question {questionTick + 1}
              </span>
            </div>

            {/* Question card — fills the space */}
            <div className="flex-1 bg-gradient-to-br from-white/[0.08] to-white/[0.03] backdrop-blur-sm border border-white/10 rounded-3xl p-6 sm:p-8 md:p-10 flex flex-col shadow-2xl shadow-purple-950/30">
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-center mb-6 sm:mb-8 leading-tight whitespace-pre-line bg-gradient-to-br from-white to-purple-100 bg-clip-text text-transparent">{q.question_text}</h2>

              {q.image_url && (
                <div className="flex justify-center mb-6 sm:mb-8">
                  <img src={q.image_url} alt="" className="max-h-48 sm:max-h-64 rounded-2xl" />
                </div>
              )}

              {/* Answers — render based on question type */}
              <div className="flex-1 flex flex-col">
                {(() => {
                  const type = q.answer_type || 'multiple_choice';
                  const colors = ['from-red-600 to-rose-600', 'from-blue-600 to-cyan-600', 'from-yellow-600 to-orange-600', 'from-green-600 to-emerald-600'];

                  // True/False — render two big buttons
                  if (type === 'true_false') {
                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 content-center flex-1">
                        {['True', 'False'].map((value, i) => {
                          const isSelected = selected === value;
                          const isCorrect = feedback && String(q.correct_answer).toLowerCase() === value.toLowerCase();
                          const isWrong = feedback && isSelected && !feedback.isCorrect;
                          return (
                            <button key={value} onClick={() => { if (!answered) { setSelected(value); submitAnswer(value); } }}
                              disabled={answered}
                              className={`p-5 sm:p-6 rounded-2xl font-bold transition-all border-2 min-h-[80px] sm:min-h-[100px] flex items-center justify-center text-2xl ${
                                isCorrect ? 'bg-green-600 border-green-400 scale-105' :
                                isWrong ? 'bg-red-600 border-red-400' :
                                isSelected ? `bg-gradient-to-br ${colors[i]} border-white/50` :
                                `bg-gradient-to-br ${colors[i]} border-transparent hover:scale-[1.02] hover:border-white/30`
                              } disabled:cursor-not-allowed`}>
                              {value}
                            </button>
                          );
                        })}
                      </div>
                    );
                  }

                  // Short answer / fill blank — text input
                  if (type === 'short_answer' || type === 'fill_blank' || type === 'math_equation') {
                    return (
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        if (answered) return;
                        const val = e.target.answer.value.trim();
                        if (!val) return;
                        setSelected(val);
                        submitAnswer(val);
                      }} className="flex flex-col gap-4 max-w-xl mx-auto w-full mt-8">
                        <input name="answer" type="text" disabled={answered}
                          placeholder="Type your answer..."
                          className="w-full px-5 py-4 bg-white/10 border-2 border-white/20 rounded-2xl text-white placeholder-white/40 text-lg focus:border-purple-400 focus:outline-none disabled:opacity-60"
                          autoFocus />
                        <button type="submit" disabled={answered}
                          className="w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-2xl font-black disabled:opacity-50">
                          Submit
                        </button>
                      </form>
                    );
                  }

                  // Multiple choice / multi_select / audio — render A/B/C/D options
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 content-center flex-1">
                      {['option_a', 'option_b', 'option_c', 'option_d'].map((key, i) => {
                        const opt = q[key];
                        if (!opt) return null;
                        const letter = ['A', 'B', 'C', 'D'][i];
                        const isMulti = type === 'multi_select';
                        const isSelected = isMulti ? (selected || '').includes(letter) : selected === letter;
                        const isCorrectLetter = isMulti
                          ? String(q.correct_answer || '').toUpperCase().includes(letter)
                          : String(q.correct_answer || '').toUpperCase() === letter;
                        const isCorrect = feedback && isCorrectLetter;
                        const isWrong = feedback && isSelected && !isCorrectLetter;
                        return (
                          <button key={key}
                            onClick={() => {
                              if (answered) return;
                              if (isMulti) {
                                const cur = selected || '';
                                setSelected(cur.includes(letter) ? cur.replace(letter, '') : cur + letter);
                              } else {
                                setSelected(letter);
                                submitAnswer(letter);
                              }
                            }}
                            disabled={answered}
                            className={`p-5 sm:p-6 rounded-2xl text-left font-bold transition-all border-2 min-h-[80px] sm:min-h-[100px] flex items-center gap-3 ${
                              isCorrect ? 'bg-green-600 border-green-400 scale-105' :
                              isWrong ? 'bg-red-600 border-red-400' :
                              isSelected ? `bg-gradient-to-br ${colors[i]} border-white/50` :
                              `bg-gradient-to-br ${colors[i]} border-transparent hover:scale-[1.02] hover:border-white/30`
                            } disabled:cursor-not-allowed`}>
                            <span className="text-xl sm:text-2xl font-black opacity-70 flex-shrink-0">{letter}</span>
                            <span className="text-base sm:text-lg flex-1">{opt}</span>
                          </button>
                        );
                      })}
                      {type === 'multi_select' && !answered && (
                        <button onClick={() => submitAnswer(selected || '')}
                          className="sm:col-span-2 py-3 bg-purple-600 hover:bg-purple-500 rounded-2xl font-black">
                          Submit Selection
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>

              {feedback && (
                <div className="mt-4 sm:mt-6 text-center">
                  <div className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-black text-base sm:text-lg ${feedback.isCorrect ? 'bg-green-600' : 'bg-red-600'}`}>
                    {feedback.isCorrect ? 'Correct!' : feedback.timedOut ? "Time's up!" : `Answer: ${feedback.correct}`}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Leaderboard modal */}
      {showLeaderboard && (
        <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center p-4" onClick={() => setShowLeaderboard(false)}>
          <div className="bg-purple-950 border border-white/20 rounded-3xl max-w-md w-full max-h-[85vh] overflow-y-auto p-5 sm:p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-black flex items-center gap-2"><BarChart3 className="w-5 h-5" /> Leaderboard</h2>
              <button onClick={() => setShowLeaderboard(false)} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-2">
              {sortedPlayers.length === 0 && <p className="text-white/50 text-center py-8">No players yet</p>}
              {sortedPlayers.map((p) => (
                <div key={p.user_id} className={`flex items-center justify-between px-4 py-3 rounded-xl ${
                  p.user_id === user?.id ? 'bg-purple-600/40 border border-purple-400/50' : 'bg-white/5 border border-white/10'
                }`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`font-black w-7 text-center ${p.rank === 1 ? 'text-yellow-300' : p.rank === 2 ? 'text-gray-300' : p.rank === 3 ? 'text-orange-400' : 'text-white/40'}`}>{p.rank}</span>
                    {p.rank === 1 && <Crown className="w-4 h-4 text-yellow-300" />}
                    <span className="font-bold truncate">{p.player_name || p.name}</span>
                    {p.user_id === user?.id && <span className="text-[10px] font-black bg-purple-500/40 px-1.5 py-0.5 rounded-full">You</span>}
                  </div>
                  <span className="font-black text-yellow-300">{fogOfWar && p.user_id !== user?.id ? '???' : (p.score || 0)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Inventory modal */}
      {showInventory && (
        <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center p-4" onClick={() => setShowInventory(false)}>
          <div className="bg-purple-950 border border-white/20 rounded-3xl max-w-md w-full max-h-[85vh] overflow-y-auto p-5 sm:p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-black flex items-center gap-2"><Backpack className="w-5 h-5" /> Inventory</h2>
              <button onClick={() => setShowInventory(false)} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            {inventory.length === 0 ? (
              <p className="text-white/50 text-center py-8">Empty — buy items from the shop!</p>
            ) : (
              <div className="space-y-2">
                {inventory.map((inv) => {
                  const item = inv.item_key === 'ultimate'
                    ? ULTIMATE_ITEM
                    : ITEMS.find(i => i.key === inv.item_key);
                  if (!item) return null;
                  const Icon = item.icon;
                  const needsTarget = ['lightning', 'fireball', 'mirror', 'ultimate'].includes(inv.item_key);
                  const isUltimate = inv.item_key === 'ultimate';
                  return (
                    <button key={inv.item_key}
                      onClick={() => needsTarget ? setAttackTarget({ itemKey: inv.item_key, multi: inv.item_key === 'fireball' }) : null}
                      disabled={!needsTarget}
                      className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-colors ${
                        isUltimate ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-400/60 hover:from-yellow-500/30 hover:to-orange-500/30 cursor-pointer' :
                        needsTarget ? 'bg-white/5 hover:bg-white/15 border-white/20 cursor-pointer' : 'bg-white/5 border-white/10 cursor-default'
                      }`}>
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isUltimate ? 'bg-yellow-500/30' : 'bg-white/10'}`}>
                        <Icon className={`w-5 h-5 ${isUltimate ? 'text-yellow-200' : ''}`} />
                      </div>
                      <div className="flex-1 text-left">
                        <div className={`font-black text-sm ${isUltimate ? 'text-yellow-200' : ''}`}>{item.name}</div>
                        <div className="text-xs text-white/60">{item.desc}</div>
                      </div>
                      <span className={`font-black ${isUltimate ? 'text-yellow-200' : 'text-yellow-300'}`}>×{inv.qty}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Shop modal */}
      {showShop && (
        <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center p-4" onClick={() => setShowShop(false)}>
          <div className="bg-purple-950 border border-white/20 rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-5 sm:p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2"><ShoppingBag className="w-6 h-6" /> Shop</h2>
              <button onClick={() => setShowShop(false)} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="text-center mb-4">
              <p className="text-xs text-white/60 mb-1">Your Score</p>
              <div className="text-yellow-300 font-black text-2xl flex items-center justify-center gap-1.5">
                <Trophy className="w-5 h-5" /> {score}
              </div>
              <p className="text-[10px] text-white/40 mt-1">Items cost score — spend wisely</p>
            </div>
            {(stockCrash || inflation) && (
              <p className={`text-center text-sm font-bold mb-4 ${stockCrash ? 'text-green-300' : 'text-red-300'}`}>
                {stockCrash ? 'Stock Crash — 50% off!' : 'Inflation — prices 3x!'}
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ITEMS.map(item => {
                const Icon = item.icon;
                const cost = adjustCost(item.cost);
                const canAfford = score >= cost;
                return (
                  <button key={item.key} onClick={() => handleBuy(item.key)} disabled={!canAfford}
                    className={`text-left p-4 rounded-2xl border-2 transition-all ${canAfford ? 'bg-white/5 border-white/20 hover:bg-white/15 hover:border-purple-400' : 'bg-white/5 border-white/5 opacity-50 cursor-not-allowed'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Icon className="w-5 h-5" />
                        <span className="font-black text-sm">{item.name}</span>
                      </div>
                      <span className={`text-sm font-black flex items-center gap-1 ${stockCrash ? 'text-green-300' : inflation ? 'text-red-300' : 'text-yellow-300'}`}>
                        <Trophy className="w-3.5 h-3.5" /> {cost}
                      </span>
                    </div>
                    <p className="text-xs text-white/60">{item.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Help modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center p-4" onClick={() => setShowHelp(false)}>
          <div className="bg-purple-950 border border-white/20 rounded-3xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-5 sm:p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-black flex items-center gap-2"><HelpCircle className="w-5 h-5" /> How to Play</h2>
              <button onClick={() => setShowHelp(false)} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4 text-sm">
              <div>
                <h3 className="font-black text-yellow-300 mb-1 flex items-center gap-1.5"><Trophy className="w-4 h-4" /> Score = your only currency</h3>
                <p className="text-white/70">Earn 10 score per correct answer. Spend score to buy items. The leader is whoever has the most score.</p>
              </div>
              <div>
                <h3 className="font-black text-orange-300 mb-1 flex items-center gap-1.5"><Flame className="w-4 h-4" /> Build a combo</h3>
                <ul className="text-white/70 space-y-0.5 ml-1">
                  <li>• 3 correct in a row: <span className="text-white">+5 score</span></li>
                  <li>• 5 in a row: <span className="text-white">free attack</span></li>
                  <li>• 7 in a row: <span className="text-white">+5 per future answer</span></li>
                  <li>• 10 in a row: <span className="text-yellow-200">Ultimate Strike (-30 to one player, ignores shields)</span></li>
                </ul>
              </div>
              <div>
                <h3 className="font-black text-purple-300 mb-1 flex items-center gap-1.5"><ShoppingBag className="w-4 h-4" /> Shop items</h3>
                <ul className="text-white/70 space-y-0.5 ml-1">
                  <li>• <span className="text-white">Lightning</span> (15) — pick a target, deal -25</li>
                  <li>• <span className="text-white">Fireball</span> (30) — -15 to 3 random players</li>
                  <li>• <span className="text-white">Shield</span> (15) — block one attack against you</li>
                  <li>• <span className="text-white">Mirror</span> (30) — reflect next attack back</li>
                  <li>• <span className="text-white">Double Down</span> (20) — next correct = 20</li>
                </ul>
              </div>
              <div>
                <h3 className="font-black text-pink-300 mb-1 flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> World Events</h3>
                <p className="text-white/70">Random events fire every 50-70 seconds. Watch for the toast banner at the top.</p>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-400/30 rounded-xl p-3 mt-3 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-yellow-300 mt-0.5 flex-shrink-0" />
                <p className="text-yellow-200 text-xs font-bold">Tip: Spending lowers your rank temporarily. Attack the leader to close the gap, defend with shields when you're in front.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attack target picker */}
      {attackTarget && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setAttackTarget(null)}>
          <div className="bg-purple-950 border border-white/20 rounded-3xl max-w-md w-full max-h-[80vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black flex items-center gap-2"><Target className="w-5 h-5" /> Pick a target</h2>
              <button onClick={() => setAttackTarget(null)} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            {attackTarget.multi ? (
              <>
                <p className="text-sm text-white/70 mb-3">This attack hits 3 random opponents.</p>
                <button onClick={() => handleAttack(attackTarget.itemKey, null)}
                  className="w-full bg-red-600 hover:bg-red-500 py-3 rounded-xl font-black">Launch!</button>
              </>
            ) : (
              <div className="space-y-2">
                {participants.filter(p => p.user_id !== user?.id).length === 0 && (
                  <p className="text-white/50 text-center py-8">No other players yet</p>
                )}
                {participants.filter(p => p.user_id !== user?.id).map(p => (
                  <button key={p.user_id} onClick={() => handleAttack(attackTarget.itemKey, p.user_id)}
                    className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/15 border border-white/10 rounded-xl transition-colors">
                    <span className="font-bold text-sm">{p.player_name || p.name}</span>
                    <span className="text-xs text-white/50">{p.score} pts</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
