import { Trophy, Clock, Coins, Sparkles } from 'lucide-react';

// Renders a small "screenshot-like" mockup of each game mode.
// Uses flex layouts so it scales properly at any aspect ratio.
export default function GameplayMockup({ mode, className = '' }) {
  switch (mode) {
    case 'classic_timed': return <ClassicMock className={className} />;
    case 'jackpot': return <JackpotMock className={className} />;
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

// ─── JACKPOT ──────────────────────────────────────────────
// A chip count, a wheel teaser, and a couple of double-edged upgrade cards.
function JackpotMock({ className }) {
  return (
    <div className={`w-full h-full bg-gradient-to-br from-amber-50 to-yellow-100 flex flex-col p-2 sm:p-3 gap-2 ${className}`}>
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1 bg-white rounded-md px-1.5 py-0.5 shadow-sm">
          <Coins className="w-3 h-3 text-amber-500" />
          <span className="font-black text-[10px] text-gray-900 tabular-nums">340</span>
        </div>
        <div
          className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
          style={{ background: 'conic-gradient(#4ade80 0deg 90deg, #f59e0b 90deg 180deg, #ef4444 180deg 270deg, #eab308 270deg 360deg)' }}
        />
      </div>
      <div className="bg-white rounded-lg shadow-sm p-2 border border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-1 text-[8px] font-bold text-amber-600 uppercase tracking-wider">
          <Sparkles className="w-2.5 h-2.5" /> Upgrades
        </div>
        <div className="text-[9px] font-black text-gray-900 mt-1">Multiplier</div>
        <div className="text-[7px] font-bold text-green-600">+ 1.5x chips earned</div>
        <div className="text-[7px] font-bold text-red-500">- 1.5x chips lost</div>
      </div>
      <div className="grid grid-cols-2 gap-1.5 flex-1 min-h-0">
        {[{ n: 'Jordan', c: 210 }, { n: 'Avi', c: 340, lead: true }].map(p => (
          <div key={p.n} className={`rounded-md border flex flex-col justify-center px-1.5 min-h-0 ${p.lead ? 'bg-amber-100 border-amber-400' : 'bg-white border-gray-200'}`}>
            <span className="text-[9px] font-bold text-gray-800 truncate">{p.n}</span>
            <span className="text-[8px] font-black text-gray-500 tabular-nums">{p.c} chips</span>
          </div>
        ))}
      </div>
    </div>
  );
}
