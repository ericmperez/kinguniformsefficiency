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
  getDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { Client, Product, Invoice, LaundryCart } from "../types";
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
  const sanitizedClient = sanitizeForFirestore({
    ...client,
    selectedProducts: client.selectedProducts || [],
    isRented: client.isRented || false
  });
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
    // Assign invoiceNumber
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
}

export type UserUpdate = Partial<Omit<UserRecord, "id">> & { allowedComponents?: AppComponentKey[]; defaultPage?: AppComponentKey };

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
      id: doc.id, // Use Firestore doc.id as the user ID
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

export const updateUser = async (id: string, updates: UserUpdate): Promise<void> => {
  const q = query(collection(db, "users"), where("id", "==", id));
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
    console.log("Updating invoice in Firebase:", { invoiceId, invoice });
    const invoiceRef = doc(db, "invoices", invoiceId);
    const invoiceDoc = await getDoc(invoiceRef);
    if (!invoiceDoc.exists()) {
      throw new Error(`Invoice with ID ${invoiceId} does not exist`);
    }
    // Sanitize invoice data before sending to Firestore
    const sanitizedInvoice = sanitizeForFirestore({
      ...invoice,
      updatedAt: new Date().toISOString(),
    });
    await updateDoc(invoiceRef, sanitizedInvoice);
    console.log("Invoice updated successfully");
  } catch (error) {
    console.error("Error updating invoice:", error);
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
export const addPickupEntry = async (entry: {
  clientId: string;
  clientName: string;
  driverId: string;
  driverName: string;
  groupId: string;
  weight: number;
  timestamp: Date | Timestamp;
}) => {
  try {
    const docRef = await addDoc(collection(db, "pickup_entries"), {
      ...entry,
      timestamp: entry.timestamp instanceof Date ? Timestamp.fromDate(entry.timestamp) : entry.timestamp,
    });
    return docRef;
  } catch (error) {
    console.error("Error adding pickup entry:", error);
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
    const docRef = await addDoc(collection(db, "pickup_groups"), {
      ...group,
      numCarts,
      segregatedCarts: null,
      startTime: group.startTime instanceof Date ? Timestamp.fromDate(group.startTime) : group.startTime,
      endTime: group.endTime instanceof Date ? Timestamp.fromDate(group.endTime) : group.endTime,
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

export { uploadBytes, getDownloadURL };