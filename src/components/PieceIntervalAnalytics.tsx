import React, { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, where, orderBy, limit, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import {
  productClassificationService,
  ProductClassification,
} from "../services/ProductClassificationService";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface ProductionEntry {
  id: string;
  invoiceId: string;
  clientId: string;
  clientName: string;
  cartId: string;
  cartName: string;
  productId: string;
  productName: string;
  quantity: number;
  addedAt: Date;
  addedBy: string;
  classification: ProductClassification;
}

interface IntervalData {
  time: string;
  mangleCount: number; // Individual Mangle pieces added at this interval
  dobladoCount: number; // Individual Doblado pieces added at this interval
  cumulativeMangleCount: number; // Running total of Mangle pieces
  cumulativeDobladoCount: number; // Running total of Doblado pieces
  totalCount: number; // Total individual pieces added at this interval
  cumulativeTotalCount: number; // Running total of all pieces
}

interface ClientData {
  clientName: string;
  clientId: string;
  intervals: IntervalData[];
  totalMangleCount: number;
  totalDobladoCount: number;
  totalCount: number;
  totalEntries: number;
}

interface TotalData {
  clientName: string;
  clientId: string;
  intervals: IntervalData[];
  totalMangleCount: number;
  totalDobladoCount: number;
  totalCount: number;
  totalEntries: number;
}

const PieceIntervalAnalytics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [productionEntries, setProductionEntries] = useState<ProductionEntry[]>(
    []
  );
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");
  const [countDisplayMode, setCountDisplayMode] = useState<
    "cumulative" | "individual" | "both"
  >("cumulative");
  const [showTotals, setShowTotals] = useState(true);
  const [isClassificationServiceReady, setIsClassificationServiceReady] =
    useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    // Default to today
    return new Date().toISOString().slice(0, 10);
  });
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30); // Last 30 days for available data
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  });

  // Wait for product classification service to be ready
  useEffect(() => {
    const initializeClassificationService = async () => {
      try {
        await productClassificationService.waitForInitialization();
        setIsClassificationServiceReady(true);
        console.log(
          "🏷️ Product classification service is ready for PieceIntervalAnalytics"
        );
      } catch (error) {
        console.error(
          "🏷️ Failed to initialize product classification service:",
          error
        );
        setIsClassificationServiceReady(true); // Continue with defaults if service fails
      }
    };

    initializeClassificationService();
  }, []);

  // Classification function using Firebase service
  const getClassification = (productName: string): ProductClassification => {
    return productClassificationService.getClassification(productName);
  };

  // Load production entries from invoices with optimized queries
  useEffect(() => {
    const loadProductionEntries = async () => {
      setLoading(true);
      try {
        console.log(
          "📊 Loading production entries for piece interval analysis with date constraints..."
        );

        const startDate = new Date(dateRange.start);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999);

        // Use optimized query with date constraints to reduce data transfer
        const startTimestamp = Timestamp.fromDate(startDate);
        const endTimestamp = Timestamp.fromDate(endDate);

        const invoicesQuery = query(
          collection(db, "invoices"),
          where("createdAt", ">=", startTimestamp),
          where("createdAt", "<=", endTimestamp),
          orderBy("createdAt", "desc"),
          limit(2000) // Safety limit to prevent excessive reads
        );

        console.log(`📊 Querying invoices from ${startDate.toISOString()} to ${endDate.toISOString()}`);
        
        const invoicesSnapshot = await getDocs(invoicesQuery);
        const entries: ProductionEntry[] = [];

        invoicesSnapshot.docs.forEach((doc) => {
          const invoice = doc.data();
          const invoiceId = doc.id;
          const carts = invoice.carts || [];

          carts.forEach((cart: any) => {
            const items = cart.items || [];

            items.forEach((item: any) => {
              if (item.addedAt && item.productName && item.quantity > 0) {
                const addedAt =
                  item.addedAt instanceof Timestamp
                    ? item.addedAt.toDate()
                    : new Date(item.addedAt);

                // Filter by date range
                if (addedAt >= startDate && addedAt <= endDate) {
                  const classification = getClassification(item.productName);

                  entries.push({
                    id: `${invoiceId}_${cart.id}_${
                      item.productId || Math.random()
                    }`,
                    invoiceId,
                    clientId: invoice.clientId || "unknown",
                    clientName: invoice.clientName || "Unknown Client",
                    cartId: cart.id,
                    cartName: cart.name || "Unnamed Cart",
                    productId: item.productId || "unknown",
                    productName: item.productName,
                    quantity: Number(item.quantity) || 0,
                    addedAt,
                    addedBy: item.addedBy || "Unknown",
                    classification,
                  });
                }
              }
            });
          });
        });

        setProductionEntries(entries);
        console.log(
          `📊 Loaded ${entries.length} production entries for analysis`
        );

        // Auto-select top 5 clients by volume if none selected
        if (selectedClients.length === 0) {
          const clientCounts = entries.reduce((acc, entry) => {
            acc[entry.clientId] = (acc[entry.clientId] || 0) + entry.quantity;
            return acc;
          }, {} as { [key: string]: number });

          const topClients = Object.entries(clientCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([clientId]) => clientId);

          setSelectedClients(topClients);
        }
      } catch (error) {
        console.error("Error loading production entries:", error);
      } finally {
        setLoading(false);
      }
    };

    // Only load data when classification service is ready
    if (isClassificationServiceReady) {
      loadProductionEntries();
    }
  }, [dateRange, isClassificationServiceReady]);

  // Get unique clients for selection
  const availableClients = useMemo(() => {
    const clientMap = new Map<string, string>();
    productionEntries.forEach((entry) => {
      clientMap.set(entry.clientId, entry.clientName);
    });
    return Array.from(clientMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [productionEntries]);

  // Process data into 30-minute intervals by client for the selected day
  const processedData = useMemo((): {
    clients: ClientData[];
    totals: TotalData | null;
  } => {
    if (!productionEntries.length || !selectedClients.length)
      return { clients: [], totals: null };

    const clientResults: ClientData[] = [];
    const selectedDateStr = selectedDate;

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
            mangleCount: 0,
            dobladoCount: 0,
            cumulativeMangleCount: 0,
            cumulativeDobladoCount: 0,
            totalCount: 0,
            cumulativeTotalCount: 0,
          });
        }
      }
      return intervals;
    };

    // Process each selected client for the specific selected date
    selectedClients.forEach((clientId) => {
      const clientEntries = productionEntries.filter(
        (entry) =>
          entry.clientId === clientId &&
          entry.addedAt.toISOString().slice(0, 10) === selectedDateStr
      );

      if (clientEntries.length === 0) {
        // Still add the client with empty intervals if they have no data for this day
        const clientName =
          productionEntries.find((e) => e.clientId === clientId)?.clientName ||
          "Unknown Client";
        clientResults.push({
          clientName,
          clientId,
          intervals: generateIntervals(),
          totalMangleCount: 0,
          totalDobladoCount: 0,
          totalCount: 0,
          totalEntries: 0,
        });
        return;
      }

      const clientName = clientEntries[0].clientName;
      const intervals = generateIntervals();

      // Process entries for the selected date only
      clientEntries.forEach((entry) => {
        const hour = entry.addedAt.getHours();
        const minute = entry.addedAt.getMinutes();

        // Find the appropriate 30-minute interval
        const intervalMinute = minute < 30 ? 0 : 30;
        const intervalIndex = hour * 2 + intervalMinute / 30;

        // Add pieces to the appropriate classification
        if (entry.classification === "Mangle") {
          intervals[intervalIndex].mangleCount += entry.quantity;
        } else {
          intervals[intervalIndex].dobladoCount += entry.quantity;
        }
        intervals[intervalIndex].totalCount += entry.quantity;
      });

      // Calculate cumulative counts (running totals throughout the day)
      let cumulativeMangleTotal = 0;
      let cumulativeDobladoTotal = 0;

      intervals.forEach((interval) => {
        cumulativeMangleTotal += interval.mangleCount;
        cumulativeDobladoTotal += interval.dobladoCount;

        interval.cumulativeMangleCount = cumulativeMangleTotal;
        interval.cumulativeDobladoCount = cumulativeDobladoTotal;
        interval.cumulativeTotalCount =
          cumulativeMangleTotal + cumulativeDobladoTotal;
      });

      const totalMangleCount = intervals.reduce(
        (sum, interval) => sum + interval.mangleCount,
        0
      );
      const totalDobladoCount = intervals.reduce(
        (sum, interval) => sum + interval.dobladoCount,
        0
      );
      const totalCount = totalMangleCount + totalDobladoCount;
      const totalEntries = clientEntries.length;

      clientResults.push({
        clientName,
        clientId,
        intervals,
        totalMangleCount,
        totalDobladoCount,
        totalCount,
        totalEntries,
      });
    });

    // Calculate totals across all selected clients
    let totalsData: TotalData | null = null;
    if (clientResults.length > 0 && showTotals) {
      const totalIntervals = generateIntervals();

      // Sum up all client intervals
      clientResults.forEach((client) => {
        client.intervals.forEach((interval, idx) => {
          totalIntervals[idx].mangleCount += interval.mangleCount;
          totalIntervals[idx].dobladoCount += interval.dobladoCount;
          totalIntervals[idx].totalCount += interval.totalCount;
        });
      });

      // Recalculate cumulative totals
      let cumulativeMangleTotal = 0;
      let cumulativeDobladoTotal = 0;

      totalIntervals.forEach((interval) => {
        cumulativeMangleTotal += interval.mangleCount;
        cumulativeDobladoTotal += interval.dobladoCount;

        interval.cumulativeMangleCount = cumulativeMangleTotal;
        interval.cumulativeDobladoCount = cumulativeDobladoTotal;
        interval.cumulativeTotalCount =
          cumulativeMangleTotal + cumulativeDobladoTotal;
      });

      totalsData = {
        clientName: "Total (All Selected Clients)",
        clientId: "TOTAL",
        intervals: totalIntervals,
        totalMangleCount: totalIntervals.reduce(
          (sum, interval) => sum + interval.mangleCount,
          0
        ),
        totalDobladoCount: totalIntervals.reduce(
          (sum, interval) => sum + interval.dobladoCount,
          0
        ),
        totalCount: totalIntervals.reduce(
          (sum, interval) => sum + interval.totalCount,
          0
        ),
        totalEntries: clientResults.reduce(
          (sum, client) => sum + client.totalEntries,
          0
        ),
      };
    }

    return {
      clients: clientResults.sort((a, b) => b.totalCount - a.totalCount),
      totals: totalsData,
    };
  }, [productionEntries, selectedClients, showTotals, selectedDate]);

  // Chart data for line chart
  const chartData = useMemo(() => {
    if (!processedData.clients.length) return { labels: [], datasets: [] };

    const labels =
      processedData.clients[0]?.intervals.map(
        (interval: IntervalData) => interval.time
      ) || [];

    const datasets: any[] = [];
    const colors = [
      "#EF4444",
      "#F97316",
      "#EAB308",
      "#22C55E",
      "#3B82F6",
      "#8B5CF6",
      "#EC4899",
      "#10B981",
      "#F59E0B",
      "#8B5A2B",
      "#6366F1",
      "#EC4899",
    ];

    // Create datasets for client data based on selected display mode
    processedData.clients.forEach((clientData, index) => {
      const baseColor = colors[index % colors.length];

      if (countDisplayMode === "cumulative" || countDisplayMode === "both") {
        // Cumulative Mangle
        datasets.push({
          label: `${clientData.clientName}${
            countDisplayMode === "both" ? " (Mangle - Cumulative)" : " - Mangle"
          }`,
          data: clientData.intervals.map((interval: IntervalData) =>
            Math.round(interval.cumulativeMangleCount)
          ),
          borderColor: baseColor,
          backgroundColor: baseColor + "20",
          tension: 0.4,
          pointRadius: countDisplayMode === "both" ? 1 : 2,
          pointHoverRadius: countDisplayMode === "both" ? 3 : 5,
          borderWidth: 2,
          fill: false,
        });

        // Cumulative Doblado
        datasets.push({
          label: `${clientData.clientName}${
            countDisplayMode === "both"
              ? " (Doblado - Cumulative)"
              : " - Doblado"
          }`,
          data: clientData.intervals.map((interval: IntervalData) =>
            Math.round(interval.cumulativeDobladoCount)
          ),
          borderColor: baseColor + "80",
          backgroundColor: baseColor + "10",
          tension: 0.4,
          pointRadius: countDisplayMode === "both" ? 1 : 2,
          pointHoverRadius: countDisplayMode === "both" ? 3 : 5,
          borderWidth: 2,
          borderDash: [5, 5],
          fill: false,
        });
      }

      if (countDisplayMode === "individual" || countDisplayMode === "both") {
        // Individual Mangle
        datasets.push({
          label: `${clientData.clientName}${
            countDisplayMode === "both" ? " (Mangle - Individual)" : " - Mangle"
          }`,
          data: clientData.intervals.map((interval: IntervalData) =>
            Math.round(interval.mangleCount)
          ),
          borderColor:
            countDisplayMode === "both" ? baseColor + "60" : baseColor,
          backgroundColor: baseColor + "10",
          tension: 0.4,
          pointRadius: countDisplayMode === "both" ? 1 : 2,
          pointHoverRadius: countDisplayMode === "both" ? 3 : 5,
          borderWidth: countDisplayMode === "both" ? 1 : 2,
          borderDash: countDisplayMode === "both" ? [3, 3] : [],
          fill: false,
        });

        // Individual Doblado
        datasets.push({
          label: `${clientData.clientName}${
            countDisplayMode === "both"
              ? " (Doblado - Individual)"
              : " - Doblado"
          }`,
          data: clientData.intervals.map((interval: IntervalData) =>
            Math.round(interval.dobladoCount)
          ),
          borderColor:
            countDisplayMode === "both" ? baseColor + "40" : baseColor + "80",
          backgroundColor: baseColor + "05",
          tension: 0.4,
          pointRadius: countDisplayMode === "both" ? 1 : 2,
          pointHoverRadius: countDisplayMode === "both" ? 3 : 5,
          borderWidth: countDisplayMode === "both" ? 1 : 2,
          borderDash: countDisplayMode === "both" ? [1, 1] : [5, 5],
          fill: false,
        });
      }
    });

    // Add totals dataset if enabled
    if (showTotals && processedData.totals) {
      const totalsData = processedData.totals;
      const totalsColor = "#6B7280"; // Gray color for totals

      if (countDisplayMode === "cumulative" || countDisplayMode === "both") {
        // Total Cumulative Mangle
        datasets.push({
          label: `${totalsData.clientName}${
            countDisplayMode === "both" ? " (Mangle - Cumulative)" : " - Mangle"
          }`,
          data: totalsData.intervals.map((interval: IntervalData) =>
            Math.round(interval.cumulativeMangleCount)
          ),
          borderColor: totalsColor,
          backgroundColor: totalsColor + "20",
          tension: 0.4,
          pointRadius: countDisplayMode === "both" ? 2 : 3,
          pointHoverRadius: countDisplayMode === "both" ? 4 : 6,
          borderWidth: 3,
          fill: false,
        });

        // Total Cumulative Doblado
        datasets.push({
          label: `${totalsData.clientName}${
            countDisplayMode === "both"
              ? " (Doblado - Cumulative)"
              : " - Doblado"
          }`,
          data: totalsData.intervals.map((interval: IntervalData) =>
            Math.round(interval.cumulativeDobladoCount)
          ),
          borderColor: totalsColor + "80",
          backgroundColor: totalsColor + "10",
          tension: 0.4,
          pointRadius: countDisplayMode === "both" ? 2 : 3,
          pointHoverRadius: countDisplayMode === "both" ? 4 : 6,
          borderWidth: 3,
          borderDash: [8, 4],
          fill: false,
        });
      }

      if (countDisplayMode === "individual" || countDisplayMode === "both") {
        // Total Individual Mangle
        datasets.push({
          label: `${totalsData.clientName}${
            countDisplayMode === "both" ? " (Mangle - Individual)" : " - Mangle"
          }`,
          data: totalsData.intervals.map((interval: IntervalData) =>
            Math.round(interval.mangleCount)
          ),
          borderColor:
            countDisplayMode === "both" ? totalsColor + "60" : totalsColor,
          backgroundColor: totalsColor + "10",
          tension: 0.4,
          pointRadius: countDisplayMode === "both" ? 2 : 3,
          pointHoverRadius: countDisplayMode === "both" ? 4 : 6,
          borderWidth: countDisplayMode === "both" ? 2 : 3,
          borderDash: countDisplayMode === "both" ? [4, 2] : [],
          fill: false,
        });

        // Total Individual Doblado
        datasets.push({
          label: `${totalsData.clientName}${
            countDisplayMode === "both"
              ? " (Doblado - Individual)"
              : " - Doblado"
          }`,
          data: totalsData.intervals.map((interval: IntervalData) =>
            Math.round(interval.dobladoCount)
          ),
          borderColor:
            countDisplayMode === "both"
              ? totalsColor + "40"
              : totalsColor + "80",
          backgroundColor: totalsColor + "05",
          tension: 0.4,
          pointRadius: countDisplayMode === "both" ? 2 : 3,
          pointHoverRadius: countDisplayMode === "both" ? 4 : 6,
          borderWidth: countDisplayMode === "both" ? 2 : 3,
          borderDash: countDisplayMode === "both" ? [2, 1] : [8, 4],
          fill: false,
        });
      }
    }

    return { labels, datasets };
  }, [processedData, countDisplayMode, showTotals]);

  // Handle client selection
  const handleClientToggle = (clientId: string) => {
    setSelectedClients((prev) =>
      prev.includes(clientId)
        ? prev.filter((c) => c !== clientId)
        : [...prev, clientId]
    );
  };

  const handleSelectAllClients = () => {
    setSelectedClients(availableClients.map((c) => c.id));
  };

  const handleClearAllClients = () => {
    setSelectedClients([]);
  };

  if (loading) {
    return (
      <div className="container py-4">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <div className="mt-2">Loading piece interval analytics...</div>
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
                <i className="bi bi-boxes me-2"></i>
                Daily Piece Interval Analytics (Mangle vs Doblado)
              </h2>
              <p className="text-muted mb-0">
                Real-time piece counts by client in 30-minute intervals for a
                specific day. Shows actual piece production (Mangle vs Doblado)
                throughout the selected day.
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
                  <label className="form-label">Date to View</label>
                  <div className="input-group">
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => {
                        const prevDate = new Date(selectedDate);
                        prevDate.setDate(prevDate.getDate() - 1);
                        setSelectedDate(prevDate.toISOString().slice(0, 10));
                      }}
                      title="Previous day"
                    >
                      <i className="bi bi-chevron-left"></i>
                    </button>
                    <input
                      type="date"
                      className="form-control"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      min={dateRange.start}
                      max={dateRange.end}
                    />
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() =>
                        setSelectedDate(new Date().toISOString().slice(0, 10))
                      }
                      title="Today"
                    >
                      Today
                    </button>
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => {
                        const nextDate = new Date(selectedDate);
                        nextDate.setDate(nextDate.getDate() + 1);
                        setSelectedDate(nextDate.toISOString().slice(0, 10));
                      }}
                      title="Next day"
                    >
                      <i className="bi bi-chevron-right"></i>
                    </button>
                  </div>
                  <small className="text-muted">Select specific day</small>
                </div>
                <div className="col-md-1">
                  <label className="form-label">Data Range</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={dateRange.start}
                    onChange={(e) =>
                      setDateRange((prev) => ({
                        ...prev,
                        start: e.target.value,
                      }))
                    }
                    title="Start of available data range"
                  />
                </div>
                <div className="col-md-1">
                  <label className="form-label">&nbsp;</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={dateRange.end}
                    onChange={(e) =>
                      setDateRange((prev) => ({ ...prev, end: e.target.value }))
                    }
                    title="End of available data range"
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label">Count Display</label>
                  <div className="btn-group w-100" role="group">
                    <button
                      className={`btn btn-sm ${
                        countDisplayMode === "cumulative"
                          ? "btn-primary"
                          : "btn-outline-primary"
                      }`}
                      onClick={() => setCountDisplayMode("cumulative")}
                      title="Show cumulative piece count (running total)"
                    >
                      Cumulative
                    </button>
                    <button
                      className={`btn btn-sm ${
                        countDisplayMode === "individual"
                          ? "btn-primary"
                          : "btn-outline-primary"
                      }`}
                      onClick={() => setCountDisplayMode("individual")}
                      title="Show individual pieces per interval"
                    >
                      Individual
                    </button>
                    <button
                      className={`btn btn-sm ${
                        countDisplayMode === "both"
                          ? "btn-primary"
                          : "btn-outline-primary"
                      }`}
                      onClick={() => setCountDisplayMode("both")}
                      title="Show both cumulative and individual counts"
                    >
                      Both
                    </button>
                  </div>
                </div>
                <div className="col-md-4">
                  <label className="form-label">
                    Clients to Include
                    <span className="text-muted ms-2">
                      ({selectedClients.length} selected)
                    </span>
                  </label>
                  <div className="d-flex gap-2 mb-2">
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={handleSelectAllClients}
                    >
                      Select All
                    </button>
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={handleClearAllClients}
                    >
                      Clear All
                    </button>
                  </div>
                  <div
                    className="d-flex flex-wrap gap-2 max-height-scroll"
                    style={{ maxHeight: "100px", overflowY: "auto" }}
                  >
                    {availableClients.map((client) => (
                      <button
                        key={client.id}
                        className={`btn btn-sm ${
                          selectedClients.includes(client.id)
                            ? "btn-primary"
                            : "btn-outline-primary"
                        }`}
                        onClick={() => handleClientToggle(client.id)}
                        title={client.name}
                      >
                        {client.name.length > 20
                          ? client.name.slice(0, 20) + "..."
                          : client.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="col-md-2">
                  <label className="form-label">Show Totals</label>
                  <div className="form-check form-switch mt-2">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="showTotalsSwitch"
                      checked={showTotals}
                      onChange={(e) => setShowTotals(e.target.checked)}
                    />
                    <label
                      className="form-check-label"
                      htmlFor="showTotalsSwitch"
                    >
                      All Selected Clients
                    </label>
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
        {processedData.clients.slice(0, 6).map((clientData) => (
          <div
            key={clientData.clientId}
            className="col-lg-2 col-md-4 col-sm-6 mb-3"
          >
            <div className="card h-100">
              <div className="card-body text-center p-3">
                <h6 className="card-title mb-1" title={clientData.clientName}>
                  {clientData.clientName.length > 15
                    ? clientData.clientName.slice(0, 15) + "..."
                    : clientData.clientName}
                </h6>
                <div className="row">
                  <div className="col-6">
                    <div className="text-success mb-1">
                      <strong>
                        {Math.round(
                          clientData.totalMangleCount
                        ).toLocaleString()}
                      </strong>
                    </div>
                    <small className="text-muted">Mangle</small>
                  </div>
                  <div className="col-6">
                    <div className="text-warning mb-1">
                      <strong>
                        {Math.round(
                          clientData.totalDobladoCount
                        ).toLocaleString()}
                      </strong>
                    </div>
                    <small className="text-muted">Doblado</small>
                  </div>
                </div>
                <hr className="my-2" />
                <small className="text-muted">
                  {clientData.totalEntries.toLocaleString()} entries
                </small>
              </div>
            </div>
          </div>
        ))}
        {/* Add totals summary card if enabled */}
        {showTotals && processedData.totals && (
          <div className="col-lg-2 col-md-4 col-sm-6 mb-3">
            <div className="card h-100 border-secondary">
              <div className="card-body text-center p-3">
                <h6
                  className="card-title mb-1 text-secondary"
                  title={processedData.totals.clientName}
                >
                  <strong>TOTALS</strong>
                </h6>
                <div className="row">
                  <div className="col-6">
                    <div className="text-success mb-1">
                      <strong>
                        {Math.round(
                          processedData.totals.totalMangleCount
                        ).toLocaleString()}
                      </strong>
                    </div>
                    <small className="text-muted">Mangle</small>
                  </div>
                  <div className="col-6">
                    <div className="text-warning mb-1">
                      <strong>
                        {Math.round(
                          processedData.totals.totalDobladoCount
                        ).toLocaleString()}
                      </strong>
                    </div>
                    <small className="text-muted">Doblado</small>
                  </div>
                </div>
                <hr className="my-2" />
                <small className="text-muted">
                  {processedData.totals.totalEntries.toLocaleString()} entries
                </small>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chart View */}
      {viewMode === "chart" && (
        <div className="row mb-4">
          <div className="col-12">
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">
                  <i className="bi bi-graph-up me-2"></i>
                  Daily Piece Count by 30-Minute Intervals for {
                    selectedDate
                  }{" "}
                  (Mangle vs Doblado)
                </h5>
              </div>
              <div className="card-body">
                {chartData.datasets.length > 0 ? (
                  <div style={{ height: "600px" }}>
                    <Line
                      data={chartData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          title: {
                            display: true,
                            text: `${
                              countDisplayMode === "cumulative"
                                ? "Cumulative Piece Count Throughout the Day"
                                : countDisplayMode === "individual"
                                ? "Individual Piece Count by 30-Minute Intervals"
                                : "Individual and Cumulative Piece Count Throughout the Day"
                            } (30-minute intervals)`,
                          },
                          legend: {
                            position: "top" as const,
                            labels: {
                              usePointStyle: true,
                              boxWidth: 6,
                            },
                          },
                          tooltip: {
                            callbacks: {
                              label: function (context) {
                                const label = context.dataset.label || "";
                                const value = context.parsed.y.toLocaleString();
                                return `${label}: ${value} pieces`;
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
                                countDisplayMode === "cumulative"
                                  ? "Cumulative Pieces"
                                  : countDisplayMode === "individual"
                                  ? "Individual Pieces"
                                  : "Piece Count"
                              }`,
                            },
                            ticks: {
                              callback: function (value) {
                                return (value as number).toLocaleString();
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
                      className="bi bi-boxes"
                      style={{ fontSize: "3rem", opacity: 0.3 }}
                    ></i>
                    <p className="mt-2">
                      No data available for the selected criteria
                    </p>
                    <p className="small">
                      Try selecting different clients or adjusting the date
                      range
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
                  Daily Piece Interval Data for {selectedDate} (Mangle vs
                  Doblado)
                </h5>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-striped table-hover mb-0">
                    <thead className="table-dark">
                      <tr>
                        <th rowSpan={countDisplayMode === "both" ? 2 : 1}>
                          Time
                        </th>
                        {processedData.clients.map((clientData) => (
                          <th
                            key={clientData.clientId}
                            className="text-center"
                            colSpan={
                              countDisplayMode === "both"
                                ? 4
                                : countDisplayMode === "individual"
                                ? 2
                                : 2
                            }
                          >
                            {clientData.clientName}
                          </th>
                        ))}
                        {/* Add totals column header if enabled */}
                        {showTotals && processedData.totals && (
                          <th
                            className="text-center table-secondary"
                            colSpan={
                              countDisplayMode === "both"
                                ? 4
                                : countDisplayMode === "individual"
                                ? 2
                                : 2
                            }
                          >
                            <strong>TOTALS (All Selected)</strong>
                          </th>
                        )}
                      </tr>
                      <tr>
                        {processedData.clients.map((clientData) => (
                          <React.Fragment key={clientData.clientId}>
                            {countDisplayMode === "both" ? (
                              <>
                                <th className="text-center small">M (Ind)</th>
                                <th className="text-center small">D (Ind)</th>
                                <th className="text-center small">M (Cum)</th>
                                <th className="text-center small">D (Cum)</th>
                              </>
                            ) : countDisplayMode === "individual" ? (
                              <>
                                <th className="text-center small">Mangle</th>
                                <th className="text-center small">Doblado</th>
                              </>
                            ) : (
                              <>
                                <th className="text-center small">Mangle</th>
                                <th className="text-center small">Doblado</th>
                              </>
                            )}
                          </React.Fragment>
                        ))}
                        {/* Add totals column headers if enabled */}
                        {showTotals && processedData.totals && (
                          <React.Fragment>
                            {countDisplayMode === "both" ? (
                              <>
                                <th className="text-center small table-secondary">
                                  M (Ind)
                                </th>
                                <th className="text-center small table-secondary">
                                  D (Ind)
                                </th>
                                <th className="text-center small table-secondary">
                                  M (Cum)
                                </th>
                                <th className="text-center small table-secondary">
                                  D (Cum)
                                </th>
                              </>
                            ) : countDisplayMode === "individual" ? (
                              <>
                                <th className="text-center small table-secondary">
                                  Mangle
                                </th>
                                <th className="text-center small table-secondary">
                                  Doblado
                                </th>
                              </>
                            ) : (
                              <>
                                <th className="text-center small table-secondary">
                                  Mangle
                                </th>
                                <th className="text-center small table-secondary">
                                  Doblado
                                </th>
                              </>
                            )}
                          </React.Fragment>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {processedData.clients[0]?.intervals.map(
                        (_, intervalIndex) => (
                          <tr key={intervalIndex}>
                            <td className="fw-bold">
                              {
                                processedData.clients[0].intervals[
                                  intervalIndex
                                ].time
                              }
                            </td>
                            {processedData.clients.map((clientData) => {
                              const interval =
                                clientData.intervals[intervalIndex];
                              const indMangleCount = Math.round(
                                interval.mangleCount
                              );
                              const indDobladoCount = Math.round(
                                interval.dobladoCount
                              );
                              const cumMangleCount = Math.round(
                                interval.cumulativeMangleCount
                              );
                              const cumDobladoCount = Math.round(
                                interval.cumulativeDobladoCount
                              );

                              return (
                                <React.Fragment key={clientData.clientId}>
                                  {countDisplayMode === "both" ? (
                                    <>
                                      <td className="text-center">
                                        {indMangleCount > 0 ? (
                                          <span className="badge bg-success">
                                            {indMangleCount.toLocaleString()}
                                          </span>
                                        ) : (
                                          <span className="text-muted">-</span>
                                        )}
                                      </td>
                                      <td className="text-center">
                                        {indDobladoCount > 0 ? (
                                          <span className="badge bg-warning text-dark">
                                            {indDobladoCount.toLocaleString()}
                                          </span>
                                        ) : (
                                          <span className="text-muted">-</span>
                                        )}
                                      </td>
                                      <td className="text-center">
                                        {cumMangleCount > 0 ? (
                                          <span className="badge bg-primary">
                                            {cumMangleCount.toLocaleString()}
                                          </span>
                                        ) : (
                                          <span className="text-muted">-</span>
                                        )}
                                      </td>
                                      <td className="text-center">
                                        {cumDobladoCount > 0 ? (
                                          <span className="badge bg-info">
                                            {cumDobladoCount.toLocaleString()}
                                          </span>
                                        ) : (
                                          <span className="text-muted">-</span>
                                        )}
                                      </td>
                                    </>
                                  ) : countDisplayMode === "individual" ? (
                                    <>
                                      <td className="text-center">
                                        {indMangleCount > 0 ? (
                                          <span className="badge bg-success">
                                            {indMangleCount.toLocaleString()}
                                          </span>
                                        ) : (
                                          <span className="text-muted">-</span>
                                        )}
                                      </td>
                                      <td className="text-center">
                                        {indDobladoCount > 0 ? (
                                          <span className="badge bg-warning text-dark">
                                            {indDobladoCount.toLocaleString()}
                                          </span>
                                        ) : (
                                          <span className="text-muted">-</span>
                                        )}
                                      </td>
                                    </>
                                  ) : (
                                    <>
                                      <td className="text-center">
                                        {cumMangleCount > 0 ? (
                                          <span className="badge bg-success">
                                            {cumMangleCount.toLocaleString()}
                                          </span>
                                        ) : (
                                          <span className="text-muted">-</span>
                                        )}
                                      </td>
                                      <td className="text-center">
                                        {cumDobladoCount > 0 ? (
                                          <span className="badge bg-warning text-dark">
                                            {cumDobladoCount.toLocaleString()}
                                          </span>
                                        ) : (
                                          <span className="text-muted">-</span>
                                        )}
                                      </td>
                                    </>
                                  )}
                                </React.Fragment>
                              );
                            })}
                            {/* Add totals column data if enabled */}
                            {showTotals && processedData.totals && (
                              <React.Fragment>
                                {(() => {
                                  const totalsInterval =
                                    processedData.totals.intervals[
                                      intervalIndex
                                    ];
                                  const indMangleCount = Math.round(
                                    totalsInterval.mangleCount
                                  );
                                  const indDobladoCount = Math.round(
                                    totalsInterval.dobladoCount
                                  );
                                  const cumMangleCount = Math.round(
                                    totalsInterval.cumulativeMangleCount
                                  );
                                  const cumDobladoCount = Math.round(
                                    totalsInterval.cumulativeDobladoCount
                                  );

                                  return countDisplayMode === "both" ? (
                                    <>
                                      <td className="text-center table-secondary">
                                        {indMangleCount > 0 ? (
                                          <span className="badge bg-success">
                                            <strong>
                                              {indMangleCount.toLocaleString()}
                                            </strong>
                                          </span>
                                        ) : (
                                          <span className="text-muted">-</span>
                                        )}
                                      </td>
                                      <td className="text-center table-secondary">
                                        {indDobladoCount > 0 ? (
                                          <span className="badge bg-warning text-dark">
                                            <strong>
                                              {indDobladoCount.toLocaleString()}
                                            </strong>
                                          </span>
                                        ) : (
                                          <span className="text-muted">-</span>
                                        )}
                                      </td>
                                      <td className="text-center table-secondary">
                                        {cumMangleCount > 0 ? (
                                          <span className="badge bg-primary">
                                            <strong>
                                              {cumMangleCount.toLocaleString()}
                                            </strong>
                                          </span>
                                        ) : (
                                          <span className="text-muted">-</span>
                                        )}
                                      </td>
                                      <td className="text-center table-secondary">
                                        {cumDobladoCount > 0 ? (
                                          <span className="badge bg-info">
                                            <strong>
                                              {cumDobladoCount.toLocaleString()}
                                            </strong>
                                          </span>
                                        ) : (
                                          <span className="text-muted">-</span>
                                        )}
                                      </td>
                                    </>
                                  ) : countDisplayMode === "individual" ? (
                                    <>
                                      <td className="text-center table-secondary">
                                        {indMangleCount > 0 ? (
                                          <span className="badge bg-success">
                                            <strong>
                                              {indMangleCount.toLocaleString()}
                                            </strong>
                                          </span>
                                        ) : (
                                          <span className="text-muted">-</span>
                                        )}
                                      </td>
                                      <td className="text-center table-secondary">
                                        {indDobladoCount > 0 ? (
                                          <span className="badge bg-warning text-dark">
                                            <strong>
                                              {indDobladoCount.toLocaleString()}
                                            </strong>
                                          </span>
                                        ) : (
                                          <span className="text-muted">-</span>
                                        )}
                                      </td>
                                    </>
                                  ) : (
                                    <>
                                      <td className="text-center table-secondary">
                                        {cumMangleCount > 0 ? (
                                          <span className="badge bg-success">
                                            <strong>
                                              {cumMangleCount.toLocaleString()}
                                            </strong>
                                          </span>
                                        ) : (
                                          <span className="text-muted">-</span>
                                        )}
                                      </td>
                                      <td className="text-center table-secondary">
                                        {cumDobladoCount > 0 ? (
                                          <span className="badge bg-warning text-dark">
                                            <strong>
                                              {cumDobladoCount.toLocaleString()}
                                            </strong>
                                          </span>
                                        ) : (
                                          <span className="text-muted">-</span>
                                        )}
                                      </td>
                                    </>
                                  );
                                })()}
                              </React.Fragment>
                            )}
                          </tr>
                        )
                      )}
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
                <div className="col-md-2">
                  <h4 className="text-primary">
                    {productionEntries
                      .filter(
                        (e) =>
                          e.addedAt.toISOString().slice(0, 10) === selectedDate
                      )
                      .length.toLocaleString()}
                  </h4>
                  <p className="mb-0">Production Entries</p>
                  <small className="text-muted">{selectedDate}</small>
                </div>
                <div className="col-md-2">
                  <h4 className="text-success">
                    {Math.round(
                      productionEntries
                        .filter(
                          (e) =>
                            e.addedAt.toISOString().slice(0, 10) ===
                              selectedDate && e.classification === "Mangle"
                        )
                        .reduce((sum, e) => sum + e.quantity, 0)
                    ).toLocaleString()}
                  </h4>
                  <p className="mb-0">Mangle Pieces</p>
                  <small className="text-muted">Selected date</small>
                </div>
                <div className="col-md-2">
                  <h4 className="text-warning">
                    {Math.round(
                      productionEntries
                        .filter(
                          (e) =>
                            e.addedAt.toISOString().slice(0, 10) ===
                              selectedDate && e.classification === "Doblado"
                        )
                        .reduce((sum, e) => sum + e.quantity, 0)
                    ).toLocaleString()}
                  </h4>
                  <p className="mb-0">Doblado Pieces</p>
                  <small className="text-muted">Selected date</small>
                </div>
                <div className="col-md-2">
                  <h4 className="text-info">
                    {Math.round(
                      productionEntries
                        .filter(
                          (e) =>
                            e.addedAt.toISOString().slice(0, 10) ===
                            selectedDate
                        )
                        .reduce((sum, e) => sum + e.quantity, 0)
                    ).toLocaleString()}
                  </h4>
                  <p className="mb-0">Total Pieces</p>
                  <small className="text-muted">Selected date</small>
                </div>
                <div className="col-md-2">
                  <h4 className="text-secondary">{selectedClients.length}</h4>
                  <p className="mb-0">Clients Selected</p>
                  <small className="text-muted">
                    Out of {availableClients.length} available
                  </small>
                </div>
                <div className="col-md-2">
                  <h4 className="text-dark">
                    {(() => {
                      const dayEntries = productionEntries.filter(
                        (e) =>
                          e.addedAt.toISOString().slice(0, 10) === selectedDate
                      );
                      return dayEntries.length > 0
                        ? Math.round(
                            dayEntries.reduce((sum, e) => sum + e.quantity, 0) /
                              dayEntries.length
                          )
                        : 0;
                    })()}
                  </h4>
                  <p className="mb-0">Avg Pieces per Entry</p>
                  <small className="text-muted">Selected date</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PieceIntervalAnalytics;
