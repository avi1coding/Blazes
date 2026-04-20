import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Flame } from 'lucide-react';

export default function AuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [showBirthday, setShowBirthday] = useState(false);
  const [birthday, setBirthday] = useState('');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const err = params.get('error');
    if (err) { navigate('/login?error=' + err); return; }

    const token = params.get('token');
    const userRaw = params.get('user');
    const isNew = params.get('new');

    if (!token || !userRaw) { navigate('/login'); return; }

    try {
      const parsed = JSON.parse(decodeURIComponent(userRaw));
      localStorage.setItem('token', token);

      if (isNew && parsed.role === 'pending') {
        setUser(parsed);
        setShowBirthday(true);
      } else {
        localStorage.setItem('user', JSON.stringify(parsed));
        navigate(parsed.role === 'teacher' ? '/home/teacher' : '/home/student');
      }
    } catch {
      navigate('/login');
    }
  }, []);

  const handleSubmit = async () => {
    if (!birthday || !user) return;
    setLoading(true);
    setError('');
    try {
      const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
      const res = await fetch(`${base}/api/auth/set-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, birthday }),
      });
      const data = await res.json();
      if (res.ok) {
        const updatedUser = { ...user, role: data.role };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        navigate(data.role === 'teacher' ? '/home/teacher' : '/home/student');
      } else {
        setError(data.error || 'Something went wrong');
      }
    } catch {
      setError('Could not connect to server');
    }
    setLoading(false);
  };

  if (showBirthday) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl text-center">
          <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Flame className="w-7 h-7 text-red-600" strokeWidth={2.5} />
          </div>
          <h2 className="text-xl font-black text-gray-900 mb-2">Welcome to Blazes!</h2>
          <p className="text-gray-600 text-sm mb-6">Enter your date of birth to get started.</p>

          <input
            type="date"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none transition-colors text-gray-700 mb-4"
          />

          {error && (
            <p className="text-red-600 text-sm font-semibold mb-4">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={!birthday || loading}
            className="w-full bg-red-600 text-white py-3 rounded-xl font-black hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Setting up...' : 'Continue'}
          </button>

          <p className="text-xs text-gray-400 mt-4">
            This helps us set up the right experience for you.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center">
      <div className="text-center text-white">
        <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center mx-auto mb-4 animate-pulse">
          <Flame className="w-9 h-9 text-red-600" strokeWidth={2.5} />
        </div>
        <p className="text-xl font-bold">Signing you in...</p>
      </div>
    </div>
  );
}
