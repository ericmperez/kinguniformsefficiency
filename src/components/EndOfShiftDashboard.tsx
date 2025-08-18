// End-of-Shift Detection Dashboard Component
// Shows when production groups have finished working

import React, { useEffect, useState } from 'react';
import ShiftEndDetectionService, { ShiftSummary, GroupShiftStatus } from '../services/ShiftEndDetectionService';

interface EndOfShiftDashboardProps {
  className?: string;
}

const EndOfShiftDashboard: React.FC<EndOfShiftDashboardProps> = ({ className = '' }) => {
  const [shiftSummary, setShiftSummary] = useState<ShiftSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const shiftService = ShiftEndDetectionService.getInstance();
    
    console.log('🏁 [End-of-Shift Dashboard] Starting shift monitoring');
    
    // Subscribe to shift updates
    const unsubscribe = shiftService.subscribe((summary: ShiftSummary) => {
      console.log('🏁 [End-of-Shift Dashboard] Received shift update:', summary);
      setShiftSummary(summary);
      setLoading(false);
    });

    // Start tracking if not already started
    shiftService.startTracking();

    // Update current time every minute
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => {
      unsubscribe();
      clearInterval(timeInterval);
    };
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return '🟢';
      case 'winding-down': return '🟡';
      case 'finished': return '🔴';
      default: return '⚪';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'winding-down': return 'warning';
      case 'finished': return 'danger';
      default: return 'secondary';
    }
  };

  const formatTimeSinceEnd = (endTime: Date | null) => {
    if (!endTime) return 'Unknown';
    
    const now = currentTime;
    const diff = now.getTime() - endTime.getTime();
    
    if (diff <= 0) return 'Just finished';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `Ended ${hours}h ${minutes}m ago`;
    } else {
      return `Ended ${minutes}m ago`;
    }
  };

  const formatIdleTime = (minutes: number) => {
    if (minutes < 60) {
      return `${Math.round(minutes)}m idle`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = Math.round(minutes % 60);
      return `${hours}h ${remainingMinutes}m idle`;
    }
  };

  const getOverallStatusMessage = (summary: ShiftSummary) => {
    const { overallStatus, activeGroups, windingDownGroups, finishedGroups } = summary;
    
    switch (overallStatus) {
      case 'active':
        return {
          message: `${activeGroups.length} group(s) actively working`,
          detail: windingDownGroups.length > 0 ? `${windingDownGroups.length} winding down` : 'Full production capacity',
          color: 'success'
        };
      case 'winding-down':
        return {
          message: `Production winding down`,
          detail: `${windingDownGroups.length} group(s) finishing up`,
          color: 'warning'
        };
      case 'finished':
        return {
          message: 'All groups have finished working',
          detail: finishedGroups.length > 0 ? `${finishedGroups.length} group(s) completed` : 'No active production',
          color: 'danger'
        };
      default:
        return {
          message: 'Status unknown',
          detail: 'Analyzing production patterns...',
          color: 'secondary'
        };
    }
  };

  if (loading) {
    return (
      <div className={`card ${className}`}>
        <div className="card-header bg-info text-white">
          <h5 className="card-title mb-0">
            🏁 End-of-Shift Detection
          </h5>
        </div>
        <div className="card-body">
          <div className="d-flex justify-content-center">
            <div className="spinner-border text-info" role="status">
              <span className="visually-hidden">Loading shift status...</span>
            </div>
          </div>
          <p className="text-center mt-3 text-muted">Analyzing production patterns...</p>
        </div>
      </div>
    );
  }

  if (!shiftSummary) {
    return (
      <div className={`card ${className}`}>
        <div className="card-header bg-secondary text-white">
          <h5 className="card-title mb-0">
            🏁 End-of-Shift Detection
          </h5>
        </div>
        <div className="card-body">
          <div className="alert alert-info">
            <i className="bi bi-info-circle me-2"></i>
            No production data available for shift analysis
          </div>
        </div>
      </div>
    );
  }

  const statusInfo = getOverallStatusMessage(shiftSummary);

  return (
    <div className={`card ${className}`}>
      <div className={`card-header bg-${statusInfo.color} text-white`}>
        <div className="d-flex justify-content-between align-items-center">
          <h5 className="card-title mb-0">
            🏁 End-of-Shift Detection
          </h5>
          <small className="opacity-75">
            Updated: {currentTime.toLocaleTimeString()}
          </small>
        </div>
      </div>

      <div className="card-body">
        {/* Overall Status */}
        <div className="row mb-4">
          <div className="col-12">
            <div className={`alert alert-${statusInfo.color} mb-3`}>
              <div className="d-flex align-items-center">
                <span className="fs-4 me-3">{getStatusIcon(shiftSummary.overallStatus)}</span>
                <div>
                  <h6 className="alert-heading mb-1">{statusInfo.message}</h6>
                  <p className="mb-0 small">{statusInfo.detail}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Time Information */}
        {shiftSummary.estimatedEndTime && (
          <div className="row mb-4">
            <div className="col-md-4">
              <div className="card border-success">
                <div className="card-body text-center">
                  <h6 className="card-title text-success">⏰ Production Duration</h6>
                  <p className="card-text fs-5 fw-bold">
                    {shiftSummary.productionStartTime && shiftSummary.estimatedEndTime ? 
                      `${shiftSummary.productionDuration.toFixed(1)}h` : 
                      'Unknown'
                    }
                  </p>
                  <small className="text-muted">
                    {shiftSummary.productionStartTime ? 
                      `${shiftSummary.productionStartTime.toLocaleTimeString()} - ${shiftSummary.estimatedEndTime.toLocaleTimeString()}` :
                      'Start to last item'
                    }
                  </small>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card border-primary">
                <div className="card-body text-center">
                  <h6 className="card-title text-primary">📦 Last Item Processed</h6>
                  <p className="card-text fs-5 fw-bold">
                    {shiftSummary.estimatedEndTime.toLocaleTimeString()}
                  </p>
                  <small className="text-muted">
                    Production ended at this time
                  </small>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card border-warning">
                <div className="card-body text-center">
                  <h6 className="card-title text-warning">⏱️ Time Since Last Item</h6>
                  <p className="card-text fs-5 fw-bold">
                    {formatTimeSinceEnd(shiftSummary.estimatedEndTime)}
                  </p>
                  <small className="text-muted">
                    Based on actual item timestamps
                  </small>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Group Status Summary */}
        <div className="row mb-3">
          <div className="col-md-4">
            <div className="card bg-success bg-opacity-10 border-success">
              <div className="card-body text-center">
                <h6 className="card-title text-success">🟢 Active Groups</h6>
                <h4 className="text-success mb-0">{shiftSummary.activeGroups.length}</h4>
                {shiftSummary.activeGroups.length > 0 && (
                  <small className="text-success">
                    {shiftSummary.activeGroups.join(', ')}
                  </small>
                )}
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card bg-warning bg-opacity-10 border-warning">
              <div className="card-body text-center">
                <h6 className="card-title text-warning">🟡 Winding Down</h6>
                <h4 className="text-warning mb-0">{shiftSummary.windingDownGroups.length}</h4>
                {shiftSummary.windingDownGroups.length > 0 && (
                  <small className="text-warning">
                    {shiftSummary.windingDownGroups.join(', ')}
                  </small>
                )}
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card bg-danger bg-opacity-10 border-danger">
              <div className="card-body text-center">
                <h6 className="card-title text-danger">🔴 Finished</h6>
                <h4 className="text-danger mb-0">{shiftSummary.finishedGroups.length}</h4>
                {shiftSummary.finishedGroups.length > 0 && (
                  <small className="text-danger">
                    {shiftSummary.finishedGroups.join(', ')}
                  </small>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div className="mt-4">
          <h6 className="fw-bold mb-3">💡 Recommendations:</h6>
          <div className="list-group">
            {shiftSummary.overallStatus === 'active' && (
              <div className="list-group-item list-group-item-success">
                <i className="bi bi-check-circle me-2"></i>
                <strong>Production Active:</strong> Normal operations - all groups working
              </div>
            )}
            {shiftSummary.overallStatus === 'winding-down' && (
              <>
                <div className="list-group-item list-group-item-warning">
                  <i className="bi bi-clock me-2"></i>
                  <strong>Prepare for End-of-Shift:</strong> Some groups slowing down
                </div>
                <div className="list-group-item list-group-item-info">
                  <i className="bi bi-people me-2"></i>
                  <strong>Resource Planning:</strong> Consider staff reassignment
                </div>
              </>
            )}
            {shiftSummary.overallStatus === 'finished' && (
              <>
                <div className="list-group-item list-group-item-danger">
                  <i className="bi bi-stop-circle me-2"></i>
                  <strong>Shift Complete:</strong> All production groups have finished
                </div>
                <div className="list-group-item list-group-item-primary">
                  <i className="bi bi-clipboard-check me-2"></i>
                  <strong>End-of-Day Tasks:</strong> Begin cleanup and reporting procedures
                </div>
              </>
            )}
          </div>
        </div>

        {/* Debug Information */}
        <div className="mt-4">
          <details className="text-muted">
            <summary className="fw-bold mb-2" style={{ cursor: 'pointer' }}>
              🔧 Technical Details
            </summary>
            <div className="small">
              <p><strong>Detection Method:</strong> Uses actual last item timestamp as production end time</p>
              <ul className="mb-2">
                <li>Active: Last item processed within 15 minutes</li>
                <li>Winding Down: Last item processed 15-30 minutes ago</li>
                <li>Finished: Last item processed 30+ minutes ago</li>
              </ul>
              <p><strong>Production Groups:</strong> Mangle Team, Doblado Team, General Production</p>
              <p><strong>Reference Time:</strong> Uses last item timestamp, not current time</p>
              <p><strong>Last Analysis:</strong> {shiftSummary.lastUpdate.toLocaleString()}</p>
              <p><strong>Groups Analyzed:</strong> {shiftSummary.activeGroups.length + shiftSummary.windingDownGroups.length + shiftSummary.finishedGroups.length}</p>
              {shiftSummary.estimatedEndTime && (
                <p><strong>Latest Item Processed:</strong> {shiftSummary.estimatedEndTime.toLocaleString()}</p>
              )}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
};

export default EndOfShiftDashboard;
