import { useState, useEffect } from 'react';
import { Flame, Trophy, Lock, ChevronRight, ChevronLeft, Users, Clock, X, BookOpen, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

// Full-bleed themed art for each mode card, standing in for a per-mode logo.
// Classic gets an oversized, tilted trophy watermark; Jackpot reuses the
// app's own coin illustration (mix-blend-mode: multiply drops its white
// background out against the gradient, the same trick GameResults.jsx uses).
// `size="sm"` is for the 56px list-row thumbnail — the "lg" offsets push the
// art almost entirely out of a box that small, so it gets its own tighter scale.
function ModeArt({ modeId, size = 'lg', className = '' }) {
  const sm = size === 'sm';
  if (modeId === 'jackpot') {
    return (
      <div className={`absolute inset-0 overflow-hidden bg-gradient-to-br from-amber-500 via-amber-600 to-yellow-700 ${className}`}>
        <img src="/blazes-coin.svg" alt="" style={{ mixBlendMode: 'multiply' }}
          className={sm ? 'absolute -right-3 -bottom-4 w-14 h-14 opacity-90' : 'absolute -right-10 -bottom-12 w-48 h-48 opacity-80'} />
        {!sm && (
          <img src="/blazes-coin.svg" alt="" className="absolute -left-6 -top-10 w-24 h-24 opacity-40 rotate-12"
            style={{ mixBlendMode: 'multiply' }} />
        )}
      </div>
    );
  }
  return (
    <div className={`absolute inset-0 overflow-hidden bg-gradient-to-br from-orange-500 via-red-500 to-red-700 ${className}`}>
      <Trophy className={sm ? 'absolute -right-2 -bottom-3 w-10 h-10 text-white/25 rotate-[18deg]' : 'absolute -right-6 -bottom-10 w-40 h-40 text-white/20 rotate-[18deg]'} strokeWidth={1.5} />
      {!sm && <Flame className="absolute -left-4 -top-8 w-20 h-20 text-white/15 -rotate-12" strokeWidth={1.5} />}
    </div>
  );
}

export default function GameModeSelect({ kit: initialKit, user, onBack }) {
  const navigate = useNavigate();
  const [kit, setKit] = useState(initialKit);
  const [selectedMode, setSelectedMode] = useState(null);
  const [filter, setFilter] = useState('all');
  const [showKitPicker, setShowKitPicker] = useState(false);
  const [availableKits, setAvailableKits] = useState([]);

  // Load other kits when the picker opens
  useEffect(() => {
    if (!showKitPicker || !user?.id) return;
    const endpoint = user.role === 'teacher' ? 'teacher' : 'student';
    fetch(`${BASE}/api/kits/${endpoint}/${user.id}`)
      .then(r => r.json())
      .then(d => setAvailableKits(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [showKitPicker, user]);

  const gameModes = [
    {
      id: 'classic_timed',
      name: 'Classic Quiz',
      tagline: 'The classic. Highest score wins.',
      solid: 'bg-red-600',
      accent: 'red',
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
      id: 'jackpot',
      name: 'Jackpot',
      tagline: 'Earn chips, buy upgrades, spin to steal.',
      solid: 'bg-amber-500',
      accent: 'amber',
      tags: ['multi'],
      description: "Chips buy upgrades that always cut both ways, or steal straight from another player. Every 5 questions, spin the wheel for a shot at the leader's chips.",
      difficulty: 'Medium',
      players: '2-50',
      duration: 'Set by host',
      features: [
        'Every upgrade has a real tradeoff, not just a bonus',
        'Spend chips to steal straight from another player',
        "Every 5 questions, spin the wheel for a shot at the leader's chips",
        'You set the length and can extend it mid-game',
        'Works with every question type'
      ],
      available: true
    },
  ];


  const handleContinue = () => {
    if (selectedMode === 'classic_timed') navigate('/game/classic-timed-setup', { state: { kit, user } });
    else if (selectedMode === 'jackpot') navigate('/game/jackpot-setup', { state: { kit, user } });
  };

  const selected = gameModes.find(m => m.id === selectedMode);

  // On mobile there isn't room to show the mode list and the full detail
  // panel at once without scrolling, so once a mode is picked the list steps
  // out of the way; a small back arrow on the detail header steps back in.
  // md+ keeps both visible side by side like before.
  return (
    <div className="h-full min-h-0 flex flex-col max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className={`flex-shrink-0 mb-2 sm:mb-4 ${selected ? 'hidden md:block' : ''}`}>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-gray-900">Choose Game Mode</h1>
        <p className="text-gray-500 text-xs sm:text-sm">Select how you want your students to play</p>
      </div>

      {/* Kit banner */}
      <div className={`flex-shrink-0 bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl sm:rounded-2xl px-3 sm:px-6 py-2.5 sm:py-4 mb-2 sm:mb-4 items-center justify-between gap-3 border border-white/5 shadow-xl ${selected ? 'hidden md:flex' : 'flex'}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg shadow-red-500/30 flex-shrink-0">
            <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <p className="font-black text-white text-sm sm:text-base truncate">{kit.title}</p>
            <p className="text-gray-400 text-xs truncate">{kit.question_count} questions &middot; {kit.subject} &middot; {kit.grade_level}</p>
          </div>
        </div>
        <button onClick={() => setShowKitPicker(true)}
          className="flex-shrink-0 bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors border border-white/20">
          Change Kit
        </button>
      </div>

      {/* Split layout */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
        {/* Left: Mode list */}
        <div className={`md:col-span-1 lg:col-span-2 min-h-0 flex-col ${selected ? 'hidden md:flex' : 'flex'}`}>
          {/* Filter tabs */}
          <div className="flex-shrink-0 flex gap-1 mb-2 sm:mb-3 bg-gray-100 p-1 rounded-xl">
            {[['all', 'All'], ['solo', 'Solo'], ['multi', 'Multiplayer']].map(([key, label]) => (
              <button key={key} onClick={() => { setFilter(key); setSelectedMode(null); }}
                className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${filter === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-2 min-h-0 overflow-hidden">
            {gameModes.filter(m => filter === 'all' || m.tags?.includes(filter)).map((mode) => {
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
                    {/* Art thumbnail, stands in for a per-mode logo */}
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 shadow-sm">
                      <ModeArt modeId={mode.id} size="sm" />
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
        <div className={`md:col-span-2 lg:col-span-3 min-h-0 flex-col ${selected ? 'flex' : 'hidden md:flex'}`}>
          {selected ? (
            <div className="bg-white rounded-2xl border-2 border-gray-100 overflow-hidden flex-1 min-h-0 flex flex-col">
              {/* Themed header, stands in for the old mockup + logo badge */}
              <div className="relative flex-shrink-0 h-20 sm:h-28">
                <ModeArt modeId={selected.id} />
                <button onClick={() => setSelectedMode(null)}
                  className="md:hidden absolute top-2 left-2 z-10 p-1.5 rounded-lg bg-black/30 hover:bg-black/40 text-white" aria-label="Back to mode list">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end pl-10 pr-3 py-3 md:p-4">
                  <div className="min-w-0">
                    <h2 className="text-lg sm:text-2xl font-black text-white drop-shadow-lg">{selected.name}</h2>
                    <p className="text-white/90 text-xs sm:text-sm font-semibold">{selected.tagline}</p>
                  </div>
                </div>
              </div>

              <div className="p-3 sm:p-6 flex-1 min-h-0 flex flex-col overflow-hidden">
                {/* Stat chips */}
                <div className="flex-shrink-0 flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2 sm:mb-4">
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
                <p className="flex-shrink-0 text-gray-700 leading-snug mb-2 sm:mb-4 text-xs sm:text-sm">{selected.description}</p>

                {/* Features */}
                <div className="flex-1 min-h-0 overflow-hidden">
                  <h4 className="text-[10px] sm:text-xs font-black text-gray-500 mb-1.5 sm:mb-3 uppercase tracking-widest">What to Expect</h4>
                  <div className="space-y-1 sm:space-y-2">
                    {selected.features.slice(0, 4).map((feature, i) => (
                      <div key={i} className="flex items-start gap-2 sm:gap-3">
                        <div className={`w-4 h-4 sm:w-6 sm:h-6 rounded sm:rounded-lg ${selected.solid} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                          <span className="text-white text-[9px] sm:text-[11px] font-black">{i + 1}</span>
                        </div>
                        <span className="text-xs sm:text-sm text-gray-700 leading-snug">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Continue button */}
                <button
                  onClick={handleContinue}
                  className={`flex-shrink-0 mt-2 sm:mt-4 w-full py-2.5 sm:py-4 rounded-xl font-black text-sm sm:text-lg transition-all text-white ${selected.solid} hover:opacity-90 active:scale-[0.99]`}
                >
                  Play {selected.name} →
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 p-4 sm:p-6 md:p-8 flex-1 min-h-0 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-gray-200 to-gray-300 rounded-2xl flex items-center justify-center mb-3 shadow-inner">
                <Flame className="w-8 h-8 text-gray-400" strokeWidth={2} />
              </div>
              <h3 className="font-black text-gray-500 text-base mb-1">Pick a Game Mode</h3>
              <p className="text-gray-400 text-sm max-w-xs">Choose a mode from the list to see how it plays</p>
            </div>
          )}
        </div>
      </div>

      {/* Back button */}
      <button onClick={onBack}
        className={`flex-shrink-0 mt-2 sm:mt-3 text-gray-500 font-bold hover:text-gray-700 transition-colors text-xs sm:text-sm items-center gap-1 ${selected ? 'hidden md:flex' : 'flex'}`}>
        ← Back to Kit Selection
      </button>

      {/* Kit picker modal */}
      {showKitPicker && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowKitPicker(false)}>
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-red-600" /> Choose a Kit
              </h2>
              <button onClick={() => setShowKitPicker(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {availableKits.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="font-semibold">No other kits available</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableKits.map(k => {
                    const isCurrent = k.id === kit.id;
                    return (
                      <button key={k.id}
                        onClick={() => {
                          if (!isCurrent) {
                            setKit(k);
                            setSelectedMode(null);
                          }
                          setShowKitPicker(false);
                        }}
                        className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                          isCurrent ? 'bg-red-50 border-red-300' : 'bg-white border-gray-100 hover:border-red-300 hover:bg-red-50'
                        }`}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
                            <BookOpen className="w-5 h-5 text-white" strokeWidth={2.5} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-black text-sm text-gray-900 truncate">{k.title}</div>
                            <div className="text-xs text-gray-500 truncate">
                              {k.question_count || 0} questions · {k.subject}{k.grade_level ? ` · ${k.grade_level}` : ''}
                            </div>
                          </div>
                          {isCurrent && (
                            <span className="text-[10px] font-black bg-red-600 text-white px-2 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0">
                              <Check className="w-3 h-3" /> CURRENT
                            </span>
                          )}
                        </div>
                      </button>
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
