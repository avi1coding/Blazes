import { Trophy, Clock, Swords, Flame, Mountain, Droplets, Crown, ShoppingBag, Users, Rocket } from 'lucide-react';

// Renders a small "screenshot-like" mockup of each game mode.
// Uses flex layouts so it scales properly at any aspect ratio.
export default function GameplayMockup({ mode, className = '' }) {
  switch (mode) {
    case 'classic_timed': return <ClassicMock className={className} />;
    case 'elemental_clash': return <ElementalClashMock className={className} />;
    case 'elemental_wager': return <RiskRewardMock className={className} />;
    case 'arena': return <ArenaMock className={className} />;
    case 'race': return <RaceMock className={className} />;
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

// ─── RACE ─────────────────────────────────────────────────
// Mini stadium-oval mockup that mirrors RaceTrack.jsx so the preview matches
// what players actually see in the live race.
function RaceMock({ className }) {
  // viewBox 160x90: stadium oval centered, straights along top/bottom, end-caps on the sides.
  // Hardcoded racer positions placed around the centerline so each appears on a different
  // section of the loop (mockup, not a live calculation).
  const racers = [
    { name: 'Maya', x: 50,  y: 73, color: '#a855f7' },
    { name: 'You',  x: 130, y: 73, color: '#22d3ee', me: true },
    { name: 'Liam', x: 138, y: 30, color: '#f97316' },
    { name: 'Jin',  x: 60,  y: 17, color: '#10b981' },
  ];

  return (
    <div className={`w-full h-full bg-gradient-to-br from-stone-800 via-stone-900 to-zinc-950 flex flex-col p-2 sm:p-3 gap-1.5 ${className}`}>
      {/* Top bar */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1">
          <Rocket className="w-3 h-3 text-amber-400" strokeWidth={2.5} />
          <span className="text-[10px] font-black text-white">RACE</span>
        </div>
        <div className="flex items-center gap-1 bg-white/10 backdrop-blur rounded-md px-1.5 py-0.5">
          <Users className="w-2.5 h-2.5 text-amber-200" />
          <span className="text-[9px] font-black text-white">12</span>
        </div>
      </div>
      {/* Stadium oval */}
      <div className="flex-1 flex items-center justify-center min-h-0">
        <svg viewBox="0 0 160 90" className="w-full h-full" style={{ display: 'block' }} preserveAspectRatio="xMidYMid meet">
          <defs>
            {/* Red clay track surface */}
            <linearGradient id="rmck-surface" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c2410c" />
              <stop offset="100%" stopColor="#7c2d12" />
            </linearGradient>
            {/* Green infield */}
            <radialGradient id="rmck-grass" cx="50%" cy="55%" r="70%">
              <stop offset="0%" stopColor="#86efac" />
              <stop offset="100%" stopColor="#15803d" />
            </radialGradient>
          </defs>
          {/* Outer concrete kerb */}
          <path
            d="M 30 73 L 130 73 A 28 28 0 0 0 130 17 L 30 17 A 28 28 0 0 0 30 73 Z"
            fill="none"
            stroke="#f1f5f9"
            strokeWidth="16"
            opacity="0.35"
          />
          {/* Red clay track surface */}
          <path
            d="M 30 73 L 130 73 A 28 28 0 0 0 130 17 L 30 17 A 28 28 0 0 0 30 73 Z"
            fill="none"
            stroke="url(#rmck-surface)"
            strokeWidth="13"
          />
          {/* Inner candy-stripe kerb */}
          <path
            d="M 35 67 L 125 67 A 22 22 0 0 0 125 23 L 35 23 A 22 22 0 0 0 35 67 Z"
            fill="url(#rmck-grass)"
            stroke="#dc2626"
            strokeWidth="1.2"
            strokeDasharray="3 3"
          />
          {/* Centerline dashes */}
          <path
            d="M 30 73 L 130 73 A 28 28 0 0 0 130 17 L 30 17 A 28 28 0 0 0 30 73 Z"
            fill="none"
            stroke="white"
            strokeOpacity="0.5"
            strokeWidth="0.5"
            strokeDasharray="2.5 3"
          />
          {/* Finish line — checkered band at bottom-center */}
          {(() => {
            const fx = 80;
            const fy = 73;
            const cw = 2.2, ch = 1.7;
            const cols = 2, rows = 8;
            return (
              <g>
                <rect x={fx - cw - 0.6} y={fy - (rows * ch) / 2 - 0.4} width={cols * cw + 1.2} height={rows * ch + 0.8} fill="white" rx="0.4" />
                {Array.from({ length: rows * cols }).map((_, i) => {
                  const c = i % cols;
                  const rr = Math.floor(i / cols);
                  return (
                    <rect key={i}
                      x={fx - cw + c * cw}
                      y={fy - (rows * ch) / 2 + rr * ch}
                      width={cw} height={ch}
                      fill={(c + rr) % 2 === 0 ? '#0a0e1a' : 'white'}
                    />
                  );
                })}
              </g>
            );
          })()}
          {/* Racers */}
          {racers.map((p) => {
            const dotR = p.me ? 4.2 : 3.2;
            return (
              <g key={p.name}>
                <circle cx={p.x} cy={p.y} r={dotR + 2.5} fill={p.color} opacity="0.4" />
                <circle cx={p.x} cy={p.y} r={dotR} fill={p.color} stroke="white" strokeWidth="0.8" />
                {p.me && (
                  <circle cx={p.x} cy={p.y} r={dotR + 1.5} fill="none" stroke={p.color} strokeWidth="0.6" opacity="0.7">
                    <animate attributeName="r" values={`${dotR + 1};${dotR + 4};${dotR + 1}`} dur="1.6s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.7;0;0.7" dur="1.6s" repeatCount="indefinite" />
                  </circle>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
