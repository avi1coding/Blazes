import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Rocket, Clock, Users, Flag, Trophy, Crown, Medal } from 'lucide-react';
import RaceTrack from '../components/RaceTrack';
import { getSkinById, getSkinIcon } from './SkinsPage';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

export default function RaceTrackView() {
  const { gameCode } = useParams();
  const [game, setGame] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [timeLeft, setTimeLeft] = useState(null);
  const startedAtRef = useRef(null);

  // Poll the game so we pick up status changes (e.g. status === 'ended') —
  // when the timer expires or the teacher ends the game, the projection view
  // swaps to the final leaderboard.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${BASE}/api/games/${gameCode}`);
        const data = await res.json();
        if (cancelled) return;
        setGame(data);
        if (data.started_at) {
          const s = data.started_at;
          const iso = s.includes('T') ? s : s.replace(' ', 'T') + (s.endsWith('Z') ? '' : 'Z');
          startedAtRef.current = new Date(iso).getTime();
        }
      } catch (_) {}
    };
    load();
    const id = setInterval(load, 2000);
    return () => { cancelled = true; clearInterval(id); };
  }, [gameCode]);

  // Poll participants
  useEffect(() => {
    let cancelled = false;
    const fetchParts = async () => {
      try {
        const res = await fetch(`${BASE}/api/games/${gameCode}/results`);
        const data = await res.json();
        if (!cancelled) setParticipants(data?.participants || []);
      } catch (_) {}
    };
    fetchParts();
    const id = setInterval(fetchParts, 1500);
    return () => { cancelled = true; clearInterval(id); };
  }, [gameCode]);

  // Game timer
  const settings = (() => {
    if (!game?.settings) return {};
    try { return typeof game.settings === 'string' ? JSON.parse(game.settings) : game.settings; }
    catch { return {}; }
  })();
  const distance = settings.distance || 10;
  const totalSec = settings.timeLimit || 600;

  useEffect(() => {
    const tick = () => {
      if (!startedAtRef.current) { setTimeLeft(totalSec); return; }
      const elapsed = (Date.now() - startedAtRef.current) / 1000;
      setTimeLeft(Math.max(0, Math.ceil(totalSec - elapsed)));
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [totalSec, game]);

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const timeWarning = timeLeft !== null && timeLeft <= 10;
  const timeLow = timeLeft !== null && timeLeft <= 60;

  const isOver = game?.status === 'ended' || (timeLeft !== null && timeLeft <= 0);

  // When the race ends, the projection should switch to a final leaderboard so
  // the class can see who won. Renders early-return so we don't also paint the
  // live track underneath.
  if (isOver) {
    return <FinalLeaderboard participants={participants} distance={distance} />;
  }

  return (
    <div className="min-h-screen flex flex-col text-white relative overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at 30% -20%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(ellipse at 80% 110%, rgba(168,85,247,0.18), transparent 60%), linear-gradient(180deg, #0a0e1a 0%, #050810 100%)',
      }}>
      {/* Decorative glow blobs */}
      <div className="pointer-events-none absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-cyan-500/[0.07] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-purple-500/[0.06] blur-3xl" />

      {/* Hero header */}
      <header className="relative z-10 px-6 sm:px-10 py-6 sm:py-8 flex items-center justify-between flex-wrap gap-4 sm:gap-6">
        <div className="flex items-center gap-4 sm:gap-5">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #06b6d4 0%, #2563eb 100%)',
              boxShadow: '0 8px 32px rgba(6,182,212,0.45)',
            }}>
            <Rocket className="w-7 h-7 sm:w-8 sm:h-8 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-none">RACE</h1>
            <div className="text-xs sm:text-sm text-cyan-300/80 font-bold mt-1">
              {distance} per lap · go furthest to win
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2 bg-white/[0.05] border border-white/[0.08] rounded-2xl px-4 py-2.5 sm:py-3">
            <Users className="w-5 h-5 text-cyan-400" />
            <span className="font-black tabular-nums text-xl sm:text-2xl">{participants.length}</span>
            <span className="text-[10px] uppercase tracking-wider text-white/50 font-bold hidden sm:inline ml-0.5">
              {participants.length === 1 ? 'racer' : 'racers'}
            </span>
          </div>
          {timeLeft !== null && (
            <div
              className={`flex items-center gap-2 sm:gap-3 rounded-2xl px-4 py-2.5 sm:py-3 border transition-colors ${
                timeWarning ? 'bg-red-500/20 border-red-400/50 animate-pulse' :
                timeLow ? 'bg-orange-500/20 border-orange-400/40' :
                'bg-white/[0.05] border-white/[0.08]'
              }`}
            >
              <Clock className={`w-5 h-5 ${timeWarning ? 'text-red-300' : 'text-white/70'}`} strokeWidth={2.5} />
              <span className="font-black tabular-nums text-2xl sm:text-3xl tracking-tight">{formatTime(timeLeft)}</span>
            </div>
          )}
        </div>
      </header>

      {/* Track — the centerpiece */}
      <main className="relative z-10 flex-1 px-4 sm:px-8 pb-6 sm:pb-10 flex items-center">
        <div
          className="w-full rounded-3xl border border-white/[0.06] overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, rgba(15,23,42,0.7) 0%, rgba(15,23,42,0.4) 100%)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            boxShadow: '0 30px 80px rgba(6,182,212,0.08)',
          }}
        >
          <div className="px-5 sm:px-7 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flag className="w-4 h-4 text-cyan-400" />
              <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-white/70">
                Live Track
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-emerald-400">Live</span>
            </div>
          </div>
          <RaceTrack participants={participants} distance={distance} className="aspect-[8/3]" />
        </div>
      </main>
    </div>
  );
}

// ─── End-of-race leaderboard ───────────────────────────────────────────────
// Designed to look great projected at the front of a classroom: big podium
// for top 3, list below for everyone else. Each entry uses the player's
// equipped skin so the visuals are consistent with the live race.
function FinalLeaderboard({ participants, distance }) {
  const sorted = [...participants].sort((a, b) =>
    (b.correct_answers || 0) - (a.correct_answers || 0)
  );
  const podium = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  // Podium order: visual L→R is 2nd, 1st, 3rd so the winner stands tallest in the middle.
  const podiumLayout = [podium[1], podium[0], podium[2]].filter(Boolean);
  const heightFor = (rank) => rank === 1 ? 'h-72 sm:h-80' : rank === 2 ? 'h-56 sm:h-64' : 'h-44 sm:h-52';
  const medalFor = (rank) => rank === 1 ? '#fbbf24' : rank === 2 ? '#cbd5e1' : '#f59e0b';
  const medalShadowFor = (rank) => rank === 1 ? 'shadow-yellow-500/40' : rank === 2 ? 'shadow-slate-400/40' : 'shadow-orange-500/40';

  return (
    <div
      className="min-h-screen flex flex-col text-white relative overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at 30% -20%, rgba(251,191,36,0.18), transparent 60%), radial-gradient(ellipse at 80% 110%, rgba(168,85,247,0.18), transparent 60%), linear-gradient(180deg, #0a0e1a 0%, #050810 100%)',
      }}
    >
      {/* Decorative glow blobs */}
      <div className="pointer-events-none absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-amber-500/[0.08] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-purple-500/[0.06] blur-3xl" />
      {/* Subtle confetti shapes (purely decorative) */}
      <div className="pointer-events-none absolute inset-0 opacity-20">
        {Array.from({ length: 30 }).map((_, i) => {
          const cx = (i * 53) % 100;
          const cy = (i * 89) % 100;
          const palette = ['#fbbf24', '#22d3ee', '#ef4444', '#a855f7', '#10b981'];
          return (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-sm rotate-45"
              style={{ left: `${cx}%`, top: `${cy}%`, background: palette[i % palette.length] }}
            />
          );
        })}
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 sm:px-10 pt-8 sm:pt-12 pb-4 text-center">
        <div className="inline-flex items-center gap-3 mb-3 px-5 py-2 bg-white/[0.06] border border-white/[0.10] rounded-full">
          <Flag className="w-4 h-4 text-amber-400" strokeWidth={2.8} />
          <span className="text-xs sm:text-sm font-black uppercase tracking-[0.3em] text-amber-200">Race Complete</span>
        </div>
        <h1 className="text-5xl sm:text-7xl font-black tracking-tight leading-none">FINAL STANDINGS</h1>
        <p className="mt-3 text-sm sm:text-base text-white/60 font-bold">
          {sorted.length} {sorted.length === 1 ? 'racer' : 'racers'} crossed the line
        </p>
      </header>

      {/* Podium */}
      {podiumLayout.length > 0 && (
        <section className="relative z-10 max-w-5xl mx-auto w-full px-4 sm:px-8 mt-2 sm:mt-6">
          <div className="grid grid-cols-3 gap-3 sm:gap-6 items-end">
            {podiumLayout.map((p, idx) => {
              if (!p) return <div key={idx} />;
              // Map L→R index back to actual rank (2nd, 1st, 3rd).
              const rank = idx === 0 ? 2 : idx === 1 ? 1 : 3;
              const correct = p.correct_answers || 0;
              const lap = Math.floor(correct / distance);
              const stepInLap = correct % distance;
              const skinId = p.avatar_skin || null;
              const skin = skinId ? getSkinById(skinId) : null;
              const SkinIcon = skinId ? getSkinIcon(skinId) : null;
              const color = skin?.glow || '#06b6d4';
              const Icon = rank === 1 ? Crown : rank === 2 ? Medal : Trophy;
              return (
                <div key={p.user_id} className="flex flex-col items-center">
                  {/* Avatar bubble + medal */}
                  <div className="relative mb-3">
                    <div
                      className="w-20 h-20 sm:w-28 sm:h-28 rounded-full flex items-center justify-center border-4"
                      style={{
                        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                        borderColor: medalFor(rank),
                        boxShadow: `0 12px 40px ${color}55`,
                      }}
                    >
                      {SkinIcon ? (
                        <SkinIcon className="w-10 h-10 sm:w-14 sm:h-14 text-white" strokeWidth={2.5} />
                      ) : (
                        <span className="text-3xl sm:text-4xl font-black text-white">
                          {(p.player_name || '?')[0].toUpperCase()}
                        </span>
                      )}
                    </div>
                    {/* Medal badge */}
                    <div
                      className={`absolute -bottom-2 -right-2 w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center border-2 border-black/40 shadow-lg ${medalShadowFor(rank)}`}
                      style={{ background: medalFor(rank) }}
                    >
                      <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-amber-900" strokeWidth={2.8} />
                    </div>
                  </div>
                  {/* Name */}
                  <div className="text-base sm:text-xl font-black text-center truncate max-w-full px-1">
                    {p.player_name || 'Player'}
                  </div>
                  <div className="text-xs sm:text-sm text-white/60 font-bold mb-2 sm:mb-3 tabular-nums">
                    Lap {lap} · {stepInLap}/{distance}
                  </div>
                  {/* Pillar */}
                  <div
                    className={`relative w-full ${heightFor(rank)} rounded-t-2xl border-x border-t border-white/[0.08] flex flex-col items-center justify-start pt-4 sm:pt-6 overflow-hidden`}
                    style={{
                      background: `linear-gradient(180deg, ${color}33 0%, ${color}11 100%)`,
                    }}
                  >
                    {/* Big rank number */}
                    <div
                      className="text-6xl sm:text-8xl font-black leading-none drop-shadow-lg"
                      style={{ color: medalFor(rank) }}
                    >
                      {rank}
                    </div>
                    <div className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-white/50 mt-1">
                      {rank === 1 ? 'Winner' : rank === 2 ? 'Runner-up' : 'Third'}
                    </div>
                    {/* Score */}
                    <div className="mt-auto mb-4 sm:mb-5 text-center">
                      <div className="text-3xl sm:text-4xl font-black tabular-nums" style={{ color }}>
                        {correct}
                      </div>
                      <div className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-white/50">
                        Correct
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Rest of the field */}
      {rest.length > 0 && (
        <section className="relative z-10 max-w-4xl mx-auto w-full px-4 sm:px-8 pb-8 sm:pb-12 mt-6 sm:mt-10">
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-3xl overflow-hidden backdrop-blur">
            <div className="px-5 sm:px-7 py-3 border-b border-white/[0.06] flex items-center gap-2">
              <Trophy className="w-4 h-4 text-cyan-400" />
              <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-white/70">
                Rest of the field
              </span>
            </div>
            <div className="divide-y divide-white/[0.05]">
              {rest.map((p, i) => {
                const rank = i + 4;
                const correct = p.correct_answers || 0;
                const lap = Math.floor(correct / distance);
                const stepInLap = correct % distance;
                const skinId = p.avatar_skin || null;
                const skin = skinId ? getSkinById(skinId) : null;
                const SkinIcon = skinId ? getSkinIcon(skinId) : null;
                const color = skin?.glow || '#94a3b8';
                return (
                  <div key={p.user_id} className="flex items-center gap-3 sm:gap-4 px-5 sm:px-7 py-3 sm:py-4">
                    <div className="text-lg sm:text-2xl font-black tabular-nums w-8 sm:w-10 text-center text-white/40 flex-shrink-0">
                      {rank}
                    </div>
                    <div
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 border-2"
                      style={{
                        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                        borderColor: `${color}66`,
                        boxShadow: `0 4px 12px ${color}33`,
                      }}
                    >
                      {SkinIcon ? (
                        <SkinIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" strokeWidth={2.5} />
                      ) : (
                        <span className="text-base sm:text-lg font-black text-white">
                          {(p.player_name || '?')[0].toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-base sm:text-lg font-black truncate">
                        {p.player_name || 'Player'}
                      </div>
                      <div className="text-[11px] sm:text-xs text-white/50 font-bold tabular-nums">
                        Lap {lap} · {stepInLap}/{distance}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-2xl sm:text-3xl font-black tabular-nums" style={{ color }}>
                        {correct}
                      </div>
                      <div className="text-[10px] font-black uppercase tracking-wider text-white/40">
                        correct
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Empty state — when the timer runs out before anyone scored */}
      {sorted.length === 0 && (
        <section className="relative z-10 max-w-2xl mx-auto w-full px-4 sm:px-8 mt-8">
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-3xl px-6 py-12 text-center">
            <Rocket className="w-10 h-10 mx-auto text-white/30 mb-3" />
            <p className="text-white/60 font-bold">No racers crossed the line.</p>
          </div>
        </section>
      )}
    </div>
  );
}
