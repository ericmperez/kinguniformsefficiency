import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';

interface AlertEmailConfig {
  emailRecipients: string[];
  alertTypes: {
    segregationErrors: boolean;
    driverAssignment: boolean;
    systemErrors: boolean;
    tunnelIssues: boolean;
    washingAlerts: boolean;
    conventionalIssues: boolean;
    invoiceWarnings: boolean;
    shippingProblems: boolean;
    specialItems: boolean;
    endOfShift: boolean;
    general: boolean;
  };
  enabled: boolean;
  lastUpdated: string;
  updatedBy: string;
}

const DEFAULT_CONFIG: AlertEmailConfig = {
  emailRecipients: [
    'rmperez@kinguniforms.net',
    'eric.perez.pr@gmail.com',
    'jperez@kinguniforms.net'
  ],
  alertTypes: {
    segregationErrors: true,
    driverAssignment: true,
    systemErrors: true,
    tunnelIssues: true,
    washingAlerts: true,
    conventionalIssues: true,
    invoiceWarnings: true,
    shippingProblems: true,
    specialItems: true,
    endOfShift: true,
    general: true
  },
  enabled: true,
  lastUpdated: new Date().toISOString(),
  updatedBy: 'System'
};

const AlertEmailManagement: React.FC = () => {
  const { user } = useAuth();
  const [config, setConfig] = useState<AlertEmailConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveResult, setSaveResult] = useState<string>('');
  const [testResult, setTestResult] = useState<string>('');
  const [emailInput, setEmailInput] = useState('');

  useEffect(() => {
    loadAlertConfig();
  }, []);

  const loadAlertConfig = async () => {
    try {
      setLoading(true);
      const configDoc = await getDoc(doc(db, 'settings', 'alertEmailConfig'));
      
      if (configDoc.exists()) {
        const data = configDoc.data() as AlertEmailConfig;
        setConfig(data);
        setEmailInput(data.emailRecipients.join(', '));
      } else {
        // Set default configuration
        setConfig(DEFAULT_CONFIG);
        setEmailInput(DEFAULT_CONFIG.emailRecipients.join(', '));
      }
    } catch (error) {
      console.error('Error loading alert email config:', error);
      setConfig(DEFAULT_CONFIG);
      setEmailInput(DEFAULT_CONFIG.emailRecipients.join(', '));
    } finally {
      setLoading(false);
    }
  };

  const saveAlertConfig = async () => {
    setSaving(true);
    setSaveResult('');

    try {
      // Parse and validate email addresses
      const recipients = emailInput
        .split(',')
        .map(email => email.trim())
        .filter(email => email.length > 0);

      if (recipients.length === 0) {
        setSaveResult('❌ Please enter at least one email recipient');
        return;
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmails = recipients.filter(email => !emailRegex.test(email));

      if (invalidEmails.length > 0) {
        setSaveResult(`❌ Invalid email addresses: ${invalidEmails.join(', ')}`);
        return;
      }

      const updatedConfig: AlertEmailConfig = {
        ...config,
        emailRecipients: recipients,
        lastUpdated: new Date().toISOString(),
        updatedBy: user?.username || 'Admin'
      };

      await setDoc(doc(db, 'settings', 'alertEmailConfig'), updatedConfig);
      setConfig(updatedConfig);
      setSaveResult(`✅ Alert email configuration saved successfully! ${recipients.length} recipient(s) configured.`);

    } catch (error) {
      console.error('Error saving alert email config:', error);
      setSaveResult(`❌ Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const updateAlertType = async (alertType: keyof AlertEmailConfig['alertTypes'], enabled: boolean) => {
    try {
      const updatedConfig = {
        ...config,
        alertTypes: {
          ...config.alertTypes,
          [alertType]: enabled
        },
        lastUpdated: new Date().toISOString(),
        updatedBy: user?.username || 'Admin'
      };

      await setDoc(doc(db, 'settings', 'alertEmailConfig'), updatedConfig);
      setConfig(updatedConfig);
    } catch (error) {
      console.error('Error updating alert type:', error);
    }
  };

  const sendTestAlert = async () => {
    setTesting(true);
    setTestResult('');

    try {
      const recipients = emailInput
        .split(',')
        .map(email => email.trim())
        .filter(email => email.length > 0);

      if (recipients.length === 0) {
        setTestResult('❌ Please enter at least one email recipient');
        return;
      }

      // Send test email using the existing API
      const response = await fetch('/api/send-test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: recipients.join(', '),
          subject: '🚨 King Uniforms - Alert System Test',
          body: `This is a test message from the King Uniforms Alert Email Management System.

📧 Alert Recipients:
${recipients.map(email => `• ${email}`).join('\n')}

✅ If you receive this email, the alert system is configured correctly!

Test Details:
• Date: ${new Date().toLocaleDateString()}
• Time: ${new Date().toLocaleTimeString()}
• Tested By: ${user?.username || 'Admin'}
• Total Recipients: ${recipients.length}

Alert Types Enabled:
${Object.entries(config.alertTypes)
  .filter(([_, enabled]) => enabled)
  .map(([type, _]) => `• ${type.replace(/([A-Z])/g, ' $1').toLowerCase()}`)
  .join('\n')}

This system will send real-time alerts for:
🚨 Segregation errors and cart verification issues
🚛 Driver assignment problems
⚙️ System errors and technical issues
🧽 Washing and tunnel alerts
📋 Conventional processing issues
📄 Invoice warnings and discrepancies
🚚 Shipping problems and delivery issues
⭐ Special item alerts
🕐 End of shift notifications
📢 General system alerts

Best regards,
King Uniforms Alert Management System`
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setTestResult(`✅ Test alert sent successfully to ${recipients.length} recipient(s)! Check your email.`);
      } else {
        setTestResult(`❌ Failed to send test alert: ${result.error || 'Unknown error'}`);
      }

    } catch (error) {
      console.error('Test alert failed:', error);
      setTestResult(`❌ Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setTesting(false);
    }
  };

  const toggleGlobalAlerts = async () => {
    try {
      const updatedConfig = {
        ...config,
        enabled: !config.enabled,
        lastUpdated: new Date().toISOString(),
        updatedBy: user?.username || 'Admin'
      };

      await setDoc(doc(db, 'settings', 'alertEmailConfig'), updatedConfig);
      setConfig(updatedConfig);
    } catch (error) {
      console.error('Error toggling global alerts:', error);
    }
  };

  const getAlertTypeDisplayName = (alertType: string): string => {
    const displayNames: Record<string, string> = {
      segregationErrors: 'Segregation Errors',
      driverAssignment: 'Driver Assignment',
      systemErrors: 'System Errors',
      tunnelIssues: 'Tunnel Issues',
      washingAlerts: 'Washing Alerts',
      conventionalIssues: 'Conventional Issues',
      invoiceWarnings: 'Invoice Warnings',
      shippingProblems: 'Shipping Problems',
      specialItems: 'Special Items',
      endOfShift: 'End of Shift',
      general: 'General Alerts'
    };
    return displayNames[alertType] || alertType;
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="row">
        <div className="col-12">
          {/* Header */}
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2 className="mb-0">
              <i className="bi bi-bell-fill me-2 text-warning"></i>
              Alert Email Management
            </h2>
            <div className="d-flex align-items-center gap-3">
              <span className="badge bg-info">
                <i className="bi bi-envelope me-1"></i>
                {config.emailRecipients.length} Recipients
              </span>
              <button
                className={`btn btn-sm ${config.enabled ? 'btn-success' : 'btn-outline-secondary'}`}
                onClick={toggleGlobalAlerts}
                title={config.enabled ? 'Disable all alerts' : 'Enable all alerts'}
              >
                <i className={`bi ${config.enabled ? 'bi-toggle-on' : 'bi-toggle-off'} me-1`}></i>
                {config.enabled ? 'Alerts Enabled' : 'Alerts Disabled'}
              </button>
            </div>
          </div>

          {/* Alert Recipients Configuration */}
          <div className="card mb-4">
            <div className="card-header bg-primary text-white">
              <h5 className="mb-0">
                <i className="bi bi-envelope-gear me-2"></i>
                Email Recipients Configuration
              </h5>
            </div>
            <div className="card-body">
              <div className="alert alert-info">
                <i className="bi bi-info-circle me-2"></i>
                <strong>Configure Alert Recipients:</strong> These email addresses will receive real-time alerts for system issues, errors, and important notifications.
              </div>

              <div className="mb-3">
                <label className="form-label">
                  <strong>Email Recipients</strong>
                  <small className="text-muted ms-2">(comma-separated)</small>
                </label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="rmperez@kinguniforms.net, eric.perez.pr@gmail.com, jperez@kinguniforms.net"
                />
                <small className="form-text text-muted">
                  These email addresses will receive alerts for all enabled alert types.
                </small>
              </div>

              <div className="d-flex gap-2 mb-3">
                <button
                  className="btn btn-success"
                  onClick={saveAlertConfig}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <div className="spinner-border spinner-border-sm me-2" role="status">
                        <span className="visually-hidden">Saving...</span>
                      </div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-circle me-2"></i>
                      Save Configuration
                    </>
                  )}
                </button>
                <button
                  className="btn btn-outline-info"
                  onClick={sendTestAlert}
                  disabled={testing}
                >
                  {testing ? (
                    <>
                      <div className="spinner-border spinner-border-sm me-2" role="status">
                        <span className="visually-hidden">Testing...</span>
                      </div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-send me-2"></i>
                      Send Test Alert
                    </>
                  )}
                </button>
                <button
                  className="btn btn-outline-secondary"
                  onClick={loadAlertConfig}
                >
                  <i className="bi bi-arrow-clockwise me-2"></i>
                  Reload
                </button>
              </div>

              {saveResult && (
                <div className={`alert mt-3 ${saveResult.startsWith('✅') ? 'alert-success' : 'alert-danger'}`}>
                  {saveResult}
                </div>
              )}

              {testResult && (
                <div className={`alert mt-3 ${testResult.startsWith('✅') ? 'alert-success' : 'alert-danger'}`}>
                  {testResult}
                </div>
              )}
            </div>
          </div>

          {/* Alert Types Configuration */}
          <div className="card mb-4">
            <div className="card-header bg-warning text-dark">
              <h5 className="mb-0">
                <i className="bi bi-sliders me-2"></i>
                Alert Types Configuration
              </h5>
            </div>
            <div className="card-body">
              <div className="alert alert-warning">
                <i className="bi bi-exclamation-triangle me-2"></i>
                <strong>Manage Alert Types:</strong> Enable or disable specific types of alerts. Recipients will only receive emails for enabled alert types.
              </div>

              <div className="row">
                {Object.entries(config.alertTypes).map(([alertType, enabled]) => (
                  <div key={alertType} className="col-md-6 mb-3">
                    <div className="card border-0 bg-light">
                      <div className="card-body p-3">
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <h6 className="mb-1">{getAlertTypeDisplayName(alertType)}</h6>
                            <small className="text-muted">
                              {alertType === 'segregationErrors' && 'Cart verification and count mismatch errors'}
                              {alertType === 'driverAssignment' && 'Unassigned drivers and truck assignment issues'}
                              {alertType === 'systemErrors' && 'Technical errors and system failures'}
                              {alertType === 'tunnelIssues' && 'Tunnel operation problems'}
                              {alertType === 'washingAlerts' && 'Washing process alerts and notifications'}
                              {alertType === 'conventionalIssues' && 'Conventional processing problems'}
                              {alertType === 'invoiceWarnings' && 'Invoice discrepancies and warnings'}
                              {alertType === 'shippingProblems' && 'Shipping and delivery issues'}
                              {alertType === 'specialItems' && 'Special item handling alerts'}
                              {alertType === 'endOfShift' && 'End of shift detection and recommendations'}
                              {alertType === 'general' && 'General system alerts and notifications'}
                            </small>
                          </div>
                          <div className="form-check form-switch">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id={`switch-${alertType}`}
                              checked={enabled}
                              onChange={(e) => updateAlertType(alertType as keyof AlertEmailConfig['alertTypes'], e.target.checked)}
                            />
                            <label className="form-check-label" htmlFor={`switch-${alertType}`}>
                              {enabled ? (
                                <span className="badge bg-success">Enabled</span>
                              ) : (
                                <span className="badge bg-secondary">Disabled</span>
                              )}
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* System Status */}
          <div className="card">
            <div className="card-header bg-info text-white">
              <h5 className="mb-0">
                <i className="bi bi-activity me-2"></i>
                System Status & Information
              </h5>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-6">
                  <h6>Configuration Status</h6>
                  <ul className="list-unstyled">
                    <li>
                      <i className="bi bi-check-circle text-success me-2"></i>
                      <strong>Recipients:</strong> {config.emailRecipients.length} configured
                    </li>
                    <li>
                      <i className="bi bi-check-circle text-success me-2"></i>
                      <strong>Alert Types:</strong> {Object.values(config.alertTypes).filter(Boolean).length} of {Object.keys(config.alertTypes).length} enabled
                    </li>
                    <li>
                      <i className={`bi ${config.enabled ? 'bi-check-circle text-success' : 'bi-x-circle text-danger'} me-2`}></i>
                      <strong>Status:</strong> {config.enabled ? 'Active' : 'Disabled'}
                    </li>
                    <li>
                      <i className="bi bi-clock text-info me-2"></i>
                      <strong>Last Updated:</strong> {new Date(config.lastUpdated).toLocaleString()}
                    </li>
                    <li>
                      <i className="bi bi-person text-info me-2"></i>
                      <strong>Updated By:</strong> {config.updatedBy}
                    </li>
                  </ul>
                </div>
                <div className="col-md-6">
                  <h6>Email Recipients</h6>
                  <ul className="list-unstyled">
                    {config.emailRecipients.map((email, index) => (
                      <li key={index}>
                        <i className="bi bi-envelope text-primary me-2"></i>
                        {email}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="alert alert-info mt-4">
            <h6 className="alert-heading">
              <i className="bi bi-lightbulb me-2"></i>
              Instructions
            </h6>
            <p className="mb-2">
              <strong>Alert System:</strong> This configuration manages where alert emails are sent when system issues occur.
              Real-time alerts are automatically triggered by various system components.
            </p>
            <p className="mb-2">
              <strong>Testing:</strong> Use the "Send Test Alert" button to verify email delivery and ensure the system is working correctly.
            </p>
            <p className="mb-0">
              <strong>Alert Types:</strong> Enable or disable specific types of alerts based on your notification preferences.
              Only enabled alert types will trigger email notifications.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertEmailManagement;
