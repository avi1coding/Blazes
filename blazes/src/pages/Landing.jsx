import React, { useState, lazy, Suspense } from 'react';
import { Flame, Play, Hash, Lightbulb, Trophy, Users, Zap, Target, FileText, BarChart3, Settings, Printer } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

const GameplayMockup = lazy(() => import('../components/GameplayMockup'));

function LazyMockup({ mode }) {
  return (
    <Suspense fallback={<div className="absolute inset-0 bg-gray-200 animate-pulse" />}>
      <GameplayMockup mode={mode} />
    </Suspense>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const [gameCode, setGameCode] = useState('');

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white shadow-sm z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
              <Flame className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-xl font-black">Blazes</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4 md:gap-6">
            <Link to="/" className="hidden sm:inline text-red-600 font-bold border-b-2 border-red-600">Home</Link>
            <Link to="/about" className="hidden md:inline text-gray-700 hover:text-red-600 font-semibold">About</Link>
            <Link to="/contact" className="hidden md:inline text-gray-700 hover:text-red-600 font-semibold">Contact</Link>
            <Link to="/pricing" className="hidden sm:inline text-gray-700 hover:text-red-600 font-semibold">Pricing</Link>
            <Link to="/login" className="bg-red-600 text-white px-4 sm:px-6 py-2 rounded-lg font-bold hover:bg-red-700 transition-colors text-sm sm:text-base">
              Log In
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-20 sm:pt-24 md:pt-32 pb-12 sm:pb-16 md:pb-20 bg-red-600 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-8 md:gap-12 items-center">
            {/* Left side - Text */}
            <div className="text-white text-center lg:text-left">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black leading-tight mb-4 sm:mb-6">
                Study Smarter.<br/>
                Play Together.<br/>
                Win Big.
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-white/90 mb-6 sm:mb-8">
                A multiplayer study game. Compete with classmates, move up the leaderboard, and review your subjects.
              </p>
            </div>

            {/* Right side - Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Join a Game Card */}
              <div id="join-game-card" className="bg-white rounded-2xl p-6 shadow-xl">
                <div className="flex items-center gap-2 mb-4">
                  <Play className="w-5 h-5 text-red-600" />
                  <h3 className="font-black text-gray-900">Join a Game</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Enter a game code to join an active game session
                </p>
                <div className="mb-4">
                  <label className="block text-xs font-bold text-gray-700 mb-2">ENTER GAME CODE</label>
                  <input
                    type="text"
                    value={gameCode}
                    onChange={(e) => setGameCode(e.target.value.toUpperCase().slice(0, 6))}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && gameCode.length === 6) navigate('/game/join', { state: { gameCode } });
                    }}
                    placeholder="ABC123"
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-red-500 focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => { if (gameCode.length === 6) navigate('/game/join', { state: { gameCode } }); }}
                  className="w-full bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 transition-colors"
                >
                  Join Now →
                </button>
              </div>

              {/* Host a Game Card */}
              <div className="bg-orange-500 rounded-2xl p-6 shadow-xl text-white">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5" />
                  <h3 className="font-black">Host a Game</h3>
                </div>
                <p className="text-sm text-white/90 mb-4">
                  Create a new game and invite your students
                </p>
                <div className="space-y-3 mb-4">
                  <Link to="/login" className="w-full bg-white text-orange-500 py-2 rounded-lg font-bold hover:bg-orange-50 transition-colors text-sm block text-center">
                    Log In
                  </Link>
                  <div className="text-center text-xs text-white/80">or</div>
                  <Link to="/signup" className="w-full bg-white text-orange-500 py-2 rounded-lg font-bold hover:bg-orange-50 transition-colors text-sm block text-center">
                    Sign Up
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-gray-900 mb-4">How It Works</h2>
            <p className="text-base sm:text-lg md:text-xl text-gray-600">Get started in seconds. No downloads. No setup.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                <Hash className="w-8 h-8 text-white" strokeWidth={3} />
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-red-700 rounded-full flex items-center justify-center text-white font-black text-sm">1</div>
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-3">Enter Code</h3>
              <p className="text-gray-600">Join a game using a code from your teacher. No account needed if you just want to play.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                <Lightbulb className="w-8 h-8 text-white" strokeWidth={2} />
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center text-white font-black text-sm">2</div>
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-3">Answer Questions</h3>
              <p className="text-gray-600">Answer questions correctly before the timer runs out and before other players do.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                <Trophy className="w-8 h-8 text-white" strokeWidth={2} />
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-red-700 rounded-full flex items-center justify-center text-white font-black text-sm">3</div>
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-3">Win & Learn</h3>
              <p className="text-gray-600">Move up the leaderboard, earn rewards, and learn your subjects.</p>
            </div>
          </div>
        </div>
      </section>

      {/* See It In Action. Gameplay mockups */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-gray-900 mb-3">See It In Action</h2>
            <p className="text-base sm:text-lg md:text-xl text-gray-600">4 unique game modes. Each one feels different.</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[
              { id: 'classic_timed', name: 'Classic Quiz', desc: 'The standard.' },
              { id: 'elemental_clash', name: 'Elemental Clash', desc: 'Team battles.' },
              { id: 'elemental_wager', name: 'Risk & Reward', desc: 'Bet your knowledge.' },
              { id: 'arena', name: 'Arena', desc: 'Strategic warfare.' },
            ].map(m => (
              <div key={m.id} className="bg-gray-100 rounded-xl overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow">
                <div className="aspect-[4/3] relative">
                  <LazyMockup mode={m.id} />
                </div>
                <div className="p-2.5 sm:p-3">
                  <div className="font-black text-xs sm:text-sm text-gray-900 truncate">{m.name}</div>
                  <div className="text-[10px] sm:text-xs text-gray-500 truncate">{m.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What Makes Blazes Awesome */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-gray-900 mb-4">What Makes Blazes Awesome</h2>
            <p className="text-base sm:text-lg md:text-xl text-gray-600">Everything you need to make studying competitive, engaging, and fun.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-white border-2 border-gray-200 rounded-2xl p-6 hover:border-red-500 transition-colors">
              <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-white" strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2">Live Leaderboards</h3>
              <p className="text-gray-600">Compare your score with your classmates in real time.</p>
            </div>
            <div className="bg-white border-2 border-gray-200 rounded-2xl p-6 hover:border-orange-500 transition-colors">
              <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-white" strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2">Power-Ups</h3>
              <p className="text-gray-600">Use power-ups to add points, pause opponents, or reveal hints.</p>
            </div>
            <div className="bg-white border-2 border-gray-200 rounded-2xl p-6 hover:border-red-500 transition-colors">
              <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-white" strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2">Team Mode</h3>
              <p className="text-gray-600">Work with teammates to score more points than the opposing group.</p>
            </div>
            <div className="bg-white border-2 border-gray-200 rounded-2xl p-6 hover:border-orange-500 transition-colors">
              <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center mb-4">
                <Target className="w-6 h-6 text-white" strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2">Progress Tracking</h3>
              <p className="text-gray-600">See your results over time with detailed stats and achievements.</p>
            </div>
            <div className="bg-white border-2 border-gray-200 rounded-2xl p-6 hover:border-red-500 transition-colors">
              <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-white" strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2">Custom Question Sets</h3>
              <p className="text-gray-600">Create your own question sets tailored to any subject or curriculum.</p>
            </div>
            <div className="bg-white border-2 border-gray-200 rounded-2xl p-6 hover:border-orange-500 transition-colors">
              <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center mb-4">
                <Printer className="w-6 h-6 text-white" strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2">Mobile-First</h3>
              <p className="text-gray-600">Play on any device - phone, tablet, or computer. No app needed.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-gray-900 mb-4">A Multiplayer Study Game</h2>
            <p className="text-base sm:text-lg md:text-xl text-gray-600">
              Blazes transforms studying into an interactive competition. Students answer questions in real-time, climb leaderboards, and unlock achievements while mastering their subjects.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-white" strokeWidth={2.5} />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900 mb-2">Competitive Learning</h3>
                <p className="text-gray-600">Studying becomes a competitive game where students answer questions in real time and move up the leaderboard.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                  <Play className="w-5 h-5 text-white" strokeWidth={2.5} />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900 mb-2">Easy to Join</h3>
                <p className="text-gray-600">Students join with a game code in seconds. No accounts needed. Teachers create games and track progress in real-time.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" strokeWidth={2.5} />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900 mb-2">Engaging Gameplay</h3>
                <p className="text-gray-600">Students collect coins, trade bonuses, sabotage rivals, and race for supremacy. All while reinforcing critical learning skills.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                  <Settings className="w-5 h-5 text-white" strokeWidth={2.5} />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900 mb-2">Any Subject, Any Device</h3>
                <p className="text-gray-600">Create custom question sets for any topic and play on phones, tablets, or computers - no app required.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center">
                  <Flame className="w-5 h-5 text-white" strokeWidth={2.5} />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900 mb-2">Built for Students (by Students)</h3>
                <p className="text-gray-600">We know the grind. Blazes turns hours of studying into fierce Friday-league competition without ever losing its educational core.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Teaser */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 mb-4">Plans for Everyone</h2>
          <p className="text-base sm:text-lg text-gray-600 mb-8 sm:mb-12 max-w-2xl mx-auto">Free to play. Upgrade for exclusive perks, AI tools, and premium features.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10 max-w-3xl mx-auto">
            <div className="bg-white rounded-2xl p-5 border border-gray-200">
              <div className="text-2xl font-black text-gray-900 mb-1">Free</div>
              <div className="text-sm font-semibold text-gray-500 mb-2">For Students</div>
              <p className="text-xs text-gray-600">Play games, create kits, earn XP</p>
            </div>
            <div className="bg-white rounded-2xl p-5 border-2 border-red-300">
              <div className="text-2xl font-black text-gray-900 mb-1">$9.99<span className="text-sm font-bold text-gray-500">/season</span></div>
              <div className="text-sm font-semibold text-red-600 mb-2">Blazes Plus</div>
              <p className="text-xs text-gray-600">Everything unlocked: AI, skins, 1.5x XP, 2x BB</p>
            </div>
            <div className="bg-white rounded-2xl p-5 border-2 border-red-300">
              <div className="text-2xl font-black text-gray-900 mb-1">$12.99<span className="text-sm font-bold text-gray-500">/mo</span></div>
              <div className="text-sm font-semibold text-red-600 mb-2">Teacher Pro</div>
              <p className="text-xs text-gray-600">AI tools, analytics, unlimited students</p>
            </div>
          </div>
          <Link to="/pricing" className="inline-flex items-center gap-2 bg-gray-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-gray-800 transition-colors">
            View All Plans →
          </Link>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-20 md:py-24 bg-orange-500 relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center relative z-10">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6">
            <Flame className="w-8 h-8 sm:w-10 sm:h-10 text-orange-500" strokeWidth={2.5} />
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-white mb-4 sm:mb-6">
            Ready to Start<br/>Learning?
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-white/90 mb-8 sm:mb-10">
            Join students who are studying smarter, not harder. Your first game is just a code away!
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <button
              onClick={() => {
                const el = document.getElementById('join-game-card');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  setTimeout(() => {
                    const input = el.querySelector('input');
                    if (input) input.focus();
                  }, 400);
                } else {
                  navigate('/game/join');
                }
              }}
              className="bg-white text-orange-500 px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-black text-base sm:text-lg hover:bg-orange-50 transition-colors shadow-xl"
            >
              Join a Game →
            </button>
            <Link to="/signup" className="bg-red-600 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-black text-base sm:text-lg hover:bg-red-700 transition-colors shadow-xl">
              Sign Up Free →
            </Link>
          </div>
          <p className="mt-6 text-white/80 text-sm">No credit card required • Free forever for students</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white py-8 sm:py-12 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                <Flame className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-xl font-black">Blazes</span>
            </Link>
            <div className="flex gap-6 sm:gap-8 text-sm text-gray-600">
              <Link to="/about" className="hover:text-red-600">About</Link>
              <Link to="/contact" className="hover:text-red-600">Contact</Link>
              <Link to="/pricing" className="hover:text-red-600">Pricing</Link>
            </div>
          </div>
          <div className="mt-8 text-center text-sm text-gray-500">
            © 2026 Blazes. Made with 🔥 by students, for students.
          </div>
        </div>
      </footer>
    </div>
  );
}
