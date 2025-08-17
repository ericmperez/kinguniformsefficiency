import React, { useEffect, useState, useMemo } from "react";
import ProductionTrackingService, { ProductionSummary, ProductionEntry } from "../services/ProductionTrackingService";

interface ClassifiedEntry extends ProductionEntry {
  classification: 'Mangle' | 'Doblado';
  hourMinute: string; // "HH:MM" format
}

interface ProductionGroup {
  classification: 'Mangle' | 'Doblado';
  totalItems: number;
  currentHourRate: number;
  overallHourlyRate: number;
  entries: ClassifiedEntry[];
  uniqueProducts: number;
  clientsCount: number;
  activeInLast30Min: boolean;
  firstEntry?: Date;
  lastEntry?: Date;
}

interface EditableClassification {
  [productName: string]: 'Mangle' | 'Doblado';
}

const ProductionClassificationDashboard: React.FC = () => {
  const [productionSummary, setProductionSummary] = useState<ProductionSummary | null>(null);
  const [customClassifications, setCustomClassifications] = useState<EditableClassification>({});
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Default classification rules
  const getDefaultClassification = (productName: string): 'Mangle' | 'Doblado' => {
    const name = productName.toLowerCase();
    
    // Mangle items (flat items that go through mangle machines)
    if (name.includes('sheet') || 
        name.includes('duvet') || 
        name.includes('sabana') ||
        name.includes('servilleta') ||
        name.includes('funda') ||
        name.includes('fitted sheet king') ||
        name.includes('fitted sheet queen') ||
        name.includes('tablecloth') ||
        name.includes('mantel')) {
      return 'Mangle';
    }
    
    // Everything else is Doblado (folding items)
    return 'Doblado';
  };

  // Get classification for a product (custom override or default)
  const getClassification = (productName: string): 'Mangle' | 'Doblado' => {
    return customClassifications[productName] || getDefaultClassification(productName);
  };

  // Initialize production tracking
  useEffect(() => {
    const productionService = ProductionTrackingService.getInstance();
    
    console.log('🏭 [Classification Dashboard] Starting production tracking');

    // Subscribe to production updates
    const unsubscribe = productionService.subscribe((summary: ProductionSummary) => {
      console.log('🏭 [Classification Dashboard] Received production update:', summary.totalItemsAdded, 'items');
      setProductionSummary(summary);
      setLoading(false);
    });

    // Start tracking
    productionService.startTracking();

    // Cleanup
    return () => {
      console.log('🏭 [Classification Dashboard] Cleaning up production tracking');
      unsubscribe();
      productionService.stopTracking();
    };
  }, []);

  // Load custom classifications from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('productClassifications');
    if (saved) {
      try {
        setCustomClassifications(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading saved classifications:', error);
      }
    }
  }, []);

  // Save custom classifications to localStorage
  const saveClassifications = (classifications: EditableClassification) => {
    setCustomClassifications(classifications);
    localStorage.setItem('productClassifications', JSON.stringify(classifications));
  };

  // Process production entries into classified groups
  const classifiedGroups = useMemo((): { mangle: ProductionGroup; doblado: ProductionGroup } => {
    if (!productionSummary) {
      return {
        mangle: { 
          classification: 'Mangle', 
          totalItems: 0, 
          currentHourRate: 0, 
          overallHourlyRate: 0, 
          entries: [], 
          uniqueProducts: 0, 
          clientsCount: 0, 
          activeInLast30Min: false 
        },
        doblado: { 
          classification: 'Doblado', 
          totalItems: 0, 
          currentHourRate: 0, 
          overallHourlyRate: 0, 
          entries: [], 
          uniqueProducts: 0, 
          clientsCount: 0, 
          activeInLast30Min: false 
        }
      };
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentHourStart = new Date();
    currentHourStart.setHours(currentHour, 0, 0, 0);
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

    // Classify all entries
    const classifiedEntries: ClassifiedEntry[] = productionSummary.recentEntries.map(entry => ({
      ...entry,
      classification: getClassification(entry.productName),
      hourMinute: entry.addedAt.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      })
    }));

    // Group by classification
    const mangleEntries = classifiedEntries.filter(e => e.classification === 'Mangle');
    const dobladoEntries = classifiedEntries.filter(e => e.classification === 'Doblado');

    // Calculate statistics for each group
    const calculateGroupStats = (entries: ClassifiedEntry[]): ProductionGroup => {
      if (entries.length === 0) {
        return {
          classification: entries === mangleEntries ? 'Mangle' : 'Doblado',
          totalItems: 0,
          currentHourRate: 0,
          overallHourlyRate: 0,
          entries: [],
          uniqueProducts: 0,
          clientsCount: 0,
          activeInLast30Min: false
        };
      }

      // Sort by time
      const sortedEntries = [...entries].sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime());
      
      const totalItems = entries.reduce((sum, e) => sum + e.quantity, 0);
      const uniqueProducts = new Set(entries.map(e => e.productName)).size;
      const clientsCount = new Set(entries.map(e => e.clientId)).size;
      
      // Current hour items
      const currentHourEntries = entries.filter(e => e.addedAt >= currentHourStart);
      const currentHourItems = currentHourEntries.reduce((sum, e) => sum + e.quantity, 0);
      
      // Calculate current hour rate
      const minutesIntoCurrentHour = now.getMinutes();
      const hoursIntoCurrentHour = minutesIntoCurrentHour / 60;
      const currentHourRate = hoursIntoCurrentHour > 0 ? currentHourItems / hoursIntoCurrentHour : 0;
      
      // Overall hourly rate
      const firstEntry = sortedEntries[0];
      const lastEntry = sortedEntries[sortedEntries.length - 1];
      const durationMs = Math.max(lastEntry.addedAt.getTime() - firstEntry.addedAt.getTime(), 60000); // Min 1 minute
      const durationHours = durationMs / (1000 * 60 * 60);
      const overallHourlyRate = totalItems / durationHours;
      
      // Check if active in last 30 minutes
      const activeInLast30Min = entries.some(e => e.addedAt >= thirtyMinutesAgo);

      return {
        classification: entries === mangleEntries ? 'Mangle' : 'Doblado',
        totalItems,
        currentHourRate,
        overallHourlyRate,
        entries: entries.sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime()), // Most recent first
        uniqueProducts,
        clientsCount,
        activeInLast30Min,
        firstEntry: firstEntry.addedAt,
        lastEntry: lastEntry.addedAt
      };
    };

    return {
      mangle: calculateGroupStats(mangleEntries),
      doblado: calculateGroupStats(dobladoEntries)
    };
  }, [productionSummary, customClassifications]);

  // Calculate timing summary for all production today
  const timingSummary = useMemo(() => {
    if (!productionSummary || !productionSummary.recentEntries.length) {
      return null;
    }

    const entries = productionSummary.recentEntries;
    const sortedEntries = [...entries].sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime());
    
    const firstEntry = sortedEntries[0];
    const lastEntry = sortedEntries[sortedEntries.length - 1];
    const totalQuantity = entries.reduce((sum, entry) => sum + entry.quantity, 0);
    
    // Calculate production span
    const productionSpanMs = lastEntry.addedAt.getTime() - firstEntry.addedAt.getTime();
    const productionSpanHours = productionSpanMs / (1000 * 60 * 60);
    const productionSpanMinutes = Math.floor((productionSpanMs % (1000 * 60 * 60)) / (1000 * 60));
    
    // Calculate rates
    const now = new Date();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const hoursFromMidnight = (now.getTime() - todayStart.getTime()) / (1000 * 60 * 60);
    const overallHourlyRate = hoursFromMidnight > 0 ? totalQuantity / hoursFromMidnight : 0;
    const productionPeriodRate = productionSpanHours > 0 ? totalQuantity / productionSpanHours : 0;
    
    return {
      firstEntry,
      lastEntry,
      totalQuantity,
      totalEntries: entries.length,
      productionSpanHours: Math.floor(productionSpanHours),
      productionSpanMinutes,
      overallHourlyRate,
      productionPeriodRate,
      uniqueClients: new Set(entries.map(e => e.clientId)).size,
      uniqueProducts: new Set(entries.map(e => e.productName)).size
    };
  }, [productionSummary]);

  // Handle product classification change
  const handleClassificationChange = (productName: string, newClassification: 'Mangle' | 'Doblado') => {
    const updated = { ...customClassifications };
    updated[productName] = newClassification;
    saveClassifications(updated);
  };

  // Get all unique products for editing
  const allProducts = useMemo(() => {
    if (!productionSummary) return [];
    const products = new Set<string>();
    productionSummary.recentEntries.forEach(entry => {
      products.add(entry.productName);
    });
    return Array.from(products).sort();
  }, [productionSummary]);

  const formatRate = (rate: number) => {
    if (rate < 1) return `${(rate * 60).toFixed(1)}/min`;
    return `${Math.round(rate)}/hr`;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  if (loading) {
    return (
      <div className="container-fluid py-4">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Loading production classification data...</p>
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
              <h2 className="mb-1">🏭 Production Classification Dashboard</h2>
              <p className="text-muted">
                Real-time tracking of Mangle vs Doblado production • Auto-updates
              </p>
            </div>
            <button 
              className="btn btn-outline-primary"
              onClick={() => setShowEditModal(true)}
            >
              <i className="fas fa-edit me-2"></i>
              Edit Classifications
            </button>
          </div>
        </div>
      </div>

      {/* Production Timing Summary */}
      {timingSummary && (
        <div className="row mb-4">
          <div className="col-12">
            <div className="card border-primary">
              <div className="card-header bg-primary text-white">
                <h5 className="mb-0">
                  <i className="fas fa-clock me-2"></i>
                  Today's Production Timeline
                </h5>
              </div>
              <div className="card-body">
                <div className="row">
                  {/* First Product */}
                  <div className="col-md-3 col-sm-6 mb-3">
                    <div className="text-center">
                      <div className="text-success mb-1">
                        <i className="fas fa-play-circle" style={{ fontSize: '1.5rem' }}></i>
                      </div>
                      <h6 className="text-success mb-1">First Product Added</h6>
                      <div className="fw-bold" style={{ fontSize: '1.1rem' }}>
                        {formatTime(timingSummary.firstEntry.addedAt)}
                      </div>
                      <small className="text-muted">
                        {timingSummary.firstEntry.productName}<br />
                        {timingSummary.firstEntry.clientName}
                      </small>
                    </div>
                  </div>
                  
                  {/* Last Product */}
                  <div className="col-md-3 col-sm-6 mb-3">
                    <div className="text-center">
                      <div className="text-danger mb-1">
                        <i className="fas fa-stop-circle" style={{ fontSize: '1.5rem' }}></i>
                      </div>
                      <h6 className="text-danger mb-1">Last Product Added</h6>
                      <div className="fw-bold" style={{ fontSize: '1.1rem' }}>
                        {formatTime(timingSummary.lastEntry.addedAt)}
                      </div>
                      <small className="text-muted">
                        {timingSummary.lastEntry.productName}<br />
                        {timingSummary.lastEntry.clientName}
                      </small>
                    </div>
                  </div>
                  
                  {/* Production Span */}
                  <div className="col-md-3 col-sm-6 mb-3">
                    <div className="text-center">
                      <div className="text-warning mb-1">
                        <i className="fas fa-hourglass-half" style={{ fontSize: '1.5rem' }}></i>
                      </div>
                      <h6 className="text-warning mb-1">Production Span</h6>
                      <div className="fw-bold" style={{ fontSize: '1.1rem' }}>
                        {timingSummary.productionSpanHours}h {timingSummary.productionSpanMinutes}m
                      </div>
                      <small className="text-muted">
                        Active production period
                      </small>
                    </div>
                  </div>
                  
                  {/* Production Rate */}
                  <div className="col-md-3 col-sm-6 mb-3">
                    <div className="text-center">
                      <div className="text-info mb-1">
                        <i className="fas fa-tachometer-alt" style={{ fontSize: '1.5rem' }}></i>
                      </div>
                      <h6 className="text-info mb-1">Production Rate</h6>
                      <div className="fw-bold" style={{ fontSize: '1.1rem' }}>
                        {Math.round(timingSummary.productionPeriodRate)}/hr
                      </div>
                      <small className="text-muted">
                        During active period
                      </small>
                    </div>
                  </div>
                </div>
                
                {/* Additional Stats Row */}
                <hr />
                <div className="row text-center">
                  <div className="col-md-3 col-6">
                    <div className="fw-bold text-primary" style={{ fontSize: '1.5rem' }}>
                      {timingSummary.totalQuantity.toLocaleString()}
                    </div>
                    <small className="text-muted">Total Units</small>
                  </div>
                  <div className="col-md-3 col-6">
                    <div className="fw-bold text-primary" style={{ fontSize: '1.5rem' }}>
                      {timingSummary.totalEntries}
                    </div>
                    <small className="text-muted">Total Items</small>
                  </div>
                  <div className="col-md-3 col-6">
                    <div className="fw-bold text-primary" style={{ fontSize: '1.5rem' }}>
                      {timingSummary.uniqueProducts}
                    </div>
                    <small className="text-muted">Product Types</small>
                  </div>
                  <div className="col-md-3 col-6">
                    <div className="fw-bold text-primary" style={{ fontSize: '1.5rem' }}>
                      {timingSummary.uniqueClients}
                    </div>
                    <small className="text-muted">Clients</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hourly Breakdown Table */}
      {timingSummary && productionSummary && productionSummary.recentEntries.length > 0 && (
        <div className="row mb-4">
          <div className="col-12">
            <div className="card">
              <div className="card-header bg-secondary text-white">
                <h5 className="mb-0">
                  <i className="fas fa-chart-bar me-2"></i>
                  Hourly Production Breakdown
                </h5>
              </div>
              <div className="card-body">
                <div className="table-responsive">
                  <table className="table table-striped table-hover">
                    <thead>
                      <tr>
                        <th>Hour</th>
                        <th className="text-center">Items Added</th>
                        <th className="text-center">Units Processed</th>
                        <th className="text-center">Clients</th>
                        <th>Top Products</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        // Group entries by hour
                        const hourlyData: { [hour: number]: {
                          items: number;
                          units: number;
                          clients: Set<string>;
                          products: { [product: string]: number };
                        } } = {};
                        
                        productionSummary.recentEntries.forEach(entry => {
                          const hour = entry.addedAt.getHours();
                          if (!hourlyData[hour]) {
                            hourlyData[hour] = {
                              items: 0,
                              units: 0,
                              clients: new Set(),
                              products: {}
                            };
                          }
                          hourlyData[hour].items++;
                          hourlyData[hour].units += entry.quantity;
                          hourlyData[hour].clients.add(entry.clientName);
                          
                          if (!hourlyData[hour].products[entry.productName]) {
                            hourlyData[hour].products[entry.productName] = 0;
                          }
                          hourlyData[hour].products[entry.productName] += entry.quantity;
                        });

                        // Sort hours and render
                        return Object.keys(hourlyData)
                          .map(Number)
                          .sort((a, b) => a - b)
                          .map(hour => {
                            const data = hourlyData[hour];
                            const hourStr = hour.toString().padStart(2, '0') + ':00';
                            
                            // Get top 3 products for this hour
                            const topProducts = Object.entries(data.products)
                              .sort(([,a], [,b]) => (b as number) - (a as number))
                              .slice(0, 3)
                              .map(([product, qty]) => `${product} (${qty})`)
                              .join(', ');

                            const isCurrentHour = new Date().getHours() === hour;
                            
                            return (
                              <tr key={hour} className={isCurrentHour ? 'table-warning' : ''}>
                                <td>
                                  <span className={`fw-bold ${isCurrentHour ? 'text-warning' : ''}`}>
                                    {hourStr}
                                    {isCurrentHour && <small className="ms-1">(Current)</small>}
                                  </span>
                                </td>
                                <td className="text-center">
                                  <span className="badge bg-primary">{data.items}</span>
                                </td>
                                <td className="text-center">
                                  <span className="fw-bold">{data.units.toLocaleString()}</span>
                                </td>
                                <td className="text-center">
                                  <span className="badge bg-info">{data.clients.size}</span>
                                </td>
                                <td>
                                  <small className="text-muted">{topProducts}</small>
                                </td>
                              </tr>
                            );
                          });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="row mb-4">
        <div className="col-md-6">
          <div className="card border-success h-100">
            <div className="card-header bg-success text-white">
              <h5 className="mb-0">
                <i className="fas fa-compress-arrows-alt me-2"></i>
                Mangle Production
                {classifiedGroups.mangle.activeInLast30Min && (
                  <span className="badge bg-light text-success ms-2">🔴 Live</span>
                )}
              </h5>
            </div>
            <div className="card-body">
              <div className="row text-center mb-3">
                <div className="col-4">
                  <h3 className="text-success">{classifiedGroups.mangle.totalItems.toLocaleString()}</h3>
                  <small className="text-muted">Total Items</small>
                </div>
                <div className="col-4">
                  <h3 className="text-info">{formatRate(classifiedGroups.mangle.currentHourRate)}</h3>
                  <small className="text-muted">Current Rate</small>
                </div>
                <div className="col-4">
                  <h3 className="text-warning">{formatRate(classifiedGroups.mangle.overallHourlyRate)}</h3>
                  <small className="text-muted">Overall Rate</small>
                </div>
              </div>
              <div className="row text-center">
                <div className="col-6">
                  <div className="fw-bold">{classifiedGroups.mangle.uniqueProducts}</div>
                  <small className="text-muted">Product Types</small>
                </div>
                <div className="col-6">
                  <div className="fw-bold">{classifiedGroups.mangle.clientsCount}</div>
                  <small className="text-muted">Clients</small>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card border-warning h-100">
            <div className="card-header bg-warning text-dark">
              <h5 className="mb-0">
                <i className="fas fa-hands me-2"></i>
                Doblado Production
                {classifiedGroups.doblado.activeInLast30Min && (
                  <span className="badge bg-light text-warning ms-2">🔴 Live</span>
                )}
              </h5>
            </div>
            <div className="card-body">
              <div className="row text-center mb-3">
                <div className="col-4">
                  <h3 className="text-warning">{classifiedGroups.doblado.totalItems.toLocaleString()}</h3>
                  <small className="text-muted">Total Items</small>
                </div>
                <div className="col-4">
                  <h3 className="text-info">{formatRate(classifiedGroups.doblado.currentHourRate)}</h3>
                  <small className="text-muted">Current Rate</small>
                </div>
                <div className="col-4">
                  <h3 className="text-primary">{formatRate(classifiedGroups.doblado.overallHourlyRate)}</h3>
                  <small className="text-muted">Overall Rate</small>
                </div>
              </div>
              <div className="row text-center">
                <div className="col-6">
                  <div className="fw-bold">{classifiedGroups.doblado.uniqueProducts}</div>
                  <small className="text-muted">Product Types</small>
                </div>
                <div className="col-6">
                  <div className="fw-bold">{classifiedGroups.doblado.clientsCount}</div>
                  <small className="text-muted">Clients</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Tables */}
      <div className="row">
        {/* Mangle Table */}
        <div className="col-12 mb-4">
          <div className="card">
            <div className="card-header bg-success text-white">
              <h5 className="mb-0">
                <i className="fas fa-compress-arrows-alt me-2"></i>
                Mangle Production Log ({classifiedGroups.mangle.entries.length} entries)
              </h5>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-striped table-hover mb-0">
                  <thead className="table-success">
                    <tr>
                      <th>Time</th>
                      <th>Client Name</th>
                      <th>Product</th>
                      <th>Quantity</th>
                      <th>Added By</th>
                      <th>Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classifiedGroups.mangle.entries.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center text-muted py-4">
                          <i className="fas fa-inbox fa-2x mb-2 d-block opacity-25"></i>
                          No mangle items processed today
                        </td>
                      </tr>
                    ) : (
                      classifiedGroups.mangle.entries.map((entry, index) => (
                        <tr key={`${entry.id}-${index}`}>
                          <td>
                            <span className="badge bg-success">
                              {formatTime(entry.addedAt)}
                            </span>
                          </td>
                          <td className="fw-bold">{entry.clientName}</td>
                          <td>{entry.productName}</td>
                          <td>
                            <span className="badge bg-primary">
                              {entry.quantity.toLocaleString()}
                            </span>
                          </td>
                          <td>
                            <small className="text-muted">{entry.addedBy}</small>
                          </td>
                          <td>
                            <small className="text-muted">#{entry.invoiceId.slice(-6)}</small>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Doblado Table */}
        <div className="col-12 mb-4">
          <div className="card">
            <div className="card-header bg-warning text-dark">
              <h5 className="mb-0">
                <i className="fas fa-hands me-2"></i>
                Doblado Production Log ({classifiedGroups.doblado.entries.length} entries)
              </h5>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-striped table-hover mb-0">
                  <thead className="table-warning">
                    <tr>
                      <th>Time</th>
                      <th>Client Name</th>
                      <th>Product</th>
                      <th>Quantity</th>
                      <th>Added By</th>
                      <th>Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classifiedGroups.doblado.entries.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center text-muted py-4">
                          <i className="fas fa-inbox fa-2x mb-2 d-block opacity-25"></i>
                          No doblado items processed today
                        </td>
                      </tr>
                    ) : (
                      classifiedGroups.doblado.entries.map((entry, index) => (
                        <tr key={`${entry.id}-${index}`}>
                          <td>
                            <span className="badge bg-warning text-dark">
                              {formatTime(entry.addedAt)}
                            </span>
                          </td>
                          <td className="fw-bold">{entry.clientName}</td>
                          <td>{entry.productName}</td>
                          <td>
                            <span className="badge bg-primary">
                              {entry.quantity.toLocaleString()}
                            </span>
                          </td>
                          <td>
                            <small className="text-muted">{entry.addedBy}</small>
                          </td>
                          <td>
                            <small className="text-muted">#{entry.invoiceId.slice(-6)}</small>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Classifications Modal */}
      {showEditModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Edit Product Classifications</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setShowEditModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <p className="text-muted">
                    Change product classifications between Mangle and Doblado. 
                    Default rules: Sheets, Duvets, Sabanas, Servilletas, Fundas, and Fitted Sheets → Mangle. All others → Doblado.
                  </p>
                </div>
                <div className="table-responsive">
                  <table className="table table-striped">
                    <thead>
                      <tr>
                        <th>Product Name</th>
                        <th>Default Classification</th>
                        <th>Current Classification</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allProducts.map(product => {
                        const defaultClass = getDefaultClassification(product);
                        const currentClass = getClassification(product);
                        const isCustom = customClassifications[product] !== undefined;
                        
                        return (
                          <tr key={product} className={isCustom ? 'table-warning' : ''}>
                            <td>{product}</td>
                            <td>
                              <span className={`badge bg-${defaultClass === 'Mangle' ? 'success' : 'warning'}`}>
                                {defaultClass}
                              </span>
                            </td>
                            <td>
                              <span className={`badge bg-${currentClass === 'Mangle' ? 'success' : 'warning'}`}>
                                {currentClass}
                                {isCustom && <span className="ms-1">*</span>}
                              </span>
                            </td>
                            <td>
                              <div className="btn-group" role="group">
                                <button 
                                  className={`btn btn-sm ${currentClass === 'Mangle' ? 'btn-success' : 'btn-outline-success'}`}
                                  onClick={() => handleClassificationChange(product, 'Mangle')}
                                >
                                  Mangle
                                </button>
                                <button 
                                  className={`btn btn-sm ${currentClass === 'Doblado' ? 'btn-warning' : 'btn-outline-warning'}`}
                                  onClick={() => handleClassificationChange(product, 'Doblado')}
                                >
                                  Doblado
                                </button>
                              </div>
                              {isCustom && (
                                <button 
                                  className="btn btn-sm btn-outline-secondary ms-2"
                                  onClick={() => {
                                    const updated = { ...customClassifications };
                                    delete updated[product];
                                    saveClassifications(updated);
                                  }}
                                  title="Reset to default"
                                >
                                  Reset
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="modal-footer">
                <p className="text-muted small me-auto">
                  * indicates custom classification override
                </p>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={() => setShowEditModal(false)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Update Footer */}
      <div className="row mt-4">
        <div className="col-12">
          <div className="alert alert-info text-center">
            <small>
              🔄 This dashboard updates automatically as items are added to invoices. 
              Classifications are saved to your browser.
              {productionSummary && (
                <span> Last update: {productionSummary.lastUpdate.toLocaleString()}</span>
              )}
            </small>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductionClassificationDashboard;
