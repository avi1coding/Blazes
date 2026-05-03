import { useEffect, useRef, useState } from 'react';

const PLAYER_COLORS = [
  '#06b6d4', '#a855f7', '#f97316', '#10b981', '#ef4444',
  '#f59e0b', '#3b82f6', '#ec4899', '#84cc16', '#8b5cf6',
];
const colorFor = (id) => PLAYER_COLORS[Math.abs((id || 0)) % PLAYER_COLORS.length];

// The race line. Stadium oval that starts at bottom-center so the FINISH line
// sits where the eye expects it. Counter-clockwise direction (matches running
// tracks in real life).
const TRACK_PATH = 'M 800 460 L 1300 460 A 160 160 0 0 0 1300 140 L 300 140 A 160 160 0 0 0 300 460 Z';

export default function RaceTrack({ participants = [], distance = 10, currentUserId, className = '' }) {
  const trackRef = useRef(null);
  const [pathLength, setPathLength] = useState(0);

  useEffect(() => {
    if (trackRef.current) {
      setPathLength(trackRef.current.getTotalLength());
    }
  }, []);

  const getPos = (progress) => {
    if (!trackRef.current || !pathLength) return { x: 800, y: 460 };
    return trackRef.current.getPointAtLength((progress * pathLength) % pathLength);
  };

  const finishPoint = pathLength > 0
    ? trackRef.current.getPointAtLength(0)
    : { x: 800, y: 460 };

  // Sort by total correct ascending so the leader renders LAST (and therefore on top)
  const sortedAsc = [...participants].sort((a, b) => (a.correct_answers || 0) - (b.correct_answers || 0));

  return (
    <div className={`relative ${className}`}>
      <svg viewBox="0 0 1600 600" className="w-full h-full" style={{ display: 'block' }}>
        <defs>
          {/* Track surface gradient — graphite, top→bottom shading for depth */}
          <linearGradient id="rt-surface" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1f2937" />
            <stop offset="50%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>
          {/* Cyan rim glow that sits just outside the track */}
          <linearGradient id="rt-rim" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#0891b2" />
          </linearGradient>
          {/* Subtle radial vignette behind everything */}
          <radialGradient id="rt-bg" cx="50%" cy="55%" r="65%">
            <stop offset="0%" stopColor="rgba(56,189,248,0.07)" />
            <stop offset="100%" stopColor="rgba(56,189,248,0)" />
          </radialGradient>

          {/* Drop shadow + colored glow filters */}
          <filter id="rt-dot-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.55" />
          </filter>
          <filter id="rt-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        {/* Background vignette */}
        <rect width="1600" height="600" fill="url(#rt-bg)" />

        {/* OUTER GLOW — soft cyan halo just outside the track band */}
        <path
          d={TRACK_PATH}
          fill="none"
          stroke="#06b6d4"
          strokeWidth="118"
          strokeOpacity="0.18"
          strokeLinecap="butt"
          filter="url(#rt-glow)"
        />

        {/* TRACK SURFACE — the thick band players race around */}
        <path
          d={TRACK_PATH}
          fill="none"
          stroke="url(#rt-surface)"
          strokeWidth="100"
          strokeLinecap="butt"
        />

        {/* Inner + outer rim highlights — bright thin strokes that read as the track edges */}
        <path
          d={TRACK_PATH}
          fill="none"
          stroke="rgba(56,189,248,0.55)"
          strokeWidth="102"
          strokeLinecap="butt"
          opacity="0"
        />
        {/* Lane separators — concentric dashed strokes inside the track for depth */}
        {[
          { offset: -34, opacity: 0.06, dash: '8 14' },
          { offset: 0, opacity: 0.45, dash: '14 18' },
          { offset: 34, opacity: 0.06, dash: '8 14' },
        ].map((cfg, i) => (
          <path
            key={i}
            d={TRACK_PATH}
            fill="none"
            stroke="white"
            strokeOpacity={cfg.opacity}
            strokeWidth={cfg.offset === 0 ? 2 : 1.5}
            strokeDasharray={cfg.dash}
            transform={`translate(0,${cfg.offset * 0})`}
            // The CENTERLINE is also our path-length reference for player position
            ref={cfg.offset === 0 ? trackRef : null}
          />
        ))}

        {/* FINISH line — bold checkered band crossing the track surface */}
        {pathLength > 0 && (() => {
          const checkW = 18;
          const checkH = 13;
          const cols = 2;
          const rows = 8; // 8 rows × 13 = 104, just over the 100-wide track band
          return (
            <g filter="url(#rt-dot-shadow)">
              {/* White backing card behind the checkers for emphasis */}
              <rect
                x={finishPoint.x - 22}
                y={finishPoint.y - (rows * checkH) / 2 - 2}
                width={cols * checkW + 8}
                height={rows * checkH + 4}
                fill="white"
                rx="2"
              />
              {Array.from({ length: rows * cols }).map((_, i) => {
                const c = i % cols;
                const r = Math.floor(i / cols);
                return (
                  <rect
                    key={i}
                    x={finishPoint.x - (cols * checkW) / 2 + c * checkW}
                    y={finishPoint.y - (rows * checkH) / 2 + r * checkH}
                    width={checkW}
                    height={checkH}
                    fill={(c + r) % 2 === 0 ? '#0a0e1a' : 'white'}
                  />
                );
              })}
              {/* "FINISH" label — pill above the checkered band */}
              <rect
                x={finishPoint.x - 50}
                y={finishPoint.y - (rows * checkH) / 2 - 38}
                width="100"
                height="26"
                rx="13"
                fill="#0a0e1a"
                stroke="white"
                strokeWidth="2"
              />
              <text
                x={finishPoint.x}
                y={finishPoint.y - (rows * checkH) / 2 - 20}
                textAnchor="middle"
                fontSize="16"
                fontWeight="900"
                fill="white"
                letterSpacing="2"
              >
                FINISH
              </text>
            </g>
          );
        })()}

        {/* PLAYERS — leader on top */}
        {pathLength > 0 && sortedAsc.map((p) => {
          const correct = p.correct_answers || 0;
          const lap = Math.floor(correct / distance);
          const progressInLap = (correct % distance) / distance;
          const pos = getPos(progressInLap);
          const isMe = p.user_id === currentUserId;
          const color = isMe ? '#06b6d4' : colorFor(p.user_id);
          const r = isMe ? 22 : 18;
          const initial = (p.player_name || '?')[0].toUpperCase();
          const name = (p.player_name || 'Player').slice(0, 12);
          const labelW = name.length * 8 + 16;

          return (
            <g key={p.user_id} style={{ transition: 'transform 700ms cubic-bezier(0.4, 0, 0.2, 1)' }}>
              {/* Soft colored aura */}
              <circle cx={pos.x} cy={pos.y} r={r + 16} fill={color} opacity="0.3" filter="url(#rt-glow)" />
              {/* Main dot with white ring + drop shadow */}
              <g filter="url(#rt-dot-shadow)">
                <circle cx={pos.x} cy={pos.y} r={r} fill={color} stroke="white" strokeWidth="3.5" />
                {/* Glossy highlight on the dot for that 3D-orb feel */}
                <ellipse
                  cx={pos.x - r * 0.32}
                  cy={pos.y - r * 0.4}
                  rx={r * 0.4}
                  ry={r * 0.25}
                  fill="rgba(255,255,255,0.45)"
                />
                <text
                  x={pos.x}
                  y={pos.y + (isMe ? 6 : 5)}
                  textAnchor="middle"
                  fontSize={isMe ? 18 : 14}
                  fontWeight="900"
                  fill="white"
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                >
                  {initial}
                </text>
              </g>
              {/* Pulsing ring for current user */}
              {isMe && (
                <circle cx={pos.x} cy={pos.y} r={r + 4} fill="none" stroke={color} strokeWidth="2" strokeOpacity="0.7">
                  <animate attributeName="r" values={`${r + 2};${r + 14};${r + 2}`} dur="1.6s" repeatCount="indefinite" />
                  <animate attributeName="stroke-opacity" values="0.7;0;0.7" dur="1.6s" repeatCount="indefinite" />
                </circle>
              )}
              {/* Lap counter badge — gold disc with the lap number */}
              {lap > 0 && (
                <g filter="url(#rt-dot-shadow)">
                  <circle cx={pos.x + r - 4} cy={pos.y - r + 4} r="11" fill="#fbbf24" stroke="white" strokeWidth="2.5" />
                  <text
                    x={pos.x + r - 4}
                    y={pos.y - r + 8}
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight="900"
                    fill="#78350f"
                  >
                    {lap}
                  </text>
                </g>
              )}
              {/* Name label — pill below the dot */}
              <g>
                <rect
                  x={pos.x - labelW / 2}
                  y={pos.y + r + 10}
                  width={labelW}
                  height="22"
                  rx="11"
                  fill="rgba(2,6,23,0.85)"
                  stroke={color}
                  strokeWidth="1.5"
                  strokeOpacity="0.6"
                />
                <text
                  x={pos.x}
                  y={pos.y + r + 25}
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="800"
                  fill="white"
                >
                  {name}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
