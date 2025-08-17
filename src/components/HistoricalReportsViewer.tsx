import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
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

  // Load existing reports (this would need to be implemented based on your file system)
  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    try {
      // In a real implementation, you'd fetch from your reports directory
      // For now, this is a placeholder
      setReports([]);
      setFilteredReports([]);
    } catch (error) {
      console.error('Error loading reports:', error);
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
      // This would call your historical report generation script
      console.log('Generating report for:', date);
      // You'd implement the actual generation here
      alert(`Report generation for ${date} would be triggered. Check the terminal for the actual command.`);
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
      console.log('Generating reports for range:', dateRange.start, 'to', dateRange.end);
      alert(`Batch report generation would be triggered for ${dateRange.start} to ${dateRange.end}. Check the terminal for the actual command.`);
    } catch (error) {
      console.error('Error generating date range:', error);
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
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading historical reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Historical Production Reports</h1>
          <p className="text-gray-600 mt-1">Search and analyze production data across any date range</p>
        </div>
        <Badge variant="outline" className="px-3 py-1">
          <FileText className="w-4 h-4 mr-2" />
          {filteredReports.length} Reports
        </Badge>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="w-5 h-5 mr-2" />
            Report Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="flex items-center space-x-2">
            <Search className="w-5 h-5 text-gray-400" />
            <Input
              placeholder="Search by date, client, product, or any keyword..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>

          {/* Date Range */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              <Input
                type="date"
                placeholder="Start Date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              />
            </div>
            <span className="text-gray-400">to</span>
            <Input
              type="date"
              placeholder="End Date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            />
            <Button 
              onClick={generateDateRange} 
              disabled={generating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {generating ? 'Generating...' : 'Generate Range'}
            </Button>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              onClick={() => generateReport(new Date().toISOString().split('T')[0])}
              disabled={generating}
            >
              <Activity className="w-4 h-4 mr-2" />
              Generate Today
            </Button>
            <Button 
              variant="outline" 
              onClick={() => generateReport(new Date(Date.now() - 24*60*60*1000).toISOString().split('T')[0])}
              disabled={generating}
            >
              <Clock className="w-4 h-4 mr-2" />
              Generate Yesterday
            </Button>
            <Button variant="outline" onClick={loadReports}>
              <FileText className="w-4 h-4 mr-2" />
              Refresh Reports
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Command Line Instructions */}
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="text-orange-800 flex items-center">
            <FileText className="w-5 h-5 mr-2" />
            Command Line Usage
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-orange-700">
          <p className="mb-2">Use the terminal to generate reports with these commands:</p>
          <div className="bg-orange-100 p-3 rounded font-mono text-xs space-y-1">
            <div><strong>Today's Report:</strong> node historical-production-report.js today</div>
            <div><strong>Specific Date:</strong> node historical-production-report.js date 2024-01-15</div>
            <div><strong>Date Range:</strong> node historical-production-report.js range 2024-01-01 2024-01-31</div>
            <div><strong>Search Reports:</strong> node historical-production-report.js search "client name"</div>
          </div>
        </CardContent>
      </Card>

      {/* Reports List */}
      {filteredReports.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Reports Found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || dateRange.start || dateRange.end 
                ? 'No reports match your current filters. Try adjusting your search criteria.' 
                : 'No production reports have been generated yet. Use the commands above to generate reports.'}
            </p>
            <Button onClick={() => {setSearchTerm(''); setDateRange({start: '', end: ''});}}>
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {filteredReports.map((report) => (
            <Card 
              key={report.date} 
              className={`cursor-pointer transition-all hover:shadow-lg ${
                selectedReport?.date === report.date ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => setSelectedReport(selectedReport?.date === report.date ? null : report)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center">
                      <Calendar className="w-5 h-5 mr-2" />
                      {report.displayDate}
                    </CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      Report generated on {new Date(report.generatedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {report.isEmpty ? (
                      <Badge variant="secondary" className="bg-gray-100">No Activity</Badge>
                    ) : (
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        {report.summary?.totalQuantity.toLocaleString()} Units
                      </Badge>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        exportReport(report);
                      }}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              {!report.isEmpty && (
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="text-center">
                      <div className="flex items-center justify-center mb-1">
                        <Package className="w-4 h-4 text-blue-600 mr-1" />
                      </div>
                      <div className="text-2xl font-bold text-blue-600">{report.summary?.totalItems}</div>
                      <div className="text-xs text-gray-600">Items</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="flex items-center justify-center mb-1">
                        <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                      </div>
                      <div className="text-2xl font-bold text-green-600">{report.summary?.totalQuantity.toLocaleString()}</div>
                      <div className="text-xs text-gray-600">Units</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="flex items-center justify-center mb-1">
                        <Users className="w-4 h-4 text-purple-600 mr-1" />
                      </div>
                      <div className="text-2xl font-bold text-purple-600">{report.summary?.uniqueClients}</div>
                      <div className="text-xs text-gray-600">Clients</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="flex items-center justify-center mb-1">
                        <BarChart3 className="w-4 h-4 text-orange-600 mr-1" />
                      </div>
                      <div className="text-2xl font-bold text-orange-600">{report.summary?.rates.production}</div>
                      <div className="text-xs text-gray-600">Units/Hr</div>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-600">
                    <div className="flex justify-between items-center">
                      <span>First: {report.summary?.firstEntry.time} - {report.summary?.firstEntry.product}</span>
                      <span>Last: {report.summary?.lastEntry.time} - {report.summary?.lastEntry.product}</span>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Detailed Report View */}
      {selectedReport && !selectedReport.isEmpty && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Detailed Report - {selectedReport.displayDate}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Timing Summary */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Timing Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-sm text-green-700 mb-1">First Item</div>
                  <div className="font-semibold">{selectedReport.summary?.firstEntry.time}</div>
                  <div className="text-sm text-gray-600">{selectedReport.summary?.firstEntry.product}</div>
                  <div className="text-sm text-gray-600">{selectedReport.summary?.firstEntry.client}</div>
                </div>
                
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="text-sm text-red-700 mb-1">Last Item</div>
                  <div className="font-semibold">{selectedReport.summary?.lastEntry.time}</div>
                  <div className="text-sm text-gray-600">{selectedReport.summary?.lastEntry.product}</div>
                  <div className="text-sm text-gray-600">{selectedReport.summary?.lastEntry.client}</div>
                </div>
                
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <div className="text-sm text-yellow-700 mb-1">Production Span</div>
                  <div className="font-semibold">
                    {selectedReport.summary?.productionSpan.hours}h {selectedReport.summary?.productionSpan.minutes}m
                  </div>
                  <div className="text-sm text-gray-600">Active Production</div>
                </div>
              </div>
            </div>

            {/* Top Products */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Top Products</h3>
              <div className="space-y-2">
                {selectedReport.topProducts?.slice(0, 5).map((product, index) => (
                  <div key={product.name} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span className="font-medium">{index + 1}. {product.name}</span>
                    <div className="text-sm text-gray-600">
                      {product.quantity.toLocaleString()} units • {product.items} entries • {product.clients} clients
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Client Summary */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Client Summary</h3>
              <div className="space-y-2">
                {selectedReport.clientSummary?.slice(0, 5).map((client, index) => (
                  <div key={client.name} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span className="font-medium">{index + 1}. {client.name}</span>
                    <div className="text-sm text-gray-600">
                      {client.quantity.toLocaleString()} units • {client.items} items • {client.products} products
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default HistoricalReportsViewer;
