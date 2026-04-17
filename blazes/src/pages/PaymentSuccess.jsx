import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Flame, Check } from 'lucide-react';

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    // Brief delay to let webhook process
    const timer = setTimeout(() => setStatus('success'), 2000);
    return () => clearTimeout(timer);
  }, []);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const homePath = user.role === 'teacher' ? '/home/teacher' : '/home/student';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {status === 'loading' ? (
          <>
            <Flame className="w-12 h-12 text-red-500 mx-auto mb-4 animate-pulse" />
            <h1 className="text-2xl font-black text-gray-900 mb-2">Processing Payment...</h1>
            <p className="text-gray-500">Please wait</p>
          </>
        ) : (
          <>
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-green-600" strokeWidth={3} />
            </div>
            <h1 className="text-3xl font-black text-gray-900 mb-3">Payment Successful!</h1>
            <p className="text-gray-600 mb-8">Your purchase has been activated. Enjoy your upgrade!</p>
            <button onClick={() => navigate(homePath)}
              className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors">
              Go to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}
