import React, { useState, useEffect } from 'react';
import AchievementsMap from './AchievementsMap';
import SkinsPage, { AvatarPreview, cacheEquippedSkin, initialEquippedSkin } from './SkinsPage';
import CreateKit from '../components/CreateKit';
import NotificationDropdown from '../components/NotificationDropdown';
import Toast from '../components/Toast';
import { Flame, Trophy, TrendingUp, Zap, Target, Award, Clock, Users, Play, ChevronRight, BarChart3, Shirt, X, Home, GraduationCap, ClipboardList, Check, BookOpen, Plus, Trash2, Settings, Crown, Lock, Sparkles } from 'lucide-react';
import { useNavigate, useLocation, useSearchParams, useParams } from 'react-router-dom';
import { getGameModeName } from '../utils/gameModeName';

export default function StudentHome() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { tab: urlTab } = useParams();
  const [cancelNotice, setCancelNotice] = useState(location.state?.notice || '');
  // URL is the source of truth for which section is shown — each tab has its
  // own page like /home/student/kits, /home/student/stats. Falls back to the
  // legacy ?tab= query string for older links, then to 'dashboard'.
  const activeTab = urlTab || searchParams.get('tab') || 'dashboard';
  const setActiveTab = (next) => navigate('/home/student/' + next);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [gameCode, setGameCode] = useState('');
  const [user, setUser] = useState(null);
  const [activeGames, setActiveGames] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [blazesBucks, setBlazesBucks] = useState(0);
  const [equippedSkinId, setEquippedSkinId] = useState(initialEquippedSkin);
  const [myClassrooms, setMyClassrooms] = useState([]);
  const [myAssignments, setMyAssignments] = useState([]);
  const [gamesThisWeek, setGamesThisWeek] = useState(0);
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const [studentAnalytics, setStudentAnalytics] = useState(null);
  const [trendPeriod, setTrendPeriod] = useState('28d');
  const [myKits, setMyKits] = useState([]);
  const [deleteKitConfirm, setDeleteKitConfirm] = useState(null);
  const [editingKit, setEditingKit] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedKit, setSelectedKit] = useState(null);
  const [showQuestionsModal, setShowQuestionsModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [showQuestionEditModal, setShowQuestionEditModal] = useState(false);
  const [deleteQuestionConfirm, setDeleteQuestionConfirm] = useState(null);
  const [newCorrect, setNewCorrect] = useState('');
  const [newQuestionType, setNewQuestionType] = useState('multiple_choice');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newImagePreview, setNewImagePreview] = useState('');
  const [showKitAIModal, setShowKitAIModal] = useState(false);
  const [kitAINotes, setKitAINotes] = useState('');
  const [kitAICount, setKitAICount] = useState(5);
  const [kitAIDifficulty, setKitAIDifficulty] = useState('medium');
  const [kitAILoading, setKitAILoading] = useState(false);
  const [kitAIError, setKitAIError] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [stats, setStats] = useState({
    gamesWon: 0,
    dayStreak: 0,
    accuracyRate: 0,
    totalGames: 0,
    winRate: 0,
    avgScore: 0,
    questionsAnswered: 0,
    currentXP: 0,
    level: 1
  });
  const [seasonProgress, setSeasonProgress] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [upgradePrompt, setUpgradePrompt] = useState({ show: false, feature: '', desc: '', tier: '' });

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      navigate('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);

    // Load equipped skin
    const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
    fetch(`${base}/api/skins/${parsedUser.id}`)
      .then(r => r.json())
      .then(d => {
        if (d.equipped?.avatar_skin) {
          setEquippedSkinId(d.equipped.avatar_skin);
          cacheEquippedSkin(parsedUser.id, d.equipped.avatar_skin);
        }
      })
      .catch(() => {});

    if (parsedUser.role === 'teacher') {
      navigate('/home/teacher');
    }

    // Fetch stats from backend
    const fetchStats = async () => {
      try {
        const response = await fetch(`${base}/api/stats/${parsedUser.id}`);
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error('Error fetching stats:', error);
        const initialStats = {
          gamesWon: 0,
          dayStreak: 0,
          accuracyRate: 0,
          totalGames: 0,
          winRate: 0,
          avgScore: 0,
          questionsAnswered: 0,
          currentXP: 0,
          level: 1
        };
        setStats(initialStats);
      }
    };

    // Fetch active games
    const fetchActiveGames = async () => {
      try {
        const response = await fetch(`${base}/api/games/active/student/${parsedUser.id}`);
        const data = await response.json();
        setActiveGames(data || []);
      } catch (error) {
        console.error('Error fetching active games:', error);
        setActiveGames([]);
      }
    };

    // Fetch recent activity
    const fetchActivity = async () => {
      try {
        const response = await fetch(`${base}/api/activity/${parsedUser.id}/10`);
        const data = await response.json();
        setRecentActivity(data || []);
      } catch (error) {
        console.error('Error fetching activity:', error);
        setRecentActivity([]);
      }
    };

    fetchStats();
    fetchActiveGames();
    fetchActivity();

    // Fetch games this week
    const fetchGamesThisWeek = async () => {
      try {
        const response = await fetch(`${base}/api/stats/${parsedUser.id}/games-this-week`);
        const data = await response.json();
        setGamesThisWeek(data.games_this_week || 0);
      } catch (error) {
        console.error('Error fetching games this week:', error);
      }
    };
    fetchGamesThisWeek();

    // Fetch BlazesBucks balance
    const fetchBB = async () => {
      try {
        const res = await fetch(`${base}/api/blazesbucks/${parsedUser.id}`);
        const data = await res.json();
        setBlazesBucks(data.balance || 0);
      } catch (_) { }
    };
    fetchBB();
    // Fetch classrooms, assignments, and student's own kits
    fetch(`${base}/api/classrooms/student/${parsedUser.id}`).then(r => r.json()).then(setMyClassrooms).catch(() => {});
    fetch(`${base}/api/assignments/student/${parsedUser.id}?t=${Date.now()}`).then(r => r.json()).then(setMyAssignments).catch(() => {});
    fetch(`${base}/api/kits/teacher/${parsedUser.id}`).then(r => r.json()).then(setMyKits).catch(() => {});
    fetch(`${base}/api/season/progress/${parsedUser.id}`).then(r => r.json()).then(setSeasonProgress).catch(() => {});
    fetch(`${base}/api/subscription/${parsedUser.id}`).then(r => r.json()).then(d => { setSubscription(d); localStorage.setItem('blazes_tier', d.tier || 'free'); }).catch(() => {});
  }, [navigate]);

  // Refetch assignments when dashboard or classrooms tab is active to show updated status
  useEffect(() => {
    if (!user) return;
    const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
    // Immediate fetch on tab/location change
    fetch(`${base}/api/assignments/student/${user.id}?t=${Date.now()}`)
      .then(r => r.json())
      .then(setMyAssignments)
      .catch(() => {});
    // Poll every 5s so deletions/updates appear without refresh
    if (activeTab === 'dashboard' || activeTab === 'classrooms') {
      const interval = setInterval(() => {
        fetch(`${base}/api/assignments/student/${user.id}?t=${Date.now()}`)
          .then(r => r.json())
          .then(setMyAssignments)
          .catch(() => {});
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab, user, location]);

  // Fetch student analytics when stats tab is active
  useEffect(() => {
    if (activeTab !== 'stats' || !user) return;
    const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
    setStudentAnalytics(null);
    fetch(`${base}/api/analytics/student/${user.id}`)
      .then(r => r.json())
      .then(data => setStudentAnalytics(data))
      .catch(err => {
        console.error('Error fetching student analytics:', err);
        setStudentAnalytics({});
      });
  }, [activeTab, user]);

  useEffect(() => {
    if (!user) return;
    const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
    const interval = setInterval(() => {
      fetch(`${base}/api/season/progress/${user.id}`).then(r => r.json()).then(setSeasonProgress).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const [joinError, setJoinError] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);

  const handleJoinGame = async () => {
    if (gameCode.length !== 6) {
      setJoinError('Please enter a valid 6-digit code');
      return;
    }
    setJoinError('');
    setJoinLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
      const res = await fetch(`${baseUrl}/api/games/${gameCode.toUpperCase()}`);
      if (!res.ok) {
        setJoinError('Game not found. Check the code and try again.');
        setJoinLoading(false);
        return;
      }
      const data = await res.json();
      if (data.status === 'ended') {
        setJoinError('This game has already ended.');
        setJoinLoading(false);
        return;
      }
      navigate('/game/join', { state: { gameCode: gameCode.toUpperCase() } });
      setShowJoinModal(false);
      setGameCode('');
    } catch {
      setJoinError('Could not connect to server. Try again.');
    } finally {
      setJoinLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Flame className="w-16 h-16 text-orange-500 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const userName = user.name || 'Student';
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Game cancelled notice */}
      {cancelNotice && (
        <div className="bg-amber-50 border-b-2 border-amber-200 px-4 py-3 flex items-center justify-between">
          <p className="text-amber-800 font-semibold text-sm">⚠️ {cancelNotice}</p>
          <button onClick={() => setCancelNotice('')} className="text-amber-600 hover:text-amber-900 ml-4">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between py-2">
            {/* Left: Logo + Nav tabs */}
            <div className="flex items-center gap-2 sm:gap-4 md:gap-6">
              <div className="flex items-center gap-2 mr-2">
                <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                  <Flame className="w-5 h-5 text-white" strokeWidth={2.5} />
                </div>
                <span className="text-xl font-black text-gray-900 hidden sm:inline">Blazes</span>
              </div>

              {/* Main tabs */}
              <div className="flex items-center gap-1">
                {[
                  { id: 'dashboard', icon: Home, label: 'Home' },
                  { id: 'myKits', icon: BookOpen, label: 'Kits' },
                  { id: 'collection', icon: Award, label: 'Collection' },
                  { id: 'stats', icon: BarChart3, label: 'Stats' },
                ].map(t => {
                  const Icon = t.icon;
                  const isActive = t.id === 'collection'
                    ? ['skins', 'achievements'].includes(activeTab)
                    : t.id === 'myKits'
                    ? ['myKits', 'createKit'].includes(activeTab)
                    : activeTab === t.id;
                  return (
                    <button key={t.id}
                      onClick={() => setActiveTab(t.id === 'collection' ? 'skins' : t.id)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all ${isActive
                        ? 'bg-red-600 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="w-4 h-4" strokeWidth={2.5} />
                      <span className="hidden sm:inline">{t.label}</span>
                    </button>
                  );
                })}
                <button
                  onClick={() => setShowJoinModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-black text-white bg-red-600 hover:bg-red-700 shadow-sm transition-all"
                >
                  <Play className="w-4 h-4" strokeWidth={2.5} />
                  <span className="hidden sm:inline">Join Game</span>
                </button>
              </div>
            </div>

            {/* Right: Upgrade (free only), BB, Notifications, Profile */}
            <div className="flex items-center gap-2">
              {(!subscription?.tier || subscription.tier === 'free') && (
                <button onClick={() => navigate('/upgrade')}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-yellow-200 bg-yellow-50 hover:bg-yellow-100 transition-colors">
                  <Crown className="w-4 h-4 text-yellow-600" strokeWidth={2.5} />
                  <span className="text-sm font-bold text-yellow-700">Upgrade</span>
                </button>
              )}
              <NotificationDropdown userId={user?.id} />
              <div className="hidden sm:flex items-center gap-1 bg-yellow-50 border border-yellow-200 px-2.5 py-1 rounded-full">
                <img src="/blazes-coin.png" className="w-4 h-4" alt="BB" style={{ mixBlendMode: 'multiply' }} />
                <span className="font-black text-yellow-700 text-xs">{blazesBucks.toLocaleString()}</span>
              </div>
              {/* Profile with dropdown */}
              <div className="relative">
                <button onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-100 transition-colors">
                  <AvatarPreview skinId={equippedSkinId} initial={userInitial} size={32} isPlus={['blazes_plus'].includes(subscription?.tier)} userId={user?.id} />
                </button>
                {showProfileMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                    <div className="absolute right-0 top-11 w-48 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <div className="font-bold text-gray-900 text-sm">{userName}</div>
                        <div className="text-xs text-gray-500">Lv {seasonProgress?.level || 1} • Season {seasonProgress?.season_number || 1}</div>
                      </div>
                      <button onClick={() => { setShowProfileMenu(false); navigate('/settings'); }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                        <Settings className="w-4 h-4" /> Settings
                      </button>
                      <button onClick={() => { setShowProfileMenu(false); handleLogout(); }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors">
                        <X className="w-4 h-4" /> Log Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Toast notification */}
      <Toast show={toast.show} message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />


      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {activeTab === 'dashboard' && (() => {
          const hour = new Date().getHours();
          const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
          const allAssignments = myAssignments;
          return (
          <>
            {/* Big Home Heading */}
            <div className="mb-8">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900">Home</h1>
            </div>

            {/* ── ASSIGNMENTS ── */}
            <div className="mb-10">
              <h1 className="text-3xl font-black text-gray-900 mb-4">Assignments</h1>

              {allAssignments.length === 0 ? (
                <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-6 sm:p-8 md:p-12 text-center">
                  <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-semibold">No assignments yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allAssignments.map(a => {
                    const overdue = a.due_date && new Date(a.due_date) < new Date() && a.status !== 'completed';
                    const isDone = a.status === 'completed';
                    const reqs = a.requirements || {};
                    return (
                      <div key={a.id} className={`bg-white rounded-xl p-4 border flex items-center gap-4 ${isDone ? 'border-green-200' : overdue ? 'border-red-200' : 'border-gray-200'}`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isDone ? 'bg-green-100' : overdue ? 'bg-red-100' : 'bg-gray-100'}`}>
                          {isDone ? <Check className="w-5 h-5 text-green-600" strokeWidth={3} /> : <ClipboardList className={`w-5 h-5 ${overdue ? 'text-red-500' : 'text-gray-400'}`} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900 truncate">{a.title}</span>
                            {overdue && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">OVERDUE</span>}
                            {isDone && <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded font-bold">DONE</span>}
                            {a.status === 'in_progress' && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold">IN PROGRESS</span>}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {a.classroom_name}{a.due_date ? ` · Due ${new Date(a.due_date).toLocaleDateString()}` : ''}
                            {reqs.min_questions ? ` · ${a.questions_answered || 0}/${reqs.min_questions} questions` : ''}
                          </p>
                        </div>
                        {!isDone && (
                          <button
                            onClick={async () => {
                              const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
                              try {
                                const res = await fetch(`${base}/api/assignments/${a.id}/play`, {
                                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ studentId: user.id })
                                });
                                const data = await res.json();
                                if (!res.ok) throw new Error(data.error);
                                localStorage.setItem('activeAssignment', JSON.stringify({ assignmentId: a.id, gameCode: data.gameCode }));
                                navigate(`/game/play/${data.gameCode}`);
                              } catch (err) { setToast({ show: true, message: 'Failed to start: ' + err.message, type: 'error' }); }
                            }}
                            className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-all flex-shrink-0"
                          >
                            {a.status === 'in_progress' ? 'Continue' : 'Start'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── CLASSES ── */}
            <div>
              <h1 className="text-3xl font-black text-gray-900 mb-4">Classes</h1>
              {myClassrooms.length === 0 ? (
                <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-6 sm:p-8 md:p-12 text-center">
                  <GraduationCap className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-semibold">You're not part of any classes.</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {myClassrooms.map(c => (
                    <div key={c.id} onClick={() => navigate(`/classroom/${c.id}`)}
                      className="bg-white rounded-2xl border border-gray-200 hover:shadow-md transition-all cursor-pointer overflow-hidden">
                      {c.image_url ? (
                        <div className="h-24 bg-gray-100 overflow-hidden">
                          <img src={c.image_url} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="h-16 bg-blue-600" />
                      )}
                      <div className="p-4">
                        <h3 className="font-black text-gray-900 mb-0.5">{c.name}</h3>
                        <p className="text-sm text-gray-500">{c.teacher_name} · {c.student_count} students</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
          );
        })()}

        {activeTab === 'stats' && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900">Your Stats</h1>
              {subscription?.tier && ['blazes_plus', 'teacher_pro', 'school'].includes(subscription.tier) ? (
                <a href={`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000'}/api/export/stats/${user.id}`}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors">
                  Export Stats
                </a>
              ) : (
                <button onClick={() => setUpgradePrompt({ show: true, feature: 'Export Stats', desc: 'Download your full game history, accuracy, and scores as a CSV spreadsheet.', tier: 'Blazes Plus' })}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl text-sm font-bold text-blue-400 hover:from-blue-100 hover:to-indigo-100 transition-colors">
                  Export Stats <Lock className="w-3 h-3 opacity-60" />
                </button>
              )}
            </div>

            {/* Loading state */}
            {studentAnalytics === null ? (
              <div className="flex items-center justify-center py-24">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 text-blue-500 mx-auto mb-3 animate-pulse" />
                  <p className="text-gray-500 font-semibold">Loading analytics...</p>
                </div>
              </div>
            ) : (
              <>
                {/* 1. Top Stats Row - 5 compact cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 text-center">
                    <Play className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                    <div className="text-2xl font-black text-gray-900">{stats.totalGames}</div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Games</div>
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 text-center">
                    <Target className="w-5 h-5 text-green-500 mx-auto mb-1" />
                    <div className="text-2xl font-black text-gray-900">{studentAnalytics.totalAnswers > 0 ? Math.round(studentAnalytics.totalCorrectAnswers * 1000 / studentAnalytics.totalAnswers) / 10 : 0}%</div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Accuracy</div>
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 text-center">
                    <ClipboardList className="w-5 h-5 text-purple-500 mx-auto mb-1" />
                    <div className="text-2xl font-black text-gray-900">{(studentAnalytics.totalAnswers || 0).toLocaleString()}</div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Questions</div>
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 text-center">
                    <Flame className="w-5 h-5 text-orange-500 mx-auto mb-1" />
                    <div className="text-2xl font-black text-gray-900">{studentAnalytics.longestStreak || 0}</div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Best Streak</div>
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 text-center">
                    <Clock className="w-5 h-5 text-indigo-500 mx-auto mb-1" />
                    <div className="text-2xl font-black text-gray-900">
                      {studentAnalytics.speedStats?.avg_time_per_question
                        ? `${Number(studentAnalytics.speedStats.avg_time_per_question).toFixed(1)}s`
                        : '--'}
                    </div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Avg Speed</div>
                  </div>
                </div>

                {/* 2. Accuracy Trend - time-period based */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-black text-gray-900">Accuracy Trend</h3>
                    <div className="flex bg-gray-100 rounded-lg p-0.5">
                      {[{ key: '7d', label: '7D' }, { key: '28d', label: '28D' }, { key: '1y', label: '1Y' }, { key: 'all', label: 'All' }].map(p => (
                        <button key={p.key} onClick={() => setTrendPeriod(p.key)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${trendPeriod === p.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {(() => {
                    const raw = studentAnalytics.accuracyByDate || [];
                    const now = new Date();
                    const todayStr = now.toISOString().split('T')[0];

                    // Determine range start and bucket config
                    let startDate, bucketCount, labelFn;
                    if (trendPeriod === '7d') {
                      startDate = new Date(now - 7 * 86400000);
                      bucketCount = 7;
                      labelFn = (d) => d.toLocaleDateString('en-US', { weekday: 'short' });
                    } else if (trendPeriod === '28d') {
                      startDate = new Date(now - 28 * 86400000);
                      bucketCount = 14;
                      labelFn = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    } else if (trendPeriod === '1y') {
                      startDate = new Date(now - 365 * 86400000);
                      bucketCount = 12;
                      labelFn = (d) => d.toLocaleDateString('en-US', { month: 'short' });
                    } else {
                      // All time: from first data point (or 30 days ago if no data) to now
                      startDate = raw.length > 0 ? new Date(raw[0].date + 'T00:00:00') : new Date(now - 30 * 86400000);
                      const span = Math.max(1, Math.ceil((now - startDate) / 86400000));
                      bucketCount = Math.min(Math.max(span, 2), 20);
                      labelFn = (d) => span > 180
                        ? d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
                        : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    }

                    const totalDays = Math.max(1, Math.ceil((now - startDate) / 86400000));
                    const bucketSize = Math.max(1, totalDays / bucketCount);

                    // Build a lookup map for raw data
                    const rawMap = {};
                    raw.forEach(d => { rawMap[d.date] = d; });

                    // Build buckets — always include all, even empty ones
                    const buckets = [];
                    for (let i = 0; i < bucketCount; i++) {
                      const bStart = new Date(startDate.getTime() + i * bucketSize * 86400000);
                      const bEnd = new Date(startDate.getTime() + (i + 1) * bucketSize * 86400000);
                      const bStartStr = bStart.toISOString().split('T')[0];
                      const bEndStr = bEnd.toISOString().split('T')[0];
                      // Sum all raw days that fall in this bucket
                      let total = 0, correct = 0;
                      raw.forEach(d => { if (d.date >= bStartStr && d.date < bEndStr) { total += d.total; correct += d.correct; } });
                      buckets.push({
                        label: labelFn(bStart),
                        accuracy: total > 0 ? Math.round(correct * 1000 / total) / 10 : null,
                        total, correct,
                        hasData: total > 0
                      });
                    }

                    // Points with data for drawing the line (skip empty buckets)
                    const svgW = 700, svgH = 200, padL = 40, padR = 20, padT = 15, padB = 35;
                    const chartW = svgW - padL - padR, chartH = svgH - padT - padB;

                    const allPoints = buckets.map((b, i) => ({
                      x: padL + (bucketCount > 1 ? (i / (bucketCount - 1)) * chartW : chartW / 2),
                      idx: i,
                      ...b
                    }));
                    const dataPoints = allPoints.filter(p => p.hasData);

                    // Build line/area only through data points
                    let linePath = '', areaPath = '';
                    if (dataPoints.length > 0) {
                      const pts = dataPoints.map(p => ({
                        ...p,
                        y: padT + chartH - (p.accuracy / 100) * chartH
                      }));
                      linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
                      areaPath = linePath + ` L${pts[pts.length - 1].x},${padT + chartH} L${pts[0].x},${padT + chartH} Z`;
                    }

                    const labelEvery = Math.max(1, Math.ceil(bucketCount / 8));

                    return (
                      <div className="overflow-x-auto">
                        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full" style={{ minWidth: 400 }}>
                          {/* Grid lines */}
                          {[0, 25, 50, 75, 100].map(v => {
                            const y = padT + chartH - (v / 100) * chartH;
                            return (
                              <g key={v}>
                                <line x1={padL} y1={y} x2={svgW - padR} y2={y} stroke="#e5e7eb" strokeWidth="1" />
                                <text x={padL - 6} y={y + 4} textAnchor="end" fill="#9ca3af" fontSize="10" fontWeight="600">{v}%</text>
                              </g>
                            );
                          })}
                          {/* Area + line (only through data points) */}
                          {dataPoints.length > 0 && (
                            <>
                              <path d={areaPath} fill="#dbeafe" />
                              <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                            </>
                          )}
                          {/* All bucket positions: labels + dots */}
                          {allPoints.map((p, i) => (
                            <g key={i}>
                              {/* X-axis label */}
                              {i % labelEvery === 0 && (
                                <text x={p.x} y={padT + chartH + 16} textAnchor="middle" fill="#6b7280" fontSize="9" fontWeight="600">
                                  {p.label}
                                </text>
                              )}
                              {/* Dot only if has data */}
                              {p.hasData && (
                                <circle cx={p.x} cy={padT + chartH - (p.accuracy / 100) * chartH} r="4" fill="#3b82f6" stroke="#fff" strokeWidth="2">
                                  <title>{`${p.label}: ${p.accuracy}% (${p.correct}/${p.total})`}</title>
                                </circle>
                              )}
                              {/* Empty marker */}
                              {!p.hasData && (
                                <circle cx={p.x} cy={padT + chartH} r="2" fill="#d1d5db" />
                              )}
                            </g>
                          ))}
                          {/* No data message */}
                          {dataPoints.length === 0 && (
                            <text x={svgW / 2} y={svgH / 2} textAnchor="middle" fill="#9ca3af" fontSize="13" fontWeight="600">No activity in this period</text>
                          )}
                        </svg>
                      </div>
                    );
                  })()}
                </div>

                {/* 3. Two columns: Subject Performance + Speed & Precision */}
                <div className="grid lg:grid-cols-2 gap-6 mb-8">
                  {/* Subject Performance (grouped by category) */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                    <h3 className="text-lg font-black text-gray-900 mb-4">Subject Performance</h3>
                    {studentAnalytics.subjectPerformance && studentAnalytics.subjectPerformance.length > 0 ? (
                      <div className="space-y-4">
                        {(() => {
                          // Group subjects by category
                          const cats = {};
                          studentAnalytics.subjectPerformance.forEach(s => {
                            const cat = s.category || 'Other';
                            if (!cats[cat]) cats[cat] = [];
                            cats[cat].push(s);
                          });
                          return Object.entries(cats).map(([cat, subjects]) => {
                            const catTotal = subjects.reduce((s, x) => s + (x.total_questions || 0), 0);
                            const catCorrect = subjects.reduce((s, x) => s + Math.round((Number(x.accuracy) || 0) * (x.total_questions || 0) / 100), 0);
                            const catAcc = catTotal > 0 ? Math.round((catCorrect / catTotal) * 100) : 0;
                            return (
                              <div key={cat}>
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-xs font-black text-gray-900 uppercase tracking-wide">{cat}</span>
                                  <span className={`text-xs font-black ${catAcc >= 75 ? 'text-green-600' : catAcc >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{catAcc}%</span>
                                </div>
                                <div className="space-y-1.5 ml-2">
                                  {subjects.map((s, i) => {
                                    const acc = Number(s.accuracy) || 0;
                                    const barColor = acc < 50 ? 'bg-red-500' : acc < 75 ? 'bg-yellow-500' : 'bg-green-500';
                                    return (
                                      <div key={i} className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-gray-600 w-24 truncate">{s.subject}</span>
                                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(acc, 100)}%` }} />
                                        </div>
                                        <span className="text-xs font-black text-gray-700 w-10 text-right">{acc.toFixed(0)}%</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-10 text-gray-400">
                        <GraduationCap className="w-5 h-5 mr-2" />
                        <span className="font-semibold">Play more games to see subject breakdown</span>
                      </div>
                    )}
                  </div>

                  {/* Speed & Precision */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                    <h3 className="text-lg font-black text-gray-900 mb-4">Speed & Precision</h3>
                    <div className="space-y-5">
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Avg Time per Question</div>
                        <div className="text-3xl font-black text-gray-900">
                          {studentAnalytics.speedStats?.avg_time_per_question
                            ? `${Number(studentAnalytics.speedStats.avg_time_per_question).toFixed(1)}s`
                            : '--'}
                        </div>
                      </div>
                      <div className="border-t border-gray-100 pt-4">
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Fastest Answer</div>
                        <div className="text-2xl font-black text-blue-600">
                          {studentAnalytics.speedStats?.fastest_answer
                            ? `${Number(studentAnalytics.speedStats.fastest_answer).toFixed(2)}s`
                            : '--'}
                        </div>
                      </div>
                      <div className="border-t border-gray-100 pt-4">
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Best Subject</div>
                        <div className="text-xl font-black text-gray-900">
                          {studentAnalytics.bestSubject || 'N/A'}
                        </div>
                      </div>
                      <div className="border-t border-gray-100 pt-4">
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Overall Accuracy</div>
                        <div className="text-xl font-black text-gray-900">
                          <span className="text-green-600">{studentAnalytics.totalCorrectAnswers || 0}</span>
                          <span className="text-gray-400 font-bold mx-1">/</span>
                          <span>{studentAnalytics.totalAnswers || 0}</span>
                          <span className="text-sm font-bold text-gray-500 ml-2">
                            ({studentAnalytics.totalAnswers > 0
                              ? ((studentAnalytics.totalCorrectAnswers / studentAnalytics.totalAnswers) * 100).toFixed(1)
                              : '0'}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. 30-Day Activity bar chart */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-8">
                  <h3 className="text-lg font-black text-gray-900 mb-4">30-Day Activity</h3>
                  {studentAnalytics.dailyActivity && studentAnalytics.dailyActivity.length > 0 ? (
                    (() => {
                      const days = studentAnalytics.dailyActivity;
                      const maxQ = Math.max(...days.map(d => d.questions_answered || 0), 1);
                      return (
                        <div className="overflow-x-auto">
                          <div className="flex items-end gap-[3px]" style={{ minWidth: 500, height: 140 }}>
                            {days.map((d, i) => {
                              const q = d.questions_answered || 0;
                              const h = q > 0 ? Math.max((q / maxQ) * 120, 4) : 2;
                              const hasCorrect = (d.correct_answers || 0) > 0;
                              const barColor = q > 0 ? (hasCorrect ? 'bg-green-500' : 'bg-gray-300') : 'bg-gray-200';
                              const dateLabel = new Date(d.date).getDate();
                              const showLabel = i % 5 === 0 || i === days.length - 1;
                              return (
                                <div key={i} className="flex flex-col items-center flex-1" style={{ minWidth: 12 }}>
                                  <div
                                    className={`w-full rounded-t ${barColor}`}
                                    style={{ height: h }}
                                    title={`${d.date}: ${q} questions, ${d.correct_answers || 0} correct`}
                                  />
                                  {showLabel && (
                                    <div className="text-[9px] font-semibold text-gray-400 mt-1">{dateLabel}</div>
                                  )}
                                  {!showLabel && <div className="mt-1" style={{ height: 12 }} />}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="flex items-center justify-center py-10 text-gray-400">
                      <BarChart3 className="w-5 h-5 mr-2" />
                      <span className="font-semibold">No activity data yet</span>
                    </div>
                  )}
                </div>

                {/* 5. Recent Games table */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-8">
                  <h3 className="text-lg font-black text-gray-900 mb-4">Recent Games</h3>
                  {studentAnalytics.recentGames && studentAnalytics.recentGames.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-2 px-3 font-bold text-gray-500 uppercase text-xs tracking-wide">Kit</th>
                            <th className="text-right py-2 px-3 font-bold text-gray-500 uppercase text-xs tracking-wide">Score</th>
                            <th className="text-right py-2 px-3 font-bold text-gray-500 uppercase text-xs tracking-wide">Accuracy</th>
                            <th className="text-right py-2 px-3 font-bold text-gray-500 uppercase text-xs tracking-wide">Questions</th>
                            <th className="text-right py-2 px-3 font-bold text-gray-500 uppercase text-xs tracking-wide">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {studentAnalytics.recentGames.slice(0, 5).map((g, i) => {
                            const acc = Number(g.accuracy) || 0;
                            const badgeColor = acc >= 80 ? 'bg-green-100 text-green-700' : acc >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
                            return (
                              <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                                <td className="py-2.5 px-3 font-semibold text-gray-800 max-w-[200px] truncate">{g.kit_title || 'Unknown Kit'}</td>
                                <td className="py-2.5 px-3 text-right font-bold text-gray-900">{(g.score || 0).toLocaleString()}</td>
                                <td className="py-2.5 px-3 text-right">
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${badgeColor}`}>
                                    {acc.toFixed(0)}%
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right font-semibold text-gray-600">{g.questions_answered || 0}</td>
                                <td className="py-2.5 px-3 text-right text-gray-500 font-medium whitespace-nowrap">
                                  {g.date ? new Date(g.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '--'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-10 text-gray-400">
                      <Play className="w-5 h-5 mr-2" />
                      <span className="font-semibold">No games played yet</span>
                    </div>
                  )}
                </div>

                {/* ═══ ADVANCED ANALYTICS (Blazes Plus only) ═══ */}
                {['blazes_plus', 'teacher_pro', 'school'].includes(subscription?.tier) ? (
                  <>
                    {/* 6. Improvement Tracker */}
                    {studentAnalytics.improvement && (
                      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-8">
                        <div className="flex items-center gap-2 mb-4">
                          <Sparkles className="w-5 h-5 text-red-500" />
                          <h3 className="text-lg font-black text-gray-900">Weekly Improvement</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                          <div className="bg-gray-50 rounded-xl p-4 text-center">
                            <div className="text-xs font-semibold text-gray-500 mb-1">This Week</div>
                            <div className="text-2xl font-black text-gray-900">{studentAnalytics.improvement.recent7Accuracy ?? '--'}%</div>
                            <div className="text-xs text-gray-400">{studentAnalytics.improvement.recent7Questions} questions</div>
                          </div>
                          <div className="bg-gray-50 rounded-xl p-4 text-center">
                            <div className="text-xs font-semibold text-gray-500 mb-1">Last Week</div>
                            <div className="text-2xl font-black text-gray-900">{studentAnalytics.improvement.prev7Accuracy ?? '--'}%</div>
                            <div className="text-xs text-gray-400">{studentAnalytics.improvement.prev7Questions} questions</div>
                          </div>
                          <div className="bg-gray-50 rounded-xl p-4 text-center">
                            <div className="text-xs font-semibold text-gray-500 mb-1">Change</div>
                            <div className={`text-2xl font-black ${studentAnalytics.improvement.trend > 0 ? 'text-green-600' : studentAnalytics.improvement.trend < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                              {studentAnalytics.improvement.trend !== null ? `${studentAnalytics.improvement.trend > 0 ? '+' : ''}${studentAnalytics.improvement.trend}%` : '--'}
                            </div>
                            <div className="text-xs text-gray-400">
                              {studentAnalytics.improvement.trend > 0 ? 'Improving' : studentAnalytics.improvement.trend < 0 ? 'Declining' : 'No change'}
                            </div>
                          </div>
                        </div>
                        {studentAnalytics.improvement.recent7AvgTime && studentAnalytics.improvement.prev7AvgTime && (
                          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-sm">
                            <span className="text-gray-500 font-semibold">Speed change:</span>
                            <span className={`font-black ${studentAnalytics.improvement.recent7AvgTime < studentAnalytics.improvement.prev7AvgTime ? 'text-green-600' : 'text-red-600'}`}>
                              {studentAnalytics.improvement.recent7AvgTime}s → {studentAnalytics.improvement.prev7AvgTime}s
                              {studentAnalytics.improvement.recent7AvgTime < studentAnalytics.improvement.prev7AvgTime ? ' (faster)' : ' (slower)'}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 7. Question Type Breakdown */}
                    {studentAnalytics.questionTypeBreakdown && studentAnalytics.questionTypeBreakdown.length > 0 && (
                      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-8">
                        <div className="flex items-center gap-2 mb-4">
                          <Sparkles className="w-5 h-5 text-red-500" />
                          <h3 className="text-lg font-black text-gray-900">Question Type Breakdown</h3>
                        </div>
                        <div className="space-y-3">
                          {studentAnalytics.questionTypeBreakdown.map((t, i) => {
                            const labels = { multiple_choice: 'Multiple Choice', true_false: 'True/False', short_answer: 'Short Answer', multi_select: 'Multi-Select', matching: 'Matching', ordering: 'Ordering', image_label: 'Image Label', audio: 'Audio', fill_blank: 'Fill in Blank', math_equation: 'Math' };
                            const acc = t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0;
                            const barColor = acc >= 80 ? 'bg-green-500' : acc >= 50 ? 'bg-yellow-500' : 'bg-red-500';
                            return (
                              <div key={i} className="flex items-center gap-3">
                                <div className="w-28 text-xs font-bold text-gray-700 truncate">{labels[t.answer_type] || t.answer_type}</div>
                                <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${acc}%` }} />
                                </div>
                                <div className="w-10 text-xs font-black text-gray-700 text-right">{acc}%</div>
                                <div className="w-16 text-[10px] text-gray-400 text-right">{t.correct}/{t.total}</div>
                                <div className="w-12 text-[10px] text-gray-400 text-right">{t.avg_time ? `${Number(t.avg_time).toFixed(1)}s` : ''}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 8. Weakest Questions */}
                    {studentAnalytics.weakestQuestions && studentAnalytics.weakestQuestions.length > 0 && (
                      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-8">
                        <div className="flex items-center gap-2 mb-4">
                          <Sparkles className="w-5 h-5 text-red-500" />
                          <h3 className="text-lg font-black text-gray-900">Questions to Review</h3>
                          <span className="text-xs text-gray-400 font-semibold ml-auto">Sorted by weakest first</span>
                        </div>
                        <div className="space-y-2">
                          {studentAnalytics.weakestQuestions.map((q, i) => {
                            const acc = q.times_seen > 0 ? Math.round((q.times_correct / q.times_seen) * 100) : 0;
                            return (
                              <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-black ${acc >= 80 ? 'bg-green-100 text-green-700' : acc >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                  {acc}%
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-bold text-gray-800 truncate">{q.question_text}</div>
                                  <div className="text-[10px] text-gray-400">{q.kit_name || 'Unknown Kit'} · {q.times_correct}/{q.times_seen} correct · {q.avg_time ? `${Number(q.avg_time).toFixed(1)}s avg` : ''}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 9. Game Mode + Perfect Games + Hourly Activity */}
                    <div className="grid lg:grid-cols-2 gap-6 mb-8">
                      {/* Game mode breakdown */}
                      {studentAnalytics.modeBreakdown && studentAnalytics.modeBreakdown.length > 0 && (
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                          <div className="flex items-center gap-2 mb-4">
                            <Sparkles className="w-5 h-5 text-red-500" />
                            <h3 className="text-lg font-black text-gray-900">Game Modes</h3>
                          </div>
                          <div className="space-y-3">
                            {studentAnalytics.modeBreakdown.map((m, i) => {
                              const acc = m.questions > 0 ? Math.round((m.correct / m.questions) * 100) : 0;
                              return (
                                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                  <div>
                                    <div className="text-sm font-bold text-gray-800">{getGameModeName(m.game_mode)}</div>
                                    <div className="text-[10px] text-gray-400">{m.games} games · {m.questions} questions</div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-sm font-black text-gray-900">{acc}%</div>
                                    <div className="text-[10px] text-gray-400">{m.avg_time ? `${Number(m.avg_time).toFixed(1)}s avg` : ''}</div>
                                  </div>
                                </div>
                              );
                            })}
                            <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl border border-green-200">
                              <div className="text-sm font-bold text-green-800">Perfect Games (100%)</div>
                              <div className="text-lg font-black text-green-700">{studentAnalytics.perfectGames || 0}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Hourly activity heatmap */}
                      {studentAnalytics.hourlyPattern && studentAnalytics.hourlyPattern.length > 0 && (
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                          <div className="flex items-center gap-2 mb-4">
                            <Sparkles className="w-5 h-5 text-red-500" />
                            <h3 className="text-lg font-black text-gray-900">When You Play</h3>
                          </div>
                          <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                            {Array.from({ length: 24 }, (_, h) => {
                              const data = studentAnalytics.hourlyPattern.find(p => p.hour === h);
                              const q = data?.questions || 0;
                              const maxQ = Math.max(...studentAnalytics.hourlyPattern.map(p => p.questions), 1);
                              const intensity = q > 0 ? Math.max(0.15, q / maxQ) : 0;
                              const acc = data && data.questions > 0 ? Math.round((data.correct / data.questions) * 100) : 0;
                              return (
                                <div key={h} className="relative group">
                                  <div className="aspect-square rounded-lg flex items-center justify-center text-[9px] font-bold"
                                    style={{ background: q > 0 ? `rgba(239, 68, 68, ${intensity})` : '#f3f4f6', color: intensity > 0.5 ? 'white' : '#6b7280' }}
                                    title={`${h}:00 — ${q} questions, ${acc}% accuracy`}>
                                    {h}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex items-center justify-between mt-3 text-[10px] text-gray-400">
                            <span>Less active</span>
                            <div className="flex gap-1">
                              {[0.1, 0.3, 0.5, 0.7, 1].map((v, i) => (
                                <div key={i} className="w-3 h-3 rounded" style={{ background: `rgba(239, 68, 68, ${v})` }} />
                              ))}
                            </div>
                            <span>More active</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 10. Personal Records */}
                    {studentAnalytics.personalRecords && (
                      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-8">
                        <div className="flex items-center gap-2 mb-4">
                          <Sparkles className="w-5 h-5 text-red-500" />
                          <h3 className="text-lg font-black text-gray-900">Personal Records</h3>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-4 text-center border border-yellow-200">
                            <Trophy className="w-5 h-5 text-yellow-600 mx-auto mb-1" />
                            <div className="text-2xl font-black text-gray-900">{(studentAnalytics.personalRecords.highScore || 0).toLocaleString()}</div>
                            <div className="text-[10px] font-semibold text-gray-500">Highest Score</div>
                            {studentAnalytics.personalRecords.highScoreKit && <div className="text-[9px] text-gray-400 truncate mt-0.5">{studentAnalytics.personalRecords.highScoreKit}</div>}
                          </div>
                          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 text-center border border-blue-200">
                            <Flame className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                            <div className="text-2xl font-black text-gray-900">{studentAnalytics.longestStreak || 0}</div>
                            <div className="text-[10px] font-semibold text-gray-500">Longest Streak</div>
                          </div>
                          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 text-center border border-green-200">
                            <Target className="w-5 h-5 text-green-600 mx-auto mb-1" />
                            <div className="text-2xl font-black text-gray-900">{studentAnalytics.perfectGames || 0}</div>
                            <div className="text-[10px] font-semibold text-gray-500">Perfect Games</div>
                          </div>
                          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 text-center border border-purple-200">
                            <Clock className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                            <div className="text-2xl font-black text-gray-900">{studentAnalytics.personalRecords.fastestAvgTime ? `${studentAnalytics.personalRecords.fastestAvgTime}s` : '--'}</div>
                            <div className="text-[10px] font-semibold text-gray-500">Fastest Game Avg</div>
                            {studentAnalytics.personalRecords.fastestKit && <div className="text-[9px] text-gray-400 truncate mt-0.5">{studentAnalytics.personalRecords.fastestKit}</div>}
                          </div>
                        </div>
                        {/* Multiplayer record */}
                        {studentAnalytics.multiplayerStats && studentAnalytics.multiplayerStats.games > 0 && (
                          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                            <div className="text-sm font-bold text-gray-700">Multiplayer Record</div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-black text-green-600">{studentAnalytics.multiplayerStats.wins}W</span>
                              <span className="text-gray-300">-</span>
                              <span className="text-sm font-black text-red-600">{studentAnalytics.multiplayerStats.games - studentAnalytics.multiplayerStats.wins}L</span>
                              <span className="text-xs font-bold text-gray-400">({studentAnalytics.multiplayerStats.games > 0 ? Math.round((studentAnalytics.multiplayerStats.wins / studentAnalytics.multiplayerStats.games) * 100) : 0}% WR)</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 11. Monthly Comparison */}
                    {studentAnalytics.monthlyComparison && (
                      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-8">
                        <div className="flex items-center gap-2 mb-4">
                          <Sparkles className="w-5 h-5 text-red-500" />
                          <h3 className="text-lg font-black text-gray-900">This Month vs Last Month</h3>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          {[
                            { label: 'Games', thisVal: studentAnalytics.monthlyComparison.thisMonth.games, lastVal: studentAnalytics.monthlyComparison.lastMonth.games },
                            { label: 'Questions', thisVal: studentAnalytics.monthlyComparison.thisMonth.questions, lastVal: studentAnalytics.monthlyComparison.lastMonth.questions },
                            { label: 'Accuracy', thisVal: studentAnalytics.monthlyComparison.thisMonth.accuracy, lastVal: studentAnalytics.monthlyComparison.lastMonth.accuracy, suffix: '%' },
                            { label: 'Avg Speed', thisVal: studentAnalytics.monthlyComparison.thisMonth.avgTime, lastVal: studentAnalytics.monthlyComparison.lastMonth.avgTime, suffix: 's', lower: true },
                          ].map((m, i) => {
                            const diff = m.thisVal != null && m.lastVal != null ? m.thisVal - m.lastVal : null;
                            const better = m.lower ? diff < 0 : diff > 0;
                            return (
                              <div key={i} className="bg-gray-50 rounded-xl p-3 text-center">
                                <div className="text-[10px] font-semibold text-gray-500 mb-1">{m.label}</div>
                                <div className="text-lg font-black text-gray-900">{m.thisVal ?? '--'}{m.suffix || ''}</div>
                                {diff !== null && diff !== 0 && (
                                  <div className={`text-xs font-bold ${better ? 'text-green-600' : 'text-red-500'}`}>
                                    {m.lower ? (diff < 0 ? `${Math.abs(diff).toFixed(1)} faster` : `${diff.toFixed(1)} slower`) : (diff > 0 ? `+${diff}${m.suffix || ''}` : `${diff}${m.suffix || ''}`)}
                                  </div>
                                )}
                                <div className="text-[9px] text-gray-400">Last: {m.lastVal ?? '--'}{m.suffix || ''}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 12. Strongest Questions */}
                    {studentAnalytics.strongestQuestions && studentAnalytics.strongestQuestions.length > 0 && (
                      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-8">
                        <div className="flex items-center gap-2 mb-4">
                          <Sparkles className="w-5 h-5 text-red-500" />
                          <h3 className="text-lg font-black text-gray-900">Mastered Questions</h3>
                          <span className="text-xs text-gray-400 font-semibold ml-auto">Your strongest</span>
                        </div>
                        <div className="space-y-2">
                          {studentAnalytics.strongestQuestions.slice(0, 5).map((q, i) => {
                            const acc = q.times_seen > 0 ? Math.round((q.times_correct / q.times_seen) * 100) : 0;
                            return (
                              <div key={i} className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-100">
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-black bg-green-100 text-green-700">{acc}%</div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-bold text-gray-800 truncate">{q.question_text}</div>
                                  <div className="text-[10px] text-gray-400">{q.kit_name || ''} · {q.times_correct}/{q.times_seen} correct · {q.avg_time ? `${Number(q.avg_time).toFixed(1)}s` : ''}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 13. Response Time + Learning from Mistakes + Time of Day */}
                    <div className="grid lg:grid-cols-2 gap-6 mb-8">
                      {/* Response time distribution */}
                      {studentAnalytics.timeDistribution && studentAnalytics.timeDistribution.length > 0 && (
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                          <div className="flex items-center gap-2 mb-4">
                            <Sparkles className="w-5 h-5 text-red-500" />
                            <h3 className="text-lg font-black text-gray-900">Response Time</h3>
                          </div>
                          <div className="space-y-2">
                            {(() => {
                              const maxT = Math.max(...studentAnalytics.timeDistribution.map(t => t.total), 1);
                              return studentAnalytics.timeDistribution.map((t, i) => {
                                const acc = t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0;
                                return (
                                  <div key={i} className="flex items-center gap-3">
                                    <div className="w-12 text-xs font-bold text-gray-600 text-right">{t.bucket}</div>
                                    <div className="flex-1 h-6 bg-gray-100 rounded-lg overflow-hidden relative">
                                      <div className="h-full bg-blue-500 rounded-lg" style={{ width: `${(t.total / maxT) * 100}%` }} />
                                      <span className="absolute inset-0 flex items-center px-2 text-[10px] font-bold text-gray-700">{t.total} answers · {acc}% correct</span>
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      )}

                      {/* Time of day performance */}
                      {studentAnalytics.timeOfDayPerf && studentAnalytics.timeOfDayPerf.length > 0 && (
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                          <div className="flex items-center gap-2 mb-4">
                            <Sparkles className="w-5 h-5 text-red-500" />
                            <h3 className="text-lg font-black text-gray-900">Best Time to Study</h3>
                          </div>
                          <div className="space-y-3">
                            {studentAnalytics.timeOfDayPerf.map((t, i) => {
                              const acc = t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0;
                              const icons = { Morning: '☀️', Afternoon: '🌤️', Evening: '🌙', Night: '🌑' };
                              const best = studentAnalytics.timeOfDayPerf.reduce((b, c) => (c.total > 0 && (c.correct / c.total) > (b.correct / (b.total || 1))) ? c : b, t);
                              return (
                                <div key={i} className={`flex items-center justify-between p-3 rounded-xl ${t.period === best.period ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">{icons[t.period] || '⏰'}</span>
                                    <div>
                                      <div className="text-sm font-bold text-gray-800">{t.period}</div>
                                      <div className="text-[10px] text-gray-400">{t.total} questions · {t.avg_time ? `${Number(t.avg_time).toFixed(1)}s avg` : ''}</div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className={`text-sm font-black ${acc >= 80 ? 'text-green-600' : acc >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{acc}%</div>
                                    {t.period === best.period && <div className="text-[9px] font-bold text-green-600">Your best</div>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 14. Learning from Mistakes + Speed Trend */}
                    <div className="grid lg:grid-cols-2 gap-6 mb-8">
                      {/* Retry improvement */}
                      {studentAnalytics.retryImprovement && (studentAnalytics.retryImprovement.firstAttemptAcc !== null || studentAnalytics.retryImprovement.retryAcc !== null) && (
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                          <div className="flex items-center gap-2 mb-4">
                            <Sparkles className="w-5 h-5 text-red-500" />
                            <h3 className="text-lg font-black text-gray-900">Learning from Mistakes</h3>
                          </div>
                          <div className="flex items-center gap-4 sm:gap-6 justify-center py-4">
                            <div className="text-center">
                              <div className="text-3xl font-black text-gray-900">{studentAnalytics.retryImprovement.firstAttemptAcc ?? '--'}%</div>
                              <div className="text-xs font-semibold text-gray-500">1st Attempt</div>
                            </div>
                            <div className="text-2xl text-gray-300">→</div>
                            <div className="text-center">
                              <div className={`text-3xl font-black ${(studentAnalytics.retryImprovement.retryAcc || 0) > (studentAnalytics.retryImprovement.firstAttemptAcc || 0) ? 'text-green-600' : 'text-gray-900'}`}>
                                {studentAnalytics.retryImprovement.retryAcc ?? '--'}%
                              </div>
                              <div className="text-xs font-semibold text-gray-500">Retry</div>
                            </div>
                          </div>
                          <div className="text-center text-xs text-gray-400 font-semibold">
                            {(studentAnalytics.retryImprovement.retryAcc || 0) > (studentAnalytics.retryImprovement.firstAttemptAcc || 0)
                              ? 'You improve when you see a question again!'
                              : 'Keep reviewing — practice makes perfect'}
                          </div>
                        </div>
                      )}

                      {/* Speed trend */}
                      {studentAnalytics.speedTrend && studentAnalytics.speedTrend.length > 1 && (
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                          <div className="flex items-center gap-2 mb-4">
                            <Sparkles className="w-5 h-5 text-red-500" />
                            <h3 className="text-lg font-black text-gray-900">Speed Over Time</h3>
                          </div>
                          <div className="space-y-1.5">
                            {(() => {
                              const maxTime = Math.max(...studentAnalytics.speedTrend.map(s => s.avg_time || 0), 1);
                              return studentAnalytics.speedTrend.map((s, i) => {
                                const t = s.avg_time ? Number(Number(s.avg_time).toFixed(1)) : 0;
                                return (
                                  <div key={i} className="flex items-center gap-2">
                                    <div className="w-16 text-[10px] font-bold text-gray-500 text-right">{s.week}</div>
                                    <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(t / maxTime) * 100}%` }} />
                                    </div>
                                    <div className="w-10 text-xs font-black text-gray-700">{t}s</div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 15. 90-Day Activity Grid (GitHub-style) */}
                    {studentAnalytics.activityGrid && (
                      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-8">
                        <div className="flex items-center gap-2 mb-4">
                          <Sparkles className="w-5 h-5 text-red-500" />
                          <h3 className="text-lg font-black text-gray-900">90-Day Activity</h3>
                        </div>
                        <div className="overflow-x-auto">
                          <div className="flex gap-[3px]" style={{ minWidth: 600 }}>
                            {(() => {
                              const gridMap = {};
                              (studentAnalytics.activityGrid || []).forEach(d => { gridMap[d.day] = d; });
                              const maxQ = Math.max(...(studentAnalytics.activityGrid || []).map(d => d.questions), 1);
                              const days = [];
                              for (let i = 89; i >= 0; i--) {
                                const dateStr = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
                                const data = gridMap[dateStr];
                                const q = data?.questions || 0;
                                const intensity = q > 0 ? Math.max(0.15, q / maxQ) : 0;
                                days.push(
                                  <div key={dateStr} className="flex-1" style={{ minWidth: 5 }}>
                                    <div className="aspect-square rounded-sm"
                                      style={{ background: q > 0 ? `rgba(239, 68, 68, ${intensity})` : '#f3f4f6' }}
                                      title={`${dateStr}: ${q} questions`} />
                                  </div>
                                );
                              }
                              return days;
                            })()}
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2 text-[10px] text-gray-400">
                          <span>90 days ago</span>
                          <div className="flex items-center gap-1">
                            <span>Less</span>
                            {[0, 0.2, 0.4, 0.7, 1].map((v, i) => (
                              <div key={i} className="w-2.5 h-2.5 rounded-sm" style={{ background: v === 0 ? '#f3f4f6' : `rgba(239, 68, 68, ${v})` }} />
                            ))}
                            <span>More</span>
                          </div>
                          <span>Today</span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  /* Locked advanced analytics for free users */
                  <div className="relative mt-4">
                    <div className="select-none" style={{ filter: 'blur(5px)' }} aria-hidden="true">
                      <div className="grid lg:grid-cols-2 gap-6 mb-6">
                        <div className="bg-white rounded-2xl p-6 border border-gray-200">
                          <h3 className="text-lg font-black text-gray-900 mb-3">Weekly Improvement</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            <div className="bg-gray-50 rounded-xl p-3 text-center"><div className="text-xl font-black">78%</div><div className="text-xs text-gray-400">This Week</div></div>
                            <div className="bg-gray-50 rounded-xl p-3 text-center"><div className="text-xl font-black">72%</div><div className="text-xs text-gray-400">Last Week</div></div>
                            <div className="bg-gray-50 rounded-xl p-3 text-center"><div className="text-xl font-black text-green-600">+6%</div><div className="text-xs text-gray-400">Improving</div></div>
                          </div>
                        </div>
                        <div className="bg-white rounded-2xl p-6 border border-gray-200">
                          <h3 className="text-lg font-black text-gray-900 mb-3">Question Types</h3>
                          <div className="space-y-2">
                            {['Multiple Choice', 'True/False', 'Matching'].map((t, i) => (
                              <div key={i} className="flex items-center gap-2"><div className="w-20 text-xs font-bold">{t}</div><div className="flex-1 h-2 bg-gray-100 rounded-full"><div className="h-full bg-green-500 rounded-full" style={{ width: `${85 - i * 15}%` }} /></div></div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="bg-white rounded-2xl p-6 border border-gray-200">
                        <h3 className="text-lg font-black text-gray-900 mb-3">Questions to Review</h3>
                        <div className="space-y-2">
                          {[1, 2, 3].map(i => (<div key={i} className="h-12 bg-gray-50 rounded-xl" />))}
                        </div>
                      </div>
                    </div>
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-[2px] rounded-2xl">
                      <div className="w-14 h-14 bg-gradient-to-br from-red-100 to-orange-100 rounded-2xl flex items-center justify-center mb-3">
                        <Sparkles className="w-7 h-7 text-red-500" />
                      </div>
                      <h3 className="text-xl font-black text-gray-900 mb-1">Advanced Analytics</h3>
                      <p className="text-sm text-gray-500 mb-4 text-center px-8">Weekly improvement tracking, question type breakdown, weakest questions, hourly patterns, and more</p>
                      <button onClick={() => navigate('/upgrade')}
                        className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-orange-500 text-white font-black rounded-xl hover:from-red-700 hover:to-orange-600 transition-all text-sm">
                        Unlock with Blazes Plus
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── Collection sub-tabs ── */}
        {['skins', 'achievements'].includes(activeTab) && (
          <div className="flex items-center gap-2 mb-6">
            <button onClick={() => setActiveTab('skins')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'skins' ? 'bg-red-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
              <Shirt className="w-4 h-4 inline mr-1.5" strokeWidth={2.5} />Skins & Packs
            </button>
            <button onClick={() => setActiveTab('achievements')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'achievements' ? 'bg-red-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
              <Award className="w-4 h-4 inline mr-1.5" strokeWidth={2.5} />Achievements
            </button>
          </div>
        )}

        {activeTab === 'skins' && user && (
          <SkinsPage
            userId={user.id}
            blazesBucks={blazesBucks}
            onBBChange={(newBal) => setBlazesBucks(newBal)}
            onSkinEquip={(skinId) => setEquippedSkinId(skinId)}
          />
        )}

        {activeTab === "achievements" && user && <div className="mt-6"><AchievementsMap userId={user.id} /></div>}


        {activeTab === 'classrooms' && (
          <div>
            <h1 className="text-3xl font-black text-gray-900 mb-6">My Classrooms & Assignments</h1>

            {/* Pending Assignments */}
            {myAssignments.filter(a => a.status !== 'completed').length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-black text-gray-900 mb-4 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-red-600" /> Pending Assignments
                </h2>
                <div className="space-y-3">
                  {myAssignments.filter(a => a.status !== 'completed').map(a => {
                    const reqs = a.requirements || {};
                    const overdue = a.due_date && new Date(a.due_date) < new Date();
                    return (
                      <div key={a.id} className={`bg-white rounded-2xl p-5 border-2 ${overdue ? 'border-red-200' : 'border-gray-200'}`}>
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-black text-gray-900">{a.title}</h3>
                              {overdue && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">OVERDUE</span>}
                              {a.status === 'in_progress' && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold">IN PROGRESS</span>}
                            </div>
                            <p className="text-sm text-gray-500">{a.classroom_name} &middot; {a.kit_title} &middot; Classic Quiz</p>
                            {a.instructions && <p className="text-sm text-gray-600 mt-1">{a.instructions}</p>}
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                              {a.due_date && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Due: {new Date(a.due_date).toLocaleDateString()}</span>}
                              {reqs.min_questions && <span>Answer {reqs.min_questions} question{reqs.min_questions !== 1 ? 's' : ''}</span>}
                              {reqs.min_accuracy && <span>Min {reqs.min_accuracy}% accuracy</span>}
                            </div>
                            {reqs.min_questions && (
                              <div className="mt-3">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-semibold text-gray-600">Progress: {a.questions_answered || 0}/{reqs.min_questions}</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div className="bg-red-600 h-2 rounded-full transition-all" style={{ width: `${Math.min(100, ((a.questions_answered || 0) / reqs.min_questions) * 100)}%` }}></div>
                                </div>
                              </div>
                            )}
                          </div>
                          <button onClick={async () => {
                            const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
                            try {
                              const res = await fetch(`${base}/api/assignments/${a.id}/play`, {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ studentId: user.id })
                              });
                              const data = await res.json();
                              if (!res.ok) throw new Error(data.error);
                              localStorage.setItem('activeAssignment', JSON.stringify({ assignmentId: a.id, gameCode: data.gameCode }));
                              navigate(`/game/play/${data.gameCode}`);
                            } catch (err) { setToast({ show: true, message: 'Failed to start: ' + err.message, type: 'error' }); }
                          }}
                            className="bg-red-600 text-white px-5 py-2 rounded-xl font-bold text-sm hover:bg-red-700 flex items-center gap-1.5 flex-shrink-0">
                            <Play className="w-4 h-4" /> Start
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Completed Assignments */}
            {myAssignments.filter(a => a.status === 'completed').length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-black text-gray-900 mb-3">Completed</h2>
                <div className="space-y-2">
                  {myAssignments.filter(a => a.status === 'completed').map(a => (
                    <div key={a.id} className="bg-green-50 rounded-xl p-4 border border-green-200 flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center"><Award className="w-4 h-4 text-white" /></div>
                      <div className="flex-1">
                        <span className="font-bold text-gray-900 text-sm">{a.title}</span>
                        <span className="text-xs text-gray-500 ml-2">{a.classroom_name} &middot; {a.questions_answered}q &middot; {a.correct_answers > 0 ? Math.round((a.correct_answers / a.questions_answered) * 100) : 0}%</span>
                      </div>
                      <span className="text-xs text-green-700 font-bold">Completed</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Classrooms list */}
            <h2 className="text-lg font-black text-gray-900 mb-3">My Classes</h2>
            {myClassrooms.length === 0 ? (
              <div className="bg-white rounded-2xl p-5 sm:p-8 text-center border border-gray-200">
                <GraduationCap className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">You're not in any classrooms yet. Your teacher will add you.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {myClassrooms.map(c => (
                  <div key={c.id} onClick={() => navigate(`/classroom/${c.id}`)}
                    className="bg-white rounded-2xl border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer overflow-hidden">
                    {c.image_url ? (
                      <div className="h-28 bg-gray-100 overflow-hidden">
                        <img src={c.image_url} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="h-20 bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                        <GraduationCap className="w-8 h-8 text-white/60" />
                      </div>
                    )}
                    <div className="p-4">
                      <h3 className="font-black text-gray-900 mb-1">{c.name}</h3>
                      <p className="text-sm text-gray-500">{c.teacher_name} &middot; {c.subject} &middot; {c.student_count} students</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'myKits' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-black text-gray-900 mb-1">My Question Kits</h1>
                <p className="text-gray-500 text-sm">Create kits and play with up to 5 people</p>
              </div>
              <button
                onClick={() => setActiveTab('createKit')}
                className="bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-red-700 flex items-center gap-2 text-sm"
              >
                <Plus className="w-4 h-4" /> New Kit
              </button>
            </div>

            {myKits.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 sm:p-8 md:p-12 text-center border border-gray-200">
                <BookOpen className="w-14 h-14 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 font-semibold mb-2">No kits yet</p>
                <p className="text-gray-400 text-sm mb-4">Create your first question kit to play with friends</p>
                <button onClick={() => setActiveTab('createKit')}
                  className="bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-red-700 text-sm inline-flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Create Kit
                </button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {myKits.map(kit => (
                  <div key={kit.id} className="bg-white rounded-2xl p-5 border border-gray-200 hover:shadow-md transition-shadow">
                    <h3 className="font-black text-gray-900 text-lg mb-2">{kit.title}</h3>
                    <div className="flex gap-2 mb-2">
                      {kit.subject && <span className="px-2.5 py-0.5 bg-red-100 text-red-600 rounded-full text-xs font-bold">{kit.subject}</span>}
                      {kit.grade_level && <span className="px-2.5 py-0.5 bg-blue-100 text-blue-600 rounded-full text-xs font-bold">{kit.grade_level}</span>}
                    </div>
                    {kit.description && <p className="text-gray-600 text-sm mb-3 line-clamp-2">{kit.description}</p>}
                    <p className="text-sm text-gray-500 mb-4"><span className="font-bold text-gray-900">{kit.question_count || 0}</span> questions</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate('/game/mode-select', { state: { kit, user } })}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-blue-100 text-blue-600 py-2 rounded-lg font-bold hover:bg-blue-200 transition-colors text-sm"
                      >
                        <Play className="w-4 h-4" /> Play
                      </button>
                      <button
                        onClick={() => {
                          if (['blazes_plus', 'teacher_pro', 'school'].includes(subscription?.tier)) {
                            navigate(`/flashcards/${kit.id}`);
                          } else {
                            setUpgradePrompt({ show: true, feature: 'AI Flashcards', desc: 'AI generates study cards from your questions. Flip, track what you know, and master any topic.', tier: 'Blazes Plus' });
                          }
                        }}
                        className={`relative flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-bold text-sm overflow-hidden ${
                          ['blazes_plus', 'teacher_pro', 'school'].includes(subscription?.tier)
                            ? 'bg-green-100 text-green-600 hover:bg-green-200'
                            : 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-500 hover:from-green-200 hover:to-emerald-200'
                        } transition-colors`}
                        title="Flashcards"
                      >
                        <BookOpen className="w-4 h-4" /> Cards
                        {!['blazes_plus', 'teacher_pro', 'school'].includes(subscription?.tier) && (
                          <Lock className="w-2.5 h-2.5 opacity-60" />
                        )}
                      </button>
                      <button
                        onClick={() => { setEditingKit({ ...kit }); setShowEditModal(true); }}
                        className="flex items-center justify-center bg-yellow-100 text-yellow-600 px-3 py-2 rounded-lg font-bold hover:bg-yellow-200 transition-colors text-sm"
                        title="Edit kit"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => {
                          const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
                          const res = await fetch(`${base}/api/kits/${kit.id}`);
                          const data = await res.json();
                          setSelectedKit(data);
                          setShowQuestionsModal(true);
                        }}
                        className="flex items-center justify-center bg-purple-100 text-purple-600 px-3 py-2 rounded-lg font-bold hover:bg-purple-200 transition-colors text-sm"
                        title="Questions"
                      >
                        <BookOpen className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteKitConfirm(kit)}
                        className="flex items-center justify-center bg-red-100 text-red-600 px-3 py-2 rounded-lg font-bold hover:bg-red-200 transition-colors text-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Delete Kit Confirmation */}
            {deleteKitConfirm && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDeleteKitConfirm(null)}>
                <div className="bg-white rounded-3xl p-5 sm:p-8 max-w-sm w-full shadow-2xl text-center" onClick={e => e.stopPropagation()}>
                  <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trash2 className="w-7 h-7 text-red-600" />
                  </div>
                  <h2 className="text-xl font-black text-gray-900 mb-2">Delete Kit?</h2>
                  <p className="text-gray-600 text-sm mb-6">
                    Are you sure you want to delete <strong>{deleteKitConfirm.title}</strong>? All questions will be permanently removed.
                  </p>
                  <div className="flex gap-3">
                    <button onClick={() => setDeleteKitConfirm(null)}
                      className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 text-sm">Cancel</button>
                    <button onClick={async () => {
                      const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
                      await fetch(`${base}/api/kits/${deleteKitConfirm.id}`, { method: 'DELETE' });
                      setDeleteKitConfirm(null);
                      fetch(`${base}/api/kits/teacher/${user.id}`).then(r => r.json()).then(setMyKits).catch(() => {});
                    }}
                      className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 text-sm">Delete</button>
                  </div>
                </div>
              </div>
            )}

            {/* Edit Kit Modal */}
            {showEditModal && editingKit && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl p-5 sm:p-8 max-w-md w-full">
                  <h2 className="text-2xl font-black text-gray-900 mb-6">Edit Kit</h2>

                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-2">Kit Title</label>
                      <input
                        type="text"
                        value={editingKit.title}
                        onChange={(e) =>
                          setEditingKit({
                            ...editingKit,
                            title: e.target.value
                          })
                        }
                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-red-500 focus:outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-2">Subject</label>
                      <input
                        type="text"
                        value={editingKit.subject || ''}
                        onChange={(e) => setEditingKit({ ...editingKit, subject: e.target.value })}
                        placeholder="e.g. Math, Science, History"
                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-red-500 focus:outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-2">Grade Level</label>
                      <input
                        type="text"
                        value={editingKit.grade_level || ''}
                        onChange={(e) => setEditingKit({ ...editingKit, grade_level: e.target.value })}
                        placeholder="e.g. 5th Grade, High School"
                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-red-500 focus:outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-2">Description</label>
                      <textarea
                        value={editingKit.description || ''}
                        onChange={(e) =>
                          setEditingKit({
                            ...editingKit,
                            description: e.target.value
                          })
                        }
                        rows={3}
                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-red-500 focus:outline-none transition-colors resize-none"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowEditModal(false);
                        setEditingKit(null);
                      }}
                      className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000'}/api/kits/${editingKit.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              title: editingKit.title,
                              subject: editingKit.subject,
                              grade_level: editingKit.grade_level,
                              description: editingKit.description
                            })
                          });

                          if (response.ok) {
                            setMyKits(myKits.map(k => k.id === editingKit.id ? { ...k, ...editingKit } : k));
                            setShowEditModal(false);
                            setEditingKit(null);
                            setToast({ show: true, message: 'Kit updated successfully!', type: 'success' });
                          } else {
                            setToast({ show: true, message: 'Error updating kit', type: 'error' });
                          }
                        } catch (error) {
                          console.error('Error updating kit:', error);
                          setToast({ show: true, message: 'Failed to update kit', type: 'error' });
                        }
                      }}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Questions Modal */}
            {showQuestionsModal && selectedKit && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
                  <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between z-10">
                    <div>
                      <h2 className="text-2xl font-black text-gray-900">{selectedKit.title}</h2>
                      <p className="text-gray-600 text-sm">{selectedKit.questions?.length || 0} questions</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {['blazes_plus', 'teacher_pro', 'school'].includes(subscription?.tier) ? (
                        <button onClick={() => setShowKitAIModal(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 transition-colors">
                          <Zap className="w-3.5 h-3.5" /> AI Generate
                        </button>
                      ) : (
                        <button onClick={() => setUpgradePrompt({ show: true, feature: 'AI Quiz Generation', desc: 'Paste your notes and AI instantly creates questions for your kit.', tier: 'Blazes Plus' })}
                          className="relative flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg text-xs font-bold overflow-hidden"
                          style={{ animation: 'pulse-glow 2s ease-in-out infinite' }}>
                          <div className="absolute inset-0 locked-shimmer" />
                          <Zap className="w-3.5 h-3.5 relative z-10" /> <span className="relative z-10">AI Generate</span>
                          <Lock className="w-2.5 h-2.5 relative z-10 opacity-70" />
                        </button>
                      )}
                      <button
                        onClick={() => { setShowQuestionsModal(false); setSelectedKit(null); }}
                        className="text-gray-500 hover:text-gray-700 text-2xl"
                      >×</button>
                    </div>
                  </div>

                  <div className="p-6">
                    {selectedKit.questions && selectedKit.questions.length > 0 ? (
                      <div className="space-y-3">
                        {selectedKit.questions.map((question, index) => {
                          const type = question.answer_type || 'multiple_choice';
                          const typeLabel = { multiple_choice: 'Multiple Choice', true_false: 'True/False', short_answer: 'Short Answer', multi_select: 'Multi-Select', matching: 'Matching', ordering: 'Ordering', image_label: 'Image Label', audio: 'Audio', fill_blank: 'Fill in Blank', math_equation: 'Math' }[type] || type;
                          let answerDisplay = question.correct_answer;
                          if (type === 'multiple_choice') {
                            const opts = { A: question.option_a, B: question.option_b, C: question.option_c, D: question.option_d };
                            answerDisplay = `${question.correct_answer}) ${opts[question.correct_answer] || question.correct_answer}`;
                          }
                          if (type === 'ordering') answerDisplay = (question.correct_answer || '').split('|||').join(' → ');
                          if (type === 'matching') answerDisplay = (question.correct_answer || '').split('###').map(p => p.replace('|||', ' → ')).join(', ');
                          return (
                            <div key={question.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-sm transition-all">
                              <div className="flex items-start justify-between p-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-bold text-gray-400">Question {index + 1}</span>
                                    <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{typeLabel}</span>
                                  </div>
                                  <p className="text-gray-900 font-bold">{question.question_text}</p>
                                  {question.image_url && type !== 'audio' && (
                                    <img src={question.image_url} alt="" className="mt-2 max-h-28 rounded-lg object-contain bg-gray-50" />
                                  )}
                                  {type === 'audio' && question.image_url && (
                                    <audio controls src={question.image_url} className="mt-2 h-8" />
                                  )}
                                </div>
                                <div className="flex gap-1 ml-3">
                                  <button onClick={() => { setEditingQuestion(question); setShowQuestionEditModal(true); }}
                                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                                    <Settings className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => setDeleteQuestionConfirm(question.id)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                              <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                                <span className="text-sm font-bold text-gray-900">Answer: </span>
                                <span className="text-sm text-gray-700">{answerDisplay}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm">No questions in this kit yet</p>
                      </div>
                    )}

                    {/* Add Question Form */}
                    <div className="mt-6 bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                      <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <Plus className="w-4 h-4 text-blue-600" /> Add New Question
                      </h4>
                      <form onSubmit={async (e) => {
                        e.preventDefault();
                        const form = e.target;
                        let correctAnswer = newCorrect;
                        let optA = form.option_a?.value || '';
                        let optB = form.option_b?.value || '';
                        let optC = form.option_c?.value || '';
                        let optD = form.option_d?.value || '';
                        let imgUrl = newImageUrl || '';

                        if (newQuestionType === 'multiple_choice' && !newCorrect) return;
                        if (newQuestionType === 'multi_select' && !newCorrect) return;
                        if (newQuestionType === 'true_false' && !newCorrect) return;
                        if (newQuestionType === 'short_answer') {
                          if (!form.correct_text?.value) return;
                          correctAnswer = form.correct_text.value;
                        }
                        if (newQuestionType === 'audio') {
                          if (!newCorrect) return;
                          if (!newImageUrl) return;
                          imgUrl = newImageUrl;
                        }
                        if (newQuestionType === 'ordering') {
                          const items = [0,1,2,3,4,5].map(i => form[`order_${i}`]?.value?.trim()).filter(Boolean);
                          if (items.length < 2) return;
                          correctAnswer = items.join('|||');
                        }
                        if (newQuestionType === 'matching') {
                          const pairs = [];
                          for (let i = 0; i < 5; i++) {
                            const l = form[`match_left_${i}`]?.value?.trim();
                            const r = form[`match_right_${i}`]?.value?.trim();
                            if (l && r) pairs.push(`${l}|||${r}`);
                          }
                          if (pairs.length < 2) return;
                          correctAnswer = pairs.join('###');
                        }

                        const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
                        try {
                          const res = await fetch(`${base}/api/kits/${selectedKit.id}/questions`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              question_text: form.question_text.value,
                              answer_type: newQuestionType,
                              correct_answer: correctAnswer,
                              option_a: optA,
                              option_b: optB,
                              option_c: optC,
                              option_d: optD,
                              image_url: imgUrl,
                            })
                          });
                          if (res.ok) {
                            setNewImageUrl(''); setNewImagePreview('');
                            const kitRes = await fetch(`${base}/api/kits/${selectedKit.id}`);
                            setSelectedKit(await kitRes.json());
                            const kitsRes = await fetch(`${base}/api/kits/teacher/${user.id}`);
                            setMyKits(await kitsRes.json());
                            form.reset(); setNewCorrect(''); setNewQuestionType('multiple_choice');
                          }
                        } catch (_) { }
                      }} className="space-y-3">
                        <input name="question_text" required placeholder="Question text" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none" />

                        {/* Question type selector */}
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            ['multiple_choice', 'Multiple Choice', false],
                            ['true_false', 'True/False', false],
                            ['short_answer', 'Short Answer', false],
                            ['multi_select', 'Multi-Select', !['blazes_plus', 'teacher_pro', 'school'].includes(subscription?.tier)],
                            ['matching', 'Matching', !['blazes_plus', 'teacher_pro', 'school'].includes(subscription?.tier)],
                            ['ordering', 'Ordering', !['blazes_plus', 'teacher_pro', 'school'].includes(subscription?.tier)],
                            ['audio', 'Audio', !['blazes_plus', 'teacher_pro', 'school'].includes(subscription?.tier)],
                          ].map(([val, label, locked]) => (
                            <button key={val} type="button"
                              onClick={() => {
                                if (locked) {
                                  setUpgradePrompt({ show: true, feature: 'More Question Types', desc: 'Unlock Multi-Select, Matching, Ordering, and Audio question types.', tier: 'Blazes Plus' });
                                } else {
                                  setNewQuestionType(val); setNewCorrect('');
                                }
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${
                                locked
                                  ? 'bg-purple-50 border-purple-200 text-purple-400 hover:border-purple-300'
                                  : newQuestionType === val ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                              }`}>
                              {label}{locked && <Lock className="w-2.5 h-2.5 inline ml-1 opacity-60" />}
                            </button>
                          ))}
                        </div>

                        {/* Multiple choice options */}
                        {newQuestionType === 'multiple_choice' && (
                          <>
                            <p className="text-xs font-bold text-gray-500">Click an option to mark it as the correct answer</p>
                            <div className="grid grid-cols-2 gap-2">
                              {['A', 'B', 'C', 'D'].map(letter => (
                                <div key={letter} className="relative">
                                  <input name={`option_${letter.toLowerCase()}`} required={letter === 'A' || letter === 'B'}
                                    placeholder={`Option ${letter}${letter === 'C' || letter === 'D' ? ' (optional)' : ''}`}
                                    className={`w-full px-3 py-2 rounded-lg text-sm focus:outline-none border-2 transition-all ${newCorrect === letter ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-white'}`} />
                                  <button type="button" onClick={() => setNewCorrect(newCorrect === letter ? '' : letter)}
                                    className={`absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${newCorrect === letter ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                    {newCorrect === letter ? '✓' : letter}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </>
                        )}

                        {/* True/False */}
                        {newQuestionType === 'true_false' && (
                          <div className="flex gap-3">
                            {['True', 'False'].map(v => (
                              <button key={v} type="button" onClick={() => setNewCorrect(v)}
                                className={`flex-1 py-3 rounded-xl font-bold border-2 transition-all ${newCorrect === v ? 'bg-green-50 border-green-400 text-green-700' : 'bg-white border-gray-200 text-gray-600'}`}>
                                {v}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Short answer */}
                        {newQuestionType === 'short_answer' && (
                          <input name="correct_text" required placeholder="Correct answer" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none" />
                        )}

                        {/* Multi-select */}
                        {newQuestionType === 'multi_select' && (
                          <>
                            <p className="text-xs font-bold text-gray-500">Click all correct answers</p>
                            <div className="grid grid-cols-2 gap-2">
                              {['A', 'B', 'C', 'D'].map(letter => (
                                <div key={letter} className="relative">
                                  <input name={`option_${letter.toLowerCase()}`} required={letter === 'A' || letter === 'B'}
                                    placeholder={`Option ${letter}`}
                                    className={`w-full px-3 py-2 rounded-lg text-sm focus:outline-none border-2 transition-all ${(newCorrect || '').includes(letter) ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-white'}`} />
                                  <button type="button" onClick={() => setNewCorrect((newCorrect || '').includes(letter) ? (newCorrect || '').replace(letter, '') : (newCorrect || '') + letter)}
                                    className={`absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded flex items-center justify-center text-xs font-black ${(newCorrect || '').includes(letter) ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                    {(newCorrect || '').includes(letter) ? '✓' : letter}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </>
                        )}

                        {/* Matching */}
                        {newQuestionType === 'matching' && (
                          <>
                            <p className="text-xs font-bold text-gray-500">Enter matching pairs</p>
                            {[0, 1, 2, 3, 4].map(idx => (
                              <div key={idx} className="flex items-center gap-2">
                                <input name={`match_left_${idx}`} placeholder={`Item ${idx + 1}`} required={idx < 2}
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none" />
                                <span className="text-gray-400 font-bold text-sm">→</span>
                                <input name={`match_right_${idx}`} placeholder={`Match ${idx + 1}`} required={idx < 2}
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none" />
                              </div>
                            ))}
                          </>
                        )}

                        {/* Ordering */}
                        {newQuestionType === 'ordering' && (
                          <>
                            <p className="text-xs font-bold text-gray-500">Enter items in the correct order</p>
                            {[0, 1, 2, 3, 4, 5].map(idx => (
                              <div key={idx} className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0">{idx + 1}</span>
                                <input name={`order_${idx}`} placeholder={idx < 2 ? `Step ${idx + 1} (required)` : `Step ${idx + 1} (optional)`} required={idx < 2}
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none" />
                              </div>
                            ))}
                          </>
                        )}

                        {/* Audio */}
                        {newQuestionType === 'audio' && (
                          <>
                            <div className="bg-white border border-gray-200 rounded-lg p-3">
                              <p className="text-xs font-bold text-gray-500 mb-2">Audio File *</p>
                              {newImageUrl && (
                                <div className="flex items-center gap-2 mb-2 bg-green-50 border border-green-200 rounded-lg p-2">
                                  <audio controls src={newImageUrl} className="h-8 flex-1" />
                                  <button type="button" onClick={() => { setNewImageUrl(''); setNewImagePreview(''); }}
                                    className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-black">×</button>
                                </div>
                              )}
                              <div
                                className={`flex flex-col items-center justify-center rounded-lg text-xs font-bold cursor-pointer transition-all py-4 px-3 ${newImageUrl ? 'bg-gray-50 border-2 border-gray-200' : 'bg-blue-50 border-2 border-dashed border-blue-300 hover:bg-blue-100'}`}
                                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-blue-500', 'bg-blue-100'); }}
                                onDragLeave={e => { e.preventDefault(); e.currentTarget.classList.remove('border-blue-500', 'bg-blue-100'); }}
                                onDrop={async e => {
                                  e.preventDefault();
                                  e.currentTarget.classList.remove('border-blue-500', 'bg-blue-100');
                                  const file = e.dataTransfer.files?.[0];
                                  if (!file || !file.type.startsWith('audio/')) return;
                                  const reader = new FileReader();
                                  reader.onload = async () => {
                                    try {
                                      const bse = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
                                      const res = await fetch(`${bse}/api/upload-audio`, {
                                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ audioData: reader.result })
                                      });
                                      const data = await res.json();
                                      if (data.url) { setNewImageUrl(data.url); setNewImagePreview(data.url); }
                                    } catch (_) {}
                                  };
                                  reader.readAsDataURL(file);
                                }}
                                onClick={() => document.getElementById('audio-upload-sh')?.click()}
                              >
                                <span className="text-lg mb-1">🎵</span>
                                <span className={newImageUrl ? 'text-gray-500' : 'text-blue-700'}>
                                  {newImageUrl ? 'Drop to replace' : 'Drop audio here or click'}
                                </span>
                                <span className="text-[10px] text-gray-400 mt-0.5">MP3, WAV, OGG</span>
                                <input id="audio-upload-sh" type="file" accept="audio/*" className="hidden" onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  const reader = new FileReader();
                                  reader.onload = async () => {
                                    try {
                                      const bse = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
                                      const res = await fetch(`${bse}/api/upload-audio`, {
                                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ audioData: reader.result })
                                      });
                                      const data = await res.json();
                                      if (data.url) { setNewImageUrl(data.url); setNewImagePreview(data.url); }
                                    } catch (_) {}
                                  };
                                  reader.readAsDataURL(file);
                                  e.target.value = '';
                                }} />
                              </div>
                            </div>
                            <p className="text-xs font-bold text-gray-500">Click the correct answer option</p>
                            <div className="grid grid-cols-2 gap-2">
                              {['A', 'B', 'C', 'D'].map(letter => (
                                <div key={letter} className="relative">
                                  <input name={`option_${letter.toLowerCase()}`} required={letter === 'A' || letter === 'B'}
                                    placeholder={`Option ${letter}`}
                                    className={`w-full px-3 py-2 rounded-lg text-sm focus:outline-none border-2 transition-all ${newCorrect === letter ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-white'}`} />
                                  <button type="button" onClick={() => setNewCorrect(newCorrect === letter ? '' : letter)}
                                    className={`absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${newCorrect === letter ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                    {newCorrect === letter ? '✓' : letter}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </>
                        )}

                        <div id="add-q-error" className="text-xs text-red-500 font-semibold hidden mb-2"></div>
                        <button type="button" onClick={(e) => {
                          const errEl = document.getElementById('add-q-error');
                          const form = e.target.closest('form');
                          if (!form.question_text?.value?.trim()) { errEl.textContent = 'Enter the question text'; errEl.classList.remove('hidden'); return; }
                          if (newQuestionType === 'multiple_choice' && !newCorrect) { errEl.textContent = 'Select the correct answer (click A, B, C, or D)'; errEl.classList.remove('hidden'); return; }
                          if (newQuestionType === 'multi_select' && !newCorrect) { errEl.textContent = 'Select at least one correct answer'; errEl.classList.remove('hidden'); return; }
                          if (newQuestionType === 'true_false' && !newCorrect) { errEl.textContent = 'Select True or False'; errEl.classList.remove('hidden'); return; }
                          if (newQuestionType === 'short_answer' && !form.correct_text?.value?.trim()) { errEl.textContent = 'Enter the correct answer'; errEl.classList.remove('hidden'); return; }
                          if (newQuestionType === 'audio' && !newImageUrl) { errEl.textContent = 'Upload an audio file'; errEl.classList.remove('hidden'); return; }
                          if (newQuestionType === 'audio' && !newCorrect) { errEl.textContent = 'Select the correct answer option'; errEl.classList.remove('hidden'); return; }
                          if (newQuestionType === 'ordering') {
                            const items = [0,1,2,3,4,5].map(i => form[`order_${i}`]?.value?.trim()).filter(Boolean);
                            if (items.length < 2) { errEl.textContent = 'Add at least 2 items to order'; errEl.classList.remove('hidden'); return; }
                          }
                          if (newQuestionType === 'matching') {
                            let pairCount = 0;
                            for (let i = 0; i < 5; i++) { if (form[`match_left_${i}`]?.value?.trim() && form[`match_right_${i}`]?.value?.trim()) pairCount++; }
                            if (pairCount < 2) { errEl.textContent = 'Add at least 2 matching pairs'; errEl.classList.remove('hidden'); return; }
                          }
                          errEl.classList.add('hidden');
                          form.requestSubmit();
                        }}
                          className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors text-sm">
                          Add Question
                        </button>
                      </form>
                    </div>

                    <div className="mt-4">
                      <button
                        onClick={() => {
                          setShowQuestionsModal(false);
                          setSelectedKit(null);
                        }}
                        className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI Generate for Kit Modal */}
            {showKitAIModal && selectedKit && (
              <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => !kitAILoading && setShowKitAIModal(false)}>
                <div className="bg-white rounded-3xl p-5 sm:p-8 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <h2 className="text-2xl font-black text-gray-900 mb-1">AI Generate Questions</h2>
                  <p className="text-gray-500 text-sm mb-6">Add AI-generated questions to <span className="font-bold text-gray-700">{selectedKit.title}</span></p>
                  {kitAIError && <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm font-semibold">{kitAIError}</div>}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Your Notes *</label>
                      <textarea value={kitAINotes} onChange={e => setKitAINotes(e.target.value)}
                        placeholder="Paste your class notes, textbook content, or study material here..."
                        rows={6} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:border-purple-500 focus:outline-none resize-none" />
                      <p className="text-xs text-gray-400 mt-1">{kitAINotes.length} characters</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-sm font-bold text-gray-700 mb-1">Questions</label>
                        <div className="flex gap-1.5">
                          {[5, 10, 15, 20].map(n => (
                            <button key={n} type="button" onClick={() => setKitAICount(n)}
                              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${kitAICount === n ? 'bg-purple-100 text-purple-700 border-2 border-purple-300' : 'bg-gray-100 text-gray-600 border-2 border-transparent'}`}>
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-bold text-gray-700 mb-1">Difficulty</label>
                        <div className="flex gap-1.5">
                          {[['easy', 'Easy'], ['medium', 'Med'], ['hard', 'Hard']].map(([v, l]) => (
                            <button key={v} type="button" onClick={() => setKitAIDifficulty(v)}
                              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${kitAIDifficulty === v ? 'bg-purple-100 text-purple-700 border-2 border-purple-300' : 'bg-gray-100 text-gray-600 border-2 border-transparent'}`}>
                              {l}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button onClick={() => { setShowKitAIModal(false); setKitAIError(''); }} disabled={kitAILoading}
                      className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 disabled:opacity-50">Cancel</button>
                    <button disabled={kitAILoading || kitAINotes.trim().length < 20}
                      onClick={async () => {
                        setKitAILoading(true); setKitAIError('');
                        try {
                          const res = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000'}/api/ai/generate-from-notes`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ notes: kitAINotes, questionCount: kitAICount, difficulty: kitAIDifficulty, userId: user.id })
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error || 'Generation failed');
                          const questions = data.questions || [];
                          for (const q of questions) {
                            await fetch(`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000'}/api/kits/${selectedKit.id}/questions`, {
                              method: 'POST', headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ question_text: q.question_text, answer_type: q.answer_type, correct_answer: q.correct_answer, option_a: q.option_a || '', option_b: q.option_b || '', option_c: q.option_c || '', option_d: q.option_d || '', image_url: '' })
                            });
                          }
                          const kitRes = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000'}/api/kits/${selectedKit.id}`);
                          setSelectedKit(await kitRes.json());
                          const kitsRes = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000'}/api/kits/teacher/${user.id}`);
                          setMyKits(await kitsRes.json());
                          setShowKitAIModal(false); setKitAINotes(''); setKitAIError('');
                        } catch (err) { setKitAIError(err.message || 'Failed to generate'); }
                        setKitAILoading(false);
                      }}
                      className="flex-1 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2">
                      {kitAILoading ? (<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating...</>) : `Generate ${kitAICount} Questions`}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Edit Question Modal */}
            {showQuestionEditModal && editingQuestion && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
                <div className="bg-white rounded-2xl p-5 sm:p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
                  <h2 className="text-2xl font-black text-gray-900 mb-6">Edit Question</h2>

                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-2">Question Text</label>
                      <textarea
                        value={editingQuestion.question_text || ''}
                        onChange={(e) =>
                          setEditingQuestion({
                            ...editingQuestion,
                            question_text: e.target.value
                          })
                        }
                        rows={3}
                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-red-500 focus:outline-none transition-colors resize-none"
                      />
                    </div>

                    {editingQuestion.answer_type === 'multiple_choice' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="block text-sm font-bold text-gray-900">Options * (min 2, max 8)</label>
                          {['option_a', 'option_b', 'option_c', 'option_d', 'option_e', 'option_f', 'option_g', 'option_h'].filter(key => editingQuestion[key]).length < 8 && (
                            <button
                              onClick={() => {
                                const optionKeys = ['option_a', 'option_b', 'option_c', 'option_d', 'option_e', 'option_f', 'option_g', 'option_h'];
                                const nextEmptyKey = optionKeys.find(key => !editingQuestion[key]);
                                if (nextEmptyKey) {
                                  setEditingQuestion({ ...editingQuestion, [nextEmptyKey]: '' });
                                }
                              }}
                              className="text-red-600 font-bold text-xs hover:text-red-700"
                            >
                              + Add Option
                            </button>
                          )}
                        </div>
                        <div className="space-y-2">
                          {['option_a', 'option_b', 'option_c', 'option_d', 'option_e', 'option_f', 'option_g', 'option_h'].map((optionKey, idx) => {
                            const option = editingQuestion[optionKey];
                            if (option === undefined) return null;
                            const optionLetter = String.fromCharCode(65 + idx);

                            return (
                              <div key={idx} className="flex items-center gap-2">
                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={editingQuestion.correct_answer ? editingQuestion.correct_answer.includes(optionLetter) : false}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        const newAnswer = editingQuestion.correct_answer ? `${editingQuestion.correct_answer}, ${optionLetter}` : optionLetter;
                                        setEditingQuestion({
                                          ...editingQuestion,
                                          correct_answer: newAnswer
                                        });
                                      } else {
                                        const newAnswer = editingQuestion.correct_answer
                                          ? editingQuestion.correct_answer.split(', ').filter(a => a !== optionLetter).join(', ')
                                          : '';
                                        setEditingQuestion({ ...editingQuestion, correct_answer: newAnswer });
                                      }
                                    }}
                                    className="w-4 h-4 rounded border-2 border-gray-300 cursor-pointer"
                                  />
                                  <span className="font-bold text-gray-900 w-6">{optionLetter})</span>
                                </label>
                                <input
                                  type="text"
                                  value={option}
                                  onChange={(e) => {
                                    setEditingQuestion({ ...editingQuestion, [optionKey]: e.target.value });
                                  }}
                                  placeholder={`Enter option ${optionLetter}`}
                                  className="flex-1 px-2 py-1 border-2 border-gray-200 rounded text-sm focus:border-red-500 focus:outline-none"
                                />
                                {['option_a', 'option_b', 'option_c', 'option_d', 'option_e', 'option_f', 'option_g', 'option_h'].filter(key => editingQuestion[key] !== undefined).length > 2 && (
                                  <button
                                    onClick={() => {
                                      const newQuestion = { ...editingQuestion };
                                      delete newQuestion[optionKey];
                                      const optionLetterToRemove = optionLetter;
                                      const newCorrectAnswer = editingQuestion.correct_answer
                                        ? editingQuestion.correct_answer.split(', ').filter(a => a !== optionLetterToRemove).join(', ')
                                        : '';
                                      setEditingQuestion({ ...newQuestion, correct_answer: newCorrectAnswer });
                                    }}
                                    className="text-red-600 hover:text-red-700 font-bold text-xs"
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {editingQuestion.answer_type === 'true_false' && (
                      <div>
                        <label className="block text-sm font-bold text-gray-900 mb-2">Correct Answer</label>
                        <div className="flex gap-3">
                          {['True', 'False'].map(v => (
                            <button key={v} type="button" onClick={() => setEditingQuestion({ ...editingQuestion, correct_answer: v })}
                              className={`flex-1 py-3 rounded-xl font-bold text-sm border-2 transition-all ${editingQuestion.correct_answer === v ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {editingQuestion.answer_type === 'short_answer' && (
                      <div>
                        <label className="block text-sm font-bold text-gray-900 mb-2">Correct Answer</label>
                        <input
                          type="text"
                          value={editingQuestion.correct_answer}
                          onChange={(e) =>
                            setEditingQuestion({
                              ...editingQuestion,
                              correct_answer: e.target.value
                            })
                          }
                          className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-red-500 focus:outline-none transition-colors"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowQuestionEditModal(false);
                        setEditingQuestion(null);
                      }}
                      className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000'}/api/kits/${selectedKit.id}/questions/${editingQuestion.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              question_text: editingQuestion.question_text,
                              correct_answer: editingQuestion.correct_answer,
                              options: [editingQuestion.option_a, editingQuestion.option_b, editingQuestion.option_c, editingQuestion.option_d]
                            })
                          });

                          if (response.ok) {
                            setSelectedKit({
                              ...selectedKit,
                              questions: selectedKit.questions.map(q => q.id === editingQuestion.id ? editingQuestion : q)
                            });
                            setShowQuestionEditModal(false);
                            setEditingQuestion(null);
                          } else {
                            setToast({ show: true, message: 'Error updating question', type: 'error' });
                          }
                        } catch (error) {
                          console.error('Error updating question:', error);
                          setToast({ show: true, message: 'Failed to update question', type: 'error' });
                        }
                      }}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Delete Question Confirmation Modal */}
            {deleteQuestionConfirm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
                <div className="bg-white rounded-2xl p-5 sm:p-8 max-w-md w-full">
                  <h2 className="text-2xl font-black text-gray-900 mb-4">Delete Question?</h2>
                  <p className="text-gray-600 mb-6">
                    Are you sure you want to delete this question? This action cannot be undone.
                  </p>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setDeleteQuestionConfirm(null)}
                      className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await fetch(`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000'}/api/kits/${selectedKit.id}/questions/${deleteQuestionConfirm}`, {
                            method: 'DELETE'
                          });
                          setSelectedKit({
                            ...selectedKit,
                            questions: selectedKit.questions.filter(q => q.id !== deleteQuestionConfirm)
                          });
                          setDeleteQuestionConfirm(null);
                        } catch (error) {
                          console.error('Error deleting question:', error);
                          setDeleteQuestionConfirm(null);
                        }
                      }}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'createKit' && user && (
          <CreateKit
            user={user}
            onBack={() => setActiveTab('myKits')}
            onKitCreated={() => {
              setActiveTab('myKits');
              const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
              fetch(`${base}/api/kits/teacher/${user.id}`).then(r => r.json()).then(setMyKits).catch(() => {});
            }}
          />
        )}

      </div>

      {showJoinModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 sm:p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900">Join Game</h2>
              <button
                onClick={() => {
                  setShowJoinModal(false);
                  setGameCode('');
                  setJoinError('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-900 mb-3">
                Enter 6-Digit Game Code
              </label>
              <input
                type="text"
                value={gameCode}
                onChange={(e) => { setGameCode(e.target.value.toUpperCase().slice(0, 6)); setJoinError(''); }}
                placeholder="ABC123"
                className={`w-full px-6 py-4 border-2 rounded-xl focus:outline-none transition-colors text-gray-900 text-center text-2xl font-black tracking-widest ${joinError ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-orange-500'}`}
                maxLength={6}
                autoFocus
              />
            </div>

            {joinError && (
              <div className="mb-4 bg-red-50 border-2 border-red-200 rounded-xl p-3 text-red-700 font-semibold text-sm text-center">
                {joinError}
              </div>
            )}

            <button
              onClick={handleJoinGame}
              disabled={joinLoading}
              className="w-full bg-gradient-to-r from-red-600 to-orange-500 text-white font-black py-4 rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 text-lg disabled:opacity-50"
            >
              <Play className="w-5 h-5" />
              {joinLoading ? 'Checking...' : 'Join Game'}
            </button>
          </div>
        </div>
      )}

      {/* Upgrade Prompt Modal */}
      {upgradePrompt.show && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setUpgradePrompt({ ...upgradePrompt, show: false })}>
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-7 h-7 text-purple-500" />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-1">{upgradePrompt.feature}</h3>
              <p className="text-sm text-gray-500 mb-5 leading-relaxed">{upgradePrompt.desc}</p>
              <button onClick={() => { setUpgradePrompt({ ...upgradePrompt, show: false }); navigate('/upgrade'); }}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all text-sm mb-2">
                Unlock with {upgradePrompt.tier}
              </button>
              <button onClick={() => setUpgradePrompt({ ...upgradePrompt, show: false })}
                className="w-full py-2 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors">
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}