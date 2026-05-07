import { useEffect, useRef, useState } from 'react';
import { getSkinById, getSkinIcon } from '../pages/SkinsPage';

const FALLBACK_COLORS = [
  '#06b6d4', '#a855f7', '#f97316', '#10b981', '#ef4444',
  '#f59e0b', '#3b82f6', '#ec4899', '#84cc16', '#8b5cf6',
];
const fallbackColor = (id) => FALLBACK_COLORS[Math.abs((id || 0)) % FALLBACK_COLORS.length];

// Stadium oval — same shape as before so the lane math still lines up.
// Counter-clockwise from bottom-center, finish line at the start.
const TRACK_PATH = 'M 800 460 L 1300 460 A 160 160 0 0 0 1300 140 L 300 140 A 160 160 0 0 0 300 460 Z';
// Inner outline of the infield (centerline minus track-band/2 ≈ 50). Fills the
// green grass with a slight curve — same oval but tightened.
const INFIELD_PATH = 'M 800 410 L 1300 410 A 110 110 0 0 0 1300 190 L 300 190 A 110 110 0 0 0 300 410 Z';

// Helpful for lighten/darken without a CSS framework. Mixes a hex into white/black.
function blend(hex, mix, towardsWhite) {
  if (!hex || !hex.startsWith('#') || (hex.length !== 7 && hex.length !== 4)) return hex;
  const full = hex.length === 4
    ? '#' + hex.slice(1).split('').map(c => c + c).join('')
    : hex;
  const r = parseInt(full.slice(1, 3), 16);
  const g = parseInt(full.slice(3, 5), 16);
  const b = parseInt(full.slice(5, 7), 16);
  const target = towardsWhite ? 255 : 0;
  const m = (c) => Math.round(c + (target - c) * mix);
  const toHex = (c) => c.toString(16).padStart(2, '0');
  return '#' + toHex(m(r)) + toHex(m(g)) + toHex(m(b));
}

export default function RaceTrack({ participants = [], distance = 10, currentUserId, className = '' }) {
  const trackRef = useRef(null);
  const [pathLength, setPathLength] = useState(0);

  useEffect(() => {
    if (trackRef.current) {
      setPathLength(trackRef.current.getTotalLength());
    }
  }, []);

  // Position + rotation along the centerline at `progress` (0..1), shifted perpendicular
  // by `laneOffset` so players sharing the same progress fan into separate lanes.
  // Returns { x, y, angle } where angle is the path tangent in degrees so a car
  // rendered with rotate(angle) points the way it's running.
  const getPos = (progress, laneOffset = 0) => {
    if (!trackRef.current || !pathLength) return { x: 800, y: 460, angle: 0 };
    const adjusted = (progress * pathLength) % pathLength;
    const p = trackRef.current.getPointAtLength(adjusted);
    const next = trackRef.current.getPointAtLength((adjusted + 1) % pathLength);
    const dx = next.x - p.x;
    const dy = next.y - p.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    if (!laneOffset) return { x: p.x, y: p.y, angle };
    const perpX = -dy / len;
    const perpY = dx / len;
    return { x: p.x + perpX * laneOffset, y: p.y + perpY * laneOffset, angle };
  };

  const finishPoint = pathLength > 0
    ? trackRef.current.getPointAtLength(0)
    : { x: 800, y: 460 };

  // Sort by total correct ascending so the leader renders LAST (and therefore on top)
  const sortedAsc = [...participants].sort((a, b) => (a.correct_answers || 0) - (b.correct_answers || 0));

  // Cluster players that share the same progress and fan them across 4 lanes.
  const clusterIndex = new Map();
  const LANE_OFFSETS = [-32, -11, 11, 32]; // 4 lanes spread across the ~100px track band
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
          {/* Track surface — classic clay-red, slight top-down shading for depth */}
          <linearGradient id="rt-surface" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c2410c" />
            <stop offset="50%" stopColor="#9a3412" />
            <stop offset="100%" stopColor="#7c2d12" />
          </linearGradient>
          {/* Inner infield grass — bright green, vignette */}
          <radialGradient id="rt-grass" cx="50%" cy="55%" r="70%">
            <stop offset="0%" stopColor="#86efac" />
            <stop offset="60%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#15803d" />
          </radialGradient>
          {/* Outer area — concrete/stadium ring */}
          <linearGradient id="rt-outer" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1f2937" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>

          {/* Drop shadow + glow filters for cars */}
          <filter id="rt-car-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#000" floodOpacity="0.55" />
          </filter>
          <filter id="rt-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        {/* Outer stadium background */}
        <rect width="1600" height="600" fill="url(#rt-outer)" />

        {/* Concrete kerb — white outline just outside the track band */}
        <path
          d={TRACK_PATH}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth="118"
          strokeLinecap="butt"
          opacity="0.35"
        />

        {/* TRACK SURFACE — red clay band */}
        <path
          d={TRACK_PATH}
          fill="none"
          stroke="url(#rt-surface)"
          strokeWidth="100"
          strokeLinecap="butt"
        />

        {/* Inner kerb (red/white candy stripe near the infield boundary) */}
        <path
          d={INFIELD_PATH}
          fill="none"
          stroke="white"
          strokeWidth="6"
          strokeDasharray="22 22"
          opacity="0.95"
        />
        <path
          d={INFIELD_PATH}
          fill="none"
          stroke="#dc2626"
          strokeWidth="6"
          strokeDasharray="22 22"
          strokeDashoffset="22"
          opacity="0.9"
        />

        {/* Green infield */}
        <path d={INFIELD_PATH} fill="url(#rt-grass)" />

        {/* Centerline — single dashed white stroke down the middle of the band.
            Per-lane parallel lines aren't possible without computing offset
            paths, but the kerbs above + this centerline read clearly as a track. */}
        <path
          ref={trackRef}
          d={TRACK_PATH}
          fill="none"
          stroke="white"
          strokeOpacity="0.5"
          strokeWidth="2"
          strokeDasharray="22 28"
        />

        {/* FINISH line — bold checkered band crossing the track surface */}
        {pathLength > 0 && (() => {
          const checkW = 18;
          const checkH = 13;
          const cols = 2;
          const rows = 8; // 8 rows × 13 = 104, just over the 100-wide track band
          return (
            <g filter="url(#rt-car-shadow)">
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

        {/* CARS — leader on top, clustered players spread across 4 lanes.
            Each player is a translate+rotate group so the car body faces the way
            it's racing. A nested transform handles the bobbing motion. */}
        {pathLength > 0 && sortedAsc.map((p) => {
          const correct = p.correct_answers || 0;
          const lap = Math.floor(correct / distance);
          const progressInLap = (correct % distance) / distance;
          const pos = getPos(progressInLap, laneFor(p));
          const isMe = p.user_id === currentUserId;
          // Car colors come from the player's equipped skin so each one is
          // visually themed. Falls back to a per-id color if no skin info.
          const skinId = p.avatar_skin || null;
          const skin = skinId ? getSkinById(skinId) : null;
          const SkinIcon = skinId ? getSkinIcon(skinId) : null;
          const baseColor = skin?.glow || fallbackColor(p.user_id);
          const bodyTop = blend(baseColor, 0.35, true);   // lighter top
          const bodyMid = baseColor;
          const bodyBot = blend(baseColor, 0.4, false);   // darker bottom
          const trim = blend(baseColor, 0.55, false);     // dark trim
          // Scale: leader/me bigger so they read clearly
          const scale = isMe ? 1.15 : 1.0;
          const carW = 56 * scale;   // length
          const carH = 28 * scale;   // width
          const wheelR = 5.5 * scale;
          const name = (p.player_name || 'Player').slice(0, 12);
          const labelW = name.length * 8 + 16;
          // Phase offset so the cars don't all bob in sync.
          const phase = ((Math.abs(p.user_id || 0) * 137) % 1000) / 1000;
          const bobDur = 0.55 + phase * 0.25;
          const bobBegin = -(phase * bobDur).toFixed(3) + 's';
          const carGradId = `rt-body-${Math.abs(p.user_id || 0)}`;

          return (
            <g
              key={p.user_id}
              style={{
                transform: `translate(${pos.x}px, ${pos.y}px) rotate(${pos.angle}deg)`,
                transition: 'transform 700ms cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              {/* Per-car gradient (defined inline so it picks up skin color) */}
              <defs>
                <linearGradient id={carGradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={bodyTop} />
                  <stop offset="50%" stopColor={bodyMid} />
                  <stop offset="100%" stopColor={bodyBot} />
                </linearGradient>
              </defs>

              {/* Bob layer — small Y oscillation = engine vibration / motion */}
              <g>
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  values="0,0; 0,-1.5; 0,0; 0,0.7; 0,0"
                  keyTimes="0; 0.25; 0.5; 0.75; 1"
                  dur={`${bobDur}s`}
                  begin={bobBegin}
                  repeatCount="indefinite"
                />

                {/* Speed lines behind the car — short streaks fading away */}
                <g opacity="0.55">
                  {[0, 1, 2].map((i) => (
                    <line
                      key={i}
                      x1={-carW / 2 - 4 - i * 6}
                      y1={(-carH / 2) + 6 + i * 6}
                      x2={-carW / 2 - 14 - i * 6}
                      y2={(-carH / 2) + 6 + i * 6}
                      stroke="white"
                      strokeWidth={1.5}
                      strokeOpacity={0.7 - i * 0.18}
                      strokeLinecap="round"
                    />
                  ))}
                </g>

                {/* Soft colored aura under the car */}
                <ellipse cx="0" cy={carH / 2 + 3} rx={carW / 2 + 2} ry={5} fill={baseColor} opacity="0.4" filter="url(#rt-glow)" />

                {/* Car body — rounded rectangle with body gradient */}
                <g filter="url(#rt-car-shadow)">
                  <rect
                    x={-carW / 2}
                    y={-carH / 2}
                    width={carW}
                    height={carH}
                    rx={carH * 0.42}
                    fill={`url(#${carGradId})`}
                    stroke={trim}
                    strokeWidth={1.5}
                  />
                  {/* Hood top highlight */}
                  <rect
                    x={-carW / 2 + 4}
                    y={-carH / 2 + 2}
                    width={carW - 8}
                    height={carH * 0.2}
                    rx={3}
                    fill="rgba(255,255,255,0.35)"
                  />
                  {/* Windshield + roof — darker tinted oval covering the cabin section */}
                  <rect
                    x={-carW * 0.18}
                    y={-carH * 0.42}
                    width={carW * 0.45}
                    height={carH * 0.84}
                    rx={carH * 0.32}
                    fill="rgba(15,23,42,0.78)"
                    stroke={blend(trim, 0.2, true)}
                    strokeWidth={0.8}
                  />
                  {/* Skin emblem on the roof — counter-rotated so it stays upright
                      regardless of which way the car is facing on the oval. */}
                  {SkinIcon && (
                    <g transform={`rotate(${-pos.angle})`}>
                      <circle cx="0" cy="0" r={carH * 0.32} fill="white" />
                      <SkinIcon
                        x={-carH * 0.22}
                        y={-carH * 0.22}
                        width={carH * 0.44}
                        height={carH * 0.44}
                        color={baseColor}
                        strokeWidth={2.5}
                      />
                    </g>
                  )}
                  {/* Headlights — small cream rounds at the front */}
                  <circle cx={carW / 2 - 4} cy={-carH * 0.22} r={2} fill="#fef3c7" />
                  <circle cx={carW / 2 - 4} cy={carH * 0.22} r={2} fill="#fef3c7" />
                  {/* Rear lights — tiny red squares at the back */}
                  <rect x={-carW / 2 + 2} y={-carH * 0.32} width={2} height={carH * 0.18} fill="#dc2626" rx={1} />
                  <rect x={-carW / 2 + 2} y={carH * 0.14} width={2} height={carH * 0.18} fill="#dc2626" rx={1} />
                </g>

                {/* Wheels — four black circles with a chrome highlight */}
                {[
                  { x: -carW / 2 + carH * 0.35, y: -carH / 2 - 1 },
                  { x:  carW / 2 - carH * 0.35, y: -carH / 2 - 1 },
                  { x: -carW / 2 + carH * 0.35, y:  carH / 2 + 1 },
                  { x:  carW / 2 - carH * 0.35, y:  carH / 2 + 1 },
                ].map((w, i) => (
                  <g key={i}>
                    <circle cx={w.x} cy={w.y} r={wheelR} fill="#0a0e1a" stroke="#1f2937" strokeWidth={0.8} />
                    <circle cx={w.x} cy={w.y} r={wheelR * 0.45} fill="#475569" />
                  </g>
                ))}

                {/* Pulsing aura ring on current user — counter-rotated so it stays circular */}
                {isMe && (
                  <g transform={`rotate(${-pos.angle})`}>
                    <circle cx="0" cy="0" r={carW / 2 + 6} fill="none" stroke={baseColor} strokeWidth="2.5" strokeOpacity="0.7">
                      <animate attributeName="r" values={`${carW / 2 + 4};${carW / 2 + 16};${carW / 2 + 4}`} dur="1.6s" repeatCount="indefinite" />
                      <animate attributeName="stroke-opacity" values="0.7;0;0.7" dur="1.6s" repeatCount="indefinite" />
                    </circle>
                  </g>
                )}

                {/* Lap counter badge — gold disc with the lap number, counter-rotated */}
                {lap > 0 && (
                  <g transform={`rotate(${-pos.angle}) translate(${carW / 2 - 4}, ${-carH / 2 - 4})`} filter="url(#rt-car-shadow)">
                    <circle cx="0" cy="0" r="11" fill="#fbbf24" stroke="white" strokeWidth="2.5" />
                    <text x="0" y="4" textAnchor="middle" fontSize="13" fontWeight="900" fill="#78350f">
                      {lap}
                    </text>
                  </g>
                )}

                {/* Name label — pill above the car, counter-rotated to stay readable */}
                <g transform={`rotate(${-pos.angle}) translate(0, ${-(carH / 2 + 18)})`}>
                  <rect
                    x={-labelW / 2}
                    y={-11}
                    width={labelW}
                    height="22"
                    rx="11"
                    fill="rgba(2,6,23,0.85)"
                    stroke={baseColor}
                    strokeWidth="1.5"
                    strokeOpacity="0.7"
                  />
                  <text
                    x="0"
                    y="5"
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
