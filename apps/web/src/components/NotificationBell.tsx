import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

import { fetchNotifications, markNotificationAsRead, markAllNotificationsAsRead, type Notification } from '../api/notifications';
import { formatDistanceToNow } from 'date-fns';

export const NotificationBell = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => fetchNotifications('UNREAD'),
    refetchInterval: 30000, // Poll every 30 seconds
  });

  const markAsReadMutation = useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const unreadCount = data?.unreadCount ?? 0;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleNotificationClick = (notification: Notification) => {
    if (notification.status === 'UNREAD') {
      markAsReadMutation.mutate(notification.id);
    }
    if (notification.link) {
      window.location.href = notification.link;
    }
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-neutral-100 transition"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-neutral-600" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-3xl shadow-lg border border-neutral-200 z-50 max-h-96 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsReadMutation.mutate()}
                className="text-xs text-primary hover:underline"
                disabled={markAllAsReadMutation.isPending}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-sm text-neutral-500">Loading...</div>
            ) : !data?.notifications.length ? (
              <div className="px-4 py-8 text-center text-sm text-neutral-500">No notifications</div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {data.notifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full text-left px-4 py-3 hover:bg-neutral-50 transition ${
                      notification.status === 'UNREAD' ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${
                          notification.status === 'UNREAD' ? 'bg-primary' : 'bg-transparent'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-900">{notification.title}</p>
                        <p className="text-xs text-neutral-600 mt-1 line-clamp-2">{notification.message}</p>
                        <p className="text-xs text-neutral-400 mt-1">
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {data && data.notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-neutral-200">
              <button
                onClick={() => {
                  setIsOpen(false);
                  // Navigate to full notifications page if you create one
                }}
                className="text-xs text-primary hover:underline w-full text-center"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

