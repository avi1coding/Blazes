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

  const sortedPlayers = [...participants].sort((a, b) => (b.correct_answers || 0) - (a.correct_answers || 0));
  const top3 = sortedPlayers.slice(0, 3);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden">
      {/* Top bar */}
      <header className="px-4 sm:px-8 py-4 border-b border-white/10 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/30">
            <Rocket className="w-6 h-6 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-xl font-black tracking-tight">Race</div>
            <div className="text-xs text-cyan-300/80 font-bold">{distance} per lap · go furthest to win</div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 sm:px-4 py-2">
            <Users className="w-4 h-4 text-cyan-400" />
            <span className="font-black tabular-nums">{participants.length}</span>
            <span className="text-[10px] uppercase tracking-wider text-white/60 font-bold hidden sm:inline">Racers</span>
          </div>
          {timeLeft !== null && (
            <div className={`flex items-center gap-2 rounded-xl px-3 sm:px-4 py-2 border ${
              timeLeft <= 10 ? 'bg-red-500/20 border-red-400/40 animate-pulse' :
              timeLeft < 60 ? 'bg-orange-500/20 border-orange-400/40' :
              'bg-white/5 border-white/10'
            }`}>
              <Clock className="w-4 h-4 text-white/80" />
              <span className="font-black tabular-nums text-base sm:text-lg">{formatTime(timeLeft)}</span>
            </div>
          )}
        </div>
      </header>

      {/* Track — center stage */}
      <main className="px-4 sm:px-8 py-4 sm:py-6">
        <div className="rounded-3xl overflow-hidden shadow-2xl border border-white/10 bg-slate-900/60">
          <RaceTrack participants={participants} distance={distance} className="aspect-[2.5/1] w-full" />
        </div>

        {/* Podium strip */}
        {top3.length > 0 && (
          <div className="mt-4 sm:mt-6 grid grid-cols-3 gap-2 sm:gap-4">
            {top3.map((p, i) => {
              const correct = p.correct_answers || 0;
              const lap = Math.floor(correct / distance);
              const stepInLap = correct % distance;
              const styles = [
                { bg: 'from-yellow-400/20 to-yellow-500/5', border: 'border-yellow-400/40', accent: 'text-yellow-300', label: '1st' },
                { bg: 'from-slate-300/20 to-slate-400/5', border: 'border-slate-300/40', accent: 'text-slate-200', label: '2nd' },
                { bg: 'from-orange-400/20 to-orange-500/5', border: 'border-orange-400/40', accent: 'text-orange-300', label: '3rd' },
              ][i];
              return (
                <div key={p.user_id} className={`bg-gradient-to-br ${styles.bg} border-2 ${styles.border} rounded-2xl p-3 sm:p-5 flex items-center gap-3`}>
                  <div className={`flex flex-col items-center justify-center w-12 sm:w-14 flex-shrink-0`}>
                    <Flag className={`w-5 h-5 sm:w-6 sm:h-6 ${styles.accent}`} />
                    <span className={`text-[10px] sm:text-xs font-black uppercase tracking-wider ${styles.accent} mt-0.5`}>{styles.label}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-base sm:text-xl truncate">{p.player_name || 'Player'}</div>
                    <div className="text-[11px] sm:text-sm text-white/70 font-bold">Lap {lap} · {stepInLap}/{distance}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-2xl sm:text-3xl font-black tabular-nums">{correct}</div>
                    <div className="text-[9px] sm:text-[10px] uppercase font-black tracking-wider text-white/60">correct</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
