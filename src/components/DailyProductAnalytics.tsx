import React, { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, where, orderBy, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import { Invoice, Client, Product } from "../types";
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';
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
} from 'chart.js';

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
  ArcElement
);

interface DailyProductStats {
  date: string;
  totalQuantity: number;
  totalRevenue: number;
  invoiceCount: number;
  clientCount: number;
  products: {
    [productName: string]: {
      quantity: number;
      revenue: number;
      invoiceCount: number;
      percentage: number;
    };
  };
}

interface DateRange {
  start: string;
  end: string;
}

const DailyProductAnalytics: React.FC = () => {
  // State management
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyProductStats[]>([]);
  
  // Date range controls
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30); // Last 30 days
    
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10)
    };
  });

  // Selected date for detailed view
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  // Product selection state
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [showProductSelector, setShowProductSelector] = useState(false);

  // Get all unique product names from invoices
  const allProductNames = useMemo(() => {
    const productNames = new Set<string>();
    invoices.forEach(invoice => {
      if (invoice.carts) {
        invoice.carts.forEach(cart => {
          if (cart.items) {
            cart.items.forEach(item => {
              if (item.productName) {
                productNames.add(item.productName);
              }
            });
          }
        });
      }
    });
    return Array.from(productNames).sort();
  }, [invoices]);

  // Handle product selection
  const handleProductToggle = (productName: string) => {
    setSelectedProducts(prev => {
      if (prev.includes(productName)) {
        return prev.filter(p => p !== productName);
      } else {
        return [...prev, productName];
      }
    });
  };

  const handleSelectAllProducts = () => {
    setSelectedProducts(allProductNames);
  };

  const handleClearAllProducts = () => {
    setSelectedProducts([]);
  };

  // Load data from Firebase
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Load invoices
        const invoicesSnapshot = await getDocs(collection(db, "invoices"));
        const invoicesData = invoicesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Invoice[];

        // Load clients
        const clientsSnapshot = await getDocs(collection(db, "clients"));
        const clientsData = clientsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Client[];

        // Load products
        const productsSnapshot = await getDocs(collection(db, "products"));
        const productsData = productsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Product[];

        setInvoices(invoicesData);
        setClients(clientsData);
        setProducts(productsData);
        
        console.log("📊 Daily Analytics Data Loaded:", {
          invoices: invoicesData.length,
          clients: clientsData.length,
          products: productsData.length
        });
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Calculate daily statistics
  const calculateDailyStats = useMemo(() => {
    if (!invoices.length || loading) return [];

    const stats: { [date: string]: DailyProductStats } = {};
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);

    // Filter invoices by date range
    const filteredInvoices = invoices.filter(invoice => {
      if (!invoice.date) return false;
      const invoiceDate = new Date(invoice.date);
      return invoiceDate >= startDate && invoiceDate <= endDate;
    });

    // Process each invoice
    filteredInvoices.forEach(invoice => {
      const dateStr = new Date(invoice.date).toISOString().slice(0, 10);
      
      if (!stats[dateStr]) {
        stats[dateStr] = {
          date: dateStr,
          totalQuantity: 0,
          totalRevenue: 0,
          invoiceCount: 0,
          clientCount: 0,
          products: {}
        };
      }

      const dayStats = stats[dateStr];
      dayStats.invoiceCount++;

      // Process carts and items
      if (invoice.carts) {
        invoice.carts.forEach(cart => {
          if (cart.items) {
            cart.items.forEach(item => {
              const productName = item.productName;
              const quantity = item.quantity || 0;
              const revenue = quantity * (item.price || 0);

              // Only include selected products (if any selected) or all products (if none selected)
              const shouldIncludeProduct = selectedProducts.length === 0 || selectedProducts.includes(productName);
              
              if (shouldIncludeProduct) {
                // Update totals
                dayStats.totalQuantity += quantity;
                dayStats.totalRevenue += revenue;

                // Update product breakdown
                if (!dayStats.products[productName]) {
                  dayStats.products[productName] = {
                    quantity: 0,
                    revenue: 0,
                    invoiceCount: 0,
                    percentage: 0
                  };
                }

                dayStats.products[productName].quantity += quantity;
                dayStats.products[productName].revenue += revenue;
                dayStats.products[productName].invoiceCount++;
              }
            });
          }
        });
      }
    });

    // Calculate percentages and unique clients
    Object.values(stats).forEach(dayStats => {
      // Calculate percentages
      Object.values(dayStats.products).forEach(product => {
        product.percentage = dayStats.totalQuantity > 0 
          ? (product.quantity / dayStats.totalQuantity) * 100 
          : 0;
      });

      // Count unique clients for this day
      const dayInvoices = filteredInvoices.filter(
        inv => new Date(inv.date).toISOString().slice(0, 10) === dayStats.date
      );
      const uniqueClients = new Set(dayInvoices.map(inv => inv.clientId));
      dayStats.clientCount = uniqueClients.size;
    });

    return Object.values(stats).sort((a, b) => a.date.localeCompare(b.date));
  }, [invoices, dateRange, selectedProducts]);

  // Get data for selected date
  const selectedDateData = useMemo(() => {
    return calculateDailyStats.find(stat => stat.date === selectedDate);
  }, [calculateDailyStats, selectedDate]);

  // Chart data preparation
  const trendChartData = useMemo(() => {
    const labels = calculateDailyStats.map(stat => 
      new Date(stat.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    );

    return {
      labels,
      datasets: [
        {
          label: 'Total Products Processed',
          data: calculateDailyStats.map(stat => stat.totalQuantity),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          fill: true,
        },
        {
          label: 'Number of Invoices',
          data: calculateDailyStats.map(stat => stat.invoiceCount),
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
          yAxisID: 'y1',
        }
      ]
    };
  }, [calculateDailyStats]);

  const revenueChartData = useMemo(() => {
    const labels = calculateDailyStats.map(stat => 
      new Date(stat.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    );

    return {
      labels,
      datasets: [
        {
          label: 'Daily Revenue ($)',
          data: calculateDailyStats.map(stat => stat.totalRevenue),
          backgroundColor: 'rgba(34, 197, 94, 0.8)',
          borderColor: 'rgba(34, 197, 94, 1)',
          borderWidth: 1,
        }
      ]
    };
  }, [calculateDailyStats]);

  const productBreakdownData = useMemo(() => {
    if (!selectedDateData) return null;

    const sortedProducts = Object.entries(selectedDateData.products)
      .sort(([,a], [,b]) => b.quantity - a.quantity)
      .slice(0, 10); // Top 10 products

    const colors = [
      '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
      '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6B7280'
    ];

    return {
      labels: sortedProducts.map(([name]) => name),
      datasets: [
        {
          data: sortedProducts.map(([, data]) => data.quantity),
          backgroundColor: colors,
          borderColor: colors.map(color => color),
          borderWidth: 2,
        }
      ]
    };
  }, [selectedDateData]);

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: `Daily Product Processing Trends${selectedProducts.length > 0 ? ` (${selectedProducts.length} selected products)` : ''}`
      }
    },
    scales: {
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Total Products'
        }
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Number of Invoices'
        },
        grid: {
          drawOnChartArea: false,
        },
      }
    }
  };

  const barChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: `Daily Revenue Trends${selectedProducts.length > 0 ? ` (${selectedProducts.length} selected products)` : ''}`
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Revenue ($)'
        }
      }
    }
  };

  const pieChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'right' as const,
      },
      title: {
        display: true,
        text: `Top Products - ${new Date(selectedDate).toLocaleDateString()}${selectedProducts.length > 0 ? ` (${selectedProducts.length} selected)` : ''}`
      }
    }
  };

  if (loading) {
    return (
      <div className="container py-4">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      {/* Header */}
      <div className="row mb-4">
        <div className="col-12">
          <h2 className="mb-3">
            📊 Daily Product Processing Analytics
            {selectedProducts.length > 0 && (
              <span className="badge bg-info ms-3">
                {selectedProducts.length} Products Selected
              </span>
            )}
          </h2>
          <p className="text-muted">
            Comprehensive analytics showing daily product processing volumes, trends, and breakdowns
            {selectedProducts.length > 0 && (
              <span className="text-info">
                <br />
                <i className="bi bi-funnel me-1"></i>
                Currently showing data for selected products only. Use the "Filter Products" button to modify selection.
              </span>
            )}
          </p>
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
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">End Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Detailed View Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                </div>
                <div className="col-md-3">
                  <button 
                    className="btn btn-primary"
                    onClick={() => {
                      const today = new Date().toISOString().slice(0, 10);
                      setSelectedDate(today);
                      setDateRange(prev => ({ ...prev, end: today }));
                    }}
                  >
                    Today
                  </button>
                </div>
                <div className="col-md-3">
                  <button 
                    className="btn btn-outline-secondary"
                    onClick={() => setShowProductSelector(!showProductSelector)}
                  >
                    <i className="bi bi-funnel me-2"></i>
                    Filter Products ({selectedProducts.length > 0 ? selectedProducts.length : 'All'})
                  </button>
                </div>
              </div>

              {/* Product Selector */}
              <div className="row mt-3">
                <div className="col-12">
                  <div className="form-check">
                    <input 
                      type="checkbox" 
                      className="form-check-input"
                      id="selectAllProducts"
                      checked={selectedProducts.length === allProductNames.length}
                      onChange={handleSelectAllProducts}
                    />
                    <label className="form-check-label" htmlFor="selectAllProducts">
                      Select All Products
                    </label>
                  </div>
                  {allProductNames.map(productName => (
                    <div className="form-check" key={productName}>
                      <input 
                        type="checkbox" 
                        className="form-check-input"
                        id={`product-${productName}`}
                        checked={selectedProducts.includes(productName)}
                        onChange={() => handleProductToggle(productName)}
                      />
                      <label className="form-check-label" htmlFor={`product-${productName}`}>
                        {productName}
                      </label>
                    </div>
                  ))}
                  <div className="mt-2">
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={handleClearAllProducts}
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product Selection Panel */}
      {showProductSelector && (
        <div className="row mb-4">
          <div className="col-12">
            <div className="card border-info">
              <div className="card-header bg-light">
                <div className="d-flex justify-content-between align-items-center">
                  <h6 className="mb-0">
                    <i className="bi bi-funnel me-2"></i>
                    Select Products to Include in Analytics
                  </h6>
                  <div>
                    <button 
                      className="btn btn-sm btn-outline-primary me-2"
                      onClick={handleSelectAllProducts}
                    >
                      Select All ({allProductNames.length})
                    </button>
                    <button 
                      className="btn btn-sm btn-outline-secondary me-2"
                      onClick={handleClearAllProducts}
                    >
                      Clear All
                    </button>
                    <button 
                      className="btn btn-sm btn-light"
                      onClick={() => setShowProductSelector(false)}
                    >
                      <i className="bi bi-x"></i>
                    </button>
                  </div>
                </div>
              </div>
              <div className="card-body">
                <div className="row">
                  {allProductNames.length === 0 ? (
                    <div className="col-12 text-center text-muted">
                      No products found in the selected date range
                    </div>
                  ) : (
                    allProductNames.map((productName, index) => (
                      <div key={productName} className="col-md-4 col-lg-3 mb-2">
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`product-${index}`}
                            checked={selectedProducts.includes(productName)}
                            onChange={() => handleProductToggle(productName)}
                          />
                          <label 
                            className="form-check-label text-truncate" 
                            htmlFor={`product-${index}`}
                            title={productName}
                            style={{ maxWidth: '200px' }}
                          >
                            {productName}
                          </label>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {selectedProducts.length > 0 && (
                  <div className="mt-3 pt-3 border-top">
                    <small className="text-muted">
                      <strong>Selected ({selectedProducts.length}):</strong> {selectedProducts.join(', ')}
                    </small>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="card bg-primary text-white">
            <div className="card-body text-center">
              <h3 className="mb-1">
                {calculateDailyStats.reduce((sum, stat) => sum + stat.totalQuantity, 0).toLocaleString()}
              </h3>
              <p className="mb-0">Total Products Processed</p>
              <small>
                Last {calculateDailyStats.length} days
                {selectedProducts.length > 0 && (
                  <><br />({selectedProducts.length} selected products)</>
                )}
              </small>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-success text-white">
            <div className="card-body text-center">
              <h3 className="mb-1">
                ${calculateDailyStats.reduce((sum, stat) => sum + stat.totalRevenue, 0).toLocaleString()}
              </h3>
              <p className="mb-0">Total Revenue</p>
              <small>Last {calculateDailyStats.length} days</small>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-info text-white">
            <div className="card-body text-center">
              <h3 className="mb-1">
                {calculateDailyStats.reduce((sum, stat) => sum + stat.invoiceCount, 0).toLocaleString()}
              </h3>
              <p className="mb-0">Total Invoices</p>
              <small>Last {calculateDailyStats.length} days</small>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-warning text-white">
            <div className="card-body text-center">
              <h3 className="mb-1">
                {calculateDailyStats.length > 0 
                  ? Math.round(calculateDailyStats.reduce((sum, stat) => sum + stat.totalQuantity, 0) / calculateDailyStats.length)
                  : 0
                }
              </h3>
              <p className="mb-0">Avg Products/Day</p>
              <small>Daily average</small>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 1 - Trends */}
      <div className="row mb-4">
        <div className="col-md-8">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">
                📈 Daily Processing Trends
                {selectedProducts.length > 0 && (
                  <small className="text-muted ms-2">({selectedProducts.length} selected products)</small>
                )}
              </h5>
            </div>
            <div className="card-body">
              <Line data={trendChartData} options={chartOptions} />
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">
                💰 Revenue Trends
                {selectedProducts.length > 0 && (
                  <small className="text-muted ms-2">({selectedProducts.length} selected products)</small>
                )}
              </h5>
            </div>
            <div className="card-body">
              <Bar data={revenueChartData} options={barChartOptions} />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 2 - Product Breakdown */}
      {selectedDateData && (
        <div className="row mb-4">
          <div className="col-md-6">
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">
                  🥧 Product Breakdown - {new Date(selectedDate).toLocaleDateString()}
                  {selectedProducts.length > 0 && (
                    <small className="text-muted ms-2">({selectedProducts.length} selected products)</small>
                  )}
                </h5>
              </div>
              <div className="card-body">
                {productBreakdownData ? (
                  <Pie data={productBreakdownData} options={pieChartOptions} />
                ) : (
                  <div className="text-center text-muted">No data for selected date</div>
                )}
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">
                  📋 Daily Summary - {new Date(selectedDate).toLocaleDateString()}
                  {selectedProducts.length > 0 && (
                    <small className="text-muted ms-2">({selectedProducts.length} selected products)</small>
                  )}
                </h5>
              </div>
              <div className="card-body">
                <div className="row">
                  <div className="col-6">
                    <div className="text-center mb-3">
                      <h4 className="text-primary">{selectedDateData.totalQuantity.toLocaleString()}</h4>
                      <small>Products Processed</small>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="text-center mb-3">
                      <h4 className="text-success">${selectedDateData.totalRevenue.toLocaleString()}</h4>
                      <small>Revenue Generated</small>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="text-center mb-3">
                      <h4 className="text-info">{selectedDateData.invoiceCount}</h4>
                      <small>Invoices Processed</small>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="text-center mb-3">
                      <h4 className="text-warning">{selectedDateData.clientCount}</h4>
                      <small>Unique Clients</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Table */}
      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">
                📅 Daily Breakdown Table
                {selectedProducts.length > 0 && (
                  <small className="text-muted ms-2">({selectedProducts.length} selected products)</small>
                )}
              </h5>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-striped table-hover">
                  <thead className="table-dark">
                    <tr>
                      <th>Date</th>
                      <th>Products Processed</th>
                      <th>Revenue</th>
                      <th>Invoices</th>
                      <th>Clients</th>
                      <th>Avg Products/Invoice</th>
                      <th>Top Product</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calculateDailyStats.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center text-muted">
                          No data available for the selected date range
                        </td>
                      </tr>
                    ) : (
                      calculateDailyStats.slice().reverse().map((stat) => {
                        const topProduct = Object.entries(stat.products)
                          .sort(([,a], [,b]) => b.quantity - a.quantity)[0];
                        
                        return (
                          <tr 
                            key={stat.date}
                            style={{ 
                              backgroundColor: stat.date === selectedDate ? '#e3f2fd' : 'transparent',
                              cursor: 'pointer'
                            }}
                            onClick={() => setSelectedDate(stat.date)}
                          >
                            <td className="fw-bold">
                              {new Date(stat.date).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </td>
                            <td>{stat.totalQuantity.toLocaleString()}</td>
                            <td>${stat.totalRevenue.toFixed(2)}</td>
                            <td>{stat.invoiceCount}</td>
                            <td>{stat.clientCount}</td>
                            <td>
                              {stat.invoiceCount > 0 
                                ? Math.round(stat.totalQuantity / stat.invoiceCount)
                                : 0
                              }
                            </td>
                            <td>
                              {topProduct ? (
                                <span>
                                  {topProduct[0]} ({topProduct[1].quantity})
                                </span>
                              ) : (
                                '-'
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Product Table for Selected Date */}
      {selectedDateData && Object.keys(selectedDateData.products).length > 0 && (
        <div className="row mt-4">
          <div className="col-12">
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">
                  🔍 Product Details - {new Date(selectedDate).toLocaleDateString()}
                  {selectedProducts.length > 0 && (
                    <small className="text-muted ms-2">({selectedProducts.length} selected products)</small>
                  )}
                </h5>
              </div>
              <div className="card-body">
                <div className="table-responsive">
                  <table className="table table-striped">
                    <thead className="table-dark">
                      <tr>
                        <th>#</th>
                        <th>Product Name</th>
                        <th>Quantity</th>
                        <th>Percentage</th>
                        <th>Revenue</th>
                        <th>Invoices</th>
                        <th>Avg Qty/Invoice</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(selectedDateData.products)
                        .sort(([,a], [,b]) => b.quantity - a.quantity)
                        .map(([productName, data], index) => (
                          <tr key={productName}>
                            <td>{index + 1}</td>
                            <td className="fw-bold">{productName}</td>
                            <td>{data.quantity.toLocaleString()}</td>
                            <td>
                              <div className="d-flex align-items-center">
                                <div 
                                  className="progress me-2" 
                                  style={{ width: '60px', height: '10px' }}
                                >
                                  <div 
                                    className="progress-bar bg-primary"
                                    style={{ width: `${data.percentage}%` }}
                                  ></div>
                                </div>
                                {data.percentage.toFixed(1)}%
                              </div>
                            </td>
                            <td>${data.revenue.toFixed(2)}</td>
                            <td>{data.invoiceCount}</td>
                            <td>
                              {data.invoiceCount > 0 
                                ? Math.round(data.quantity / data.invoiceCount)
                                : 0
                              }
                            </td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyProductAnalytics;
