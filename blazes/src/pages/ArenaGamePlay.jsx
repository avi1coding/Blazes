import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Coins, Shield, Zap, Flame, ShoppingBag, Sparkles, Clock, Trophy, X, Crown, Target } from 'lucide-react';
import { AvatarPreview, isBlazesPlusCached } from './SkinsPage';
import { rankParticipants } from '../utils/ranking';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

const ITEMS = [
  { key: 'lightning',  name: 'Lightning Strike', cost: 50,  desc: '-30 to one player',         icon: Zap,   color: 'yellow' },
  { key: 'fireball',   name: 'Fireball',         cost: 100, desc: '-50 to 3 random players',   icon: Flame, color: 'red' },
  { key: 'shield',     name: 'Shield',           cost: 75,  desc: 'Block next attack',         icon: Shield,color: 'blue' },
  { key: 'mirror',     name: 'Mirror',           cost: 150, desc: 'Reflect next attack',       icon: Shield,color: 'cyan' },
  { key: 'doubleDown', name: 'Double Down',      cost: 100, desc: 'Next correct = 2x points',  icon: Sparkles, color: 'purple' },
  { key: 'scoreBoost', name: 'Score Boost',      cost: 200, desc: '+50 score instantly',       icon: Trophy,color: 'green' },
];

export default function ArenaGamePlay({ gameCode: propCode, user: propUser }) {
  const params = useParams();
  const gameCode = propCode || params.gameCode;
  const navigate = useNavigate();
  const [user] = useState(() => propUser || JSON.parse(localStorage.getItem('user') || 'null'));

  const [game, setGame] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [gameTimeLeft, setGameTimeLeft] = useState(null);

  const [coins, setCoins] = useState(0);
  const [combo, setCombo] = useState(0);
  const [score, setScore] = useState(0);
  const [shields, setShields] = useState(0);
  const [doubleDown, setDoubleDown] = useState(0);
  const [permBonus, setPermBonus] = useState(0);
  const [inventory, setInventory] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [activeEvents, setActiveEvents] = useState([]);
  const [eventToast, setEventToast] = useState(null);

  const [showShop, setShowShop] = useState(false);
  const [attackTarget, setAttackTarget] = useState(null); // { itemKey }

  const startTimeRef = useRef(Date.now());
  const gameStartedRef = useRef(null);

  const isShopClosed = activeEvents.some(e => e.key === 'shopClosed');

  // Load game + questions
  useEffect(() => {
    fetch(`${BASE}/api/games/${gameCode}`).then(r => r.json()).then(setGame).catch(() => {});
  }, [gameCode]);

  useEffect(() => {
    if (!game) return;
    fetch(`${BASE}/api/kits/${game.kit_id}`).then(r => r.json()).then(data => {
      setQuestions(Array.isArray(data?.questions) ? data.questions : []);
    }).catch(() => {});
    if (game.started_at) gameStartedRef.current = new Date(game.started_at).getTime();
  }, [game]);

  // Game time-left counter
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
  }, [game]);

  // Per-question timer
  useEffect(() => {
    if (!questions[currentQ]) return;
    const q = questions[currentQ];
    let limit = q.time_limit || 30;
    // Time crunch event halves it
    const tc = activeEvents.find(e => e.key === 'timeCrunch');
    if (tc) limit = Math.max(5, Math.floor(limit / 2));

    setTimeLeft(limit);
    setSelected(null);
    setAnswered(false);
    setFeedback(null);
    startTimeRef.current = Date.now();

    const id = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(id); handleTimeUp(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQ, questions]);

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
        setCoins(stateRes.coins || 0);
        setCombo(stateRes.combo || 0);
        setShields(stateRes.shields || 0);
        setDoubleDown(stateRes.doubleDown || 0);
        setPermBonus(stateRes.permBonus || 0);
        setScore(stateRes.score || 0);
        const newEvents = stateRes.activeEvents || [];
        // Show toast for new events
        if (newEvents.length > activeEvents.length) {
          const newest = newEvents[0];
          setEventToast(newest);
          setTimeout(() => setEventToast(null), 4000);
        }
        setActiveEvents(newEvents);
      }
      if (invRes?.items) setInventory(invRes.items);
      if (Array.isArray(partRes)) setParticipants(partRes);
    } catch (_) {}
  }, [gameCode, user, activeEvents.length]);

  // Poll state every 2s
  useEffect(() => {
    fetchState();
    const id = setInterval(fetchState, 2000);
    return () => clearInterval(id);
  }, [fetchState]);

  const handleTimeUp = () => {
    if (answered) return;
    submitAnswer(null);
  };

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
      if (data.arenaInfo) {
        setCombo(data.arenaInfo.combo || 0);
      }
    } catch (_) {}

    setTimeout(() => {
      if (currentQ + 1 < questions.length) {
        setCurrentQ(currentQ + 1);
      } else {
        // Loop questions if time hasn't run out
        setCurrentQ(0);
      }
    }, 2000);
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
      fetchState();
    } catch (_) {}
  };

  const handleGameOver = useCallback(() => {
    navigate(`/game/results/${gameCode}`, { state: { game, user, score } });
  }, [gameCode, navigate, game, user, score]);

  const q = questions[currentQ];
  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // Apply pricing modifiers to display
  const stockCrash = activeEvents.some(e => e.key === 'stockCrash');
  const inflation = activeEvents.some(e => e.key === 'inflation');
  const adjustCost = (c) => {
    let v = c;
    if (stockCrash) v = Math.floor(v / 2);
    if (inflation) v = v * 3;
    return v;
  };

  // Score visibility (Fog of War)
  const fogOfWar = activeEvents.some(e => e.key === 'fogOfWar');

  const sortedPlayers = rankParticipants(participants);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-indigo-950 to-purple-950 text-white">
      {/* Event toast */}
      {eventToast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 sm:px-6 py-3 rounded-2xl shadow-2xl border-2 font-black text-center max-w-md ${
          eventToast.info?.type === 'good' ? 'bg-green-600 border-green-400' :
          eventToast.info?.type === 'bad' ? 'bg-red-600 border-red-400' :
          'bg-yellow-600 border-yellow-400'
        }`}>
          <div className="text-sm sm:text-base">{eventToast.info?.name}</div>
          <div className="text-xs sm:text-sm font-normal opacity-90 mt-0.5">{eventToast.info?.desc}</div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 bg-purple-900/80 backdrop-blur-md border-b border-white/10 px-3 sm:px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <AvatarPreview skinId="default" initial={user?.name?.[0] || '?'} size={32} isPlus={isBlazesPlusCached()} />
            <span className="font-bold text-sm sm:text-base truncate">{user?.name}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 bg-yellow-500/20 border border-yellow-400/40 rounded-lg px-2.5 py-1.5">
              <Coins className="w-4 h-4 text-yellow-300" />
              <span className="font-black text-sm">{coins}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5">
              <Trophy className="w-4 h-4 text-yellow-300" />
              <span className="font-black text-sm">{fogOfWar ? '???' : score}</span>
            </div>
            {gameTimeLeft !== null && (
              <div className="flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5">
                <Clock className="w-4 h-4" />
                <span className="font-black text-sm">{formatTime(gameTimeLeft)}</span>
              </div>
            )}
            <button onClick={() => setShowShop(true)} disabled={isShopClosed}
              className={`px-3 py-1.5 rounded-lg font-bold text-sm flex items-center gap-1.5 transition-all ${
                isShopClosed ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500 text-white'
              }`}>
              <ShoppingBag className="w-4 h-4" /> Shop
            </button>
          </div>
        </div>
        {combo >= 2 && (
          <div className="max-w-6xl mx-auto mt-2 text-center">
            <span className="inline-flex items-center gap-1.5 bg-orange-500/20 border border-orange-400/40 rounded-full px-3 py-1 text-xs font-black text-orange-200">
              <Flame className="w-3.5 h-3.5" /> {combo} streak
              {combo >= 10 ? ' — ULTIMATE!' : combo >= 7 ? ' — +10 bonus per answer' : combo >= 5 ? ' — Free item next' : combo >= 3 ? ' — +50 coin bonus' : ''}
            </span>
          </div>
        )}
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {!q ? (
          <div className="text-center py-16">
            <p className="text-white/70">Loading questions...</p>
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-3xl p-4 sm:p-6 md:p-8 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-purple-300">Question {currentQ + 1}</span>
              {timeLeft !== null && (
                <span className={`text-sm font-black ${timeLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-white/70'}`}>
                  {timeLeft}s
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl md:text-3xl font-black mb-6">{q.question_text}</h2>

            {q.image_url && <img src={q.image_url} alt="" className="max-h-48 sm:max-h-64 mx-auto rounded-xl mb-6" />}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {['option_a', 'option_b', 'option_c', 'option_d'].map((key, i) => {
                const opt = q[key];
                if (!opt) return null;
                const letter = ['A', 'B', 'C', 'D'][i];
                const isSelected = selected === letter;
                const isCorrect = feedback && letter === q.correct_answer;
                const isWrong = feedback && isSelected && !feedback.isCorrect;
                return (
                  <button key={key} onClick={() => { if (!answered) { setSelected(letter); submitAnswer(letter); } }}
                    disabled={answered}
                    className={`p-4 rounded-xl text-left font-bold transition-all border-2 ${
                      isCorrect ? 'bg-green-600 border-green-400' :
                      isWrong ? 'bg-red-600 border-red-400' :
                      isSelected ? 'bg-purple-600 border-purple-400' :
                      'bg-white/5 border-white/10 hover:bg-white/10 hover:border-purple-400'
                    } disabled:cursor-not-allowed`}>
                    <span className="text-purple-300 mr-2">{letter}.</span>{opt}
                  </button>
                );
              })}
            </div>

            {feedback && (
              <div className="mt-4 text-center font-black text-lg">
                {feedback.isCorrect ? '✓ Correct!' : `✗ Answer: ${feedback.correct}`}
              </div>
            )}
          </div>
        )}

        {/* Quick stats / leaderboard */}
        {participants.length > 0 && !fogOfWar && (
          <div className="mt-6 bg-white/5 border border-white/10 rounded-2xl p-4">
            <h3 className="text-sm font-black text-purple-300 mb-3">Leaderboard</h3>
            <div className="space-y-1">
              {sortedPlayers.slice(0, 10).map((p) => (
                <div key={p.user_id} className={`flex items-center justify-between px-3 py-1.5 rounded-lg ${p.user_id === user?.id ? 'bg-purple-600/30 border border-purple-400/40' : 'bg-white/5'}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`font-black w-6 text-center text-xs ${p.rank === 1 ? 'text-yellow-300' : p.rank === 2 ? 'text-gray-300' : p.rank === 3 ? 'text-orange-400' : 'text-white/40'}`}>{p.rank}</span>
                    {p.rank === 1 && <Crown className="w-3.5 h-3.5 text-yellow-300" />}
                    <span className="text-sm font-bold truncate">{p.player_name || p.name}</span>
                  </div>
                  <span className="font-black text-sm">{p.score || 0}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inventory */}
        {inventory.length > 0 && (
          <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl p-4">
            <h3 className="text-sm font-black text-purple-300 mb-3">Your Items</h3>
            <div className="flex flex-wrap gap-2">
              {inventory.map((inv) => {
                const item = ITEMS.find(i => i.key === inv.item_key);
                if (!item) return null;
                const Icon = item.icon;
                const needsTarget = ['lightning', 'fireball', 'mirror'].includes(inv.item_key);
                return (
                  <button key={inv.item_key}
                    onClick={() => needsTarget ? setAttackTarget({ itemKey: inv.item_key, multi: inv.item_key === 'fireball' }) : null}
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg px-3 py-2 transition-colors">
                    <Icon className="w-4 h-4" />
                    <span className="text-xs font-bold">{item.name}</span>
                    <span className="text-xs bg-white/20 rounded-full px-1.5">{inv.qty}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Shop modal */}
      {showShop && (
        <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center p-4" onClick={() => setShowShop(false)}>
          <div className="bg-purple-900 border border-white/20 rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-5 sm:p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2"><ShoppingBag className="w-6 h-6" /> Shop</h2>
              <button onClick={() => setShowShop(false)} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="text-center text-yellow-300 font-black mb-4 flex items-center justify-center gap-1.5"><Coins className="w-4 h-4" /> {coins}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ITEMS.map(item => {
                const Icon = item.icon;
                const cost = adjustCost(item.cost);
                const canAfford = coins >= cost;
                return (
                  <button key={item.key} onClick={() => handleBuy(item.key)} disabled={!canAfford}
                    className={`text-left p-4 rounded-xl border-2 transition-all ${canAfford ? 'bg-white/5 border-white/20 hover:bg-white/10' : 'bg-white/5 border-white/5 opacity-50 cursor-not-allowed'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Icon className="w-5 h-5" />
                        <span className="font-black text-sm">{item.name}</span>
                      </div>
                      <span className={`text-sm font-black flex items-center gap-1 ${stockCrash ? 'text-green-300' : inflation ? 'text-red-300' : 'text-yellow-300'}`}>
                        <Coins className="w-3.5 h-3.5" /> {cost}
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

      {/* Attack target picker */}
      {attackTarget && (
        <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center p-4" onClick={() => setAttackTarget(null)}>
          <div className="bg-purple-900 border border-white/20 rounded-3xl max-w-md w-full max-h-[80vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
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
                {participants.filter(p => p.user_id !== user?.id).map(p => (
                  <button key={p.user_id} onClick={() => handleAttack(attackTarget.itemKey, p.user_id)}
                    className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors">
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
