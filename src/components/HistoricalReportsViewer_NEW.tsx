// filepath: /Users/ericperez/Desktop/react-app/src/components/HistoricalReportsViewer.tsx
import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Search,
  TrendingUp,
  Users,
  Package,
  Clock,
  FileText,
  Download,
  Filter,
  BarChart3,
  Activity
} from 'lucide-react';

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
      // Fetch reports from the API
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
        // Reload the reports list
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
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="text-muted">Loading historical reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid p-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="text-dark mb-2" style={{ fontSize: '2rem', fontWeight: 'bold' }}>Historical Production Reports</h1>
          <p className="text-muted">Search and analyze production data across any date range</p>
        </div>
        <span className="badge bg-primary fs-6">
          <FileText className="me-2" style={{ width: '16px', height: '16px' }} />
          {filteredReports.length} Reports
        </span>
      </div>

      {/* Controls */}
      <div className="card mb-4">
        <div className="card-header">
          <h5 className="card-title mb-0 d-flex align-items-center">
            <Filter className="me-2" style={{ width: '20px', height: '20px' }} />
            Report Controls
          </h5>
        </div>
        <div className="card-body">
          {/* Search */}
          <div className="d-flex align-items-center mb-3">
            <Search className="text-muted me-2" style={{ width: '20px', height: '20px' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search by date, client, product, or any keyword..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Date Range */}
          <div className="d-flex align-items-center gap-3 mb-3">
            <div className="d-flex align-items-center">
              <Calendar className="text-muted me-2" style={{ width: '20px', height: '20px' }} />
              <input
                type="date"
                className="form-control"
                placeholder="Start Date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              />
            </div>
            <span className="text-muted">to</span>
            <input
              type="date"
              className="form-control"
              placeholder="End Date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            />
            <button 
              className="btn btn-primary"
              onClick={generateDateRange} 
              disabled={generating}
            >
              {generating ? 'Generating...' : 'Generate Range'}
            </button>
          </div>

          {/* Quick Actions */}
          <div className="d-flex align-items-center gap-2">
            <button 
              className="btn btn-outline-secondary"
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
              <Activity className="me-2" style={{ width: '16px', height: '16px' }} />
              Generate Today
            </button>
            <button 
              className="btn btn-outline-secondary"
              onClick={async () => {
                setGenerating(true);
                try {
                  const yesterday = new Date(Date.now() - 24*60*60*1000).toISOString().split('T')[0];
                  const response = await fetch('http://localhost:3001/api/historical-reports', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ action: 'date', date: yesterday })
                  });
                  
                  const data = await response.json();
                  
                  if (data.success) {
                    alert("Yesterday's report generated successfully!");
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
              <Clock className="me-2" style={{ width: '16px', height: '16px' }} />
              Generate Yesterday
            </button>
            <button 
              className="btn btn-outline-primary"
              onClick={loadReports}
            >
              <FileText className="me-2" style={{ width: '16px', height: '16px' }} />
              Refresh Reports
            </button>
          </div>
        </div>
      </div>

      {/* Command Line Instructions */}
      <div className="card mb-4 border-warning" style={{ backgroundColor: '#fff3cd' }}>
        <div className="card-header" style={{ backgroundColor: '#ffeaa7', color: '#856404' }}>
          <h5 className="card-title mb-0 d-flex align-items-center">
            <FileText className="me-2" style={{ width: '20px', height: '20px' }} />
            Command Line Usage
          </h5>
        </div>
        <div className="card-body text-dark">
          <p className="mb-2">Use the terminal to generate reports with these commands:</p>
          <div className="p-3 rounded" style={{ backgroundColor: '#ffeec1', fontFamily: 'monospace', fontSize: '0.875rem' }}>
            <div><strong>Today's Report:</strong> node historical-production-report.js today</div>
            <div><strong>Specific Date:</strong> node historical-production-report.js date 2024-01-15</div>
            <div><strong>Date Range:</strong> node historical-production-report.js range 2024-01-01 2024-01-31</div>
            <div><strong>Search Reports:</strong> node historical-production-report.js search "client name"</div>
          </div>
        </div>
      </div>

      {/* Reports List */}
      {filteredReports.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-5">
            <FileText className="text-muted mb-3" style={{ width: '48px', height: '48px' }} />
            <h3 className="text-dark mb-2">No Reports Found</h3>
            <p className="text-muted mb-4">
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
        <div className="d-grid gap-4">
          {filteredReports.map((report) => (
            <div 
              key={report.date} 
              className={`card ${selectedReport?.date === report.date ? 'border-primary' : ''}`}
              style={{ cursor: 'pointer' }}
              onClick={() => setSelectedReport(selectedReport?.date === report.date ? null : report)}
            >
              <div className="card-header">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h5 className="card-title mb-1 d-flex align-items-center">
                      <Calendar className="me-2" style={{ width: '20px', height: '20px' }} />
                      {report.displayDate}
                    </h5>
                    <p className="text-muted mb-0 small">
                      Report generated on {new Date(report.generatedAt).toLocaleString()}
                    </p>
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
                      <Download style={{ width: '16px', height: '16px' }} />
                    </button>
                  </div>
                </div>
              </div>
              
              {!report.isEmpty && (
                <div className="card-body">
                  <div className="row g-4 mb-3">
                    <div className="col-md-3 text-center">
                      <div className="d-flex justify-content-center mb-2">
                        <Package className="text-primary" style={{ width: '20px', height: '20px' }} />
                      </div>
                      <div className="h4 text-primary mb-1">{report.summary?.totalItems}</div>
                      <div className="small text-muted">Items</div>
                    </div>
                    
                    <div className="col-md-3 text-center">
                      <div className="d-flex justify-content-center mb-2">
                        <TrendingUp className="text-success" style={{ width: '20px', height: '20px' }} />
                      </div>
                      <div className="h4 text-success mb-1">{report.summary?.totalQuantity.toLocaleString()}</div>
                      <div className="small text-muted">Units</div>
                    </div>
                    
                    <div className="col-md-3 text-center">
                      <div className="d-flex justify-content-center mb-2">
                        <Users className="text-info" style={{ width: '20px', height: '20px' }} />
                      </div>
                      <div className="h4 text-info mb-1">{report.summary?.uniqueClients}</div>
                      <div className="small text-muted">Clients</div>
                    </div>
                    
                    <div className="col-md-3 text-center">
                      <div className="d-flex justify-content-center mb-2">
                        <BarChart3 className="text-warning" style={{ width: '20px', height: '20px' }} />
                      </div>
                      <div className="h4 text-warning mb-1">{report.summary?.rates.production}</div>
                      <div className="small text-muted">Units/Hr</div>
                    </div>
                  </div>
                  
                  <div className="d-flex justify-content-between align-items-center text-muted small">
                    <span>First: {report.summary?.firstEntry.time} - {report.summary?.firstEntry.product}</span>
                    <span>Last: {report.summary?.lastEntry.time} - {report.summary?.lastEntry.product}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Detailed Report View */}
      {selectedReport && !selectedReport.isEmpty && (
        <div className="card mt-4">
          <div className="card-header">
            <h5 className="card-title mb-0">Detailed Report - {selectedReport.displayDate}</h5>
          </div>
          <div className="card-body">
            {/* Timing Summary */}
            <div className="mb-4">
              <h6 className="text-primary mb-3">Timing Summary</h6>
              <div className="row g-3">
                <div className="col-md-4">
                  <div className="p-3 rounded" style={{ backgroundColor: '#d4edda' }}>
                    <div className="small text-success mb-1">First Item</div>
                    <div className="fw-semibold">{selectedReport.summary?.firstEntry.time}</div>
                    <div className="small text-muted">{selectedReport.summary?.firstEntry.product}</div>
                    <div className="small text-muted">{selectedReport.summary?.firstEntry.client}</div>
                  </div>
                </div>
                
                <div className="col-md-4">
                  <div className="p-3 rounded" style={{ backgroundColor: '#f8d7da' }}>
                    <div className="small text-danger mb-1">Last Item</div>
                    <div className="fw-semibold">{selectedReport.summary?.lastEntry.time}</div>
                    <div className="small text-muted">{selectedReport.summary?.lastEntry.product}</div>
                    <div className="small text-muted">{selectedReport.summary?.lastEntry.client}</div>
                  </div>
                </div>
                
                <div className="col-md-4">
                  <div className="p-3 rounded" style={{ backgroundColor: '#fff3cd' }}>
                    <div className="small text-warning mb-1">Production Span</div>
                    <div className="fw-semibold">
                      {selectedReport.summary?.productionSpan.hours}h {selectedReport.summary?.productionSpan.minutes}m
                    </div>
                    <div className="small text-muted">Active Production</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Products */}
            <div className="mb-4">
              <h6 className="text-primary mb-3">Top Products</h6>
              <div className="list-group">
                {selectedReport.topProducts?.slice(0, 5).map((product, index) => (
                  <div key={product.name} className="list-group-item d-flex justify-content-between align-items-center">
                    <span className="fw-medium">{index + 1}. {product.name}</span>
                    <div className="text-muted small">
                      {product.quantity.toLocaleString()} units • {product.items} entries • {product.clients} clients
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Client Summary */}
            <div>
              <h6 className="text-primary mb-3">Client Summary</h6>
              <div className="list-group">
                {selectedReport.clientSummary?.slice(0, 5).map((client, index) => (
                  <div key={client.name} className="list-group-item d-flex justify-content-between align-items-center">
                    <span className="fw-medium">{index + 1}. {client.name}</span>
                    <div className="text-muted small">
                      {client.quantity.toLocaleString()} units • {client.items} items • {client.products} products
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoricalReportsViewer;
