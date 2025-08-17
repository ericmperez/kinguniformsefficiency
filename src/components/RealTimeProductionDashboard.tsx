import React, { useEffect, useState } from 'react';
import ProductionTrackingService, { ProductionSummary, ProductionRate, ProductionEntry } from '../services/ProductionTrackingService';
import { useRealTimeIndicator } from '../hooks/useRealTimeIndicator';
import RealTimeIndicator from './RealTimeIndicator';

const RealTimeProductionDashboard: React.FC = () => {
  const [productionSummary, setProductionSummary] = useState<ProductionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  // Real-time indicators
  const productionIndicator = useRealTimeIndicator('Production Data');

  useEffect(() => {
    const productionService = ProductionTrackingService.getInstance();

    console.log('🏭 [Production Dashboard] Starting production tracking');
    productionIndicator.setUpdating(true);

    // Subscribe to production updates
    const unsubscribe = productionService.subscribe((summary: ProductionSummary) => {
      console.log('🏭 [Production Dashboard] Received production update:', summary.totalItems, 'items');
      setProductionSummary(summary);
      setLoading(false);
      productionIndicator.markUpdate('Production Data');
    });

    // Start tracking
    productionService.startTracking();

    // Cleanup
    return () => {
      console.log('🏭 [Production Dashboard] Cleaning up production tracking');
      unsubscribe();
      productionService.stopTracking();
    };
  }, []);

  const formatRate = (rate: number, type: 'hour' | 'minute' = 'hour') => {
    if (rate < 1) return `${(rate * 60).toFixed(1)}/min`;
    return type === 'hour' ? `${Math.round(rate)}/hr` : `${rate.toFixed(1)}/min`;
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return `${hours}h ${remainingMinutes}m`;
  };

  const formatQuantity = (quantity: number, type: 'lbs' | 'qty' | 'cart') => {
    switch (type) {
      case 'lbs':
        return `${Math.round(quantity)} lbs`;
      case 'cart':
        return `${quantity} ${quantity === 1 ? 'cart' : 'carts'}`;
      default:
        return `${quantity} items`;
    }
  };

  const getProductIcon = (productName: string) => {
    const name = productName.toLowerCase();
    if (name.includes('sabana')) return '🛏️';
    if (name.includes('towel') || name.includes('toalla')) return '🏖️';
    if (name.includes('uniform') || name.includes('scrub')) return '👔';
    if (name.includes('blanket') || name.includes('colcha') || name.includes('manta')) return '🛌';
    if (name.includes('sheet')) return '📄';
    if (name.includes('pickup') || name.includes('weight')) return '⚖️';
    return '📦';
  };

  const getActivityLevel = (rate: ProductionRate) => {
    if (!rate.isActive) return { level: 'inactive', color: 'text-muted', badge: 'bg-secondary' };
    if (rate.ratePerHour > 100) return { level: 'high', color: 'text-success', badge: 'bg-success' };
    if (rate.ratePerHour > 50) return { level: 'medium', color: 'text-primary', badge: 'bg-primary' };
    return { level: 'low', color: 'text-warning', badge: 'bg-warning' };
  };

  if (loading) {
    return (
      <div className="container-fluid py-4">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Loading production data...</p>
        </div>
      </div>
    );
  }

  if (!productionSummary || productionSummary.totalItems === 0) {
    return (
      <div className="container-fluid py-4">
        <div className="row mb-4">
          <div className="col-12">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h2 className="mb-1">🏭 Real-Time Production Tracking</h2>
                <p className="text-muted">
                  Monitor production rates for items being processed
                </p>
              </div>
              <RealTimeIndicator 
                status={productionIndicator.status} 
                size="small" 
                showDetails={true}
              />
            </div>
          </div>
        </div>

        <div className="alert alert-info text-center">
          <h4 className="mb-3">🏭 No Production Activity Yet</h4>
          <p className="mb-0">
            Production tracking will show rates once users start adding items that are not "Unknown". 
            <br />
            The system tracks items from manual conventional products and pickup entries.
          </p>
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
              <h2 className="mb-1">🏭 Real-Time Production Tracking</h2>
              <p className="text-muted">
                Live production rates • Updates automatically • {productionSummary.totalItems} items processed today
              </p>
            </div>
            <RealTimeIndicator 
              status={productionIndicator.status} 
              size="small" 
              showDetails={true}
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="row mb-4">
        <div className="col-md-3 mb-3">
          <div className="card border-primary h-100">
            <div className="card-body text-center">
              <div className="display-6 text-primary mb-2">
                <i className="bi bi-boxes"></i>
              </div>
              <h3 className="text-primary mb-1">
                {productionSummary.totalItems.toLocaleString()}
              </h3>
              <h6 className="card-title">Total Items Processed</h6>
              <small className="text-muted">
                Across {productionSummary.totalUniqueProducts} product types
              </small>
            </div>
          </div>
        </div>

        <div className="col-md-3 mb-3">
          <div className="card border-success h-100">
            <div className="card-body text-center">
              <div className="display-6 text-success mb-2">
                <i className="bi bi-activity"></i>
              </div>
              <h3 className="text-success mb-1">
                {productionSummary.activeProducts}
              </h3>
              <h6 className="card-title">Active Products</h6>
              <small className="text-muted">
                Currently being processed (last 30min)
              </small>
            </div>
          </div>
        </div>

        <div className="col-md-3 mb-3">
          <div className="card border-info h-100">
            <div className="card-body text-center">
              <div className="display-6 text-info mb-2">
                <i className="bi bi-speedometer2"></i>
              </div>
              <h3 className="text-info mb-1">
                {productionSummary.topProducts.length > 0 
                  ? Math.round(productionSummary.topProducts[0].ratePerHour)
                  : 0
                }/hr
              </h3>
              <h6 className="card-title">Top Production Rate</h6>
              <small className="text-muted">
                {productionSummary.topProducts.length > 0 
                  ? productionSummary.topProducts[0].productName
                  : 'No data'
                }
              </small>
            </div>
          </div>
        </div>

        <div className="col-md-3 mb-3">
          <div className="card border-warning h-100">
            <div className="card-body text-center">
              <div className="display-6 text-warning mb-2">
                <i className="bi bi-clock"></i>
              </div>
              <h3 className="text-warning mb-1">
                {productionSummary.recentEntries.length}
              </h3>
              <h6 className="card-title">Recent Entries</h6>
              <small className="text-muted">
                Last updated: {productionSummary.lastUpdate.toLocaleTimeString()}
              </small>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        {/* Production Rates Table */}
        <div className="col-lg-8 mb-4">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">📊 Production Rates by Item</h5>
            </div>
            <div className="card-body">
              {productionSummary.topProducts.length === 0 ? (
                <div className="text-center text-muted py-4">
                  No production data available
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th className="text-center">Quantity</th>
                        <th className="text-center">Rate/Hour</th>
                        <th className="text-center">Duration</th>
                        <th className="text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productionSummary.topProducts.map((rate, index) => {
                        const activity = getActivityLevel(rate);
                        return (
                          <tr 
                            key={rate.productName}
                            className={selectedProduct === rate.productName ? 'table-active' : ''}
                            onClick={() => setSelectedProduct(
                              selectedProduct === rate.productName ? null : rate.productName
                            )}
                            style={{ cursor: 'pointer' }}
                          >
                            <td>
                              <div className="d-flex align-items-center">
                                <span className="me-2" style={{ fontSize: '1.2em' }}>
                                  {getProductIcon(rate.productName)}
                                </span>
                                <div>
                                  <div className="fw-bold">{rate.productName}</div>
                                  <small className="text-muted">
                                    {rate.entriesCount} entries
                                  </small>
                                </div>
                              </div>
                            </td>
                            <td className="text-center">
                              <span className="fw-bold">
                                {rate.totalQuantity.toLocaleString()}
                              </span>
                            </td>
                            <td className="text-center">
                              <span className={`fw-bold ${activity.color}`}>
                                {formatRate(rate.ratePerHour)}
                              </span>
                            </td>
                            <td className="text-center">
                              <small className="text-muted">
                                {formatDuration(rate.durationMinutes)}
                              </small>
                            </td>
                            <td className="text-center">
                              <span className={`badge ${activity.badge}`}>
                                {rate.isActive ? '🔴 Active' : '⚫ Inactive'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="col-lg-4 mb-4">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">⚡ Recent Activity</h5>
            </div>
            <div className="card-body">
              <div 
                className="activity-feed" 
                style={{ maxHeight: '500px', overflowY: 'auto' }}
              >
                {productionSummary.recentEntries.length === 0 ? (
                  <div className="text-center text-muted py-4">
                    No recent activity
                  </div>
                ) : (
                  productionSummary.recentEntries.map((entry) => (
                    <div key={entry.id} className="d-flex align-items-start mb-3">
                      <span className="me-3" style={{ fontSize: '1.2em', marginTop: '2px' }}>
                        {getProductIcon(entry.productName)}
                      </span>
                      <div className="flex-grow-1">
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <strong>{entry.productName}</strong>
                            <br />
                            <small className="text-muted">
                              {entry.clientName} • {formatQuantity(entry.quantity, entry.type)}
                            </small>
                          </div>
                          <small className="text-muted">
                            {entry.timestamp.toLocaleTimeString([], { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </small>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Product Details */}
      {selectedProduct && (
        <div className="row">
          <div className="col-12">
            <div className="card border-info">
              <div className="card-header bg-info text-white">
                <h5 className="mb-0">
                  📊 Production Details: {selectedProduct}
                </h5>
              </div>
              <div className="card-body">
                {(() => {
                  const productRate = productionSummary.topProducts.find(r => r.productName === selectedProduct);
                  if (!productRate) return null;

                  const activity = getActivityLevel(productRate);
                  
                  return (
                    <div className="row">
                      <div className="col-md-3">
                        <div className="text-center">
                          <h3 className="text-primary">{productRate.totalQuantity.toLocaleString()}</h3>
                          <small className="text-muted">Total Quantity</small>
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div className="text-center">
                          <h3 className={activity.color}>{formatRate(productRate.ratePerHour)}</h3>
                          <small className="text-muted">Production Rate</small>
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div className="text-center">
                          <h3 className="text-info">{productRate.entriesCount}</h3>
                          <small className="text-muted">Number of Entries</small>
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div className="text-center">
                          <h3 className="text-warning">{formatDuration(productRate.durationMinutes)}</h3>
                          <small className="text-muted">Time Period</small>
                        </div>
                      </div>
                    </div>
                  );
                })()}
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
              🔄 This dashboard updates automatically in real-time as items are added to the system. 
              Production rates are calculated based on activity duration and exclude "Unknown" items. 
              Last update: {productionSummary.lastUpdate.toLocaleString()}
            </small>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealTimeProductionDashboard;
