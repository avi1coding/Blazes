import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Flame, Ghost, Users, Crown } from 'lucide-react';
import { AvatarPreview, cacheTier } from './SkinsPage';

function computeFireLevel(startedAt, settings) {
  if (!startedAt) return 0;
  const start = new Date(startedAt.includes('T') ? startedAt : startedAt.replace(' ', 'T') + 'Z').getTime();
  const elapsed = (Date.now() - start) / 1000;
  if (elapsed <= 0) return 0;
  const initialInterval = settings?.initialFireInterval || 5;
  const accelEvery = settings?.fireAccelerationInterval || 30;
  const accelAmount = settings?.fireAccelerationAmount || 0.5;
  const minInterval = settings?.minFireInterval || 1.5;
  let fireFloor = 0, currentInterval = initialInterval, time = 0;
  while (time < elapsed) {
    const nextAccel = Math.ceil((time + 0.001) / accelEvery) * accelEvery;
    const timeUntilAccel = nextAccel - time;
    const timeRemaining = elapsed - time;
    const chunk = Math.min(timeUntilAccel, timeRemaining);
    fireFloor += Math.floor(chunk / currentInterval);
    if (timeRemaining <= timeUntilAccel) break;
    currentInterval = Math.max(minInterval, currentInterval - accelAmount);
    time = nextAccel;
  }
  return Math.max(0, fireFloor - 3);
}

export default function InfernoTowerView() {
  const { gameCode } = useParams();
  const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

  const [data, setData] = useState(null);
  const [fireLevel, setFireLevel] = useState(0);
  const [playerSkins, setPlayerSkins] = useState({});
  const fetchedSkins = useRef(new Set());

  // Poll
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`${base}/api/games/${gameCode}/inferno-state`);
        if (res.ok) {
          const d = await res.json();
          setData(d);
          // Fetch skins
          (d.participants || []).forEach(p => {
            if (fetchedSkins.current.has(p.user_id)) return;
            fetchedSkins.current.add(p.user_id);
            fetch(`${base}/api/skins/${p.user_id}`)
              .then(r => r.json())
              .then(s => { if (s.equipped?.avatar_skin) setPlayerSkins(prev => ({ ...prev, [p.user_id]: s.equipped.avatar_skin })); if (s.tier) cacheTier(p.user_id, s.tier); })
              .catch(() => {});
          });
        }
      } catch (_) { }
    };
    poll();
    const t = setInterval(poll, 1500);
    return () => clearInterval(t);
  }, [gameCode, base]);

  // Smooth fire level
  useEffect(() => {
    if (!data?.started_at) return;
    const tick = () => setFireLevel(computeFireLevel(data.started_at, data.settings));
    tick();
    const t = setInterval(tick, 200);
    return () => clearInterval(t);
  }, [data?.started_at, data?.settings]);

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Flame className="w-16 h-16 text-orange-500 animate-pulse" />
      </div>
    );
  }

  const players = (data.participants || []).sort((a, b) => (b.tower_floor || 0) - (a.tower_floor || 0));
  const alive = players.filter(p => !p.is_ghost);
  const ghosts = players.filter(p => p.is_ghost);
  const maxFloor = Math.max(fireLevel, ...players.map(p => p.tower_floor || 0), 10) + 3;
  const ended = data.status === 'ended';
  const wasTiebreaker = data.suddenDeath === 2;
  const winner = ended && alive.length > 0 ? alive[0] : null;

  // Tower floor lines
  // Build visible floor range (viewport shows ~20 floors centered on action)
  const viewFloors = 20;
  const actionCenter = Math.max(fireLevel, ...alive.map(p => p.tower_floor || 0));
  const viewBottom = Math.max(0, actionCenter - Math.floor(viewFloors * 0.4));
  const viewTop = viewBottom + viewFloors;
  const floorHeight = 100 / viewFloors; // percent per floor

  // Assign player columns within tower
  const cols = Math.max(2, Math.min(players.length, 6));
  const colWidth = 100 / (cols + 1);

  // Group players by floor for positioning
  const playersByFloor = {};
  players.forEach(p => {
    const f = p.tower_floor || 0;
    if (!playersByFloor[f]) playersByFloor[f] = [];
    playersByFloor[f].push(p);
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-950 via-gray-950 to-gray-950 flex flex-col overflow-hidden">
      <style>{`
        @keyframes flicker { 0%,100%{opacity:0.8} 50%{opacity:1} }
        @keyframes rise { 0%{transform:translateY(0) scale(1);opacity:1} 100%{transform:translateY(-60px) scale(0.3);opacity:0} }
        @keyframes sway { 0%,100%{transform:translateX(0)} 50%{transform:translateX(3px)} }
      `}</style>

      {/* Header */}
      <div className="bg-black/60 backdrop-blur px-6 py-3 flex items-center justify-between flex-shrink-0 z-20 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <Flame className="w-8 h-8 text-orange-500" strokeWidth={2.5} />
          <span className="text-2xl font-black text-white">Inferno Tower</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-green-400" />
            <span className="font-black text-green-400 text-lg">{alive.length}</span>
            <span className="text-gray-500 text-sm font-bold">alive</span>
          </div>
          <div className="flex items-center gap-2">
            <Ghost className="w-5 h-5 text-purple-400" />
            <span className="font-black text-purple-400 text-lg">{ghosts.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-400" />
            <span className="font-black text-orange-400 text-lg">F{fireLevel}</span>
          </div>
        </div>
      </div>

      {/* Podium overlay */}
      {ended && winner && (() => {
        const sorted = [...players].sort((a, b) => {
          if ((a.is_ghost || 0) !== (b.is_ghost || 0)) return (a.is_ghost || 0) - (b.is_ghost || 0);
          return (b.tower_floor || 0) - (a.tower_floor || 0);
        });
        const top3 = sorted.slice(0, 3);
        const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3.length >= 2 ? [top3[1], top3[0]] : [top3[0]];
        const podiumHeights = ['h-28', 'h-40', 'h-20'];
        const podiumColors = ['bg-gradient-to-t from-gray-500 to-gray-400', 'bg-gradient-to-t from-yellow-500 to-yellow-400', 'bg-gradient-to-t from-amber-700 to-amber-600'];
        const placeLabels = ['2nd', '1st', '3rd'];
        const placeTextColors = ['text-gray-300', 'text-yellow-400', 'text-amber-500'];

        return (
          <div className="fixed inset-0 z-30 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm">
            <h1 className="text-5xl sm:text-6xl font-black text-white mb-2">Game Over!</h1>
            <p className="text-gray-400 text-lg font-bold mb-10">{wasTiebreaker ? 'Decided by Tiebreaker' : 'Final Results'}</p>

            {/* Podium */}
            <div className="flex items-end justify-center gap-3 sm:gap-6 mb-8">
              {podiumOrder.map((p, i) => {
                if (!p) return null;
                const actualIndex = top3.length >= 3 ? i : i === 1 ? 0 : 1;
                const height = top3.length >= 3 ? podiumHeights[i] : i === 1 ? podiumHeights[1] : podiumHeights[0];
                const color = top3.length >= 3 ? podiumColors[i] : i === 1 ? podiumColors[1] : podiumColors[0];
                const label = top3.length >= 3 ? placeLabels[i] : i === 1 ? '1st' : '2nd';
                const textColor = top3.length >= 3 ? placeTextColors[i] : i === 1 ? placeTextColors[1] : placeTextColors[0];
                const isWinner = label === '1st';

                return (
                  <div key={p.user_id} className="flex flex-col items-center">
                    {/* Crown for 1st */}
                    {isWinner && <Crown className="w-10 h-10 text-yellow-400 mb-2 drop-shadow-lg" strokeWidth={2.5} />}
                    {/* Avatar */}
                    <div className="mb-2">
                      <AvatarPreview skinId={playerSkins[p.user_id] || 'default'} initial={(p.player_name || '?')[0].toUpperCase()} size={isWinner ? 72 : 56} />
                    </div>
                    <span className="font-black text-white text-sm sm:text-base mb-1">{p.player_name?.split(' ')[0]}</span>
                    <span className="text-xs font-bold text-orange-400 mb-2">
                      {wasTiebreaker ? (isWinner ? 'Tiebreaker Winner' : 'Tiebreaker') : `Floor ${p.tower_floor || 0}`} &middot; {p.score || 0}pts
                    </span>
                    {/* Podium block */}
                    <div className={`${color} ${height} w-24 sm:w-32 rounded-t-xl flex items-start justify-center pt-3`}>
                      <span className={`text-2xl sm:text-3xl font-black ${textColor} drop-shadow`}>{label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Tower + Scenery */}
      <div className="flex-1 flex items-stretch overflow-hidden relative">
        {/* Background sky */}
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/30 via-transparent to-transparent" />

        {/* Left side: Floor labels */}
        <div className="w-16 flex-shrink-0 relative z-10">
          {Array.from({ length: viewFloors + 1 }).map((_, i) => {
            const floor = viewBottom + i;
            const bottom = i * floorHeight;
            return (
              <div key={floor} className="absolute right-0 w-full flex items-center justify-end pr-2"
                style={{ bottom: `${bottom}%`, height: `${floorHeight}%` }}>
                <span className={`text-xs font-black tabular-nums ${floor <= fireLevel ? 'text-orange-500' : 'text-gray-600'}`}>
                  {floor}
                </span>
              </div>
            );
          })}
        </div>

        {/* Tower structure */}
        <div className="flex-1 relative" style={{ maxWidth: 600, margin: '0 auto' }}>
          {/* Tower body */}
          <div className="absolute inset-x-4 top-0 bottom-0 z-0">
            {/* Brick pattern floors */}
            {Array.from({ length: viewFloors + 1 }).map((_, i) => {
              const floor = viewBottom + i;
              const bottom = i * floorHeight;
              const isOnFire = floor <= fireLevel;
              return (
                <div key={floor} className="absolute left-0 right-0" style={{ bottom: `${bottom}%`, height: `${floorHeight}%` }}>
                  {/* Floor platform */}
                  <div className={`absolute bottom-0 left-0 right-0 h-[2px] ${isOnFire ? 'bg-orange-700' : 'bg-gray-700'}`} />
                  {/* Brick wall */}
                  <div className={`absolute inset-0 border-l-2 border-r-2 ${isOnFire ? 'border-orange-800/60 bg-orange-950/30' : 'border-gray-800/60 bg-gray-900/40'}`}>
                    {/* Windows */}
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-around px-4">
                      {[0, 1, 2].map(w => (
                        <div key={w} className={`w-4 h-3 rounded-t-sm ${isOnFire ? 'bg-orange-600/40' : 'bg-yellow-900/20 border border-gray-700/40'}`} />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Tower top cap */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[40px] border-r-[40px] border-b-[16px] border-l-transparent border-r-transparent border-b-gray-700 z-10" />
          </div>

          {/* Fire overlay on tower */}
          {fireLevel > viewBottom && (
            <div className="absolute inset-x-4 bottom-0 z-10 pointer-events-none transition-all duration-500"
              style={{ height: `${Math.min(100, ((fireLevel - viewBottom) / viewFloors) * 100)}%` }}>
              <div className="absolute inset-0 bg-gradient-to-t from-red-800/90 via-orange-700/70 to-orange-500/20 rounded-t-lg" />
              {/* Flames at the top of fire */}
              <div className="absolute -top-8 left-0 right-0 h-12 flex justify-around items-end overflow-hidden">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="relative" style={{ animation: `sway ${1 + i * 0.1}s ease-in-out infinite` }}>
                    <div className="w-3 rounded-full bg-gradient-to-t from-red-600 to-yellow-400"
                      style={{ height: 16 + Math.sin(i * 1.3) * 10, animation: `flicker ${0.5 + i * 0.1}s ease-in-out infinite` }} />
                  </div>
                ))}
              </div>
              {/* Embers */}
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="absolute w-1.5 h-1.5 bg-yellow-400 rounded-full"
                  style={{
                    left: `${10 + (i * 9)}%`,
                    bottom: `${90 + Math.random() * 10}%`,
                    animation: `rise ${1.5 + i * 0.2}s ease-out infinite`,
                    animationDelay: `${i * 0.3}s`,
                  }} />
              ))}
            </div>
          )}

          {/* Players on the tower */}
          {players.map(p => {
            const floor = p.tower_floor || 0;
            if (floor < viewBottom - 1 || floor > viewTop + 1) return null; // off screen
            const bottomPercent = ((floor - viewBottom) / viewFloors) * 100;
            const isLeader = alive.length > 0 && p.user_id === alive[0]?.user_id;
            const isFrozen = p.frozen_until && new Date(p.frozen_until.includes?.('T') ? p.frozen_until : (p.frozen_until || '').replace(' ', 'T') + 'Z').getTime() > Date.now();
            // Position within floor
            const floorPlayers = playersByFloor[floor] || [];
            const idx = floorPlayers.indexOf(p);
            const xOffset = floorPlayers.length === 1 ? 50 : 20 + (idx / (floorPlayers.length - 1)) * 60;

            return (
              <div key={p.user_id}
                className={`absolute z-20 flex flex-col items-center transition-all duration-700 ease-out ${p.is_ghost ? 'opacity-25' : ''}`}
                style={{ bottom: `${Math.max(0, Math.min(95, bottomPercent))}%`, left: `${xOffset}%`, transform: 'translate(-50%, 50%)' }}>
                {isLeader && !p.is_ghost && <Crown className="w-5 h-5 text-yellow-400 mb-0.5 drop-shadow" strokeWidth={2.5} />}
                <div className={`relative ${isFrozen && !p.is_ghost ? 'ring-3 ring-blue-400 rounded-full shadow-[0_0_12px_#60a5fa]' : ''}`}>
                  <AvatarPreview skinId={playerSkins[p.user_id] || 'default'} initial={(p.player_name || '?')[0].toUpperCase()} size={48} />
                  {p.is_ghost && <Ghost className="absolute -top-1 -right-1 w-4 h-4 text-purple-400" />}
                </div>
                <div className="mt-1 bg-black/80 backdrop-blur-sm px-2 py-0.5 rounded-md text-center border border-gray-700/50">
                  <div className="text-xs font-black text-white leading-tight">{p.player_name?.split(' ')[0]}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right side: Leaderboard */}
        <div className="w-56 flex-shrink-0 bg-black/40 backdrop-blur-sm border-l border-gray-800 p-3 z-10 overflow-y-auto">
          <h4 className="text-xs font-black text-gray-500 mb-3 uppercase tracking-wider">Leaderboard</h4>
          <div className="space-y-1.5">
            {players.map((p, i) => {
              // Tied placement: same floor + same ghost status = same rank
              const place = i === 0 ? 1 : (
                (p.tower_floor || 0) === (players[i - 1].tower_floor || 0) && (p.is_ghost || 0) === (players[i - 1].is_ghost || 0)
                  ? (() => { let j = i - 1; while (j > 0 && (players[j].tower_floor || 0) === (players[j - 1].tower_floor || 0) && (players[j].is_ghost || 0) === (players[j - 1].is_ghost || 0)) j--; return j + 1; })()
                  : i + 1
              );
              return (
                <div key={p.user_id} className={`flex items-center gap-2 p-2 rounded-lg ${p.is_ghost ? 'opacity-40' : place === 1 ? 'bg-yellow-900/30 border border-yellow-800/50' : 'bg-gray-800/50'}`}>
                  <span className={`text-xs font-black w-5 ${place === 1 ? 'text-yellow-400' : 'text-gray-500'}`}>#{place}</span>
                  <AvatarPreview skinId={playerSkins[p.user_id] || 'default'} initial={(p.player_name || '?')[0].toUpperCase()} size={24} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white truncate">{p.player_name?.split(' ')[0]}</div>
                  </div>
                  <span className="text-xs font-black text-orange-400">F{p.tower_floor || 0}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
