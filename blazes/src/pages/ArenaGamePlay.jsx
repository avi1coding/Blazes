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
  const seenAttackIdsRef = useRef(new Set());

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
    if (game.started_at) gameStartedRef.current = new Date(game.started_at).getTime();
  }, [game]);

  // Game-time countdown
  useEffect(() => {
    if (!game?.settings) return;
    const settings = typeof game.settings === 'string' ? JSON.parse(game.settings) : game.settings;
    const totalSec = settings.timeLimit || 600;
    const tick = () => {
      if (!gameStartedRef.current) { setGameTimeLeft(totalSec); return; }
      const elapsed = (Date.now() - gameStartedRef.current) / 1000;
      const left = Math.max(0, Math.round(totalSec - elapsed));
      setGameTimeLeft(left);
      if (left === 0) handleGameOver();
    };
    tick();
    const id = setInterval(tick, 1000);
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


  const submitAnswer = async (answer) => {
    if (answered) return;
    setAnswered(true);
    const q = questions[currentQ];
    const timeTaken = (Date.now() - startTimeRef.current) / 1000;
    const correctAnswer = q.correct_answer;
    const isCorrect = answer && answer.toString().trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();

    setFeedback({ isCorrect, correct: correctAnswer });

    try {
      const res = await fetch(`${BASE}/api/games/${gameCode}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, questionId: q.id, selectedAnswer: answer || '', isCorrect, timeTaken }),
      });
      const data = await res.json();
      if (data.arenaInfo) setCombo(data.arenaInfo.combo || 0);
    } catch (_) {}

    advanceTimeoutRef.current = setTimeout(advanceQuestion, 800);
    fetchState();
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

  const q = questions[currentQ];
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-indigo-950 to-fuchsia-950 text-white flex flex-col">
      {/* Hit effect — flash + shake + label */}
      {hitEffect && (
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
            <div className="bg-black/80 backdrop-blur-sm border-2 border-white/30 rounded-2xl px-6 py-4 text-center animate-bounce">
              <div className="text-4xl mb-1">
                {hitEffect.blocked ? '🛡️' :
                 hitEffect.itemKey === 'lightning' ? '⚡' :
                 hitEffect.itemKey === 'fireball' ? '🔥' :
                 hitEffect.itemKey === 'ultimate' ? '💥' :
                 hitEffect.itemKey === 'mirror' ? '🪞' : '💥'}
              </div>
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
      <header className="sticky top-0 z-30 bg-purple-900/90 backdrop-blur-md border-b border-white/10 px-3 sm:px-4 py-2.5 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          {/* Left: avatar + name */}
          <div className="flex items-center gap-2 min-w-0">
            <AvatarPreview skinId="default" initial={user?.name?.[0] || '?'} size={32} isPlus={isBlazesPlusCached()} />
            <div className="hidden sm:flex flex-col min-w-0">
              <span className="font-bold text-sm truncate">{user?.name}</span>
              {myRank && <span className="text-[10px] font-bold text-purple-300">Rank #{myRank}</span>}
            </div>
          </div>

          {/* Center: stats */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1.5 bg-yellow-500/20 border border-yellow-400/40 rounded-lg px-3 py-1.5">
              <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-300" />
              <span className="font-black text-sm sm:text-base">{fogOfWar ? '???' : score}</span>
            </div>
            {gameTimeLeft !== null && (
              <div className={`flex items-center gap-1 border rounded-lg px-2 py-1.5 ${gameTimeLeft < 30 ? 'bg-red-500/20 border-red-400/40 animate-pulse' : 'bg-white/10 border-white/20'}`}>
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="font-black text-xs sm:text-sm">{formatTime(gameTimeLeft)}</span>
              </div>
            )}
          </div>

          {/* Right: nav buttons */}
          <div className="flex items-center gap-1.5">
            <button onClick={() => setShowHelp(true)}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              title="How to play">
              <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button onClick={() => setShowLeaderboard(true)}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              title="Leaderboard">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button onClick={() => setShowInventory(true)}
              className="relative p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              title="Inventory">
              <Backpack className="w-4 h-4 sm:w-5 sm:h-5" />
              {inventoryCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">{inventoryCount}</span>
              )}
            </button>
            <button onClick={() => setShowShop(true)} disabled={isShopClosed}
              className={`p-2 rounded-lg transition-all ${
                isShopClosed ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500 text-white'
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
            {shields > 0 && <span className="text-[10px] font-black bg-blue-500/30 border border-blue-400/40 rounded-full px-2 py-0.5">🛡 {shields} shield</span>}
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
            {/* Question number */}
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <span className="text-sm font-bold text-purple-300">Question {questionTick + 1}</span>
            </div>

            {/* Question card — fills the space */}
            <div className="flex-1 bg-white/[0.07] backdrop-blur-sm border border-white/10 rounded-3xl p-5 sm:p-8 md:p-10 flex flex-col">
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-center mb-6 sm:mb-8 leading-tight whitespace-pre-line">{q.question_text}</h2>

              {q.image_url && (
                <div className="flex justify-center mb-6 sm:mb-8">
                  <img src={q.image_url} alt="" className="max-h-48 sm:max-h-64 rounded-2xl" />
                </div>
              )}

              {/* Answers — fill remaining space */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 content-center">
                {['option_a', 'option_b', 'option_c', 'option_d'].map((key, i) => {
                  const opt = q[key];
                  if (!opt) return null;
                  const letter = ['A', 'B', 'C', 'D'][i];
                  const isSelected = selected === letter;
                  const isCorrect = feedback && letter === q.correct_answer;
                  const isWrong = feedback && isSelected && !feedback.isCorrect;
                  const colors = ['from-red-600 to-rose-600', 'from-blue-600 to-cyan-600', 'from-yellow-600 to-orange-600', 'from-green-600 to-emerald-600'];
                  return (
                    <button key={key} onClick={() => { if (!answered) { setSelected(letter); submitAnswer(letter); } }}
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
              </div>

              {feedback && (
                <div className="mt-4 sm:mt-6 text-center">
                  <div className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-black text-base sm:text-lg ${feedback.isCorrect ? 'bg-green-600' : 'bg-red-600'}`}>
                    {feedback.isCorrect ? '✓ Correct!' : feedback.timedOut ? '⏱ Time\'s up!' : `✗ Answer: ${feedback.correct}`}
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
                {stockCrash ? '🎉 Stock Crash — 50% off!' : '💸 Inflation — prices 3x!'}
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
              <div className="bg-yellow-500/10 border border-yellow-400/30 rounded-xl p-3 mt-3">
                <p className="text-yellow-200 text-xs font-bold">💡 Tip: Spending lowers your rank temporarily. Attack the leader to close the gap, defend with shields when you're in front.</p>
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
