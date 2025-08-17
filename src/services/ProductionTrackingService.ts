// Production Tracking Service
// Real-time production rate tracking based on items added to invoices

import { collection, query, where, onSnapshot, Timestamp, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';

export interface ProductionEntry {
  id: string;
  invoiceId: string;
  clientId: string;
  clientName: string;
  cartId: string;
  cartName: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  addedBy: string;
  addedAt: Date;
  source: 'invoice_item';
}

export interface ProductionRate {
  productName: string;
  totalQuantity: number;
  entriesCount: number;
  firstEntry: Date;
  lastEntry: Date;
  durationMinutes: number;
  ratePerHour: number;
  ratePerMinute: number;
  isActive: boolean; // true if entries in last 30 minutes
  clientsCount: number; // number of different clients for this product
  avgQuantityPerEntry: number;
}

export interface ProductionSummary {
  totalItemsAdded: number; // total items added today
  totalUniqueProducts: number;
  activeProducts: number; // products with activity in last 30 minutes  
  topProductsByRate: ProductionRate[];
  recentEntries: ProductionEntry[];
  hourlyBreakdown: { [hour: string]: number }; // items per hour breakdown
  currentHourRate: number; // items per hour for current hour
  lastUpdate: Date;
}

class ProductionTrackingService {
  private static instance: ProductionTrackingService;
  private productionEntries: ProductionEntry[] = [];
  private listeners: ((summary: ProductionSummary) => void)[] = [];
  private isListening: boolean = false;

  private constructor() {}

  public static getInstance(): ProductionTrackingService {
    if (!ProductionTrackingService.instance) {
      ProductionTrackingService.instance = new ProductionTrackingService();
    }
    return ProductionTrackingService.instance;
  }

  /**
   * Start real-time tracking of production data from invoice items
   */
  public startTracking(): void {
    if (this.isListening) return;

    console.log('🏭 [Production Tracking] Starting real-time invoice item tracking');
    this.isListening = true;

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const todayStart = Timestamp.fromDate(today);
    const todayEnd = Timestamp.fromDate(tomorrow);

    // Listen to all invoices and extract items added today
    const invoicesQuery = query(
      collection(db, 'invoices'),
      orderBy('date', 'desc'),
      limit(500) // Get recent invoices to check for today's items
    );

    const unsubscribeInvoices = onSnapshot(invoicesQuery, (snapshot) => {
      const allEntries: ProductionEntry[] = [];
      const todayStartTime = today.getTime();
      const tomorrowStartTime = tomorrow.getTime();

      snapshot.docs.forEach(doc => {
        const invoiceData = doc.data();
        const invoiceId = doc.id;
        const clientId = invoiceData.clientId || '';
        const clientName = invoiceData.clientName || 'Unknown Client';
        const carts = invoiceData.carts || [];

        // Extract items from all carts in the invoice
        carts.forEach((cart: any) => {
          const cartId = cart.id || '';
          const cartName = cart.name || 'Unknown Cart';
          const items = cart.items || [];

          items.forEach((item: any) => {
            // Check if item was added today
            if (item.addedAt) {
              const itemAddedAt = new Date(item.addedAt);
              const itemTime = itemAddedAt.getTime();

              // Only include items added today
              if (itemTime >= todayStartTime && itemTime < tomorrowStartTime) {
                // Skip "Unknown" products
                if (!item.productName || 
                    item.productName.toLowerCase().includes('unknown') ||
                    !item.quantity || 
                    item.quantity <= 0) {
                  return;
                }

                allEntries.push({
                  id: `${invoiceId}-${cartId}-${item.productId}-${itemTime}`,
                  invoiceId,
                  clientId,
                  clientName,
                  cartId,
                  cartName,
                  productId: item.productId || '',
                  productName: item.productName || '',
                  quantity: Number(item.quantity) || 0,
                  price: Number(item.price) || 0,
                  addedBy: item.addedBy || 'Unknown',
                  addedAt: itemAddedAt,
                  source: 'invoice_item' as const
                });
              }
            }
          });
        });
      });

      console.log('🏭 [Production Tracking] Invoice items updated:', allEntries.length);
      this.updateProductionEntries(allEntries);
    });

    // Store unsubscribe function
    (this as any).unsubscribeFunctions = [unsubscribeInvoices];
  }

  /**
   * Stop tracking and clean up listeners
   */
  public stopTracking(): void {
    if (!this.isListening) return;

    console.log('🏭 [Production Tracking] Stopping production tracking');
    this.isListening = false;

    if ((this as any).unsubscribeFunctions) {
      (this as any).unsubscribeFunctions.forEach((unsubscribe: () => void) => {
        unsubscribe();
      });
      delete (this as any).unsubscribeFunctions;
    }

    this.productionEntries = [];
    this.listeners = [];
  }

  /**
   * Subscribe to production updates
   */
  public subscribe(callback: (summary: ProductionSummary) => void): () => void {
    this.listeners.push(callback);

    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  /**
   * Update production entries and notify listeners
   */
  private updateProductionEntries(newEntries: ProductionEntry[]): void {
    // Replace all entries
    this.productionEntries = [...newEntries];

    // Sort by timestamp (newest first)
    this.productionEntries.sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime());

    // Calculate production summary
    const summary = this.calculateProductionSummary();

    // Notify all listeners
    this.listeners.forEach(callback => {
      try {
        callback(summary);
      } catch (error) {
        console.error('🏭 [Production Tracking] Error in listener callback:', error);
      }
    });
  }

  /**
   * Calculate production rates and summary based on invoice items added today
   */
  private calculateProductionSummary(): ProductionSummary {
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const currentHour = now.getHours();
    const currentHourStart = new Date();
    currentHourStart.setHours(currentHour, 0, 0, 0);

    // Group entries by product name
    const productGroups = new Map<string, ProductionEntry[]>();
    const hourlyBreakdown: { [hour: string]: number } = {};
    let currentHourItems = 0;
    
    this.productionEntries.forEach(entry => {
      // Group by product
      const key = entry.productName.toLowerCase();
      if (!productGroups.has(key)) {
        productGroups.set(key, []);
      }
      productGroups.get(key)!.push(entry);

      // Count items by hour
      const entryHour = entry.addedAt.getHours();
      const hourKey = `${entryHour}:00`;
      hourlyBreakdown[hourKey] = (hourlyBreakdown[hourKey] || 0) + entry.quantity;
      
      // Count items in current hour
      if (entry.addedAt >= currentHourStart) {
        currentHourItems += entry.quantity;
      }
    });

    // Calculate production rates for each product
    const productionRates: ProductionRate[] = Array.from(productGroups.entries()).map(([productKey, entries]) => {
      // Sort entries by timestamp
      const sortedEntries = entries.sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime());
      
      const firstEntry = sortedEntries[0];
      const lastEntry = sortedEntries[sortedEntries.length - 1];
      const totalQuantity = entries.reduce((sum, entry) => sum + entry.quantity, 0);
      
      // Calculate duration (minimum 1 minute to avoid division by zero)
      const durationMs = Math.max(
        lastEntry.addedAt.getTime() - firstEntry.addedAt.getTime(),
        60000 // 1 minute minimum
      );
      const durationMinutes = durationMs / (1000 * 60);
      
      // Calculate rates
      const ratePerMinute = totalQuantity / durationMinutes;
      const ratePerHour = ratePerMinute * 60;
      
      // Check if product is currently active (entries in last 30 minutes)
      const isActive = entries.some(entry => entry.addedAt >= thirtyMinutesAgo);
      
      // Count unique clients for this product
      const uniqueClients = new Set(entries.map(entry => entry.clientId)).size;
      
      // Average quantity per entry
      const avgQuantityPerEntry = totalQuantity / entries.length;

      return {
        productName: firstEntry.productName, // Use original casing
        totalQuantity,
        entriesCount: entries.length,
        firstEntry: firstEntry.addedAt,
        lastEntry: lastEntry.addedAt,
        durationMinutes,
        ratePerHour,
        ratePerMinute,
        isActive,
        clientsCount: uniqueClients,
        avgQuantityPerEntry
      };
    });

    // Sort by rate per hour (descending) and then by total quantity
    productionRates.sort((a, b) => {
      if (a.ratePerHour !== b.ratePerHour) {
        return b.ratePerHour - a.ratePerHour;
      }
      return b.totalQuantity - a.totalQuantity;
    });

    // Get recent entries (last 50)
    const recentEntries = this.productionEntries.slice(0, 50);

    // Count active products
    const activeProducts = productionRates.filter(rate => rate.isActive).length;

    // Calculate current hour rate (items per hour based on current hour progress)
    const minutesIntoCurrentHour = now.getMinutes();
    const hoursIntoCurrentHour = minutesIntoCurrentHour / 60;
    const currentHourRate = hoursIntoCurrentHour > 0 ? currentHourItems / hoursIntoCurrentHour : 0;

    const summary: ProductionSummary = {
      totalItemsAdded: this.productionEntries.reduce((sum, entry) => sum + entry.quantity, 0),
      totalUniqueProducts: productGroups.size,
      activeProducts,
      topProductsByRate: productionRates.slice(0, 15), // Top 15 products
      recentEntries,
      hourlyBreakdown,
      currentHourRate,
      lastUpdate: now
    };

    console.log('🏭 [Production Summary]', {
      totalItemsAdded: summary.totalItemsAdded,
      totalUniqueProducts: summary.totalUniqueProducts,
      activeProducts: summary.activeProducts,
      currentHourRate: Math.round(summary.currentHourRate),
      topProductsCount: summary.topProductsByRate.length
    });

    return summary;
  }

  /**
   * Get current production summary (synchronous)
   */
  public getCurrentSummary(): ProductionSummary | null {
    if (this.productionEntries.length === 0) return null;
    return this.calculateProductionSummary();
  }

  /**
   * Get production rate for a specific product
   */
  public getProductionRate(productName: string): ProductionRate | null {
    const summary = this.getCurrentSummary();
    if (!summary) return null;

    const lowerProductName = productName.toLowerCase();
    return summary.topProductsByRate.find(rate => 
      rate.productName.toLowerCase().includes(lowerProductName)
    ) || null;
  }
}

export default ProductionTrackingService;
