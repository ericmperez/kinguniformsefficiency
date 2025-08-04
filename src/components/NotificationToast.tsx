// Toast notification component for displaying real-time updates
import React from 'react';
import type { Notification } from '../hooks/useNotifications';

interface NotificationToastProps {
  notifications: Notification[];
  onRemove: (id: string) => void;
}

const NotificationToast: React.FC<NotificationToastProps> = ({ notifications, onRemove }) => {
  const getIconForType = (type: Notification['type']) => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📢';
    }
  };

  const getColorForType = (type: Notification['type']) => {
    switch (type) {
      case 'success': return 'bg-success';
      case 'error': return 'bg-danger';
      case 'warning': return 'bg-warning';
      case 'info': return 'bg-info';
      default: return 'bg-secondary';
    }
  };

  if (notifications.length === 0) return null;

  return (
    <div 
      className="position-fixed"
      style={{ 
        top: '20px', 
        right: '20px', 
        zIndex: 1060,
        width: '350px'
      }}
    >
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`alert ${getColorForType(notification.type)} alert-dismissible fade show mb-2`}
          role="alert"
          style={{
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            animation: 'slideInRight 0.3s ease-out'
          }}
        >
          <div className="d-flex align-items-start">
            <span className="me-2" style={{ fontSize: '18px' }}>
              {getIconForType(notification.type)}
            </span>
            <div className="flex-grow-1">
              <div className="fw-bold">
                {notification.title}
              </div>
              {notification.message && (
                <div className="small mt-1">
                  {notification.message}
                </div>
              )}
              {notification.action && (
                <button
                  className="btn btn-sm btn-outline-light mt-2"
                  onClick={notification.action.onClick}
                >
                  {notification.action.label}
                </button>
              )}
            </div>
          </div>
          <button
            type="button"
            className="btn-close btn-close-white"
            aria-label="Close"
            onClick={() => onRemove(notification.id)}
          ></button>
        </div>
      ))}
      
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        .alert.fade.show {
          animation: slideInRight 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default NotificationToast;
