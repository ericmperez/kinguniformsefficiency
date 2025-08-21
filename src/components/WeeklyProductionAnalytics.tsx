import React, { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
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
import { productClassificationService } from "../services/ProductClassificationService";

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

interface ProductionEntry {
  id: string;
  productName: string;
  quantity: number;
  addedAt: Date;
  clientName: string;
  classification: "Mangle" | "Doblado";
}

interface DayOfWeekData {
  dayName: string;
  dayIndex: number;
  totalProduction: number;
  mangleProduction: number;
  dobladoProduction: number;
  entryCount: number;
  dates: Date[];
}

const WeeklyProductionAnalytics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [productionEntries, setProductionEntries] = useState<ProductionEntry[]>([]);
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30); // Last 30 days by default
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  });
  const [chartType, setChartType] = useState<"line" | "bar">("bar");

  // Load production entries data
  useEffect(() => {
    const loadProductionEntries = async () => {
      setLoading(true);
      try {
        console.log("📊 Loading production entries for weekly analysis...");

        const startDate = new Date(dateRange.start);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999);

        // Query invoices within date range
        const invoicesQuery = query(
          collection(db, "invoices"),
          where("date", ">=", Timestamp.fromDate(startDate)),
          where("date", "<=", Timestamp.fromDate(endDate))
        );

        const invoicesSnapshot = await getDocs(invoicesQuery);
        const entries: ProductionEntry[] = [];

        // Wait for classification service to initialize
        await productClassificationService.waitForInitialization();

        invoicesSnapshot.docs.forEach((doc) => {
          const invoice = doc.data();
          const invoiceDate = invoice.date?.toDate() || new Date();

          // Process all items in all carts
          if (invoice.carts && Array.isArray(invoice.carts)) {
            invoice.carts.forEach((cart: any) => {
              if (cart.items && Array.isArray(cart.items)) {
                cart.items.forEach((item: any) => {
                  // Only include items with valid production data
                  if (
                    item.productName &&
                    item.quantity &&
                    Number(item.quantity) > 0 &&
                    !item.productName.toLowerCase().includes("unknown") &&
                    item.addedAt
                  ) {
                    const addedAt = item.addedAt.toDate ? item.addedAt.toDate() : new Date(item.addedAt);
                    
                    // Check if item was added within our date range
                    if (addedAt >= startDate && addedAt <= endDate) {
                      const classification = productClassificationService.getClassification(item.productName);
                      
                      entries.push({
                        id: `${doc.id}-${cart.id}-${item.idx || Date.now()}`,
                        productName: item.productName,
                        quantity: Number(item.quantity),
                        addedAt: addedAt,
                        clientName: invoice.clientName || "Unknown Client",
                        classification: classification,
                      });
                    }
                  }
                });
              }
            });
          }
        });

        console.log(`📦 Loaded ${entries.length} production entries`);
        setProductionEntries(entries);
      } catch (error) {
        console.error("❌ Error loading production entries:", error);
      } finally {
        setLoading(false);
      }
    };

    loadProductionEntries();
  }, [dateRange]);

  // Process data by day of week
  const weeklyData = useMemo(() => {
    if (!productionEntries.length) return [];

    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayData: { [key: number]: DayOfWeekData } = {};

    // Initialize all days
    for (let i = 0; i < 7; i++) {
      dayData[i] = {
        dayName: dayNames[i],
        dayIndex: i,
        totalProduction: 0,
        mangleProduction: 0,
        dobladoProduction: 0,
        entryCount: 0,
        dates: [],
      };
    }

    // Group entries by day of week
    const entriesByDay: { [key: number]: ProductionEntry[] } = {};
    productionEntries.forEach((entry) => {
      const dayOfWeek = entry.addedAt.getDay();
      if (!entriesByDay[dayOfWeek]) {
        entriesByDay[dayOfWeek] = [];
      }
      entriesByDay[dayOfWeek].push(entry);
      
      // Track unique dates for averaging
      const dateStr = entry.addedAt.toDateString();
      if (!dayData[dayOfWeek].dates.some(d => d.toDateString() === dateStr)) {
        dayData[dayOfWeek].dates.push(new Date(entry.addedAt));
      }
    });

    // Calculate averages for each day
    Object.keys(entriesByDay).forEach((dayOfWeekStr) => {
      const dayOfWeek = parseInt(dayOfWeekStr);
      const entries = entriesByDay[dayOfWeek];
      const uniqueDates = dayData[dayOfWeek].dates.length;
      
      if (uniqueDates > 0) {
        const totalQty = entries.reduce((sum, entry) => sum + entry.quantity, 0);
        const mangleQty = entries
          .filter((entry) => entry.classification === "Mangle")
          .reduce((sum, entry) => sum + entry.quantity, 0);
        const dobladoQty = entries
          .filter((entry) => entry.classification === "Doblado")
          .reduce((sum, entry) => sum + entry.quantity, 0);

        dayData[dayOfWeek] = {
          ...dayData[dayOfWeek],
          totalProduction: Math.round(totalQty / uniqueDates),
          mangleProduction: Math.round(mangleQty / uniqueDates),
          dobladoProduction: Math.round(dobladoQty / uniqueDates),
          entryCount: Math.round(entries.length / uniqueDates),
        };
      }
    });

    return Object.values(dayData).sort((a, b) => a.dayIndex - b.dayIndex);
  }, [productionEntries]);

  // Chart data for visualization
  const chartData = useMemo(() => {
    const labels = weeklyData.map((day) => day.dayName);

    return {
      labels,
      datasets: [
        {
          label: "Total Production Avg",
          data: weeklyData.map((day) => day.totalProduction),
          borderColor: "#3B82F6",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          borderWidth: 3,
          pointRadius: 6,
          pointHoverRadius: 8,
          tension: 0.4,
          fill: chartType === "line",
        },
        {
          label: "Mangle Avg",
          data: weeklyData.map((day) => day.mangleProduction),
          borderColor: "#10B981",
          backgroundColor: "rgba(16, 185, 129, 0.7)",
          borderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
          tension: 0.4,
          fill: false,
        },
        {
          label: "Doblado Avg",
          data: weeklyData.map((day) => day.dobladoProduction),
          borderColor: "#F59E0B",
          backgroundColor: "rgba(245, 158, 11, 0.7)",
          borderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
          tension: 0.4,
          fill: false,
        },
      ],
    };
  }, [weeklyData, chartType]);

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: `Daily Production Averages by Day of Week (${dateRange.start} to ${dateRange.end})`,
        font: {
          size: 16,
          weight: "bold" as const,
        },
        padding: 20,
      },
      legend: {
        position: "top" as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const label = context.dataset.label || "";
            const value = context.parsed.y || 0;
            return `${label}: ${value.toLocaleString()} units/day`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Average Units per Day",
          font: {
            size: 14,
            weight: "bold" as const,
          },
        },
        ticks: {
          callback: function (value: any) {
            return value.toLocaleString();
          },
        },
      },
      x: {
        title: {
          display: true,
          text: "Day of Week",
          font: {
            size: 14,
            weight: "bold" as const,
          },
        },
      },
    },
  };

  if (loading) {
    return (
      <div className="container-fluid py-4">
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "400px" }}>
          <div className="text-center">
            <div className="spinner-border text-primary mb-3" role="status"></div>
            <div>Loading weekly production analytics...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      {/* Header */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h2 className="mb-1">📊 Weekly Production Analytics</h2>
              <p className="text-muted">
                Daily production averages by Mangle, Doblado, and Total production by day of week
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
                <div className="col-md-3">
                  <label className="form-label">Start Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={dateRange.start}
                    onChange={(e) =>
                      setDateRange((prev) => ({ ...prev, start: e.target.value }))
                    }
                  />
                </div>
                <div className="col-md-3">
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
                  <label className="form-label">Chart Type</label>
                  <div className="btn-group w-100" role="group">
                    <button
                      className={`btn ${
                        chartType === "bar" ? "btn-primary" : "btn-outline-primary"
                      }`}
                      onClick={() => setChartType("bar")}
                    >
                      <i className="bi bi-bar-chart me-1"></i>
                      Bar Chart
                    </button>
                    <button
                      className={`btn ${
                        chartType === "line" ? "btn-primary" : "btn-outline-primary"
                      }`}
                      onClick={() => setChartType("line")}
                    >
                      <i className="bi bi-graph-up me-1"></i>
                      Line Chart
                    </button>
                  </div>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Quick Ranges</label>
                  <div className="btn-group w-100" role="group">
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => {
                        const end = new Date();
                        const start = new Date();
                        start.setDate(start.getDate() - 30);
                        setDateRange({
                          start: start.toISOString().slice(0, 10),
                          end: end.toISOString().slice(0, 10),
                        });
                      }}
                    >
                      30d
                    </button>
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => {
                        const end = new Date();
                        const start = new Date();
                        start.setDate(start.getDate() - 90);
                        setDateRange({
                          start: start.toISOString().slice(0, 10),
                          end: end.toISOString().slice(0, 10),
                        });
                      }}
                    >
                      90d
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
        {weeklyData.map((dayData) => (
          <div key={dayData.dayIndex} className="col-lg-1-7 col-md-3 col-sm-6 mb-3" style={{flex: '1 1 14.28%', minWidth: '180px'}}>
            <div className="card h-100">
              <div className="card-body text-center p-3">
                <h6 className="card-title mb-2">{dayData.dayName}</h6>
                <div className="text-primary mb-1">
                  <strong>{dayData.totalProduction.toLocaleString()}</strong>
                </div>
                <small className="text-muted">Total Avg/Day</small>
                <hr className="my-2" />
                <div className="row">
                  <div className="col-6">
                    <div className="text-success small">
                      <strong>{dayData.mangleProduction.toLocaleString()}</strong>
                    </div>
                    <small className="text-muted">Mangle</small>
                  </div>
                  <div className="col-6">
                    <div className="text-warning small">
                      <strong>{dayData.dobladoProduction.toLocaleString()}</strong>
                    </div>
                    <small className="text-muted">Doblado</small>
                  </div>
                </div>
                <small className="text-muted mt-1 d-block">
                  {dayData.dates.length} day{dayData.dates.length !== 1 ? 's' : ''} sampled
                </small>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Chart */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">
                <i className="bi bi-graph-up me-2"></i>
                Weekly Production Pattern Analysis
              </h5>
            </div>
            <div className="card-body">
              {weeklyData.length > 0 ? (
                <div style={{ height: "500px" }}>
                  {chartType === "line" ? (
                    <Line data={chartData} options={chartOptions} />
                  ) : (
                    <Bar data={chartData} options={chartOptions} />
                  )}
                </div>
              ) : (
                <div className="text-center text-muted py-5">
                  <i className="bi bi-graph-up" style={{ fontSize: "3rem", opacity: 0.3 }}></i>
                  <p className="mt-3">No production data found for the selected date range</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">📋 Detailed Weekly Breakdown</h5>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-striped table-hover">
                  <thead className="table-dark">
                    <tr>
                      <th>Day of Week</th>
                      <th className="text-center">Total Avg</th>
                      <th className="text-center">Mangle Avg</th>
                      <th className="text-center">Doblado Avg</th>
                      <th className="text-center">Mangle %</th>
                      <th className="text-center">Doblado %</th>
                      <th className="text-center">Days Sampled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeklyData.map((dayData) => (
                      <tr key={dayData.dayIndex}>
                        <td>
                          <strong>{dayData.dayName}</strong>
                        </td>
                        <td className="text-center">
                          <span className="badge bg-primary fs-6">
                            {dayData.totalProduction.toLocaleString()}
                          </span>
                        </td>
                        <td className="text-center">
                          <span className="badge bg-success fs-6">
                            {dayData.mangleProduction.toLocaleString()}
                          </span>
                        </td>
                        <td className="text-center">
                          <span className="badge bg-warning fs-6">
                            {dayData.dobladoProduction.toLocaleString()}
                          </span>
                        </td>
                        <td className="text-center">
                          <span className="text-success fw-bold">
                            {dayData.totalProduction > 0
                              ? Math.round((dayData.mangleProduction / dayData.totalProduction) * 100)
                              : 0}%
                          </span>
                        </td>
                        <td className="text-center">
                          <span className="text-warning fw-bold">
                            {dayData.totalProduction > 0
                              ? Math.round((dayData.dobladoProduction / dayData.totalProduction) * 100)
                              : 0}%
                          </span>
                        </td>
                        <td className="text-center">
                          <span className="badge bg-info">
                            {dayData.dates.length}
                          </span>
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

      {/* Insights */}
      <div className="row mt-4">
        <div className="col-12">
          <div className="alert alert-info">
            <h6 className="alert-heading mb-2">📊 How to Read This Data</h6>
            <ul className="list-unstyled small mb-0">
              <li className="mb-1">
                <i className="bi bi-graph-up text-primary me-2"></i>
                <strong>Total Production Avg:</strong> Average units processed per day for each day of the week
              </li>
              <li className="mb-1">
                <i className="bi bi-tools text-success me-2"></i>
                <strong>Mangle Avg:</strong> Average Mangle units (sheets, duvets, etc.) per day
              </li>
              <li className="mb-1">
                <i className="bi bi-hand-index text-warning me-2"></i>
                <strong>Doblado Avg:</strong> Average Doblado units (folded items) per day
              </li>
              <li className="mb-1">
                <i className="bi bi-calendar-week text-info me-2"></i>
                <strong>Days Sampled:</strong> Number of actual working days used to calculate the average
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeeklyProductionAnalytics;
