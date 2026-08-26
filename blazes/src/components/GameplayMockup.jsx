import { Trophy, Clock, Swords, Flame, Mountain, Droplets, Crown, ShoppingBag, Users, Vault, Waves, Zap, Sun } from 'lucide-react';

// Renders a small "screenshot-like" mockup of each game mode.
// Uses flex layouts so it scales properly at any aspect ratio.
export default function GameplayMockup({ mode, className = '' }) {
  switch (mode) {
    case 'classic_timed': return <ClassicMock className={className} />;
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
      {/* Answer grid. Flex grows to fill */}
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
        <div className="text-[7px] text-gray-500 font-semibold mt-1">Maya took 132</div>
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
          <span className="font-black text-[8px] text-white">YOU HAVE IT</span>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-sm p-2 border border-cyan-200 flex-shrink-0">
        <div className="text-[8px] font-black text-gray-600 uppercase tracking-wider mb-1">Current</div>
        <div className="h-2 rounded-full bg-gradient-to-r from-cyan-200 via-cyan-500 to-cyan-200" />
        <div className="flex items-center justify-between mt-1">
          <span className="text-[7px] font-semibold text-cyan-700">Moving toward you</span>
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
