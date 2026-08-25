import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Star, Crown, Sparkles, Flame, Zap, TrendingUp, Lock, Check, Users, BarChart3, Gem, Calendar } from 'lucide-react';
import SkinsPage, { AvatarPreview, cacheEquippedSkin, initialEquippedSkin } from './SkinsPage';
import AchievementsMap from './AchievementsMap';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

// Read user once, synchronously. localStorage.getItem returns null when missing
// (safe. JSON.parse(null) returns null), and a try/catch guards against corrupted
// payloads. Returning here means the very first render already has the user, no
// white-screen flash before a useEffect kicks in.
function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch (_) {
    return null;
  }
}

export default function HubPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState(readStoredUser);
  // URL is the source of truth for the tab so the browser back/forward
  // buttons can navigate between tabs.
  const tab = searchParams.get('tab') || 'levels';
  const [progress, setProgress] = useState(null);
  const [blazesBucks, setBlazesBucks] = useState(0);
  const [equippedSkinId, setEquippedSkinId] = useState(initialEquippedSkin);
  const [subscription, setSubscription] = useState(null);

  // /hub?tab=upgrade should send the user to the polished pricing page,
  // not the inline UpgradeCard. Catch it before any data fetches.
  useEffect(() => {
    if (tab === 'upgrade') navigate('/upgrade', { replace: true });
  }, [tab, navigate]);

  // Bounce to /login if there's no user; if there is, fan out the data fetches.
  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetch(`${BASE}/api/season/progress/${user.id}`).then(r => r.json()).then(setProgress).catch(() => {});
    fetch(`${BASE}/api/blazesbucks/${user.id}`).then(r => r.json()).then(d => setBlazesBucks(d.balance || 0)).catch(() => {});
    fetch(`${BASE}/api/skins/${user.id}`).then(r => r.json()).then(d => {
      if (d.equipped?.avatar_skin) {
        setEquippedSkinId(d.equipped.avatar_skin);
        cacheEquippedSkin(user.id, d.equipped.avatar_skin);
      }
    }).catch(() => {});
    fetch(`${BASE}/api/subscription/${user.id}`).then(r => r.json()).then(setSubscription).catch(() => {});
  }, [navigate, user]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center animate-pulse">
          <Flame className="w-6 h-6 text-white" strokeWidth={2.5} />
        </div>
      </div>
    );
  }

  const backPath = user.role === 'teacher' ? '/home/teacher' : '/home/student';
  const goBack = () => {
    if (location.key !== 'default') navigate(-1);
    else navigate(backPath);
  };
  const isPro = ['teacher_pro', 'blazes_plus', 'school'].includes(subscription?.tier);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={goBack}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0">
                <ArrowLeft className="w-5 h-5 text-gray-700" />
              </button>
              <div className="flex items-center gap-2 min-w-0">
                <AvatarPreview skinId={equippedSkinId} initial={user.name?.[0]?.toUpperCase() || '?'} size={36} isPlus={isPro} userId={user.id} />
                <div className="min-w-0">
                  <div className="font-black text-gray-900 text-sm leading-tight truncate">{user.name || 'You'}</div>
                  <div className="text-[11px] text-gray-500 font-bold leading-tight">Lv {progress?.level || 1} · {user.role === 'teacher' ? 'Teacher' : 'Student'}{isPro ? ' Pro' : ''}</div>
                </div>
              </div>
            </div>
          </div>
          {/* No tab strip and no BlazesBucks pill: the Lv button opens this page
              to show the level and nothing else. The other tabs still render if
              reached directly by URL (/hub?tab=skins), they're just not linked
              from here any more. */}
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {tab === 'levels' && (
          <LevelsView progress={progress} blazesBucks={blazesBucks} isPro={isPro} navigate={navigate} />
        )}
        {tab === 'skins' && (
          <SkinsPage
            userId={user.id}
            blazesBucks={blazesBucks}
            onBBChange={setBlazesBucks}
            onSkinEquip={setEquippedSkinId}
          />
        )}
        {tab === 'achievements' && <AchievementsMap userId={user.id} />}
        {tab === 'upgrade' && <UpgradeCard navigate={navigate} role={user.role} />}
      </div>
    </div>
  );
}

function LevelsView({ progress, blazesBucks, isPro, navigate }) {
  const level = progress?.level || 1;
  const xpPct = progress?.xp_for_next > 0 ? Math.min((progress.xp_into_level / progress.xp_for_next) * 100, 100) : 0;
  const xpToNext = progress ? Math.max(0, progress.xp_for_next - progress.xp_into_level) : 0;
  const totalXp = progress?.total_xp || 0;
  const dailyPct = progress?.daily_cap > 0 ? Math.min((progress.xp_earned_today / progress.daily_cap) * 100, 100) : 0;
  // Circular progress geometry. Single SVG ring around the level number.
  const ringR = 92;
  const ringC = 2 * Math.PI * ringR;
  const ringFilled = (xpPct / 100) * ringC;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Hero level card. Circular ring around a giant level number */}
      <div className="relative overflow-hidden bg-gradient-to-br from-amber-400 via-orange-500 to-red-600 rounded-3xl p-6 sm:p-8 text-white shadow-2xl">
        {/* Decorative background sparkles */}
        <div className="absolute inset-0 opacity-25 pointer-events-none">
          <Sparkles className="absolute top-6 right-8 w-8 h-8" />
          <Sparkles className="absolute bottom-10 right-20 w-4 h-4" />
          <Flame className="absolute bottom-6 left-6 w-7 h-7" />
          <Star className="absolute top-12 left-12 w-5 h-5" />
        </div>

        <div className="relative flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
          {/* Circular ring + level number */}
          <div className="relative flex-shrink-0">
            <svg viewBox="0 0 220 220" className="w-44 h-44 sm:w-52 sm:h-52 -rotate-90">
              <circle cx="110" cy="110" r={ringR} fill="none" stroke="rgba(0,0,0,0.22)" strokeWidth="14" />
              <circle
                cx="110" cy="110" r={ringR}
                fill="none" stroke="white" strokeWidth="14" strokeLinecap="round"
                strokeDasharray={`${ringFilled} ${ringC}`}
                style={{ transition: 'stroke-dasharray 700ms ease-out', filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.6))' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Level</div>
              <div className="text-6xl sm:text-7xl font-black leading-none drop-shadow-md">{level}</div>
              {progress?.tier && (
                <div className="mt-1 px-2.5 py-0.5 bg-black/25 rounded-full text-[10px] font-black uppercase tracking-wider">
                  {progress.tier}
                </div>
              )}
            </div>
          </div>

          {/* Right side info */}
          <div className="flex-1 min-w-0 text-center sm:text-left w-full">
            {progress ? (
              <>
                <div className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">Next milestone</div>
                <div className="text-2xl font-black mb-3">Level {level + 1}</div>
                <div className="bg-black/20 rounded-full h-3 overflow-hidden mb-2">
                  <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${xpPct}%`, boxShadow: '0 0 10px rgba(255,255,255,0.6)' }} />
                </div>
                <div className="text-xs font-bold tabular-nums opacity-90 mb-4">
                  {progress.xp_into_level.toLocaleString()} / {progress.xp_for_next.toLocaleString()} XP · {xpToNext.toLocaleString()} to go
                </div>
                <div className="flex items-center gap-2 justify-center sm:justify-start text-xs font-black opacity-90">
                  <TrendingUp className="w-3.5 h-3.5" strokeWidth={2.8} />
                  <span>{totalXp.toLocaleString()} total XP earned</span>
                </div>
              </>
            ) : (
              <div className="text-sm opacity-80">Loading…</div>
            )}
          </div>
        </div>
      </div>

      {/* BlazesBucks + daily XP, side by side under the level card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-100 to-yellow-200 border border-amber-300 flex items-center justify-center flex-shrink-0 shadow-sm">
            <img src="/blazes-coin.png" className="w-7 h-7" alt="" style={{ mixBlendMode: 'multiply' }} />
          </div>
          <div className="min-w-0">
            <div className="text-2xl font-black text-amber-700 tabular-nums leading-none">{blazesBucks.toLocaleString()}</div>
            <div className="text-[11px] text-gray-500 font-bold uppercase tracking-wider mt-1">BlazesBucks</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-orange-500" strokeWidth={2.8} />
              <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">Daily XP</span>
            </div>
            <div className="text-xs font-black text-gray-800 tabular-nums">{progress?.xp_earned_today || 0}/{progress?.daily_cap || 0}</div>
          </div>
          <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-orange-400 via-orange-500 to-red-500 transition-all duration-500 rounded-full" style={{ width: `${dailyPct}%` }} />
          </div>
          <div className="text-[10px] text-gray-400 font-semibold mt-1.5">Resets at midnight</div>
        </div>
      </div>

      {/* Go Plus, the only route off this page. Pro users already have it. */}
      {!isPro && (
        <div className="bg-gradient-to-r from-purple-600 via-fuchsia-600 to-purple-700 rounded-2xl p-4 sm:p-5 text-white flex items-center gap-4 shadow-lg">
          <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center flex-shrink-0">
            <Crown className="w-6 h-6" strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-black text-base sm:text-lg">Earn 2× XP &amp; BB</div>
            <div className="text-xs sm:text-sm text-white/85">Upgrade to Blazes Plus for double earnings + exclusive cosmetics.</div>
          </div>
          <button onClick={() => navigate('/upgrade')}
            className="flex-shrink-0 bg-white text-purple-700 hover:bg-yellow-100 px-4 py-2 rounded-xl font-black text-sm transition-colors shadow">
            Go Plus →
          </button>
        </div>
      )}
    </div>
  );
}

function UpgradeCard({ navigate, role }) {
  const isTeacher = role === 'teacher';
  const planName = isTeacher ? 'Teacher Pro' : 'Blazes Plus';
  const tagline = isTeacher
    ? 'Power tools for serious teaching.'
    : 'Stand out, earn faster, collect more.';

  // Feature list. Same vocabulary the live /upgrade page uses, distilled to a
  // glanceable hub card. Icons make each row scannable.
  const features = isTeacher ? [
    { icon: BarChart3, label: 'Advanced class analytics', desc: 'Per-student insights, response-time heatmaps, deeper trends.' },
    { icon: Users, label: 'Up to 60 players per game', desc: 'Triple the standard cap for big classes & assemblies.' },
    { icon: Sparkles, label: 'Custom kit branding', desc: 'Your name, colors, and logo on every kit you publish.' },
    { icon: Zap, label: 'Priority support', desc: 'Skip the line when something needs attention.' },
  ] : [
    { icon: TrendingUp, label: '2× XP & BlazesBucks', desc: 'Level up twice as fast, save twice as fast.' },
    { icon: Gem, label: 'Exclusive Plus skins', desc: 'Animated avatars and bar themes you can\'t buy with BB.' },
    { icon: Crown, label: 'Plus profile ring', desc: 'A spinning rainbow halo around your avatar everywhere.' },
    { icon: Calendar, label: 'Season Pass perks', desc: 'Bonus track rewards each season, claimable any time.' },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Hero card */}
      <div className="relative overflow-hidden bg-gradient-to-br from-purple-700 via-fuchsia-600 to-purple-800 rounded-3xl p-6 sm:p-8 text-white shadow-2xl">
        {/* Decorative shapes */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-fuchsia-300/20 rounded-full blur-3xl pointer-events-none" />
        <Sparkles className="absolute top-5 right-6 w-5 h-5 opacity-60" />
        <Sparkles className="absolute bottom-8 right-12 w-3 h-3 opacity-50" />

        <div className="relative flex items-start gap-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-yellow-300 to-amber-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-900/30">
            <Crown className="w-7 h-7 sm:w-8 sm:h-8 text-amber-900" strokeWidth={2.5} fill="#78350f" fillOpacity="0.2" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] sm:text-xs font-black uppercase tracking-[0.25em] opacity-80 mb-1">Upgrade</div>
            <h2 className="text-3xl sm:text-4xl font-black leading-none mb-1">{planName}</h2>
            <p className="text-sm sm:text-base text-white/85">{tagline}</p>
          </div>
        </div>

        <button onClick={() => navigate('/upgrade')}
          className="relative mt-6 w-full py-3.5 bg-white text-purple-800 rounded-xl font-black hover:bg-yellow-100 active:scale-[0.99] transition-all shadow-lg shadow-purple-900/40 flex items-center justify-center gap-2">
          See Pricing
          <span className="text-purple-400">→</span>
        </button>
      </div>

      {/* Feature list */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <div className="text-xs font-black uppercase tracking-widest text-gray-500">What you get</div>
        </div>
        <div className="divide-y divide-gray-100">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div key={i} className="flex items-start gap-3 sm:gap-4 px-5 py-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-100 to-fuchsia-100 border border-purple-200 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-purple-700" strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-gray-900 text-sm flex items-center gap-2">
                    {f.label}
                    <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" strokeWidth={3} />
                  </div>
                  <div className="text-xs text-gray-500 font-medium mt-0.5">{f.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Free vs Plus mini-compare */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-4 h-4 text-gray-400" strokeWidth={2.5} />
            <span className="text-xs font-black uppercase tracking-wider text-gray-500">Free</span>
          </div>
          <ul className="space-y-1.5 text-xs text-gray-600 font-semibold">
            <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-gray-400" strokeWidth={3} /> Standard XP & BB</li>
            <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-gray-400" strokeWidth={3} /> Basic skins</li>
            <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-gray-400" strokeWidth={3} /> {isTeacher ? 'Up to 20 players' : 'All game modes'}</li>
          </ul>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 border-2 border-purple-300 rounded-2xl p-4 sm:p-5 relative">
          <div className="absolute -top-2 right-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-amber-950 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow">
            Best
          </div>
          <div className="flex items-center gap-2 mb-3">
            <Crown className="w-4 h-4 text-purple-600" strokeWidth={2.5} />
            <span className="text-xs font-black uppercase tracking-wider text-purple-700">{planName}</span>
          </div>
          <ul className="space-y-1.5 text-xs text-purple-900 font-bold">
            {features.slice(0, 3).map((f, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <Check className="w-3 h-3 text-purple-600" strokeWidth={3} /> {f.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
