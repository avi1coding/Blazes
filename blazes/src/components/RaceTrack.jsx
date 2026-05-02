import { useEffect, useRef, useState } from 'react';
import { Flag, Users } from 'lucide-react';

const PLAYER_COLORS = [
  '#06b6d4', '#a855f7', '#f97316', '#10b981', '#ef4444',
  '#f59e0b', '#3b82f6', '#ec4899', '#84cc16', '#8b5cf6',
];

// SVG path for the racing line — stadium oval positioned in 1000×400 viewBox.
// Start point is bottom-center so finish line sits where the eye expects it.
const TRACK_PATH = 'M 500 320 L 800 320 A 80 80 0 0 0 800 160 L 200 160 A 80 80 0 0 0 200 320 Z';

export default function RaceTrack({ participants = [], distance = 10, currentUserId, className = '' }) {
  const trackPathRef = useRef(null);
  const [pathLength, setPathLength] = useState(0);

  useEffect(() => {
    if (trackPathRef.current) {
      setPathLength(trackPathRef.current.getTotalLength());
    }
  }, []);

  const getPositionAt = (progress) => {
    if (!trackPathRef.current || !pathLength) return { x: 500, y: 320 };
    return trackPathRef.current.getPointAtLength((progress * pathLength) % pathLength);
  };

  const finishPoint = pathLength > 0 ? trackPathRef.current.getPointAtLength(0) : { x: 500, y: 320 };

  // Sort by total correct desc so top players render last (on top of stack)
  const sortedAsc = [...participants].sort((a, b) => (a.correct_answers || 0) - (b.correct_answers || 0));

  return (
    <div className={`relative ${className}`}>
      <svg viewBox="0 0 1000 400" className="w-full h-full" style={{ display: 'block' }}>
        <defs>
          {/* Sky-to-grass gradient for the infield */}
          <linearGradient id="raceTrackBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e3a8a" />
            <stop offset="100%" stopColor="#172554" />
          </linearGradient>
          <linearGradient id="trackSurface" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#dc2626" />
            <stop offset="100%" stopColor="#991b1b" />
          </linearGradient>
          <radialGradient id="grassFill" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#15803d" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Player dot drop shadow */}
          <filter id="dotShadow">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.4" />
          </filter>
        </defs>

        {/* Stadium background */}
        <rect width="1000" height="400" fill="url(#raceTrackBg)" />

        {/* Track surface (red rubberized) */}
        <path
          d="M 500 360 L 800 360 A 120 120 0 0 0 800 120 L 200 120 A 120 120 0 0 0 200 360 Z"
          fill="url(#trackSurface)"
        />

        {/* Lane dividers (4 lanes) */}
        {[100, 105, 110, 115].map(r => (
          <path
            key={r}
            d={`M 500 ${320 + (r - 100)} L 800 ${320 + (r - 100)} A ${r} ${r} 0 0 0 800 ${160 - (r - 100)} L 200 ${160 - (r - 100)} A ${r} ${r} 0 0 0 200 ${320 + (r - 100)} Z`}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="1"
          />
        ))}

        {/* Inner field (grass) */}
        <path
          d="M 500 280 L 800 280 A 40 40 0 0 0 800 200 L 200 200 A 40 40 0 0 0 200 280 Z"
          fill="url(#grassFill)"
        />

        {/* Subtle field detail */}
        <ellipse cx="500" cy="240" rx="180" ry="20" fill="rgba(255,255,255,0.05)" />

        {/* The actual race line (centerline) — players move along this */}
        <path
          ref={trackPathRef}
          d={TRACK_PATH}
          fill="none"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth="2"
          strokeDasharray="6 10"
        />

        {/* Finish line — proper checkered pattern */}
        {pathLength > 0 && (
          <g>
            {/* White base bars */}
            <rect x={finishPoint.x - 12} y={finishPoint.y - 26} width="24" height="52" fill="white" />
            {/* Checker pattern */}
            {Array.from({ length: 8 }).map((_, i) => (
              <rect
                key={i}
                x={finishPoint.x - 12 + (i % 2) * 12}
                y={finishPoint.y - 26 + Math.floor(i / 2) * 13}
                width="12" height="13"
                fill={(Math.floor(i / 2) + (i % 2)) % 2 === 0 ? 'black' : 'white'}
              />
            ))}
            {/* "FINISH" label */}
            <text x={finishPoint.x} y={finishPoint.y - 35} textAnchor="middle" fontSize="14" fontWeight="900" fill="white" stroke="black" strokeWidth="0.5">
              FINISH
            </text>
          </g>
        )}

        {/* Players (rendered with the leader on top) */}
        {pathLength > 0 && sortedAsc.map((p) => {
          const correct = p.correct_answers || 0;
          const lap = Math.floor(correct / distance);
          const progressInLap = (correct % distance) / distance;
          const pos = getPositionAt(progressInLap);
          const isMe = p.user_id === currentUserId;
          // Color: stable per user_id
          const colorIdx = (p.user_id || 0) % PLAYER_COLORS.length;
          const color = isMe ? '#06b6d4' : PLAYER_COLORS[colorIdx];

          return (
            <g key={p.user_id} style={{ transition: 'transform 700ms cubic-bezier(0.4, 0, 0.2, 1)' }}>
              {/* Outer halo for current user */}
              {isMe && (
                <circle cx={pos.x} cy={pos.y} r="22" fill={color} fillOpacity="0.25" />
              )}
              {/* Player dot with shadow */}
              <g filter="url(#dotShadow)">
                <circle cx={pos.x} cy={pos.y} r={isMe ? 16 : 13} fill={color} stroke="white" strokeWidth="3" />
                {isMe && (
                  <circle cx={pos.x} cy={pos.y} r="16" fill="none" stroke="white" strokeWidth="1" strokeOpacity="0.6">
                    <animate attributeName="r" values="16;22;16" dur="1.5s" repeatCount="indefinite" />
                    <animate attributeName="stroke-opacity" values="0.6;0;0.6" dur="1.5s" repeatCount="indefinite" />
                  </circle>
                )}
                <text x={pos.x} y={pos.y + 4} textAnchor="middle" fontSize={isMe ? '12' : '10'} fontWeight="900" fill="white">
                  {(p.player_name || '?')[0].toUpperCase()}
                </text>
              </g>
              {/* Lap badge (gold) — appears once they've completed one lap */}
              {lap > 0 && (
                <g>
                  <circle cx={pos.x + 13} cy={pos.y - 13} r="9" fill="#fbbf24" stroke="white" strokeWidth="2" filter="url(#dotShadow)" />
                  <text x={pos.x + 13} y={pos.y - 9} textAnchor="middle" fontSize="11" fontWeight="900" fill="#78350f">
                    {lap}
                  </text>
                </g>
              )}
              {/* Name label below the dot */}
              <text x={pos.x} y={pos.y + 32} textAnchor="middle" fontSize="11" fontWeight="700" fill="white" stroke="black" strokeWidth="0.4">
                {(p.player_name || 'Player').slice(0, 12)}{isMe ? ' (you)' : ''}
              </text>
            </g>
          );
        })}

        {/* Player count badge */}
        <g>
          <rect x="20" y="20" rx="8" ry="8" width="100" height="32" fill="rgba(0,0,0,0.5)" />
          <foreignObject x="20" y="20" width="100" height="32">
            <div className="w-full h-full flex items-center justify-center gap-1.5 text-white">
              <Users className="w-4 h-4" />
              <span className="font-black text-sm tabular-nums">{participants.length}</span>
            </div>
          </foreignObject>
        </g>

        {/* Lap reminder */}
        <g>
          <rect x="880" y="20" rx="8" ry="8" width="100" height="32" fill="rgba(0,0,0,0.5)" />
          <foreignObject x="880" y="20" width="100" height="32">
            <div className="w-full h-full flex items-center justify-center gap-1.5 text-white">
              <Flag className="w-4 h-4" />
              <span className="font-black text-sm">{distance}/lap</span>
            </div>
          </foreignObject>
        </g>
      </svg>
    </div>
  );
}
