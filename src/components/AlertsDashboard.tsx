import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, Timestamp, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';

// Alert types that can occur in the system
export type AlertType = 
  | 'segregation_error' 
  | 'driver_assignment' 
  | 'system_error' 
  | 'production_delay' 
  | 'tunnel_issue' 
  | 'washing_alert' 
  | 'conventional_issue' 
  | 'shipping_problem' 
  | 'invoice_warning'
  | 'cart_verification'
  | 'special_item'
  | 'end_of_shift'
  | 'general';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface SystemAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  component: string; // Which system component triggered the alert
  clientName?: string;
  userName?: string;
  triggerData?: any; // Additional context data
  timestamp: Timestamp;
  isRead: boolean;
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Timestamp;
  resolveNotes?: string;
  createdBy: string;
}

interface AlertsDashboardProps {
  maxAlerts?: number;
  showCreateAlert?: boolean;
}

const AlertsDashboard: React.FC<AlertsDashboardProps> = ({ 
  maxAlerts = 100, 
  showCreateAlert = true 
}) => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeverity, setSelectedSeverity] = useState<AlertSeverity | 'all'>('all');
  const [selectedType, setSelectedType] = useState<AlertType | 'all'>('all');
  const [selectedComponent, setSelectedComponent] = useState<string>('all');
  const [showOnlyUnread, setShowOnlyUnread] = useState(false);
  const [showOnlyUnresolved, setShowOnlyUnresolved] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedDateRange, setSelectedDateRange] = useState<string>('today');

  // New alert form state
  const [newAlert, setNewAlert] = useState({
    type: 'general' as AlertType,
    severity: 'medium' as AlertSeverity,
    title: '',
    message: '',
    component: 'System'
  });

  // Real-time alerts listener
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let alertQuery = query(
      collection(db, 'system_alerts'),
      orderBy('timestamp', 'desc'),
      limit(maxAlerts)
    );

    // Apply date filter
    if (selectedDateRange === 'today') {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      alertQuery = query(
        collection(db, 'system_alerts'),
        where('timestamp', '>=', Timestamp.fromDate(today)),
        where('timestamp', '<', Timestamp.fromDate(tomorrow)),
        orderBy('timestamp', 'desc')
      );
    } else if (selectedDateRange === 'week') {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      alertQuery = query(
        collection(db, 'system_alerts'),
        where('timestamp', '>=', Timestamp.fromDate(weekAgo)),
        orderBy('timestamp', 'desc'),
        limit(maxAlerts)
      );
    }

    const unsubscribe = onSnapshot(alertQuery, (snapshot) => {
      const alertsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp || Timestamp.now()
      })) as SystemAlert[];
      
      setAlerts(alertsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [maxAlerts, selectedDateRange]);

  // Filter alerts based on selected criteria
  const filteredAlerts = alerts.filter(alert => {
    if (selectedSeverity !== 'all' && alert.severity !== selectedSeverity) return false;
    if (selectedType !== 'all' && alert.type !== selectedType) return false;
    if (selectedComponent !== 'all' && alert.component !== selectedComponent) return false;
    if (showOnlyUnread && alert.isRead) return false;
    if (showOnlyUnresolved && alert.isResolved) return false;
    return true;
  });

  // Get unique components from alerts
  const components = Array.from(new Set(alerts.map(alert => alert.component)));

  // Alert statistics
  const stats = {
    total: filteredAlerts.length,
    unread: filteredAlerts.filter(a => !a.isRead).length,
    unresolved: filteredAlerts.filter(a => !a.isResolved).length,
    critical: filteredAlerts.filter(a => a.severity === 'critical').length,
    high: filteredAlerts.filter(a => a.severity === 'high').length,
  };

  // Create new alert
  const handleCreateAlert = async () => {
    if (!user || !newAlert.title.trim() || !newAlert.message.trim()) return;

    try {
      await addDoc(collection(db, 'system_alerts'), {
        ...newAlert,
        timestamp: Timestamp.now(),
        isRead: false,
        isResolved: false,
        createdBy: user.username || user.id,
        triggerData: {
          manuallyCreated: true,
          userRole: user.role
        }
      });

      // Reset form
      setNewAlert({
        type: 'general',
        severity: 'medium',
        title: '',
        message: '',
        component: 'System'
      });
      setShowCreateForm(false);
    } catch (error) {
      console.error('Error creating alert:', error);
    }
  };

  // Mark alert as read
  const markAsRead = async (alertId: string) => {
    try {
      await updateDoc(doc(db, 'system_alerts', alertId), {
        isRead: true
      });
    } catch (error) {
      console.error('Error marking alert as read:', error);
    }
  };

  // Resolve alert
  const resolveAlert = async (alertId: string, notes?: string) => {
    if (!user) return;

    try {
      await updateDoc(doc(db, 'system_alerts', alertId), {
        isResolved: true,
        resolvedBy: user.username || user.id,
        resolvedAt: Timestamp.now(),
        resolveNotes: notes || '',
        isRead: true // Auto-mark as read when resolved
      });
    } catch (error) {
      console.error('Error resolving alert:', error);
    }
  };

  // Delete alert (admin only)
  const deleteAlert = async (alertId: string) => {
    if (!user || !['Admin', 'Owner'].includes(user.role)) return;

    if (window.confirm('Are you sure you want to delete this alert?')) {
      try {
        await deleteDoc(doc(db, 'system_alerts', alertId));
      } catch (error) {
        console.error('Error deleting alert:', error);
      }
    }
  };

  // Get alert icon and color
  const getAlertDisplay = (alert: SystemAlert) => {
    const severityColors = {
      low: 'text-info',
      medium: 'text-warning', 
      high: 'text-danger',
      critical: 'text-danger fw-bold'
    };

    const typeIcons = {
      segregation_error: '📦',
      driver_assignment: '🚛',
      system_error: '⚠️',
      production_delay: '⏰',
      tunnel_issue: '🔄',
      washing_alert: '🧽',
      conventional_issue: '⚙️',
      shipping_problem: '📦',
      invoice_warning: '📄',
      cart_verification: '✅',
      special_item: '🔔',
      end_of_shift: '🏁',
      general: '📢'
    };

    return {
      icon: typeIcons[alert.type] || '📢',
      color: severityColors[alert.severity],
      bgColor: alert.isResolved ? 'bg-light' : (alert.severity === 'critical' ? 'bg-danger-subtle' : 
                alert.severity === 'high' ? 'bg-warning-subtle' : '')
    };
  };

  if (loading) {
    return (
      <div className="card">
        <div className="card-body text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading alerts...</span>
          </div>
          <p className="mt-2">Loading system alerts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid">
      <div className="row mb-4">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h2 className="mb-0">
              🚨 System Alerts Dashboard
              {stats.unresolved > 0 && (
                <span className="badge bg-danger ms-2">{stats.unresolved} Unresolved</span>
              )}
            </h2>
            {showCreateAlert && ['Admin', 'Supervisor', 'Owner'].includes(user?.role || '') && (
              <button 
                className="btn btn-primary"
                onClick={() => setShowCreateForm(true)}
              >
                <i className="bi bi-plus-circle me-1"></i>
                Create Alert
              </button>
            )}
          </div>

          {/* Statistics Cards */}
          <div className="row mb-4">
            <div className="col-md-2 col-6 mb-2">
              <div className="card border-primary">
                <div className="card-body text-center py-2">
                  <h4 className="text-primary mb-1">{stats.total}</h4>
                  <small className="text-muted">Total Alerts</small>
                </div>
              </div>
            </div>
            <div className="col-md-2 col-6 mb-2">
              <div className="card border-info">
                <div className="card-body text-center py-2">
                  <h4 className="text-info mb-1">{stats.unread}</h4>
                  <small className="text-muted">Unread</small>
                </div>
              </div>
            </div>
            <div className="col-md-2 col-6 mb-2">
              <div className="card border-warning">
                <div className="card-body text-center py-2">
                  <h4 className="text-warning mb-1">{stats.unresolved}</h4>
                  <small className="text-muted">Unresolved</small>
                </div>
              </div>
            </div>
            <div className="col-md-2 col-6 mb-2">
              <div className="card border-danger">
                <div className="card-body text-center py-2">
                  <h4 className="text-danger mb-1">{stats.critical}</h4>
                  <small className="text-muted">Critical</small>
                </div>
              </div>
            </div>
            <div className="col-md-2 col-6 mb-2">
              <div className="card border-secondary">
                <div className="card-body text-center py-2">
                  <h4 className="text-secondary mb-1">{stats.high}</h4>
                  <small className="text-muted">High Priority</small>
                </div>
              </div>
            </div>
            <div className="col-md-2 col-6 mb-2">
              <div className="card border-success">
                <div className="card-body text-center py-2">
                  <h4 className="text-success mb-1">{alerts.filter(a => a.isResolved).length}</h4>
                  <small className="text-muted">Resolved</small>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="mb-0">🔍 Filters</h5>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-2">
                  <label className="form-label">Date Range</label>
                  <select 
                    className="form-select form-select-sm"
                    value={selectedDateRange}
                    onChange={(e) => setSelectedDateRange(e.target.value)}
                  >
                    <option value="today">Today</option>
                    <option value="week">Last 7 Days</option>
                    <option value="all">All Time</option>
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label">Severity</label>
                  <select 
                    className="form-select form-select-sm"
                    value={selectedSeverity}
                    onChange={(e) => setSelectedSeverity(e.target.value as AlertSeverity | 'all')}
                  >
                    <option value="all">All Severities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label">Type</label>
                  <select 
                    className="form-select form-select-sm"
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value as AlertType | 'all')}
                  >
                    <option value="all">All Types</option>
                    <option value="segregation_error">Segregation</option>
                    <option value="driver_assignment">Driver Assignment</option>
                    <option value="tunnel_issue">Tunnel</option>
                    <option value="washing_alert">Washing</option>
                    <option value="conventional_issue">Conventional</option>
                    <option value="shipping_problem">Shipping</option>
                    <option value="invoice_warning">Invoice</option>
                    <option value="system_error">System Error</option>
                    <option value="general">General</option>
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label">Component</label>
                  <select 
                    className="form-select form-select-sm"
                    value={selectedComponent}
                    onChange={(e) => setSelectedComponent(e.target.value)}
                  >
                    <option value="all">All Components</option>
                    {components.map(component => (
                      <option key={component} value={component}>{component}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Status Filters</label>
                  <div className="d-flex gap-2">
                    <div className="form-check">
                      <input 
                        className="form-check-input" 
                        type="checkbox" 
                        id="unreadOnly"
                        checked={showOnlyUnread}
                        onChange={(e) => setShowOnlyUnread(e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="unreadOnly">
                        Unread Only
                      </label>
                    </div>
                    <div className="form-check">
                      <input 
                        className="form-check-input" 
                        type="checkbox" 
                        id="unresolvedOnly"
                        checked={showOnlyUnresolved}
                        onChange={(e) => setShowOnlyUnresolved(e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="unresolvedOnly">
                        Unresolved Only
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Create Alert Form */}
          {showCreateForm && (
            <div className="card mb-4 border-primary">
              <div className="card-header bg-primary text-white">
                <h5 className="mb-0">➕ Create New Alert</h5>
              </div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-3">
                    <label className="form-label">Type</label>
                    <select 
                      className="form-select"
                      value={newAlert.type}
                      onChange={(e) => setNewAlert({...newAlert, type: e.target.value as AlertType})}
                    >
                      <option value="general">General</option>
                      <option value="segregation_error">Segregation Error</option>
                      <option value="driver_assignment">Driver Assignment</option>
                      <option value="tunnel_issue">Tunnel Issue</option>
                      <option value="washing_alert">Washing Alert</option>
                      <option value="conventional_issue">Conventional Issue</option>
                      <option value="shipping_problem">Shipping Problem</option>
                      <option value="invoice_warning">Invoice Warning</option>
                      <option value="system_error">System Error</option>
                    </select>
                  </div>
                  <div className="col-md-2">
                    <label className="form-label">Severity</label>
                    <select 
                      className="form-select"
                      value={newAlert.severity}
                      onChange={(e) => setNewAlert({...newAlert, severity: e.target.value as AlertSeverity})}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Component</label>
                    <input 
                      type="text"
                      className="form-control"
                      value={newAlert.component}
                      onChange={(e) => setNewAlert({...newAlert, component: e.target.value})}
                      placeholder="e.g., Segregation, Tunnel, etc."
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Title</label>
                    <input 
                      type="text"
                      className="form-control"
                      value={newAlert.title}
                      onChange={(e) => setNewAlert({...newAlert, title: e.target.value})}
                      placeholder="Brief alert title"
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label">Message</label>
                    <textarea 
                      className="form-control"
                      rows={3}
                      value={newAlert.message}
                      onChange={(e) => setNewAlert({...newAlert, message: e.target.value})}
                      placeholder="Detailed alert description..."
                    />
                  </div>
                  <div className="col-12">
                    <button 
                      className="btn btn-primary me-2"
                      onClick={handleCreateAlert}
                      disabled={!newAlert.title.trim() || !newAlert.message.trim()}
                    >
                      Create Alert
                    </button>
                    <button 
                      className="btn btn-secondary"
                      onClick={() => setShowCreateForm(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Alerts List */}
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">
                📋 Alerts ({filteredAlerts.length})
                {selectedDateRange !== 'all' && (
                  <small className="text-muted ms-2">
                    • {selectedDateRange === 'today' ? 'Today' : 'Last 7 days'}
                  </small>
                )}
              </h5>
            </div>
            <div className="card-body p-0">
              {filteredAlerts.length === 0 ? (
                <div className="text-center py-4">
                  <div className="text-muted">
                    <i className="bi bi-check-circle" style={{fontSize: '3rem'}}></i>
                    <h5 className="mt-2">No alerts found</h5>
                    <p>
                      {showOnlyUnresolved 
                        ? "All alerts have been resolved! 🎉" 
                        : "No alerts match your current filters."
                      }
                    </p>
                  </div>
                </div>
              ) : (
                <div className="list-group list-group-flush">
                  {filteredAlerts.map((alert) => {
                    const display = getAlertDisplay(alert);
                    return (
                      <div 
                        key={alert.id} 
                        className={`list-group-item ${display.bgColor} ${!alert.isRead ? 'border-start border-4 border-primary' : ''}`}
                      >
                        <div className="d-flex justify-content-between align-items-start">
                          <div className="flex-grow-1">
                            <div className="d-flex align-items-center mb-2">
                              <span className="me-2" style={{fontSize: '1.2em'}}>
                                {display.icon}
                              </span>
                              <h6 className={`mb-0 ${display.color}`}>
                                {alert.title}
                                {!alert.isRead && (
                                  <span className="badge bg-primary ms-2">New</span>
                                )}
                                {alert.isResolved && (
                                  <span className="badge bg-success ms-2">Resolved</span>
                                )}
                              </h6>
                              <span className={`badge ms-2 ${
                                alert.severity === 'critical' ? 'bg-danger' :
                                alert.severity === 'high' ? 'bg-warning' :
                                alert.severity === 'medium' ? 'bg-info' : 'bg-secondary'
                              }`}>
                                {alert.severity.toUpperCase()}
                              </span>
                            </div>
                            <p className="mb-2 text-muted">{alert.message}</p>
                            <div className="d-flex flex-wrap gap-2 mb-2">
                              <small className="text-muted">
                                <i className="bi bi-building me-1"></i>
                                {alert.component}
                              </small>
                              {alert.clientName && (
                                <small className="text-muted">
                                  <i className="bi bi-person me-1"></i>
                                  {alert.clientName}
                                </small>
                              )}
                              <small className="text-muted">
                                <i className="bi bi-clock me-1"></i>
                                {alert.timestamp.toDate().toLocaleString()}
                              </small>
                              <small className="text-muted">
                                <i className="bi bi-person-check me-1"></i>
                                {alert.createdBy}
                              </small>
                            </div>
                            {alert.isResolved && alert.resolveNotes && (
                              <div className="mt-2 p-2 bg-success-subtle rounded">
                                <small>
                                  <strong>Resolution:</strong> {alert.resolveNotes}
                                  <br />
                                  <em>Resolved by {alert.resolvedBy} on {alert.resolvedAt?.toDate().toLocaleString()}</em>
                                </small>
                              </div>
                            )}
                          </div>
                          <div className="d-flex gap-1 ms-3">
                            {!alert.isRead && (
                              <button 
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => markAsRead(alert.id)}
                                title="Mark as read"
                              >
                                <i className="bi bi-eye"></i>
                              </button>
                            )}
                            {!alert.isResolved && (
                              <button 
                                className="btn btn-sm btn-outline-success"
                                onClick={() => {
                                  const notes = prompt('Resolution notes (optional):');
                                  if (notes !== null) {
                                    resolveAlert(alert.id, notes);
                                  }
                                }}
                                title="Resolve alert"
                              >
                                <i className="bi bi-check-circle"></i>
                              </button>
                            )}
                            {['Admin', 'Owner'].includes(user?.role || '') && (
                              <button 
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => deleteAlert(alert.id)}
                                title="Delete alert"
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertsDashboard;
