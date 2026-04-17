import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Flame } from 'lucide-react';

export default function AuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const error = params.get('error');
    if (error) {
      navigate('/login?error=' + error);
      return;
    }

    const token = params.get('token');
    const userRaw = params.get('user');

    if (!token || !userRaw) {
      navigate('/login');
      return;
    }

    try {
      const user = JSON.parse(decodeURIComponent(userRaw));
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      navigate(user.role === 'teacher' ? '/home/teacher' : '/home/student');
    } catch {
      navigate('/login');
    }
  }, []);

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
