import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AvatarPreview, getNameColor, isBlazesPlusCached } from './SkinsPage';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Clock, Trophy, Check, X, Heart, Skull, Lock, Users, Flame, BarChart3, Crown, Medal, Maximize2 } from 'lucide-react';
import ElementalClashGamePlay from './ElementalClashGamePlay';
import ForgeGamePlay from './ForgeGamePlay';
import ElementalWagerGamePlay from './ElementalWagerGamePlay';
import ArenaGamePlay from './ArenaGamePlay';
import ElementalMarketsGamePlay from './ElementalMarketsGamePlay';

function getFullImageUrl(url) {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
  return url.startsWith('/') ? `${base}${url}` : `${base}/${url}`;
}

function formatTime(seconds) {
  if (seconds === null || seconds === undefined) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`;
}

// ─── Classic-timed game (unchanged) ──────────────────────────────────────────
function computeTimeLeft(game) {
  if (!game?.settings?.timeLimit || game.settings.endless) return null;
  if (!game.started_at) return game.settings.timeLimit;
  const startedAt = new Date(game.started_at.replace(' ', 'T') + 'Z').getTime();
  return Math.max(0, game.settings.timeLimit - Math.floor((Date.now() - startedAt) / 1000));
}

function ClassicGamePlay({ gameCode, user, equippedSkinId, initialGame }) {
  const navigate = useNavigate();
  const userSettings = JSON.parse(localStorage.getItem('blazes_settings') || '{}');
  const timerWarnings = userSettings.timer_warnings !== 0;

  // Notify server when player leaves (tab close, navigate away)
  useEffect(() => {
    if (!user?.id) return;
    const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
    const sendLeave = () => {
      try {
        navigator.sendBeacon(`${base}/api/games/${gameCode}/leave`,
          new Blob([JSON.stringify({ userId: user.id })], { type: 'application/json' }));
      } catch (_) {}
    };
    window.addEventListener('beforeunload', sendLeave);
    return () => window.removeEventListener('beforeunload', sendLeave);
  }, [gameCode, user]);

  const [game, setGame] = useState(initialGame);
  const [questions, setQuestions] = useState(initialGame?.questions || []);
  const [questionQueue, setQuestionQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(() => computeTimeLeft(initialGame));
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [bbPopup, setBbPopup] = useState({ show: false, amount: 0 });
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [liveLeaderboard, setLiveLeaderboard] = useState([]);
  const [assignmentMinQuestions, setAssignmentMinQuestions] = useState(null);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [lastCorrect, setLastCorrect] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [matchSelections, setMatchSelections] = useState({});
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [dragMatchItem, setDragMatchItem] = useState(null);
  const [dragOverLeft, setDragOverLeft] = useState(null);
  const [assignmentMinAccuracy, setAssignmentMinAccuracy] = useState(null);
  const [assignmentCompleted, setAssignmentCompleted] = useState(false);

  // Assignments are coursework, not a competition: no trophy score and no host
  // Finish button. Regular game modes keep both.
  const isAssignment = !!initialGame?.assignment_id;
  const liveAccuracy = questionsAnswered > 0 ? Math.round((correctCount / questionsAnswered) * 100) : 0;

  // Poll live leaderboard while the modal is open so the player can see
  // their rank update in near-real time without leaving the game.
  // Must stay below the useState calls above: the dependency array is evaluated
  // during render, so declaring it earlier read showLeaderboard in its TDZ and
  // threw "Cannot access 'showLeaderboard' before initialization" every render.
  useEffect(() => {
    if (!showLeaderboard) return;
    const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
    const fetchLb = async () => {
      try {
        const r = await fetch(`${base}/api/games/${gameCode}`);
        if (!r.ok) return;
        const d = await r.json();
        const sorted = [...(d.participants || [])].sort((a, b) => (b.score || 0) - (a.score || 0));
        setLiveLeaderboard(sorted);
      } catch (_) {}
    };
    fetchLb();
    const id = setInterval(fetchLb, 2000);
    return () => clearInterval(id);
  }, [showLeaderboard, gameCode]);

  const scoreRef = useRef(0);
  const correctCountRef = useRef(0);
  const questionsAnsweredRef = useRef(0);
  const questionsRef = useRef(initialGame?.questions || []);
  const gameRef = useRef(initialGame);
  const gameOverCalledRef = useRef(false);
  const questionStartTimeRef = useRef(Date.now());
  const assignmentSubmittedRef = useRef(false);

  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { correctCountRef.current = correctCount; }, [correctCount]);
  useEffect(() => { questionsAnsweredRef.current = questionsAnswered; }, [questionsAnswered]);
  useEffect(() => { questionsRef.current = questions; }, [questions]);
  useEffect(() => { gameRef.current = game; }, [game]);

  useEffect(() => {
    if (!initialGame) return;
    const qs = initialGame.questions || [];
    setQuestions(qs);
    questionsRef.current = qs;
    const shuffled = [...Array(qs.length).keys()].sort(() => Math.random() - 0.5);
    setQuestionQueue(shuffled);
    if (initialGame.settings?.timeLimit) setTimeLeft(initialGame.settings.timeLimit);
    
    // If this is an assignment, fetch assignment details for progress bar
    if (initialGame.assignment_id) {
      const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
      fetch(`${base}/api/assignments/${initialGame.assignment_id}`)
        .then(r => r.json())
        .then(data => {
          const reqs = typeof data.requirements === 'string' ? JSON.parse(data.requirements) : data.requirements;
          if (reqs?.min_questions) {
            setAssignmentMinQuestions(reqs.min_questions);
          }
          if (reqs?.min_accuracy) {
            setAssignmentMinAccuracy(reqs.min_accuracy);
          }
        })
        .catch(err => console.log('Could not fetch assignment:', err));
    }
    
    // If this is an assignment resume, load initial progress
    if (initialGame.assignment_id && user?.id && gameCode) {
      const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
      fetch(`${base}/api/games/${gameCode}/student/${user.id}/answers`)
        .then(r => r.json())
        .then(data => {
          if (data?.answers && data.answers.length > 0) {
            setQuestionsAnswered(data.answers.length);
            questionsAnsweredRef.current = data.answers.length;
            setScore(data.totalScore || 0);
            scoreRef.current = data.totalScore || 0;
            setCorrectCount(data.correctCount || 0);
            correctCountRef.current = data.correctCount || 0;
            // Set question number to next question to answer
            setQuestionNumber(data.answers.length + 1);
            // Skip to the next unanswered question
            const answeredQIds = new Set(data.answers.map(a => a.question_id));
            const firstUnansweredIdx = shuffled.findIndex(idx => !answeredQIds.has(qs[idx].id));
            if (firstUnansweredIdx >= 0) setQueueIndex(firstUnansweredIdx);
          }
        })
        .catch(err => console.log('Could not fetch progress:', err));
    }
  }, []);

  const submitScore = useCallback(async () => {
    const currentUser = JSON.parse(localStorage.getItem('user') || 'null');
    if (!currentUser) return null;
    try {
      const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
      const payload = {
        userId: currentUser.id,
        finalScore: scoreRef.current,
        questionsAnswered: questionsAnsweredRef.current,
        correctCount: correctCountRef.current,
        totalQuestions: questionsRef.current.length
      };
      console.log('Submitting score:', payload);
      const res = await fetch(`${base}/api/games/${gameCode}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      console.log('Score submission response:', result);
      return result;
    } catch (err) {
      console.error('Error submitting score:', err);
      return null;
    }
  }, [gameCode]);

  const handleGameOver = useCallback(async () => {
    if (gameOverCalledRef.current) return;
    gameOverCalledRef.current = true;
    const currentUser = JSON.parse(localStorage.getItem('user') || 'null');
    const finalScore = scoreRef.current;
    const finalCorrect = correctCountRef.current;
    const finalAnswered = questionsAnsweredRef.current;
    const totalQs = questionsRef.current.length;
    const currentGame = gameRef.current;
    let bbEarned = 0;
    let xpEarned = 0;
    if (currentUser && currentGame) {
      try {
        const data = await submitScore();
        bbEarned = data?.bbEarned || 0;
        xpEarned = data?.xpEarned || 0;
      } catch (_) { }
      try {
        const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
        fetch(`${base}/api/achievements/check/${currentUser.id}`, { method: 'POST' });
      } catch (_) { }
    }
    if (bbEarned > 0 || xpEarned > 0) {
      setBbPopup({ show: true, amount: bbEarned, xp: xpEarned });
      await new Promise(r => setTimeout(r, 2500));
    }
    // GamePlay is the playing tab — always show student-style results here.
    // (The teacher monitor tab shows teacher-results separately.)
    navigate(`/game/results/${gameCode}`, { state: { score: finalScore, correctCount: finalCorrect, questionsAnswered: finalAnswered, totalQuestions: totalQs, game: currentGame, bbEarned, xpEarned } });
  }, [gameCode, navigate]);

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
        const data = await (await fetch(`${base}/api/games/${gameCode}`)).json();
        if (data.status === 'ended') { handleGameOver(); return; }
        // Re-sync timer only when drift > 1s to avoid visual skips
        const synced = computeTimeLeft(data);
        if (synced !== null) setTimeLeft(prev => Math.abs(synced - prev) > 1 ? synced : prev);
      } catch (_) { }
    }, 3000);
    return () => clearInterval(poll);
  }, [gameCode, handleGameOver]);

  useEffect(() => {
    if (!game?.settings || game.settings.endless || timeLeft === null) return;
    if (timeLeft <= 0) { handleGameOver(); return; }
    const t = setInterval(() => setTimeLeft(p => p - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft, game, handleGameOver]);

  const handleNextQuestion = useCallback(() => {
    // Check if assignment requirements are met
    if (initialGame?.assignment_id && assignmentMinQuestions && questionsAnsweredRef.current >= assignmentMinQuestions) {
      const currentAccuracy = questionsAnsweredRef.current > 0 ? Math.round((correctCountRef.current / questionsAnsweredRef.current) * 100) : 0;
      const accuracyMet = !assignmentMinAccuracy || currentAccuracy >= assignmentMinAccuracy;
      const questionsMet = questionsAnsweredRef.current >= assignmentMinQuestions;

      if (questionsMet && accuracyMet) {
        // Persist as soon as the requirements are met, not when the modal button is
        // pressed — closing the tab on the completion screen used to discard the whole
        // run (no completion, no notification, no season XP).
        if (!assignmentSubmittedRef.current) {
          assignmentSubmittedRef.current = true;
          submitScore();
        }
        setAssignmentCompleted(true);
        return;
      }
    }

    setSelectedOption(null); setIsAnswered(false); setLastCorrect(null);
    setQuestionNumber(p => p + 1);
    questionStartTimeRef.current = Date.now();
    setQueueIndex(prev => {
      const next = prev + 1;
      if (next < questionQueue.length) return next;
      setQuestionQueue([...Array(questionsRef.current.length).keys()].sort(() => Math.random() - 0.5));
      return 0;
    });
  }, [questionQueue.length, initialGame?.assignment_id, assignmentMinQuestions, assignmentMinAccuracy, submitScore]);

  // Assignment runs have no timer and no host Finish button, so without this the
  // only way out is meeting every requirement — a student who can't reach the
  // accuracy gate would otherwise be stuck in the quiz with no exit.
  const handleAssignmentExit = useCallback(async () => {
    if (!assignmentSubmittedRef.current) {
      assignmentSubmittedRef.current = true;
      await submitScore();
    }
    navigate('/home/student?tab=classrooms');
  }, [submitScore, navigate]);

  const handleAnswer = async (optionIndex) => {
    if (isAnswered) return;
    setSelectedOption(optionIndex); setIsAnswered(true);
    const newAnswered = questionsAnsweredRef.current + 1;
    setQuestionsAnswered(newAnswered); questionsAnsweredRef.current = newAnswered;
    const currentQuestion = questions[questionQueue[queueIndex]];
    // True/False kits sometimes store correctAnswer as the string "True"/"False"
    // and sometimes as a numeric 0/1. Normalize both before comparing so the
    // wrong-answer path doesn't fire just because the shape differed.
    const ca = currentQuestion.correctAnswer;
    const tf = (currentQuestion.answerType || currentQuestion.answer_type) === 'true_false';
    const isCorrect = tf
      ? (Number(ca) === optionIndex || String(ca).toLowerCase() === (optionIndex === 0 ? 'true' : 'false'))
      : (optionIndex === ca);
    if (isCorrect) {
      const nc = correctCountRef.current + 1; setCorrectCount(nc); correctCountRef.current = nc;
    }
    if (user && currentQuestion.id) {
      const timeTaken = parseFloat(((Date.now() - questionStartTimeRef.current) / 1000).toFixed(1));
      try {
        const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
        const res = await fetch(`${base}/api/games/${gameCode}/answer`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, questionId: currentQuestion.id, selectedAnswer: String(optionIndex), isCorrect, timeTaken })
        });
        const data = await res.json().catch(() => ({}));
        const pts = Number(data?.pointsEarned) || 0;
        if (pts > 0) {
          const ns = scoreRef.current + pts; setScore(ns); scoreRef.current = ns;
        }
      } catch (_) { }
    }
    setTypedAnswer('');
    setTimeout(handleNextQuestion, 1500);
  };

  // answerOverride: the image_label buttons call this straight after setTypedAnswer(),
  // and setState is async — reading typedAnswer here got the PREVIOUS click's value,
  // so the first tap did nothing and the second graded the label tapped before it.
  const handleShortAnswer = async (answerOverride) => {
    if (isAnswered) return;
    const answer = answerOverride ?? typedAnswer;
    const currentQCheck = questions[questionQueue[queueIndex]];
    if (currentQCheck.answerType !== 'ordering' && currentQCheck.answerType !== 'matching' && !answer.trim()) return;
    const currentQ = questions[questionQueue[queueIndex]];
    let isCorrect;
    if (currentQ.answerType === 'math_equation') {
      const userVal = parseFloat(answer.trim());
      const correctVal = parseFloat(currentQ.correctAnswer);
      isCorrect = !isNaN(userVal) && !isNaN(correctVal) && Math.abs(userVal - correctVal) <= Math.abs(correctVal * 0.01) + 0.001;
    } else if (currentQ.answerType === 'multi_select') {
      const userLetters = answer.split('').sort().join('');
      const correctLetters = String(currentQ.correctAnswer).split('').sort().join('');
      isCorrect = userLetters === correctLetters;
    } else if (currentQ.answerType === 'image_label' && Array.isArray(currentQ.correctAnswer)) {
      isCorrect = currentQ.correctAnswer.some(p => p.label.toLowerCase() === answer.trim().toLowerCase());
    } else if (currentQ.answerType === 'ordering' && Array.isArray(currentQ.correctAnswer)) {
      isCorrect = orderItems.length === currentQ.correctAnswer.length && orderItems.every((item, idx) => item === currentQ.correctAnswer[idx]);
    } else if (currentQ.answerType === 'matching') {
      const correct = currentQ.correctAnswer;
      if (Array.isArray(correct)) {
        isCorrect = correct.every(pair => matchSelections[pair.left] === pair.right);
      } else {
        isCorrect = false;
      }
    } else {
      // Short answer / fill blank — check exact first, then AI
      const exactMatch = answer.trim().toLowerCase() === String(currentQ.correctAnswer).toLowerCase();
      if (exactMatch) {
        isCorrect = true;
      } else {
        try {
          const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
          const resp = await fetch(`${base}/api/check-answer`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userAnswer: answer.trim(), correctAnswer: String(currentQ.correctAnswer), questionText: currentQ.text })
          });
          const data = await resp.json();
          isCorrect = data.isCorrect;
        } catch {
          isCorrect = false;
        }
      }
    }
    setSelectedOption(answer.trim());
    // Keep the verdict we just computed. The banner used to re-derive it with an
    // exact string compare, which disagreed with the real grading — math_equation
    // uses a 1% tolerance, so "3.0" for "3" scored points but rendered "Wrong!".
    setLastCorrect(isCorrect);
    setIsAnswered(true);
    const newAnswered = questionsAnsweredRef.current + 1;
    setQuestionsAnswered(newAnswered); questionsAnsweredRef.current = newAnswered;
    if (isCorrect) {
      const nc = correctCountRef.current + 1; setCorrectCount(nc); correctCountRef.current = nc;
    }
    if (user && currentQ.id) {
      const timeTaken = parseFloat(((Date.now() - questionStartTimeRef.current) / 1000).toFixed(1));
      const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
      fetch(`${base}/api/games/${gameCode}/answer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, questionId: currentQ.id, selectedAnswer: answer.trim(), isCorrect, timeTaken })
      })
        .then(r => r.json().catch(() => ({})))
        .then(data => {
          const pts = Number(data?.pointsEarned) || 0;
          if (pts > 0) {
            const ns = scoreRef.current + pts; setScore(ns); scoreRef.current = ns;
          }
        })
        .catch(() => {});
    }
    setTypedAnswer('');
    setTimeout(() => {
      setOrderItems([]);
      setMatchSelections({});
      handleNextQuestion();
    }, 1500);
  };

  const rawQuestion = questions[questionQueue[queueIndex]];
  if (!rawQuestion) return <div className="min-h-screen flex items-center justify-center">No questions available.</div>;
  // True/False questions don't always carry an `options` array from the
  // backend (kits made with answer_type='true_false' often store no option
  // columns), so default it to ['True','False'] before render. Without this,
  // options.map would throw and the page would bounce to home.
  const currentQuestion = (() => {
    if (rawQuestion.answerType === 'true_false' && (!Array.isArray(rawQuestion.options) || rawQuestion.options.length === 0)) {
      return { ...rawQuestion, options: ['True', 'False'] };
    }
    return rawQuestion;
  })();
  const imgUrl = getFullImageUrl(currentQuestion.imageUrl || currentQuestion.image_url);

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-6">
      {/* Live leaderboard modal — opens from the header button so the player
          can see their current rank without leaving the game. Polls every 2s
          while open. */}
      {showLeaderboard && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowLeaderboard(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-lg font-black text-gray-900">Live Leaderboard</div>
                  <div className="text-xs font-bold text-gray-500">Updates every 2 seconds</div>
                </div>
              </div>
              <button onClick={() => setShowLeaderboard(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {liveLeaderboard.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm font-semibold">Waiting for scores…</div>
              ) : (
                <ul className="space-y-1.5">
                  {liveLeaderboard.slice(0, 10).map((p, i) => {
                    const isMe = p.user_id === user?.id;
                    const place = i + 1;
                    // Blazes flame palette: red leader, orange 2nd, amber 3rd.
                    const medal = place === 1 ? '#dc2626' : place === 2 ? '#f97316' : place === 3 ? '#fbbf24' : null;
                    return (
                      <li
                        key={p.user_id}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 ${isMe ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-transparent'}`}
                      >
                        <div className="w-8 text-center">
                          {place === 1 ? (
                            <Crown className="w-6 h-6 mx-auto" style={{ color: medal }} strokeWidth={2.5} />
                          ) : place <= 3 ? (
                            <Medal className="w-5 h-5 mx-auto" style={{ color: medal }} strokeWidth={2.5} />
                          ) : (
                            <span className="font-black text-gray-400 text-sm">{place}</span>
                          )}
                        </div>
                        <AvatarPreview skinId={p.avatar_skin || 'default'} initial={(p.player_name || '?')[0].toUpperCase()} size={36} userId={p.user_id} />
                        <div className="flex-1 min-w-0">
                          <div className="font-black text-sm truncate text-gray-900">
                            {p.player_name || 'Player'}{isMe && <span className="ml-2 text-xs text-blue-600">YOU</span>}
                          </div>
                        </div>
                        <div className="font-black tabular-nums text-gray-900">{p.score || 0}</div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {bbPopup.show && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-white text-gray-900 font-black px-4 sm:px-6 py-4 rounded-2xl shadow-2xl border-2 border-gray-200 animate-bounce">
          {(bbPopup.xp || 0) > 0 && (
            <div className="text-center">
              <div className="text-xl text-red-600">+{bbPopup.xp}</div>
              <div className="text-[10px] font-semibold text-gray-500">XP</div>
            </div>
          )}
          {(bbPopup.xp || 0) > 0 && (bbPopup.amount || 0) > 0 && <div className="w-px h-8 bg-gray-200" />}
          {(bbPopup.amount || 0) > 0 && (
            <div className="flex items-center gap-2">
              <img src="/blazes-coin.png" className="w-8 h-8" alt="coin" style={{ mixBlendMode: 'multiply' }} />
              <div>
                <div className="text-xl text-yellow-600">+{bbPopup.amount}</div>
                <div className="text-[10px] font-semibold text-gray-500">BlazesBucks</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Assignment Completion Modal */}
      {assignmentCompleted && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-4 sm:p-6 md:p-8 max-w-md w-full shadow-2xl text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" strokeWidth={3} />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">Assignment Complete! 🎉</h2>
            <p className="text-gray-600 mb-6">Great job! You've met all the requirements for this assignment.</p>
            <div className="bg-blue-50 rounded-xl p-4 mb-6 text-left">
              <p className="text-sm font-bold text-gray-700 mb-2">Results:</p>
              <p className="text-sm text-gray-600">Questions Answered: <span className="font-bold text-gray-900">{questionsAnswered}/{assignmentMinQuestions}</span></p>
              <p className="text-sm text-gray-600">Accuracy: <span className="font-bold text-gray-900">{questionsAnswered > 0 ? Math.round((correctCount / questionsAnswered) * 100) : 0}%</span></p>
              {assignmentMinAccuracy && <p className="text-sm text-gray-600">Required: <span className="font-bold text-gray-900">{assignmentMinAccuracy}%</span></p>}
            </div>
            {/* The score was already submitted the moment the requirements were met,
                so this is navigation only. */}
            <button
              onClick={() => navigate('/home/student?tab=classrooms')}
              className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors"
            >
              Return Home
            </button>
          </div>
        </div>
      )}
      
      <div className="max-w-4xl mx-auto flex items-center justify-between mb-4 sm:mb-8">
        <div className="flex items-center gap-2 sm:gap-3">
          <AvatarPreview skinId={equippedSkinId} initial={user?.name?.[0] || '?'} size={40} isPlus={isBlazesPlusCached()} />
          <span className="font-black text-lg sm:text-xl" style={{ color: getNameColor(equippedSkinId) }}>{user?.name || 'Player'}</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {!isAssignment && game?.host_id === user?.id && (
            <button onClick={async () => {
              try {
                const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
                await fetch(`${base}/api/games/${gameCode}/end`, { method: 'PUT' });
              } catch (_) {}
              handleGameOver();
            }}
              className="px-3 py-1.5 sm:px-4 sm:py-2 bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-600 rounded-xl text-xs sm:text-sm font-bold border border-gray-200 hover:border-red-200 transition-colors">
              Finish
            </button>
          )}
          {isAssignment && !assignmentCompleted && (
            <button onClick={handleAssignmentExit}
              title="Save your progress and go back"
              className="px-3 py-1.5 sm:px-4 sm:py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs sm:text-sm font-bold border border-gray-200 transition-colors">
              Save &amp; Exit
            </button>
          )}
          <button
            onClick={() => setShowLeaderboard(true)}
            title="View live leaderboard"
            className="flex items-center gap-1.5 sm:gap-2 bg-white hover:bg-blue-50 hover:border-blue-300 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl shadow-sm border border-gray-200 transition-colors"
          >
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            <span className="hidden sm:inline font-bold text-xs sm:text-sm text-gray-700">Leaderboard</span>
          </button>
          {!isAssignment && (
            <div className="flex items-center gap-1 sm:gap-2 bg-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl shadow-sm border border-gray-200">
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" />
              <span className="font-black text-sm sm:text-base text-gray-900">{score}</span>
            </div>
          )}
          {!game?.settings?.endless && timeLeft !== null && (
            <div className={`flex items-center gap-1 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl shadow-sm border text-sm sm:text-base ${timerWarnings && timeLeft < 30 ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-gray-200 text-gray-700'}`}>
              <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="font-bold">{formatTime(timeLeft)}</span>
            </div>
          )}
        </div>
      </div>
      <div className="max-w-4xl mx-auto">
        {initialGame?.assignment_id && assignmentMinQuestions && (
          <div className="mb-4 sm:mb-6 bg-white rounded-2xl p-4 sm:p-5 shadow-lg border-2 border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-gray-700">Assignment Progress</span>
              <span className="text-sm font-bold text-red-600">{questionsAnswered}/{assignmentMinQuestions}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
              <div className="bg-red-600 h-2.5 rounded-full transition-all" style={{ width: `${Math.min(100, (questionsAnswered / assignmentMinQuestions) * 100)}%` }}></div>
            </div>
            {/* Without this the accuracy gate is invisible: a student who has answered
                enough questions but is below the required accuracy sees no reason why
                the assignment hasn't completed. */}
            {assignmentMinAccuracy && (
              <div className="flex items-center justify-between mt-2 text-xs font-bold">
                <span className="text-gray-500">Accuracy needed: {assignmentMinAccuracy}%</span>
                <span className={liveAccuracy >= assignmentMinAccuracy ? 'text-green-600' : 'text-orange-600'}>
                  You: {liveAccuracy}%
                </span>
              </div>
            )}
          </div>
        )}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-lg border-2 border-gray-100 mb-4 sm:mb-6 text-center">
          <span className="inline-block px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs sm:text-sm font-bold mb-3 sm:mb-4">
            Question {questionNumber}{currentQuestion.answerType && currentQuestion.answerType !== 'multiple_choice' ? ` · ${currentQuestion.answerType.replace(/_/g, ' ')}` : ''}
          </span>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-gray-900 mb-2 whitespace-pre-line">{currentQuestion.text || currentQuestion.question_text}</h2>
          {currentQuestion.answerType === 'audio' && imgUrl && (
            <audio controls className="mx-auto mt-4" src={imgUrl}>Your browser does not support audio.</audio>
          )}
          {currentQuestion.answerType !== 'audio' && imgUrl && <img src={imgUrl} alt="" className="mt-4 max-h-48 mx-auto rounded-xl object-contain" />}
        </div>
        {currentQuestion.answerType === 'short_answer' || (currentQuestion.answerType === 'fill_blank' && (!currentQuestion.options || currentQuestion.options.length === 0)) || currentQuestion.answerType === 'math_equation' ? (
          <div className="max-w-lg mx-auto">
            {!isAnswered ? (
              <form onSubmit={(e) => { e.preventDefault(); handleShortAnswer(); }} className="space-y-3">
                <input
                  type={currentQuestion.answerType === 'math_equation' ? 'number' : 'text'}
                  step={currentQuestion.answerType === 'math_equation' ? 'any' : undefined}
                  value={typedAnswer}
                  onChange={(e) => setTypedAnswer(e.target.value)}
                  placeholder={currentQuestion.answerType === 'math_equation' ? 'Enter your answer...' : 'Type your answer...'}
                  autoFocus
                  className="w-full px-4 sm:px-6 py-4 border-2 border-gray-200 rounded-2xl text-lg font-bold text-gray-900 focus:border-blue-500 focus:outline-none transition-colors text-center"
                />
                <button type="submit" disabled={!typedAnswer.trim()}
                  className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-lg">
                  Submit Answer
                </button>
              </form>
            ) : (
              <div className={`p-6 rounded-2xl border-2 text-center ${
                lastCorrect ? 'bg-green-100 border-green-500' : 'bg-red-100 border-red-500'
              }`}>
                <div className="flex items-center justify-center gap-2 mb-2">
                  {lastCorrect
                    ? <Check className="w-6 h-6 text-green-600" />
                    : <X className="w-6 h-6 text-red-600" />
                  }
                  <span className="font-black text-lg">{lastCorrect ? 'Correct!' : 'Wrong!'}</span>
                </div>
                <p className="text-sm text-gray-600">Your answer: <span className="font-bold">{selectedOption}</span></p>
                {!lastCorrect && (
                  <p className="text-sm text-green-700 mt-1">Correct answer: <span className="font-bold">{currentQuestion.correctAnswer}</span></p>
                )}
              </div>
            )}
          </div>
        ) : currentQuestion.answerType === 'multi_select' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {currentQuestion.options.map((option, index) => {
              const letter = ['A','B','C','D'][index];
              const isCorrectOption = String(currentQuestion.correctAnswer || '').includes(letter);
              const isSelected = (typedAnswer || '').includes(letter);
              return (
                <button key={index}
                  onClick={() => {
                    if (isAnswered) return;
                    const cur = typedAnswer || '';
                    setTypedAnswer(cur.includes(letter) ? cur.replace(letter, '') : cur + letter);
                  }}
                  disabled={isAnswered}
                  className={`p-4 sm:p-6 rounded-xl sm:rounded-2xl text-left transition-all ${isAnswered
                    ? isCorrectOption ? 'bg-green-100 border-2 border-green-500 text-green-800'
                      : isSelected ? 'bg-red-100 border-2 border-red-500 text-red-800'
                      : 'bg-gray-50 border-2 border-gray-100 opacity-40'
                    : isSelected ? 'bg-blue-100 border-2 border-blue-500'
                    : 'bg-white border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-lg">{option}</span>
                    {isSelected && !isAnswered && <div className="w-5 h-5 bg-blue-500 rounded flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>}
                    {isAnswered && isCorrectOption && <Check className="w-6 h-6 text-green-600" />}
                    {isAnswered && isSelected && !isCorrectOption && <X className="w-6 h-6 text-red-600" />}
                  </div>
                </button>
              );
            })}
            {!isAnswered && (
              <button onClick={() => {
                if (!typedAnswer) return;
                handleShortAnswer();
              }} disabled={!typedAnswer}
                className="sm:col-span-2 py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-colors disabled:opacity-40 text-lg">
                Submit Selection
              </button>
            )}
          </div>
        ) : currentQuestion.answerType === 'image_label' && Array.isArray(currentQuestion.correctAnswer) ? (
          <div>
            {/* Image with pins */}
            <div className="relative rounded-xl overflow-hidden border-2 border-gray-200 mb-4">
              {imgUrl && <img src={imgUrl} alt="" className="w-full max-h-72 object-contain" />}
              {currentQuestion.correctAnswer.map((pin, i) => (
                <div key={i} style={{ position: 'absolute', left: `${pin.x}%`, top: `${pin.y}%`, transform: 'translate(-50%, -100%)' }}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shadow-lg border-2 border-white ${
                    isAnswered ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                  }`}>
                    {i + 1}
                  </div>
                  {isAnswered && (
                    <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap shadow">
                      {pin.label}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* Label options — tap to match to next unmatched pin */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentQuestion.options.map((label, i) => {
                const isCorrectLabel = currentQuestion.correctAnswer.some(p => p.label === label);
                return (
                  <button key={i} onClick={() => {
                    if (isAnswered) return;
                    setTypedAnswer(label);
                    // Pass the label explicitly — the state update above has not landed yet.
                    handleShortAnswer(label);
                  }} disabled={isAnswered}
                    className={`p-4 rounded-xl text-left transition-all ${isAnswered
                      ? isCorrectLabel ? 'bg-green-100 border-2 border-green-500' : 'bg-gray-50 border-2 border-gray-100 opacity-40'
                      : 'bg-white border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50'
                    }`}>
                    <span className="font-bold">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : currentQuestion.answerType === 'ordering' && Array.isArray(currentQuestion.correctAnswer) ? (
          <div className="max-w-lg mx-auto">
            {orderItems.length === 0 && currentQuestion.options.length > 0 && (() => { setTimeout(() => setOrderItems([...currentQuestion.options]), 0); return null; })()}
            <p className="text-sm text-gray-500 font-semibold mb-3 text-center">Drag items to reorder them</p>
            <div className="space-y-2">
              {(orderItems.length > 0 ? orderItems : currentQuestion.options).map((item, i) => (
                <div key={`${item}-${i}`}
                  draggable={!isAnswered}
                  onDragStart={() => setDragIdx(i)}
                  onDragOver={e => { e.preventDefault(); setDragOverIdx(i); }}
                  onDragLeave={() => setDragOverIdx(null)}
                  onDrop={e => {
                    e.preventDefault();
                    if (dragIdx === null || dragIdx === i) return;
                    const newOrder = [...orderItems.length > 0 ? orderItems : currentQuestion.options];
                    const dragged = newOrder.splice(dragIdx, 1)[0];
                    newOrder.splice(i, 0, dragged);
                    setOrderItems(newOrder);
                    setDragIdx(null);
                    setDragOverIdx(null);
                  }}
                  onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                  className={`p-4 rounded-xl font-bold transition-all flex items-center gap-3 select-none ${
                    isAnswered
                      ? (orderItems[i] === currentQuestion.correctAnswer[i] ? 'bg-green-100 border-2 border-green-500' : 'bg-red-100 border-2 border-red-500')
                      : dragOverIdx === i ? 'bg-blue-100 border-2 border-blue-500 scale-[1.02]'
                      : dragIdx === i ? 'opacity-50 border-2 border-gray-300 bg-gray-100'
                      : 'bg-white border-2 border-gray-200 hover:border-gray-300 cursor-grab active:cursor-grabbing'
                  }`}>
                  <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-black text-gray-500 flex-shrink-0">{i + 1}</span>
                  <span className="flex-1 text-gray-900">{item}</span>
                  {!isAnswered && <span className="text-gray-300 text-lg">⠿</span>}
                  {isAnswered && orderItems[i] === currentQuestion.correctAnswer[i] && <Check className="w-5 h-5 text-green-600" />}
                  {isAnswered && orderItems[i] !== currentQuestion.correctAnswer[i] && <X className="w-5 h-5 text-red-600" />}
                </div>
              ))}
            </div>
            {!isAnswered && (
              <button onClick={() => { setTypedAnswer('submit'); handleShortAnswer(); }}
                className="w-full mt-4 py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-colors text-lg">
                Submit Order
              </button>
            )}
            {isAnswered && (
              <div className="mt-3 text-center text-sm font-semibold text-gray-500">
                Correct: {currentQuestion.correctAnswer.join(' → ')}
              </div>
            )}
          </div>
        ) : currentQuestion.answerType === 'matching' && Array.isArray(currentQuestion.correctAnswer) ? (
          <div className="max-w-lg mx-auto">
            <p className="text-sm text-gray-500 font-semibold mb-3 text-center">Drag items from the right to match with the left</p>
            <div className="flex gap-4">
              {/* Left column — drop targets */}
              <div className="flex-1 space-y-2">
                {currentQuestion.correctAnswer.map((pair, i) => (
                  <div key={i}
                    onDragOver={e => { e.preventDefault(); setDragOverLeft(pair.left); }}
                    onDragLeave={() => setDragOverLeft(null)}
                    onDrop={e => {
                      e.preventDefault();
                      if (dragMatchItem) {
                        setMatchSelections(prev => ({ ...prev, [pair.left]: dragMatchItem }));
                        setDragMatchItem(null);
                        setDragOverLeft(null);
                      }
                    }}
                    className={`p-3 rounded-xl text-sm font-bold transition-all min-h-[52px] ${
                      isAnswered
                        ? matchSelections[pair.left] === pair.right ? 'bg-green-100 border-2 border-green-500 text-green-800' : 'bg-red-100 border-2 border-red-500 text-red-800'
                        : dragOverLeft === pair.left ? 'bg-blue-100 border-2 border-blue-500 text-blue-800'
                        : 'bg-white border-2 border-gray-200 text-gray-900'
                    }`}>
                    <div>{pair.left}</div>
                    {matchSelections[pair.left] && (
                      <div className={`mt-1 text-xs font-semibold flex items-center gap-1 ${isAnswered ? '' : 'text-blue-600'}`}>
                        → {matchSelections[pair.left]}
                        {!isAnswered && (
                          <button onClick={() => setMatchSelections(prev => { const n = {...prev}; delete n[pair.left]; return n; })}
                            className="ml-auto text-gray-400 hover:text-red-500">×</button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Right column — draggable items */}
              <div className="flex-1 space-y-2">
                {(currentQuestion.rightOptions || []).map((opt, j) => {
                  const isUsed = Object.values(matchSelections).includes(opt);
                  return (
                    <div key={j}
                      draggable={!isAnswered && !isUsed}
                      onDragStart={() => setDragMatchItem(opt)}
                      onDragEnd={() => setDragMatchItem(null)}
                      className={`p-3 rounded-xl text-sm font-bold transition-all min-h-[52px] select-none ${
                        isUsed ? 'opacity-30 border-2 border-dashed border-gray-200 text-gray-400'
                        : isAnswered ? 'bg-gray-50 border-2 border-gray-200 text-gray-500'
                        : dragMatchItem === opt ? 'opacity-50 border-2 border-gray-300 bg-gray-100'
                        : 'bg-red-50 border-2 border-red-200 text-red-800 cursor-grab active:cursor-grabbing hover:bg-red-100'
                      }`}>
                      {opt}
                      {!isUsed && !isAnswered && <span className="float-right text-red-300">⠿</span>}
                    </div>
                  );
                })}
              </div>
            </div>
            {!isAnswered && (
              <button
                onClick={() => {
                  if (!currentQuestion.correctAnswer.every(p => matchSelections[p.left])) return;
                  setTypedAnswer('submit');
                  handleShortAnswer();
                }}
                disabled={!currentQuestion.correctAnswer.every(p => matchSelections[p.left])}
                className="w-full mt-4 py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-colors text-lg disabled:opacity-40">
                Submit Matches
              </button>
            )}
            {isAnswered && (
              <div className="mt-3 text-center text-sm font-semibold text-gray-500">
                {currentQuestion.correctAnswer.map(p => `${p.left} → ${p.right}`).join(' · ')}
              </div>
            )}
          </div>
        ) : (currentQuestion.answerType === 'true_false' || currentQuestion.answer_type === 'true_false') ? (
          // Dedicated True/False branch — renders the two buttons literally,
          // never depending on currentQuestion.options. Kits that store T/F
          // questions without filling option_a/b (the common case) used to fall
          // into the default MC branch and crash on options.map.
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {[{ label: 'True', idx: 0 }, { label: 'False', idx: 1 }].map(({ label, idx }) => {
              const correct = Number(currentQuestion.correctAnswer) === idx
                || String(currentQuestion.correctAnswer).toLowerCase() === label.toLowerCase();
              const wasSelected = selectedOption === idx;
              return (
                <button
                  key={label}
                  onClick={() => handleAnswer(idx)}
                  disabled={isAnswered}
                  className={`p-5 sm:p-7 rounded-xl sm:rounded-2xl text-center font-black text-2xl transition-all ${isAnswered
                    ? correct ? 'bg-green-100 border-2 border-green-500 text-green-800'
                      : wasSelected ? 'bg-red-100 border-2 border-red-500 text-red-800'
                      : 'bg-gray-50 border-2 border-gray-100 opacity-40'
                    : 'bg-white border-2 border-gray-200 hover:border-red-500 hover:bg-red-50'}`}
                >
                  {label}
                  {isAnswered && correct && <Check className="inline-block w-5 h-5 ml-2 text-green-600" />}
                  {isAnswered && wasSelected && !correct && <X className="inline-block w-5 h-5 ml-2 text-red-600" />}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {(currentQuestion.options || []).map((option, index) => (
              <button key={index} onClick={() => handleAnswer(index)} disabled={isAnswered}
                className={`p-4 sm:p-6 rounded-xl sm:rounded-2xl text-left transition-all ${isAnswered
                  ? index === currentQuestion.correctAnswer ? 'bg-green-100 border-2 border-green-500 text-green-800'
                    : index === selectedOption ? 'bg-red-100 border-2 border-red-500 text-red-800'
                    : 'bg-gray-50 border-2 border-gray-100 opacity-40'
                  : 'bg-white border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-lg">{option}</span>
                  {isAnswered && index === currentQuestion.correctAnswer && <Check className="w-6 h-6 text-green-600" />}
                  {isAnswered && index === selectedOption && index !== currentQuestion.correctAnswer && <X className="w-6 h-6 text-red-600" />}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Survival game (synchronized rounds) ─────────────────────────────────────
function SurvivalGamePlay({ gameCode, user, equippedSkinId }) {
  const navigate = useNavigate();
  const [survivalData, setSurvivalData] = useState(null);
  const [myAnswerThisRound, setMyAnswerThisRound] = useState(null); // optionIndex I clicked
  const prevQuestionIndexRef = useRef(null);
  const prevRoundStatusRef = useRef(null);
  const [bbPopup, setBbPopup] = useState({ show: false, amount: 0 });
  const [displayTimeLeft, setDisplayTimeLeft] = useState(null);
  const [tick, setTick] = useState(0);
  const [suddenDeathFlash, setSuddenDeathFlash] = useState(false);
  const suddenDeathSeenRef = useRef(false);
  const gameOverCalledRef = useRef(false);
  const submitLockRef = useRef(false); // prevent double submit
  const myScoreRef = useRef(0);
  const correctCountRef = useRef(0);
  const questionsAnsweredRef = useRef(0);

  const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

  const handleGameOver = useCallback(async () => {
    if (gameOverCalledRef.current) return;
    gameOverCalledRef.current = true;
    const currentUser = JSON.parse(localStorage.getItem('user') || 'null');
    let bbEarned = 0;
    if (currentUser) {
      try {
        const res = await fetch(`${base}/api/games/${gameCode}/answers`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUser.id, finalScore: myScoreRef.current, questionsAnswered: questionsAnsweredRef.current, correctCount: correctCountRef.current, totalQuestions: questionsAnsweredRef.current })
        });
        bbEarned = (await res.json()).bbEarned || 0;
      } catch (_) { }
    }
    if (bbEarned > 0) {
      setBbPopup({ show: true, amount: bbEarned });
      await new Promise(r => setTimeout(r, 2500));
    }
    navigate(`/game/results/${gameCode}`, { state: { score: myScoreRef.current, correctCount: correctCountRef.current, questionsAnswered: questionsAnsweredRef.current, totalQuestions: questionsAnsweredRef.current, bbEarned } });
  }, [gameCode, navigate]);

  // Poll survival-state every 1.5s
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`${base}/api/games/${gameCode}/survival-state?userId=${user?.id || ''}`);
        if (!res.ok) return;
        const data = await res.json();
        setSurvivalData(data);
        // Keep score ref in sync with server
        const me = data.participants?.find(p => p.user_id === user?.id);
        if (me) myScoreRef.current = me.score || 0;
        if (data.status === 'ended' && !gameOverCalledRef.current) handleGameOver();
      } catch (_) { }
    };
    poll();
    const interval = setInterval(poll, 1500);
    return () => clearInterval(interval);
  }, [gameCode, user?.id, handleGameOver]);

  // Force re-renders during countdown so the computed value stays fresh
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 100);
    return () => clearInterval(t);
  }, []);

  // Detect sudden death activation
  useEffect(() => {
    if (survivalData?.sudden_death === 1 && !suddenDeathSeenRef.current) {
      suddenDeathSeenRef.current = true;
      setSuddenDeathFlash(true);
      setTimeout(() => setSuddenDeathFlash(false), 3000);
    }
  }, [survivalData?.sudden_death]);

  // Reset my answer when the question index changes (most reliable signal of a new round)
  useEffect(() => {
    if (!survivalData) return;
    const qi = survivalData.current_question_index ?? 0;
    const rs = survivalData.round_status;
    // Question index changed → definitely a new round
    if (prevQuestionIndexRef.current !== null && qi !== prevQuestionIndexRef.current) {
      setMyAnswerThisRound(null);
      submitLockRef.current = false;
    }
    // Round status went to 'answering' from anything else → new round
    if (rs === 'answering' && prevRoundStatusRef.current && prevRoundStatusRef.current !== 'answering') {
      setMyAnswerThisRound(null);
      submitLockRef.current = false;
    }
    prevQuestionIndexRef.current = qi;
    prevRoundStatusRef.current = rs;
  }, [survivalData?.current_question_index, survivalData?.round_status]);

  // Sync local countdown timer from server poll data
  useEffect(() => {
    if (!survivalData) return;
    const serverTime = survivalData.roundTimeLeft;
    if (survivalData.round_status !== 'answering' || serverTime == null) {
      setDisplayTimeLeft(null);
      return;
    }
    // Only hard-sync when difference > 1.5s (one poll interval) to avoid jumps
    setDisplayTimeLeft(prev => {
      if (prev == null || Math.abs(prev - serverTime) > 1.5) return Math.round(serverTime);
      return prev;
    });
  }, [survivalData]);

  // Local 1-second countdown between polls
  useEffect(() => {
    if (displayTimeLeft == null || displayTimeLeft <= 0) return;
    const t = setTimeout(() => setDisplayTimeLeft(p => Math.max(0, (p ?? 0) - 1)), 1000);
    return () => clearTimeout(t);
  }, [displayTimeLeft]);

  const handleAnswer = async (optionIndex) => {
    if (myAnswerThisRound !== null || submitLockRef.current) return;
    if (survivalData?.round_status !== 'answering') return;
    submitLockRef.current = true;
    setMyAnswerThisRound(optionIndex);

    const currentQ = survivalData.questions?.[survivalData.current_question_index || 0];
    if (!currentQ || !user) return;
    const isCorrect = optionIndex === currentQ.correctAnswer;
    questionsAnsweredRef.current += 1;
    if (isCorrect) correctCountRef.current += 1;
    const timeTaken = 0;
    try {
      await fetch(`${base}/api/games/${gameCode}/answer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, questionId: currentQ.id, selectedAnswer: String(optionIndex), isCorrect, timeTaken })
      });
    } catch (_) { }
  };

  if (!survivalData) return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white font-bold">Loading...</div>;

  // Countdown is handled in the lobby — skip if round hasn't started yet
  if (survivalData.round_started_at) {
    const s = survivalData.round_started_at;
    const target = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z').getTime();
    if (target > Date.now()) {
      return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white font-bold">Starting...</div>;
    }
  }

  const questions = survivalData.questions || [];
  const currentQ = questions[survivalData.current_question_index || 0];
  const myParticipant = survivalData.participants?.find(p => p.user_id === user?.id);
  const livesTotal = survivalData.settings?.livesPerPlayer || 3;
  const livesLeft = myParticipant?.lives ?? livesTotal;
  const isEliminated = myParticipant?.eliminated === 1;
  const roundStatus = survivalData.round_status || 'answering';
  const roundTimeLeft = survivalData.roundTimeLeft;

  // Use LOCAL click state as single source of truth (server myRoundAnswer can be stale across rounds)
  const hasAnswered = myAnswerThisRound !== null;
  const selectedOptionIndex = myAnswerThisRound ?? -1;
  const roundIsCorrect = hasAnswered && currentQ ? myAnswerThisRound === currentQ.correctAnswer : false;

  // Show results: correct/wrong colors
  const showResults = roundStatus === 'results';

  // Eliminated screen
  if (isEliminated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 sm:p-6">
        <div className="text-center">
          <Skull className="w-16 h-16 sm:w-20 sm:h-20 text-red-500 mx-auto mb-6" strokeWidth={2} />
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-3">Eliminated!</h1>
          <p className="text-gray-400 text-lg sm:text-xl mb-8">You ran out of lives. Better luck next time!</p>
          <div className="flex gap-2 justify-center mb-8">
            {Array.from({ length: livesTotal }).map((_, i) => <Heart key={i} className="w-8 h-8 text-gray-600" />)}
          </div>
          <p className="text-gray-500 text-sm mb-6">Final Score: <span className="text-white font-black">{myParticipant?.score || 0}</span></p>
          <button onClick={handleGameOver} className="bg-red-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-red-700 transition-colors">
            See Results
          </button>
        </div>
      </div>
    );
  }

  if (!currentQ) return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">Loading question...</div>;
  const imgUrl = getFullImageUrl(currentQ.imageUrl || currentQ.image_url);

  const aliveCount = survivalData.participants?.filter(p => !p.eliminated).length || 0;
  const isSuddenDeath = survivalData.sudden_death === 1;

  return (
    <div className={`min-h-screen p-3 sm:p-6 ${isSuddenDeath ? 'bg-gray-950' : 'bg-gray-900'}`}>
      {/* Sudden Death full-screen flash */}
      {suddenDeathFlash && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-red-950/95 animate-pulse">
          <div className="text-center">
            <Skull className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 text-red-500 mx-auto mb-4" strokeWidth={2.5} />
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-red-500 mb-2 tracking-tight">SUDDEN DEATH</h1>
            <p className="text-red-300 font-bold text-base sm:text-lg md:text-xl">One wrong answer and you're out!</p>
          </div>
        </div>
      )}

      {bbPopup.show && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-white text-gray-900 font-black px-4 sm:px-6 py-4 rounded-2xl shadow-2xl border-2 border-gray-200 animate-bounce">
          {(bbPopup.xp || 0) > 0 && (
            <div className="text-center">
              <div className="text-xl text-red-600">+{bbPopup.xp}</div>
              <div className="text-[10px] font-semibold text-gray-500">XP</div>
            </div>
          )}
          {(bbPopup.xp || 0) > 0 && (bbPopup.amount || 0) > 0 && <div className="w-px h-8 bg-gray-200" />}
          {(bbPopup.amount || 0) > 0 && (
            <div className="flex items-center gap-2">
              <img src="/blazes-coin.png" className="w-8 h-8" alt="coin" style={{ mixBlendMode: 'multiply' }} />
              <div>
                <div className="text-xl text-yellow-600">+{bbPopup.amount}</div>
                <div className="text-[10px] font-semibold text-gray-500">BlazesBucks</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sudden Death persistent banner */}
      {isSuddenDeath && !suddenDeathFlash && (
        <div className="max-w-4xl mx-auto mb-3">
          <div className="flex items-center justify-center gap-2 bg-red-950 border-2 border-red-700 rounded-xl px-4 py-2">
            <Skull className="w-5 h-5 text-red-500" strokeWidth={2.5} />
            <span className="font-black text-red-400 text-sm tracking-wide">SUDDEN DEATH — One wrong answer eliminates you!</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="max-w-4xl mx-auto flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <AvatarPreview skinId={equippedSkinId} initial={user?.name?.[0] || '?'} size={40} isPlus={isBlazesPlusCached()} />
          <div>
            <span className="font-black text-base sm:text-lg" style={{ color: getNameColor(equippedSkinId) }}>{user?.name || 'Player'}</span>
            <div className="flex gap-0.5 mt-0.5">
              {Array.from({ length: livesTotal }).map((_, i) => (
                <Heart key={i} className={`w-4 h-4 ${i < livesLeft ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-center">
            <div className="text-xs text-gray-400 font-bold">ALIVE</div>
            <div className="text-xl font-black text-white">{aliveCount}</div>
          </div>
          <div className="flex items-center gap-1.5 bg-gray-800 px-3 py-1.5 rounded-xl border border-gray-700">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <span className="font-black text-white">{myParticipant?.score || 0}</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Timer bar */}
        {roundStatus === 'answering' && displayTimeLeft != null && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-gray-400">Time remaining</span>
              <span className={`text-lg font-black tabular-nums ${displayTimeLeft <= 5 ? 'text-red-400' : 'text-white'}`}>
                {formatTime(displayTimeLeft)}
              </span>
            </div>
            <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-none ${displayTimeLeft <= 5 ? 'bg-red-500' : 'bg-orange-500'}`}
                style={{ width: `${(displayTimeLeft / (survivalData.settings?.questionTimeLimit || 15)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Results phase banner */}
        {showResults && (
          <div className={`mb-4 p-3 rounded-xl text-center font-black text-lg flex items-center justify-center gap-2 ${roundIsCorrect ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
            {!hasAnswered ? <><Clock className="w-5 h-5 inline" /> Time&apos;s up — no answer!</>
              : roundIsCorrect ? <><Check className="w-5 h-5 inline" /> Correct!</>
              : <><X className="w-5 h-5 inline" /> Wrong!</>}
            {!roundIsCorrect && livesLeft > 0 && <span className="ml-2 font-bold text-sm">({livesLeft} {livesLeft === 1 ? 'life' : 'lives'} left)</span>}
            {!roundIsCorrect && livesLeft === 0 && <span className="ml-2 font-bold text-sm">— Eliminated next round</span>}
          </div>
        )}

        {/* Question */}
        <div className="bg-gray-800 rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-gray-700 mb-4 sm:mb-6 text-center">
          <span className="inline-block px-3 py-1 bg-gray-700 text-gray-300 rounded-full text-xs sm:text-sm font-bold mb-3 sm:mb-4">
            Question {(survivalData.current_question_index || 0) + 1}
          </span>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white whitespace-pre-line">{currentQ.text || currentQ.question_text}</h2>
          {imgUrl && <img src={imgUrl} alt="" className="mt-4 max-h-48 mx-auto rounded-xl object-contain" />}
        </div>

        {/* Waiting screen — shown after answering, hides the question so answers can't be shared */}
        {hasAnswered && roundStatus === 'answering' ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-full border-4 border-gray-700 border-t-orange-500 animate-spin" />
              <Lock className="w-8 h-8 text-orange-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" strokeWidth={2.5} />
            </div>
            <p className="text-white font-black text-2xl mb-2">Answer locked in!</p>
            <div className="flex items-center gap-2 text-gray-400 font-semibold">
              <Users className="w-4 h-4" />
              <span>Waiting for other players...</span>
            </div>
          </div>
        ) : (
          /* Options */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {currentQ.options.map((option, index) => {
              let cls = 'bg-gray-800 border-gray-600 text-gray-200 hover:border-blue-400 hover:bg-gray-700';
              if (showResults) {
                if (index === currentQ.correctAnswer) cls = 'bg-green-900 border-green-500 text-green-200';
                else if (index === selectedOptionIndex) cls = 'bg-red-900 border-red-500 text-red-200';
                else cls = 'bg-gray-800 border-gray-700 text-gray-500 opacity-50';
              }
              const disabled = showResults || roundStatus !== 'answering';
              return (
                <button key={index} onClick={() => handleAnswer(index)} disabled={disabled}
                  className={`p-4 sm:p-6 rounded-xl sm:rounded-2xl border-2 text-left transition-all ${cls} ${disabled ? 'cursor-default' : 'cursor-pointer'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-lg">{option}</span>
                    {showResults && index === currentQ.correctAnswer && <Check className="w-6 h-6 text-green-400" />}
                    {showResults && index === selectedOptionIndex && index !== currentQ.correctAnswer && <X className="w-6 h-6 text-red-400" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Router ───────────────────────────────────────────────────────────────────
export default function GamePlay() {
  const navigate = useNavigate();
  const { gameCode } = useParams();
  const location = useLocation();

  const [user] = useState(() => JSON.parse(localStorage.getItem('user') || 'null'));
  const [equippedSkinId, setEquippedSkinId] = useState('default');
  const [game, setGame] = useState(location.state?.game || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
    fetch(`${base}/api/skins/${user.id}`).then(r => r.json()).then(d => {
      if (d.equipped?.avatar_skin) setEquippedSkinId(d.equipped.avatar_skin);
    }).catch(() => {});
    fetch(`${base}/api/games/${gameCode}`).then(r => r.json()).then(d => {
      setGame(d); setLoading(false);
    }).catch(err => { setError(err.message); setLoading(false); });
  }, [gameCode, user, navigate]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50">Loading...</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-red-600">{error}</div>;
  if (!game) return null;

  if (game.game_mode === 'forge') {
    return <ForgeGamePlay gameCode={gameCode} user={user} />;
  }
  if (game.game_mode === 'elemental_clash') {
    return <ElementalClashGamePlay gameCode={gameCode} user={user} equippedSkinId={equippedSkinId} />;
  }
  if (game.game_mode === 'elemental_wager') {
    return <ElementalWagerGamePlay gameCode={gameCode} user={user} equippedSkinId={equippedSkinId} />;
  }
  if (game.game_mode === 'arena') {
    return <ArenaGamePlay gameCode={gameCode} user={user} equippedSkinId={equippedSkinId} />;
  }
  if (game.game_mode === 'elemental_markets') {
    return <ElementalMarketsGamePlay gameCode={gameCode} user={user} equippedSkinId={equippedSkinId} />;
  }
  return <ClassicGamePlay gameCode={gameCode} user={user} equippedSkinId={equippedSkinId} initialGame={game} />;
}
