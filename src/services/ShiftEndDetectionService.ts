// End-of-Shift Detection Service
// Detects when production groups have finished working for the day

import { collection, query, where, onSnapshot, Timestamp, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';

export interface ShiftStatus {
  isActive: boolean;
  lastActivity: Date;
  idleMinutes: number;
  estimatedEndTime: Date | null;
  confidence: 'high' | 'medium' | 'low';
}

export interface GroupShiftStatus {
  groupName: string;
  status: ShiftStatus;
  recentActivity: {
    lastEntry: Date;
    recentEntryCount: number;
    avgHourlyRate: number;
  };
}

export interface ShiftSummary {
  overallStatus: 'active' | 'winding-down' | 'finished';
  activeGroups: string[];
  finishedGroups: string[];
  windingDownGroups: string[];
  estimatedEndTime: Date | null; // Last item processed time
  productionStartTime: Date | null; // First item processed time
  productionDuration: number; // Hours from start to last item (not current time)
  totalIdleTime: number; // Time since last item (current time - last item time)
  lastUpdate: Date;
}

class ShiftEndDetectionService {
  private static instance: ShiftEndDetectionService;
  private listeners: ((summary: ShiftSummary) => void)[] = [];
  private isTracking: boolean = false;
  private currentSummary: ShiftSummary | null = null;

  // Configurable thresholds
  private readonly IDLE_THRESHOLD_MINUTES = 30; // Consider idle after 30 minutes
  private readonly WINDING_DOWN_THRESHOLD_MINUTES = 15; // Winding down after 15 minutes
  private readonly END_OF_SHIFT_THRESHOLD_MINUTES = 45; // Likely finished after 45 minutes
  private readonly MINIMUM_ACTIVITY_THRESHOLD = 5; // Minimum entries per hour to be considered active

  private constructor() {}

  public static getInstance(): ShiftEndDetectionService {
    if (!ShiftEndDetectionService.instance) {
      ShiftEndDetectionService.instance = new ShiftEndDetectionService();
    }
    return ShiftEndDetectionService.instance;
  }

  /**
   * Start monitoring for end-of-shift patterns
   */
  public startTracking(): void {
    if (this.isTracking) return;

    console.log('🏁 [Shift Detection] Starting end-of-shift tracking');
    this.isTracking = true;

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const todayStart = Timestamp.fromDate(today);
    const todayEnd = Timestamp.fromDate(tomorrow);

    // Listen to production data for end-of-shift detection
    const invoicesQuery = query(
      collection(db, 'invoices'),
      orderBy('date', 'desc'),
      limit(1000) // Get recent invoices
    );

    const unsubscribeInvoices = onSnapshot(invoicesQuery, (snapshot) => {
      this.analyzeShiftPatterns(snapshot, todayStart, todayEnd);
    });

    // Also listen to segregation logs for additional activity detection
    const segregationQuery = query(
      collection(db, 'segregation_done_logs'),
      where('timestamp', '>=', todayStart),
      where('timestamp', '<', todayEnd),
      orderBy('timestamp', 'desc')
    );

    const unsubscribeSegregation = onSnapshot(segregationQuery, (snapshot) => {
      // This will trigger re-analysis with updated segregation data
      console.log('🏁 [Shift Detection] Segregation activity detected:', snapshot.docs.length);
    });

    // Store cleanup functions
    (this as any).unsubscribeFunctions = [unsubscribeInvoices, unsubscribeSegregation];
  }

  /**
   * Stop tracking and cleanup
   */
  public stopTracking(): void {
    if (!this.isTracking) return;

    console.log('🏁 [Shift Detection] Stopping end-of-shift tracking');
    this.isTracking = false;

    if ((this as any).unsubscribeFunctions) {
      (this as any).unsubscribeFunctions.forEach((unsubscribe: () => void) => {
        unsubscribe();
      });
      delete (this as any).unsubscribeFunctions;
    }

    this.listeners = [];
    this.currentSummary = null;
  }

  /**
   * Subscribe to shift status updates
   */
  public subscribe(callback: (summary: ShiftSummary) => void): () => void {
    this.listeners.push(callback);

    // Send current summary if available
    if (this.currentSummary) {
      callback(this.currentSummary);
    }

    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  /**
   * Analyze production patterns using actual last item timestamps as production end times
   */
  private analyzeShiftPatterns(snapshot: any, todayStart: Timestamp, todayEnd: Timestamp): void {
    const now = new Date();
    const activities = new Map<string, Date[]>(); // group name -> activity times

    // Process invoice items for today
    snapshot.docs.forEach((doc: any) => {
      const invoiceData = doc.data();
      const carts = invoiceData.carts || [];

      carts.forEach((cart: any) => {
        const items = cart.items || [];
        items.forEach((item: any) => {
          if (item.addedAt) {
            const itemAddedAt = new Date(item.addedAt);
            const itemTime = itemAddedAt.getTime();
            const todayStartTime = todayStart.toMillis();
            const todayEndTime = todayEnd.toMillis();

            if (itemTime >= todayStartTime && itemTime < todayEndTime) {
              // Classify by production type (simplified groups)
              const productName = (item.productName || '').toLowerCase();
              let groupName = 'General Production';
              
              if (productName.includes('mangle') || productName.includes('sabana') || 
                  productName.includes('toalla') || productName.includes('towel')) {
                groupName = 'Mangle Team';
              } else if (productName.includes('doblado') || productName.includes('uniforme') || 
                        productName.includes('uniform') || productName.includes('scrub')) {
                groupName = 'Doblado Team';
              }

              if (!activities.has(groupName)) {
                activities.set(groupName, []);
              }
              activities.get(groupName)!.push(itemAddedAt);
            }
          }
        });
      });
    });

    // Analyze each group using their actual last item timestamp as the production end time
    const groupStatuses: GroupShiftStatus[] = [];
    const activeGroups: string[] = [];
    const finishedGroups: string[] = [];
    const windingDownGroups: string[] = [];

    activities.forEach((times, groupName) => {
      if (times.length === 0) return;

      // Sort times to get the actual first and last entries
      times.sort((a, b) => a.getTime() - b.getTime());
      
      const firstEntry = times[0]; // Production start time for this group
      const lastEntry = times[times.length - 1]; // Production END time for this group
      
      // Calculate how long ago the production ended (time since last item)
      const minutesSinceProductionEnded = (now.getTime() - lastEntry.getTime()) / (1000 * 60);
      
      // Calculate production statistics using actual production timespan
      const productionSpanHours = Math.max(
        (lastEntry.getTime() - firstEntry.getTime()) / (1000 * 60 * 60),
        0.5 // minimum 30 minutes
      );
      const avgHourlyRate = times.length / productionSpanHours;

      // Determine status based on how long ago production actually ended
      let status: 'active' | 'winding-down' | 'finished' = 'finished';
      let confidence: 'high' | 'medium' | 'low' = 'high';
      
      // Production ended at lastEntry time - classify based on recency
      if (minutesSinceProductionEnded < this.WINDING_DOWN_THRESHOLD_MINUTES) {
        status = 'active';
        activeGroups.push(groupName);
        confidence = 'high';
      } else if (minutesSinceProductionEnded < this.IDLE_THRESHOLD_MINUTES) {
        status = 'winding-down';
        windingDownGroups.push(groupName);
        confidence = 'medium';
      } else {
        status = 'finished';
        finishedGroups.push(groupName);
        confidence = 'high';
      }

      const groupStatus: GroupShiftStatus = {
        groupName,
        status: {
          isActive: status === 'active',
          lastActivity: lastEntry, // This is the actual production end time
          idleMinutes: minutesSinceProductionEnded,
          estimatedEndTime: lastEntry, // Production ended at last entry time
          confidence
        },
        recentActivity: {
          lastEntry: lastEntry,
          recentEntryCount: times.length,
          avgHourlyRate: Math.round(avgHourlyRate)
        }
      };

      // Store additional timing info for overall calculations
      (groupStatus as any).firstEntry = firstEntry;
      (groupStatus as any).productionSpanHours = productionSpanHours;

      groupStatuses.push(groupStatus);
    });

    // Determine overall status based on group statuses
    let overallStatus: 'active' | 'winding-down' | 'finished' = 'finished';
    if (activeGroups.length > 0) {
      overallStatus = 'active';
    } else if (windingDownGroups.length > 0) {
      overallStatus = 'winding-down';
    }

    // Find the latest production end time and earliest start time across all groups
    let latestProductionEndTime: Date | null = null;
    let earliestProductionStartTime: Date | null = null;
    
    if (groupStatuses.length > 0) {
      const allLastEntries = groupStatuses
        .map(g => g.status.lastActivity)
        .sort((a, b) => b.getTime() - a.getTime()); // Latest first
      
      const allFirstEntries = groupStatuses
        .map(g => (g as any).firstEntry) // Get the first entry we stored earlier
        .sort((a, b) => a.getTime() - b.getTime()); // Earliest first
      
      latestProductionEndTime = allLastEntries[0]; // Most recent production activity
      earliestProductionStartTime = allFirstEntries[0]; // Earliest production start
    }

    // Calculate production duration from start to END (not current time)
    const productionDuration = (latestProductionEndTime && earliestProductionStartTime) 
      ? (latestProductionEndTime.getTime() - earliestProductionStartTime.getTime()) / (1000 * 60 * 60)
      : 0;

    // Calculate total idle time (time since last activity across all groups)
    const totalIdleTime = latestProductionEndTime 
      ? Math.max(0, (now.getTime() - latestProductionEndTime.getTime()) / (1000 * 60))
      : 0;

    const summary: ShiftSummary = {
      overallStatus,
      activeGroups,
      finishedGroups,
      windingDownGroups,
      estimatedEndTime: latestProductionEndTime, // When production actually ended
      productionStartTime: earliestProductionStartTime, // When production started
      productionDuration, // Hours from start to END (not current time)
      totalIdleTime,
      lastUpdate: now
    };

    this.currentSummary = summary;

    // Log shift status for debugging
    console.log('🏁 [Shift Detection] Status Update:', {
      overallStatus,
      activeGroups: activeGroups.length,
      windingDownGroups: windingDownGroups.length,
      finishedGroups: finishedGroups.length,
      latestProductionEnd: latestProductionEndTime?.toLocaleTimeString(),
      totalIdleMinutes: Math.round(totalIdleTime)
    });

    // Notify listeners
    this.listeners.forEach(callback => {
      try {
        callback(summary);
      } catch (error) {
        console.error('🏁 [Shift Detection] Error in listener callback:', error);
      }
    });
  }

  /**
   * Get current shift summary (synchronous)
   */
  public getCurrentSummary(): ShiftSummary | null {
    return this.currentSummary;
  }

  /**
   * Check if a specific group is likely finished
   */
  public isGroupFinished(groupName: string): boolean {
    if (!this.currentSummary) return false;
    return this.currentSummary.finishedGroups.includes(groupName);
  }

  /**
   * Get estimated time until all groups finish
   */
  public getTimeUntilEndOfShift(): number | null {
    if (!this.currentSummary || !this.currentSummary.estimatedEndTime) return null;
    
    const now = new Date();
    const msUntilEnd = this.currentSummary.estimatedEndTime.getTime() - now.getTime();
    return Math.max(msUntilEnd / (1000 * 60), 0); // minutes
  }

  /**
   * Get activity level for a specific time range
   */
  public getActivityLevel(minutesAgo: number = 30): 'high' | 'medium' | 'low' | 'none' {
    if (!this.currentSummary) return 'none';

    const { activeGroups, windingDownGroups, finishedGroups } = this.currentSummary;
    
    if (activeGroups.length >= 2) return 'high';
    if (activeGroups.length === 1 || windingDownGroups.length > 0) return 'medium';
    if (windingDownGroups.length > 0) return 'low';
    return 'none';
  }
}

export default ShiftEndDetectionService;
