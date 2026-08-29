import { Trophy, Clock } from 'lucide-react';

// Renders a small "screenshot-like" mockup of each game mode.
// Uses flex layouts so it scales properly at any aspect ratio.
export default function GameplayMockup({ mode, className = '' }) {
  switch (mode) {
    case 'classic_timed': return <ClassicMock className={className} />;
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
