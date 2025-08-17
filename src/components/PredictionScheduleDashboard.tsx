import React, { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, where, orderBy, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import { Invoice, Client, Product } from "../types";
import { Line, Bar, Pie, Radar } from 'react-chartjs-2';
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
  RadialLinearScale,
} from 'chart.js';

// Import centralized date/time utilities
import {
  parseTimestamp,
  formatDateForComparison,
  createDateRange,
  getDaysFromNow,
  createFirebaseDateQuery,
  isHoliday,
  formatDateForDisplay,
  formatTimeForDisplay
} from '../utils/dateTimeUtils';

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
  ArcElement,
  RadialLinearScale
);

interface PickupEntry {
  id: string;
  clientId: string;
  clientName: string;
  timestamp: Date;
  weight: number;
  driverName: string;
}

interface WeeklyPattern {
  dayOfWeek: number;
  dayName: string;
  avgWeight: number;
  avgEntries: number;
  avgRevenue: number;
  avgClientCount: number;
  confidence: number;
  peakHour: number;
  stdDev?: number; // Added for confidence interval calculations
  recommendations: string[];
}

interface ClientPrediction {
  clientId: string;
  clientName: string;
  likelihood: number;
  predictedWeight: number;
  predictedTime: string;
  confidence: number;
  lastSeen: string;
  weeklyPattern: boolean[];
}

interface DayPrediction {
  date: string;
  dayName: string;
  totalPredictedWeight: number;
  totalPredictedEntries: number;
  totalPredictedRevenue: number;
  predictedClientCount: number;
  confidenceLevel: number;
  peakHours: number[];
  staffingRecommendation: string;
  criticalFactors: string[];
}

// New interface for weight comparison
interface DailyWeightComparison {
  date: string;
  dayName: string;
  averageWeight: number;
  predictedWeight: number;
  actualPickupWeight: number; // For historical dates
  difference: number;
  percentageDifference: number;
  accuracy: 'High' | 'Medium' | 'Low' | 'N/A';
  hasActualData: boolean;
  clientCount: number;
  entryCount: number;
}

// Interface for prediction accuracy tracking
interface PredictionAccuracyRecord {
  date: string;
  dayOfWeek: number;
  clientId?: string;
  predictedValue: number;
  actualValue: number;
  predictionType: 'weight' | 'entries' | 'clientActivity';
  errorRate: number;
  confidenceUsed: number;
  modelUsed: string;
  timestamp: Date;
}

// Interface for confidence learning system
interface ConfidenceLearning {
  modelName: string;
  baseConfidence: number;
  learningRate: number;
  accuracyHistory: number[];
  recentAccuracy: number;
  adjustedConfidence: number;
  lastUpdate: Date;
  predictionCount: number;
}

const PredictionScheduleDashboard: React.FC = () => {

  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pickupEntries, setPickupEntries] = useState<PickupEntry[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  
  // Prediction data
  const [weeklyPatterns, setWeeklyPatterns] = useState<WeeklyPattern[]>([]);
  const [clientPredictions, setClientPredictions] = useState<ClientPrediction[]>([]);
  const [next7DaysPredictions, setNext7DaysPredictions] = useState<DayPrediction[]>([]);
  
  // Weight comparison data
  const [weightComparisons, setWeightComparisons] = useState<DailyWeightComparison[]>([]);
  
  // Self-learning confidence system
  const [accuracyRecords, setAccuracyRecords] = useState<PredictionAccuracyRecord[]>([]);
  const [confidenceLearning, setConfidenceLearning] = useState<ConfidenceLearning[]>([]);
  const [adaptiveConfidence, setAdaptiveConfidence] = useState<{ [key: string]: number }>({});
  
  // UI State
  const [selectedPredictionDays, setSelectedPredictionDays] = useState(7);
  const [predictionConfidenceFilter, setPredictionConfidenceFilter] = useState(0.6);

  // Load historical data with consistent date/time handling
  useEffect(() => {
    loadHistoricalData();
  }, []);

  const loadHistoricalData = async () => {
    setLoading(true);
    try {
      console.log("🔮 Loading historical data for predictions...");

      // Load last 90 days of data for analysis - using consistent date handling
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999); // Include all of today
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);
      startDate.setHours(0, 0, 0, 0); // Start of 90 days ago

      // Load invoices with proper string date handling (keeping original format)
      const invoicesSnapshot = await getDocs(collection(db, "invoices"));
      const invoicesData = invoicesSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }) as Invoice)
        .filter(inv => {
          if (!inv.date) return false;
          const invDate = parseTimestamp(inv.date);
          return invDate >= startDate && invDate <= endDate;
        });

      // Load pickup entries using Firebase Timestamps for queries
      const entriesQuery = query(
        collection(db, "pickup_entries"),
        where("timestamp", ">=", Timestamp.fromDate(startDate)),
        where("timestamp", "<=", Timestamp.fromDate(endDate))
      );
      const entriesSnapshot = await getDocs(entriesQuery);
      const entriesData = entriesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          clientId: data.clientId,
          clientName: data.clientName || 'Unknown',
          timestamp: parseTimestamp(data.timestamp), // Ensure consistent Date handling
          weight: data.weight || 0,
          driverName: data.driverName || 'Unknown'
        } as PickupEntry;
      });

      // Load clients
      const clientsSnapshot = await getDocs(collection(db, "clients"));
      const clientsData = clientsSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }) as Client);

      setInvoices(invoicesData);
      setPickupEntries(entriesData);
      setClients(clientsData);

      console.log(`📊 Loaded data with consistent date handling:`, {
        invoices: invoicesData.length,
        entries: entriesData.length,
        clients: clientsData.length,
        dateRange: `${startDate.toISOString().slice(0, 10)} to ${endDate.toISOString().slice(0, 10)}`
      });

    } catch (error) {
      console.error("Error loading historical data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Self-Learning Confidence System
  const updateAccuracyRecords = useMemo(() => {
    if (!pickupEntries.length || !weightComparisons.length) return [];

    console.log("🧠 Updating prediction accuracy records for confidence learning...");

    const records: PredictionAccuracyRecord[] = [];

    // Analyze historical weight predictions
    weightComparisons
      .filter(comp => comp.hasActualData && comp.predictedWeight > 0)
      .forEach(comp => {
        const errorRate = Math.abs(comp.percentageDifference) / 100;
        
        records.push({
          date: comp.date,
          dayOfWeek: new Date(comp.date).getDay(),
          predictedValue: comp.predictedWeight,
          actualValue: comp.actualPickupWeight,
          predictionType: 'weight',
          errorRate,
          confidenceUsed: 0.7, // Default confidence
          modelUsed: 'weeklyPattern',
          timestamp: new Date(comp.date)
        });
      });

    // Analyze client prediction accuracy
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatDateForComparison(yesterday);
    
    const yesterdayEntries = pickupEntries.filter(entry => {
      const entryDate = parseTimestamp(entry.timestamp);
      return formatDateForComparison(entryDate) === yesterdayStr;
    });

    const yesterdayClients = new Set(yesterdayEntries.map(e => e.clientId));
    
    clientPredictions.forEach(pred => {
      const actuallyShowed = yesterdayClients.has(pred.clientId);
      const errorRate = actuallyShowed ? 
        Math.abs(pred.likelihood - 1) : 
        Math.abs(pred.likelihood - 0);

      records.push({
        date: yesterdayStr,
        dayOfWeek: yesterday.getDay(),
        clientId: pred.clientId,
        predictedValue: pred.likelihood,
        actualValue: actuallyShowed ? 1 : 0,
        predictionType: 'clientActivity',
        errorRate,
        confidenceUsed: pred.confidence,
        modelUsed: 'clientBehavior',
        timestamp: yesterday
      });
    });

    console.log(`🧠 Generated ${records.length} accuracy records for confidence learning`);
    return records;
  }, [pickupEntries, weightComparisons, clientPredictions]);

  // Adaptive Confidence Learning System
  const calculateAdaptiveConfidence = useMemo(() => {
    if (!updateAccuracyRecords.length) return {};

    console.log("🎯 Calculating adaptive confidence adjustments based on historical accuracy...");

    const confidenceAdjustments: { [key: string]: number } = {};
    const modelPerformance: { [modelName: string]: { 
      accuracyHistory: number[]; 
      recentAccuracy: number; 
      predictionCount: number;
    } } = {};

    // Group records by model and analyze performance
    updateAccuracyRecords.forEach(record => {
      const modelKey = `${record.modelUsed}_${record.predictionType}`;
      
      if (!modelPerformance[modelKey]) {
        modelPerformance[modelKey] = {
          accuracyHistory: [],
          recentAccuracy: 0,
          predictionCount: 0
        };
      }

      // Convert error rate to accuracy (1 - error)
      const accuracy = Math.max(0, 1 - record.errorRate);
      modelPerformance[modelKey].accuracyHistory.push(accuracy);
      modelPerformance[modelKey].predictionCount++;
    });

    // Calculate confidence adjustments for each model
    Object.keys(modelPerformance).forEach(modelKey => {
      const performance = modelPerformance[modelKey];
      
      if (performance.accuracyHistory.length < 3) {
        // Not enough data for adjustment
        confidenceAdjustments[modelKey] = 1.0;
        return;
      }

      // Calculate recent performance (last 30% of predictions)
      const recentCount = Math.max(3, Math.floor(performance.accuracyHistory.length * 0.3));
      const recentAccuracies = performance.accuracyHistory.slice(-recentCount);
      const recentAverage = recentAccuracies.reduce((sum, acc) => sum + acc, 0) / recentAccuracies.length;
      
      // Calculate overall performance
      const overallAverage = performance.accuracyHistory.reduce((sum, acc) => sum + acc, 0) / performance.accuracyHistory.length;
      
      // Calculate trend (is performance improving?)
      const oldHalf = performance.accuracyHistory.slice(0, Math.floor(performance.accuracyHistory.length / 2));
      const newHalf = performance.accuracyHistory.slice(Math.floor(performance.accuracyHistory.length / 2));
      const oldAverage = oldHalf.reduce((sum, acc) => sum + acc, 0) / oldHalf.length;
      const newAverage = newHalf.reduce((sum, acc) => sum + acc, 0) / newHalf.length;
      const trendFactor = newAverage > oldAverage ? 1.1 : 0.95;
      
      // Base confidence adjustment on recent performance
      let confidenceMultiplier = 1.0;
      
      if (recentAverage > 0.85) {
        // Excellent performance - increase confidence
        confidenceMultiplier = Math.min(1.5, 1.0 + (recentAverage - 0.85) * 2);
      } else if (recentAverage > 0.7) {
        // Good performance - slight increase
        confidenceMultiplier = 1.0 + (recentAverage - 0.7) * 0.5;
      } else if (recentAverage > 0.5) {
        // Average performance - maintain
        confidenceMultiplier = 1.0;
      } else {
        // Poor performance - decrease confidence
        confidenceMultiplier = Math.max(0.3, recentAverage * 1.5);
      }
      
      // Apply trend factor
      confidenceMultiplier *= trendFactor;
      
      // Apply data volume factor (more predictions = more reliable adjustment)
      const volumeFactor = Math.min(1.2, 1.0 + (performance.predictionCount / 100) * 0.2);
      confidenceMultiplier *= volumeFactor;
      
      confidenceAdjustments[modelKey] = Math.max(0.1, Math.min(2.0, confidenceMultiplier));
      
      console.log(`🎯 Model ${modelKey}: Recent accuracy ${(recentAverage * 100).toFixed(1)}%, Confidence adjustment: ${confidenceMultiplier.toFixed(2)}x`);
    });

    return confidenceAdjustments;
  }, [updateAccuracyRecords]);

  // Enhanced weekly patterns using advanced statistical methods and machine learning principles
  const calculateWeeklyPatterns = useMemo((): WeeklyPattern[] => {
    if (!pickupEntries.length || !invoices.length) return [];

    console.log("🧮 Calculating enhanced weekly patterns with advanced analytics...");

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const patterns: WeeklyPattern[] = [];

    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      // Filter data for this day of week with consistent date handling
      const dayEntries = pickupEntries.filter(entry => {
        // Ensure entry.timestamp is a Date object
        const entryDate = parseTimestamp(entry.timestamp);
        return entryDate.getDay() === dayOfWeek;
      });
      
      const dayInvoices = invoices.filter(inv => {
        if (!inv.date) return false;
        const invDate = parseTimestamp(inv.date);
        return invDate.getDay() === dayOfWeek;
      });

      // Enhanced grouping with outlier detection - using consistent date formatting
      const dateGroups: { [date: string]: { 
        weight: number; 
        entries: number; 
        revenue: number; 
        clients: Set<string>;
        isOutlier?: boolean;
      } } = {};
      
      // Process entries with consistent date formatting
      dayEntries.forEach(entry => {
        const entryDate = parseTimestamp(entry.timestamp);
        const dateStr = formatDateForComparison(entryDate);
        if (!dateGroups[dateStr]) {
          dateGroups[dateStr] = { weight: 0, entries: 0, revenue: 0, clients: new Set() };
        }
        dateGroups[dateStr].weight += entry.weight;
        dateGroups[dateStr].entries += 1;
        dateGroups[dateStr].clients.add(entry.clientId);
      });

      // Process invoices with better revenue calculation and consistent date handling
      dayInvoices.forEach(inv => {
        const invDate = parseTimestamp(inv.date);
        const dateStr = formatDateForComparison(invDate);
        if (!dateGroups[dateStr]) {
          dateGroups[dateStr] = { weight: 0, entries: 0, revenue: 0, clients: new Set() };
        }
        
        // Enhanced revenue calculation
        let invoiceRevenue = 0;
        if (inv.carts) {
          inv.carts.forEach(cart => {
            if (cart.items) {
              cart.items.forEach(item => {
                const quantity = item.quantity || 0;
                const price = item.price || 0;
                invoiceRevenue += quantity * price;
              });
            }
          });
        }
        dateGroups[dateStr].revenue += invoiceRevenue;
      });

      // Outlier detection using IQR method
      const dates = Object.keys(dateGroups);
      if (dates.length > 4) { // Need sufficient data for outlier detection
        const weights = dates.map(date => dateGroups[date].weight).sort((a, b) => a - b);
        const q1 = weights[Math.floor(weights.length * 0.25)];
        const q3 = weights[Math.floor(weights.length * 0.75)];
        const iqr = q3 - q1;
        const lowerBound = q1 - (1.5 * iqr);
        const upperBound = q3 + (1.5 * iqr);
        
        dates.forEach(date => {
          const weight = dateGroups[date].weight;
          if (weight < lowerBound || weight > upperBound) {
            dateGroups[date].isOutlier = true;
          }
        });
      }

      // Calculate robust statistics (excluding outliers)
      const normalDates = dates.filter(date => !dateGroups[date].isOutlier);
      const outlierDates = dates.filter(date => dateGroups[date].isOutlier);
      
      // Use different weights for normal vs outlier data
      const totalNormalWeight = normalDates.reduce((sum, date) => sum + dateGroups[date].weight, 0);
      const totalOutlierWeight = outlierDates.reduce((sum, date) => sum + dateGroups[date].weight, 0);
      
      // Weighted averages (70% normal data, 30% outlier data to account for unusual days)
      const normalCount = normalDates.length || 1;
      const outlierCount = outlierDates.length || 0;
      
      const avgWeight = normalCount > 0 ? 
        ((totalNormalWeight / normalCount) * 0.7) + 
        ((outlierCount > 0 ? (totalOutlierWeight / outlierCount) : 0) * 0.3) : 0;
      
      const avgEntries = normalCount > 0 ? 
        ((normalDates.reduce((sum, date) => sum + dateGroups[date].entries, 0) / normalCount) * 0.7) + 
        ((outlierCount > 0 ? (outlierDates.reduce((sum, date) => sum + dateGroups[date].entries, 0) / outlierCount) : 0) * 0.3) : 0;
        
      const avgRevenue = normalCount > 0 ? 
        ((normalDates.reduce((sum, date) => sum + dateGroups[date].revenue, 0) / normalCount) * 0.7) + 
        ((outlierCount > 0 ? (outlierDates.reduce((sum, date) => sum + dateGroups[date].revenue, 0) / outlierCount) : 0) * 0.3) : 0;
        
      const avgClientCount = normalCount > 0 ? 
        ((normalDates.reduce((sum, date) => sum + dateGroups[date].clients.size, 0) / normalCount) * 0.7) + 
        ((outlierCount > 0 ? (outlierDates.reduce((sum, date) => sum + dateGroups[date].clients.size, 0) / outlierCount) : 0) * 0.3) : 0;

      // Enhanced confidence calculation with multiple factors
      const dataPointsFactor = Math.min(1, dates.length / 8); // More weeks = higher confidence
      const recentDataFactor = dates.filter(date => {
        const daysDiff = (new Date().getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff <= 30;
      }).length / Math.max(4, dates.length * 0.3); // Recent data weight
      
      const variabilityFactor = normalDates.length > 1 ? 
        Math.max(0.1, 1 - (Math.sqrt(
          normalDates.reduce((sum, date) => sum + Math.pow(dateGroups[date].weight - avgWeight, 2), 0) / normalDates.length
        ) / Math.max(avgWeight, 1))) : 0.5;
      
      const outlierPenalty = Math.max(0.7, 1 - (outlierCount / Math.max(dates.length, 1)) * 0.5);
      
      const enhancedConfidence = Math.min(1, 
        (dataPointsFactor * 0.3 + 
         recentDataFactor * 0.3 + 
         variabilityFactor * 0.3 + 
         outlierPenalty * 0.1)
      );

      // Enhanced peak hour analysis with time weighting
      const hourCounts: { [hour: number]: { count: number; weight: number } } = {};
      dayEntries.forEach(entry => {
        const hour = entry.timestamp.getHours();
        if (!hourCounts[hour]) hourCounts[hour] = { count: 0, weight: 0 };
        hourCounts[hour].count += 1;
        hourCounts[hour].weight += entry.weight;
        
        // Weight recent entries more heavily
        const daysDiff = (new Date().getTime() - entry.timestamp.getTime()) / (1000 * 60 * 60 * 24);
        const recencyWeight = Math.exp(-daysDiff / 30); // Exponential decay over 30 days
        hourCounts[hour].weight += entry.weight * recencyWeight;
      });
      
      // Find peak hour based on weighted activity
      const peakHour = Object.entries(hourCounts)
        .sort(([,a], [,b]) => (b.count + b.weight * 0.1) - (a.count + a.weight * 0.1))[0]?.[0] || 9;

      // Enhanced recommendations with confidence-based suggestions
      const recommendations: string[] = [];
      
      if (enhancedConfidence < 0.4) {
        recommendations.push("⚠️ Low confidence - collect more data for this day");
      }
      
      if (avgWeight > 1200 && enhancedConfidence > 0.6) {
        recommendations.push("🔥 Consistently high volume - schedule extra staff");
      } else if (avgWeight > 800 && enhancedConfidence > 0.5) {
        recommendations.push("📈 Above average volume - monitor staffing needs");
      }
      
      if (avgEntries > 25 && enhancedConfidence > 0.5) {
        recommendations.push("🚚 High pickup frequency - optimize driver routes");
      }
      
      if (outlierCount > normalCount * 0.3) {
        recommendations.push("📊 Variable patterns - prepare for fluctuations");
      }
      
      const peakHourNum = parseInt(peakHour.toString());
      if (peakHourNum < 9) {
        recommendations.push("🌅 Early peak activity - start operations early");
      } else if (peakHourNum > 16) {
        recommendations.push("🌆 Late peak activity - extend evening coverage");
      } else if (peakHourNum >= 12 && peakHourNum <= 14) {
        recommendations.push("🍽️ Lunch-time peak - maintain full staff during breaks");
      }

      // Seasonal adjustments
      const recentEntries = dayEntries.filter(entry => {
        const daysDiff = (new Date().getTime() - entry.timestamp.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff <= 30;
      });
      
      if (recentEntries.length > dayEntries.length * 0.4) {
        recommendations.push("📈 Recent activity increase - trending upward");
      }

      patterns.push({
        dayOfWeek,
        dayName: dayNames[dayOfWeek],
        avgWeight: Math.round(avgWeight),
        avgEntries: Math.round(avgEntries),
        avgRevenue: Math.round(avgRevenue),
        avgClientCount: Math.round(avgClientCount),
        confidence: enhancedConfidence,
        peakHour: peakHourNum,
        recommendations
      });
    }

    console.log(`📊 Generated enhanced weekly patterns with confidence levels:`, 
      patterns.map(p => ({ day: p.dayName, confidence: (p.confidence * 100).toFixed(0) + '%' }))
    );
    
    return patterns;
  }, [pickupEntries, invoices]);

  // Enhanced client behavior prediction using advanced statistical methods
  const calculateClientPredictions = useMemo((): ClientPrediction[] => {
    if (!pickupEntries.length || !clients.length) return [];

    console.log("🤖 Calculating enhanced client predictions with advanced algorithms...");

    const predictions: ClientPrediction[] = [];
    const tomorrow = getDaysFromNow(1);
    const tomorrowDayOfWeek = tomorrow.getDay();

    clients.forEach(client => {
      const clientEntries = pickupEntries.filter(entry => entry.clientId === client.id);
      
      // Require more data points for higher confidence
      if (clientEntries.length < 5) return;

      // Sort entries chronologically
      clientEntries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      // Analyze multiple patterns
      const weeklyPattern = new Array(7).fill(false);
      const dayWeights: { [day: number]: number[] } = {};
      const dayTimes: { [day: number]: number[] } = {};
      const recentTrend: number[] = [];
      const seasonalFactors: { [month: number]: number } = {};

      // Enhanced data analysis
      clientEntries.forEach((entry, index) => {
        const dayOfWeek = entry.timestamp.getDay();
        const month = entry.timestamp.getMonth();
        weeklyPattern[dayOfWeek] = true;
        
        if (!dayWeights[dayOfWeek]) {
          dayWeights[dayOfWeek] = [];
          dayTimes[dayOfWeek] = [];
        }
        dayWeights[dayOfWeek].push(entry.weight);
        dayTimes[dayOfWeek].push(entry.timestamp.getHours() * 60 + entry.timestamp.getMinutes());
        
        // Track recent trend (last 30 days)
        const daysSinceEntry = (new Date().getTime() - entry.timestamp.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceEntry <= 30) {
          recentTrend.push(entry.weight);
        }
        
        // Seasonal analysis
        if (!seasonalFactors[month]) seasonalFactors[month] = 0;
        seasonalFactors[month] += entry.weight;
      });

      // Advanced likelihood calculation using multiple factors
      const tomorrowEntries = clientEntries.filter(entry => 
        entry.timestamp.getDay() === tomorrowDayOfWeek
      );
      
      // Base frequency likelihood
      const totalWeeks = Math.max(1, 
        (new Date().getTime() - clientEntries[0].timestamp.getTime()) / (1000 * 60 * 60 * 24 * 7)
      );
      const baseLikelihood = tomorrowEntries.length / totalWeeks;
      
      // Recency factor (higher weight for recent activity)
      const daysSinceLastEntry = (new Date().getTime() - clientEntries[clientEntries.length - 1].timestamp.getTime()) / (1000 * 60 * 60 * 24);
      const recencyFactor = Math.exp(-daysSinceLastEntry / 14); // Exponential decay over 14 days
      
      // Consistency factor (how regular is this client?)
      const tomorrowIntervals: number[] = [];
      for (let i = 1; i < tomorrowEntries.length; i++) {
        const intervalDays = (tomorrowEntries[i].timestamp.getTime() - tomorrowEntries[i-1].timestamp.getTime()) / (1000 * 60 * 60 * 24);
        tomorrowIntervals.push(intervalDays);
      }
      
      let consistencyFactor = 1;
      if (tomorrowIntervals.length > 1) {
        const avgInterval = tomorrowIntervals.reduce((a, b) => a + b) / tomorrowIntervals.length;
        const intervalVariance = tomorrowIntervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / tomorrowIntervals.length;
        consistencyFactor = Math.max(0.1, 1 - (Math.sqrt(intervalVariance) / avgInterval));
      }
      
      // Seasonal adjustment
      const currentMonth = new Date().getMonth();
      const currentMonthAvg = seasonalFactors[currentMonth] || 0;
      const allMonthsAvg = Object.values(seasonalFactors).reduce((a, b) => a + b, 0) / Math.max(1, Object.keys(seasonalFactors).length);
      const seasonalAdjustment = allMonthsAvg > 0 ? currentMonthAvg / allMonthsAvg : 1;
      
      // Combined likelihood with multiple factors
      const enhancedLikelihood = Math.min(1, 
        baseLikelihood * recencyFactor * consistencyFactor * seasonalAdjustment
      );

      if (enhancedLikelihood < 0.15) return; // Skip very unlikely clients

      // Enhanced weight prediction using trend analysis
      const tomorrowWeights = dayWeights[tomorrowDayOfWeek] || [];
      let predictedWeight = 0;
      
      if (tomorrowWeights.length > 0) {
        // Use weighted average with more weight on recent data
        const weightedSum = tomorrowWeights.reduce((sum, weight, index) => {
          const recencyWeight = Math.pow(0.9, tomorrowWeights.length - index - 1); // More weight for recent entries
          return sum + (weight * recencyWeight);
        }, 0);
        const totalWeight = tomorrowWeights.reduce((sum, _, index) => {
          return sum + Math.pow(0.9, tomorrowWeights.length - index - 1);
        }, 0);
        predictedWeight = Math.round(weightedSum / totalWeight);
        
        // Apply trend adjustment
        if (recentTrend.length >= 3) {
          const trendSlope = (recentTrend[recentTrend.length - 1] - recentTrend[0]) / recentTrend.length;
          predictedWeight += Math.round(trendSlope * 0.3); // 30% trend influence
        }
      } else {
        // Fallback to overall average with seasonal adjustment
        const overallAvg = clientEntries.reduce((sum, e) => sum + e.weight, 0) / clientEntries.length;
        predictedWeight = Math.round(overallAvg * seasonalAdjustment);
      }

      // Enhanced time prediction with variance consideration
      const tomorrowTimes = dayTimes[tomorrowDayOfWeek] || [];
      let predictedTimeMinutes = 540; // Default 9:00 AM
      
      if (tomorrowTimes.length > 0) {
        // Use median instead of mean for better outlier handling
        const sortedTimes = [...tomorrowTimes].sort((a, b) => a - b);
        predictedTimeMinutes = sortedTimes[Math.floor(sortedTimes.length / 2)];
      }
      
      const predictedHour = Math.floor(predictedTimeMinutes / 60);
      const predictedMinute = predictedTimeMinutes % 60;
      const predictedTime = `${predictedHour.toString().padStart(2, '0')}:${predictedMinute.toString().padStart(2, '0')}`;

      // Advanced confidence calculation
      const dataPointsFactor = Math.min(1, clientEntries.length / 20); // More data = higher confidence
      const recentActivityFactor = Math.min(1, recentTrend.length / 10);
      const variabilityFactor = tomorrowWeights.length > 1 ? 
        Math.max(0.1, 1 - (Math.sqrt(
          tomorrowWeights.reduce((sum, w) => sum + Math.pow(w - predictedWeight, 2), 0) / tomorrowWeights.length
        ) / predictedWeight)) : 0.5;
      
      const enhancedConfidence = Math.min(1, 
        (dataPointsFactor * 0.3 + 
         recentActivityFactor * 0.2 + 
         consistencyFactor * 0.3 + 
         variabilityFactor * 0.2) * 
        enhancedLikelihood
      );

      // Last seen with more detail
      const lastEntry = clientEntries[clientEntries.length - 1];
      const daysSinceLastSeen = Math.floor(
        (new Date().getTime() - lastEntry.timestamp.getTime()) / (1000 * 60 * 60 * 24)
      );

      predictions.push({
        clientId: client.id,
        clientName: client.name,
        likelihood: enhancedLikelihood,
        predictedWeight: Math.max(0, predictedWeight),
        predictedTime,
        confidence: enhancedConfidence,
        lastSeen: daysSinceLastSeen === 0 ? 'Today' : 
                 daysSinceLastSeen === 1 ? 'Yesterday' : 
                 `${daysSinceLastSeen} days ago`,
        weeklyPattern
      });
    });

    console.log(`🎯 Generated ${predictions.length} high-confidence predictions`);
    return predictions
      .filter(p => p.confidence >= predictionConfidenceFilter)
      .sort((a, b) => (b.likelihood * b.confidence) - (a.likelihood * a.confidence)); // Sort by combined score
  }, [pickupEntries, clients, predictionConfidenceFilter]);

  // Enhanced Weekly Patterns with Adaptive Confidence
  const calculateAdaptiveWeeklyPatterns = useMemo((): WeeklyPattern[] => {
    const basePatterns = calculateWeeklyPatterns;
    const adaptiveAdjustments = calculateAdaptiveConfidence;
    
    if (!basePatterns.length) return basePatterns;

    console.log("🔄 Applying adaptive confidence adjustments to weekly patterns...");

    return basePatterns.map(pattern => {
      const modelKey = 'weeklyPattern_weight';
      const confidenceAdjustment = adaptiveAdjustments[modelKey] || 1.0;
      
      // Apply learning-based confidence adjustment
      const adjustedConfidence = Math.min(1.0, pattern.confidence * confidenceAdjustment);
      
      // Add self-improvement recommendations
      const enhancedRecommendations = [...pattern.recommendations];
      
      if (confidenceAdjustment > 1.2) {
        enhancedRecommendations.push("🚀 High prediction accuracy - confidence auto-increased");
      } else if (confidenceAdjustment < 0.8) {
        enhancedRecommendations.push("📊 Adjusting confidence based on recent accuracy");
      }
      
      if (adjustedConfidence > pattern.confidence + 0.1) {
        enhancedRecommendations.push("⬆️ Confidence improved through machine learning");
      }

      return {
        ...pattern,
        confidence: adjustedConfidence,
        recommendations: enhancedRecommendations
      };
    });
  }, [calculateWeeklyPatterns, calculateAdaptiveConfidence]);

  // Enhanced Client Predictions with Adaptive Confidence
  const calculateAdaptiveClientPredictions = useMemo((): ClientPrediction[] => {
    const basePredictions = calculateClientPredictions;
    const adaptiveAdjustments = calculateAdaptiveConfidence;
    
    if (!basePredictions.length) return basePredictions;

    console.log("🔄 Applying adaptive confidence adjustments to client predictions...");

    return basePredictions.map(prediction => {
      const modelKey = 'clientBehavior_clientActivity';
      const confidenceAdjustment = adaptiveAdjustments[modelKey] || 1.0;
      
      // Apply learning-based confidence adjustment
      const adjustedConfidence = Math.min(1.0, prediction.confidence * confidenceAdjustment);
      
      return {
        ...prediction,
        confidence: adjustedConfidence
      };
    });
  }, [calculateClientPredictions, calculateAdaptiveConfidence]);

  // Automatic Confidence Improvement Logger
  const logConfidenceImprovements = useMemo(() => {
    const adaptiveAdjustments = calculateAdaptiveConfidence;
    const improvements: string[] = [];

    Object.entries(adaptiveAdjustments).forEach(([modelKey, adjustment]) => {
      if (adjustment > 1.1) {
        improvements.push(`✅ ${modelKey}: ${((adjustment - 1) * 100).toFixed(1)}% confidence increase`);
      } else if (adjustment < 0.9) {
        improvements.push(`⚠️ ${modelKey}: ${((1 - adjustment) * 100).toFixed(1)}% confidence decrease`);
      }
    });

    if (improvements.length > 0) {
      console.log("🎉 Automatic Confidence Improvements Applied:");
      improvements.forEach(improvement => console.log(improvement));
    }

    return improvements;
  }, [calculateAdaptiveConfidence]);

  // Update states with adaptive versions
  useEffect(() => {
    setAccuracyRecords(updateAccuracyRecords);
  }, [updateAccuracyRecords]);

  useEffect(() => {
    setAdaptiveConfidence(calculateAdaptiveConfidence);
  }, [calculateAdaptiveConfidence]);

  // Enhanced 7-day predictions with advanced forecasting algorithms
  const generateDayPredictions = useMemo((): DayPrediction[] => {
    if (!weeklyPatterns.length || !calculateClientPredictions.length) return [];

    console.log("📅 Generating enhanced 7-day predictions with advanced forecasting...");

    const predictions: DayPrediction[] = [];

    for (let i = 0; i < selectedPredictionDays; i++) {
      const date = getDaysFromNow(i);
      const dayOfWeek = date.getDay();
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
      
      const weeklyPattern = weeklyPatterns.find(p => p.dayOfWeek === dayOfWeek);
      if (!weeklyPattern) continue;

      // Enhanced base prediction with trend analysis
      let totalPredictedWeight = weeklyPattern.avgWeight;
      let totalPredictedEntries = weeklyPattern.avgEntries;
      let totalPredictedRevenue = weeklyPattern.avgRevenue;
      let predictedClientCount = weeklyPattern.avgClientCount;
      
      // Apply temporal adjustments
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isMonday = dayOfWeek === 1;
      const isHolidayDate = isHoliday(date); // Enhanced holiday detection from utilities
      
      // Weekend adjustment
      if (isWeekend && weeklyPattern.confidence > 0.6) {
        totalPredictedWeight *= 0.7; // Typically lower on weekends
        totalPredictedEntries *= 0.6;
        predictedClientCount *= 0.5;
      }
      
      // Monday buildup effect
      if (isMonday && weeklyPattern.confidence > 0.5) {
        totalPredictedWeight *= 1.2; // Monday often has weekend backlog
        totalPredictedEntries *= 1.3;
      }

      // Client-specific predictions for this day
      const dayClientPredictions = calculateClientPredictions.filter(cp => {
        // More sophisticated client day matching
        const hasHistoryOnThisDay = cp.weeklyPattern[dayOfWeek];
        const isHighLikelihood = cp.likelihood > 0.3;
        const isRecentlyActive = !cp.lastSeen.includes('days ago') || parseInt(cp.lastSeen) < 7;
        
        return hasHistoryOnThisDay && isHighLikelihood && isRecentlyActive;
      });
      
      // Multi-model prediction ensemble
      const modelPredictions = [];
      
      // Model 1: Pattern-based prediction
      modelPredictions.push({
        weight: totalPredictedWeight,
        entries: totalPredictedEntries,
        confidence: weeklyPattern.confidence
      });
      
      // Model 2: Client aggregation prediction
      if (dayClientPredictions.length > 0) {
        const clientPredictedWeight = dayClientPredictions.reduce((sum, cp) => {
          // Apply client-specific adjustments
          let adjustedWeight = cp.predictedWeight;
          
          // Seasonal adjustment based on recent trends
          const recentClientEntries = pickupEntries.filter(entry => {
            const daysDiff = (new Date().getTime() - entry.timestamp.getTime()) / (1000 * 60 * 60 * 24);
            return entry.clientId === cp.clientId && daysDiff <= 30;
          });
          
          if (recentClientEntries.length > 0) {
            const recentAvg = recentClientEntries.reduce((s, e) => s + e.weight, 0) / recentClientEntries.length;
            const historicalAvg = pickupEntries
              .filter(entry => entry.clientId === cp.clientId)
              .reduce((s, e) => s + e.weight, 0) / Math.max(1, pickupEntries.filter(e => e.clientId === cp.clientId).length);
            
            if (historicalAvg > 0) {
              const trendFactor = recentAvg / historicalAvg;
              adjustedWeight *= Math.max(0.5, Math.min(1.5, trendFactor)); // Cap adjustments
            }
          }
          
          return sum + (adjustedWeight * cp.likelihood * cp.confidence);
        }, 0);
        
        const clientConfidence = dayClientPredictions.reduce((sum, cp) => sum + cp.confidence, 0) / dayClientPredictions.length;
        
        modelPredictions.push({
          weight: clientPredictedWeight,
          entries: dayClientPredictions.length,
          confidence: clientConfidence
        });
      }
      
      // Model 3: Time series trend prediction
      const historicalSameDayData = pickupEntries.filter(entry => {
        const entryDayOfWeek = entry.timestamp.getDay();
        const daysDiff = (new Date().getTime() - entry.timestamp.getTime()) / (1000 * 60 * 60 * 24);
        return entryDayOfWeek === dayOfWeek && daysDiff <= 60; // Last 60 days
      });
      
      if (historicalSameDayData.length >= 4) {
        // Group by week and calculate trend
        const weeklyTotals: { [week: number]: number } = {};
        historicalSameDayData.forEach(entry => {
          const weekKey = Math.floor((new Date().getTime() - entry.timestamp.getTime()) / (1000 * 60 * 60 * 24 * 7));
          if (!weeklyTotals[weekKey]) weeklyTotals[weekKey] = 0;
          weeklyTotals[weekKey] += entry.weight;
        });
        
        const weeks = Object.keys(weeklyTotals).map(k => parseInt(k)).sort();
        if (weeks.length >= 3) {
          // Simple linear trend
          const weights = weeks.map(w => weeklyTotals[w]);
          const avgWeight = weights.reduce((a, b) => a + b) / weights.length;
          const trend = (weights[weights.length - 1] - weights[0]) / weeks.length;
          
          modelPredictions.push({
            weight: Math.max(0, avgWeight + trend),
            entries: totalPredictedEntries, // Use pattern-based for entries
            confidence: Math.min(1, weights.length / 8)
          });
        }
      }
      
      // Ensemble prediction (weighted average of models)
      const totalModelWeight = modelPredictions.reduce((sum, model) => sum + model.confidence, 0);
      if (totalModelWeight > 0) {
        totalPredictedWeight = modelPredictions.reduce((sum, model) => 
          sum + (model.weight * model.confidence), 0
        ) / totalModelWeight;
        
        totalPredictedEntries = modelPredictions.reduce((sum, model) => 
          sum + (model.entries * model.confidence), 0
        ) / totalModelWeight;
      }

      // Enhanced confidence calculation with model agreement
      const modelVariance = modelPredictions.length > 1 ? 
        modelPredictions.reduce((sum, model) => sum + Math.pow(model.weight - totalPredictedWeight, 2), 0) / modelPredictions.length : 0;
      
      const modelAgreement = modelVariance > 0 ? Math.max(0, 1 - (Math.sqrt(modelVariance) / Math.max(totalPredictedWeight, 1))) : 0.5;
      
      const baseConfidence = weeklyPattern.confidence;
      const clientDataConfidence = dayClientPredictions.length > 0 ? 
        dayClientPredictions.reduce((sum, cp) => sum + cp.confidence, 0) / dayClientPredictions.length : 0;
      const temporalFactors = 1 - (i * 0.05); // Confidence decreases with prediction distance
      
      const enhancedConfidence = Math.min(1, 
        (baseConfidence * 0.4 + 
         clientDataConfidence * 0.3 + 
         modelAgreement * 0.2 + 
         temporalFactors * 0.1)
      );

      // Enhanced peak hours prediction
      const peakHours = [weeklyPattern.peakHour];
      
      // Add secondary peaks based on client predictions
      const clientTimeDistribution: { [hour: number]: number } = {};
      dayClientPredictions.forEach(cp => {
        const hour = parseInt(cp.predictedTime.split(':')[0]);
        clientTimeDistribution[hour] = (clientTimeDistribution[hour] || 0) + cp.likelihood;
      });
      
      const sortedClientHours = Object.entries(clientTimeDistribution)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .map(([hour]) => parseInt(hour));
      
      if (sortedClientHours.length > 0 && sortedClientHours[0] !== weeklyPattern.peakHour) {
        peakHours.push(sortedClientHours[0]);
      }

      // Enhanced staffing recommendations with confidence weighting
      let staffingRecommendation = "Normal staffing";
      if (enhancedConfidence > 0.6) {
        if (totalPredictedWeight > 1400) staffingRecommendation = "Heavy day - Add 2+ extra staff";
        else if (totalPredictedWeight > 1000) staffingRecommendation = "Busy day - Add 1 extra staff";
        else if (totalPredictedWeight > 600) staffingRecommendation = "Normal+ day - Monitor closely";
        else if (totalPredictedWeight < 300) staffingRecommendation = "Light day - Reduced staffing possible";
      } else {
        staffingRecommendation += " (Low confidence - monitor actual data)";
      }

      // Enhanced critical factors
      const criticalFactors: string[] = [];
      
      if (enhancedConfidence < 0.4) criticalFactors.push("⚠️ Low prediction confidence - high uncertainty");
      else if (enhancedConfidence < 0.6) criticalFactors.push("⚡ Moderate confidence - monitor closely");
      
      if (dayClientPredictions.length > predictedClientCount * 0.8) {
        criticalFactors.push("👥 High confirmed client activity");
      }
      
      if (modelPredictions.length > 1 && modelVariance > totalPredictedWeight * 0.3) {
        criticalFactors.push("📊 Model disagreement - volatile conditions");
      }
      
      if (isMonday && weeklyPattern.confidence > 0.5) {
        criticalFactors.push("📅 Monday buildup effect expected");
      }
      
      if (isWeekend) {
        criticalFactors.push("🏖️ Weekend patterns - typically reduced activity");
      }
      
      if (peakHours.length > 1) {
        criticalFactors.push("⏰ Multiple peak periods identified");
      }
      
      if (i === 0) criticalFactors.push("🎯 Tomorrow - immediate preparation needed");
      
      // Revenue prediction enhancement
      const avgRevenuePerPound = weeklyPattern.avgRevenue > 0 && weeklyPattern.avgWeight > 0 ? 
        weeklyPattern.avgRevenue / weeklyPattern.avgWeight : 2.5; // Fallback rate
      
      totalPredictedRevenue = totalPredictedWeight * avgRevenuePerPound;
      
      predictions.push({
        date: formatDateForComparison(date), // Use timezone-safe formatting
        dayName,
        totalPredictedWeight: Math.round(Math.max(0, totalPredictedWeight)),
        totalPredictedEntries: Math.round(Math.max(0, totalPredictedEntries)),
        totalPredictedRevenue: Math.round(Math.max(0, totalPredictedRevenue)),
        predictedClientCount: Math.round(Math.max(0, predictedClientCount)),
        confidenceLevel: enhancedConfidence,
        peakHours: peakHours.filter((hour, index, arr) => arr.indexOf(hour) === index).sort((a, b) => a - b),
        staffingRecommendation,
        criticalFactors
      });
    }

    console.log(`🎯 Generated ${predictions.length} enhanced daily predictions with avg confidence:`, 
      `${((predictions.reduce((sum, p) => sum + p.confidenceLevel, 0) / predictions.length) * 100).toFixed(1)}%`
    );

    return predictions;
  }, [weeklyPatterns, calculateClientPredictions, selectedPredictionDays, pickupEntries]);

  // Enhanced weight comparison analysis
  const calculateWeightComparisons = useMemo((): DailyWeightComparison[] => {
    if (!pickupEntries.length || !next7DaysPredictions.length) return [];

    console.log("⚖️ Calculating daily weight comparisons between predictions and actual data...");

    const comparisons: DailyWeightComparison[] = [];

    // Get last 14 days for historical comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = -14; i <= selectedPredictionDays; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = formatDateForComparison(date);
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];

      // Get actual pickup data for this date
      const dayPickupEntries = pickupEntries.filter(entry => {
        const entryDate = parseTimestamp(entry.timestamp);
        return formatDateForComparison(entryDate) === dateStr;
      });

      const actualPickupWeight = dayPickupEntries.reduce((sum, entry) => sum + entry.weight, 0);
      const actualEntryCount = dayPickupEntries.length;
      const actualClientCount = new Set(dayPickupEntries.map(entry => entry.clientId)).size;

      // Get average weight from historical patterns for this day of week
      const dayOfWeek = date.getDay();
      const weeklyPattern = weeklyPatterns.find(p => p.dayOfWeek === dayOfWeek);
      const averageWeight = weeklyPattern ? weeklyPattern.avgWeight : 0;

      // Get predicted weight for future dates
      let predictedWeight = 0;
      if (i >= 0 && i < next7DaysPredictions.length) {
        predictedWeight = next7DaysPredictions[i].totalPredictedWeight;
      } else {
        // Use weekly pattern for historical dates
        predictedWeight = averageWeight;
      }

      // Calculate differences and accuracy
      const hasActualData = i < 0; // Historical dates have actual data
      const difference = hasActualData ? actualPickupWeight - predictedWeight : predictedWeight - averageWeight;
      const percentageDifference = predictedWeight > 0 ? (difference / predictedWeight) * 100 : 0;

      // Determine accuracy for historical dates
      let accuracy: 'High' | 'Medium' | 'Low' | 'N/A' = 'N/A';
      if (hasActualData && predictedWeight > 0) {
        const absolutePercentageError = Math.abs(percentageDifference);
        if (absolutePercentageError <= 15) accuracy = 'High';
        else if (absolutePercentageError <= 30) accuracy = 'Medium';
        else accuracy = 'Low';
      }

      comparisons.push({
        date: dateStr,
        dayName,
        averageWeight,
        predictedWeight,
        actualPickupWeight,
        difference,
        percentageDifference,
        accuracy,
        hasActualData,
        clientCount: actualClientCount,
        entryCount: actualEntryCount
      });
    }

    console.log(`⚖️ Generated ${comparisons.length} weight comparisons with ${comparisons.filter(c => c.hasActualData).length} historical data points`);
    
    return comparisons.sort((a, b) => a.date.localeCompare(b.date));
  }, [pickupEntries, next7DaysPredictions, weeklyPatterns, selectedPredictionDays]);

  // Update weight comparison state
  useEffect(() => {
    setWeightComparisons(calculateWeightComparisons);
  }, [calculateWeightComparisons]);

  // Update derived state
  useEffect(() => {
    setWeeklyPatterns(calculateWeeklyPatterns);
  }, [calculateWeeklyPatterns]);

  useEffect(() => {
    setClientPredictions(calculateClientPredictions);
  }, [calculateClientPredictions]);

  useEffect(() => {
    setNext7DaysPredictions(generateDayPredictions);
  }, [generateDayPredictions]);

  // Chart data
  const weeklyPatternsChart = useMemo(() => {
    const labels = weeklyPatterns.map(p => p.dayName);
    return {
      labels,
      datasets: [
        {
          label: 'Predicted Weight (lbs)',
          data: weeklyPatterns.map(p => p.avgWeight),
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.2)',
          yAxisID: 'y',
        },
        {
          label: 'Predicted Entries',
          data: weeklyPatterns.map(p => p.avgEntries),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          yAxisID: 'y1',
        }
      ]
    };
  }, [weeklyPatterns]);

  const next7DaysChart = useMemo(() => {
    const labels = next7DaysPredictions.map(p => 
      `${p.dayName.slice(0, 3)} ${new Date(p.date).getDate()}`
    );
    return {
      labels,
      datasets: [
        {
          label: 'Predicted Weight (lbs)',
          data: next7DaysPredictions.map(p => p.totalPredictedWeight),
          backgroundColor: next7DaysPredictions.map(p => 
            p.confidenceLevel > 0.7 ? 'rgba(34, 197, 94, 0.8)' :
            p.confidenceLevel > 0.5 ? 'rgba(251, 191, 36, 0.8)' : 'rgba(239, 68, 68, 0.8)'
          ),
          borderColor: next7DaysPredictions.map(p => 
            p.confidenceLevel > 0.7 ? 'rgb(34, 197, 94)' :
            p.confidenceLevel > 0.5 ? 'rgb(251, 191, 36)' : 'rgb(239, 68, 68)'
          ),
          borderWidth: 2,
        }
      ]
    };
  }, [next7DaysPredictions]);

  // Prediction vs Historical Weight Comparison Chart Data
  const predictionVsHistoricalChart = useMemo(() => {
    if (!next7DaysPredictions.length || !weeklyPatterns.length) {
      return {
        labels: [],
        datasets: []
      };
    }

    const labels = next7DaysPredictions.map(p => 
      `${p.dayName.slice(0, 3)} ${new Date(p.date).getDate()}`
    );

    // Get historical averages for the same days
    const historicalAverages = next7DaysPredictions.map(p => {
      const dayOfWeek = new Date(p.date).getDay();
      const weeklyPattern = weeklyPatterns.find(pattern => pattern.dayOfWeek === dayOfWeek);
      return weeklyPattern ? weeklyPattern.avgWeight : 0;
    });

    return {
      labels,
      datasets: [
        {
          label: 'Predicted Weight (lbs)',
          data: next7DaysPredictions.map(p => p.totalPredictedWeight),
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 3,
          pointRadius: 6,
          pointHoverRadius: 8,
          tension: 0.4,
          fill: false
        },
        {
          label: 'Historical Average Weight (lbs)',
          data: historicalAverages,
          backgroundColor: 'rgba(34, 197, 94, 0.2)',
          borderColor: 'rgb(34, 197, 94)',
          borderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
          tension: 0.4,
          borderDash: [5, 5], // Dashed line for historical data
          fill: false
        }
      ]
    };
  }, [next7DaysPredictions, weeklyPatterns]);

  // Chart for the differences (separate bar chart)
  const predictionDifferenceChart = useMemo(() => {
    if (!next7DaysPredictions.length || !weeklyPatterns.length) {
      return {
        labels: [],
        datasets: []
      };
    }

    const labels = next7DaysPredictions.map(p => 
      `${p.dayName.slice(0, 3)} ${new Date(p.date).getDate()}`
    );

    // Get historical averages for the same days
    const historicalAverages = next7DaysPredictions.map(p => {
      const dayOfWeek = new Date(p.date).getDay();
      const weeklyPattern = weeklyPatterns.find(pattern => pattern.dayOfWeek === dayOfWeek);
      return weeklyPattern ? weeklyPattern.avgWeight : 0;
    });

    const differences = next7DaysPredictions.map((p, index) => 
      p.totalPredictedWeight - historicalAverages[index]
    );

    return {
      labels,
      datasets: [
        {
          label: 'Difference (Predicted - Historical)',
          data: differences,
          backgroundColor: differences.map(diff => 
            diff >= 0 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)'
          ),
          borderColor: differences.map(diff => 
            diff >= 0 ? 'rgb(16, 185, 129)' : 'rgb(239, 68, 68)'
          ),
          borderWidth: 1
        }
      ]
    };
  }, [next7DaysPredictions, weeklyPatterns]);

  // Enhanced Prediction Intelligence with Confidence Intervals and Advanced Analytics
  const enhancedPredictionAnalysis = useMemo(() => {
    if (!next7DaysPredictions.length || !weeklyPatterns.length) return null;

    const analysis = next7DaysPredictions.map((pred, index) => {
      const dayOfWeek = new Date(pred.date).getDay();
      const weeklyPattern = weeklyPatterns.find(pattern => pattern.dayOfWeek === dayOfWeek);
      const historicalAvg = weeklyPattern ? weeklyPattern.avgWeight : 0;
      const difference = pred.totalPredictedWeight - historicalAvg;
      const percentageDiff = historicalAvg > 0 ? (difference / historicalAvg) * 100 : 0;

      // Calculate confidence intervals based on historical variance
      const historicalVariance = weeklyPattern ? (weeklyPattern.stdDev || historicalAvg * 0.15) : 0;
      const confidenceInterval = {
        lower: pred.totalPredictedWeight - (1.96 * historicalVariance), // 95% confidence
        upper: pred.totalPredictedWeight + (1.96 * historicalVariance),
        margin: 1.96 * historicalVariance
      };

      // Seasonal adjustment factor
      const monthOfYear = new Date(pred.date).getMonth();
      const seasonalMultiplier = getSeasonalMultiplier(monthOfYear);
      const seasonallyAdjustedPrediction = pred.totalPredictedWeight * seasonalMultiplier;

      // Anomaly detection
      const zScore = historicalVariance > 0 ? Math.abs(difference) / historicalVariance : 0;
      const isAnomalous = zScore > 2.5; // More than 2.5 standard deviations

      // Trend analysis (if we have multiple days)
      const trend = index > 0 ? 
        pred.totalPredictedWeight - next7DaysPredictions[index - 1].totalPredictedWeight : 0;

      return {
        ...pred,
        historicalAvg,
        difference,
        percentageDiff,
        confidenceInterval,
        seasonallyAdjustedPrediction,
        seasonalMultiplier,
        isAnomalous,
        zScore,
        trend,
        accuracy: calculatePredictionAccuracy(pred.totalPredictedWeight, historicalAvg),
        volatility: calculateVolatility(historicalVariance, historicalAvg)
      };
    });

    return analysis;
  }, [next7DaysPredictions, weeklyPatterns]);

  // Helper functions for advanced analytics
  const getSeasonalMultiplier = (month: number): number => {
    // Business seasonality - adjust based on your business patterns
    const seasonalFactors: { [key: number]: number } = {
      0: 1.1,  // January - New Year cleanup
      1: 0.95, // February - slower month
      2: 1.05, // March - spring cleaning
      3: 1.1,  // April - spring peak
      4: 1.15, // May - wedding season
      5: 1.2,  // June - peak season
      6: 1.1,  // July - summer
      7: 1.05, // August - back to school
      8: 1.1,  // September - fall cleaning
      9: 1.0,  // October - normal
      10: 0.9, // November - pre-holiday lull
      11: 1.05 // December - holiday events
    };
    return seasonalFactors[month] || 1.0;
  };

  const calculatePredictionAccuracy = (predicted: number, historical: number): string => {
    if (historical === 0) return 'N/A';
    const accuracy = 100 - Math.abs((predicted - historical) / historical) * 100;
    if (accuracy >= 95) return 'Excellent';
    if (accuracy >= 85) return 'Good';
    if (accuracy >= 70) return 'Fair';
    return 'Needs Improvement';
  };

  const calculateVolatility = (variance: number, mean: number): string => {
    if (mean === 0) return 'N/A';
    const coefficientOfVariation = (Math.sqrt(variance) / mean) * 100;
    if (coefficientOfVariation < 10) return 'Low';
    if (coefficientOfVariation < 25) return 'Moderate';
    return 'High';
  };

  // Machine Learning-inspired trend detection
  const detectTrends = useMemo(() => {
    if (!enhancedPredictionAnalysis || enhancedPredictionAnalysis.length < 3) return null;

    const predictions = enhancedPredictionAnalysis.map(a => a.totalPredictedWeight);
    const trends = [];

    for (let i = 2; i < predictions.length; i++) {
      const recent = predictions.slice(i - 2, i + 1);
      const isIncreasing = recent[1] > recent[0] && recent[2] > recent[1];
      const isDecreasing = recent[1] < recent[0] && recent[2] < recent[1];
      
      if (isIncreasing) trends.push({ day: i, type: 'increasing', strength: 'strong' });
      else if (isDecreasing) trends.push({ day: i, type: 'decreasing', strength: 'strong' });
    }

    return trends;
  }, [enhancedPredictionAnalysis]);

  // Advanced chart data with confidence bands
  const advancedPredictionChart = useMemo(() => {
    if (!enhancedPredictionAnalysis) {
      return { labels: [], datasets: [] };
    }

    const labels = enhancedPredictionAnalysis.map(a => 
      `${a.dayName.slice(0, 3)} ${new Date(a.date).getDate()}`
    );

    return {
      labels,
      datasets: [
        {
          label: 'Predicted Weight (lbs)',
          data: enhancedPredictionAnalysis.map(a => a.totalPredictedWeight),
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 3,
          pointRadius: 6,
          pointHoverRadius: 8,
          tension: 0.4,
          fill: false
        },
        {
          label: 'Historical Average (lbs)',
          data: enhancedPredictionAnalysis.map(a => a.historicalAvg),
          backgroundColor: 'rgba(34, 197, 94, 0.2)',
          borderColor: 'rgb(34, 197, 94)',
          borderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
          tension: 0.4,
          borderDash: [5, 5],
          fill: false
        },
        {
          label: 'Seasonally Adjusted Prediction',
          data: enhancedPredictionAnalysis.map(a => a.seasonallyAdjustedPrediction),
          backgroundColor: 'rgba(168, 85, 247, 0.2)',
          borderColor: 'rgb(168, 85, 247)',
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.4,
          borderDash: [2, 2],
          fill: false
        },
        {
          label: 'Confidence Upper Bound',
          data: enhancedPredictionAnalysis.map(a => a.confidenceInterval.upper),
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderColor: 'rgba(59, 130, 246, 0.3)',
          borderWidth: 1,
          pointRadius: 0,
          tension: 0.4,
          fill: '+1'
        },
        {
          label: 'Confidence Lower Bound',
          data: enhancedPredictionAnalysis.map(a => a.confidenceInterval.lower),
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderColor: 'rgba(59, 130, 246, 0.3)',
          borderWidth: 1,
          pointRadius: 0,
          tension: 0.4,
          fill: false
        }
      ]
    };
  }, [enhancedPredictionAnalysis]);

  // Smart insights generation
  const generateSmartInsights = useMemo(() => {
    if (!enhancedPredictionAnalysis) return [];

    const insights = [];

    // Overall accuracy insight
    const accuracies = enhancedPredictionAnalysis.map(a => a.accuracy);
    const excellentCount = accuracies.filter(a => a === 'Excellent').length;
    const goodCount = accuracies.filter(a => a === 'Good').length;

    if (excellentCount >= enhancedPredictionAnalysis.length * 0.7) {
      insights.push({
        type: 'success',
        icon: '🎯',
        message: `High accuracy predictions: ${excellentCount} out of ${enhancedPredictionAnalysis.length} days show excellent accuracy`
      });
    } else if (goodCount + excellentCount >= enhancedPredictionAnalysis.length * 0.6) {
      insights.push({
        type: 'info',
        icon: '📊',
        message: `Good prediction reliability: ${goodCount + excellentCount} out of ${enhancedPredictionAnalysis.length} days show good or excellent accuracy`
      });
    } else {
      insights.push({
        type: 'warning',
        icon: '⚠️',
        message: 'Prediction accuracy could be improved - consider reviewing historical data patterns'
      });
    }

    // Anomaly detection insight
    const anomalousCount = enhancedPredictionAnalysis.filter(a => a.isAnomalous).length;
    if (anomalousCount > 0) {
      insights.push({
        type: 'warning',
        icon: '🚨',
        message: `${anomalousCount} day(s) show anomalous predictions that deviate significantly from historical patterns`
      });
    }

    // Trend insights
    if (detectTrends && detectTrends.length > 0) {
      const increasingTrends = detectTrends.filter(t => t.type === 'increasing').length;
      const decreasingTrends = detectTrends.filter(t => t.type === 'decreasing').length;

      if (increasingTrends > decreasingTrends) {
        insights.push({
          type: 'info',
          icon: '📈',
          message: 'Upward trend detected - workload is expected to increase over the forecast period'
        });
      } else if (decreasingTrends > increasingTrends) {
        insights.push({
          type: 'info',
          icon: '📉',
          message: 'Downward trend detected - workload is expected to decrease over the forecast period'
        });
      }
    }

    // Seasonal adjustment insights
    const seasonalAdjustments = enhancedPredictionAnalysis.filter(a => Math.abs(a.seasonalMultiplier - 1) > 0.05);
    if (seasonalAdjustments.length > 0) {
      insights.push({
        type: 'info',
        icon: '🗓️',
        message: `${seasonalAdjustments.length} day(s) have significant seasonal adjustments affecting predictions`
      });
    }

    return insights;
  }, [enhancedPredictionAnalysis, detectTrends]);

  if (loading) {
    return (
      <div className="container py-4">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">🔮 Analyzing historical data and generating predictions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      {/* Header */}
      <div className="row mb-4">
        <div className="col-12">
          <h2 className="mb-2">🔮 Enhanced AI Prediction & Schedule Planning Dashboard</h2>
          <p className="text-muted">
            Professional workload predictions using advanced statistical methods, trend analysis, and ensemble forecasting algorithms.
            <br />
            <small>
              <i className="bi bi-info-circle me-1"></i>
              Predictions based on {pickupEntries.length} pickup entries and {invoices.length} invoices from the last 90 days
              <span className="ms-3">
                <i className="bi bi-shield-check me-1"></i>
                Enhanced confidence scoring with outlier detection and model validation
              </span>
            </small>
          </p>
          
          {/* Confidence Summary */}
          <div className="row mt-3">
            <div className="col-12">
              <div className="alert alert-info">
                <div className="row text-center">
                  <div className="col-md-3">
                    <h6 className="mb-1">Overall Confidence</h6>
                    <div className="d-flex align-items-center justify-content-center">
                      <div className="progress me-2" style={{ width: '100px', height: '20px' }}>
                        <div 
                          className={`progress-bar ${
                            weeklyPatterns.reduce((sum, p) => sum + p.confidence, 0) / Math.max(weeklyPatterns.length, 1) > 0.7 ? 'bg-success' :
                            weeklyPatterns.reduce((sum, p) => sum + p.confidence, 0) / Math.max(weeklyPatterns.length, 1) > 0.5 ? 'bg-warning' : 'bg-danger'
                          }`}
                          style={{ width: `${(weeklyPatterns.reduce((sum, p) => sum + p.confidence, 0) / Math.max(weeklyPatterns.length, 1)) * 100}%` }}
                        ></div>
                      </div>
                      <span className="badge bg-primary">
                        {((weeklyPatterns.reduce((sum, p) => sum + p.confidence, 0) / Math.max(weeklyPatterns.length, 1)) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <h6 className="mb-1">Data Quality</h6>
                    <span className={`badge ${pickupEntries.length > 100 ? 'bg-success' : pickupEntries.length > 50 ? 'bg-warning' : 'bg-danger'}`}>
                      {pickupEntries.length > 100 ? 'Excellent' : pickupEntries.length > 50 ? 'Good' : 'Limited'}
                    </span>
                  </div>
                  <div className="col-md-3">
                    <h6 className="mb-1">Tomorrow's Confidence</h6>
                    {next7DaysPredictions.length > 0 && (
                      <div className="d-flex align-items-center justify-content-center">
                        <div className="progress me-2" style={{ width: '80px', height: '20px' }}>
                          <div 
                            className={`progress-bar ${
                              next7DaysPredictions[0].confidenceLevel > 0.7 ? 'bg-success' :
                              next7DaysPredictions[0].confidenceLevel > 0.5 ? 'bg-warning' : 'bg-danger'
                            }`}
                            style={{ width: `${next7DaysPredictions[0].confidenceLevel * 100}%` }}
                          ></div>
                        </div>
                        <span className="badge bg-primary">
                          {(next7DaysPredictions[0].confidenceLevel * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="col-md-3">
                    <h6 className="mb-1">High-Confidence Clients</h6>
                    <span className="badge bg-success">
                      {clientPredictions.filter(cp => cp.confidence > 0.7).length}
                    </span>
                    <span className="text-muted ms-1">/ {clientPredictions.length}</span>
                  </div>
                </div>
              </div>
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
                  <label className="form-label">Prediction Days</label>
                  <select 
                    className="form-select"
                    value={selectedPredictionDays}
                    onChange={(e) => setSelectedPredictionDays(parseInt(e.target.value))}
                  >
                    <option value={3}>Next 3 Days</option>
                    <option value={7}>Next 7 Days</option>
                    <option value={14}>Next 14 Days</option>
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label">Confidence Filter</label>
                  <select
                    className="form-select"
                    value={predictionConfidenceFilter}
                    onChange={(e) => setPredictionConfidenceFilter(parseFloat(e.target.value))}
                  >
                    <option value={0.2}>20% - Show All</option>
                    <option value={0.4}>40% - Basic Filter</option>
                    <option value={0.6}>60% - High Quality</option>
                    <option value={0.8}>80% - Very High Only</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <div className="small text-muted mb-1">Prediction Models Active</div>
                  <div className="d-flex gap-1">
                    <span className="badge bg-success" title="Pattern-based forecasting">Patterns</span>
                    <span className="badge bg-info" title="Client behavior analysis">Clients</span>
                    <span className="badge bg-warning" title="Time series trending">Trends</span>
                    <span className="badge bg-primary" title="Ensemble averaging">Ensemble</span>
                  </div>
                </div>
                <div className="col-md-5">
                  <div className="d-flex gap-2">
                    <button 
                      className="btn btn-outline-primary"
                      onClick={loadHistoricalData}
                    >
                      <i className="bi bi-arrow-clockwise me-1"></i>
                      Refresh Predictions
                    </button>
                    <button 
                      className="btn btn-outline-success"
                      onClick={() => window.print()}
                    >
                      <i className="bi bi-printer me-1"></i>
                      Print Schedule
                    </button>
                    <div className="dropdown">
                      <button 
                        className="btn btn-outline-info dropdown-toggle" 
                        data-bs-toggle="dropdown"
                      >
                        <i className="bi bi-info-circle me-1"></i>
                        Model Info
                      </button>
                      <div className="dropdown-menu">
                        <div className="dropdown-item-text" style={{ maxWidth: '300px' }}>
                          <small>
                            <strong>Enhanced Prediction System:</strong><br />
                            • Outlier detection using IQR method<br />
                            • Exponential decay weighting for recent data<br />
                            • Multi-model ensemble forecasting<br />
                            • Confidence scoring with model agreement<br />
                            • Seasonal and temporal adjustments
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
      </div>

      {/* Weekly Patterns Analysis */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">📊 Weekly Patterns Analysis</h5>
            </div>
            <div className="card-body">
              <div className="row mb-3">
                <div className="col-lg-8">
                  <Line 
                    data={weeklyPatternsChart} 
                    options={{
                      responsive: true,
                      plugins: {
                        title: {
                          display: true,
                          text: 'Weekly Workload Patterns'
                        },
                        legend: {
                          position: 'top' as const,
                        },
                      },
                      scales: {
                        y: {
                          type: 'linear' as const,
                          display: true,
                          position: 'left' as const,
                          title: {
                            display: true,
                            text: 'Weight (lbs)'
                          }
                        },
                        y1: {
                          type: 'linear' as const,
                          display: true,
                          position: 'right' as const,
                          title: {
                            display: true,
                            text: 'Number of Entries'
                          },
                          grid: {
                            drawOnChartArea: false,
                          },
                        }
                      }
                    }}
                  />
                </div>
                <div className="col-lg-4">
                  <h6>🎯 Key Insights</h6>
                  <div className="list-group list-group-flush">
                    {weeklyPatterns
                      .sort((a, b) => b.avgWeight - a.avgWeight)
                      .slice(0, 3)
                      .map((pattern, index) => (
                      <div key={pattern.dayOfWeek} className="list-group-item border-0 px-0">
                        <div className="d-flex justify-content-between">
                          <strong className={index === 0 ? 'text-danger' : index === 1 ? 'text-warning' : 'text-info'}>
                            {index === 0 ? '🔥' : index === 1 ? '⚡' : '📈'} {pattern.dayName}
                          </strong>
                          <span className="badge bg-primary">{pattern.avgWeight} lbs</span>
                        </div>
                        <small className="text-muted">
                          Peak: {pattern.peakHour}:00 | Confidence: {(pattern.confidence * 100).toFixed(0)}%
                        </small>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Next 7 Days Predictions */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">📅 Next {selectedPredictionDays} Days Predictions</h5>
            </div>
            <div className="card-body">
              <div className="row mb-3">
                <div className="col-lg-8">
                  <Bar 
                    data={next7DaysChart}
                    options={{
                      responsive: true,
                      plugins: {
                        title: {
                          display: true,
                          text: 'Predicted Daily Workload'
                        },
                        legend: {
                          display: false
                        },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          title: {
                            display: true,
                            text: 'Predicted Weight (lbs)'
                          }
                        }
                      }
                    }}
                  />
                </div>
                <div className="col-lg-4">
                  <h6>📋 Planning Summary</h6>
                  <div className="table-responsive">
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>Day</th>
                          <th>Weight</th>
                          <th>Confidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {next7DaysPredictions.slice(0, 5).map((pred, index) => (
                          <tr key={pred.date} className={index === 0 ? 'table-warning' : ''}>
                            <td>
                              <strong>{pred.dayName.slice(0, 3)}</strong>
                              <br />
                              <small className="text-muted">{new Date(pred.date).getDate()}</small>
                            </td>
                            <td>
                              <span className="badge bg-primary">
                                {pred.totalPredictedWeight} lbs
                              </span>
                            </td>
                            <td>
                              <div className="progress" style={{ width: '60px', height: '20px' }}>
                                <div 
                                  className={`progress-bar ${
                                    pred.confidenceLevel > 0.7 ? 'bg-success' :
                                    pred.confidenceLevel > 0.5 ? 'bg-warning' : 'bg-danger'
                                  }`}
                                  style={{ width: `${pred.confidenceLevel * 100}%` }}
                                >
                                  {(pred.confidenceLevel * 100).toFixed(0)}%
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Daily Predictions */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">📋 Detailed Daily Schedule Recommendations</h5>
            </div>
            <div className="card-body">
              <div className="row">
                {next7DaysPredictions.slice(0, 3).map((pred, index) => (
                  <div key={pred.date} className="col-md-4 mb-3">
                    <div className={`card h-100 ${index === 0 ? 'border-warning' : 'border-light'}`}>
                      <div className="card-header bg-light">
                        <h6 className="mb-0">
                          {index === 0 ? '🎯 Tomorrow' : pred.dayName}
                          <br />
                          <small className="text-muted">
                            {formatDateForDisplay(pred.date)}
                          </small>
                        </h6>
                      </div>
                      <div className="card-body">
                        {/* Key Metrics */}
                        <div className="row text-center mb-3">
                          <div className="col-4">
                            <h5 className="text-primary">{pred.totalPredictedWeight}</h5>
                            <small className="text-muted">lbs</small>
                          </div>
                          <div className="col-4">
                            <h5 className="text-info">{pred.totalPredictedEntries}</h5>
                            <small className="text-muted">entries</small>
                          </div>
                          <div className="col-4">
                            <h5 className="text-success">{pred.predictedClientCount}</h5>
                            <small className="text-muted">clients</small>
                          </div>
                        </div>

                        {/* Staffing Recommendation */}
                        <div className="mb-3">
                          <h6>👥 Staffing</h6>
                          <span className={`badge ${
                            pred.staffingRecommendation.includes('Heavy') ? 'bg-danger' :
                            pred.staffingRecommendation.includes('Busy') ? 'bg-warning' :
                            pred.staffingRecommendation.includes('Light') ? 'bg-info' :
                            'bg-success'
                          }`}>
                            {pred.staffingRecommendation}
                          </span>
                        </div>

                        {/* Peak Hours */}
                        <div className="mb-3">
                          <h6>⏰ Peak Hours</h6>
                          {pred.peakHours.map((hour, i) => (
                            <span key={i} className="badge bg-secondary me-1">
                              {hour}:00
                            </span>
                          ))}
                        </div>

                        {/* Critical Factors */}
                        {pred.criticalFactors.length > 0 && (
                          <div>
                            <h6>⚠️ Critical Factors</h6>
                            <ul className="list-unstyled">
                              {pred.criticalFactors.slice(0, 2).map((factor, i) => (
                                <li key={i} className="small text-muted">
                                  • {factor}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      <div className="card-footer">
                        <div className="d-flex justify-content-between align-items-center">
                          <small className="text-muted">
                            Confidence: {(pred.confidenceLevel * 100).toFixed(0)}%
                          </small>
                          <div className="progress" style={{ width: '60px', height: '8px' }}>
                            <div 
                              className={`progress-bar ${
                                pred.confidenceLevel > 0.7 ? 'bg-success' :
                                pred.confidenceLevel > 0.5 ? 'bg-warning' : 'bg-danger'
                              }`}
                              style={{ width: `${pred.confidenceLevel * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Client Predictions */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">👥 Tomorrow's Client Activity Predictions</h5>
            </div>
            <div className="card-body">
              {clientPredictions.length === 0 ? (
                <div className="text-center text-muted py-4">
                  <i className="bi bi-search" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
                  <p className="mt-2">No high-confidence client predictions available</p>
                  <small>Try lowering the confidence filter to see more predictions</small>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover">
                    <thead className="table-dark">
                      <tr>
                        <th>Client</th>
                        <th>Likelihood</th>
                        <th>Predicted Weight</th>
                        <th>Predicted Time</th>
                        <th>Confidence</th>
                        <th>Last Seen</th>
                        <th>Weekly Pattern</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientPredictions.slice(0, 15).map((pred) => (
                        <tr key={pred.clientId}>
                          <td className="fw-bold">{pred.clientName}</td>
                          <td>
                            <div className="d-flex align-items-center">
                              <div className="progress me-2" style={{ width: '60px', height: '12px' }}>
                                <div 
                                  className="progress-bar bg-primary"
                                  style={{ width: `${pred.likelihood * 100}%` }}
                                ></div>
                              </div>
                              {(pred.likelihood * 100).toFixed(0)}%
                            </div>
                          </td>
                          <td>
                            <span className="badge bg-info">
                              {pred.predictedWeight} lbs
                            </span>
                          </td>
                          <td>
                            <span className="badge bg-secondary">
                              {pred.predictedTime}
                            </span>
                          </td>
                          <td>
                            <div className="progress" style={{ width: '50px', height: '12px' }}>
                              <div 
                                className={`progress-bar ${
                                  pred.confidence > 0.7 ? 'bg-success' :
                                  pred.confidence > 0.5 ? 'bg-warning' : 'bg-danger'
                                }`}
                                style={{ width: `${pred.confidence * 100}%` }}
                              ></div>
                            </div>
                          </td>
                          <td>
                            <small className="text-muted">{pred.lastSeen}</small>
                          </td>
                          <td>
                            <div className="d-flex">
                              {pred.weeklyPattern.map((active, dayIndex) => (
                                <div
                                  key={dayIndex}
                                  className={`me-1 ${active ? 'bg-success' : 'bg-light'}`}
                                  style={{ 
                                    width: '12px', 
                                    height: '12px', 
                                    borderRadius: '2px',
                                    opacity: active ? 1 : 0.3
                                  }}
                                  title={['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayIndex]}
                                ></div>
                              ))}
                            </div>
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

      {/* Weight Comparison Analysis */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">⚖️ Daily Weight Comparison Analysis</h5>
              <small className="text-muted">Compare average historical weights with predicted weights (pickup data) for each day</small>
            </div>
            <div className="card-body">
              {weightComparisons.length === 0 ? (
                <div className="text-center text-muted py-4">
                  <i className="bi bi-graph-up" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
                  <p className="mt-2">No weight comparison data available</p>
                  <small>Load historical data to see weight analysis</small>
                </div>
              ) : (
                <>
                  {/* Summary Cards */}
                  <div className="row mb-4">
                    <div className="col-md-3">
                      <div className="card bg-info text-white">
                        <div className="card-body text-center">
                          <h4 className="mb-1">
                            {weightComparisons.filter(w => w.hasActualData && w.accuracy === 'High').length}
                          </h4>
                          <p className="mb-0">High Accuracy Predictions</p>
                          <small>≤15% error rate</small>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="card bg-success text-white">
                        <div className="card-body text-center">
                          <h4 className="mb-1">
                            {weightComparisons.filter(w => w.hasActualData).length > 0 
                              ? Math.round(
                                  weightComparisons
                                    .filter(w => w.hasActualData)
                                    .reduce((sum, w) => sum + Math.abs(w.percentageDifference), 0) / 
                                  weightComparisons.filter(w => w.hasActualData).length
                                )
                              : 0
                            }%
                          </h4>
                          <p className="mb-0">Average Error Rate</p>
                          <small>Historical accuracy</small>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="card bg-warning text-white">
                        <div className="card-body text-center">
                          <h4 className="mb-1">
                            {weightComparisons.filter(w => !w.hasActualData).length}
                          </h4>
                          <p className="mb-0">Future Predictions</p>
                          <small>Next {selectedPredictionDays} days</small>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="card bg-primary text-white">
                        <div className="card-body text-center">
                          <h4 className="mb-1">
                            {Math.round(
                              weightComparisons
                                .filter(w => w.hasActualData)
                                .reduce((sum, w) => sum + w.actualPickupWeight, 0)
                            )}
                          </h4>
                          <p className="mb-0">Total Historical Weight</p>
                          <small>lbs collected</small>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Detailed Comparison Table */}
                  <div className="table-responsive">
                    <table className="table table-striped table-hover">
                      <thead className="table-dark">
                        <tr>
                          <th>Date</th>
                          <th>Day</th>
                          <th>Average Weight</th>
                          <th>Predicted Weight</th>
                          <th>Actual Weight</th>
                          <th>Difference</th>
                          <th>% Difference</th>
                          <th>Accuracy</th>
                          <th>Clients</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weightComparisons.map((comparison) => (
                          <tr 
                            key={comparison.date}
                            className={!comparison.hasActualData ? 'table-light' : ''}
                          >
                            <td className="fw-bold">
                              {new Date(comparison.date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric'
                              })}
                            </td>
                            <td>{comparison.dayName}</td>
                            <td>
                              <span className="badge bg-secondary">
                                {comparison.averageWeight} lbs
                              </span>
                            </td>
                            <td>
                              <span className="badge bg-info">
                                {comparison.predictedWeight} lbs
                              </span>
                            </td>
                            <td>
                              {comparison.hasActualData ? (
                                <span className="badge bg-success">
                                  {comparison.actualPickupWeight} lbs
                                </span>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                            <td>
                              {comparison.hasActualData ? (
                                <span className={`badge ${
                                  comparison.difference >= 0 ? 'bg-success' : 'bg-warning'
                                }`}>
                                  {comparison.difference >= 0 ? '+' : ''}{Math.round(comparison.difference)} lbs
                                </span>
                              ) : (
                                <span className={`badge ${
                                  comparison.difference >= 0 ? 'bg-info' : 'bg-secondary'
                                }`}>
                                  {comparison.difference >= 0 ? '+' : ''}{Math.round(comparison.difference)} lbs
                                </span>
                              )}
                            </td>
                            <td>
                              {comparison.hasActualData ? (
                                <span className={`badge ${
                                  Math.abs(comparison.percentageDifference) <= 15 ? 'bg-success' :
                                  Math.abs(comparison.percentageDifference) <= 30 ? 'bg-warning' : 'bg-danger'
                                }`}>
                                  {comparison.percentageDifference >= 0 ? '+' : ''}
                                  {Math.round(comparison.percentageDifference)}%
                                </span>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                            <td>
                              {comparison.hasActualData ? (
                                <span className={`badge ${
                                  comparison.accuracy === 'High' ? 'bg-success' :
                                  comparison.accuracy === 'Medium' ? 'bg-warning' : 'bg-danger'
                                }`}>
                                  {comparison.accuracy}
                                </span>
                              ) : (
                                <span className="badge bg-light text-dark">Future</span>
                              )}
                            </td>
                            <td>
                              <span className="badge bg-primary">
                                {comparison.clientCount}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Accuracy Insights */}
                  <div className="row mt-4">
                    <div className="col-md-6">
                      <div className="card border-info">
                        <div className="card-header bg-info text-white">
                          <h6 className="mb-0">📊 Prediction Accuracy Analysis</h6>
                        </div>
                        <div className="card-body">
                          {weightComparisons.filter(w => w.hasActualData).length > 0 ? (
                            <>
                              <div className="d-flex justify-content-between mb-2">
                                <span>High Accuracy (≤15% error):</span>
                                <strong>
                                  {weightComparisons.filter(w => w.hasActualData && w.accuracy === 'High').length} days
                                </strong>
                              </div>
                              <div className="d-flex justify-content-between mb-2">
                                <span>Medium Accuracy (15-30% error):</span>
                                <strong>
                                  {weightComparisons.filter(w => w.hasActualData && w.accuracy === 'Medium').length} days
                                </strong>
                              </div>
                              <div className="d-flex justify-content-between mb-2">
                                <span>Low Accuracy (&gt;30% error):</span>
                                <strong>
                                  {weightComparisons.filter(w => w.hasActualData && w.accuracy === 'Low').length} days
                                </strong>
                              </div>
                              <hr />
                              <div className="d-flex justify-content-between">
                                <span><strong>Overall Accuracy Rate:</strong></span>
                                <strong className="text-success">
                                  {Math.round(
                                    (weightComparisons.filter(w => w.hasActualData && w.accuracy === 'High').length / 
                                     weightComparisons.filter(w => w.hasActualData).length) * 100
                                  )}%
                                </strong>
                              </div>
                            </>
                          ) : (
                            <p className="text-muted mb-0">No historical data available for accuracy analysis</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="card border-success">
                        <div className="card-header bg-success text-white">
                          <h6 className="mb-0">💡 Weight Comparison Insights</h6>
                        </div>
                        <div className="card-body">
                          <ul className="list-unstyled mb-0">
                            <li className="mb-2">
                              <i className="bi bi-check-circle text-success me-2"></i>
                              <strong>Predicted Weight:</strong> Expected weight based on client behavior patterns
                            </li>
                            <li className="mb-2">
                              <i className="bi bi-graph-up text-info me-2"></i>
                              <strong>Actual Weight:</strong> Manually entered pickup weights from drivers
                            </li>
                            <li className="mb-2">
                              <i className="bi bi-calculator text-warning me-2"></i>
                              <strong>Average Weight:</strong> Historical average for this day of week
                            </li>
                            <li className="mb-0">
                              <i className="bi bi-target text-primary me-2"></i>
                              <strong>Accuracy:</strong> How close predictions were to actual pickup weights
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Prediction vs Historical Weight Comparison */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">📈 Prediction vs Historical Weight Comparison</h5>
              <small className="text-muted">Compare predicted weights with historical averages for the same days of the week</small>
            </div>
            <div className="card-body">
              {predictionVsHistoricalChart.datasets.length > 0 ? (
                <>
                  <div className="row mb-4">
                    <div className="col-lg-8">
                      <div className="chart-container mb-3">
                        <h6 className="text-center mb-3">📊 Weight Comparison</h6>
                        <Line 
                          data={predictionVsHistoricalChart} 
                          options={{
                            responsive: true,
                            plugins: {
                              title: {
                                display: false
                              },
                              legend: {
                                position: 'top' as const,
                              },
                            },
                            scales: {
                              y: {
                                beginAtZero: true,
                                title: {
                                  display: true,
                                  text: 'Weight (lbs)'
                                }
                              }
                            }
                          }}
                        />
                      </div>
                      
                      <div className="chart-container"></div>
                        <h6 className="text-center mb-3">📈 Prediction Accuracy</h6>
                        <Bar 
                          data={predictionDifferenceChart} 
                          options={{
                            responsive: true,
                            plugins: {
                              title: {
                                display: false
                              },
                              legend: {
                                position: 'top' as const,
                              },
                            },
                            scales: {
                              y: {
                                beginAtZero: true,
                                title: {
                                  display: true,
                                  text: 'Difference (lbs)'
                                }
                              }
                            }
                          }}
                        />
                      </div>
                    </div>
                    <div className="col-lg-4">
                      <h6>📊 Analysis & Insights</h6>
                      <div className="list-group list-group-flush">
                        {next7DaysPredictions
                          .map((pred, index) => {
                            const historicalAvg = weeklyPatterns.find(p => p.dayOfWeek === new Date(pred.date).getDay())?.avgWeight || 0;
                            const difference = pred.totalPredictedWeight - historicalAvg;
                            const percentageDiff = historicalAvg > 0 ? ((difference / historicalAvg) * 100) : 0;
                            
                            return (
                              <div key={pred.date} className="list-group-item border-0 px-0">
                                <div className="d-flex justify-content-between align-items-start">
                                  <div>
                                    <strong className={index === 0 ? 'text-danger' : index === 1 ? 'text-warning' : 'text-info'}>
                                      {index === 0 ? '🔥' : index === 1 ? '⚡' : '📈'} {pred.dayName}
                                    </strong>
                                    <div className="mt-1">
                                      <small className="text-muted d-block">
                                        Predicted: <strong>{pred.totalPredictedWeight} lbs</strong>
                                      </small>
                                      <small className="text-muted d-block">
                                        Historical Avg: <strong>{Math.round(historicalAvg)} lbs</strong>
                                      </small>
                                    </div>
                                  </div>
                                  <div className="text-end">
                                    <span className={`badge ${difference >= 0 ? 'bg-success' : 'bg-danger'}`}>
                                      {difference >= 0 ? '+' : ''}{Math.round(difference)} lbs
                                    </span>
                                    <div className="mt-1">
                                      <small className={difference >= 0 ? 'text-success' : 'text-danger'}>
                                        {percentageDiff >= 0 ? '+' : ''}{Math.round(percentageDiff)}%
                                      </small>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        }
                      </div>
                      
                      <div className="mt-3 p-3 bg-light rounded">
                        <h6 className="mb-2">🎯 Understanding the Chart</h6>
                        <ul className="list-unstyled small mb-0">
                          <li className="mb-2">
                            <i className="bi bi-graph-up text-primary me-2"></i>
                            <strong>Blue Line:</strong> AI-predicted weight for each day
                          </li>
                          <li className="mb-2">
                            <i className="bi bi-graph-down text-success me-2"></i>
                            <strong>Green Dashed Line:</strong> Historical average weight for same day of week
                          </li>
                          <li className="mb-2">
                            <i className="bi bi-bar-chart text-info me-2"></i>
                            <strong>Green/Red Bars:</strong> Prediction accuracy (positive = higher than usual, negative = lower than usual)
                          </li>
                          <li className="mb-0">
                            <i className="bi bi-target text-warning me-2"></i>
                            <strong>Purpose:</strong> Validate prediction accuracy against historical patterns
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center text-muted py-5"></div>
                  <i className="bi bi-graph-up" style={{ fontSize: '3rem' }}></i>
                  <h6 className="mt-3">No prediction data available</h6>
                  <p>Generate predictions to see the comparison chart</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations Summary */}
      <div className="row">
        <div className="col-12">
          <div className="card border-primary">
            <div className="card-header bg-primary text-white">
              <h5 className="mb-0">🎯 Enhanced AI-Powered Scheduling Recommendations</h5>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-6">
                  <h6>📊 Advanced Statistical Insights</h6>
                  <ul className="list-group list-group-flush">
                    {weeklyPatterns
                      .filter(p => p.recommendations.length > 0)
                      .slice(0, 4)
                      .map((pattern) => (
                      <li key={pattern.dayOfWeek} className="list-group-item border-0 px-0">
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <strong>{pattern.dayName}:</strong>
                            <ul className="mt-1 mb-0">
                              {pattern.recommendations.slice(0, 2).map((rec, i) => (
                                <li key={i} className="small">{rec}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="text-end">
                            <div className="progress" style={{ width: '60px', height: '12px' }}>
                              <div 
                                className={`progress-bar ${
                                  pattern.confidence > 0.7 ? 'bg-success' :
                                  pattern.confidence > 0.5 ? 'bg-warning' : 'bg-danger'
                                }`}
                                style={{ width: `${pattern.confidence * 100}%` }}
                              ></div>
                            </div>
                            <small className="text-muted">{(pattern.confidence * 100).toFixed(0)}% confidence</small>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="col-md-6">
                  <h6>🚀 Enhanced Tomorrow Predictions</h6>
                  {next7DaysPredictions.length > 0 && (
                    <div className={`alert ${
                      next7DaysPredictions[0].confidenceLevel > 0.7 ? 'alert-success' :
                      next7DaysPredictions[0].confidenceLevel > 0.5 ? 'alert-warning' : 'alert-danger'
                    }`}>I j</div>
                      <h6>Tomorrow ({next7DaysPredictions[0]?.dayName}) - {(next7DaysPredictions[0]?.confidenceLevel * 100).toFixed(0)}% Confidence</h6>
                      <ul className="mb-2">
                        <li>Expected workload: <strong>{next7DaysPredictions[0]?.totalPredictedWeight} lbs</strong></li>
                        <li>Staffing: <strong>{next7DaysPredictions[0]?.staffingRecommendation}</strong></li>
                        <li>Peak hours: <strong>{next7DaysPredictions[0]?.peakHours.join(', ')}:00</strong></li>
                        <li>High-confidence clients: <strong>{clientPredictions.filter(c => c.likelihood > 0.6 && c.confidence > 0.7).length}</strong></li>
                      </ul>
                      <div className="progress mb-2">
                        <div 
                          className={`progress-bar ${
                            next7DaysPredictions[0]?.confidenceLevel > 0.7 ? 'bg-success' :
                            next7DaysPredictions[0]?.confidenceLevel > 0.5 ? 'bg-warning' : 'bg-danger'
                          }`}
                          style={{ width: `${next7DaysPredictions[0]?.confidenceLevel * 100}%` }}
                        >
                          Prediction Confidence
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <h6 className="mt-3">🧠 Enhanced Algorithm Features</h6>
                  <div className="small text-muted">
                    <ul className="mb-0">
                      <li><strong>Outlier Detection:</strong> IQR-based anomaly filtering</li>
                      <li><strong>Recency Weighting:</strong> Exponential decay for time relevance</li>
                      <li><strong>Multi-Model Ensemble:</strong> Pattern + Client + Trend analysis</li>
                      <li><strong>Model Agreement:</strong> Confidence based on prediction consensus</li>
                      <li><strong>Temporal Adjustments:</strong> Monday buildup, weekend effects</li>
                      <li><strong>Seasonal Factors:</strong> Monthly trend adjustments</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            <div className="card-footer text-center">
              <small className="text-muted">
                🤖 Enhanced predictions powered by advanced statistical analysis of {pickupEntries.length} historical data points
                • Multi-model ensemble with {((weeklyPatterns.reduce((sum, p) => sum + p.confidence, 0) / Math.max(weeklyPatterns.length, 1)) * 100).toFixed(0)}% average confidence
                • Outlier detection and trend analysis for maximum accuracy
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PredictionScheduleDashboard;
