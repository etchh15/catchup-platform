import React, { useState } from 'react';
import './NotificationCenter.css';

export default function NotificationCenter({
  notifications = [],
  unreadCount = 0,
  onNotificationClick,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  loading = false,
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Format relative time
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString();
  };

  // Get notification icon based on type
  const getNotificationIcon = (type) => {
    const icons = {
      bid_received: '💼',
      bid_accepted: '✅',
      bid_rejected: '❌',
      message_received: '💬',
      task_started: '▶️',
      work_delivered: '📦',
      task_completed: '🎉',
      dispute_filed: '⚠️',
      dispute_response: '🔄',
      dispute_resolved: '✔️',
      review_received: '⭐',
      verification_status: '🔐',
    };
    return icons[type] || '📬';
  };

  // Get notification color based on type
  const getNotificationColor = (type) => {
    const colors = {
      bid_received: '#e3f2fd',
      bid_accepted: '#c8e6c9',
      bid_rejected: '#ffcdd2',
      message_received: '#fff9c4',
      task_started: '#b3e5fc',
      work_delivered: '#c8e6c9',
      task_completed: '#c8e6c9',
      dispute_filed: '#ffe0b2',
      dispute_response: '#f8bbd0',
      dispute_resolved: '#dcedc8',
      review_received: '#f0f4c3',
      verification_status: '#e1bee7',
    };
    return colors[type] || '#f5f5f5';
  };

  const handleNotificationClick = (notification) => {
    if (!notification.is_read) {
      onMarkAsRead?.(notification.id);
    }
    if (notification.action_url) {
      onNotificationClick?.(notification);
    }
  };

  return (
    <div className="notification-center">
      {/* Bell Icon Button */}
      <button
        className={`notification-bell${unreadCount > 0 ? ' has-unread' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title={`${unreadCount} unread notifications`}
      >
        🔔
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {/* Notification Dropdown Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="notification-backdrop"
            onClick={() => setIsOpen(false)}
          />

          {/* Notification Panel */}
          <div className="notification-panel">
            {/* Header */}
            <div className="notification-header">
              <h3 className="notification-title">Notifications</h3>
              <div className="notification-header-actions">
                {unreadCount > 0 && (
                  <button
                    className="notification-action-btn"
                    onClick={onMarkAllAsRead}
                    title="Mark all as read"
                  >
                    ✓ Mark all read
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    className="notification-action-btn danger"
                    onClick={onClearAll}
                    title="Clear all notifications"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>

            {/* Notifications List */}
            <div className="notification-list">
              {loading && (
                <div className="notification-empty">
                  <p>Loading...</p>
                </div>
              )}

              {!loading && notifications.length === 0 && (
                <div className="notification-empty">
                  <p style={{ fontSize: '3em', margin: '10px 0' }}>📭</p>
                  <p>No notifications yet</p>
                  <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    We'll notify you when something happens
                  </p>
                </div>
              )}

              {!loading && notifications.length > 0 && (
                <div>
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`notification-item${!notification.is_read ? ' unread' : ''}`}
                      style={{
                        backgroundColor: !notification.is_read
                          ? getNotificationColor(notification.type)
                          : 'transparent',
                      }}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="notification-icon">
                        {getNotificationIcon(notification.type)}
                      </div>

                      <div className="notification-content">
                        <div className="notification-title-text">
                          {notification.title}
                        </div>
                        <div className="notification-message">
                          {notification.message}
                        </div>
                        <div className="notification-time">
                          {formatTime(notification.created_at)}
                        </div>
                      </div>

                      {!notification.is_read && (
                        <div className="notification-unread-dot" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
