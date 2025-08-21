import React, { useMemo } from "react";
import { Line, Bar, Scatter } from "react-chartjs-2";

interface PredictionData {
  date: string;
  dayName: string;
  totalPredictedWeight: number;
  confidenceLevel: number;
}

interface WeeklyPattern {
  dayOfWeek: number;
  dayName: string;
  avgWeight: number;
  avgEntries: number;
  confidence: number;
}

interface IntelligentPredictionProps {
  predictions: PredictionData[];
  weeklyPatterns: WeeklyPattern[];
}

// Enhanced intelligence features for prediction analysis
export const IntelligentPredictionEnhancements: React.FC<
  IntelligentPredictionProps
> = ({ predictions, weeklyPatterns }) => {
  // Advanced analytics with confidence intervals and seasonal adjustments
  const enhancedAnalysis = useMemo(() => {
    if (!predictions.length || !weeklyPatterns.length) return [];

    return predictions.map((pred, index) => {
      const dayOfWeek = new Date(pred.date).getDay();
      const weeklyPattern = weeklyPatterns.find(
        (p) => p.dayOfWeek === dayOfWeek
      );
      const historicalAvg = weeklyPattern ? weeklyPattern.avgWeight : 0;
      const difference = pred.totalPredictedWeight - historicalAvg;
      const percentageDiff =
        historicalAvg > 0 ? (difference / historicalAvg) * 100 : 0;

      // Calculate confidence intervals (assuming 15% standard deviation)
      const historicalVariance = historicalAvg * 0.15;
      const confidenceInterval = {
        lower: pred.totalPredictedWeight - 1.96 * historicalVariance,
        upper: pred.totalPredictedWeight + 1.96 * historicalVariance,
        margin: 1.96 * historicalVariance,
      };

      // Seasonal adjustment
      const monthOfYear = new Date(pred.date).getMonth();
      const seasonalMultiplier = getSeasonalMultiplier(monthOfYear);
      const seasonallyAdjustedPrediction =
        pred.totalPredictedWeight * seasonalMultiplier;

      // Anomaly detection using Z-score
      const zScore =
        historicalVariance > 0 ? Math.abs(difference) / historicalVariance : 0;
      const isAnomalous = zScore > 2.5;

      // Trend analysis
      const trend =
        index > 0
          ? pred.totalPredictedWeight -
            predictions[index - 1].totalPredictedWeight
          : 0;

      return {
        ...pred,
        historicalAvg,
        difference,
        percentageDiff,
        confidenceInterval,
        seasonallyAdjustedPrediction,
        seasonalMultiplier,
        isAnomalous,
        zScore,
        trend,
        accuracy: calculatePredictionAccuracy(
          pred.totalPredictedWeight,
          historicalAvg
        ),
        volatility: calculateVolatility(historicalVariance, historicalAvg),
      };
    });
  }, [predictions, weeklyPatterns]);

  // Smart insights generation
  const smartInsights = useMemo(() => {
    if (!enhancedAnalysis.length) return [];

    const insights = [];

    // Overall accuracy insight
    const excellentCount = enhancedAnalysis.filter(
      (a) => a.accuracy === "Excellent"
    ).length;
    const goodCount = enhancedAnalysis.filter(
      (a) => a.accuracy === "Good"
    ).length;

    if (excellentCount >= enhancedAnalysis.length * 0.7) {
      insights.push({
        type: "success",
        icon: "🎯",
        message: `High accuracy predictions: ${excellentCount}/${enhancedAnalysis.length} days show excellent accuracy (≥95%)`,
      });
    } else if (goodCount + excellentCount >= enhancedAnalysis.length * 0.6) {
      insights.push({
        type: "info",
        icon: "📊",
        message: `Good prediction reliability: ${goodCount + excellentCount}/${
          enhancedAnalysis.length
        } days show good accuracy (≥85%)`,
      });
    } else {
      insights.push({
        type: "warning",
        icon: "⚠️",
        message:
          "Prediction accuracy could be improved - consider reviewing historical data patterns",
      });
    }

    // Anomaly detection
    const anomalousCount = enhancedAnalysis.filter((a) => a.isAnomalous).length;
    if (anomalousCount > 0) {
      insights.push({
        type: "warning",
        icon: "🚨",
        message: `${anomalousCount} day(s) show anomalous predictions (>2.5σ from historical patterns)`,
      });
    }

    // Trend analysis
    const upwardTrends = enhancedAnalysis.filter((a) => a.trend > 0).length;
    const downwardTrends = enhancedAnalysis.filter((a) => a.trend < 0).length;

    if (upwardTrends > downwardTrends) {
      insights.push({
        type: "info",
        icon: "📈",
        message:
          "Upward trend detected - workload increasing over forecast period",
      });
    } else if (downwardTrends > upwardTrends) {
      insights.push({
        type: "info",
        icon: "📉",
        message:
          "Downward trend detected - workload decreasing over forecast period",
      });
    }

    // Seasonal insights
    const seasonalAdjustments = enhancedAnalysis.filter(
      (a) => Math.abs(a.seasonalMultiplier - 1) > 0.05
    );
    if (seasonalAdjustments.length > 0) {
      insights.push({
        type: "info",
        icon: "🗓️",
        message: `${seasonalAdjustments.length} day(s) have significant seasonal adjustments (±5%)`,
      });
    }

    return insights;
  }, [enhancedAnalysis]);

  // Advanced chart with confidence bands
  const confidenceBandChart = useMemo(() => {
    if (!enhancedAnalysis.length) return { labels: [], datasets: [] };

    const labels = enhancedAnalysis.map(
      (a) => `${a.dayName.slice(0, 3)} ${new Date(a.date).getDate()}`
    );

    return {
      labels,
      datasets: [
        {
          label: "Predicted Weight",
          data: enhancedAnalysis.map((a) => a.totalPredictedWeight),
          backgroundColor: "rgba(59, 130, 246, 0.2)",
          borderColor: "rgb(59, 130, 246)",
          borderWidth: 3,
          pointRadius: 6,
          fill: false,
          tension: 0.4,
        },
        {
          label: "Historical Average",
          data: enhancedAnalysis.map((a) => a.historicalAvg),
          backgroundColor: "rgba(34, 197, 94, 0.2)",
          borderColor: "rgb(34, 197, 94)",
          borderWidth: 2,
          pointRadius: 5,
          borderDash: [5, 5],
          fill: false,
          tension: 0.4,
        },
        {
          label: "Upper Confidence Bound (95%)",
          data: enhancedAnalysis.map((a) => a.confidenceInterval.upper),
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          borderColor: "rgba(59, 130, 246, 0.3)",
          borderWidth: 1,
          pointRadius: 0,
          fill: "+1",
          tension: 0.4,
        },
        {
          label: "Lower Confidence Bound (95%)",
          data: enhancedAnalysis.map((a) => a.confidenceInterval.lower),
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          borderColor: "rgba(59, 130, 246, 0.3)",
          borderWidth: 1,
          pointRadius: 0,
          fill: false,
          tension: 0.4,
        },
        {
          label: "Seasonally Adjusted",
          data: enhancedAnalysis.map((a) => a.seasonallyAdjustedPrediction),
          backgroundColor: "rgba(168, 85, 247, 0.2)",
          borderColor: "rgb(168, 85, 247)",
          borderWidth: 2,
          pointRadius: 4,
          borderDash: [2, 2],
          fill: false,
          tension: 0.4,
        },
      ],
    };
  }, [enhancedAnalysis]);

  // Anomaly scatter plot
  const anomalyScatterChart = useMemo(() => {
    if (!enhancedAnalysis.length) return { datasets: [] };

    const normalPoints = enhancedAnalysis.filter((a) => !a.isAnomalous);
    const anomalousPoints = enhancedAnalysis.filter((a) => a.isAnomalous);

    return {
      datasets: [
        {
          label: "Normal Predictions",
          data: normalPoints.map((a, i) => ({ x: i, y: a.zScore })),
          backgroundColor: "rgba(34, 197, 94, 0.7)",
          borderColor: "rgb(34, 197, 94)",
          pointRadius: 6,
        },
        {
          label: "Anomalous Predictions",
          data: anomalousPoints.map((a, i) => ({
            x: enhancedAnalysis.indexOf(a),
            y: a.zScore,
          })),
          backgroundColor: "rgba(239, 68, 68, 0.7)",
          borderColor: "rgb(239, 68, 68)",
          pointRadius: 8,
        },
      ],
    };
  }, [enhancedAnalysis]);

  if (!predictions.length || !weeklyPatterns.length) {
    return (
      <div className="alert alert-info">
        <h6>🔬 Intelligent Analysis Unavailable</h6>
        <p className="mb-0">
          Generate predictions to see advanced intelligence features
        </p>
      </div>
    );
  }

  return (
    <div className="row">
      {/* Smart Insights Panel */}
      <div className="col-lg-4">
        <div className="card">
          <div className="card-header">
            <h6 className="mb-0">🧠 AI-Powered Insights</h6>
          </div>
          <div className="card-body">
            {smartInsights.map((insight, index) => (
              <div
                key={index}
                className={`alert alert-${
                  insight.type === "success"
                    ? "success"
                    : insight.type === "warning"
                    ? "warning"
                    : "info"
                } mb-2`}
              >
                <div className="d-flex">
                  <div className="me-2" style={{ fontSize: "1.2rem" }}>
                    {insight.icon}
                  </div>
                  <div>
                    <small>{insight.message}</small>
                  </div>
                </div>
              </div>
            ))}

            {/* Advanced Metrics */}
            <div className="mt-3 p-3 bg-light rounded">
              <h6 className="mb-2">📈 Statistical Summary</h6>
              <div className="row text-center">
                <div className="col-6">
                  <div className="border-end">
                    <strong className="d-block">
                      {Math.round(
                        enhancedAnalysis.reduce(
                          (sum, a) => sum + Math.abs(a.percentageDiff),
                          0
                        ) / enhancedAnalysis.length
                      )}
                      %
                    </strong>
                    <small className="text-muted">Avg Deviation</small>
                  </div>
                </div>
                <div className="col-6">
                  <strong className="d-block">
                    {
                      enhancedAnalysis.filter(
                        (a) =>
                          a.accuracy === "Excellent" || a.accuracy === "Good"
                      ).length
                    }
                  </strong>
                  <small className="text-muted">Reliable Days</small>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Anomaly Detection */}
        <div className="card mt-3">
          <div className="card-header">
            <h6 className="mb-0">🚨 Anomaly Detection</h6>
          </div>
          <div className="card-body" style={{ height: "250px" }}>
            <Scatter
              data={anomalyScatterChart}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  title: {
                    display: true,
                    text: "Statistical Deviation (Z-Score)",
                  },
                  legend: {
                    position: "bottom",
                  },
                },
                scales: {
                  x: {
                    title: {
                      display: true,
                      text: "Day Index",
                    },
                  },
                  y: {
                    title: {
                      display: true,
                      text: "Z-Score (σ)",
                    },
                  },
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* Advanced Prediction Chart with Confidence Bands */}
      <div className="col-lg-8">
        <div className="card">
          <div className="card-header">
            <h6 className="mb-0">
              📊 Advanced Prediction Analysis with Confidence Intervals
            </h6>
            <small className="text-muted">
              95% confidence bands and seasonal adjustments
            </small>
          </div>
          <div className="card-body" style={{ height: "400px" }}>
            <Line
              data={confidenceBandChart}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: "top",
                  },
                  tooltip: {
                    callbacks: {
                      afterBody: (tooltipItems) => {
                        const index = tooltipItems[0]?.dataIndex;
                        if (index !== undefined && enhancedAnalysis[index]) {
                          const analysis = enhancedAnalysis[index];
                          return [
                            `Accuracy: ${analysis.accuracy}`,
                            `Seasonal Factor: ${(
                              analysis.seasonalMultiplier * 100
                            ).toFixed(1)}%`,
                            `Z-Score: ${analysis.zScore.toFixed(2)}σ`,
                            `Volatility: ${analysis.volatility}`,
                          ];
                        }
                        return [];
                      },
                    },
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
          </div>
        </div>

        {/* Detailed Analysis Table */}
        <div className="card mt-3">
          <div className="card-header">
            <h6 className="mb-0">📋 Detailed Intelligence Report</h6>
          </div>
          <div className="card-body">
            <div className="table-responsive">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Predicted</th>
                    <th>Historical</th>
                    <th>Difference</th>
                    <th>Accuracy</th>
                    <th>Seasonal</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {enhancedAnalysis.map((analysis, index) => (
                    <tr
                      key={index}
                      className={analysis.isAnomalous ? "table-warning" : ""}
                    >
                      <td>
                        <strong>{analysis.dayName}</strong>
                        <br />
                        <small className="text-muted">
                          {new Date(analysis.date).toLocaleDateString()}
                        </small>
                      </td>
                      <td>
                        <strong>{analysis.totalPredictedWeight} lbs</strong>
                        <br />
                        <small className="text-muted">
                          ±{Math.round(analysis.confidenceInterval.margin)} lbs
                        </small>
                      </td>
                      <td>{Math.round(analysis.historicalAvg)} lbs</td>
                      <td>
                        <span
                          className={
                            analysis.difference >= 0
                              ? "text-success"
                              : "text-danger"
                          }
                        >
                          {analysis.difference >= 0 ? "+" : ""}
                          {Math.round(analysis.difference)} lbs
                          <br />
                          <small>
                            ({analysis.percentageDiff >= 0 ? "+" : ""}
                            {Math.round(analysis.percentageDiff)}%)
                          </small>
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            analysis.accuracy === "Excellent"
                              ? "bg-success"
                              : analysis.accuracy === "Good"
                              ? "bg-primary"
                              : analysis.accuracy === "Fair"
                              ? "bg-warning"
                              : "bg-danger"
                          }`}
                        >
                          {analysis.accuracy}
                        </span>
                      </td>
                      <td>
                        {(analysis.seasonalMultiplier * 100).toFixed(1)}%
                        <br />
                        <small className="text-muted">
                          {Math.round(analysis.seasonallyAdjustedPrediction)}{" "}
                          lbs
                        </small>
                      </td>
                      <td>
                        {analysis.isAnomalous ? (
                          <span className="badge bg-warning">
                            <i className="bi bi-exclamation-triangle-fill"></i>{" "}
                            Anomaly
                          </span>
                        ) : (
                          <span className="badge bg-success">
                            <i className="bi bi-check-circle-fill"></i> Normal
                          </span>
                        )}
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
  );
};

// Helper functions
function getSeasonalMultiplier(month: number): number {
  const seasonalFactors: { [key: number]: number } = {
    0: 1.1, // January - New Year cleanup
    1: 0.95, // February - slower month
    2: 1.05, // March - spring cleaning
    3: 1.1, // April - spring peak
    4: 1.15, // May - wedding season
    5: 1.2, // June - peak season
    6: 1.1, // July - summer
    7: 1.05, // August - back to school
    8: 1.1, // September - fall cleaning
    9: 1.0, // October - normal
    10: 0.9, // November - pre-holiday lull
    11: 1.05, // December - holiday events
  };
  return seasonalFactors[month] || 1.0;
}

function calculatePredictionAccuracy(
  predicted: number,
  historical: number
): string {
  if (historical === 0) return "N/A";
  const accuracy = 100 - Math.abs((predicted - historical) / historical) * 100;
  if (accuracy >= 95) return "Excellent";
  if (accuracy >= 85) return "Good";
  if (accuracy >= 70) return "Fair";
  return "Needs Improvement";
}

function calculateVolatility(variance: number, mean: number): string {
  if (mean === 0) return "N/A";
  const coefficientOfVariation = (Math.sqrt(variance) / mean) * 100;
  if (coefficientOfVariation < 10) return "Low";
  if (coefficientOfVariation < 25) return "Moderate";
  return "High";
}

export default IntelligentPredictionEnhancements;
