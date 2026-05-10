import React, { useState, useEffect, useRef } from 'react';

// ─── Stale-while-revalidate cache helpers ───────────────────────────────
// Persist heavy dashboard pieces (stats, kits, classrooms, etc.) to
// localStorage keyed by userId. Lazy-init state from cache so the page
// renders instantly with the user's last-seen data, then the real fetch
// hydrates the latest values in the background. Subsequent visits feel
// instant even when the backend is slow.
function _readUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
}
function _cacheKey(suffix) {
  const u = _readUser();
  return u ? `th:${u.id}:${suffix}` : null;
}
function readCached(suffix, fallback) {
  const k = _cacheKey(suffix);
  if (!k) return fallback;
  try {
    const raw = localStorage.getItem(k);
    return raw == null ? fallback : JSON.parse(raw);
  } catch { return fallback; }
}
function writeCached(suffix, value) {
  const k = _cacheKey(suffix);
  if (!k) return;
  try { localStorage.setItem(k, JSON.stringify(value)); } catch {}
}
import SkinsPage, { AvatarPreview, isBlazesPlusCached, cacheTier, cacheEquippedSkin, initialEquippedSkin } from './SkinsPage';
import AchievementsMap from './AchievementsMap';
import CreateKit from '../components/CreateKit';
import AddQuestionForm from '../components/AddQuestionForm';
import NotificationDropdown from '../components/NotificationDropdown';
import SubjectPicker, { GradePicker } from '../components/SubjectPicker';
import { getGameModeName } from '../utils/gameModeName';
import { Flame, Plus, BarChart3, Shirt, BookOpen, Users, TrendingUp, Calendar, Clock, Trophy, Target, Zap, Play, Settings, Home, Trash2, GraduationCap, ChevronRight, ClipboardList, Check, X, Crown, Layers, Award, Star } from 'lucide-react';
import Toast from '../components/Toast';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';

export default function TeacherHome() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { tab: urlTab } = useParams();
  // URL is the source of truth for which section is shown — each tab has its
  // own page like /home/teacher/kits, /home/teacher/stats, etc. Falls back to
  // the legacy ?tab= query string for older links, then to 'dashboard'.
  const activeTab = urlTab || searchParams.get('tab') || 'dashboard';
  const setActiveTab = (next) => navigate('/home/teacher/' + next);
  const [user, setUser] = useState(null);
  const [equippedSkinId, setEquippedSkinId] = useState(initialEquippedSkin);
  const [blazesBucks, setBlazesBucks] = useState(0);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);

  const handleJoinGame = async () => {
    if (joinCode.length !== 6) {
      setJoinError('Please enter a valid 6-digit code');
      return;
    }
    setJoinError('');
    setJoinLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
      const res = await fetch(`${baseUrl}/api/games/${joinCode.toUpperCase()}`);
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
      navigate('/game/join', { state: { gameCode: joinCode.toUpperCase() } });
      setShowJoinModal(false);
      setJoinCode('');
    } catch {
      setJoinError('Could not connect to server. Try again.');
    } finally {
      setJoinLoading(false);
    }
  };
  // Lazy-init from localStorage cache so the dashboard renders with last-seen
  // data immediately; the fetches below refresh it. First visit still pays the
  // full network cost, every subsequent visit feels instant.
  const [teacherStats, setTeacherStats] = useState(() => readCached('stats', {
    totalGames: 0, avgScore: 0, activeStudents: 0, totalClasses: 0, classesToday: 0,
  }));
  const [topPerformers, setTopPerformers] = useState(() => readCached('top', []));
  const [recentActivity, setRecentActivity] = useState(() => readCached('activity', []));
  const [studentsNeedingHelp, setStudentsNeedingHelp] = useState(() => readCached('needhelp', []));
  const [studentSkins, setStudentSkins] = useState({});
  const [studentTiers, setStudentTiers] = useState({});
  const [kits, setKits] = useState(() => readCached('kits', []));
  // If we have a non-empty cached list we can skip the skeleton entirely —
  // the fresh fetch will reconcile differences in the background.
  const [kitsLoading, setKitsLoading] = useState(() => readCached('kits', []).length === 0);
  const [editingKit, setEditingKit] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [selectedKit, setSelectedKit] = useState(null);
  const [showQuestionsModal, setShowQuestionsModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [showQuestionEditModal, setShowQuestionEditModal] = useState(false);
  const [deleteQuestionConfirm, setDeleteQuestionConfirm] = useState(null);
  const [newCorrect, setNewCorrect] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newImagePreview, setNewImagePreview] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [classrooms, setClassrooms] = useState(() => readCached('classrooms', []));
  const [showCreateClassroom, setShowCreateClassroom] = useState(false);
  const [newClassroom, setNewClassroom] = useState({ name: '', subject: '', gradeLevel: '', imageUrl: '' });
  const [showGoogleImport, setShowGoogleImport] = useState(false);
  const [googleCourses, setGoogleCourses] = useState([]);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [importingCourse, setImportingCourse] = useState(null);
  const [googleImportResult, setGoogleImportResult] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsSearch, setAnalyticsSearch] = useState('');
  const [analyticsSortBy, setAnalyticsSortBy] = useState('name');
  const [analyticsClassFilter, setAnalyticsClassFilter] = useState('all');
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' });
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedStudentDetail, setSelectedStudentDetail] = useState(null);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [seasonProgress, setSeasonProgress] = useState(null);
  const [teacherTier, setTeacherTier] = useState('free');
  const [selectedGameCode, setSelectedGameCode] = useState(null);
  const [gameDetails, setGameDetails] = useState(null);
  const [loadingGameDetails, setLoadingGameDetails] = useState(false);
  const [expandedPlayerIndex, setExpandedPlayerIndex] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      navigate('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);

    const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

    // Load equipped skin
    fetch(`${base}/api/skins/${parsedUser.id}`)
      .then(r => r.json())
      .then(d => {
        if (d.equipped?.avatar_skin) {
          setEquippedSkinId(d.equipped.avatar_skin);
          cacheEquippedSkin(parsedUser.id, d.equipped.avatar_skin);
        }
      })
      .catch(() => {});

    // Load BlazesBucks balance
    fetch(`${base}/api/blazesbucks/${parsedUser.id}`)
      .then(r => r.json())
      .then(d => setBlazesBucks(d.balance || 0))
      .catch(() => {});

    // Load season progress
    fetch(`${base}/api/season/progress/${parsedUser.id}`)
      .then(r => r.json())
      .then(setSeasonProgress)
      .catch(() => {});

    // Load subscription tier
    fetch(`${base}/api/subscription/${parsedUser.id}`)
      .then(r => r.json())
      .then(d => setTeacherTier(d.tier || 'free'))
      .catch(() => {});

    if (parsedUser.role === 'student') {
      navigate('/home/student');
    }

    // Every fetch writes its result into the SWR cache after success, so the
    // next mount lazy-inits from a populated cache.
    const fetchStats = async () => {
      try {
        const data = await fetch(`${base}/api/stats/${parsedUser.id}`).then(r => r.json());
        setTeacherStats(data);
        writeCached('stats', data);
      } catch (e) { console.error('Error fetching stats:', e); }
    };
    const fetchTopPerformers = async () => {
      try {
        const data = await fetch(`${base}/api/students/top-performers/${parsedUser.id}`).then(r => r.json());
        const arr = Array.isArray(data) ? data : [];
        setTopPerformers(arr);
        writeCached('top', arr);
      } catch (e) { console.error('Error fetching top performers:', e); }
    };
    const fetchRecentActivity = async () => {
      try {
        const data = await fetch(`${base}/api/activity/${parsedUser.id}/10`).then(r => r.json());
        const arr = Array.isArray(data) ? data : [];
        setRecentActivity(arr);
        writeCached('activity', arr);
      } catch (e) { console.error('Error fetching recent activity:', e); }
    };
    const fetchStudentsNeedingHelp = async () => {
      try {
        const data = await fetch(`${base}/api/students/needing-help/${parsedUser.id}`).then(r => r.json());
        const arr = Array.isArray(data) ? data : [];
        setStudentsNeedingHelp(arr);
        writeCached('needhelp', arr);
      } catch (e) { console.error('Error fetching students needing help:', e); }
    };
    const fetchKits = async () => {
      try {
        const data = await fetch(`${base}/api/kits/teacher/${parsedUser.id}`).then(r => r.json());
        const arr = Array.isArray(data) ? data : [];
        setKits(arr);
        writeCached('kits', arr);
      } catch (e) { console.error('Error fetching kits:', e); }
      finally { setKitsLoading(false); }
    };

    fetchStats();
    fetchTopPerformers();
    fetchRecentActivity();
    fetchStudentsNeedingHelp();
    fetchKits();
    fetch(`${base}/api/classrooms/teacher/${parsedUser.id}`)
      .then(r => r.json())
      .then(data => { const arr = Array.isArray(data) ? data : []; setClassrooms(arr); writeCached('classrooms', arr); })
      .catch(() => {});
  }, [navigate]);

  // Fetch skins for any student we haven't fetched yet
  useEffect(() => {
    const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
    const allStudents = [...topPerformers, ...studentsNeedingHelp];
    allStudents.forEach(s => {
      if (!s.id || studentSkins[s.id] !== undefined) return;
      setStudentSkins(prev => ({ ...prev, [s.id]: null })); // mark as fetching
      fetch(`${base}/api/skins/${s.id}`)
        .then(r => r.json())
        .then(d => {
          setStudentSkins(prev => ({ ...prev, [s.id]: d.equipped?.avatar_skin || 'default' }));
          if (d.tier) { setStudentTiers(prev => ({ ...prev, [s.id]: d.tier })); cacheTier(s.id, d.tier); }
        })
        .catch(() => setStudentSkins(prev => ({ ...prev, [s.id]: 'default' })));
    });
  }, [topPerformers, studentsNeedingHelp]);

  // Cache analytics in a ref so toggling tabs doesn't trigger a refetch within 60s
  const analyticsCacheRef = useRef({ data: null, fetchedAt: 0, userId: null });

  // Fetch analytics when stats tab is active
  useEffect(() => {
    if (activeTab !== 'stats' || !user) return;
    const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

    const cache = analyticsCacheRef.current;
    const fresh = cache.data && cache.userId === user.id && Date.now() - cache.fetchedAt < 60_000;
    if (fresh) {
      setAnalytics(cache.data);
      return;
    }

    setAnalytics(null);
    setSelectedStudent(null);
    setSelectedStudentDetail(null);
    fetch(`${base}/api/analytics/teacher/${user.id}`)
      .then(r => r.json())
      .then(data => {
        analyticsCacheRef.current = { data, fetchedAt: Date.now(), userId: user.id };
        setAnalytics(data);
      })
      .catch(() => {
        setAnalytics({ students: [], classPerformance: [], accuracyDistribution: [], totalQuestionsAnswered: 0, overallAvgAccuracy: 0 });
      });
  }, [activeTab, user]);

  // Fetch individual student detail when selected
  useEffect(() => {
    if (!selectedStudent) { setSelectedStudentDetail(null); return; }
    const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
    setSelectedStudentDetail(null);
    fetch(`${base}/api/analytics/student/${selectedStudent.id}?teacherId=${user?.id}`)
      .then(r => r.json())
      .then(setSelectedStudentDetail)
      .catch(() => setSelectedStudentDetail({}));
  }, [selectedStudent]);

  // Fetch game details when selected (pro feature)
  useEffect(() => {
    if (!selectedGameCode) { setGameDetails(null); return; }
    if (!['teacher_pro', 'school'].includes(teacherTier)) { setGameDetails(null); return; }
    const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
    setLoadingGameDetails(true);
    setExpandedPlayerIndex(null);
    fetch(`${base}/api/games/${selectedGameCode}/details`)
      .then(r => r.json())
      .then(setGameDetails)
      .catch(err => { console.error('Error fetching game details:', err); setGameDetails(null); })
      .finally(() => setLoadingGameDetails(false));
  }, [selectedGameCode, teacherTier]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Flame className="w-16 h-16 text-red-600 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const userName = user.name || 'Teacher';
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50">
      <Toast show={toast.show} message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-2">
          {/* Left: logo + main tabs */}
          <div className="flex items-center gap-2 sm:gap-4 md:gap-6 min-w-0">
            <div className="flex items-center gap-2 mr-2 flex-shrink-0">
              <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                <Flame className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-xl font-black text-gray-900 hidden sm:inline">Blazes</span>
            </div>
            <div className="flex items-center gap-1 overflow-x-auto">
              {[
                { id: 'dashboard', icon: Home, label: 'Home' },
                { id: 'myKits', icon: BookOpen, label: 'Kits' },
                { id: 'classrooms', icon: GraduationCap, label: 'Classes' },
                { id: 'stats', icon: BarChart3, label: 'Stats' },
              ].map(t => {
                const Icon = t.icon;
                const isActive = t.id === 'myKits'
                  ? ['myKits', 'createKit'].includes(activeTab)
                  : activeTab === t.id;
                return (
                  <button key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap ${isActive
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
                className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-full text-sm font-black transition-all whitespace-nowrap bg-red-600 text-white hover:bg-red-700 shadow-sm"
              >
                <Play className="w-4 h-4" strokeWidth={2.5} />
                <span className="hidden sm:inline">Join Game</span>
              </button>
            </div>
          </div>

          {/* Right: notifications, account button (levels/profile/collection/upgrade), avatar (settings/logout) */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <NotificationDropdown userId={user?.id} />

            {/* Hub button — opens the dedicated personal area (levels / skins / achievements / upgrade) */}
            <button onClick={() => navigate('/hub')}
              className="group flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-white border border-gray-200 hover:border-amber-300 hover:bg-amber-50 transition-all shadow-sm">
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #fbbf24 0%, #f97316 100%)', boxShadow: '0 1px 4px rgba(249,115,22,0.4)' }}>
                <Star className="w-3.5 h-3.5 fill-white text-white" strokeWidth={2.5} />
              </div>
              <span className="text-sm font-black text-gray-900 tabular-nums">Lv {seasonProgress?.level || 1}</span>
              <div className="hidden sm:flex items-center gap-1 ml-0.5 pl-2 border-l border-gray-200">
                <svg viewBox="0 0 24 24" className="w-4 h-4" aria-label="BB">
                  <defs>
                    <radialGradient id="bbCoinHub" cx="35%" cy="28%" r="85%">
                      <stop offset="0%" stopColor="#fffbe6" />
                      <stop offset="55%" stopColor="#fbbf24" />
                      <stop offset="100%" stopColor="#b45309" />
                    </radialGradient>
                  </defs>
                  <circle cx="12" cy="12" r="10" fill="url(#bbCoinHub)" stroke="#7c2d12" strokeWidth="0.7" />
                  <text x="12" y="16.5" textAnchor="middle" fontWeight="900" fontSize="12" fill="#7c2d12">B</text>
                </svg>
                <span className="text-xs font-black tabular-nums text-amber-700">{blazesBucks.toLocaleString()}</span>
              </div>
            </button>

            {/* Avatar — settings + log out */}
            <div className="relative">
              <button onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-100 transition-colors">
                <AvatarPreview skinId={equippedSkinId} initial={userInitial} size={32} isPlus={teacherTier === 'teacher_pro'} userId={user?.id} />
              </button>
              {showProfileMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                  <div className="absolute right-0 top-11 w-52 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <div className="font-bold text-gray-900 text-sm truncate">{userName}</div>
                      <div className="text-xs text-gray-500">Teacher{teacherTier === 'teacher_pro' ? ' Pro' : ''}</div>
                    </div>
                    <button onClick={() => { setShowProfileMenu(false); navigate('/settings'); }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                      <Settings className="w-4 h-4" /> Settings
                    </button>
                    <button onClick={() => { setShowProfileMenu(false); handleLogout(); }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors border-t border-gray-100">
                      <X className="w-4 h-4" /> Log Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {activeTab === 'dashboard' && (() => {
          return (
          <>
            {/* Heading */}
            <div className="mb-8">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900">Home</h1>
            </div>

            {/* Quick Actions */}
            <div className="mb-10">
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <button
                  onClick={() => setActiveTab('myKits')}
                  className="group flex flex-col items-start gap-3 p-5 bg-white rounded-2xl border border-gray-200 hover:border-red-300 hover:shadow-md transition-all text-left"
                >
                  <div className="w-11 h-11 bg-red-100 group-hover:bg-red-600 rounded-xl flex items-center justify-center transition-colors">
                    <Play className="w-5 h-5 text-red-600 group-hover:text-white transition-colors" strokeWidth={2.5} />
                  </div>
                  <div>
                    <div className="font-black text-gray-900">Start a Game</div>
                    <div className="text-xs text-gray-500 mt-0.5">Pick a kit and host a session</div>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('createKit')}
                  className="group flex flex-col items-start gap-3 p-5 bg-white rounded-2xl border border-gray-200 hover:border-orange-300 hover:shadow-md transition-all text-left"
                >
                  <div className="w-11 h-11 bg-orange-100 group-hover:bg-orange-500 rounded-xl flex items-center justify-center transition-colors">
                    <Plus className="w-5 h-5 text-orange-600 group-hover:text-white transition-colors" strokeWidth={2.5} />
                  </div>
                  <div>
                    <div className="font-black text-gray-900">New Kit</div>
                    <div className="text-xs text-gray-500 mt-0.5">Build a new question set</div>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('classrooms')}
                  className="group flex flex-col items-start gap-3 p-5 bg-white rounded-2xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all text-left"
                >
                  <div className="w-11 h-11 bg-blue-100 group-hover:bg-blue-600 rounded-xl flex items-center justify-center transition-colors">
                    <GraduationCap className="w-5 h-5 text-blue-600 group-hover:text-white transition-colors" strokeWidth={2.5} />
                  </div>
                  <div>
                    <div className="font-black text-gray-900">Manage Classes</div>
                    <div className="text-xs text-gray-500 mt-0.5">View or add a classroom</div>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('stats')}
                  className="group flex flex-col items-start gap-3 p-5 bg-white rounded-2xl border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all text-left"
                >
                  <div className="w-11 h-11 bg-purple-100 group-hover:bg-purple-600 rounded-xl flex items-center justify-center transition-colors">
                    <BarChart3 className="w-5 h-5 text-purple-600 group-hover:text-white transition-colors" strokeWidth={2.5} />
                  </div>
                  <div>
                    <div className="font-black text-gray-900">View Stats</div>
                    <div className="text-xs text-gray-500 mt-0.5">Class & student insights</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Classes */}
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-4">Classes</h2>
              {classrooms.length === 0 ? (
                <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-6 sm:p-8 md:p-12 text-center">
                  <GraduationCap className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-semibold mb-4">No classes yet.</p>
                  <button onClick={() => setActiveTab('classrooms')} className="bg-red-600 text-white px-5 py-2 rounded-lg font-bold hover:bg-red-700 transition-colors text-sm">
                    Create your first class
                  </button>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {classrooms.map(c => (
                    <div key={c.id} onClick={() => navigate(`/classroom/${c.id}`)}
                      className="bg-white rounded-2xl p-5 border border-gray-200 hover:shadow-md hover:border-red-300 transition-all cursor-pointer">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <GraduationCap className="w-5 h-5 text-red-600" strokeWidth={2.5} />
                        </div>
                        <h3 className="font-black text-gray-900 truncate">{c.name}</h3>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {c.student_count || 0} students</span>
                        {c.subject && <span className="bg-gray-100 px-2 py-0.5 rounded-full font-bold">{c.subject}</span>}
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
          !analytics ? (
            <div className="flex flex-col items-center justify-center py-32">
              <BarChart3 className="w-12 h-12 text-red-400 mb-4 animate-pulse" />
              <p className="text-gray-500 font-semibold">Loading analytics...</p>
            </div>
          ) : (() => {
            const allStudents = analytics.students || [];
            const classNames = [...new Set(allStudents.flatMap(s => s.classrooms || []))];
            const filtered = allStudents
              .filter(s => analyticsClassFilter === 'all' || (s.classrooms || []).includes(analyticsClassFilter))
              .filter(s => !analyticsSearch || s.name.toLowerCase().includes(analyticsSearch.toLowerCase()))
              .sort((a, b) => {
                if (analyticsSortBy === 'name') return a.name.localeCompare(b.name);
                if (analyticsSortBy === 'accuracy') return b.accuracy - a.accuracy;
                if (analyticsSortBy === 'questions') return b.total_questions - a.total_questions;
                if (analyticsSortBy === 'games') return b.games_played - a.games_played;
                if (analyticsSortBy === 'assignments') return b.completed_assignments - a.completed_assignments;
                return 0;
              });
            const maxDistCount = Math.max(...(analytics.accuracyDistribution || []).map(d => d.count), 1);
            const distColors = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];

            // Student detail panel helpers
            const detail = selectedStudentDetail;
            const detailStudent = selectedStudent;

            return (
              <div>
                <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-3xl font-black text-gray-900 mb-1">Analytics</h1>
                    <p className="text-gray-500">Performance data for students in your classrooms</p>
                  </div>
                  <a href={`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000'}/api/export/teacher/${user.id}`}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-colors">
                    <BarChart3 className="w-4 h-4" /> Export Report
                  </a>
                </div>

                {/* Summary row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-semibold text-gray-500">Students</span>
                    </div>
                    <p className="text-2xl font-black text-gray-900">{allStudents.length}</p>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="w-4 h-4 text-green-600" />
                      <span className="text-xs font-semibold text-gray-500">Avg Accuracy</span>
                    </div>
                    <p className="text-2xl font-black text-gray-900">{Math.round(analytics.overallAvgAccuracy)}%</p>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="w-4 h-4 text-purple-600" />
                      <span className="text-xs font-semibold text-gray-500">Total Questions</span>
                    </div>
                    <p className="text-2xl font-black text-gray-900">{(analytics.totalQuestionsAnswered || 0).toLocaleString()}</p>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <div className="flex items-center gap-2 mb-1">
                      <GraduationCap className="w-4 h-4 text-orange-600" />
                      <span className="text-xs font-semibold text-gray-500">Classrooms</span>
                    </div>
                    <p className="text-2xl font-black text-gray-900">{(analytics.classPerformance || []).length}</p>
                  </div>
                </div>

                {/* Accuracy distribution */}
                {(analytics.accuracyDistribution || []).some(b => b.count > 0) && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
                    <h2 className="text-sm font-bold text-gray-700 mb-4">Student Accuracy Distribution</h2>
                    <div className="flex items-end gap-3 h-40">
                      {(analytics.accuracyDistribution || []).map((b, i) => {
                        const pct = maxDistCount > 0 ? (b.count / maxDistCount) * 100 : 0;
                        return (
                          <div key={b.range} className="flex-1 flex flex-col items-center h-full">
                            <div className="flex-1 flex flex-col justify-end w-full">
                              <div className="text-center mb-1">
                                <span className="text-xs font-black text-gray-700">{b.count}</span>
                              </div>
                              <div
                                className="w-full rounded-t-lg transition-all duration-500"
                                style={{
                                  height: `${Math.max(pct, b.count > 0 ? 6 : 2)}%`,
                                  backgroundColor: distColors[i]
                                }}
                              />
                            </div>
                            <div className="mt-2 text-center">
                              <span className="text-[10px] font-bold text-gray-500 leading-tight block">{b.range}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="text-center mt-2">
                      <span className="text-[10px] text-gray-400">Accuracy Range</span>
                    </div>
                  </div>
                )}

                {/* Category + Subject Performance */}
                {analytics.categoryBreakdown && analytics.categoryBreakdown.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
                    <h2 className="text-lg font-black text-gray-900 mb-4">Performance by Category</h2>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                      {analytics.categoryBreakdown.map((c, i) => {
                        const isExpanded = expandedCategory === c.category;
                        return (
                          <div key={i} className={`rounded-xl p-4 cursor-pointer transition-all ${isExpanded ? 'bg-red-50 border-2 border-red-200 col-span-full' : 'bg-gray-50 hover:bg-gray-100'}`}
                            onClick={() => setExpandedCategory(isExpanded ? null : c.category)}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-black text-gray-900">{c.category}</span>
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-black ${c.accuracy >= 80 ? 'text-green-600' : c.accuracy >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{c.accuracy}%</span>
                                <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                              </div>
                            </div>
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                              <div className={`h-full rounded-full ${c.accuracy >= 80 ? 'bg-green-500' : c.accuracy >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${c.accuracy}%` }} />
                            </div>
                            <div className="text-[10px] text-gray-400">{c.correct}/{c.total} correct · {c.subjectCount} subject{c.subjectCount !== 1 ? 's' : ''} · {c.subjects?.reduce((s, x) => s + (x.unique_students || 0), 0)} students</div>

                            {/* Expanded detail */}
                            {isExpanded && c.subjects && c.subjects.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-red-200 space-y-3" onClick={e => e.stopPropagation()}>
                                {c.subjects.sort((a, b) => b.total - a.total).map((s, j) => {
                                  const sAcc = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
                                  return (
                                    <div key={j} className="bg-white rounded-lg p-3 border border-gray-200">
                                      <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-xs font-bold text-gray-800">{s.subject}</span>
                                        <span className={`text-xs font-black ${sAcc >= 80 ? 'text-green-600' : sAcc >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{sAcc}%</span>
                                      </div>
                                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1.5">
                                        <div className={`h-full rounded-full ${sAcc >= 80 ? 'bg-green-500' : sAcc >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${sAcc}%` }} />
                                      </div>
                                      <div className="flex items-center justify-between text-[10px] text-gray-400">
                                        <span>{s.correct}/{s.total} correct</span>
                                        <span>{s.unique_students || 0} students</span>
                                        <span>{s.avg_time ? `${Number(s.avg_time).toFixed(1)}s avg` : ''}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Two-column: Question Types + Kit Performance */}
                <div className="grid lg:grid-cols-2 gap-6 mb-6">
                  {/* Question Type Performance */}
                  {analytics.questionTypePerf && analytics.questionTypePerf.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-200 p-6">
                      <h2 className="text-lg font-black text-gray-900 mb-4">Question Types</h2>
                      <div className="space-y-2.5">
                        {analytics.questionTypePerf.map((t, i) => {
                          const labels = { multiple_choice: 'Multiple Choice', true_false: 'True/False', short_answer: 'Short Answer', multi_select: 'Multi-Select', matching: 'Matching', ordering: 'Ordering', image_label: 'Image Label', audio: 'Audio', fill_blank: 'Fill Blank', math_equation: 'Math' };
                          const acc = t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0;
                          return (
                            <div key={i} className="flex items-center gap-2">
                              <div className="w-24 text-xs font-bold text-gray-700 truncate">{labels[t.answer_type] || t.answer_type}</div>
                              <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${acc >= 80 ? 'bg-green-500' : acc >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${acc}%` }} />
                              </div>
                              <div className="w-10 text-xs font-black text-gray-700 text-right">{acc}%</div>
                              <div className="w-14 text-[10px] text-gray-400 text-right">{t.correct}/{t.total}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Kit Performance */}
                  {analytics.kitPerf && analytics.kitPerf.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-200 p-6">
                      <h2 className="text-lg font-black text-gray-900 mb-4">Kit Performance</h2>
                      <div className="space-y-2.5 max-h-80 overflow-y-auto">
                        {analytics.kitPerf.map((k, i) => {
                          const acc = k.q_total > 0 ? Math.round((k.q_correct / k.q_total) * 100) : 0;
                          return (
                            <div key={i} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-gray-800 truncate">{k.title}</div>
                                <div className="text-[10px] text-gray-400">{k.unique_players} students · {k.times_played} plays</div>
                              </div>
                              <div className={`text-xs font-black ${acc >= 80 ? 'text-green-600' : acc >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{acc}%</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Three-column: Hardest Questions + Top Performers + Needs Attention */}
                <div className="grid lg:grid-cols-3 gap-6 mb-6">
                  {/* Hardest Questions */}
                  {analytics.hardestQuestions && analytics.hardestQuestions.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-200 p-6">
                      <h2 className="text-sm font-black text-gray-900 mb-3">Hardest Questions</h2>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {analytics.hardestQuestions.slice(0, 8).map((q, i) => {
                          const acc = q.times_answered > 0 ? Math.round((q.correct / q.times_answered) * 100) : 0;
                          return (
                            <div key={i} className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${acc < 40 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{acc}%</div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-semibold text-gray-800 truncate">{q.question_text}</div>
                                <div className="text-[9px] text-gray-400">{q.kit_name || ''} · {q.correct}/{q.times_answered}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Top Performers */}
                  {analytics.topPerformers && analytics.topPerformers.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-200 p-6">
                      <h2 className="text-sm font-black text-gray-900 mb-3">Top Performers</h2>
                      <div className="space-y-2">
                        {analytics.topPerformers.map((s, i) => (
                          <div key={i} className="flex items-center gap-2.5 p-2 bg-green-50 rounded-lg border border-green-100">
                            <div className="w-6 h-6 rounded-full bg-green-200 flex items-center justify-center text-[10px] font-black text-green-800">#{i + 1}</div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold text-gray-800 truncate">{s.name}</div>
                              <div className="text-[9px] text-gray-400">{s.total_questions} questions</div>
                            </div>
                            <div className="text-xs font-black text-green-700">{Math.round(s.accuracy)}%</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Needs Attention */}
                  {analytics.needsAttention && analytics.needsAttention.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-200 p-6">
                      <h2 className="text-sm font-black text-gray-900 mb-3">Needs Attention</h2>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {analytics.needsAttention.slice(0, 8).map((s, i) => (
                          <div key={i} className="flex items-center gap-2.5 p-2 bg-red-50 rounded-lg border border-red-100">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold text-gray-800 truncate">{s.name}</div>
                              <div className="text-[9px] text-red-500 font-semibold">{s.reason}</div>
                            </div>
                            <div className="text-xs font-black text-red-600">{s.total_questions > 0 ? `${Math.round(s.accuracy)}%` : '--'}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Class Progress Timeline */}
                {analytics.classProgressTimeline && analytics.classProgressTimeline.length > 1 && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
                    <h2 className="text-lg font-black text-gray-900 mb-1">Class Progress</h2>
                    <p className="text-xs text-gray-400 mb-4">Overall class accuracy over the last 16 weeks</p>
                    {(() => {
                      const data = analytics.classProgressTimeline;
                      const svgW = 700, svgH = 220, padL = 40, padR = 20, padT = 20, padB = 40;
                      const chartW = svgW - padL - padR, chartH = svgH - padT - padB;
                      const points = data.map((w, i) => {
                        const acc = w.questions > 0 ? Math.round((w.correct / w.questions) * 100) : 0;
                        return {
                          x: padL + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2),
                          y: padT + chartH - (acc / 100) * chartH,
                          acc, week: w.week_start ? new Date(w.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : w.week,
                          students: w.active_students, games: w.games, questions: w.questions,
                        };
                      });
                      const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
                      const areaPath = linePath + ` L${points[points.length - 1].x},${padT + chartH} L${points[0].x},${padT + chartH} Z`;
                      const firstAcc = points[0]?.acc || 0;
                      const lastAcc = points[points.length - 1]?.acc || 0;
                      const trend = lastAcc - firstAcc;
                      return (
                        <div>
                          <div className="flex items-center gap-4 mb-3">
                            <div className="flex items-center gap-1.5">
                              <div className={`w-2 h-2 rounded-full ${trend >= 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                              <span className={`text-sm font-black ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {trend >= 0 ? '+' : ''}{trend}% overall
                              </span>
                            </div>
                            <span className="text-xs text-gray-400">{firstAcc}% → {lastAcc}%</span>
                          </div>
                          <div className="overflow-x-auto">
                            <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full" style={{ minWidth: 400 }}>
                              {[0, 25, 50, 75, 100].map(v => {
                                const y = padT + chartH - (v / 100) * chartH;
                                return (
                                  <g key={v}>
                                    <line x1={padL} y1={y} x2={svgW - padR} y2={y} stroke="#e5e7eb" strokeWidth="1" />
                                    <text x={padL - 6} y={y + 4} textAnchor="end" fill="#9ca3af" fontSize="10" fontWeight="600">{v}%</text>
                                  </g>
                                );
                              })}
                              <path d={areaPath} fill={trend >= 0 ? '#dcfce7' : '#fee2e2'} />
                              <path d={linePath} fill="none" stroke={trend >= 0 ? '#22c55e' : '#ef4444'} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                              {points.map((p, i) => (
                                <g key={i}>
                                  <circle cx={p.x} cy={p.y} r="4" fill={trend >= 0 ? '#22c55e' : '#ef4444'} stroke="#fff" strokeWidth="2">
                                    <title>{`${p.week}: ${p.acc}% (${p.students} students, ${p.games} games)`}</title>
                                  </circle>
                                  {(i % Math.max(1, Math.floor(data.length / 6)) === 0 || i === data.length - 1) && (
                                    <text x={p.x} y={padT + chartH + 16} textAnchor="middle" fill="#6b7280" fontSize="9" fontWeight="600">{p.week}</text>
                                  )}
                                </g>
                              ))}
                            </svg>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Two-column: Assignment Deadlines + Question Difficulty Map */}
                <div className="grid lg:grid-cols-2 gap-6 mb-6">
                  {/* Assignment Deadlines */}
                  {analytics.assignmentDeadlines && analytics.assignmentDeadlines.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-200 p-6">
                      <h2 className="text-lg font-black text-gray-900 mb-1">Upcoming Deadlines</h2>
                      <p className="text-xs text-gray-400 mb-4">Assignments due soon</p>
                      <div className="space-y-2.5 max-h-96 overflow-y-auto">
                        {analytics.assignmentDeadlines.map((a, i) => {
                          const dueDate = a.due_date ? new Date(a.due_date + 'T' + (a.due_time || '23:59')) : null;
                          const daysLeft = dueDate ? Math.ceil((dueDate - Date.now()) / 86400000) : null;
                          const urgency = daysLeft !== null && daysLeft <= 1 ? 'urgent' : daysLeft !== null && daysLeft <= 3 ? 'soon' : 'normal';
                          const compPct = a.total_students > 0 ? Math.round((a.completed / a.total_students) * 100) : 0;
                          return (
                            <div key={i} className={`p-3 rounded-xl border ${urgency === 'urgent' ? 'bg-red-50 border-red-200' : urgency === 'soon' ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="text-xs font-bold text-gray-900 truncate flex-1 mr-2">{a.title}</div>
                                {daysLeft !== null && (
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap ${urgency === 'urgent' ? 'bg-red-200 text-red-800' : urgency === 'soon' ? 'bg-orange-200 text-orange-800' : 'bg-gray-200 text-gray-700'}`}>
                                    {daysLeft <= 0 ? 'Due today' : daysLeft === 1 ? 'Due tomorrow' : `${daysLeft} days left`}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-[10px] text-gray-500 mb-2">
                                <span>{a.classroom}</span>
                                <span>{a.due_date}{a.due_time ? ` ${a.due_time}` : ''}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${compPct}%` }} />
                                </div>
                                <span className="text-[10px] font-bold text-gray-600">{a.completed}/{a.total_students}</span>
                              </div>
                              {a.not_started > 0 && (
                                <div className="mt-1.5 text-[10px] font-semibold text-red-600">
                                  {a.not_started} student{a.not_started !== 1 ? 's' : ''} haven't started
                                  {a.in_progress > 0 && <span className="text-orange-600"> · {a.in_progress} in progress</span>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Question Difficulty Map */}
                  {analytics.questionDifficultyMap && analytics.questionDifficultyMap.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-200 p-6">
                      <h2 className="text-lg font-black text-gray-900 mb-1">Question Difficulty Map</h2>
                      <p className="text-xs text-gray-400 mb-4">Questions your students struggle with most — consider re-teaching these</p>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {analytics.questionDifficultyMap.map((q, i) => {
                          const acc = q.times_answered > 0 ? Math.round((q.correct / q.times_answered) * 100) : 0;
                          const failRate = 100 - acc;
                          return (
                            <div key={i} className="p-3 bg-gray-50 rounded-xl">
                              <div className="flex items-start gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0 ${acc < 30 ? 'bg-red-100 text-red-700' : acc < 50 ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                  {failRate}%
                                  <div className="text-[7px] font-bold opacity-60 ml-0.5">fail</div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-bold text-gray-800 leading-snug">{q.question_text}</div>
                                  <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                                    <span className="font-semibold">{q.kit_name || ''}</span>
                                    {q.subject && <span>· {q.subject}</span>}
                                    <span>· {q.correct}/{q.times_answered} correct</span>
                                    <span>· {q.unique_students} students</span>
                                    {q.avg_time && <span>· {Number(q.avg_time).toFixed(1)}s avg</span>}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Assignment Completion Overview */}
                {analytics.assignmentPerf && analytics.assignmentPerf.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
                    <h2 className="text-lg font-black text-gray-900 mb-4">Assignment Completion</h2>
                    <div className="space-y-2.5 max-h-80 overflow-y-auto">
                      {analytics.assignmentPerf.map((a, i) => {
                        const compPct = a.total_students > 0 ? Math.round((a.completed / a.total_students) * 100) : 0;
                        return (
                          <div key={i} className="p-3 bg-gray-50 rounded-xl">
                            <div className="flex items-center justify-between mb-1">
                              <div className="text-xs font-bold text-gray-800 truncate flex-1">{a.title}</div>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${compPct >= 80 ? 'bg-green-100 text-green-700' : compPct >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                {compPct}% done
                              </span>
                            </div>
                            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mb-1">
                              <div className={`h-full rounded-full ${compPct >= 80 ? 'bg-green-500' : compPct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${compPct}%` }} />
                            </div>
                            <div className="text-[9px] text-gray-400">{a.classroom} · {a.completed}/{a.total_students} · Due {a.due_date || 'N/A'}{a.avg_accuracy ? ` · Avg ${Math.round(a.avg_accuracy)}%` : ''}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Recent Games */}
                {analytics.recentGames && analytics.recentGames.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
                    <h2 className="text-lg font-black text-gray-900 mb-4">Recent Games</h2>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-2 px-3 text-xs font-bold text-gray-500 uppercase">Kit</th>
                            <th className="text-left py-2 px-3 text-xs font-bold text-gray-500 uppercase">Mode</th>
                            <th className="text-right py-2 px-3 text-xs font-bold text-gray-500 uppercase">Players</th>
                            <th className="text-right py-2 px-3 text-xs font-bold text-gray-500 uppercase">Avg Score</th>
                            <th className="text-right py-2 px-3 text-xs font-bold text-gray-500 uppercase">Accuracy</th>
                            <th className="text-right py-2 px-3 text-xs font-bold text-gray-500 uppercase">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analytics.recentGames.map((g, i) => {
                            const acc = g.total > 0 ? Math.round((g.correct / g.total) * 100) : 0;
                            return (
                              <tr
                                key={i}
                                onClick={() => {
                                  if (teacherTier === 'teacher_pro' && g.game_code) {
                                    setSelectedGameCode(g.game_code);
                                  }
                                }}
                                className={`border-b border-gray-100 last:border-0 ${
                                  teacherTier === 'teacher_pro' && g.game_code
                                    ? 'cursor-pointer hover:bg-red-50 transition-colors'
                                    : 'hover:bg-gray-50'
                                }`}
                              >
                                <td className="py-2 px-3 font-semibold text-gray-800 truncate max-w-[150px]">{g.kit || 'Unknown'}</td>
                                <td className="py-2 px-3 text-gray-600">{getGameModeName(g.game_mode)}</td>
                                <td className="py-2 px-3 text-right font-bold text-gray-700">{g.players}</td>
                                <td className="py-2 px-3 text-right font-bold text-gray-700">{g.avg_score ? Math.round(g.avg_score) : '--'}</td>
                                <td className="py-2 px-3 text-right">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${acc >= 80 ? 'bg-green-100 text-green-700' : acc >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{acc}%</span>
                                </td>
                                <td className="py-2 px-3 text-right text-gray-500 text-xs whitespace-nowrap">{g.created_at ? new Date(g.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '--'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Filters + student table */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
                  <div className="p-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
                    <h2 className="text-lg font-black text-gray-900 mr-auto">Student Roster</h2>
                    <input
                      type="text" placeholder="Search students..."
                      value={analyticsSearch} onChange={e => setAnalyticsSearch(e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-red-500 w-48"
                    />
                    {classNames.length > 1 && (
                      <div className="flex bg-gray-100 rounded-lg p-0.5">
                        <button onClick={() => setAnalyticsClassFilter('all')}
                          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${analyticsClassFilter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                          All Classes
                        </button>
                        {classNames.map(c => (
                          <button key={c} onClick={() => setAnalyticsClassFilter(c)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${analyticsClassFilter === c ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                            {c}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex bg-gray-100 rounded-lg p-0.5">
                      {[['name', 'Name'], ['accuracy', 'Accuracy'], ['questions', 'Questions'], ['games', 'Games'], ['assignments', 'Assignments']].map(([val, label]) => (
                        <button key={val} onClick={() => setAnalyticsSortBy(val)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${analyticsSortBy === val ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {filtered.length === 0 ? (
                    <div className="p-6 sm:p-8 md:p-12 text-center">
                      <Users className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                      <p className="text-gray-400 font-semibold text-sm">{analyticsSearch ? 'No students match your search' : 'No students in your classrooms yet'}</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left py-3 px-4 font-bold text-gray-500 uppercase text-xs">Student</th>
                            <th className="text-center py-3 px-3 font-bold text-gray-500 uppercase text-xs">Accuracy</th>
                            <th className="text-center py-3 px-3 font-bold text-gray-500 uppercase text-xs">Questions</th>
                            <th className="text-center py-3 px-3 font-bold text-gray-500 uppercase text-xs">Games</th>
                            <th className="text-center py-3 px-3 font-bold text-gray-500 uppercase text-xs">Avg Speed</th>
                            <th className="text-center py-3 px-3 font-bold text-gray-500 uppercase text-xs">Assignments</th>
                            <th className="text-center py-3 px-3 font-bold text-gray-500 uppercase text-xs">Last Active</th>
                            <th className="text-center py-3 px-3 font-bold text-gray-500 uppercase text-xs w-16"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map(s => (
                            <tr key={s.id}
                              onClick={() => setSelectedStudent(s)}
                              className={`border-b border-gray-100 cursor-pointer transition-colors ${selectedStudent?.id === s.id ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <AvatarPreview skinId={studentSkins[s.id] || 'default'} initial={s.name?.[0]?.toUpperCase() || '?'} size={32} isPlus={s.subscription_tier === 'blazes_plus'} />
                                  <div>
                                    <div className="font-bold text-gray-900">{s.name}</div>
                                    <div className="text-[10px] text-gray-400">{(s.classrooms || []).join(', ')}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-3 text-center">
                                {s.total_questions > 0 ? (
                                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                                    s.accuracy >= 75 ? 'bg-green-100 text-green-700' :
                                    s.accuracy >= 50 ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-red-100 text-red-700'
                                  }`}>{Math.round(s.accuracy)}%</span>
                                ) : <span className="text-xs text-gray-300">--</span>}
                              </td>
                              <td className="py-3 px-3 text-center font-semibold text-gray-700">{s.total_questions}</td>
                              <td className="py-3 px-3 text-center font-semibold text-gray-700">{s.games_played}</td>
                              <td className="py-3 px-3 text-center text-gray-600">{s.avg_speed > 0 ? `${s.avg_speed}s` : '--'}</td>
                              <td className="py-3 px-3 text-center">
                                <span className="font-semibold text-gray-700">{s.completed_assignments}/{s.total_assignments}</span>
                              </td>
                              <td className="py-3 px-3 text-center text-xs text-gray-500">
                                {s.last_active ? (() => {
                                  const diff = (Date.now() - new Date(s.last_active).getTime()) / 1000;
                                  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
                                  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
                                  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
                                  return new Date(s.last_active).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                })() : '--'}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <a href={`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000'}/api/export/teacher/${user.id}/student/${s.id}`}
                                  onClick={e => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 rounded-lg text-[10px] font-bold hover:bg-red-100 transition-colors"
                                  title="Export student report">
                                  <BarChart3 className="w-3 h-3" /> Export
                                </a>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Student detail panel */}
                {detailStudent && (
                  <div className="bg-white rounded-2xl border-2 border-red-200 overflow-hidden">
                    <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-red-50">
                      <div className="flex items-center gap-3">
                        <AvatarPreview skinId={studentSkins[detailStudent.id] || 'default'} initial={detailStudent.name?.[0]?.toUpperCase() || '?'} size={40} isPlus={detailStudent.subscription_tier === 'blazes_plus'} />
                        <div>
                          <h3 className="font-black text-gray-900">{detailStudent.name}</h3>
                          <p className="text-xs text-gray-500">{(detailStudent.classrooms || []).join(', ')} · {detailStudent.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a href={`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000'}/api/export/teacher/${user.id}/student/${detailStudent.id}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors">
                          <BarChart3 className="w-3.5 h-3.5" /> Export
                        </a>
                        <button onClick={() => { setSelectedStudent(null); setSelectedStudentDetail(null); }}
                          className="p-2 hover:bg-red-100 rounded-lg transition-colors">
                          <X className="w-5 h-5 text-gray-500" />
                        </button>
                      </div>
                    </div>

                    {!detail ? (
                      <div className="p-6 sm:p-8 md:p-12 text-center">
                        <BarChart3 className="w-8 h-8 text-gray-300 mx-auto mb-2 animate-pulse" />
                        <p className="text-gray-400 text-sm">Loading student data...</p>
                      </div>
                    ) : (
                      <div className="p-5">
                        {/* Detail stat cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                          <div className="bg-gray-50 rounded-xl p-3 text-center">
                            <div className="text-lg font-black text-gray-900">{detailStudent.games_played}</div>
                            <div className="text-[10px] font-semibold text-gray-500">Games</div>
                          </div>
                          <div className="bg-gray-50 rounded-xl p-3 text-center">
                            <div className="text-lg font-black text-gray-900">{Math.round(detailStudent.accuracy)}%</div>
                            <div className="text-[10px] font-semibold text-gray-500">Accuracy</div>
                          </div>
                          <div className="bg-gray-50 rounded-xl p-3 text-center">
                            <div className="text-lg font-black text-gray-900">{detail.longestStreak || 0}</div>
                            <div className="text-[10px] font-semibold text-gray-500">Best Streak</div>
                          </div>
                          <div className="bg-gray-50 rounded-xl p-3 text-center">
                            <div className="text-lg font-black text-gray-900">{detail.speedStats?.avg_time_per_question || 0}s</div>
                            <div className="text-[10px] font-semibold text-gray-500">Avg Speed</div>
                          </div>
                        </div>

                        {/* Accuracy trend line (last 28 days) */}
                        {(() => {
                          const raw = detail.accuracyByDate || [];
                          if (raw.length === 0) return null;
                          const cutoff = new Date(Date.now() - 28 * 86400000).toISOString().split('T')[0];
                          const filtered = raw.filter(d => d.date >= cutoff);
                          if (filtered.length === 0) return null;
                          // Bucket into ~7 periods
                          const bucketSize = Math.max(1, Math.ceil(28 / 7));
                          const startDate = new Date(cutoff);
                          const buckets = [];
                          for (let i = 0; i < 7; i++) {
                            const bStart = new Date(startDate.getTime() + i * bucketSize * 86400000).toISOString().split('T')[0];
                            const bEnd = new Date(startDate.getTime() + (i + 1) * bucketSize * 86400000).toISOString().split('T')[0];
                            const inB = filtered.filter(d => d.date >= bStart && d.date < bEnd);
                            const total = inB.reduce((s, d) => s + d.total, 0);
                            const correct = inB.reduce((s, d) => s + d.correct, 0);
                            if (total > 0) buckets.push({ label: new Date(bStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), accuracy: Math.round(correct * 1000 / total) / 10 });
                          }
                          if (buckets.length < 2) return null;
                          const svgW = 600, svgH = 120, pad = 30;
                          const cW = svgW - pad * 2, cH = svgH - pad * 2;
                          const pts = buckets.map((b, i) => ({
                            x: pad + (i / (buckets.length - 1)) * cW,
                            y: pad + cH - (b.accuracy / 100) * cH,
                            ...b
                          }));
                          const line = pts.map(p => `${p.x},${p.y}`).join(' ');
                          return (
                            <div className="mb-5">
                              <h4 className="text-xs font-bold text-gray-500 mb-2">ACCURACY TREND (LAST 28 DAYS)</h4>
                              <svg viewBox={`0 0 ${svgW} ${svgH + 15}`} className="w-full">
                                {[0, 50, 100].map(v => (
                                  <g key={v}>
                                    <line x1={pad} y1={pad + cH - (v / 100) * cH} x2={pad + cW} y2={pad + cH - (v / 100) * cH} stroke="#f3f4f6" strokeWidth="1" />
                                    <text x={pad - 4} y={pad + cH - (v / 100) * cH + 3} textAnchor="end" fill="#9ca3af" fontSize="9">{v}%</text>
                                  </g>
                                ))}
                                <polygon points={`${pts[0].x},${pad + cH} ${line} ${pts[pts.length - 1].x},${pad + cH}`} fill="#dbeafe" opacity="0.5" />
                                <polyline points={line} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" />
                                {pts.map((p, i) => (
                                  <g key={i}>
                                    <circle cx={p.x} cy={p.y} r="3.5" fill="#3b82f6" stroke="white" strokeWidth="1.5">
                                      <title>{`${p.label}: ${p.accuracy}%`}</title>
                                    </circle>
                                    {i % 2 === 0 && <text x={p.x} y={pad + cH + 12} textAnchor="middle" fill="#9ca3af" fontSize="8">{p.label}</text>}
                                  </g>
                                ))}
                              </svg>
                            </div>
                          );
                        })()}

                        {/* Subject performance + recent games */}
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-xs font-bold text-gray-500 mb-2">SUBJECT PERFORMANCE</h4>
                            {(detail.subjectPerformance || []).length === 0 ? (
                              <p className="text-xs text-gray-400">No subject data</p>
                            ) : (
                              <div className="space-y-2">
                                {(detail.subjectPerformance || []).map(sub => (
                                  <div key={sub.subject} className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-gray-700 w-20 truncate">{sub.subject}</span>
                                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                                      <div className="h-full rounded-full" style={{
                                        width: `${Math.round(sub.accuracy)}%`,
                                        backgroundColor: sub.accuracy >= 75 ? '#22c55e' : sub.accuracy >= 50 ? '#eab308' : '#ef4444'
                                      }} />
                                    </div>
                                    <span className="text-xs font-bold text-gray-600 w-10 text-right">{Math.round(sub.accuracy)}%</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-gray-500 mb-2">RECENT GAMES</h4>
                            {(detail.recentGames || []).length === 0 ? (
                              <p className="text-xs text-gray-400">No games played</p>
                            ) : (
                              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                {(detail.recentGames || []).slice(0, 5).map((g, i) => (
                                  <div
                                    key={i}
                                    onClick={() => {
                                      if (teacherTier === 'teacher_pro' && g.game_code) {
                                        setSelectedGameCode(g.game_code);
                                      }
                                    }}
                                    className={`flex items-center gap-2 text-xs ${
                                      teacherTier === 'teacher_pro' && g.game_code
                                        ? 'cursor-pointer hover:bg-red-50 p-1.5 rounded transition-colors'
                                        : ''
                                    }`}
                                  >
                                    <span className="font-semibold text-gray-700 flex-1 truncate">{g.kit_title || 'Game'}</span>
                                    <span className={`px-1.5 py-0.5 rounded font-bold ${
                                      g.accuracy >= 75 ? 'bg-green-100 text-green-700' :
                                      g.accuracy >= 50 ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-red-100 text-red-700'
                                    }`}>{Math.round(g.accuracy)}%</span>
                                    <span className="text-gray-400 w-14 text-right">{g.score}pts</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()
        )}

        {/* Game Details Modal (Pro Feature) */}
        {selectedGameCode && gameDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-gray-900">Game Details</h2>
                  <p className="text-sm text-gray-500 mt-1">Game Code: <span className="font-mono font-bold">{selectedGameCode}</span></p>
                </div>
                <button
                  onClick={() => setSelectedGameCode(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>

              {loadingGameDetails ? (
                <div className="p-6 sm:p-8 md:p-12 text-center">
                  <BarChart3 className="w-8 h-8 text-gray-300 mx-auto mb-2 animate-pulse" />
                  <p className="text-gray-400 text-sm">Loading game details...</p>
                </div>
              ) : gameDetails ? (
                <div className="p-6 space-y-6">
                  {/* Basic Info Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-blue-50 rounded-xl p-4">
                      <div className="text-xs font-bold text-blue-600 uppercase mb-1">Mode</div>
                      <div className="text-lg font-black text-blue-900">{getGameModeName(gameDetails.game_mode)}</div>
                    </div>
                    <div className="bg-green-50 rounded-xl p-4">
                      <div className="text-xs font-bold text-green-600 uppercase mb-1">Players</div>
                      <div className="text-lg font-black text-green-900">{gameDetails.players || 0}</div>
                    </div>
                    <div className="bg-purple-50 rounded-xl p-4">
                      <div className="text-xs font-bold text-purple-600 uppercase mb-1">Avg Score</div>
                      <div className="text-lg font-black text-purple-900">{gameDetails.avg_score ? Math.round(gameDetails.avg_score) : '--'}</div>
                    </div>
                    <div className="bg-orange-50 rounded-xl p-4">
                      <div className="text-xs font-bold text-orange-600 uppercase mb-1">Accuracy</div>
                      <div className="text-lg font-black text-orange-900">
                        {gameDetails.total > 0 ? Math.round((gameDetails.correct / gameDetails.total) * 100) : '--'}%
                      </div>
                    </div>
                  </div>

                  {/* Questions Breakdown */}
                  {gameDetails.total > 0 && (
                    <div className="border border-gray-200 rounded-2xl p-4">
                      <h3 className="font-bold text-gray-900 mb-4">Overall Questions Performance</h3>
                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-gray-600">Overall Accuracy</span>
                            <span className="font-bold text-gray-900">{gameDetails.correct}/{gameDetails.total}</span>
                          </div>
                          <div className="bg-gray-100 rounded-full h-3 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all"
                              style={{ width: `${(gameDetails.correct / gameDetails.total) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Kit Information */}
                  {gameDetails.kit_title && (
                    <div className="border border-gray-200 rounded-2xl p-4">
                      <h3 className="font-bold text-gray-900 mb-3">Kit Information</h3>
                      <div className="text-sm text-gray-700">
                        <div className="flex items-center justify-between py-2 border-b border-gray-100">
                          <span className="text-gray-600">Kit Name</span>
                          <span className="font-semibold">{gameDetails.kit_title}</span>
                        </div>
                        {gameDetails.created_at && (
                          <div className="flex items-center justify-between py-2">
                            <span className="text-gray-600">Played On</span>
                            <span className="font-semibold">
                              {new Date(gameDetails.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Player Details */}
                  {gameDetails.participants && gameDetails.participants.length > 0 && (
                    <div className="border border-gray-200 rounded-2xl p-4">
                      <h3 className="font-bold text-gray-900 mb-4">Player Performance</h3>
                      <div className="space-y-3">
                        {gameDetails.participants.map((p, idx) => (
                          <div key={idx} className="border border-gray-100 rounded-lg overflow-hidden">
                            <button
                              onClick={() => setExpandedPlayerIndex(expandedPlayerIndex === idx ? null : idx)}
                              className="w-full p-4 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
                            >
                              <div className="flex-1 text-left">
                                <div className="font-bold text-gray-900">{p.player_name || p.user_name || 'Anonymous'}</div>
                                <div className="text-xs text-gray-600 mt-1 flex items-center gap-4">
                                  <span>
                                    <strong>{p.correct_answers}/{p.total_answered}</strong> correct
                                  </span>
                                  <span>
                                    <strong>{p.accuracy}%</strong> accuracy
                                  </span>
                                  <span>
                                    <strong>{p.score}</strong> points
                                  </span>
                                </div>
                              </div>
                              <ChevronRight className={`w-5 h-5 text-gray-500 transition-transform ${expandedPlayerIndex === idx ? 'rotate-90' : ''}`} />
                            </button>

                            {/* Expanded player details */}
                            {expandedPlayerIndex === idx && p.answers && p.answers.length > 0 && (
                              <div className="p-4 border-t border-gray-100 bg-white">
                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                  {p.answers.map((ans, ansIdx) => (
                                    <div key={ansIdx} className={`p-3 rounded-lg border-l-4 ${
                                      ans.is_correct 
                                        ? 'bg-green-50 border-green-500' 
                                        : 'bg-red-50 border-red-500'
                                    }`}>
                                      <div className="flex items-start gap-2">
                                        <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5 ${
                                          ans.is_correct ? 'bg-green-500' : 'bg-red-500'
                                        }`}>
                                          {ans.is_correct ? '✓' : '✗'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="text-xs font-semibold text-gray-600 mb-1">
                                            Question {ansIdx + 1}
                                          </div>
                                          <div className="text-sm text-gray-700 mb-2 break-words">
                                            {ans.question_text || 'Question text not available'}
                                          </div>
                                          {ans.time_taken > 0 && (
                                            <div className="text-xs text-gray-500">
                                              Time: {ans.time_taken}s
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-6 sm:p-8 md:p-12 text-center">
                  <p className="text-gray-400 text-sm">Game details not found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'classrooms' && (
          <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="text-3xl font-black text-gray-900 mb-1">Classrooms</h1>
                <p className="text-gray-500">Manage your classes and assign homework</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={async () => {
                  setGoogleLoading(true);
                  setGoogleImportResult(null);
                  setShowGoogleImport(true);
                  const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
                  try {
                    const res = await fetch(`${base}/api/google-classroom/courses`, { credentials: 'include' });
                    if (res.status === 401) {
                      window.location.href = `${base}/auth/google/classroom`;
                      return;
                    }
                    const data = await res.json();
                    setGoogleCourses(Array.isArray(data) ? data : []);
                  } catch (_) {
                    window.location.href = `${base}/auth/google/classroom`;
                  } finally { setGoogleLoading(false); }
                }}
                  className="bg-white border-2 border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-bold hover:bg-gray-50 hover:border-gray-300 flex items-center gap-2.5 text-sm transition-colors">
                  <span className="w-6 h-6 rounded-md bg-white ring-1 ring-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                    <img src="/google-classroom.svg" className="w-5 h-5 object-contain" alt="Google Classroom" />
                  </span>
                  Import from Google Classroom
                </button>
                <button onClick={() => setShowCreateClassroom(true)}
                  className="bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-red-700 flex items-center gap-2 text-sm">
                  <Plus className="w-4 h-4" /> New Classroom
                </button>
              </div>
            </div>

            {classrooms.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 sm:p-8 md:p-12 text-center border border-gray-200">
                <GraduationCap className="w-14 h-14 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 font-semibold mb-1">No classrooms yet</p>
                <p className="text-gray-400 text-sm">Create a classroom to organize students and assign homework</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {classrooms.map(c => (
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
                    <div className="p-5">
                    <h3 className="font-black text-gray-900 text-lg mb-1">{c.name}</h3>
                    <div className="flex gap-2 mb-3">
                      {c.subject && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">{c.subject}</span>}
                      {c.grade_level && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-bold">{c.grade_level}</span>}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <Users className="w-4 h-4" />
                      <span className="font-semibold">{c.student_count} student{c.student_count !== 1 ? 's' : ''}</span>
                    </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Create Classroom Modal */}
            {showCreateClassroom && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateClassroom(false)}>
                <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
                  <h2 className="text-2xl font-black text-gray-900 mb-6">New Classroom</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Classroom Name *</label>
                      <input type="text" value={newClassroom.name} onChange={e => setNewClassroom({ ...newClassroom, name: e.target.value })}
                        placeholder="e.g., Period 3 Math" className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-red-500 focus:outline-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Subject</label>
                        <SubjectPicker value={newClassroom.subject} onChange={(v) => setNewClassroom({ ...newClassroom, subject: v })} />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Grade Level <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
                        <GradePicker value={newClassroom.gradeLevel} onChange={(v) => setNewClassroom({ ...newClassroom, gradeLevel: v })} />
                      </div>
                    </div>
                    {/* Class Image */}
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Class Image <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
                      {newClassroom.imageUrl && (
                        <div className="relative mb-2">
                          <img src={newClassroom.imageUrl} alt="" className="w-full h-32 object-cover rounded-xl border border-gray-200" />
                          <button onClick={() => setNewClassroom({ ...newClassroom, imageUrl: '' })}
                            className="absolute top-2 right-2 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center text-xs hover:bg-black/80">×</button>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <input type="text" value={newClassroom.imageUrl} onChange={e => setNewClassroom({ ...newClassroom, imageUrl: e.target.value })}
                          placeholder="Paste image URL..." className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-xs focus:border-red-500 focus:outline-none" />
                        <label className="px-3 py-2 bg-gray-100 text-gray-700 border-2 border-gray-200 rounded-xl text-xs font-bold cursor-pointer hover:bg-gray-200">
                          Upload
                          <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                            const file = e.target.files?.[0]; if (!file) return;
                            const reader = new FileReader();
                            reader.onload = async () => {
                              const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
                              const res = await fetch(`${base}/api/upload-image`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageData: reader.result }) });
                              const data = await res.json();
                              if (data.url) setNewClassroom(prev => ({ ...prev, imageUrl: data.url }));
                            };
                            reader.readAsDataURL(file);
                            e.target.value = '';
                          }} />
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button onClick={() => setShowCreateClassroom(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl">Cancel</button>
                    <button onClick={async () => {
                      if (!newClassroom.name) return;
                      const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
                      await fetch(`${base}/api/classrooms`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ teacherId: user.id, name: newClassroom.name, subject: newClassroom.subject, gradeLevel: newClassroom.gradeLevel, imageUrl: newClassroom.imageUrl })
                      });
                      setShowCreateClassroom(false);
                      setNewClassroom({ name: '', subject: '', gradeLevel: '', imageUrl: '' });
                      fetch(`${base}/api/classrooms/teacher/${user.id}`).then(r => r.json()).then(setClassrooms);
                    }} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700">Create</button>
                  </div>
                </div>
              </div>
            )}

            {/* Google Classroom Import Modal */}
            {showGoogleImport && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowGoogleImport(false)}>
                <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-3 mb-6">
                    <span className="w-10 h-10 rounded-xl bg-white ring-1 ring-gray-200 flex items-center justify-center overflow-hidden shadow-sm shrink-0">
                      <img src="/google-classroom.svg" className="w-8 h-8 object-contain" alt="Google Classroom" />
                    </span>
                    <h2 className="text-2xl font-black text-gray-900">Import from Google Classroom</h2>
                  </div>

                  {googleImportResult ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-green-50 border-2 border-green-200 rounded-xl">
                        <p className="font-bold text-green-800">Imported "{googleImportResult.courseName}"</p>
                        <p className="text-sm text-green-700 mt-1">Sent invites to {googleImportResult.added} of {googleImportResult.total} students. They'll join the classroom once they accept.</p>
                      </div>
                      {googleImportResult.notFound?.length > 0 && (
                        <div className="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-xl">
                          <p className="font-bold text-yellow-800 mb-2">{googleImportResult.notFound.length} student{googleImportResult.notFound.length !== 1 ? 's' : ''} don't have a Blazes account yet</p>
                          <p className="text-xs text-yellow-700 mb-3">Ask them to sign up, then add them to the classroom manually.</p>
                          <div className="max-h-40 overflow-y-auto space-y-1">
                            {googleImportResult.notFound.map((s, i) => (
                              <div key={i} className="text-xs text-gray-700 bg-white rounded px-2 py-1">
                                {s.name ? <span className="font-semibold">{s.name}</span> : null}
                                {s.name ? <span className="text-gray-400"> · </span> : null}
                                <span>{s.email}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <button onClick={() => { setGoogleImportResult(null); setShowGoogleImport(false); }}
                        className="w-full py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 text-sm">Done</button>
                    </div>
                  ) : googleLoading ? (
                    <div className="py-12 text-center text-gray-500">Loading your classes...</div>
                  ) : googleCourses.length === 0 ? (
                    <div className="py-12 text-center">
                      <p className="text-gray-500 mb-4">No active classes found, or you need to connect Google Classroom.</p>
                      <button onClick={() => {
                        const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
                        window.location.href = `${base}/auth/google/classroom`;
                      }} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-700">
                        Connect Google Classroom
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-500 mb-4">Select a class to import its students into Blazes:</p>
                      {googleCourses.map(course => (
                        <button key={course.id} disabled={importingCourse === course.id}
                          onClick={async () => {
                            setImportingCourse(course.id);
                            const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
                            try {
                              const importRes = await fetch(`${base}/api/google-classroom/import`, {
                                method: 'POST',
                                credentials: 'include',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ courseId: course.id, courseName: course.name })
                              });
                              if (importRes.status === 401) {
                                window.location.href = `${base}/auth/google/classroom`;
                                return;
                              }
                              const result = await importRes.json();
                              if (!importRes.ok) throw new Error(result.error || 'Import failed');
                              setGoogleImportResult({ ...result, courseName: course.name });
                              fetch(`${base}/api/classrooms/teacher/${user.id}`).then(r => r.json()).then(setClassrooms);
                            } catch (err) {
                              setToast({ show: true, message: 'Import failed: ' + err.message, type: 'error' });
                            } finally { setImportingCourse(null); }
                          }}
                          className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all text-left disabled:opacity-50">
                          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                            <GraduationCap className="w-5 h-5 text-green-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-gray-900 truncate">{course.name}</div>
                            <div className="text-xs text-gray-500">{course.section || ''} {course.descriptionHeading || ''}</div>
                          </div>
                          <span className="text-xs font-bold text-blue-600 flex-shrink-0">
                            {importingCourse === course.id ? 'Importing...' : 'Import'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  <button onClick={() => setShowGoogleImport(false)}
                    className="w-full mt-6 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 text-sm">Close</button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'createKit' && (
          <CreateKit
            user={user}
            onBack={() => setActiveTab('dashboard')}
            onKitCreated={() => {
              setActiveTab('myKits');
              // Refresh kits list
              fetch(`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000'}/api/kits/teacher/${user.id}`)
                .then(res => res.json())
                .then(data => setKits(data))
                .catch(err => console.error('Error refreshing kits:', err));
            }}
          />
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
            onBBChange={(newBalance) => setBlazesBucks(newBalance)}
            onSkinEquip={(skinId) => setEquippedSkinId(skinId)}
          />
        )}

        {activeTab === 'achievements' && user && (
          <AchievementsMap userId={user.id} />
        )}

        {activeTab === 'myKits' && (
          <>
            <div className="mb-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 mb-2 flex items-center gap-3">
                    <BookOpen className="w-7 h-7 sm:w-8 sm:h-8 text-red-600" strokeWidth={2.5} />
                    My Question Kits
                  </h1>
                  <p className="text-gray-600">Manage and organize your question kits</p>
                </div>
                <button
                  onClick={() => setActiveTab('createKit')}
                  className="bg-gradient-to-r from-red-600 to-orange-500 text-white px-4 sm:px-6 py-3 rounded-xl font-bold hover:shadow-lg transition-all flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  New Kit
                </button>
              </div>

              {kitsLoading ? (
                // Skeleton cards so the user never sees the empty state during the
                // initial fetch. Renders three placeholders that look like real cards.
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                      <div className="h-6 w-3/4 bg-gray-200 rounded-md mb-3 animate-pulse" />
                      <div className="flex gap-2 mb-4">
                        <div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse" />
                        <div className="h-5 w-12 bg-gray-200 rounded-full animate-pulse" />
                      </div>
                      <div className="h-4 w-1/2 bg-gray-100 rounded mb-2 animate-pulse" />
                      <div className="h-9 w-full bg-gray-100 rounded-lg mt-4 animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : kits.length === 0 ? (
                <div className="bg-white rounded-2xl p-6 sm:p-8 md:p-12 text-center shadow-sm border border-gray-200">
                  <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 font-semibold mb-2">No kits yet</p>
                  <p className="text-gray-500 text-sm">Create your first question kit to get started</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {kits.map((kit) => (
                    <div key={kit.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                      <div className="mb-4">
                        <h3 className="text-xl font-black text-gray-900 mb-2">{kit.title}</h3>
                        <div className="flex gap-2 mb-3">
                          <span className="px-3 py-1 bg-red-100 text-red-600 rounded-full text-xs font-bold">
                            {kit.subject}
                          </span>
                          <span className="px-3 py-1 bg-blue-100 text-blue-600 rounded-full text-xs font-bold">
                            {kit.grade_level}
                          </span>
                        </div>
                        <p className="text-gray-600 text-sm mb-3 line-clamp-2">{kit.description}</p>
                        <div className="text-sm text-gray-500">
                          <span className="font-semibold text-gray-900">{kit.question_count || 0}</span> questions
                        </div>
                      </div>

                      <div className="flex gap-2 pt-4 border-t border-gray-200">
                        <button
                          onClick={() => navigate('/game/mode-select', { state: { kit, user } })}
                          className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white py-2.5 rounded-lg font-black hover:bg-red-700 transition-colors text-sm"
                        >
                          <Play className="w-4 h-4" strokeWidth={2.5} />
                          Play
                        </button>
                        <div className="relative group">
                          <button
                            onClick={() => navigate(`/flashcards/${kit.id}`)}
                            aria-label="Flashcards"
                            className="p-2.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            <Layers className="w-4 h-4" />
                          </button>
                          <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gray-900 text-white text-xs font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                            Flashcards
                          </span>
                        </div>
                        <div className="relative group">
                          <button
                            onClick={async () => {
                              try {
                                const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000'}/api/kits/${kit.id}`);
                                const kitDetails = await response.json();
                                setSelectedKit(kitDetails);
                                setShowQuestionsModal(true);
                              } catch (error) {
                                console.error('Error fetching kit details:', error);
                              }
                            }}
                            aria-label="Questions"
                            className="p-2.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            <BookOpen className="w-4 h-4" />
                          </button>
                          <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gray-900 text-white text-xs font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                            Questions
                          </span>
                        </div>
                        <div className="relative group">
                          <button
                            onClick={() => { setEditingKit(kit); setShowEditModal(true); }}
                            aria-label="Edit"
                            className="p-2.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                          <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gray-900 text-white text-xs font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                            Edit
                          </span>
                        </div>
                        <div className="relative group">
                          <button
                            onClick={() => setDeleteConfirm(kit.id)}
                            aria-label="Delete"
                            className="p-2.5 bg-gray-100 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gray-900 text-white text-xs font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                            Delete
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Edit Modal */}
            {showEditModal && editingKit && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl p-8 max-w-md w-full">
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
                      <SubjectPicker value={editingKit.subject} onChange={(v) => setEditingKit({ ...editingKit, subject: v })} />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-2">Grade Level</label>
                      <GradePicker value={editingKit.grade_level} onChange={(v) => setEditingKit({ ...editingKit, grade_level: v })} />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-2">Description</label>
                      <textarea
                        value={editingKit.description}
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
                            // Update the kit in the kits array
                            setKits(kits.map(k => k.id === editingKit.id ? editingKit : k));
                            setShowEditModal(false);
                            setEditingKit(null);
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

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl p-8 max-w-md w-full">
                  <h2 className="text-2xl font-black text-gray-900 mb-4">Delete Kit?</h2>
                  <p className="text-gray-600 mb-6">
                    Are you sure you want to delete this kit? This action cannot be undone.
                  </p>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        // Optimistic: drop from local state immediately, fire DELETE
                        // in the background. If it fails, slot the kit back in.
                        const kitId = deleteConfirm;
                        const kitsBefore = kits;
                        setKits(kits.filter(k => k.id !== kitId));
                        setDeleteConfirm(null);
                        const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
                        fetch(`${base}/api/kits/${kitId}`, { method: 'DELETE' })
                          .then(r => { if (!r.ok) throw new Error('Delete failed'); })
                          .catch(error => {
                            console.error('Error deleting kit:', error);
                            setKits(kitsBefore);
                            setToast({ show: true, message: 'Could not delete kit — restored.', type: 'error' });
                          });
                      }}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Questions Modal */}
            {showQuestionsModal && selectedKit && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
                  <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-black text-gray-900">{selectedKit.title}</h2>
                      <p className="text-gray-600 text-sm">{selectedKit.questions?.length || 0} questions</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowQuestionsModal(false);
                        setSelectedKit(null);
                      }}
                      className="text-gray-500 hover:text-gray-700 text-2xl"
                    >
                      ×
                    </button>
                  </div>

                  <div className="p-6">
                    {selectedKit.questions && selectedKit.questions.length > 0 ? (
                      <div className="space-y-4">
                        {selectedKit.questions.map((question, index) => (
                          <div key={question.id} className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="text-sm font-bold text-gray-500 mb-1">Question {index + 1}</div>
                                <p className="text-gray-900 font-semibold">{question.question_text}</p>
                                {question.image_url && (
                                  <img src={question.image_url} alt="Question" className="mt-2 max-h-32 rounded-lg object-contain bg-white border border-gray-200" />
                                )}
                              </div>
                              <div className="flex gap-2 ml-4">
                                <button
                                  onClick={() => {
                                    console.log('Editing question:', question);
                                    setEditingQuestion(question);
                                    setShowQuestionEditModal(true);
                                  }}
                                  className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                                  title="Edit question"
                                >
                                  <Settings className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setDeleteQuestionConfirm(question.id)}
                                  className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                  title="Delete question"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {question.answer_type === 'multiple_choice' && (
                              <div className="text-sm text-gray-600 space-y-1">
                                {question.option_a && <p>A) {question.option_a}</p>}
                                {question.option_b && <p>B) {question.option_b}</p>}
                                {question.option_c && <p>C) {question.option_c}</p>}
                                {question.option_d && <p>D) {question.option_d}</p>}
                                <div className="mt-2 pt-2 border-t border-gray-300">
                                  <span className="font-semibold text-gray-900">Answer: {question.correct_answer}</span>
                                </div>
                              </div>
                            )}
                            {question.answer_type === 'true_false' && (
                              <div className="text-sm text-gray-600 space-y-1">
                                <p>A) True</p>
                                <p>B) False</p>
                                <div className="mt-2 pt-2 border-t border-gray-300">
                                  <span className="font-semibold text-gray-900">Answer: {question.correct_answer}</span>
                                </div>
                              </div>
                            )}
                            {question.answer_type === 'short_answer' && (
                              <div className="text-sm text-gray-600 space-y-1">
                                <div className="mt-2 pt-2 border-t border-gray-300">
                                  <span className="font-semibold text-gray-900">Answer: {question.correct_answer}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm">No questions in this kit yet</p>
                      </div>
                    )}

                    {/* Add Question Form (shared component — supports all 7 question types) */}
                    <div className="mt-6">
                      <AddQuestionForm
                        kit={selectedKit}
                        tier={teacherTier}
                        ownerEndpoint={`kits/teacher/${user.id}`}
                        onQuestionAdded={(kitData, kitsList) => {
                          setSelectedKit(kitData);
                          if (kitsList) setKits(kitsList);
                        }}
                      />
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

            {/* Edit Question Modal */}
            {showQuestionEditModal && editingQuestion && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
                <div className="bg-white rounded-2xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
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
                            // Update the question in selectedKit
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
                <div className="bg-white rounded-2xl p-8 max-w-md w-full">
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
                      onClick={() => {
                        // Optimistic delete: drop locally, fire request in the
                        // background. Restore on failure.
                        const qid = deleteQuestionConfirm;
                        const before = selectedKit;
                        setSelectedKit({
                          ...selectedKit,
                          questions: selectedKit.questions.filter(q => q.id !== qid),
                        });
                        setDeleteQuestionConfirm(null);
                        const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
                        fetch(`${base}/api/kits/${before.id}/questions/${qid}`, { method: 'DELETE' })
                          .then(r => { if (!r.ok) throw new Error('Delete failed'); })
                          .catch(err => {
                            console.error('Error deleting question:', err);
                            setSelectedKit(before);
                            setToast({ show: true, message: 'Could not delete question — restored.', type: 'error' });
                          });
                      }}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <div className="mt-12 text-center pb-8">
          <button
            onClick={handleLogout}
            className="text-gray-500 hover:text-gray-700 font-semibold transition-colors"
          >
            Log Out
          </button>
        </div>
      </div>

      {/* Join Game modal — teachers can join existing games as participants */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 sm:p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900">Join Game</h2>
              <button
                onClick={() => { setShowJoinModal(false); setJoinCode(''); setJoinError(''); }}
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
                value={joinCode}
                onChange={(e) => { setJoinCode(e.target.value.toUpperCase().slice(0, 6)); setJoinError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !joinLoading) handleJoinGame(); }}
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
    </div>
  );
}