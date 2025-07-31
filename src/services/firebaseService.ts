import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs,
  query,
  where,
  Timestamp,
  getDoc,
  writeBatch,
  setDoc,
  orderBy
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { Client, Product, Invoice, LaundryCart, Suggestion } from "../types";
import type { AppComponentKey } from "../permissions";

// Client operations
export const addClient = async (client: Omit<Client, "id">): Promise<string> => {
  try {
    console.log("Adding client to Firebase:", client);
    const docRef = await addDoc(collection(db, "clients"), client);
    console.log("Client added with ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Error adding client:", error);
    throw error;
  }
};

export const updateClient = async (clientId: string, client: any) => {
  const clientRef = doc(db, 'clients', clientId);
  // Sanitize client object to remove undefined fields
  // IMPORTANT: Only set defaults for fields that are explicitly provided
  // This prevents overwriting existing data when doing partial updates
  const clientUpdate: any = { ...client };
  
  // Only set defaults if these fields are explicitly included in the update
  if (client.hasOwnProperty('selectedProducts') && !client.selectedProducts) {
    clientUpdate.selectedProducts = [];
  }
  if (client.hasOwnProperty('isRented') && client.isRented === undefined) {
    clientUpdate.isRented = false;
  }
  
  const sanitizedClient = sanitizeForFirestore(clientUpdate);
  await updateDoc(clientRef, sanitizedClient);
};

export const deleteClient = async (clientId: string) => {
  await deleteDoc(doc(db, 'clients', clientId));
};

export const getClients = async (): Promise<Client[]> => {
  try {
    console.log("Fetching clients from Firebase");
    const querySnapshot = await getDocs(collection(db, "clients"));
    const clients = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Client[];
    console.log("Fetched clients:", clients);
    return clients;
  } catch (error) {
    console.error("Error fetching clients:", error);
    throw error;
  }
};

// Product operations
export const addProduct = async (product: Omit<Product, "id">): Promise<string> => {
  try {
    // Sanitize product object to remove undefined fields
    const sanitizedProduct = sanitizeForFirestore(product);
    console.log("Adding product to Firebase:", sanitizedProduct);
    const docRef = await addDoc(collection(db, "products"), sanitizedProduct);
    console.log("Product added with ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Error adding product:", error);
    throw error;
  }
};

export const updateProduct = async (productId: string, product: any) => {
  const productRef = doc(db, 'products', productId);
  await updateDoc(productRef, product);
};

export const deleteProduct = async (productId: string) => {
  await deleteDoc(doc(db, 'products', productId));
};

export const getProducts = async (): Promise<Product[]> => {
  try {
    console.log("Fetching products from Firebase");
    const querySnapshot = await getDocs(collection(db, "products"));
    const products = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Product[];
    console.log("Fetched products:", products);
    return products;
  } catch (error) {
    console.error("Error fetching products:", error);
    throw error;
  }
};

// Invoice operations
let nextInvoiceNumber = 56091;

export const getNextInvoiceNumber = async (): Promise<number> => {
  // Fetch all invoices and find the max invoiceNumber
  const querySnapshot = await getDocs(collection(db, "invoices"));
  let max = 56090;
  querySnapshot.forEach(doc => {
    const data = doc.data();
    if (typeof data.invoiceNumber === 'number' && data.invoiceNumber > max) {
      max = data.invoiceNumber;
    }
  });
  return max + 1;
};

export const addInvoice = async (invoice: Omit<Invoice, "id">): Promise<string> => {
  try {
    const invoiceNumber = (invoice as any).invoiceNumber || await getNextInvoiceNumber();
    const docRef = await addDoc(collection(db, "invoices"), { ...invoice, invoiceNumber });
    return docRef.id;
  } catch (error) {
    throw error;
  }
};

// User operations
export interface UserRecord {
  id: string;
  username: string;
  role: string;
  logoutTimeout?: number;
}

export type UserUpdate = Partial<UserRecord> & { allowedComponents?: AppComponentKey[]; defaultPage?: AppComponentKey; logoutTimeout?: number };

export const addUser = async (user: UserRecord): Promise<void> => {
  // Always set the id field to the intended login ID
  const sanitizedUser = sanitizeForFirestore({ ...user, id: user.id });
  await addDoc(collection(db, "users"), sanitizedUser);
};

export const getUsers = async (): Promise<UserRecord[]> => {
  const querySnapshot = await getDocs(collection(db, "users"));
  return querySnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: data.id, // Use the 4-digit login code, not doc.id
      username: data.username,
      role: data.role,
      allowedComponents: data.allowedComponents || undefined,
      defaultPage: data.defaultPage || undefined,
    };
  });
};

export const deleteUser = async (id: string): Promise<void> => {
  const q = query(collection(db, "users"), where("id", "==", id));
  const querySnapshot = await getDocs(q);
  for (const docSnap of querySnapshot.docs) {
    await deleteDoc(doc(db, "users", docSnap.id));
  }
};

export const updateUser = async (oldId: string, updates: UserUpdate): Promise<void> => {
  const q = query(collection(db, "users"), where("id", "==", oldId));
  const querySnapshot = await getDocs(q);
  const sanitizedUpdates = sanitizeForFirestore(updates);
  for (const docSnap of querySnapshot.docs) {
    await updateDoc(doc(db, "users", docSnap.id), sanitizedUpdates);
  }
};

// Utility to deeply sanitize invoice/cart data before sending to Firestore
function sanitizeForFirestore(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore);
  } else if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) continue; // Firestore does not allow undefined fields
      if (value === null) {
        sanitized[key] = null;
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeForFirestore(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
  return obj;
}

export const updateInvoice = async (
  invoiceId: string,
  invoice: Partial<Invoice>
): Promise<void> => {
  try {
    console.log("🔥 Firebase updateInvoice called:", { invoiceId, invoice });
    const invoiceRef = doc(db, "invoices", invoiceId);
    const invoiceDoc = await getDoc(invoiceRef);
    if (!invoiceDoc.exists()) {
      console.error("❌ Invoice does not exist:", invoiceId);
      throw new Error(`Invoice with ID ${invoiceId} does not exist`);
    }
    
    // Sanitize invoice data before sending to Firestore
    const sanitizedInvoice = sanitizeForFirestore({
      ...invoice,
      updatedAt: new Date().toISOString(),
    });
    
    console.log("💾 Writing to Firestore:", { invoiceId, sanitizedInvoice });
    await updateDoc(invoiceRef, sanitizedInvoice);
    console.log("✅ Invoice updated successfully in Firestore");
  } catch (error) {
    console.error("❌ Error updating invoice:", error);
    throw error;
  }
};

export const assignCartToInvoice = async (
  invoiceId: string,
  cart: { id: string; name: string }
): Promise<void> => {
  const invoiceRef = doc(db, "invoices", invoiceId);
  await updateDoc(invoiceRef, {
    cart,
    updatedAt: new Date().toISOString(),
  });
};

export const deleteInvoice = async (invoiceId: string) => {
  await deleteDoc(doc(db, 'invoices', invoiceId));
};

export const getInvoices = async (): Promise<Invoice[]> => {
  try {
    console.log("Fetching invoices from Firebase");
    const querySnapshot = await getDocs(collection(db, "invoices"));
    const invoices = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Invoice[];
    console.log("Fetched invoices:", invoices);
    return invoices;
  } catch (error) {
    console.error("Error fetching invoices:", error);
    throw error;
  }
};

// Image upload
export const uploadImage = async (file: File, path: string): Promise<string> => {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
};

// Pickup Entry operations
// Export logActivity so it can be used in Segregation
export async function logActivity({ type, message, user }: { type: string; message: string; user?: string }) {
  try {
    await addDoc(collection(db, "activity_log"), {
      type,
      message,
      user: user || null,
      createdAt: Timestamp.now(),
    });
  } catch (e) {
    // Silent fail for logging
  }
}

// Cleanup old activity logs (older than 15 days)
export async function cleanupOldActivityLogs() {
  try {
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
    const cutoffTimestamp = Timestamp.fromDate(fifteenDaysAgo);
    
    const logsQuery = query(
      collection(db, "activity_log"),
      where("createdAt", "<", cutoffTimestamp)
    );
    
    const snapshot = await getDocs(logsQuery);
    
    if (snapshot.empty) {
      return; // No old logs to delete
    }
    
    // Use batch delete for better performance
    const batch = writeBatch(db);
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`Deleted ${snapshot.docs.length} old activity log entries`);
  } catch (error) {
    console.error("Error cleaning up old activity logs:", error);
  }
}

// User Session and Statistics Tracking
export interface UserSession {
  id: string;
  userId: string;
  username: string;
  loginTime: Timestamp;
  logoutTime?: Timestamp;
  duration?: number; // in milliseconds
  date: string; // YYYY-MM-DD format
  isActive: boolean;
  lastActivity: Timestamp;
  interactionCount: number;
}

export interface DailyUserStats {
  id: string;
  userId: string;
  username: string;
  date: string; // YYYY-MM-DD format
  totalLoginTime: number; // in milliseconds
  totalInteractions: number;
  sessionCount: number;
  firstLogin: Timestamp;
  lastLogout?: Timestamp;
  averageSessionDuration: number;
}

// Start a new user session
export async function startUserSession(userId: string, username: string): Promise<string> {
  try {
    const now = Timestamp.now();
    const today = new Date().toISOString().slice(0, 10);
    
    const sessionData: Omit<UserSession, 'id'> = {
      userId,
      username,
      loginTime: now,
      date: today,
      isActive: true,
      lastActivity: now,
      interactionCount: 0
    };
    
    const docRef = await addDoc(collection(db, "user_sessions"), sessionData);
    
    // Log the login activity
    await logActivity({
      type: "Login",
      message: `User ${username} logged in`,
      user: username
    });
    
    return docRef.id;
  } catch (error) {
    console.error("Error starting user session:", error);
    throw error;
  }
}

// End a user session
export async function endUserSession(sessionId: string, username?: string): Promise<void> {
  try {
    const sessionRef = doc(db, "user_sessions", sessionId);
    const sessionSnap = await getDoc(sessionRef);
    
    if (!sessionSnap.exists()) {
      console.warn(`Session ${sessionId} not found`);
      return;
    }
    
    const sessionData = sessionSnap.data() as UserSession;
    const now = Timestamp.now();
    const duration = now.toMillis() - sessionData.loginTime.toMillis();
    
    await updateDoc(sessionRef, {
      logoutTime: now,
      duration,
      isActive: false
    });
    
    // Update daily statistics
    await updateDailyUserStats(sessionData.userId, sessionData.username, sessionData.date, {
      sessionDuration: duration,
      interactions: sessionData.interactionCount,
      logoutTime: now
    });
    
    // Log the logout activity
    if (username) {
      await logActivity({
        type: "Logout",
        message: `User ${username} logged out (session duration: ${Math.round(duration / 60000)} minutes)`,
        user: username
      });
    }
  } catch (error) {
    console.error("Error ending user session:", error);
  }
}

// Update user activity (increment interaction count and update last activity time)
export async function updateUserActivity(sessionId: string): Promise<void> {
  try {
    const sessionRef = doc(db, "user_sessions", sessionId);
    const sessionSnap = await getDoc(sessionRef);
    
    if (!sessionSnap.exists()) {
      return;
    }
    
    const sessionData = sessionSnap.data() as UserSession;
    
    await updateDoc(sessionRef, {
      lastActivity: Timestamp.now(),
      interactionCount: (sessionData.interactionCount || 0) + 1
    });
  } catch (error) {
    console.error("Error updating user activity:", error);
  }
}

// Update daily user statistics
async function updateDailyUserStats(
  userId: string, 
  username: string, 
  date: string, 
  sessionData: { sessionDuration: number; interactions: number; logoutTime?: Timestamp }
): Promise<void> {
  try {
    const statsId = `${userId}_${date}`;
    const statsRef = doc(db, "daily_user_stats", statsId);
    const statsSnap = await getDoc(statsRef);
    
    if (statsSnap.exists()) {
      // Update existing stats
      const currentStats = statsSnap.data() as DailyUserStats;
      const newTotalLoginTime = currentStats.totalLoginTime + sessionData.sessionDuration;
      const newTotalInteractions = currentStats.totalInteractions + sessionData.interactions;
      const newSessionCount = currentStats.sessionCount + 1;
      
      await updateDoc(statsRef, {
        totalLoginTime: newTotalLoginTime,
        totalInteractions: newTotalInteractions,
        sessionCount: newSessionCount,
        lastLogout: sessionData.logoutTime,
        averageSessionDuration: newTotalLoginTime / newSessionCount
      });
    } else {
      // Create new stats entry
      const newStats: Omit<DailyUserStats, 'id'> = {
        userId,
        username,
        date,
        totalLoginTime: sessionData.sessionDuration,
        totalInteractions: sessionData.interactions,
        sessionCount: 1,
        firstLogin: Timestamp.now(),
        lastLogout: sessionData.logoutTime,
        averageSessionDuration: sessionData.sessionDuration
      };
      
      await setDoc(statsRef, newStats);
    }
  } catch (error) {
    console.error("Error updating daily user stats:", error);
  }
}

// Get daily user statistics for a specific date
export async function getDailyUserStats(date: string): Promise<DailyUserStats[]> {
  try {
    const q = query(
      collection(db, "daily_user_stats"),
      where("date", "==", date)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as DailyUserStats));
  } catch (error) {
    console.error("Error fetching daily user stats:", error);
    return [];
  }
}

// Get active user sessions
export async function getActiveUserSessions(): Promise<UserSession[]> {
  try {
    const q = query(
      collection(db, "user_sessions"),
      where("isActive", "==", true)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as UserSession));
  } catch (error) {
    console.error("Error fetching active user sessions:", error);
    return [];
  }
}

// Get user statistics for a date range
export async function getUserStatsDateRange(startDate: string, endDate: string): Promise<DailyUserStats[]> {
  try {
    const q = query(
      collection(db, "daily_user_stats"),
      where("date", ">=", startDate),
      where("date", "<=", endDate),
      orderBy("date", "desc")
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as DailyUserStats));
  } catch (error) {
    console.error("Error fetching user stats for date range:", error);
    return [];
  }
}

// Cleanup old user sessions and stats (older than 30 days)
export async function cleanupOldUserData() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString().slice(0, 10);
    
    // Cleanup old sessions
    const sessionsQuery = query(
      collection(db, "user_sessions"),
      where("date", "<", cutoffDate)
    );
    
    const sessionsSnapshot = await getDocs(sessionsQuery);
    
    if (!sessionsSnapshot.empty) {
      const sessionsBatch = writeBatch(db);
      sessionsSnapshot.docs.forEach((doc) => {
        sessionsBatch.delete(doc.ref);
      });
      await sessionsBatch.commit();
      console.log(`Deleted ${sessionsSnapshot.docs.length} old user session entries`);
    }
    
    // Cleanup old stats
    const statsQuery = query(
      collection(db, "daily_user_stats"),
      where("date", "<", cutoffDate)
    );
    
    const statsSnapshot = await getDocs(statsQuery);
    
    if (!statsSnapshot.empty) {
      const statsBatch = writeBatch(db);
      statsSnapshot.docs.forEach((doc) => {
        statsBatch.delete(doc.ref);
      });
      await statsBatch.commit();
      console.log(`Deleted ${statsSnapshot.docs.length} old user stats entries`);
    }
  } catch (error) {
    console.error("Error cleaning up old user data:", error);
  }
}

// Cleanup inactive sessions (sessions with no activity for > 1 hour)
export async function cleanupInactiveSessions() {
  try {
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    const cutoffTimestamp = Timestamp.fromDate(oneHourAgo);
    
    const inactiveSessionsQuery = query(
      collection(db, "user_sessions"),
      where("isActive", "==", true),
      where("lastActivity", "<", cutoffTimestamp)
    );
    
    const snapshot = await getDocs(inactiveSessionsQuery);
    
    if (!snapshot.empty) {
      const batch = writeBatch(db);
      const now = Timestamp.now();
      
      snapshot.docs.forEach((docSnap) => {
        const sessionData = docSnap.data() as UserSession;
        const duration = cutoffTimestamp.toMillis() - sessionData.loginTime.toMillis();
        
        // Mark session as inactive and set logout time
        batch.update(docSnap.ref, {
          isActive: false,
          logoutTime: cutoffTimestamp,
          duration
        });
        
        // Update daily stats for the inactive session
        updateDailyUserStats(sessionData.userId, sessionData.username, sessionData.date, {
          sessionDuration: duration,
          interactions: sessionData.interactionCount,
          logoutTime: cutoffTimestamp
        }).catch(console.error);
      });
      
      await batch.commit();
      console.log(`Cleaned up ${snapshot.docs.length} inactive sessions`);
    }
  } catch (error) {
    console.error("Error cleaning up inactive sessions:", error);
  }
}

// Get user session statistics summary
export async function getUserSessionSummary(userId: string, days: number = 7): Promise<{
  totalLoginTime: number;
  totalInteractions: number;
  totalSessions: number;
  averageSessionDuration: number;
  averageInteractionsPerDay: number;
  activeDays: number;
}> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const dateRange = Array.from({ length: days }, (_, i) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      return date.toISOString().slice(0, 10);
    });
    
    const statsPromises = dateRange.map(date => 
      getDailyUserStats(date).then(stats => 
        stats.find(stat => stat.userId === userId)
      )
    );
    
    const userStats = (await Promise.all(statsPromises)).filter(Boolean) as DailyUserStats[];
    
    const totalLoginTime = userStats.reduce((sum, stat) => sum + stat.totalLoginTime, 0);
    const totalInteractions = userStats.reduce((sum, stat) => sum + stat.totalInteractions, 0);
    const totalSessions = userStats.reduce((sum, stat) => sum + stat.sessionCount, 0);
    const activeDays = userStats.length;
    
    return {
      totalLoginTime,
      totalInteractions,
      totalSessions,
      averageSessionDuration: totalSessions > 0 ? totalLoginTime / totalSessions : 0,
      averageInteractionsPerDay: activeDays > 0 ? totalInteractions / activeDays : 0,
      activeDays
    };
  } catch (error) {
    console.error("Error getting user session summary:", error);
    return {
      totalLoginTime: 0,
      totalInteractions: 0,
      totalSessions: 0,
      averageSessionDuration: 0,
      averageInteractionsPerDay: 0,
      activeDays: 0
    };
  }
}

// --- AUTO-FIX SEGREGATED CARTS FOR TUNNEL CLIENTS (RUN ONCE ON APP START) ---
(async function autoFixSegregatedCartsForTunnelClients() {
  try {
    const groupsSnap = await getDocs(collection(db, 'pickup_groups'));
    for (const groupDoc of groupsSnap.docs) {
      const group = groupDoc.data();
      if (!group.clientId) continue;
      const clientSnap = await getDoc(doc(db, 'clients', group.clientId));
      if (!clientSnap.exists()) continue;
      const client = clientSnap.data();
      if (
        client.washingType === 'Tunnel' &&
        client.segregation === false &&
        typeof group.numCarts === 'number' &&
        group.segregatedCarts !== group.numCarts
      ) {
        await updateDoc(doc(db, 'pickup_groups', groupDoc.id), {
          segregatedCarts: group.numCarts,
        });
      }
    }
  } catch (e) {
    // Silent fail
  }
})();

// Call this after adding/removing carts for a group
export const updateSegregatedCartsIfTunnelNoSeg = async (groupId: string) => {
  const groupSnap = await getDoc(doc(db, 'pickup_groups', groupId));
  if (!groupSnap.exists()) return;
  const group = groupSnap.data();
  if (!group.clientId) return;
  const clientSnap = await getDoc(doc(db, 'clients', group.clientId));
  if (!clientSnap.exists()) return;
  const client = clientSnap.data();
  if (
    client.washingType === 'Tunnel' &&
    client.segregation === false &&
    Array.isArray(group.carts)
  ) {
    await updateDoc(doc(db, 'pickup_groups', groupId), {
      segregatedCarts: group.carts.length,
    });
  }
};

// Set segregatedCarts for a pickup group (used by Segregation page to persist value)
export const setSegregatedCarts = async (
  groupId: string,
  segregatedCarts: number
): Promise<void> => {
  await updateDoc(doc(db, 'pickup_groups', groupId), {
    segregatedCarts,
  });
};

// Avatar fallback utility for client avatars
export function getClientAvatarUrl(client: { imageUrl?: string }): string {
  if (client && typeof client.imageUrl === 'string' && client.imageUrl.trim() !== '') {
    return client.imageUrl;
  }
  return '/images/clients/default-avatar.png';
}

// Batch update all invoices that reference a product when the product is updated
export const propagateProductUpdateToInvoices = async (productId: string, updatedProduct: Partial<Product>) => {
  // Fetch all invoices
  const invoicesSnapshot = await getDocs(collection(db, "invoices"));
  const batchUpdates: Promise<any>[] = [];
  invoicesSnapshot.forEach((docSnap) => {
    const invoice = docSnap.data() as Invoice;
    let needsUpdate = false;
    // Update products array
    const newProducts = (invoice.products || []).map((p: any) => {
      if (p.id === productId) {
        needsUpdate = true;
        return { ...p, ...updatedProduct };
      }
      return p;
    });
    // Update carts/items
    const newCarts = (invoice.carts || []).map((cart: any) => ({
      ...cart,
      items: (cart.items || []).map((item: any) => {
        if (item.productId === productId) {
          needsUpdate = true;
          return {
            ...item,
            productName: updatedProduct.name ?? item.productName,
            price: updatedProduct.price ?? item.price,
          };
        }
        return item;
      }),
    }));
    if (needsUpdate) {
      batchUpdates.push(updateDoc(doc(db, "invoices", docSnap.id), {
        products: newProducts,
        carts: newCarts,
        updatedAt: new Date().toISOString(),
      }));
    }
  });
  await Promise.all(batchUpdates);
};

// Suggestions operations
export const addSuggestion = async (suggestion: Omit<Suggestion, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    const suggestionData = {
      ...suggestion,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    
    const docRef = await addDoc(collection(db, "suggestions"), suggestionData);
    console.log("Suggestion added with ID:", docRef.id);
    
    // Log activity
    await logActivity({
      type: "Suggestions",
      message: `New suggestion submitted: "${suggestion.title}" by ${suggestion.submittedByName}`,
      user: suggestion.submittedBy,
    });
    
    return docRef.id;
  } catch (error) {
    console.error("Error adding suggestion:", error);
    throw error;
  }
};

export const updateSuggestion = async (suggestionId: string, updates: Partial<Suggestion>): Promise<void> => {
  try {
    const suggestionRef = doc(db, "suggestions", suggestionId);
    const sanitizedUpdates = sanitizeForFirestore({
      ...updates,
      updatedAt: Timestamp.now(),
    });
    
    await updateDoc(suggestionRef, sanitizedUpdates);
    console.log("Suggestion updated:", suggestionId);
    
    // Log activity if status changed
    if (updates.status) {
      await logActivity({
        type: "Suggestions",
        message: `Suggestion "${updates.title || suggestionId}" status changed to ${updates.status}${updates.reviewedByName ? ` by ${updates.reviewedByName}` : ''}`,
        user: updates.reviewedBy || 'system',
      });
    }
  } catch (error) {
    console.error("Error updating suggestion:", error);
    throw error;
  }
};

export const deleteSuggestion = async (suggestionId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, "suggestions", suggestionId));
    console.log("Suggestion deleted:", suggestionId);
    
    await logActivity({
      type: "Suggestions",
      message: `Suggestion ${suggestionId} was deleted`,
      user: 'system',
    });
  } catch (error) {
    console.error("Error deleting suggestion:", error);
    throw error;
  }
};

export const getSuggestions = async (): Promise<Suggestion[]> => {
  try {
    console.log("Fetching suggestions from Firebase");
    const querySnapshot = await getDocs(collection(db, "suggestions"));
    const suggestions = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt),
      updatedAt: doc.data().updatedAt?.toDate?.() || new Date(doc.data().updatedAt),
    })) as Suggestion[];
    
    console.log("Fetched suggestions:", suggestions);
    return suggestions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error("Error fetching suggestions:", error);
    throw error;
  }
};

// Pickup Entry operations
export const addPickupEntry = async (entry: {
  clientId: string;
  clientName: string;
  driverId: string;
  driverName: string;
  groupId: string;
  weight: number;
  timestamp: Date | Timestamp;
  user?: string; // Optionally pass user info
}) => {
  try {
    const docToSend = {
      ...entry,
      timestamp: entry.timestamp instanceof Date ? Timestamp.fromDate(entry.timestamp) : entry.timestamp,
    };
    console.log("[addPickupEntry] Writing to Firestore:", docToSend);
    const docRef = await addDoc(collection(db, "pickup_entries"), docToSend);
    // Log the entry creation
    await logActivity({
      type: "Entradas",
      message: `Entrada creada para cliente ${entry.clientName} (${entry.clientId}), chofer ${entry.driverName}, peso: ${entry.weight} lbs`,
      user: entry.user,
    });
    return docRef;
  } catch (error) {
    console.error("Error adding pickup entry:", error, entry);
    throw error;
  }
};

// Update a pickup entry
export const updatePickupEntry = async (entryId: string, updates: Partial<{ weight: number }>) => {
  try {
    await updateDoc(doc(db, "pickup_entries", entryId), updates);
  } catch (error) {
    console.error("Error updating pickup entry:", error);
    throw error;
  }
};

// Delete a pickup entry
export const deletePickupEntry = async (entryId: string) => {
  try {
    await deleteDoc(doc(db, "pickup_entries", entryId));
  } catch (error) {
    console.error("Error deleting pickup entry:", error);
    throw error;
  }
};

// Pickup Group operations
export const addPickupGroup = async (group: {
  clientId: string;
  clientName: string;
  driverId: string;
  driverName: string;
  startTime: Date | Timestamp;
  endTime: Date | Timestamp;
  totalWeight: number;
  status: string;
  carts?: any[];
  entries?: any[];
}) => {
  try {
    // numCarts is the number of entries that belong to this group
    const numCarts = Array.isArray(group.entries) ? group.entries.length : 0;
    // Fetch client to check segregation and washingType
    let segregatedCarts: number | null = null;
    try {
      const clientSnap = await getDoc(doc(db, "clients", group.clientId));
      const client = clientSnap.exists() ? clientSnap.data() : null;
      // Always set segregatedCarts = numCarts for Tunnel clients that do not need segregation
      if (client && client.washingType === "Tunnel" && client.segregation === false) {
        segregatedCarts = numCarts;
      } else {
        segregatedCarts = null;
      }
    } catch (e) {
      // If client fetch fails, fallback to null
      segregatedCarts = null;
    }
    const docRef = await addDoc(collection(db, "pickup_groups"), {
      ...group,
      numCarts,
      segregatedCarts,
      startTime: group.startTime instanceof Timestamp ? group.startTime : Timestamp.fromDate(new Date(group.startTime)),
      endTime: group.endTime instanceof Timestamp ? group.endTime : Timestamp.fromDate(new Date(group.endTime)),
    });
    return docRef;
  } catch (error) {
    console.error("Error adding pickup group:", error);
    throw error;
  }
};

export const updatePickupGroupStatus = async (groupId: string, status: string) => {
  try {
    await updateDoc(doc(db, "pickup_groups", groupId), { status });
  } catch (error) {
    console.error("Error updating pickup group status:", error);
    throw error;
  }
};

export const getTodayPickupGroups = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const q = query(
    collection(db, "pickup_groups"),
    where("startTime", ">=", Timestamp.fromDate(today)),
    where("startTime", "<", Timestamp.fromDate(tomorrow))
  );
  const snap = await getDocs(q);
  return snap.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      startTime: data.startTime instanceof Timestamp ? data.startTime.toDate() : new Date(data.startTime),
      endTime: data.endTime instanceof Timestamp ? data.endTime.toDate() : new Date(data.endTime),
    };
  });
};

export const getAllPickupGroups = async () => {
  const snap = await getDocs(collection(db, "pickup_groups"));
  return snap.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      startTime: data.startTime instanceof Timestamp ? data.startTime.toDate() : new Date(data.startTime),
      endTime: data.endTime instanceof Timestamp ? data.endTime.toDate() : new Date(data.endTime),
    };
  });
};

// Add a manual conventional product entry
export const addManualConventionalProduct = async (entry: {
  clientId: string;
  clientName: string;
  productId: string;
  productName: string;
  quantity: number;
  type: 'lbs' | 'qty' | 'cart';
  createdAt?: Date;
}) => {
  const { clientId, clientName, productId, productName, quantity, type, createdAt } = entry;
  const docData = {
    clientId,
    clientName,
    productId,
    productName,
    quantity,
    type,
    createdAt: createdAt instanceof Timestamp ? createdAt : Timestamp.fromDate(createdAt ? new Date(createdAt) : new Date()),
  };
  return await addDoc(collection(db, 'manual_conventional_products'), docData);
};

// Get all manual conventional products for a given date (defaults to today)
export const getManualConventionalProductsForDate = async (date: Date = new Date()) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  const q = query(
    collection(db, 'manual_conventional_products'),
    where('createdAt', '>=', start),
    where('createdAt', '<', end)
  );
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Delete a manual conventional product by ID
export const deleteManualConventionalProduct = async (manualProductId: string) => {
  await deleteDoc(doc(db, 'manual_conventional_products', manualProductId));
};