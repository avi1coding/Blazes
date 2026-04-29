import { useState } from 'react';
import { Flame, Trophy, Lock, Swords, ChevronRight, Users, Clock, Zap, Crown, Dice5, Rocket, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function GameModeSelect({ kit, user, onBack }) {
  const navigate = useNavigate();
  const [selectedMode, setSelectedMode] = useState(null);
  const [filter, setFilter] = useState('all');

  const gameModes = [
    {
      id: 'classic_timed',
      name: 'Classic Quiz',
      tagline: 'The classic. Highest score wins.',
      icon: Trophy,
      gradient: 'from-amber-400 via-yellow-500 to-orange-500',
      glow: 'shadow-amber-500/40',
      accent: 'amber',
      pattern: 'radial-gradient(circle at 20% 20%, rgba(251, 191, 36, 0.15), transparent 50%), radial-gradient(circle at 80% 80%, rgba(249, 115, 22, 0.15), transparent 50%)',
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
      tagline: 'Team vs team. Pick a side.',
      icon: Swords,
      gradient: 'from-red-500 via-purple-500 to-blue-500',
      glow: 'shadow-purple-500/40',
      accent: 'purple',
      pattern: 'radial-gradient(circle at 0% 50%, rgba(239, 68, 68, 0.2), transparent 50%), radial-gradient(circle at 100% 50%, rgba(59, 130, 246, 0.2), transparent 50%)',
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
      tagline: 'Bet big or play safe.',
      icon: Dice5,
      gradient: 'from-orange-500 via-amber-500 to-red-600',
      glow: 'shadow-orange-500/40',
      accent: 'orange',
      pattern: 'radial-gradient(circle at 30% 70%, rgba(249, 115, 22, 0.2), transparent 50%), radial-gradient(circle at 70% 30%, rgba(220, 38, 38, 0.2), transparent 50%)',
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
    ...(user?.role === 'teacher' ? [{
      id: 'arena',
      name: 'Arena',
      tagline: 'Strategic battle quiz. No mercy.',
      icon: Crown,
      gradient: 'from-fuchsia-600 via-purple-600 to-indigo-700',
      glow: 'shadow-fuchsia-500/50',
      accent: 'fuchsia',
      pattern: 'radial-gradient(circle at 25% 25%, rgba(217, 70, 239, 0.25), transparent 50%), radial-gradient(circle at 75% 75%, rgba(99, 102, 241, 0.25), transparent 50%)',
      tags: ['solo', 'multi', 'teacher'],
      description: 'Strategic battle quiz. Earn coins, buy attacks/shields, build combos, and survive random world events. Teacher exclusive.',
      difficulty: 'Hard',
      players: '1-50',
      duration: '5-20 min',
      features: [
        'Shop with attacks, shields, and power-ups',
        'Combo system — streaks unlock huge bonuses',
        '7 random world events keep things chaotic',
        'No deaths — everyone plays the whole game'
      ],
      available: true,
      teacherOnly: true,
    }] : []),
    {
      id: 'race',
      name: 'Race',
      tagline: 'First to the finish wins.',
      icon: Rocket,
      gradient: 'from-cyan-400 via-sky-500 to-blue-600',
      glow: 'shadow-cyan-500/40',
      accent: 'cyan',
      pattern: 'radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.2), transparent 60%)',
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
    else if (selectedMode === 'arena') navigate('/game/arena-setup', { state: { kit, user } });
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
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl px-4 sm:px-6 py-4 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 border border-white/5 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/30">
            <Flame className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <p className="font-black text-white">{kit.title}</p>
            <p className="text-gray-400 text-sm">{kit.question_count} questions &middot; {kit.subject} &middot; {kit.grade_level}</p>
          </div>
        </div>
        <button onClick={onBack} className="text-gray-400 text-sm font-bold hover:text-white transition-colors">Change Kit</button>
      </div>

      {/* Split layout */}
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

          <div className="space-y-3">
            {gameModes.filter(m => filter === 'all' || m.tags?.includes(filter)).map((mode) => {
              const Icon = mode.icon;
              const isSelected = selectedMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => mode.available && setSelectedMode(mode.id)}
                  disabled={!mode.available}
                  className={`relative w-full p-4 rounded-2xl text-left transition-all overflow-hidden group ${
                    !mode.available
                      ? 'opacity-40 cursor-not-allowed bg-gray-50 border-2 border-gray-200'
                      : isSelected
                        ? `bg-gradient-to-br ${mode.gradient} text-white shadow-2xl ${mode.glow} border-2 border-white/30 scale-[1.02]`
                        : 'bg-white border-2 border-gray-100 hover:border-gray-300 hover:shadow-lg hover:scale-[1.01]'
                  }`}
                >
                  {/* Background pattern when selected */}
                  {isSelected && mode.pattern && (
                    <div className="absolute inset-0 pointer-events-none opacity-50" style={{ background: mode.pattern }} />
                  )}

                  {/* Teacher-only ribbon */}
                  {mode.teacherOnly && (
                    <div className={`absolute top-0 right-0 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-bl-lg ${
                      isSelected ? 'bg-white/30 text-white' : 'bg-fuchsia-500 text-white'
                    }`}>
                      Teacher
                    </div>
                  )}

                  <div className="relative flex items-center gap-3">
                    {/* Icon */}
                    <div className={`relative w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 ${
                      isSelected
                        ? 'bg-white/25 backdrop-blur-sm shadow-lg'
                        : `bg-gradient-to-br ${mode.gradient} shadow-md ${mode.glow}`
                    }`}>
                      <Icon className="w-7 h-7 text-white" strokeWidth={2.5} />
                      {isSelected && (
                        <Sparkles className="absolute -top-1 -right-1 w-3.5 h-3.5 text-yellow-200 animate-pulse" strokeWidth={3} />
                      )}
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <div className={`font-black text-base leading-tight ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                        {mode.name}
                      </div>
                      <div className={`text-xs mt-0.5 truncate ${isSelected ? 'text-white/85' : 'text-gray-500'}`}>
                        {mode.tagline}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : mode.difficulty === 'Easy' ? 'bg-green-100 text-green-700'
                            : mode.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}>{mode.difficulty}</span>
                        <span className={`text-[10px] flex items-center gap-1 ${isSelected ? 'text-white/75' : 'text-gray-400'}`}>
                          <Users className="w-3 h-3" />{mode.players}
                        </span>
                      </div>
                    </div>

                    {/* Trailing icon */}
                    {!mode.available
                      ? <Lock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      : <ChevronRight className={`w-5 h-5 flex-shrink-0 transition-transform ${isSelected ? 'text-white translate-x-1' : 'text-gray-300 group-hover:translate-x-1 group-hover:text-gray-500'}`} />
                    }
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Detail panel */}
        <div className="md:col-span-2 lg:col-span-3">
          {selected ? (
            <div className={`relative rounded-3xl p-5 sm:p-7 md:p-8 h-full overflow-hidden border border-white/10 shadow-2xl ${selected.glow}`}
              style={{
                background: `linear-gradient(135deg, var(--tw-from), var(--tw-to)), ${selected.pattern}`,
              }}>
              {/* Layered gradient bg */}
              <div className={`absolute inset-0 bg-gradient-to-br ${selected.gradient}`} />
              <div className="absolute inset-0 opacity-40" style={{ background: selected.pattern }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-white/10" />

              <div className="relative">
                {/* Mode header */}
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-16 h-16 bg-white/25 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-2xl flex-shrink-0">
                    <selected.icon className="w-8 h-8 text-white" strokeWidth={2.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-2xl sm:text-3xl font-black text-white drop-shadow-md">{selected.name}</h2>
                    <p className="text-white/85 text-sm font-semibold mt-0.5">{selected.tagline}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-white/25 backdrop-blur-sm text-white">{selected.difficulty}</span>
                      {selected.tags?.includes('solo') && <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-white/25 backdrop-blur-sm text-white">Solo</span>}
                      {selected.tags?.includes('multi') && <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-white/25 backdrop-blur-sm text-white">Multi</span>}
                      <span className="text-xs text-white/85 font-bold flex items-center gap-1"><Users className="w-3.5 h-3.5" />{selected.players}</span>
                      <span className="text-xs text-white/85 font-bold flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{selected.duration}</span>
                    </div>
                  </div>
                </div>

                {/* Description card */}
                <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4 mb-5 border border-white/20">
                  <p className="text-white text-sm sm:text-base leading-relaxed">{selected.description}</p>
                </div>

                {/* Features */}
                <div className="mb-6">
                  <h4 className="text-xs font-black text-white/85 mb-3 uppercase tracking-widest">What to Expect</h4>
                  <div className="space-y-2">
                    {selected.features.map((feature, i) => (
                      <div key={i} className="flex items-start gap-3 bg-white/10 rounded-xl p-2.5 border border-white/10">
                        <div className="w-6 h-6 rounded-lg bg-white/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-white text-[11px] font-black">{i + 1}</span>
                        </div>
                        <span className="text-sm text-white/95">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Continue button */}
                <button
                  onClick={handleContinue}
                  className="w-full py-4 rounded-2xl font-black text-lg transition-all hover:shadow-2xl bg-white text-gray-900 hover:scale-[1.01] active:scale-[0.99]"
                >
                  Play {selected.name} →
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 p-4 sm:p-6 md:p-8 h-full flex flex-col items-center justify-center text-center min-h-[400px]">
              <div className="w-20 h-20 bg-gradient-to-br from-gray-200 to-gray-300 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
                <Flame className="w-10 h-10 text-gray-400" strokeWidth={2} />
              </div>
              <h3 className="font-black text-gray-500 text-lg mb-1">Pick a Game Mode</h3>
              <p className="text-gray-400 text-sm max-w-xs">Choose a mode from the list to see how it plays</p>
            </div>
          )}
        </div>
      </div>

      {/* Back button */}
      <button onClick={onBack} className="text-gray-500 font-bold hover:text-gray-700 transition-colors text-sm flex items-center gap-1">
        ← Back to Kit Selection
      </button>
    </div>
  );
}
