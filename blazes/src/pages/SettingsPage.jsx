import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { ArrowLeft, User, Bell, Gamepad2, Eye, Shield, Trash2, ChevronRight, Lock, BookOpen, BarChart3, Users, ClipboardList, Flame } from 'lucide-react';
import Toast from '../components/Toast';
import { authHeaders, handleUnauthorized } from '../utils/auth';

function getPasswordStrength(pw) {
  if (!pw) return { label: '', color: '', width: '0%' };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: 'Weak', color: 'bg-red-500', width: '20%' };
  if (score <= 2) return { label: 'Fair', color: 'bg-orange-500', width: '40%' };
  if (score <= 3) return { label: 'Good', color: 'bg-yellow-500', width: '60%' };
  if (score <= 4) return { label: 'Strong', color: 'bg-green-500', width: '80%' };
  return { label: 'Very Strong', color: 'bg-green-600', width: '100%' };
}

function VolumeSlider({ value, onChange, label, description }) {
  return (
    <div className="py-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="font-bold text-gray-900 text-sm">{label}</div>
          {description && <div className="text-xs text-gray-500 mt-0.5">{description}</div>}
        </div>
        <span className="text-sm font-bold text-gray-500 w-10 text-right">{value}%</span>
      </div>
      <input
        type="range" min="0" max="100" value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-red-600"
      />
    </div>
  );
}

function Toggle({ enabled, onChange, label, description }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <div className="font-bold text-gray-900 text-sm">{label}</div>
        {description && <div className="text-xs text-gray-500 mt-0.5">{description}</div>}
      </div>
      <button onClick={() => onChange(!enabled)}
        className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-red-600' : 'bg-gray-300'}`}>
        <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
          style={{ transform: enabled ? 'translateX(20px)' : 'translateX(0)' }} />
      </button>
    </div>
  );
}

const baseSections = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'security', label: 'Security', icon: Lock },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'gameplay', label: 'Gameplay', icon: Gamepad2 },
  { id: 'accessibility', label: 'Accessibility', icon: Eye },
  { id: 'privacy', label: 'Privacy', icon: Shield },
];

const teachingSections = [
  { id: 'teaching', label: 'Teaching', icon: BookOpen },
];

function getSections(userRole) {
  return userRole === 'teacher' ? [...baseSections, ...teachingSections] : baseSections;
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(null);
  // URL is the source of truth so browser back/forward navigates between sections.
  const activeSection = searchParams.get('section') || 'account';
  const setActiveSection = (next) => setSearchParams({ section: next });
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });

  // Account form states
  const [nameValue, setNameValue] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteStep, setDeleteStep] = useState('warning'); // 'warning' | 'confirm'
  const [deleteAcknowledged, setDeleteAcknowledged] = useState(false);
  const [deleteCooldown, setDeleteCooldown] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loginActivity, setLoginActivity] = useState([]);
  const [userInfo, setUserInfo] = useState(null);
  const [settingsLocked, setSettingsLocked] = useState(true);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [unlockCode, setUnlockCode] = useState('');
  const [unlockCodeSent, setUnlockCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [forcePasswordSetup, setForcePasswordSetup] = useState(false);
  const [setupPassword, setSetupPassword] = useState('');
  const [setupPasswordConfirm, setSetupPasswordConfirm] = useState('');

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) { navigate('/login'); return; }
    const parsed = JSON.parse(userData);
    setUser(parsed);
    setNameValue(parsed.name || '');
    setEmailValue(parsed.email || '');
    fetch(`${base}/api/settings/${parsed.id}`)
      .then(r => r.json())
      .then(data => { setSettings(data); localStorage.setItem('blazes_settings', JSON.stringify(data)); })
      .catch(() => {});
    fetch(`${base}/api/auth/user-info/${parsed.id}`)
      .then(r => r.json())
      .then(info => { setUserInfo(info); })
      .catch(() => {});
    fetch(`${base}/api/auth/login-activity/${parsed.id}`).then(r => r.json()).then(setLoginActivity).catch(() => {});
  }, [navigate, base]);

  useEffect(() => {
    if (deleteStep !== 'confirm' || deleteCooldown <= 0) return;
    const id = setTimeout(() => setDeleteCooldown(s => s - 1), 1000);
    return () => clearTimeout(id);
  }, [deleteStep, deleteCooldown]);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };

  const updateSetting = async (field, value) => {
    if (!user) return;
    const updated = { ...settings, [field]: value };
    setSettings(updated);
    localStorage.setItem('blazes_settings', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
    try {
      await fetch(`${base}/api/settings/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
    } catch {
      showToast('Failed to save setting', 'error');
    }
  };

  const handleSaveName = async () => {
    if (!nameValue.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${base}/api/auth/change-name`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ name: nameValue.trim() }),
      });
      if (handleUnauthorized(res)) return;
      const data = await res.json();
      if (res.ok) {
        const updatedUser = { ...user, name: nameValue.trim() };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        showToast('Display name updated');
      } else {
        showToast(data.error || 'Failed to update name', 'error');
      }
    } catch {
      showToast('Failed to update name', 'error');
    }
    setSaving(false);
  };

  const handleSaveEmail = async () => {
    if (!emailValue.trim()) return;
    setSaving(true);
    try {
      // Server reads `newEmail`; sending `email` made this endpoint always 400.
      // userId is ignored now — identity comes from the token.
      const body = { newEmail: emailValue.trim() };
      if (userInfo?.hasPassword !== false && emailPassword) body.password = emailPassword;
      const res = await fetch(`${base}/api/auth/change-email`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (handleUnauthorized(res)) return;
      const data = await res.json();
      if (res.ok) {
        const updatedUser = { ...user, email: emailValue.trim() };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        setEmailPassword('');
        showToast('Email updated');
      } else {
        showToast(data.error || 'Failed to update email', 'error');
      }
    } catch {
      showToast('Failed to update email', 'error');
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }
    setSaving(true);
    try {
      const body = { userId: user.id, newPassword };
      if (userInfo?.hasPassword !== false) body.currentPassword = currentPassword;
      const res = await fetch(`${base}/api/auth/change-password`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (handleUnauthorized(res)) return;
      const data = await res.json();
      if (res.ok) {
        // Trigger password manager save
        if (window.PasswordCredential) {
          try {
            const cred = new window.PasswordCredential({ id: user.email, password: newPassword });
            navigator.credentials.store(cred);
          } catch (_) {}
        }
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowPasswordChange(false);
        setUserInfo(prev => prev ? { ...prev, hasPassword: true } : prev);
        showToast(userInfo?.hasPassword !== false ? 'Password updated' : 'Password set');
      } else {
        showToast(data.error || 'Failed to update password', 'error');
      }
    } catch {
      showToast('Failed to update password', 'error');
    }
    setSaving(false);
  };

  const closeDeleteModal = () => {
    setShowDeleteConfirm(false);
    setDeleteStep('warning');
    setDeletePassword('');
    setDeleteConfirmText('');
    setDeleteAcknowledged(false);
    setDeleteCooldown(0);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== user.email) return;
    if (!deleteAcknowledged) return;
    if (userInfo?.hasPassword !== false && !deletePassword) return;
    setSaving(true);
    try {
      const res = await fetch(`${base}/api/auth/delete-account/${user.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
        body: JSON.stringify({ password: deletePassword }),
      });
      if (handleUnauthorized(res)) return;
      if (res.ok) {
        localStorage.clear();
        navigate('/');
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to delete account', 'error');
      }
    } catch {
      showToast('Failed to delete account', 'error');
    }
    setSaving(false);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center animate-pulse">
          <Flame className="w-6 h-6 text-white" strokeWidth={2.5} />
        </div>
      </div>
    );
  }

  const backPath = user.role === 'teacher' ? '/home/teacher' : '/home/student';
  const goBack = () => {
    if (location.key !== 'default') navigate(-1);
    else navigate(backPath);
  };

  const renderAccount = () => (
    <div className="space-y-6">
      {/* Current Plan */}
      <div className="bg-gray-50 rounded-xl p-4 mb-6 flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-gray-900">Current Plan</div>
          <div className="text-xs text-gray-500">{userInfo?.subscriptionTier && userInfo.subscriptionTier !== 'free' ? userInfo.subscriptionTier.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Free'}</div>
        </div>
        <button onClick={() => navigate('/upgrade')} className="text-sm font-bold text-red-600 hover:text-red-700">
          {userInfo?.subscriptionTier && userInfo.subscriptionTier !== 'free' ? 'Manage Plan' : 'Upgrade'}
        </button>
      </div>

      {/* Display Name */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="font-black text-gray-900 text-sm mb-3">Display Name</h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={nameValue}
            onChange={e => setNameValue(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
          <button
            onClick={handleSaveName}
            disabled={saving || nameValue === user.name}
            className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>

      {/* Email */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="font-black text-gray-900 text-sm mb-3">Email</h3>
        <div className="space-y-3">
          <input
            type="email"
            value={emailValue}
            onChange={e => setEmailValue(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
          {userInfo?.hasPassword !== false && (
            <input
              type="password"
              value={emailPassword}
              onChange={e => setEmailPassword(e.target.value)}
              placeholder="Confirm your password"
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          )}
          <button
            onClick={handleSaveEmail}
            disabled={saving || emailValue === user.email}
            className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>

      {/* Password */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="font-black text-gray-900 text-sm mb-3">Password</h3>
        {!showPasswordChange ? (
          <button
            onClick={() => setShowPasswordChange(true)}
            className="px-4 py-2 border border-gray-300 text-sm font-bold text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Change Password
          </button>
        ) : (
          <div className="space-y-3">
            {userInfo?.hasPassword !== false ? (
              <input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                autoComplete="current-password"
              />
            ) : (
              <p className="text-xs text-gray-500">Set a password for your account (currently using Google sign-in only)</p>
            )}
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="New password"
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              autoComplete="new-password"
            />
            {newPassword && (() => {
              const strength = getPasswordStrength(newPassword);
              return (
                <div className="mt-2">
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${strength.color}`} style={{ width: strength.width }} />
                  </div>
                  <p className="text-xs font-semibold text-gray-500 mt-1">{strength.label}</p>
                </div>
              );
            })()}
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              autoComplete="new-password"
            />
            <div className="flex gap-2">
              <button
                onClick={handleChangePassword}
                disabled={saving}
                className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {userInfo?.hasPassword !== false ? 'Update Password' : 'Set Password'}
              </button>
              <button
                onClick={() => { setShowPasswordChange(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }}
                className="px-4 py-2 border border-gray-300 text-sm font-bold text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-2xl border-2 border-red-200 p-5">
        <h3 className="font-black text-red-600 text-sm mb-2">Danger Zone</h3>
        <p className="text-xs text-gray-500 mb-3">Permanently delete your account and all associated data. This cannot be undone.</p>
        <button
          onClick={() => { setShowDeleteConfirm(true); setDeleteStep('warning'); }}
          className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-colors flex items-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Delete Account
        </button>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={closeDeleteModal}>
          <div className="bg-white rounded-3xl p-7 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            {deleteStep === 'warning' ? (
              <>
                <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-7 h-7 text-red-600" />
                </div>
                <h2 className="text-xl font-black text-gray-900 text-center mb-2">Delete your account?</h2>
                <p className="text-sm text-gray-600 text-center mb-5">This action is <strong>permanent</strong> and cannot be undone.</p>
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5">
                  <p className="text-xs font-bold text-red-800 mb-2">You will permanently lose:</p>
                  <ul className="text-xs text-red-700 space-y-1 list-disc list-inside">
                    <li>Your profile, name, and email</li>
                    <li>All Blazes Bucks, XP, and skins</li>
                    <li>Your game history and achievements</li>
                    {user?.role === 'teacher' ? (
                      <>
                        <li>All classrooms and student rosters you own</li>
                        <li>All kits and assignments you've created</li>
                      </>
                    ) : (
                      <li>Your assignment submissions and progress</li>
                    )}
                    <li>Any active subscriptions (cancellation is your responsibility)</li>
                  </ul>
                </div>
                <div className="flex gap-2">
                  <button onClick={closeDeleteModal}
                    className="flex-1 py-3 border-2 border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50">
                    Keep my account
                  </button>
                  <button onClick={() => { setDeleteStep('confirm'); setDeleteCooldown(5); }}
                    className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700">
                    Continue
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-black text-gray-900 mb-2">Final confirmation</h2>
                <p className="text-sm text-gray-600 mb-5">Confirm by entering your details. There's no recovery after this.</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Type your email to confirm</label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={e => setDeleteConfirmText(e.target.value)}
                      placeholder={user.email}
                      autoComplete="off"
                      className="w-full px-3 py-2.5 border-2 border-red-200 rounded-xl text-sm focus:outline-none focus:border-red-500 font-mono"
                    />
                  </div>
                  {userInfo?.hasPassword !== false && (
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Your password</label>
                      <input
                        type="password"
                        value={deletePassword}
                        onChange={e => setDeletePassword(e.target.value)}
                        autoComplete="current-password"
                        className="w-full px-3 py-2.5 border-2 border-red-200 rounded-xl text-sm focus:outline-none focus:border-red-500"
                      />
                    </div>
                  )}
                  <label className="flex items-start gap-2 cursor-pointer p-3 bg-red-50 rounded-xl">
                    <input
                      type="checkbox"
                      checked={deleteAcknowledged}
                      onChange={e => setDeleteAcknowledged(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-red-600"
                    />
                    <span className="text-xs text-red-800 font-semibold">I understand this action is permanent and all of my data will be deleted forever.</span>
                  </label>
                </div>
                <div className="flex gap-2 mt-5">
                  <button onClick={() => setDeleteStep('warning')}
                    className="flex-1 py-3 border-2 border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50">
                    Back
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={
                      saving ||
                      deleteCooldown > 0 ||
                      deleteConfirmText !== user.email ||
                      !deleteAcknowledged ||
                      (userInfo?.hasPassword !== false && !deletePassword)
                    }
                    className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {deleteCooldown > 0 ? `Wait ${deleteCooldown}s...` : saving ? 'Deleting...' : 'Delete forever'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderNotifications = () => (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <h3 className="font-black text-gray-900 text-sm mb-1">Notification Preferences</h3>
      <p className="text-xs text-gray-500 mb-3">Choose which notifications you want to receive.</p>
      <div className="divide-y divide-gray-100">
        <Toggle
          label="Assignment Reminders"
          description="Get notified about upcoming and overdue assignments"
          enabled={settings?.notify_assignments ?? true}
          onChange={v => updateSetting('notify_assignments', v)}
        />
        <Toggle
          label="Achievement Alerts"
          description="Celebrate when you unlock new achievements"
          enabled={settings?.notify_achievements ?? true}
          onChange={v => updateSetting('notify_achievements', v)}
        />
        <Toggle
          label="Game Invites"
          description="Be notified when someone invites you to a game"
          enabled={settings?.notify_game_invites ?? true}
          onChange={v => updateSetting('notify_game_invites', v)}
        />
        <Toggle
          label="Classroom Updates"
          description="Stay informed about classroom announcements"
          enabled={settings?.notify_classroom ?? true}
          onChange={v => updateSetting('notify_classroom', v)}
        />
      </div>
    </div>
  );

  const renderGameplay = () => (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <h3 className="font-black text-gray-900 text-sm mb-1">Gameplay Settings</h3>
      <p className="text-xs text-gray-500 mb-3">Customize your in-game experience.</p>
      <div className="divide-y divide-gray-100">
        <VolumeSlider
          label="Music Volume"
          description="Background music in lobbies and games"
          value={settings?.music_volume ?? 30}
          onChange={v => updateSetting('music_volume', v)}
        />
        <VolumeSlider
          label="Sound Effects Volume"
          description="Sound effects during gameplay"
          value={settings?.sfx_volume ?? 70}
          onChange={v => updateSetting('sfx_volume', v)}
        />
        <Toggle
          label="Sound Effects"
          description="Enable or disable all sounds"
          enabled={settings?.sound_enabled ?? true}
          onChange={v => updateSetting('sound_enabled', v)}
        />
        <Toggle
          label="Animations"
          description="Show animations and visual effects"
          enabled={settings?.animations_enabled ?? true}
          onChange={v => updateSetting('animations_enabled', v)}
        />
        <Toggle
          label="Timer Warnings"
          description="Flash warnings when time is running low"
          enabled={settings?.timer_warnings ?? true}
          onChange={v => updateSetting('timer_warnings', v)}
        />
      </div>
    </div>
  );

  const renderAccessibility = () => (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <h3 className="font-black text-gray-900 text-sm mb-1">Accessibility</h3>
      <p className="text-xs text-gray-500 mb-3">Adjust the interface to your preferences.</p>
      <div className="space-y-4">
        <div>
          <div className="font-bold text-gray-900 text-sm mb-2">Font Size</div>
          <div className="flex rounded-xl overflow-hidden border border-gray-300">
            {['small', 'medium', 'large'].map(size => (
              <button
                key={size}
                onClick={() => updateSetting('font_size', size)}
                className={`flex-1 py-2 text-sm font-bold capitalize transition-colors ${
                  (settings?.font_size || 'medium') === size
                    ? 'bg-red-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
        <div className="border-t border-gray-100 pt-1">
          <Toggle
            label="Reduce Motion"
            description="Minimize animations throughout the app"
            enabled={settings?.reduce_motion ?? false}
            onChange={v => updateSetting('reduce_motion', v)}
          />
        </div>
      </div>
    </div>
  );

  const renderPrivacy = () => (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <h3 className="font-black text-gray-900 text-sm mb-1">Privacy</h3>
      <p className="text-xs text-gray-500 mb-3">Control your visibility and data sharing.</p>
      <div className="divide-y divide-gray-100">
        <Toggle
          label="Show on Leaderboards"
          description="Allow your name to appear on public leaderboards"
          enabled={settings?.leaderboard_visible ?? true}
          onChange={v => updateSetting('leaderboard_visible', v)}
        />
        <Toggle
          label="Show Activity to Others"
          description="Let classmates see your recent activity"
          enabled={settings?.activity_visible ?? true}
          onChange={v => updateSetting('activity_visible', v)}
        />
      </div>
    </div>
  );

  const renderTeaching = () => (
    <div className="space-y-5">
      {/* Classroom Display Settings */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="font-black text-gray-900 text-sm mb-4 flex items-center gap-2">
          <Users className="w-4 h-4" />
          Classroom Display
        </h3>
        <div className="divide-y divide-gray-100">
          <Toggle
            label="Show Student Names on Leaderboards"
            description="Display student names in game and classroom leaderboards"
            enabled={settings?.show_student_names ?? true}
            onChange={v => updateSetting('show_student_names', v)}
          />
          <Toggle
            label="Show Student Scores"
            description="Display individual student scores and performance"
            enabled={settings?.show_student_scores ?? true}
            onChange={v => updateSetting('show_student_scores', v)}
          />
          <Toggle
            label="Show Student Progress"
            description="Display student progress and achievement milestones"
            enabled={settings?.show_student_progress ?? true}
            onChange={v => updateSetting('show_student_progress', v)}
          />
        </div>
      </div>

      {/* Assignment Settings */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="font-black text-gray-900 text-sm mb-4 flex items-center gap-2">
          <ClipboardList className="w-4 h-4" />
          Assignment Defaults
        </h3>
        <div className="divide-y divide-gray-100">
          <Toggle
            label="Auto-generate Due Dates"
            description="Automatically set due dates based on assignment creation"
            enabled={settings?.auto_due_dates ?? false}
            onChange={v => updateSetting('auto_due_dates', v)}
          />
          <Toggle
            label="Require Password for Submissions"
            description="Require students to authenticate before submitting assignments"
            enabled={settings?.require_submission_auth ?? false}
            onChange={v => updateSetting('require_submission_auth', v)}
          />
          <Toggle
            label="Allow Late Submissions"
            description="Allow students to submit assignments after due date"
            enabled={settings?.allow_late_submissions ?? true}
            onChange={v => updateSetting('allow_late_submissions', v)}
          />
          <Toggle
            label="Show Answers After Due Date"
            description="Automatically reveal correct answers once assignment deadline passes"
            enabled={settings?.show_answers_after_due ?? true}
            onChange={v => updateSetting('show_answers_after_due', v)}
          />
        </div>
      </div>

      {/* Grading & Analytics */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="font-black text-gray-900 text-sm mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Analytics & Grading
        </h3>
        <div className="divide-y divide-gray-100">
          <Toggle
            label="Show Accuracy-Based Grading"
            description="Use accuracy percentage as part of overall grades"
            enabled={settings?.use_accuracy_grading ?? true}
            onChange={v => updateSetting('use_accuracy_grading', v)}
          />
          <Toggle
            label="Show Speed Statistics"
            description="Display average response time and speed metrics"
            enabled={settings?.show_speed_stats ?? true}
            onChange={v => updateSetting('show_speed_stats', v)}
          />
          <Toggle
            label="Track Attendance"
            description="Monitor student attendance in games and assignments"
            enabled={settings?.track_attendance ?? true}
            onChange={v => updateSetting('track_attendance', v)}
          />
          <Toggle
            label="Enable Advanced Analytics"
            description="Access detailed learning analytics and insights (Pro feature)"
            enabled={settings?.enable_advanced_analytics ?? false}
            onChange={v => updateSetting('enable_advanced_analytics', v)}
          />
          <Toggle
            label="Show Learning Trends"
            description="Display student learning progression over time"
            enabled={settings?.show_learning_trends ?? true}
            onChange={v => updateSetting('show_learning_trends', v)}
          />
        </div>
      </div>

      {/* Data & Export Settings */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="font-black text-gray-900 text-sm mb-4">Data & Export</h3>
        <div className="divide-y divide-gray-100">
          <Toggle
            label="Auto-Export Student Data"
            description="Automatically export student performance data monthly"
            enabled={settings?.auto_export_data ?? false}
            onChange={v => updateSetting('auto_export_data', v)}
          />
          <Toggle
            label="Enable FERPA Compliance"
            description="Extra data protection for student information (FERPA)"
            enabled={settings?.ferpa_compliance ?? false}
            onChange={v => updateSetting('ferpa_compliance', v)}
          />
          <Toggle
            label="Allow Student Data Download"
            description="Let students download their own performance data"
            enabled={settings?.allow_student_data_download ?? true}
            onChange={v => updateSetting('allow_student_data_download', v)}
          />
        </div>
      </div>

      {/* Game & Quiz Settings */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="font-black text-gray-900 text-sm mb-4">Game & Quiz Settings</h3>
        <div className="divide-y divide-gray-100">
          <Toggle
            label="Shuffle Question Order"
            description="Randomize question order for each student by default"
            enabled={settings?.shuffle_questions ?? true}
            onChange={v => updateSetting('shuffle_questions', v)}
          />
          <Toggle
            label="Show Question Rationale"
            description="Display explanation for correct answers"
            enabled={settings?.show_rationale ?? true}
            onChange={v => updateSetting('show_rationale', v)}
          />
          <Toggle
            label="Allow Question Review"
            description="Let students review their answers after games"
            enabled={settings?.allow_question_review ?? true}
            onChange={v => updateSetting('allow_question_review', v)}
          />
          <Toggle
            label="Timer Enforcement"
            description="Strictly enforce time limits for questions"
            enabled={settings?.enforce_timers ?? true}
            onChange={v => updateSetting('enforce_timers', v)}
          />
          <Toggle
            label="Show Leaderboards in Real-Time"
            description="Display live leaderboards during games"
            enabled={settings?.show_live_leaderboards ?? true}
            onChange={v => updateSetting('show_live_leaderboards', v)}
          />
        </div>
      </div>

      {/* Notifications for Teachers */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="font-black text-gray-900 text-sm mb-4">Teaching Notifications</h3>
        <div className="divide-y divide-gray-100">
          <Toggle
            label="Student Struggling Alerts"
            description="Get notified when students are struggling with content"
            enabled={settings?.notify_struggling_students ?? true}
            onChange={v => updateSetting('notify_struggling_students', v)}
          />
          <Toggle
            label="Assignment Submission Alerts"
            description="Get notified when students submit assignments"
            enabled={settings?.notify_submissions ?? true}
            onChange={v => updateSetting('notify_submissions', v)}
          />
          <Toggle
            label="Low Participation Alerts"
            description="Get notified about students with low engagement"
            enabled={settings?.notify_low_participation ?? true}
            onChange={v => updateSetting('notify_low_participation', v)}
          />
          <Toggle
            label="Grade Milestone Alerts"
            description="Get notified when students reach grade milestones"
            enabled={settings?.notify_milestones ?? false}
            onChange={v => updateSetting('notify_milestones', v)}
          />
        </div>
      </div>
    </div>
  );

  const renderSecurity = () => (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-6 border border-gray-200 mb-4">
        <h3 className="font-black text-gray-900 mb-4">Account Information</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Account type</span>
            <span className="font-bold text-gray-900">{userInfo?.isGoogleAccount ? 'Google' : 'Email'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Created</span>
            <span className="font-bold text-gray-900">{userInfo?.createdAt ? new Date(userInfo.createdAt).toLocaleDateString() : '--'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Password last changed</span>
            <span className="font-bold text-gray-900">{userInfo?.passwordChangedAt ? new Date(userInfo.passwordChangedAt).toLocaleDateString() : 'Never'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Has password</span>
            <span className={`font-bold ${userInfo?.hasPassword ? 'text-green-600' : 'text-red-600'}`}>{userInfo?.hasPassword ? 'Yes' : 'No'}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-gray-200">
        <h3 className="font-black text-gray-900 mb-4">Recent Login Activity</h3>
        {loginActivity.length === 0 ? (
          <p className="text-sm text-gray-400">No login activity recorded</p>
        ) : (
          <div className="space-y-2">
            {loginActivity.slice(0, 5).map((a, i) => {
              const agent = a.user_agent || '';
              const device = /Mobile|Android|iPhone/i.test(agent) ? 'Mobile' : 'Desktop';
              const browser = /Chrome/i.test(agent) ? 'Chrome' : /Firefox/i.test(agent) ? 'Firefox' : /Safari/i.test(agent) ? 'Safari' : 'Browser';
              return (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <div className="text-sm font-bold text-gray-900">{device} · {browser}</div>
                    <div className="text-xs text-gray-400">{a.ip_address}</div>
                  </div>
                  <div className="text-xs text-gray-500">{new Date(a.created_at).toLocaleString()}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'account': return renderAccount();
      case 'security': return renderSecurity();
      case 'notifications': return renderNotifications();
      case 'gameplay': return renderGameplay();
      case 'accessibility': return renderAccessibility();
      case 'privacy': return renderPrivacy();
      case 'teaching': return renderTeaching();
      default: return renderAccount();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Toast show={toast.show} message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />

      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={goBack} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-xl font-black text-gray-900">Settings</h1>
        </div>
      </nav>

      {/* Mobile horizontal tabs */}
      <div className="md:hidden bg-white border-b border-gray-200 overflow-x-auto">
        <div className="flex px-4 py-2 gap-1 min-w-max">
          {getSections(user?.role).map(s => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                  activeSection === s.id
                    ? 'bg-red-50 text-red-600'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex gap-4 md:gap-6">
          {/* Desktop sidebar */}
          <div className="hidden md:block w-56 shrink-0">
            <div className="bg-white rounded-2xl border border-gray-200 p-2 sticky top-20">
              {getSections(user?.role).map(s => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveSection(s.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                      activeSection === s.id
                        ? 'bg-red-50 text-red-600'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {s.label}
                    {activeSection === s.id && <ChevronRight className="w-4 h-4 ml-auto" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main content */}
          {settingsLocked ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="max-w-sm w-full text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8 text-gray-400" />
                </div>
                <h2 className="text-xl font-black text-gray-900 mb-2">Verify Your Identity</h2>
                <p className="text-sm text-gray-500 mb-6">
                  {userInfo?.hasPassword === false
                    ? unlockCodeSent
                      ? `We sent a 6-digit code to ${user.email}. Enter it below.`
                      : `We'll email a 6-digit code to ${user.email} to verify it's you.`
                    : 'Enter your password to access settings'}
                </p>
                {userInfo?.hasPassword !== false ? (
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    setUnlockError('');
                    try {
                      const response = await fetch(`${base}/api/auth/verify-password`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: user.email, password: unlockPassword })
                      });
                      const data = await response.json();
                      if (response.ok && data.success) {
                        setSettingsLocked(false);
                        setUnlockPassword('');
                      } else {
                        setUnlockError(data.message || 'Incorrect password');
                      }
                    } catch (err) {
                      setUnlockError('Could not verify: ' + err.message);
                    }
                  }}>
                    <input
                      type="password"
                      value={unlockPassword}
                      onChange={(e) => setUnlockPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl mb-3 focus:border-red-500 focus:outline-none"
                      autoFocus
                    />
                    {unlockError && <p className="text-red-600 text-sm font-semibold mb-3">{unlockError}</p>}
                    <button type="submit" className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors">
                      Unlock Settings
                    </button>
                  </form>
                ) : !unlockCodeSent ? (
                  <>
                    {unlockError && <p className="text-red-600 text-sm font-semibold mb-3">{unlockError}</p>}
                    <button
                      onClick={async () => {
                        setSendingCode(true);
                        setUnlockError('');
                        try {
                          const res = await fetch(`${base}/api/auth/request-unlock-code`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId: user.id }),
                          });
                          const data = await res.json();
                          if (res.ok) {
                            setUnlockCodeSent(true);
                            if (data.devCode) console.log('[dev] unlock code:', data.devCode);
                          } else {
                            setUnlockError(data.error || 'Failed to send code');
                          }
                        } catch (err) {
                          setUnlockError('Could not send code: ' + err.message);
                        } finally { setSendingCode(false); }
                      }}
                      disabled={sendingCode}
                      className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {sendingCode ? 'Sending...' : 'Email me a code'}
                    </button>
                  </>
                ) : (
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    setUnlockError('');
                    try {
                      const res = await fetch(`${base}/api/auth/verify-unlock-code`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: user.id, code: unlockCode.trim() }),
                      });
                      const data = await res.json();
                      if (res.ok && data.success) {
                        setSettingsLocked(false);
                        setUnlockCode('');
                        setUnlockCodeSent(false);
                        if (userInfo?.hasPassword === false) setForcePasswordSetup(true);
                      } else {
                        setUnlockError(data.error || 'Incorrect code');
                      }
                    } catch (err) {
                      setUnlockError('Could not verify: ' + err.message);
                    }
                  }}>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={unlockCode}
                      onChange={(e) => setUnlockCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="6-digit code"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl mb-3 focus:border-red-500 focus:outline-none text-center text-lg tracking-widest font-mono"
                      autoFocus
                    />
                    {unlockError && <p className="text-red-600 text-sm font-semibold mb-3">{unlockError}</p>}
                    <button type="submit" disabled={unlockCode.length !== 6} className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50">
                      Verify Code
                    </button>
                    <button type="button" onClick={() => { setUnlockCodeSent(false); setUnlockCode(''); setUnlockError(''); }}
                      className="mt-3 text-xs text-gray-500 font-semibold hover:text-gray-700">
                      Didn't get it? Resend
                    </button>
                  </form>
                )}
              </div>
            </div>
          ) : forcePasswordSetup ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="max-w-sm w-full">
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8 text-red-600" />
                </div>
                <h2 className="text-xl font-black text-gray-900 mb-2 text-center">Create a Password</h2>
                <p className="text-sm text-gray-500 mb-6 text-center">Before you continue, set a password so you can sign in without Google in the future.</p>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (setupPassword !== setupPasswordConfirm) { showToast('Passwords do not match', 'error'); return; }
                  if (setupPassword.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }
                  setSaving(true);
                  try {
                    const res = await fetch(`${base}/api/auth/change-password`, {
                      method: 'PUT',
                      headers: authHeaders(),
                      body: JSON.stringify({ newPassword: setupPassword }),
                    });
                    if (handleUnauthorized(res)) return;
                    const data = await res.json();
                    if (res.ok) {
                      setUserInfo(prev => prev ? { ...prev, hasPassword: true } : prev);
                      setForcePasswordSetup(false);
                      setSetupPassword('');
                      setSetupPasswordConfirm('');
                      showToast('Password set');
                    } else {
                      showToast(data.error || 'Failed to set password', 'error');
                    }
                  } catch {
                    showToast('Failed to set password', 'error');
                  } finally { setSaving(false); }
                }}>
                  <input
                    type="password"
                    value={setupPassword}
                    onChange={e => setSetupPassword(e.target.value)}
                    placeholder="New password"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl mb-2 focus:border-red-500 focus:outline-none"
                    autoComplete="new-password"
                    autoFocus
                  />
                  {setupPassword && (() => {
                    const strength = getPasswordStrength(setupPassword);
                    return (
                      <div className="mb-3">
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${strength.color}`} style={{ width: strength.width }} />
                        </div>
                        <p className="text-xs font-semibold text-gray-500 mt-1">{strength.label}</p>
                      </div>
                    );
                  })()}
                  <input
                    type="password"
                    value={setupPasswordConfirm}
                    onChange={e => setSetupPasswordConfirm(e.target.value)}
                    placeholder="Confirm password"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl mb-3 focus:border-red-500 focus:outline-none"
                    autoComplete="new-password"
                  />
                  <button type="submit" disabled={saving} className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50">
                    {saving ? 'Setting...' : 'Set Password & Continue'}
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-w-0">
              {renderContent()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
