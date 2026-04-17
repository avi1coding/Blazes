import React, { useState } from 'react';
import { Flame, Mail, MessageSquare, HelpCircle, Bug, Send, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import StyledSelect from '../components/StyledSelect';

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', category: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
      const res = await fetch(`${base}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setSubmitted(true);
      } else {
        setError(data.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setError('Could not connect to the server. Please try again.');
    }
    setSending(false);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white shadow-sm z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
              <Flame className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-xl font-black">Blazes</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link to="/" className="text-gray-700 hover:text-red-600 font-semibold">Home</Link>
            <Link to="/about" className="text-gray-700 hover:text-red-600 font-semibold">About</Link>
            <Link to="/contact" className="text-red-600 font-bold border-b-2 border-red-600">Contact</Link>
            <Link to="/pricing" className="text-gray-700 hover:text-red-600 font-semibold">Pricing</Link>
            <Link to="/login" className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-red-700 transition-colors">
              Log In
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-16 bg-red-600">
        <div className="max-w-3xl mx-auto px-6 text-center text-white">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-8">
            <Mail className="w-4 h-4" />
            <span className="text-sm font-bold uppercase tracking-wide">Get in Touch</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-black leading-tight mb-4">We're Here to Help</h1>
          <p className="text-xl text-white/85">
            Got a bug, a question, or just want to say hi? We read every message.
          </p>
        </div>
      </section>

      {/* Contact Options */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            <div className="bg-white rounded-2xl p-6 border-2 border-gray-100 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Bug className="w-6 h-6 text-red-600" strokeWidth={2.5} />
              </div>
              <h3 className="font-black text-gray-900 mb-2">Report a Bug</h3>
              <p className="text-sm text-gray-600">Something broken or not working as expected? Let us know and we'll fix it fast.</p>
            </div>
            <div className="bg-white rounded-2xl p-6 border-2 border-gray-100 text-center">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <HelpCircle className="w-6 h-6 text-orange-500" strokeWidth={2.5} />
              </div>
              <h3 className="font-black text-gray-900 mb-2">Get Help</h3>
              <p className="text-sm text-gray-600">Need help setting up a game, managing your account, or anything else? We've got you.</p>
            </div>
            <div className="bg-white rounded-2xl p-6 border-2 border-gray-100 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-6 h-6 text-red-600" strokeWidth={2.5} />
              </div>
              <h3 className="font-black text-gray-900 mb-2">Share Feedback</h3>
              <p className="text-sm text-gray-600">Have an idea to make Blazes better? We're always listening — especially from students.</p>
            </div>
          </div>

          {/* Form */}
          <div className="max-w-2xl mx-auto">
            {submitted ? (
              <div className="bg-green-50 border-2 border-green-200 rounded-3xl p-12 text-center">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-8 h-8 text-white" strokeWidth={2.5} />
                </div>
                <h2 className="text-3xl font-black text-gray-900 mb-3">Message Sent!</h2>
                <p className="text-gray-600 mb-6">Thanks for reaching out. We'll get back to you as soon as possible.</p>
                <button
                  onClick={() => { setSubmitted(false); setForm({ name: '', email: '', category: '', message: '' }); }}
                  className="bg-red-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-red-700 transition-colors"
                >
                  Send Another
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-8 border-2 border-gray-100 shadow-sm">
                <h2 className="text-2xl font-black text-gray-900 mb-6">Send us a message</h2>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Your Name <span className="text-gray-400 font-normal">(optional)</span></label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Your name"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Email Address <span className="text-gray-400 font-normal">(optional)</span></label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="you@example.com"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">What's this about?</label>
                    <select
                      required
                      value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none transition-colors text-gray-700 bg-white"
                    >
                      <option value="">Select a category</option>
                      <option value="bug">Bug Report</option>
                      <option value="help">I need help</option>
                      <option value="feedback">Feature idea / Feedback</option>
                      <option value="account">Account issue</option>
                      <option value="other">Something else</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Message</label>
                    <textarea
                      required
                      rows={5}
                      value={form.message}
                      onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                      placeholder="Describe your issue or question in as much detail as you can..."
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none transition-colors resize-none"
                    />
                  </div>

                  {error && (
                    <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-red-700 font-semibold text-sm">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={sending}
                    className="w-full flex items-center justify-center gap-2 bg-red-600 text-white py-4 rounded-xl font-black text-lg hover:bg-red-700 transition-colors shadow-lg shadow-red-200 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Send className="w-5 h-5" strokeWidth={2.5} />
                    {sending ? 'Sending...' : 'Send Message'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white py-12 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
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
          </div>
        </div>
        <div className="mt-8 text-center text-sm text-gray-500">© 2026 Blazes. All rights reserved.</div>
      </footer>
    </div>
  );
}
