// Real-time indicator component for showing live data updates
import React from 'react';
import type { RealTimeStatus } from '../hooks/useRealTimeIndicator';

interface RealTimeIndicatorProps {
  status: RealTimeStatus;
  size?: 'small' | 'medium' | 'large';
  showDetails?: boolean;
  position?: 'inline' | 'floating';
  className?: string;
}

const RealTimeIndicator: React.FC<RealTimeIndicatorProps> = ({
  status,
  size = 'medium',
  showDetails = true,
  position = 'inline',
  className = '',
}) => {
  const getStatusColor = () => {
    if (status.isUpdating) return '#ff9800'; // Orange
    if (status.isLive) return '#4caf50'; // Green
    return '#9e9e9e'; // Gray
  };

  const getStatusText = () => {
    if (status.isUpdating) return 'Updating...';
    if (status.isLive) return 'Live';
    return 'Offline';
  };

  const getStatusIcon = () => {
    if (status.isUpdating) {
      return (
        <div 
          className="animate-spin rounded-full border-2 border-t-transparent"
          style={{ 
            borderColor: getStatusColor(),
            borderTopColor: 'transparent',
            width: size === 'small' ? 12 : size === 'medium' ? 16 : 20,
            height: size === 'small' ? 12 : size === 'medium' ? 16 : 20,
          }}
        />
      );
    }

    return (
      <div 
        className={`rounded-full ${status.isLive ? 'animate-pulse' : ''}`}
        style={{ 
          backgroundColor: getStatusColor(),
          width: size === 'small' ? 8 : size === 'medium' ? 10 : 12,
          height: size === 'small' ? 8 : size === 'medium' ? 10 : 12,
        }}
      />
    );
  };

  const formatLastUpdate = () => {
    if (!status.lastUpdate) return 'Never';
    
    const now = new Date();
    const diff = now.getTime() - status.lastUpdate.getTime();
    
    if (diff < 1000) return 'Just now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return status.lastUpdate.toLocaleTimeString();
  };

  const containerClasses = `
    ${position === 'floating' ? 'fixed top-4 right-4 z-50' : ''}
    ${className}
  `;

  return (
    <div className={containerClasses}>
      <div 
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg border
          ${position === 'floating' ? 'bg-white shadow-lg' : 'bg-gray-50'}
          ${size === 'small' ? 'text-xs' : size === 'medium' ? 'text-sm' : 'text-base'}
        `}
        style={{ 
          borderColor: getStatusColor(),
          fontSize: size === 'small' ? '12px' : size === 'medium' ? '14px' : '16px',
        }}
      >
        {/* Status Icon */}
        <div className="flex items-center justify-center">
          {getStatusIcon()}
        </div>

        {/* Status Text */}
        <span 
          className="font-medium"
          style={{ color: getStatusColor() }}
        >
          {getStatusText()}
        </span>

        {/* Details */}
        {showDetails && (
          <div className="flex flex-col text-gray-600" style={{ fontSize: size === 'small' ? '10px' : '12px' }}>
            <span>Last: {formatLastUpdate()}</span>
            {status.updateCount > 0 && (
              <span>Updates: {status.updateCount}</span>
            )}
            {status.dataSource && (
              <span>Source: {status.dataSource}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RealTimeIndicator;
