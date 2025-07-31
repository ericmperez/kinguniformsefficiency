import React, { useEffect, useState } from "react";
import { collection, query, orderBy, limit, onSnapshot, Timestamp, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";
import { 
  getDailyUserStats, 
  getActiveUserSessions, 
  getUserStatsDateRange, 
  cleanupOldUserData, 
  type DailyUserStats, 
  type UserSession as FirebaseUserSession 
} from "../services/firebaseService";

interface LiveActivity {
  id: string;
  type: string;
  message: string;
  user?: string;
  createdAt: Timestamp;
  isRecent: boolean;
}

interface UserSession {
  user: string;
  lastActivity: Date;
  activityCount: number;
  currentTask?: string;
  isOnline: boolean;
  sessionDuration?: number;
}

interface EnhancedUserSession extends UserSession {
  loginTime?: Date;
  sessionId?: string;
}

export default function RealTimeActivityDashboard() {
  const { user } = useAuth();
  const [liveActivities, setLiveActivities] = useState<LiveActivity[]>([]);
  const [userSessions, setUserSessions] = useState<Map<string, EnhancedUserSession>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [dailyStats, setDailyStats] = useState<DailyUserStats[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [activeView, setActiveView] = useState<'live' | 'daily' | 'historical'>('live');

  // Check if user has permission to view dashboard - Only specific users allowed
  const canViewDashboard = user && (
    user.id === "1991" || 
    user.id === "1995" || 
    user.id === "1167"
  );

  useEffect(() => {
    if (!canViewDashboard) return;

    // Real-time listener for recent activities (last 2 hours)
    const twoHoursAgo = new Date();
    twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
    const cutoffTimestamp = Timestamp.fromDate(twoHoursAgo);

    const activitiesQuery = query(
      collection(db, "activity_log"),
      where("createdAt", ">=", cutoffTimestamp),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(activitiesQuery, async (snapshot) => {
      const activities: LiveActivity[] = [];
      const sessions = new Map<string, EnhancedUserSession>();
      const now = new Date();

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const activityTime = data.createdAt?.toDate();
        
        if (!activityTime) return;

        const timeDiff = now.getTime() - activityTime.getTime();
        const isRecent = timeDiff < 5 * 60 * 1000; // Last 5 minutes

        const activity: LiveActivity = {
          id: doc.id,
          type: data.type || "Unknown",
          message: data.message || "",
          user: data.user || "Unknown",
          createdAt: data.createdAt,
          isRecent
        };

        activities.push(activity);

        // Track user sessions
        if (data.user) {
          const existing = sessions.get(data.user);
          const isOnline = timeDiff < 15 * 60 * 1000; // Online if active in last 15 minutes

          if (existing) {
            if (activityTime > existing.lastActivity) {
              existing.lastActivity = activityTime;
              existing.currentTask = data.type;
            }
            existing.activityCount++;
            existing.isOnline = existing.isOnline || isOnline;
          } else {
            sessions.set(data.user, {
              user: data.user,
              lastActivity: activityTime,
              activityCount: 1,
              currentTask: data.type,
              isOnline
            });
          }
        }
      });

      // Enhance sessions with actual session data from Firebase
      try {
        const activeSessions = await getActiveUserSessions();
        activeSessions.forEach((session: FirebaseUserSession) => {
          const existing = sessions.get(session.username);
          if (existing) {
            existing.loginTime = session.loginTime.toDate();
            existing.sessionId = session.id;
            existing.sessionDuration = now.getTime() - session.loginTime.toMillis();
          } else if (session.isActive) {
            sessions.set(session.username, {
              user: session.username,
              lastActivity: session.lastActivity.toDate(),
              activityCount: session.interactionCount,
              currentTask: 'Active',
              isOnline: true,
              loginTime: session.loginTime.toDate(),
              sessionId: session.id,
              sessionDuration: now.getTime() - session.loginTime.toMillis()
            });
          }
        });
      } catch (error) {
        console.error("Error fetching active sessions:", error);
      }

      setLiveActivities(activities);
      setUserSessions(sessions);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [canViewDashboard]);

  // Load daily statistics when date changes
  useEffect(() => {
    if (!canViewDashboard || activeView !== 'daily') return;

    const loadDailyStats = async () => {
      try {
        setLoading(true);
        const stats = await getDailyUserStats(selectedDate);
        setDailyStats(stats);
      } catch (error) {
        console.error("Error loading daily stats:", error);
      } finally {
        setLoading(false);
      }
    };

    loadDailyStats();
  }, [canViewDashboard, selectedDate, activeView]);

  // Cleanup old data periodically
  useEffect(() => {
    if (!canViewDashboard) return;

    const cleanup = async () => {
      try {
        await cleanupOldUserData();
      } catch (error) {
        console.error("Error during cleanup:", error);
      }
    };

    // Run cleanup once when component mounts
    cleanup();
  }, [canViewDashboard]);

  if (!canViewDashboard) {
    return (
      <div className="card p-4 mb-4">
        <div className="alert alert-warning">
          <h5>Access Restricted</h5>
          <p>Real-time activity monitoring is only available to authorized users (1991, 1995, 1167).</p>
        </div>
      </div>
    );
  }

  const recentActivities = showAllActivities ? liveActivities : liveActivities.filter(a => a.isRecent);
  const onlineUsers = Array.from(userSessions.values()).filter(s => s.isOnline);
  const totalUsers = userSessions.size;

  const getActivityIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'login': return '🔐';
      case 'invoice': return '📄';
      case 'tunnel': return '🔄';
      case 'segregation': return '📦';
      case 'conventional': return '⚙️';
      case 'user': return '👤';
      case 'shipping': return '🚛';
      default: return '📝';
    }
  };

  const getActivityColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'login': return '#28a745';
      case 'invoice': return '#007bff';
      case 'tunnel': return '#fd7e14';
      case 'segregation': return '#6f42c1';
      case 'conventional': return '#20c997';
      case 'user': return '#dc3545';
      case 'shipping': return '#ffc107';
      default: return '#6c757d';
    }
  };

  const formatTimeAgo = (timestamp: Timestamp) => {
    const now = new Date();
    const activityTime = timestamp.toDate();
    const diffMs = now.getTime() - activityTime.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffSeconds = Math.floor(diffMs / 1000);

    if (diffMinutes < 1) {
      return `${diffSeconds}s ago`;
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else {
      const diffHours = Math.floor(diffMinutes / 60);
      return `${diffHours}h ago`;
    }
  };

  const formatDuration = (milliseconds: number) => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const formatTime = (timestamp: Timestamp) => {
    return timestamp.toDate().toLocaleTimeString();
  };

  return (
    <div className="card p-4 mb-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0" style={{ fontWeight: 700 }}>
          🔴 Real-Time Activity Dashboard
        </h4>
        <div className="d-flex gap-2">
          <span className="badge bg-success">
            {onlineUsers.length} Online
          </span>
          <span className="badge bg-info">
            {totalUsers} Total Users
          </span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mb-4">
        <ul className="nav nav-tabs">
          <li className="nav-item">
            <button 
              className={`nav-link ${activeView === 'live' ? 'active' : ''}`}
              onClick={() => setActiveView('live')}
            >
              🔴 Live Activity
            </button>
          </li>
          <li className="nav-item">
            <button 
              className={`nav-link ${activeView === 'daily' ? 'active' : ''}`}
              onClick={() => setActiveView('daily')}
            >
              📊 Daily Statistics
            </button>
          </li>
        </ul>
      </div>

      {loading ? (
        <div className="text-center p-4">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <div className="mt-2">Loading data...</div>
        </div>
      ) : (
        <>
          {activeView === 'live' && (
            <>
              {/* Online Users Section */}
              <div className="mb-4">
                <h5 className="mb-3">👥 Currently Active Users</h5>
                {onlineUsers.length === 0 ? (
                  <div className="alert alert-info">
                    <h6 className="alert-heading">No Active Users</h6>
                    <p className="mb-2">This is normal for a new dashboard implementation.</p>
                    <p className="mb-0">
                      <strong>To see data:</strong> Login with a user account and interact with the app. 
                      You'll appear here as an active user with session duration and activity tracking.
                    </p>
                  </div>
                ) : (
                  <div className="row">
                    {onlineUsers.map((session) => (
                      <div key={session.user} className="col-md-6 col-lg-4 mb-3">
                        <div className="card border-success" style={{ backgroundColor: '#f8fff9' }}>
                          <div className="card-body p-3">
                            <div className="d-flex justify-content-between align-items-start">
                              <div>
                                <h6 className="mb-1" style={{ color: '#28a745' }}>
                                  🟢 {session.user}
                                </h6>
                                <small className="text-muted">
                                  Last: {formatTimeAgo(Timestamp.fromDate(session.lastActivity))}
                                </small>
                                {session.loginTime && (
                                  <div className="mt-1">
                                    <small className="text-muted">
                                      Session: {formatDuration(session.sessionDuration || 0)}
                                    </small>
                                  </div>
                                )}
                                {session.currentTask && (
                                  <div className="mt-1">
                                    <span 
                                      className="badge" 
                                      style={{ 
                                        backgroundColor: getActivityColor(session.currentTask), 
                                        color: 'white',
                                        fontSize: '11px'
                                      }}
                                    >
                                      {getActivityIcon(session.currentTask)} {session.currentTask}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <span className="badge bg-light text-dark">
                                {session.activityCount}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Activity Feed Controls */}
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="mb-0">⚡ Live Activity Feed</h5>
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="showAllActivities"
                    checked={showAllActivities}
                    onChange={(e) => setShowAllActivities(e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="showAllActivities">
                    Show all activities (2h)
                  </label>
                </div>
              </div>

              {/* Live Activity Feed */}
              <div 
                className="border rounded p-3" 
                style={{ 
                  backgroundColor: '#f8f9fa', 
                  maxHeight: '400px', 
                  overflowY: 'auto' 
                }}
              >
                {recentActivities.length === 0 ? (
                  <div className="text-center text-muted p-4">
                    {showAllActivities ? 
                      "No activities in the last 2 hours" : 
                      "No recent activities (last 5 minutes)"
                    }
                  </div>
                ) : (
                  <div className="list-group list-group-flush">
                    {recentActivities.map((activity) => (
                      <div
                        key={activity.id}
                        className={`list-group-item border-0 px-0 ${
                          activity.isRecent ? 'bg-light border-start border-3 border-success' : ''
                        }`}
                        style={{ 
                          marginBottom: '8px',
                          borderRadius: '6px',
                          ...(activity.isRecent && { paddingLeft: '12px' })
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-start">
                          <div className="flex-grow-1">
                            <div className="d-flex align-items-center mb-1">
                              <span 
                                className="badge me-2" 
                                style={{ 
                                  backgroundColor: getActivityColor(activity.type),
                                  color: 'white'
                                }}
                              >
                                {getActivityIcon(activity.type)} {activity.type}
                              </span>
                              <strong className="text-primary">{activity.user}</strong>
                              {activity.isRecent && (
                                <span className="badge bg-success ms-2 fs-6">LIVE</span>
                              )}
                            </div>
                            <div className="text-dark mb-1">{activity.message}</div>
                            <small className="text-muted">
                              {formatTimeAgo(activity.createdAt)} • {activity.createdAt.toDate().toLocaleTimeString()}
                            </small>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Dashboard Stats */}
              <div className="row mt-4">
                <div className="col-md-3">
                  <div className="card bg-primary text-white">
                    <div className="card-body text-center">
                      <h5>{recentActivities.length}</h5>
                      <small>Recent Activities</small>
                    </div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card bg-success text-white">
                    <div className="card-body text-center">
                      <h5>{onlineUsers.length}</h5>
                      <small>Online Users</small>
                    </div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card bg-info text-white">
                    <div className="card-body text-center">
                      <h5>{Array.from(new Set(liveActivities.map(a => a.type))).length}</h5>
                      <small>Activity Types</small>
                    </div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card bg-warning text-white">
                    <div className="card-body text-center">
                      <h5>{Math.round(liveActivities.length / Math.max(totalUsers, 1))}</h5>
                      <small>Avg Activities/User</small>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeView === 'daily' && (
            <>
              {/* Date Selector */}
              <div className="mb-4">
                <div className="row align-items-center">
                  <div className="col-md-4">
                    <label className="form-label">Select Date:</label>
                    <input
                      type="date"
                      className="form-control"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      max={new Date().toISOString().slice(0, 10)}
                    />
                  </div>
                </div>
              </div>

              {/* Daily Statistics */}
              <div className="mb-4">
                <h5 className="mb-3">📊 Daily User Statistics - {selectedDate}</h5>
                {dailyStats.length === 0 ? (
                  <div className="text-muted text-center p-4">
                    No statistics available for this date
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-striped">
                      <thead>
                        <tr>
                          <th>User</th>
                          <th>Total Login Time</th>
                          <th>Total Interactions</th>
                          <th>Sessions</th>
                          <th>Avg Session Duration</th>
                          <th>First Login</th>
                          <th>Last Logout</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailyStats.map((stat) => (
                          <tr key={stat.id}>
                            <td>
                              <strong>{stat.username}</strong>
                              <br />
                              <small className="text-muted">{stat.userId}</small>
                            </td>
                            <td>
                              <span className="badge bg-primary">
                                {formatDuration(stat.totalLoginTime)}
                              </span>
                            </td>
                            <td>
                              <span className="badge bg-info">
                                {stat.totalInteractions}
                              </span>
                            </td>
                            <td>
                              <span className="badge bg-secondary">
                                {stat.sessionCount}
                              </span>
                            </td>
                            <td>
                              {formatDuration(stat.averageSessionDuration)}
                            </td>
                            <td>
                              <small>{formatTime(stat.firstLogin)}</small>
                            </td>
                            <td>
                              <small>
                                {stat.lastLogout ? formatTime(stat.lastLogout) : 'Still active'}
                              </small>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Daily Summary Cards */}
              {dailyStats.length > 0 && (
                <div className="row">
                  <div className="col-md-3">
                    <div className="card bg-primary text-white">
                      <div className="card-body text-center">
                        <h5>{dailyStats.length}</h5>
                        <small>Active Users</small>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card bg-success text-white">
                      <div className="card-body text-center">
                        <h5>{formatDuration(dailyStats.reduce((sum, stat) => sum + stat.totalLoginTime, 0))}</h5>
                        <small>Total Login Time</small>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card bg-info text-white">
                      <div className="card-body text-center">
                        <h5>{dailyStats.reduce((sum, stat) => sum + stat.totalInteractions, 0)}</h5>
                        <small>Total Interactions</small>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card bg-warning text-white">
                      <div className="card-body text-center">
                        <h5>{dailyStats.reduce((sum, stat) => sum + stat.sessionCount, 0)}</h5>
                        <small>Total Sessions</small>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="mt-3 text-center">
            <small className="text-muted">
              🔄 Dashboard updates automatically • 
              {activeView === 'live' 
                ? ' Showing activities from the last 2 hours' 
                : ` Showing statistics for ${selectedDate}`
              }
            </small>
          </div>
        </>
      )}
    </div>
  );
}
