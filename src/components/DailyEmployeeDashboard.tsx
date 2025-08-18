import React, { useEffect, useState, useMemo } from "react";
import ProductionTrackingService, { ProductionSummary, ProductionEntry } from "../services/ProductionTrackingService";
import EndOfShiftDashboard from "./EndOfShiftDashboard";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// Add CSS animations
const animationStyles = `
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
  }
  
  @keyframes shimmer {
    0% { background-position: -200px 0; }
    100% { background-position: calc(200px + 100%) 0; }
  }
  
  @keyframes glow {
    0%, 100% { box-shadow: 0 0 20px rgba(255, 230, 109, 0.3); }
    50% { box-shadow: 0 0 40px rgba(255, 230, 109, 0.6); }
  }

  @keyframes countUp {
    0% { transform: scale(0.8); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }

  @keyframes fadeInUp {
    0% { opacity: 0; transform: translateY(30px); }
    100% { opacity: 1; transform: translateY(0); }
  }

  .card-hover:hover {
    transform: scale(1.03) translateY(-8px) !important;
    box-shadow: 0 20px 40px rgba(0,0,0,0.2) !important;
  }

  .number-animation {
    animation: countUp 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .fade-in {
    animation: fadeInUp 0.8s ease-out;
  }

  .shimmer-effect {
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
    background-size: 200px 100%;
    animation: shimmer 2s infinite;
  }

  .floating {
    animation: float 3s ease-in-out infinite;
  }

  .glow-effect {
    animation: glow 2s ease-in-out infinite alternate;
  }
`;

interface DailyStats {
  totalUnits: number;
  mangleUnits: number;
  dobladoUnits: number;
  totalItems: number;
  uniqueClients: number;
  currentHourRate: number;
  peakHourRate: number;
  productionSpanHours: number;
  firstEntryTime: string;
  lastEntryTime: string;
  segregatedClients: number;
  segregatedWeight: number;
  pickupEntries: number;
  pickupWeight: number;
}

const DailyEmployeeDashboard: React.FC = () => {
  const [productionSummary, setProductionSummary] = useState<ProductionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Segregation and pickup data
  const [segregatedClientsToday, setSegregatedClientsToday] = useState<number>(0);
  const [totalSegregatedWeight, setTotalSegregatedWeight] = useState<number>(0);
  const [pickupEntriesToday, setPickupEntriesToday] = useState<number>(0);
  const [totalPickupWeight, setTotalPickupWeight] = useState<number>(0);

  // Hourly chart data
  const [hourlyDobladoData, setHourlyDobladoData] = useState<{[hour: number]: number}>({});
  const [hourlyMangleData, setHourlyMangleData] = useState<{[hour: number]: number}>({});
  const [hourlySegregationData, setHourlySegregationData] = useState<{[hour: number]: number}>({});
  
  // Get start times from localStorage (set in Production Classification Dashboard)
  const mangleStartTime = localStorage.getItem('mangleStartTime') || '08:00';
  const dobladoStartTime = localStorage.getItem('dobladoStartTime') || '08:00';
  const segregationStartTime = localStorage.getItem('segregationStartTime') || '08:00';

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Initialize production tracking
  useEffect(() => {
    const productionService = ProductionTrackingService.getInstance();
    
    const unsubscribe = productionService.subscribe((summary: ProductionSummary) => {
      setProductionSummary(summary);
      setLoading(false);
    });

    productionService.startTracking();

    return () => {
      unsubscribe();
      productionService.stopTracking();
    };
  }, []);

  // Fetch additional data
  useEffect(() => {
    const fetchDailyData = async () => {
      try {
        const today = new Date();
        const localTodayStr = today.getFullYear() + '-' + 
          String(today.getMonth() + 1).padStart(2, '0') + '-' + 
          String(today.getDate()).padStart(2, '0');

        // Fetch segregation data
        const segregationQuery = query(
          collection(db, 'segregation_done_logs'),
          where('date', '==', localTodayStr)
        );
        const segregationSnapshot = await getDocs(segregationQuery);
        
        let segWeight = 0;
        segregationSnapshot.docs.forEach(doc => {
          const data = doc.data();
          segWeight += Number(data.weight) || 0;
        });
        
        setSegregatedClientsToday(segregationSnapshot.docs.length);
        setTotalSegregatedWeight(segWeight);

        // Fetch pickup data
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const { Timestamp } = await import('firebase/firestore');
        const pickupQuery = query(
          collection(db, 'pickup_entries'),
          where('timestamp', '>=', Timestamp.fromDate(today)),
          where('timestamp', '<', Timestamp.fromDate(tomorrow))
        );
        
        const pickupSnapshot = await getDocs(pickupQuery);
        let pickupWeight = 0;
        
        pickupSnapshot.docs.forEach(doc => {
          const data = doc.data();
          pickupWeight += Number(data.weight) || 0;
        });
        
        setPickupEntriesToday(pickupSnapshot.docs.length);
        setTotalPickupWeight(pickupWeight);
        
      } catch (error) {
        console.error('Error fetching daily data:', error);
      }
    };

    fetchDailyData();
  }, []);

  // Fetch hourly Doblado production data
  useEffect(() => {
    const fetchHourlyDobladoData = async () => {
      if (!productionSummary?.allEntriesToday && !productionSummary?.recentEntries) return;
      
      const entries = productionSummary.allEntriesToday || productionSummary.recentEntries;
      const hourlyData: {[hour: number]: number} = {};
      
      // Get classification function from localStorage or use defaults
      const getDefaultClassification = (productName: string): 'Mangle' | 'Doblado' => {
        const name = productName.toLowerCase();
        if (name.includes('sheet') || 
            name.includes('duvet') || 
            name.includes('sabana') ||
            name.includes('servilleta') ||
            name.includes('funda') ||
            name.includes('toalla') ||
            name.includes('towel') ||
            name.includes('mangle') ||
            name.includes('tablecloth')) {
          return 'Mangle';
        }
        return 'Doblado';
      };

      const customClassifications = JSON.parse(localStorage.getItem('productClassifications') || '{}');
      const getClassification = (productName: string) => 
        customClassifications[productName] || getDefaultClassification(productName);
      
      // Process entries for Doblado items only
      entries.forEach(entry => {
        if (getClassification(entry.productName) === 'Doblado') {
          const hour = entry.addedAt.getHours();
          hourlyData[hour] = (hourlyData[hour] || 0) + entry.quantity;
        }
      });
      
      setHourlyDobladoData(hourlyData);
    };

    fetchHourlyDobladoData();
  }, [productionSummary]);

  // Fetch hourly Mangle production data
  useEffect(() => {
    const fetchHourlyMangleData = async () => {
      if (!productionSummary?.allEntriesToday && !productionSummary?.recentEntries) return;
      
      const entries = productionSummary.allEntriesToday || productionSummary.recentEntries;
      const hourlyData: {[hour: number]: number} = {};
      
      // Get classification function from localStorage or use defaults
      const getDefaultClassification = (productName: string): 'Mangle' | 'Doblado' => {
        const name = productName.toLowerCase();
        if (name.includes('sheet') || 
            name.includes('duvet') || 
            name.includes('sabana') ||
            name.includes('servilleta') ||
            name.includes('funda') ||
            name.includes('toalla') ||
            name.includes('towel') ||
            name.includes('mangle') ||
            name.includes('tablecloth')) {
          return 'Mangle';
        }
        return 'Doblado';
      };

      const customClassifications = JSON.parse(localStorage.getItem('productClassifications') || '{}');
      const getClassification = (productName: string) => 
        customClassifications[productName] || getDefaultClassification(productName);
      
      // Process entries for Mangle items only
      entries.forEach(entry => {
        if (getClassification(entry.productName) === 'Mangle') {
          const hour = entry.addedAt.getHours();
          hourlyData[hour] = (hourlyData[hour] || 0) + entry.quantity;
        }
      });
      
      setHourlyMangleData(hourlyData);
    };

    fetchHourlyMangleData();
  }, [productionSummary]);

  // Fetch hourly segregation data  
  useEffect(() => {
    const fetchHourlySegregationData = async () => {
      try {
        const today = new Date();
        const localTodayStr = today.getFullYear() + '-' + 
          String(today.getMonth() + 1).padStart(2, '0') + '-' + 
          String(today.getDate()).padStart(2, '0');

        const segregationQuery = query(
          collection(db, 'segregation_done_logs'),
          where('date', '==', localTodayStr)
        );
        
        const segregationSnapshot = await getDocs(segregationQuery);
        const hourlyData: {[hour: number]: number} = {};
        
        segregationSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const weight = Number(data.weight) || 0;
          const timestamp = data.timestamp;
          
          let timestampDate;
          if (timestamp && timestamp.toDate) {
            timestampDate = timestamp.toDate();
          } else if (timestamp) {
            timestampDate = new Date(timestamp);
          } else {
            return;
          }
          
          const hour = timestampDate.getHours();
          hourlyData[hour] = (hourlyData[hour] || 0) + weight;
        });
        
        setHourlySegregationData(hourlyData);
        
      } catch (error) {
        console.error('Error fetching hourly segregation data:', error);
      }
    };

    fetchHourlySegregationData();
  }, []);

  // Calculate current production rates based on area-specific duration calculations
  const currentProductionRates = useMemo(() => {
    if (!productionSummary || (!productionSummary.allEntriesToday?.length && !productionSummary.recentEntries?.length)) {
      return {
        mangleRate: 0,
        dobladoRate: 0,
        segregationRate: 0,
        mangleHoursElapsed: 0,
        dobladoHoursElapsed: 0,
        segregationHoursElapsed: 0,
        totalMangleProduction: 0,
        totalDobladoProduction: 0,
        totalSegregationProduction: totalSegregatedWeight
      };
    }

    const entries = productionSummary.allEntriesToday || productionSummary.recentEntries;
    
    // Debug logging to verify data source
    console.log('🔍 [Daily Dashboard] Production data source:', {
      usingAllEntriesToday: !!(productionSummary.allEntriesToday),
      allEntriesTodayCount: productionSummary.allEntriesToday?.length || 0,
      recentEntriesCount: productionSummary.recentEntries?.length || 0,
      totalEntriesUsed: entries.length,
      totalUnitsFromEntries: entries.reduce((sum, e) => sum + e.quantity, 0)
    });
    
    if (entries.length === 0) {
      return {
        mangleRate: 0,
        dobladoRate: 0,
        segregationRate: 0,
        mangleHoursElapsed: 0,
        dobladoHoursElapsed: 0,
        segregationHoursElapsed: 0,
        totalMangleProduction: 0,
        totalDobladoProduction: 0,
        totalSegregationProduction: totalSegregatedWeight
      };
    }

    // Helper function to parse time string to today's date
    const parseTimeToToday = (timeStr: string): Date => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const today = new Date();
      today.setHours(hours, minutes, 0, 0);
      return today;
    };

    // Get configured start times for each area
    const mangleStartDate = parseTimeToToday(mangleStartTime);
    const dobladoStartDate = parseTimeToToday(dobladoStartTime);
    const segregationStartDate = parseTimeToToday(segregationStartTime);
    
    // Classify entries
    const getDefaultClassification = (productName: string): 'Mangle' | 'Doblado' => {
      const name = productName.toLowerCase();
      if (name.includes('sheet') || 
          name.includes('duvet') || 
          name.includes('sabana') ||
          name.includes('servilleta') ||
          name.includes('funda') ||
          name.includes('toalla') ||
          name.includes('towel') ||
          name.includes('mangle')) {
        return 'Mangle';
      }
      return 'Doblado';
    };

    const customClassifications = JSON.parse(localStorage.getItem('productClassifications') || '{}');
    const getClassification = (productName: string) => 
      customClassifications[productName] || getDefaultClassification(productName);

    // Separate entries by area and find last item time for each area
    let mangleEntries: ProductionEntry[] = [];
    let dobladoEntries: ProductionEntry[] = [];
    let totalMangleProduction = 0;
    let totalDobladoProduction = 0;
    
    entries.forEach(entry => {
      const classification = getClassification(entry.productName);
      if (classification === 'Mangle') {
        mangleEntries.push(entry);
        totalMangleProduction += entry.quantity;
      } else {
        dobladoEntries.push(entry);
        totalDobladoProduction += entry.quantity;
      }
    });

    // Debug classification results
    console.log('🔍 [Daily Dashboard] Classification results:', {
      totalEntries: entries.length,
      mangleEntries: mangleEntries.length,
      dobladoEntries: dobladoEntries.length,
      totalMangleProduction,
      totalDobladoProduction,
      totalFromBoth: totalMangleProduction + totalDobladoProduction,
      sampleClassifications: entries.slice(0, 5).map(e => ({
        product: e.productName,
        quantity: e.quantity,
        classification: getClassification(e.productName)
      }))
    });

    // Calculate area-specific durations
    let mangleDurationHours = 0;
    let dobladoDurationHours = 0;
    let segregationDurationHours = 0;

    // Mangle duration: configured start time → last Mangle item time
    if (mangleEntries.length > 0) {
      const sortedMangleEntries = [...mangleEntries].sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime());
      const lastMangleItem = sortedMangleEntries[sortedMangleEntries.length - 1];
      const mangleDurationMs = lastMangleItem.addedAt.getTime() - mangleStartDate.getTime();
      mangleDurationHours = Math.max(mangleDurationMs / (1000 * 60 * 60), 0.5); // Minimum 30 minutes
    }

    // Doblado duration: configured start time → last Doblado item time
    if (dobladoEntries.length > 0) {
      const sortedDobladoEntries = [...dobladoEntries].sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime());
      const lastDobladoItem = sortedDobladoEntries[sortedDobladoEntries.length - 1];
      const dobladoDurationMs = lastDobladoItem.addedAt.getTime() - dobladoStartDate.getTime();
      dobladoDurationHours = Math.max(dobladoDurationMs / (1000 * 60 * 60), 0.5); // Minimum 30 minutes
    }

    // Segregation duration: for now, use the configured segregation start time and current time
    // TODO: In the future, this could use the actual last segregation item timestamp
    if (totalSegregatedWeight > 0) {
      const currentTime = new Date();
      const segregationDurationMs = currentTime.getTime() - segregationStartDate.getTime();
      segregationDurationHours = Math.max(segregationDurationMs / (1000 * 60 * 60), 0.5); // Minimum 30 minutes
    }

    // Calculate area-specific rates
    const mangleRate = mangleDurationHours > 0 ? totalMangleProduction / mangleDurationHours : 0;
    const dobladoRate = dobladoDurationHours > 0 ? totalDobladoProduction / dobladoDurationHours : 0;
    const segregationRate = segregationDurationHours > 0 ? totalSegregatedWeight / segregationDurationHours : 0;
    
    return {
      mangleRate: Math.round(mangleRate),
      dobladoRate: Math.round(dobladoRate),
      segregationRate: Math.round(segregationRate),
      mangleHoursElapsed: mangleDurationHours, // Area-specific duration
      dobladoHoursElapsed: dobladoDurationHours, // Area-specific duration
      segregationHoursElapsed: segregationDurationHours, // Area-specific duration
      totalMangleProduction,
      totalDobladoProduction,
      totalSegregationProduction: totalSegregatedWeight
    };
  }, [productionSummary, totalSegregatedWeight, mangleStartTime, dobladoStartTime, segregationStartTime]);

  // Generate chart data for Doblado
  const dobladoChartData = useMemo(() => {
    const hours = Array.from({length: 24}, (_, i) => i);
    const data = hours.map(hour => hourlyDobladoData[hour] || 0);
    
    return {
      labels: hours.map(h => `${h.toString().padStart(2, '0')}:00`),
      datasets: [{
        label: 'Doblado Units/Hour',
        data: data,
        backgroundColor: 'rgba(255, 193, 7, 0.7)',
        borderColor: 'rgba(255, 193, 7, 1)',
        borderWidth: 2,
        borderRadius: 4,
      }]
    };
  }, [hourlyDobladoData]);

  // Generate chart data for Mangle
  const mangleChartData = useMemo(() => {
    const hours = Array.from({length: 24}, (_, i) => i);
    const data = hours.map(hour => hourlyMangleData[hour] || 0);
    
    return {
      labels: hours.map(h => `${h.toString().padStart(2, '0')}:00`),
      datasets: [{
        label: 'Mangle Units/Hour',
        data: data,
        backgroundColor: 'rgba(17, 153, 142, 0.7)',
        borderColor: 'rgba(17, 153, 142, 1)',
        borderWidth: 2,
        borderRadius: 4,
      }]
    };
  }, [hourlyMangleData]);

  // Generate chart data for Segregation
  const segregationChartData = useMemo(() => {
    const hours = Array.from({length: 24}, (_, i) => i);
    const data = hours.map(hour => hourlySegregationData[hour] || 0);
    
    return {
      labels: hours.map(h => `${h.toString().padStart(2, '0')}:00`),
      datasets: [{
        label: 'Segregation Weight (lbs)/Hour',
        data: data,
        backgroundColor: 'rgba(23, 162, 184, 0.7)',
        borderColor: 'rgba(23, 162, 184, 1)',
        borderWidth: 2,
        borderRadius: 4,
      }]
    };
  }, [hourlySegregationData]);

  // Chart options
  const chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          font: {
            size: 14,
            weight: 'bold'
          },
          color: 'black'
        }
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: 'black',
          font: {
            size: 12,
            weight: 'bold'
          }
        },
        grid: {
          color: 'rgba(0,0,0,0.1)'
        }
      },
      x: {
        ticks: {
          color: 'black',
          font: {
            size: 11,
            weight: 'bold'
          }
        },
        grid: {
          color: 'rgba(0,0,0,0.1)'
        }
      }
    }
  };

  // Calculate daily statistics
  const dailyStats = useMemo((): DailyStats | null => {
    if (!productionSummary || (!productionSummary.allEntriesToday?.length && !productionSummary.recentEntries?.length)) {
      return null;
    }

    const entries = productionSummary.allEntriesToday || productionSummary.recentEntries;
    
    // Debug: verify we're using the same data source as currentProductionRates
    console.log('🔍 [Daily Stats] Using data source:', {
      usingAllEntriesToday: !!(productionSummary.allEntriesToday),
      entriesCount: entries.length,
      totalUnits: entries.reduce((sum, entry) => sum + entry.quantity, 0)
    });
    
    const sortedEntries = [...entries].sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime());
    
    const totalUnits = entries.reduce((sum, entry) => sum + entry.quantity, 0);
    const totalItems = entries.length;
    const uniqueClients = new Set(entries.map(e => e.clientId)).size;
    
    // Calculate Mangle vs Doblado
    const getDefaultClassification = (productName: string): 'Mangle' | 'Doblado' => {
      const name = productName.toLowerCase();
      if (name.includes('sheet') || 
          name.includes('duvet') || 
          name.includes('sabana') ||
          name.includes('servilleta') ||
          name.includes('funda') ||
          name.includes('toalla') ||
          name.includes('towel') ||
          name.includes('mangle') ||
          name.includes('tablecloth')) {
        return 'Mangle';
      }
      return 'Doblado';
    };

    const customClassifications = JSON.parse(localStorage.getItem('productClassifications') || '{}');
    const getClassification = (productName: string) => 
      customClassifications[productName] || getDefaultClassification(productName);
    
    let mangleUnits = 0, dobladoUnits = 0;
    entries.forEach(entry => {
      const classification = getClassification(entry.productName);
      if (classification === 'Mangle') {
        mangleUnits += entry.quantity;
      } else {
        dobladoUnits += entry.quantity;
      }
    });

    // Debug: verify classification matches currentProductionRates
    console.log('🔍 [Daily Stats] Classification results:', {
      mangleUnits,
      dobladoUnits,
      totalCalculated: mangleUnits + dobladoUnits,
      totalExpected: totalUnits,
      matches: (mangleUnits + dobladoUnits) === totalUnits
    });

    // Calculate rates
    const hourlyBreakdown = productionSummary.hourlyBreakdown || {};
    const hourlyRates = Object.values(hourlyBreakdown);
    const peakHourRate = Math.max(...hourlyRates, 0);
    const currentHourRate = productionSummary.currentHourRate || 0;

    // Calculate production span
    const firstEntry = sortedEntries[0];
    const lastEntry = sortedEntries[sortedEntries.length - 1];
    const productionSpanMs = lastEntry.addedAt.getTime() - firstEntry.addedAt.getTime();
    const productionSpanHours = productionSpanMs / (1000 * 60 * 60);

    return {
      totalUnits,
      mangleUnits,
      dobladoUnits,
      totalItems,
      uniqueClients,
      currentHourRate,
      peakHourRate,
      productionSpanHours,
      firstEntryTime: firstEntry.addedAt.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      }),
      lastEntryTime: lastEntry.addedAt.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      }),
      segregatedClients: segregatedClientsToday,
      segregatedWeight: totalSegregatedWeight,
      pickupEntries: pickupEntriesToday,
      pickupWeight: totalPickupWeight
    };
  }, [productionSummary, segregatedClientsToday, totalSegregatedWeight, pickupEntriesToday, totalPickupWeight]);

  if (loading) {
    return (
      <div className="container-fluid py-4">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Loading daily dashboard...</p>
        </div>
      </div>
    );
  }

  if (!dailyStats) {
    return (
      <div className="container-fluid py-4">
        <div className="text-center">
          <div className="alert alert-info">
            <h4>🌅 Ready to Start the Day!</h4>
            <p>No production activity recorded yet today. Let's get started!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{animationStyles}</style>
      <div className="container-fluid py-3" style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
        minHeight: '100vh',
        position: 'relative'
      }}>
        {/* Animated Background Pattern */}
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.02"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          zIndex: -1,
          opacity: 0.3,
          animation: 'float 8s ease-in-out infinite'
        }} />
        
      {/* Header with Current Time */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card border-0 shadow-lg" style={{ borderRadius: '20px' }}>
            <div className="card-body text-center py-4" style={{ 
              background: 'linear-gradient(135deg, #FF6B6B 0%, #4ECDC4 100%)',
              borderRadius: '20px' 
            }}>
              <div className="mb-3">
                <i className="fas fa-sun floating" style={{ 
                  fontSize: '3rem', 
                  color: '#FFE66D', 
                  textShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  animation: 'pulse 2s infinite'
                }}></i>
              </div>
              <h1 className="text-dark mb-2" style={{ 
                fontWeight: '700',
                fontSize: '2.5rem'
              }}>
                🏭 Daily Production Dashboard
              </h1>
              <h2 className="text-dark mb-2" style={{ 
                fontSize: '1.8rem'
              }}>
                {currentTime.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </h2>
              <div className="d-flex justify-content-center align-items-center">
                <div className="bg-light rounded-pill px-4 py-2">
                  <h3 className="text-dark mb-0" style={{ 
                    fontFamily: 'monospace',
                    fontSize: '2rem'
                  }}>
                    <i className="fas fa-clock me-2"></i>
                    {currentTime.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </h3>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Statistics Cards - Enhanced */}
      <div className="row mb-4">
        {/* Total Production */}
        <div className="col-lg-3 col-md-6 mb-3">
          <div className="card border-0 shadow-lg h-100 card-hover" style={{ 
            borderRadius: '20px',
            transform: 'scale(1)',
            transition: 'all 0.3s ease'
          }} onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'} 
             onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>
            <div className="card-body text-center py-4 bg-light text-dark" style={{ 
              borderRadius: '20px'
            }}>
              <div className="mb-3">
                <div className="bg-secondary bg-opacity-20 rounded-circle d-inline-flex align-items-center justify-content-center" 
                     style={{ width: '80px', height: '80px' }}>
                  <i className="fas fa-cogs" style={{ fontSize: '2.5rem', color: '#0E62A0' }}></i>
                </div>
              </div>
              <h1 className="mb-2 number-animation" style={{ 
                fontSize: '3rem', 
                fontWeight: '800'
              }}>
                {dailyStats.totalUnits.toLocaleString()}
              </h1>
              <h5 className="mb-2">
                Total Units Produced
              </h5>
              <div className="bg-secondary bg-opacity-20 rounded-pill px-3 py-1">
                <small style={{ fontSize: '0.9rem' }}>
                  <i className="fas fa-clock me-1"></i>
                  {dailyStats.firstEntryTime} - {dailyStats.lastEntryTime}
                </small>
              </div>
            </div>
          </div>
        </div>

        {/* Mangle Production */}
        <div className="col-lg-3 col-md-6 mb-3">
          <div className="card border-0 shadow-lg h-100 card-hover" style={{ 
            borderRadius: '20px',
            transform: 'scale(1)',
            transition: 'all 0.3s ease'
          }} onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'} 
             onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>
            <div className="card-body text-center py-4 bg-light text-dark" style={{ 
              borderRadius: '20px'
            }}>
              <div className="mb-3">
                <div className="bg-secondary bg-opacity-20 rounded-circle d-inline-flex align-items-center justify-content-center" 
                     style={{ width: '80px', height: '80px' }}>
                  <i className="fas fa-compress-arrows-alt" style={{ fontSize: '2.5rem', color: '#198754' }}></i>
                </div>
              </div>
              <h1 className="mb-2 number-animation" style={{ 
                fontSize: '3rem', 
                fontWeight: '800'
              }}>
                {dailyStats.mangleUnits.toLocaleString()}
              </h1>
              <h5 className="mb-2">
                Mangle Units
              </h5>
              <div className="bg-secondary bg-opacity-20 rounded-pill px-3 py-1">
                <small style={{ fontSize: '0.9rem' }}>
                  <i className="fas fa-percentage me-1"></i>
                  {dailyStats.totalUnits > 0 ? Math.round((dailyStats.mangleUnits / dailyStats.totalUnits) * 100) : 0}% of total
                </small>
              </div>
            </div>
          </div>
        </div>

        {/* Doblado Production */}
        <div className="col-lg-3 col-md-6 mb-3">
          <div className="card border-0 shadow-lg h-100 card-hover" style={{ 
            borderRadius: '20px',
            transform: 'scale(1)',
            transition: 'all 0.3s ease'
          }} onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'} 
             onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>
            <div className="card-body text-center py-4 bg-light text-dark" style={{ 
              borderRadius: '20px'
            }}>
              <div className="mb-3">
                <div className="bg-secondary bg-opacity-20 rounded-circle d-inline-flex align-items-center justify-content-center" 
                     style={{ width: '80px', height: '80px' }}>
                  <i className="fas fa-hands" style={{ fontSize: '2.5rem', color: '#ffc107' }}></i>
                </div>
              </div>
              <h1 className="mb-2 number-animation" style={{ 
                fontSize: '3rem', 
                fontWeight: '800'
              }}>
                {dailyStats.dobladoUnits.toLocaleString()}
              </h1>
              <h5 className="mb-2">
                Doblado Units
              </h5>
              <div className="bg-secondary bg-opacity-20 rounded-pill px-3 py-1">
                <small style={{ fontSize: '0.9rem' }}>
                  <i className="fas fa-percentage me-1"></i>
                  {dailyStats.totalUnits > 0 ? Math.round((dailyStats.dobladoUnits / dailyStats.totalUnits) * 100) : 0}% of total
                </small>
              </div>
            </div>
          </div>
        </div>

        {/* Current Performance */}
        <div className="col-lg-3 col-md-6 mb-3">
          <div className="card border-0 shadow-lg h-100 card-hover" style={{ 
            borderRadius: '20px',
            transform: 'scale(1)',
            transition: 'all 0.3s ease'
          }} onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'} 
             onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>
            <div className="card-body text-center py-4 bg-light text-dark" style={{ 
              borderRadius: '20px'
            }}>
              <div className="mb-3">
                <div className="bg-secondary bg-opacity-20 rounded-circle d-inline-flex align-items-center justify-content-center" 
                     style={{ width: '80px', height: '80px' }}>
                  <i className="fas fa-tachometer-alt" style={{ fontSize: '2.5rem', color: '#0dcaf0' }}></i>
                </div>
              </div>
              <h1 className="mb-2 number-animation" style={{ 
                fontSize: '3rem', 
                fontWeight: '800'
              }}>
                {Math.round(dailyStats.currentHourRate)}
              </h1>
              <h5 className="mb-2">
                Current Rate/Hour
              </h5>
              <div className="bg-secondary bg-opacity-20 rounded-pill px-3 py-1">
                <small style={{ fontSize: '0.9rem' }}>
                  <i className="fas fa-arrow-up me-1"></i>
                  Peak: {Math.round(dailyStats.peakHourRate)}/hr
                </small>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Stats Row - Enhanced with Modern Cards */}
      <div className="row mb-4">
        {/* Clients Served */}
        <div className="col-lg-2 col-md-4 col-6 mb-3">
          <div className="card border-0 shadow h-100 fade-in" style={{ 
            borderRadius: '15px',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)'
          }}>
            <div className="card-body text-center py-3">
              <div className="mb-2">
                <i className="fas fa-users" style={{ 
                  fontSize: '2.5rem', 
                  background: 'linear-gradient(45deg, #FF6B6B, #4ECDC4)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}></i>
              </div>
              <h3 className="mb-1 number-animation" style={{ fontWeight: '700', color: '#2C3E50' }}>
                {dailyStats.uniqueClients}
              </h3>
              <small className="text-muted fw-bold">Clients Served</small>
            </div>
          </div>
        </div>

        {/* Items Processed */}
        <div className="col-lg-2 col-md-4 col-6 mb-3">
          <div className="card border-0 shadow h-100 fade-in" style={{ 
            borderRadius: '15px',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)'
          }}>
            <div className="card-body text-center py-3">
              <div className="mb-2">
                <i className="fas fa-list" style={{ 
                  fontSize: '2.5rem', 
                  background: 'linear-gradient(45deg, #667eea, #764ba2)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}></i>
              </div>
              <h3 className="mb-1 number-animation" style={{ fontWeight: '700', color: '#2C3E50' }}>
                {dailyStats.totalItems}
              </h3>
              <small className="text-muted fw-bold">Items Processed</small>
            </div>
          </div>
        </div>

        {/* Segregated */}
        <div className="col-lg-2 col-md-4 col-6 mb-3">
          <div className="card border-0 shadow h-100 fade-in" style={{ 
            borderRadius: '15px',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)'
          }}>
            <div className="card-body text-center py-3">
              <div className="mb-2">
                <i className="fas fa-tasks" style={{ 
                  fontSize: '2.5rem', 
                  background: 'linear-gradient(45deg, #11998e, #38ef7d)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}></i>
              </div>
              <h3 className="mb-1 number-animation" style={{ fontWeight: '700', color: '#2C3E50' }}>
                {dailyStats.segregatedClients}
              </h3>
              <small className="text-muted fw-bold">Segregated</small>
            </div>
          </div>
        </div>

        {/* Segregation Weight */}
        <div className="col-lg-2 col-md-4 col-6 mb-3">
          <div className="card border-0 shadow h-100 fade-in" style={{ 
            borderRadius: '15px',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)'
          }}>
            <div className="card-body text-center py-3">
              <div className="mb-2">
                <i className="fas fa-weight" style={{ 
                  fontSize: '2.5rem', 
                  background: 'linear-gradient(45deg, #f093fb, #f5576c)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}></i>
              </div>
              <h3 className="mb-1 number-animation" style={{ fontWeight: '700', color: '#2C3E50' }}>
                {dailyStats.segregatedWeight.toLocaleString()}
              </h3>
              <small className="text-muted fw-bold">lbs Segregated</small>
            </div>
          </div>
        </div>

        {/* Pickups */}
        <div className="col-lg-2 col-md-4 col-6 mb-3">
          <div className="card border-0 shadow h-100 fade-in" style={{ 
            borderRadius: '15px',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)'
          }}>
            <div className="card-body text-center py-3">
              <div className="mb-2">
                <i className="fas fa-truck" style={{ 
                  fontSize: '2.5rem', 
                  background: 'linear-gradient(45deg, #fa709a, #fee140)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}></i>
              </div>
              <h3 className="mb-1 number-animation" style={{ fontWeight: '700', color: '#2C3E50' }}>
                {dailyStats.pickupEntries}
              </h3>
              <small className="text-muted fw-bold">Pickups</small>
            </div>
          </div>
        </div>

        {/* Pickup Weight */}
        <div className="col-lg-2 col-md-4 col-6 mb-3">
          <div className="card border-0 shadow h-100 fade-in" style={{ 
            borderRadius: '15px',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)'
          }}>
            <div className="card-body text-center py-3">
              <div className="mb-2">
                <i className="fas fa-truck-loading" style={{ 
                  fontSize: '2.5rem', 
                  background: 'linear-gradient(45deg, #667eea, #764ba2)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}></i>
              </div>
              <h3 className="mb-1 number-animation" style={{ fontWeight: '700', color: '#2C3E50' }}>
                {dailyStats.pickupWeight.toLocaleString()}
              </h3>
              <small className="text-muted fw-bold">lbs Picked Up</small>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Progress Section */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card border-0 shadow-lg" style={{ 
            borderRadius: '20px',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)'
          }}>
            <div className="card-body p-4">
              <div className="d-flex align-items-center mb-4">
                <div className="bg-gradient-primary rounded-circle d-flex align-items-center justify-content-center me-3" 
                     style={{ width: '50px', height: '50px', background: 'linear-gradient(45deg, #FF6B6B, #4ECDC4)' }}>
                  <i className="fas fa-chart-pie text-dark" style={{ fontSize: '1.5rem' }}></i>
                </div>
                <h4 className="mb-0" style={{ color: '#2C3E50', fontWeight: '700' }}>
                  Production Breakdown
                </h4>
              </div>
              
              <div className="row align-items-center">
                <div className="col-lg-8 mb-3">
                  <div className="progress mb-3" style={{ 
                    height: '50px', 
                    borderRadius: '25px',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
                  }}>
                    <div 
                      className="progress-bar d-flex align-items-center justify-content-center position-relative shimmer-effect"
                      style={{ 
                        width: `${dailyStats.totalUnits > 0 ? (dailyStats.mangleUnits / dailyStats.totalUnits) * 100 : 0}%`,
                        background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                        fontSize: '16px',
                        fontWeight: '700',
                        borderRadius: '25px 0 0 25px',
                        textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                      }}
                    >
                      <i className="fas fa-compress-arrows-alt me-2"></i>
                      Mangle: {dailyStats.mangleUnits.toLocaleString()}
                    </div>
                    <div 
                      className="progress-bar d-flex align-items-center justify-content-center shimmer-effect"
                      style={{ 
                        width: `${dailyStats.totalUnits > 0 ? (dailyStats.dobladoUnits / dailyStats.totalUnits) * 100 : 0}%`,
                        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                        fontSize: '16px',
                        fontWeight: '700',
                        borderRadius: '0 25px 25px 0',
                        textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                      }}
                    >
                      <i className="fas fa-hands me-2"></i>
                      Doblado: {dailyStats.dobladoUnits.toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="col-lg-4">
                  <div className="text-center p-4 glow-effect" style={{ 
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: '20px',
                    color: 'white'
                  }}>
                    <div className="mb-2">
                      <i className="fas fa-clock" style={{ fontSize: '2rem', opacity: '0.8' }}></i>
                    </div>
                    <h2 className="mb-1 number-animation" style={{ fontWeight: '800', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                      {Math.floor(dailyStats.productionSpanHours)}h {Math.floor((dailyStats.productionSpanHours % 1) * 60)}m
                    </h2>
                    <small style={{ opacity: '0.9', fontWeight: '600' }}>Active Production Time</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Real-Time Hourly Production Charts */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card border-0 shadow-lg bg-light text-dark" style={{ 
            borderRadius: '25px'
          }}>
            <div className="card-body p-4">
              <div className="text-center mb-4">
                <h3 className="mb-2" style={{ 
                  fontWeight: '800'
                }}>
                  📊 Real-Time Hourly Production Charts
                </h3>
                <p className="mb-0 text-muted">
                  Live tracking of Mangle, Doblado, and Segregation by hour
                </p>
              </div>
              
              <div className="row">
                {/* Mangle Hourly Chart */}
                <div className="col-lg-4 col-md-12 mb-4">
                  <div className="card" style={{ 
                    background: 'rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '20px'
                  }}>
                    <div className="card-header text-center bg-light text-dark" style={{ 
                      borderRadius: '20px 20px 0 0',
                      border: 'none'
                    }}>
                      <h5 className="mb-0" style={{ fontWeight: '700' }}>
                        <i className="fas fa-compress-arrows-alt me-2"></i>
                        Mangle Production per Hour
                      </h5>
                    </div>
                    <div className="card-body" style={{ height: '300px', padding: '20px' }}>
                      <Bar data={mangleChartData} options={chartOptions} />
                    </div>
                    <div className="card-footer bg-success text-white text-center" style={{
                      borderRadius: '0 0 20px 20px',
                      background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)'
                    }}>
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <h4 className="mb-0 fw-bold">
                            <i className="fas fa-tachometer-alt me-2"></i>
                            {currentProductionRates.mangleRate}/hr
                          </h4>
                          <small className="opacity-75">Current Rate</small>
                        </div>
                        <div className="text-end">
                          <h6 className="mb-0">
                            {currentProductionRates.totalMangleProduction.toLocaleString()}
                          </h6>
                          <small className="opacity-75">Total Units</small>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Doblado Hourly Chart */}
                <div className="col-lg-4 col-md-12 mb-4">
                  <div className="card" style={{ 
                    background: 'rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '20px'
                  }}>
                    <div className="card-header text-center bg-light text-dark" style={{ 
                      borderRadius: '20px 20px 0 0',
                      border: 'none'
                    }}>
                      <h5 className="mb-0" style={{ fontWeight: '700' }}>
                        <i className="fas fa-hands me-2"></i>
                        Doblado Production per Hour
                      </h5>
                    </div>
                    <div className="card-body" style={{ height: '300px', padding: '20px' }}>
                      <Bar data={dobladoChartData} options={chartOptions} />
                    </div>
                    <div className="card-footer bg-warning text-dark text-center" style={{
                      borderRadius: '0 0 20px 20px',
                      background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                      color: 'white !important'
                    }}>
                      <div className="d-flex justify-content-between align-items-center text-white">
                        <div>
                          <h4 className="mb-0 fw-bold">
                            <i className="fas fa-tachometer-alt me-2"></i>
                            {currentProductionRates.dobladoRate}/hr
                          </h4>
                          <small className="opacity-75">Current Rate</small>
                        </div>
                        <div className="text-end">
                          <h6 className="mb-0">
                            {currentProductionRates.totalDobladoProduction.toLocaleString()}
                          </h6>
                          <small className="opacity-75">Total Units</small>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Segregation Hourly Chart */}
                <div className="col-lg-4 col-md-12 mb-4">
                  <div className="card" style={{ 
                    background: 'rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '20px'
                  }}>
                    <div className="card-header text-center bg-light text-dark" style={{ 
                      borderRadius: '20px 20px 0 0',
                      border: 'none'
                    }}>
                      <h5 className="mb-0" style={{ fontWeight: '700' }}>
                        <i className="fas fa-tasks me-2"></i>
                        Segregation per Hour
                      </h5>
                    </div>
                    <div className="card-body" style={{ height: '300px', padding: '20px' }}>
                      <Bar data={segregationChartData} options={chartOptions} />
                    </div>
                    <div className="card-footer bg-info text-white text-center" style={{
                      borderRadius: '0 0 20px 20px',
                      background: 'linear-gradient(135deg, #23a2b8 0%, #17a2b8 100%)'
                    }}>
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <h4 className="mb-0 fw-bold">
                            <i className="fas fa-tachometer-alt me-2"></i>
                            {currentProductionRates.segregationRate} lbs/hr
                          </h4>
                          <small className="opacity-75">Current Rate</small>
                        </div>
                        <div className="text-end">
                          <h6 className="mb-0">
                            {currentProductionRates.totalSegregationProduction.toLocaleString()} lbs
                          </h6>
                          <small className="opacity-75">Total Weight</small>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Current Production Rates */}
              <div className="row">
                <div className="col-12">
                  <div className="card" style={{ 
                    background: 'rgba(255, 255, 255, 0.15)',
                    backdropFilter: 'blur(15px)',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderRadius: '20px'
                  }}>
                    <div className="card-body p-4">
                      <h5 className="text-center text-dark mb-4" style={{ fontWeight: '700' }}>
                        📈 Current Production Rates (Area-Specific Duration Calculations)
                      </h5>
                      <div className="row">
                        <div className="col-lg-2 col-md-4 col-6 text-center mb-3">
                          <div className="text-success mb-2">
                            <i className="fas fa-compress-arrows-alt" style={{ fontSize: '2rem' }}></i>
                          </div>
                          <h3 className="text-dark number-animation" style={{ 
                            fontWeight: '800'
                          }}>
                            {currentProductionRates.mangleRate}
                          </h3>
                          <small style={{ opacity: '0.9', fontWeight: '600' }}>Mangle Units/Hour</small>
                          <div className="mt-1">
                            <small style={{ opacity: '0.7' }}>
                              Duration: {currentProductionRates.mangleHoursElapsed.toFixed(1)}h
                            </small>
                          </div>
                        </div>
                        <div className="col-lg-2 col-md-4 col-6 text-center mb-3">
                          <div className="text-warning mb-2">
                            <i className="fas fa-hands" style={{ fontSize: '2rem' }}></i>
                          </div>
                          <h3 className="text-dark number-animation" style={{ 
                            fontWeight: '800'
                          }}>
                            {currentProductionRates.dobladoRate}
                          </h3>
                          <small style={{ opacity: '0.9', fontWeight: '600' }}>Doblado Units/Hour</small>
                          <div className="mt-1">
                            <small style={{ opacity: '0.7' }}>
                              Duration: {currentProductionRates.dobladoHoursElapsed.toFixed(1)}h
                            </small>
                          </div>
                        </div>
                        <div className="col-lg-2 col-md-4 col-6 text-center mb-3">
                          <div className="text-info mb-2">
                            <i className="fas fa-tasks" style={{ fontSize: '2rem' }}></i>
                          </div>
                          <h3 className="text-dark number-animation" style={{ 
                            fontWeight: '800'
                          }}>
                            {currentProductionRates.segregationRate}
                          </h3>
                          <small style={{ opacity: '0.9', fontWeight: '600' }}>Segregation lbs/Hour</small>
                          <div className="mt-1">
                            <small style={{ opacity: '0.7' }}>
                              Duration: {currentProductionRates.segregationHoursElapsed.toFixed(1)}h
                            </small>
                          </div>
                        </div>
                        <div className="col-lg-2 col-md-4 col-6 text-center mb-3">
                          <div className="text-light mb-2">
                            <i className="fas fa-compress-arrows-alt" style={{ fontSize: '2rem' }}></i>
                          </div>
                          <h3 className="text-dark number-animation" style={{ 
                            fontWeight: '800'
                          }}>
                            {currentProductionRates.totalMangleProduction.toLocaleString()}
                          </h3>
                          <small style={{ opacity: '0.9', fontWeight: '600' }}>Total Mangle Units</small>
                          <div className="mt-1">
                            <small style={{ opacity: '0.7' }}>During production</small>
                          </div>
                        </div>
                        <div className="col-lg-2 col-md-4 col-6 text-center mb-3">
                          <div className="text-success mb-2">
                            <i className="fas fa-calculator" style={{ fontSize: '2rem' }}></i>
                          </div>
                          <h3 className="text-dark number-animation" style={{ 
                            fontWeight: '800'
                          }}>
                            {currentProductionRates.totalDobladoProduction.toLocaleString()}
                          </h3>
                          <small style={{ opacity: '0.9', fontWeight: '600' }}>Total Doblado Units</small>
                          <div className="mt-1">
                            <small style={{ opacity: '0.7' }}>During production</small>
                          </div>
                        </div>
                        <div className="col-lg-2 col-md-4 col-6 text-center mb-3">
                          <div className="text-primary mb-2">
                            <i className="fas fa-weight-hanging" style={{ fontSize: '2rem' }}></i>
                          </div>
                          <h3 className="text-dark number-animation" style={{ 
                            fontWeight: '800'
                          }}>
                            {currentProductionRates.totalSegregationProduction.toLocaleString()}
                          </h3>
                          <small style={{ opacity: '0.9', fontWeight: '600' }}>Total Segregation lbs</small>
                          <div className="mt-1">
                            <small style={{ opacity: '0.7' }}>During production</small>
                          </div>
                        </div>
                      </div>
                      <div className="text-center mt-3">
                        <small style={{ opacity: '0.8', fontStyle: 'italic' }}>
                          💡 Each area uses its configured start time → last item time for duration calculation
                        </small>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* End-of-Shift Detection Dashboard */}
      <div className="row mb-4">
        <div className="col-12">
          <EndOfShiftDashboard className="shadow-lg border-0" />
        </div>
      </div>

      {/* Enhanced Footer */}
      <div className="row">
        <div className="col-12">
          <div className="card border-0 shadow-lg" style={{ 
            borderRadius: '20px',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)'
          }}>
            <div className="card-body text-center py-4">
              <div className="mb-3">
                <i className="fas fa-heart floating" style={{ 
                  fontSize: '2rem', 
                  color: '#e74c3c',
                  animation: 'pulse 2s infinite'
                }}></i>
              </div>
              <h5 className="mb-2" style={{ color: '#2C3E50', fontWeight: '600' }}>
                <i className="fas fa-sync-alt me-2" style={{ 
                  animation: 'spin 3s linear infinite',
                  color: '#3498db'
                }}></i>
                Dashboard updates automatically every minute
              </h5>
              <div className="d-flex justify-content-center align-items-center">
                <div className="bg-gradient-success rounded-pill px-4 py-2" style={{
                  background: 'linear-gradient(45deg, #FF6B6B, #4ECDC4)',
                  color: 'white'
                }}>
                  <h6 className="mb-0" style={{ fontWeight: '700' }}>
                    Keep up the excellent work! 💪 🌟 🚀
                  </h6>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default DailyEmployeeDashboard;
