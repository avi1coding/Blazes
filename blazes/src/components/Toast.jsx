import React, { useEffect } from 'react';
import { X, AlertCircle, CheckCircle, InfoIcon } from 'lucide-react';

export default function Toast({ message, type = 'info', onClose, duration = 4000, show = true }) {
  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [show, onClose, duration]);

  if (!show) return null;

  const bgColor = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-yellow-50 border-yellow-200',
    info: 'bg-blue-50 border-blue-200'
  }[type] || 'bg-blue-50 border-blue-200';

  const iconColor = {
    success: 'text-green-600',
    error: 'text-red-600',
    warning: 'text-yellow-600',
    info: 'text-blue-600'
  }[type] || 'text-blue-600';

  const Icon = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertCircle,
    info: InfoIcon
  }[type] || InfoIcon;

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 ${bgColor} border rounded-lg px-4 py-3 shadow-lg max-w-sm animate-fade-in`}>
      <Icon className={`w-5 h-5 flex-shrink-0 ${iconColor}`} strokeWidth={2} />
      <p className={`flex-1 text-sm font-medium ${iconColor.replace('text-', 'text-')}`}>{message}</p>
      <button
        onClick={onClose}
        className={`flex-shrink-0 ${iconColor} hover:opacity-70 transition-opacity`}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// Centered modal-style notification for confirmations/errors
export function ModalNotification({ title, message, type = 'info', onClose, buttons, show = true }) {
  if (!show) return null;

  const bgColor = {
    success: 'border-green-200 bg-green-50',
    error: 'border-red-200 bg-red-50',
    warning: 'border-yellow-200 bg-yellow-50',
    info: 'border-blue-200 bg-blue-50'
  }[type] || 'border-blue-200 bg-blue-50';

  const iconBg = {
    success: 'bg-green-100',
    error: 'bg-red-100',
    warning: 'bg-yellow-100',
    info: 'bg-blue-100'
  }[type] || 'bg-blue-100';

  const iconColor = {
    success: 'text-green-600',
    error: 'text-red-600',
    warning: 'text-yellow-600',
    info: 'text-blue-600'
  }[type] || 'text-blue-600';

  const Icon = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertCircle,
    info: InfoIcon
  }[type] || InfoIcon;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-2xl ${bgColor} border-2 p-8 max-w-md w-full shadow-xl`}>
        <div className="flex items-center gap-4 mb-4">
          <div className={`w-12 h-12 ${iconBg} rounded-full flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-6 h-6 ${iconColor}`} strokeWidth={2} />
          </div>
          <h2 className="text-xl font-black text-gray-900">{title}</h2>
        </div>
        
        {message && <p className="text-gray-700 mb-6">{message}</p>}
        
        <div className="flex gap-3">
          {buttons ? (
            buttons.map((btn, idx) => (
              <button
                key={idx}
                onClick={() => { btn.onClick?.(); onClose?.(); }}
                className={`flex-1 py-2.5 rounded-lg font-bold transition-colors ${btn.className || 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              >
                {btn.label}
              </button>
            ))
          ) : (
            <button
              onClick={onClose}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors"
            >
              OK
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
