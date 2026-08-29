import { Flame, Check, Crown, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Pricing() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="fixed top-0 left-0 right-0 bg-white shadow-sm z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
              <Flame className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-xl font-black">Blazes</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4 md:gap-6">
            <Link to="/" className="hidden sm:inline text-gray-700 hover:text-red-600 font-semibold">Home</Link>
            <Link to="/about" className="hidden md:inline text-gray-700 hover:text-red-600 font-semibold">About</Link>
            <Link to="/contact" className="hidden md:inline text-gray-700 hover:text-red-600 font-semibold">Contact</Link>
            <Link to="/pricing" className="hidden sm:inline text-red-600 font-bold border-b-2 border-red-600">Pricing</Link>
            <Link to="/login" className="bg-red-600 text-white px-4 sm:px-6 py-2 rounded-lg font-bold hover:bg-red-700 transition-colors text-sm sm:text-base">Log In</Link>
          </div>
        </div>
      </nav>

      <section className="pt-20 sm:pt-24 md:pt-32 pb-16 sm:pb-20 md:pb-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 mb-4">Simple, Transparent Pricing</h2>
            <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">Free for students to play. One upgrade unlocks everything.</p>
          </div>

          <h3 className="text-xl font-black text-gray-900 mb-4">For Students</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-8 sm:mb-12 max-w-3xl mx-auto">
            {/* Free */}
            <div className="bg-white rounded-2xl p-6 border-2 border-gray-200">
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mb-4"><Flame className="w-5 h-5 text-gray-500" /></div>
              <h3 className="text-lg font-black text-gray-900">Free</h3>
              <div className="mt-2 mb-4"><span className="text-3xl font-black text-gray-900">$0</span><span className="text-gray-500 text-sm ml-1">forever</span></div>
              <ul className="space-y-2.5 mb-6">
                {['Join and play any game', 'Create up to 10 kits', '3 basic question types', 'Host games (up to 5 players)', 'Earn XP and BlazesBucks', 'Buy skins from the shop'].map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600"><Check className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />{f}</li>
                ))}
              </ul>
              <Link to="/signup" className="block text-center py-2.5 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition-colors text-sm">Sign Up Free</Link>
            </div>

            {/* Blazes Plus */}
            <div className="bg-white rounded-2xl p-6 border-2 border-red-300 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full">MOST POPULAR</div>
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center mb-4"><Flame className="w-5 h-5 text-red-600" /></div>
              <h3 className="text-lg font-black text-gray-900">Blazes Plus</h3>
              <div className="mt-2 mb-4"><span className="text-3xl font-black text-gray-900">$9.99</span><span className="text-gray-500 text-sm ml-1">/season (90 days)</span></div>
              <ul className="space-y-2.5 mb-6">
                {[
                  '1.5x XP multiplier',
                  '2x BlazesBucks earning rate',
                  'All Season Pack skins unlocked',
                  'AI Quiz Generation',
                  'AI Flashcards & Study Overview',
                  'All 8 question types',
                  'Host games up to 15 players',
                  'Unlimited kit storage',
                  'Export stats (CSV)',
                  'Exclusive profile frame',
                ].map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600"><Check className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />{f}</li>
                ))}
              </ul>
              <Link to="/signup" className="block text-center py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors text-sm">Get Started</Link>
              <p className="text-center text-xs text-gray-400 mt-2">~$3.33/month</p>
            </div>
          </div>

          <h3 className="text-xl font-black text-gray-900 mb-4">For Teachers</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-8 sm:mb-12 max-w-3xl mx-auto">
            <div className="bg-white rounded-2xl p-6 border-2 border-red-300 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full">FOR TEACHERS</div>
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center mb-4"><Crown className="w-5 h-5 text-red-600" /></div>
              <h3 className="text-lg font-black text-gray-900">Teacher Pro</h3>
              <div className="mt-2 mb-4"><span className="text-3xl font-black text-gray-900">$12.99</span><span className="text-gray-500 text-sm ml-1">/month</span></div>
              <ul className="space-y-2.5 mb-6">
                {['Unlimited students per class', 'Advanced student analytics', 'Export reports (CSV/PDF)', 'AI quiz generation tools', 'All 8 question types', 'Custom game branding', 'Priority support'].map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600"><Check className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />{f}</li>
                ))}
              </ul>
              <Link to="/signup" className="block text-center py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors text-sm">Start Free Trial</Link>
              <p className="text-center text-xs text-gray-400 mt-2">14-day free trial, cancel anytime</p>
            </div>

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

          <div className="bg-white rounded-2xl p-8 border border-gray-200">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-black text-gray-900 mb-2">BlazesBucks</h3>
              <p className="text-gray-500">Skip the grind. Get the skins you want.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-3xl mx-auto">
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
                    <img src="/blazes-coin.svg" className="w-6 h-6" alt="BB" style={{ mixBlendMode: 'multiply' }} />
                    <span className="text-xl font-black text-gray-900">{p.bb.toLocaleString()}</span>
                  </div>
                  <Link to="/signup" className="block w-full py-2 bg-gray-900 text-white font-bold rounded-lg text-sm hover:bg-gray-800 transition-colors">{p.price}</Link>
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-gray-400 mt-4">BlazesBucks are used to buy cosmetic skins only. No pay-to-win.</p>
          </div>
        </div>
      </section>

      <footer className="bg-white py-8 sm:py-12 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center"><Flame className="w-5 h-5 text-white" strokeWidth={2.5} /></div>
            <span className="text-xl font-black">Blazes</span>
          </Link>
          <div className="flex gap-8 text-sm text-gray-600">
            <Link to="/about" className="hover:text-red-600">About</Link>
            <Link to="/contact" className="hover:text-red-600">Contact</Link>
            <Link to="/pricing" className="hover:text-red-600">Pricing</Link>
          </div>
        </div>
        <div className="mt-8 text-center text-sm text-gray-500">&copy; 2026 Blazes. All rights reserved.</div>
      </footer>
    </div>
  );
}
