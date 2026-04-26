import { useState } from 'react';
import { Flame, Trophy, Lock, Swords, ChevronRight, Users, Clock, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function GameModeSelect({ kit, user, onBack }) {
  const navigate = useNavigate();
  const [selectedMode, setSelectedMode] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' | 'solo' | 'multi'

  const gameModes = [
    {
      id: 'classic_timed',
      name: 'Classic Quiz',
      icon: Trophy,
      color: 'from-blue-500 to-green-500',
      accent: 'blue',
      tags: ['solo', 'multi'],
      description: 'The standard quiz experience. Students answer questions within a time limit set by you. Highest score wins.',
      difficulty: 'Easy',
      players: '1-30',
      duration: 'Set by host',
      features: [
        'Teacher sets the overall time limit',
        'Students answer at their own pace',
        'Most correct answers wins',
        'Great for quick assessments'
      ],
      available: true
    },
    {
      id: 'elemental_clash',
      name: 'Elemental Clash',
      icon: Swords,
      color: 'from-purple-500 to-indigo-600',
      accent: 'purple',
      tags: ['multi'],
      description: 'Team vs team battle. The class splits into two teams. Correct answers earn energy (personal) or points (team). Spend energy to buy elemental attacks that destroy the other team\'s score.',
      difficulty: 'Medium',
      players: '4-50',
      duration: '3-15 min',
      features: [
        'Auto-splits class into 2 teams',
        'Choose: +1 energy or +10 team points per correct answer',
        'Buy attacks: Earthquake, Tsunami, Hurricane, Wildfire',
        'Team with most points when time runs out wins'
      ],
      available: true
    },
    {
      id: 'elemental_wager',
      name: 'Risk & Reward',
      icon: Flame,
      color: 'from-amber-500 to-orange-600',
      accent: 'amber',
      tags: ['solo', 'multi'],
      description: 'Bet on your knowledge! Choose Rock (safe), Raindrop (balanced), or Torch (risky) before each question. Build answer streaks to upgrade your bets to higher tiers with bigger rewards and bigger risks.',
      difficulty: 'Medium',
      players: '1-50',
      duration: '1-10 min',
      features: [
        'Choose risk level before each question',
        'Build answer streaks to upgrade tiers',
        'Wrong answer resets your streak back to Tier 1',
        'Score can never go below zero'
      ],
      available: true
    },
    {
      id: 'race',
      name: 'Race',
      icon: Zap,
      color: 'from-cyan-500 to-blue-500',
      accent: 'cyan',
      tags: ['multi'],
      description: 'Sprint to the finish. First player to answer all questions correctly wins. Speed and accuracy both matter.',
      difficulty: 'Easy',
      players: '2-50',
      duration: '5-15 min',
      features: [
        'First to finish wins',
        'Accuracy matters',
        'Fast-paced action',
        'Competitive racing'
      ],
      available: false
    }
  ];

  const handleContinue = () => {
    if (selectedMode === 'classic_timed') navigate('/game/classic-timed-setup', { state: { kit, user } });
    else if (selectedMode === 'elemental_clash') navigate('/game/elemental-clash-setup', { state: { kit, user } });
    else if (selectedMode === 'elemental_wager') navigate('/game/elemental-wager-setup', { state: { kit, user } });
  };

  const selected = gameModes.find(m => m.id === selectedMode);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gray-900 mb-1">Choose Game Mode</h1>
        <p className="text-gray-500">Select how you want your students to play</p>
      </div>

      {/* Kit banner */}
      <div className="bg-gray-900 rounded-2xl px-4 sm:px-6 py-4 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center">
            <Flame className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <p className="font-black text-white">{kit.title}</p>
            <p className="text-gray-400 text-sm">{kit.question_count} questions &middot; {kit.subject} &middot; {kit.grade_level}</p>
          </div>
        </div>
        <button onClick={onBack} className="text-gray-400 text-sm font-bold hover:text-white transition-colors">Change Kit</button>
      </div>

      {/* Split layout: modes list on left, detail on right */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6 mb-8">
        {/* Left: Mode list */}
        <div className="md:col-span-1 lg:col-span-2">
          {/* Filter tabs */}
          <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl">
            {[['all', 'All'], ['solo', 'Solo'], ['multi', 'Multiplayer']].map(([key, label]) => (
              <button key={key} onClick={() => { setFilter(key); setSelectedMode(null); }}
                className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${filter === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
          {gameModes.filter(m => filter === 'all' || m.tags?.includes(filter)).map((mode) => {
            const Icon = mode.icon;
            const isSelected = selectedMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => mode.available && setSelectedMode(mode.id)}
                disabled={!mode.available}
                className={`w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all ${
                  !mode.available
                    ? 'opacity-40 cursor-not-allowed bg-gray-50'
                    : isSelected
                      ? 'bg-gray-900 text-white shadow-lg'
                      : 'bg-white border-2 border-gray-100 hover:border-gray-200 hover:shadow-sm'
                }`}
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isSelected ? 'bg-white/20' : `bg-gradient-to-br ${mode.color}`
                }`}>
                  <Icon className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-white'}`} strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-black text-sm ${isSelected ? 'text-white' : 'text-gray-900'}`}>{mode.name}</div>
                  <div className={`text-xs ${isSelected ? 'text-gray-300' : 'text-gray-500'}`}>
                    {mode.difficulty} &middot; {mode.players} players
                  </div>
                </div>
                {!mode.available ? (
                  <Lock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronRight className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-gray-300' : 'text-gray-400'}`} />
                )}
              </button>
            );
          })}
          </div>
        </div>

        {/* Right: Detail panel */}
        <div className="md:col-span-2 lg:col-span-3">
          {selected ? (
            <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 sm:p-6 md:p-8 h-full">
              {/* Mode header */}
              <div className="flex items-center gap-4 mb-6">
                <div className={`w-14 h-14 bg-gradient-to-br ${selected.color} rounded-2xl flex items-center justify-center shadow-lg`}>
                  <selected.icon className="w-7 h-7 text-white" strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-gray-900">{selected.name}</h2>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold ${
                      selected.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
                      selected.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>{selected.difficulty}</span>
                    {selected.tags?.includes('solo') && <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-blue-100 text-blue-700">Solo</span>}
                    {selected.tags?.includes('multi') && <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-purple-100 text-purple-700">Multiplayer</span>}
                    <span className="text-xs text-gray-500 flex items-center gap-1"><Users className="w-3 h-3" />{selected.players}</span>
                    <span className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" />{selected.duration}</span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className="text-gray-600 leading-relaxed mb-8">{selected.description}</p>

              {/* Features */}
              <div className="mb-8">
                <h4 className="text-sm font-black text-gray-900 mb-3 uppercase tracking-wider">Features</h4>
                <div className="space-y-3">
                  {selected.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${selected.color} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                        <span className="text-white text-[10px] font-black">{i + 1}</span>
                      </div>
                      <span className="text-sm text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Continue button */}
              <button
                onClick={handleContinue}
                className={`w-full py-4 rounded-xl font-black text-white transition-all hover:shadow-lg bg-gradient-to-r ${selected.color}`}
              >
                Continue with {selected.name}
              </button>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 p-4 sm:p-6 md:p-8 h-full flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                <Flame className="w-8 h-8 text-gray-300" />
              </div>
              <h3 className="font-black text-gray-400 text-lg mb-1">Select a Game Mode</h3>
              <p className="text-gray-400 text-sm max-w-xs">Click on a game mode from the list to see its details and features</p>
            </div>
          )}
        </div>
      </div>

      {/* Back button */}
      <button onClick={onBack} className="text-gray-500 font-bold hover:text-gray-700 transition-colors text-sm">
        &larr; Back to Kit Selection
      </button>
    </div>
  );
}
