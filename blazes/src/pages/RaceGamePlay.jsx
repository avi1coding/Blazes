import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Clock, Flag, Trophy, Users, Crown, Rocket } from 'lucide-react';
import { AvatarPreview } from './SkinsPage';
import { rankParticipants } from '../utils/ranking';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

// Stadium / oval track path. Uses an SVG rounded-rect path so we can use getPointAtLength.
// viewBox: 0 0 800 240, track centerline radius/curve tuned to look like a real running track.
const TRACK_PATH = 'M 100 60 L 700 60 A 60 60 0 0 1 700 180 L 100 180 A 60 60 0 0 1 100 60 Z';

// Player colors (cycled through participants)
const PLAYER_COLORS = [
  '#06b6d4', // cyan
  '#a855f7', // purple
  '#f97316', // orange
  '#10b981', // green
  '#ef4444', // red
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#ec4899', // pink
  '#84cc16', // lime
  '#8b5cf6', // violet
];

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
  const [winner, setWinner] = useState(null);

  const startTimeRef = useRef(Date.now());
  const gameStartedRef = useRef(null);
  const advanceTimeoutRef = useRef(null);
  const trackPathRef = useRef(null);
  const [pathLength, setPathLength] = useState(0);

  const settings = (() => {
    if (!game?.settings) return {};
    try { return typeof game.settings === 'string' ? JSON.parse(game.settings) : game.settings; }
    catch { return {}; }
  })();
  const distance = settings.distance || 20;

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
      // Shuffle once per player
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

  // Measure track length once
  useEffect(() => {
    if (trackPathRef.current) {
      setPathLength(trackPathRef.current.getTotalLength());
    }
  }, []);

  // Poll participants
  const fetchParticipants = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/games/${gameCode}/results`);
      const data = await res.json();
      const parts = data?.participants || [];
      setParticipants(parts);
      // Find me
      const me = parts.find(p => p.user_id === user?.id);
      if (me) setMyCorrect(me.correct_answers || 0);
      // Find winner (anyone who hit the distance)
      const finished = parts.filter(p => (p.correct_answers || 0) >= distance);
      if (finished.length > 0 && !winner) {
        // The one with the most correct, then fastest avg
        const topFinisher = [...finished].sort((a, b) => {
          if (b.correct_answers !== a.correct_answers) return b.correct_answers - a.correct_answers;
          return (a.avg_time || 999) - (b.avg_time || 999);
        })[0];
        setWinner(topFinisher);
        // Auto-end after 3 seconds
        setTimeout(() => handleGameOver(), 3000);
      }
    } catch (_) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameCode, user?.id, distance, winner]);

  useEffect(() => {
    fetchParticipants();
    const id = setInterval(fetchParticipants, 1500);
    return () => clearInterval(id);
  }, [fetchParticipants]);

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
      setMyCorrect(c => c + 1); // optimistic update
    }

    advanceTimeoutRef.current = setTimeout(advanceQuestion, isCorrect ? 600 : 1200);

    // Fire submission in background
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

  // Position a player on the track
  const getPositionAt = (progress) => {
    if (!trackPathRef.current || !pathLength) return { x: 100, y: 60 };
    // Start at the bottom-left and go around. Adjust offset so 0% is at the start line.
    const offset = pathLength * 0.5; // visual: start line at the right side of the bottom
    const adjusted = (offset + (progress * pathLength)) % pathLength;
    return trackPathRef.current.getPointAtLength(adjusted);
  };

  const sortedPlayers = [...participants].sort((a, b) => (b.correct_answers || 0) - (a.correct_answers || 0));
  const myPosition = sortedPlayers.findIndex(p => p.user_id === user?.id) + 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-sky-50 to-blue-100 flex flex-col">
      {/* Winner overlay */}
      {winner && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
            <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
              <Crown className="w-10 h-10 text-white" strokeWidth={2.5} />
            </div>
            <h2 className="text-3xl font-black text-gray-900 mb-2">
              {winner.user_id === user?.id ? 'You Won!' : `${winner.player_name || 'Winner'} Won!`}
            </h2>
            <p className="text-gray-600">First to {distance} correct answers</p>
          </div>
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
              <div className="text-[10px] text-gray-500">First to {distance} wins</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-cyan-50 border border-cyan-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <Flag className="w-4 h-4 text-cyan-600" />
              <span className="font-black text-cyan-900 tabular-nums">{myCorrect} / {distance}</span>
            </div>
            {gameTimeLeft !== null && (
              <div className={`flex items-center gap-2 border rounded-lg px-3 py-2 ${
                gameTimeLeft <= 10 ? 'bg-red-50 border-red-300 animate-pulse' :
                gameTimeLeft < 60 ? 'bg-orange-50 border-orange-300' :
                'bg-white border-gray-200'
              }`}>
                <Clock className="w-4 h-4 text-gray-700" />
                <span className="font-black text-gray-900 tabular-nums">{formatTime(gameTimeLeft)}</span>
              </div>
            )}
            {myPosition > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-600" />
                <span className="font-black text-yellow-900">#{myPosition}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 flex flex-col gap-4">
        {/* Lap track */}
        <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> Track ({participants.length})
            </h3>
            <span className="text-[10px] font-bold text-gray-400">Live</span>
          </div>
          <div className="relative" style={{ paddingBottom: '30%' }}>
            <svg viewBox="0 0 800 240" className="absolute inset-0 w-full h-full">
              {/* Track outline (outer) */}
              <path d="M 100 30 L 700 30 A 90 90 0 0 1 700 210 L 100 210 A 90 90 0 0 1 100 30 Z" fill="#10b981" />
              {/* Inner field */}
              <path d="M 130 60 L 670 60 A 60 60 0 0 1 670 180 L 130 180 A 60 60 0 0 1 130 60 Z" fill="#86efac" />
              {/* The actual race line (centerline) */}
              <path
                ref={trackPathRef}
                d={TRACK_PATH}
                fill="none"
                stroke="#fbbf24"
                strokeWidth="2"
                strokeDasharray="8 8"
              />
              {/* Finish line — vertical line at the start position */}
              {pathLength > 0 && (() => {
                const finishPoint = trackPathRef.current.getPointAtLength(pathLength * 0.5);
                return (
                  <g>
                    <line x1={finishPoint.x} y1={finishPoint.y - 28} x2={finishPoint.x} y2={finishPoint.y + 28} stroke="white" strokeWidth="3" />
                    {/* Checker pattern */}
                    {[0, 1, 2, 3].map(i => (
                      <rect key={i}
                        x={finishPoint.x - 4 + (i % 2) * 4}
                        y={finishPoint.y - 24 + i * 12}
                        width="4" height="6"
                        fill={i % 2 === 0 ? 'black' : 'white'} />
                    ))}
                  </g>
                );
              })()}
              {/* Players */}
              {pathLength > 0 && participants.map((p, i) => {
                const progress = Math.min(1, (p.correct_answers || 0) / distance);
                const pos = getPositionAt(progress);
                const isMe = p.user_id === user?.id;
                const color = isMe ? '#06b6d4' : PLAYER_COLORS[(i + 1) % PLAYER_COLORS.length];
                return (
                  <g key={p.user_id} style={{ transition: 'all 600ms ease-out' }}>
                    <circle cx={pos.x} cy={pos.y} r={isMe ? 12 : 10} fill={color} stroke="white" strokeWidth="3" />
                    <text x={pos.x} y={pos.y + 4} textAnchor="middle" fontSize="10" fontWeight="900" fill="white">
                      {(p.player_name || '?')[0].toUpperCase()}
                    </text>
                    {isMe && (
                      <text x={pos.x} y={pos.y - 18} textAnchor="middle" fontSize="11" fontWeight="900" fill="#0e7490">YOU</text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Mini leaderboard */}
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {sortedPlayers.slice(0, 8).map((p, i) => {
              const isMe = p.user_id === user?.id;
              return (
                <div key={p.user_id} className={`flex items-center gap-2 p-1.5 rounded-lg text-xs ${
                  isMe ? 'bg-cyan-50 border border-cyan-200' : 'bg-gray-50'
                }`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ${
                    i === 0 ? 'bg-yellow-400 text-yellow-900' :
                    i === 1 ? 'bg-gray-300 text-gray-800' :
                    i === 2 ? 'bg-orange-400 text-orange-900' :
                    'bg-gray-200 text-gray-600'
                  }`}>{i + 1}</span>
                  <span className={`flex-1 truncate font-bold ${isMe ? 'text-cyan-900' : 'text-gray-900'}`}>
                    {p.player_name || 'Player'}{isMe && ' (You)'}
                  </span>
                  <span className="text-[10px] font-black text-gray-500 tabular-nums">{p.correct_answers || 0}</span>
                </div>
              );
            })}
          </div>
        </div>

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
    </div>
  );
}
