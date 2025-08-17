import React, { useEffect, useState, useMemo } from "react";
import { collection, query, where, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useRealTimeIndicator } from "../hooks/useRealTimeIndicator";
import RealTimeIndicator from "./RealTimeIndicator";
import ProductionTrackingService, { ProductionSummary } from "../services/ProductionTrackingService";

interface TodayMetrics {
  totalPoundsEntered: number;
  totalPoundsWashedTunnel: number;
  totalItemsProcessed: number;
  totalInvoices: number;
  totalPickupEntries: number;
  totalTunnelGroupsWashed: number;
  lastUpdate: Date;
}

interface PickupEntry {
  id: string;
  weight: number;
  timestamp: Date;
  clientName: string;
  driverName: string;
  groupId: string;
}

interface PickupGroup {
  id: string;
  clientName: string;
  totalWeight: number;
  status: string;
  washed: boolean;
  washingType?: string;
  startTime: Date;
}

interface TunnelGroup {
  id: string;
  clientName: string;
  totalWeight: number;
  status: string;
  washed: boolean;
  washingType?: string;
  segregatedCarts: number;
  carts: any[];
  startTime: Date;
  processedWeight?: number;
  remainingWeight?: number;
  progress?: number;
}

interface Invoice {
  id: string;
  clientName: string;
  date: string;
  carts: Array<{
    items: Array<{
      productName: string;
      quantity: number;
      price: number;
    }>;
  }>;
  totalWeight: number;
}

const RealTimeOperationsDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<TodayMetrics>({
    totalPoundsEntered: 0,
    totalPoundsWashedTunnel: 0,
    totalItemsProcessed: 0,
    totalInvoices: 0,
    totalPickupEntries: 0,
    totalTunnelGroupsWashed: 0,
    lastUpdate: new Date(),
  });

  const [pickupEntries, setPickupEntries] = useState<PickupEntry[]>([]);
  const [pickupGroups, setPickupGroups] = useState<PickupGroup[]>([]);
  const [tunnelGroups, setTunnelGroups] = useState<TunnelGroup[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [productionSummary, setProductionSummary] = useState<ProductionSummary | null>(null);

  // Real-time indicators
  const pickupIndicator = useRealTimeIndicator('Pickup Data');
  const tunnelIndicator = useRealTimeIndicator('Tunnel Operations');
  const invoiceIndicator = useRealTimeIndicator('Invoice Processing');
  const productionIndicator = useRealTimeIndicator('Production Tracking');

  // Get today's date range
  const todayRange = useMemo(() => {
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    
    return {
      start: Timestamp.fromDate(startOfDay),
      end: Timestamp.fromDate(endOfDay),
      dateString: today.toISOString().slice(0, 10)
    };
  }, []);

  // Real-time listener for pickup entries
  useEffect(() => {
    pickupIndicator.setUpdating(true);
    
    const q = query(
      collection(db, "pickup_entries"),
      where("timestamp", ">=", todayRange.start),
      where("timestamp", "<=", todayRange.end)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entries: PickupEntry[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          weight: data.weight || 0,
          timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate() : new Date(data.timestamp),
          clientName: data.clientName || '',
          driverName: data.driverName || '',
          groupId: data.groupId || '',
        };
      });

      setPickupEntries(entries);
      pickupIndicator.markUpdate('Pickup Entries');
      console.log('📊 Pickup entries updated:', entries.length);
    });

    return () => unsubscribe();
  }, [todayRange.start, todayRange.end]);

  // Initialize production tracking
  useEffect(() => {
    const productionService = ProductionTrackingService.getInstance();
    
    console.log('🏭 [Operations Dashboard] Starting production tracking');
    productionIndicator.setUpdating(true);

    // Subscribe to production updates
    const unsubscribeProduction = productionService.subscribe((summary: ProductionSummary) => {
      console.log('🏭 [Operations Dashboard] Received production update:', summary.totalItemsAdded, 'items');
      setProductionSummary(summary);
      productionIndicator.markUpdate('Production Data');
    });

    // Start tracking
    productionService.startTracking();

    // Cleanup
    return () => {
      console.log('🏭 [Operations Dashboard] Cleaning up production tracking');
      unsubscribeProduction();
      productionService.stopTracking();
    };
  }, []);

  // Real-time listener for pickup groups (tunnel washing)
  useEffect(() => {
    tunnelIndicator.setUpdating(true);
    
    const q = query(
      collection(db, "pickup_groups"),
      where("startTime", ">=", todayRange.start),
      where("startTime", "<=", todayRange.end)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const groups: PickupGroup[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          clientName: data.clientName || '',
          totalWeight: data.totalWeight || 0,
          status: data.status || '',
          washed: data.washed || false,
          washingType: data.washingType || '',
          startTime: data.startTime instanceof Timestamp ? data.startTime.toDate() : new Date(data.startTime),
        };
      });

      setPickupGroups(groups);
      
      // Filter and enhance tunnel groups
      const tunnelGroupsData: TunnelGroup[] = groups
        .filter(group => 
          (group.status === 'Tunnel' || group.washingType === 'Tunnel') &&
          group.status !== 'deleted' && 
          group.status !== 'Entregado'
        )
        .map(group => {
          const data = snapshot.docs.find(doc => doc.id === group.id)?.data();
          const segregatedCarts = data?.segregatedCarts || 0;
          const carts = data?.carts || [];
          
          // Calculate processed and remaining weight
          // For tunnel groups, segregatedCarts indicates how many carts have been processed
          const totalCarts = carts.length || 1; // fallback to 1 if no carts array
          const processedRatio = totalCarts > 0 ? segregatedCarts / totalCarts : 0;
          const processedWeight = group.totalWeight * processedRatio;
          const remainingWeight = group.totalWeight - processedWeight;
          const progress = group.totalWeight > 0 ? (processedWeight / group.totalWeight) * 100 : 0;
          
          return {
            ...group,
            segregatedCarts,
            carts,
            processedWeight,
            remainingWeight,
            progress
          };
        })
        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime()); // Sort by time added
      
      setTunnelGroups(tunnelGroupsData);
      tunnelIndicator.markUpdate('Pickup Groups');
      console.log('🔄 Pickup groups updated:', groups.length);
      console.log('🏗️ Tunnel groups updated:', tunnelGroupsData.length);
    });

    return () => unsubscribe();
  }, [todayRange.start, todayRange.end]);

  // Real-time listener for invoices
  useEffect(() => {
    invoiceIndicator.setUpdating(true);
    
    const q = query(
      collection(db, "invoices"),
      where("date", ">=", todayRange.dateString),
      where("date", "<=", todayRange.dateString)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const todayInvoices: Invoice[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          clientName: data.clientName || '',
          date: data.date || '',
          carts: data.carts || [],
          totalWeight: data.totalWeight || 0,
        };
      }).filter(invoice => {
        // Double-check date filtering
        return invoice.date === todayRange.dateString;
      });

      setInvoices(todayInvoices);
      invoiceIndicator.markUpdate('Invoices');
      console.log('📄 Invoices updated:', todayInvoices.length);
    });

    return () => unsubscribe();
  }, [todayRange.dateString]);

  // Calculate metrics when data changes
  useEffect(() => {
    // Total pounds entered today
    const totalPoundsEntered = pickupEntries.reduce((sum, entry) => sum + entry.weight, 0);

    // Total pounds washed in Tunnel today (groups with Tunnel status and washed=true)
    const tunnelGroupsWashed = pickupGroups.filter(group => 
      (group.status === 'Tunnel' || group.washingType === 'Tunnel') && group.washed
    );
    const totalPoundsWashedTunnel = tunnelGroupsWashed.reduce((sum, group) => sum + group.totalWeight, 0);

    // Total items processed today (from invoices)
    const totalItemsProcessed = invoices.reduce((sum, invoice) => {
      return sum + invoice.carts.reduce((cartSum, cart) => {
        return cartSum + (cart.items || []).reduce((itemSum, item) => itemSum + (item.quantity || 0), 0);
      }, 0);
    }, 0);

    const newMetrics: TodayMetrics = {
      totalPoundsEntered,
      totalPoundsWashedTunnel,
      totalItemsProcessed,
      totalInvoices: invoices.length,
      totalPickupEntries: pickupEntries.length,
      totalTunnelGroupsWashed: tunnelGroupsWashed.length,
      lastUpdate: new Date(),
    };

    setMetrics(newMetrics);
    setLoading(false);

    console.log('📊 Metrics calculated:', newMetrics);
  }, [pickupEntries, pickupGroups, tunnelGroups, invoices, productionSummary]);

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const formatWeight = (weight: number) => {
    return `${Math.round(weight).toLocaleString()} lbs`;
  };

  if (loading) {
    return (
      <div className="container-fluid py-4">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Loading real-time operations data...</p>
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
              <h2 className="mb-1">⚡ Real-Time Operations Dashboard</h2>
              <p className="text-muted">
                Live metrics for today's operations • Updates automatically
              </p>
            </div>
            <div className="d-flex gap-3">
              <RealTimeIndicator 
                status={pickupIndicator.status} 
                size="small" 
                showDetails={true}
              />
              <RealTimeIndicator 
                status={tunnelIndicator.status} 
                size="small" 
                showDetails={true}
              />
              <RealTimeIndicator 
                status={invoiceIndicator.status} 
                size="small" 
                showDetails={true}
              />
              <RealTimeIndicator 
                status={productionIndicator.status} 
                size="small" 
                showDetails={true}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Metrics Cards */}
      <div className="row mb-4">
        <div className="col-md-3 mb-3">
          <div className="card border-info h-100">
            <div className="card-body text-center">
              <div className="display-4 text-info mb-2">
                <i className="bi bi-speedometer2"></i>
              </div>
              <h2 className="text-info mb-1">
                {formatNumber(productionSummary?.totalItemsAdded || 0)}
              </h2>
              <h5 className="card-title">Items Added to Invoices Today</h5>
              <p className="text-muted mb-2">
                {productionSummary?.activeProducts || 0} active products
                {productionSummary && productionSummary.currentHourRate > 0 && (
                  <span> • {Math.round(productionSummary.currentHourRate)}/hr current rate</span>
                )}
              </p>
              <small className="text-muted">
                Real-time invoice item tracking
              </small>
            </div>
          </div>
        </div>

        <div className="col-md-3 mb-3">
          <div className="card border-primary h-100">
            <div className="card-body text-center">
              <div className="display-4 text-primary mb-2">
                <i className="bi bi-inbox"></i>
              </div>
              <h2 className="text-primary mb-1">
                {formatWeight(metrics.totalPoundsEntered)}
              </h2>
              <h5 className="card-title">Total Pounds Entered Today</h5>
              <p className="text-muted mb-2">
                From {formatNumber(metrics.totalPickupEntries)} pickup entries
              </p>
              <small className="text-muted">
                Last updated: {metrics.lastUpdate.toLocaleTimeString()}
              </small>
            </div>
          </div>
        </div>

        <div className="col-md-3 mb-3">
          <div className="card border-success h-100">
            <div className="card-body text-center">
              <div className="display-4 text-success mb-2">
                <i className="bi bi-arrow-repeat"></i>
              </div>
              <h2 className="text-success mb-1">
                {formatWeight(metrics.totalPoundsWashedTunnel)}
              </h2>
              <h5 className="card-title">Pounds Washed in Tunnel Today</h5>
              <p className="text-muted mb-2">
                From {formatNumber(metrics.totalTunnelGroupsWashed)} tunnel groups completed
              </p>
              <small className="text-muted">
                Last updated: {metrics.lastUpdate.toLocaleTimeString()}
              </small>
            </div>
          </div>
        </div>

        <div className="col-md-3 mb-3">
          <div className="card border-warning h-100">
            <div className="card-body text-center">
              <div className="display-4 text-warning mb-2">
                <i className="bi bi-box-seam"></i>
              </div>
              <h2 className="text-warning mb-1">
                {formatNumber(metrics.totalItemsProcessed)}
              </h2>
              <h5 className="card-title">Items Processed Today</h5>
              <p className="text-muted mb-2">
                From {formatNumber(metrics.totalInvoices)} invoices created
              </p>
              <small className="text-muted">
                Last updated: {metrics.lastUpdate.toLocaleTimeString()}
              </small>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="row mb-4">
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">📊 Today's Pickup Summary</h5>
            </div>
            <div className="card-body">
              <div className="row text-center">
                <div className="col-6">
                  <div className="border-end">
                    <h4 className="text-primary">{formatNumber(metrics.totalPickupEntries)}</h4>
                    <small className="text-muted">Total Entries</small>
                  </div>
                </div>
                <div className="col-6">
                  <h4 className="text-primary">{formatWeight(metrics.totalPoundsEntered)}</h4>
                  <small className="text-muted">Total Weight</small>
                </div>
              </div>
              <hr />
              <div className="d-flex justify-content-between">
                <span>Average per entry:</span>
                <strong>
                  {metrics.totalPickupEntries > 0 
                    ? formatWeight(metrics.totalPoundsEntered / metrics.totalPickupEntries)
                    : '0 lbs'
                  }
                </strong>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">🔄 Today's Tunnel Operations</h5>
            </div>
            <div className="card-body">
              <div className="row text-center">
                <div className="col-6">
                  <div className="border-end">
                    <h4 className="text-success">{formatNumber(metrics.totalTunnelGroupsWashed)}</h4>
                    <small className="text-muted">Groups Washed</small>
                  </div>
                </div>
                <div className="col-6">
                  <h4 className="text-success">{formatWeight(metrics.totalPoundsWashedTunnel)}</h4>
                  <small className="text-muted">Weight Processed</small>
                </div>
              </div>
              <hr />
              <div className="d-flex justify-content-between">
                <span>Average per group:</span>
                <strong>
                  {metrics.totalTunnelGroupsWashed > 0 
                    ? formatWeight(metrics.totalPoundsWashedTunnel / metrics.totalTunnelGroupsWashed)
                    : '0 lbs'
                  }
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Real-Time Tunnel Groups Section */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0 d-flex align-items-center justify-content-between">
                <span>🏗️ Real-Time Tunnel Groups Progress</span>
                <span className="badge bg-primary">
                  {tunnelGroups.length} Active Groups
                </span>
              </h5>
            </div>
            <div className="card-body">
              {tunnelGroups.length === 0 ? (
                <div className="text-center text-muted py-4">
                  <i className="bi bi-hourglass-split" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
                  <p className="mt-2 mb-0">No tunnel groups in progress today</p>
                </div>
              ) : (
                <div className="row">
                  {tunnelGroups.map((group, index) => (
                    <div key={group.id} className="col-md-6 col-lg-4 mb-3">
                      <div className="card h-100 border-primary">
                        <div className="card-body">
                          <div className="d-flex justify-content-between align-items-start mb-2">
                            <h6 className="card-title mb-0 text-primary fw-bold">
                              {group.clientName}
                            </h6>
                            <span className="badge bg-light text-dark">
                              #{index + 1}
                            </span>
                          </div>
                          
                          {/* Progress Bar */}
                          <div className="mb-2">
                            <div className="d-flex justify-content-between align-items-center mb-1">
                              <small className="text-muted">Progress</small>
                              <small className="fw-bold text-primary">
                                {Math.round(group.progress || 0)}%
                              </small>
                            </div>
                            <div className="progress" style={{ height: '8px' }}>
                              <div 
                                className="progress-bar bg-success" 
                                style={{ width: `${group.progress || 0}%` }}
                              ></div>
                            </div>
                          </div>

                          {/* Weight Information */}
                          <div className="row text-center mb-2">
                            <div className="col-4">
                              <div className="text-success fw-bold">
                                {Math.round(group.processedWeight || 0)}
                              </div>
                              <small className="text-muted d-block" style={{ fontSize: '0.7rem' }}>
                                Processed
                              </small>
                            </div>
                            <div className="col-4">
                              <div className="text-warning fw-bold">
                                {Math.round(group.remainingWeight || 0)}
                              </div>
                              <small className="text-muted d-block" style={{ fontSize: '0.7rem' }}>
                                Remaining
                              </small>
                            </div>
                            <div className="col-4">
                              <div className="text-primary fw-bold">
                                {Math.round(group.totalWeight)}
                              </div>
                              <small className="text-muted d-block" style={{ fontSize: '0.7rem' }}>
                                Total lbs
                              </small>
                            </div>
                          </div>

                          {/* Status Information */}
                          <div className="d-flex justify-content-between align-items-center">
                            <div>
                              <span className={`badge ${
                                group.washed ? 'bg-success' : 'bg-warning'
                              }`}>
                                {group.washed ? '✓ Washed' : '⏳ In Progress'}
                              </span>
                            </div>
                            <div className="text-end">
                              <small className="text-muted d-block">
                                {group.segregatedCarts}/{group.carts.length || 1} carts
                              </small>
                              <small className="text-muted">
                                Started: {group.startTime.toLocaleTimeString([], { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </small>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Summary Stats */}
              {tunnelGroups.length > 0 && (
                <div className="border-top pt-3 mt-3">
                  <div className="row text-center">
                    <div className="col-md-3">
                      <div className="fw-bold text-success">
                        {formatWeight(tunnelGroups.reduce((sum, g) => sum + (g.processedWeight || 0), 0))}
                      </div>
                      <small className="text-muted">Total Processed</small>
                    </div>
                    <div className="col-md-3">
                      <div className="fw-bold text-warning">
                        {formatWeight(tunnelGroups.reduce((sum, g) => sum + (g.remainingWeight || 0), 0))}
                      </div>
                      <small className="text-muted">Total Remaining</small>
                    </div>
                    <div className="col-md-3">
                      <div className="fw-bold text-success">
                        {tunnelGroups.filter(g => g.washed).length}
                      </div>
                      <small className="text-muted">Completed Groups</small>
                    </div>
                    <div className="col-md-3">
                      <div className="fw-bold text-info">
                        {Math.round(tunnelGroups.reduce((sum, g) => sum + (g.progress || 0), 0) / Math.max(tunnelGroups.length, 1))}%
                      </div>
                      <small className="text-muted">Avg Progress</small>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Real-Time Production Section */}
      {productionSummary && productionSummary.totalItemsAdded > 0 && (
        <div className="row mb-4">
          <div className="col-12">
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0 d-flex align-items-center justify-content-between">
                  <span>🏭 Real-Time Production Rates (Items Added to Invoices)</span>
                  <div className="d-flex gap-2">
                    <span className="badge bg-success">
                      {productionSummary.activeProducts} Active
                    </span>
                    <span className="badge bg-info">
                      {Math.round(productionSummary.currentHourRate)}/hr Current Rate
                    </span>
                  </div>
                </h5>
              </div>
              <div className="card-body">
                {productionSummary.topProductsByRate.length === 0 ? (
                  <div className="text-center text-muted py-4">
                    <i className="bi bi-hourglass-split" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
                    <p className="mt-2 mb-0">No production activity detected</p>
                  </div>
                ) : (
                  <>
                    {/* Hourly Breakdown Chart */}
                    <div className="mb-4">
                      <h6 className="mb-3">📊 Hourly Activity Breakdown</h6>
                      <div className="row">
                        {Object.entries(productionSummary.hourlyBreakdown)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([hour, count]) => (
                          <div key={hour} className="col-md-2 col-sm-3 mb-2">
                            <div className="text-center">
                              <div className="fw-bold text-primary">{count}</div>
                              <small className="text-muted">{hour}</small>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Top Products */}
                    <div className="mb-4">
                      <h6 className="mb-3">🏆 Top Production Items</h6>
                      <div className="row">
                        {productionSummary.topProductsByRate.slice(0, 8).map((product, index) => {
                          const getProductIcon = (productName: string) => {
                            const name = productName.toLowerCase();
                            if (name.includes('sabana')) return '🛏️';
                            if (name.includes('towel') || name.includes('toalla')) return '🏖️';
                            if (name.includes('uniform') || name.includes('scrub')) return '👔';
                            if (name.includes('blanket') || name.includes('colcha')) return '🛌';
                            if (name.includes('pickup') || name.includes('weight')) return '⚖️';
                            return '📦';
                          };

                          const formatRate = (rate: number) => {
                            if (rate < 1) return `${(rate * 60).toFixed(1)}/min`;
                            return `${Math.round(rate)}/hr`;
                          };

                          return (
                            <div key={`${product.productName}-${index}`} className="col-md-6 col-lg-4 col-xl-3 mb-3">
                              <div className={`card h-100 ${product.isActive ? 'border-success' : 'border-secondary'}`}>
                                <div className="card-body p-3">
                                  <div className="d-flex justify-content-between align-items-start mb-2">
                                    <span style={{ fontSize: '1.2em' }}>
                                      {getProductIcon(product.productName)}
                                    </span>
                                    <span className={`badge ${product.isActive ? 'bg-success' : 'bg-secondary'}`} style={{ fontSize: '0.7em' }}>
                                      {product.isActive ? '🔴 Live' : '⚫ Inactive'}
                                    </span>
                                  </div>
                                  
                                  <h6 className="card-title text-truncate mb-2" title={product.productName} style={{ fontSize: '0.9em' }}>
                                    {product.productName}
                                  </h6>
                                  
                                  <div className="row text-center mb-2">
                                    <div className="col-6">
                                      <div className="text-primary fw-bold">
                                        {product.totalQuantity.toLocaleString()}
                                      </div>
                                      <small className="text-muted d-block" style={{ fontSize: '0.65rem' }}>
                                        Total Items
                                      </small>
                                    </div>
                                    <div className="col-6">
                                      <div className={`fw-bold ${product.isActive ? 'text-success' : 'text-muted'}`}>
                                        {formatRate(product.ratePerHour)}
                                      </div>
                                      <small className="text-muted d-block" style={{ fontSize: '0.65rem' }}>
                                        Rate
                                      </small>
                                    </div>
                                  </div>

                                  <div className="row text-center">
                                    <div className="col-6">
                                      <small className="text-muted" style={{ fontSize: '0.65rem' }}>
                                        {product.entriesCount} entries
                                      </small>
                                    </div>
                                    <div className="col-6">
                                      <small className="text-muted" style={{ fontSize: '0.65rem' }}>
                                        {product.clientsCount} clients
                                      </small>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Production Summary Statistics */}
                    <div className="border-top pt-3 mt-3">
                      <div className="row text-center">
                        <div className="col-md-3">
                          <div className="fw-bold text-primary">
                            {productionSummary.totalItemsAdded.toLocaleString()}
                          </div>
                          <small className="text-muted">Total Items Added</small>
                        </div>
                        <div className="col-md-3">
                          <div className="fw-bold text-success">
                            {productionSummary.activeProducts}
                          </div>
                          <small className="text-muted">Active Products</small>
                        </div>
                        <div className="col-md-3">
                          <div className="fw-bold text-info">
                            {Math.round(productionSummary.topProductsByRate.reduce((sum, p) => sum + p.ratePerHour, 0) / Math.max(productionSummary.topProductsByRate.length, 1))}
                          </div>
                          <small className="text-muted">Avg Rate/Hr</small>
                        </div>
                        <div className="col-md-3">
                          <div className="fw-bold text-warning">
                            {productionSummary.totalUniqueProducts}
                          </div>
                          <small className="text-muted">Product Types</small>
                        </div>
                      </div>
                    </div>
                  </>
                )}
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
              🔄 This dashboard updates automatically in real-time as data is added to the system. 
              Last update: {metrics.lastUpdate.toLocaleString()}
            </small>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealTimeOperationsDashboard;
