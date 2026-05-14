import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  Flame, Trophy, Crown, Users, Clock, Zap, TrendingUp, TrendingDown,
  Swords, Mountain, Droplets, Wind, Heart, Ghost, Newspaper, DollarSign,
  BarChart3, Maximize2, Activity, Star, ArrowUp, Sparkles, Medal,
} from 'lucide-react';
import { AvatarPreview, getNameColor, cacheTier } from './SkinsPage';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

// Each mode gets a base dark slate with a soft accent halo — the accent is the
// only mode-specific color that bleeds into the background. Everything else
// (cards, text, borders) is a neutral palette so the screen reads as polished
// rather than carnival-bright. The accent is used for the leader, top-of-row
// medals, and the live-feed icons so the room can still tell modes apart.
const MODE_THEME = {
  classic_timed:    { label: 'Classic Quiz',     icon: Trophy,     accent: '#fbbf24', accentSoft: 'rgba(251,191,36,0.18)' },
  survival:         { label: 'Survival',         icon: Heart,      accent: '#f87171', accentSoft: 'rgba(248,113,113,0.20)' },
  elemental_clash:  { label: 'Elemental Clash',  icon: Swords,     accent: '#a78bfa', accentSoft: 'rgba(167,139,250,0.20)' },
  elemental_wager:  { label: 'Risk & Reward',    icon: TrendingUp, accent: '#34d399', accentSoft: 'rgba(52,211,153,0.20)' },
  arena:            { label: 'Arena',            icon: Swords,     accent: '#fbbf24', accentSoft: 'rgba(251,191,36,0.18)' },
  inferno_tower:    { label: 'Inferno Tower',    icon: Flame,      accent: '#fb923c', accentSoft: 'rgba(251,146,60,0.22)' },
  elemental_markets:{ label: 'Elemental Markets',icon: TrendingUp, accent: '#10b981', accentSoft: 'rgba(16,185,129,0.20)' },
};

// All modes share the same near-black gradient base. dark=true means the
// foreground uses white text — the whole presenter is dark-mode now.
function themeWithDefaults(t) {
  return {
    ...t,
    dark: true,
    textOnBg: '#e5e7eb',
  };
}

function modeTheme(mode) {
  return themeWithDefaults(MODE_THEME[mode] || MODE_THEME.classic_timed);
}

// Background layer — a clean dark base, two soft accent halos at top corners,
// and a faint dot grid for texture. No bouncing icons; the design relies on
// typography and the live cards to carry the mode personality.
function AnimatedBackground({ theme }) {
  return (
    <>
      {/* Base — near-black slate */}
      <div
        className="fixed inset-0 -z-10"
        style={{ background: 'radial-gradient(ellipse at top, #1e293b 0%, #0f172a 60%, #020617 100%)' }}
      />
      {/* Soft accent halos — bleed mode color in just enough to be felt */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 18% -10%, ${theme.accentSoft}, transparent 45%), radial-gradient(circle at 85% 110%, ${theme.accentSoft}, transparent 50%)`,
        }}
      />
      {/* Faint dot grid for texture without noise */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none opacity-[0.06]"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
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
  const textOn = theme.dark ? 'text-white' : 'text-gray-900';
  const subtleText = theme.dark ? 'text-white/70' : 'text-gray-700';

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
    <div className={`min-h-screen relative overflow-hidden ${textOn}`}>
      <AnimatedBackground theme={theme} />

      {/* Final-results podium — overlays everything once the game ends. Top 3
          if ≤ 10 players, top 5 if more, so a big classroom still gets a fair
          shot at the spotlight. */}
      {game?.status === 'ended' && ranked.length > 0 && (
        <Podium ranked={ranked} theme={theme} mode={game?.game_mode} />
      )}

      {/* Header bar — minimal, tighter typography, accent ring instead of solid block */}
      <header className="px-8 sm:px-12 pt-8 pb-5 flex flex-wrap items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${theme.accent}55` }}
          >
            <HeaderIcon className="w-6 h-6" style={{ color: theme.accent }} strokeWidth={2.5} />
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
      <ModeBanner game={game} modeData={modeData} theme={theme} />

      {/* Body: live feed (primary, 2/3) + leaderboard (compact, 1/3) */}
      <main className="px-8 sm:px-12 pb-10 grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Leaderboard — compact column */}
        <section className="lg:col-span-2">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-3 flex items-center gap-2">
            <Trophy className="w-3.5 h-3.5" style={{ color: theme.accent }} /> Leaderboard
          </h2>
          {ranked.length === 0 ? (
            <div className={`rounded-2xl ${theme.dark ? 'bg-white/5' : 'bg-white/40 backdrop-blur'} p-12 text-center ${subtleText}`}>
              Waiting for players…
            </div>
          ) : (
            <div className="space-y-1.5">
              {ranked.slice(0, 8).map((p, i) => {
                const place = i + 1;
                const isBumped = bumped[p.user_id] && Date.now() - bumped[p.user_id] < 1200;
                const isFirst = place === 1;
                return (
                  <div
                    key={p.user_id}
                    className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl backdrop-blur-sm transition-all duration-300 ${
                      isFirst
                        ? 'bg-white/[0.07] border border-white/15'
                        : 'bg-white/[0.025] border border-white/[0.08] hover:bg-white/[0.05]'
                    } ${p.eliminated || p.is_ghost ? 'opacity-45' : ''}`}
                    style={{
                      animation: 'rowEnter 0.4s ease-out',
                      ...(isFirst ? { boxShadow: `inset 0 0 0 1px ${theme.accent}40, 0 0 32px ${theme.accent}25` } : {}),
                    }}
                  >
                    {/* Placement — small chip on the left */}
                    <div className="flex-shrink-0 w-8 text-center">
                      {isFirst ? (
                        <Crown className="w-6 h-6 mx-auto" style={{ color: theme.accent }} strokeWidth={2.5} />
                      ) : (
                        <span
                          className="text-base font-black"
                          style={{ color: place <= 3 ? theme.accent : 'rgba(255,255,255,0.35)' }}
                        >
                          {place}
                        </span>
                      )}
                    </div>

                    {/* Avatar — smaller, fixed size */}
                    <AvatarPreview
                      skinId={p.avatar}
                      initial={(p.player_name || '?')[0].toUpperCase()}
                      size={40}
                      userId={p.user_id}
                    />

                    {/* Name + sub-info */}
                    <div className="flex-1 min-w-0">
                      <div
                        className="font-black truncate text-base leading-tight"
                        style={{ color: isFirst ? theme.accent : getNameColor(p.avatar) || '#f1f5f9' }}
                      >
                        {p.player_name}
                      </div>
                      <ModeSubInfo p={p} mode={game?.game_mode} theme={theme} />
                    </div>

                    {/* Score — refined, smaller */}
                    <div
                      className="font-black tabular-nums text-xl leading-none flex-shrink-0"
                      style={{
                        color: isFirst ? theme.accent : '#f1f5f9',
                        ...(isBumped ? { animation: 'scoreBump 0.9s ease-out' } : {}),
                      }}
                    >
                      {formatScore(p.score, game?.game_mode)}
                    </div>
                  </div>
                );
              })}
              {ranked.length > 8 && (
                <div className="text-center text-[10px] uppercase tracking-widest text-white/35 font-black pt-3">
                  + {ranked.length - 8} more
                </div>
              )}
            </div>
          )}
        </section>

        {/* Live events — primary column, gets the room's attention */}
        <aside className="lg:col-span-3">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-3 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5" style={{ color: theme.accent }} /> Live feed
          </h2>
          <div className="rounded-2xl bg-white/[0.025] border border-white/[0.06] p-5 min-h-[480px]">
            {recentEvents.length === 0 ? (
              <div className="text-center py-24 text-white/40 text-sm font-semibold">
                {game?.status === 'started' ? 'Watching the action…' : "Game hasn't started yet"}
              </div>
            ) : (
              <ul className="space-y-2.5">
                {recentEvents.map((ev, idx) => {
                  const Icon = ev.icon;
                  const isLatest = idx === 0;
                  return (
                    <li
                      key={ev.id}
                      className={`flex items-center gap-4 px-4 py-3 rounded-xl border ${
                        isLatest
                          ? 'bg-white/[0.06] border-white/15'
                          : 'bg-white/[0.02] border-white/[0.05]'
                      }`}
                      style={{ animation: 'slideUp 0.4s ease-out' }}
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: `${ev.color}1f`, border: `1px solid ${ev.color}40` }}
                      >
                        <Icon className="w-5 h-5" style={{ color: ev.color }} />
                      </div>
                      <span className="text-base font-bold leading-snug text-white/90 flex-1">{ev.text}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
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
function ModeBanner({ game, modeData, theme }) {
  const mode = game?.game_mode;
  if (!modeData) return null;
  const pill = 'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-black text-xs bg-white/[0.04] border border-white/10';

  if (mode === 'elemental_markets') {
    const regime = modeData.regime || 'normal';
    const regimeColors = { normal: '#94a3b8', bull: '#34d399', bear: '#fbbf24', crash: '#f87171', recovery: '#22d3ee' };
    return (
      <div className="px-8 sm:px-12 pb-4 flex flex-wrap items-center gap-2">
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
function Podium({ ranked, theme, mode }) {
  const showTop = ranked.length > 10 ? 5 : 3;
  const winners = ranked.slice(0, showTop);
  if (winners.length === 0) return null;

  // Visual order maps placement → column index. We want #1 in the middle.
  const orderTop3 = [2, 1, 3];                 // left to right
  const orderTop5 = [4, 2, 1, 3, 5];
  const visualOrder = showTop === 5 ? orderTop5 : orderTop3;

  // Pedestal heights — center is tallest, outer columns are shortest.
  const heightForPlace = (place) => {
    if (showTop === 5) {
      return { 1: 220, 2: 180, 3: 150, 4: 120, 5: 120 }[place] || 120;
    }
    return { 1: 220, 2: 170, 3: 140 }[place] || 140;
  };

  const placeColor = (place) => {
    if (place === 1) return theme.accent;
    if (place === 2) return theme.dark ? '#e5e7eb' : '#6b7280';
    if (place === 3) return '#f59e0b';
    return theme.dark ? '#cbd5e1' : '#475569';
  };

  // Confetti — drop a handful of accent-colored squares from the top of the
  // screen so the moment feels celebratory without needing a heavy lib.
  const confetti = useMemo(() => {
    return Array.from({ length: 40 }).map((_, i) => ({
      key: i,
      left: Math.random() * 100,
      delay: Math.random() * 2.5,
      duration: 4 + Math.random() * 3,
      color: [theme.accent, '#fbbf24', '#fca5a5', '#a78bfa', '#86efac'][i % 5],
      size: 6 + Math.random() * 10,
    }));
  }, [theme.accent]);

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center px-6 sm:px-10 backdrop-blur-md"
      style={{ background: theme.dark ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.5)' }}
    >
      {/* Confetti layer */}
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
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-3"
             style={{ background: `${theme.accent}26`, color: theme.accent }}>
          <Sparkles className="w-4 h-4" />
          <span className="text-xs font-black uppercase tracking-widest">Final standings</span>
        </div>
        <h1 className="text-4xl sm:text-6xl font-black mb-12">
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
                {/* Avatar + crown */}
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
                      style={{ color: theme.accent, width: 48, height: 48 }}
                      strokeWidth={2.5}
                    />
                  )}
                </div>

                {/* Name + score */}
                <div className={`font-black ${place === 1 ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl'} truncate max-w-full px-1`}
                     style={{ color: place === 1 ? theme.accent : undefined }}>
                  {p.player_name}
                </div>
                <div className={`font-black tabular-nums ${place === 1 ? 'text-3xl sm:text-4xl' : 'text-xl sm:text-2xl'} opacity-90`}>
                  {formatScore(p.score, mode)}
                </div>

                {/* Pedestal */}
                <div
                  className="w-full mt-3 flex items-center justify-center rounded-t-xl border-t-2 border-x-2 relative overflow-hidden"
                  style={{
                    height: h,
                    background: theme.dark
                      ? `linear-gradient(180deg, ${color}30 0%, ${color}15 100%)`
                      : `linear-gradient(180deg, ${color}50 0%, ${color}25 100%)`,
                    borderColor: `${color}80`,
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
function ModeSubInfo({ p, mode, theme }) {
  const sub = theme.dark ? 'text-white/60' : 'text-gray-700';
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
