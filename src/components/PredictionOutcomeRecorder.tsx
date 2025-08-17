// Prediction Outcome Recording Component
// Allows users to manually record actual vs predicted results for ML learning
// Also includes automatic learning from existing pickup data

import React, { useState, useEffect } from 'react';
import MachineLearningService from '../services/MachineLearningService';
import AutoMLDataService from '../services/AutoMLDataService';

interface PredictionRecord {
  date: string;
  dayName: string;
  predictedWeight: number;
  actualWeight?: number;
  status: 'pending' | 'recorded' | 'overdue';
}

const PredictionOutcomeRecorder: React.FC = () => {
  const [mlService] = useState(() => MachineLearningService.getInstance());
  const [autoMLService] = useState(() => AutoMLDataService.getInstance());
  const [pendingPredictions, setPendingPredictions] = useState<PredictionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  
  // Automatic learning state
  const [autoLearningStats, setAutoLearningStats] = useState<any>(null);
  const [performingAutoLearning, setPerformingAutoLearning] = useState(false);
  const [showAutoLearning, setShowAutoLearning] = useState(false);

  // Automatic learning functions
  const performAutoLearning = async () => {
    setPerformingAutoLearning(true);
    try {
      console.log('🤖 Starting automatic learning from historical data...');
      await autoMLService.performDailyAutoLearning();
      const stats = await autoMLService.getAutomaticLearningStats();
      setAutoLearningStats(stats);
      console.log('✅ Automatic learning completed:', stats);
    } catch (error) {
      console.error('❌ Automatic learning failed:', error);
    } finally {
      setPerformingAutoLearning(false);
    }
  };

  const loadAutoLearningStats = async () => {
    try {
      const stats = await autoMLService.getAutomaticLearningStats();
      setAutoLearningStats(stats);
    } catch (error) {
      console.error('❌ Failed to load auto learning stats:', error);
    }
  };

  // Load auto learning stats on component mount
  useEffect(() => {
    if (showAutoLearning) {
      loadAutoLearningStats();
    }
  }, [showAutoLearning]);

  // Load pending predictions (dates from last 7 days that need actual data)
  useEffect(() => {
    loadPendingPredictions();
  }, []);

  const loadPendingPredictions = () => {
    const records: PredictionRecord[] = [];
    const today = new Date();
    
    // Generate last 7 days that need actual data recording
    for (let i = 1; i <= 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
      
      // Check if we already have actual data for this date
      const existingOutcome = mlService.getOutcomeForDate?.(dateStr);
      const status = existingOutcome ? 'recorded' : (i > 3 ? 'overdue' : 'pending');
      
      records.push({
        date: dateStr,
        dayName,
        predictedWeight: 850, // This would come from your prediction system
        actualWeight: existingOutcome?.actualWeight,
        status
      });
    }
    
    setPendingPredictions(records);
  };

  const recordActualOutcome = async (record: PredictionRecord, actualWeight: number) => {
    setLoading(true);
    try {
      // Record the outcome in the ML system
      await mlService.recordPredictionOutcome(
        record.date,
        record.predictedWeight,
        actualWeight,
        'ensemble'
      );

      // Update the local state
      setPendingPredictions(prev => 
        prev.map(p => 
          p.date === record.date 
            ? { ...p, actualWeight, status: 'recorded' as const }
            : p
        )
      );

      console.log(`✅ Recorded outcome for ${record.date}: ${actualWeight} lbs (predicted: ${record.predictedWeight} lbs)`);
    } catch (error) {
      console.error('Failed to record outcome:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAccuracyColor = (predicted: number, actual?: number) => {
    if (!actual) return 'secondary';
    const accuracy = 100 - Math.abs((predicted - actual) / predicted) * 100;
    if (accuracy >= 90) return 'success';
    if (accuracy >= 75) return 'info';
    if (accuracy >= 60) return 'warning';
    return 'danger';
  };

  const getAccuracyPercentage = (predicted: number, actual?: number) => {
    if (!actual) return 'N/A';
    return (100 - Math.abs((predicted - actual) / predicted) * 100).toFixed(1) + '%';
  };

  if (!showRecorder) {
    return (
      <div className="card border-info">
        <div className="card-body text-center">
          <h6 className="card-title">🎯 ML Learning System</h6>
          <p className="text-muted mb-3">
            Train the ML system using prediction outcomes
          </p>
          <div className="row">
            <div className="col-md-6 mb-2">
              <button 
                className="btn btn-info w-100"
                onClick={() => setShowRecorder(true)}
              >
                <i className="bi bi-pencil me-2"></i>
                Manual Entry
              </button>
              <small className="text-muted d-block mt-1">Enter actual weights manually</small>
            </div>
            <div className="col-md-6 mb-2">
              <button 
                className="btn btn-success w-100"
                onClick={() => setShowAutoLearning(true)}
              >
                <i className="bi bi-robot me-2"></i>
                Automatic Learning
              </button>
              <small className="text-muted d-block mt-1">Learn from historical pickup data</small>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showAutoLearning) {
    return (
      <div className="card border-success">
        <div className="card-header bg-success text-white d-flex justify-content-between align-items-center">
          <div>
            <h5 className="mb-0">🤖 Automatic ML Learning</h5>
            <small>Using historical pickup data for training</small>
          </div>
          <button 
            className="btn btn-outline-light btn-sm"
            onClick={() => setShowAutoLearning(false)}
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
        <div className="card-body">
          <div className="alert alert-success">
            <i className="bi bi-lightbulb me-2"></i>
            <strong>How it works:</strong> The system automatically analyzes your historical pickup data 
            and compares it with predictions to train the ML models. No manual data entry required!
          </div>

          <div className="row mb-3">
            <div className="col-12">
              <button 
                className="btn btn-primary me-2"
                onClick={performAutoLearning}
                disabled={performingAutoLearning}
              >
                {performingAutoLearning ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Learning...
                  </>
                ) : (
                  <>
                    <i className="bi bi-play-fill me-2"></i>
                    Start Automatic Learning
                  </>
                )}
              </button>
              <button 
                className="btn btn-outline-primary"
                onClick={loadAutoLearningStats}
                disabled={performingAutoLearning}
              >
                <i className="bi bi-arrow-clockwise me-2"></i>
                Refresh Stats
              </button>
            </div>
          </div>

          {autoLearningStats && (
            <div className="row">
              <div className="col-md-6">
                <div className="card bg-light">
                  <div className="card-body">
                    <h6>Learning Statistics</h6>
                    <div className="mb-2">
                      <strong>Total Comparisons:</strong> {autoLearningStats.totalComparisons}
                    </div>
                    <div className="mb-2">
                      <strong>Average Accuracy:</strong>{' '}
                      <span className={`badge ${autoLearningStats.averageAccuracy >= 75 ? 'bg-success' : autoLearningStats.averageAccuracy >= 60 ? 'bg-warning' : 'bg-danger'}`}>
                        {autoLearningStats.averageAccuracy.toFixed(1)}%
                      </span>
                    </div>
                    <div className="mb-2">
                      <strong>Recent Accuracy:</strong>{' '}
                      <span className={`badge ${autoLearningStats.recentAccuracy >= 75 ? 'bg-success' : autoLearningStats.recentAccuracy >= 60 ? 'bg-warning' : 'bg-danger'}`}>
                        {autoLearningStats.recentAccuracy.toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <strong>Trend:</strong>{' '}
                      <span className={`badge ${autoLearningStats.improvementTrend === 'Improving' ? 'bg-success' : autoLearningStats.improvementTrend === 'Declining' ? 'bg-warning' : 'bg-secondary'}`}>
                        {autoLearningStats.improvementTrend}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-md-6">
                <div className="card bg-light">
                  <div className="card-body">
                    <h6>Accuracy by Day of Week</h6>
                    {Object.entries(autoLearningStats.accuracyByDayOfWeek).map(([day, accuracy]) => {
                      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                      const dayName = dayNames[parseInt(day)];
                      const accuracyNum = accuracy as number;
                      return (
                        <div key={day} className="d-flex justify-content-between">
                          <span>{dayName}:</span>
                          <span className={`badge ${accuracyNum >= 75 ? 'bg-success' : accuracyNum >= 60 ? 'bg-warning' : 'bg-danger'}`}>
                            {accuracyNum.toFixed(1)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-3 text-center">
            <button 
              className="btn btn-outline-secondary"
              onClick={() => {setShowRecorder(true); setShowAutoLearning(false);}}
            >
              Switch to Manual Entry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card border-primary">
      <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
        <div>
          <h5 className="mb-0">🎯 ML Learning - Record Actual Outcomes</h5>
          <small>Help the system learn by recording actual vs predicted weights</small>
        </div>
        <button 
          className="btn btn-outline-light btn-sm"
          onClick={() => setShowRecorder(false)}
        >
          <i className="bi bi-x-lg"></i>
        </button>
      </div>
      <div className="card-body">
        <div className="row mb-3">
          <div className="col-12">
            <div className="alert alert-info">
              <i className="bi bi-lightbulb me-2"></i>
              <strong>Manual Entry:</strong> Enter the actual weight collected for each day. 
              The ML system will learn from the difference between predicted and actual values.
              After 10+ recordings, automatic retraining begins.
              <br />
              <small className="mt-2 d-block">
                💡 <strong>Tip:</strong> You can also use <button className="btn btn-link btn-sm p-0" onClick={() => {setShowAutoLearning(true); setShowRecorder(false);}}>Automatic Learning</button> 
                to train using historical pickup data without manual entry.
              </small>
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-hover">
            <thead className="table-dark">
              <tr>
                <th>Date</th>
                <th>Day</th>
                <th>Predicted</th>
                <th>Actual Weight</th>
                <th>Accuracy</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pendingPredictions.map((record) => (
                <tr key={record.date}>
                  <td>
                    {new Date(record.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    })}
                  </td>
                  <td className="fw-bold">{record.dayName}</td>
                  <td>
                    <span className="badge bg-info">{record.predictedWeight} lbs</span>
                  </td>
                  <td>
                    {record.status === 'recorded' ? (
                      <span className="badge bg-success">{record.actualWeight} lbs</span>
                    ) : (
                      <ActualWeightInput
                        onSubmit={(weight) => recordActualOutcome(record, weight)}
                        loading={loading}
                      />
                    )}
                  </td>
                  <td>
                    <span className={`badge bg-${getAccuracyColor(record.predictedWeight, record.actualWeight)}`}>
                      {getAccuracyPercentage(record.predictedWeight, record.actualWeight)}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${
                      record.status === 'recorded' ? 'bg-success' :
                      record.status === 'overdue' ? 'bg-danger' : 'bg-warning'
                    }`}>
                      {record.status.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    {record.status === 'recorded' ? (
                      <i className="bi bi-check-circle text-success"></i>
                    ) : (
                      <small className="text-muted">Enter actual weight</small>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="row mt-4">
          <div className="col-md-6">
            <div className="card bg-light">
              <div className="card-body">
                <h6>ML Learning Progress</h6>
                <div className="progress mb-2">
                  <div 
                    className="progress-bar bg-primary"
                    style={{ width: `${Math.min(100, (pendingPredictions.filter(p => p.status === 'recorded').length / 10) * 100)}%` }}
                  ></div>
                </div>
                <small className="text-muted">
                  {pendingPredictions.filter(p => p.status === 'recorded').length}/10 outcomes needed for retraining
                </small>
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="card bg-light">
              <div className="card-body">
                <h6>Current Accuracy</h6>
                <div className="d-flex align-items-center">
                  <div className="me-3">
                    <span className="badge bg-primary fs-6">
                      {(() => {
                        const recorded = pendingPredictions.filter(p => p.status === 'recorded');
                        if (recorded.length === 0) return 'N/A';
                        const avgAccuracy = recorded.reduce((sum, r) => {
                          const acc = 100 - Math.abs((r.predictedWeight - (r.actualWeight || 0)) / r.predictedWeight) * 100;
                          return sum + acc;
                        }, 0) / recorded.length;
                        return avgAccuracy.toFixed(1) + '%';
                      })()}
                    </span>
                  </div>
                  <small className="text-muted">Based on {pendingPredictions.filter(p => p.status === 'recorded').length} recorded outcomes</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Component for entering actual weight
const ActualWeightInput: React.FC<{
  onSubmit: (weight: number) => void;
  loading: boolean;
}> = ({ onSubmit, loading }) => {
  const [weight, setWeight] = useState('');
  const [showInput, setShowInput] = useState(false);

  const handleSubmit = () => {
    const weightNum = parseFloat(weight);
    if (weightNum > 0) {
      onSubmit(weightNum);
      setWeight('');
      setShowInput(false);
    }
  };

  if (!showInput) {
    return (
      <button 
        className="btn btn-outline-primary btn-sm"
        onClick={() => setShowInput(true)}
        disabled={loading}
      >
        <i className="bi bi-plus me-1"></i>
        Add
      </button>
    );
  }

  return (
    <div className="input-group input-group-sm" style={{ minWidth: '120px' }}>
      <input
        type="number"
        className="form-control"
        placeholder="lbs"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        autoFocus
      />
      <button 
        className="btn btn-success"
        onClick={handleSubmit}
        disabled={loading || !weight}
      >
        <i className="bi bi-check"></i>
      </button>
      <button 
        className="btn btn-secondary"
        onClick={() => setShowInput(false)}
      >
        <i className="bi bi-x"></i>
      </button>
    </div>
  );
};

export default PredictionOutcomeRecorder;
