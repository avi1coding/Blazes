import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AvatarPreview, isBlazesPlusCached } from './SkinsPage';
import { Check, X, Flame, Mountain, Droplets, Trophy, Clock, Zap, Crown } from 'lucide-react';

const TIERS = {
  1: {
    rock: { name: 'Rock', icon: 'mountain', right: 5, wrong: 0, color: 'from-gray-500 to-gray-600', bg: 'bg-gray-800', border: 'border-gray-600', text: 'text-gray-300' },
    raindrop: { name: 'Raindrop', icon: 'droplets', right: 10, wrong: -5, color: 'from-blue-500 to-cyan-500', bg: 'bg-blue-900', border: 'border-blue-500', text: 'text-blue-300' },
    torch: { name: 'Torch', icon: 'flame', right: 25, wrong: -10, color: 'from-orange-500 to-red-500', bg: 'bg-orange-900', border: 'border-orange-500', text: 'text-orange-300' },
  },
  2: {
    rock: { name: 'Boulder', icon: 'mountain', right: 15, wrong: -5, color: 'from-gray-400 to-gray-600', bg: 'bg-gray-800', border: 'border-gray-500', text: 'text-gray-300' },
    raindrop: { name: 'Wave', icon: 'droplets', right: 30, wrong: -15, color: 'from-blue-400 to-blue-600', bg: 'bg-blue-900', border: 'border-blue-400', text: 'text-blue-300' },
    torch: { name: 'Campfire', icon: 'flame', right: 65, wrong: -35, color: 'from-orange-400 to-red-500', bg: 'bg-orange-900', border: 'border-orange-400', text: 'text-orange-300' },
  },
  3: {
    rock: { name: 'Mountain', icon: 'mountain', right: 35, wrong: -15, color: 'from-gray-300 to-gray-500', bg: 'bg-gray-800', border: 'border-gray-400', text: 'text-gray-200' },
    raindrop: { name: 'Tsunami', icon: 'droplets', right: 80, wrong: -45, color: 'from-cyan-400 to-blue-600', bg: 'bg-blue-900', border: 'border-cyan-400', text: 'text-cyan-300' },
    torch: { name: 'Wildfire', icon: 'flame', right: 175, wrong: -120, color: 'from-red-400 to-red-600', bg: 'bg-red-900', border: 'border-red-400', text: 'text-red-300' },
  },
  4: {
    rock: { name: 'Earth', icon: 'mountain', right: 75, wrong: -30, color: 'from-green-500 to-emerald-600', bg: 'bg-green-900', border: 'border-green-500', text: 'text-green-300' },
    raindrop: { name: 'Water', icon: 'droplets', right: 200, wrong: -120, color: 'from-indigo-400 to-blue-600', bg: 'bg-indigo-900', border: 'border-indigo-400', text: 'text-indigo-300' },
    torch: { name: 'Fire', icon: 'flame', right: 500, wrong: -350, color: 'from-red-500 to-yellow-500', bg: 'bg-red-950', border: 'border-red-500', text: 'text-red-300' },
  },
};

const BetIcon = ({ type, size = 20 }) => {
  if (type === 'mountain') return <Mountain className={`w-${size/4} h-${size/4}`} style={{ width: size, height: size }} />;
  if (type === 'droplets') return <Droplets className={`w-${size/4} h-${size/4}`} style={{ width: size, height: size }} />;
  return <Flame className={`w-${size/4} h-${size/4}`} style={{ width: size, height: size }} />;
};

function getFullImageUrl(url) {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
  return url.startsWith('/') ? `${base}${url}` : `${base}/${url}`;
}

export default function ElementalWagerGamePlay({ gameCode, user, equippedSkinId }) {
  const navigate = useNavigate();
  const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

  const [gameData, setGameData] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [questionQueue, setQuestionQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [phase, setPhase] = useState('bet'); // 'bet' | 'question' | 'result'
  const [selectedBet, setSelectedBet] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lastResult, setLastResult] = useState(null); // { correct, points }
  const [timeLeft, setTimeLeft] = useState(null);
  const [participants, setParticipants] = useState([]);
  const gameOverRef = useRef(false);
  const questionsRef = useRef([]);
  const correctCountRef = useRef(0);
  const totalAnsweredRef = useRef(0);
  const maxStreakRef = useRef(0);
  const [showLeaderboard, setShowLeaderboard] = useState(true);

  const currentTier = Math.min(4, 1 + Math.floor(streak / 10));

  // Poll
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`${base}/api/games/${gameCode}/wager-state?userId=${user?.id || ''}`);
        if (!res.ok) return;
        const data = await res.json();
        setGameData(data);
        setParticipants(data.participants || []);
        if (data.timeLeft != null) setTimeLeft(prev => prev == null || Math.abs(prev - data.timeLeft) > 2 ? Math.round(data.timeLeft) : prev);
        if (data.questions?.length && questionsRef.current.length === 0) {
          questionsRef.current = data.questions;
          setQuestions(data.questions);
          setQuestionQueue([...Array(data.questions.length).keys()].sort(() => Math.random() - 0.5));
        }
        if (data.status === 'ended' && !gameOverRef.current) {
          gameOverRef.current = true;
          navigate(`/game/results/${gameCode}`, {
            state: { score, correctCount: correctCountRef.current, questionsAnswered: totalAnsweredRef.current, totalQuestions: totalAnsweredRef.current, gameMode: 'elemental_wager' }
          });
        }
      } catch (_) { }
    };
    poll();
    const t = setInterval(poll, 2000);
    return () => clearInterval(t);
  }, [gameCode, user?.id, navigate, base, score]);

  // Local timer
  useEffect(() => {
    if (timeLeft == null || timeLeft <= 0) return;
    const t = setTimeout(() => setTimeLeft(p => Math.max(0, (p ?? 0) - 1)), 1000);
    return () => clearTimeout(t);
  }, [timeLeft]);

  const handleNextQuestion = useCallback(() => {
    setSelectedOption(null);
    setSelectedBet(null);
    setLastResult(null);
    setPhase('bet');
    setQueueIndex(prev => {
      const next = prev + 1;
      if (next < questionQueue.length) return next;
      setQuestionQueue([...Array(questionsRef.current.length).keys()].sort(() => Math.random() - 0.5));
      return 0;
    });
  }, [questionQueue.length]);

  const handleBet = (betType) => {
    setSelectedBet(betType);
    setPhase('question');
  };

  const handleAnswer = async (optionIndex) => {
    if (selectedOption !== null) return;
    setSelectedOption(optionIndex);
    const currentQ = questions[questionQueue[queueIndex]];
    if (!currentQ) return;
    const isCorrect = optionIndex === currentQ.correctAnswer;
    const tier = TIERS[currentTier][selectedBet];
    const points = isCorrect ? tier.right : tier.wrong;

    totalAnsweredRef.current += 1;

    if (isCorrect) {
      correctCountRef.current += 1;
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > maxStreakRef.current) maxStreakRef.current = newStreak;
    } else {
      setStreak(0);
    }

    const newScore = Math.max(0, score + points);
    setScore(newScore);
    setLastResult({ correct: isCorrect, points, betName: tier.name });
    setPhase('result');

    // Submit to server
    try {
      await fetch(`${base}/api/games/${gameCode}/wager-answer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, questionId: currentQ.id, selectedAnswer: String(optionIndex), isCorrect, pointsEarned: points, newStreak: isCorrect ? streak + 1 : 0 })
      });
    } catch (_) { }

    setTimeout(handleNextQuestion, 1500);
  };

  if (!gameData || questions.length === 0) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white font-bold">Loading...</div>;
  }

  const currentQ = questions[questionQueue[queueIndex]];
  if (!currentQ) return null;
  const imgUrl = getFullImageUrl(currentQ.imageUrl || currentQ.image_url);
  const tierData = TIERS[currentTier];
  const mins = Math.floor((timeLeft || 0) / 60);
  const secs = (timeLeft || 0) % 60;

  const hasMultiplayer = participants.length > 1;

  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">
      {/* Header — full width */}
      <div className="px-4 sm:px-8 pt-4 sm:pt-6 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between bg-gray-900/80 backdrop-blur rounded-2xl p-3 border border-gray-800">
          <div className="flex items-center gap-3">
            <AvatarPreview skinId={equippedSkinId} initial={user?.name?.[0] || '?'} size={36} isPlus={isBlazesPlusCached()} />
            <div>
              <span className="font-black text-white text-sm">{user?.name}</span>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-yellow-400 font-bold">{score} pts</span>
                {streak > 0 && <span className="text-orange-400 font-bold">{streak} streak</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Tier */}
            <div className="bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-xl text-center">
              <div className="text-[10px] text-gray-400 font-bold">TIER</div>
              <div className="text-lg font-black text-white">{currentTier}</div>
            </div>
            {/* Timer */}
            <div className={`px-3 py-1.5 rounded-xl border ${(timeLeft || 0) < 30 ? 'bg-red-900/50 border-red-600 text-red-300' : 'bg-gray-800 border-gray-700 text-gray-300'}`}>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                <span className="font-black text-sm tabular-nums">{mins}:{secs.toString().padStart(2, '0')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Streak progress to next tier */}
        {streak > 0 && currentTier < 4 && (
          <div className="mt-2 bg-gray-900 rounded-xl p-2 border border-gray-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-400 font-bold">NEXT TIER IN {10 - (streak % 10)} CORRECT</span>
              <span className="text-[10px] text-orange-400 font-bold">TIER {currentTier} → {currentTier + 1}</span>
            </div>
            <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all duration-300" style={{ width: `${(streak % 10) * 10}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Main content area — game + optional leaderboard */}
      <div className="flex-1 flex overflow-hidden">
        {/* Game area */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 pb-6">
          <div className="max-w-4xl mx-auto">
        {/* BET PHASE */}
        {phase === 'bet' && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-2">Choose Your Wager</h2>
              <p className="text-gray-500">Pick your risk level for the next question</p>
            </div>
            <div className="grid grid-cols-3 gap-4 sm:gap-6">
              {['rock', 'raindrop', 'torch'].map(betType => {
                const bet = tierData[betType];
                return (
                  <button key={betType} onClick={() => handleBet(betType)}
                    className={`relative p-6 sm:p-8 rounded-2xl sm:rounded-3xl border-2 ${bet.border} ${bet.bg} hover:scale-105 transition-all text-center group`}>
                    <div className={`w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br ${bet.color} flex items-center justify-center shadow-lg`}>
                      <BetIcon type={bet.icon} size={36} />
                    </div>
                    <div className={`font-black text-xl sm:text-2xl mb-3 ${bet.text}`}>{bet.name}</div>
                    <div className="space-y-1.5">
                      <div className="text-green-400 font-bold text-base sm:text-lg">+{bet.right}</div>
                      <div className="text-red-400 font-bold text-base sm:text-lg">{bet.wrong === 0 ? 'No risk' : bet.wrong}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* QUESTION PHASE */}
        {phase === 'question' && (
          <div>
            {/* Bet indicator */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className={`px-4 py-1.5 rounded-xl border ${tierData[selectedBet].border} ${tierData[selectedBet].bg} flex items-center gap-2`}>
                <BetIcon type={tierData[selectedBet].icon} size={16} />
                <span className={`font-black text-sm ${tierData[selectedBet].text}`}>{tierData[selectedBet].name}</span>
              </div>
            </div>

            <div className="bg-gray-800/80 rounded-2xl sm:rounded-3xl p-6 sm:p-10 border border-gray-700 mb-5 sm:mb-8 text-center shadow-lg">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white leading-snug">{currentQ.text || currentQ.question_text}</h2>
              {imgUrl && <img src={imgUrl} alt="" className="mt-4 max-h-48 mx-auto rounded-xl object-contain" />}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              {currentQ.options.map((option, index) => {
                let cls = 'bg-gray-800/80 border-gray-600 text-gray-200 hover:border-orange-400 hover:bg-gray-700 hover:shadow-lg';
                if (selectedOption !== null) {
                  if (index === currentQ.correctAnswer) cls = 'bg-green-900 border-green-500 text-green-200';
                  else if (index === selectedOption) cls = 'bg-red-900 border-red-500 text-red-200';
                  else cls = 'bg-gray-800 border-gray-700 text-gray-500 opacity-40';
                }
                return (
                  <button key={index} onClick={() => handleAnswer(index)} disabled={selectedOption !== null}
                    className={`p-4 sm:p-6 rounded-2xl border-2 text-left transition-all ${cls} ${selectedOption !== null ? 'cursor-default' : 'cursor-pointer'}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-lg">{option}</span>
                      {selectedOption !== null && index === currentQ.correctAnswer && <Check className="w-6 h-6 text-green-400" />}
                      {selectedOption !== null && index === selectedOption && index !== currentQ.correctAnswer && <X className="w-6 h-6 text-red-400" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* RESULT PHASE */}
        {phase === 'result' && lastResult && (
          <div className="text-center py-12 sm:py-16">
            <div className={`inline-flex items-center gap-4 px-10 py-6 rounded-3xl mb-6 ${lastResult.correct ? 'bg-green-900/60 border-2 border-green-500' : 'bg-red-900/60 border-2 border-red-500'}`}>
              {lastResult.correct ? <Check className="w-10 h-10 text-green-400" /> : <X className="w-10 h-10 text-red-400" />}
              <span className={`text-4xl sm:text-5xl font-black ${lastResult.correct ? 'text-green-300' : 'text-red-300'}`}>
                {lastResult.correct ? `+${lastResult.points}` : lastResult.points}
              </span>
            </div>
            <div className="text-5xl sm:text-6xl font-black text-white mb-3">{score} pts</div>
            <div className="text-gray-500 text-base">
              {streak > 0 ? `${streak} in a row — Tier ${currentTier}` : 'Streak reset'}
            </div>
          </div>
        )}
          </div>
        </div>

        {/* Leaderboard sidebar — right side on desktop */}
        {hasMultiplayer && showLeaderboard && (() => {
          const sorted = [...participants].sort((a, b) => (b.score || 0) - (a.score || 0));
          const places = sorted.map((p, i) => {
            if (i === 0) return 1;
            return (p.score || 0) === (sorted[i - 1].score || 0)
              ? (() => { let j = i - 1; while (j > 0 && (sorted[j].score || 0) === (sorted[j - 1].score || 0)) j--; return j + 1; })()
              : i + 1;
          });
          return (
            <div className="w-64 flex-shrink-0 bg-gray-900/80 border-l border-gray-800 p-4 overflow-y-auto hidden lg:block">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs font-black text-gray-500 uppercase tracking-wider">Leaderboard</h4>
                <button onClick={() => setShowLeaderboard(false)} className="text-gray-600 hover:text-gray-400 text-xs font-bold">Hide</button>
              </div>
              <div className="space-y-2">
                {sorted.map((p, i) => {
                  const isMe = p.user_id === user?.id;
                  return (
                    <div key={p.user_id} className={`flex items-center gap-2.5 p-2.5 rounded-xl transition-colors ${isMe ? 'bg-yellow-900/30 border border-yellow-800/50' : 'bg-gray-800/50 hover:bg-gray-800'}`}>
                      <span className={`font-black w-6 text-center text-sm ${places[i] === 1 ? 'text-yellow-400' : places[i] === 2 ? 'text-gray-400' : places[i] === 3 ? 'text-amber-600' : 'text-gray-600'}`}>
                        {places[i] === 1 ? <Crown className="w-4 h-4 text-yellow-400 mx-auto" /> : `#${places[i]}`}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-bold truncate ${isMe ? 'text-yellow-300' : 'text-gray-300'}`}>{p.player_name?.split(' ')[0]}</div>
                        {p.wager_streak > 0 && <div className="text-[10px] text-orange-400 font-bold">{p.wager_streak} streak</div>}
                      </div>
                      <span className={`font-black tabular-nums text-sm ${isMe ? 'text-yellow-400' : 'text-gray-400'}`}>{p.score}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Mobile leaderboard toggle + collapsed show button */}
        {hasMultiplayer && !showLeaderboard && (
          <button onClick={() => setShowLeaderboard(true)}
            className="fixed top-4 right-4 z-20 bg-gray-900 border border-gray-700 px-3 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition-colors hidden lg:flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5" /> Leaderboard
          </button>
        )}
      </div>
    </div>
  );
}
