import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, X, Trash2, Trophy } from 'lucide-react';

export default function NotificationDropdown({ userId }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

  useEffect(() => {
    if (!userId) return;
    const fetchCount = () => {
      fetch(`${base}/api/notifications/${userId}/count`).then(r => r.json()).then(d => setUnreadCount(d.count || 0)).catch(() => {});
    };
    fetchCount();
    const t = setInterval(fetchCount, 15000);
    return () => clearInterval(t);
  }, [userId, base]);

  useEffect(() => {
    if (!open || !userId) return;
    fetch(`${base}/api/notifications/${userId}`).then(r => r.json()).then(d => setNotifications(d || [])).catch(() => {});
  }, [open, userId, base]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = async () => {
    await fetch(`${base}/api/notifications/${userId}/read-all`, { method: 'PUT' });
    setUnreadCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
  };

  const markRead = async (id) => {
    await fetch(`${base}/api/notifications/${id}/read`, { method: 'PUT' });
    setUnreadCount(prev => Math.max(0, prev - 1));
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
  };

  const clearAll = async () => {
    await fetch(`${base}/api/notifications/${userId}/clear`, { method: 'DELETE' });
    setNotifications([]);
    setUnreadCount(0);
  };

  const handleInvite = async (notif, accept) => {
    const classroomId = notif.link?.split(':')[1];
    if (!classroomId) return;
    await fetch(`${base}/api/classrooms/${classroomId}/${accept ? 'accept' : 'decline'}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: userId })
    });
    markRead(notif.id);
    setNotifications(prev => prev.map(n => n.id === notif.id ? {
      ...n, is_read: 1, type: accept ? 'classroom_accepted' : 'classroom_declined',
      title: accept ? 'Invitation Accepted' : 'Invitation Declined',
    } : n));
  };

  const timeAgo = (dateStr) => {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const getIcon = (type) => {
    if (type === 'classroom_invite' || type === 'classroom_accepted' || type === 'classroom_declined' || type === 'classroom_added' || type === 'student_joined') return '📚';
    if (type === 'new_assignment') return '📝';
    if (type === 'student_completed' || type === 'all_completed') return '✅';
    if (type === 'achievement') return '🏆';
    return '🔔';
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
        <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'text-gray-900' : 'text-gray-600'}`} />
        {unreadCount > 0 && (
          <>
            <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
            <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full animate-ping" />
          </>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2">
              <h3 className="font-black text-gray-900 text-sm">Notifications</h3>
              {unreadCount > 0 && <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">{unreadCount} new</span>}
            </div>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs text-blue-600 font-bold hover:text-blue-700">Read all</button>
              )}
              {notifications.length > 0 && (
                <button onClick={clearAll} className="text-xs text-gray-400 font-bold hover:text-red-500 flex items-center gap-1">
                  <Trash2 className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-10 text-center">
                <Bell className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 text-sm font-semibold">All caught up!</p>
                <p className="text-gray-300 text-xs mt-1">No notifications</p>
              </div>
            ) : (
              notifications.map(n => {
                const isInvite = n.type === 'classroom_invite' && !n.is_read;
                const isAchievement = n.type === 'achievement';
                return (
                  <div key={n.id}
                    onClick={() => {
                      if (isInvite) return;
                      if (!n.is_read) markRead(n.id);
                      if (n.link && n.link.startsWith('/')) {
                        setOpen(false);
                        navigate(n.link);
                      }
                    }}
                    className={`px-5 py-3.5 border-b border-gray-50 transition-all ${
                      n.is_read
                        ? 'bg-white hover:bg-gray-50'
                        : isAchievement
                          ? 'bg-yellow-50 hover:bg-yellow-100'
                          : 'bg-blue-50 hover:bg-blue-100'
                    } ${!isInvite ? 'cursor-pointer' : ''}`}>
                    <div className="flex items-start gap-3">
                      <span className="text-lg mt-0.5 flex-shrink-0">{getIcon(n.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm ${n.is_read ? 'text-gray-500' : 'text-gray-900 font-bold'}`}>{n.title}</p>
                          {!n.is_read && <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                        <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.created_at)}</p>

                        {isInvite && (
                          <div className="flex gap-2 mt-2.5">
                            <button onClick={(e) => { e.stopPropagation(); handleInvite(n, true); }}
                              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 transition-colors shadow-sm">
                              <Check className="w-3.5 h-3.5" /> Accept
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleInvite(n, false); }}
                              className="flex items-center gap-1.5 px-4 py-2 bg-gray-200 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-300 transition-colors">
                              <X className="w-3.5 h-3.5" /> Decline
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
