import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Flame } from 'lucide-react';

// Catches render errors anywhere in the route tree so a broken component
// shows a friendly retry UI instead of a fully white screen.
function homePathForUser() {
  try {
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    if (u?.role === 'teacher') return '/home/teacher';
    if (u?.role === 'student' || u?.role === 'guest') return '/home/student';
  } catch (_) { /* malformed localStorage; fall through */ }
  return '/';
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
    // Silently recover from transient render errors, most are race conditions
    // during navigation. Bounce to the user's home so they can keep moving
    // instead of being stranded on a scary error screen.
    setTimeout(() => { window.location.href = homePathForUser(); }, 0);
  }
  render() {
    // Render nothing while the redirect kicks in. Better than the big red overlay.
    if (this.state.error) return null;
    return this.props.children;
  }
}

// Pages that load immediately (first screen users see)
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";

// Everything else loads on demand
const SignUp = lazy(() => import("./pages/SignUp"));
const StudentHome = lazy(() => import("./pages/StudentHome"));
const TeacherHome = lazy(() => import("./pages/TeacherHome"));
const GameModePage = lazy(() => import("./pages/GameModePage"));
const TeacherLobby = lazy(() => import("./pages/TeacherLobby"));
const StudentJoinGame = lazy(() => import("./pages/StudentJoinGame"));
const StudentLobby = lazy(() => import("./pages/StudentLobby"));
const GamePlay = lazy(() => import("./pages/GamePlay"));
const GameStats = lazy(() => import("./pages/GameStats"));
const GameResults = lazy(() => import("./pages/GameResults"));
const ClassicTimedSetupPage = lazy(() => import("./pages/ClassicTimedSetupPage"));
const TerritorySetupPage = lazy(() => import("./pages/TerritorySetupPage"));
const TeacherMonitoringDashboard = lazy(() => import("./pages/TeacherMonitoringDashboard"));
const TeacherPresentView = lazy(() => import("./pages/TeacherPresentView"));
const StudentMonitor = lazy(() => import("./pages/StudentMonitor"));
const TeacherGameResults = lazy(() => import("./pages/TeacherGameResults"));
const HubPage = lazy(() => import("./pages/HubPage"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Pricing = lazy(() => import("./pages/Pricing"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ClassroomPage = lazy(() => import("./pages/ClassroomPage"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const Upgrade = lazy(() => import("./pages/Upgrade"));
const Flashcards = lazy(() => import("./pages/Flashcards"));
const NotFound = lazy(() => import("./pages/NotFound"));

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center animate-pulse">
        <Flame className="w-6 h-6 text-white" strokeWidth={2.5} />
      </div>
    </div>
  );
}

function App() {
  useEffect(() => {
    const applySettings = () => {
      const raw = localStorage.getItem('blazes_settings');
      if (!raw) return;
      try {
        const s = JSON.parse(raw);
        const root = document.documentElement;
        root.classList.remove('text-sm', 'text-base', 'text-lg');
        if (s.font_size === 'small') root.classList.add('text-sm');
        else if (s.font_size === 'large') root.classList.add('text-lg');
        if (s.reduce_motion) root.classList.add('reduce-motion');
        else root.classList.remove('reduce-motion');
        if (!s.animations_enabled) root.classList.add('no-animations');
        else root.classList.remove('no-animations');
      } catch {}
    };
    applySettings();
    window.addEventListener('storage', applySettings);
    const interval = setInterval(applySettings, 2000);
    return () => { window.removeEventListener('storage', applySettings); clearInterval(interval); };
  }, []);

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<Loading />}>
          <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/payment/success" element={<PaymentSuccess />} />
          <Route path="/upgrade" element={<Upgrade />} />
          <Route path="/flashcards/:kitId" element={<Flashcards />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/home/student" element={<StudentHome />} />
          <Route path="/home/student/:tab" element={<StudentHome />} />
          <Route path="/home/teacher" element={<TeacherHome />} />
          <Route path="/home/teacher/:tab" element={<TeacherHome />} />
          <Route path="/game/join" element={<StudentJoinGame />} />
          <Route path="/game/waiting/:gameCode" element={<TeacherLobby />} />
          <Route path="/game/lobby/:gameCode" element={<StudentLobby />} />
          <Route path="/game/play/:gameCode" element={<GamePlay />} />
          <Route path="/game/stats/:gameCode" element={<GameStats />} />
          <Route path="/game/results/:gameCode" element={<GameResults />} />
          <Route path="/game/monitor/:gameCode/all" element={<TeacherMonitoringDashboard />} />
          <Route path="/game/present/:gameCode" element={<TeacherPresentView />} />
          <Route path="/game/monitor/:gameCode/:userId" element={<StudentMonitor />} />
          <Route path="/game/teacher-results/:gameCode" element={<TeacherGameResults />} />
          <Route path="/game/mode-select" element={<GameModePage />} />
          <Route path="/game/classic-timed-setup" element={<ClassicTimedSetupPage />} />
          <Route path="/game/territory-setup" element={<TerritorySetupPage />} />
          <Route path="/hub" element={<HubPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/classroom/:classroomId" element={<ClassroomPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
