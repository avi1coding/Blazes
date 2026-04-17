import React from 'react';
import { X, AlertCircle, CheckCircle } from 'lucide-react';

export default function Popup({ message, type = 'error', onClose }) {
  if (!message) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
            type === 'error' ? 'bg-red-100' : 'bg-green-100'
          }`}>
            {type === 'error' ? (
              <AlertCircle className="w-6 h-6 text-red-600" strokeWidth={2.5} />
            ) : (
              <CheckCircle className="w-6 h-6 text-green-600" strokeWidth={2.5} />
            )}
          </div>
          
          <div className="flex-1">
            <h3 className="font-black text-gray-900 text-lg mb-1">
              {type === 'error' ? 'Error' : 'Success'}
            </h3>
            <p className="text-gray-600">{message}</p>
          </div>

          <button 
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <button
          onClick={onClose}
          className={`w-full mt-6 py-3 rounded-xl font-bold transition-colors ${
            type === 'error' 
              ? 'bg-red-600 text-white hover:bg-red-700' 
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          OK
        </button>
      </div>
    </div>
  );
}