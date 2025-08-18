import React, { useEffect, useState, useMemo } from "react";
import ProductionTrackingService, { ProductionSummary, ProductionEntry } from "../services/ProductionTrackingService";
import EndOfShiftDashboard from "./EndOfShiftDashboard";
// Add segregation-related imports
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";

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

  // State for all products added today (for Edit Classifications modal)
  const [allProductsToday, setAllProductsToday] = useState<string[]>([]);

  // Add segregation data state
  const [segregatedClientsToday, setSegregatedClientsToday] = useState<Array<{
    clientId: string;
    clientName: string;
    weight: number;
    timestamp: string;
    user?: string;
  }>>([]);
  const [totalSegregatedWeight, setTotalSegregatedWeight] = useState(0);
  const [segregationLoading, setSegregationLoading] = useState(true);

  // Add pickup entries state
  const [pickupEntriesToday, setPickupEntriesToday] = useState<Array<{
    id: string;
    clientId: string;
    clientName: string;
    driverId: string;
    driverName: string;
    groupId: string;
    weight: number;
    timestamp: string;
  }>>([]);
  const [totalPickupWeight, setTotalPickupWeight] = useState(0);
  const [pickupEntriesLoading, setPickupEntriesLoading] = useState(true);

  // State for production start times for hourly rate calculations
  const [mangleStartTime, setMangleStartTime] = useState<string>(
    localStorage.getItem('mangleStartTime') || '08:00'
  );
  const [dobladoStartTime, setDobladoStartTime] = useState<string>(
    localStorage.getItem('dobladoStartTime') || '08:00'
  );
  const [segregationStartTime, setSegregationStartTime] = useState<string>(
    localStorage.getItem('segregationStartTime') || '08:00'
  );

  // Collapsible sections state
  const [collapsedSections, setCollapsedSections] = useState<{
    segregation: boolean;
    pickupEntries: boolean;
    mangleLog: boolean;
    dobladoLog: boolean;
  }>({
    segregation: false,
    pickupEntries: false,
    mangleLog: false,
    dobladoLog: false,
  });

  const toggleSection = (section: keyof typeof collapsedSections) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Save start times to localStorage when changed
  const handleMangleStartTimeChange = (time: string) => {
    setMangleStartTime(time);
    localStorage.setItem('mangleStartTime', time);
  };

  const handleDobladoStartTimeChange = (time: string) => {
    setDobladoStartTime(time);
    localStorage.setItem('dobladoStartTime', time);
  };

  const handleSegregationStartTimeChange = (time: string) => {
    setSegregationStartTime(time);
    localStorage.setItem('segregationStartTime', time);
  };

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

  // Direct Firebase query to get ALL products added today (bypassing service filters)
  useEffect(() => {
    const fetchAllProductsToday = async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Get all invoices to find ALL products added today
        const invoicesSnapshot = await getDocs(collection(db, 'invoices'));
        const allProductsSet = new Set<string>();

        invoicesSnapshot.docs.forEach(doc => {
          const invoice = doc.data();
          const carts = invoice.carts || [];
          
          carts.forEach((cart: any) => {
            const items = cart.items || [];
            
            items.forEach((item: any) => {
              if (item.addedAt && item.productName) {
                const itemDate = new Date(item.addedAt);
                
                // Include ALL items added today, regardless of quantity or other filters
                if (itemDate >= today && itemDate < tomorrow) {
                  allProductsSet.add(item.productName);
                }
              }
            });
          });
        });

        const sortedProducts = Array.from(allProductsSet).sort();
        setAllProductsToday(sortedProducts);
        console.log(`🏭 [Classification] Found ${sortedProducts.length} unique products added today`);
        
      } catch (error) {
        console.error('Error fetching all products for today:', error);
      }
    };

    fetchAllProductsToday();
  }, []);

  // State for segregation hourly rates
  const [segregationHourlyData, setSegregationHourlyData] = useState<Array<{
    hour: number;
    clients: number;
    weight: number;
    rate: number;
  }>>([]);

  // Fetch segregation data for today (with fallback to recent data)
  useEffect(() => {
    const fetchSegregationData = async () => {
      try {
        setSegregationLoading(true);
        
        // Get today's date string (YYYY-MM-DD format) using local timezone
        const today = new Date();
        const localTodayStr = today.getFullYear() + '-' + 
          String(today.getMonth() + 1).padStart(2, '0') + '-' + 
          String(today.getDate()).padStart(2, '0');
        const utcTodayStr = today.toISOString().slice(0, 10);
        
        console.log('🏭 [Segregation] Local date:', localTodayStr);
        console.log('🏭 [Segregation] UTC date:', utcTodayStr);
        console.log('🏭 [Segregation] Timezone offset (hours):', today.getTimezoneOffset() / 60);
        
        // Try local date first, then UTC date as fallback
        let segregationQuery = query(
          collection(db, 'segregation_done_logs'),
          where('date', '==', localTodayStr)
        );
        
        let segregationSnapshot = await getDocs(segregationQuery);
        console.log('🏭 [Segregation] Found', segregationSnapshot.docs.length, 'records for local date:', localTodayStr);
        
        // If no records found with local date and local != UTC, try UTC date
        if (segregationSnapshot.docs.length === 0 && localTodayStr !== utcTodayStr) {
          console.log('🏭 [Segregation] Trying UTC date:', utcTodayStr);
          segregationQuery = query(
            collection(db, 'segregation_done_logs'),
            where('date', '==', utcTodayStr)
          );
          segregationSnapshot = await getDocs(segregationQuery);
          console.log('🏭 [Segregation] Found', segregationSnapshot.docs.length, 'records for UTC date:', utcTodayStr);
        }
        
        // If still no records found, check recent records as fallback
        let allSegregationDocs = segregationSnapshot.docs;
        
        if (segregationSnapshot.docs.length === 0) {
          console.log('🏭 [Segregation] No records for either date, checking recent records...');
          
          // Query recent segregation records (last 48 hours) as fallback
          const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
          const { Timestamp } = await import('firebase/firestore');
          
          const recentQuery = query(
            collection(db, 'segregation_done_logs'),
            where('timestamp', '>=', Timestamp.fromDate(twoDaysAgo))
          );
          
          const recentSnapshot = await getDocs(recentQuery);
          console.log('🏭 [Segregation] Found', recentSnapshot.docs.length, 'recent records (last 48h)');
          allSegregationDocs = recentSnapshot.docs;
        }
                
        const segregatedClients: typeof segregatedClientsToday = [];
        let totalWeight = 0;
        
        // Hourly breakdown data
        const hourlyBreakdown: { [hour: number]: { clients: number; weight: number } } = {};
        
        allSegregationDocs.forEach(doc => {
          const data = doc.data();
          const weight = Number(data.weight) || 0;
          const timestamp = data.timestamp || new Date().toISOString();
          
          // Convert Firestore timestamp to JavaScript Date if needed
          let timestampDate;
          if (timestamp && timestamp.toDate) {
            timestampDate = timestamp.toDate();
          } else if (timestamp) {
            timestampDate = new Date(timestamp);
          } else {
            timestampDate = new Date();
          }
          
          // Only include records from the last 24 hours for better relevance
          const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          if (timestampDate < twentyFourHoursAgo) {
            return; // Skip old records
          }
          
          segregatedClients.push({
            clientId: data.clientId || 'unknown',
            clientName: data.clientName || 'Unknown Client',
            weight: weight,
            timestamp: timestampDate.toISOString(),
            user: data.user || 'Unknown'
          });
          
          totalWeight += weight;
          
          // Calculate hourly breakdown
          const hour = timestampDate.getHours();
          if (!hourlyBreakdown[hour]) {
            hourlyBreakdown[hour] = { clients: 0, weight: 0 };
          }
          hourlyBreakdown[hour].clients += 1;
          hourlyBreakdown[hour].weight += weight;
        });
        
        // Convert hourly breakdown to array with rates
        const hourlyData = Object.entries(hourlyBreakdown)
          .map(([hourStr, data]) => {
            const hour = parseInt(hourStr);
            return {
              hour,
              clients: data.clients,
              weight: data.weight,
              rate: data.weight // Weight per hour (since it's already per hour)
            };
          })
          .sort((a, b) => a.hour - b.hour);
        
        // Sort by timestamp (most recent first)
        segregatedClients.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        setSegregatedClientsToday(segregatedClients);
        setTotalSegregatedWeight(totalWeight);
        setSegregationHourlyData(hourlyData);
        
        console.log('🏭 [Segregation Data] Processed segregation data:', {
          totalClients: segregatedClients.length,
          totalWeight: totalWeight,
          localDateFilter: localTodayStr,
          utcDateFilter: utcTodayStr,
          recordsFound: allSegregationDocs.length,
          recordsInLast24h: segregatedClients.length,
          hourlyBreakdown: hourlyData,
          sampleClients: segregatedClients.slice(0, 3).map(c => ({
            name: c.clientName,
            weight: c.weight,
            time: new Date(c.timestamp).toLocaleTimeString()
          }))
        });
        
      } catch (error) {
        console.error('Error fetching segregation data:', error);
      } finally {
        setSegregationLoading(false);
      }
    };

    fetchSegregationData();
  }, []);

  // Fetch pickup entries data for today
  useEffect(() => {
    const fetchPickupEntries = async () => {
      try {
        setPickupEntriesLoading(true);
        
        // Get today's date range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Import Firebase functions dynamically
        const { Timestamp } = await import('firebase/firestore');
        
        // Query pickup_entries for today
        const pickupEntriesQuery = query(
          collection(db, 'pickup_entries'),
          where('timestamp', '>=', Timestamp.fromDate(today)),
          where('timestamp', '<', Timestamp.fromDate(tomorrow))
        );
        
        const pickupEntriesSnapshot = await getDocs(pickupEntriesQuery);
        const pickupEntries: typeof pickupEntriesToday = [];
        let totalWeight = 0;
        
        pickupEntriesSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const weight = Number(data.weight) || 0;
          const timestamp = data.timestamp;
          
          // Convert timestamp to string
          let timestampStr = new Date().toISOString();
          if (timestamp && typeof timestamp.toDate === 'function') {
            timestampStr = timestamp.toDate().toISOString();
          } else if (timestamp instanceof Date) {
            timestampStr = timestamp.toISOString();
          } else if (typeof timestamp === 'string') {
            timestampStr = new Date(timestamp).toISOString();
          }
          
          pickupEntries.push({
            id: doc.id,
            clientId: data.clientId || 'unknown',
            clientName: data.clientName || 'Unknown Client',
            driverId: data.driverId || 'unknown',
            driverName: data.driverName || 'Unknown Driver',
            groupId: data.groupId || 'unknown',
            weight: weight,
            timestamp: timestampStr
          });
          
          totalWeight += weight;
        });
        
        // Sort by timestamp (most recent first)
        pickupEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        setPickupEntriesToday(pickupEntries);
        setTotalPickupWeight(totalWeight);
        
        console.log('🚛 [Pickup Entries] Loaded pickup entries data for today:', {
          totalEntries: pickupEntries.length,
          totalWeight: totalWeight,
          entriesProcessed: pickupEntries.map(e => `${e.clientName} - ${e.weight}lbs`)
        });
        
      } catch (error) {
        console.error('Error fetching pickup entries data:', error);
      } finally {
        setPickupEntriesLoading(false);
      }
    };

    fetchPickupEntries();
  }, []);

  // Calculate current hour segregation rate
  const currentHourSegregationRate = useMemo(() => {
    if (!segregationHourlyData.length) return 0;
    
    const currentHour = new Date().getHours();
    const currentHourData = segregationHourlyData.find(h => h.hour === currentHour);
    
    return currentHourData ? currentHourData.rate : 0;
  }, [segregationHourlyData]);

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

    // Classify all entries - use ALL entries for today, not just recent ones
    const allEntriesForClassification = productionSummary.allEntriesToday || productionSummary.recentEntries;
    console.log('🔍 [Production Logs] Using entries for classification:', {
      allEntriesTodayCount: productionSummary.allEntriesToday?.length || 0,
      recentEntriesCount: productionSummary.recentEntries?.length || 0,
      usingAllEntries: !!(productionSummary.allEntriesToday),
      totalEntriesForLogs: allEntriesForClassification.length
    });
    
    const classifiedEntries: ClassifiedEntry[] = allEntriesForClassification.map(entry => ({
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
    
    console.log('🔍 [Production Logs] Classification results:', {
      totalEntries: classifiedEntries.length,
      mangleEntries: mangleEntries.length,
      dobladoEntries: dobladoEntries.length,
      mangleUnits: mangleEntries.reduce((sum, e) => sum + e.quantity, 0),
      dobladoUnits: dobladoEntries.reduce((sum, e) => sum + e.quantity, 0)
    });

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

  // Get all unique products for editing - Enhanced to show ALL products added today
  const allProducts = useMemo(() => {
    if (!productionSummary) return [];
    
    // Start with products from recent entries (filtered data)
    const products = new Set<string>();
    productionSummary.recentEntries.forEach(entry => {
      products.add(entry.productName);
    });
    
    // Add products from Firebase query
    allProductsToday.forEach(product => {
      products.add(product);
    });

    return Array.from(products).sort();
  }, [productionSummary, allProductsToday]);

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

      {/* Production Start Time Configuration */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card border-info">
            <div className="card-header bg-light text-dark">
              <h5 className="mb-0">
                <i className="fas fa-clock me-2"></i>
                Production Start Time Configuration
              </h5>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-4">
                  <div className="mb-3">
                    <label className="form-label fw-bold">
                      <i className="fas fa-compress-arrows-alt me-2 text-success"></i>
                      Mangle Production Start Time
                    </label>
                    <input 
                      type="time"
                      className="form-control"
                      value={mangleStartTime}
                      onChange={(e) => handleMangleStartTimeChange(e.target.value)}
                    />
                    <small className="text-muted">
                      Used to calculate hourly production rates for Daily Dashboard charts
                    </small>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="mb-3">
                    <label className="form-label fw-bold">
                      <i className="fas fa-hands me-2 text-warning"></i>
                      Doblado Production Start Time
                    </label>
                    <input 
                      type="time"
                      className="form-control"
                      value={dobladoStartTime}
                      onChange={(e) => handleDobladoStartTimeChange(e.target.value)}
                    />
                    <small className="text-muted">
                      Used to calculate hourly production rates for Daily Dashboard charts
                    </small>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="mb-3">
                    <label className="form-label fw-bold">
                      <i className="fas fa-tasks me-2 text-info"></i>
                      Segregation Start Time
                    </label>
                    <input 
                      type="time"
                      className="form-control"
                      value={segregationStartTime}
                      onChange={(e) => handleSegregationStartTimeChange(e.target.value)}
                    />
                    <small className="text-muted">
                      Used to calculate hourly segregation rates for Daily Dashboard charts
                    </small>
                  </div>
                </div>
              </div>
              <div className="alert alert-light mt-3">
                <i className="fas fa-info-circle me-2 text-info"></i>
                <strong>Note:</strong> These start times are used by the Daily Dashboard to calculate 
                accurate hourly production rates. The graphs will show production from these selected 
                times onwards. Settings are saved automatically.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Production Timing Summary */}
      {timingSummary && (
        <div className="row mb-4">
          <div className="col-12">
            <div className="card border-primary">
              <div className="card-header bg-light text-dark">
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

      {/* Enhanced Hourly Production Analytics Dashboard */}
      {timingSummary && productionSummary && productionSummary.recentEntries.length > 0 && (
        <div className="row mb-4">
          <div className="col-12">
            <div className="card shadow-sm">
              <div className="card-header bg-light text-dark">
                <div className="d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">
                    <i className="fas fa-chart-line me-2"></i>
                    📊 Hourly Production Analytics
                  </h5>
                  <div className="d-flex gap-3 text-center">
                    <div>
                      <div className="fw-bold fs-6">
                        {Object.keys(productionSummary.hourlyBreakdown || {}).length}
                      </div>
                      <small className="text-muted">Active Hours</small>
                    </div>
                    <div>
                      <div className="fw-bold fs-6">
                        {Math.round(productionSummary.currentHourRate || 0)}
                      </div>
                      <small className="text-muted">Current Rate/hr</small>
                    </div>
                  </div>
                </div>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-striped table-hover">
                    <thead>
                      <tr>
                        <th>Hour</th>
                        <th className="text-center">Mangle/Doblado Split</th>
                        <th className="text-center">Units Processed</th>
                        <th className="text-center">Clients</th>
                        <th>Top Products</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        console.log('🔍 [Hourly Table] Building table with:', {
                          hourlyBreakdownKeys: Object.keys(productionSummary.hourlyBreakdown || {}),
                          hourlyBreakdownData: productionSummary.hourlyBreakdown,
                          recentEntriesCount: productionSummary.recentEntries.length,
                          allEntriesTodayCount: productionSummary.allEntriesToday?.length || 0,
                          totalItemsAdded: productionSummary.totalItemsAdded,
                          allEntriesHours: (productionSummary.allEntriesToday || productionSummary.recentEntries).map(e => e.addedAt.getHours()),
                          firstEntries: (productionSummary.allEntriesToday || productionSummary.recentEntries).slice(0, 5).map(e => ({
                            hour: e.addedAt.getHours(),
                            product: e.productName,
                            client: e.clientName,
                            quantity: e.quantity,
                            time: e.addedAt.toLocaleTimeString()
                          }))
                        });                        // Get hourly data from service
                        const hourlyFromService = productionSummary.hourlyBreakdown || {};
                        
                        // Build detailed hourly data from ALL entries for today (not just recent 50)
                        const allEntries = productionSummary.allEntriesToday || productionSummary.recentEntries;
                        
                        // Check if we have service data but no entries (common issue)
                        const hasServiceData = Object.keys(hourlyFromService).length > 0;
                        const hasEntryData = allEntries.length > 0;
                        
                        console.log('🔍 [Hourly Table] Data availability:', {
                          hasServiceData,
                          hasEntryData,
                          usingAllEntriesToday: !!(productionSummary.allEntriesToday),
                          serviceUnitsTotal: Object.values(hourlyFromService).reduce((sum, units) => sum + units, 0),
                          allEntriesTotal: allEntries.length,
                          recentEntriesTotal: productionSummary.recentEntries.length
                        });
                        
                        if (hasServiceData && !hasEntryData) {
                          console.warn('🔍 [Hourly Table] Warning: Service has hourly data but no entries - this is likely a data sync issue');
                        }
                        const hourlyData: { [hour: number]: {
                          items: number;
                          units: number;
                          clients: Set<string>;
                          products: { [product: string]: number };
                          mangleItems: number;
                          dobladoItems: number;
                          mangleUnits: number;
                          dobladoUnits: number;
                        } } = {};
                        
                        // Process ALL entries to build complete hourly breakdown
                        allEntries.forEach(entry => {
                          const hour = entry.addedAt.getHours();
                          if (!hourlyData[hour]) {
                            hourlyData[hour] = {
                              items: 0,
                              units: 0,
                              clients: new Set(),
                              products: {},
                              mangleItems: 0,
                              dobladoItems: 0,
                              mangleUnits: 0,
                              dobladoUnits: 0
                            };
                          }
                          
                          hourlyData[hour].items++;
                          hourlyData[hour].units += entry.quantity;
                          hourlyData[hour].clients.add(entry.clientName);
                          
                          if (!hourlyData[hour].products[entry.productName]) {
                            hourlyData[hour].products[entry.productName] = 0;
                          }
                          hourlyData[hour].products[entry.productName] += entry.quantity;
                          
                          // Classify the entry and add to appropriate category
                          const classification = getClassification(entry.productName);
                          if (classification === 'Mangle') {
                            hourlyData[hour].mangleItems++;
                            hourlyData[hour].mangleUnits += entry.quantity;
                          } else {
                            hourlyData[hour].dobladoItems++;
                            hourlyData[hour].dobladoUnits += entry.quantity;
                          }
                        });

                        console.log('🔍 [Hourly Table] Processed hourly data:', {
                          hoursWithData: Object.keys(hourlyData),
                          totalEntriesProcessed: Object.values(hourlyData).reduce((sum, data) => sum + data.items, 0),
                          entriesSource: productionSummary.allEntriesToday ? 'allEntriesToday' : 'recentEntries',
                          hourlyStats: Object.fromEntries(
                            Object.entries(hourlyData).map(([hour, data]) => [
                              hour, 
                              {
                                items: data.items,
                                units: data.units,
                                clients: data.clients.size,
                                mangleItems: data.mangleItems,
                                dobladoItems: data.dobladoItems,
                                mangleUnits: data.mangleUnits,
                                dobladoUnits: data.dobladoUnits,
                                manglePercent: data.items > 0 ? Math.round((data.mangleItems / data.items) * 100) : 0,
                                dobladoPercent: data.items > 0 ? Math.round((data.dobladoItems / data.items) * 100) : 0,
                                clientNames: Array.from(data.clients).slice(0, 3),
                                topProduct: Object.entries(data.products)
                                  .sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0] || 'None'
                              }
                            ])
                          )
                        });

                        // Collect all hours that have data
                        const allHours = new Set<number>();
                        
                        // Add hours from service breakdown
                        Object.keys(hourlyFromService).forEach(hourStr => {
                          const hourMatch = hourStr.match(/(\d+):00/);
                          if (hourMatch) {
                            const hour = parseInt(hourMatch[1]);
                            if (!isNaN(hour)) allHours.add(hour);
                          }
                        });
                        
                        // Add hours from detailed analysis
                        Object.keys(hourlyData).forEach(hourStr => {
                          const hour = parseInt(hourStr);
                          if (!isNaN(hour)) allHours.add(hour);
                        });

                        console.log('🔍 [Hourly Table] All hours found:', Array.from(allHours).sort());

                        // Generate table rows for all hours
                        const hourlyRows = Array.from(allHours)
                          .sort((a, b) => a - b)
                          .map(hour => {
                            const data = hourlyData[hour] || {
                              items: 0,
                              units: 0,
                              clients: new Set(),
                              products: {},
                              mangleItems: 0,
                              dobladoItems: 0,
                              mangleUnits: 0,
                              dobladoUnits: 0
                            };
                            
                            // Get units from service data first, then fall back to computed data
                            const hourKey = `${hour}:00`;
                            const serviceUnits = hourlyFromService[hourKey] || 0;
                            const computedUnits = data.units;
                            const finalUnits = Math.max(serviceUnits, computedUnits);
                            
                            const hourStr = hour.toString().padStart(2, '0') + ':00';
                            
                            // Get top 3 products for this hour
                            const productEntries = Object.entries(data.products);
                            const topProducts = productEntries
                              .sort(([,a], [,b]) => (b as number) - (a as number))
                              .slice(0, 3)
                              .map(([product, qty]) => `${product} (${qty})`)
                              .join(', ');

                            const isCurrentHour = new Date().getHours() === hour;
                            const hasActivity = finalUnits > 0 || data.items > 0;
                            
                            console.log(`🔍 [Hourly Table] Hour ${hour}:`, {
                              serviceUnits,
                              computedUnits,
                              finalUnits,
                              items: data.items,
                              clients: data.clients.size,
                              topProducts: topProducts || 'No activity',
                              hasActivity,
                              fallbackMode: hasServiceData && !hasEntryData
                            });
                            
                            // Show all hours that have any activity
                            return (
                              <tr key={hour} className={
                                isCurrentHour ? 'table-warning' : 
                                hasActivity ? '' : 'table-light text-muted'
                              }>
                                <td>
                                  <span className={`fw-bold ${isCurrentHour ? 'text-warning' : hasActivity ? '' : 'text-muted'}`}>
                                    {hourStr}
                                    {isCurrentHour && <small className="ms-1">(Current)</small>}
                                  </span>
                                </td>
                                <td className="text-center">
                                  {data.items > 0 ? (
                                    <div>
                                      <div className="mb-1" style={{ width: '120px', margin: '0 auto' }}>
                                        <div 
                                          className="progress" 
                                          style={{ height: '20px', borderRadius: '10px', border: '1px solid #dee2e6' }}
                                          title={`${data.mangleUnits.toLocaleString()} Mangle pieces, ${data.dobladoUnits.toLocaleString()} Doblado pieces`}
                                        >
                                          <div 
                                            className="progress-bar bg-success"
                                            style={{ 
                                              width: `${Math.round((data.mangleUnits / data.units) * 100)}%`,
                                              fontSize: '11px',
                                              fontWeight: 'bold',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              color: 'black'
                                            }}
                                          >
                                            M {Math.round((data.mangleUnits / data.units) * 100)}%
                                          </div>
                                          <div 
                                            className="progress-bar bg-warning"
                                            style={{ 
                                              width: `${Math.round((data.dobladoUnits / data.units) * 100)}%`,
                                              fontSize: '11px',
                                              fontWeight: 'bold',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              color: '#856404'
                                            }}
                                          >
                                            D {Math.round((data.dobladoUnits / data.units) * 100)}%
                                          </div>
                                        </div>
                                      </div>
                                      <small className="text-muted">
                                        {data.mangleUnits.toLocaleString()} / {data.dobladoUnits.toLocaleString()}
                                      </small>
                                    </div>
                                  ) : finalUnits > 0 && hasServiceData && !hasEntryData ? (
                                    <span className="badge bg-warning text-dark" title="Service has data but entries are missing">?</span>
                                  ) : (
                                    <span className="text-muted">-</span>
                                  )}
                                </td>
                                <td className="text-center">
                                  {finalUnits > 0 ? (
                                    <span className="fw-bold">{finalUnits.toLocaleString()}</span>
                                  ) : (
                                    <span className="text-muted">-</span>
                                  )}
                                </td>
                                <td className="text-center">
                                  {data.clients.size > 0 ? (
                                    <span className="badge bg-info">{data.clients.size}</span>
                                  ) : finalUnits > 0 && hasServiceData && !hasEntryData ? (
                                    <span className="badge bg-warning text-dark" title="Service has data but entries are missing">?</span>
                                  ) : (
                                    <span className="text-muted">-</span>
                                  )}
                                </td>
                                <td>
                                  {topProducts ? (
                                    <small className="text-muted">{topProducts}</small>
                                  ) : finalUnits > 0 && hasServiceData && !hasEntryData ? (
                                    <small className="text-warning">Data sync issue - check console</small>
                                  ) : (
                                    <small className="text-muted">No activity</small>
                                  )}
                                </td>
                              </tr>
                            );
                          });
                          
                        // Calculate totals for the daily summary row
                        const totalSummary = (() => {
                          let totalMangleItems = 0;
                          let totalDobladoItems = 0;
                          let totalMangleUnits = 0;
                          let totalDobladoUnits = 0;
                          let totalUnits = 0;
                          let totalItems = 0;
                          const allDayClients = new Set<string>();
                          
                          Object.values(hourlyData).forEach(data => {
                            totalMangleItems += data.mangleItems;
                            totalDobladoItems += data.dobladoItems;
                            totalMangleUnits += data.mangleUnits;
                            totalDobladoUnits += data.dobladoUnits;
                            totalUnits += data.units;
                            totalItems += data.items;
                            data.clients.forEach(client => allDayClients.add(client));
                          });
                          
                          return {
                            totalMangleItems,
                            totalDobladoItems,
                            totalMangleUnits,
                            totalDobladoUnits,
                            totalUnits,
                            totalItems,
                            totalClients: allDayClients.size
                          };
                        })();
                        
                        // Add total row to the hourly rows
                        const totalRow = (
                          <tr key="daily-total" className="table-dark border-top border-3 border-primary">
                            <th className="fw-bold text-light">
                              <i className="fas fa-calculator me-2"></i>
                              DAILY TOTAL
                            </th>
                            <th className="text-center">
                              {totalSummary.totalItems > 0 ? (
                                <div>
                                  <div className="mb-1" style={{ width: '140px', margin: '0 auto' }}>
                                    <div 
                                      className="progress" 
                                      style={{ height: '24px', borderRadius: '12px', border: '2px solid #ffffff' }}
                                      title={`${totalSummary.totalMangleUnits.toLocaleString()} Mangle pieces, ${totalSummary.totalDobladoUnits.toLocaleString()} Doblado pieces`}
                                    >
                                      <div 
                                        className="progress-bar bg-success"
                                        style={{ 
                                          width: `${Math.round((totalSummary.totalMangleUnits / totalSummary.totalUnits) * 100)}%`,
                                          fontSize: '12px',
                                          fontWeight: 'bold',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          color: 'black'
                                        }}
                                      >
                                        M {Math.round((totalSummary.totalMangleUnits / totalSummary.totalUnits) * 100)}%
                                      </div>
                                      <div 
                                        className="progress-bar bg-warning"
                                        style={{ 
                                          width: `${Math.round((totalSummary.totalDobladoUnits / totalSummary.totalUnits) * 100)}%`,
                                          fontSize: '12px',
                                          fontWeight: 'bold',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          color: '#856404'
                                        }}
                                      >
                                        D {Math.round((totalSummary.totalDobladoUnits / totalSummary.totalUnits) * 100)}%
                                      </div>
                                    </div>
                                  </div>
                                  <small className="text-dark">
                                    {totalSummary.totalMangleUnits.toLocaleString()} / {totalSummary.totalDobladoUnits.toLocaleString()}
                                  </small>
                                </div>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </th>
                            <th className="text-center">
                              <span className="badge bg-primary fs-6">
                                {totalSummary.totalUnits.toLocaleString()}
                              </span>
                            </th>
                            <th className="text-center">
                              <span className="badge bg-info fs-6">
                                {totalSummary.totalClients}
                              </span>
                            </th>
                            <th>
                              <strong className="text-light">
                                {totalSummary.totalItems.toLocaleString()} items processed today
                              </strong>
                            </th>
                          </tr>
                        );
                        
                        return [...hourlyRows, totalRow];
                      })()}
                    </tbody>
                  </table>
                </div>
                
                {/* Summary Stats */}
                <div className="row mt-3">
                  <div className="col-12">
                    <div className="alert alert-light">
                      <div className="row text-center">
                        <div className="col-md-3">
                          <strong className="text-primary">
                            {Object.values(productionSummary.hourlyBreakdown || {}).reduce((sum, count) => sum + count, 0).toLocaleString()}
                          </strong>
                          <br />
                          <small className="text-muted">Total Units Today</small>
                        </div>
                        <div className="col-md-3">
                          <strong className="text-success">
                            {Object.keys(productionSummary.hourlyBreakdown || {}).length}
                          </strong>
                          <br />
                          <small className="text-muted">Active Hours</small>
                        </div>
                        <div className="col-md-3">
                          <strong className="text-info">
                            {Object.keys(productionSummary.hourlyBreakdown || {}).length > 0 ? 
                              Math.round(Object.values(productionSummary.hourlyBreakdown || {}).reduce((sum, count) => sum + count, 0) / Object.keys(productionSummary.hourlyBreakdown || {}).length)
                              : 0
                            }
                          </strong>
                          <br />
                          <small className="text-muted">Avg Units/Hour</small>
                        </div>
                        <div className="col-md-3">
                          <strong className="text-warning">
                            {Math.round(productionSummary.currentHourRate || 0)}
                          </strong>
                          <br />
                          <small className="text-muted">Current Hour Rate</small>
                        </div>
                      </div>
                    </div>
                  </div>
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
            <div className="card-header bg-light text-dark">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">
                  <i className="fas fa-compress-arrows-alt me-2"></i>
                  Mangle Production
                  {classifiedGroups.mangle.activeInLast30Min && (
                    <span className="badge bg-light text-success ms-2">🔴 Live</span>
                  )}
                </h5>
              </div>
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
            <div className="card-header bg-light text-dark">
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

      {/* Segregated Clients Log for Today */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card border-info">
            <div 
              className="card-header bg-light text-dark"
              style={{ cursor: 'pointer' }}
              onClick={() => toggleSection('segregation')}
            >
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">
                  <i className={`fas ${collapsedSections.segregation ? 'fa-chevron-right' : 'fa-chevron-down'} me-2`}></i>
                  <i className="fas fa-tasks me-2"></i>
                  Segregated Clients (Last 24h)
                </h5>
                <div className="d-flex gap-4">
                  <div className="text-end">
                    <div className="fw-bold fs-6">
                      {segregatedClientsToday.length}
                    </div>
                    <small className="text-muted">Clients</small>
                  </div>
                  <div className="text-end">
                    <div className="fw-bold fs-6">
                      {totalSegregatedWeight.toLocaleString()} lbs
                    </div>
                    <small className="text-muted">Total Weight</small>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Collapsible Content */}
            <div className={`collapse ${!collapsedSections.segregation ? 'show' : ''}`}>
            <div className="card-body p-0">
              {segregationLoading ? (
                <div className="text-center py-4">
                  <div className="spinner-border text-info" role="status">
                    <span className="visually-hidden">Loading segregation data...</span>
                  </div>
                  <div className="mt-2 text-muted">Loading segregation data...</div>
                </div>
              ) : segregatedClientsToday.length === 0 ? (
                <div className="text-center text-muted py-4">
                  <i className="fas fa-clipboard-list fa-2x mb-3 opacity-25"></i>
                  <div>No clients have been segregated in the last 24 hours</div>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-striped table-hover mb-0">
                    <thead className="table-info">
                      <tr>
                        <th>Time</th>
                        <th>Client Name</th>
                        <th className="text-center">Weight (lbs)</th>
                        <th className="text-center">Segregated By</th>
                        <th className="text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {segregatedClientsToday.map((client, index) => (
                        <tr key={`${client.clientId}-${index}`}>
                          <td>
                            <span className="badge bg-info">
                              {new Date(client.timestamp).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true
                              })}
                            </span>
                          </td>
                          <td className="fw-bold">{client.clientName}</td>
                          <td className="text-center">
                            <span className="badge bg-success fs-6">
                              {client.weight.toLocaleString()}
                            </span>
                          </td>
                          <td className="text-center">
                            <span className="badge bg-secondary">
                              {client.user || 'Unknown'}
                            </span>
                          </td>
                          <td className="text-center">
                            <span className="badge bg-info">
                              <i className="fas fa-check-circle me-1"></i>
                              Segregated
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pickup Entries Log */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card border-primary">
            <div 
              className="card-header bg-light text-dark"
              style={{ cursor: 'pointer' }}
              onClick={() => toggleSection('pickupEntries')}
            >
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">
                  <i className={`fas ${collapsedSections.pickupEntries ? 'fa-chevron-right' : 'fa-chevron-down'} me-2`}></i>
                  <i className="fas fa-truck me-2"></i>
                  Pickup Entries Today
                </h5>
                <div className="d-flex gap-4">
                  <div className="text-end">
                    <div className="fw-bold fs-6">
                      {pickupEntriesToday.length}
                    </div>
                    <small className="opacity-75">Entries</small>
                  </div>
                  <div className="text-end">
                    <div className="fw-bold fs-6">
                      {totalPickupWeight.toLocaleString()} lbs
                    </div>
                    <small className="opacity-75">Total Weight</small>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Collapsible Content */}
            <div className={`collapse ${!collapsedSections.pickupEntries ? 'show' : ''}`}>
            <div className="card-body p-0">
              {pickupEntriesLoading ? (
                <div className="text-center py-4">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading pickup entries data...</span>
                  </div>
                  <div className="mt-2 text-muted">Loading pickup entries data...</div>
                </div>
              ) : pickupEntriesToday.length === 0 ? (
                <div className="text-center text-muted py-4">
                  <i className="fas fa-truck fa-2x mb-3 opacity-25"></i>
                  <div>No pickup entries recorded today</div>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-striped table-hover mb-0">
                    <thead className="table-info">
                      <tr>
                        <th>Time</th>
                        <th>Client Name</th>
                        <th>Driver Name</th>
                        <th className="text-center">Weight (lbs)</th>
                        <th className="text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pickupEntriesToday.map((entry, index) => (
                        <tr key={`${entry.id}-${index}`}>
                          <td>
                            <span className="badge bg-info">
                              {new Date(entry.timestamp).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true
                              })}
                            </span>
                          </td>
                          <td className="fw-bold">{entry.clientName}</td>
                          <td>{entry.driverName}</td>
                          <td className="text-center">
                            <span className="badge bg-success fs-6">
                              {entry.weight.toLocaleString()}
                            </span>
                          </td>
                          <td className="text-center">
                            <span className="badge bg-primary">
                              <i className="fas fa-check-circle me-1"></i>
                              Entrada
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
            <div 
              className="card-header bg-light text-dark"
              style={{ cursor: 'pointer' }}
              onClick={() => toggleSection('mangleLog')}
            >
              <h5 className="mb-0">
                <i className={`fas ${collapsedSections.mangleLog ? 'fa-chevron-right' : 'fa-chevron-down'} me-2`}></i>
                <i className="fas fa-compress-arrows-alt me-2"></i>
                Mangle Production Log ({classifiedGroups.mangle.entries.length} entries)
              </h5>
            </div>
            
            {/* Collapsible Content */}
            <div className={`collapse ${!collapsedSections.mangleLog ? 'show' : ''}`}>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-striped table-hover mb-0">
                  <thead className="table-info">
                    <tr>
                      <th>Time</th>
                      <th>Client Name</th>
                      <th>Product</th>
                      <th className="text-center">Quantity</th>
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
                            <span className="badge bg-info">
                              {formatTime(entry.addedAt)}
                            </span>
                          </td>
                          <td className="fw-bold">{entry.clientName}</td>
                          <td>{entry.productName}</td>
                          <td className="text-center">
                            <span className="badge bg-success fs-6">
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

        {/* Doblado Table */}
        <div className="col-12 mb-4">
          <div className="card">
            <div 
              className="card-header bg-light text-dark"
              style={{ cursor: 'pointer' }}
              onClick={() => toggleSection('dobladoLog')}
            >
              <h5 className="mb-0">
                <i className={`fas ${collapsedSections.dobladoLog ? 'fa-chevron-right' : 'fa-chevron-down'} me-2`}></i>
                <i className="fas fa-hands me-2"></i>
                Doblado Production Log ({classifiedGroups.doblado.entries.length} entries)
              </h5>
            </div>
            
            {/* Collapsible Content */}
            <div className={`collapse ${!collapsedSections.dobladoLog ? 'show' : ''}`}>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-striped table-hover mb-0">
                  <thead className="table-info">
                    <tr>
                      <th>Time</th>
                      <th>Client Name</th>
                      <th>Product</th>
                      <th className="text-center">Quantity</th>
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
                            <span className="badge bg-info">
                              {formatTime(entry.addedAt)}
                            </span>
                          </td>
                          <td className="fw-bold">{entry.clientName}</td>
                          <td>{entry.productName}</td>
                          <td className="text-center">
                            <span className="badge bg-success fs-6">
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

      {/* End-of-Shift Detection Dashboard */}
      <div className="row mb-4">
        <div className="col-12">
          <EndOfShiftDashboard className="shadow-lg border-0" />
        </div>
      </div>

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
