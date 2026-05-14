import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  Flame, Trophy, Crown, Users, Clock, Zap, TrendingUp, TrendingDown,
  Swords, Mountain, Droplets, Wind, Heart, Ghost, Newspaper, DollarSign,
  BarChart3, Maximize2, Activity, Star, ArrowUp, Sparkles, Medal,
} from 'lucide-react';
import { AvatarPreview, getNameColor, cacheTier } from './SkinsPage';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

// Each mode gets its own background + accent floaters + label/icon. Backgrounds
// are CSS-only so they animate cheaply on a projector. The "events" key tells
// the right-hand panel which endpoint feeds it and how to render rows.
const MODE_THEME = {
  classic_timed: {
    label: 'Classic Quiz',
    icon: Trophy,
    gradient: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 35%, #fbbf24 100%)',
    overlayGradient: 'radial-gradient(ellipse at top, rgba(255,255,255,0.4), transparent 60%)',
    accent: '#dc2626',
    textOnBg: '#7c2d12',
    floaters: [Flame, Star, Trophy],
  },
  survival: {
    label: 'Survival',
    icon: Heart,
    gradient: 'linear-gradient(180deg, #450a0a 0%, #7f1d1d 60%, #991b1b 100%)',
    overlayGradient: 'radial-gradient(ellipse at center, rgba(0,0,0,0.4), rgba(0,0,0,0.7))',
    accent: '#fca5a5',
    textOnBg: '#fee2e2',
    dark: true,
    floaters: [Heart, Ghost, Flame],
  },
  elemental_clash: {
    label: 'Elemental Clash',
    icon: Swords,
    gradient: 'linear-gradient(135deg, #1e3a8a 0%, #5b21b6 50%, #9d174d 100%)',
    overlayGradient: 'radial-gradient(circle at 30% 30%, rgba(59,130,246,0.3), transparent 50%), radial-gradient(circle at 70% 70%, rgba(220,38,38,0.3), transparent 50%)',
    accent: '#fbbf24',
    textOnBg: '#fef3c7',
    dark: true,
    floaters: [Flame, Droplets, Mountain, Wind],
  },
  elemental_wager: {
    label: 'Risk & Reward',
    icon: TrendingUp,
    gradient: 'linear-gradient(135deg, #064e3b 0%, #047857 50%, #fbbf24 100%)',
    overlayGradient: 'radial-gradient(ellipse at top, rgba(251,191,36,0.25), transparent 60%)',
    accent: '#fde047',
    textOnBg: '#fef9c3',
    dark: true,
    floaters: [DollarSign, Star, TrendingUp],
  },
  arena: {
    label: 'Arena',
    icon: Swords,
    gradient: 'linear-gradient(180deg, #1c1917 0%, #44403c 50%, #57534e 100%)',
    overlayGradient: 'radial-gradient(ellipse at center, rgba(251,191,36,0.15), transparent 70%)',
    accent: '#fbbf24',
    textOnBg: '#fef3c7',
    dark: true,
    floaters: [Swords, Zap, Crown],
  },
  inferno_tower: {
    label: 'Inferno Tower',
    icon: Flame,
    gradient: 'linear-gradient(0deg, #7c2d12 0%, #ea580c 50%, #1c1917 100%)',
    overlayGradient: 'radial-gradient(ellipse at bottom, rgba(251,146,60,0.5), transparent 60%)',
    accent: '#fed7aa',
    textOnBg: '#ffedd5',
    dark: true,
    floaters: [Flame, Ghost],
  },
  elemental_markets: {
    label: 'Elemental Markets',
    icon: TrendingUp,
    gradient: 'linear-gradient(135deg, #022c22 0%, #064e3b 50%, #052e16 100%)',
    overlayGradient: 'radial-gradient(ellipse at top, rgba(16,185,129,0.18), transparent 60%)',
    accent: '#10b981',
    textOnBg: '#d1fae5',
    dark: true,
    floaters: [TrendingUp, TrendingDown, DollarSign, BarChart3],
  },
};

function modeTheme(mode) {
  return MODE_THEME[mode] || MODE_THEME.classic_timed;
}

// Background layer — animated gradient + softly-floating mode-themed icons.
// Pure CSS animations so it stays buttery on a projector even with a long game.
function AnimatedBackground({ theme }) {
  // Stable random placements per mount so floaters don't jitter every poll.
  const floaters = useMemo(() => {
    const out = [];
    const count = 22;
    for (let i = 0; i < count; i++) {
      const Icon = theme.floaters[i % theme.floaters.length];
      out.push({
        Icon,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 18 + Math.random() * 42,
        delay: Math.random() * 8,
        duration: 8 + Math.random() * 10,
        opacity: 0.06 + Math.random() * 0.12,
      });
    }
    return out;
  }, [theme]);

  return (
    <>
      <div
        className="fixed inset-0 -z-10"
        style={{ background: theme.gradient }}
      />
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{ background: theme.overlayGradient }}
      />
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        {floaters.map((f, i) => (
          <f.Icon
            key={i}
            className="absolute"
            strokeWidth={1.5}
            style={{
              left: `${f.left}%`,
              top: `${f.top}%`,
              width: f.size,
              height: f.size,
              opacity: f.opacity,
              color: theme.accent,
              animation: `float ${f.duration}s ease-in-out ${f.delay}s infinite alternate`,
            }}
          />
        ))}
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

      {/* Header bar */}
      <header className="px-6 sm:px-10 pt-6 pb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
            style={{ background: theme.accent }}
          >
            <HeaderIcon className={`w-7 h-7 ${theme.dark ? 'text-white' : 'text-gray-900'}`} strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-widest opacity-70">Now playing</div>
            <div className="text-2xl sm:text-3xl font-black">{theme.label}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={`px-4 py-2 rounded-xl font-black tracking-widest text-lg ${theme.dark ? 'bg-white/10' : 'bg-black/10'}`}>
            {gameCode}
          </div>
          {timeStr && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${theme.dark ? 'bg-white/10' : 'bg-black/10'} ${timeLeft < 30 ? 'animate-pulse' : ''}`}>
              <Clock className="w-5 h-5" />
              <span className="text-xl font-black tabular-nums">{timeStr}</span>
            </div>
          )}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${theme.dark ? 'bg-white/10' : 'bg-black/10'}`}>
            <Users className="w-5 h-5" />
            <span className="text-xl font-black">{ranked.length}</span>
          </div>
          <button
            onClick={requestFullscreen}
            className={`p-2 rounded-xl ${theme.dark ? 'bg-white/10 hover:bg-white/20' : 'bg-black/10 hover:bg-black/20'} transition-colors`}
            title="Go fullscreen"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Mode-specific banner — e.g. market regime, sudden death, team scores */}
      <ModeBanner game={game} modeData={modeData} theme={theme} />

      {/* Body: leaderboard + events */}
      <main className="px-6 sm:px-10 pb-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leaderboard */}
        <section className="lg:col-span-2">
          <h2 className="text-sm font-black uppercase tracking-widest opacity-70 mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4" /> Leaderboard
          </h2>
          {ranked.length === 0 ? (
            <div className={`rounded-2xl ${theme.dark ? 'bg-white/5' : 'bg-white/40 backdrop-blur'} p-12 text-center ${subtleText}`}>
              Waiting for players…
            </div>
          ) : (
            <div className="space-y-2.5">
              {ranked.slice(0, 12).map((p, i) => {
                const place = i + 1;
                const isBumped = bumped[p.user_id] && Date.now() - bumped[p.user_id] < 1200;
                const isFirst = place === 1;
                const isPodium = place <= 3;
                const tone = theme.dark
                  ? (isFirst ? 'bg-white/[0.09] border-white/20' : isPodium ? 'bg-white/[0.06] border-white/15' : 'bg-white/[0.04] border-white/10')
                  : (isFirst ? 'bg-white/80 border-white/70' : isPodium ? 'bg-white/65 border-white/50' : 'bg-white/45 border-white/35');
                return (
                  <div
                    key={p.user_id}
                    className={`group flex items-center gap-4 sm:gap-5 px-4 py-3 sm:px-5 sm:py-4 rounded-2xl border-2 backdrop-blur-sm transition-all duration-500 ${tone} ${
                      isFirst ? 'scale-[1.025]' : ''
                    } ${p.eliminated || p.is_ghost ? 'opacity-45' : ''}`}
                    style={{
                      ...(isFirst ? { '--glow': `${theme.accent}66`, animation: 'glowPulse 3.2s ease-in-out infinite' } : {}),
                      animation: isFirst ? 'glowPulse 3.2s ease-in-out infinite, rowEnter 0.45s ease-out' : 'rowEnter 0.45s ease-out',
                    }}
                  >
                    {/* Placement */}
                    <div className="flex-shrink-0 w-14 sm:w-16 text-center">
                      {isFirst ? (
                        <Crown className="w-11 h-11 mx-auto drop-shadow-lg" style={{ color: theme.accent }} strokeWidth={2.5} />
                      ) : place === 2 ? (
                        <Medal className="w-9 h-9 mx-auto" style={{ color: theme.dark ? '#e5e7eb' : '#6b7280' }} strokeWidth={2.5} />
                      ) : place === 3 ? (
                        <Medal className="w-9 h-9 mx-auto" style={{ color: '#f59e0b' }} strokeWidth={2.5} />
                      ) : (
                        <span className={`text-2xl sm:text-3xl font-black ${isPodium ? '' : 'opacity-40'}`}>
                          {place}
                        </span>
                      )}
                    </div>

                    {/* Avatar */}
                    <div className={isFirst ? 'ring-4 ring-offset-2 rounded-full' : ''}
                         style={isFirst ? { ringColor: theme.accent, '--tw-ring-color': theme.accent, '--tw-ring-offset-color': 'transparent' } : {}}>
                      <AvatarPreview
                        skinId={p.avatar}
                        initial={(p.player_name || '?')[0].toUpperCase()}
                        size={isFirst ? 64 : 56}
                        userId={p.user_id}
                      />
                    </div>

                    {/* Name + sub-info */}
                    <div className="flex-1 min-w-0">
                      <div
                        className={`font-black truncate ${isFirst ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'}`}
                        style={{ color: isFirst ? theme.accent : getNameColor(p.avatar) || undefined }}
                      >
                        {p.player_name}
                      </div>
                      <ModeSubInfo p={p} mode={game?.game_mode} theme={theme} />
                    </div>

                    {/* Score */}
                    <div className="text-right flex-shrink-0 min-w-[6rem]">
                      <div
                        className={`font-black tabular-nums leading-none ${isFirst ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl'}`}
                        style={isBumped ? { animation: 'scoreBump 0.9s ease-out' } : {}}
                      >
                        {formatScore(p.score, game?.game_mode)}
                      </div>
                      <div className="text-[10px] font-black uppercase tracking-widest opacity-60 mt-1">
                        {game?.game_mode === 'elemental_markets' ? 'score' : 'points'}
                      </div>
                    </div>
                  </div>
                );
              })}
              {ranked.length > 12 && (
                <div className={`text-center text-xs ${subtleText} font-bold pt-2`}>
                  + {ranked.length - 12} more players
                </div>
              )}
            </div>
          )}
        </section>

        {/* Live events */}
        <aside>
          <h2 className="text-sm font-black uppercase tracking-widest opacity-70 mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4" /> Live feed
          </h2>
          <div className={`rounded-2xl ${theme.dark ? 'bg-white/5' : 'bg-white/40 backdrop-blur'} p-3 min-h-[200px]`}>
            {recentEvents.length === 0 ? (
              <div className={`text-center py-8 ${subtleText} text-sm font-semibold`}>
                {game?.status === 'started' ? 'Watching the action…' : 'Game hasn\'t started yet'}
              </div>
            ) : (
              <ul className="space-y-2">
                {recentEvents.map(ev => {
                  const Icon = ev.icon;
                  return (
                    <li
                      key={ev.id}
                      className={`flex items-start gap-3 p-2.5 rounded-xl ${theme.dark ? 'bg-white/[0.04]' : 'bg-white/40'}`}
                      style={{ animation: 'slideUp 0.4s ease-out' }}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: ev.color }} />
                      <span className="text-sm font-bold leading-snug">{ev.text}</span>
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

// Pill or row of mode-specific context shown right under the header. Keeps the
// main leaderboard uncluttered while still surfacing the things that make each
// mode feel different on the big screen.
function ModeBanner({ game, modeData, theme }) {
  const mode = game?.game_mode;
  if (!modeData) return null;
  const pill = `inline-flex items-center gap-2 px-4 py-2 rounded-full font-black text-sm ${theme.dark ? 'bg-white/10' : 'bg-black/10'}`;

  if (mode === 'elemental_markets') {
    const regime = modeData.regime || 'normal';
    const regimeColors = { normal: '#cbd5e1', bull: '#86efac', bear: '#fcd34d', crash: '#fca5a5', recovery: '#67e8f9' };
    return (
      <div className="px-6 sm:px-10 pb-3 flex flex-wrap items-center gap-2">
        <span className={pill} style={{ color: regimeColors[regime] }}>
          <Activity className="w-4 h-4" /> {regime.toUpperCase()}
        </span>
        {(modeData.stocks || []).slice(0, 6).map(s => (
          <span key={s.sym} className={pill} style={{ color: s.color }}>
            {s.sym} ${s.price?.toFixed(2)}
            <span className={s.changePct >= 0 ? 'text-emerald-300' : 'text-red-300'}>
              {s.changePct >= 0 ? '+' : ''}{s.changePct?.toFixed(1)}%
            </span>
          </span>
        ))}
      </div>
    );
  }

  if (mode === 'elemental_clash') {
    return (
      <div className="px-6 sm:px-10 pb-3 flex items-center gap-3">
        <span className={pill} style={{ background: 'rgba(59,130,246,0.25)' }}>
          <span className="text-blue-200">Team 1</span>
          <span className="tabular-nums">{modeData.team1Score || 0}</span>
        </span>
        <span className={pill} style={{ background: 'rgba(220,38,38,0.25)' }}>
          <span className="text-red-200">Team 2</span>
          <span className="tabular-nums">{modeData.team2Score || 0}</span>
        </span>
      </div>
    );
  }

  if (mode === 'inferno_tower') {
    return (
      <div className="px-6 sm:px-10 pb-3 flex items-center gap-3">
        <span className={pill} style={{ color: '#fed7aa' }}>
          <Flame className="w-4 h-4" /> Fire level {modeData.fireLevel || 0}
        </span>
        {modeData.suddenDeath === 1 && (
          <span className={pill} style={{ background: 'rgba(220,38,38,0.4)' }}>SUDDEN DEATH</span>
        )}
        {modeData.suddenDeath === 2 && (
          <span className={pill} style={{ background: 'rgba(251,191,36,0.4)' }}>TIEBREAKER</span>
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
