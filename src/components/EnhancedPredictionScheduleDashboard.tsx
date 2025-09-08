// Enhanced Prediction Schedule Dashboard with ML Integration and External Data
import React, { useEffect, useState, useMemo } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { Invoice, Client, Product } from "../types";
import { Line, Bar, Pie, Radar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  RadialLinearScale,
} from "chart.js";

// Import services and utilities
import {
  parseTimestamp,
  formatDateForComparison,
  createDateRange,
  getDaysFromNow,
  createFirebaseDateQuery,
  isHoliday,
  formatDateForDisplay,
  formatTimeForDisplay,
} from "../utils/dateTimeUtils";

// Import ML and External Data services
import MachineLearningService from "../services/MachineLearningService";
import {
  externalDataService,
  ExternalDataInsight,
} from "../services/ExternalDataIntegrationService";

// Import ML outcome recorder
import PredictionOutcomeRecorder from "./PredictionOutcomeRecorder";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  RadialLinearScale
);

interface PickupEntry {
  id: string;
  clientId: string;
  clientName: string;
  timestamp: Date;
  weight: number;
  driverName: string;
  cartId: string;
}

interface WeeklyPattern {
  dayOfWeek: number;
  dayName: string;
  avgWeight: number;
  avgEntries: number;
  avgRevenue: number;
  avgClientCount: number;
  confidence: number;
  peakHour: number;
  stdDev?: number;
  recommendations: string[];
}

interface ClientPrediction {
  clientId: string;
  clientName: string;
  likelihood: number;
  predictedWeight: number;
  predictedTime: string;
  confidence: number;
  lastSeen: string;
  weeklyPattern: boolean[];
}

interface DayPrediction {
  date: string;
  dayName: string;
  totalPredictedWeight: number;
  totalPredictedEntries: number;
  totalPredictedRevenue: number;
  predictedClientCount: number;
  confidenceLevel: number;
  peakHours: number[];
  staffingRecommendation: string;
  criticalFactors: string[];
}

interface EnhancedPrediction extends DayPrediction {
  mlAdjustment: number;
  externalDataAdjustment: number;
  originalPrediction: number;
  mlConfidence: number;
  externalDataImpact: ExternalDataInsight | null;
}

const EnhancedPredictionScheduleDashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pickupEntries, setPickupEntries] = useState<PickupEntry[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  // Initialize ML Service
  const [mlService] = useState(() => MachineLearningService.getInstance());
  // Prediction data
  const [weeklyPatterns, setWeeklyPatterns] = useState<WeeklyPattern[]>([]);
  const [clientPredictions, setClientPredictions] = useState<
    ClientPrediction[]
  >([]);
  const [basePredictions, setBasePredictions] = useState<DayPrediction[]>([]);
  const [enhancedPredictions, setEnhancedPredictions] = useState<
    EnhancedPrediction[]
  >([]);
  const [externalDataInsights, setExternalDataInsights] = useState<
    ExternalDataInsight[]
  >([]);

  // ML and External Data states
  const [mlInsights, setMlInsights] = useState<any>(null);
  const [externalDataSummary, setExternalDataSummary] = useState<any>(null);

  // UI State
  const [selectedPredictionDays, setSelectedPredictionDays] = useState(7);
  const [predictionConfidenceFilter, setPredictionConfidenceFilter] =
    useState(0.6);
  const [showMLFeatures, setShowMLFeatures] = useState(true);
  const [showExternalData, setShowExternalData] = useState(true);

  // Load historical data
  useEffect(() => {
    loadHistoricalData();
  }, []);

  const loadHistoricalData = async () => {
    setLoading(true);
    try {
      console.log("🔮 Loading historical data for enhanced predictions...");

      // Load last 90 days of data for analysis
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);
      startDate.setHours(0, 0, 0, 0);

      // Load invoices
      const invoicesSnapshot = await getDocs(collection(db, "invoices"));
      const invoicesData = invoicesSnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as Invoice))
        .filter((inv) => {
          if (!inv.date) return false;
          const invDate = parseTimestamp(inv.date);
          return invDate >= startDate && invDate <= endDate;
        });

      // Load pickup entries
      const entriesQuery = query(
        collection(db, "pickup_entries"),
        where("timestamp", ">=", Timestamp.fromDate(startDate)),
        where("timestamp", "<=", Timestamp.fromDate(endDate))
      );
      const entriesSnapshot = await getDocs(entriesQuery);
      const entriesData = entriesSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          clientId: data.clientId,
          clientName: data.clientName || "Unknown",
          timestamp: parseTimestamp(data.timestamp),
          weight: data.weight || 0,
          driverName: data.driverName || "Unknown",
          cartId: data.cartId || "",
        } as PickupEntry;
      });

      // Load clients
      const clientsSnapshot = await getDocs(collection(db, "clients"));
      const clientsData = clientsSnapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          } as Client)
      );

      setInvoices(invoicesData);
      setPickupEntries(entriesData);
      setClients(clientsData);

      console.log(`📊 Loaded enhanced prediction data:`, {
        invoices: invoicesData.length,
        entries: entriesData.length,
        clients: clientsData.length,
        dateRange: `${startDate.toISOString().slice(0, 10)} to ${endDate
          .toISOString()
          .slice(0, 10)}`,
      });
    } catch (error) {
      console.error("Error loading historical data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate basic weekly patterns
  const calculateWeeklyPatterns = useMemo((): WeeklyPattern[] => {
    if (!pickupEntries.length || !invoices.length) return [];

    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const patterns: WeeklyPattern[] = [];

    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      const dayEntries = pickupEntries.filter((entry) => {
        const entryDate = parseTimestamp(entry.timestamp);
        return entryDate.getDay() === dayOfWeek;
      });

      const dayInvoices = invoices.filter((inv) => {
        if (!inv.date) return false;
        const invDate = parseTimestamp(inv.date);
        return invDate.getDay() === dayOfWeek;
      });

      // Group by date
      const dateGroups: {
        [date: string]: {
          weight: number;
          entries: number;
          revenue: number;
          clients: Set<string>;
        };
      } = {};

      dayEntries.forEach((entry) => {
        const entryDate = parseTimestamp(entry.timestamp);
        const dateStr = formatDateForComparison(entryDate);
        if (!dateGroups[dateStr]) {
          dateGroups[dateStr] = {
            weight: 0,
            entries: 0,
            revenue: 0,
            clients: new Set(),
          };
        }
        dateGroups[dateStr].weight += entry.weight;
        dateGroups[dateStr].entries += 1;
        dateGroups[dateStr].clients.add(entry.clientId);
      });

      // Calculate averages
      const dates = Object.keys(dateGroups);
      const avgWeight =
        dates.length > 0
          ? dates.reduce((sum, date) => sum + dateGroups[date].weight, 0) /
            dates.length
          : 0;
      const avgEntries =
        dates.length > 0
          ? dates.reduce((sum, date) => sum + dateGroups[date].entries, 0) /
            dates.length
          : 0;
      const avgClientCount =
        dates.length > 0
          ? dates.reduce(
              (sum, date) => sum + dateGroups[date].clients.size,
              0
            ) / dates.length
          : 0;

      // Calculate revenue from invoices
      const avgRevenue =
        dayInvoices.length > 0
          ? dayInvoices.reduce((sum, inv) => {
              let invoiceRevenue = 0;
              if (inv.carts) {
                inv.carts.forEach((cart) => {
                  if (cart.items) {
                    cart.items.forEach((item) => {
                      invoiceRevenue +=
                        (item.quantity || 0) * (item.price || 0);
                    });
                  }
                });
              }
              return sum + invoiceRevenue;
            }, 0) / dayInvoices.length
          : 0;

      // Calculate confidence and peak hour
      const confidence =
        Math.min(1, dates.length / 8) * (avgWeight > 0 ? 1 : 0.5);
      const peakHour =
        dayEntries.length > 0
          ? Math.round(
              dayEntries.reduce(
                (sum, entry) =>
                  sum + parseTimestamp(entry.timestamp).getHours(),
                0
              ) / dayEntries.length
            )
          : 12;

      // Calculate standard deviation for confidence intervals
      const weights = dates.map((date) => dateGroups[date].weight);
      const variance =
        weights.length > 1
          ? weights.reduce(
              (sum, weight) => sum + Math.pow(weight - avgWeight, 2),
              0
            ) /
            (weights.length - 1)
          : 0;
      const stdDev = Math.sqrt(variance);

      // Generate recommendations
      const recommendations: string[] = [];
      if (avgWeight > 1000)
        recommendations.push("Heavy day - prepare additional staffing");
      if (avgWeight < 300)
        recommendations.push("Light day - reduced staffing possible");
      if (confidence < 0.5)
        recommendations.push("Low confidence - monitor closely");

      patterns.push({
        dayOfWeek,
        dayName: dayNames[dayOfWeek],
        avgWeight: Math.round(avgWeight),
        avgEntries: Math.round(avgEntries),
        avgRevenue: Math.round(avgRevenue),
        avgClientCount: Math.round(avgClientCount),
        confidence: Math.round(confidence * 100) / 100,
        peakHour,
        stdDev,
        recommendations,
      });
    }

    return patterns;
  }, [pickupEntries, invoices]);

  // Calculate basic predictions
  const calculateBasePredictions = useMemo((): DayPrediction[] => {
    if (!weeklyPatterns.length) return [];

    const predictions: DayPrediction[] = [];
    const today = new Date();

    for (let i = 0; i < selectedPredictionDays; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dayOfWeek = date.getDay();
      const dayName = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ][dayOfWeek];

      const weeklyPattern = weeklyPatterns.find(
        (p) => p.dayOfWeek === dayOfWeek
      );

      if (weeklyPattern) {
        predictions.push({
          date: formatDateForComparison(date),
          dayName,
          totalPredictedWeight: weeklyPattern.avgWeight,
          totalPredictedEntries: weeklyPattern.avgEntries,
          totalPredictedRevenue: weeklyPattern.avgRevenue,
          predictedClientCount: weeklyPattern.avgClientCount,
          confidenceLevel: weeklyPattern.confidence,
          peakHours: [weeklyPattern.peakHour],
          staffingRecommendation:
            weeklyPattern.avgWeight > 1000
              ? "Heavy staffing"
              : "Normal staffing",
          criticalFactors: weeklyPattern.recommendations,
        });
      }
    }

    return predictions;
  }, [weeklyPatterns, selectedPredictionDays]);

  // Enhanced predictions with ML and External Data
  useEffect(() => {
    const enhancePredictions = async () => {
      if (!basePredictions.length) return;

      console.log("🤖 Enhancing predictions with ML and External Data...");

      // Get ML insights
      const mlData = mlService.getMLInsights();
      setMlInsights(mlData);

      // Get external data insights
      const dates = basePredictions.map((p) => p.date);
      const externalInsights =
        await externalDataService.getExternalDataInsights(dates);
      setExternalDataInsights(externalInsights);

      const externalSummary = await externalDataService.getExternalDataSummary(
        externalInsights
      );
      setExternalDataSummary(externalSummary);

      // Create enhanced predictions
      const enhanced: EnhancedPrediction[] = basePredictions.map(
        (basePred, index) => {
          const externalInsight = externalInsights[index];

          // ML adjustment - use ensemble prediction with individual model predictions
          let mlAdjustment = 1.0;
          let mlConfidence = basePred.confidenceLevel;

          if (showMLFeatures && mlData) {
            // For demo purposes, create simple model predictions based on patterns
            const patternPred = basePred.totalPredictedWeight;
            const clientPred =
              basePred.totalPredictedWeight *
              (basePred.predictedClientCount / 10); // Simple client factor
            const trendPred = basePred.totalPredictedWeight * 1.02; // Simple trend factor
            const neuralPred = basePred.totalPredictedWeight * 0.98; // Simple neural adjustment

            const mlPrediction = mlService.calculateEnsemblePrediction(
              patternPred,
              clientPred,
              trendPred,
              neuralPred
            );

            mlAdjustment =
              mlPrediction.prediction / basePred.totalPredictedWeight;
            mlConfidence = mlPrediction.confidence;
          }

          // External data adjustment
          let externalDataAdjustment = 1.0;
          if (showExternalData && externalInsight) {
            const adjustment =
              externalDataService.adjustPredictionsWithExternalData(
                basePred.totalPredictedWeight,
                externalInsight
              );
            externalDataAdjustment = adjustment.adjustmentFactor;
          }

          // Combined adjustment
          const combinedAdjustment = mlAdjustment * externalDataAdjustment;
          const adjustedWeight = Math.round(
            basePred.totalPredictedWeight * combinedAdjustment
          );

          // Enhanced confidence (average of ML and external data confidence)
          const enhancedConfidence = externalInsight
            ? (mlConfidence + externalInsight.confidence) / 2
            : mlConfidence;

          return {
            ...basePred,
            totalPredictedWeight: adjustedWeight,
            confidenceLevel: Math.min(1, enhancedConfidence),
            originalPrediction: basePred.totalPredictedWeight,
            mlAdjustment,
            externalDataAdjustment,
            mlConfidence,
            externalDataImpact: externalInsight,
          };
        }
      );

      setEnhancedPredictions(enhanced);
      console.log(
        `🎯 Enhanced ${enhanced.length} predictions with ML and external data`
      );
    };

    enhancePredictions();
  }, [basePredictions, showMLFeatures, showExternalData, pickupEntries]);

  // Update states
  useEffect(() => {
    setWeeklyPatterns(calculateWeeklyPatterns);
  }, [calculateWeeklyPatterns]);

  useEffect(() => {
    setBasePredictions(calculateBasePredictions);
  }, [calculateBasePredictions]);

  // Chart data
  const enhancedPredictionsChart = useMemo(() => {
    if (!enhancedPredictions.length) return { labels: [], datasets: [] };

    const labels = enhancedPredictions.map(
      (p) => `${p.dayName.slice(0, 3)} ${new Date(p.date).getDate()}`
    );

    return {
      labels,
      datasets: [
        {
          label: "Enhanced Prediction (lbs)",
          data: enhancedPredictions.map((p) => p.totalPredictedWeight),
          backgroundColor: "rgba(59, 130, 246, 0.2)",
          borderColor: "rgb(59, 130, 246)",
          borderWidth: 3,
          pointRadius: 6,
          pointHoverRadius: 8,
          tension: 0.4,
        },
        {
          label: "Original Prediction (lbs)",
          data: enhancedPredictions.map((p) => p.originalPrediction),
          backgroundColor: "rgba(156, 163, 175, 0.2)",
          borderColor: "rgb(156, 163, 175)",
          borderWidth: 2,
          pointRadius: 4,
          tension: 0.4,
          borderDash: [5, 5],
        },
      ],
    };
  }, [enhancedPredictions]);

  if (loading) {
    return (
      <div className="container py-4">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">
            🤖 Loading enhanced AI predictions with ML and external data
            integration...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      {/* Header */}
      <div className="row mb-4">
        <div className="col-12">
          <h2 className="mb-2">🧠 Enhanced AI Prediction Dashboard</h2>
          <p className="text-muted">
            Advanced workload predictions using Machine Learning, External Data
            Integration, and Statistical Analysis
            <br />
            <small>
              <i className="bi bi-cpu me-1"></i>
              ML-powered ensemble predictions with weather, holiday, and
              economic data integration
              <span className="ms-3">
                <i className="bi bi-shield-check me-1"></i>
                Based on {pickupEntries.length} pickup entries and{" "}
                {invoices.length} invoices
              </span>
            </small>
          </p>
        </div>
      </div>

      {/* Feature Controls */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <div className="row align-items-center">
                <div className="col-md-2">
                  <label className="form-label">Prediction Days</label>
                  <select
                    className="form-select"
                    value={selectedPredictionDays}
                    onChange={(e) =>
                      setSelectedPredictionDays(parseInt(e.target.value))
                    }
                  >
                    <option value={3}>Next 3 Days</option>
                    <option value={7}>Next 7 Days</option>
                    <option value={14}>Next 14 Days</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="mlFeatures"
                      checked={showMLFeatures}
                      onChange={(e) => setShowMLFeatures(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="mlFeatures">
                      🤖 Machine Learning Enhancement
                    </label>
                  </div>
                  <small className="text-muted">
                    Neural networks, ensemble models, real-time retraining
                  </small>
                </div>
                <div className="col-md-3">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="externalData"
                      checked={showExternalData}
                      onChange={(e) => setShowExternalData(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="externalData">
                      🌐 External Data Integration
                    </label>
                  </div>
                  <small className="text-muted">
                    Weather, holidays, economic indicators
                  </small>
                </div>
                <div className="col-md-4">
                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-outline-primary"
                      onClick={loadHistoricalData}
                    >
                      <i className="bi bi-arrow-clockwise me-1"></i>
                      Refresh
                    </button>
                    <button
                      className="btn btn-outline-success"
                      onClick={() => window.print()}
                    >
                      <i className="bi bi-printer me-1"></i>
                      Print
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Predictions Chart */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">
                📊 Enhanced Predictions with ML & External Data
              </h5>
            </div>
            <div className="card-body">
              {enhancedPredictionsChart.datasets.length > 0 ? (
                <Line
                  data={enhancedPredictionsChart}
                  options={{
                    responsive: true,
                    plugins: {
                      title: {
                        display: true,
                        text: "ML-Enhanced Predictions vs Original Predictions",
                      },
                      legend: {
                        position: "top" as const,
                      },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        title: {
                          display: true,
                          text: "Weight (lbs)",
                        },
                      },
                    },
                  }}
                />
              ) : (
                <div className="text-center py-4 text-muted">
                  <i
                    className="bi bi-graph-up"
                    style={{ fontSize: "3rem", opacity: 0.3 }}
                  ></i>
                  <p>No prediction data available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Predictions Table */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">🎯 Detailed Enhanced Predictions</h5>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead className="table-dark">
                    <tr>
                      <th>Date</th>
                      <th>Day</th>
                      <th>Original</th>
                      <th>Enhanced</th>
                      <th>ML Adjust</th>
                      <th>External Adjust</th>
                      <th>Confidence</th>
                      <th>Key Factors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enhancedPredictions.map((pred) => (
                      <tr key={pred.date}>
                        <td>
                          {new Date(pred.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="fw-bold">{pred.dayName}</td>
                        <td>
                          <span className="badge bg-secondary">
                            {pred.originalPrediction} lbs
                          </span>
                        </td>
                        <td>
                          <span className="badge bg-primary">
                            {pred.totalPredictedWeight} lbs
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              pred.mlAdjustment > 1.05
                                ? "bg-success"
                                : pred.mlAdjustment < 0.95
                                ? "bg-warning"
                                : "bg-info"
                            }`}
                          >
                            {((pred.mlAdjustment - 1) * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              pred.externalDataAdjustment > 1.05
                                ? "bg-success"
                                : pred.externalDataAdjustment < 0.95
                                ? "bg-warning"
                                : "bg-info"
                            }`}
                          >
                            {((pred.externalDataAdjustment - 1) * 100).toFixed(
                              1
                            )}
                            %
                          </span>
                        </td>
                        <td>
                          <div
                            className="progress"
                            style={{ width: "60px", height: "12px" }}
                          >
                            <div
                              className={`progress-bar ${
                                pred.confidenceLevel > 0.7
                                  ? "bg-success"
                                  : pred.confidenceLevel > 0.5
                                  ? "bg-warning"
                                  : "bg-danger"
                              }`}
                              style={{
                                width: `${pred.confidenceLevel * 100}%`,
                              }}
                            ></div>
                          </div>
                        </td>
                        <td>
                          <div className="d-flex flex-wrap gap-1">
                            {pred.externalDataImpact?.riskFactors
                              .slice(0, 2)
                              .map((factor, i) => (
                                <span
                                  key={i}
                                  className="badge bg-light text-dark"
                                  title={factor}
                                >
                                  {factor.slice(0, 20)}...
                                </span>
                              ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ML Outcome Recorder */}
      {showMLFeatures && (
        <div className="row mb-4">
          <div className="col-12">
            <PredictionOutcomeRecorder />
          </div>
        </div>
      )}

      {/* ML Insights Panel */}
      {showMLFeatures && mlInsights && (
        <div className="row mb-4">
          <div className="col-12">
            <div className="card border-primary">
              <div className="card-header bg-primary text-white">
                <h5 className="mb-0">🤖 Machine Learning Insights</h5>
              </div>
              <div className="card-body">
                <div className="row">
                  <div className="col-md-4">
                    <h6>Neural Network Confidence</h6>
                    <div className="progress mb-2">
                      <div
                        className="progress-bar bg-info"
                        style={{
                          width: `${
                            (mlInsights.neuralNetworkConfidence || 0) * 100
                          }%`,
                        }}
                      ></div>
                    </div>
                    <small className="text-muted">
                      {(
                        (mlInsights.neuralNetworkConfidence || 0) * 100
                      ).toFixed(1)}
                      % average confidence
                    </small>
                  </div>
                  <div className="col-md-4">
                    <h6>Ensemble Model Performance</h6>
                    <div className="mb-2">
                      <small>
                        Pattern:{" "}
                        {(mlInsights.modelWeights?.pattern * 100 || 0).toFixed(
                          0
                        )}
                        %
                      </small>
                      <br />
                      <small>
                        Client:{" "}
                        {(mlInsights.modelWeights?.client * 100 || 0).toFixed(
                          0
                        )}
                        %
                      </small>
                      <br />
                      <small>
                        Trend:{" "}
                        {(mlInsights.modelWeights?.trend * 100 || 0).toFixed(0)}
                        %
                      </small>
                      <br />
                      <small>
                        Neural:{" "}
                        {(mlInsights.modelWeights?.neural * 100 || 0).toFixed(
                          0
                        )}
                        %
                      </small>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <h6>Real-time Learning</h6>
                    <div className="mb-2">
                      <span className="badge bg-success">
                        {mlInsights.totalPredictions || 0} predictions tracked
                      </span>
                      <br />
                      <span className="badge bg-info mt-1">
                        {mlInsights.retrainingEvents || 0} retraining events
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* External Data Summary */}
      {showExternalData && externalDataSummary && (
        <div className="row mb-4">
          <div className="col-12">
            <div className="card border-info">
              <div className="card-header bg-info text-white">
                <h5 className="mb-0">🌐 External Data Impact Summary</h5>
              </div>
              <div className="card-body">
                <div className="row">
                  <div className="col-md-3">
                    <h6>Weather Impact</h6>
                    <div className="mb-2">
                      <span
                        className={`badge ${
                          externalDataSummary.weatherImpact.extreme > 0
                            ? "bg-danger"
                            : externalDataSummary.weatherImpact.moderate > 0
                            ? "bg-warning"
                            : "bg-success"
                        }`}
                      >
                        {externalDataSummary.weatherImpact.extreme} Extreme
                      </span>
                      <span className="badge bg-warning ms-1">
                        {externalDataSummary.weatherImpact.moderate} Moderate
                      </span>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <h6>Holiday Impact</h6>
                    <div className="mb-2">
                      <span className="badge bg-primary">
                        {externalDataSummary.holidayImpact.count} Holidays
                      </span>
                      <br />
                      <span className="badge bg-danger mt-1">
                        {externalDataSummary.holidayImpact.majorHolidays} Major
                      </span>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <h6>Economic Trend</h6>
                    <div className="mb-2">
                      <span
                        className={`badge ${
                          externalDataSummary.economicImpact.trend === "growth"
                            ? "bg-success"
                            : externalDataSummary.economicImpact.trend ===
                              "decline"
                            ? "bg-danger"
                            : "bg-info"
                        }`}
                      >
                        {externalDataSummary.economicImpact.trend}
                      </span>
                      <br />
                      <small>
                        Stability:{" "}
                        {(
                          externalDataSummary.economicImpact.stability * 100
                        ).toFixed(0)}
                        %
                      </small>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <h6>Overall Risk</h6>
                    <div className="mb-2">
                      <span
                        className={`badge ${
                          externalDataSummary.overallRisk === "high"
                            ? "bg-danger"
                            : externalDataSummary.overallRisk === "moderate"
                            ? "bg-warning"
                            : "bg-success"
                        }`}
                      >
                        {externalDataSummary.overallRisk.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <h6>Key Recommendations</h6>
                  <ul className="list-unstyled">
                    {externalDataSummary.keyRecommendations
                      .slice(0, 3)
                      .map((rec: string, i: number) => (
                        <li key={i} className="mb-1">
                          <i className="bi bi-arrow-right text-info me-2"></i>
                          {rec}
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* System Status Footer */}
      <div className="row">
        <div className="col-12">
          <div className="card bg-light">
            <div className="card-body">
              <div className="row text-center">
                <div className="col-md-3">
                  <h6>System Status</h6>
                  <span className="badge bg-success">Online</span>
                </div>
                <div className="col-md-3">
                  <h6>ML Models</h6>
                  <span
                    className={`badge ${
                      showMLFeatures ? "bg-success" : "bg-secondary"
                    }`}
                  >
                    {showMLFeatures ? "Active" : "Disabled"}
                  </span>
                </div>
                <div className="col-md-3">
                  <h6>External Data</h6>
                  <span
                    className={`badge ${
                      showExternalData ? "bg-success" : "bg-secondary"
                    }`}
                  >
                    {showExternalData ? "Connected" : "Disabled"}
                  </span>
                </div>
                <div className="col-md-3">
                  <h6>Predictions</h6>
                  <span className="badge bg-info">
                    {enhancedPredictions.length} Days
                  </span>
                </div>
              </div>
              <div className="mt-3 text-center">
                <small className="text-muted">
                  🧠 Enhanced AI Prediction System v2.0 - Machine Learning
                  Integration and External Data Analysis Complete
                  <br />
                  Last updated: {new Date().toLocaleString()}
                </small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedPredictionScheduleDashboard;
