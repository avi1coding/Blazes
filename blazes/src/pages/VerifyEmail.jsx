import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Flame, Check, X } from 'lucide-react';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('loading'); // loading, success, error

  useEffect(() => {
    if (!token) { setStatus('error'); return; }
    const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
    fetch(`${base}/api/auth/verify-email?token=${token}`)
      .then(r => {
        if (r.ok) setStatus('success');
        else setStatus('error');
      })
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Flame className="w-8 h-8 text-white" strokeWidth={2.5} />
        </div>
        {status === 'loading' && (
          <div>
            <h1 className="text-2xl font-black text-gray-900 mb-2">Verifying...</h1>
            <p className="text-gray-500">Please wait</p>
          </div>
        )}
        {status === 'success' && (
          <div>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" strokeWidth={3} />
            </div>
            <h1 className="text-2xl font-black text-gray-900 mb-2">Email Verified!</h1>
            <p className="text-gray-500 mb-6">Your account is ready. You can now log in.</p>
            <button onClick={() => navigate('/login')}
              className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors">
              Go to Login
            </button>
          </div>
        )}
        {status === 'error' && (
          <div>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8 text-red-600" strokeWidth={3} />
            </div>
            <h1 className="text-2xl font-black text-gray-900 mb-2">Verification Failed</h1>
            <p className="text-gray-500 mb-6">This link is invalid or has already been used.</p>
            <button onClick={() => navigate('/login')}
              className="w-full py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors">
              Go to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
