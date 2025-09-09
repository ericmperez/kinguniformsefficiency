import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, Timestamp, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import ProductionTrackingService, { ProductionEntry } from '../services/ProductionTrackingService';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

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

// Analytics interfaces
export interface EmployeeAlertStats {
  employeeName: string;
  totalAlerts: number;
  totalEntries: number;
  alertToEntryRatio: number;
  alertsByMonth: { [key: string]: number };
  alertsByDay: { [key: string]: number };
  alertsByType: { [key: string]: number };
  averageResolutionTime?: number; // in hours
}

export interface AlertAnalytics {
  employeeStats: EmployeeAlertStats[];
  timeSeriesData: {
    labels: string[];
    datasets: any[];
  };
  topEmployeesByAlerts: EmployeeAlertStats[];
  topEmployeesByRatio: EmployeeAlertStats[];
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
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Analytics state
  const [analytics, setAnalytics] = useState<AlertAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsTimeframe, setAnalyticsTimeframe] = useState<'day' | 'month' | 'year'>('month');
  const [productionEntries, setProductionEntries] = useState<ProductionEntry[]>([]);

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

  // Load production entries for analytics
  useEffect(() => {
    if (!showAnalytics) return;

    const productionService = ProductionTrackingService.getInstance();
    productionService.startTracking();

    const unsubscribe = productionService.subscribe((summary) => {
      setProductionEntries(summary.allEntriesToday || []);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [showAnalytics]);

  // Generate analytics data
  const generateAnalytics = async () => {
    if (!showAnalytics || analyticsLoading) return;
    
    setAnalyticsLoading(true);
    
    try {
      console.log('🔍 Generating alert analytics...');
      // Get all alerts from the selected timeframe
      const now = new Date();
      let startDate = new Date();
      
      switch (analyticsTimeframe) {
        case 'day':
          startDate.setDate(now.getDate() - 30); // Last 30 days
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 12); // Last 12 months
          break;
        case 'year':
          startDate.setFullYear(now.getFullYear() - 3); // Last 3 years
          break;
      }

      // Query all alerts in timeframe
      const alertsQuery = query(
        collection(db, 'system_alerts'),
        where('timestamp', '>=', Timestamp.fromDate(startDate)),
        orderBy('timestamp', 'desc')
      );

      const alertsSnapshot = await getDocs(alertsQuery);
      const allAlertsData = alertsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp || Timestamp.now()
      })) as SystemAlert[];

      // Query production entries in same timeframe
      const entriesQuery = query(
        collection(db, 'invoices'),
        orderBy('date', 'desc')
      );
      
      const entriesSnapshot = await getDocs(entriesQuery);
      const allProductionEntries: ProductionEntry[] = [];
      
      entriesSnapshot.docs.forEach(doc => {
        const invoiceData = doc.data();
        const carts = invoiceData.carts || [];
        
        carts.forEach((cart: any) => {
          const items = cart.items || [];
          items.forEach((item: any) => {
            if (item.addedAt && item.addedBy) {
              const addedDate = item.addedAt.toDate ? item.addedAt.toDate() : new Date(item.addedAt);
              if (addedDate >= startDate) {
                allProductionEntries.push({
                  id: `${doc.id}_${cart.id}_${item.id}`,
                  invoiceId: doc.id,
                  clientId: invoiceData.clientId || '',
                  clientName: invoiceData.clientName || 'Unknown Client',
                  cartId: cart.id,
                  cartName: cart.name || cart.cartName,
                  productId: item.id,
                  productName: item.name || item.productName,
                  quantity: item.quantity || 0,
                  price: item.price || 0,
                  addedBy: item.addedBy,
                  addedAt: addedDate,
                  source: 'invoice_item'
                });
              }
            }
          });
        });
      });

      // Process employee statistics
      const employeeMap = new Map<string, EmployeeAlertStats>();

      // Initialize employee data from production entries
      allProductionEntries.forEach(entry => {
        if (!employeeMap.has(entry.addedBy)) {
          employeeMap.set(entry.addedBy, {
            employeeName: entry.addedBy,
            totalAlerts: 0,
            totalEntries: 0,
            alertToEntryRatio: 0,
            alertsByMonth: {},
            alertsByDay: {},
            alertsByType: {}
          });
        }
        
        const stats = employeeMap.get(entry.addedBy)!;
        stats.totalEntries++;
      });

      // Process alerts data
      allAlertsData.forEach(alert => {
        const employeeName = alert.createdBy || 'Unknown';
        
        if (!employeeMap.has(employeeName)) {
          employeeMap.set(employeeName, {
            employeeName,
            totalAlerts: 0,
            totalEntries: 0,
            alertToEntryRatio: 0,
            alertsByMonth: {},
            alertsByDay: {},
            alertsByType: {}
          });
        }

        const stats = employeeMap.get(employeeName)!;
        stats.totalAlerts++;

        // Time-based categorization
        const alertDate = alert.timestamp.toDate();
        let timeKey = '';
        
        switch (analyticsTimeframe) {
          case 'day':
            timeKey = alertDate.toISOString().split('T')[0]; // YYYY-MM-DD
            stats.alertsByDay[timeKey] = (stats.alertsByDay[timeKey] || 0) + 1;
            break;
          case 'month':
            timeKey = `${alertDate.getFullYear()}-${String(alertDate.getMonth() + 1).padStart(2, '0')}`;
            stats.alertsByMonth[timeKey] = (stats.alertsByMonth[timeKey] || 0) + 1;
            break;
          case 'year':
            timeKey = alertDate.getFullYear().toString();
            stats.alertsByMonth[timeKey] = (stats.alertsByMonth[timeKey] || 0) + 1;
            break;
        }

        // Alert type tracking
        stats.alertsByType[alert.type] = (stats.alertsByType[alert.type] || 0) + 1;

        // Calculate resolution time if resolved
        if (alert.isResolved && alert.resolvedAt) {
          const resolutionTimeMs = alert.resolvedAt.toDate().getTime() - alert.timestamp.toDate().getTime();
          const resolutionTimeHours = resolutionTimeMs / (1000 * 60 * 60);
          stats.averageResolutionTime = stats.averageResolutionTime 
            ? (stats.averageResolutionTime + resolutionTimeHours) / 2 
            : resolutionTimeHours;
        }
      });

      // Calculate ratios and finalize stats
      const employeeStats: EmployeeAlertStats[] = Array.from(employeeMap.values()).map(stats => ({
        ...stats,
        alertToEntryRatio: stats.totalEntries > 0 ? (stats.totalAlerts / stats.totalEntries) * 100 : 0
      }));

      // Generate time series data
      const timeLabels = new Set<string>();
      employeeStats.forEach(emp => {
        Object.keys(analyticsTimeframe === 'day' ? emp.alertsByDay : emp.alertsByMonth).forEach(date => {
          timeLabels.add(date);
        });
      });

      const sortedLabels = Array.from(timeLabels).sort();
      
      const datasets = employeeStats
        .filter(emp => emp.totalAlerts > 0)
        .slice(0, 10) // Top 10 employees
        .map((emp, index) => {
          const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'];
          const data = sortedLabels.map(label => {
            const alerts = analyticsTimeframe === 'day' ? emp.alertsByDay : emp.alertsByMonth;
            return alerts[label] || 0;
          });

          return {
            label: emp.employeeName,
            data,
            backgroundColor: colors[index % colors.length],
            borderColor: colors[index % colors.length],
            borderWidth: 2,
            fill: false
          };
        });

      const analytics: AlertAnalytics = {
        employeeStats,
        timeSeriesData: {
          labels: sortedLabels,
          datasets
        },
        topEmployeesByAlerts: employeeStats
          .filter(emp => emp.totalAlerts > 0)
          .sort((a, b) => b.totalAlerts - a.totalAlerts)
          .slice(0, 10),
        topEmployeesByRatio: employeeStats
          .filter(emp => emp.totalEntries > 0 && emp.totalAlerts > 0)
          .sort((a, b) => b.alertToEntryRatio - a.alertToEntryRatio)
          .slice(0, 10)
      };

      setAnalytics(analytics);
      console.log('✅ Analytics generated successfully:', {
        employeesCount: analytics.employeeStats.length,
        totalAlerts: analytics.employeeStats.reduce((sum, emp) => sum + emp.totalAlerts, 0),
        totalEntries: analytics.employeeStats.reduce((sum, emp) => sum + emp.totalEntries, 0)
      });
    } catch (error) {
      console.error('❌ Error generating analytics:', error);
      // Set empty analytics data to show error state
      setAnalytics({
        employeeStats: [],
        timeSeriesData: { labels: [], datasets: [] },
        topEmployeesByAlerts: [],
        topEmployeesByRatio: []
      });
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Generate analytics when analytics view is opened
  useEffect(() => {
    if (showAnalytics) {
      generateAnalytics();
    }
  }, [showAnalytics, analyticsTimeframe]);

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
            <div className="d-flex gap-2">
              {showCreateAlert && ['Admin', 'Supervisor', 'Owner'].includes(user?.role || '') && (
                <button 
                  className="btn btn-primary"
                  onClick={() => setShowCreateForm(true)}
                >
                  <i className="bi bi-plus-circle me-1"></i>
                  Create Alert
                </button>
              )}
              <button 
                className={`btn ${showAnalytics ? 'btn-success' : 'btn-outline-success'}`}
                onClick={() => setShowAnalytics(!showAnalytics)}
              >
                <i className="bi bi-graph-up me-1"></i>
                {showAnalytics ? 'Hide Analytics' : 'Show Analytics'}
              </button>
            </div>
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

          {/* Analytics Section */}
          {showAnalytics && (
            <div className="card mb-4 border-success">
              <div className="card-header bg-success text-white d-flex justify-content-between align-items-center">
                <h5 className="mb-0">📊 Employee Alert Analytics</h5>
                <div className="d-flex gap-2 align-items-center">
                  <label className="form-label text-white mb-0 me-2">Time Period:</label>
                  <select 
                    className="form-select form-select-sm"
                    value={analyticsTimeframe}
                    onChange={(e) => setAnalyticsTimeframe(e.target.value as 'day' | 'month' | 'year')}
                    style={{ width: 'auto' }}
                  >
                    <option value="day">Daily (30 days)</option>
                    <option value="month">Monthly (12 months)</option>
                    <option value="year">Yearly (3 years)</option>
                  </select>
                  <button 
                    className="btn btn-sm btn-light"
                    onClick={generateAnalytics}
                    disabled={analyticsLoading}
                  >
                    {analyticsLoading ? (
                      <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                    ) : (
                      <i className="bi bi-arrow-clockwise me-1"></i>
                    )}
                    Refresh
                  </button>
                </div>
              </div>
              <div className="card-body">
                {analyticsLoading ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-success" role="status">
                      <span className="visually-hidden">Loading analytics...</span>
                    </div>
                    <p className="mt-3 text-muted">Generating analytics data...</p>
                  </div>
                ) : analytics ? (
                  <div>
                    {/* Summary Cards */}
                    <div className="row mb-4">
                      <div className="col-md-3 col-6 mb-2">
                        <div className="card border-primary">
                          <div className="card-body text-center py-2">
                            <h4 className="text-primary mb-1">{analytics.employeeStats.length}</h4>
                            <small className="text-muted">Total Employees</small>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-3 col-6 mb-2">
                        <div className="card border-warning">
                          <div className="card-body text-center py-2">
                            <h4 className="text-warning mb-1">
                              {analytics.employeeStats.reduce((sum, emp) => sum + emp.totalAlerts, 0)}
                            </h4>
                            <small className="text-muted">Total Alerts</small>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-3 col-6 mb-2">
                        <div className="card border-info">
                          <div className="card-body text-center py-2">
                            <h4 className="text-info mb-1">
                              {analytics.employeeStats.reduce((sum, emp) => sum + emp.totalEntries, 0)}
                            </h4>
                            <small className="text-muted">Total Entries</small>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-3 col-6 mb-2">
                        <div className="card border-success">
                          <div className="card-body text-center py-2">
                            <h4 className="text-success mb-1">
                              {analytics.employeeStats.length > 0 
                                ? (analytics.employeeStats.reduce((sum, emp) => sum + emp.alertToEntryRatio, 0) / analytics.employeeStats.length).toFixed(2)
                                : '0.00'
                              }%
                            </h4>
                            <small className="text-muted">Avg Alert Ratio</small>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Charts Section */}
                    <div className="row">
                      {/* Time Series Chart */}
                      <div className="col-12 mb-4">
                        <div className="card">
                          <div className="card-header">
                            <h6 className="mb-0">
                              📈 Alert Trends by Employee ({analyticsTimeframe === 'day' ? 'Last 30 Days' : 
                                analyticsTimeframe === 'month' ? 'Last 12 Months' : 'Last 3 Years'})
                            </h6>
                          </div>
                          <div className="card-body">
                            {analytics.timeSeriesData.datasets.length > 0 ? (
                              <div style={{ height: '400px' }}>
                                <Line
                                  data={analytics.timeSeriesData}
                                  options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                      title: {
                                        display: true,
                                        text: 'Employee Alert Trends Over Time'
                                      },
                                      legend: {
                                        position: 'top',
                                      },
                                    },
                                    scales: {
                                      x: {
                                        display: true,
                                        title: {
                                          display: true,
                                          text: analyticsTimeframe === 'day' ? 'Date' : 
                                                analyticsTimeframe === 'month' ? 'Month' : 'Year'
                                        }
                                      },
                                      y: {
                                        display: true,
                                        title: {
                                          display: true,
                                          text: 'Number of Alerts'
                                        },
                                        beginAtZero: true
                                      }
                                    },
                                  }}
                                />
                              </div>
                            ) : (
                              <div className="text-center py-4 text-muted">
                                <i className="bi bi-graph-up" style={{ fontSize: '3rem' }}></i>
                                <p className="mt-2">No alert data available for the selected timeframe</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Top Employees by Alert Count */}
                      <div className="col-md-6 mb-4">
                        <div className="card">
                          <div className="card-header">
                            <h6 className="mb-0">🔝 Top Employees by Alert Count</h6>
                          </div>
                          <div className="card-body">
                            {analytics.topEmployeesByAlerts.length > 0 ? (
                              <div className="table-responsive">
                                <table className="table table-sm">
                                  <thead>
                                    <tr>
                                      <th>Employee</th>
                                      <th>Alerts</th>
                                      <th>Entries</th>
                                      <th>Ratio %</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {analytics.topEmployeesByAlerts.map((emp, index) => (
                                      <tr key={emp.employeeName}>
                                        <td>
                                          <span className={`badge ${index < 3 ? 'bg-warning' : 'bg-secondary'} me-2`}>
                                            #{index + 1}
                                          </span>
                                          {emp.employeeName}
                                        </td>
                                        <td>
                                          <span className="badge bg-danger">{emp.totalAlerts}</span>
                                        </td>
                                        <td>
                                          <span className="badge bg-info">{emp.totalEntries}</span>
                                        </td>
                                        <td>
                                          <span className={`badge ${emp.alertToEntryRatio > 5 ? 'bg-danger' : 
                                            emp.alertToEntryRatio > 2 ? 'bg-warning' : 'bg-success'}`}>
                                            {emp.alertToEntryRatio.toFixed(2)}%
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="text-center py-3 text-muted">
                                <i className="bi bi-people" style={{ fontSize: '2rem' }}></i>
                                <p className="mt-2">No employee alert data available</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Top Employees by Alert-to-Entry Ratio */}
                      <div className="col-md-6 mb-4">
                        <div className="card">
                          <div className="card-header">
                            <h6 className="mb-0">⚠️ Highest Alert-to-Entry Ratios</h6>
                          </div>
                          <div className="card-body">
                            {analytics.topEmployeesByRatio.length > 0 ? (
                              <div className="table-responsive">
                                <table className="table table-sm">
                                  <thead>
                                    <tr>
                                      <th>Employee</th>
                                      <th>Ratio %</th>
                                      <th>Alerts</th>
                                      <th>Entries</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {analytics.topEmployeesByRatio.map((emp, index) => (
                                      <tr key={emp.employeeName}>
                                        <td>
                                          <span className={`badge ${index < 3 ? 'bg-danger' : 'bg-secondary'} me-2`}>
                                            #{index + 1}
                                          </span>
                                          {emp.employeeName}
                                        </td>
                                        <td>
                                          <span className={`badge ${emp.alertToEntryRatio > 5 ? 'bg-danger' : 
                                            emp.alertToEntryRatio > 2 ? 'bg-warning' : 'bg-success'}`}>
                                            {emp.alertToEntryRatio.toFixed(2)}%
                                          </span>
                                        </td>
                                        <td>
                                          <span className="badge bg-warning">{emp.totalAlerts}</span>
                                        </td>
                                        <td>
                                          <span className="badge bg-info">{emp.totalEntries}</span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="text-center py-3 text-muted">
                                <i className="bi bi-graph-down" style={{ fontSize: '2rem' }}></i>
                                <p className="mt-2">No ratio data available</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Performance Insights */}
                    <div className="row">
                      <div className="col-12">
                        <div className="card border-info">
                          <div className="card-header bg-info text-white">
                            <h6 className="mb-0">💡 Performance Insights</h6>
                          </div>
                          <div className="card-body">
                            <div className="row">
                              <div className="col-md-4">
                                <h6>🎯 Best Performers</h6>
                                <ul className="list-unstyled">
                                  {analytics.employeeStats
                                    .filter(emp => emp.totalEntries > 0)
                                    .sort((a, b) => a.alertToEntryRatio - b.alertToEntryRatio)
                                    .slice(0, 3)
                                    .map(emp => (
                                      <li key={emp.employeeName} className="mb-1">
                                        <span className="badge bg-success me-2">{emp.alertToEntryRatio.toFixed(2)}%</span>
                                        {emp.employeeName}
                                      </li>
                                    ))
                                  }
                                </ul>
                              </div>
                              <div className="col-md-4">
                                <h6>📈 Most Productive</h6>
                                <ul className="list-unstyled">
                                  {analytics.employeeStats
                                    .sort((a, b) => b.totalEntries - a.totalEntries)
                                    .slice(0, 3)
                                    .map(emp => (
                                      <li key={emp.employeeName} className="mb-1">
                                        <span className="badge bg-primary me-2">{emp.totalEntries}</span>
                                        {emp.employeeName}
                                      </li>
                                    ))
                                  }
                                </ul>
                              </div>
                              <div className="col-md-4">
                                <h6>⚠️ Needs Attention</h6>
                                <ul className="list-unstyled">
                                  {analytics.employeeStats
                                    .filter(emp => emp.alertToEntryRatio > 3 && emp.totalEntries > 0)
                                    .sort((a, b) => b.alertToEntryRatio - a.alertToEntryRatio)
                                    .slice(0, 3)
                                    .map(emp => (
                                      <li key={emp.employeeName} className="mb-1">
                                        <span className="badge bg-warning me-2">{emp.alertToEntryRatio.toFixed(2)}%</span>
                                        {emp.employeeName}
                                      </li>
                                    ))
                                  }
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted">Click "Refresh" to generate analytics data</p>
                  </div>
                )}
              </div>
            </div>
          )}

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
