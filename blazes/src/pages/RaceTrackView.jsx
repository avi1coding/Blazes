import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Rocket, Clock, Users, Flag } from 'lucide-react';
import RaceTrack from '../components/RaceTrack';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

export default function RaceTrackView() {
  const { gameCode } = useParams();
  const [game, setGame] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [timeLeft, setTimeLeft] = useState(null);
  const startedAtRef = useRef(null);

  // Load game once
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
    return () => { cancelled = true; };
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

      {/* Standings */}
      <main className="relative z-10 flex-1 px-4 sm:px-6 pb-6 sm:pb-10">
        <div
          className="rounded-3xl border border-white/[0.06] overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, rgba(15,23,42,0.7) 0%, rgba(15,23,42,0.4) 100%)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          <div className="px-5 sm:px-7 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flag className="w-4 h-4 text-cyan-400" />
              <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-white/70">
                Live Standings
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-emerald-400">Live</span>
            </div>
          </div>
          <RaceTrack participants={participants} distance={distance} />
        </div>
      </main>
    </div>
  );
}
