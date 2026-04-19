import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import GameModeSelect from '../components/GameModeSelect';

export default function GameModePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { kit } = location.state || {};
  
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  if (!kit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No kit selected</p>
          <button
            onClick={() => navigate('/home/teacher')}
            className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-red-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <GameModeSelect
        kit={kit}
        user={user}
        onBack={() => navigate('/home/teacher')}
      />
    </div>
  );
}
