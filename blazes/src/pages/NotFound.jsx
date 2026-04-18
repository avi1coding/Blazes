import { useNavigate, useLocation } from 'react-router-dom';
import { Flame, ArrowLeft, Home } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();
  const location = useLocation();
  // window.history.length > 1 isn't perfectly reliable, but in practice tells us
  // whether the user has somewhere to "go back" to within this tab.
  const canGoBack = window.history.length > 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
            <Flame className="w-7 h-7 text-red-600" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white">Blazes</h1>
        </div>

        <div className="bg-white rounded-3xl p-4 sm:p-6 md:p-8 shadow-2xl text-center">
          <div className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-red-600 mb-2">404</div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">This isn't a page</h2>
          <p className="text-gray-600 mb-1">We couldn't find anything at</p>
          <p className="text-sm font-mono text-gray-500 bg-gray-50 rounded-lg px-3 py-2 mb-6 break-all">
            {location.pathname}
          </p>

          <div className="flex flex-col gap-2">
            {canGoBack && (
              <button
                onClick={() => navigate(-1)}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-5 h-5" />
                Go back
              </button>
            )}
            <button
              onClick={() => navigate('/')}
              className={`w-full font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 ${
                canGoBack
                  ? 'bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              <Home className="w-5 h-5" />
              Go home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
