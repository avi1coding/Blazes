import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Flame, Clock, CheckCircle, XCircle } from 'lucide-react';

export default function Regular() {
  const navigate = useNavigate();
  const location = useLocation();
  const { gameCode } = useParams();
  const [user, setUser] = useState(null);
  const [game, setGame] = useState(location.state?.game || null);
  const [timeLeft, setTimeLeft] = useState(0); // Game time left in seconds
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [isCorrect, setIsCorrect] = useState(null);
  const [gameEnded, setGameEnded] = useState(false); // New state to track if game has ended (win or lose)
  const [loading, setLoading] = useState(true);
  const [correctCount, setCorrectCount] = useState(0);
  const [questionsAttempted, setQuestionsAttempted] = useState(0);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      navigate('/login');
      return;
    }
    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);

    const fetchGameData = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000'}/api/games/${gameCode}/state`);
        const data = await response.json();
        
        if (!game && data) {
          setGame(data);
        }
        
        const gameDuration = data.settings?.gameplayTime || data.settings?.timeLimit || 0;
        const elapsedTime = data.gameTime || 0;
        const remainingTime = Math.max(0, gameDuration - elapsedTime);
        setTimeLeft(remainingTime);

        const currentPlayer = data.participants?.find(p => p.user_id === parsedUser.id);
        if (currentPlayer) setScore(currentPlayer.score || 0);

        if ((data.status === 'ended' || remainingTime <= 0) && !gameEnded) {
          setGameEnded(true);
        }

        if (data.kit_id && questions.length === 0) {
          const kitResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000'}/api/kits/${data.kit_id}`);
          const kitData = await kitResponse.json();
          setQuestions(kitData.questions || []);
        }
      } catch (err) {
        console.error("Error fetching game data:", err);
      } finally {
        setLoading(false);
      }
    };

    if (parsedUser) {
      fetchGameData();
      const interval = setInterval(fetchGameData, 1000);
      return () => clearInterval(interval);
    }
  }, [gameCode, navigate, user, game, questions.length, gameEnded]);

  useEffect(() => {
    if (!gameEnded) return;

    const submitFinalScoreAndNavigate = async () => {
      if (!user) return;
      try {
        await fetch(`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000'}/api/games/${gameCode}/answers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            finalScore: score,
            questionsAnswered: correctCount,
            totalQuestions: questionsAttempted,
          })
        });
      } catch (err) {
        console.error('Error submitting score:', err);
      }

      setTimeout(() => {
        navigate(`/game/results/${gameCode}`, {
          state: {
            score,
            questionsAnswered: correctCount,
            totalQuestions: questionsAttempted,
            hasWon: timeLeft > 0,
          }
        });
      }, 3000);
    };

    submitFinalScoreAndNavigate();
  }, [gameEnded, navigate, user, score, gameCode, correctCount, questionsAttempted, timeLeft]);

  const handleAnswerSelect = async (optionKey) => {
    const currentQuestion = questions[currentQuestionIndex];
    if (answered || !currentQuestion || !user) return;

    setQuestionsAttempted(prev => prev + 1);

    const selectedLetter = optionKey.split('_')[1].toUpperCase();
    const correctAnswerStr = currentQuestion.correct_answer || '';
    const correctLetters = correctAnswerStr
      .split(',')
      .map(answer => {
        const match = answer.trim().match(/[A-D]/i);
        return match ? match[0].toUpperCase() : null;
      })
      .filter(letter => letter !== null);

    const isAnswerCorrect = correctLetters.includes(selectedLetter);

    if (isAnswerCorrect) {
      setCorrectCount(prev => prev + 1);
    }

    setSelectedAnswer(optionKey);
    setIsCorrect(isAnswerCorrect);
    setAnswered(true);

    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000'}/api/games/${gameCode}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          questionId: currentQuestion.id,
          selectedAnswer: optionKey,
          isCorrect: isAnswerCorrect,
        }),
      });
    } catch (err) {
      console.error('Error sending answer to server:', err);
    }

    setTimeout(() => {
      if (currentQuestionIndex === questions.length - 1 && !game?.settings?.repeatQuestions) {
        setGameEnded(true);
      } else {
        const nextIndex = (currentQuestionIndex + 1) % questions.length;
        setCurrentQuestionIndex(nextIndex);
        setSelectedAnswer(null);
        setAnswered(false);
        setIsCorrect(null);
      }
    }, 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Flame className="w-16 h-16 text-red-600 animate-pulse" />
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-orange-500 text-white">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Flame className="w-8 h-8" />
            <span className="text-2xl font-black">{game?.settings?.gameName || 'Blazes Quiz'}</span>
          </div>
          <div className="flex items-center gap-8">
            {/* Score */}
            <div className="text-center">
              <div className="text-sm opacity-80">Score</div>
              <div className="text-2xl font-bold">{score}</div>
            </div>

            {/* Game Timer */}
            <div className="text-center flex items-center gap-2">
              <Clock className="w-5 h-5" />
              <div>
                <div className="text-sm opacity-80">Time Left</div>
                <div className={`text-2xl font-bold ${timeLeft <= 10 ? 'text-red-400 animate-pulse' : ''}`}>
                  {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                </div>
              </div>
            </div>

            {/* Question Progress */}
            <div className="text-center">
              <div className="text-sm opacity-80">Question</div>
              <div className="text-2xl font-bold">{questions.length > 0 ? `${currentQuestionIndex + 1}/${questions.length}` : 'N/A'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Question Area */}
      {currentQuestion && (
        <div className="max-w-4xl mx-auto px-6 py-12">
          {/* Question */}
          <div className="bg-white rounded-2xl p-8 mb-8 shadow-xl">
            <h2 className="text-3xl font-black text-gray-900 mb-2">
              {currentQuestion.question_text}
            </h2>
          </div>

          {/* Answer Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {['option_a', 'option_b', 'option_c', 'option_d'].map((optionKey, idx) => {
              const optionValue = currentQuestion[optionKey];
              if (!optionValue) return null;

              const isSelected = selectedAnswer === optionKey;
              // Get the letter from optionKey: 'option_a' -> 'A'
              const optionLetter = optionKey.split('_')[1].toUpperCase();
              // Check if this option is a correct answer
              // correct_answer could be "A", "Option A", "Option A, Option B", etc.
              const correctAnswerStr = currentQuestion.correct_answer || '';
              const correctLetters = correctAnswerStr
                .split(',')
                .map(answer => {
                  // Try to extract letter from "Option X" format or just use the letter
                  const match = answer.trim().match(/[A-D]/i);
                  return match ? match[0].toUpperCase() : null;
                })
                .filter(letter => letter !== null);
              const isCorrectAnswer = correctLetters.includes(optionLetter);
              const showCorrect = answered && isCorrectAnswer;
              const showIncorrect = answered && isSelected && !isCorrect;

              return (
                <button
                  key={optionKey}
                  onClick={() => handleAnswerSelect(optionKey)}
                  disabled={answered}
                  className={`p-6 rounded-xl font-bold text-lg transition-all text-left ${
                    showCorrect
                      ? 'bg-green-500 text-white border-2 border-green-600 scale-105'
                      : showIncorrect
                      ? 'bg-red-500 text-white border-2 border-red-600'
                      : isSelected && !answered
                      ? 'bg-blue-500 text-white border-2 border-blue-600'
                      : 'bg-white text-gray-900 border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50'
                  } ${answered ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center justify-between">
                    <span>{optionValue}</span>
                    {showCorrect && <CheckCircle className="w-6 h-6" />}
                    {showIncorrect && <XCircle className="w-6 h-6" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Feedback */}
          {answered && (
            <div className={`p-6 rounded-xl text-center font-bold text-lg ${
              isCorrect
                ? 'bg-green-100 text-green-700 border-2 border-green-300'
                : 'bg-red-100 text-red-700 border-2 border-red-300'
            }`} key={currentQuestionIndex}> {/* Add key to force re-render feedback */}
              {isCorrect ? (
                <>
                  <CheckCircle className="w-6 h-6 inline-block mr-2" />
                  Correct!
                </>
              ) : (
                <>
                  <XCircle className="w-6 h-6 inline-block mr-2" />
                  Incorrect. Next question...
                </>
              )}
            </div>
          )}
        </div>
      )}

      {!currentQuestion && (
        <div className="max-w-4xl mx-auto px-6 py-12 text-center text-white">
          <Flame className="w-24 h-24 mx-auto mb-6 animate-pulse" />
          <h2 className="text-4xl font-black mb-4">Loading Questions...</h2>
        </div>
      )}
    </div>
  );
}