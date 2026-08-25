import { Trophy, Clock, Swords, Flame, Mountain, Droplets, Crown, ShoppingBag, Users, Vault, Waves, Zap, Sun } from 'lucide-react';

// Renders a small "screenshot-like" mockup of each game mode.
// Uses flex layouts so it scales properly at any aspect ratio.
export default function GameplayMockup({ mode, className = '' }) {
  switch (mode) {
    case 'classic_timed': return <ClassicMock className={className} />;
    case 'elemental_clash': return <ElementalClashMock className={className} />;
    case 'elemental_wager': return <RiskRewardMock className={className} />;
    case 'arena': return <ArenaMock className={className} />;
    case 'vault': return <VaultMock className={className} />;
    case 'undertow': return <UndertowMock className={className} />;
    case 'fracture': return <FractureMock className={className} />;
    case 'eclipse': return <EclipseMock className={className} />;
    default: return <ClassicMock className={className} />;
  }
}

// ─── CLASSIC QUIZ ─────────────────────────────────────────
function ClassicMock({ className }) {
  return (
    <div className={`w-full h-full bg-gradient-to-br from-amber-50 to-orange-50 flex flex-col p-2 sm:p-3 gap-2 ${className}`}>
      {/* Top bar */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1 bg-white rounded-md px-1.5 py-0.5 shadow-sm">
          <Trophy className="w-3 h-3 text-amber-500" />
          <span className="font-black text-[10px] text-gray-900 tabular-nums">2,450</span>
        </div>
        <div className="flex items-center gap-1 bg-white rounded-md px-1.5 py-0.5 shadow-sm">
          <Clock className="w-3 h-3 text-gray-500" />
          <span className="font-black text-[10px] text-gray-900 tabular-nums">3:24</span>
        </div>
      </div>
      {/* Question card */}
      <div className="bg-white rounded-lg shadow-sm p-2 border border-gray-100 flex-shrink-0">
        <div className="text-[8px] font-bold text-amber-600 uppercase tracking-wider">Question 4</div>
        <div className="text-[10px] sm:text-xs font-black text-gray-900 leading-tight mt-0.5">Capital of France?</div>
      </div>
      {/* Answer grid — flex grows to fill */}
      <div className="grid grid-cols-2 gap-1.5 flex-1 min-h-0">
        {[
          { l: 'A', t: 'Berlin' },
          { l: 'B', t: 'Paris', correct: true },
          { l: 'C', t: 'Rome' },
          { l: 'D', t: 'Madrid' },
        ].map(o => (
          <div key={o.l} className={`rounded-md p-1.5 flex items-center gap-1.5 border shadow-sm min-h-0 ${
            o.correct ? 'bg-green-100 border-green-400' : 'bg-white border-gray-100'
          }`}>
            <span className={`w-4 h-4 rounded text-[8px] font-black flex items-center justify-center flex-shrink-0 ${
              o.correct ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'
            }`}>{o.l}</span>
            <span className="text-[9px] font-bold text-gray-900 truncate">{o.t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ELEMENTAL CLASH ──────────────────────────────────────
function ElementalClashMock({ className }) {
  return (
    <div className={`w-full h-full bg-gradient-to-br from-purple-100 via-indigo-50 to-purple-100 flex flex-col p-2 sm:p-3 gap-1.5 ${className}`}>
      {/* Team scoreboards */}
      <div className="grid grid-cols-2 gap-1.5 flex-shrink-0">
        <div className="bg-red-500 rounded-md p-1.5 shadow-sm">
          <div className="text-[7px] font-bold text-white/80 uppercase tracking-wider">Red</div>
          <div className="text-sm sm:text-base font-black text-white leading-none mt-0.5 tabular-nums">340</div>
        </div>
        <div className="bg-blue-500 rounded-md p-1.5 shadow-sm text-right">
          <div className="text-[7px] font-bold text-white/80 uppercase tracking-wider">Blue</div>
          <div className="text-sm sm:text-base font-black text-white leading-none mt-0.5 tabular-nums">285</div>
        </div>
      </div>
      {/* VS badge */}
      <div className="flex justify-center -my-1 relative z-10">
        <div className="bg-white rounded-full w-6 h-6 flex items-center justify-center shadow-md border border-purple-200">
          <Swords className="w-3.5 h-3.5 text-purple-600" strokeWidth={2.5} />
        </div>
      </div>
      {/* Energy + attack panel */}
      <div className="bg-white rounded-lg p-1.5 shadow-sm border border-purple-100 flex-1 flex flex-col gap-1.5 min-h-0">
        <div className="flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
            <span className="text-[9px] font-black text-gray-900 tabular-nums">8 ENERGY</span>
          </div>
          <span className="text-[8px] font-bold text-purple-600 bg-purple-100 rounded px-1.5 py-0.5">YOUR TURN</span>
        </div>
        <div className="grid grid-cols-4 gap-1 flex-1 min-h-0">
          {[
            { i: Mountain, c: 'bg-amber-100 text-amber-700' },
            { i: Droplets, c: 'bg-blue-100 text-blue-700' },
            { i: Flame, c: 'bg-red-100 text-red-700' },
            { i: Swords, c: 'bg-purple-100 text-purple-700' },
          ].map((a, i) => {
            const Icon = a.i;
            return (
              <div key={i} className={`${a.c} rounded flex items-center justify-center min-h-0`}>
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
    <div className={`w-full h-full bg-gradient-to-br from-orange-100 via-amber-50 to-red-100 flex flex-col p-2 sm:p-3 gap-1.5 ${className}`}>
      {/* Top bar */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="bg-white rounded-md px-1.5 py-0.5 shadow-sm flex items-center gap-1">
          <Flame className="w-3 h-3 text-orange-500" />
          <span className="font-black text-[10px] text-gray-900">5x STREAK</span>
        </div>
        <div className="bg-orange-500 rounded-md px-1.5 py-0.5 shadow-sm">
          <span className="font-black text-[9px] text-white">TIER 3</span>
        </div>
      </div>
      {/* Tagline */}
      <div className="text-center flex-shrink-0">
        <div className="text-[8px] font-bold text-orange-700 uppercase tracking-widest">Choose Your Bet</div>
      </div>
      {/* Bet options */}
      <div className="grid grid-cols-3 gap-1.5 flex-1 min-h-0">
        {[
          { i: Mountain, label: 'Rock', sub: '+5/0', color: 'from-gray-400 to-gray-500', sel: false },
          { i: Droplets, label: 'Drop', sub: '+10/-3', color: 'from-blue-400 to-blue-500', sel: true },
          { i: Flame, label: 'Torch', sub: '+25/-10', color: 'from-orange-500 to-red-500', sel: false },
        ].map((o) => {
          const Icon = o.i;
          return (
            <div key={o.label} className={`rounded-md p-1 flex flex-col items-center justify-center text-center min-h-0 ${
              o.sel ? `bg-gradient-to-br ${o.color} ring-2 ring-orange-400 shadow-md` : 'bg-white border border-gray-200'
            }`}>
              <Icon className={`w-3.5 h-3.5 ${o.sel ? 'text-white' : 'text-gray-600'}`} strokeWidth={2.5} />
              <div className={`text-[8px] font-black mt-0.5 ${o.sel ? 'text-white' : 'text-gray-900'}`}>{o.label}</div>
              <div className={`text-[7px] font-bold ${o.sel ? 'text-white/90' : 'text-gray-500'} tabular-nums`}>{o.sub}</div>
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
    <div className={`w-full h-full bg-gradient-to-br from-purple-950 via-indigo-950 to-fuchsia-950 flex flex-col p-2 sm:p-3 gap-1.5 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-[8px] font-black text-white">A</div>
          <Crown className="w-2.5 h-2.5 text-yellow-400" strokeWidth={3} />
        </div>
        <div className="flex items-center gap-1">
          <div className="bg-yellow-500/20 border border-yellow-400/40 rounded px-1.5 py-0.5 flex items-center gap-1">
            <Trophy className="w-2.5 h-2.5 text-yellow-300" />
            <span className="text-[9px] font-black text-white tabular-nums">147</span>
          </div>
          <div className="bg-red-500/30 border border-red-400/60 rounded px-1.5 py-0.5 flex items-center gap-1">
            <Clock className="w-2.5 h-2.5 text-white" />
            <span className="text-[9px] font-black text-white tabular-nums">0:09</span>
          </div>
          <div className="bg-fuchsia-600 rounded p-1">
            <ShoppingBag className="w-2.5 h-2.5 text-white" />
          </div>
        </div>
      </div>
      {/* Combo banner */}
      <div className="flex justify-center flex-shrink-0">
        <div className="bg-orange-500/30 border border-orange-400/50 rounded-full px-2 py-0.5 flex items-center gap-1">
          <Flame className="w-2.5 h-2.5 text-orange-300" />
          <span className="text-[8px] font-black text-orange-200">7 STREAK</span>
        </div>
      </div>
      {/* Question card */}
      <div className="bg-white/[0.07] border border-white/10 rounded-lg p-1.5 flex-1 flex flex-col gap-1.5 min-h-0">
        <div className="text-[7px] font-black text-purple-300 uppercase tracking-widest text-center flex-shrink-0">Question 12</div>
        <div className="text-[10px] sm:text-xs font-black text-white text-center leading-tight flex-shrink-0">8 × 7 = ?</div>
        <div className="grid grid-cols-2 gap-1 flex-1 min-h-0">
          {[
            { l: 'A', t: '54', g: 'from-red-600 to-rose-600' },
            { l: 'B', t: '56', g: 'from-blue-600 to-cyan-600', correct: true },
            { l: 'C', t: '64', g: 'from-yellow-600 to-orange-600' },
            { l: 'D', t: '49', g: 'from-green-600 to-emerald-600' },
          ].map(o => (
            <div key={o.l} className={`rounded flex items-center gap-1 px-1 min-h-0 ${
              o.correct ? 'bg-green-600 ring-1 ring-green-300' : `bg-gradient-to-br ${o.g}`
            }`}>
              <span className="text-[8px] font-black text-white/70 flex-shrink-0">{o.l}</span>
              <span className="text-[10px] font-bold text-white tabular-nums">{o.t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── THE VAULT ────────────────────────────────────────────
// The shared pot is the whole story, so it dominates the frame.
function VaultMock({ className }) {
  return (
    <div className={`w-full h-full bg-gradient-to-br from-amber-50 to-yellow-100 flex flex-col p-2 sm:p-3 gap-2 ${className}`}>
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1 bg-white rounded-md px-1.5 py-0.5 shadow-sm">
          <Vault className="w-3 h-3 text-amber-600" />
          <span className="font-black text-[9px] text-gray-900">THE VAULT</span>
        </div>
        <div className="flex items-center gap-1 bg-white rounded-md px-1.5 py-0.5 shadow-sm">
          <Clock className="w-3 h-3 text-gray-500" />
          <span className="font-black text-[10px] text-gray-900 tabular-nums">12:08</span>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-sm p-2 border border-amber-200 flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[8px] font-black text-gray-600 uppercase tracking-wider">Pot</span>
          <span className="text-sm font-black text-amber-600 tabular-nums leading-none">418</span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full w-2/3 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full" />
        </div>
        <div className="text-[7px] text-gray-500 font-semibold mt-1">Maya cracked it for 132</div>
      </div>
      <div className="bg-green-50 border border-green-300 rounded-md px-1.5 py-1 flex items-center gap-1 flex-shrink-0">
        <span className="text-[9px] font-black text-green-700">+132</span>
        <span className="text-[7px] text-green-700/80 font-semibold">streak 4</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 flex-1 min-h-0">
        {['Berlin', 'Paris', 'Rome', 'Madrid'].map((t, i) => (
          <div key={t} className={`rounded-md border flex items-center px-1.5 ${i === 1 ? 'bg-green-100 border-green-400' : 'bg-white border-gray-200'}`}>
            <span className="text-[9px] font-bold text-gray-800 truncate">{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── UNDERTOW ─────────────────────────────────────────────
// One current everyone is chasing.
function UndertowMock({ className }) {
  return (
    <div className={`w-full h-full bg-gradient-to-br from-cyan-50 to-blue-100 flex flex-col p-2 sm:p-3 gap-2 ${className}`}>
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1 bg-white rounded-md px-1.5 py-0.5 shadow-sm">
          <Waves className="w-3 h-3 text-cyan-600" />
          <span className="font-black text-[9px] text-gray-900">UNDERTOW</span>
        </div>
        <div className="bg-cyan-500 rounded-md px-1.5 py-0.5">
          <span className="font-black text-[8px] text-white">YOU HOLD IT</span>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-sm p-2 border border-cyan-200 flex-shrink-0">
        <div className="text-[8px] font-black text-gray-600 uppercase tracking-wider mb-1">Current</div>
        <div className="h-2 rounded-full bg-gradient-to-r from-cyan-200 via-cyan-500 to-cyan-200" />
        <div className="flex items-center justify-between mt-1">
          <span className="text-[7px] font-semibold text-cyan-700">Flowing toward you</span>
          <span className="text-[8px] font-black text-cyan-700">1.8x</span>
        </div>
      </div>
      <div className="flex gap-1 flex-shrink-0">
        {[['Ava', 'bg-cyan-500'], ['Leo', 'bg-slate-300'], ['Sam', 'bg-slate-300']].map(([n, c]) => (
          <div key={n} className="flex-1 bg-white rounded-md px-1 py-0.5 flex items-center gap-1 border border-gray-100">
            <span className={`w-1.5 h-1.5 rounded-full ${c}`} />
            <span className="text-[7px] font-bold text-gray-700 truncate">{n}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1.5 flex-1 min-h-0">
        {['True', 'False'].map((t, i) => (
          <div key={t} className={`rounded-md border flex items-center justify-center ${i === 0 ? 'bg-cyan-100 border-cyan-400' : 'bg-white border-gray-200'}`}>
            <span className="text-[10px] font-black text-gray-800">{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── FRACTURE ─────────────────────────────────────────────
// Shared glass, visibly cracking.
function FractureMock({ className }) {
  const cracks = [[18, 30, -35], [34, 62, 20], [55, 24, 55], [70, 70, -15], [86, 44, 40]];
  return (
    <div className={`w-full h-full bg-gradient-to-br from-violet-50 to-purple-100 flex flex-col p-2 sm:p-3 gap-2 ${className}`}>
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1 bg-white rounded-md px-1.5 py-0.5 shadow-sm">
          <Zap className="w-3 h-3 text-violet-600" />
          <span className="font-black text-[9px] text-gray-900">FRACTURE</span>
        </div>
        <div className="flex items-center gap-1 bg-white rounded-md px-1.5 py-0.5 shadow-sm">
          <span className="text-[7px] font-bold text-gray-500 uppercase">Cracks</span>
          <span className="font-black text-[10px] text-violet-600 tabular-nums">3</span>
        </div>
      </div>
      <div className="relative bg-gray-900 rounded-lg flex-shrink-0 h-10 overflow-hidden">
        {cracks.map(([x, y, r], i) => (
          <span key={i} className="absolute w-px h-5 bg-white/60"
            style={{ left: `${x}%`, top: `${y}%`, transform: `translateY(-50%) rotate(${r}deg)` }} />
        ))}
        <span className="absolute bottom-0.5 left-1.5 text-[7px] font-bold text-white/50">Repair with correct answers</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 flex-1 min-h-0">
        {['Mitosis', 'Meiosis', 'Osmosis', 'Diffusion'].map((t, i) => (
          <div key={t} className={`rounded-md border flex items-center px-1.5 ${i === 0 ? 'bg-violet-100 border-violet-400' : 'bg-white border-gray-200'}`}>
            <span className="text-[9px] font-bold text-gray-800 truncate">{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ECLIPSE ──────────────────────────────────────────────
// Territory lit by each player's skin colour, on a dark field.
function EclipseMock({ className }) {
  return (
    <div className={`w-full h-full bg-gradient-to-br from-orange-50 to-red-100 flex flex-col p-2 sm:p-3 gap-2 ${className}`}>
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1 bg-white rounded-md px-1.5 py-0.5 shadow-sm">
          <Sun className="w-3 h-3 text-orange-600" />
          <span className="font-black text-[9px] text-gray-900">ECLIPSE</span>
        </div>
        <div className="flex items-center gap-1 bg-white rounded-md px-1.5 py-0.5 shadow-sm">
          <span className="text-[7px] font-bold text-gray-500 uppercase">Radius</span>
          <span className="font-black text-[10px] text-orange-600 tabular-nums">14.2</span>
        </div>
      </div>
      <div className="relative bg-gray-900 rounded-lg flex-1 min-h-0 overflow-hidden flex items-center justify-center gap-3">
        <div className="flex flex-col items-center">
          <div className="rounded-full" style={{ width: 26, height: 26, background: '#f97316', boxShadow: '0 0 12px #f97316' }} />
          <span className="text-[6px] font-bold text-white/70 mt-0.5">You</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="rounded-full" style={{ width: 15, height: 15, background: '#38bdf8', boxShadow: '0 0 8px #38bdf8' }} />
          <span className="text-[6px] font-bold text-white/70 mt-0.5">Ava</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="rounded-full" style={{ width: 9, height: 9, background: '#a78bfa', boxShadow: '0 0 6px #a78bfa' }} />
          <span className="text-[6px] font-bold text-white/70 mt-0.5">Leo</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5 flex-shrink-0 h-7">
        {['4', '5'].map((t, i) => (
          <div key={t} className={`rounded-md border flex items-center px-1.5 ${i === 0 ? 'bg-orange-100 border-orange-400' : 'bg-white border-gray-200'}`}>
            <span className="text-[9px] font-black text-gray-800">{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
