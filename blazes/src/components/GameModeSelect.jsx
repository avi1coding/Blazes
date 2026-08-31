import { useState, useEffect } from 'react';
import { Flame, Trophy, Lock, ChevronRight, Users, Clock, X, BookOpen, Check, Grid3x3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import GameplayMockup from './GameplayMockup';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

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

  // Warm the browser cache for the lobby music while the teacher is still
  // picking a mode and filling out setup. Without this, LobbyMusic.mp3 only
  // starts downloading once the lobby itself mounts, so it takes a moment
  // to start. Fire-and-forget, we just want the bytes cached ahead of time.
  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/audio/LobbyMusic.mp3', { signal: ctrl.signal, cache: 'force-cache' })
      .then(r => r.arrayBuffer())
      .catch(() => { /* offline, AbortError, etc., silent */ });
    return () => ctrl.abort();
  }, []);

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
      id: 'territory',
      name: 'Territory',
      tagline: 'A shared grid. Your color spreads on its own.',
      icon: Grid3x3,
      gradient: 'from-emerald-500 to-teal-600',
      solid: 'bg-emerald-600',
      glow: 'shadow-emerald-500/40',
      accent: 'emerald',
      tags: ['multi'],
      description: 'The whole class shares one grid. A correct answer automatically claims the tile next to your last one, no picking, so your color spreads outward on its own. Tiles fade back to open ground if left alone, so the board never fills up, it just keeps shifting for as long as you run the game.',
      difficulty: 'Easy',
      players: '2-50',
      duration: 'Set by host',
      features: [
        'Correct answers claim ground automatically',
        'No picking or choices to make beyond the question',
        'Tiles fade over time, so it never runs out of room',
        'You set the length and can extend it mid-game',
        'Works with every question type'
      ],
      available: true
    },
  ];


  const handleContinue = () => {
    if (selectedMode === 'classic_timed') navigate('/game/classic-timed-setup', { state: { kit, user } });
    else if (selectedMode === 'territory') navigate('/game/territory-setup', { state: { kit, user } });
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
        <button onClick={() => setShowKitPicker(true)}
          className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors border border-white/20">
          Change Kit
        </button>
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
              {/* Gameplay mockup preview at top */}
              <div className="relative h-48 sm:h-56 overflow-hidden bg-gray-100">
                <GameplayMockup mode={selected.id} />
                {/* Mode title overlay */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4">
                  <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-2xl sm:text-3xl font-black text-white drop-shadow-lg">{selected.name}</h2>
                      <p className="text-white/90 text-sm font-semibold mt-0.5">{selected.tagline}</p>
                    </div>
                    <div className={`w-12 h-12 ${selected.solid} ring-4 ring-white/30 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg`}>
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
