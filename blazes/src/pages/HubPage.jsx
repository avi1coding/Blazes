import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Star, Shirt, Award, Crown, Sparkles, Flame } from 'lucide-react';
import SkinsPage, { AvatarPreview } from './SkinsPage';
import AchievementsMap from './AchievementsMap';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

// Read user once, synchronously. localStorage.getItem returns null when missing
// (safe — JSON.parse(null) returns null), and a try/catch guards against corrupted
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, setUser] = useState(readStoredUser);
  // URL is the source of truth for the tab so the browser back/forward
  // buttons can navigate between tabs.
  const tab = searchParams.get('tab') || 'levels';
  const [progress, setProgress] = useState(null);
  const [blazesBucks, setBlazesBucks] = useState(0);
  const [equippedSkinId, setEquippedSkinId] = useState('default');
  const [subscription, setSubscription] = useState(null);
  const [badges, setBadges] = useState([]);

  // Bounce to /login if there's no user; if there is, fan out the data fetches.
  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetch(`${BASE}/api/season/progress/${user.id}`).then(r => r.json()).then(setProgress).catch(() => {});
    fetch(`${BASE}/api/season/badges/${user.id}`).then(r => r.json()).then(d => setBadges(Array.isArray(d) ? d : [])).catch(() => {});
    fetch(`${BASE}/api/blazesbucks/${user.id}`).then(r => r.json()).then(d => setBlazesBucks(d.balance || 0)).catch(() => {});
    fetch(`${BASE}/api/skins/${user.id}`).then(r => r.json()).then(d => { if (d.equipped?.avatar_skin) setEquippedSkinId(d.equipped.avatar_skin); }).catch(() => {});
    fetch(`${BASE}/api/subscription/${user.id}`).then(r => r.json()).then(setSubscription).catch(() => {});
  }, [navigate, user]);

  const switchTab = (next) => {
    setSearchParams({ tab: next });
  };

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
  const isPro = ['teacher_pro', 'blazes_plus', 'school'].includes(subscription?.tier);

  const tabs = [
    { id: 'levels', label: 'Levels', icon: Star },
    { id: 'skins', label: 'Skins & Packs', icon: Shirt },
    { id: 'achievements', label: 'Achievements', icon: Award },
    ...(!isPro ? [{ id: 'upgrade', label: 'Upgrade', icon: Crown }] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => navigate(backPath)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0">
                <ArrowLeft className="w-5 h-5 text-gray-700" />
              </button>
              <div className="flex items-center gap-2 min-w-0">
                <AvatarPreview skinId={equippedSkinId} initial={user.name?.[0]?.toUpperCase() || '?'} size={36} isPlus={isPro} />
                <div className="min-w-0">
                  <div className="font-black text-gray-900 text-sm leading-tight truncate">{user.name || 'You'}</div>
                  <div className="text-[11px] text-gray-500 font-bold leading-tight">Lv {progress?.level || 1} · {user.role === 'teacher' ? 'Teacher' : 'Student'}{isPro ? ' Pro' : ''}</div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-yellow-50 border border-yellow-200 px-3 py-1.5 rounded-full flex-shrink-0">
              <img src="/blazes-coin.png" className="w-4 h-4" alt="BB" style={{ mixBlendMode: 'multiply' }} />
              <span className="font-black text-yellow-700 text-sm tabular-nums">{blazesBucks.toLocaleString()}</span>
            </div>
          </div>
          {/* Tab strip */}
          <div className="flex items-center gap-1 overflow-x-auto pb-3 -mx-1 px-1">
            {tabs.map(t => {
              const Icon = t.icon;
              const isActive = tab === t.id;
              return (
                <button key={t.id} onClick={() => switchTab(t.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap flex-shrink-0 ${
                    isActive ? 'bg-red-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                  }`}>
                  <Icon className="w-4 h-4" strokeWidth={2.5} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {tab === 'levels' && (
          <LevelsView user={user} progress={progress} blazesBucks={blazesBucks} badges={badges} isPro={isPro} navigate={navigate} />
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

function LevelsView({ progress, blazesBucks, badges, isPro, navigate }) {
  const level = progress?.level || 1;
  const xpPct = progress?.xp_for_next > 0 ? Math.min((progress.xp_into_level / progress.xp_for_next) * 100, 100) : 0;
  const xpToNext = progress ? Math.max(0, progress.xp_for_next - progress.xp_into_level) : 0;
  const dailyPct = progress?.daily_cap > 0 ? Math.min((progress.xp_earned_today / progress.daily_cap) * 100, 100) : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Big level card */}
      <div className="bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 rounded-3xl p-8 text-white shadow-xl text-center relative overflow-hidden">
        <Sparkles className="absolute top-4 right-4 w-6 h-6 opacity-50" />
        <Flame className="absolute bottom-4 left-4 w-6 h-6 opacity-40" />
        <div className="text-sm font-black uppercase tracking-widest opacity-90 mb-1">Current Level</div>
        <div className="text-7xl font-black tracking-tight mb-3 drop-shadow-lg">{level}</div>
        {progress ? (
          <>
            <div className="w-full h-3 bg-black/25 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-white transition-all duration-700" style={{ width: `${xpPct}%` }} />
            </div>
            <div className="text-sm font-bold opacity-90 tabular-nums">
              {progress.xp_into_level} / {progress.xp_for_next} XP · {xpToNext} to Lv {level + 1}
            </div>
          </>
        ) : (
          <div className="text-sm opacity-80">Loading…</div>
        )}
      </div>

      {/* BB + daily XP cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-200 flex items-center gap-3">
          <div className="w-12 h-12 bg-yellow-50 border border-yellow-200 rounded-xl flex items-center justify-center flex-shrink-0">
            <img src="/blazes-coin.png" className="w-7 h-7" alt="BB" style={{ mixBlendMode: 'multiply' }} />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-black text-yellow-700 tabular-nums">{blazesBucks.toLocaleString()}</div>
            <div className="text-xs text-gray-500 font-semibold">BlazesBucks balance</div>
          </div>
        </div>
        {progress && progress.daily_cap > 0 && (
          <div className="bg-white rounded-2xl p-5 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">Daily XP</div>
              <div className="text-xs font-black text-gray-700 tabular-nums">{progress.xp_earned_today} / {progress.daily_cap}</div>
            </div>
            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-orange-400 to-red-500 transition-all duration-500" style={{ width: `${dailyPct}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-gray-200">
          <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-3">Badges Earned</div>
          <div className="flex flex-wrap gap-2">
            {badges.map((b, i) => (
              <div key={i} className="px-3 py-1.5 bg-gradient-to-r from-yellow-100 to-orange-100 border border-orange-200 rounded-full text-xs font-black text-orange-700">
                {b.name || b.id}
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={() => navigate('/profile')}
        className="w-full py-3 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl font-bold text-gray-700 transition-colors">
        View full profile & season history →
      </button>
    </div>
  );
}

function UpgradeCard({ navigate }) {
  return (
    <div className="max-w-md mx-auto">
      <div className="bg-gradient-to-br from-purple-600 to-fuchsia-700 rounded-3xl p-8 text-white shadow-xl text-center">
        <Crown className="w-12 h-12 mx-auto mb-4" strokeWidth={2.5} />
        <h2 className="text-3xl font-black mb-2">Go Pro</h2>
        <p className="text-white/80 mb-6 text-sm leading-relaxed">
          Unlock advanced analytics, larger games, exclusive cosmetics, and 2× XP & BB earnings.
        </p>
        <button onClick={() => navigate('/upgrade')}
          className="w-full py-3.5 bg-white text-purple-700 rounded-xl font-black hover:bg-yellow-100 active:scale-[0.99] transition-all shadow-lg">
          See Pricing
        </button>
      </div>
    </div>
  );
}
