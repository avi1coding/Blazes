import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AvatarPreview, isBlazesPlusCached } from './SkinsPage';
import { Check, X, Flame, Users, Snowflake, Ghost, Crosshair } from 'lucide-react';

function computeFireLevel(startedAt, settings) {
  if (!startedAt) return 0;
  const start = new Date(startedAt.includes('T') ? startedAt : startedAt.replace(' ', 'T') + 'Z').getTime();
  const elapsed = (Date.now() - start) / 1000;
  if (elapsed <= 0) return 0;
  const initialInterval = settings?.initialFireInterval || 5;
  const accelEvery = settings?.fireAccelerationInterval || 30;
  const accelAmount = settings?.fireAccelerationAmount || 0.5;
  const minInterval = settings?.minFireInterval || 1.5;
  let fireFloor = 0, currentInterval = initialInterval, time = 0;
  while (time < elapsed) {
    const nextAccel = Math.ceil((time + 0.001) / accelEvery) * accelEvery;
    const timeUntilAccel = nextAccel - time;
    const timeRemaining = elapsed - time;
    const chunk = Math.min(timeUntilAccel, timeRemaining);
    fireFloor += Math.floor(chunk / currentInterval);
    if (timeRemaining <= timeUntilAccel) break;
    currentInterval = Math.max(minInterval, currentInterval - accelAmount);
    time = nextAccel;
  }
  return Math.max(0, fireFloor - 3);
}

function getFullImageUrl(url) {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
  return url.startsWith('/') ? `${base}${url}` : `${base}/${url}`;
}

export default function InfernoTowerGamePlay({ gameCode, user, equippedSkinId }) {
  const navigate = useNavigate();
  const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

  const [gameData, setGameData] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [questionQueue, setQuestionQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [myFloor, setMyFloor] = useState(0);
  const [isGhost, setIsGhost] = useState(false);
  const [frozenUntil, setFrozenUntil] = useState(null);
  const [frozenCountdown, setFrozenCountdown] = useState(0);
  const [fireLevel, setFireLevel] = useState(0);
  const [showFireballPicker, setShowFireballPicker] = useState(false);
  const [fireballHit, setFireballHit] = useState(false);
  const [eliminatedFlash, setEliminatedFlash] = useState(false);
  const [tiebreakerCountdown, setTiebreakerCountdown] = useState(null); // absolute ms timestamp
  const [tbDisplayCount, setTbDisplayCount] = useState(0); // 5,4,3,2,1,0
  const gameOverRef = useRef(false);
  const questionsRef = useRef([]);
  const wasAliveRef = useRef(true);
  const correctCountRef = useRef(0);
  const totalAnsweredRef = useRef(0);
  const seenFireballIds = useRef(new Set());

  // Poll game state
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`${base}/api/games/${gameCode}/inferno-state?userId=${user?.id || ''}`);
        if (!res.ok) return;
        const data = await res.json();
        setGameData(data);
        setMyFloor(data.myFloor || 0);
        if (data.myFrozenUntil) {
          setFrozenUntil(new Date(data.myFrozenUntil.includes('T') ? data.myFrozenUntil : data.myFrozenUntil.replace(' ', 'T') + 'Z').getTime());
        }
        // Store tiebreaker target timestamp
        if (data.suddenDeath === 2 && data.tiebreakerStartedAt) {
          const tbTarget = new Date(data.tiebreakerStartedAt.includes('T') ? data.tiebreakerStartedAt : data.tiebreakerStartedAt.replace(' ', 'T') + 'Z').getTime();
          setTiebreakerCountdown(tbTarget);
        }
        // Sync alive/ghost state from server (server is authority after sudden death/tiebreaker)
        if (data.myGhost === 0) {
          if (!wasAliveRef.current || isGhost) {
            // Player was revived (sudden death / tiebreaker)
            wasAliveRef.current = true;
            setIsGhost(false);
            setSelectedOption(null);
            setIsAnswered(false);
          }
        } else if (data.myGhost === 1) {
          if (wasAliveRef.current) {
            wasAliveRef.current = false;
            setIsGhost(true);
            // Only show eliminated flash if not in sudden death/tiebreaker (they'll be revived)
            if (!data.suddenDeath) {
              setEliminatedFlash(true);
              setTimeout(() => setEliminatedFlash(false), 3000);
            }
          } else {
            setIsGhost(true);
          }
        }
        // Init questions
        if (data.questions?.length && questionsRef.current.length === 0) {
          questionsRef.current = data.questions;
          setQuestions(data.questions);
          setQuestionQueue([...Array(data.questions.length).keys()].sort(() => Math.random() - 0.5));
        }
        // Fireball hits
        if (data.recentFireballs) {
          for (const fb of data.recentFireballs) {
            if (!seenFireballIds.current.has(fb.id)) {
              seenFireballIds.current.add(fb.id);
              setFireballHit(true);
              setTimeout(() => setFireballHit(false), 2000);
            }
          }
        }
        if (data.status === 'ended' && !gameOverRef.current) {
          gameOverRef.current = true;
          const myP = (data.participants || []).find(p => p.user_id === user?.id);
          navigate(`/game/results/${gameCode}`, {
            state: {
              score: myP?.score || 0,
              correctCount: correctCountRef.current,
              questionsAnswered: totalAnsweredRef.current,
              totalQuestions: totalAnsweredRef.current,
              hasWon: !myP?.is_ghost,
              gameMode: 'inferno_tower',
            }
          });
        }
      } catch (_) { }
    };
    poll();
    const interval = setInterval(poll, 1500);
    return () => clearInterval(interval);
  }, [gameCode, user?.id, navigate, base]);

  // Compute fire level locally for smooth animation
  useEffect(() => {
    if (!gameData?.started_at) return;
    const tick = () => setFireLevel(computeFireLevel(gameData.started_at, gameData.settings));
    tick();
    const t = setInterval(tick, 200);
    return () => clearInterval(t);
  }, [gameData?.started_at, gameData?.settings]);

  // Frozen countdown
  useEffect(() => {
    if (!frozenUntil) { setFrozenCountdown(0); return; }
    const tick = () => {
      const left = Math.max(0, Math.ceil((frozenUntil - Date.now()) / 1000));
      setFrozenCountdown(left);
      if (left <= 0) setFrozenUntil(null);
    };
    tick();
    const t = setInterval(tick, 100);
    return () => clearInterval(t);
  }, [frozenUntil]);

  // Tiebreaker countdown tick — schedule at exact transition moments
  useEffect(() => {
    if (!tiebreakerCountdown) { setTbDisplayCount(0); return; }
    const tick = () => {
      const msLeft = tiebreakerCountdown - Date.now();
      const secs = Math.min(5, Math.max(0, Math.ceil(msLeft / 1000)));
      setTbDisplayCount(secs);
      if (secs <= 0) return;
      // Schedule next tick at exact second boundary
      const msUntilNext = msLeft - (secs - 1) * 1000;
      return setTimeout(tick, Math.max(10, msUntilNext));
    };
    const t = tick();
    return () => clearTimeout(t);
  }, [tiebreakerCountdown]);

  const handleNextQuestion = useCallback(() => {
    setSelectedOption(null);
    setIsAnswered(false);
    setShowFireballPicker(false);
    setQueueIndex(prev => {
      const next = prev + 1;
      if (next < questionQueue.length) return next;
      setQuestionQueue([...Array(questionsRef.current.length).keys()].sort(() => Math.random() - 0.5));
      return 0;
    });
  }, [questionQueue.length]);

  const handleAnswer = async (optionIndex) => {
    if (isAnswered || frozenCountdown > 0) return;
    setSelectedOption(optionIndex);
    setIsAnswered(true);
    const currentQ = questions[questionQueue[queueIndex]];
    if (!currentQ) return;
    const isCorrect = optionIndex === currentQ.correctAnswer;
    totalAnsweredRef.current += 1;
    if (isCorrect) correctCountRef.current += 1;

    try {
      const res = await fetch(`${base}/api/games/${gameCode}/inferno-answer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, questionId: currentQ.id, selectedAnswer: String(optionIndex), isCorrect })
      });
      const data = await res.json();
      if (data.floor) setMyFloor(data.floor);
      if (data.frozenFor) {
        setFrozenUntil(Date.now() + data.frozenFor * 1000);
      }
      if (data.canFireball) {
        setShowFireballPicker(true);
        return; // don't auto-advance, wait for fireball pick
      }
    } catch (_) { }

    setTimeout(handleNextQuestion, isCorrect ? 400 : 1000);
  };

  const handleFireball = async (targetUserId) => {
    try {
      await fetch(`${base}/api/games/${gameCode}/inferno-fireball`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, targetUserId })
      });
    } catch (_) { }
    setShowFireballPicker(false);
    setTimeout(handleNextQuestion, 300);
  };

  if (!gameData || questions.length === 0) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white font-bold">Loading...</div>;
  }

  const currentQ = questions[questionQueue[queueIndex]];
  if (!currentQ) return null;
  const imgUrl = getFullImageUrl(currentQ.imageUrl || currentQ.image_url);

  const alivePlayers = (gameData.participants || []).filter(p => !p.is_ghost);
  const aliveCount = alivePlayers.length;
  const gap = myFloor - fireLevel;
  const isFrozen = frozenCountdown > 0;

  return (
    <div className={`min-h-screen bg-gray-950 p-3 sm:p-6 relative overflow-hidden ${fireballHit ? 'animate-[shake_0.3s_ease-in-out_3]' : ''}`}>
      <style>{`@keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }`}</style>

      {/* Eliminated flash (only when not in sudden death/tiebreaker) */}
      {eliminatedFlash && gameData?.suddenDeath !== 1 && gameData?.suddenDeath !== 2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-red-950/90 animate-pulse">
          <div className="text-center">
            <Flame className="w-24 h-24 text-red-500 mx-auto mb-4" strokeWidth={1.5} />
            <h1 className="text-6xl font-black text-red-400 mb-2">BURNED!</h1>
            <p className="text-red-300 text-xl font-bold">You're now a ghost — send fireballs to freeze others!</p>
          </div>
        </div>
      )}

      {/* Fireball hit flash */}
      {fireballHit && !eliminatedFlash && (
        <div className="fixed inset-0 z-40 pointer-events-none bg-orange-600/20 animate-pulse" />
      )}

      {/* Frozen overlay */}
      {isFrozen && !isGhost && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-blue-950/85 backdrop-blur-md">
          <div className="text-center">
            <div className="relative inline-block mb-6">
              <Snowflake className="w-24 h-24 text-blue-300 animate-spin" style={{ animationDuration: '3s' }} />
              <div className="absolute inset-0 rounded-full bg-blue-400/10 animate-ping" />
            </div>
            <h2 className="text-5xl font-black text-blue-200 mb-3 tracking-tight">FROZEN!</h2>
            <div className="text-7xl font-black text-white tabular-nums drop-shadow-lg">{frozenCountdown}s</div>
          </div>
        </div>
      )}

      {/* Fire rising visual (left edge) — hidden during tiebreaker */}
      {gameData?.suddenDeath !== 2 && (
        <div className="fixed left-0 bottom-0 w-2 sm:w-3 z-20 transition-all duration-500 bg-gradient-to-t from-red-600 via-orange-500 to-yellow-400"
          style={{ height: `${Math.min(100, Math.max(5, (fireLevel / Math.max(fireLevel, myFloor, 1)) * 100))}%` }} />
      )}

      {/* Header */}
      <div className="max-w-4xl mx-auto mb-4">
        <div className="flex items-center justify-between bg-gray-900/50 backdrop-blur-sm rounded-2xl p-3 border border-gray-800/50">
          <div className="flex items-center gap-3">
            <AvatarPreview skinId={equippedSkinId} initial={user?.name?.[0] || '?'} size={36} isPlus={isBlazesPlusCached()} />
            <div>
              <span className="font-black text-white text-sm">{user?.name}</span>
              {isGhost && <span className="ml-2 text-xs bg-purple-600/80 text-purple-200 px-2 py-0.5 rounded-full font-bold"><Ghost className="w-3 h-3 inline mr-0.5" />GHOST</span>}
            </div>
          </div>
          {gameData?.suddenDeath !== 2 ? (
            <div className="flex items-center gap-3">
              {/* Floor */}
              <div className="text-center bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-xl">
                <div className="text-xs text-gray-400 font-bold">FLOOR</div>
                <div className="text-xl font-black text-white">{myFloor}</div>
              </div>
              {/* Fire */}
              <div className={`text-center px-3 py-1.5 rounded-xl ${gap <= 3 ? 'bg-red-900 border border-red-600' : 'bg-gray-800 border border-gray-700'}`}>
                <div className="text-xs text-orange-400 font-bold flex items-center gap-1"><Flame className="w-3 h-3" />FIRE</div>
                <div className={`text-xl font-black ${gap <= 3 ? 'text-red-400' : 'text-orange-400'}`}>{fireLevel}</div>
              </div>
              {/* Alive */}
              <div className="text-center bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-xl">
                <div className="text-xs text-gray-400 font-bold flex items-center gap-1"><Users className="w-3 h-3" />ALIVE</div>
                <div className="text-xl font-black text-green-400">{aliveCount}</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-yellow-900/50 border border-yellow-700 px-3 py-1.5 rounded-xl">
              <Crosshair className="w-4 h-4 text-yellow-400" />
              <span className="font-black text-yellow-300 text-sm">TIEBREAKER</span>
            </div>
          )}
        </div>

        {/* Tiebreaker — synced countdown */}
        {gameData?.suddenDeath === 2 && tbDisplayCount > 0 && (
          <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-gray-950">
            <div className="mb-8 relative">
              <div className="w-40 h-40 rounded-full border-[6px] border-yellow-500/30 flex items-center justify-center">
                <div className="w-36 h-36 rounded-full border-4 border-yellow-400 flex items-center justify-center bg-yellow-500/5" key={tbDisplayCount}>
                  <span className="text-8xl font-black text-white drop-shadow-lg">{tbDisplayCount}</span>
                </div>
              </div>
              <div className="absolute inset-0 rounded-full border-4 border-yellow-400/20 animate-ping" />
            </div>
            <div className="flex items-center gap-3 mb-3">
              <Crosshair className="w-8 h-8 text-yellow-400" strokeWidth={2.5} />
              <h2 className="text-4xl font-black text-yellow-400 tracking-tight">TIEBREAKER</h2>
            </div>
            <p className="text-gray-400 font-bold text-lg">First correct answer wins!</p>
          </div>
        )}

        {gameData?.suddenDeath === 2 && tbDisplayCount <= 0 && (
          <div className="mt-2 text-center bg-gradient-to-r from-yellow-900/80 to-amber-900/80 border-2 border-yellow-600 rounded-xl py-2.5 px-4">
            <div className="flex items-center justify-center gap-2">
              <Crosshair className="w-5 h-5 text-yellow-400" strokeWidth={2.5} />
              <span className="font-black text-yellow-300 tracking-wide">TIEBREAKER — First correct answer wins!</span>
            </div>
          </div>
        )}

        {/* Sudden Death banner */}
        {gameData?.suddenDeath === 1 && (
          <div className="mt-2 text-center bg-gradient-to-r from-red-950 to-red-900 border-2 border-red-700 rounded-xl py-2.5 px-4 shadow-lg shadow-red-900/30">
            <div className="flex items-center justify-center gap-2">
              <Flame className="w-5 h-5 text-red-400 animate-pulse" />
              <span className="font-black text-red-300 tracking-wide">SUDDEN DEATH — Fire is rising faster!</span>
              <Flame className="w-5 h-5 text-red-400 animate-pulse" />
            </div>
          </div>
        )}

        {/* Floor gap warning */}
        {!isGhost && gameData?.suddenDeath !== 2 && gap <= 5 && gap > 0 && (
          <div className={`mt-2 text-center font-black text-sm rounded-lg py-1 ${gap <= 2 ? 'bg-red-900 text-red-300 animate-pulse' : 'bg-orange-900/50 text-orange-400'}`}>
            {gap <= 2 ? 'FIRE IS RIGHT BEHIND YOU!' : `Fire is ${gap} floors below you!`}
          </div>
        )}
      </div>

      {/* Fireball Target Picker (Ghost) */}
      {showFireballPicker && (
        <div className="max-w-4xl mx-auto mb-4">
          <div className="bg-gradient-to-b from-purple-900 to-purple-950 border-2 border-purple-500 rounded-2xl p-5 shadow-xl shadow-purple-900/30">
            <h3 className="font-black text-purple-200 mb-4 flex items-center gap-2 text-lg">
              <Crosshair className="w-6 h-6 text-purple-400" strokeWidth={2.5} /> Choose a target to freeze!
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {alivePlayers.map(p => (
                <button key={p.user_id} onClick={() => handleFireball(p.user_id)}
                  className="flex items-center gap-2 p-3 bg-purple-800/80 border border-purple-600 rounded-xl hover:bg-purple-700 hover:border-purple-400 hover:shadow-lg transition-all">
                  <Flame className="w-4 h-4 text-orange-400 flex-shrink-0" />
                  <span className="font-bold text-white text-sm truncate">{p.player_name}</span>
                  <span className="text-xs text-purple-300 ml-auto font-black">F{p.tower_floor}</span>
                </button>
              ))}
            </div>
            <button onClick={() => { setShowFireballPicker(false); handleNextQuestion(); }}
              className="w-full mt-3 py-2 text-purple-400 font-bold text-sm hover:text-purple-200 transition-colors">Skip</button>
          </div>
        </div>
      )}

      {/* Question */}
      {!showFireballPicker && (
        <div className="max-w-4xl mx-auto">
          <div className={`rounded-2xl sm:rounded-3xl p-5 sm:p-8 border-2 mb-4 sm:mb-6 text-center shadow-lg ${isGhost ? 'bg-purple-950/80 border-purple-700 shadow-purple-900/20' : 'bg-gray-800/80 border-gray-700 shadow-gray-900/20'}`}>
            {isGhost && <div className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-400 mb-3 bg-purple-900/50 px-3 py-1 rounded-full"><Ghost className="w-3 h-3" />GHOST MODE — Correct answers send fireballs!</div>}
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white leading-snug">{currentQ.text || currentQ.question_text}</h2>
            {imgUrl && <img src={imgUrl} alt="" className="mt-4 max-h-48 mx-auto rounded-xl object-contain" />}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {currentQ.options.map((option, index) => {
              let cls = isGhost
                ? 'bg-purple-900/80 border-purple-600 text-purple-200 hover:border-purple-400 hover:bg-purple-800 hover:shadow-lg hover:shadow-purple-900/30'
                : 'bg-gray-800/80 border-gray-600 text-gray-200 hover:border-orange-400 hover:bg-gray-700 hover:shadow-lg hover:shadow-orange-900/20';
              if (isAnswered) {
                if (index === currentQ.correctAnswer) cls = 'bg-green-900 border-green-500 text-green-200';
                else if (index === selectedOption) cls = 'bg-red-900 border-red-500 text-red-200';
                else cls = 'bg-gray-800 border-gray-700 text-gray-500 opacity-40';
              }
              const disabled = isAnswered || (isFrozen && !isGhost) || (gameData?.suddenDeath === 2 && tbDisplayCount > 0);
              return (
                <button key={index} onClick={() => handleAnswer(index)} disabled={disabled}
                  className={`p-4 sm:p-6 rounded-2xl border-2 text-left transition-all ${cls} ${disabled ? 'cursor-default' : 'cursor-pointer'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-lg">{option}</span>
                    {isAnswered && index === currentQ.correctAnswer && <Check className="w-6 h-6 text-green-400" />}
                    {isAnswered && index === selectedOption && index !== currentQ.correctAnswer && <X className="w-6 h-6 text-red-400" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
