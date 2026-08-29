import React from 'react';
import { Flame, CheckCircle, TrendingDown, Brain, Clock, AlertCircle, Trophy, Users, Zap, Target, FileText, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function About() {
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
            <Link to="/" className="hidden sm:inline text-gray-700 hover:text-red-600 font-semibold">Home</Link>
            <Link to="/about" className="hidden sm:inline text-red-600 font-bold border-b-2 border-red-600">About</Link>
            <Link to="/contact" className="hidden md:inline text-gray-700 hover:text-red-600 font-semibold">Contact</Link>
            <Link to="/pricing" className="hidden md:inline text-gray-700 hover:text-red-600 font-semibold">Pricing</Link>
            <Link to="/login" className="bg-red-600 text-white px-4 sm:px-6 py-2 rounded-lg font-bold hover:bg-red-700 transition-colors text-sm sm:text-base">
              Log In
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-20 sm:pt-24 md:pt-32 pb-16 sm:pb-20 md:pb-24 bg-red-600">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center text-white">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-6 sm:mb-8">
            <Flame className="w-4 h-4" />
            <span className="text-sm font-bold uppercase tracking-wide">Our Story</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-black leading-tight mb-4 sm:mb-6">
            We Make Review Day<br/>Competitive
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-white/85 max-w-2xl mx-auto">
            Review day used to be the worst day of the week. We made it the best.
          </p>
        </div>f
      </section>

      {/* The Problem + The Solution */}
      <section className="py-12 sm:py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-8 md:gap-12">

            {/* Left, The Problem */}
            <div>
              <span className="text-red-600 font-bold uppercase tracking-widest text-sm">The Problem</span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 mt-2 mb-4">
                No student<br/><span className="text-red-600">wants</span> to study
              </h2>
              <p className="text-gray-600 mb-8">
                The problem with studying isn't that students are lazy. It's that traditional review methods are genuinely boring. Flashcards, worksheets, and re-reading notes do not use what actually motivates people: competition, social connection, and winning.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-red-50 border-2 border-red-100 rounded-2xl p-5 text-center">
                  <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <TrendingDown className="w-5 h-5 text-white" strokeWidth={2.5} />
                  </div>
                  <div className="text-3xl font-black text-red-600 mb-1">65%</div>
                  <p className="text-xs font-semibold text-gray-700">of students are bored in class every single day</p>
                </div>
                <div className="bg-orange-50 border-2 border-orange-100 rounded-2xl p-5 text-center">
                  <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <Brain className="w-5 h-5 text-white" strokeWidth={2.5} />
                  </div>
                  <div className="text-3xl font-black text-orange-500 mb-1">70%</div>
                  <p className="text-xs font-semibold text-gray-700">of new information is forgotten within 24 hours without active recall</p>
                </div>
                <div className="bg-red-50 border-2 border-red-100 rounded-2xl p-5 text-center">
                  <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <Clock className="w-5 h-5 text-white" strokeWidth={2.5} />
                  </div>
                  <div className="text-3xl font-black text-red-600 mb-1">10 min</div>
                  <p className="text-xs font-semibold text-gray-700">average attention span during passive, lecture-style review</p>
                </div>
                <div className="bg-orange-50 border-2 border-orange-100 rounded-2xl p-5 text-center">
                  <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <AlertCircle className="w-5 h-5 text-white" strokeWidth={2.5} />
                  </div>
                  <div className="text-3xl font-black text-orange-500 mb-1">1 in 3</div>
                  <p className="text-xs font-semibold text-gray-700">students never voluntarily study outside of class</p>
                </div>
              </div>
            </div>

            {/* Right, The Solution */}
            <div>
              <span className="text-green-600 font-bold uppercase tracking-widest text-sm">The Solution</span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 mt-2 mb-4">
                Make them <br/><span className="text-green-600">want </span> to study
              </h2>
              <p className="text-gray-600 mb-8">
                Blazes wraps the content teachers need to cover inside a multiplayer game students actually want to play. Competition, rewards, and social energy do the motivating, the curriculum does the teaching.
              </p>

              <div className="space-y-4">
                <div className="flex gap-4 p-4 bg-green-50 border-2 border-green-100 rounded-2xl">
                  <div className="flex-shrink-0 w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center">
                    <Zap className="w-5 h-5 text-white" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h4 className="font-black text-gray-900">Live multiplayer competition</h4>
                    <p className="text-sm text-gray-600">Students compete against each other in real time. Nobody wants to place last, so everyone keeps answering.</p>
                  </div>
                </div>
                <div className="flex gap-4 p-4 bg-green-50 border-2 border-green-100 rounded-2xl">
                  <div className="flex-shrink-0 w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-white" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h4 className="font-black text-gray-900">Rewards that keep them coming back</h4>
                    <p className="text-sm text-gray-600">BlazesBucks, custom skins, streaks, and leaderboards give students a real reason to play again tomorrow.</p>
                  </div>
                </div>
                <div className="flex gap-4 p-4 bg-green-50 border-2 border-green-100 rounded-2xl">
                  <div className="flex-shrink-0 w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center">
                    <Target className="w-5 h-5 text-white" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h4 className="font-black text-gray-900">Teacher control, student energy</h4>
                    <p className="text-sm text-gray-600">Teachers set the questions and monitor progress live. Students feel the freedom of a game. Everyone wins.</p>
                  </div>
                </div>
                <div className="flex gap-4 p-4 bg-green-50 border-2 border-green-100 rounded-2xl">
                  <div className="flex-shrink-0 w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-white" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h4 className="font-black text-gray-900">Zero friction to join</h4>
                    <p className="text-sm text-gray-600">One 6-digit code. Any device. No downloads, no accounts needed. A full class is playing in under 60 seconds.</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* What We Stand For */}
      <section className="py-12 sm:py-16 md:py-24 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-4">
            <span className="text-red-600 font-bold uppercase tracking-widest text-sm">Our Principles</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-gray-900 text-center mb-4">What We Stand For</h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 text-center mb-10 sm:mb-16">Four principles that guide every decision we make at Blazes.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="bg-white rounded-2xl p-8 border-2 border-gray-100 hover:border-red-200 transition-colors">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-4">
                <Flame className="w-6 h-6 text-red-600" strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-3">Learning Should Be Fun</h3>
              <p className="text-gray-600">We believe the best education happens when students are genuinely excited to participate. Blazes turns every study session into something students actually look forward to.</p>
            </div>
            <div className="bg-white rounded-2xl p-8 border-2 border-gray-100 hover:border-orange-200 transition-colors">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-4">
                <Trophy className="w-6 h-6 text-orange-500" strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-3">Competition Drives Growth</h3>
              <p className="text-gray-600">Healthy competition pushes students to try harder, think faster, and retain more. We harness that natural drive and point it toward academic success.</p>
            </div>
            <div className="bg-white rounded-2xl p-8 border-2 border-gray-100 hover:border-red-200 transition-colors">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-red-600" strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-3">Teachers Are Heroes</h3>
              <p className="text-gray-600">Every feature we build starts with one question: does this make a teacher's life easier? Educators deserve tools that respect their time and amplify their impact.</p>
            </div>
            <div className="bg-white rounded-2xl p-8 border-2 border-gray-100 hover:border-orange-200 transition-colors">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-4">
                <CheckCircle className="w-6 h-6 text-orange-500" strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-3">Accessible to Everyone</h3>
              <p className="text-gray-600">No app downloads, no expensive hardware, no barriers. Any student with a phone or browser can join a game in seconds, regardless of their school's budget.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Why It Works */}
      <section className="py-12 sm:py-16 md:py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-8 md:gap-12 lg:gap-16 items-center">
            <div>
              <span className="text-red-600 font-bold uppercase tracking-widest text-sm">Why It Works</span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-gray-900 mt-2 mb-4 sm:mb-6">The Science Behind the Fun</h2>
              <p className="text-base sm:text-lg text-gray-600 mb-6 sm:mb-8">Blazes isn't entertainment with a study label slapped on it. Every mechanic is designed around what learning science says actually works.</p>
              <div className="space-y-5">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-red-600" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h4 className="font-black text-gray-900">Active Recall</h4>
                    <p className="text-gray-600 text-sm">Answering questions, rather than re-reading, is what makes information easier to remember. Every Blazes round is a recall session.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-orange-500" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h4 className="font-black text-gray-900">Spaced Repetition</h4>
                    <p className="text-gray-600 text-sm">Questions rotate across sessions so the same content surfaces again before students forget it.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-red-600" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h4 className="font-black text-gray-900">Intrinsic Motivation</h4>
                    <p className="text-gray-600 text-sm">Skins, streaks, BlazesBucks, and leaderboards give students real reasons to want to play again tomorrow.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-orange-500" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h4 className="font-black text-gray-900">Immediate Feedback</h4>
                    <p className="text-gray-600 text-sm">Students see the correct answer right away. That instant correction is what the brain needs to update what it knows.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-red-600 rounded-2xl p-8 text-white">
                <div className="text-3xl sm:text-4xl md:text-5xl font-black mb-2">3×</div>
                <p className="text-lg font-bold">more likely to study voluntarily</p>
                <p className="text-white/75 text-sm mt-1">Students are 3× more likely to revisit content they found genuinely fun and engaging.</p>
              </div>
              <div className="bg-orange-500 rounded-2xl p-8 text-white">
                <div className="text-3xl sm:text-4xl md:text-5xl font-black mb-2">75%</div>
                <p className="text-lg font-bold">retention through active practice</p>
                <p className="text-white/75 text-sm mt-1">Students retain ~75% of material when they actively practice and recall it, vs just 5% from passive listening.</p>
              </div>
              <div className="bg-gray-900 rounded-2xl p-8 text-white">
                <div className="text-3xl sm:text-4xl md:text-5xl font-black mb-2">32%</div>
                <p className="text-lg font-bold">of high schoolers feel engaged at school</p>
                <p className="text-white/75 text-sm mt-1">According to Gallup, only 32% of high school students describe themselves as engaged in their education. Blazes exists to fix that.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Founder */}
      <section className="py-12 sm:py-16 md:py-24 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-4">
            <span className="text-red-600 font-bold uppercase tracking-widest text-sm">The Builder</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-gray-900 text-center mb-10 sm:mb-16">Built by a Student,<br/>for Students</h2>

          <div className="bg-white rounded-3xl p-6 sm:p-8 md:p-10 border-2 border-gray-100 flex flex-col md:flex-row gap-6 sm:gap-8 md:gap-10 items-center">
            <div className="flex-shrink-0">
              <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-red-500 to-orange-400 flex items-center justify-center shadow-lg shadow-red-200">
                <Flame className="w-16 h-16 text-white" strokeWidth={2} />
              </div>
              <div className="text-center mt-4">
                <div className="font-black text-gray-900 text-lg">Avi Mehta</div>
                <div className="text-sm text-red-600 font-bold">Founder & Builder</div>
                <div className="text-xs text-gray-500 mt-1">Age 13</div>
              </div>
            </div>
            <div>
              <p className="text-lg text-gray-700 mb-5 leading-relaxed">
                I'm a 13-year-old student who got tired of the same thing every review day. Worksheets, re-reading notes, and staring at flashcards until I stopped paying attention. I knew there had to be a better way.
              </p>
              <p className="text-lg text-gray-700 mb-5 leading-relaxed">
                So I built Blazes. Not as a school project, not for a grade. I built it just because I genuinely believe students learn better when they're competing, laughing, and actually having fun. I've felt the boredom of regular studying firsthand. I know what would make students excited and what wouldn't.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed">
                I truly believe Blazes can change how students feel about studying. When you're having fun, you stop thinking of it as work, and that's when real learning happens. If even one student goes home and actually wants to review because of Blazes, that means everything to me. Blazes is more than a game to me. It is a chance to make school more engaging.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20 md:py-24 bg-red-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6">
            <Flame className="w-8 h-8 sm:w-10 sm:h-10 text-red-600" strokeWidth={2.5} />
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-white mb-4 sm:mb-6">
            Ready to Start<br/>With Your Class?
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-white/85 mb-8 sm:mb-10 max-w-2xl mx-auto">
            Join thousands of teachers already using Blazes to make review sessions more engaging. Free to start. No credit card. No setup required.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link to="/signup" className="bg-white text-red-600 px-8 py-4 rounded-xl font-black text-lg hover:bg-red-50 transition-colors shadow-xl">
              Start for Free →
            </Link>
            <Link to="/login" className="border-2 border-white/50 text-white px-8 py-4 rounded-xl font-black text-lg hover:bg-white/10 transition-colors">
              Log In
            </Link>
          </div>
          <p className="mt-6 text-white/70 text-sm">Free forever for students • No app download required</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white py-8 sm:py-12 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
              <Flame className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-xl font-black">Blazes</span>
          </Link>
          <div className="flex gap-8 text-sm text-gray-600">
            <Link to="/about" className="hover:text-red-600">About</Link>
            <Link to="/contact" className="hover:text-red-600">Contact</Link>
            <Link to="/pricing" className="hover:text-red-600">Pricing</Link>
            <Link to="/terms" className="hover:text-red-600">Terms</Link>
            <Link to="/privacy" className="hover:text-red-600">Privacy</Link>
          </div>
        </div>
        <div className="mt-8 text-center text-sm text-gray-500">© 2026 Blazes. All rights reserved.</div>
      </footer>
    </div>
  );
}
