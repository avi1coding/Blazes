import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Flame, GraduationCap, BookOpen, ArrowLeft } from 'lucide-react';
import { authHeaders, handleUnauthorized } from '../utils/auth';

export default function AuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [step, setStep] = useState('role'); // 'role' | 'teacher_age'
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
        setShowRolePicker(true);
      } else {
        localStorage.setItem('user', JSON.stringify(parsed));
        navigate(parsed.role === 'teacher' ? '/home/teacher' : '/home/student');
      }
    } catch {
      navigate('/login');
    }
  }, []);

  const submitRole = async (role, bday) => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
      // The token stored above proves who this is; the server ignores any userId.
      const body = { role };
      if (bday) body.birthday = bday;
      const res = await fetch(`${base}/api/auth/set-role`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (handleUnauthorized(res)) return;
      const data = await res.json();
      if (res.ok) {
        const updatedUser = { ...user, role: data.role };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        navigate(data.role === 'teacher' ? '/home/teacher' : '/home/student');
      } else {
        setError(data.error || 'Something went wrong');
        setLoading(false);
      }
    } catch {
      setError('Could not connect to server');
      setLoading(false);
    }
  };

  const pickStudent = () => submitRole('student');
  const pickTeacher = () => { setStep('teacher_age'); setError(''); };
  const submitTeacher = () => {
    if (!birthday) { setError('Please enter your date of birth'); return; }
    submitRole('teacher', birthday);
  };

  if (showRolePicker && step === 'role') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Flame className="w-7 h-7 text-red-600" strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">Welcome to Blazes!</h2>
            <p className="text-gray-600 text-sm">How will you be using Blazes?</p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4">
            <button
              onClick={pickStudent}
              disabled={loading}
              className="bg-white border-2 border-gray-200 hover:border-red-500 hover:bg-red-50 rounded-2xl p-5 transition-all disabled:opacity-50 group"
            >
              <BookOpen className="w-10 h-10 text-red-600 mx-auto mb-3 group-hover:scale-110 transition-transform" strokeWidth={2.5} />
              <div className="font-black text-gray-900 mb-1">Student</div>
              <div className="text-xs text-gray-500">Join games, study, and play</div>
            </button>

            <button
              onClick={pickTeacher}
              disabled={loading}
              className="bg-white border-2 border-gray-200 hover:border-orange-500 hover:bg-orange-50 rounded-2xl p-5 transition-all disabled:opacity-50 group"
            >
              <GraduationCap className="w-10 h-10 text-orange-500 mx-auto mb-3 group-hover:scale-110 transition-transform" strokeWidth={2.5} />
              <div className="font-black text-gray-900 mb-1">Teacher</div>
              <div className="text-xs text-gray-500">Create games and classrooms</div>
              <div className="text-[10px] font-bold text-orange-600 mt-2">18+ required</div>
            </button>
          </div>

          {error && (
            <p className="text-red-600 text-sm font-semibold text-center mb-2">{error}</p>
          )}

          <p className="text-xs text-gray-400 text-center mt-4">
            You can't change this later. Pick what fits you best.
          </p>
        </div>
      </div>
    );
  }

  if (showRolePicker && step === 'teacher_age') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl">
          <button onClick={() => { setStep('role'); setError(''); setBirthday(''); }} className="flex items-center gap-1 text-sm font-bold text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="w-7 h-7 text-orange-500" strokeWidth={2.5} />
            </div>
            <h2 className="text-xl font-black text-gray-900 mb-2">Verify your age</h2>
            <p className="text-gray-600 text-sm">Teacher accounts require you to be 18 or older.</p>
          </div>

          <label className="block text-sm font-bold text-gray-700 mb-2">Date of Birth</label>
          <input
            type="date"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none transition-colors text-gray-700 mb-4"
          />

          {error && (
            <p className="text-red-600 text-sm font-semibold mb-4">{error}</p>
          )}

          <button
            onClick={submitTeacher}
            disabled={!birthday || loading}
            className="w-full bg-orange-500 text-white py-3 rounded-xl font-black hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            {loading ? 'Setting up...' : 'Continue as Teacher'}
          </button>
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
