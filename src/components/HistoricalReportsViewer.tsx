import React, { useState, useEffect } from 'react';

interface ProductionReport {
  date: string;
  displayDate: string;
  isEmpty: boolean;
  summary?: {
    totalItems: number;
    totalQuantity: number;
    processedInvoices: number;
    uniqueProducts: number;
    uniqueClients: number;
    firstEntry: {
      time: string;
      product: string;
      client: string;
      quantity: number;
      addedBy: string;
    };
    lastEntry: {
      time: string;
      product: string;
      client: string;
      quantity: number;
      addedBy: string;
    };
    productionSpan: {
      hours: number;
      minutes: number;
      totalMinutes: number;
    };
    rates: {
      overall: number;
      production: number;
    };
  };
  hourlyBreakdown: Array<{
    hour: number;
    hourDisplay: string;
    items: number;
    quantity: number;
    clients: number;
    topProducts: Array<{ name: string; quantity: number }>;
  }>;
  topProducts: Array<{
    name: string;
    quantity: number;
    items: number;
    clients: number;
  }>;
  clientSummary: Array<{
    name: string;
    quantity: number;
    items: number;
    products: number;
  }>;
  generatedAt: string;
}

const HistoricalReportsViewer: React.FC = () => {
  const [reports, setReports] = useState<ProductionReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<ProductionReport[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReport, setSelectedReport] = useState<ProductionReport | null>(null);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Load existing reports
  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/historical-reports');
      const data = await response.json();
      
      if (data.success) {
        setReports(data.reports || []);
        setFilteredReports(data.reports || []);
      } else {
        console.error('Failed to load reports:', data.error);
        setReports([]);
        setFilteredReports([]);
      }
    } catch (error) {
      console.error('Error loading reports:', error);
      setReports([]);
      setFilteredReports([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter reports based on search term and date range
  useEffect(() => {
    let filtered = reports;

    if (searchTerm) {
      filtered = filtered.filter(report => 
        report.displayDate.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.date.includes(searchTerm) ||
        (report.summary && (
          report.summary.firstEntry.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
          report.summary.firstEntry.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
          report.topProducts?.some(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
          report.clientSummary?.some(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
        ))
      );
    }

    if (dateRange.start) {
      filtered = filtered.filter(report => report.date >= dateRange.start);
    }

    if (dateRange.end) {
      filtered = filtered.filter(report => report.date <= dateRange.end);
    }

    setFilteredReports(filtered);
  }, [reports, searchTerm, dateRange]);

  const generateReport = async (date: string) => {
    setGenerating(true);
    try {
      const response = await fetch('http://localhost:3001/api/historical-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'date',
          date: date
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`Report generated successfully for ${date}!`);
        await loadReports();
      } else {
        console.error('Failed to generate report:', data.error);
        alert(`Error generating report: ${data.error}`);
      }
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error generating report. Check console for details.');
    } finally {
      setGenerating(false);
    }
  };

  const generateDateRange = async () => {
    if (!dateRange.start || !dateRange.end) {
      alert('Please select both start and end dates');
      return;
    }
    
    setGenerating(true);
    try {
      const response = await fetch('http://localhost:3001/api/historical-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'range',
          startDate: dateRange.start,
          endDate: dateRange.end
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`Reports generated successfully for ${dateRange.start} to ${dateRange.end}!`);
        await loadReports();
      } else {
        console.error('Failed to generate reports:', data.error);
        alert(`Error generating reports: ${data.error}`);
      }
    } catch (error) {
      console.error('Error generating date range:', error);
      alert('Error generating reports. Check console for details.');
    } finally {
      setGenerating(false);
    }
  };

  const exportReport = (report: ProductionReport) => {
    const dataStr = JSON.stringify(report, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `production-report-${report.date}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  if (loading) {
    return (
      <div className="container-fluid py-4">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Loading historical reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      {/* Header */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="d-flex align-items-center justify-between">
            <div>
              <h1 className="display-4 fw-bold text-primary">📊 Historical Production Reports</h1>
              <p className="text-muted">Search and analyze production data across any date range</p>
            </div>
            <div className="badge bg-primary fs-6">
              📄 {filteredReports.length} Reports
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="card mb-4">
        <div className="card-header">
          <h5 className="card-title mb-0">
            🔧 Report Controls
          </h5>
        </div>
        <div className="card-body">
          {/* Search */}
          <div className="row mb-3">
            <div className="col-12">
              <div className="input-group">
                <span className="input-group-text">🔍</span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search by date, client, product, or any keyword..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Date Range */}
          <div className="row mb-3">
            <div className="col-md-4">
              <div className="input-group">
                <span className="input-group-text">📅</span>
                <input
                  type="date"
                  className="form-control"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                />
              </div>
            </div>
            <div className="col-md-4">
              <div className="input-group">
                <span className="input-group-text">📅</span>
                <input
                  type="date"
                  className="form-control"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                />
              </div>
            </div>
            <div className="col-md-4">
              <button 
                className="btn btn-primary w-100"
                onClick={generateDateRange} 
                disabled={generating}
              >
                {generating ? '⏳ Generating...' : '🔄 Generate Range'}
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="row">
            <div className="col-md-3">
              <button 
                className="btn btn-outline-primary w-100"
                onClick={async () => {
                  setGenerating(true);
                  try {
                    const response = await fetch('http://localhost:3001/api/historical-reports', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({ action: 'today' })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                      alert("Today's report generated successfully!");
                      await loadReports();
                    } else {
                      alert(`Error: ${data.error}`);
                    }
                  } catch (error) {
                    console.error('Error:', error);
                    alert('Error generating report');
                  } finally {
                    setGenerating(false);
                  }
                }}
                disabled={generating}
              >
                📊 Generate Today
              </button>
            </div>
            <div className="col-md-3">
              <button 
                className="btn btn-outline-secondary w-100"
                onClick={() => generateReport(new Date(Date.now() - 24*60*60*1000).toISOString().split('T')[0])}
                disabled={generating}
              >
                🕐 Generate Yesterday
              </button>
            </div>
            <div className="col-md-3">
              <button 
                className="btn btn-outline-info w-100"
                onClick={loadReports}
              >
                🔄 Refresh Reports
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Command Line Instructions */}
      <div className="alert alert-warning" role="alert">
        <h6 className="alert-heading">💻 Command Line Usage</h6>
        <small>
          <strong>Today's Report:</strong> <code>node historical-production-report.js today</code><br/>
          <strong>Specific Date:</strong> <code>node historical-production-report.js date 2024-01-15</code><br/>
          <strong>Date Range:</strong> <code>node historical-production-report.js range 2024-01-01 2024-01-31</code><br/>
          <strong>Search Reports:</strong> <code>node historical-production-report.js search "client name"</code>
        </small>
      </div>

      {/* Reports List */}
      {filteredReports.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-5">
            <i className="fas fa-file-alt fa-4x text-muted mb-3"></i>
            <h3 className="text-muted">No Reports Found</h3>
            <p className="text-muted">
              {searchTerm || dateRange.start || dateRange.end 
                ? 'No reports match your current filters. Try adjusting your search criteria.' 
                : 'No production reports have been generated yet. Use the commands above to generate reports.'}
            </p>
            <button 
              className="btn btn-primary"
              onClick={() => {setSearchTerm(''); setDateRange({start: '', end: ''});}}
            >
              Clear Filters
            </button>
          </div>
        </div>
      ) : (
        <div className="row">
          {filteredReports.map((report) => (
            <div className="col-12 mb-4" key={report.date}>
              <div className={`card h-100 ${selectedReport?.date === report.date ? 'border-primary' : ''}`} 
                   style={{ cursor: 'pointer' }}
                   onClick={() => setSelectedReport(selectedReport?.date === report.date ? null : report)}>
                <div className="card-header">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <h5 className="card-title mb-1">
                        📅 {report.displayDate}
                      </h5>
                      <small className="text-muted">
                        Generated: {new Date(report.generatedAt).toLocaleString()}
                      </small>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      {report.isEmpty ? (
                        <span className="badge bg-secondary">No Activity</span>
                      ) : (
                        <span className="badge bg-success">
                          {report.summary?.totalQuantity.toLocaleString()} Units
                        </span>
                      )}
                      <button
                        className="btn btn-outline-primary btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          exportReport(report);
                        }}
                      >
                        📥 Export
                      </button>
                    </div>
                  </div>
                </div>
                
                {!report.isEmpty && report.summary && (
                  <div className="card-body">
                    <div className="row text-center">
                      <div className="col-md-3">
                        <h4 className="text-primary">{report.summary.totalItems}</h4>
                        <small className="text-muted">Items</small>
                      </div>
                      <div className="col-md-3">
                        <h4 className="text-success">{report.summary.totalQuantity.toLocaleString()}</h4>
                        <small className="text-muted">Units</small>
                      </div>
                      <div className="col-md-3">
                        <h4 className="text-info">{report.summary.uniqueClients}</h4>
                        <small className="text-muted">Clients</small>
                      </div>
                      <div className="col-md-3">
                        <h4 className="text-warning">{report.summary.rates.production}</h4>
                        <small className="text-muted">Units/Hr</small>
                      </div>
                    </div>
                    
                    <hr />
                    
                    <div className="d-flex justify-content-between text-sm">
                      <span>First: {report.summary.firstEntry.time} - {report.summary.firstEntry.product}</span>
                      <span>Last: {report.summary.lastEntry.time} - {report.summary.lastEntry.product}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detailed Report View */}
      {selectedReport && !selectedReport.isEmpty && selectedReport.summary && (
        <div className="card mt-4">
          <div className="card-header">
            <h5 className="card-title">📋 Detailed Report - {selectedReport.displayDate}</h5>
          </div>
          <div className="card-body">
            {/* Timing Summary */}
            <h6 className="mb-3">⏰ Timing Summary</h6>
            <div className="row mb-4">
              <div className="col-md-4">
                <div className="card bg-light">
                  <div className="card-body text-center">
                    <h6 className="text-success">First Item</h6>
                    <p className="fw-bold">{selectedReport.summary.firstEntry.time}</p>
                    <small>{selectedReport.summary.firstEntry.product}</small><br/>
                    <small>{selectedReport.summary.firstEntry.client}</small>
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="card bg-light">
                  <div className="card-body text-center">
                    <h6 className="text-danger">Last Item</h6>
                    <p className="fw-bold">{selectedReport.summary.lastEntry.time}</p>
                    <small>{selectedReport.summary.lastEntry.product}</small><br/>
                    <small>{selectedReport.summary.lastEntry.client}</small>
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="card bg-light">
                  <div className="card-body text-center">
                    <h6 className="text-warning">Production Span</h6>
                    <p className="fw-bold">
                      {selectedReport.summary.productionSpan.hours}h {selectedReport.summary.productionSpan.minutes}m
                    </p>
                    <small>Active Production</small>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Products */}
            <h6 className="mb-3">🏆 Top Products</h6>
            <div className="row mb-4">
              {selectedReport.topProducts?.slice(0, 5).map((product, index) => (
                <div className="col-12 mb-2" key={product.name}>
                  <div className="d-flex justify-content-between align-items-center p-2 bg-light rounded">
                    <span className="fw-bold">{index + 1}. {product.name}</span>
                    <small className="text-muted">
                      {product.quantity.toLocaleString()} units • {product.items} entries • {product.clients} clients
                    </small>
                  </div>
                </div>
              ))}
            </div>

            {/* Client Summary */}
            <h6 className="mb-3">👥 Client Summary</h6>
            <div className="row">
              {selectedReport.clientSummary?.slice(0, 5).map((client, index) => (
                <div className="col-12 mb-2" key={client.name}>
                  <div className="d-flex justify-content-between align-items-center p-2 bg-light rounded">
                    <span className="fw-bold">{index + 1}. {client.name}</span>
                    <small className="text-muted">
                      {client.quantity.toLocaleString()} units • {client.items} items • {client.products} products
                    </small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoricalReportsViewer;