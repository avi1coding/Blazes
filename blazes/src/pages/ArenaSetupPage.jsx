import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Clock, Play, Swords, Sparkles, Coins, ArrowLeft, Zap, Shield, Flame, Trophy } from 'lucide-react';
import HostPlaysToggle from '../components/HostPlaysToggle';
import DarkSelect from '../components/DarkSelect';

export default function ArenaSetupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { kit, user } = location.state || {};

  const [gameName, setGameName] = useState(`${kit?.title || 'Arena'} Battle`);
  const [timeLimit, setTimeLimit] = useState(600);
  const [startingCoins, setStartingCoins] = useState(100);
  const [eventInterval, setEventInterval] = useState(60);
  const [hostPlays, setHostPlays] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!kit || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-950 via-indigo-950 to-purple-950 text-white p-4">
        <div className="text-center">
          <p className="mb-4 text-white/70">Missing setup info. Pick a kit first.</p>
          <button onClick={() => navigate('/home/teacher')} className="bg-purple-600 hover:bg-purple-500 px-6 py-2 rounded-lg font-bold">Go Back</button>
        </div>
      </div>
    );
  }

  if (user.role !== 'teacher') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-950 via-indigo-950 to-purple-950 text-white p-4">
        <div className="text-center">
          <p className="mb-4 text-white/70">Arena Mode is only available to teachers.</p>
          <button onClick={() => navigate(-1)} className="bg-purple-600 hover:bg-purple-500 px-6 py-2 rounded-lg font-bold">Go Back</button>
        </div>
      </div>
    );
  }

  const generateGameCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const handleCreateGame = async () => {
    setLoading(true);
    setError('');
    const gameCode = generateGameCode();
    const settings = { gameName, timeLimit, startingCoins, eventInterval, hostName: user.name, hostPlays };
    try {
      const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
      const res = await fetch(`${base}/api/games/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostId: user.id, kitId: kit.id, gameCode, gameMode: 'arena', settings }),
      });
      if (!res.ok) throw new Error('Failed to create game');
      const data = await res.json();
      navigate(`/game/waiting/${data.gameCode}`, { state: { user } });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-indigo-950 to-fuchsia-950 text-white relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-20 -left-20 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl" />
      <div className="absolute bottom-20 -right-20 w-96 h-96 bg-fuchsia-500/15 rounded-full blur-3xl" />
      <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Top bar */}
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm font-bold text-white/70 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {/* Hero */}
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600/30 to-fuchsia-600/30 border border-purple-400/40 rounded-full px-4 py-1.5 mb-4 backdrop-blur-sm">
            <Sparkles className="w-4 h-4 text-purple-300" />
            <span className="text-xs font-black uppercase tracking-wider text-purple-200">Teacher Exclusive</span>
          </div>
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-fuchsia-500 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30">
              <Swords className="w-8 h-8" strokeWidth={2.5} />
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black bg-gradient-to-r from-purple-200 to-fuchsia-200 bg-clip-text text-transparent">Arena</h1>
          </div>
          <p className="text-white/60 text-sm sm:text-base max-w-2xl mx-auto">A strategic battle quiz. Earn coins, buy attacks, build combos, and survive random world events.</p>
        </div>

        {/* Feature badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { icon: Coins, label: 'Coin Economy', color: 'from-yellow-500 to-orange-500' },
            { icon: Zap, label: '6 Shop Items', color: 'from-blue-500 to-cyan-500' },
            { icon: Flame, label: 'Combo System', color: 'from-orange-500 to-red-500' },
            { icon: Sparkles, label: '13 World Events', color: 'from-pink-500 to-purple-500' },
          ].map(f => {
            const Icon = f.icon;
            return (
              <div key={f.label} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-3 flex flex-col items-center text-center">
                <div className={`w-9 h-9 bg-gradient-to-br ${f.color} rounded-lg flex items-center justify-center mb-2`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-white/80">{f.label}</span>
              </div>
            );
          })}
        </div>

        {/* Setup form */}
        <div className="bg-white/[0.07] backdrop-blur-md border border-white/10 rounded-3xl p-5 sm:p-7 md:p-8 shadow-2xl">
          <h2 className="text-lg font-black text-white/90 uppercase tracking-wider mb-5">Configure Your Battle</h2>

          <div className="space-y-5">
            {/* Game Name */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-bold text-white/80 mb-2">
                <Trophy className="w-4 h-4 text-purple-300" /> Game Name
              </label>
              <input type="text" value={gameName} onChange={(e) => setGameName(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:border-purple-400 focus:outline-none transition-colors" />
            </div>

            {/* Two columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-1.5 text-sm font-bold text-white/80 mb-2">
                  <Clock className="w-4 h-4 text-purple-300" /> Time Limit
                </label>
                <DarkSelect
                  value={timeLimit}
                  onChange={setTimeLimit}
                  options={[
                    { value: 300, label: '5 minutes' },
                    { value: 600, label: '10 minutes' },
                    { value: 900, label: '15 minutes' },
                    { value: 1200, label: '20 minutes' },
                  ]}
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-sm font-bold text-white/80 mb-2">
                  <Coins className="w-4 h-4 text-yellow-300" /> Starting Coins
                </label>
                <DarkSelect
                  value={startingCoins}
                  onChange={setStartingCoins}
                  options={[
                    { value: 0, label: '0 — Hard mode' },
                    { value: 100, label: '100 — Normal' },
                    { value: 250, label: '250 — Easy' },
                    { value: 500, label: '500 — Chaotic fun' },
                  ]}
                />
              </div>
            </div>

            {/* Event Frequency */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-bold text-white/80 mb-2">
                <Sparkles className="w-4 h-4 text-pink-300" /> World Event Frequency
              </label>
              <DarkSelect
                value={eventInterval}
                onChange={setEventInterval}
                options={[
                  { value: 30, label: 'Every 30s — Chaos' },
                  { value: 60, label: 'Every 60s — Normal' },
                  { value: 120, label: 'Every 2 min — Calm' },
                  { value: 0, label: 'Off — Pure quiz' },
                ]}
              />
            </div>

            {/* How it works */}
            <div className="bg-gradient-to-br from-purple-600/20 to-fuchsia-600/20 border border-purple-400/30 rounded-2xl p-4 sm:p-5">
              <h3 className="text-sm font-black mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-300" /> How Arena Works
              </h3>
              <ul className="text-sm text-white/75 space-y-2">
                <li className="flex gap-2"><span className="text-purple-300">•</span> Answer questions to earn <span className="font-bold text-yellow-300">coins</span> + <span className="font-bold text-purple-300">score</span></li>
                <li className="flex gap-2"><span className="text-purple-300">•</span> Spend coins on attacks, shields, and power-ups</li>
                <li className="flex gap-2"><span className="text-purple-300">•</span> Build streaks: <span className="font-bold">5 = free item</span>, <span className="font-bold">10 = ultimate (-100 to all opponents)</span></li>
                <li className="flex gap-2"><span className="text-purple-300">•</span> Random world events keep things unpredictable</li>
                <li className="flex gap-2"><span className="text-purple-300">•</span> No deaths — everyone plays the whole game</li>
              </ul>
            </div>

            {/* Host plays */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <HostPlaysToggle value={hostPlays} onChange={setHostPlays} />
            </div>
          </div>

          {error && <p className="mt-4 text-center text-red-300 font-bold text-sm">{error}</p>}

          {/* Actions */}
          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <button onClick={() => navigate(-1)}
              className="flex-1 px-6 py-3.5 bg-white/10 hover:bg-white/20 rounded-xl font-bold transition-colors">
              Back
            </button>
            <button onClick={handleCreateGame} disabled={loading}
              className="flex-[2] flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 rounded-xl font-black transition-all disabled:opacity-50 shadow-lg shadow-purple-500/30">
              <Play className="w-5 h-5" />
              {loading ? 'Creating...' : 'Launch Arena'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
