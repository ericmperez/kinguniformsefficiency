import React, { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, where, orderBy, limit, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import { Line, Bar } from "react-chartjs-2";
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
} from "chart.js";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
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

interface IntervalData {
  time: string;
  weight: number; // Individual weight added at this interval
  cumulativeWeight: number; // Running total up to this point
  count: number;
}

interface DayOfWeekData {
  dayName: string;
  dayIndex: number;
  intervals: IntervalData[];
  totalWeight: number;
  totalEntries: number;
  avgWeightPerEntry: number;
}

const WeightIntervalAnalytics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [pickupEntries, setPickupEntries] = useState<PickupEntry[]>([]);
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Monday to Friday by default
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");
  const [weightDisplayMode, setWeightDisplayMode] = useState<
    "cumulative" | "individual" | "both"
  >("cumulative");
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 90); // Last 90 days
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  });

  // Load pickup entries data with optimized Firestore queries
  useEffect(() => {
    const loadPickupEntries = async () => {
      setLoading(true);
      try {
        console.log(
          "📊 Loading pickup entries for weight interval analysis with date constraints..."
        );

        const startDate = new Date(dateRange.start);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999);

        // Convert to Firestore Timestamp for query
        const startTimestamp = Timestamp.fromDate(startDate);
        const endTimestamp = Timestamp.fromDate(endDate);

        // Use Firestore query with date constraints to reduce data transfer
        const q = query(
          collection(db, "pickup_entries"),
          where("timestamp", ">=", startTimestamp),
          where("timestamp", "<=", endTimestamp),
          orderBy("timestamp", "desc"),
          limit(10000) // Safety limit to prevent excessive reads
        );

        console.log(`📊 Querying pickup_entries from ${startDate.toISOString()} to ${endDate.toISOString()}`);
        
        const snapshot = await getDocs(q);
        const entries = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            const timestamp =
              data.timestamp instanceof Timestamp
                ? data.timestamp.toDate()
                : new Date(data.timestamp);

            return {
              id: doc.id,
              clientId: data.clientId || "unknown",
              clientName: data.clientName || "Unknown Client",
              timestamp,
              weight: Number(data.weight) || 0,
              driverName: data.driverName || "Unknown Driver",
              cartId: data.cartId || "",
            } as PickupEntry;
          })
          .filter(
            (entry) =>
              entry.timestamp instanceof Date &&
              !isNaN(entry.timestamp.getTime()) &&
              entry.weight > 0
          );

        setPickupEntries(entries);
        console.log(`📊 Loaded ${entries.length} pickup entries for analysis (optimized query)`);
      } catch (error) {
        console.error("Error loading pickup entries:", error);
      } finally {
        setLoading(false);
      }
    };

    loadPickupEntries();
  }, [dateRange]);

  // Process data into 30-minute intervals by day of week
  const processedData = useMemo((): DayOfWeekData[] => {
    if (!pickupEntries.length) return [];

    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const results: DayOfWeekData[] = [];

    // Generate 30-minute intervals for the day (48 intervals: 00:00-23:30)
    const generateIntervals = (): IntervalData[] => {
      const intervals: IntervalData[] = [];
      for (let hour = 0; hour < 24; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const timeStr = `${hour.toString().padStart(2, "0")}:${minute
            .toString()
            .padStart(2, "0")}`;
          intervals.push({
            time: timeStr,
            weight: 0,
            cumulativeWeight: 0,
            count: 0,
          });
        }
      }
      return intervals;
    };

    // Process each day of the week
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      if (!selectedDays.includes(dayIndex)) continue;

      const dayEntries = pickupEntries.filter(
        (entry) => entry.timestamp.getDay() === dayIndex
      );
      const intervals = generateIntervals();

      // Group entries by date and then by 30-minute intervals
      const entriesByDate: { [dateStr: string]: PickupEntry[] } = {};
      dayEntries.forEach((entry) => {
        const dateStr = entry.timestamp.toISOString().slice(0, 10);
        if (!entriesByDate[dateStr]) {
          entriesByDate[dateStr] = [];
        }
        entriesByDate[dateStr].push(entry);
      });

      // Calculate cumulative weights for each interval across all dates
      const intervalAverages: {
        [intervalKey: string]: { totalWeight: number; dateCount: number };
      } = {};

      Object.entries(entriesByDate).forEach(([dateStr, dateEntries]) => {
        const intervalWeights: { [intervalKey: string]: number } = {};

        // Initialize all intervals to 0 for this date
        intervals.forEach((_, idx) => {
          intervalWeights[idx] = 0;
        });

        // Process entries for this date
        dateEntries.forEach((entry) => {
          const hour = entry.timestamp.getHours();
          const minute = entry.timestamp.getMinutes();

          // Find the appropriate 30-minute interval
          const intervalMinute = minute < 30 ? 0 : 30;
          const intervalIndex = hour * 2 + intervalMinute / 30;

          // Accumulate weight for this interval on this date
          intervalWeights[intervalIndex] += entry.weight;
        });

        // Add this date's interval weights to the running totals
        Object.entries(intervalWeights).forEach(([intervalIdx, weight]) => {
          const key = intervalIdx.toString();
          if (!intervalAverages[key]) {
            intervalAverages[key] = { totalWeight: 0, dateCount: 0 };
          }
          intervalAverages[key].totalWeight += weight;
          intervalAverages[key].dateCount++;
        });
      });

      // Calculate averages and populate intervals with cumulative weights
      let cumulativeTotal = 0;
      Object.entries(intervalAverages).forEach(([intervalIdx, data]) => {
        const idx = parseInt(intervalIdx);
        const avgWeight =
          data.dateCount > 0 ? data.totalWeight / data.dateCount : 0;
        intervals[idx].weight = avgWeight;
        intervals[idx].count = data.dateCount;

        // Calculate cumulative weight (running total)
        cumulativeTotal += avgWeight;
        intervals[idx].cumulativeWeight = cumulativeTotal;
      });

      const totalWeight = intervals.reduce(
        (sum, interval) => sum + interval.weight,
        0
      );
      const totalEntries = dayEntries.length;
      const avgWeightPerEntry =
        totalEntries > 0
          ? dayEntries.reduce((sum, e) => sum + e.weight, 0) / totalEntries
          : 0;

      results.push({
        dayName: dayNames[dayIndex],
        dayIndex,
        intervals,
        totalWeight,
        totalEntries,
        avgWeightPerEntry,
      });
    }

    return results.sort((a, b) => a.dayIndex - b.dayIndex);
  }, [pickupEntries, selectedDays]);

  // Chart data for line chart with selectable weight display mode
  const chartData = useMemo(() => {
    if (!processedData.length) return { labels: [], datasets: [] };

    const labels =
      processedData[0]?.intervals.map((interval) => interval.time) || [];

    const datasets: any[] = [];

    // Create datasets based on selected display mode
    processedData.forEach((dayData, index) => {
      const colors = [
        "#EF4444",
        "#F97316",
        "#EAB308",
        "#22C55E",
        "#3B82F6",
        "#8B5CF6",
        "#EC4899",
      ];

      if (weightDisplayMode === "cumulative" || weightDisplayMode === "both") {
        datasets.push({
          label: `${dayData.dayName}${
            weightDisplayMode === "both" ? " (Cumulative)" : ""
          }`,
          data: dayData.intervals.map((interval) =>
            Math.round(interval.cumulativeWeight)
          ),
          borderColor: colors[index % colors.length],
          backgroundColor: colors[index % colors.length] + "20",
          tension: 0.4,
          pointRadius: 2,
          pointHoverRadius: 5,
          borderWidth: 2,
          yAxisID: "y",
        });
      }

      if (weightDisplayMode === "individual" || weightDisplayMode === "both") {
        datasets.push({
          label: `${dayData.dayName}${
            weightDisplayMode === "both" ? " (Individual)" : ""
          }`,
          data: dayData.intervals.map((interval) =>
            Math.round(interval.weight)
          ),
          borderColor:
            weightDisplayMode === "both"
              ? colors[index % colors.length] + "80"
              : colors[index % colors.length],
          backgroundColor: colors[index % colors.length] + "10",
          tension: 0.4,
          pointRadius: weightDisplayMode === "both" ? 1 : 2,
          pointHoverRadius: weightDisplayMode === "both" ? 3 : 5,
          borderWidth: weightDisplayMode === "both" ? 1 : 2,
          borderDash: weightDisplayMode === "both" ? [5, 5] : [],
          yAxisID: "y",
        });
      }
    });

    return { labels, datasets };
  }, [processedData, weightDisplayMode]);

  // Handle day selection
  const handleDayToggle = (dayIndex: number) => {
    setSelectedDays((prev) =>
      prev.includes(dayIndex)
        ? prev.filter((d) => d !== dayIndex)
        : [...prev, dayIndex].sort()
    );
  };

  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  if (loading) {
    return (
      <div className="container py-4">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <div className="mt-2">Loading weight interval analytics...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      {/* Header */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card border-0 shadow">
            <div className="card-body">
              <h2 className="mb-2">
                <i className="bi bi-graph-up me-2"></i>
                Weight Interval Analytics
              </h2>
              <p className="text-muted mb-0">
                Historical average weight by day of the week in 30-minute
                intervals. Shows cumulative weight trends throughout each day
                based on pickup entries.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <div className="row align-items-end">
                <div className="col-md-2">
                  <label className="form-label">Start Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={dateRange.start}
                    onChange={(e) =>
                      setDateRange((prev) => ({
                        ...prev,
                        start: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label">End Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={dateRange.end}
                    onChange={(e) =>
                      setDateRange((prev) => ({ ...prev, end: e.target.value }))
                    }
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Days to Include</label>
                  <div className="d-flex flex-wrap gap-2">
                    {dayNames.map((dayName, index) => (
                      <button
                        key={index}
                        className={`btn btn-sm ${
                          selectedDays.includes(index)
                            ? "btn-primary"
                            : "btn-outline-primary"
                        }`}
                        onClick={() => handleDayToggle(index)}
                      >
                        {dayName.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Weight Display</label>
                  <div className="btn-group w-100" role="group">
                    <button
                      className={`btn btn-sm ${
                        weightDisplayMode === "cumulative"
                          ? "btn-primary"
                          : "btn-outline-primary"
                      }`}
                      onClick={() => setWeightDisplayMode("cumulative")}
                      title="Show cumulative weight (running total)"
                    >
                      <i className="bi bi-graph-up me-1"></i>
                      Cumulative
                    </button>
                    <button
                      className={`btn btn-sm ${
                        weightDisplayMode === "individual"
                          ? "btn-primary"
                          : "btn-outline-primary"
                      }`}
                      onClick={() => setWeightDisplayMode("individual")}
                      title="Show individual weight per interval"
                    >
                      <i className="bi bi-bar-chart me-1"></i>
                      Individual
                    </button>
                    <button
                      className={`btn btn-sm ${
                        weightDisplayMode === "both"
                          ? "btn-primary"
                          : "btn-outline-primary"
                      }`}
                      onClick={() => setWeightDisplayMode("both")}
                      title="Show both cumulative and individual weights"
                    >
                      <i className="bi bi-layers me-1"></i>
                      Both
                    </button>
                  </div>
                </div>
                <div className="col-md-2">
                  <label className="form-label">View Mode</label>
                  <div className="btn-group w-100" role="group">
                    <button
                      className={`btn ${
                        viewMode === "chart"
                          ? "btn-primary"
                          : "btn-outline-primary"
                      }`}
                      onClick={() => setViewMode("chart")}
                    >
                      <i className="bi bi-graph-up me-1"></i>
                      Chart
                    </button>
                    <button
                      className={`btn ${
                        viewMode === "table"
                          ? "btn-primary"
                          : "btn-outline-primary"
                      }`}
                      onClick={() => setViewMode("table")}
                    >
                      <i className="bi bi-table me-1"></i>
                      Table
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="row mb-4">
        {processedData.map((dayData) => (
          <div
            key={dayData.dayIndex}
            className="col-lg-2 col-md-3 col-sm-4 col-6 mb-3"
          >
            <div className="card h-100">
              <div className="card-body text-center p-3">
                <h6 className="card-title mb-1">{dayData.dayName}</h6>
                <div className="text-primary mb-1">
                  <strong>
                    {Math.round(dayData.totalWeight).toLocaleString()}
                  </strong>
                </div>
                <small className="text-muted">Avg lbs/day</small>
                <hr className="my-2" />
                <small className="text-muted">
                  {dayData.totalEntries.toLocaleString()} total entries
                </small>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart View */}
      {viewMode === "chart" && (
        <div className="row mb-4">
          <div className="col-12">
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">
                  <i className="bi bi-graph-up me-2"></i>
                  Average Weight by 30-Minute Intervals
                </h5>
              </div>
              <div className="card-body">
                {chartData.datasets.length > 0 ? (
                  <div style={{ height: "500px" }}>
                    <Line
                      data={chartData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          title: {
                            display: true,
                            text: `${
                              weightDisplayMode === "cumulative"
                                ? "Cumulative Weight Throughout the Day"
                                : weightDisplayMode === "individual"
                                ? "Individual Weight by 30-Minute Intervals"
                                : "Individual and Cumulative Weight Throughout the Day"
                            } (30-minute intervals)`,
                          },
                          legend: {
                            position: "top" as const,
                          },
                          tooltip: {
                            callbacks: {
                              label: function (context) {
                                return `${
                                  context.dataset.label
                                }: ${context.parsed.y.toLocaleString()} lbs`;
                              },
                            },
                          },
                        },
                        scales: {
                          x: {
                            title: {
                              display: true,
                              text: "Time of Day",
                            },
                            ticks: {
                              maxTicksLimit: 12,
                              callback: function (value, index) {
                                // Show every 4th tick (every 2 hours)
                                return index % 4 === 0
                                  ? this.getLabelForValue(value as number)
                                  : "";
                              },
                            },
                          },
                          y: {
                            beginAtZero: true,
                            title: {
                              display: true,
                              text: `${
                                weightDisplayMode === "cumulative"
                                  ? "Cumulative Weight (lbs)"
                                  : weightDisplayMode === "individual"
                                  ? "Individual Weight (lbs)"
                                  : "Weight (lbs)"
                              }`,
                            },
                            ticks: {
                              callback: function (value) {
                                return (
                                  (value as number).toLocaleString() + " lbs"
                                );
                              },
                            },
                          },
                        },
                        interaction: {
                          intersect: false,
                          mode: "index",
                        },
                      }}
                    />
                  </div>
                ) : (
                  <div className="text-center py-5 text-muted">
                    <i
                      className="bi bi-graph-up"
                      style={{ fontSize: "3rem", opacity: 0.3 }}
                    ></i>
                    <p className="mt-2">
                      No data available for the selected criteria
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table View */}
      {viewMode === "table" && (
        <div className="row">
          <div className="col-12">
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">
                  <i className="bi bi-table me-2"></i>
                  Weight Interval Data Table
                </h5>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-striped table-hover mb-0">
                    <thead className="table-dark">
                      <tr>
                        <th rowSpan={weightDisplayMode === "both" ? 2 : 1}>
                          Time
                        </th>
                        {processedData.map((dayData) => (
                          <th
                            key={dayData.dayIndex}
                            className="text-center"
                            colSpan={
                              weightDisplayMode === "both"
                                ? 2
                                : weightDisplayMode === "individual"
                                ? 1
                                : 1
                            }
                          >
                            {dayData.dayName}
                          </th>
                        ))}
                      </tr>
                      {weightDisplayMode === "both" && (
                        <tr>
                          {processedData.map((dayData) => (
                            <React.Fragment key={dayData.dayIndex}>
                              <th className="text-center small">Individual</th>
                              <th className="text-center small">Cumulative</th>
                            </React.Fragment>
                          ))}
                        </tr>
                      )}
                    </thead>
                    <tbody>
                      {processedData[0]?.intervals.map((_, intervalIndex) => (
                        <tr key={intervalIndex}>
                          <td className="fw-bold">
                            {processedData[0].intervals[intervalIndex].time}
                          </td>
                          {processedData.map((dayData) => {
                            const interval = dayData.intervals[intervalIndex];
                            const individualWeight = Math.round(
                              interval.weight
                            );
                            const cumulativeWeight = Math.round(
                              interval.cumulativeWeight
                            );

                            if (weightDisplayMode === "individual") {
                              return (
                                <td
                                  key={dayData.dayIndex}
                                  className="text-center"
                                >
                                  {individualWeight > 0 ? (
                                    <span
                                      className={`badge ${
                                        individualWeight > 1000
                                          ? "bg-success"
                                          : individualWeight > 500
                                          ? "bg-warning text-dark"
                                          : individualWeight > 0
                                          ? "bg-info"
                                          : "bg-light text-dark"
                                      }`}
                                    >
                                      {individualWeight.toLocaleString()}
                                    </span>
                                  ) : (
                                    <span className="text-muted">-</span>
                                  )}
                                </td>
                              );
                            } else if (weightDisplayMode === "cumulative") {
                              return (
                                <td
                                  key={dayData.dayIndex}
                                  className="text-center"
                                >
                                  {cumulativeWeight > 0 ? (
                                    <span
                                      className={`badge ${
                                        cumulativeWeight > 5000
                                          ? "bg-primary"
                                          : cumulativeWeight > 2000
                                          ? "bg-success"
                                          : cumulativeWeight > 500
                                          ? "bg-warning text-dark"
                                          : cumulativeWeight > 0
                                          ? "bg-info"
                                          : "bg-light text-dark"
                                      }`}
                                    >
                                      {cumulativeWeight.toLocaleString()}
                                    </span>
                                  ) : (
                                    <span className="text-muted">-</span>
                                  )}
                                </td>
                              );
                            } else {
                              // both
                              return (
                                <React.Fragment key={dayData.dayIndex}>
                                  <td className="text-center">
                                    {individualWeight > 0 ? (
                                      <span
                                        className={`badge ${
                                          individualWeight > 1000
                                            ? "bg-success"
                                            : individualWeight > 500
                                            ? "bg-warning text-dark"
                                            : individualWeight > 0
                                            ? "bg-info"
                                            : "bg-light text-dark"
                                        }`}
                                      >
                                        {individualWeight.toLocaleString()}
                                      </span>
                                    ) : (
                                      <span className="text-muted">-</span>
                                    )}
                                  </td>
                                  <td className="text-center">
                                    {cumulativeWeight > 0 ? (
                                      <span
                                        className={`badge ${
                                          cumulativeWeight > 5000
                                            ? "bg-primary"
                                            : cumulativeWeight > 2000
                                            ? "bg-success"
                                            : cumulativeWeight > 500
                                            ? "bg-warning text-dark"
                                            : cumulativeWeight > 0
                                            ? "bg-info"
                                            : "bg-light text-dark"
                                        }`}
                                      >
                                        {cumulativeWeight.toLocaleString()}
                                      </span>
                                    ) : (
                                      <span className="text-muted">-</span>
                                    )}
                                  </td>
                                </React.Fragment>
                              );
                            }
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="row mt-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">
                <i className="bi bi-bar-chart me-2"></i>
                Summary Statistics
              </h5>
            </div>
            <div className="card-body">
              <div className="row text-center">
                <div className="col-md-3">
                  <h4 className="text-primary">
                    {pickupEntries.length.toLocaleString()}
                  </h4>
                  <p className="mb-0">Total Pickup Entries</p>
                  <small className="text-muted">
                    {dateRange.start} to {dateRange.end}
                  </small>
                </div>
                <div className="col-md-3">
                  <h4 className="text-success">
                    {Math.round(
                      pickupEntries.reduce((sum, e) => sum + e.weight, 0)
                    ).toLocaleString()}
                  </h4>
                  <p className="mb-0">Total Weight (lbs)</p>
                  <small className="text-muted">All selected days</small>
                </div>
                <div className="col-md-3">
                  <h4 className="text-warning">
                    {pickupEntries.length > 0
                      ? Math.round(
                          pickupEntries.reduce((sum, e) => sum + e.weight, 0) /
                            pickupEntries.length
                        )
                      : 0}
                  </h4>
                  <p className="mb-0">Avg Weight per Entry</p>
                  <small className="text-muted">Historical average</small>
                </div>
                <div className="col-md-3">
                  <h4 className="text-info">{selectedDays.length}</h4>
                  <p className="mb-0">Days Selected</p>
                  <small className="text-muted">Out of 7 days</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeightIntervalAnalytics;
