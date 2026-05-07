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

  // Position along the centerline at `progress` (0..1), then shifted perpendicular
  // by `laneOffset` pixels — so players who are at the same progress (e.g. all at
  // the starting line) don't pile on top of each other.
  const getPos = (progress, laneOffset = 0) => {
    if (!trackRef.current || !pathLength) return { x: 800, y: 460 };
    const adjusted = (progress * pathLength) % pathLength;
    const p = trackRef.current.getPointAtLength(adjusted);
    if (!laneOffset) return p;
    // Tangent via a small forward step → rotate 90° for the perpendicular direction.
    const next = trackRef.current.getPointAtLength((adjusted + 1) % pathLength);
    const dx = next.x - p.x;
    const dy = next.y - p.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const perpX = -dy / len;
    const perpY = dx / len;
    return { x: p.x + perpX * laneOffset, y: p.y + perpY * laneOffset };
  };

  const finishPoint = pathLength > 0
    ? trackRef.current.getPointAtLength(0)
    : { x: 800, y: 460 };

  // Sort by total correct ascending so the leader renders LAST (and therefore on top)
  const sortedAsc = [...participants].sort((a, b) => (a.correct_answers || 0) - (b.correct_answers || 0));

  // Cluster players that share the same progress and fan them across 4 lanes so
  // each one stays visible. Using a Map keyed by exact correct_answers count means
  // every player at the start is in the same cluster and gets a different lane.
  const clusterIndex = new Map();
  const LANE_OFFSETS = [-30, -10, 10, 30]; // 4 lanes spread across the ~100px track band
  for (const p of [...participants].sort((a, b) => (b.correct_answers || 0) - (a.correct_answers || 0))) {
    const key = p.correct_answers || 0;
    const i = clusterIndex.get(`__count_${key}`) || 0;
    clusterIndex.set(p.user_id, i);
    clusterIndex.set(`__count_${key}`, i + 1);
  }
  const laneFor = (p) => {
    const i = clusterIndex.get(p.user_id) ?? 0;
    return LANE_OFFSETS[i % LANE_OFFSETS.length];
  };

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

        {/* PLAYERS — leader on top, clustered players spread across 4 lanes.
            Each runner is a translate group so SVG transform smoothly tweens
            position changes. A nested group adds a continuous bobbing motion
            so the runners feel like they're actively running rather than
            sliding statically along the track. */}
        {pathLength > 0 && sortedAsc.map((p) => {
          const correct = p.correct_answers || 0;
          const lap = Math.floor(correct / distance);
          const progressInLap = (correct % distance) / distance;
          const pos = getPos(progressInLap, laneFor(p));
          const isMe = p.user_id === currentUserId;
          const color = isMe ? '#06b6d4' : colorFor(p.user_id);
          const r = isMe ? 22 : 18;
          const initial = (p.player_name || '?')[0].toUpperCase();
          const name = (p.player_name || 'Player').slice(0, 12);
          const labelW = name.length * 8 + 16;
          // Stagger each runner's bob phase so they don't all bounce in sync —
          // looks more like a real pack of runners.
          const phase = ((Math.abs(p.user_id || 0) * 137) % 1000) / 1000;
          const bobDur = isMe ? 0.55 : 0.6 + (phase * 0.2);
          const bobBegin = -(phase * bobDur).toFixed(3) + 's';

          return (
            <g
              key={p.user_id}
              style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, transition: 'transform 700ms cubic-bezier(0.4, 0, 0.2, 1)' }}
            >
              {/* Bob layer — small Y oscillation = running motion */}
              <g>
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  values="0,0; 0,-3; 0,0; 0,1; 0,0"
                  keyTimes="0; 0.25; 0.5; 0.75; 1"
                  dur={`${bobDur}s`}
                  begin={bobBegin}
                  repeatCount="indefinite"
                />
                {/* Soft colored aura */}
                <circle cx="0" cy="0" r={r + 16} fill={color} opacity="0.3" filter="url(#rt-glow)" />
                {/* Main dot with white ring + drop shadow */}
                <g filter="url(#rt-dot-shadow)">
                  <circle cx="0" cy="0" r={r} fill={color} stroke="white" strokeWidth="3.5" />
                  {/* Glossy highlight on the dot for that 3D-orb feel */}
                  <ellipse
                    cx={-r * 0.32}
                    cy={-r * 0.4}
                    rx={r * 0.4}
                    ry={r * 0.25}
                    fill="rgba(255,255,255,0.45)"
                  />
                  <text
                    x="0"
                    y={isMe ? 6 : 5}
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
                  <circle cx="0" cy="0" r={r + 4} fill="none" stroke={color} strokeWidth="2" strokeOpacity="0.7">
                    <animate attributeName="r" values={`${r + 2};${r + 14};${r + 2}`} dur="1.6s" repeatCount="indefinite" />
                    <animate attributeName="stroke-opacity" values="0.7;0;0.7" dur="1.6s" repeatCount="indefinite" />
                  </circle>
                )}
                {/* Lap counter badge — gold disc with the lap number */}
                {lap > 0 && (
                  <g filter="url(#rt-dot-shadow)">
                    <circle cx={r - 4} cy={-r + 4} r="11" fill="#fbbf24" stroke="white" strokeWidth="2.5" />
                    <text
                      x={r - 4}
                      y={-r + 8}
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
                    x={-labelW / 2}
                    y={r + 10}
                    width={labelW}
                    height="22"
                    rx="11"
                    fill="rgba(2,6,23,0.85)"
                    stroke={color}
                    strokeWidth="1.5"
                    strokeOpacity="0.6"
                  />
                  <text
                    x="0"
                    y={r + 25}
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight="800"
                    fill="white"
                  >
                    {name}
                  </text>
                </g>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
