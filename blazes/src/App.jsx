import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import StudentHome from "./pages/StudentHome";
import TeacherHome from "./pages/TeacherHome";
import GameModePage from "./pages/GameModePage";
import TeacherLobby from "./pages/TeacherLobby";
import StudentJoinGame from "./pages/StudentJoinGame";
import StudentLobby from "./pages/StudentLobby";
import GamePlay from "./pages/GamePlay";
import GameStats from "./pages/GameStats";
import GameResults from "./pages/GameResults";
import ClassicTimedSetupPage from "./pages/ClassicTimedSetupPage";
import RegularSetupPage from "./pages/RegularSetupPage";
import TeacherMonitoringDashboard from "./pages/TeacherMonitoringDashboard";
import StudentMonitor from "./pages/StudentMonitor";
import TeacherGameResults from "./pages/TeacherGameResults";
import SurvivalSetupPage from "./pages/SurvivalSetupPage";
import ElementalClashSetupPage from "./pages/ElementalClashSetupPage";
import InfernoTowerSetupPage from "./pages/InfernoTowerSetupPage";
import ElementalWagerSetupPage from "./pages/ElementalWagerSetupPage";
import InfernoTowerView from "./pages/InfernoTowerView";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Pricing from "./pages/Pricing";
import AuthCallback from "./pages/AuthCallback";
import ForgotPassword from "./pages/ForgotPassword";
import ClassroomPage from "./pages/ClassroomPage";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";
import PaymentSuccess from "./pages/PaymentSuccess";
import Upgrade from "./pages/Upgrade";
import Flashcards from "./pages/Flashcards";
import NotFound from "./pages/NotFound";

function App() {
  useEffect(() => {
    const applySettings = () => {
      const raw = localStorage.getItem('blazes_settings');
      if (!raw) return;
      try {
        const s = JSON.parse(raw);
        const root = document.documentElement;
        // Font size
        root.classList.remove('text-sm', 'text-base', 'text-lg');
        if (s.font_size === 'small') root.classList.add('text-sm');
        else if (s.font_size === 'large') root.classList.add('text-lg');
        // Reduce motion
        if (s.reduce_motion) root.classList.add('reduce-motion');
        else root.classList.remove('reduce-motion');
        // Animations disabled
        if (!s.animations_enabled) root.classList.add('no-animations');
        else root.classList.remove('no-animations');
      } catch {}
    };
    applySettings();
    window.addEventListener('storage', applySettings);
    // Re-check periodically for same-tab updates
    const interval = setInterval(applySettings, 2000);
    return () => { window.removeEventListener('storage', applySettings); clearInterval(interval); };
  }, []);

  return (
    <BrowserRouter>
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
        <Route path="/game/survival-setup" element={<SurvivalSetupPage />} />
        <Route path="/game/elemental-clash-setup" element={<ElementalClashSetupPage />} />
        <Route path="/game/inferno-tower-setup" element={<InfernoTowerSetupPage />} />
        <Route path="/game/elemental-wager-setup" element={<ElementalWagerSetupPage />} />
        <Route path="/game/inferno-tower-view/:gameCode" element={<InfernoTowerView />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/classroom/:classroomId" element={<ClassroomPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
