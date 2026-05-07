import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Clock, Flag, Trophy, Rocket, BarChart3, X, Eye } from 'lucide-react';
import { getSkinById, getSkinIcon, initialEquippedSkin } from './SkinsPage';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

export default function RaceGamePlay({ gameCode: propCode, user: propUser }) {
  const params = useParams();
  const gameCode = propCode || params.gameCode;
  const navigate = useNavigate();
  const [user] = useState(() => propUser || JSON.parse(localStorage.getItem('user') || 'null'));

  const [game, setGame] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [questionTick, setQuestionTick] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [gameTimeLeft, setGameTimeLeft] = useState(null);

  const [myCorrect, setMyCorrect] = useState(0);
  const [participants, setParticipants] = useState([]);
  const [lapToast, setLapToast] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const prevLapsRef = useRef(0);

  const startTimeRef = useRef(Date.now());
  const gameStartedRef = useRef(null);
  const advanceTimeoutRef = useRef(null);

  const settings = (() => {
    if (!game?.settings) return {};
    try { return typeof game.settings === 'string' ? JSON.parse(game.settings) : game.settings; }
    catch { return {}; }
  })();
  const distance = settings.distance || 10;

  const currentQ = questions.length > 0 ? questionTick % questions.length : 0;
  const q = questions[currentQ];

  // Notify server when player leaves
  useEffect(() => {
    if (!user?.id) return;
    const sendLeave = () => {
      try { navigator.sendBeacon(`${BASE}/api/games/${gameCode}/leave`, new Blob([JSON.stringify({ userId: user.id })], { type: 'application/json' })); } catch (_) {}
    };
    window.addEventListener('beforeunload', sendLeave);
    return () => window.removeEventListener('beforeunload', sendLeave);
  }, [gameCode, user]);

  // Load game
  useEffect(() => {
    fetch(`${BASE}/api/games/${gameCode}`).then(r => r.json()).then(setGame).catch(() => {});
  }, [gameCode]);

  // Load questions
  useEffect(() => {
    if (!game) return;
    fetch(`${BASE}/api/kits/${game.kit_id}`).then(r => r.json()).then(data => {
      const qs = Array.isArray(data?.questions) ? data.questions : [];
      setQuestions([...qs].sort(() => Math.random() - 0.5));
    }).catch(() => {});
    if (game.started_at) {
      const s = game.started_at;
      const iso = s.includes('T') ? s : s.replace(' ', 'T') + (s.endsWith('Z') ? '' : 'Z');
      gameStartedRef.current = new Date(iso).getTime();
    }
  }, [game]);

  // Game timer
  useEffect(() => {
    if (!game?.settings) return;
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

  // Reset answer state on question change
  useEffect(() => {
    if (!questions.length) return;
    setSelected(null);
    setAnswered(false);
    setFeedback(null);
    startTimeRef.current = Date.now();
  }, [questionTick, questions]);

  // Poll participants
  const fetchParticipants = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/games/${gameCode}/results`);
      const data = await res.json();
      const parts = data?.participants || [];
      setParticipants(parts);
      const me = parts.find(p => p.user_id === user?.id);
      if (me) setMyCorrect(me.correct_answers || 0);
    } catch (_) {}
  }, [gameCode, user?.id]);

  useEffect(() => {
    fetchParticipants();
    const id = setInterval(fetchParticipants, 1500);
    return () => clearInterval(id);
  }, [fetchParticipants]);

  // Detect lap completion locally (for the toast)
  useEffect(() => {
    const newLaps = Math.floor(myCorrect / distance);
    if (newLaps > prevLapsRef.current && prevLapsRef.current >= 0) {
      setLapToast({ lap: newLaps, ts: Date.now() });
      setTimeout(() => setLapToast(null), 2000);
    }
    prevLapsRef.current = newLaps;
  }, [myCorrect, distance]);

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
    if (!q) return;
    const timeTaken = (Date.now() - startTimeRef.current) / 1000;
    const correctAnswer = q.correct_answer;
    const isCorrect = answer && answer.toString().trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();

    setFeedback({ isCorrect, correct: correctAnswer });
    if (isCorrect) {
      setMyCorrect(c => c + 1);
    }

    advanceTimeoutRef.current = setTimeout(advanceQuestion, isCorrect ? 600 : 1200);

    fetch(`${BASE}/api/games/${gameCode}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, questionId: q.id, selectedAnswer: answer || '', isCorrect, timeTaken }),
    }).catch(() => {});
  };

  const handleGameOver = useCallback(() => {
    navigate(`/game/results/${gameCode}`, { state: { game, user } });
  }, [gameCode, navigate, game, user]);

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const sortedPlayers = [...participants].sort((a, b) => (b.correct_answers || 0) - (a.correct_answers || 0));
  const myPosition = sortedPlayers.findIndex(p => p.user_id === user?.id) + 1;

  // Pull the player's equipped skin for the mini-track car so it themes itself.
  const me = participants.find(p => p.user_id === user?.id);
  const meSkinId = me?.avatar_skin || initialEquippedSkin();
  const meSkin = getSkinById(meSkinId);
  const meColor = meSkin?.glow || '#06b6d4';
  const MeSkinIcon = getSkinIcon(meSkinId);
  const lapProgress = (myCorrect % distance) / distance; // 0..1 within current lap
  const currentLap = Math.floor(myCorrect / distance);

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-sky-50 to-blue-100 flex flex-col">
      {/* Lap completion toast */}
      {lapToast && (
        <div key={lapToast.ts} className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-black px-6 py-3 rounded-2xl shadow-2xl border-2 border-yellow-300 animate-bounce flex items-center gap-2">
          <Flag className="w-5 h-5" strokeWidth={2.5} />
          <span className="text-lg">LAP {lapToast.lap} COMPLETE!</span>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm px-3 sm:px-4 py-3 flex-shrink-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
              <Rocket className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-black text-gray-900">Race</div>
              <div className="text-[10px] text-gray-500">{distance} per lap · go furthest to win</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-cyan-50 border border-cyan-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <Flag className="w-4 h-4 text-cyan-600" />
              <span className="font-black text-cyan-900 tabular-nums text-sm sm:text-base">
                Lap {Math.floor(myCorrect / distance)} · {myCorrect % distance}/{distance}
              </span>
            </div>
            {gameTimeLeft !== null && (
              <div className={`flex items-center gap-2 border rounded-lg px-3 py-2 ${
                gameTimeLeft <= 10 ? 'bg-red-50 border-red-300 animate-pulse' :
                gameTimeLeft < 60 ? 'bg-orange-50 border-orange-300' :
                'bg-white border-gray-200'
              }`}>
                <Clock className="w-4 h-4 text-gray-700" />
                <span className="font-black text-gray-900 tabular-nums text-sm sm:text-base">{formatTime(gameTimeLeft)}</span>
              </div>
            )}
            {myPosition > 0 && (
              <div className="hidden sm:flex bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-600" />
                <span className="font-black text-yellow-900">#{myPosition}</span>
              </div>
            )}
            <button
              onClick={() => setShowLeaderboard(true)}
              className="flex items-center gap-1.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg px-3 py-2 font-black text-xs sm:text-sm transition-colors"
              title="Leaderboard"
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Leaderboard</span>
            </button>
            {/* Host playing? Give them a one-click way to pop the monitoring dashboard
                in another tab so they can watch all students while they answer. */}
            {game?.host_id && user?.id && game.host_id === user.id && (
              <button
                onClick={() => window.open(`/game/monitor/${gameCode}/all`, '_blank', 'noopener')}
                className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-3 py-2 font-black text-xs sm:text-sm transition-colors"
                title="Open monitoring dashboard"
              >
                <Eye className="w-4 h-4" />
                <span className="hidden sm:inline">Monitor</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mini-track strip — visual progress through the current lap. The player's
          car is themed by their equipped skin so the gameplay screen feels
          continuous with the live race track view. */}
      <div className="bg-gradient-to-b from-stone-800 to-stone-900 border-b border-stone-700 px-3 sm:px-4 py-2.5">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-amber-400 flex-shrink-0 w-12">
            Lap {currentLap}
          </div>
          <div className="relative flex-1 h-9">
            <svg viewBox="0 0 800 36" preserveAspectRatio="none" className="w-full h-full">
              <defs>
                <linearGradient id="rgp-clay" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#c2410c" />
                  <stop offset="100%" stopColor="#7c2d12" />
                </linearGradient>
              </defs>
              {/* Track band */}
              <rect x="0" y="6" width="800" height="24" fill="url(#rgp-clay)" rx="3" />
              {/* Top + bottom kerbs (white/red candy stripe) */}
              {Array.from({ length: 40 }).map((_, i) => (
                <rect key={`kt-${i}`} x={i * 20} y="3" width="10" height="3" fill={i % 2 === 0 ? 'white' : '#dc2626'} />
              ))}
              {Array.from({ length: 40 }).map((_, i) => (
                <rect key={`kb-${i}`} x={i * 20} y="30" width="10" height="3" fill={i % 2 === 0 ? '#dc2626' : 'white'} />
              ))}
              {/* Centerline dashes */}
              <line x1="0" y1="18" x2="800" y2="18" stroke="white" strokeOpacity="0.55" strokeWidth="1.5" strokeDasharray="14 16" />
              {/* Finish line at the right end */}
              <g>
                {Array.from({ length: 8 }).map((_, i) => {
                  const cw = 6, ch = 3;
                  const c = i % 2;
                  const r = Math.floor(i / 2);
                  return (
                    <rect key={i}
                      x={780 + c * cw}
                      y={6 + r * ch}
                      width={cw} height={ch}
                      fill={(c + r) % 2 === 0 ? '#0a0e1a' : 'white'}
                    />
                  );
                })}
              </g>
              {/* Player car — themed dot moving through the lap */}
              {(() => {
                const cx = 8 + lapProgress * (780 - 16);
                return (
                  <g style={{ transform: `translate(${cx}px, 18px)`, transition: 'transform 700ms cubic-bezier(0.4, 0, 0.2, 1)' }}>
                    <ellipse cx="0" cy="3" rx="11" ry="2.5" fill={meColor} opacity="0.55" />
                    <circle cx="0" cy="0" r="9" fill={meColor} stroke="white" strokeWidth="2" />
                    {MeSkinIcon && (
                      <g>
                        <circle cx="0" cy="0" r="6" fill="white" />
                        <MeSkinIcon x="-4" y="-4" width="8" height="8" color={meColor} strokeWidth="2.5" />
                      </g>
                    )}
                  </g>
                );
              })()}
            </svg>
          </div>
          <div className="text-[10px] font-black tabular-nums text-amber-400 flex-shrink-0">
            {myCorrect % distance}/{distance}
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-3xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 flex flex-col gap-4">
        {/* Question */}
        {!q ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">Loading questions...</div>
        ) : (
          <div className="flex-1 bg-white rounded-2xl border-2 border-gray-100 p-5 sm:p-7 shadow-sm flex flex-col">
            <div className="text-center mb-4">
              <span className="inline-flex items-center gap-1.5 bg-cyan-100 text-cyan-700 text-[10px] font-black uppercase tracking-wider rounded-full px-3 py-1">
                Question {questionTick + 1}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-center text-gray-900 mb-6 sm:mb-8 leading-tight whitespace-pre-line">{q.question_text}</h2>

            {q.image_url && (
              <div className="flex justify-center mb-6">
                <img src={q.image_url} alt="" className="max-h-40 sm:max-h-48 rounded-xl" />
              </div>
            )}

            {/* Answer rendering — handle main types */}
            {(() => {
              const type = q.answer_type || 'multiple_choice';

              if (type === 'true_false') {
                return (
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 flex-1 content-center">
                    {['True', 'False'].map(value => {
                      const isSelected = selected === value;
                      const isCorrect = feedback && String(q.correct_answer).toLowerCase() === value.toLowerCase();
                      const isWrong = feedback && isSelected && !feedback.isCorrect;
                      return (
                        <button key={value} onClick={() => { if (!answered) { setSelected(value); submitAnswer(value); } }}
                          disabled={answered}
                          className={`p-5 sm:p-7 rounded-xl font-black text-2xl border-2 transition-all min-h-[80px] flex items-center justify-center ${
                            isCorrect ? 'bg-green-100 border-green-500 text-green-700 scale-105' :
                            isWrong ? 'bg-red-100 border-red-500 text-red-700' :
                            isSelected ? 'bg-cyan-100 border-cyan-500 text-cyan-700' :
                            'bg-white border-gray-200 hover:border-cyan-400 hover:bg-cyan-50 text-gray-900'
                          } disabled:cursor-not-allowed`}>
                          {value}
                        </button>
                      );
                    })}
                  </div>
                );
              }

              if (type === 'short_answer' || type === 'fill_blank' || type === 'math_equation') {
                return (
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (answered) return;
                    const val = e.target.answer.value.trim();
                    if (!val) return;
                    setSelected(val);
                    submitAnswer(val);
                  }} className="flex flex-col gap-3 max-w-xl mx-auto w-full">
                    <input name="answer" type="text" disabled={answered}
                      placeholder="Type your answer..."
                      className="w-full px-5 py-4 bg-white border-2 border-gray-200 rounded-xl text-gray-900 text-lg focus:border-cyan-500 focus:outline-none disabled:opacity-60"
                      autoFocus />
                    <button type="submit" disabled={answered}
                      className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-black disabled:opacity-50">
                      Submit
                    </button>
                  </form>
                );
              }

              // Multiple choice (default)
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 flex-1 content-center">
                  {['option_a', 'option_b', 'option_c', 'option_d'].map((key, i) => {
                    const opt = q[key];
                    if (!opt) return null;
                    const letter = ['A', 'B', 'C', 'D'][i];
                    const isSelected = selected === letter;
                    const isCorrectLetter = String(q.correct_answer || '').toUpperCase() === letter;
                    const isCorrect = feedback && isCorrectLetter;
                    const isWrong = feedback && isSelected && !isCorrectLetter;
                    return (
                      <button key={key}
                        onClick={() => { if (!answered) { setSelected(letter); submitAnswer(letter); } }}
                        disabled={answered}
                        className={`p-4 sm:p-5 rounded-xl text-left font-bold border-2 transition-all min-h-[70px] flex items-center gap-3 ${
                          isCorrect ? 'bg-green-100 border-green-500 text-green-800 scale-105' :
                          isWrong ? 'bg-red-100 border-red-500 text-red-800' :
                          isSelected ? 'bg-cyan-100 border-cyan-500 text-cyan-800' :
                          'bg-white border-gray-200 hover:border-cyan-400 hover:bg-cyan-50 text-gray-900'
                        } disabled:cursor-not-allowed`}>
                        <span className="text-lg sm:text-xl font-black opacity-50 flex-shrink-0">{letter}</span>
                        <span className="text-sm sm:text-base flex-1">{opt}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}

            {feedback && (
              <div className="mt-4 text-center">
                <div className={`inline-block px-5 py-2 rounded-full font-black text-base ${feedback.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {feedback.isCorrect ? 'Correct! +1 step' : `Answer: ${feedback.correct}`}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Leaderboard modal */}
      {showLeaderboard && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowLeaderboard(false)}>
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-cyan-600" /> Leaderboard
              </h2>
              <button onClick={() => setShowLeaderboard(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {sortedPlayers.length === 0 ? (
                <div className="text-center py-12 text-gray-500 font-semibold">No racers yet</div>
              ) : (
                <div className="space-y-2">
                  {sortedPlayers.map((p, i) => {
                    const isMe = p.user_id === user?.id;
                    const correct = p.correct_answers || 0;
                    const lap = Math.floor(correct / distance);
                    const stepInLap = correct % distance;
                    return (
                      <div key={p.user_id} className={`flex items-center gap-3 p-3 rounded-xl border-2 ${
                        isMe ? 'bg-cyan-50 border-cyan-300' : 'bg-gray-50 border-transparent'
                      }`}>
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 ${
                          i === 0 ? 'bg-yellow-400 text-yellow-900' :
                          i === 1 ? 'bg-gray-300 text-gray-800' :
                          i === 2 ? 'bg-orange-400 text-orange-900' :
                          'bg-gray-200 text-gray-600'
                        }`}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className={`font-black text-sm truncate ${isMe ? 'text-cyan-900' : 'text-gray-900'}`}>
                            {p.player_name || 'Player'}{isMe && ' (You)'}
                          </div>
                          <div className="text-xs text-gray-500 font-semibold">
                            Lap {lap} · {stepInLap}/{distance}
                          </div>
                        </div>
                        <div className="flex flex-col items-end flex-shrink-0">
                          <span className="text-lg font-black text-cyan-700 tabular-nums">{correct}</span>
                          <span className="text-[10px] font-bold text-gray-400 uppercase">correct</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
