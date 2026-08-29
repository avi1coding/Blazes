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

export default function Terms() {
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
            <Link to="/privacy" className="hidden sm:inline text-gray-700 hover:text-red-600 font-semibold">Privacy</Link>
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
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 mb-3">Terms of Service</h1>
          <p className="text-gray-500">Last updated: {UPDATED}</p>
        </div>
      </section>

      {/* Body */}
      <section className="py-12 sm:py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">

          <p className="text-gray-600 leading-relaxed mb-10">
            These Terms of Service ("Terms") govern access to and use of Blazes, an online quiz and study
            platform for classrooms (the "Service"). By creating an account, joining a game, or otherwise
            using the Service, you agree to these Terms. If you are a student under 18, you should have your
            teacher, school, or a parent or guardian review these Terms with you.
          </p>

          <Section n="1" title="Who Can Use Blazes">
            <p>
              Blazes has two kinds of accounts: <strong>teacher accounts</strong>, which must belong to
              someone 18 or older, and <strong>student accounts</strong>. A student account is typically
              created or invited by a teacher through a classroom, and by adding students to a classroom a
              teacher confirms they have the authority to do so under their school's policies and applicable
              law. A student does not need to provide more personal information than a name and, optionally,
              an email address to participate.
            </p>
          </Section>

          <Section n="2" title="Accounts and Security">
            <p>
              You're responsible for the activity on your account and for keeping your password confidential.
              Tell us right away if you think your account has been accessed without permission. Teachers are
              responsible for the classrooms, kits, and assignments they create, and for managing which
              students have access to them.
            </p>
          </Section>

          <Section n="3" title="Acceptable Use">
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>Use the Service to harass, bully, or share content that is obscene, hateful, or otherwise inappropriate for a classroom setting</li>
              <li>Attempt to access another user's account, or a classroom or kit you weren't given access to</li>
              <li>Probe, scan, or interfere with the Service's infrastructure, or try to bypass rate limits, subscription gates, or the game modes' anti-cheat checks</li>
              <li>Use the Service to build a competing product, or resell access to it</li>
              <li>Upload content that infringes someone else's rights</li>
            </ul>
          </Section>

          <Section n="4" title="Your Content">
            <p>
              Question kits, images, audio, and other material you upload or create ("Your Content") remain
              yours. By posting it to Blazes, you give us a license to store, display, and transmit it as
              needed to run the Service, for example showing a kit's questions to the students playing a game
              built from it. You're responsible for making sure Your Content is something you have the right
              to post and that it's appropriate for the students who will see it.
            </p>
            <p>
              Blazes can generate quiz questions and flashcards using AI, from notes, files, or a topic you
              provide. AI-generated content can be inaccurate or off-topic. You're responsible for reviewing
              it before assigning it to students, the same as you would with any material from an outside
              source.
            </p>
          </Section>

          <Section n="5" title="Subscriptions and Payments">
            <p>
              Blazes Plus, Teacher Pro, and School plans are paid subscriptions billed through Stripe, our
              payment processor. Subscriptions renew automatically at the price and interval shown at
              checkout until you cancel. You can cancel any time from your account settings; cancelling stops
              future renewals but doesn't refund the current billing period unless required by law. We may
              change subscription pricing going forward, with notice before it applies to your next renewal.
            </p>
          </Section>

          <Section n="6" title="BlazesBucks and Virtual Items">
            <p>
              BlazesBucks are earned by playing, completing achievements, and other in-app activity. They are
              not currency, have no cash value, cannot be redeemed for money, and cannot be transferred
              between accounts. Skins and other virtual items purchased with BlazesBucks are a limited license
              to use them within Blazes, not property you own. Balances and items are tied to your account and
              are forfeited if the account is closed or terminated.
            </p>
          </Section>

          <Section n="7" title="Signing In With Google">
            <p>
              If you sign in with Google, we receive the basic profile information Google shares under its
              permissions screen (typically your name, email, and profile picture) to create or log you into
              your Blazes account. We don't post to your Google account or access anything beyond what that
              screen discloses. See our <Link to="/privacy" className="text-red-600 font-semibold hover:underline">Privacy Policy</Link> for how that information is used.
            </p>
          </Section>

          <Section n="8" title="Intellectual Property">
            <p>
              The Blazes name, logo, game modes, and the Service's design and code are owned by us or our
              licensors. Nothing in these Terms transfers that ownership to you. You may not copy, modify, or
              create derivative works from the Service itself.
            </p>
          </Section>

          <Section n="9" title="Termination">
            <p>
              You can stop using Blazes and close your account at any time. We may suspend or terminate an
              account that violates these Terms, poses a risk to other users, or where we're required to by
              law. Where practical, we'll tell you why.
            </p>
          </Section>

          <Section n="10" title="Disclaimers">
            <p>
              Blazes is provided "as is." We work to keep it available and accurate, but we don't guarantee
              the Service will be uninterrupted, error-free, or that AI-generated content will be correct. To
              the extent permitted by law, we disclaim warranties of merchantability, fitness for a particular
              purpose, and non-infringement.
            </p>
          </Section>

          <Section n="11" title="Limitation of Liability">
            <p>
              To the extent permitted by law, Blazes and its team aren't liable for indirect, incidental, or
              consequential damages arising from your use of the Service. Our total liability for any claim
              relating to the Service is limited to the amount you paid us, if any, in the 12 months before
              the claim arose.
            </p>
          </Section>

          <Section n="12" title="Changes to These Terms">
            <p>
              We may update these Terms as Blazes changes. We'll update the date at the top of this page, and
              for material changes we'll make a reasonable effort to notify account holders. Continuing to use
              the Service after a change takes effect means you accept the updated Terms.
            </p>
          </Section>

          <Section n="13" title="Contact">
            <p>
              Questions about these Terms can be sent through our <Link to="/contact" className="text-red-600 font-semibold hover:underline">Contact page</Link>.
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
              <Link to="/privacy" className="hover:text-red-600">Privacy</Link>
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
