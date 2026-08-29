import React from 'react';
import { Flame } from 'lucide-react';
import { Link } from 'react-router-dom';

const UPDATED = 'August 29, 2026';

function Section({ n, title, children }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl sm:text-2xl font-black text-gray-900 mb-3">{n}. {title}</h2>
      <div className="text-gray-600 leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function Privacy() {
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
            <Link to="/terms" className="hidden sm:inline text-gray-700 hover:text-red-600 font-semibold">Terms</Link>
            <Link to="/contact" className="hidden md:inline text-gray-700 hover:text-red-600 font-semibold">Contact</Link>
            <Link to="/login" className="bg-red-600 text-white px-4 sm:px-6 py-2 rounded-lg font-bold hover:bg-red-700 transition-colors text-sm sm:text-base">
              Log In
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-24 sm:pt-28 md:pt-32 pb-10 sm:pb-14 bg-gray-50 border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 mb-3">Privacy Policy</h1>
          <p className="text-gray-500">Last updated: {UPDATED}</p>
        </div>
      </section>

      {/* Body */}
      <section className="py-12 sm:py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">

          <p className="text-gray-600 leading-relaxed mb-10">
            This Privacy Policy explains what information Blazes collects, how it's used, and the choices
            you have. Blazes is a classroom tool: most of what we collect exists to run games, track
            progress, and give teachers useful reporting on their own students, not to build a profile for
            advertising.
          </p>

          <Section n="1" title="Information We Collect">
            <p><strong>Account information.</strong> Name, email, role (teacher or student), and password (stored hashed, never in plain text) or, if you sign in with Google, the basic profile Google shares.</p>
            <p><strong>Classroom data.</strong> Classrooms, question kits, assignments, and the roster of students a teacher adds to their classroom.</p>
            <p><strong>Gameplay data.</strong> Answers, scores, accuracy, response times, and game history, the data a teacher needs to see how their students are doing, and that powers a student's own stats, achievements, and levels.</p>
            <p><strong>Payment information.</strong> If you subscribe to a paid plan, payment is handled directly by Stripe. We receive confirmation that a payment succeeded and your subscription tier, not your full card number.</p>
            <p><strong>Technical data.</strong> Standard web request data (IP address, browser type, timestamps) used for security and troubleshooting.</p>
          </Section>

          <Section n="2" title="Children's Privacy">
            <p>
              Blazes is used by students of all ages, including children under 13, through their school. A
              student account is created and managed by a teacher acting on behalf of their school, not
              directly by the child, consistent with how school-supplied education tools are typically
              provisioned. We collect only what's needed to run the classroom (a display name, and gameplay
              activity within games their teacher creates), don't require an email address to participate as
              a student, don't show behavioral advertising to student accounts, and don't sell student
              information. A teacher or school can request that a student's data be corrected or removed at
              any time through our <Link to="/contact" className="text-red-600 font-semibold hover:underline">Contact page</Link>.
            </p>
          </Section>

          <Section n="3" title="How We Use Information">
            <ul className="list-disc pl-6 space-y-1.5">
              <li>To operate the Service, run games, save progress, and show teachers reporting on their own classrooms</li>
              <li>To maintain accounts, authenticate logins, and enforce subscription tiers</li>
              <li>To generate AI quiz content from material a teacher provides, sent to our AI provider for that single request and not used to train their models on our behalf</li>
              <li>To communicate with you about your account, or respond to a message sent through the Contact page</li>
              <li>To detect abuse, cheating, and security issues</li>
              <li>To improve the Service, generally in aggregate rather than by reviewing individual accounts</li>
            </ul>
          </Section>

          <Section n="4" title="Who We Share Information With">
            <p>
              We don't sell personal information. We share it only with the service providers that make
              Blazes work, each bound to use it only to provide their service to us:
            </p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li><strong>Stripe</strong>, to process subscription payments</li>
              <li><strong>Groq</strong>, to generate AI quiz questions and flashcards from content a teacher submits</li>
              <li><strong>Google</strong>, if you choose to sign in with your Google account</li>
              <li>Our hosting and database providers, who store the Service's data on our behalf</li>
            </ul>
            <p>We may also disclose information if required by law, or to protect the rights and safety of our users.</p>
          </Section>

          <Section n="5" title="Data Retention">
            <p>
              We keep account and classroom data for as long as the account is active, so a teacher's
              historical reporting stays intact. If you close your account, or a teacher removes a student
              from their roster, we delete or anonymize the associated personal data within a reasonable
              period, except where we're required to keep it longer (for example, financial records tied to a
              payment).
            </p>
          </Section>

          <Section n="6" title="Data Security">
            <p>
              Passwords are hashed, not stored in plain text. Payment details never touch our servers, they're
              handled directly by Stripe. Traffic to Blazes is encrypted in transit. No system is perfectly
              secure, but we take reasonable steps to protect the data you trust us with.
            </p>
          </Section>

          <Section n="7" title="Your Choices">
            <p>
              You can review and update your account details from Settings at any time. You can request a
              copy of your data, ask us to correct it, or ask us to delete your account through our{' '}
              <Link to="/contact" className="text-red-600 font-semibold hover:underline">Contact page</Link>.
              For a student account, that request should come from the student's teacher or school, since
              they manage the roster the account belongs to.
            </p>
          </Section>

          <Section n="8" title="Cookies and Local Storage">
            <p>
              Blazes uses your browser's local storage to keep you signed in and remember preferences like
              your equipped skin, this is functional, not third-party advertising tracking. We don't use
              third-party ad-tracking cookies.
            </p>
          </Section>

          <Section n="9" title="Changes to This Policy">
            <p>
              We may update this Privacy Policy as Blazes changes. We'll update the date at the top of this
              page, and for material changes we'll make a reasonable effort to notify account holders.
            </p>
          </Section>

          <Section n="10" title="Contact">
            <p>
              Questions about this policy, or requests about your data, can be sent through our{' '}
              <Link to="/contact" className="text-red-600 font-semibold hover:underline">Contact page</Link>.
            </p>
          </Section>

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
              <Link to="/terms" className="hover:text-red-600">Terms</Link>
              <Link to="/contact" className="hover:text-red-600">Contact</Link>
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
