import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Flame } from 'lucide-react';

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
const RegularSetupPage = lazy(() => import("./pages/RegularSetupPage"));
const TeacherMonitoringDashboard = lazy(() => import("./pages/TeacherMonitoringDashboard"));
const StudentMonitor = lazy(() => import("./pages/StudentMonitor"));
const TeacherGameResults = lazy(() => import("./pages/TeacherGameResults"));
const ElementalClashSetupPage = lazy(() => import("./pages/ElementalClashSetupPage"));
const ElementalWagerSetupPage = lazy(() => import("./pages/ElementalWagerSetupPage"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
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
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/payment/success" element={<PaymentSuccess />} />
          <Route path="/upgrade" element={<Upgrade />} />
          <Route path="/flashcards/:kitId" element={<Flashcards />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/home/student" element={<StudentHome />} />
          <Route path="/home/teacher" element={<TeacherHome />} />
          <Route path="/game/join" element={<StudentJoinGame />} />
          <Route path="/game/waiting/:gameCode" element={<TeacherLobby />} />
          <Route path="/game/lobby/:gameCode" element={<StudentLobby />} />
          <Route path="/game/play/:gameCode" element={<GamePlay />} />
          <Route path="/game/stats/:gameCode" element={<GameStats />} />
          <Route path="/game/results/:gameCode" element={<GameResults />} />
          <Route path="/game/monitor/:gameCode/all" element={<TeacherMonitoringDashboard />} />
          <Route path="/game/monitor/:gameCode/:userId" element={<StudentMonitor />} />
          <Route path="/game/teacher-results/:gameCode" element={<TeacherGameResults />} />
          <Route path="/game/mode-select" element={<GameModePage />} />
          <Route path="/game/classic-timed-setup" element={<ClassicTimedSetupPage />} />
          <Route path="/game/regular-setup" element={<RegularSetupPage />} />
          <Route path="/game/elemental-clash-setup" element={<ElementalClashSetupPage />} />
          <Route path="/game/elemental-wager-setup" element={<ElementalWagerSetupPage />} />
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
    </BrowserRouter>
  );
}

export default App;
