import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Check, Star, Crown, Building2, Flame } from 'lucide-react';

export default function Upgrade() {
  const navigate = useNavigate();
  const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState('');
  const [subscription, setSubscription] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (!token || !userData) { navigate('/login'); return; }
    const parsed = JSON.parse(userData);
    setUser(parsed);
    fetch(`${base}/api/subscription/${parsed.id}`).then(r => r.json()).then(setSubscription).catch(() => {});
  }, [navigate, base]);

  const homePath = user?.role === 'teacher' ? '/home/teacher' : '/home/student';

  const handleCheckout = async (plan) => {
    if (!user) return;
    setLoading(plan);
    setError('');
    try {
      const res = await fetch(`${base}/api/payments/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, plan })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || 'Could not create checkout session.');
      }
    } catch {
      setError('Could not connect to server.');
    }
    setLoading(null);
  };

  if (!user) return null;

  const isStudent = user.role === 'student';
  const isActive = subscription?.tier === 'blazes_plus' || subscription?.tier === 'teacher_pro';

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(homePath)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-xl font-black text-gray-900">Upgrade</h1>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <p className="text-red-700 font-semibold text-sm">{error}</p>
          </div>
        )}

        {isStudent ? (
          <div className="max-w-md mx-auto">
            {/* Blazes Plus */}
            <div className={`bg-white rounded-3xl p-8 relative border-2 ${subscription?.tier === 'blazes_plus' ? 'border-green-400' : 'border-red-300'}`}>
              {subscription?.tier === 'blazes_plus' && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">ACTIVE</div>
              )}
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Flame className="w-7 h-7 text-red-600" />
                </div>
                <h3 className="text-2xl font-black text-gray-900">Blazes Plus</h3>
                <div className="mt-2"><span className="text-4xl font-black text-gray-900">$9.99</span><span className="text-gray-500 text-sm ml-1">/season (90 days)</span></div>
                <p className="text-xs text-gray-400 mt-1">That's only ~$3.33/month</p>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  '1.5x XP multiplier',
                  '2x BlazesBucks earning rate',
                  'All Season Pack skins unlocked',
                  'AI Quiz Generation (notes & PDFs)',
                  'AI Flashcards study mode',
                  'AI Study Overview after games',
                  'All 8 question types',
                  'Host games up to 15 players',
                  'Unlimited kit storage',
                  'Export stats (Excel)',
                  'Exclusive profile frame',
                  'Early access to new features',
                ].map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-gray-700"><Check className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />{f}</li>
                ))}
              </ul>
              {subscription?.tier === 'blazes_plus' ? (
                <div className="w-full py-3 bg-green-100 text-green-700 font-bold rounded-xl text-sm text-center">
                  Active{subscription.expires ? ` · Expires ${new Date(subscription.expires).toLocaleDateString()}` : ''}
                </div>
              ) : (
                <button onClick={() => handleCheckout('blazes_plus')} disabled={loading === 'blazes_plus'}
                  className="w-full py-3.5 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 transition-colors text-base disabled:opacity-50">
                  {loading === 'blazes_plus' ? 'Redirecting...' : 'Get Blazes Plus'}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6 mb-10 max-w-3xl mx-auto">
            {/* Teacher Pro */}
            <div className={`bg-white rounded-2xl p-6 relative border-2 ${subscription?.tier === 'teacher_pro' ? 'border-green-400' : 'border-red-300'}`}>
              {subscription?.tier === 'teacher_pro' && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">ACTIVE</div>
              )}
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center mb-4"><Crown className="w-5 h-5 text-red-600" /></div>
              <h3 className="text-lg font-black text-gray-900">Teacher Pro</h3>
              <div className="mt-2 mb-4"><span className="text-3xl font-black text-gray-900">$12.99</span><span className="text-gray-500 text-sm ml-1">/month</span></div>
              <ul className="space-y-2.5 mb-6">
                {['Unlimited students per class', 'Advanced student analytics', 'Export reports (CSV/PDF)', 'AI quiz generation tools', 'All 8 question types', 'Custom game branding', 'Priority support'].map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600"><Check className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />{f}</li>
                ))}
              </ul>
              {subscription?.tier === 'teacher_pro' ? (
                <div className="w-full py-2.5 bg-green-100 text-green-700 font-bold rounded-xl text-sm text-center">Active</div>
              ) : (
                <>
                  <button onClick={() => handleCheckout('teacher_pro')} disabled={loading === 'teacher_pro'}
                    className="w-full py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors text-sm disabled:opacity-50">
                    {loading === 'teacher_pro' ? 'Redirecting...' : 'Start Free Trial'}
                  </button>
                  <p className="text-center text-xs text-gray-400 mt-2">14-day free trial, cancel anytime</p>
                </>
              )}
            </div>

            {/* School/District */}
            <div className="bg-white rounded-2xl p-6 border-2 border-blue-300">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-4"><Building2 className="w-5 h-5 text-blue-600" /></div>
              <h3 className="text-lg font-black text-gray-900">School & District</h3>
              <div className="mt-2 mb-4"><span className="text-3xl font-black text-gray-900">Custom</span></div>
              <ul className="space-y-2.5 mb-6">
                {['Everything in Teacher Pro', 'Unlimited teachers', 'Admin dashboard', 'SSO / Google Workspace', 'Dedicated account manager', 'SLA & onboarding support'].map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600"><Check className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />{f}</li>
                ))}
              </ul>
              <Link to="/contact" className="block text-center py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors text-sm">Contact Sales</Link>
            </div>
          </div>
        )}

        {/* BlazesBucks */}
        <div className="bg-white rounded-2xl p-8 border border-gray-200 mt-10">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-black text-gray-900 mb-2">BlazesBucks</h3>
            <p className="text-gray-500">Skip the grind. Get the skins you want.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {[
              { bb: 500, price: '$0.99', badge: '' },
              { bb: 3000, price: '$4.99', badge: '+500 bonus' },
              { bb: 7000, price: '$9.99', badge: 'Best Value' },
              { bb: 15000, price: '$19.99', badge: '+3000 bonus' },
            ].map(p => (
              <div key={p.bb} className={`rounded-xl p-4 text-center border-2 ${p.badge === 'Best Value' ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200'} relative`}>
                {p.badge && (
                  <div className={`absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold px-2 py-0.5 rounded-full ${p.badge === 'Best Value' ? 'bg-yellow-400 text-yellow-900' : 'bg-green-100 text-green-700'}`}>{p.badge}</div>
                )}
                <div className="flex items-center justify-center gap-1.5 mb-2 mt-1">
                  <img src="/blazes-coin.png" className="w-6 h-6" alt="BB" style={{ mixBlendMode: 'multiply' }} />
                  <span className="text-xl font-black text-gray-900">{p.bb.toLocaleString()}</span>
                </div>
                <button onClick={() => handleCheckout(`bb_${p.bb}`)} disabled={loading === `bb_${p.bb}`}
                  className="w-full py-2 bg-gray-900 text-white font-bold rounded-lg text-sm hover:bg-gray-800 transition-colors disabled:opacity-50">
                  {loading === `bb_${p.bb}` ? '...' : p.price}
                </button>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-gray-400 mt-4">BlazesBucks are used to buy cosmetic skins only. No pay-to-win.</p>
        </div>

        {isActive && (
          <div className="mt-10 bg-white rounded-2xl p-6 border border-gray-200">
            <h3 className="text-lg font-black text-gray-900 mb-2">Current Plan</h3>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-bold text-gray-900">
                  {subscription.tier === 'blazes_plus' ? 'Blazes Plus' : subscription.tier === 'teacher_pro' ? 'Teacher Pro' : subscription.tier}
                </div>
                {subscription.expires && (
                  <div className="text-xs text-gray-500">Expires {new Date(subscription.expires).toLocaleDateString()}</div>
                )}
              </div>
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">ACTIVE</span>
            </div>
            <div className="border-t border-gray-100 pt-4">
              <button onClick={() => setShowCancelConfirm(true)}
                className="text-sm text-red-600 font-semibold hover:text-red-700 transition-colors">
                Cancel Subscription
              </button>
            </div>
          </div>
        )}

        {showCancelConfirm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCancelConfirm(false)}>
            <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center" onClick={e => e.stopPropagation()}>
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Crown className="w-7 h-7 text-red-600" />
              </div>
              <h2 className="text-xl font-black text-gray-900 mb-2">Cancel Plan?</h2>
              <p className="text-gray-600 text-sm mb-6">You'll lose access to all premium features when your plan expires.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 text-sm">Keep Plan</button>
                <button onClick={async () => {
                  try {
                    const res = await fetch(`${base}/api/subscription/downgrade`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userId: user.id })
                    });
                    if (res.ok) {
                      setSubscription({ tier: 'free' });
                      setShowCancelConfirm(false);
                    } else {
                      const data = await res.json();
                      setError(data.error || 'Failed to cancel');
                      setShowCancelConfirm(false);
                    }
                  } catch { setError('Could not connect'); setShowCancelConfirm(false); }
                }}
                  className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 text-sm">Cancel Plan</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
