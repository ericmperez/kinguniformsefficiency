import React, { useState, useEffect } from 'react';
import { triggerDriverAssignmentCheck, getSchedulerStatus } from '../services/taskScheduler';
import { checkUnassignedDrivers, generateUnassignedTrucksEmail } from '../services/driverAssignmentNotifier';

interface TaskStatus {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  nextRun?: string;
}

const DriverNotificationSettings: React.FC = () => {
  const [taskStatus, setTaskStatus] = useState<TaskStatus[]>([]);
  const [isTestingNotification, setIsTestingNotification] = useState(false);
  const [testResult, setTestResult] = useState<string>('');
  const [emailRecipients, setEmailRecipients] = useState('emperez@kinguniforms.net');
  const [previewEmail, setPreviewEmail] = useState<{subject: string, body: string} | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  useEffect(() => {
    loadTaskStatus();
    // Refresh status every 30 seconds
    const interval = setInterval(loadTaskStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadTaskStatus = () => {
    try {
      const status = getSchedulerStatus();
      setTaskStatus(status);
    } catch (error) {
      console.error('Error loading task status:', error);
    }
  };

  const handleTestNotification = async () => {
    setIsTestingNotification(true);
    setTestResult('');

    try {
      const recipients = emailRecipients.split(',').map(email => email.trim()).filter(Boolean);
      
      if (recipients.length === 0) {
        setTestResult('❌ Please enter at least one email recipient');
        return;
      }

      console.log('Testing driver assignment notification...');
      await triggerDriverAssignmentCheck();
      setTestResult('✅ Test notification sent successfully! Check your email.');
      
    } catch (error) {
      console.error('Test notification failed:', error);
      setTestResult(`❌ Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTestingNotification(false);
    }
  };

  const handlePreviewEmail = async () => {
    setIsLoadingPreview(true);
    setPreviewEmail(null);

    try {
      // Get current unassigned drivers data
      const alert = await checkUnassignedDrivers();
      const emailContent = generateUnassignedTrucksEmail(alert);
      setPreviewEmail(emailContent);
    } catch (error) {
      console.error('Error generating email preview:', error);
      setTestResult(`❌ Preview failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  return (
    <div className="container py-4">
      <div className="row">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2 className="mb-0">
              <i className="bi bi-bell me-2"></i>
              Driver Assignment Notifications
            </h2>
            <div className="badge bg-success">
              <i className="bi bi-check-circle me-1"></i>
              System Active
            </div>
          </div>

          {/* System Overview */}
          <div className="row mb-4">
            <div className="col-md-6">
              <div className="card border-primary">
                <div className="card-header bg-primary text-white">
                  <h5 className="mb-0">
                    <i className="bi bi-clock me-2"></i>
                    Scheduled Tasks
                  </h5>
                </div>
                <div className="card-body">
                  {taskStatus.length === 0 ? (
                    <p className="text-muted">No scheduled tasks found.</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-sm">
                        <thead>
                          <tr>
                            <th>Task</th>
                            <th>Schedule</th>
                            <th>Next Run</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {taskStatus.map(task => (
                            <tr key={task.id}>
                              <td>
                                <small className="fw-bold">{task.name}</small>
                              </td>
                              <td>
                                <span className="badge bg-info">{task.schedule}</span>
                              </td>
                              <td>
                                <small className="text-muted">
                                  {task.nextRun || 'Not scheduled'}
                                </small>
                              </td>
                              <td>
                                <span className={`badge ${task.enabled ? 'bg-success' : 'bg-secondary'}`}>
                                  {task.enabled ? 'Enabled' : 'Disabled'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="col-md-6">
              <div className="card border-info">
                <div className="card-header bg-info text-white">
                  <h5 className="mb-0">
                    <i className="bi bi-info-circle me-2"></i>
                    How It Works
                  </h5>
                </div>
                <div className="card-body">
                  <ul className="list-unstyled mb-0">
                    <li className="mb-2">
                      <i className="bi bi-check text-success me-2"></i>
                      <small>Automatically checks at 8:00 PM daily</small>
                    </li>
                    <li className="mb-2">
                      <i className="bi bi-check text-success me-2"></i>
                      <small>Identifies unassigned drivers for tomorrow</small>
                    </li>
                    <li className="mb-2">
                      <i className="bi bi-check text-success me-2"></i>
                      <small>Sends email alerts to supervisors</small>
                    </li>
                    <li className="mb-0">
                      <i className="bi bi-check text-success me-2"></i>
                      <small>Provides daily confirmation when all assigned</small>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Test Notification Section */}
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="mb-0">
                <i className="bi bi-gear me-2"></i>
                Test & Configuration
              </h5>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-8">
                  <div className="mb-3">
                    <label className="form-label">
                      <strong>Email Recipients</strong>
                      <small className="text-muted ms-2">(comma-separated)</small>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={emailRecipients}
                      onChange={(e) => setEmailRecipients(e.target.value)}
                      placeholder="manager@example.com, supervisor@example.com"
                    />
                    <small className="form-text text-muted">
                      These email addresses will receive daily driver assignment notifications
                    </small>
                  </div>
                </div>
                <div className="col-md-4">
                  <label className="form-label">&nbsp;</label>
                  <div className="d-grid gap-2">
                    <button
                      className="btn btn-primary"
                      onClick={handleTestNotification}
                      disabled={isTestingNotification}
                    >
                      {isTestingNotification ? (
                        <>
                          <div className="spinner-border spinner-border-sm me-2" role="status">
                            <span className="visually-hidden">Loading...</span>
                          </div>
                          Sending...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-send me-2"></i>
                          Send Test Email
                        </>
                      )}
                    </button>
                    <button
                      className="btn btn-outline-info"
                      onClick={handlePreviewEmail}
                      disabled={isLoadingPreview}
                    >
                      {isLoadingPreview ? (
                        <>
                          <div className="spinner-border spinner-border-sm me-2" role="status">
                            <span className="visually-hidden">Loading...</span>
                          </div>
                          Loading...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-eye me-2"></i>
                          Preview Email
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {testResult && (
                <div className={`alert ${testResult.startsWith('✅') ? 'alert-success' : 'alert-danger'} mt-3`}>
                  {testResult}
                </div>
              )}
            </div>
          </div>

          {/* Email Preview */}
          {previewEmail && (
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">
                  <i className="bi bi-envelope me-2"></i>
                  Email Preview
                </h5>
              </div>
              <div className="card-body">
                <div className="mb-3">
                  <label className="form-label fw-bold">Subject:</label>
                  <div className="p-2 bg-light border rounded">
                    {previewEmail.subject}
                  </div>
                </div>
                <div className="mb-0">
                  <label className="form-label fw-bold">Message Body:</label>
                  <div className="p-3 bg-light border rounded">
                    <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>
                      {previewEmail.body}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="alert alert-info mt-4">
            <h6 className="alert-heading">
              <i className="bi bi-lightbulb me-2"></i>
              Instructions
            </h6>
            <p className="mb-2">
              <strong>Automated Schedule:</strong> The system automatically checks for unassigned drivers every day at 8:00 PM 
              and sends email notifications to the configured recipients.
            </p>
            <p className="mb-2">
              <strong>Manual Testing:</strong> Use the "Send Test Email" button above to manually trigger a notification 
              and verify the system is working correctly.
            </p>
            <p className="mb-0">
              <strong>Email Preview:</strong> Use the "Preview Email" button to see what the current notification 
              would look like based on tomorrow's driver assignments.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverNotificationSettings;
