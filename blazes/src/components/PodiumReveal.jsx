import { useEffect, useState } from 'react';
import { Crown } from 'lucide-react';
import { AvatarPreview } from '../pages/SkinsPage';

// Shared with GameResults.jsx so the student's "wait for it" hold lines up
// with how long the teacher's reveal actually takes.
export const PODIUM_TOTAL_MS = 5000;

const STAGE_MS = { third: 400, second: 1400, first: 2600, settled: 4200 };

const PLACE_STYLE = {
  1: { order: 'order-2', height: 'h-40 sm:h-52', top: 'bg-gradient-to-b from-yellow-300 to-amber-500', face: 'bg-gradient-to-b from-amber-400 to-amber-600', ring: 'ring-yellow-300', label: '1st' },
  2: { order: 'order-1', height: 'h-28 sm:h-36', top: 'bg-gradient-to-b from-slate-200 to-slate-400', face: 'bg-gradient-to-b from-slate-300 to-slate-500', ring: 'ring-slate-300', label: '2nd' },
  3: { order: 'order-3', height: 'h-20 sm:h-28', top: 'bg-gradient-to-b from-orange-300 to-amber-600', face: 'bg-gradient-to-b from-amber-500 to-amber-700', ring: 'ring-amber-400', label: '3rd' },
};

function PodiumBlock({ place, player, skinId, revealed }) {
  if (!player) return <div className={`flex-1 max-w-[150px] ${PLACE_STYLE[place].order}`} />;
  const style = PLACE_STYLE[place];
  const name = player.player_name || player.name || 'Player';

  return (
    <div className={`flex-1 max-w-[150px] flex flex-col items-center ${style.order}`}>
      <div
        className="flex flex-col items-center transition-all duration-500 ease-out"
        style={{
          opacity: revealed ? 1 : 0,
          transform: revealed ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.85)',
        }}
      >
        {place === 1 && <Crown className="w-8 h-8 sm:w-9 sm:h-9 text-yellow-400 drop-shadow mb-1" strokeWidth={2.5} />}
        <div className={`relative rounded-full ring-4 ${style.ring} shadow-lg mb-2`}>
          <AvatarPreview skinId={skinId || 'default'} initial={name[0]?.toUpperCase() || '?'} size={place === 1 ? 68 : 56} userId={player.user_id} />
        </div>
        <div className="font-black text-white text-sm sm:text-base text-center truncate max-w-[130px] drop-shadow">
          {name}
        </div>
        <div className="font-black text-amber-200 text-xs sm:text-sm tabular-nums">{player.score ?? 0} chips</div>
      </div>

      {/* The block itself: a light "top" face plus a darker "front" face,
          simple two-tone shading standing in for real 3D depth. */}
      <div className={`relative w-full mt-3 rounded-t-xl overflow-hidden shadow-2xl transition-all duration-500 ease-out ${style.height}`}
        style={{ opacity: revealed ? 1 : 0.15, transform: revealed ? 'scaleY(1)' : 'scaleY(0.6)', transformOrigin: 'bottom' }}>
        <div className={`absolute inset-x-0 top-0 h-3 ${style.top}`} />
        <div className={`absolute inset-0 top-3 ${style.face} flex items-start justify-center pt-2`}>
          <span className="text-2xl sm:text-3xl font-black text-white/90 drop-shadow">{style.label}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Teacher-only end-of-jackpot reveal: 3rd, then 2nd, then 1st place rise onto
 * a podium in sequence, then the rest of the field slides in beside it.
 * `top3` must already be sorted 1st→3rd. `playerSkins` maps user_id -> skinId.
 */
export default function PodiumReveal({ top3, rest, playerSkins = {} }) {
  const [stage, setStage] = useState({ third: false, second: false, first: false, settled: false });

  useEffect(() => {
    const timers = Object.entries(STAGE_MS).map(([key, ms]) =>
      setTimeout(() => setStage(s => ({ ...s, [key]: true })), ms)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const [first, second, third] = top3;

  return (
    <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-3xl p-6 sm:p-10 shadow-xl">
      <div className="flex items-end justify-center gap-3 sm:gap-5 min-h-[220px] sm:min-h-[280px]">
        <PodiumBlock place={2} player={second} skinId={playerSkins[second?.user_id]} revealed={stage.second} />
        <PodiumBlock place={1} player={first} skinId={playerSkins[first?.user_id]} revealed={stage.first} />
        <PodiumBlock place={3} player={third} skinId={playerSkins[third?.user_id]} revealed={stage.third} />
      </div>

      {rest.length > 0 && (
        <div
          className="mt-6 pt-6 border-t border-white/10 space-y-2 transition-all duration-500 ease-out"
          style={{ opacity: stage.settled ? 1 : 0, transform: stage.settled ? 'translateY(0)' : 'translateY(12px)' }}
        >
          {rest.map((p, i) => (
            <div key={p.user_id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5">
              <span className="w-5 text-center text-xs font-black text-gray-400 flex-shrink-0">#{i + 4}</span>
              <AvatarPreview skinId={playerSkins[p.user_id] || 'default'} initial={(p.player_name || p.name || '?')[0].toUpperCase()} size={32} userId={p.user_id} />
              <span className="flex-1 min-w-0 truncate font-bold text-white text-sm">{p.player_name || p.name}</span>
              <span className="font-black text-amber-300 text-sm tabular-nums">{p.score ?? 0}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
