import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Trophy, Home, Target, Zap } from 'lucide-react';

export default function GameStats() {
  const navigate = useNavigate();
  const location = useLocation();
  const { score, correctCount, totalQuestions } = location.state || { score: 0, correctCount: 0, totalQuestions: 0 };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-md w-full text-center">
            <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trophy className="w-10 h-10 text-yellow-600" />
            </div>
            
            <h1 className="text-3xl font-black text-gray-900 mb-2">Game Over!</h1>
            <p className="text-gray-600 mb-8">Great effort!</p>

            <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <div className="flex items-center justify-center gap-2 text-gray-500 mb-1">
                        <Zap className="w-4 h-4" />
                        <span className="text-sm font-bold">Score</span>
                    </div>
                    <div className="text-2xl font-black text-gray-900">{score}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <div className="flex items-center justify-center gap-2 text-gray-500 mb-1">
                        <Target className="w-4 h-4" />
                        <span className="text-sm font-bold">Accuracy</span>
                    </div>
                    <div className="text-2xl font-black text-gray-900">
                        {totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0}%
                    </div>
                </div>
            </div>

            <button onClick={() => navigate('/home/student')} className="w-full bg-gray-900 text-white font-bold py-4 rounded-xl hover:bg-gray-800 transition-colors flex items-center justify-center gap-2">
                <Home className="w-5 h-5" /> Back to Home
            </button>
        </div>
    </div>
  );
}