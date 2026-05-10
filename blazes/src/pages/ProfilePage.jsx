import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AvatarPreview } from './SkinsPage';
import { ArrowLeft, Flame, Clock, Zap, Star, Sparkles } from 'lucide-react';

export default function ProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [progress, setProgress] = useState(null);
  const [badges, setBadges] = useState([]);
  const [equippedSkinId, setEquippedSkinId] = useState('default');
  const [subscription, setSubscription] = useState(null);

  const isPlus = subscription?.tier === 'blazes_plus' || subscription?.tier === 'teacher_pro' || subscription?.tier === 'school';

  useEffect(() => {
    let parsed = null;
    try {
      parsed = JSON.parse(localStorage.getItem('user') || 'null');
    } catch (_) { /* corrupted; treat as logged out */ }
    if (!parsed) { navigate('/login'); return; }
    setUser(parsed);
    const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
    fetch(`${base}/api/season/progress/${parsed.id}`).then(r => r.json()).then(setProgress).catch(() => {});
    fetch(`${base}/api/season/badges/${parsed.id}`).then(r => r.json()).then(d => setBadges(Array.isArray(d) ? d : [])).catch(() => {});
    fetch(`${base}/api/skins/${parsed.id}`).then(r => r.json()).then(d => { if (d.equipped?.avatar_skin) setEquippedSkinId(d.equipped.avatar_skin); }).catch(() => {});
    fetch(`${base}/api/subscription/${parsed.id}`).then(r => r.json()).then(setSubscription).catch(() => {});
  }, [navigate]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#1f1f23' }}>
        <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center animate-pulse">
          <Flame className="w-6 h-6 text-white" strokeWidth={2.5} />
        </div>
      </div>
    );
  }

  const backPath = user.role === 'teacher' ? '/home/teacher' : '/home/student';
  // Prefer in-app history so the back arrow returns to the page the user came
  // from. location.key === 'default' means this was the first navigation in
  // this tab — no history to pop, so fall back to the role-appropriate home.
  const goBack = () => {
    if (location.key !== 'default') navigate(-1);
    else navigate(backPath);
  };
  const level = progress?.level || 1;
  const xpPct = progress?.xp_for_next > 0 ? Math.min((progress.xp_into_level / progress.xp_for_next) * 100, 100) : 0;
  const dailyPct = progress?.daily_cap > 0 ? Math.min((progress.xp_earned_today / progress.daily_cap) * 100, 100) : 0;
  const xpToNext = progress ? progress.xp_for_next - progress.xp_into_level : 0;

  const milestones = [
    { level: 10, label: 'Bronze', color: 'text-orange-700', bg: 'bg-orange-100', border: 'border-orange-300' },
    { level: 25, label: 'Silver', color: 'text-gray-600', bg: 'bg-gray-100', border: 'border-gray-300' },
    { level: 50, label: 'Gold', color: 'text-yellow-700', bg: 'bg-yellow-100', border: 'border-yellow-300' },
    { level: 75, label: 'Diamond', color: 'text-cyan-700', bg: 'bg-cyan-100', border: 'border-cyan-300' },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #1f1f23 0%, #18181b 50%, #111113 100%)' }}>
      {/* Nav */}
      <nav className="sticky top-0 z-10" style={{ background: 'rgba(31,31,35,0.95)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={goBack} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-lg font-black text-white">Levels</h1>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Level card */}
        {progress && (
          <div className="bg-white/10 backdrop-blur-sm rounded-3xl border border-white/10 p-4 sm:p-6 md:p-8 mb-6 sm:mb-8 text-center relative">
            {/* Decorative shapes */}
            <div className="absolute top-4 right-8 w-16 h-16 bg-white/5 rounded-lg rotate-12" />
            <div className="absolute bottom-6 left-10 w-12 h-12 bg-white/5 rounded-lg -rotate-6" />
            <div className="absolute top-12 left-6 w-8 h-8 bg-white/5 rounded rotate-45" />

            {/* Avatar with Blazes Plus frame */}
            <div className="relative z-10 mb-6 flex justify-center">
              <div className="relative">
                <AvatarPreview skinId={equippedSkinId} initial={user.name?.[0]?.toUpperCase() || '?'} size={72} isPlus={isPlus} />
                {isPlus && (
                  <div style={{
                    position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)',
                    background: 'linear-gradient(135deg, #ef4444, #f97316)',
                    color: 'white', fontSize: 8, fontWeight: 900, padding: '2px 8px',
                    borderRadius: 99, whiteSpace: 'nowrap', zIndex: 3,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                    border: '2px solid #1f1f23',
                  }}>
                    BLAZES PLUS
                  </div>
                )}
              </div>
            </div>

            {/* Season + Level */}
            <div className="text-orange-400 font-bold text-sm mb-1">Season {progress.season_number}</div>
            <div className="text-white font-black text-3xl sm:text-4xl md:text-5xl lg:text-6xl mb-2">LEVEL {level}</div>

            {/* Multiplier badges */}
            {isPlus && (
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="flex items-center gap-1 px-2.5 py-1 bg-orange-500/20 border border-orange-400/40 rounded-full">
                  <Zap className="w-3 h-3 text-orange-400" />
                  <span className="text-orange-300 text-[10px] font-black">1.5x XP</span>
                </div>
                <div className="flex items-center gap-1 px-2.5 py-1 bg-yellow-500/20 border border-yellow-400/40 rounded-full">
                  <Sparkles className="w-3 h-3 text-yellow-400" />
                  <span className="text-yellow-300 text-[10px] font-black">2x BB</span>
                </div>
              </div>
            )}
            {!isPlus && <div className="mb-4" />}

            {/* XP bar */}
            <div className="max-w-md mx-auto">
              <div className="flex flex-col sm:flex-row justify-between text-xs sm:text-sm mb-2 gap-1">
                <span className="text-white/70 font-bold">{progress.xp_into_level.toLocaleString()}/{progress.xp_for_next.toLocaleString()} XP</span>
                <span className="text-white/70 font-bold">{xpToNext.toLocaleString()} XP TO LEVEL {Math.min(level + 1, 100)}</span>
              </div>
              <div className="h-6 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${xpPct}%` }} />
              </div>
            </div>

            {/* Info text */}
            <div className="max-w-md mx-auto mt-6 text-left space-y-3">
              <p className="text-white/80 text-sm">
                <span className="font-bold text-white">Earn XP to level up.</span> Each time you level up, you'll earn <span className="font-bold text-orange-400">50 BlazesBucks</span> which you can use to purchase items in the Shop.
              </p>
              <p className="text-white/80 text-sm">
                You can earn XP by playing games, completing assignments, and answering questions correctly.
              </p>
            </div>
          </div>
        )}

        {/* Limits */}
        {progress && (
          <div className="mb-8">
            <h2 className="text-white/50 font-black text-sm uppercase tracking-wider mb-4">LIMITS</h2>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <div className="flex items-center justify-between mb-1">
                <div className="font-bold text-white">Daily XP</div>
                <div className="text-white/60 text-xs font-bold">{progress.xp_earned_today.toLocaleString()} / {progress.daily_cap.toLocaleString()} XP</div>
              </div>
              <div className="text-red-400 text-[10px] font-semibold mb-3">Resets every day at midnight</div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden mb-2">
                <div className="h-full bg-gradient-to-r from-orange-500 to-yellow-500 rounded-full transition-all" style={{ width: `${dailyPct}%` }} />
              </div>
              {isPlus ? (
                <div className="w-full bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-400/30 rounded-xl p-3 mt-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-red-500/30 flex items-center justify-center">
                      <Flame className="w-4 h-4 text-red-400" />
                    </div>
                    <div>
                      <p className="text-red-200 text-xs font-black">Blazes Plus Active</p>
                      <p className="text-red-400/70 text-[10px] font-semibold">You're earning 1.5x XP on all activities{subscription?.expires ? ` · Expires ${new Date(subscription.expires).toLocaleDateString()}` : ''}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <button onClick={() => navigate('/upgrade')}
                  className="w-full bg-gradient-to-r from-orange-500/20 to-yellow-500/20 border border-orange-400/30 rounded-xl p-3 mt-3 hover:from-orange-500/30 hover:to-yellow-500/30 transition-all group text-left">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-orange-500/30 flex items-center justify-center">
                        <Zap className="w-4 h-4 text-orange-300" />
                      </div>
                      <div>
                        <p className="text-orange-200 text-xs font-black">Want more XP?</p>
                        <p className="text-orange-400/70 text-[10px] font-semibold">Blazes Plus members earn 1.5x XP and 2x BlazesBucks</p>
                      </div>
                    </div>
                    <span className="text-orange-300 text-xs font-black group-hover:translate-x-0.5 transition-transform">Upgrade</span>
                  </div>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Season info */}
        {progress && (
          <div className="mb-8">
            <h2 className="text-white/50 font-black text-sm uppercase tracking-wider mb-4">SEASON INFO</h2>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-white/70 text-sm font-semibold">Total XP this season</span>
                <span className="text-white font-black">{progress.xp.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/70 text-sm font-semibold">Days remaining</span>
                <span className="text-white font-black flex items-center gap-1.5"><Clock className="w-4 h-4 text-orange-400" />{progress.days_remaining}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/70 text-sm font-semibold">Season reward per level</span>
                <span className="text-orange-400 font-black">+50 BB</span>
              </div>
            </div>
          </div>
        )}

        {/* Milestones */}
        <div className="mb-8">
          <h2 className="text-white/50 font-black text-sm uppercase tracking-wider mb-4">MILESTONES</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {milestones.map(m => (
              <div key={m.label} className={`rounded-xl p-4 text-center border ${level >= m.level ? m.bg + ' ' + m.border : 'bg-white/5 border-white/10'}`}>
                <div className={`text-2xl font-black ${level >= m.level ? m.color : 'text-white/30'}`}>{m.level}</div>
                <div className={`text-xs font-bold mt-1 ${level >= m.level ? m.color : 'text-white/40'}`}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Past badges */}
        {badges.length > 0 && (
          <div>
            <h2 className="text-white/50 font-black text-sm uppercase tracking-wider mb-4">PAST SEASONS</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {badges.map((b, i) => {
                const m = milestones.find(ms => ms.label.toLowerCase() === b.badge_tier) || milestones[0];
                return (
                  <div key={i} className={`rounded-xl p-4 text-center border ${m.bg} ${m.border}`}>
                    <div className={`text-sm font-black ${m.color}`}>{b.badge_tier}</div>
                    <div className="text-xs text-gray-500 mt-1">S{b.season_number} · Lv {b.peak_level}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
