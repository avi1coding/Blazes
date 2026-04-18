import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AvatarPreview, isBlazesPlusCached } from './SkinsPage';
import { Trophy, Check, X, Zap, Clock, ShoppingBag, Flame, Droplets, Wind, Mountain } from 'lucide-react';

const ATTACKS = [
  { id: 'earthquake', name: 'Earthquake', cost: 5, damage: 30, icon: Mountain, color: 'from-amber-600 to-yellow-700', bg: 'bg-amber-900', text: 'text-amber-300' },
  { id: 'tsunami', name: 'Tsunami', cost: 8, damage: 50, icon: Droplets, color: 'from-blue-500 to-cyan-600', bg: 'bg-blue-900', text: 'text-blue-300' },
  { id: 'hurricane', name: 'Hurricane', cost: 10, damage: 65, icon: Wind, color: 'from-teal-500 to-emerald-600', bg: 'bg-teal-900', text: 'text-teal-300' },
  { id: 'wildfire', name: 'Wildfire', cost: 15, damage: 100, icon: Flame, color: 'from-red-500 to-orange-600', bg: 'bg-red-900', text: 'text-red-300' },
];

function getFullImageUrl(url) {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
  return url.startsWith('/') ? `${base}${url}` : `${base}/${url}`;
}

export default function ElementalClashGamePlay({ gameCode, user, equippedSkinId }) {
  const navigate = useNavigate();
  const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

  const [gameData, setGameData] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [questionQueue, setQuestionQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [lastCorrect, setLastCorrect] = useState(null);
  const [showChoice, setShowChoice] = useState(false);
  const [currentQuestionId, setCurrentQuestionId] = useState(null);
  const [showShop, setShowShop] = useState(false);
  const [attackAnimation, setAttackAnimation] = useState(null);
  const [attackLaunched, setAttackLaunched] = useState(null);
  const [energy, setEnergy] = useState(0);
  const [myTeam, setMyTeam] = useState(null);
  const [team1Score, setTeam1Score] = useState(0);
  const [team2Score, setTeam2Score] = useState(0);
  const [timeLeft, setTimeLeft] = useState(null);
  const seenAttackIds = useRef(new Set());
  const gameOverRef = useRef(false);
  const questionsRef = useRef([]);

  // Poll game state
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`${base}/api/games/${gameCode}/elemental-state?userId=${user?.id || ''}`);
        if (!res.ok) return;
        const data = await res.json();
        setGameData(data);
        setTeam1Score(data.team1Score);
        setTeam2Score(data.team2Score);
        setEnergy(data.myEnergy || 0);
        setMyTeam(data.myTeam);
        if (data.timeLeft != null) setTimeLeft(data.timeLeft);

        // Init questions once
        if (data.questions?.length && questionsRef.current.length === 0) {
          questionsRef.current = data.questions;
          setQuestions(data.questions);
          const shuffled = [...Array(data.questions.length).keys()].sort(() => Math.random() - 0.5);
          setQuestionQueue(shuffled);
        }

        // Check for attack animations targeting my team
        if (data.recentAttacks && data.myTeam) {
          for (const atk of data.recentAttacks) {
            if (atk.target_team === data.myTeam && !seenAttackIds.current.has(atk.id)) {
              seenAttackIds.current.add(atk.id);
              setAttackAnimation(atk);
              setTimeout(() => setAttackAnimation(null), 2500);
              break; // one at a time
            }
          }
        }

        if (data.status === 'ended' && !gameOverRef.current) {
          gameOverRef.current = true;
          navigate(`/game/results/${gameCode}`, {
            state: {
              score: data.myScore || 0,
              correctCount: 0,
              questionsAnswered: 0,
              totalQuestions: 0,
              gameMode: 'elemental_clash',
              team1Score: data.team1Score,
              team2Score: data.team2Score,
              myTeam: data.myTeam,
            }
          });
        }
      } catch (_) { }
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [gameCode, user?.id, navigate, base]);

  // Local timer countdown
  useEffect(() => {
    if (timeLeft == null || timeLeft <= 0) return;
    const t = setTimeout(() => setTimeLeft(p => Math.max(0, (p ?? 0) - 1)), 1000);
    return () => clearTimeout(t);
  }, [timeLeft]);

  const handleNextQuestion = useCallback(() => {
    setSelectedOption(null);
    setIsAnswered(false);
    setLastCorrect(null);
    setShowChoice(false);
    setCurrentQuestionId(null);
    setQueueIndex(prev => {
      const next = prev + 1;
      if (next < questionQueue.length) return next;
      const reshuffled = [...Array(questionsRef.current.length).keys()].sort(() => Math.random() - 0.5);
      setQuestionQueue(reshuffled);
      return 0;
    });
  }, [questionQueue.length]);

  const handleAnswer = async (optionIndex) => {
    if (isAnswered) return;
    setSelectedOption(optionIndex);
    setIsAnswered(true);
    const currentQ = questions[questionQueue[queueIndex]];
    if (!currentQ) return;
    const isCorrect = optionIndex === currentQ.correctAnswer;
    setLastCorrect(isCorrect);

    // Record answer
    try {
      await fetch(`${base}/api/games/${gameCode}/answer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, questionId: currentQ.id, selectedAnswer: String(optionIndex), isCorrect, timeTaken: 0 })
      });
    } catch (_) { }

    if (isCorrect) {
      setCurrentQuestionId(currentQ.id);
      setShowChoice(true);
    } else {
      setTimeout(handleNextQuestion, 1200);
    }
  };

  const handleChoice = async (choice) => {
    setShowChoice(false);
    try {
      const res = await fetch(`${base}/api/games/${gameCode}/elemental-choice`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, questionId: currentQuestionId, choice })
      });
      const data = await res.json();
      if (data.success) {
        setEnergy(data.energy);
        setTeam1Score(data.team1Score);
        setTeam2Score(data.team2Score);
      }
    } catch (_) { }
    setTimeout(handleNextQuestion, 300);
  };

  const handleAttack = async (attackType) => {
    try {
      const res = await fetch(`${base}/api/games/${gameCode}/elemental-attack`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, attackType })
      });
      const data = await res.json();
      if (data.success) {
        setEnergy(data.energy);
        setTeam1Score(data.team1Score);
        setTeam2Score(data.team2Score);
        setAttackLaunched(attackType);
        setTimeout(() => setAttackLaunched(null), 1500);
        setShowShop(false);
      }
    } catch (_) { }
  };

  if (!gameData || questions.length === 0) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white font-bold">Loading...</div>;
  }

  const currentQ = questions[questionQueue[queueIndex]];
  if (!currentQ) return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">Loading question...</div>;
  const imgUrl = getFullImageUrl(currentQ.imageUrl || currentQ.image_url);

  const myScore = myTeam === 1 ? team1Score : team2Score;
  const enemyScore = myTeam === 1 ? team2Score : team1Score;
  const minutes = Math.floor((timeLeft || 0) / 60);
  const seconds = Math.floor((timeLeft || 0) % 60);

  const attackAnimationConfig = {
    earthquake: { label: 'EARTHQUAKE', cls: 'bg-amber-950/90 text-amber-400', shake: true, Icon: Mountain },
    tsunami: { label: 'TSUNAMI', cls: 'bg-blue-950/90 text-blue-400', shake: false, Icon: Droplets },
    hurricane: { label: 'HURRICANE', cls: 'bg-teal-950/90 text-teal-400', shake: false, Icon: Wind },
    wildfire: { label: 'WILDFIRE', cls: 'bg-red-950/90 text-red-400', shake: false, Icon: Flame },
  };

  return (
    <div className={`min-h-screen bg-gray-900 p-3 sm:p-6 ${attackAnimation?.attack_type === 'earthquake' ? 'animate-[shake_0.5s_ease-in-out_infinite]' : ''}`}>
      <style>{`@keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-8px)} 75%{transform:translateX(8px)} }`}</style>

      {/* Attack Animation Overlay */}
      {attackAnimation && (() => {
        const cfg = attackAnimationConfig[attackAnimation.attack_type];
        if (!cfg) return null;
        const Icon = cfg.Icon;
        return (
          <div className={`fixed inset-0 z-50 flex items-center justify-center ${cfg.cls} animate-pulse`}>
            <div className="text-center">
              <Icon className="w-24 h-24 mx-auto mb-4" strokeWidth={1.5} />
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-black tracking-tight">{cfg.label}!</h1>
              <p className="text-xl mt-2 opacity-80">-{attackAnimation.damage} points!</p>
            </div>
          </div>
        );
      })()}

      {/* Attack Launched Toast */}
      {attackLaunched && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-40 bg-green-600 text-white font-black px-3 sm:px-4 md:px-6 py-3 rounded-2xl shadow-2xl animate-bounce">
          Attack launched!
        </div>
      )}

      {/* Header */}
      <div className="max-w-4xl mx-auto mb-4">
        {/* Team Scores */}
        <div className="flex items-center justify-between mb-3">
          <div className={`flex-1 text-center p-3 rounded-xl ${myTeam === 1 ? 'bg-blue-900 border-2 border-blue-500' : 'bg-gray-800 border border-gray-700'}`}>
            <div className="text-xs font-bold text-blue-400 mb-1">{myTeam === 1 ? 'YOUR TEAM' : 'ENEMY'}</div>
            <div className="text-3xl font-black text-white">{team1Score}</div>
          </div>
          <div className="px-4 text-gray-500 font-black text-xl">VS</div>
          <div className={`flex-1 text-center p-3 rounded-xl ${myTeam === 2 ? 'bg-red-900 border-2 border-red-500' : 'bg-gray-800 border border-gray-700'}`}>
            <div className="text-xs font-bold text-red-400 mb-1">{myTeam === 2 ? 'YOUR TEAM' : 'ENEMY'}</div>
            <div className="text-3xl font-black text-white">{team2Score}</div>
          </div>
        </div>

        {/* Player info bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AvatarPreview skinId={equippedSkinId} initial={user?.name?.[0] || '?'} size={32} isPlus={isBlazesPlusCached()} />
            <span className="font-bold text-white text-sm">{user?.name}</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Energy */}
            <div className="flex items-center gap-1.5 bg-yellow-900/50 border border-yellow-700 px-3 py-1.5 rounded-xl">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="font-black text-yellow-300 text-sm">{energy}</span>
            </div>
            {/* Shop */}
            <button onClick={() => setShowShop(true)}
              className="flex items-center gap-1.5 bg-purple-900/50 border border-purple-600 px-3 py-1.5 rounded-xl hover:bg-purple-800/50 transition-colors">
              <ShoppingBag className="w-4 h-4 text-purple-400" />
              <span className="font-bold text-purple-300 text-sm">Shop</span>
            </button>
            {/* Timer */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${(timeLeft || 0) < 30 ? 'bg-red-900/50 border-red-600 text-red-300' : 'bg-gray-800 border-gray-700 text-gray-300'}`}>
              <Clock className="w-4 h-4" />
              <span className="font-black text-sm tabular-nums">{minutes}:{seconds.toString().padStart(2, '0')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Question */}
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-800 rounded-2xl p-5 sm:p-8 border border-gray-700 mb-4 text-center">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white">{currentQ.text || currentQ.question_text}</h2>
          {imgUrl && <img src={imgUrl} alt="" className="mt-4 max-h-48 mx-auto rounded-xl object-contain" />}
        </div>

        {/* Choice Modal (after correct answer) */}
        {showChoice ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button onClick={() => handleChoice('energy')}
              className="p-4 sm:p-5 md:p-6 rounded-2xl border-2 border-yellow-500 bg-yellow-900/30 hover:bg-yellow-900/60 transition-all text-center">
              <Zap className="w-10 h-10 text-yellow-400 mx-auto mb-2" />
              <div className="text-xl font-black text-yellow-300">+1 Energy</div>
              <div className="text-sm text-yellow-500 mt-1">For yourself</div>
            </button>
            <button onClick={() => handleChoice('team_points')}
              className="p-4 sm:p-5 md:p-6 rounded-2xl border-2 border-green-500 bg-green-900/30 hover:bg-green-900/60 transition-all text-center">
              <Trophy className="w-10 h-10 text-green-400 mx-auto mb-2" />
              <div className="text-xl font-black text-green-300">+10 Points</div>
              <div className="text-sm text-green-500 mt-1">For your team</div>
            </button>
          </div>
        ) : (
          /* Answer Options */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {currentQ.options.map((option, index) => {
              let cls = 'bg-gray-800 border-gray-600 text-gray-200 hover:border-blue-400 hover:bg-gray-700';
              if (isAnswered) {
                if (index === currentQ.correctAnswer) cls = 'bg-green-900 border-green-500 text-green-200';
                else if (index === selectedOption) cls = 'bg-red-900 border-red-500 text-red-200';
                else cls = 'bg-gray-800 border-gray-700 text-gray-500 opacity-40';
              }
              return (
                <button key={index} onClick={() => handleAnswer(index)} disabled={isAnswered}
                  className={`p-4 sm:p-6 rounded-2xl border-2 text-left transition-all ${cls} ${isAnswered ? 'cursor-default' : 'cursor-pointer'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-lg">{option}</span>
                    {isAnswered && index === currentQ.correctAnswer && <Check className="w-6 h-6 text-green-400" />}
                    {isAnswered && index === selectedOption && index !== currentQ.correctAnswer && <X className="w-6 h-6 text-red-400" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Shop Modal */}
      {showShop && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowShop(false)}>
          <div className="bg-gray-900 rounded-3xl p-4 sm:p-5 md:p-6 max-w-md w-full border-2 border-purple-600 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                <ShoppingBag className="w-6 h-6 text-purple-400" /> Attack Shop
              </h2>
              <div className="flex items-center gap-1.5 bg-yellow-900/50 border border-yellow-700 px-3 py-1.5 rounded-xl">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="font-black text-yellow-300">{energy}</span>
              </div>
            </div>
            <div className="space-y-3">
              {ATTACKS.map(atk => {
                const Icon = atk.icon;
                const canAfford = energy >= atk.cost;
                return (
                  <button key={atk.id} onClick={() => canAfford && handleAttack(atk.id)} disabled={!canAfford}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${canAfford ? `${atk.bg} border-gray-600 hover:border-gray-400 cursor-pointer` : 'bg-gray-800 border-gray-700 opacity-40 cursor-not-allowed'}`}>
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${atk.color} flex items-center justify-center`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className={`font-black text-lg ${canAfford ? atk.text : 'text-gray-500'}`}>{atk.name}</div>
                      <div className="text-sm text-gray-400">-{atk.damage} enemy points</div>
                    </div>
                    <div className="flex items-center gap-1 bg-black/30 px-3 py-1.5 rounded-lg">
                      <Zap className="w-4 h-4 text-yellow-400" />
                      <span className="font-black text-yellow-300">{atk.cost}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <button onClick={() => setShowShop(false)} className="w-full mt-4 py-3 bg-gray-800 text-gray-400 font-bold rounded-xl hover:bg-gray-700 transition-colors">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
