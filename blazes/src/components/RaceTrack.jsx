import { useMemo } from 'react';
import { Trophy, Medal } from 'lucide-react';

// Stable per-user color (deterministic from id so a player keeps the same accent)
const PLAYER_COLORS = [
  '#06b6d4', '#a855f7', '#f97316', '#10b981', '#ef4444',
  '#f59e0b', '#3b82f6', '#ec4899', '#84cc16', '#8b5cf6',
];
const colorFor = (id) => PLAYER_COLORS[Math.abs((id || 0)) % PLAYER_COLORS.length];

// Leaderboard-style race visualization. Each row = one player. The progress bar
// inside each row scales relative to the current leader so the player who's
// ahead always reaches the right edge — instantly obvious who's winning.
export default function RaceTrack({ participants = [], distance = 10, currentUserId, className = '' }) {
  const ordered = useMemo(() => (
    [...participants].sort((a, b) => (b.correct_answers || 0) - (a.correct_answers || 0))
  ), [participants]);

  const leader = ordered[0]?.correct_answers || 0;
  const max = Math.max(distance, leader || distance);

  return (
    <div className={`relative w-full p-4 sm:p-6 ${className}`}>
      <div className="flex flex-col gap-2 sm:gap-3">
        {ordered.length === 0 && (
          <div className="text-center py-12 sm:py-16 text-white/40 font-bold text-sm sm:text-base">
            Waiting for racers…
          </div>
        )}
        {ordered.map((p, idx) => {
          const correct = p.correct_answers || 0;
          const lap = Math.floor(correct / distance);
          const stepInLap = correct % distance;
          const pct = max > 0 ? Math.min(100, (correct / max) * 100) : 0;
          const isMe = p.user_id === currentUserId;
          const accent = isMe ? '#06b6d4' : colorFor(p.user_id);
          const rankColors = [
            { bg: 'from-yellow-400 to-amber-500', shadow: 'rgba(251,191,36,0.45)', icon: Trophy },
            { bg: 'from-slate-300 to-slate-400', shadow: 'rgba(203,213,225,0.4)', icon: Medal },
            { bg: 'from-orange-400 to-amber-700', shadow: 'rgba(251,146,60,0.4)', icon: Medal },
          ];
          const rankStyle = idx < 3 ? rankColors[idx] : null;
          const RankIcon = rankStyle?.icon;

          return (
            <div
              key={p.user_id}
              className="flex items-center gap-3 sm:gap-4 rounded-2xl border bg-white/[0.04] border-white/[0.06] px-3 sm:px-5 py-2.5 sm:py-3.5 transition-[transform,opacity] duration-700"
              style={{
                boxShadow: idx === 0
                  ? `0 0 0 1px ${accent}66, 0 8px 32px ${rankStyle?.shadow || 'rgba(0,0,0,0.25)'}`
                  : isMe ? `0 0 0 1px ${accent}55` : undefined,
                background: idx === 0 ? `linear-gradient(90deg, rgba(251,191,36,0.06), rgba(255,255,255,0.02))` : undefined,
              }}
            >
              {/* Rank pill */}
              <div className="flex-shrink-0 flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11">
                {rankStyle ? (
                  <div
                    className={`w-full h-full rounded-xl bg-gradient-to-br ${rankStyle.bg} flex items-center justify-center shadow-md`}
                    style={{ boxShadow: `0 4px 14px ${rankStyle.shadow}` }}
                  >
                    <RankIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" strokeWidth={2.5} />
                  </div>
                ) : (
                  <div className="w-full h-full rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center">
                    <span className="text-sm sm:text-base font-black text-white/70 tabular-nums">{idx + 1}</span>
                  </div>
                )}
              </div>

              {/* Avatar disc */}
              <div
                className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white font-black text-base sm:text-lg uppercase"
                style={{
                  background: `radial-gradient(circle at 32% 26%, rgba(255,255,255,0.35), rgba(255,255,255,0) 55%), linear-gradient(135deg, ${accent}, ${accent}cc)`,
                  boxShadow: `0 0 18px ${accent}99, 0 0 0 2px rgba(0,0,0,0.25) inset`,
                }}
              >
                {(p.player_name || '?')[0]}
              </div>

              {/* Name + progress + stats */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <div className="font-black text-white truncate text-sm sm:text-base flex items-center gap-2">
                    {p.player_name || 'Player'}
                    {isMe && <span className="text-[10px] font-black text-cyan-300 px-1.5 py-0.5 bg-cyan-500/20 rounded-full">YOU</span>}
                    {lap > 0 && (
                      <span className="text-[10px] font-black text-yellow-300 px-1.5 py-0.5 bg-yellow-500/15 rounded-full whitespace-nowrap">
                        LAP {lap}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1 flex-shrink-0">
                    <span className="text-xl sm:text-2xl font-black text-white tabular-nums">{correct}</span>
                    <span className="text-[10px] font-black uppercase tracking-wider text-white/50">correct</span>
                  </div>
                </div>
                {/* Progress bar — relative to current leader */}
                <div className="relative h-2.5 sm:h-3 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700"
                    style={{
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, ${accent}, ${accent}dd)`,
                      boxShadow: `0 0 12px ${accent}cc`,
                    }}
                  />
                  {/* Within-lap tick markers */}
                  <div className="absolute inset-0 flex pointer-events-none">
                    {Array.from({ length: Math.max(1, Math.floor(max / distance)) }).map((_, i) => (
                      <div
                        key={i}
                        className="border-r border-white/15 h-full"
                        style={{ width: `${100 / Math.max(1, Math.floor(max / distance))}%` }}
                      />
                    ))}
                  </div>
                </div>
                <div className="mt-1 text-[10px] sm:text-xs font-bold text-white/50 tabular-nums">
                  Lap {lap} · {stepInLap}/{distance}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
