import { useState } from 'react';
import { Flame, Trophy, Lock, Swords, ChevronRight, Users, Clock, Zap, Crown, Dice5, Rocket, Sparkles, ImageIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Renders a screenshot, with a graceful fallback if the file isn't there yet
function ScreenshotImage({ src, alt, fallbackIcon: Fallback }) {
  const [errored, setErrored] = useState(false);
  if (errored) {
    return (
      <div className="text-white/50 flex flex-col items-center gap-2">
        {Fallback && <Fallback className="w-16 h-16 opacity-40" strokeWidth={1.5} />}
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">Preview coming soon</span>
      </div>
    );
  }
  return <img src={src} alt={alt} onError={() => setErrored(true)} className="absolute inset-0 w-full h-full object-cover" />;
}

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
      gradient: 'from-amber-500 to-orange-600',
      solid: 'bg-amber-500',
      glow: 'shadow-amber-500/30',
      accent: 'amber',
      screenshot: '/screenshots/classic.png',
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
      gradient: 'from-purple-600 to-indigo-700',
      solid: 'bg-purple-600',
      glow: 'shadow-purple-500/30',
      accent: 'purple',
      screenshot: '/screenshots/elemental-clash.png',
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
      gradient: 'from-orange-500 to-red-600',
      solid: 'bg-orange-500',
      glow: 'shadow-orange-500/30',
      accent: 'orange',
      screenshot: '/screenshots/risk-reward.png',
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
      gradient: 'from-fuchsia-600 to-purple-800',
      solid: 'bg-fuchsia-700',
      glow: 'shadow-fuchsia-500/30',
      accent: 'fuchsia',
      screenshot: '/screenshots/arena.png',
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
      gradient: 'from-cyan-500 to-blue-600',
      solid: 'bg-cyan-600',
      glow: 'shadow-cyan-500/30',
      accent: 'cyan',
      screenshot: '/screenshots/race.png',
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

          <div className="space-y-2">
            {gameModes.filter(m => filter === 'all' || m.tags?.includes(filter)).map((mode) => {
              const Icon = mode.icon;
              const isSelected = selectedMode === mode.id;
              const accentBorder = `border-${mode.accent}-500`;
              return (
                <button
                  key={mode.id}
                  onClick={() => mode.available && setSelectedMode(mode.id)}
                  disabled={!mode.available}
                  className={`relative w-full p-3.5 rounded-xl text-left transition-all overflow-hidden group ${
                    !mode.available
                      ? 'opacity-40 cursor-not-allowed bg-gray-50 border-2 border-gray-200'
                      : isSelected
                        ? `bg-white border-2 ${accentBorder} shadow-md`
                        : 'bg-white border-2 border-gray-100 hover:border-gray-300'
                  }`}
                >
                  {/* Teacher-only ribbon */}
                  {mode.teacherOnly && (
                    <div className="absolute top-0 right-0 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-bl-lg bg-fuchsia-600 text-white">
                      Teacher
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    {/* Icon */}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${mode.solid}`}>
                      <Icon className="w-6 h-6 text-white" strokeWidth={2.5} />
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-base leading-tight text-gray-900">{mode.name}</div>
                      <div className="text-xs mt-0.5 text-gray-500 truncate">{mode.tagline}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          mode.difficulty === 'Easy' ? 'bg-green-100 text-green-700'
                          : mode.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                        }`}>{mode.difficulty}</span>
                        <span className="text-[10px] flex items-center gap-1 text-gray-400">
                          <Users className="w-3 h-3" />{mode.players}
                        </span>
                      </div>
                    </div>

                    {/* Trailing icon */}
                    {!mode.available
                      ? <Lock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      : <ChevronRight className={`w-5 h-5 flex-shrink-0 transition-transform ${isSelected ? `text-${mode.accent}-600 translate-x-1` : 'text-gray-300 group-hover:translate-x-1 group-hover:text-gray-500'}`} />
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
            <div className="bg-white rounded-2xl border-2 border-gray-100 overflow-hidden h-full flex flex-col">
              {/* Screenshot preview at top */}
              <div className={`relative ${selected.solid} h-48 sm:h-56 flex items-center justify-center overflow-hidden`}>
                <ScreenshotImage src={selected.screenshot} alt={`${selected.name} gameplay`} fallbackIcon={selected.icon} />
                {/* Mode title overlay */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-4">
                  <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-2xl sm:text-3xl font-black text-white">{selected.name}</h2>
                      <p className="text-white/90 text-sm font-semibold mt-0.5">{selected.tagline}</p>
                    </div>
                    <div className={`w-12 h-12 ${selected.solid} ring-4 ring-white/20 rounded-xl flex items-center justify-center flex-shrink-0`}>
                      <selected.icon className="w-6 h-6 text-white" strokeWidth={2.5} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 sm:p-6 flex-1 flex flex-col">
                {/* Stat chips */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                    selected.difficulty === 'Easy' ? 'bg-green-100 text-green-700'
                    : selected.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
                  }`}>{selected.difficulty}</span>
                  {selected.tags?.includes('solo') && <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-700">Solo</span>}
                  {selected.tags?.includes('multi') && <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-700">Multi</span>}
                  <span className="text-xs text-gray-500 font-bold flex items-center gap-1"><Users className="w-3.5 h-3.5" />{selected.players}</span>
                  <span className="text-xs text-gray-500 font-bold flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{selected.duration}</span>
                </div>

                {/* Description */}
                <p className="text-gray-700 leading-relaxed mb-5 text-sm">{selected.description}</p>

                {/* Features */}
                <div className="mb-6 flex-1">
                  <h4 className="text-xs font-black text-gray-500 mb-3 uppercase tracking-widest">What to Expect</h4>
                  <div className="space-y-2">
                    {selected.features.map((feature, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className={`w-6 h-6 rounded-lg ${selected.solid} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                          <span className="text-white text-[11px] font-black">{i + 1}</span>
                        </div>
                        <span className="text-sm text-gray-700">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Continue button */}
                <button
                  onClick={handleContinue}
                  className={`w-full py-4 rounded-xl font-black text-lg transition-all text-white ${selected.solid} hover:opacity-90 active:scale-[0.99]`}
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
