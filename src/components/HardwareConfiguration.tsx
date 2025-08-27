/**
 * Hardware Configuration Component
 * Allows users to configure hardware communication settings
 */

import React, { useState, useEffect } from 'react';
import { hardwareService, HardwareConfig } from '../services/hardwareService';

interface HardwareConfigurationProps {
  onClose: () => void;
}

export function HardwareConfiguration({ onClose }: HardwareConfigurationProps) {
  const [config, setConfig] = useState<HardwareConfig>({
    enabled: false,
    communicationType: 'websocket',
    endpoint: 'ws://localhost:8080/cart-countdown',
    port: 'COM3',
    pin: 18,
    relayDuration: 500,
  });
  
  const [isConnected, setIsConnected] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string>('');

  useEffect(() => {
    // Check initial connection status
    setIsConnected(hardwareService.isHardwareConnected());
    
    // Update connection status every 2 seconds
    const interval = setInterval(() => {
      setIsConnected(hardwareService.isHardwareConnected());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleConfigChange = (field: keyof HardwareConfig, value: any) => {
    const newConfig = { ...config, [field]: value };
    setConfig(newConfig);
    
    // Apply configuration to hardware service
    hardwareService.configure(newConfig);
  };

  const testConnection = async () => {
    setIsTesting(true);
    setTestResult('');
    
    try {
      const success = await hardwareService.testConnection();
      if (success) {
        setTestResult('✅ Test successful! Hardware responded correctly.');
      } else {
        setTestResult('❌ Test failed. Check your hardware configuration.');
      }
    } catch (error) {
      setTestResult(`❌ Test error: ${error.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">🔧 Hardware Configuration</h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
            />
          </div>
          
          <div className="modal-body">
            <div className="row">
              <div className="col-md-8">
                {/* Enable Hardware Communication */}
                <div className="mb-3">
                  <div className="form-check form-switch">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="enableHardware"
                      checked={config.enabled}
                      onChange={(e) => handleConfigChange('enabled', e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="enableHardware">
                      <strong>Enable Hardware Communication</strong>
                    </label>
                  </div>
                  <small className="form-text text-muted">
                    When enabled, the app will send signals to external hardware when cart countdown buttons are pressed.
                  </small>
                </div>

                {config.enabled && (
                  <>
                    {/* Communication Type */}
                    <div className="mb-3">
                      <label className="form-label">Communication Type</label>
                      <select
                        className="form-select"
                        value={config.communicationType}
                        onChange={(e) => handleConfigChange('communicationType', e.target.value as any)}
                      >
                        <option value="websocket">WebSocket (Real-time)</option>
                        <option value="http">HTTP API</option>
                        <option value="serial">Serial Port (USB/RS232)</option>
                        <option value="gpio">GPIO (Raspberry Pi)</option>
                      </select>
                    </div>

                    {/* Configuration based on type */}
                    {(config.communicationType === 'websocket' || config.communicationType === 'http') && (
                      <div className="mb-3">
                        <label className="form-label">
                          {config.communicationType === 'websocket' ? 'WebSocket URL' : 'HTTP Endpoint'}
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          value={config.endpoint}
                          onChange={(e) => handleConfigChange('endpoint', e.target.value)}
                          placeholder={
                            config.communicationType === 'websocket' 
                              ? 'ws://localhost:8080/cart-countdown'
                              : 'http://localhost:3001/cart-countdown'
                          }
                        />
                      </div>
                    )}

                    {config.communicationType === 'serial' && (
                      <div className="mb-3">
                        <label className="form-label">Serial Port</label>
                        <input
                          type="text"
                          className="form-control"
                          value={config.port}
                          onChange={(e) => handleConfigChange('port', e.target.value)}
                          placeholder="COM3 (Windows) or /dev/ttyUSB0 (Linux)"
                        />
                        <small className="form-text text-muted">
                          Common ports: COM1-COM9 (Windows), /dev/ttyUSB0, /dev/ttyACM0 (Linux/Mac)
                        </small>
                      </div>
                    )}

                    {config.communicationType === 'gpio' && (
                      <div className="mb-3">
                        <label className="form-label">GPIO Pin Number</label>
                        <input
                          type="number"
                          className="form-control"
                          value={config.pin}
                          onChange={(e) => handleConfigChange('pin', parseInt(e.target.value) || 18)}
                          min="1"
                          max="40"
                        />
                        <small className="form-text text-muted">
                          GPIO pin number for relay control (Raspberry Pi). Common pins: 18, 24, 25
                        </small>
                      </div>
                    )}

                    {(config.communicationType === 'gpio') && (
                      <div className="mb-3">
                        <label className="form-label">Relay Duration (ms)</label>
                        <input
                          type="number"
                          className="form-control"
                          value={config.relayDuration}
                          onChange={(e) => handleConfigChange('relayDuration', parseInt(e.target.value) || 500)}
                          min="100"
                          max="5000"
                          step="100"
                        />
                        <small className="form-text text-muted">
                          How long to activate the relay when cart countdown is triggered
                        </small>
                      </div>
                    )}

                    {/* Test Connection */}
                    <div className="mb-3">
                      <div className="d-flex align-items-center gap-3">
                        <button
                          className="btn btn-outline-primary"
                          onClick={testConnection}
                          disabled={isTesting}
                        >
                          {isTesting ? (
                            <>
                              <span className="spinner-border spinner-border-sm me-2" />
                              Testing...
                            </>
                          ) : (
                            '🧪 Test Connection'
                          )}
                        </button>
                        
                        <div className="d-flex align-items-center">
                          <div className={`badge ${isConnected ? 'bg-success' : 'bg-secondary'} me-2`}>
                            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
                          </div>
                        </div>
                      </div>
                      
                      {testResult && (
                        <div className="mt-2">
                          <div className={`alert ${testResult.includes('✅') ? 'alert-success' : 'alert-danger'} py-2`}>
                            {testResult}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              
              <div className="col-md-4">
                {/* Help and Documentation */}
                <div className="card bg-light">
                  <div className="card-body">
                    <h6 className="card-title">📚 Communication Types</h6>
                    
                    <div className="mb-3">
                      <strong>WebSocket</strong>
                      <p className="small mb-1">Real-time bidirectional communication. Best for instant responses and sensor feedback.</p>
                    </div>
                    
                    <div className="mb-3">
                      <strong>HTTP API</strong>
                      <p className="small mb-1">Simple request-response communication. Good for basic relay control.</p>
                    </div>
                    
                    <div className="mb-3">
                      <strong>Serial Port</strong>
                      <p className="small mb-1">Direct USB/RS232 communication with microcontrollers like Arduino.</p>
                    </div>
                    
                    <div className="mb-3">
                      <strong>GPIO</strong>
                      <p className="small mb-1">Direct pin control on Raspberry Pi. Perfect for relay modules.</p>
                    </div>
                  </div>
                </div>

                <div className="card bg-info bg-opacity-10 mt-3">
                  <div className="card-body">
                    <h6 className="card-title">ℹ️ How It Works</h6>
                    <ul className="small mb-0 ps-3">
                      <li>When minus button is pressed in tunnel page</li>
                      <li>Signal is sent to configured hardware</li>
                      <li>Hardware can control relays, motors, lights, etc.</li>
                      <li>Can receive sensor feedback (optional)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Close
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                // Save configuration (you might want to persist this)
                console.log('💾 Hardware configuration saved:', config);
                onClose();
              }}
            >
              💾 Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HardwareConfiguration;
