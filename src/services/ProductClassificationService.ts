// Product Classification Service
// Centralizes product classification logic with Firestore backend
// and localStorage fallback for offline functionality

import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  getDocs,
  query,
  where 
} from 'firebase/firestore';
import { db } from '../firebase';

export type ProductClassification = 'Mangle' | 'Doblado';

export interface ProductClassificationRecord {
  productName: string;
  classification: ProductClassification;
  isCustom: boolean; // true if manually set, false if using default rule
  lastModified: string;
  modifiedBy?: string; // user who made the change
}

export interface ClassificationStats {
  totalProducts: number;
  mangleProducts: number;
  dobladoProducts: number;
  customClassifications: number;
  defaultClassifications: number;
  lastSyncTime: string;
}

class ProductClassificationService {
  private static instance: ProductClassificationService;
  private classifications: Map<string, ProductClassificationRecord> = new Map();
  private listeners: ((classifications: Map<string, ProductClassificationRecord>) => void)[] = [];
  private firestoreListener: (() => void) | null = null;
  private isInitialized = false;
  private lastSyncTime: string = new Date().toISOString();

  // Firestore collection reference
  private readonly COLLECTION_NAME = 'product_classifications';

  private constructor() {
    this.initializeService();
  }

  public static getInstance(): ProductClassificationService {
    if (!ProductClassificationService.instance) {
      ProductClassificationService.instance = new ProductClassificationService();
    }
    return ProductClassificationService.instance;
  }

  // Default classification rules (same as current logic)
  private getDefaultClassification = (productName: string): ProductClassification => {
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
        name.includes('mantel') ||
        name.includes('toalla') ||
        name.includes('towel') ||
        name.includes('mangle')) {
      return 'Mangle';
    }
    
    // Everything else is Doblado (folding items)
    return 'Doblado';
  };

  // Initialize the service
  private async initializeService(): Promise<void> {
    try {
      console.log('🏷️ [ProductClassification] Initializing service...');

      // First, load from localStorage as fallback
      this.loadFromLocalStorage();

      // Then sync with Firestore
      await this.syncWithFirestore();

      // Set up real-time listener for Firestore changes
      this.setupFirestoreListener();

      this.isInitialized = true;
      console.log('🏷️ [ProductClassification] Service initialized successfully');
      
    } catch (error) {
      console.error('🏷️ [ProductClassification] Failed to initialize service:', error);
      // Continue with localStorage data if Firestore fails
      this.isInitialized = true;
    }
  }

  // Load classifications from localStorage (fallback/offline support)
  private loadFromLocalStorage(): void {
    try {
      const saved = localStorage.getItem('productClassifications');
      if (saved) {
        const localClassifications = JSON.parse(saved);
        
        // Convert old localStorage format to new format
        Object.entries(localClassifications).forEach(([productName, classification]) => {
          this.classifications.set(productName, {
            productName,
            classification: classification as ProductClassification,
            isCustom: true, // Assume localStorage entries are custom
            lastModified: new Date().toISOString(),
          });
        });

        console.log(`🏷️ [ProductClassification] Loaded ${this.classifications.size} classifications from localStorage`);
      }
    } catch (error) {
      console.error('🏷️ [ProductClassification] Error loading from localStorage:', error);
    }
  }

  // Sync with Firestore
  private async syncWithFirestore(): Promise<void> {
    try {
      const classificationsRef = collection(db, this.COLLECTION_NAME);
      const snapshot = await getDocs(classificationsRef);
      
      let firestoreCount = 0;
      snapshot.forEach((doc) => {
        const data = doc.data() as ProductClassificationRecord;
        this.classifications.set(data.productName, data);
        firestoreCount++;
      });

      this.lastSyncTime = new Date().toISOString();
      console.log(`🏷️ [ProductClassification] Synced ${firestoreCount} classifications from Firestore`);

      // If we have localStorage data that's not in Firestore, migrate it
      await this.migrateLocalStorageToFirestore();

    } catch (error) {
      console.error('🏷️ [ProductClassification] Error syncing with Firestore:', error);
    }
  }

  // Migrate localStorage data to Firestore
  private async migrateLocalStorageToFirestore(): Promise<void> {
    try {
      const saved = localStorage.getItem('productClassifications');
      if (!saved) return;

      const localClassifications = JSON.parse(saved);
      const migrations: Promise<void>[] = [];

      Object.entries(localClassifications).forEach(([productName, classification]) => {
        // Only migrate if not already in Firestore
        if (!this.classifications.has(productName)) {
          const record: ProductClassificationRecord = {
            productName,
            classification: classification as ProductClassification,
            isCustom: true,
            lastModified: new Date().toISOString(),
          };

          migrations.push(this.saveToFirestore(record));
        }
      });

      if (migrations.length > 0) {
        await Promise.all(migrations);
        console.log(`🏷️ [ProductClassification] Migrated ${migrations.length} classifications to Firestore`);
      }

    } catch (error) {
      console.error('🏷️ [ProductClassification] Error migrating localStorage data:', error);
    }
  }

  // Set up real-time listener for Firestore changes
  private setupFirestoreListener(): void {
    try {
      const classificationsRef = collection(db, this.COLLECTION_NAME);
      
      this.firestoreListener = onSnapshot(classificationsRef, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data() as ProductClassificationRecord;
          
          if (change.type === 'added' || change.type === 'modified') {
            this.classifications.set(data.productName, data);
          } else if (change.type === 'removed') {
            this.classifications.delete(data.productName);
          }
        });

        this.lastSyncTime = new Date().toISOString();
        this.notifyListeners();
        console.log('🏷️ [ProductClassification] Real-time update received');
      });

    } catch (error) {
      console.error('🏷️ [ProductClassification] Error setting up Firestore listener:', error);
    }
  }

  // Save classification to Firestore
  private async saveToFirestore(record: ProductClassificationRecord): Promise<void> {
    try {
      const docRef = doc(db, this.COLLECTION_NAME, record.productName);
      await setDoc(docRef, record);
      
      // Also update localStorage for offline support
      this.updateLocalStorage();
      
    } catch (error) {
      console.error('🏷️ [ProductClassification] Error saving to Firestore:', error);
      throw error;
    }
  }

  // Update localStorage with current classifications
  private updateLocalStorage(): void {
    try {
      const localFormat: { [key: string]: ProductClassification } = {};
      
      this.classifications.forEach((record, productName) => {
        localFormat[productName] = record.classification;
      });

      localStorage.setItem('productClassifications', JSON.stringify(localFormat));
    } catch (error) {
      console.error('🏷️ [ProductClassification] Error updating localStorage:', error);
    }
  }

  // Get classification for a product
  public getClassification(productName: string): ProductClassification {
    const record = this.classifications.get(productName);
    if (record) {
      return record.classification;
    }
    
    // Return default classification if not found
    return this.getDefaultClassification(productName);
  }

  // Set custom classification for a product
  public async setClassification(
    productName: string, 
    classification: ProductClassification,
    modifiedBy?: string
  ): Promise<void> {
    const record: ProductClassificationRecord = {
      productName,
      classification,
      isCustom: true,
      lastModified: new Date().toISOString(),
      modifiedBy,
    };

    // Update local cache immediately
    this.classifications.set(productName, record);
    this.notifyListeners();

    // Save to Firestore (async)
    try {
      await this.saveToFirestore(record);
      console.log(`🏷️ [ProductClassification] Updated ${productName} -> ${classification}`);
    } catch (error) {
      console.error(`🏷️ [ProductClassification] Failed to save ${productName}:`, error);
      // Could implement retry logic here
    }
  }

  // Remove custom classification (revert to default)
  public async removeCustomClassification(productName: string): Promise<void> {
    try {
      const docRef = doc(db, this.COLLECTION_NAME, productName);
      await setDoc(docRef, {
        productName,
        classification: this.getDefaultClassification(productName),
        isCustom: false,
        lastModified: new Date().toISOString(),
      });

      // Update local cache
      this.classifications.delete(productName);
      this.updateLocalStorage();
      this.notifyListeners();

      console.log(`🏷️ [ProductClassification] Removed custom classification for ${productName}`);
    } catch (error) {
      console.error(`🏷️ [ProductClassification] Failed to remove classification for ${productName}:`, error);
    }
  }

  // Get all classifications
  public getAllClassifications(): Map<string, ProductClassificationRecord> {
    return new Map(this.classifications);
  }

  // Get classifications in the old format (for compatibility)
  public getClassificationsCompatFormat(): { [key: string]: ProductClassification } {
    const result: { [key: string]: ProductClassification } = {};
    
    this.classifications.forEach((record, productName) => {
      result[productName] = record.classification;
    });

    return result;
  }

  // Get statistics
  public getStats(): ClassificationStats {
    const totalProducts = this.classifications.size;
    let mangleProducts = 0;
    let dobladoProducts = 0;
    let customClassifications = 0;

    this.classifications.forEach((record) => {
      if (record.classification === 'Mangle') mangleProducts++;
      else dobladoProducts++;
      
      if (record.isCustom) customClassifications++;
    });

    return {
      totalProducts,
      mangleProducts,
      dobladoProducts,
      customClassifications,
      defaultClassifications: totalProducts - customClassifications,
      lastSyncTime: this.lastSyncTime,
    };
  }

  // Subscribe to classification changes
  public subscribe(listener: (classifications: Map<string, ProductClassificationRecord>) => void): () => void {
    this.listeners.push(listener);

    // Send initial data if service is initialized
    if (this.isInitialized) {
      listener(this.classifications);
    }

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // Notify all listeners of changes
  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      listener(new Map(this.classifications));
    });
  }

  // Bulk import classifications
  public async bulkImportClassifications(
    classifications: { [key: string]: ProductClassification },
    modifiedBy?: string
  ): Promise<void> {
    const updates: Promise<void>[] = [];

    Object.entries(classifications).forEach(([productName, classification]) => {
      updates.push(this.setClassification(productName, classification, modifiedBy));
    });

    try {
      await Promise.all(updates);
      console.log(`🏷️ [ProductClassification] Bulk imported ${updates.length} classifications`);
    } catch (error) {
      console.error('🏷️ [ProductClassification] Bulk import failed:', error);
      throw error;
    }
  }

  // Wait for service to be initialized
  public async waitForInitialization(): Promise<void> {
    if (this.isInitialized) return;

    return new Promise((resolve) => {
      const checkInitialized = () => {
        if (this.isInitialized) {
          resolve();
        } else {
          setTimeout(checkInitialized, 100);
        }
      };
      checkInitialized();
    });
  }

  // Cleanup
  public destroy(): void {
    if (this.firestoreListener) {
      this.firestoreListener();
      this.firestoreListener = null;
    }
    this.listeners = [];
    this.classifications.clear();
    this.isInitialized = false;
  }
}

// Export singleton instance
export const productClassificationService = ProductClassificationService.getInstance();
export default ProductClassificationService;
