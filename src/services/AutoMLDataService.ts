// Automatic ML Data Collection Service
// Uses existing pickup data to automatically train ML models without manual entry

import { collection, query, where, getDocs, Timestamp, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import MachineLearningService from './MachineLearningService';

interface HistoricalPickupData {
  date: string;
  clientId: string;
  clientName: string;
  actualWeight: number;
  entryCount: number;
  averageEntryWeight: number;
  dayOfWeek: number;
  groupId: string;
}

interface PredictionComparison {
  date: string;
  clientId: string;
  clientName: string;
  predictedWeight: number;
  actualWeight: number;
  accuracy: number;
  dayOfWeek: number;
}

export class AutoMLDataService {
  private static instance: AutoMLDataService;
  private mlService: MachineLearningService;

  private constructor() {
    this.mlService = MachineLearningService.getInstance();
  }

  public static getInstance(): AutoMLDataService {
    if (!AutoMLDataService.instance) {
      AutoMLDataService.instance = new AutoMLDataService();
    }
    return AutoMLDataService.instance;
  }

  /**
   * Get historical pickup data from Firebase for a date range
   */
  public async getHistoricalPickupData(
    startDate: Date, 
    endDate: Date
  ): Promise<HistoricalPickupData[]> {
    console.log(`🔍 Fetching historical pickup data from ${startDate.toDateString()} to ${endDate.toDateString()}`);
    
    try {
      // Query pickup_entries for the date range
      const entriesQuery = query(
        collection(db, 'pickup_entries'),
        where('timestamp', '>=', Timestamp.fromDate(startDate)),
        where('timestamp', '<', Timestamp.fromDate(endDate)),
        orderBy('timestamp', 'asc')
      );

      const entriesSnapshot = await getDocs(entriesQuery);
      const entries = entriesSnapshot.docs.map(doc => {
        const data = doc.data();
        const timestamp = data.timestamp instanceof Timestamp ? data.timestamp.toDate() : new Date(data.timestamp);
        
        return {
          id: doc.id,
          clientId: data.clientId,
          clientName: data.clientName,
          weight: data.weight || 0,
          groupId: data.groupId,
          timestamp,
          date: timestamp.toISOString().split('T')[0],
          cartId: data.cartId || "",
        };
      });

      // Group entries by date and client
      const groupedData: { [key: string]: any[] } = {};
      
      entries.forEach(entry => {
        const key = `${entry.date}_${entry.clientId}`;
        if (!groupedData[key]) {
          groupedData[key] = [];
        }
        groupedData[key].push(entry);
      });

      // Convert grouped data to HistoricalPickupData
      const historicalData: HistoricalPickupData[] = [];

      Object.values(groupedData).forEach(clientEntries => {
        if (clientEntries.length === 0) return;

        const firstEntry = clientEntries[0];
        const totalWeight = clientEntries.reduce((sum, entry) => sum + entry.weight, 0);
        const averageWeight = totalWeight / clientEntries.length;
        const date = new Date(firstEntry.timestamp);

        historicalData.push({
          date: firstEntry.date,
          clientId: firstEntry.clientId,
          clientName: firstEntry.clientName,
          actualWeight: totalWeight,
          entryCount: clientEntries.length,
          averageEntryWeight: averageWeight,
          dayOfWeek: date.getDay(),
          groupId: firstEntry.groupId
        });
      });

      console.log(`✅ Found ${historicalData.length} historical pickup records`);
      return historicalData.sort((a, b) => a.date.localeCompare(b.date));

    } catch (error) {
      console.error('❌ Error fetching historical pickup data:', error);
      return [];
    }
  }

  /**
   * Generate predictions for historical dates and compare with actual data
   */
  public async performAutomaticMLTraining(daysBack: number = 30): Promise<PredictionComparison[]> {
    console.log(`🤖 Starting automatic ML training with ${daysBack} days of historical data...`);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Get historical actual data
    const historicalData = await this.getHistoricalPickupData(startDate, endDate);
    
    if (historicalData.length === 0) {
      console.log('⚠️ No historical data found for automatic training');
      return [];
    }

    // Generate predictions for each historical date/client and compare
    const comparisons: PredictionComparison[] = [];

    for (const record of historicalData) {
      try {
        // Generate a prediction for this date/client using current prediction logic
        const predictedWeight = await this.generatePredictionForDate(
          record.date,
          record.clientId,
          record.dayOfWeek
        );

        if (predictedWeight > 0) {
          const accuracy = (100 - Math.abs((predictedWeight - record.actualWeight) / record.actualWeight) * 100);
          
          comparisons.push({
            date: record.date,
            clientId: record.clientId,
            clientName: record.clientName,
            predictedWeight,
            actualWeight: record.actualWeight,
            accuracy: Math.max(0, accuracy), // Ensure accuracy is not negative
            dayOfWeek: record.dayOfWeek
          });

          // Record this outcome in the ML system for learning
          await this.mlService.recordPredictionOutcome(
            record.date,
            predictedWeight,
            record.actualWeight,
            'auto-historical'
          );
        }
      } catch (error) {
        console.error(`❌ Error processing record for ${record.date} - ${record.clientName}:`, error);
      }
    }

    console.log(`✅ Automatic ML training completed with ${comparisons.length} prediction comparisons`);
    return comparisons;
  }

  /**
   * Generate a prediction for a specific date/client using historical patterns
   */
  private async generatePredictionForDate(
    date: string, 
    clientId: string, 
    dayOfWeek: number
  ): Promise<number> {
    // This uses simple historical averaging as a baseline prediction
    // In a more sophisticated system, this would use your existing prediction algorithms
    
    try {
      // Get last 4 weeks of data for this client and day of week
      const lookbackDate = new Date(date);
      lookbackDate.setDate(lookbackDate.getDate() - 28); // 4 weeks back
      
      const historicalSamples = await this.getHistoricalPickupData(
        lookbackDate, 
        new Date(date)
      );

      // Filter for same client and same day of week
      const relevantSamples = historicalSamples.filter(record => 
        record.clientId === clientId && record.dayOfWeek === dayOfWeek
      );

      if (relevantSamples.length === 0) {
        // Fallback: use all data for this client
        const clientSamples = historicalSamples.filter(record => record.clientId === clientId);
        if (clientSamples.length > 0) {
          return clientSamples.reduce((sum, record) => sum + record.actualWeight, 0) / clientSamples.length;
        }
        return 0;
      }

      // Calculate weighted average (more recent data has higher weight)
      let totalWeight = 0;
      let totalWeightedValue = 0;

      relevantSamples.forEach((sample, index) => {
        const recencyWeight = index + 1; // More recent = higher weight
        totalWeight += recencyWeight;
        totalWeightedValue += sample.actualWeight * recencyWeight;
      });

      return totalWeight > 0 ? totalWeightedValue / totalWeight : 0;

    } catch (error) {
      console.error(`❌ Error generating prediction for ${date}:`, error);
      return 0;
    }
  }

  /**
   * Get accuracy summary for automatic learning
   */
  public async getAutomaticLearningStats(): Promise<{
    totalComparisons: number;
    averageAccuracy: number;
    accuracyByDayOfWeek: { [day: number]: number };
    recentAccuracy: number;
    improvementTrend: string;
  }> {
    // Perform training on last 14 days to get stats
    const comparisons = await this.performAutomaticMLTraining(14);
    
    if (comparisons.length === 0) {
      return {
        totalComparisons: 0,
        averageAccuracy: 0,
        accuracyByDayOfWeek: {},
        recentAccuracy: 0,
        improvementTrend: 'No data'
      };
    }

    const totalAccuracy = comparisons.reduce((sum, comp) => sum + comp.accuracy, 0);
    const averageAccuracy = totalAccuracy / comparisons.length;

    // Accuracy by day of week
    const accuracyByDay: { [day: number]: number[] } = {};
    comparisons.forEach(comp => {
      if (!accuracyByDay[comp.dayOfWeek]) {
        accuracyByDay[comp.dayOfWeek] = [];
      }
      accuracyByDay[comp.dayOfWeek].push(comp.accuracy);
    });

    const accuracyByDayOfWeek: { [day: number]: number } = {};
    Object.keys(accuracyByDay).forEach(day => {
      const dayNum = parseInt(day);
      const dayAccuracies = accuracyByDay[dayNum];
      accuracyByDayOfWeek[dayNum] = dayAccuracies.reduce((sum, acc) => sum + acc, 0) / dayAccuracies.length;
    });

    // Recent vs older accuracy comparison
    const sortedComparisons = comparisons.sort((a, b) => a.date.localeCompare(b.date));
    const midPoint = Math.floor(sortedComparisons.length / 2);
    const olderComparisons = sortedComparisons.slice(0, midPoint);
    const recentComparisons = sortedComparisons.slice(midPoint);

    const olderAccuracy = olderComparisons.length > 0 
      ? olderComparisons.reduce((sum, comp) => sum + comp.accuracy, 0) / olderComparisons.length 
      : 0;
    
    const recentAccuracy = recentComparisons.length > 0 
      ? recentComparisons.reduce((sum, comp) => sum + comp.accuracy, 0) / recentComparisons.length 
      : 0;

    const improvementTrend = recentAccuracy > olderAccuracy ? 'Improving' : 
                           recentAccuracy < olderAccuracy ? 'Declining' : 'Stable';

    return {
      totalComparisons: comparisons.length,
      averageAccuracy,
      accuracyByDayOfWeek,
      recentAccuracy,
      improvementTrend
    };
  }

  /**
   * Perform daily automatic learning (can be called on app startup or scheduled)
   */
  public async performDailyAutoLearning(): Promise<void> {
    console.log('🔄 Performing daily automatic ML learning...');
    
    try {
      // Train on last 7 days of data
      await this.performAutomaticMLTraining(7);
      
      console.log('✅ Daily automatic learning completed');
    } catch (error) {
      console.error('❌ Error in daily automatic learning:', error);
    }
  }
}

export default AutoMLDataService;
