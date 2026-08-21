import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { authHeaders, handleUnauthorized } from '../utils/auth';
import { ArrowLeft, Check, Crown, Building2, Flame, Sparkles, Zap, BarChart3, FileText, Users as UsersIcon, Trophy, Shield } from 'lucide-react';

export default function Upgrade() {
  const navigate = useNavigate();
  const location = useLocation();
  const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState('');
  const [subscription, setSubscription] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [trialBusy, setTrialBusy] = useState(false);
  const [trialError, setTrialError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (!token || !userData) { navigate('/login'); return; }
    let parsed = null;
    try { parsed = JSON.parse(userData); } catch (_) {}
    if (!parsed) { navigate('/login'); return; }
    setUser(parsed);
    fetch(`${base}/api/subscription/${parsed.id}`).then(r => r.json()).then(setSubscription).catch(() => {});
  }, [navigate, base]);

  const homePath = user?.role === 'teacher' ? '/home/teacher' : '/home/student';
  const goBack = () => {
    if (location.key !== 'default') navigate(-1);
    else navigate(homePath);
  };

  const handleCheckout = async (plan) => {
    if (!user) return;
    setLoading(plan);
    setError('');
    try {
      const res = await fetch(`${base}/api/payments/checkout`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ plan })
      });
      if (handleUnauthorized(res)) return;
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setError(data.error || 'Could not create checkout session.');
    } catch {
      setError('Could not connect to server.');
    }
    setLoading(null);
  };

  const handleStartTrial = async () => {
    if (!user) return;
    setTrialBusy(true);
    setTrialError('');
    try {
      const res = await fetch(`${base}/api/subscription/start-trial`, {
        method: 'POST',
        headers: authHeaders(),
        // userId now comes from the token; sending it would be ignored.
        body: JSON.stringify({}),
      });
      if (handleUnauthorized(res)) return;
      const data = await res.json();
      if (!res.ok) { setTrialError(data.error || 'Could not start trial.'); }
      else {
        // Reflect locally so the active state shows without a refetch
        setSubscription({ tier: 'teacher_pro', expires: data.expires, trialUsed: true, trialEligible: false });
      }
    } catch { setTrialError('Could not connect to server.'); }
    finally { setTrialBusy(false); }
  };

  if (!user) return null;

  const isStudent = user.role === 'student';
  const isActive = ['blazes_plus', 'teacher_pro', 'school'].includes(subscription?.tier);
  const trialEligible = subscription?.trialEligible;
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={goBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-xl font-black text-gray-900">Plans & Pricing</h1>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-10 sm:py-14">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-black uppercase tracking-widest mb-4">
            <Sparkles className="w-3.5 h-3.5" /> Unlock more
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 tracking-tight mb-3">
            {isStudent ? 'Get more from Blazes' : 'Built for great teachers'}
          </h2>
          <p className="text-gray-500 text-base sm:text-lg max-w-xl mx-auto">
            {isStudent
              ? 'Unlock perks, earn faster, and play with more friends. Cancel any time.'
              : 'Unlimited classroom size, AI tools, and analytics that actually help. Try it free for 3 days.'}
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-3 text-center max-w-xl mx-auto">
            <p className="text-red-700 font-semibold text-sm">{error}</p>
          </div>
        )}

        {/* Trial banner — teachers only, only when eligible */}
        {!isStudent && trialEligible && (
          <div className="mb-8 max-w-3xl mx-auto rounded-2xl p-5 sm:p-6 border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-teal-50 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-500/30">
                <Sparkles className="w-6 h-6 text-white" strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-black text-emerald-700 mb-0.5 tracking-wider uppercase">3-Day Free Trial</div>
                <div className="text-gray-900 font-black text-lg leading-tight">Try Teacher Pro free for 3 days</div>
                <div className="text-gray-500 text-sm mt-0.5">No card required · auto-reverts to free if you don't subscribe</div>
              </div>
              <button
                onClick={handleStartTrial}
                disabled={trialBusy}
                className="px-5 py-3 rounded-xl font-black text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:shadow-lg hover:shadow-emerald-500/30 transition-shadow disabled:opacity-50 disabled:cursor-wait text-sm sm:text-base whitespace-nowrap"
              >
                {trialBusy ? 'Starting…' : 'Start free trial →'}
              </button>
            </div>
            {trialError && <p className="text-red-700 text-xs font-bold mt-3">{trialError}</p>}
          </div>
        )}

        {/* Plans */}
        {isStudent ? (
          <div className="max-w-md mx-auto">
            <PlanCard
              accent="red"
              icon={Flame}
              title="Blazes Plus"
              priceMain="$9.99"
              priceSub="/ 90 days"
              priceHint="that's ~$3.33/month"
              cta={subscription?.tier === 'blazes_plus' ? null : 'Get Blazes Plus'}
              onCta={() => handleCheckout('blazes_plus')}
              busy={loading === 'blazes_plus'}
              active={subscription?.tier === 'blazes_plus'}
              activeExpires={subscription?.expires}
              features={[
                { icon: Zap,        text: '1.5× XP & 2× BlazesBucks earning' },
                { icon: Sparkles,   text: 'All Season Pack skins unlocked' },
                { icon: FileText,   text: 'AI Quiz Generation from notes/PDFs' },
                { icon: Trophy,     text: 'AI Flashcards study mode' },
                { icon: BarChart3,  text: 'AI Study Overview after every game' },
                { icon: UsersIcon,  text: 'Host games up to 15 players' },
                { icon: Shield,     text: 'Unlimited kit storage + Excel export' },
                { icon: Crown,      text: 'Exclusive profile frame + early access' },
              ]}
              fmtDate={fmtDate}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 max-w-4xl mx-auto">
            <PlanCard
              accent="red"
              icon={Crown}
              title="Teacher Pro"
              priceMain="$12.99"
              priceSub="/ month"
              priceHint={trialEligible ? '3-day free trial available' : 'Cancel any time'}
              cta={subscription?.tier === 'teacher_pro' ? null : 'Subscribe'}
              onCta={() => handleCheckout('teacher_pro')}
              busy={loading === 'teacher_pro'}
              active={subscription?.tier === 'teacher_pro'}
              activeExpires={subscription?.expires}
              recommended
              features={[
                { icon: UsersIcon, text: 'Unlimited students per class' },
                { icon: BarChart3, text: 'Advanced student analytics' },
                { icon: FileText,  text: 'Export reports (CSV / PDF)' },
                { icon: Sparkles,  text: 'AI quiz generation tools' },
                { icon: Trophy,    text: 'All 8 question types' },
                { icon: Crown,     text: 'Custom game branding' },
                { icon: Shield,    text: 'Priority support' },
              ]}
              fmtDate={fmtDate}
            />
            <PlanCard
              accent="blue"
              icon={Building2}
              title="School & District"
              priceMain="Custom"
              priceSub=""
              priceHint="Contact sales for a quote"
              cta="Contact Sales"
              ctaAsLink="/contact"
              active={subscription?.tier === 'school'}
              features={[
                { icon: Crown,     text: 'Everything in Teacher Pro' },
                { icon: UsersIcon, text: 'Unlimited teachers' },
                { icon: BarChart3, text: 'Admin dashboard' },
                { icon: Shield,    text: 'SSO / Google Workspace' },
                { icon: FileText,  text: 'Dedicated account manager' },
                { icon: Sparkles,  text: 'SLA & onboarding support' },
              ]}
              fmtDate={fmtDate}
            />
          </div>
        )}

        {/* BlazesBucks store */}
        <div className="mt-12 bg-white rounded-3xl p-5 sm:p-7 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-gray-900">BlazesBucks Store</h3>
              <p className="text-gray-500 text-sm">Skip the grind. Buy skins directly.</p>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
              Cosmetic only · no pay-to-win
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {[
              { bb: 500,   price: '$0.99',  badge: '' },
              { bb: 3000,  price: '$4.99',  badge: '+500 bonus' },
              { bb: 7000,  price: '$9.99',  badge: 'Best Value' },
              { bb: 15000, price: '$19.99', badge: '+3000 bonus' },
            ].map(p => (
              <div key={p.bb} className={`rounded-2xl p-4 text-center border-2 relative transition-shadow hover:shadow-md ${p.badge === 'Best Value' ? 'border-amber-400 bg-amber-50/50' : 'border-gray-200 bg-gray-50/50'}`}>
                {p.badge && (
                  <div className={`absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-black px-2.5 py-0.5 rounded-full ${p.badge === 'Best Value' ? 'bg-amber-400 text-amber-900' : 'bg-emerald-100 text-emerald-700'}`}>{p.badge}</div>
                )}
                <div className="flex items-center justify-center gap-1.5 mb-3 mt-1">
                  <img src="/blazes-coin.png" className="w-6 h-6" alt="BB" style={{ mixBlendMode: 'multiply' }} />
                  <span className="text-xl font-black text-gray-900 tabular-nums">{p.bb.toLocaleString()}</span>
                </div>
                <button onClick={() => handleCheckout(`bb_${p.bb}`)} disabled={loading === `bb_${p.bb}`}
                  className="w-full py-2 bg-gray-900 text-white font-black rounded-lg text-sm hover:bg-gray-800 transition-colors disabled:opacity-50">
                  {loading === `bb_${p.bb}` ? '…' : p.price}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Current plan card */}
        {isActive && (
          <div className="mt-8 bg-white rounded-2xl p-5 sm:p-6 border border-gray-200 shadow-sm max-w-2xl mx-auto">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Current plan</div>
                <div className="text-lg font-black text-gray-900">
                  {subscription.tier === 'blazes_plus' ? 'Blazes Plus' : subscription.tier === 'teacher_pro' ? 'Teacher Pro' : 'School & District'}
                </div>
                {subscription.expires && (
                  <div className="text-xs text-gray-500 mt-0.5">Active until {fmtDate(subscription.expires)}</div>
                )}
              </div>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-black uppercase tracking-wider">Active</span>
            </div>
            <div className="border-t border-gray-100 pt-3 mt-4">
              <button onClick={() => setShowCancelConfirm(true)}
                className="text-sm text-red-600 font-bold hover:text-red-700 transition-colors">
                Cancel subscription
              </button>
            </div>
          </div>
        )}

        {/* Cancel modal — unchanged behaviour */}
        {showCancelConfirm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCancelConfirm(false)}>
            <div className="bg-white rounded-3xl p-7 max-w-sm w-full shadow-2xl text-center" onClick={e => e.stopPropagation()}>
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Crown className="w-7 h-7 text-red-600" />
              </div>
              <h2 className="text-xl font-black text-gray-900 mb-2">Cancel plan?</h2>
              <p className="text-gray-600 text-sm mb-6">You'll keep premium features until the end of your billing period.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 text-sm">Keep plan</button>
                <button onClick={async () => {
                  try {
                    const res = await fetch(`${base}/api/subscription/downgrade`, {
                      method: 'POST',
                      headers: authHeaders(),
                      body: JSON.stringify({})
                    });
                    if (handleUnauthorized(res)) return;
                    if (res.ok) { setSubscription({ tier: 'free' }); setShowCancelConfirm(false); }
                    else { const d = await res.json(); setError(d.error || 'Failed to cancel'); setShowCancelConfirm(false); }
                  } catch { setError('Could not connect'); setShowCancelConfirm(false); }
                }}
                  className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 text-sm">Cancel plan</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PlanCard({ accent = 'red', icon: Icon, title, priceMain, priceSub, priceHint, cta, ctaAsLink, onCta, busy, active, activeExpires, features = [], recommended, fmtDate }) {
  const accentMap = {
    red:   { ring: 'ring-red-300',   bg: 'bg-red-100',   text: 'text-red-600',   btn: 'bg-red-600 hover:bg-red-700',   check: 'text-red-500' },
    blue:  { ring: 'ring-blue-300',  bg: 'bg-blue-100',  text: 'text-blue-600',  btn: 'bg-blue-600 hover:bg-blue-700', check: 'text-blue-500' },
  };
  const a = accentMap[accent] || accentMap.red;
  return (
    <div className={`relative bg-white rounded-3xl p-6 sm:p-7 border-2 ${active ? 'border-emerald-400' : recommended ? 'border-red-300 shadow-lg shadow-red-100' : 'border-gray-200'} transition-shadow`}>
      {active && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full">Active</div>
      )}
      {!active && recommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full">Recommended</div>
      )}
      <div className={`w-12 h-12 rounded-2xl ${a.bg} flex items-center justify-center mb-4`}>
        <Icon className={`w-6 h-6 ${a.text}`} strokeWidth={2.5} />
      </div>
      <h3 className="text-xl font-black text-gray-900 mb-1">{title}</h3>
      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-3xl sm:text-4xl font-black text-gray-900">{priceMain}</span>
        {priceSub && <span className="text-gray-500 text-sm font-bold">{priceSub}</span>}
      </div>
      {priceHint && <p className="text-xs text-gray-400 mb-5">{priceHint}</p>}
      <ul className="space-y-2.5 mb-6">
        {features.map((f, i) => {
          const FIcon = f.icon || Check;
          return (
            <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
              <FIcon className={`w-4 h-4 ${a.check} mt-0.5 flex-shrink-0`} strokeWidth={2.5} />
              <span>{f.text}</span>
            </li>
          );
        })}
      </ul>
      {active ? (
        <div className="w-full py-3 bg-emerald-100 text-emerald-700 font-black rounded-xl text-sm text-center">
          Active{activeExpires ? ` · until ${fmtDate(activeExpires)}` : ''}
        </div>
      ) : ctaAsLink ? (
        <Link to={ctaAsLink} className={`block text-center py-3 ${a.btn} text-white font-black rounded-xl transition-colors text-sm`}>
          {cta}
        </Link>
      ) : cta ? (
        <button onClick={onCta} disabled={busy}
          className={`w-full py-3 ${a.btn} text-white font-black rounded-xl transition-colors text-sm disabled:opacity-50`}>
          {busy ? 'Redirecting…' : cta}
        </button>
      ) : null}
    </div>
  );
}
