import React from 'react';
import { Box, Skeleton, Typography, Alert } from '@mui/material';

// Skeleton loading component for tables
export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({ 
  rows = 5, 
  columns = 4 
}) => (
  <Box sx={{ width: '100%' }}>
    {/* Table header skeleton */}
    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
      {Array.from({ length: columns }).map((_, index) => (
        <Skeleton 
          key={`header-${index}`} 
          variant="text" 
          sx={{ flex: 1, height: 40 }} 
        />
      ))}
    </Box>
    
    {/* Table rows skeleton */}
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <Box key={`row-${rowIndex}`} sx={{ display: 'flex', gap: 2, mb: 1 }}>
        {Array.from({ length: columns }).map((_, colIndex) => (
          <Skeleton 
            key={`cell-${rowIndex}-${colIndex}`}
            variant="rectangular" 
            sx={{ flex: 1, height: 60, borderRadius: 1 }} 
          />
        ))}
      </Box>
    ))}
  </Box>
);

// Card grid skeleton for dashboard
export const CardGridSkeleton: React.FC<{ cards?: number }> = ({ cards = 6 }) => (
  <Box sx={{ 
    display: 'grid', 
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
    gap: 3,
    p: 2 
  }}>
    {Array.from({ length: cards }).map((_, index) => (
      <Box key={`card-${index}`} sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Skeleton variant="rectangular" height={200} />
        <Box sx={{ p: 2 }}>
          <Skeleton variant="text" sx={{ fontSize: '1.5rem', mb: 1 }} />
          <Skeleton variant="text" sx={{ fontSize: '1rem', mb: 1 }} />
          <Skeleton variant="text" sx={{ fontSize: '1rem', width: '60%' }} />
        </Box>
      </Box>
    ))}
  </Box>
);

// Form skeleton for settings pages
export const FormSkeleton: React.FC = () => (
  <Box sx={{ maxWidth: 600, mx: 'auto', p: 3 }}>
    <Skeleton variant="text" sx={{ fontSize: '2rem', mb: 3, width: '40%' }} />
    
    {Array.from({ length: 5 }).map((_, index) => (
      <Box key={`field-${index}`} sx={{ mb: 3 }}>
        <Skeleton variant="text" sx={{ fontSize: '1rem', mb: 1, width: '30%' }} />
        <Skeleton variant="rectangular" height={56} sx={{ borderRadius: 1 }} />
      </Box>
    ))}
    
    <Box sx={{ display: 'flex', gap: 2, mt: 4 }}>
      <Skeleton variant="rectangular" width={120} height={40} sx={{ borderRadius: 1 }} />
      <Skeleton variant="rectangular" width={100} height={40} sx={{ borderRadius: 1 }} />
    </Box>
  </Box>
);

// List skeleton for reports
export const ListSkeleton: React.FC<{ items?: number }> = ({ items = 8 }) => (
  <Box sx={{ width: '100%' }}>
    {Array.from({ length: items }).map((_, index) => (
      <Box key={`item-${index}`} sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 2, 
        p: 2, 
        borderBottom: '1px solid #f0f0f0' 
      }}>
        <Skeleton variant="circular" width={40} height={40} />
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" sx={{ fontSize: '1.2rem', mb: 0.5, width: '70%' }} />
          <Skeleton variant="text" sx={{ fontSize: '0.9rem', width: '50%' }} />
        </Box>
        <Skeleton variant="rectangular" width={80} height={30} sx={{ borderRadius: 1 }} />
      </Box>
    ))}
  </Box>
);

// Stats skeleton for analytics
export const StatsSkeleton: React.FC = () => (
  <Box sx={{ 
    display: 'grid', 
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
    gap: 2,
    mb: 4 
  }}>
    {Array.from({ length: 4 }).map((_, index) => (
      <Box key={`stat-${index}`} sx={{ 
        p: 3, 
        border: '1px solid #e0e0e0', 
        borderRadius: 2 
      }}>
        <Skeleton variant="text" sx={{ fontSize: '0.9rem', mb: 1, width: '60%' }} />
        <Skeleton variant="text" sx={{ fontSize: '2.5rem', mb: 1, width: '40%' }} />
        <Skeleton variant="text" sx={{ fontSize: '0.8rem', width: '80%' }} />
      </Box>
    ))}
  </Box>
);

// Enhanced loading spinner with message
export const LoadingSpinner: React.FC<{ 
  message?: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'page' | 'inline' | 'overlay';
}> = ({ 
  message = "Loading...", 
  size = 'medium',
  variant = 'page'
}) => {
  const sizeMap = {
    small: { minHeight: '200px', spinnerSize: 30 },
    medium: { minHeight: '50vh', spinnerSize: 40 },
    large: { minHeight: '80vh', spinnerSize: 50 }
  };

  const variantStyles = {
    page: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: sizeMap[size].minHeight,
      width: '100%'
    },
    inline: {
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      p: 2
    },
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      zIndex: 9999
    }
  };

  return (
    <Box sx={variantStyles[variant] as any}>
      <div 
        className="spinner-border text-primary" 
        role="status"
        style={{ 
          width: sizeMap[size].spinnerSize, 
          height: sizeMap[size].spinnerSize 
        }}
      >
        <span className="visually-hidden">{message}</span>
      </div>
      {variant !== 'inline' && (
        <Typography 
          variant="body2" 
          color="text.secondary" 
          sx={{ mt: 2, textAlign: 'center' }}
        >
          {message}
        </Typography>
      )}
    </Box>
  );
};

// Error boundary fallback component
export const ErrorFallback: React.FC<{
  error?: Error;
  resetError?: () => void;
  message?: string;
}> = ({ 
  error, 
  resetError, 
  message = "Something went wrong. Please try again." 
}) => (
  <Alert 
    severity="error" 
    sx={{ m: 2 }}
    action={
      resetError ? (
        <button 
          className="btn btn-outline-danger btn-sm"
          onClick={resetError}
        >
          Try Again
        </button>
      ) : undefined
    }
  >
    <Typography variant="h6" component="div" sx={{ mb: 1 }}>
      Oops! Something went wrong
    </Typography>
    <Typography variant="body2" sx={{ mb: 1 }}>
      {message}
    </Typography>
    {error && process.env.NODE_ENV === 'development' && (
      <Typography variant="caption" component="div" sx={{ 
        mt: 1, 
        p: 1, 
        backgroundColor: '#f5f5f5', 
        borderRadius: 1,
        fontFamily: 'monospace',
        fontSize: '0.75rem'
      }}>
        {error.message}
      </Typography>
    )}
  </Alert>
);

// Data state wrapper with loading and error states
export const DataStateWrapper: React.FC<{
  loading: boolean;
  error?: Error | string | null;
  data?: any;
  children: React.ReactNode;
  loadingComponent?: React.ReactNode;
  errorComponent?: React.ReactNode;
  emptyComponent?: React.ReactNode;
  onRetry?: () => void;
}> = ({
  loading,
  error,
  data,
  children,
  loadingComponent,
  errorComponent,
  emptyComponent,
  onRetry
}) => {
  if (loading) {
    return <>{loadingComponent || <LoadingSpinner />}</>;
  }

  if (error) {
    return (
      <>
        {errorComponent || (
          <ErrorFallback 
            error={typeof error === 'string' ? new Error(error) : error}
            resetError={onRetry}
          />
        )}
      </>
    );
  }

  if (data !== undefined && Array.isArray(data) && data.length === 0) {
    return (
      <>
        {emptyComponent || (
          <Box sx={{ textAlign: 'center', p: 4 }}>
            <Typography variant="h6" color="text.secondary">
              No data available
            </Typography>
            <Typography variant="body2" color="text.secondary">
              There's nothing to show right now.
            </Typography>
          </Box>
        )}
      </>
    );
  }

  return <>{children}</>;
}; 