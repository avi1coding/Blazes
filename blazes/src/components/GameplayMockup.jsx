import { Trophy, Clock, Coins, Swords, Flame, Mountain, Droplets, Crown, ShoppingBag, Shield, Users, Rocket } from 'lucide-react';

// Renders a small "screenshot-like" mockup of each game mode.
// Used as the preview image in the mode picker (and reusable elsewhere).
export default function GameplayMockup({ mode, className = '' }) {
  switch (mode) {
    case 'classic_timed':
      return <ClassicMock className={className} />;
    case 'elemental_clash':
      return <ElementalClashMock className={className} />;
    case 'elemental_wager':
      return <RiskRewardMock className={className} />;
    case 'arena':
      return <ArenaMock className={className} />;
    case 'race':
      return <RaceMock className={className} />;
    default:
      return <ClassicMock className={className} />;
  }
}

// ─── CLASSIC QUIZ ─────────────────────────────────────────
function ClassicMock({ className }) {
  return (
    <div className={`relative w-full h-full bg-gradient-to-br from-amber-50 to-orange-50 ${className}`}>
      {/* Top bar */}
      <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 bg-white rounded-lg px-2 py-1 shadow-sm">
          <Trophy className="w-3 h-3 text-amber-500" />
          <span className="font-black text-[10px] text-gray-900">2,450</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white rounded-lg px-2 py-1 shadow-sm">
          <Clock className="w-3 h-3 text-gray-500" />
          <span className="font-black text-[10px] text-gray-900">3:24</span>
        </div>
      </div>
      {/* Question card */}
      <div className="absolute inset-x-4 top-12 bg-white rounded-xl shadow-md p-3 border border-gray-100">
        <div className="text-[8px] font-bold text-amber-600 uppercase tracking-wider mb-1">Question 4</div>
        <div className="text-xs font-black text-gray-900 leading-snug">What is the capital of France?</div>
      </div>
      {/* Answer grid */}
      <div className="absolute inset-x-4 bottom-3 grid grid-cols-2 gap-1.5">
        {[
          { l: 'A', t: 'Berlin', sel: false, correct: false },
          { l: 'B', t: 'Paris', sel: true, correct: true },
          { l: 'C', t: 'Rome', sel: false, correct: false },
          { l: 'D', t: 'Madrid', sel: false, correct: false },
        ].map(o => (
          <div key={o.l} className={`rounded-lg p-1.5 flex items-center gap-1.5 border-2 shadow-sm ${
            o.correct ? 'bg-green-100 border-green-500' : 'bg-white border-gray-100'
          }`}>
            <span className={`w-4 h-4 rounded text-[8px] font-black flex items-center justify-center ${
              o.correct ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'
            }`}>{o.l}</span>
            <span className="text-[9px] font-bold text-gray-900">{o.t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ELEMENTAL CLASH ──────────────────────────────────────
function ElementalClashMock({ className }) {
  return (
    <div className={`relative w-full h-full bg-gradient-to-br from-purple-100 via-indigo-50 to-purple-100 ${className}`}>
      {/* Team scores at top */}
      <div className="absolute top-2 left-2 right-2 grid grid-cols-2 gap-2">
        <div className="bg-red-500 rounded-lg p-1.5 shadow-md">
          <div className="text-[7px] font-bold text-white/80 uppercase tracking-wider">Team Red</div>
          <div className="text-base font-black text-white leading-none">340</div>
        </div>
        <div className="bg-blue-500 rounded-lg p-1.5 shadow-md text-right">
          <div className="text-[7px] font-bold text-white/80 uppercase tracking-wider">Team Blue</div>
          <div className="text-base font-black text-white leading-none">285</div>
        </div>
      </div>
      {/* Vs in the middle */}
      <div className="absolute top-9 left-1/2 -translate-x-1/2 bg-white rounded-full w-7 h-7 flex items-center justify-center shadow-md border-2 border-purple-200">
        <Swords className="w-4 h-4 text-purple-600" strokeWidth={2.5} />
      </div>
      {/* Energy + attack panel */}
      <div className="absolute inset-x-4 bottom-3 bg-white rounded-xl p-2.5 shadow-md border border-purple-100">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <span className="text-[9px] font-black text-gray-900">8 ENERGY</span>
          </div>
          <span className="text-[8px] font-bold text-purple-600 bg-purple-100 rounded px-1.5 py-0.5">YOUR TURN</span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {[
            { i: Mountain, c: 'bg-amber-100 text-amber-700' },
            { i: Droplets, c: 'bg-blue-100 text-blue-700' },
            { i: Flame, c: 'bg-red-100 text-red-700' },
            { i: Swords, c: 'bg-purple-100 text-purple-700' },
          ].map((a, i) => {
            const Icon = a.i;
            return (
              <div key={i} className={`${a.c} rounded p-1 flex items-center justify-center aspect-square`}>
                <Icon className="w-3 h-3" strokeWidth={2.5} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── RISK & REWARD ────────────────────────────────────────
function RiskRewardMock({ className }) {
  return (
    <div className={`relative w-full h-full bg-gradient-to-br from-orange-100 via-amber-50 to-red-100 ${className}`}>
      {/* Streak indicator */}
      <div className="absolute top-2 left-2 bg-white rounded-lg px-2 py-1 shadow-md flex items-center gap-1">
        <Flame className="w-3 h-3 text-orange-500" />
        <span className="font-black text-[10px] text-gray-900">5x STREAK</span>
      </div>
      {/* Tier badge */}
      <div className="absolute top-2 right-2 bg-orange-500 rounded-lg px-2 py-1 shadow-md">
        <span className="font-black text-[9px] text-white">TIER 3</span>
      </div>
      {/* Tagline */}
      <div className="absolute top-12 inset-x-3 text-center">
        <div className="text-[8px] font-bold text-orange-600 uppercase tracking-widest">Choose Your Bet</div>
      </div>
      {/* Bet options */}
      <div className="absolute inset-x-3 top-16 bottom-3 grid grid-cols-3 gap-1.5">
        {[
          { i: Mountain, label: 'Rock', sub: '+5 / 0', color: 'from-gray-400 to-gray-500', sel: false },
          { i: Droplets, label: 'Drop', sub: '+10 / -3', color: 'from-blue-400 to-blue-500', sel: true },
          { i: Flame, label: 'Torch', sub: '+25 / -10', color: 'from-orange-500 to-red-500', sel: false },
        ].map((o) => {
          const Icon = o.i;
          return (
            <div key={o.label} className={`rounded-lg p-1.5 flex flex-col items-center justify-center text-center ${
              o.sel ? `bg-gradient-to-br ${o.color} ring-2 ring-offset-1 ring-orange-400 shadow-md` : 'bg-white border border-gray-200'
            }`}>
              <Icon className={`w-4 h-4 mb-0.5 ${o.sel ? 'text-white' : 'text-gray-600'}`} strokeWidth={2.5} />
              <div className={`text-[8px] font-black ${o.sel ? 'text-white' : 'text-gray-900'}`}>{o.label}</div>
              <div className={`text-[7px] font-bold ${o.sel ? 'text-white/85' : 'text-gray-500'}`}>{o.sub}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── ARENA ────────────────────────────────────────────────
function ArenaMock({ className }) {
  return (
    <div className={`relative w-full h-full bg-gradient-to-br from-purple-950 via-indigo-950 to-fuchsia-950 ${className}`}>
      {/* Header */}
      <div className="absolute top-1.5 left-2 right-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-[8px] font-black text-white">A</div>
          <Crown className="w-2.5 h-2.5 text-yellow-400" strokeWidth={3} />
        </div>
        <div className="flex items-center gap-1">
          <div className="bg-yellow-500/20 border border-yellow-400/40 rounded px-1.5 py-0.5 flex items-center gap-1">
            <Trophy className="w-2.5 h-2.5 text-yellow-300" />
            <span className="text-[9px] font-black text-white">147</span>
          </div>
          <div className="bg-red-500/30 border border-red-400/60 rounded px-1.5 py-0.5 flex items-center gap-1 animate-pulse">
            <Clock className="w-2.5 h-2.5 text-white" />
            <span className="text-[9px] font-black text-white">0:09</span>
          </div>
          <div className="bg-fuchsia-600 rounded p-0.5">
            <ShoppingBag className="w-2.5 h-2.5 text-white" />
          </div>
        </div>
      </div>
      {/* Combo banner */}
      <div className="absolute top-9 left-1/2 -translate-x-1/2 bg-orange-500/30 border border-orange-400/50 rounded-full px-2 py-0.5 flex items-center gap-1">
        <Flame className="w-2.5 h-2.5 text-orange-300" />
        <span className="text-[8px] font-black text-orange-200">7 STREAK · +5/answer</span>
      </div>
      {/* Question card */}
      <div className="absolute inset-x-3 top-14 bottom-3 bg-white/[0.07] backdrop-blur-sm border border-white/10 rounded-xl p-2 flex flex-col">
        <div className="text-[7px] font-black text-purple-300 uppercase tracking-widest text-center mb-1">Question 12</div>
        <div className="text-[10px] font-black text-white text-center leading-tight mb-1.5 px-2">What's 8 × 7?</div>
        <div className="grid grid-cols-2 gap-1 flex-1">
          {[
            { l: 'A', t: '54', g: 'from-red-600 to-rose-600' },
            { l: 'B', t: '56', g: 'from-blue-600 to-cyan-600', correct: true },
            { l: 'C', t: '64', g: 'from-yellow-600 to-orange-600' },
            { l: 'D', t: '49', g: 'from-green-600 to-emerald-600' },
          ].map(o => (
            <div key={o.l} className={`rounded p-1 flex items-center gap-1 ${
              o.correct ? 'bg-green-600 ring-1 ring-green-300 scale-105' : `bg-gradient-to-br ${o.g}`
            }`}>
              <span className="text-[8px] font-black text-white/70">{o.l}</span>
              <span className="text-[9px] font-bold text-white">{o.t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── RACE ─────────────────────────────────────────────────
function RaceMock({ className }) {
  return (
    <div className={`relative w-full h-full bg-gradient-to-br from-cyan-50 to-sky-100 ${className}`}>
      {/* Title */}
      <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Rocket className="w-3 h-3 text-cyan-600" strokeWidth={2.5} />
          <span className="text-[9px] font-black text-gray-900">RACE</span>
        </div>
        <div className="flex items-center gap-1 bg-white rounded px-1.5 py-0.5 shadow-sm">
          <Users className="w-2.5 h-2.5 text-gray-500" />
          <span className="text-[8px] font-black text-gray-900">12</span>
        </div>
      </div>
      {/* Race track */}
      <div className="absolute inset-x-3 top-9 bottom-3 space-y-2">
        {[
          { name: 'You', pos: 78, color: 'bg-cyan-500' },
          { name: 'Maya', pos: 92, color: 'bg-purple-500' },
          { name: 'Liam', pos: 65, color: 'bg-orange-500' },
          { name: 'Jin', pos: 50, color: 'bg-green-500' },
        ].map((p, i) => (
          <div key={p.name}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[8px] font-bold text-gray-700">#{i + 1} {p.name}</span>
              <span className="text-[7px] font-bold text-gray-500">{p.pos}%</span>
            </div>
            <div className="relative h-2.5 bg-gray-200 rounded-full overflow-hidden">
              <div className={`h-full ${p.color} rounded-full transition-all`} style={{ width: `${p.pos}%` }} />
              {/* Finish line marker */}
              <div className="absolute top-0 right-0 h-full w-0.5 bg-red-500" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
