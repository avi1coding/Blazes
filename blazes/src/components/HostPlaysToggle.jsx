import { Users, User } from 'lucide-react';

export default function HostPlaysToggle({ value, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Will you play this game?
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`flex-1 py-2.5 px-4 rounded-lg font-bold text-sm transition-all border-2 flex items-center justify-center gap-2 ${
            !value
              ? 'bg-red-600 text-white border-red-600'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
          }`}
        >
          <Users className="w-4 h-4" />
          Just host
        </button>
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`flex-1 py-2.5 px-4 rounded-lg font-bold text-sm transition-all border-2 flex items-center justify-center gap-2 ${
            value
              ? 'bg-red-600 text-white border-red-600'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
          }`}
        >
          <User className="w-4 h-4" />
          Play too
        </button>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        {value
          ? 'You\'ll join the game as a player. You can start the game alone.'
          : 'You\'ll only host. You need at least one student to join before starting.'}
      </p>
    </div>
  );
}
