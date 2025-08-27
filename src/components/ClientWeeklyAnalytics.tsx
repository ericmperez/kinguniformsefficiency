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
  clientId: string;
  clientName: string;
  classification: "Mangle" | "Doblado";
}

interface ClientDayData {
  dayName: string;
  dayIndex: number;
  totalAvg: number;
  mangleAvg: number;
  dobladoAvg: number;
  entryCount: number;
  uniqueDates: number;
}

interface ClientWeeklyData {
  clientId: string;
  clientName: string;
  dayData: ClientDayData[];
  totalItems: number;
  totalMangle: number;
  totalDoblado: number;
  averageDailyItems: number;
}

const ClientWeeklyAnalytics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [productionEntries, setProductionEntries] = useState<ProductionEntry[]>([]);
  const [clientsData, setClientsData] = useState<ClientWeeklyData[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 90); // Last 90 days by default for better averages
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  });
  const [chartType, setChartType] = useState<"line" | "bar">("bar");
  const [viewMode, setViewMode] = useState<"chart" | "table">("table");
  const [showType, setShowType] = useState<"total" | "mangle" | "doblado">("total");
  const [debugInfo, setDebugInfo] = useState<{
    totalInvoices: number;
    totalInDatabase: number;
    dateRangeIssue: boolean;
    sampleDates: string[];
  }>({
    totalInvoices: 0,
    totalInDatabase: 0,
    dateRangeIssue: false,
    sampleDates: []
  });

  // Load production entries data
  useEffect(() => {
    const loadProductionEntries = async () => {
      setLoading(true);
      try {
        console.log("📊 Loading client production entries for weekly analysis...");
        console.log("🔍 Date range:", { start: dateRange.start, end: dateRange.end });

        const startDate = new Date(dateRange.start);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999);

        console.log("🔍 Parsed dates:", { startDate, endDate });

        // Query invoices within date range
        console.log("🔍 Attempting query with date range...");
        let invoicesQuery = query(
          collection(db, "invoices"),
          where("date", ">=", Timestamp.fromDate(startDate)),
          where("date", "<=", Timestamp.fromDate(endDate))
        );

        console.log("🔍 Executing Firestore query...");
        let invoicesSnapshot = await getDocs(invoicesQuery);
        console.log(`📄 Found ${invoicesSnapshot.docs.length} invoices in date range`);
        
        // If no invoices found in date range, try without date filter to see if there's any data
        if (invoicesSnapshot.docs.length === 0) {
          console.log("🔍 No invoices in date range, checking all invoices...");
          const allInvoicesQuery = query(collection(db, "invoices"));
          const allInvoicesSnapshot = await getDocs(allInvoicesQuery);
          console.log(`📄 Total invoices in database: ${allInvoicesSnapshot.docs.length}`);
          
          // Update debug info
          const sampleDates = allInvoicesSnapshot.docs.slice(0, 10).map(doc => {
            const invoice = doc.data();
            return invoice.date?.toDate ? invoice.date.toDate().toISOString().slice(0, 10) : 'No date';
          });
          
          setDebugInfo({
            totalInvoices: invoicesSnapshot.docs.length,
            totalInDatabase: allInvoicesSnapshot.docs.length,
            dateRangeIssue: allInvoicesSnapshot.docs.length > 0,
            sampleDates
          });
          
          if (allInvoicesSnapshot.docs.length > 0) {
            // Log sample invoice dates to understand the data structure
            const sampleInvoices = allInvoicesSnapshot.docs.slice(0, 3);
            console.log("📅 Sample invoice dates:");
            sampleInvoices.forEach((doc, idx) => {
              const invoice = doc.data();
              console.log(`Invoice ${idx + 1}:`, {
                id: doc.id,
                date: invoice.date,
                dateType: typeof invoice.date,
                convertedDate: invoice.date?.toDate ? invoice.date.toDate() : new Date(invoice.date),
                clientName: invoice.clientName
              });
            });
            
            // Use broader date range or all invoices for now
            console.log("🔧 Using all invoices due to no data in specified range");
            invoicesSnapshot = allInvoicesSnapshot;
          } else {
            setDebugInfo({
              totalInvoices: 0,
              totalInDatabase: 0,
              dateRangeIssue: false,
              sampleDates: []
            });
          }
        } else {
          // Update debug info for successful query
          setDebugInfo({
            totalInvoices: invoicesSnapshot.docs.length,
            totalInDatabase: invoicesSnapshot.docs.length,
            dateRangeIssue: false,
            sampleDates: []
          });
        }
        
        const entries: ProductionEntry[] = [];

        // Wait for classification service to initialize
        console.log("⏳ Waiting for classification service...");
        await productClassificationService.waitForInitialization();
        console.log("✅ Classification service ready");

        let processedInvoices = 0;
        let processedCarts = 0;
        let processedItems = 0;
        let validEntries = 0;

        invoicesSnapshot.docs.forEach((doc) => {
          const invoice = doc.data();
          const invoiceDate = invoice.date?.toDate() || new Date();
          processedInvoices++;

          console.log(`📋 Processing invoice ${processedInvoices}:`, {
            id: doc.id,
            clientId: invoice.clientId,
            clientName: invoice.clientName,
            date: invoiceDate,
            cartsCount: invoice.carts?.length || 0
          });

          // Process all items in all carts
          if (invoice.carts && Array.isArray(invoice.carts)) {
            invoice.carts.forEach((cart: any) => {
              processedCarts++;
              if (cart.items && Array.isArray(cart.items)) {
                cart.items.forEach((item: any) => {
                  processedItems++;
                  
                  console.log(`🔍 Processing item ${processedItems}:`, {
                    productName: item.productName,
                    quantity: item.quantity,
                    addedAt: item.addedAt,
                    hasValidData: !!(
                      item.productName &&
                      item.quantity &&
                      Number(item.quantity) > 0 &&
                      !item.productName.toLowerCase().includes("unknown") &&
                      item.addedAt &&
                      invoice.clientId &&
                      invoice.clientName
                    )
                  });

                  // Only include items with valid production data
                  if (
                    item.productName &&
                    item.quantity &&
                    Number(item.quantity) > 0 &&
                    !item.productName.toLowerCase().includes("unknown") &&
                    item.addedAt &&
                    invoice.clientId &&
                    invoice.clientName
                  ) {
                    const addedAt = item.addedAt.toDate ? item.addedAt.toDate() : new Date(item.addedAt);
                    
                    // Check if item was added within our date range
                    if (addedAt >= startDate && addedAt <= endDate) {
                      const classification = productClassificationService.getClassification(item.productName);
                      
                      validEntries++;
                      console.log(`✅ Valid entry ${validEntries}:`, {
                        productName: item.productName,
                        quantity: Number(item.quantity),
                        addedAt,
                        clientName: invoice.clientName,
                        classification
                      });
                      
                      entries.push({
                        id: `${doc.id}-${cart.id}-${item.idx || Date.now()}`,
                        productName: item.productName,
                        quantity: Number(item.quantity),
                        addedAt: addedAt,
                        clientId: invoice.clientId,
                        clientName: invoice.clientName,
                        classification: classification,
                      });
                    } else {
                      console.log(`❌ Item outside date range:`, {
                        addedAt,
                        startDate,
                        endDate
                      });
                    }
                  }
                });
              }
            });
          }
        });

        console.log(`📊 Processing summary:`, {
          processedInvoices,
          processedCarts,
          processedItems,
          validEntries,
          finalEntriesCount: entries.length
        });

        console.log(`📦 Loaded ${entries.length} production entries for client analysis`);
        
        if (entries.length === 0) {
          console.log("⚠️ No entries found. Debugging info:");
          console.log("- Date range:", { start: dateRange.start, end: dateRange.end });
          console.log("- Invoices in range:", invoicesSnapshot.docs.length);
          
          // Log a sample invoice for debugging
          if (invoicesSnapshot.docs.length > 0) {
            const sampleInvoice = invoicesSnapshot.docs[0].data();
            console.log("Sample invoice:", {
              id: invoicesSnapshot.docs[0].id,
              clientId: sampleInvoice.clientId,
              clientName: sampleInvoice.clientName,
              date: sampleInvoice.date,
              carts: sampleInvoice.carts?.length || 0
            });
            
            if (sampleInvoice.carts?.length > 0) {
              const sampleCart = sampleInvoice.carts[0];
              console.log("Sample cart:", {
                id: sampleCart.id,
                items: sampleCart.items?.length || 0
              });
              
              if (sampleCart.items?.length > 0) {
                const sampleItem = sampleCart.items[0];
                console.log("Sample item:", {
                  productName: sampleItem.productName,
                  quantity: sampleItem.quantity,
                  addedAt: sampleItem.addedAt
                });
              }
            }
          }
        }
        
        setProductionEntries(entries);
      } catch (error) {
        console.error("❌ Error loading production entries:", error);
      } finally {
        setLoading(false);
      }
    };

    loadProductionEntries();
  }, [dateRange]);

  // Process data by client and day of week
  const processedClientsData = useMemo(() => {
    console.log("🔄 Processing client data, entries count:", productionEntries.length);
    
    if (!productionEntries.length) {
      console.log("❌ No production entries available for processing");
      return [];
    }

    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const clientsMap: { [clientId: string]: ClientWeeklyData } = {};

    console.log("👥 Grouping entries by client...");

    // Group entries by client
    productionEntries.forEach((entry) => {
      if (!clientsMap[entry.clientId]) {
        // Initialize client data
        clientsMap[entry.clientId] = {
          clientId: entry.clientId,
          clientName: entry.clientName,
          dayData: dayNames.map((dayName, index) => ({
            dayName,
            dayIndex: index,
            totalAvg: 0,
            mangleAvg: 0,
            dobladoAvg: 0,
            entryCount: 0,
            uniqueDates: 0,
          })),
          totalItems: 0,
          totalMangle: 0,
          totalDoblado: 0,
          averageDailyItems: 0,
        };
      }
    });

    console.log(`📊 Found ${Object.keys(clientsMap).length} unique clients:`, Object.keys(clientsMap).map(id => clientsMap[id].clientName));

    // Process entries for each client
    Object.keys(clientsMap).forEach((clientId) => {
      const clientEntries = productionEntries.filter((entry) => entry.clientId === clientId);
      const client = clientsMap[clientId];

      // Track unique dates per day of week for averaging
      const datesByDay: { [day: number]: Set<string> } = {};
      const itemsByDay: { [day: number]: { total: number; mangle: number; doblado: number } } = {};

      // Initialize tracking structures
      for (let i = 0; i < 7; i++) {
        datesByDay[i] = new Set();
        itemsByDay[i] = { total: 0, mangle: 0, doblado: 0 };
      }

      // Process each entry
      clientEntries.forEach((entry) => {
        const dayOfWeek = entry.addedAt.getDay();
        const dateStr = entry.addedAt.toISOString().slice(0, 10);
        
        // Track unique dates
        datesByDay[dayOfWeek].add(dateStr);
        
        // Sum quantities
        itemsByDay[dayOfWeek].total += entry.quantity;
        if (entry.classification === "Mangle") {
          itemsByDay[dayOfWeek].mangle += entry.quantity;
        } else {
          itemsByDay[dayOfWeek].doblado += entry.quantity;
        }
      });

      // Calculate averages
      client.dayData.forEach((dayData, dayIndex) => {
        const uniqueDates = datesByDay[dayIndex].size;
        dayData.uniqueDates = uniqueDates;
        
        if (uniqueDates > 0) {
          dayData.totalAvg = Math.round(itemsByDay[dayIndex].total / uniqueDates);
          dayData.mangleAvg = Math.round(itemsByDay[dayIndex].mangle / uniqueDates);
          dayData.dobladoAvg = Math.round(itemsByDay[dayIndex].doblado / uniqueDates);
          dayData.entryCount = clientEntries.filter((e) => e.addedAt.getDay() === dayIndex).length;
        }
      });

      // Calculate totals
      client.totalItems = clientEntries.reduce((sum, entry) => sum + entry.quantity, 0);
      client.totalMangle = clientEntries
        .filter((entry) => entry.classification === "Mangle")
        .reduce((sum, entry) => sum + entry.quantity, 0);
      client.totalDoblado = clientEntries
        .filter((entry) => entry.classification === "Doblado")
        .reduce((sum, entry) => sum + entry.quantity, 0);
      
      // Calculate average daily items (total items / unique dates across all days)
      const allUniqueDates = new Set();
      clientEntries.forEach((entry) => {
        allUniqueDates.add(entry.addedAt.toISOString().slice(0, 10));
      });
      client.averageDailyItems = allUniqueDates.size > 0 ? Math.round(client.totalItems / allUniqueDates.size) : 0;
    });

    // Sort by total items descending
    const sorted = Object.values(clientsMap).sort((a, b) => b.totalItems - a.totalItems);

    // Auto-select top 10 clients for initial view
    if (selectedClients.length === 0) {
      const topClients = sorted.slice(0, 10).map((client) => client.clientId);
      setSelectedClients(topClients);
    }

    return sorted;
  }, [productionEntries]);

  // Update clients data state
  useEffect(() => {
    setClientsData(processedClientsData);
  }, [processedClientsData]);

  // Chart data for visualization
  const chartData = useMemo(() => {
    if (!selectedClients.length || !clientsData.length) return null;

    const selectedClientsData = clientsData.filter((client) =>
      selectedClients.includes(client.clientId)
    );

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const colors = [
      "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
      "#06B6D4", "#F97316", "#84CC16", "#EC4899", "#6B7280"
    ];

    const datasets = selectedClientsData.map((client, index) => ({
      label: client.clientName,
      data: client.dayData.map((dayData) => {
        switch (showType) {
          case "mangle":
            return dayData.mangleAvg;
          case "doblado":
            return dayData.dobladoAvg;
          default:
            return dayData.totalAvg;
        }
      }),
      borderColor: colors[index % colors.length],
      backgroundColor: colors[index % colors.length] + "20",
      borderWidth: chartType === "line" ? 3 : 1,
      pointRadius: chartType === "line" ? 4 : 0,
      pointHoverRadius: chartType === "line" ? 6 : 0,
      tension: 0.4,
      fill: chartType === "bar",
    }));

    return {
      labels: dayNames,
      datasets,
    };
  }, [selectedClients, clientsData, showType, chartType]);

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: `Client Average Items by Day of Week (${showType.charAt(0).toUpperCase() + showType.slice(1)})`,
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
            const typeLabel = showType === "total" ? "items" : `${showType} items`;
            return `${label}: ${value.toLocaleString()} ${typeLabel}/day avg`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: `Average ${showType.charAt(0).toUpperCase() + showType.slice(1)} Items per Day`,
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

  // Handle client selection
  const handleClientToggle = (clientId: string) => {
    setSelectedClients((prev) =>
      prev.includes(clientId)
        ? prev.filter((id) => id !== clientId)
        : [...prev, clientId]
    );
  };

  const handleSelectAllClients = () => {
    setSelectedClients(clientsData.slice(0, 20).map((client) => client.clientId)); // Limit to top 20 for performance
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
          <div className="mt-2">Loading client weekly analytics...</div>
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
                <i className="bi bi-people me-2"></i>
                Client Weekly Analytics - Items per Day by Mangle vs Doblado
              </h2>
              <p className="text-muted mb-0">
                Shows average items each client brings per day of the week, broken down by Mangle and Doblado classifications.
                Averages are calculated from historical data over the selected date range.
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
                      setDateRange((prev) => ({ ...prev, start: e.target.value }))
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
                <div className="col-md-2">
                  <label className="form-label">Show Data</label>
                  <select
                    className="form-select"
                    value={showType}
                    onChange={(e) => setShowType(e.target.value as "total" | "mangle" | "doblado")}
                  >
                    <option value="total">Total Items</option>
                    <option value="mangle">Mangle Items Only</option>
                    <option value="doblado">Doblado Items Only</option>
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label">View Mode</label>
                  <div className="btn-group w-100" role="group">
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
                  </div>
                </div>
                <div className="col-md-2">
                  <label className="form-label">Chart Type</label>
                  <div className="btn-group w-100" role="group">
                    <button
                      className={`btn ${
                        chartType === "bar"
                          ? "btn-secondary"
                          : "btn-outline-secondary"
                      }`}
                      onClick={() => setChartType("bar")}
                      disabled={viewMode !== "chart"}
                    >
                      Bar
                    </button>
                    <button
                      className={`btn ${
                        chartType === "line"
                          ? "btn-secondary"
                          : "btn-outline-secondary"
                      }`}
                      onClick={() => setChartType("line")}
                      disabled={viewMode !== "chart"}
                    >
                      Line
                    </button>
                  </div>
                </div>
                <div className="col-md-2">
                  <div className="d-flex gap-1">
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

      {/* Client Selection */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <div className="d-flex justify-content-between align-items-center">
                <h6 className="mb-0">
                  <i className="bi bi-funnel me-2"></i>
                  Select Clients to Display ({selectedClients.length} selected)
                </h6>
                <div>
                  <button
                    className="btn btn-sm btn-outline-primary me-2"
                    onClick={handleSelectAllClients}
                  >
                    Select Top 20
                  </button>
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    onClick={handleClearAllClients}
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>
            <div className="card-body">
              <div className="row">
                {clientsData.slice(0, 30).map((client) => (
                  <div key={client.clientId} className="col-lg-3 col-md-4 col-sm-6 mb-2">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`client-${client.clientId}`}
                        checked={selectedClients.includes(client.clientId)}
                        onChange={() => handleClientToggle(client.clientId)}
                      />
                      <label
                        className="form-check-label small"
                        htmlFor={`client-${client.clientId}`}
                        title={`Total: ${client.totalItems.toLocaleString()}, Avg/day: ${client.averageDailyItems}`}
                      >
                        <strong>{client.clientName}</strong>
                        <br />
                        <small className="text-muted">
                          {client.averageDailyItems} avg/day ({client.totalItems.toLocaleString()} total)
                        </small>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart View */}
      {viewMode === "chart" && (
        <div className="row mb-4">
          <div className="col-12">
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">
                  <i className="bi bi-graph-up me-2"></i>
                  Client Weekly Pattern Analysis - {showType.charAt(0).toUpperCase() + showType.slice(1)} Items
                </h5>
              </div>
              <div className="card-body">
                {chartData && selectedClients.length > 0 ? (
                  <div style={{ height: "500px" }}>
                    {chartType === "line" ? (
                      <Line data={chartData} options={chartOptions} />
                    ) : (
                      <Bar data={chartData} options={chartOptions} />
                    )}
                  </div>
                ) : (
                  <div className="text-center py-5 text-muted">
                    <i
                      className="bi bi-graph-up"
                      style={{ fontSize: "3rem", opacity: 0.3 }}
                    ></i>
                    <p className="mt-3">Select clients to view their weekly patterns</p>
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
                  Client Weekly Breakdown - Average Items per Day of Week
                </h5>
              </div>
              <div className="card-body">
                <div className="table-responsive">
                  <table className="table table-striped table-hover">
                    <thead className="table-dark">
                      <tr>
                        <th>Client</th>
                        <th className="text-center">Sun</th>
                        <th className="text-center">Mon</th>
                        <th className="text-center">Tue</th>
                        <th className="text-center">Wed</th>
                        <th className="text-center">Thu</th>
                        <th className="text-center">Fri</th>
                        <th className="text-center">Sat</th>
                        <th className="text-center">Weekly Avg</th>
                        <th className="text-center">Total Items</th>
                        <th className="text-center">M/D Split</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientsData
                        .filter((client) => selectedClients.length === 0 || selectedClients.includes(client.clientId))
                        .slice(0, 50) // Limit for performance
                        .map((client) => (
                          <tr key={client.clientId}>
                            <td>
                              <strong>{client.clientName}</strong>
                              <br />
                              <small className="text-muted">{client.clientId}</small>
                            </td>
                            {client.dayData.map((dayData, index) => (
                              <td key={index} className="text-center">
                                <div className="mb-1">
                                  <strong
                                    className={
                                      dayData.totalAvg > 0
                                        ? dayData.totalAvg > 50
                                          ? "text-success"
                                          : dayData.totalAvg > 20
                                          ? "text-warning"
                                          : "text-primary"
                                        : "text-muted"
                                    }
                                  >
                                    {showType === "total"
                                      ? dayData.totalAvg.toLocaleString()
                                      : showType === "mangle"
                                      ? dayData.mangleAvg.toLocaleString()
                                      : dayData.dobladoAvg.toLocaleString()}
                                  </strong>
                                </div>
                                {dayData.totalAvg > 0 && (
                                  <small className="text-muted">
                                    M:{dayData.mangleAvg} D:{dayData.dobladoAvg}
                                  </small>
                                )}
                                <br />
                                <small className="text-muted">
                                  ({dayData.uniqueDates}d)
                                </small>
                              </td>
                            ))}
                            <td className="text-center">
                              <strong className="text-primary">
                                {client.averageDailyItems.toLocaleString()}
                              </strong>
                            </td>
                            <td className="text-center">
                              <span className="badge bg-info">
                                {client.totalItems.toLocaleString()}
                              </span>
                            </td>
                            <td className="text-center">
                              <div className="small">
                                <span className="badge bg-success me-1">
                                  M: {client.totalMangle.toLocaleString()}
                                </span>
                                <br />
                                <span className="badge bg-warning">
                                  D: {client.totalDoblado.toLocaleString()}
                                </span>
                              </div>
                              <div className="mt-1">
                                <small className="text-muted">
                                  {client.totalItems > 0
                                    ? `${Math.round(
                                        (client.totalMangle / client.totalItems) * 100
                                      )}% / ${Math.round(
                                        (client.totalDoblado / client.totalItems) * 100
                                      )}%`
                                    : "0% / 0%"}
                                </small>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {clientsData.length === 0 && (
                  <div className="text-center py-5">
                    <i
                      className="bi bi-inbox"
                      style={{ fontSize: "4rem", opacity: 0.3 }}
                    ></i>
                    <h5 className="text-muted mt-3">No Client Data Found</h5>
                    <p className="text-muted mb-2">
                      No production data found for the selected date range: {dateRange.start} to {dateRange.end}
                    </p>
                    <div className="mt-3">
                      <small className="text-muted d-block">
                        📅 <strong>Date Range:</strong> {new Date(dateRange.start).toLocaleDateString()} - {new Date(dateRange.end).toLocaleDateString()}
                      </small>
                      <small className="text-muted d-block">
                        📊 <strong>Production Entries:</strong> {productionEntries.length} found
                      </small>
                      <small className="text-muted d-block">
                        👥 <strong>Processed Clients:</strong> {clientsData.length}
                      </small>
                      <small className="text-muted d-block">
                        📄 <strong>Invoices in Range:</strong> {debugInfo.totalInvoices} (Total in DB: {debugInfo.totalInDatabase})
                      </small>
                    </div>
                    
                    {debugInfo.dateRangeIssue && (
                      <div className="alert alert-warning mt-3">
                        <h6 className="mb-2">⚠️ Date Range Issue Detected</h6>
                        <p className="mb-2 small">
                          Found {debugInfo.totalInDatabase} invoices in database, but none in your selected date range.
                        </p>
                        {debugInfo.sampleDates.length > 0 && (
                          <div className="small">
                            <strong>Sample invoice dates in database:</strong>
                            <ul className="mb-0 mt-1">
                              {debugInfo.sampleDates.slice(0, 5).map((date, idx) => (
                                <li key={idx}>{date}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="alert alert-info mt-4 text-start">
                      <h6 className="mb-2">💡 Troubleshooting Tips:</h6>
                      <ul className="mb-0 small">
                        <li>Try expanding the date range (currently set to last 90 days)</li>
                        <li>Ensure there are invoices with production items in the date range</li>
                        <li>Check if items have proper <code>addedAt</code> timestamps</li>
                        <li>Verify that clients have invoice data with item details</li>
                      </ul>
                    </div>
                    <div className="mt-3">
                      <button 
                        className="btn btn-outline-primary me-2"
                        onClick={() => {
                          const end = new Date();
                          const start = new Date();
                          start.setDate(start.getDate() - 365); // Last year
                          setDateRange({
                            start: start.toISOString().slice(0, 10),
                            end: end.toISOString().slice(0, 10),
                          });
                        }}
                      >
                        📅 Try Last Year
                      </button>
                      <button 
                        className="btn btn-outline-secondary"
                        onClick={() => {
                          console.log('🔍 Debug Info:', {
                            dateRange,
                            productionEntries: productionEntries.length,
                            clientsData: clientsData.length,
                            debugInfo,
                            sampleEntries: productionEntries.slice(0, 3)
                          });
                        }}
                      >
                        🔍 Debug Info
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Insights */}
      <div className="row mt-4">
        <div className="col-12">
          <div className="alert alert-info">
            <h6 className="alert-heading mb-2">
              <i className="bi bi-lightbulb me-2"></i>
              How to Read This Data
            </h6>
            <ul className="list-unstyled small mb-0">
              <li className="mb-1">
                <i className="bi bi-calendar-week text-primary me-2"></i>
                <strong>Daily Averages:</strong> Each day shows the average number of items this client typically brings on that day of the week
              </li>
              <li className="mb-1">
                <i className="bi bi-tools text-success me-2"></i>
                <strong>Mangle Items:</strong> Items that require mangle processing (sheets, towels, etc.)
              </li>
              <li className="mb-1">
                <i className="bi bi-hand-index text-warning me-2"></i>
                <strong>Doblado Items:</strong> Items that require folding (uniforms, clothing, etc.)
              </li>
              <li className="mb-1">
                <i className="bi bi-graph-up text-info me-2"></i>
                <strong>Sample Size:</strong> Number in parentheses (Xd) shows how many days were sampled for that day of the week
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientWeeklyAnalytics;
