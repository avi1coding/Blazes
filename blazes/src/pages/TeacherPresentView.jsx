import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  Flame, Trophy, Crown, Users, Clock, Zap, TrendingUp, TrendingDown,
  Swords, Mountain, Droplets, Wind, Heart, Ghost, Newspaper, DollarSign,
  BarChart3, Maximize2, Activity, Star, ArrowUp, Sparkles, Medal,
} from 'lucide-react';
import { AvatarPreview, getNameColor, cacheTier } from './SkinsPage';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

// Single shared design across every mode. We used to vary the accent color
// by game mode but the result was a kaleidoscope. Now the only thing that
// changes is the mode label + icon shown in the header; the leaderboard,
// background, medals, and live feed use a fixed gold/silver/bronze palette
// the entire app over. Mode data still drives the live feed CONTENT — only
// the colors are unified.
const MODE_THEME = {
  classic_timed:    { label: 'Classic Quiz',      icon: Trophy },
  survival:         { label: 'Survival',          icon: Heart },
  elemental_clash:  { label: 'Elemental Clash',   icon: Swords },
  elemental_wager:  { label: 'Risk & Reward',     icon: TrendingUp },
  arena:            { label: 'Arena',             icon: Swords },
  inferno_tower:    { label: 'Inferno Tower',     icon: Flame },
  elemental_markets:{ label: 'Elemental Markets', icon: TrendingUp },
};

// Shared design tokens — the only colors anyone should reach for. Anything
// mode-specific (regime, team color, stock tint) stays inside its own pill.
const GOLD   = '#fbbf24';
const SILVER = '#cbd5e1';
const BRONZE = '#d97706';

function modeTheme(mode) {
  return MODE_THEME[mode] || MODE_THEME.classic_timed;
}

// Background — solid deep navy, a thick gold rule at the very top edge of the
// screen, and a soft vignette that frames the leaderboard. No gradients, no
// patterns, no per-mode tinting — just a clean, focused stage.
function AnimatedBackground() {
  return (
    <>
      {/* Solid base */}
      <div className="fixed inset-0 -z-10" style={{ backgroundColor: '#0a1024' }} />

      {/* Vignette — pure inset shadow, no color fade */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{ boxShadow: 'inset 0 0 320px 80px rgba(0,0,0,0.6)' }}
      />

      {/* Top + bottom gold rules — broadcast-graphic bars that frame the screen */}
      <div className="fixed inset-x-0 top-0 -z-10 pointer-events-none">
        <div className="h-1" style={{ backgroundColor: GOLD }} />
        <div className="h-px" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
      </div>
      <div className="fixed inset-x-0 bottom-0 -z-10 pointer-events-none">
        <div className="h-px" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
        <div className="h-1" style={{ backgroundColor: GOLD, opacity: 0.6 }} />
      </div>
      <style>{`
        @keyframes float {
          0%   { transform: translateY(0) rotate(0deg); }
          100% { transform: translateY(-30px) rotate(8deg); }
        }
        @keyframes scoreBump {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.22); color: #fbbf24; text-shadow: 0 0 24px rgba(251,191,36,0.7); }
          100% { transform: scale(1); }
        }
        @keyframes slideUp {
          from { transform: translateY(12px); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
        @keyframes rowEnter {
          from { transform: translateY(-6px); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 24px var(--glow), 0 0 0 1px rgba(255,255,255,0.1) inset; }
          50%      { box-shadow: 0 0 48px var(--glow), 0 0 0 1px rgba(255,255,255,0.15) inset; }
        }
        @keyframes podiumRise {
          from { transform: translateY(60px); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
        @keyframes confetti {
          0%   { transform: translateY(-100vh) rotate(0deg); opacity: 0; }
          5%   { opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </>
  );
}

// Format helper used by the leaderboard. Markets scores are dollar values,
// every other mode is plain integer points.
function formatScore(value, mode) {
  if (mode === 'elemental_markets') {
    return `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
  return String(value || 0);
}

export default function TeacherPresentView() {
  const { gameCode } = useParams();
  const [game, setGame] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [playerSkins, setPlayerSkins] = useState({});
  const [modeData, setModeData] = useState(null); // mode-specific live state
  const [recentEvents, setRecentEvents] = useState([]); // generic event log
  const [error, setError] = useState('');

  const fetchedSkinIds = useRef(new Set());
  const seenEventIds = useRef(new Set());
  const prevScores = useRef({}); // user_id → last score, used to bump on change
  const prevRanks = useRef({}); // user_id → last rank position, used to detect overtakes
  const streakCount = useRef({}); // user_id → consecutive score-up polls (proxy for answer streak)
  const eventCounter = useRef(0); // monotonic id for client-generated events
  const [bumped, setBumped] = useState({}); // user_id → timestamp of last bump

  // Poll the game every 2s. For modes that have their own live-state endpoint,
  // also poll that and merge a per-user score override into participants.
  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      try {
        const gRes = await fetch(`${BASE}/api/games/${gameCode}`);
        const gData = await gRes.json();
        if (cancelled) return;
        if (!gRes.ok) { setError(gData.error || 'Failed to load game'); return; }
        setGame(gData);
        setParticipants(gData.participants || []);

        // Mode-specific fetch — used for live events panel + score overrides
        const mode = gData.game_mode;
        let extra = null;
        try {
          if (mode === 'elemental_markets' && gData.status === 'started') {
            const r = await fetch(`${BASE}/api/games/${gameCode}/markets/state`);
            if (r.ok) extra = await r.json();
          } else if (mode === 'elemental_clash' && gData.status === 'started') {
            const r = await fetch(`${BASE}/api/games/${gameCode}/elemental-state`);
            if (r.ok) extra = await r.json();
          } else if (mode === 'inferno_tower' && gData.status === 'started') {
            const r = await fetch(`${BASE}/api/games/${gameCode}/inferno-state`);
            if (r.ok) extra = await r.json();
          }
        } catch (_) { /* mode endpoints are best-effort */ }
        if (!cancelled) setModeData(extra);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    };
    fetchAll();
    const id = setInterval(fetchAll, 2000);
    return () => { cancelled = true; clearInterval(id); };
  }, [gameCode]);

  // Pull equipped skin for any new participant so the leaderboard shows their look
  useEffect(() => {
    participants.forEach(p => {
      if (!p.user_id || fetchedSkinIds.current.has(p.user_id)) return;
      fetchedSkinIds.current.add(p.user_id);
      fetch(`${BASE}/api/skins/${p.user_id}`)
        .then(r => r.json())
        .then(d => {
          if (d.equipped?.avatar_skin) setPlayerSkins(prev => ({ ...prev, [p.user_id]: d.equipped.avatar_skin }));
          if (d.tier) cacheTier(p.user_id, d.tier);
        })
        .catch(() => {});
    });
  }, [participants]);

  // Build the ranked list. For markets, use the live portfolio from modeData;
  // for clash/inferno, use whatever the mode-state endpoint returned (which
  // already includes the latest team/floor info); for everyone else, the
  // participant score column is authoritative during play.
  const ranked = useMemo(() => {
    const gameMode = game?.game_mode;
    let list = participants.map(p => ({
      user_id: p.user_id,
      player_name: p.player_name || p.name || 'Player',
      score: p.score || 0,
      avatar: p.avatar_skin || playerSkins[p.user_id] || 'default',
      eliminated: !!p.eliminated,
      lives: p.lives,
      hasLeft: !!p.left_at,
      // Mode-specific flair
      team: p.team,
      tower_floor: p.tower_floor,
      is_ghost: p.is_ghost,
    }));

    if (gameMode === 'elemental_markets' && modeData?.leaderboard) {
      const byId = new Map(modeData.leaderboard.map(p => [p.user_id, p.portfolio]));
      list = list.map(p => ({ ...p, score: byId.get(p.user_id) ?? p.score }));
    } else if (gameMode === 'inferno_tower' && modeData?.participants) {
      const byId = new Map(modeData.participants.map(p => [p.user_id, p]));
      list = list.map(p => {
        const m = byId.get(p.user_id);
        return m ? { ...p, score: m.score || 0, tower_floor: m.tower_floor, is_ghost: m.is_ghost } : p;
      });
    } else if (gameMode === 'elemental_clash' && modeData?.participants) {
      const byId = new Map(modeData.participants.map(p => [p.user_id, p]));
      list = list.map(p => {
        const m = byId.get(p.user_id);
        return m ? { ...p, score: m.score || 0, energy_points: m.energy_points } : p;
      });
    }

    return list.sort((a, b) => (b.score || 0) - (a.score || 0));
  }, [participants, modeData, game?.game_mode, playerSkins]);

  // Tie-aware placements: two players on the same score share a rank. The next
  // rank skips ahead by the number of tied players above (standard "1224"
  // ranking, not dense). placements[i] is the visible rank for ranked[i].
  const placements = useMemo(() => {
    const out = [];
    ranked.forEach((p, i) => {
      if (i === 0) { out.push(1); return; }
      const prev = ranked[i - 1];
      if ((p.score || 0) === (prev.score || 0)) out.push(out[i - 1]);
      else out.push(i + 1);
    });
    return out;
  }, [ranked]);

  // Bump a score when it changes so the projector audience can see who just
  // moved up. Trigger via a per-user timestamp that the row reads to set an
  // inline animation. Same pass also generates synthetic events for modes
  // without their own event stream — streaks (consecutive score-ups), big
  // jumps (fast correct answers), and rank overtakes ("upsets").
  useEffect(() => {
    const mode = game?.game_mode;
    const nextScores = { ...prevScores.current };
    const nextRanks = { ...prevRanks.current };
    const newBumps = {};
    const generatedEvents = [];
    let changed = false;

    // Build current rank map from the freshly-ranked list
    const currentRanks = {};
    ranked.forEach((p, i) => { currentRanks[p.user_id] = i + 1; });

    for (const p of ranked) {
      const prevScore = nextScores[p.user_id];
      const prevRank = nextRanks[p.user_id];
      const delta = prevScore != null ? p.score - prevScore : 0;

      if (prevScore != null && prevScore !== p.score) {
        newBumps[p.user_id] = Date.now();
        changed = true;
      }

      // Synthetic events — only meaningful for the "generic" modes that lack
      // their own server-side event feed (classic, survival, wager, arena).
      // Markets/clash/inferno already have rich event streams.
      const wantsGenericEvents = mode === 'classic_timed' || mode === 'survival'
        || mode === 'elemental_wager' || mode === 'arena';
      if (wantsGenericEvents && prevScore != null) {
        if (delta > 0) {
          streakCount.current[p.user_id] = (streakCount.current[p.user_id] || 0) + 1;
          const streak = streakCount.current[p.user_id];

          // Big-jump event: a fast classic answer is in the 80-100 range, so
          // surface it as a "speed" call-out the room can see.
          if (delta >= 80) {
            generatedEvents.push({
              id: `fast-${p.user_id}-${++eventCounter.current}`,
              icon: Zap,
              color: '#fde047',
              text: `${p.player_name} fast answer · +${delta}`,
              ts: Date.now(),
            });
          }

          // Streak milestones — 3, 5, 7, 10 in a row without missing one
          if (streak === 3 || streak === 5 || streak === 7 || streak === 10) {
            generatedEvents.push({
              id: `streak-${p.user_id}-${streak}-${++eventCounter.current}`,
              icon: Flame,
              color: streak >= 7 ? '#fb923c' : '#fbbf24',
              text: `${p.player_name} on a ${streak}-streak!`,
              ts: Date.now(),
            });
          }
        } else if (delta < 0 || (delta === 0 && p.score === prevScore && currentRanks[p.user_id] > prevRank)) {
          // Score didn't go up — streak resets next time they get one wrong
          streakCount.current[p.user_id] = 0;
        }
      }

      // Upset/overtake event — someone moved from rank K → K-1 (or better)
      // while the player above them stayed put. Skip the first poll where
      // we have no previous rank to compare against.
      if (wantsGenericEvents && prevRank != null) {
        const newRank = currentRanks[p.user_id];
        if (newRank < prevRank && newRank <= 5) {
          // Find who used to be at newRank — the person they passed
          const passedId = Object.keys(nextRanks).find(uid => nextRanks[uid] === newRank);
          const passed = ranked.find(r => String(r.user_id) === String(passedId));
          if (passed && passed.user_id !== p.user_id) {
            generatedEvents.push({
              id: `upset-${p.user_id}-${++eventCounter.current}`,
              icon: ArrowUp,
              color: '#a78bfa',
              text: `${p.player_name} overtook ${passed.player_name} for #${newRank}`,
              ts: Date.now(),
            });
          }
        }
      }

      nextScores[p.user_id] = p.score;
    }

    prevScores.current = nextScores;
    prevRanks.current = currentRanks;
    if (changed) setBumped(b => ({ ...b, ...newBumps }));
    if (generatedEvents.length) {
      setRecentEvents(prev => [...generatedEvents.reverse(), ...prev].slice(0, 12));
    }
  }, [ranked, game?.game_mode]);

  // Accumulate live events for the right-hand panel. Each mode populates
  // a unified [{id, icon, color, text, ts}] feed for rendering.
  useEffect(() => {
    if (!modeData) return;
    const mode = game?.game_mode;
    const additions = [];
    if (mode === 'elemental_markets' && Array.isArray(modeData.events)) {
      for (const ev of modeData.events) {
        if (seenEventIds.current.has(ev.id)) continue;
        seenEventIds.current.add(ev.id);
        additions.push({
          id: `mkt-${ev.id}`,
          icon: ev.kind === 'crash' ? TrendingDown : ev.kind === 'bull' ? TrendingUp : Newspaper,
          color: ev.kind === 'crash' ? '#fca5a5' : ev.kind === 'bull' ? '#86efac' : ev.kind === 'bear' ? '#fcd34d' : '#cbd5e1',
          text: ev.msg,
          ts: Date.now(),
        });
      }
    } else if (mode === 'elemental_clash' && Array.isArray(modeData.recentAttacks)) {
      for (const atk of modeData.recentAttacks) {
        const key = `clash-${atk.id}`;
        if (seenEventIds.current.has(key)) continue;
        seenEventIds.current.add(key);
        const attacker = (modeData.participants || []).find(p => p.user_id === atk.attacker_user_id);
        const iconByType = { earthquake: Mountain, tsunami: Droplets, hurricane: Wind, wildfire: Flame };
        additions.push({
          id: key,
          icon: iconByType[atk.attack_type] || Swords,
          color: atk.target_team === 1 ? '#93c5fd' : '#fca5a5',
          text: `${attacker?.player_name || 'Player'} hit Team ${atk.target_team} for ${atk.damage}`,
          ts: Date.now(),
        });
      }
    }
    if (additions.length) setRecentEvents(prev => [...additions.reverse(), ...prev].slice(0, 12));
  }, [modeData, game?.game_mode]);

  // Try fullscreen on first user gesture — most projectors want F11 anyway,
  // but a click on the button below will request it explicitly.
  const requestFullscreen = () => {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {});
  };

  const theme = modeTheme(game?.game_mode);
  const HeaderIcon = theme.icon;

  // Time-left for modes that report it
  const timeLeft = modeData?.timeLeft != null ? Math.max(0, Math.floor(modeData.timeLeft)) : null;
  const timeStr = timeLeft != null ? `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}` : null;

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <p className="text-2xl font-black mb-2">Couldn't load game</p>
          <p className="text-white/60">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen relative overflow-hidden text-white flex flex-col">
      <AnimatedBackground />

      {/* Final-results podium — overlays everything once the game ends. Top 3
          if ≤ 10 players, top 5 if more, so a big classroom still gets a fair
          shot at the spotlight. */}
      {game?.status === 'ended' && ranked.length > 0 && (
        <Podium ranked={ranked} mode={game?.game_mode} />
      )}

      {/* Header bar — minimal, fixed height so the leaderboard gets the rest */}
      <header className="flex-shrink-0 px-8 sm:px-12 pt-6 pb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <HeaderIcon className="w-6 h-6 text-white/85" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Now playing</div>
            <div className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">{theme.label}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Stat label="code" value={gameCode} />
          {timeStr && (
            <Stat
              label="time"
              value={timeStr}
              icon={Clock}
              accent={timeLeft < 30 ? '#ef4444' : null}
              pulse={timeLeft < 30}
            />
          )}
          <Stat label="players" value={ranked.length} icon={Users} />
          <button
            onClick={requestFullscreen}
            className="ml-1 p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/10 border border-white/10 transition-colors"
            title="Go fullscreen"
          >
            <Maximize2 className="w-4 h-4 text-white/70" />
          </button>
        </div>
      </header>

      {/* Mode-specific banner — e.g. market regime, sudden death, team scores */}
      <ModeBanner game={game} modeData={modeData} />

      {/* Body — leaderboard is the centerpiece, sized to fill the viewport so
          all top-10 rows are visible at once. No scrolling on the present
          screen; if rows would overflow, we shrink them. */}
      <main className="flex-1 min-h-0 px-6 sm:px-10 pb-6 w-full max-w-5xl mx-auto flex flex-col gap-3">
        {ranked.length === 0 ? (
          <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-16 text-center text-white/50 text-lg font-semibold">
            Waiting for players to join…
          </div>
        ) : (
          <div
            className="rounded-xl overflow-hidden flex-1 min-h-0 flex flex-col"
            style={{
              backgroundColor: '#0e1535',
              boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)',
            }}
          >
            {/* Card header — dark slab with a thin gold rule underneath */}
            <div className="relative flex-shrink-0">
              <div className="px-6 sm:px-8 py-3 flex items-center gap-3" style={{ background: '#080d24' }}>
                <Trophy className="w-5 h-5" style={{ color: GOLD }} />
                <span className="text-sm font-black uppercase tracking-[0.22em] text-white">Leaderboard</span>
              </div>
              <div className="h-px" style={{ backgroundColor: GOLD, opacity: 0.65 }} />
            </div>

            {/* Rows — flex-1 column where each row gets an even share of space so
                all 10 fit without scrolling, no matter the viewport height. */}
            <ul className="flex-1 min-h-0 flex flex-col">
              {ranked.slice(0, 10).map((p, i) => {
                const place = placements[i];
                const isBumped = bumped[p.user_id] && Date.now() - bumped[p.user_id] < 1200;
                const isFirst = place === 1;
                const medalColor = place === 1 ? GOLD : place === 2 ? SILVER : place === 3 ? BRONZE : null;
                const stripeColor = medalColor || 'transparent';
                // Top-3 rows are slightly taller, slightly tinted, and the
                // accent stripe widens. Everyone else is the same neutral row
                // with alternating zebra striping for scannability.
                const rowBg = isFirst
                  ? 'linear-gradient(90deg, rgba(251,191,36,0.10), rgba(251,191,36,0) 60%)'
                  : place === 2 ? 'linear-gradient(90deg, rgba(203,213,225,0.06), rgba(203,213,225,0) 60%)'
                  : place === 3 ? 'linear-gradient(90deg, rgba(217,119,6,0.07), rgba(217,119,6,0) 60%)'
                  : i % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent';
                return (
                  <li
                    key={p.user_id}
                    className={`flex items-center gap-4 sm:gap-6 px-5 sm:px-7 border-b border-white/[0.04] last:border-b-0 min-h-0 overflow-hidden ${
                      p.eliminated || p.is_ghost ? 'opacity-40' : ''
                    }`}
                    style={{
                      background: rowBg,
                      animation: 'rowEnter 0.4s ease-out',
                      borderLeft: `${place <= 3 ? 6 : 0}px solid ${stripeColor}`,
                      // Distribute available vertical space across all 10 rows
                      // so they always fit on screen. Top-3 get a 1.3× share so
                      // they're visibly taller than the rest.
                      flex: place <= 3 ? '1.3 1 0' : '1 1 0',
                    }}
                  >
                    {/* Rank — tabular monospace number, fixed width */}
                    <div className="flex-shrink-0 w-12 sm:w-14 flex items-center justify-center">
                      {isFirst ? (
                        <Crown className="w-9 h-9 drop-shadow" style={{ color: GOLD }} strokeWidth={2.5} />
                      ) : (
                        <span
                          className="font-black tabular-nums leading-none"
                          style={{
                            color: medalColor || 'rgba(255,255,255,0.35)',
                            fontSize: place <= 3 ? '2rem' : '1.5rem',
                            letterSpacing: '-0.02em',
                          }}
                        >
                          {place}
                        </span>
                      )}
                    </div>

                    {/* Avatar with ring on top 3 */}
                    <div
                      className="flex-shrink-0 rounded-full"
                      style={medalColor ? {
                        padding: 2,
                        background: medalColor,
                        boxShadow: isFirst ? `0 0 16px ${GOLD}55` : 'none',
                      } : {}}
                    >
                      <div className={medalColor ? 'rounded-full bg-[#0e1535]' : ''} style={medalColor ? { padding: 2 } : {}}>
                        <AvatarPreview
                          skinId={p.avatar}
                          initial={(p.player_name || '?')[0].toUpperCase()}
                          size={isFirst ? 60 : place <= 3 ? 52 : 44}
                          userId={p.user_id}
                        />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div
                        className={`font-black truncate leading-tight tracking-tight ${
                          isFirst ? 'text-3xl sm:text-4xl' : place <= 3 ? 'text-xl sm:text-2xl' : 'text-lg sm:text-xl'
                        }`}
                        style={{ color: isFirst ? GOLD : '#f8fafc' }}
                      >
                        {p.player_name}
                      </div>
                      <ModeSubInfo p={p} mode={game?.game_mode} />
                    </div>

                    {/* Score */}
                    <div
                      className={`font-black tabular-nums leading-none flex-shrink-0 text-white ${
                        isFirst ? 'text-5xl sm:text-6xl' : place <= 3 ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'
                      }`}
                      style={isBumped ? { animation: 'scoreBump 0.9s ease-out' } : { letterSpacing: '-0.02em' }}
                    >
                      {formatScore(p.score, game?.game_mode)}
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Card footer */}
            {ranked.length > 10 && (
              <div className="px-6 py-3 text-center text-[10px] uppercase tracking-[0.22em] text-white/40 font-black border-t border-white/[0.05]"
                   style={{ background: '#080d24' }}>
                + {ranked.length - 10} more players
              </div>
            )}
          </div>
        )}

        {/* Live feed — single compact row of pills directly beneath the
            leaderboard. flex-shrink-0 + overflow-hidden so it never pushes
            rows off-screen, and we only show the 4 most recent events. */}
        {recentEvents.length > 0 && (
          <div className="flex-shrink-0 flex items-center gap-2 overflow-hidden">
            <Activity className="w-3.5 h-3.5 flex-shrink-0" style={{ color: GOLD }} />
            <ul className="flex items-center gap-2 overflow-hidden">
              {recentEvents.slice(0, 4).map((ev, idx) => {
                const Icon = ev.icon;
                const isLatest = idx === 0;
                return (
                  <li
                    key={ev.id}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border flex-shrink-0 ${
                      isLatest ? 'bg-white/[0.06] border-white/15' : 'bg-white/[0.02] border-white/[0.06]'
                    }`}
                    style={{ animation: 'slideUp 0.4s ease-out' }}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: ev.color }} />
                    <span className="text-xs font-bold text-white/90 whitespace-nowrap">{ev.text}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}

// Compact stat pill used in the header — label on top, value below. Optional
// icon + accent override for the time-running-out variant.
function Stat({ label, value, icon: Icon, accent, pulse }) {
  return (
    <div
      className={`px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/10 flex items-center gap-2.5 ${pulse ? 'animate-pulse' : ''}`}
      style={accent ? { borderColor: `${accent}80`, background: `${accent}1a` } : {}}
    >
      {Icon && <Icon className="w-4 h-4 text-white/60" />}
      <div>
        <div className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40 leading-none">{label}</div>
        <div className="font-black tabular-nums text-base leading-none mt-0.5">{value}</div>
      </div>
    </div>
  );
}

// Pill or row of mode-specific context shown right under the header. Keeps the
// main leaderboard uncluttered while still surfacing the things that make each
// mode feel different on the big screen.
function ModeBanner({ game, modeData }) {
  const mode = game?.game_mode;
  if (!modeData) return null;
  const pill = 'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-black text-xs bg-white/[0.04] border border-white/10';

  if (mode === 'elemental_markets') {
    const regime = modeData.regime || 'normal';
    const regimeColors = { normal: '#94a3b8', bull: '#34d399', bear: '#fbbf24', crash: '#f87171', recovery: '#22d3ee' };
    return (
      <div className="flex-shrink-0 px-8 sm:px-12 pb-3 flex flex-wrap items-center gap-2">
        <span className={pill} style={{ color: regimeColors[regime], borderColor: `${regimeColors[regime]}55` }}>
          <Activity className="w-3.5 h-3.5" /> {regime.toUpperCase()}
        </span>
        {(modeData.stocks || []).slice(0, 6).map(s => (
          <span key={s.sym} className={pill}>
            <span style={{ color: s.color }}>{s.sym}</span>
            <span className="tabular-nums text-white/85">${s.price?.toFixed(2)}</span>
            <span className={`tabular-nums ${s.changePct >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
              {s.changePct >= 0 ? '+' : ''}{s.changePct?.toFixed(1)}%
            </span>
          </span>
        ))}
      </div>
    );
  }

  if (mode === 'elemental_clash') {
    return (
      <div className="px-8 sm:px-12 pb-4 flex items-center gap-2">
        <span className={pill} style={{ borderColor: 'rgba(96,165,250,0.5)' }}>
          <span className="text-blue-300">Team 1</span>
          <span className="tabular-nums text-white">{modeData.team1Score || 0}</span>
        </span>
        <span className={pill} style={{ borderColor: 'rgba(248,113,113,0.5)' }}>
          <span className="text-red-300">Team 2</span>
          <span className="tabular-nums text-white">{modeData.team2Score || 0}</span>
        </span>
      </div>
    );
  }

  if (mode === 'inferno_tower') {
    return (
      <div className="px-8 sm:px-12 pb-4 flex items-center gap-2">
        <span className={pill} style={{ color: '#fb923c', borderColor: 'rgba(251,146,60,0.5)' }}>
          <Flame className="w-3.5 h-3.5" /> Fire level {modeData.fireLevel || 0}
        </span>
        {modeData.suddenDeath === 1 && (
          <span className={pill} style={{ color: '#fca5a5', borderColor: 'rgba(248,113,113,0.6)' }}>SUDDEN DEATH</span>
        )}
        {modeData.suddenDeath === 2 && (
          <span className={pill} style={{ color: '#fcd34d', borderColor: 'rgba(252,211,77,0.6)' }}>TIEBREAKER</span>
        )}
      </div>
    );
  }

  return null;
}

// End-of-game podium overlay. Slots are arranged 2 - 1 - 3 (with 4 - 2 - 1 - 3
// - 5 for big classrooms) so #1 sits in the visual center on the tallest
// pedestal. Each column rises in sequence so the room watches the reveal.
function Podium({ ranked, mode }) {
  const showTop = ranked.length > 10 ? 5 : 3;
  const winners = ranked.slice(0, showTop);
  if (winners.length === 0) return null;

  const orderTop3 = [2, 1, 3];
  const orderTop5 = [4, 2, 1, 3, 5];
  const visualOrder = showTop === 5 ? orderTop5 : orderTop3;

  const heightForPlace = (place) => {
    if (showTop === 5) return { 1: 220, 2: 180, 3: 150, 4: 120, 5: 120 }[place] || 120;
    return { 1: 220, 2: 170, 3: 140 }[place] || 140;
  };

  const placeColor = (place) => {
    if (place === 1) return GOLD;
    if (place === 2) return SILVER;
    if (place === 3) return BRONZE;
    return '#94a3b8';
  };

  // Neutral confetti palette — gold/silver/bronze + soft accent splash.
  const confetti = useMemo(() => {
    const palette = [GOLD, SILVER, BRONZE, '#a78bfa', '#86efac'];
    return Array.from({ length: 40 }).map((_, i) => ({
      key: i,
      left: Math.random() * 100,
      delay: Math.random() * 2.5,
      duration: 4 + Math.random() * 3,
      color: palette[i % palette.length],
      size: 6 + Math.random() * 10,
    }));
  }, []);

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center px-6 sm:px-10 backdrop-blur-md"
      style={{ background: 'rgba(0,0,0,0.7)' }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {confetti.map(c => (
          <div
            key={c.key}
            className="absolute rounded-sm"
            style={{
              left: `${c.left}%`,
              top: 0,
              width: c.size,
              height: c.size,
              background: c.color,
              animation: `confetti ${c.duration}s linear ${c.delay}s infinite`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-6xl text-center">
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-3"
          style={{ background: `${GOLD}1f`, color: GOLD, border: `1px solid ${GOLD}55` }}
        >
          <Sparkles className="w-4 h-4" />
          <span className="text-xs font-black uppercase tracking-widest">Final standings</span>
        </div>
        <h1 className="text-4xl sm:text-6xl font-black mb-12 text-white">
          {winners[0].player_name} <span className="opacity-60">wins</span>
        </h1>

        <div className={`grid ${showTop === 5 ? 'grid-cols-5' : 'grid-cols-3'} gap-3 sm:gap-6 items-end max-w-5xl mx-auto`}>
          {visualOrder.map((place, idx) => {
            const p = winners[place - 1];
            if (!p) return <div key={place} />;
            const h = heightForPlace(place);
            const color = placeColor(place);
            return (
              <div
                key={p.user_id}
                className="flex flex-col items-center"
                style={{ animation: `podiumRise 0.7s ease-out ${idx * 0.18}s both` }}
              >
                <div className="relative mb-3">
                  <AvatarPreview
                    skinId={p.avatar}
                    initial={(p.player_name || '?')[0].toUpperCase()}
                    size={place === 1 ? 96 : 72}
                    userId={p.user_id}
                  />
                  {place === 1 && (
                    <Crown
                      className="absolute -top-7 left-1/2 -translate-x-1/2 drop-shadow-lg"
                      style={{ color: GOLD, width: 48, height: 48 }}
                      strokeWidth={2.5}
                    />
                  )}
                </div>

                <div
                  className={`font-black ${place === 1 ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl'} truncate max-w-full px-1`}
                  style={{ color: place === 1 ? GOLD : '#f1f5f9' }}
                >
                  {p.player_name}
                </div>
                <div className="font-black tabular-nums opacity-90 text-white"
                     style={{ fontSize: place === 1 ? '2.25rem' : '1.5rem' }}>
                  {formatScore(p.score, mode)}
                </div>

                <div
                  className="w-full mt-3 flex items-center justify-center rounded-t-xl border-t-2 border-x-2 relative overflow-hidden"
                  style={{
                    height: h,
                    background: `linear-gradient(180deg, ${color}28 0%, ${color}10 100%)`,
                    borderColor: `${color}88`,
                  }}
                >
                  <span
                    className="font-black"
                    style={{
                      color,
                      fontSize: place === 1 ? '5rem' : '3.5rem',
                      textShadow: `0 0 24px ${color}80`,
                    }}
                  >
                    {place}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Tiny sub-label under each player's name on the leaderboard — different per
// mode so the projector audience gets at-a-glance context (lives, floor, team).
function ModeSubInfo({ p, mode }) {
  const sub = 'text-white/55';
  if (mode === 'survival') {
    if (p.eliminated) return <span className={`text-xs font-bold ${sub}`}>Eliminated</span>;
    if (p.lives != null) {
      return (
        <span className="inline-flex items-center gap-1">
          {Array.from({ length: Math.max(0, p.lives) }).map((_, i) => (
            <Heart key={i} className="w-3.5 h-3.5 fill-red-500 text-red-500" />
          ))}
        </span>
      );
    }
  }
  if (mode === 'inferno_tower') {
    if (p.is_ghost) return <span className={`text-xs font-bold ${sub}`}>Ghost</span>;
    return <span className={`text-xs font-black ${sub}`}>Floor {p.tower_floor || 0}</span>;
  }
  if (mode === 'elemental_clash' && p.team) {
    return <span className={`text-xs font-bold ${p.team === 1 ? 'text-blue-300' : 'text-red-300'}`}>Team {p.team}</span>;
  }
  if (p.hasLeft) return <span className={`text-xs font-bold ${sub}`}>Left</span>;
  return null;
}
