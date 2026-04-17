import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Flame, ArrowLeft, Zap, Clock, User, Trophy, XCircle } from 'lucide-react'; // Added Trophy, XCircle
import { AvatarPreview } from './SkinsPage';

export default function StudentMonitor() {
  const navigate = useNavigate();
  const { gameCode, userId } = useParams();
  const [studentData, setStudentData] = useState(null);
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gameEnded, setGameEnded] = useState(false); // New state for game end
  const [studentAnswers, setStudentAnswers] = useState([]);
  const [skinId, setSkinId] = useState('default');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

        // Fetch game data
        const gameResponse = await fetch(`${base}/api/games/${gameCode}`);
        const gameData = await gameResponse.json();
        setGame(gameData);
        setGameEnded(gameData.status === 'ended'); // Set gameEnded status

        // Get student participant info
        const student = gameData.participants.find(p => p.user_id === parseInt(userId));
        setStudentData(student);

        // Fetch student's answers for this game
        const answersResponse = await fetch(
          `${base}/api/games/${gameCode}/student/${userId}/answers`
        );
        if (answersResponse.ok) {
          const answersData = await answersResponse.json();
          setStudentAnswers(answersData);
        }

        // Fetch skin
        fetch(`${base}/api/skins/${userId}`)
          .then(r => r.json())
          .then(d => { if (d.equipped?.avatar_skin) setSkinId(d.equipped.avatar_skin); })
          .catch(() => {});

        setLoading(false);
      } catch (err) {
        console.error('Error fetching student data:', err);
        setLoading(false);
      }
    };

    fetchData();

    // Poll for updates every 2 seconds
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [gameCode, userId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Flame className="w-16 h-16 text-red-600 animate-pulse" />
      </div>
    );
  }

  if (!studentData || !game) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 font-semibold mb-4">Student not found</p>
          <button
            onClick={() => navigate(`/game/monitor/${gameCode}/all`)}
            className="px-6 py-2 bg-red-600 text-white font-bold rounded-lg"
          >
            Back to Game
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/game/monitor/${gameCode}/all`)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <div>
              <h1 className="text-lg sm:text-2xl font-black text-gray-900">
                Monitoring: {studentData.player_name}
              </h1>
              <p className="text-sm text-gray-600">Game: {gameCode}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-8">
            <div className="text-center">
              <div className="text-sm text-gray-600">Current Score</div>
              <div className="text-3xl font-black text-red-600">{studentData.score || 0}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600">Answers</div>
              <div className="text-3xl font-black text-gray-900">{studentAnswers.length}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Student Profile Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-8">
          <div className="flex items-center gap-6">
            <AvatarPreview skinId={skinId} initial={studentData.player_name?.charAt(0).toUpperCase() || 'S'} size={80} />
            <div className="flex-1">
              <h2 className="text-2xl font-black text-gray-900">{studentData.player_name}</h2>
              <p className="text-gray-600">Monitoring live gameplay</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600 mb-2">Status</div>
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold
                ${game.status === 'started' ? 'bg-green-100 text-green-700' :
                  game.status === 'ended' && studentData.is_eliminated ? 'bg-red-100 text-red-700' :
                    game.status === 'ended' && !studentData.is_eliminated ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                }
              `}>
                {game.status === 'started' && <div className="w-2 h-2 rounded-full bg-green-600 animate-pulse" />}
                {game.status === 'ended' && studentData.is_eliminated && <XCircle className="w-4 h-4 text-red-600" />}
                {game.status === 'ended' && !studentData.is_eliminated && <Trophy className="w-4 h-4 text-yellow-600" />}
                {game.status === 'started' ? 'Playing' :
                  game.status === 'ended' && studentData.is_eliminated ? 'Eliminated' :
                    game.status === 'ended' && !studentData.is_eliminated ? 'Won' :
                      'Waiting'
                }
              </div>
              {gameEnded && (studentData.is_eliminated ? <p className="text-xs text-red-500 mt-1">Bomb Exploded!</p> : <p className="text-xs text-yellow-500 mt-1">Game Time Limit!</p>)}
            </div>
          </div>
        </div>

        {/* Answers Timeline */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-xl font-black text-gray-900 mb-6">Answer Timeline</h3>

          {studentAnswers.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No answers yet. Waiting for student to answer...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {studentAnswers.map((answer, index) => (
                <div
                  key={answer.id}
                  className={`p-4 rounded-xl border-2 ${answer.is_correct
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                    }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${answer.is_correct ? 'bg-green-600' : 'bg-red-600'
                        }`}>
                        {index + 1}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900">Question {index + 1}</h4>
                        <p className="text-sm text-gray-600">{answer.question_text}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold text-sm mb-1 ${answer.is_correct ? 'text-green-700' : 'text-red-700'
                        }`}>
                        {answer.is_correct ? '✓ Correct' : '✗ Incorrect'}
                      </div>
                      <div className="text-xs text-gray-600">
                        {answer.time_taken}s
                      </div>
                    </div>
                  </div>

                  <div className="ml-11">
                    <p className="text-sm">
                      <span className="text-gray-600">Answered: </span>
                      <span className="font-bold text-gray-900">
                        {(() => {
                          const question = game.questions?.find(q => q.id === answer.question_id);
                          return question?.options?.[parseInt(answer.answer)] ?? answer.answer;
                        })()}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="mt-6 sm:mt-8 grid grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 text-center">
            <div className="text-sm text-gray-600 mb-2">Accuracy</div>
            <div className="text-3xl font-black text-gray-900">
              {studentAnswers.length > 0
                ? Math.round((studentAnswers.filter(a => a.is_correct).length / studentAnswers.length) * 100)
                : 0
              }%
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 text-center">
            <div className="text-sm text-gray-600 mb-2">Correct Answers</div>
            <div className="text-3xl font-black text-green-600">
              {studentAnswers.filter(a => a.is_correct).length}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 text-center">
            <div className="text-sm text-gray-600 mb-2">Avg Time</div>
            <div className="text-3xl font-black text-gray-900">
              {(() => {
                const timed = studentAnswers.filter(a => a.time_taken != null);
                return timed.length > 0
                  ? (timed.reduce((sum, a) => sum + a.time_taken, 0) / timed.length).toFixed(1) + 's'
                  : '—';
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
