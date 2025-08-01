import React from 'react';
import {
  Snackbar,
  Alert,
  AlertTitle,
  Button,
  Box,
  IconButton,
  Slide,
  SlideProps
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { Notification } from '../hooks/useNotifications';

interface ToastNotificationsProps {
  notifications: Notification[];
  onRemove: (id: string) => void;
}

// Slide transition for better animation
function SlideTransition(props: SlideProps) {
  return <Slide {...props} direction="left" />;
}

export const ToastNotifications: React.FC<ToastNotificationsProps> = ({
  notifications,
  onRemove
}) => {
  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return <SuccessIcon />;
      case 'error':
        return <ErrorIcon />;
      case 'warning':
        return <WarningIcon />;
      case 'info':
        return <InfoIcon />;
      default:
        return <InfoIcon />;
    }
  };

  const getSeverity = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return 'success' as const;
      case 'error':
        return 'error' as const;
      case 'warning':
        return 'warning' as const;
      case 'info':
        return 'info' as const;
      default:
        return 'info' as const;
    }
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 80, // Below app bar
        right: 16,
        zIndex: 2000,
        maxWidth: 400,
        width: '100%',
        '& > *': {
          marginBottom: 1
        }
      }}
    >
      {notifications.map((notification, index) => (
        <Snackbar
          key={notification.id}
          open={true}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          TransitionComponent={SlideTransition}
          sx={{
            position: 'relative',
            top: index * 80, // Stack notifications
            width: '100%',
            '& .MuiSnackbar-root': {
              position: 'relative'
            }
          }}
        >
          <Alert
            severity={getSeverity(notification.type)}
            icon={getIcon(notification.type)}
            action={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {notification.action && (
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => {
                      notification.action?.onClick();
                      onRemove(notification.id);
                    }}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    {notification.action.label}
                  </Button>
                )}
                <IconButton
                  size="small"
                  aria-label="close"
                  color="inherit"
                  onClick={() => onRemove(notification.id)}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            }
            sx={{
              width: '100%',
              alignItems: 'flex-start',
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              borderRadius: 2,
              '& .MuiAlert-message': {
                padding: '8px 0'
              }
            }}
          >
            <AlertTitle sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
              {notification.title}
            </AlertTitle>
            {notification.message && (
              <Box sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                {notification.message}
              </Box>
            )}
          </Alert>
        </Snackbar>
      ))}
    </Box>
  );
};

// Simple toast for quick notifications
export const SimpleToast: React.FC<{
  open: boolean;
  message: string;
  severity?: 'success' | 'error' | 'warning' | 'info';
  onClose: () => void;
  duration?: number;
}> = ({ open, message, severity = 'info', onClose, duration = 3000 }) => {
  return (
    <Snackbar
      open={open}
      autoHideDuration={duration}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      TransitionComponent={SlideTransition}
    >
      <Alert
        onClose={onClose}
        severity={severity}
        sx={{
          width: '100%',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          borderRadius: 2
        }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
};

// Loading toast for operations
export const LoadingToast: React.FC<{
  open: boolean;
  message: string;
}> = ({ open, message }) => {
  return (
    <Snackbar
      open={open}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        severity="info"
        icon={
          <div 
            className="spinner-border spinner-border-sm text-primary" 
            role="status"
            style={{ width: 20, height: 20 }}
          >
            <span className="visually-hidden">Loading...</span>
          </div>
        }
        sx={{
          width: '100%',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          borderRadius: 2,
          backgroundColor: '#f8f9fa',
          color: '#333'
        }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
}; 